-- ─────────────────────────────────────────────────────────────────────────────
-- SOD / EOD revamp: risk, completion, confidence, quality gate.
-- Additive only — existing rows keep working (new columns default null/false).
-- History is already retained: checkins/eod_updates are one-row-per-user-per-day
-- (unique(user_id, date)) and are never deleted.
-- ─────────────────────────────────────────────────────────────────────────────

-- Morning check-in (SOD)
alter table public.checkins
  add column if not exists risk boolean not null default false,
  add column if not exists risk_note text,
  add column if not exists tagged_issues jsonb;

-- End of day (EOD)
-- "What's shipped today?" reuses the existing `accomplished` column.
alter table public.eod_updates
  add column if not exists completion_pct integer,      -- 0–100 toward final delivery
  add column if not exists confidence text,             -- 'high' | 'medium' | 'low'
  add column if not exists risk boolean not null default false,
  add column if not exists risk_note text,
  add column if not exists quality_gate jsonb,          -- { matches_prd, dev_qa, needs_review, review_what_whom }
  add column if not exists tagged_issues jsonb;

notify pgrst, 'reload schema';
