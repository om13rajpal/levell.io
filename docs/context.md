# Project Context - Sales Call Analytics Platform

## Overview
This is a Next.js 16 application for sales call analytics, team management, and AI-powered call scoring. The platform integrates with Fireflies.ai for call transcription and uses Supabase for backend services.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16.0.1 (App Router)
- **UI**: React 18.3.1, Tailwind CSS 4, Radix UI, Shadcn/ui
- **State**: Zustand, Redux Toolkit
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React, Tabler Icons

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google OAuth, Magic Link)
- **Email**: Nodemailer with SMTP (Supabase configured)
- **File Storage**: Supabase Storage

### Integrations
- **Fireflies.ai**: Call transcription and analysis
- **Clearbit**: Company logos via `https://logo.clearbit.com/{domain}`
- **n8n**: Workflow automation webhooks

---

## Project Structure

```
app/
├── page.tsx                    # Landing page
├── login/page.tsx              # Login page (Google OAuth + Magic Link)
├── auth/callback/page.tsx      # OAuth callback handler
├── dashboard/page.tsx          # Main dashboard with charts
├── calls/
│   ├── page.tsx               # Calls list with filtering
│   └── [id]/page.tsx          # Call detail with transcript, AI analysis
├── companies/
│   ├── page.tsx               # Companies list (detected from calls)
│   └── [id]/page.tsx          # Company detail with call history
├── team/
│   ├── page.tsx               # Team management (invite, remove, roles)
│   ├── analytics/page.tsx     # Team performance analytics
│   ├── member/[id]/page.tsx   # Individual member stats
│   └── invite/[id]/page.tsx   # Accept team invitation
├── business/page.tsx           # Business profile management
├── account/page.tsx            # User account settings
├── integration/page.tsx        # Fireflies.ai integration setup
├── notification/page.tsx       # Notifications center
└── onboarding/
    ├── page.tsx               # Onboarding router
    ├── step1/page.tsx         # Name input
    ├── step2/page.tsx         # Company info
    ├── step3/page.tsx         # Connect Fireflies
    ├── step4/page.tsx         # Team setup
    ├── step5/page.tsx         # Preferences
    └── step6/page.tsx         # Completion

components/
├── app-sidebar.tsx            # Main navigation sidebar
├── site-header.tsx            # Page header with breadcrumbs
├── nav-user.tsx               # User dropdown menu
├── login-form.tsx             # Login form component
├── AiAnalysis.tsx             # AI scoring display component
├── ReviewProfile.tsx          # Sales profile review component
├── chart-area-interactive.tsx # Interactive area chart
├── section-cards.tsx          # Dashboard stat cards
├── ConnectTools.tsx           # Fireflies connection UI
└── ui/                        # Shadcn/ui components

services/
├── email.ts                   # Email service (team invitations)
├── team.ts                    # Team operations (invite, roles)
├── onboarding.ts              # Onboarding flow logic
└── exportAnalytics.ts         # Analytics export (PDF, Excel)

lib/
├── supabaseClient.ts          # Supabase client instance
├── axiosClient.ts             # Axios with retry logic
└── utils.ts                   # Utility functions
```

---

## Database Schema (Supabase)

### Core Tables

#### `users`
- `id` (uuid, PK) - Supabase auth user ID
- `email` (text)
- `full_name` (text)
- `avatar_url` (text)
- `team_id` (uuid, FK → teams.id)
- `role` (text) - 'owner' | 'admin' | 'member'
- `onboarding_step` (int) - Current onboarding step
- `created_at` (timestamp)

#### `company` (User's own company)
- `id` (uuid, PK)
- `user_id` (uuid, FK → users.id)
- `company_name` (text)
- `company_url` (text)
- `created_at` (timestamp)

#### `companies` (Detected companies from calls)
- `id` (uuid, PK)
- `company_id` (uuid, FK → company.id) - Links to user's company
- `company_name` (text)
- `domain` (text)
- `company_goal_objective` (text)
- `created_at` (timestamp)

#### `transcripts` (Call records)
- `id` (int, PK)
- `user_id` (uuid, FK → users.id)
- `fireflies_id` (text) - External Fireflies ID
- `title` (text)
- `duration` (numeric) - Duration in minutes
- `created_at` (timestamp)
- `participants` (jsonb)
- `sentences` (jsonb) - Transcript sentences
- `summary` (jsonb) - AI-generated summary
- `ai_overall_score` (numeric) - Overall call score 0-100
- `ai_scores` (jsonb) - Category scores
- `ai_analysis` (jsonb) - Detailed AI analysis

