# Email Service Setup Guide

This guide will help you set up email functionality for team invitations in your application.

## Overview

The email service supports three providers:

1. **Resend** (Recommended) - Easy setup, generous free tier
2. **SendGrid** - Enterprise-grade email service
3. **Nodemailer/SMTP** - For Gmail or custom SMTP servers

## Quick Start

### Option 1: Resend (Recommended)

**Why Resend?**
- ✅ Easy setup (5 minutes)
- ✅ Generous free tier (3,000 emails/month)
- ✅ Modern API
- ✅ Great deliverability
- ✅ No credit card required for free tier

**Setup Steps:**

1. **Sign up**: Go to [resend.com](https://resend.com) and create an account

2. **Get API Key**: Navigate to [API Keys](https://resend.com/api-keys) and create a new key

3. **Add to `.env`**:
   ```bash
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_FROM=Team App <noreply@yourdomain.com>
   EMAIL_FROM_NAME=Team Collaboration App
   ```

4. **Verify Domain** (Optional for production):
   - Go to [Domains](https://resend.com/domains)
   - Add your domain and follow DNS verification steps
   - Update `EMAIL_FROM` to use your verified domain

5. **Test**: Send a test invitation!

### Option 2: SendGrid

**Setup Steps:**

1. **Sign up**: Create account at [sendgrid.com](https://sendgrid.com)

2. **Create API Key**:
   - Navigate to Settings > [API Keys](https://app.sendgrid.com/settings/api_keys)
   - Click "Create API Key"
   - Give it "Full Access" permissions
   - Copy the API key

3. **Add to `.env`**:
   ```bash
   SENDGRID_API_KEY=SG.your_api_key_here
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   EMAIL_FROM_NAME=Team Collaboration App
   ```

4. **Verify Sender** (Required):
   - Go to Settings > [Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
   - Verify your email or domain

### Option 3: Gmail SMTP (Development Only)

**⚠️ Warning**: Gmail SMTP is only for development/testing. Use Resend or SendGrid for production.

**Setup Steps:**

1. **Enable 2FA**: Enable 2-Factor Authentication on your Gmail account

2. **Create App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Generate and copy the password

3. **Add to `.env`**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password-here
   SMTP_FROM_EMAIL=your-email@gmail.com
   EMAIL_FROM_NAME=Team Collaboration App
   ```

**Gmail Limitations**:
- 500 emails per day limit
- May have deliverability issues
- Not recommended for production
- Emails may go to spam

## Environment Variables Reference

### Resend
```bash
RESEND_API_KEY=          # Your Resend API key
EMAIL_FROM=              # Sender email address
EMAIL_FROM_NAME=         # Sender display name
```

### SendGrid
```bash
SENDGRID_API_KEY=        # Your SendGrid API key
SENDGRID_FROM_EMAIL=     # Verified sender email
EMAIL_FROM_NAME=         # Sender display name
```

### SMTP (Gmail or Custom)
```bash
SMTP_HOST=               # SMTP server hostname
SMTP_PORT=               # SMTP port (usually 587 or 465)
SMTP_USER=               # SMTP username
SMTP_PASS=               # SMTP password
SMTP_FROM_EMAIL=         # Sender email address
EMAIL_FROM_NAME=         # Sender display name
```

### Site Configuration
```bash
NEXT_PUBLIC_SITE_URL=    # Your site URL (e.g., https://yourapp.com)
```

## Testing Your Setup

1. **Check Configuration**:
   ```bash
   curl http://localhost:3000/api/send-invitation
   ```

   Should return:
   ```json
   {
     "status": "ok",
     "configuredProviders": ["resend"],
     "ready": true
   }
   ```

2. **Send Test Invitation**:
   - Go to your team settings
   - Invite a test email address
   - Check the recipient's inbox (and spam folder)

3. **Debug Issues**:
   - Check browser console for errors
   - Check server logs: `npm run dev`
   - Verify environment variables are loaded
   - Test API endpoint directly

## Email Templates

The service includes three email templates:

### 1. Team Invitation
Professional invitation email with:
- Team name and inviter information
- Call-to-action button
- Expiry notice (7 days)
- Responsive design

### 2. Welcome Email
Welcome message for new users

### 3. Notification
Generic notification template

## Customization

### Custom Email Template

Edit `services/email.ts`:

```typescript
function getTeamInvitationTemplate(data: TeamInvitationEmailData): string {
  // Customize your HTML template here
  return `
    <!DOCTYPE html>
    <html>
      <!-- Your custom template -->
    </html>
  `;
}
```

### Add New Email Provider

Edit `app/api/send-invitation/route.ts`:

```typescript
async function sendViaCustomProvider(params: SendInvitationRequest): Promise<EmailResponse> {
  // Implement your provider
}

// Add to POST handler
if (process.env.CUSTOM_API_KEY) {
  result = await sendViaCustomProvider(body);
  if (result.success) {
    return NextResponse.json(result, { status: 200 });
  }
}
```

## Troubleshooting

### Emails Not Sending

1. **Check Configuration**:
   ```bash
   # Verify environment variables are loaded
   console.log('API Key:', process.env.RESEND_API_KEY?.substring(0, 10));
   ```

2. **Check API Endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/send-invitation \
     -H "Content-Type: application/json" \
     -d '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
   ```

3. **Common Issues**:
   - ❌ API key not set correctly
   - ❌ Environment variables not loaded (restart dev server)
   - ❌ Email address not verified (SendGrid)
   - ❌ Domain not verified (production)
   - ❌ Rate limits exceeded

### Emails Going to Spam

1. **Verify Your Domain** (Most important):
   - Set up SPF, DKIM, and DMARC records
   - Use Resend or SendGrid's domain verification

2. **Use Professional Content**:
   - Avoid spam trigger words
   - Include unsubscribe link
   - Use verified sender address

3. **Warm Up Your Domain**:
   - Start with low volume
   - Gradually increase sending

### Gmail Specific Issues

1. **"Less secure apps" Error**:
   - Enable 2FA
   - Use App Password instead of regular password

2. **Daily Limit Reached**:
   - Switch to Resend or SendGrid

3. **Authentication Failed**:
   - Verify App Password is correct
   - Check username is full email address

## Production Checklist

- [ ] Use Resend or SendGrid (not Gmail SMTP)
- [ ] Verify domain with your email provider
- [ ] Set up SPF, DKIM, DMARC records
- [ ] Test email deliverability
- [ ] Set up email analytics/monitoring
- [ ] Configure proper `EMAIL_FROM` address
- [ ] Test on multiple email clients
- [ ] Add unsubscribe functionality
- [ ] Set up error notifications
- [ ] Configure rate limiting

## Cost Comparison

| Provider | Free Tier | Paid Plans |
|----------|-----------|------------|
| **Resend** | 3,000 emails/month | $20/month for 50,000 |
| **SendGrid** | 100 emails/day | $19.95/month for 50,000 |
| **Gmail** | 500 emails/day | Not for production |

## Support

- Resend Docs: [resend.com/docs](https://resend.com/docs)
- SendGrid Docs: [docs.sendgrid.com](https://docs.sendgrid.com)
- Gmail SMTP: [support.google.com](https://support.google.com/mail/answer/7126229)

## Next Steps

1. Choose your email provider (recommend Resend)
2. Follow the setup steps above
3. Add environment variables to `.env`
4. Restart your dev server
5. Test sending an invitation
6. Verify the email template looks good
7. Deploy to production with verified domain

**Need help?** Open an issue or check the troubleshooting section above.
