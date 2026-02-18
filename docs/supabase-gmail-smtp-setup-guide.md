# Comprehensive Guide: Supabase Custom SMTP with Gmail Configuration

## Table of Contents
1. [Overview](#overview)
2. [Supabase Custom SMTP Configuration](#supabase-custom-smtp-configuration)
3. [Gmail SMTP Setup](#gmail-smtp-setup)
4. [Supabase Edge Functions for Email](#supabase-edge-functions-for-email)
5. [Environment Variables](#environment-variables)
6. [Complete Code Examples](#complete-code-examples)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for configuring custom SMTP in Supabase using Gmail as your email provider. It covers dashboard configuration, Gmail app password generation, and implementing email functionality through Supabase Edge Functions.

### Why Use Custom SMTP?

- **Production Requirements**: Supabase's default email service is limited to 3 emails per hour and only sends to pre-authorized addresses
- **Scalability**: Custom SMTP enables high-volume transactional emails
- **Deliverability**: Transactional email providers ensure messages reach recipients
- **Control**: Full control over sender identity, templates, and email content

---

## Supabase Custom SMTP Configuration

### Step 1: Access SMTP Settings in Supabase Dashboard

**Option A: Via Authentication Menu**
1. Navigate to your Supabase Project Dashboard
2. Go to **Authentication** → **Emails** → **SMTP Settings**
3. Toggle **Enable Custom SMTP** to ON

**Option B: Via Project Settings**
1. Navigate to **Project Settings**
2. Select **Authorization** from the submenu
3. Scroll down to **SMTP Settings**
4. Toggle **Enable Custom SMTP** to ON

### Step 2: Configure SMTP Server Settings

Once custom SMTP is enabled, configure the following fields:

| Field | Value for Gmail | Description |
|-------|----------------|-------------|
| **SMTP Host** | `smtp.gmail.com` | Gmail's SMTP server |
| **Port** | `587` (TLS) or `465` (SSL) | See port comparison below |
| **Username** | Your Gmail address | Must be the actual Gmail account |
| **Password** | App Password (16 characters) | Generated from Google Account |
| **Sender Email** | Same as username | Gmail enforces this |
| **Sender Name** | Your desired name | Display name in emails |

### Port Selection: 587 vs 465

**Port 587 (Recommended - STARTTLS)**
- ✅ Current industry standard
- ✅ Uses explicit TLS with STARTTLS
- ✅ Better compatibility across networks
- ✅ Recommended by RFC 8314 and most providers
- Connection starts unencrypted, upgrades to secure

**Port 465 (Alternative - Implicit SSL/TLS)**
- Uses implicit TLS (encrypted from start)
- Older standard, now RFC 8314 compliant
- May have compatibility issues in some environments
- Gmail fully supports both ports

**Best Practice**: Use **port 587** as your default choice unless explicitly required to use 465.

### Step 3: Configure Email Domain Settings (Recommended)

For production use, configure these DNS records with your email provider:

- **DKIM**: Authenticate your domain's emails
- **DMARC**: Prevent email spoofing
- **SPF**: Specify authorized mail servers

These settings significantly improve email deliverability and reduce spam filtering.

---

## Gmail SMTP Setup

### Prerequisites

⚠️ **IMPORTANT**: Google disabled "Less Secure App" access on May 30, 2022. You MUST use App Passwords with 2-Factor Authentication.

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security Settings](https://myaccount.google.com/security)
2. Navigate to **Security** section
3. Enable **2-Step Verification**
4. Complete the 2FA setup process

### Step 2: Generate App Password

1. After enabling 2FA, go back to [Google Account Security](https://myaccount.google.com/security)
2. Scroll down to **2-Step Verification** section
3. Click on **App passwords**
4. If prompted, re-authenticate
5. Under "Select app", choose **Other (Custom name)**
6. Enter a name like `Supabase SMTP` or `Nodemailer`
7. Click **Generate**
8. Google displays a 16-character password (format: `xxxx xxxx xxxx xxxx`)
9. **Copy this password immediately** - you won't see it again
10. Remove spaces when using it: `xxxxxxxxxxxxxxxx`

### Gmail SMTP Configuration Settings

```
SMTP Server: smtp.gmail.com
Port (TLS): 587
Port (SSL): 465
Security: TLS/SSL
Authentication: Yes (required)
Username: your-email@gmail.com
Password: 16-character app password (no spaces)
```

### Gmail Sending Limits

- **Personal Gmail**: 500 recipients per rolling 24-hour period
- **Google Workspace**: 2,000 recipients per rolling 24-hour period

### Important Gmail Restrictions

1. **Sender Address Override**: Gmail always uses the authenticated account as the sender. If you specify a different `from` address, Gmail will silently replace it with your authenticated email.

2. **Not Recommended for Production**:
   - Gmail is designed for human use, not automated services
   - Aggressive login heuristics may block connections from unusual locations
   - Better to use dedicated transactional email providers (SendGrid, Postmark, Amazon SES, Resend) for production

3. **For Testing/Development**: Gmail with App Passwords is excellent for quick testing and development environments.

---

## Supabase Edge Functions for Email

Supabase Edge Functions are server-side TypeScript functions deployed globally at the edge, close to your users. They run on Deno runtime and can send emails using nodemailer or other libraries.

### Option 1: Using Nodemailer in Edge Functions

#### Step 1: Create Edge Function

```bash
# Create a new edge function
supabase functions new send-email

# This creates: supabase/functions/send-email/index.ts
```

#### Step 2: Configure Dependencies (deno.json)

Create or modify `supabase/functions/send-email/deno.json`:

```json
{
  "imports": {
    "nodemailer": "npm:nodemailer@6.9.8"
  }
}
```

#### Step 3: Implement Edge Function with Nodemailer

Create `supabase/functions/send-email/index.ts`:

```typescript
import nodemailer from "npm:nodemailer@6.9.8";

// Define types
interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    // Parse request body
    const { to, subject, text, html, from }: EmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject || (!text && !html)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, and text or html' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create nodemailer transport
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(Deno.env.get('SMTP_PORT')) || 587,
      secure: Deno.env.get('SMTP_SECURE') === 'true', // true for 465, false for 587
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: from || Deno.env.get('SMTP_FROM') || Deno.env.get('SMTP_USER'),
      to,
      subject,
      text,
      html,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send email',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
```

#### Step 4: Set Environment Variables

In Supabase Dashboard:
1. Go to **Edge Functions** → **Settings** → **Secrets**
2. Add the following secrets:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
```

Or use CLI:
```bash
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_SECURE=false
supabase secrets set SMTP_USER=your-email@gmail.com
supabase secrets set SMTP_PASS=your-app-password
supabase secrets set SMTP_FROM=your-email@gmail.com
```

#### Step 5: Deploy Edge Function

```bash
# Deploy with JWT verification (default - requires authentication)
supabase functions deploy send-email

# Deploy without JWT verification (for public use - use with caution)
supabase functions deploy send-email --no-verify-jwt
```

#### Step 6: Test the Function

```bash
# Get your function URL
FUNCTION_URL=$(supabase functions list | grep send-email | awk '{print $2}')

# Test with curl
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email from Supabase",
    "text": "This is a test email sent from Supabase Edge Function!",
    "html": "<h1>Test Email</h1><p>This is a test email sent from Supabase Edge Function!</p>"
  }'
```

### Option 2: Using React Email Templates

For more sophisticated email templates, use React Email with Resend or other providers.

#### Step 1: Create Email Template

Create `supabase/functions/_templates/welcome-email.tsx`:

```typescript
import * as React from 'npm:react@18.3.1';
import { Html, Head, Body, Container, Heading, Text, Button } from 'npm:@react-email/components@0.0.22';

interface WelcomeEmailProps {
  userName: string;
  confirmationUrl: string;
}

export default function WelcomeEmail({ userName, confirmationUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '5px' }}>
          <Heading style={{ color: '#333333' }}>Welcome, {userName}!</Heading>
          <Text style={{ fontSize: '16px', color: '#555555' }}>
            Thank you for signing up. Please confirm your email address by clicking the button below.
          </Text>
          <Button
            href={confirmationUrl}
            style={{
              backgroundColor: '#007bff',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '4px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Confirm Email
          </Button>
          <Text style={{ fontSize: '14px', color: '#888888', marginTop: '20px' }}>
            If you didn't sign up for this account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

#### Step 2: Implement Edge Function with React Email

Create `supabase/functions/send-welcome-email/index.ts`:

```typescript
import nodemailer from "npm:nodemailer@6.9.8";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import WelcomeEmail from "../_templates/welcome-email.tsx";

interface WelcomeEmailRequest {
  to: string;
  userName: string;
  confirmationUrl: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { to, userName, confirmationUrl }: WelcomeEmailRequest = await req.json();

    // Render React Email template to HTML
    const emailHtml = await renderAsync(
      WelcomeEmail({ userName, confirmationUrl })
    );

    // Create transport
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT')),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: Deno.env.get('SMTP_FROM'),
      to,
      subject: `Welcome to Our Platform, ${userName}!`,
      html: emailHtml,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send email', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Option 3: Using Supabase Auth Email Hook

For custom authentication emails, use the Send Email Auth Hook instead of SMTP.

#### Configure Auth Hook

1. Go to **Authentication** → **Hooks** in Supabase Dashboard
2. Click **Create Hook**
3. Select **Send Email** hook type
4. Choose **HTTPS** as hook type
5. Enter your Edge Function URL
6. Click **Generate Secret** and save it
7. Click **Create**

#### Implement Auth Hook Edge Function

```typescript
import nodemailer from "npm:nodemailer@6.9.8";
import { Webhook } from "npm:standardwebhooks@1.0.0";

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify webhook signature
  const wh = new Webhook(Deno.env.get('SEND_EMAIL_HOOK_SECRET')!);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT')),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    // Send custom auth email based on action type
    let subject = '';
    let html = '';

    switch (email_data.email_action_type) {
      case 'signup':
        subject = 'Confirm Your Email';
        html = `<p>Click <a href="${email_data.redirect_to}">here</a> to confirm your email.</p>`;
        break;
      case 'recovery':
        subject = 'Reset Your Password';
        html = `<p>Click <a href="${email_data.redirect_to}">here</a> to reset your password.</p>`;
        break;
      case 'magic_link':
        subject = 'Your Magic Link';
        html = `<p>Click <a href="${email_data.redirect_to}">here</a> to sign in.</p>`;
        break;
    }

    await transporter.sendMail({
      from: Deno.env.get('SMTP_FROM'),
      to: user.email,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Environment Variables

### Required Variables for Edge Functions

Create a `.env` file for local development:

```bash
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-email@gmail.com

# For Auth Hooks
SEND_EMAIL_HOOK_SECRET=your-webhook-secret-from-dashboard
```

### Setting Variables in Supabase

**Via Dashboard:**
1. Navigate to **Edge Functions** → **Settings** → **Secrets**
2. Add each environment variable

**Via CLI:**
```bash
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_SECURE=false
supabase secrets set SMTP_USER=your-email@gmail.com
supabase secrets set SMTP_PASS=your-app-password
```

### Local Development

For local testing:

```bash
# Create .env file in supabase/functions/send-email/
echo "SMTP_HOST=smtp.gmail.com" > supabase/functions/send-email/.env
echo "SMTP_PORT=587" >> supabase/functions/send-email/.env
echo "SMTP_USER=your-email@gmail.com" >> supabase/functions/send-email/.env
echo "SMTP_PASS=your-app-password" >> supabase/functions/send-email/.env

# Run locally
supabase functions serve send-email --env-file supabase/functions/send-email/.env
```

---

## Complete Code Examples

### Example 1: Simple Text Email

```typescript
// Client-side code to call the edge function
const sendEmail = async () => {
  const response = await fetch('YOUR_EDGE_FUNCTION_URL', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      to: 'recipient@example.com',
      subject: 'Hello from Supabase',
      text: 'This is a plain text email.',
    })
  });

  const data = await response.json();
  console.log(data);
};
```

### Example 2: HTML Email with Attachments

```typescript
// Edge function with attachment support
import nodemailer from "npm:nodemailer@6.9.8";

Deno.serve(async (req) => {
  const { to, subject, html, attachments } = await req.json();

  const transporter = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT')),
    secure: false,
    auth: {
      user: Deno.env.get('SMTP_USER'),
      pass: Deno.env.get('SMTP_PASS'),
    },
  });

  const info = await transporter.sendMail({
    from: Deno.env.get('SMTP_FROM'),
    to,
    subject,
    html,
    attachments: attachments || [],
  });

  return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Example 3: Database Trigger to Send Email

Create a database trigger that calls your edge function:

```sql
-- Create a function to send email on new user signup
CREATE OR REPLACE FUNCTION send_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'YOUR_EDGE_FUNCTION_URL',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := jsonb_build_object(
        'to', NEW.email,
        'userName', NEW.name,
        'confirmationUrl', 'https://yourapp.com/confirm?token=' || NEW.confirmation_token
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_email();
```

---

## Security Best Practices

### 1. Protect App Passwords

- ✅ **DO**: Store app passwords in Supabase secrets (never commit to git)
- ✅ **DO**: Use environment variables for all sensitive credentials
- ✅ **DO**: Rotate app passwords periodically
- ❌ **DON'T**: Hardcode credentials in your code
- ❌ **DON'T**: Share app passwords across multiple services

### 2. Implement Rate Limiting

```typescript
// Simple rate limiting in edge function
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(email: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(email);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(email, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
```

### 3. Validate Email Addresses

```typescript
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Use in edge function
if (!isValidEmail(to)) {
  return new Response(
    JSON.stringify({ error: 'Invalid email address' }),
    { status: 400 }
  );
}
```

### 4. Use JWT Verification

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  );

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Proceed with email sending...
});
```

### 5. Sanitize HTML Content

```typescript
// Install: npm install dompurify
import DOMPurify from 'npm:isomorphic-dompurify@2.9.0';

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target']
  });
}
```

### 6. Monitor and Log

```typescript
// Log email attempts
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  action: 'email_sent',
  to: to,
  subject: subject,
  success: true,
  messageId: info.messageId
}));
```

### 7. Configure SPF, DKIM, and DMARC

For production with custom domains:

```dns
# SPF Record
TXT @ "v=spf1 include:_spf.google.com ~all"

# DKIM (get from Gmail settings)
TXT google._domainkey "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"

# DMARC
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com"
```

### 8. Separate Auth and Marketing Emails

- Use different SMTP credentials for authentication emails vs marketing
- Prevents reputation damage if one service is flagged
- Keeps authentication critical paths independent

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Username and Password not accepted"

**Causes:**
- Using regular Gmail password instead of App Password
- 2FA not enabled on Google account
- Incorrect App Password (contains spaces)

**Solutions:**
- Enable 2FA on Google account first
- Generate new App Password
- Remove all spaces from App Password: `xxxxxxxxxxxxxxxx`
- Verify username is the full Gmail address

#### 2. "Connection timeout" or "ETIMEDOUT"

**Causes:**
- Firewall blocking port 587 or 465
- Incorrect SMTP host
- Network restrictions on cloud providers

**Solutions:**
- Try alternative port (587 → 465 or vice versa)
- Verify SMTP host is `smtp.gmail.com`
- Check cloud provider firewall rules
- Try port 2525 as alternative

#### 3. Gmail Blocking Connections

**Error:** "Sign-in attempt blocked"

**Causes:**
- Gmail detecting unusual location/IP
- Multiple failed login attempts
- Account security restrictions

**Solutions:**
- Check Gmail security alerts and approve the device
- Wait 24 hours before retrying
- Use dedicated transactional email service for production
- Whitelist your server IP in Google Workspace (if applicable)

#### 4. "Sender address rejected"

**Cause:**
- Gmail enforces sender address matches authenticated account

**Solution:**
- Use authenticated Gmail address as `from` field
- Or accept that Gmail will override it

#### 5. Edge Function Deployment Fails

**Common causes:**
- Missing deno.json configuration
- Incorrect npm package imports
- Missing environment variables

**Solutions:**
```bash
# Verify deno.json exists
cat supabase/functions/send-email/deno.json

# Check function logs
supabase functions logs send-email

# Test locally first
supabase functions serve send-email --env-file .env

# Verify secrets are set
supabase secrets list
```

#### 6. React Email JSX Runtime Errors

**Error:** "JSX is not supported in Deno runtime"

**Solution:**
- Use React Email version 0.0.22 (not 1.0.0+)
- Import from `npm:@react-email/components@0.0.22`
- Or render templates separately and import HTML

#### 7. Rate Limiting Errors

**Error:** Hitting Gmail's 500/2000 daily limit

**Solutions:**
- Implement queue system for high-volume sends
- Migrate to dedicated SMTP service (SendGrid, Postmark, SES)
- Use multiple Gmail accounts with round-robin
- Upgrade to Google Workspace for 2000/day limit

#### 8. Local Development SMTP Issues

**Issue:** Can't test SMTP locally

**Solutions:**
```bash
# Use Supabase local "inbucket" for testing
# View emails at http://localhost:54324

# Or use MailHog/Mailpit for local SMTP testing
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Configure local .env to use MailHog
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

---

## Additional Resources

### Official Documentation
- [Supabase Custom SMTP Guide](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Gmail SMTP Settings](https://developers.google.com/workspace/gmail/imap/imap-smtp)
- [Nodemailer Documentation](https://nodemailer.com)

### Recommended Email Providers for Production
1. **Resend** - Modern email API with React Email support
2. **SendGrid** - Up to 100 emails/day free
3. **Postmark** - Excellent deliverability
4. **Amazon SES** - Cost-effective for high volume
5. **Mailgun** - Flexible API and pricing

### Testing Tools
- **MailHog** - Local SMTP testing
- **Mailtrap** - Email testing sandbox
- **Mail-Tester** - Check spam score and configuration

---

## Summary Checklist

### Supabase SMTP Configuration
- [ ] Enable Custom SMTP in Supabase Dashboard
- [ ] Configure SMTP host: `smtp.gmail.com`
- [ ] Set port: 587 (TLS) or 465 (SSL)
- [ ] Enter Gmail address as username
- [ ] Enter 16-character App Password
- [ ] Set sender email and name

### Gmail Setup
- [ ] Enable 2-Factor Authentication on Google Account
- [ ] Generate App Password from Google Account Security
- [ ] Copy 16-character password (remove spaces)
- [ ] Verify Gmail account has sending quota available

### Edge Function Setup
- [ ] Create edge function: `supabase functions new send-email`
- [ ] Configure deno.json with nodemailer import
- [ ] Implement email sending logic
- [ ] Set environment variables in Supabase Dashboard
- [ ] Deploy edge function
- [ ] Test with curl or client code

### Security
- [ ] Store credentials in Supabase Secrets
- [ ] Never commit credentials to git
- [ ] Implement rate limiting
- [ ] Validate email addresses
- [ ] Use JWT verification for protected endpoints
- [ ] Sanitize HTML content
- [ ] Configure SPF/DKIM/DMARC for custom domains

### Production Considerations
- [ ] Consider migrating from Gmail to dedicated SMTP provider
- [ ] Set up monitoring and logging
- [ ] Implement email queue for high volume
- [ ] Configure custom domain for better deliverability
- [ ] Separate auth emails from marketing emails
- [ ] Set up email bounce handling
- [ ] Configure retry logic for failed sends

---

**Last Updated:** December 2025

**Research Sources:**
- [Supabase Custom SMTP Documentation](https://supabase.com/docs/guides/auth/auth-smtp)
- [Mailtrap Supabase Email Guide](https://mailtrap.io/blog/supabase-send-email/)
- [Sendlayer SMTP Configuration Guide](https://sendlayer.com/blog/supabase-custom-smtp-and-email-configuration-guide/)
- [Supabase Gmail SMTP Troubleshooting](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y)
- [Nodemailer Gmail Configuration](https://nodemailer.com/usage/using-gmail)
- [Mailtrap Nodemailer Gmail Guide](https://mailtrap.io/blog/nodemailer-gmail/)
- [Supabase Edge Functions Send Email Example](https://supabase.com/docs/guides/functions/examples/send-emails)
- [Supabase GitHub SMTP Example](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/index.ts)
- [Supabase React Email Guide](https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend)
- [RFC 8314 SMTP Standards](https://stackoverflow.com/questions/15796530/what-is-the-difference-between-ports-465-and-587)
- [Gmail SMTP Port Configuration](https://developers.google.com/workspace/gmail/imap/imap-smtp)
