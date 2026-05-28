
-- Harden SECURITY DEFINER trigger functions: revoke EXECUTE from public roles.
-- These functions are only invoked by triggers (BEFORE/AFTER INSERT/UPDATE)
-- and must not be callable directly by anon or authenticated users.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_enrollment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payment_validated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_access_on_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_on_installment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_tranche2_installment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_payment_tranche2_token() FROM PUBLIC, anon, authenticated;

-- Keep RLS helpers callable by authenticated users (needed by RLS policies).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_active(uuid, uuid) TO authenticated;
