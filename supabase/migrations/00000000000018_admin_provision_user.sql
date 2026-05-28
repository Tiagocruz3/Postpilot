-- Admin user provisioning helper used by the `admin-manage-user` edge function
-- after `auth.admin.createUser` succeeds. Sets the role (via user_roles),
-- ensures a credit account row exists, and assigns the membership plan +
-- subscription status in a single SECURITY DEFINER call so the edge function
-- only needs the service-role key for the auth user creation itself.

CREATE OR REPLACE FUNCTION public.admin_provision_user(
  p_user_id UUID,
  p_role TEXT DEFAULT 'member',
  p_plan TEXT DEFAULT 'free',
  p_subscription_status TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.user_credit_accounts;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- Role assignment.
  IF p_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin';
  END IF;

  -- Credit account + membership plan.
  PERFORM public.ensure_user_credit_account(p_user_id);
  UPDATE public.user_credit_accounts
  SET
    membership_plan = COALESCE(p_plan, membership_plan),
    subscription_status = COALESCE(p_subscription_status, subscription_status),
    updated_at = timezone('utc', now())
  WHERE user_id = p_user_id
  RETURNING * INTO acct;

  RETURN jsonb_build_object('success', true, 'account', row_to_json(acct));
END;
$$;

-- Service-role-only: edge function calls this with the service key. Keep
-- regular authenticated callers locked out so this can't be abused.
REVOKE ALL ON FUNCTION public.admin_provision_user(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_provision_user(UUID, TEXT, TEXT, TEXT) TO service_role;

-- The edge function also needs to call is_platform_admin from the service
-- role context to verify the caller, so make it callable from there too.
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO service_role;
