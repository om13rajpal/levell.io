/**
 * Email Service for Team Invitations
 * Uses Supabase SMTP configuration via API route
 * Brand: Levvl.io - Clean, Professional Design
 */

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TeamInvitationEmailData {
  recipientEmail: string;
  inviterName: string;
  teamName: string;
  inviteUrl: string;
  expiresInDays?: number;
}

/**
 * Team Invitation Email Template - Clean Professional Design for Levvl.io
 * Gmail-compatible: No animations, inline styles, table-based layout
 */
function getTeamInvitationTemplate(data: TeamInvitationEmailData): string {
  const { inviterName, teamName, inviteUrl, expiresInDays = 7, recipientEmail } = data;

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${inviterName} invited you to ${teamName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #dc4a4a; padding: 32px 40px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Levvl Logo Text -->
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">levvl</h1>
                    <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 500;">Sales Intelligence Platform</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">

              <!-- Invitation Header -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0 0 24px; font-size: 12px; font-weight: 600; color: #dc4a4a; text-transform: uppercase; letter-spacing: 1.5px;">Team Invitation</p>

                    <!-- Inviter Avatar -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="width: 72px; height: 72px; background-color: #dc4a4a; border-radius: 50%; vertical-align: middle;">
                          <span style="font-size: 26px; font-weight: 700; color: #ffffff; line-height: 72px;">${getInitials(inviterName)}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Inviter Name -->
                    <h2 style="margin: 20px 0 8px; font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.3px;">${inviterName}</h2>
                    <p style="margin: 0; font-size: 16px; color: #71717a;">has invited you to join</p>
                  </td>
                </tr>
              </table>

              <!-- Team Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="48" valign="middle">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="width: 48px; height: 48px; background-color: #dc4a4a; border-radius: 10px; text-align: center; vertical-align: middle;">
                                <img src="https://img.icons8.com/ios-filled/24/ffffff/conference-call.png" alt="Team" width="24" height="24" style="display: block; margin: 0 auto;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-left: 16px;" valign="middle">
                          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">Team</p>
                          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #18181b;">${teamName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 32px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color: #dc4a4a; border-radius: 10px;">
                          <a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Accept Invitation</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Expiry Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef9c3; border-radius: 10px; border: 1px solid #fde047;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="24" valign="top">
                          <img src="https://img.icons8.com/ios-filled/24/ca8a04/clock--v1.png" alt="Clock" width="20" height="20" />
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; color: #854d0e; line-height: 1.5;">This invitation expires in <strong>${expiresInDays} days</strong></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Link Fallback -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-top: 28px; border-top: 1px solid #e4e4e7; margin-top: 28px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa;">If the button doesn't work, copy this link:</p>
                    <p style="margin: 0; font-size: 13px; word-break: break-all;">
                      <a href="${inviteUrl}" style="color: #dc4a4a; text-decoration: none;">${inviteUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #71717a;">
                      Sent to <span style="color: #18181b; font-weight: 500;">${recipientEmail}</span>
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                      If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px;">
                    <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                      &copy; ${new Date().getFullYear()} Levvl. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
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

/**
 * Send team invitation email via API route
 */
export async function sendTeamInvitationEmail(
  recipientEmail: string,
  inviterName: string,
  teamName: string,
  inviteUrl: string,
  expiresInDays: number = 7
): Promise<EmailResponse> {
  const emailData: TeamInvitationEmailData = {
    recipientEmail,
    inviterName,
    teamName,
    inviteUrl,
    expiresInDays,
  };

  const html = getTeamInvitationTemplate(emailData);
  const subject = `${inviterName} invited you to join ${teamName}`;

  try {
    // Build absolute URL for API endpoint
    const baseUrl = typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/send-invitation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject,
        html,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      return {
        success: true,
        messageId: result.messageId,
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to send email",
      };
    }
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
