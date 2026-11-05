# Daily Status

A workspace for organizations to manage team daily updates, tasks, sprints, and
progress. Members share planned and completed work, blockers, and availability;
teams can also manage boards, issues, and project documentation.

Production-ready setup runbook for local development with Supabase.

This README replaces the generic Next.js template and documents the exact order needed to run this repo without setup surprises.

## 1) Prerequisites

- macOS, Linux, or Windows with a shell
- Node.js 22 LTS recommended (Node 20+ also works)
- npm 10+
- A Supabase project (new or existing)

## 2) Install dependencies

From project root:

```bash
npm ci
```

If lockfile conflicts or npm ci fails because of local changes:

```bash
npm install
```

## 3) Create environment file

Create a file named .env.local in the repository root:

```bash
cp .env.local.example .env.local
```

Use this template content:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET=LONG_RANDOM_SECRET_VALUE
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

Notes:

- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are used by browser and server auth clients.
- SUPABASE_SERVICE_ROLE_KEY is required for invite flows, cron jobs, and server-side notification writes.
- CRON_SECRET must match the x-cron-secret header sent to cron endpoints.
- GROQ_API_KEY is required for AI summary/chat features.

## 4) Supabase Auth configuration

In Supabase Dashboard:

1. Go to Authentication -> URL Configuration.
2. Set Site URL to:
	- http://localhost:3000
3. Add Redirect URLs:
	- http://localhost:3000/auth/callback
	- http://localhost:3000/join/*
	- http://localhost:3000/auth/reset-password

Without these redirects, sign-in, invite accept, and password reset callbacks can fail.

## 5) Database setup (exact SQL order)

Open Supabase SQL Editor and run files in this exact order.

Core and migrations:

1. supabase/schema.sql
2. supabase/schema-v2.sql
3. supabase/schema-v3.sql
4. supabase/schema-v4.sql
5. supabase/schema-v5.sql
6. supabase/schema-team-profiles.sql

Feature schemas:

7. supabase/schema-docs.sql
8. supabase/schema-sod-eod.sql
9. supabase/schema-notifications.sql (STEP 1 block first)

Optional scheduler:

10. Enable extension pg_cron in Supabase.
11. Run schema-notifications.sql STEP 2 block (cron.schedule) only after pg_cron is enabled.

Why this order matters:

- schema-v5 creates boards/issues tables referenced by notifications foreign keys.
- notifications must come after v5 to avoid FK errors.

## 6) Required manual storage setup

Create a Supabase Storage bucket named issue-attachments.

Recommended for current code path:

- Public bucket (current API stores/uses public URLs)
- Max file size 10 MB

If you make it private, attachment APIs must be updated to signed URL flow.

## 7) Run the app

```bash
npm run dev
```

Open:

- http://localhost:3000

## 8) Quick verification checklist

After startup, verify in this order:

1. Sign up or sign in from /login.
2. Complete onboarding (create team or join invite).
3. Open dashboard and create at least one project/board item.
4. Upload one issue attachment (tests storage bucket wiring).
5. Trigger AI route from board chat (tests GROQ key).

## 9) Optional cron endpoint test (local)

Use the same CRON_SECRET from .env.local:

```bash
curl -i -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/generate-summary
curl -i -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/morning-reminder
curl -i -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/eod-reminder
```

Expected behavior:

- Correct secret -> 200 response JSON
- Wrong/missing secret -> 401 Unauthorized

## 10) Known gotchas and fixes

1. SQL rerun collisions
- Some scripts are idempotent; some policies in schema-notifications.sql can fail on repeated runs.
- If rerunning notifications script, drop conflicting policies first or run only missing statements.

2. schema-v3 policy cleanup line
- schema-v3 creates an admin team-update policy and later drops it in the same file.
- Keep as-is for compatibility with current project behavior unless you intentionally tighten team update rules.

3. Invite emails not sending
- Verify SUPABASE_SERVICE_ROLE_KEY.
- Confirm auth email provider is configured in Supabase.

4. Login redirect loops
- Recheck Auth Site URL and Redirect URLs in Supabase config.

## 11) Useful commands

```bash
# development
npm run dev

# production build check
npm run build

# lint
npm run lint
```

## 12) Tech stack

- Next.js 16
- React 19
- Supabase (Auth, Postgres, Storage)
- Tailwind CSS 4
- TanStack Query
- Groq SDK

---

If this setup is followed in order, the repository should boot cleanly with working auth, onboarding, invites, board data, attachments, notifications, and AI features.
