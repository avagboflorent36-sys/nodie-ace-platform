
CREATE TABLE public.cohort_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 1,
  label text,
  percent numeric,
  amount numeric,
  due_offset_days int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cohort_payment_schedule TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cohort_payment_schedule TO authenticated;
GRANT ALL ON public.cohort_payment_schedule TO service_role;
ALTER TABLE public.cohort_payment_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads payment schedule" ON public.cohort_payment_schedule FOR SELECT USING (true);
CREATE POLICY "Admins manage payment schedule" ON public.cohort_payment_schedule FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.cohort_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  offset_days int NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'email',
  template_key text NOT NULL DEFAULT 'reminder_before',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cohort_reminder_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cohort_reminder_rules TO authenticated;
GRANT ALL ON public.cohort_reminder_rules TO service_role;
ALTER TABLE public.cohort_reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read reminder rules" ON public.cohort_reminder_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage reminder rules" ON public.cohort_reminder_rules FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
