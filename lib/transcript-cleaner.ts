/**
 * Transcript Cleaner Module
 *
 * Ports the n8n workflow logic for cleaning and tagging raw call transcripts.
 * Handles speaker identification, filler removal, talk ratio calculation,
 * and [REP]/[PROSPECT] tagging for downstream AI extraction agents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CleanedTranscript {
  /** Tagged transcript lines: "[REP] Name: text\n[PROSPECT] Name: text\n..." */
  sentences_text: string;
  /** Number of cleaned sentences included in the output */
  sentence_count: number;
  /** Talk ratio breakdown between rep and prospect(s) */
  talk_ratio: {
    rep_percent: number;
    prospect_percent: number;
    rep_word_count: number;
    prospect_word_count: number;
    total_words: number;
    calculation_method: "time_based" | "word_based";
  };
  /** Call duration in minutes */
  duration_minutes: number;
  /** Participant identification results */
  participants: {
    rep: {
      name: string;
      email: string;
      transcript_speaker_name: string;
      company: string;
    };
    prospects: Array<{ name: string }>;
    identification_method: "name_match" | "company_match" | "first_speaker";
    identification_confidence: "high" | "medium" | "low";
    total_participants: number;
  };
}

export interface RawSentence {
  speaker_name?: string;
  text?: string;
  start_time?: number;
  end_time?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Regex for entire sentences that are pure filler / pleasantries and should
 * be dropped entirely. Anchored so it only matches when the *whole* sentence
 * is the filler phrase.
 */
const FILLER_SENTENCE_REGEX =
  /^(um+|uh+|hmm+|hello|hi|hey|thanks|thank you|can you hear me|yeah|yep|okay|ok|sure|right|got it|mm-hmm|mhm|uh-huh)\.?$/i;

/**
 * Inline filler words / phrases that should be stripped from within sentences.
 * We use word-boundary anchors so we don't corrupt real words.
 */
const INLINE_FILLER_REGEX =
  /\b(um|uh|like,|you know,|basically,|actually,|literally,|sort of|kind of|I mean,)\b/gi;

/** Minimum word count a sentence must have (after cleaning) to be kept. */
const MIN_WORD_COUNT = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate name variants for fuzzy speaker-to-rep matching.
 * Given "John Smith" and email "jsmith@acme.com" produces:
 *   ["john smith", "john", "smith", "jsmith"]
 */
function buildRepNameVariants(repName: string, repEmail: string): string[] {
  const variants: string[] = [];

  const normalised = repName.trim().toLowerCase();
  if (normalised) {
    variants.push(normalised);

    const parts = normalised.split(/\s+/);
    for (const part of parts) {
      if (part && !variants.includes(part)) {
        variants.push(part);
      }
    }
  }

  // Email prefix (before @)
  const atIndex = repEmail.indexOf("@");
  if (atIndex > 0) {
    const prefix = repEmail.substring(0, atIndex).toLowerCase();
    if (prefix && !variants.includes(prefix)) {
      variants.push(prefix);
    }
  }

  return variants;
}

/**
 * Normalise a speaker name for comparison (lowercase, trimmed).
 */
function normaliseSpeaker(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Count words in a string (splits on whitespace).
 */
function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Clean a single sentence text:
 *  1. Strip inline fillers
 *  2. Collapse extra whitespace
 *  3. Trim
 */
function cleanSentenceText(text: string): string {
  let cleaned = text.replace(INLINE_FILLER_REGEX, "");
  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

// ---------------------------------------------------------------------------
// Speaker Identification
// ---------------------------------------------------------------------------

interface IdentificationResult {
  repSpeakerName: string;
  method: "name_match" | "company_match" | "first_speaker";
  confidence: "high" | "medium" | "low";
}

function identifyRepSpeaker(
  sentences: RawSentence[],
  repName: string,
  repEmail: string,
  companyName: string
): IdentificationResult {
  // Collect unique speaker names from the transcript
  const uniqueSpeakers = new Set<string>();
  for (const s of sentences) {
    const name = normaliseSpeaker(s.speaker_name);
    if (name) uniqueSpeakers.add(name);
  }

  const speakerList = Array.from(uniqueSpeakers);

  // --- Strategy 1: Name match ---
  const nameVariants = buildRepNameVariants(repName, repEmail);
  for (const speaker of speakerList) {
    for (const variant of nameVariants) {
      if (speaker === variant || speaker.includes(variant) || variant.includes(speaker)) {
        return {
          repSpeakerName: speaker,
          method: "name_match",
          confidence: "high",
        };
      }
    }
  }

  // --- Strategy 2: Company name match ---
  if (companyName) {
    const companyFirstWord = companyName.trim().split(/\s+/)[0].toLowerCase();
    if (companyFirstWord) {
      for (const speaker of speakerList) {
        if (speaker.includes(companyFirstWord)) {
          return {
            repSpeakerName: speaker,
            method: "company_match",
            confidence: "medium",
          };
        }
      }
    }
  }

  // --- Strategy 3: First speaker fallback ---
  const firstSpeaker = sentences.find((s) => normaliseSpeaker(s.speaker_name))?.speaker_name ?? "";
  return {
    repSpeakerName: normaliseSpeaker(firstSpeaker),
    method: "first_speaker",
    confidence: "low",
  };
}

// ---------------------------------------------------------------------------
// Talk Ratio Calculation
// ---------------------------------------------------------------------------

interface TalkRatioResult {
  rep_percent: number;
  prospect_percent: number;
  rep_word_count: number;
  prospect_word_count: number;
  total_words: number;
  calculation_method: "time_based" | "word_based";
}

function calculateTalkRatio(
  sentences: RawSentence[],
  repSpeakerName: string
): TalkRatioResult {
  const hasTimestamps = sentences.some(
    (s) =>
      s.start_time !== undefined &&
      s.start_time !== null &&
      s.end_time !== undefined &&
      s.end_time !== null
  );

  let repValue = 0;
  let prospectValue = 0;
  let repWords = 0;
  let prospectWords = 0;

  for (const s of sentences) {
    const speaker = normaliseSpeaker(s.speaker_name);
    const isRep = speaker === repSpeakerName;
    const text = s.text ?? "";
    const wc = wordCount(text);

    if (isRep) {
      repWords += wc;
    } else {
      prospectWords += wc;
    }

    if (hasTimestamps && s.start_time !== undefined && s.end_time !== undefined) {
      const duration = Math.max(0, s.end_time - s.start_time);
      if (isRep) {
        repValue += duration;
      } else {
        prospectValue += duration;
      }
    }
  }

  // If time-based, use time values; otherwise fall back to word counts
  if (hasTimestamps) {
    const total = repValue + prospectValue;
    return {
      rep_percent: total > 0 ? Math.round((repValue / total) * 100) : 50,
      prospect_percent: total > 0 ? Math.round((prospectValue / total) * 100) : 50,
      rep_word_count: repWords,
      prospect_word_count: prospectWords,
      total_words: repWords + prospectWords,
      calculation_method: "time_based",
    };
  }

  const totalWords = repWords + prospectWords;
  return {
    rep_percent: totalWords > 0 ? Math.round((repWords / totalWords) * 100) : 50,
    prospect_percent: totalWords > 0 ? Math.round((prospectWords / totalWords) * 100) : 50,
    rep_word_count: repWords,
    prospect_word_count: prospectWords,
    total_words: totalWords,
    calculation_method: "word_based",
  };
}

// ---------------------------------------------------------------------------
// Duration Calculation
// ---------------------------------------------------------------------------

function calculateDuration(
  sentences: RawSentence[],
  providedDuration?: number
): number {
  if (providedDuration !== undefined && providedDuration > 0) {
    return providedDuration;
  }

  // Try to derive from timestamps
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const s of sentences) {
    if (s.start_time !== undefined && s.start_time !== null) {
      minTime = Math.min(minTime, s.start_time);
    }
    if (s.end_time !== undefined && s.end_time !== null) {
      maxTime = Math.max(maxTime, s.end_time);
    }
  }

  if (isFinite(minTime) && isFinite(maxTime) && maxTime > minTime) {
    // Timestamps are in seconds; convert to minutes
    return Math.round(((maxTime - minTime) / 60) * 10) / 10;
  }

  // Fallback: estimate from sentence count (~6 sentences per minute is a rough
  // heuristic for conversational speech)
  return Math.max(1, Math.round((sentences.length / 6) * 10) / 10);
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Clean and tag a raw transcript for downstream AI analysis.
 *
 * @param sentences  - Raw sentence objects from the transcript provider
 * @param repName    - The sales rep's display name (e.g. "Jane Doe")
 * @param repEmail   - The sales rep's email address
 * @param companyName - The rep's company name (used for speaker identification)
 * @param durationMinutes - Optional pre-known call duration in minutes
 * @returns A fully cleaned, tagged, and annotated transcript
 */
export function cleanTranscript(
  sentences: Array<{
    speaker_name?: string;
    text?: string;
    start_time?: number;
    end_time?: number;
  }>,
  repName: string,
  repEmail: string,
  companyName: string,
  durationMinutes?: number
): CleanedTranscript {
  // ------------------------------------------------------------------
  // 1. Identify the rep speaker
  // ------------------------------------------------------------------
  const identification = identifyRepSpeaker(sentences, repName, repEmail, companyName);
  const repSpeakerName = identification.repSpeakerName;

  // ------------------------------------------------------------------
  // 2. Calculate talk ratio on the FULL (uncleaned) transcript so the
  //    numbers reflect actual speaking behaviour, not post-filter counts.
  // ------------------------------------------------------------------
  const talkRatio = calculateTalkRatio(sentences, repSpeakerName);

  // ------------------------------------------------------------------
  // 3. Calculate duration
  // ------------------------------------------------------------------
  const duration = calculateDuration(sentences, durationMinutes);

  // ------------------------------------------------------------------
  // 4. Clean sentences: remove filler sentences, strip inline fillers,
  //    drop short sentences, and tag with [REP] / [PROSPECT].
  // ------------------------------------------------------------------
  const taggedLines: string[] = [];

  // Collect unique prospect names
  const prospectNameSet = new Set<string>();

  for (const sentence of sentences) {
    const rawText = (sentence.text ?? "").trim();
    if (!rawText) continue;

    // Drop entire sentence if it is a pure filler / pleasantry
    if (FILLER_SENTENCE_REGEX.test(rawText)) continue;

    // Strip inline filler words
    const cleaned = cleanSentenceText(rawText);
    if (!cleaned) continue;

    // Drop sentences shorter than MIN_WORD_COUNT words after cleaning
    if (wordCount(cleaned) < MIN_WORD_COUNT) continue;

    // Determine speaker role
    const speaker = normaliseSpeaker(sentence.speaker_name);
    const isRep = speaker === repSpeakerName;
    const displayName = (sentence.speaker_name ?? "Unknown").trim();
    const tag = isRep ? "REP" : "PROSPECT";

    if (!isRep && displayName) {
      prospectNameSet.add(displayName);
    }

    taggedLines.push(`[${tag}] ${displayName}: ${cleaned}`);
  }

  // ------------------------------------------------------------------
  // 5. Build prospect list and participants info
  // ------------------------------------------------------------------
  const prospects = Array.from(prospectNameSet).map((name) => ({ name }));

  // Find the original-cased rep speaker name from the transcript
  const repOriginalName =
    sentences.find(
      (s) => normaliseSpeaker(s.speaker_name) === repSpeakerName
    )?.speaker_name?.trim() ?? repName;

  const participants: CleanedTranscript["participants"] = {
    rep: {
      name: repName,
      email: repEmail,
      transcript_speaker_name: repOriginalName,
      company: companyName,
    },
    prospects,
    identification_method: identification.method,
    identification_confidence: identification.confidence,
    total_participants: 1 + prospects.length,
  };

  // ------------------------------------------------------------------
  // 6. Assemble result
  // ------------------------------------------------------------------
  return {
    sentences_text: taggedLines.join("\n"),
    sentence_count: taggedLines.length,
    talk_ratio: talkRatio,
    duration_minutes: duration,
    participants,
  };
}
