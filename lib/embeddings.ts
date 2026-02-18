import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Lazy-loaded admin Supabase client
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase environment variables not configured");
    }

    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

// ============================================
// Embedding Generation
// ============================================

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_CHUNK_SIZE = 8000; // Characters per chunk (conservative for token limit)
const CHUNK_OVERLAP = 200; // Overlap between chunks for context continuity

export interface EmbeddingChunk {
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191), // Truncate to model limit
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const truncatedTexts = texts.map((t) => t.slice(0, 8191));

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedTexts,
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Split text into overlapping chunks for embedding
 */
export function chunkText(text: string, metadata: Record<string, unknown> = {}): EmbeddingChunk[] {
  if (text.length <= MAX_CHUNK_SIZE) {
    return [{ content: text, chunkIndex: 0, metadata }];
  }

  const chunks: EmbeddingChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + MAX_CHUNK_SIZE, text.length);

    // Try to break at sentence boundary
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
      metadata: { ...metadata, totalChunks: 0 }, // Will be updated
    });

    start = breakPoint - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    chunkIndex++;
  }

  // Update total chunks in metadata
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = chunks.length;
  });

  return chunks;
}

// ============================================
// Content Preparation for Different Sources
// ============================================

interface TranscriptData {
  id: number;
  user_id: string;
  title: string | null;
  sentences?: Array<{ speaker_name?: string; text?: string }> | null;
  ai_summary: string | null;
  ai_what_worked?: unknown[] | null;
  ai_improvement_areas?: unknown[] | null;
  ai_deal_risk_alerts?: unknown[] | null;
  ai_deal_signal?: string | null;
  ai_overall_score: number | null;
  duration?: number | null;
  created_at: string | null;
  participants?: string[] | null;
}

/**
 * Prepare transcript content for embedding
 */
export function prepareTranscriptContent(transcript: TranscriptData): string {
  const parts: string[] = [];

  // Title and metadata
  parts.push(`# ${transcript.title || "Untitled Call"}`);
  if (transcript.ai_overall_score !== null) {
    parts.push(`Score: ${transcript.ai_overall_score}/100`);
  }
  if (transcript.duration) {
    const mins = Math.round(transcript.duration);
    parts.push(`Duration: ${mins} minutes`);
  }
  if (transcript.created_at) {
    parts.push(`Date: ${new Date(transcript.created_at).toLocaleDateString()}`);
  }

  // Participants
  if (transcript.participants && transcript.participants.length > 0) {
    parts.push(`\nParticipants: ${transcript.participants.join(", ")}`);
  }

  // AI Summary
  if (transcript.ai_summary) {
    parts.push(`\n## Summary\n${transcript.ai_summary}`);
  }

  // What worked
  if (transcript.ai_what_worked && Array.isArray(transcript.ai_what_worked)) {
    parts.push(`\n## What Worked`);
    transcript.ai_what_worked.forEach((item) => {
      if (typeof item === "string") {
        parts.push(`- ${item}`);
      } else if (typeof item === "object" && item !== null) {
        parts.push(`- ${JSON.stringify(item)}`);
      }
    });
  }

  // Improvement areas
  if (transcript.ai_improvement_areas && Array.isArray(transcript.ai_improvement_areas)) {
    parts.push(`\n## Areas for Improvement`);
    transcript.ai_improvement_areas.forEach((item) => {
      if (typeof item === "string") {
        parts.push(`- ${item}`);
      } else if (typeof item === "object" && item !== null) {
        parts.push(`- ${JSON.stringify(item)}`);
      }
    });
  }

  // Deal risk alerts
  if (transcript.ai_deal_risk_alerts && Array.isArray(transcript.ai_deal_risk_alerts)) {
    parts.push(`\n## Deal Risk Alerts`);
    transcript.ai_deal_risk_alerts.forEach((alert) => {
      if (typeof alert === "string") {
        parts.push(`- ${alert}`);
      } else if (typeof alert === "object" && alert !== null) {
        parts.push(`- ${JSON.stringify(alert)}`);
      }
    });
  }

  // Transcript sentences (limited to prevent massive embeddings)
  if (transcript.sentences && Array.isArray(transcript.sentences)) {
    parts.push(`\n## Conversation`);
    const sentences = transcript.sentences.slice(0, 150); // Limit to 150 exchanges
    sentences.forEach((s) => {
      if (s.speaker_name && s.text) {
        parts.push(`${s.speaker_name}: ${s.text}`);
      }
    });
    if (transcript.sentences.length > 150) {
      parts.push(`... and ${transcript.sentences.length - 150} more exchanges`);
    }
  }

  return parts.join("\n");
}

