ALTER TABLE public.chariow_payment_attempts
ADD COLUMN IF NOT EXISTS payment_id uuid,
ADD COLUMN IF NOT EXISTS installment_id uuid;

CREATE INDEX IF NOT EXISTS idx_chariow_attempts_payment
  ON public.chariow_payment_attempts(payment_id, installment_position, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chariow_attempts_installment
  ON public.chariow_payment_attempts(installment_id, created_at DESC);

UPDATE public.chariow_payment_attempts a
SET payment_id = p.id
FROM public.payments p
WHERE a.payment_id IS NULL
  AND p.cohort_id = a.cohort_id
  AND lower(p.chariow_customer_email) = lower(a.email);

UPDATE public.chariow_payment_attempts a
SET installment_id = i.id
FROM public.payment_installments i
WHERE a.installment_id IS NULL
  AND a.payment_id = i.payment_id
  AND a.installment_position = i.position;

UPDATE public.payments p
SET amount_paid = COALESCE(v.amount_paid, 0),
    status = CASE
      WHEN COALESCE(v.amount_paid, 0) >= p.amount_total THEN 'paid'::public.payment_status
      WHEN COALESCE(v.amount_paid, 0) > 0 THEN 'partial'::public.payment_status
      ELSE 'pending'::public.payment_status
    END
FROM (
  SELECT payment_id, COALESCE(SUM(amount), 0) AS amount_paid
  FROM public.payment_installments
  WHERE status = 'validated'
  GROUP BY payment_id
) v
WHERE p.id = v.payment_id;