
-- 1. cohortes : 3 product IDs Chariow
ALTER TABLE public.cohortes
  ADD COLUMN IF NOT EXISTS chariow_product_id_full text,
  ADD COLUMN IF NOT EXISTS chariow_product_id_installment_1 text,
  ADD COLUMN IF NOT EXISTS chariow_product_id_installment_2 text;

-- 2. payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS chariow_sale_id text,
  ADD COLUMN IF NOT EXISTS chariow_customer_email text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS payments_chariow_sale_id_key
  ON public.payments(chariow_sale_id) WHERE chariow_sale_id IS NOT NULL;

-- 3. payment_installments
ALTER TABLE public.payment_installments
  ADD COLUMN IF NOT EXISTS chariow_sale_id text,
  ADD COLUMN IF NOT EXISTS chariow_raw_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS payment_installments_chariow_sale_id_key
  ON public.payment_installments(chariow_sale_id) WHERE chariow_sale_id IS NOT NULL;

-- 4. chariow_webhook_events
CREATE TABLE IF NOT EXISTS public.chariow_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  sale_id text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text,
  UNIQUE(event_type, sale_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chariow_webhook_events TO authenticated;
GRANT ALL ON public.chariow_webhook_events TO service_role;

ALTER TABLE public.chariow_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read chariow_webhook_events"
  ON public.chariow_webhook_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage chariow_webhook_events"
  ON public.chariow_webhook_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. pending_enrollments
CREATE TABLE IF NOT EXISTS public.pending_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  chariow_sale_id text UNIQUE,
  mode public.payment_mode NOT NULL,
  installment_position integer,
  claim_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  claimed_at timestamptz,
  claimed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_enrollments_email_idx ON public.pending_enrollments(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_enrollments TO authenticated;
GRANT ALL ON public.pending_enrollments TO service_role;

ALTER TABLE public.pending_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pending_enrollments"
  ON public.pending_enrollments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
