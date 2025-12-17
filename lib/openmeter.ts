import { OpenMeter } from '@openmeter/sdk';

// Initialize OpenMeter client
export const openmeter = new OpenMeter({
  baseUrl: process.env.OPENMETER_BASE_URL ?? 'https://openmeter.cloud',
  token: process.env.OPENMETER_TOKEN,
});

// Event types for tracking
export const METER_TYPES = {
  API_CALLS: 'api_calls',
  TRANSCRIPTS: 'transcripts',
  TOKENS: 'tokens',
  COMPANIES: 'companies',
  AGENT_REQUESTS: 'agent_requests',
} as const;

// Cache for subjects that have been ensured to exist
const subjectCache = new Set<string>();

// Ensure subject/customer exists in OpenMeter before tracking events
export async function ensureSubject({
  subjectId,
  displayName,
  metadata,
}: {
  subjectId: string;
  displayName?: string;
  metadata?: Record<string, string>;
}) {
  // Skip if already ensured in this session
  if (subjectCache.has(subjectId)) {
    return { success: true, cached: true };
  }

  try {
    // OpenMeter SDK uses 'customers' API for subject management
    await openmeter.customers.create({
      id: subjectId,
      name: displayName || subjectId,
      metadata: metadata || {},
    });
    subjectCache.add(subjectId);
    console.log('[OpenMeter] Customer created:', subjectId);
    return { success: true, cached: false };
  } catch (error: any) {
    // If customer already exists, that's fine - cache it
    if (error?.status === 409 || error?.message?.includes('already exists')) {
      subjectCache.add(subjectId);
      return { success: true, cached: false, existed: true };
    }
    // Log but don't fail - continue with event ingestion
    console.warn('[OpenMeter] Customer creation warning:', error?.message || error);
    subjectCache.add(subjectId); // Cache to avoid repeated attempts
    return { success: false, error };
  }
}

// Helper function to track usage events
export async function trackUsage({
  type,
  subject,
  data,
  subjectDisplayName,
}: {
  type: string;
  subject: string;
  data: Record<string, unknown>;
  subjectDisplayName?: string;
}) {
  try {
    // Ensure the subject exists first
    await ensureSubject({
      subjectId: subject,
      displayName: subjectDisplayName,
    });

    await openmeter.events.ingest({
      type,
      subject,
      data,
    });
    return { success: true };
  } catch (error) {
    console.error('OpenMeter tracking error:', error);
    return { success: false, error };
  }
}

// Track AI token usage
export async function trackTokenUsage({
  userId,
  tokens,
  model,
  provider = 'openrouter',
  type = 'output',
}: {
  userId: string;
  tokens: number;
  model: string;
  provider?: string;
  type?: 'input' | 'output';
}) {
  return trackUsage({
    type: METER_TYPES.TOKENS,
    subject: userId,
    data: {
      tokens,
      model,
      provider,
      type,
    },
  });
}

// Track API call
export async function trackApiCall({
  userId,
  endpoint,
  method,
  statusCode,
}: {
  userId: string;
  endpoint: string;
  method: string;
  statusCode: number;
}) {
  return trackUsage({
    type: METER_TYPES.API_CALLS,
    subject: userId,
    data: {
      endpoint,
      method,
      statusCode,
      count: 1,
    },
  });
}

// Track transcript processing
export async function trackTranscript({
  userId,
  transcriptId,
  duration,
  wordCount,
}: {
  userId: string;
  transcriptId: string;
  duration?: number;
  wordCount?: number;
}) {
  return trackUsage({
    type: METER_TYPES.TRANSCRIPTS,
    subject: userId,
    data: {
      transcriptId,
      duration,
      wordCount,
      count: 1,
    },
  });
}

// Track agent request
export async function trackAgentRequest({
  userId,
  companyId,
  promptTokens,
  completionTokens,
  model,
}: {
  userId: string;
  companyId?: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
}) {
  return trackUsage({
    type: METER_TYPES.AGENT_REQUESTS,
    subject: userId,
    data: {
      companyId,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      model,
      count: 1,
    },
  });
}