interface CompanyData {
  id: string;
  user_id?: string;
  company_name: string | null;
  domain: string | null;
  company_goal_objective: string | null;
  pain_points: string[] | null;
  company_contacts: Array<{ name?: string; email?: string; title?: string }> | null;
  ai_recommendations: string[] | null;
  risk_summary: string[] | null;
  ai_relationship: string[] | null;
}

/**
 * Prepare company content for embedding
 */
export function prepareCompanyContent(company: CompanyData): string {
  const parts: string[] = [];

  parts.push(`# ${company.company_name || "Unknown Company"}`);
  if (company.domain) {
    parts.push(`Domain: ${company.domain}`);
  }

  if (company.company_goal_objective) {
    parts.push(`\n## Goal/Objective\n${company.company_goal_objective}`);
  }

  if (company.pain_points && company.pain_points.length > 0) {
    parts.push(`\n## Pain Points`);
    company.pain_points.forEach((p) => parts.push(`- ${p}`));
  }

  if (company.company_contacts && company.company_contacts.length > 0) {
    parts.push(`\n## Contacts`);
    company.company_contacts.forEach((c) => {
      const contact = [c.name, c.title, c.email].filter(Boolean).join(" - ");
      parts.push(`- ${contact}`);
    });
  }

  if (company.ai_recommendations && company.ai_recommendations.length > 0) {
    parts.push(`\n## AI Recommendations`);
    company.ai_recommendations.forEach((r) => parts.push(`- ${r}`));
  }

  if (company.risk_summary && company.risk_summary.length > 0) {
    parts.push(`\n## Risk Summary`);
    company.risk_summary.forEach((r) => parts.push(`- ${r}`));
  }

  if (company.ai_relationship && company.ai_relationship.length > 0) {
    parts.push(`\n## Relationship Insights`);
    company.ai_relationship.forEach((r) => parts.push(`- ${r}`));
  }

  return parts.join("\n");
}

// ============================================
// Ingestion Functions
// ============================================

/**
 * Ingest a transcript into the embeddings table
 */
export async function ingestTranscript(transcriptId: number): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Fetch transcript - only select needed fields to avoid loading huge sentences array
  const { data: transcript, error: fetchError } = await supabase
    .from("transcripts")
    .select("id, user_id, title, ai_overall_score, ai_summary, ai_what_worked, ai_improvement_areas, ai_deal_signal, ai_deal_risk_alerts, duration, participants, created_at")
    .eq("id", transcriptId)
    .single();

  if (fetchError || !transcript) {
    console.error("[Embeddings] Failed to fetch transcript:", fetchError);
    throw new Error(`Transcript ${transcriptId} not found`);
  }

  // Delete existing embeddings for this transcript
  await supabase
    .from("workspace_embeddings")
    .delete()
    .eq("source_type", "transcript")
    .eq("source_id", transcriptId.toString());

  // Prepare content and chunk it
  const content = prepareTranscriptContent(transcript as TranscriptData);
  const chunks = chunkText(content, {
    title: transcript.title,
    score: transcript.ai_overall_score,
    date: transcript.created_at,
  });

  // Process in batches of 10 to avoid OOM
  const EMBED_BATCH_SIZE = 10;
  let totalInserted = 0;

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeddings = await generateEmbeddings(batchChunks.map((c) => c.content));

    const rows = batchChunks.map((chunk, idx) => ({
      user_id: transcript.user_id,
      source_type: "transcript",
      source_id: transcriptId.toString(),
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      embedding: JSON.stringify(batchEmbeddings[idx]),
      metadata: chunk.metadata,
    }));

    const { error: insertError } = await supabase
      .from("workspace_embeddings")
      .insert(rows);

    if (insertError) {
      console.error("[Embeddings] Failed to insert batch:", insertError);
      throw insertError;
    }

    totalInserted += batchChunks.length;
    console.log(`[Embeddings] Transcript ${transcriptId}: batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1} done (${totalInserted}/${chunks.length} chunks)`);
  }

  console.log(`[Embeddings] Ingested transcript ${transcriptId} with ${chunks.length} chunks`);
}

/**
 * Ingest a company into the embeddings table
 */
