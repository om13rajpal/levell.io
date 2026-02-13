import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

interface SendInvitationRequest {
  to: string;
  subject: string;
  html: string;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const body: SendInvitationRequest = await request.json();

    if (!body.to || !body.subject || !body.html) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    if (!isValidEmail(body.to)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address format" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY is not configured in environment." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "team@levvl.io";

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: body.to,
      subject: body.subject,
      html: body.html,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const resendConfigured = !!process.env.RESEND_API_KEY;

  return NextResponse.json({
    status: "ok",
    provider: "resend",
    configured: resendConfigured,
    ready: resendConfigured,
  });
}
