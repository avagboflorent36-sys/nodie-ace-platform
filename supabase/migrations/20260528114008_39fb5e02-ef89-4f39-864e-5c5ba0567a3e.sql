
CREATE TABLE public.chariow_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  cohort_id uuid NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  mode payment_mode NOT NULL,
  installment_position integer NOT NULL DEFAULT 1,
  chariow_product_id text,
  amount_expected numeric,
  currency text NOT NULL DEFAULT 'XOF',
  checkout_url text,
  chariow_sale_id text,
  status text NOT NULL DEFAULT 'created',
  last_error text,
  chariow_raw_response jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.chariow_payment_attempts TO authenticated;
GRANT ALL ON public.chariow_payment_attempts TO service_role;

ALTER TABLE public.chariow_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage chariow_payment_attempts"
  ON public.chariow_payment_attempts FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE INDEX idx_chariow_attempts_token ON public.chariow_payment_attempts(token);
CREATE INDEX idx_chariow_attempts_sale_id ON public.chariow_payment_attempts(chariow_sale_id);
CREATE INDEX idx_chariow_attempts_email ON public.chariow_payment_attempts(lower(email));
CREATE INDEX idx_chariow_attempts_status ON public.chariow_payment_attempts(status, created_at DESC);

CREATE TRIGGER trg_chariow_attempts_updated_at
  BEFORE UPDATE ON public.chariow_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
