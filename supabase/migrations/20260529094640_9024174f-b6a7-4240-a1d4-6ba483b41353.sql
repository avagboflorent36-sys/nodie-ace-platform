ALTER TABLE public.cohort_enrollments
ADD COLUMN IF NOT EXISTS certificate_unlocked_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS certificate_unlocked_by uuid NULL;