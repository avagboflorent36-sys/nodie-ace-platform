-- 1. Repair existing data: for any 2-installment payment that paid only the first
--    tranche and has no row for tranche 2, create it; and align amount_total.
DO $$
DECLARE
  r record;
  v_inst1_amount numeric;
  v_price_installment numeric;
  v_due_days integer;
BEGIN
  FOR r IN
    SELECT p.id AS payment_id,
           p.cohort_id,
           p.amount_total,
           p.amount_paid,
           c.price_installment,
           c.installment_2_deadline_days,
           c.start_date
    FROM public.payments p
    JOIN public.cohortes c ON c.id = p.cohort_id
    WHERE p.mode = 'installments_2'
  LOOP
    v_price_installment := COALESCE(r.price_installment, r.amount_total);
    v_due_days := COALESCE(r.installment_2_deadline_days, 45);

    -- Fix amount_total when it equals a single tranche
    IF r.amount_total IS NULL OR r.amount_total < v_price_installment * 2 THEN
      UPDATE public.payments
      SET amount_total = v_price_installment * 2
      WHERE id = r.payment_id;
    END IF;

    -- Ensure installment row #2 exists
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_installments
      WHERE payment_id = r.payment_id AND position = 2
    ) THEN
      INSERT INTO public.payment_installments (payment_id, position, amount, due_date, status)
      VALUES (
        r.payment_id,
        2,
        v_price_installment,
        COALESCE(r.start_date, CURRENT_DATE) + (v_due_days || ' days')::interval,
        'pending'
      );
    END IF;

    -- Ensure installment row #1 exists (in case it was never created)
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_installments
      WHERE payment_id = r.payment_id AND position = 1
    ) THEN
      INSERT INTO public.payment_installments (payment_id, position, amount, due_date, status)
      VALUES (
        r.payment_id,
        1,
        v_price_installment,
        COALESCE(r.start_date, CURRENT_DATE),
        'pending'
      );
    END IF;
  END LOOP;
END $$;

-- 2. Trigger: when tranche 1 of a 2-installment payment is validated,
--    automatically create tranche 2 if missing.
CREATE OR REPLACE FUNCTION public.ensure_tranche2_installment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_cohort record;
  v_amount numeric;
BEGIN
  IF NEW.position <> 1 OR NEW.status <> 'validated' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'validated' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = NEW.payment_id;
  IF v_payment.mode <> 'installments_2' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cohort FROM public.cohortes WHERE id = v_payment.cohort_id;
  v_amount := COALESCE(v_cohort.price_installment, NEW.amount);

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_installments
    WHERE payment_id = NEW.payment_id AND position = 2
  ) THEN
    INSERT INTO public.payment_installments (payment_id, position, amount, due_date, status)
    VALUES (
      NEW.payment_id,
      2,
      v_amount,
      COALESCE(v_cohort.start_date, CURRENT_DATE) + (COALESCE(v_cohort.installment_2_deadline_days, 45) || ' days')::interval,
      'pending'
    );
  END IF;

  -- Make sure payment.amount_total reflects two tranches
  IF v_payment.amount_total < v_amount * 2 THEN
    UPDATE public.payments SET amount_total = v_amount * 2 WHERE id = v_payment.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_tranche2_installment ON public.payment_installments;
CREATE TRIGGER trg_ensure_tranche2_installment
AFTER UPDATE OF status ON public.payment_installments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_tranche2_installment();