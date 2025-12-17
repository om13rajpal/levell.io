import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackUsage, METER_TYPES } from '@/lib/openmeter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { type, data } = body;

    // Validate event type
    const validTypes = Object.values(METER_TYPES);
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Track the usage event
    const result = await trackUsage({
      type,
      subject: user.id,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to track usage', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Usage tracking error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check available meter types
export async function GET() {
  return NextResponse.json({
    meterTypes: METER_TYPES,
    description: 'Available meter types for usage tracking',
  });
}
