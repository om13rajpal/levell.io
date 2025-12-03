/**
 * API Route: Send Team Invitation Email
 * POST /api/send-invitation
 *
 * Uses Supabase SMTP configuration (nodemailer with your SMTP settings)
 */

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface SendInvitationRequest {
  to: string;
  subject: string;
  html: string;
  inviterName?: string;
  teamName?: string;
  inviteUrl?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Create nodemailer transporter using Supabase SMTP settings
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Main handler - sends email via SMTP (Supabase configured)
 */
export async function POST(request: NextRequest) {
  try {
    const body: SendInvitationRequest = await request.json();

    // Validate request
    if (!body.to || !body.subject || !body.html) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(body.to)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address format" },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = createTransporter();

    if (!transporter) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your environment.",
        },
        { status: 500 }
      );
    }

    // Send email
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || "Team App";

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: body.to,
      subject: body.subject,
      html: body.html,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
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

/**
 * Health check endpoint
 */
export async function GET() {
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  return NextResponse.json({
    status: "ok",
    smtpConfigured,
    ready: smtpConfigured,
  });
}
