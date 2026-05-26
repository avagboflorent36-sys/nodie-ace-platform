CREATE TABLE public.formation_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.formation_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_modules TO authenticated;
GRANT ALL ON public.formation_modules TO service_role;

ALTER TABLE public.formation_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads formation_modules"
  ON public.formation_modules FOR SELECT
  USING (true);

CREATE POLICY "Admins manage formation_modules"
  ON public.formation_modules FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

ALTER TABLE public.formation_resources
  ADD COLUMN IF NOT EXISTS module_id uuid;

CREATE INDEX IF NOT EXISTS idx_formation_resources_module_id
  ON public.formation_resources(module_id);

CREATE INDEX IF NOT EXISTS idx_formation_modules_formation_id
  ON public.formation_modules(formation_id);