export async function ingestCompany(companyId: string, userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Fetch company
  const { data: company, error: fetchError } = await supabase
    .from("external_org")
    .select("*")
    .eq("id", companyId)
    .single();

  if (fetchError || !company) {
    console.error("[Embeddings] Failed to fetch company:", fetchError);
    throw new Error(`Company ${companyId} not found`);
  }

  // Delete existing embeddings for this company
  await supabase
    .from("workspace_embeddings")
    .delete()
    .eq("source_type", "company")
    .eq("source_id", companyId);

  // Prepare content and chunk it
  const content = prepareCompanyContent(company);
  const chunks = chunkText(content, {
    company_name: company.company_name,
    domain: company.domain,
  });

  // Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  // Insert into database
  const rows = chunks.map((chunk, idx) => ({
    user_id: userId,
    source_type: "company",
    source_id: companyId,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[idx]),
    metadata: chunk.metadata,
  }));

  const { error: insertError } = await supabase
    .from("workspace_embeddings")
    .insert(rows);

  if (insertError) {
    console.error("[Embeddings] Failed to insert company embeddings:", insertError);
    throw insertError;
  }

  console.log(`[Embeddings] Ingested company ${companyId} with ${chunks.length} chunks`);
}

/**
 * Ingest all transcripts for a user (bulk ingestion)
 */
export async function ingestAllUserTranscripts(userId: string): Promise<{ processed: number; errors: number }> {
  const supabase = getSupabaseAdmin();

  // Fetch all transcripts for user
  const { data: transcripts, error } = await supabase
    .from("transcripts")
    .select("id")
    .eq("user_id", userId);

  if (error) {
    console.error("[Embeddings] Failed to fetch user transcripts:", error);
    throw error;
  }

  let processed = 0;
  let errors = 0;

  for (const transcript of transcripts || []) {
    try {
      await ingestTranscript(transcript.id);
      processed++;
    } catch (err) {
      console.error(`[Embeddings] Error ingesting transcript ${transcript.id}:`, err);
      errors++;
    }
  }

  console.log(`[Embeddings] Bulk ingestion complete: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}

// ============================================
// Semantic Search
// ============================================

export interface SearchResult {
  id: string;
  sourceType: "transcript" | "company" | "coaching_note";
  sourceId: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Semantic search across user's workspace
 */
export async function semanticSearch(
  userId: string,
  query: string,
  options: {
    limit?: number;
    sourceTypes?: ("transcript" | "company" | "coaching_note")[];
    minSimilarity?: number;
  } = {}
): Promise<SearchResult[]> {
  const { limit = 10, sourceTypes, minSimilarity = 0.3 } = options;

  const supabase = getSupabaseAdmin();

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Build the RPC query for similarity search
  const { data, error } = await supabase.rpc("search_workspace_embeddings", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: userId,
    match_count: limit,
    min_similarity: minSimilarity,
    source_types: sourceTypes || null,
  });

  if (error) {
    console.error("[Embeddings] Search error:", error);
    throw error;
  }

  return (data || []).map((row: {
    id: string;
    source_type: "transcript" | "company" | "coaching_note";
    source_id: string;
    content: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    content: row.content,
    similarity: row.similarity,
    metadata: row.metadata || {},
  }));
}

/**
 * Get relevant context for AI agent based on query
 */
export async function getRelevantContext(
  userId: string,
  query: string,
  maxChunks: number = 5
): Promise<string> {
  const results = await semanticSearch(userId, query, {
    limit: maxChunks,
    minSimilarity: 0.25,
  });

  if (results.length === 0) {
    return "No relevant context found in your workspace.";
  }

  // Group results by source
  const transcriptChunks: string[] = [];
  const companyChunks: string[] = [];
  const otherChunks: string[] = [];

  for (const result of results) {
    const header = `[Relevance: ${(result.similarity * 100).toFixed(0)}%]`;

    if (result.sourceType === "transcript") {
      const title = result.metadata.title || `Transcript #${result.sourceId}`;
      transcriptChunks.push(`### ${title}\n${header}\n${result.content.slice(0, 2000)}`);
    } else if (result.sourceType === "company") {
      const name = result.metadata.company_name || `Company #${result.sourceId}`;
      companyChunks.push(`### ${name}\n${header}\n${result.content.slice(0, 2000)}`);
    } else {
      otherChunks.push(`${header}\n${result.content.slice(0, 1000)}`);
    }
  }

  const parts: string[] = [];

  if (transcriptChunks.length > 0) {
    parts.push("## Relevant Call Transcripts\n" + transcriptChunks.join("\n\n---\n\n"));
  }

  if (companyChunks.length > 0) {
    parts.push("## Relevant Company Information\n" + companyChunks.join("\n\n---\n\n"));
  }

  if (otherChunks.length > 0) {
    parts.push("## Other Relevant Context\n" + otherChunks.join("\n\n"));
  }

  return parts.join("\n\n");
}
