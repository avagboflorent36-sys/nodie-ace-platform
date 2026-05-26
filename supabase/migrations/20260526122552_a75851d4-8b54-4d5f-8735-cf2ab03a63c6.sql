
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'student');
CREATE TYPE public.cohort_status AS ENUM ('inscription_open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'suspended', 'completed', 'cancelled');
CREATE TYPE public.payment_mode AS ENUM ('full', 'installments_2');
CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'pending', 'overdue', 'suspended');
CREATE TYPE public.installment_status AS ENUM ('pending', 'submitted', 'validated', 'rejected');
CREATE TYPE public.resource_type AS ENUM ('video', 'document', 'link', 'exercise');
CREATE TYPE public.notification_type AS ENUM ('new_enrollment', 'payment_received', 'payment_validated', 'payment_overdue', 'new_resource', 'live_session', 'suspension', 'reactivation', 'announcement');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  whatsapp TEXT,
  country TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (separate table for security) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role: SECURITY DEFINER, search_path locked
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  );
$$;

-- ============ FORMATIONS ============
CREATE TABLE public.formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  price_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  duration_weeks INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

-- ============ COHORTES ============
CREATE TABLE public.cohortes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  status public.cohort_status NOT NULL DEFAULT 'inscription_open',
  zoom_link TEXT,
  price_full NUMERIC(10,2),
  price_installment NUMERIC(10,2),
  installment_deadline_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cohortes ENABLE ROW LEVEL SECURITY;

-- ============ MODULES ============
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- ============ RESSOURCES ============
CREATE TABLE public.ressources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  type public.resource_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  file_path TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ressources ENABLE ROW LEVEL SECURITY;

-- ============ LIVE SESSIONS ============
CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  meeting_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- ============ ANNONCES ============
CREATE TABLE public.annonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;

-- ============ ENROLLMENTS ============
CREATE TABLE public.cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, cohort_id)
);
ALTER TABLE public.cohort_enrollments ENABLE ROW LEVEL SECURITY;

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES public.cohortes(id) ON DELETE CASCADE,
  amount_total NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  mode public.payment_mode NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  final_deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============ PAYMENT INSTALLMENTS ============
CREATE TABLE public.payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  position INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE,
  status public.installment_status NOT NULL DEFAULT 'pending',
  proof_path TEXT,
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

-- ============ PROGRESS TRACKING ============
CREATE TABLE public.progress_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ressource_id UUID NOT NULL REFERENCES public.ressources(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, ressource_id)
);
ALTER TABLE public.progress_tracking ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

-- ============ is_student_active ============
CREATE OR REPLACE FUNCTION public.is_student_active(_student_id UUID, _cohort_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.cohort_enrollments e ON e.student_id = p.student_id AND e.cohort_id = p.cohort_id
    WHERE p.student_id = _student_id
      AND p.cohort_id = _cohort_id
      AND e.status = 'active'
      AND p.status IN ('paid', 'partial', 'pending')
      AND (p.final_deadline IS NULL OR p.final_deadline >= CURRENT_DATE OR p.status = 'paid')
  );
$$;

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER formations_updated_at BEFORE UPDATE ON public.formations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cohortes_updated_at BEFORE UPDATE ON public.cohortes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Auto profile + role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, whatsapp, country)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'whatsapp',
    NEW.raw_user_meta_data->>'country'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Notify admins on new enrollment ============
CREATE OR REPLACE FUNCTION public.notify_admins_new_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_cohort_name TEXT;
  v_student_name TEXT;
BEGIN
  SELECT name INTO v_cohort_name FROM public.cohortes WHERE id = NEW.cohort_id;
  SELECT COALESCE(first_name || ' ' || last_name, email) INTO v_student_name FROM public.profiles WHERE id = NEW.student_id;
  FOR v_admin_id IN SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin') LOOP
    INSERT INTO public.notifications (user_id, type, title, content, link)
    VALUES (v_admin_id, 'new_enrollment', 'Nouvelle inscription', v_student_name || ' s''est inscrit à ' || v_cohort_name, '/admin/etudiants');
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_new_enrollment AFTER INSERT ON public.cohort_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_enrollment();

-- ============ Notify student on payment validation ============
CREATE OR REPLACE FUNCTION public.notify_payment_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated') THEN
    SELECT student_id INTO v_student_id FROM public.payments WHERE id = NEW.payment_id;
    INSERT INTO public.notifications (user_id, type, title, content, link)
    VALUES (v_student_id, 'payment_validated', 'Paiement validé', 'Votre paiement de ' || NEW.amount || ' a été validé.', '/etudiant/paiements');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_installment_validated AFTER UPDATE ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_validated();

