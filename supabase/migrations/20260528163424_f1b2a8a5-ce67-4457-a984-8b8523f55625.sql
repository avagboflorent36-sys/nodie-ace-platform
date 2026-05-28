ALTER TABLE public.cohort_reminder_rules
  ADD COLUMN IF NOT EXISTS trigger_mode text NOT NULL DEFAULT 'relative',
  ADD COLUMN IF NOT EXISTS time_of_day time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

ALTER TABLE public.cohort_reminder_rules
  DROP CONSTRAINT IF EXISTS cohort_reminder_rules_trigger_mode_chk;
ALTER TABLE public.cohort_reminder_rules
  ADD CONSTRAINT cohort_reminder_rules_trigger_mode_chk
  CHECK (trigger_mode IN ('relative', 'absolute'));

ALTER TABLE public.cohort_access_rules
  ADD COLUMN IF NOT EXISTS trigger_mode text NOT NULL DEFAULT 'relative',
  ADD COLUMN IF NOT EXISTS time_of_day time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

ALTER TABLE public.cohort_access_rules
  DROP CONSTRAINT IF EXISTS cohort_access_rules_trigger_mode_chk;
ALTER TABLE public.cohort_access_rules
  ADD CONSTRAINT cohort_access_rules_trigger_mode_chk
  CHECK (trigger_mode IN ('relative', 'absolute'));