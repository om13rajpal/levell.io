# Levvl.io - Feature Documentation

> **AI-Powered Sales Call Coaching & Team Collaboration Platform**

A comprehensive SaaS application that leverages AI to analyze sales calls, provide coaching insights, and facilitate team collaboration for improved sales performance.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Core Features](#core-features)
4. [Authentication & Onboarding](#authentication--onboarding)
5. [Dashboard](#dashboard)
6. [Call Management & Analysis](#call-management--analysis)
7. [AI Sales Intelligence Agent](#ai-sales-intelligence-agent)
8. [Company Intelligence](#company-intelligence)
9. [Team Management](#team-management)
10. [Business Profile & Sales Playbook](#business-profile--sales-playbook)
11. [Integrations](#integrations)
12. [Account & Settings](#account--settings)
13. [Landing Page](#landing-page)
14. [Database Schema](#database-schema)
15. [API Routes](#api-routes)

---

## Overview

Levvl.io is an AI-powered sales coaching platform that:
- Automatically syncs and analyzes sales call recordings from Fireflies
- Provides AI-generated scoring across multiple sales competency categories
- Detects and tracks companies mentioned in calls
- Enables team collaboration with coaching notes and performance analytics
- Offers an AI chat assistant for contextual call and company insights

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **React 18** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS 4** | Styling |
| **Radix UI** | Headless UI components |
| **Framer Motion** | Animations |
| **GSAP** | Advanced animations |
| **Lenis** | Smooth scrolling |
| **Recharts** | Data visualization |
| **TanStack Table** | Data tables |

### Backend & Services
| Technology | Purpose |
|------------|---------|
| **Supabase** | Authentication, PostgreSQL database, real-time |
| **OpenAI API** | AI analysis and chat (GPT-4o, GPT-4 Turbo, etc.) |
| **Fireflies API** | Call transcript sync |
| **n8n** | Workflow automation |
| **OpenMeter** | Usage tracking and metering |
| **Nodemailer** | Email service |

### AI/ML
| Technology | Purpose |
|------------|---------|
| **AI SDK (Vercel)** | AI integration framework |
| **@ai-sdk/openai** | OpenAI provider |

---

## Core Features

### 1. Sales Call Management
- **Call Sync**: Automatically sync calls from Fireflies API
- **Call Listing**: Paginated table with search, filters, and sorting
- **Call Details**: Full transcript view with AI analysis
- **Call Deletion**: Remove calls with cascade deletion of related data

### 2. AI-Powered Call Scoring
Calls are scored on a 0-100 scale across these categories:

| Category | Description |
|----------|-------------|
| Call Setup & Control | Meeting structure and control |
| Discovery & Qualification | Understanding customer needs |
| Active Listening | Engagement and response quality |
| Value Communication | Presenting value propositions |
| Next Steps & Momentum | Closing actions and follow-ups |
| Objection Handling | Addressing concerns effectively |

**Score Visualization:**
- Green Badge: 80+ (Excellent)
- Yellow Badge: 60-79 (Good)
- Red Badge: <60 (Needs Improvement)

### 3. Company Intelligence
- **Auto-Detection**: AI identifies companies from call transcripts
- **Pain Points Aggregation**: Collects customer pain points across all companies
- **Risk Assessment**: Flags at-risk accounts based on call activity
- **Company Goals**: Set objectives for each account
- **AI Predictions**: Trigger n8n workflows to predict new companies

### 4. Team Collaboration
- **Team Creation/Joining**: Create new teams or join existing ones
- **Role Management**: Owner, Admin, and Member roles
- **Coaching Notes**: Admins can add coaching feedback for team members
- **Team Analytics**: Performance stats across the team

---

## Authentication & Onboarding

### Authentication
- **Supabase Auth**: Email/password authentication
- **Session Management**: Persistent sessions with secure tokens
- **Auth Callback**: `/auth/callback` route for OAuth flows

### Multi-Step Onboarding
Six-step onboarding flow:

| Step | Purpose |
|------|---------|
| Step 1 | User information (name, email) |
| Step 2 | Sales motion/framework selection |
| Step 3 | Company information |
| Step 4 | ICP configuration |
| Step 5 | Product/service setup |
| Step 6 | Final review |

**Features:**
- Progress tracking with visual indicators
- Form data persistence in localStorage
- Validation before step progression
- Onboarding guard for protected routes

---

## Dashboard

**Route:** `/dashboard`

### Components
1. **Section Cards**: Key metrics display
   - Total Calls
   - Average Score
   - Scored Calls
   - Performance Trend

2. **Interactive Chart**: Area chart showing call scores over time

3. **Coaching Notes**: Personal coaching feedback from team admins

4. **Recent Calls Table**:
   - Paginated list (10/20/30/40/50 per page)
   - Title, Duration, Score, Date columns
   - Click to view call details
   - "Scoring" animation for unscored calls

5. **Sync Button**: Manual sync from Fireflies

### Performance Features
- Lazy loading with Intersection Observer
- Server-side pagination
- Skeleton loaders during fetch
- Error boundaries for graceful failures

---

## Call Management & Analysis

### Calls Page
**Route:** `/calls`

**Features:**
- Advanced filtering:
  - Search by title/content
  - Score range slider (0-100)
  - Duration filters (min/max)
  - Only scored calls toggle
- Sorting options (by score, by date)
- Stats cards with aggregated metrics
- Server-side pagination

### Call Detail Page
**Route:** `/calls/[id]`

**Content:**
- Full call transcript
- AI analysis breakdown
- Category scores with explanations
- Deal risk alerts
- Qualification gaps
- Action items
- Meeting attendees

---

## AI Sales Intelligence Agent

**Route:** `/agent`

### Features
- **Context Selection**: Choose a call or company to analyze
- **Model Selection**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
- **Streaming Responses**: Real-time AI response generation
- **Reasoning Display**: Collapsible thinking/reasoning sections
- **Markdown Rendering**: Full markdown support with tables, code, lists
- **Quick Actions**: Pre-built prompts for common queries

### Quick Actions for Calls
- Key Insights
- Pain Points
- Action Items
- Deal Risks

### Quick Actions for Companies
- Company Overview
- Call History
- Recommendations
- Risk Assessment

### Chat Interface
- Message history with conversation flow
- Typing animation with cycling prompts
- Stop/cancel generation
- Context indicator showing selected call/company

---

## Company Intelligence

### Companies Page
**Route:** `/companies`

### Features

1. **Your Company Banner**: Display your company info with logo

2. **Stats Cards**:
   - Total Companies detected
   - Total Calls
   - Average Score
   - At Risk accounts

3. **Uncovered Pain Points**: Aggregated pain points from all companies
   - Expandable list
   - Click to navigate to company
   - AI extraction indicator

4. **Company Table**:
   - Company name with Clearbit logo
   - Industry (auto-detected)
   - Call count
   - Last call date
   - Risk status (Healthy/Warning/Critical)
   - Average score

5. **Filters**:
   - Search by name
   - Filter by industry
   - Filter by risk status
   - Sort by calls or score

6. **Actions**:
   - Add Company (manual)
   - Predict Companies (AI via n8n)
   - Set Goals
   - Delete Company

### Company Detail Page
**Route:** `/companies/[id]`

- Company profile
- Associated calls
- Pain points
- Contacts
- AI recommendations
- Risk summary

---

## Team Management

**Route:** `/team`

### Team States

#### No Team State
- Create new team
- Join existing team (by Team ID)

#### Team Member State
- Team header with info
- Members table
- Personal stats
- Coaching notes

### Team Features

| Feature | Description |
|---------|-------------|
| Create Team | Create new team with custom name |
| Join Team | Join via numeric Team ID |
| Leave Team | Members can leave (except owner) |
| Copy Team ID | Share ID for invites |
| Team Settings | Rename team (admin only) |

### Member Management (Admin Only)
- View all members
- Change member roles (Admin/Member)
- Remove members
- Invite new members via email
- Manage pending invitations
- Revoke invitations

### Invitation System
- Email invitations with secure tokens
- 7-day expiry
- Generated invite links
- Pending invitation tracking

### Team Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, cannot be removed |
| **Admin** | Manage members, settings, invites |
| **Member** | View content only |

### Team Analytics
**Route:** `/team/analytics`

- Member performance stats
- Total calls per member
- Average scores
- Recent activity (7 days)

### Member Detail
**Route:** `/team/member/[id]`

- Individual stats
- Call history
- Coaching notes

---

## Business Profile & Sales Playbook

**Route:** `/business`

### Profile Sections

#### 1. Company Information
- Company Name
- Website URL
- Industry
- Sales Motion
- Elevator Pitch / Value Proposition

#### 2. Products & Services
- Product name
- Description
- Up to 10 products

#### 3. Ideal Customer Profile (ICP)
- Company Size (chips)
- Geographic Regions (chips)
- Target Industries (chips)
- Tech Stack (chips)

#### 4. Buyer Personas
- Role/Name
- Notes (job title, decision influence)

#### 5. Talk Tracks
- Key talking points
- Unlimited tracks

#### 6. Objection Handling
- Common objections
- Prepared rebuttals

### Data Persistence
- Saved to Supabase (`users.business_profile`, `webhook_data`)
- Local storage for offline access
- Used by AI for call analysis

---

## Integrations

**Route:** `/integration`

### Fireflies Integration
- API key storage
- Call transcript sync
- Meeting data retrieval
- Webhook-based ingestion

### OpenAI Integration
- Custom API key support
- Model selection:
  - GPT-4o (Most capable)
  - GPT-4o Mini (Fast & efficient)
  - GPT-4 Turbo (Advanced reasoning)
  - GPT-3.5 Turbo (Quick & affordable)
- Token usage tracking

### n8n Workflow Integration
- Fireflies sync workflow
- Company prediction workflow
- Custom webhook payloads

### OpenMeter Usage Tracking
- API call tracking
- Transcript processing metrics
- Token usage monitoring

---

## Account & Settings

**Route:** `/account`

### Profile Management
- Name editing
- Email display (read-only)
- Avatar support
- Account creation timestamp
- Last login tracking

### Notification Preferences
**Route:** `/notification`

#### Email Notifications
- Weekly performance summaries
- Task reminders

#### In-App Notifications
- Integration status updates
- Call processed notifications
- Product updates
- Team mentions

### Account Actions
- Logout
- Delete Account (with confirmation)

---

## Landing Page

**Route:** `/` (root)

### Sections

1. **Navigation**: Responsive navbar with smooth scroll
2. **Hero Section**: Animated headline with CTA
3. **Logo Cloud**: Partner/integration logos
4. **Problem Section**: Pain points addressed
5. **Features Showcase**: Key feature highlights
6. **Dashboard Mockup**: Interactive preview
7. **How It Works**: Step-by-step guide
8. **Stats Section**: Key metrics
9. **Final CTA**: Sign-up call to action
10. **Footer**: Links and legal

### Animations
- GSAP for scroll-triggered animations
- Lenis for smooth scrolling
- Framer Motion for micro-interactions
- Parallax effects
- Horizontal scroll sections

---

## Database Schema

### Core Tables

```
users
├── id (UUID, PK)
├── email
├── name / full_name
├── team_id (FK)
├── business_profile (JSONB)
├── onboarding_completed (boolean)
├── created_at
└── updated_at

transcripts
├── id (SERIAL, PK)
├── user_id (FK)
├── title
├── duration (minutes)
├── transcript (text)
├── ai_overall_score (0-100)
├── ai_category_scores (JSONB)
├── ai_summary
├── created_at
└── fireflies_id

companies
├── id (SERIAL, PK)
├── company_id (FK to company)
├── company_name
├── domain
├── pain_points (JSONB array)
├── contacts (JSONB)
├── company_goal_objective
└── created_at

company (user's own company)
├── id (SERIAL, PK)
├── user_id (FK)
├── company_name
├── company_url
└── created_at

company_calls
├── id (SERIAL, PK)
├── company_id (FK)
├── transcript_id (FK)
└── created_at

teams
├── id (SERIAL, PK)
├── team_name
├── owner (FK to users)
├── members (UUID array)
└── created_at

team_invitations
├── id (UUID, PK)
├── team_id (FK)
├── email
├── invited_by (FK)
├── token
├── expires_at
├── status
└── created_at

team_tags
├── id (SERIAL, PK)
├── team_id (FK)
├── tag_name (Admin/Member)
├── tag_color
└── created_at

team_member_tags
├── id (SERIAL, PK)
├── team_id (FK)
├── user_id (FK)
├── tag_id (FK)
└── created_at

coaching_notes
├── id (SERIAL, PK)
├── team_id (FK)
├── user_id (FK)
├── coach_id (FK)
├── note (text)
└── created_at

api_keys
├── id (SERIAL, PK)
├── user_id (FK)
├── fireflies
├── openapi
└── created_at

notifications (preferences)
├── id (SERIAL, PK)
├── user_id (FK)
├── email_weekly_summary
├── email_task_reminders
├── inapp_integration_status
├── inapp_call_processed
├── inapp_product_updates
├── inapp_team_mentions
└── created_at

webhook_data
├── id (SERIAL, PK)
├── user_id (FK)
├── data (JSONB)
└── created_at
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent` | POST | AI agent chat endpoint |
| `/api/webhook` | POST | n8n webhook receiver |
| `/api/send-invitation` | POST | Send team invitation emails |
| `/api/upgrade-request` | POST | Handle upgrade requests |
| `/api/usage/track` | POST | Track usage metrics |

---

## Performance Optimizations

1. **Server-Side Pagination**: Only fetch current page data
2. **Lazy Loading**: Intersection Observer for deferred loading
3. **Caching**: localStorage caching with TTL
4. **Memoization**: React.memo and useMemo for expensive computations
5. **Skeleton Loaders**: Perceived performance during loading
6. **Debouncing**: 300ms debounce on search inputs
7. **Error Boundaries**: Graceful error handling

---

## Security Features

1. **Supabase RLS**: Row-level security policies
2. **Secure Token Storage**: API keys stored securely
3. **Input Validation**: Server-side validation with Zod
4. **XSS Prevention**: React's built-in escaping
5. **CSRF Protection**: Supabase session tokens
6. **Invitation Tokens**: Secure, expiring invite links

---

## Future Considerations

- Real-time collaboration features
- Advanced analytics dashboards
- Custom AI model training
- Mobile application
- Slack/Teams integrations
- CRM integrations (Salesforce, HubSpot)
- Video call recording support
- Multi-language support

---

*Last Updated: January 2025*
