-- Platform membership credits per user
CREATE TABLE IF NOT EXISTS public.user_credit_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_plan TEXT NOT NULL DEFAULT 'free'
    CHECK (membership_plan IN ('free', 'starter', 'pro', 'growth', 'agency')),
  monthly_credits_used INTEGER NOT NULL DEFAULT 0 CHECK (monthly_credits_used >= 0),
  topup_credits_balance INTEGER NOT NULL DEFAULT 0 CHECK (topup_credits_balance >= 0),
  cycle_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', timezone('utc', now())),
  cycle_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', timezone('utc', now())) + interval '1 month'),
  posts_used INTEGER NOT NULL DEFAULT 0 CHECK (posts_used >= 0),
  images_used INTEGER NOT NULL DEFAULT 0 CHECK (images_used >= 0),
  videos_used INTEGER NOT NULL DEFAULT 0 CHECK (videos_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.credit_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER,
  model_used TEXT,
  account_role TEXT NOT NULL DEFAULT 'member' CHECK (account_role IN ('admin', 'member')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS credit_usage_logs_user_created_idx
  ON public.credit_usage_logs (user_id, created_at DESC);

ALTER TABLE public.user_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_credit_accounts_select_own"
  ON public.user_credit_accounts FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_credit_accounts_insert_own"
  ON public.user_credit_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_credit_accounts_update_own"
  ON public.user_credit_accounts FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "credit_usage_logs_select_own"
  ON public.credit_usage_logs FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "credit_usage_logs_insert_own"
  ON public.credit_usage_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Platform admin by email (case-insensitive)
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id AND lower(email) = 'tiagoruz3@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_credit_account(p_user_id UUID DEFAULT auth.uid())
RETURNS public.user_credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.user_credit_accounts;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO acct FROM public.user_credit_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_credit_accounts (user_id)
    VALUES (p_user_id)
    RETURNING * INTO acct;
  END IF;

  -- Roll monthly cycle if past end
  IF acct.cycle_end <= timezone('utc', now()) THEN
    UPDATE public.user_credit_accounts
    SET
      monthly_credits_used = 0,
      posts_used = 0,
      images_used = 0,
      videos_used = 0,
      cycle_start = date_trunc('month', timezone('utc', now())),
      cycle_end = date_trunc('month', timezone('utc', now())) + interval '1 month',
      updated_at = timezone('utc', now())
    WHERE user_id = p_user_id
    RETURNING * INTO acct;
  END IF;

  RETURN acct;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_action_type TEXT,
  p_credits INTEGER,
  p_workspace_id UUID DEFAULT NULL,
  p_model_used TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  acct public.user_credit_accounts;
  plan_allowance INTEGER;
  monthly_remaining INTEGER;
  total_remaining INTEGER;
  from_monthly INTEGER := 0;
  from_topup INTEGER := 0;
  is_admin BOOLEAN;
  role_label TEXT := 'member';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  is_admin := public.is_platform_admin(uid);
  IF is_admin THEN
    role_label := 'admin';
    INSERT INTO public.credit_usage_logs (
      user_id, workspace_id, action_type, credits_used, balance_after, model_used, account_role, metadata
    ) VALUES (
      uid, p_workspace_id, p_action_type, p_credits, NULL, p_model_used, role_label,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('unlimited', true)
    );
    RETURN jsonb_build_object(
      'success', true,
      'unlimited', true,
      'balance_after', null
    );
  END IF;

  acct := public.ensure_user_credit_account(uid);

  plan_allowance := CASE acct.membership_plan
    WHEN 'starter' THEN 750
    WHEN 'pro' THEN 2500
    WHEN 'growth' THEN 7500
    WHEN 'agency' THEN 25000
    ELSE 50
  END;

  monthly_remaining := GREATEST(0, plan_allowance - acct.monthly_credits_used);
  total_remaining := monthly_remaining + acct.topup_credits_balance;

  IF p_credits > total_remaining THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance_after', total_remaining
    );
  END IF;

  from_monthly := LEAST(p_credits, monthly_remaining);
  from_topup := p_credits - from_monthly;

  UPDATE public.user_credit_accounts
  SET
    monthly_credits_used = monthly_credits_used + from_monthly,
    topup_credits_balance = topup_credits_balance - from_topup,
    updated_at = timezone('utc', now())
  WHERE user_id = uid
  RETURNING * INTO acct;

  monthly_remaining := GREATEST(0, plan_allowance - acct.monthly_credits_used);
  total_remaining := monthly_remaining + acct.topup_credits_balance;

  INSERT INTO public.credit_usage_logs (
    user_id, workspace_id, action_type, credits_used, balance_after, model_used, account_role, metadata
  ) VALUES (
    uid, p_workspace_id, p_action_type, p_credits, total_remaining, p_model_used, role_label,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'unlimited', false,
    'balance_after', total_remaining,
    'monthly_remaining', monthly_remaining,
    'topup_balance', acct.topup_credits_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_topup_credits(p_credits INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  acct public.user_credit_accounts;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.is_platform_admin(uid) THEN
    RETURN jsonb_build_object('success', true, 'unlimited', true);
  END IF;
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  acct := public.ensure_user_credit_account(uid);
  UPDATE public.user_credit_accounts
  SET topup_credits_balance = topup_credits_balance + p_credits, updated_at = timezone('utc', now())
  WHERE user_id = uid
  RETURNING * INTO acct;

  RETURN jsonb_build_object('success', true, 'topup_balance', acct.topup_credits_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_credit_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(TEXT, INTEGER, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_topup_credits(INTEGER) TO authenticated;
