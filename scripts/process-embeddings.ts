/**
 * Script to process embedding queue
 * Run with: npx tsx --env-file=.env scripts/process-embeddings.ts
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const BATCH_SIZE = 3; // Process fewer at a time to avoid memory issues
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 200;

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranscriptData {
  id: number;
  user_id: string;
  title: string | null;
  sentences: Array<{ speaker_name?: string; text?: string }> | null;
  ai_summary: string | null;
  ai_what_worked: unknown[] | null;
  ai_improvement_areas: unknown[] | null;
  ai_deal_risk_alerts: unknown[] | null;
  ai_overall_score: number | null;
  duration: number | null;
  created_at: string | null;
  participants: string[] | null;
}

// Chunk text for embedding
function chunkText(text: string, metadata: Record<string, unknown> = {}) {
  if (text.length <= MAX_CHUNK_SIZE) {
    return [{ content: text, chunkIndex: 0, metadata }];
  }

  const chunks: { content: string; chunkIndex: number; metadata: Record<string, unknown> }[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + MAX_CHUNK_SIZE, text.length);
    let breakPoint = end;

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const lastBreak = Math.max(lastPeriod, lastNewline);
      if (lastBreak > start + MAX_CHUNK_SIZE / 2) {
        breakPoint = lastBreak + 1;
      }
    }

    chunks.push({
      content: text.slice(start, breakPoint).trim(),
      chunkIndex,
      metadata: { ...metadata, totalChunks: 0 },
    });

    start = breakPoint - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    chunkIndex++;
  }

  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}

// Prepare transcript content
function prepareTranscriptContent(transcript: TranscriptData): string {
  const parts: string[] = [];

  parts.push(`# ${transcript.title || "Untitled Call"}`);
  if (transcript.ai_overall_score !== null) {
    parts.push(`Score: ${transcript.ai_overall_score}/100`);
  }
  if (transcript.duration) {
    parts.push(`Duration: ${Math.round(transcript.duration)} minutes`);
  }
  if (transcript.created_at) {
    parts.push(`Date: ${new Date(transcript.created_at).toLocaleDateString()}`);
  }

  if (transcript.participants && transcript.participants.length > 0) {
    parts.push(`\nParticipants: ${transcript.participants.join(", ")}`);
  }

  if (transcript.ai_summary) {
    parts.push(`\n## Summary\n${transcript.ai_summary}`);
  }

  if (transcript.ai_what_worked && Array.isArray(transcript.ai_what_worked)) {
    parts.push(`\n## What Worked`);
    transcript.ai_what_worked.forEach((item) => {
      parts.push(`- ${typeof item === "string" ? item : JSON.stringify(item)}`);
    });
  }

  if (transcript.ai_improvement_areas && Array.isArray(transcript.ai_improvement_areas)) {
    parts.push(`\n## Areas for Improvement`);
    transcript.ai_improvement_areas.forEach((item) => {
      parts.push(`- ${typeof item === "string" ? item : JSON.stringify(item)}`);
    });
  }

  if (transcript.ai_deal_risk_alerts && Array.isArray(transcript.ai_deal_risk_alerts)) {
    parts.push(`\n## Deal Risk Alerts`);
    transcript.ai_deal_risk_alerts.forEach((alert) => {
      parts.push(`- ${typeof alert === "string" ? alert : JSON.stringify(alert)}`);
    });
  }

  if (transcript.sentences && Array.isArray(transcript.sentences)) {
    parts.push(`\n## Conversation`);
    const sentences = transcript.sentences.slice(0, 50); // Limit to 50 to reduce memory
    sentences.forEach((s) => {
      if (s.speaker_name && s.text) {
        parts.push(`${s.speaker_name}: ${s.text}`);
      }
    });
    if (transcript.sentences.length > 50) {
      parts.push(`... and ${transcript.sentences.length - 50} more exchanges`);
    }
  }

  return parts.join("\n");
}

// Generate embeddings
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const truncatedTexts = texts.map((t) => t.slice(0, 8191));
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedTexts,
  });
  return response.data.map((d) => d.embedding);
}

// Process a single transcript
async function ingestTranscript(transcriptId: number): Promise<void> {
  // Fetch without sentences first (they can be huge)
  const { data: transcript, error: fetchError } = await supabase
    .from("transcripts")
    .select("id, user_id, title, ai_summary, ai_what_worked, ai_improvement_areas, ai_deal_risk_alerts, ai_overall_score, duration, created_at, participants")
    .eq("id", transcriptId)
    .single();

  if (fetchError || !transcript) {
    throw new Error(`Transcript ${transcriptId} not found`);
  }

  // Add empty sentences - we'll rely on AI summary for semantic search
  (transcript as TranscriptData).sentences = null;

  // Delete existing embeddings
  await supabase
    .from("workspace_embeddings")
    .delete()
    .eq("source_type", "transcript")
    .eq("source_id", transcriptId.toString());

  // Prepare and chunk content
  const content = prepareTranscriptContent(transcript as TranscriptData);
  const chunks = chunkText(content, {
    title: transcript.title,
    score: transcript.ai_overall_score,
    date: transcript.created_at,
  });

  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  // Insert into database
  const rows = chunks.map((chunk, idx) => ({
    user_id: transcript.user_id,
    source_type: "transcript",
    source_id: transcriptId.toString(),
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[idx]),
    metadata: chunk.metadata,
  }));

  const { error: insertError } = await supabase
    .from("workspace_embeddings")
    .insert(rows);

  if (insertError) {
    throw insertError;
  }

  console.log(`  ✓ Transcript ${transcriptId} indexed (${chunks.length} chunks)`);
}

// Main processing function
async function processQueue() {
  console.log("🚀 Starting embedding queue processing...\n");

  let processed = 0;
  let failed = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch pending items
    const { data: pendingItems, error: fetchError } = await supabase
      .from("embedding_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching queue:", fetchError);
      break;
    }

    if (!pendingItems || pendingItems.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${pendingItems.length} items...`);

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await supabase
          .from("embedding_queue")
          .update({ status: "processing", attempts: item.attempts + 1 })
          .eq("id", item.id);

        // Process
        if (item.source_type === "transcript") {
          await ingestTranscript(parseInt(item.source_id));
        }

        // Mark as completed
        await supabase
          .from("embedding_queue")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processed++;
      } catch (error) {
        console.error(`  ✗ Failed ${item.source_type} ${item.source_id}:`, error);

        const newStatus = item.attempts >= 3 ? "failed" : "pending";
        await supabase
          .from("embedding_queue")
          .update({
            status: newStatus,
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", item.id);

        failed++;
      }
    }

    console.log(`  Batch complete: ${processed} processed, ${failed} failed\n`);
  }

  console.log(`\n✅ Queue processing complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Failed: ${failed}`);
}

// Run
processQueue().catch(console.error);
