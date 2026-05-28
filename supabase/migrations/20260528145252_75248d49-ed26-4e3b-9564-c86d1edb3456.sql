
-- =====================================================
-- 1. cohort_access_rules
-- =====================================================
CREATE TABLE public.cohort_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'installment_overdue',
  installment_position integer,
  offset_days integer NOT NULL DEFAULT 7,
  action text NOT NULL DEFAULT 'restrict_access',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_access_rules TO authenticated;
GRANT ALL ON public.cohort_access_rules TO service_role;

ALTER TABLE public.cohort_access_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cohort_access_rules"
ON public.cohort_access_rules FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_cohort_access_rules_cohort ON public.cohort_access_rules(cohort_id, enabled);

-- =====================================================
-- 2. cohort_email_campaigns
-- =====================================================
CREATE TABLE public.cohort_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body_html text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  recipient_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_email_campaigns TO authenticated;
GRANT ALL ON public.cohort_email_campaigns TO service_role;

ALTER TABLE public.cohort_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cohort_email_campaigns"
ON public.cohort_email_campaigns FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_cohort_email_campaigns_due
  ON public.cohort_email_campaigns(scheduled_at, status)
  WHERE status IN ('scheduled');

-- =====================================================
-- 3. automation_run_log
-- =====================================================
CREATE TABLE public.automation_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  payload jsonb,
  error text
);

GRANT SELECT, INSERT ON public.automation_run_log TO authenticated;
GRANT ALL ON public.automation_run_log TO service_role;

ALTER TABLE public.automation_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read automation_run_log"
ON public.automation_run_log FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_automation_run_log_recent ON public.automation_run_log(run_at DESC);

-- =====================================================
-- 4. Auto-restore access when an installment is validated
-- =====================================================
CREATE OR REPLACE FUNCTION public.restore_access_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_cohort_id uuid;
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated') THEN
    SELECT p.student_id, p.cohort_id INTO v_student_id, v_cohort_id
    FROM public.payments p WHERE p.id = NEW.payment_id;

    UPDATE public.cohort_enrollments
    SET status = 'active'
    WHERE student_id = v_student_id
      AND cohort_id = v_cohort_id
      AND status = 'restricted';

    INSERT INTO public.automation_run_log (job_type, status, payload)
    VALUES ('auto_restore_access', 'ok',
      jsonb_build_object('student_id', v_student_id, 'cohort_id', v_cohort_id, 'installment_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_access_on_payment ON public.payment_installments;
CREATE TRIGGER trg_restore_access_on_payment
AFTER UPDATE ON public.payment_installments
FOR EACH ROW
EXECUTE FUNCTION public.restore_access_on_payment();
