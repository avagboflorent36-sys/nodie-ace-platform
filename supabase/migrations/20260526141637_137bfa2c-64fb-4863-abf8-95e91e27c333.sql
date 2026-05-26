
ALTER TYPE public.enrollment_status ADD VALUE IF NOT EXISTS 'restricted';

DO $$ BEGIN
  CREATE TYPE public.form_field_type AS ENUM ('short_text','long_text','email','phone','single_choice','multiple_choice','file','number','date');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.cohortes
  ADD COLUMN IF NOT EXISTS installment_1_deadline_days integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS installment_2_deadline_days integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS reminder_days_before integer[] NOT NULL DEFAULT ARRAY[7,3,1];

ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS student_confirmed_at timestamptz;

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS program jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL,
  label text NOT NULL,
  field_type public.form_field_type NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.form_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads form_fields" ON public.form_fields;
CREATE POLICY "Anyone reads form_fields" ON public.form_fields FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage form_fields" ON public.form_fields;
CREATE POLICY "Admins manage form_fields" ON public.form_fields FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL,
  student_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.form_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_responses TO authenticated;
GRANT ALL ON public.form_responses TO service_role;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone inserts form_responses" ON public.form_responses;
CREATE POLICY "Anyone inserts form_responses" ON public.form_responses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read form_responses" ON public.form_responses;
CREATE POLICY "Admins read form_responses" ON public.form_responses FOR SELECT USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Students read own form_responses" ON public.form_responses;
CREATE POLICY "Students read own form_responses" ON public.form_responses FOR SELECT USING (auth.uid() = student_id);

CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'sent',
  error text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reminders TO authenticated;
GRANT ALL ON public.payment_reminders TO service_role;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage payment_reminders" ON public.payment_reminders;
CREATE POLICY "Admins manage payment_reminders" ON public.payment_reminders FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.formation_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  type public.resource_type NOT NULL,
  url text,
  file_path text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.formation_resources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_resources TO authenticated;
GRANT ALL ON public.formation_resources TO service_role;
ALTER TABLE public.formation_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage formation_resources" ON public.formation_resources;
CREATE POLICY "Admins manage formation_resources" ON public.formation_resources FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Enrolled students read formation_resources" ON public.formation_resources;
CREATE POLICY "Enrolled students read formation_resources" ON public.formation_resources FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.cohortes c
    JOIN public.cohort_enrollments e ON e.cohort_id = c.id
    WHERE c.formation_id = formation_resources.formation_id
      AND e.student_id = auth.uid()
      AND e.status = 'active'
  )
);