-- ============ Auto-update payment amount_paid + status when installment validated ============
CREATE OR REPLACE FUNCTION public.update_payment_on_installment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_paid NUMERIC;
BEGIN
  SELECT amount_total INTO v_total FROM public.payments WHERE id = NEW.payment_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.payment_installments
    WHERE payment_id = NEW.payment_id AND status = 'validated';
  UPDATE public.payments
  SET amount_paid = v_paid,
      status = CASE
        WHEN v_paid >= v_total THEN 'paid'::public.payment_status
        WHEN v_paid > 0 THEN 'partial'::public.payment_status
        ELSE status
      END
  WHERE id = NEW.payment_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_installment_status_change AFTER INSERT OR UPDATE OF status ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_on_installment();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- USER_ROLES
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- FORMATIONS (public read for active)
CREATE POLICY "Anyone reads active formations" ON public.formations FOR SELECT USING (is_active = true);
CREATE POLICY "Admins read all formations" ON public.formations FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage formations" ON public.formations FOR ALL USING (public.is_admin(auth.uid()));

-- COHORTES (public read open ones)
CREATE POLICY "Anyone reads cohortes" ON public.cohortes FOR SELECT USING (true);
CREATE POLICY "Admins manage cohortes" ON public.cohortes FOR ALL USING (public.is_admin(auth.uid()));

-- MODULES
CREATE POLICY "Enrolled active students read modules" ON public.modules FOR SELECT USING (
  public.is_student_active(auth.uid(), cohort_id)
);
CREATE POLICY "Admins manage modules" ON public.modules FOR ALL USING (public.is_admin(auth.uid()));

-- RESSOURCES (restricted: only active students)
CREATE POLICY "Active students read ressources" ON public.ressources FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = ressources.module_id
      AND public.is_student_active(auth.uid(), m.cohort_id)
  )
);
CREATE POLICY "Admins manage ressources" ON public.ressources FOR ALL USING (public.is_admin(auth.uid()));

-- LIVE SESSIONS (restricted)
CREATE POLICY "Active students read live" ON public.live_sessions FOR SELECT USING (
  public.is_student_active(auth.uid(), cohort_id)
);
CREATE POLICY "Admins manage live" ON public.live_sessions FOR ALL USING (public.is_admin(auth.uid()));

-- ANNONCES
CREATE POLICY "Enrolled students read annonces" ON public.annonces FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cohort_enrollments e WHERE e.cohort_id = annonces.cohort_id AND e.student_id = auth.uid())
);
CREATE POLICY "Admins manage annonces" ON public.annonces FOR ALL USING (public.is_admin(auth.uid()));

-- ENROLLMENTS
CREATE POLICY "Students read own enrollments" ON public.cohort_enrollments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins read enrollments" ON public.cohort_enrollments FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage enrollments" ON public.cohort_enrollments FOR ALL USING (public.is_admin(auth.uid()));

-- PAYMENTS
CREATE POLICY "Students read own payments" ON public.payments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins read payments" ON public.payments FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL USING (public.is_admin(auth.uid()));

-- PAYMENT INSTALLMENTS
CREATE POLICY "Students read own installments" ON public.payment_installments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_installments.payment_id AND p.student_id = auth.uid())
);
CREATE POLICY "Students upload own proof" ON public.payment_installments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_installments.payment_id AND p.student_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_installments.payment_id AND p.student_id = auth.uid())
);
CREATE POLICY "Admins manage installments" ON public.payment_installments FOR ALL USING (public.is_admin(auth.uid()));

-- PROGRESS TRACKING
CREATE POLICY "Students read own progress" ON public.progress_tracking FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students write own progress" ON public.progress_tracking FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students delete own progress" ON public.progress_tracking FOR DELETE USING (auth.uid() = student_id);
CREATE POLICY "Admins read all progress" ON public.progress_tracking FOR SELECT USING (public.is_admin(auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('payment-proofs', 'payment-proofs', false),
  ('ressources', 'ressources', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: avatars (public)
CREATE POLICY "Avatar images public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- payment-proofs (private, student writes, admin reads)
CREATE POLICY "Students upload payment proof" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Students read own proof" ON storage.objects FOR SELECT USING (
  bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Admins read all proofs" ON storage.objects FOR SELECT USING (
  bucket_id = 'payment-proofs' AND public.is_admin(auth.uid())
);

-- ressources (private, only active students read via signed URLs through edge; admins write)
CREATE POLICY "Admins upload ressources files" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'ressources' AND public.is_admin(auth.uid())
);
CREATE POLICY "Admins manage ressources files" ON storage.objects FOR UPDATE USING (
  bucket_id = 'ressources' AND public.is_admin(auth.uid())
);
CREATE POLICY "Admins delete ressources files" ON storage.objects FOR DELETE USING (
  bucket_id = 'ressources' AND public.is_admin(auth.uid())
);
CREATE POLICY "Authenticated read ressources files" ON storage.objects FOR SELECT USING (
  bucket_id = 'ressources' AND auth.uid() IS NOT NULL
);

-- Realtime publication for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
