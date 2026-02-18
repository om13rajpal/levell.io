/**
 * API Route: Send Upgrade Plan Request Email
 * POST /api/upgrade-request
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

interface UpgradeRequestBody {
  userName: string;
  userEmail: string;
  companyName?: string;
}

/**
 * Generate upgrade request email template
 */
function getUpgradeRequestTemplate(data: UpgradeRequestBody): string {
  const { userName, userEmail, companyName } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plan Upgrade Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #dc4a4a; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">levvl</h1>
              <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 500;">Plan Upgrade Request</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">

              <h2 style="margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #18181b;">New Upgrade Request</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #a1a1aa; text-transform: uppercase;">User Name</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #18181b;">${userName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #a1a1aa; text-transform: uppercase;">Email</p>
                          <p style="margin: 0; font-size: 16px; color: #18181b;">
                            <a href="mailto:${userEmail}" style="color: #dc4a4a; text-decoration: none;">${userEmail}</a>
                          </p>
                        </td>
                      </tr>
                      ${companyName ? `
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #a1a1aa; text-transform: uppercase;">Company</p>
                          <p style="margin: 0; font-size: 16px; color: #18181b;">${companyName}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; line-height: 1.6;">
                This user has requested a plan upgrade. Please reach out to them to discuss their needs and provide upgrade options.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Levvl. Upgrade Request Notification.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const body: UpgradeRequestBody = await request.json();

    if (!body.userName || !body.userEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userName, userEmail" },
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
    const adminEmail = process.env.ADMIN_EMAIL || process.env.RESEND_ADMIN_EMAIL;

    if (!adminEmail) {
      console.error("ADMIN_EMAIL not configured for upgrade requests");
      return NextResponse.json(
        { success: false, error: "Admin email not configured" },
        { status: 500 }
      );
    }

    const html = getUpgradeRequestTemplate(body);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `Plan Upgrade Request from ${body.userName}`,
      html,
      replyTo: body.userEmail,
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
    console.error("Upgrade request email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send upgrade request",
      },
      { status: 500 }
    );
  }
}