#### `company_calls` (Links calls to companies)
- `id` (uuid, PK)
- `company_id` (uuid, FK → companies.id)
- `transcript_id` (int, FK → transcripts.id)
- `created_at` (timestamp)

#### `teams`
- `id` (uuid, PK)
- `name` (text)
- `owner` (uuid, FK → users.id)
- `members` (uuid[]) - Array of user IDs
- `admins` (uuid[]) - Array of admin user IDs
- `created_at` (timestamp)

#### `team_invitations`
- `id` (uuid, PK)
- `team_id` (uuid, FK → teams.id)
- `email` (text)
- `invited_by` (uuid, FK → users.id)
- `status` (text) - 'pending' | 'accepted' | 'expired'
- `expires_at` (timestamp)
- `created_at` (timestamp)

#### `team_member_tags`
- `id` (uuid, PK)
- `team_id` (uuid, FK → teams.id)
- `user_id` (uuid, FK → users.id)
- `tags` (text[])

---

## Key Features

### 1. Call Analytics
- View all calls with filtering (date, duration, score)
- Detailed call view with transcript, AI analysis
- Score breakdown by categories (Discovery, Active Listening, etc.)
- Playback timestamps for transcript navigation

### 2. Company Tracking
- Auto-detect companies from call transcripts
- Company goals and objectives
- Call history per company
- Score trends over time

### 3. Team Management
- Invite team members via email
- Role-based access (Owner, Admin, Member)
- Team analytics and leaderboards
- Individual member performance tracking

### 4. AI Analysis
- Overall call score (0-100)
- Category scores:
  - Call Setup & Control
  - Discovery & Qualification
  - Active Listening
  - Value Communication
  - Next Steps & Momentum
  - Objection Handling
- Strengths and areas for improvement
- Action items extraction

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Site URL (for email links)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# SMTP (for team invitation emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Your App Name
```

---

## API Routes

### `/api/send-invitation` (POST)
Send team invitation email via SMTP.

**Request:**
```json
{
  "to": "recipient@email.com",
  "subject": "Team Invitation",
  "html": "<html>...</html>"
}
```

### `/api/webhook` (POST)
Fireflies.ai webhook for new transcripts.

---

## Common Patterns

### Supabase Client Usage
```typescript
import { supabase } from "@/lib/supabaseClient";

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Query with filters
const { data, error } = await supabase
  .from("transcripts")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });
```

### Toast Notifications
```typescript
import { toast } from "sonner";

toast.success("Action completed!");
toast.error("Something went wrong");
```

### Company Logo (Clearbit)
```typescript
const logoUrl = `https://logo.clearbit.com/${domain}`;
```

---

## Scoring System

Calls are scored on a 0-100 scale across categories:

| Category | Weight | Description |
|----------|--------|-------------|
| Call Setup & Control | 15% | Opening, agenda setting |
| Discovery & Qualification | 25% | Needs analysis, questions |
| Active Listening | 20% | Engagement, follow-ups |
| Value Communication | 20% | Solution presentation |
| Next Steps & Momentum | 10% | Action items, commitments |
| Objection Handling | 10% | Addressing concerns |

Score colors:
- **Green (≥80)**: Excellent
- **Amber (60-79)**: Good
- **Red (<60)**: Needs improvement

---

## Time/Duration Formatting

Duration is stored in **minutes** in the database. Display format:
- `< 60 min`: Show as `Xm` (e.g., "45m")
- `≥ 60 min`: Show as `Xh Ym` (e.g., "1h 30m")

Transcript timestamps are in **seconds**. Display format: `MM:SS`

---

## Team Roles & Permissions

| Permission | Owner | Admin | Member |
|------------|-------|-------|--------|
| View team analytics | ✅ | ✅ | ✅ |
| View member details | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Delete team | ✅ | ❌ | ❌ |

---

## Common Issues & Solutions

### Email not sending
1. Check SMTP environment variables are set
2. For Gmail: Enable 2FA and use App Password
3. Check `/api/send-invitation` health endpoint

### Company calls showing 0
- Ensure `company_calls.company_id` matches `companies.id`
- Filter calls by user's detected company IDs

### Company logo not loading
- Check `company_url` is set in `company` table
- Clearbit requires valid domain format

### Team member not removed
- Must clear `users.team_id` when removing from team
- Also remove from `teams.members` array and `team_member_tags`

---

## File Naming Conventions

- Pages: `app/[route]/page.tsx`
- Components: PascalCase (`AiAnalysis.tsx`)
- Services: camelCase (`email.ts`)
- UI Components: kebab-case in `/components/ui/`

---

## Build & Deploy

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm run start

# Lint
npm run lint
```

Deploy to Vercel with environment variables configured.
