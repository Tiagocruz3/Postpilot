-- Admin subscription management

ALTER TABLE public.user_credit_accounts
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'cancelled', 'suspended')),
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  posts_limit INTEGER NOT NULL DEFAULT 0,
  images_limit INTEGER NOT NULL DEFAULT 0,
  videos_limit INTEGER NOT NULL DEFAULT 0,
  social_accounts_limit INTEGER NOT NULL DEFAULT 1,
  team_members_limit INTEGER NOT NULL DEFAULT 1,
  access_ads BOOLEAN NOT NULL DEFAULT false,
  access_premium_video BOOLEAN NOT NULL DEFAULT false,
  access_analytics BOOLEAN NOT NULL DEFAULT true,
  access_scheduling BOOLEAN NOT NULL DEFAULT true,
  access_ai_vault BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.topup_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  best_value BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.platform_credit_rules (
  id TEXT PRIMARY KEY DEFAULT 'default',
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.platform_subscription_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topup_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_select_all_auth"
  ON public.subscription_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "topup_packs_select_all_auth"
  ON public.topup_packs FOR SELECT TO authenticated USING (true);

CREATE POLICY "platform_credit_rules_select_auth"
  ON public.platform_credit_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "platform_subscription_settings_select_auth"
  ON public.platform_subscription_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_audit_logs_admin_select"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Seed plans
INSERT INTO public.subscription_plans (
  id, name, monthly_price, monthly_credits, posts_limit, images_limit, videos_limit,
  social_accounts_limit, team_members_limit, access_ads, access_premium_video, featured, sort_order
) VALUES
  ('free', 'Free', 0, 50, 10, 5, 0, 1, 1, false, false, false, 0),
  ('starter', 'Starter', 19, 750, 60, 40, 4, 2, 2, true, false, false, 1),
  ('pro', 'Pro', 49, 2500, 200, 150, 12, 5, 5, true, true, true, 2),
  ('growth', 'Growth', 99, 7500, 500, 400, 30, 10, 10, true, true, false, 3),
  ('agency', 'Agency', 500, 25000, 1500, 1200, 100, 30, 30, true, true, false, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.topup_packs (id, name, credits, price, best_value, sort_order) VALUES
  ('small', 'Small Top Up', 1000, 10, false, 0),
  ('creator', 'Creator Boost', 5000, 39, true, 1),
  ('growth', 'Growth Pack', 10000, 69, false, 2),
  ('power', 'Power Pack', 25000, 149, false, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_credit_rules (id, rules) VALUES (
  'default',
  '{"caption":1,"hashtags":1,"post_idea":1,"ad_copy":2,"image":10,"video_short":75,"video_premium":200}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_subscription_settings (id, settings) VALUES (
  'default',
  '{
    "enableFreePlan": true,
    "enableTrials": false,
    "trialDays": 14,
    "allowTopUp": true,
    "allowUpgrade": true,
    "allowDowngrade": true,
    "allowCancel": true,
    "lowCreditThresholdPercent": 25,
    "criticalCreditThresholdPercent": 10,
    "currency": "USD",
    "taxEnabled": false,
    "taxRatePercent": 10,
    "billingProvider": "stripe"
  }'::jsonb
) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email TEXT;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT email INTO admin_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.admin_audit_logs (admin_user_id, admin_email, action, target_type, target_id, old_value, new_value)
  VALUES (auth.uid(), COALESCE(admin_email, 'unknown'), p_action, p_target_type, p_target_id, p_old_value, p_new_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.joined_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT
      p.id AS user_id,
      COALESCE(p.display_name, split_part(u.email, '@', 1)) AS name,
      u.email,
      CASE WHEN public.is_platform_admin(p.id) THEN 'admin' ELSE 'member' END AS role,
      COALESCE(a.membership_plan, 'free') AS plan,
      COALESCE(a.subscription_status, 'active') AS subscription_status,
      COALESCE(sp.monthly_credits, 50) AS monthly_credits,
      COALESCE(a.topup_credits_balance, 0) AS topup_credits,
      COALESCE(a.monthly_credits_used, 0) AS credits_used,
      COALESCE(a.posts_used, 0) AS posts_used,
      COALESCE(a.images_used, 0) AS images_used,
      COALESCE(a.videos_used, 0) AS videos_used,
      p.created_at AS joined_at,
      a.suspended_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.user_credit_accounts a ON a.user_id = p.id
    LEFT JOIN public.subscription_plans sp ON sp.id = COALESCE(a.membership_plan, 'free')
  ) t;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id UUID,
  p_role TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT NULL,
  p_subscription_status TEXT DEFAULT NULL,
  p_suspend BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_acct public.user_credit_accounts;
  new_acct public.user_credit_accounts;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.ensure_user_credit_account(p_user_id);
  SELECT * INTO old_acct FROM public.user_credit_accounts WHERE user_id = p_user_id;

  IF p_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF p_role = 'member' THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin';
  END IF;

  UPDATE public.user_credit_accounts
  SET
    membership_plan = COALESCE(p_plan, membership_plan),
    subscription_status = COALESCE(p_subscription_status, subscription_status),
    suspended_at = CASE
      WHEN p_suspend IS TRUE THEN timezone('utc', now())
      WHEN p_suspend IS FALSE THEN NULL
      ELSE suspended_at
    END,
    updated_at = timezone('utc', now())
  WHERE user_id = p_user_id
  RETURNING * INTO new_acct;

  PERFORM public.admin_write_audit(
    'update_user',
    'user',
    p_user_id::text,
    to_jsonb(old_acct),
    to_jsonb(new_acct)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_user_id UUID,
  p_monthly_delta INTEGER DEFAULT 0,
  p_topup_delta INTEGER DEFAULT 0,
  p_reset_monthly_used BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_acct public.user_credit_accounts;
  new_acct public.user_credit_accounts;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.ensure_user_credit_account(p_user_id);
  SELECT * INTO old_acct FROM public.user_credit_accounts WHERE user_id = p_user_id;

  UPDATE public.user_credit_accounts
  SET
    monthly_credits_used = CASE
      WHEN p_reset_monthly_used THEN 0
      ELSE GREATEST(0, monthly_credits_used - p_monthly_delta)
    END,
    topup_credits_balance = GREATEST(0, topup_credits_balance + p_topup_delta),
    updated_at = timezone('utc', now())
  WHERE user_id = p_user_id
  RETURNING * INTO new_acct;

  PERFORM public.admin_write_audit(
    'adjust_credits',
    'user',
    p_user_id::text,
    to_jsonb(old_acct),
    to_jsonb(new_acct)
  );

  RETURN jsonb_build_object('success', true, 'account', row_to_json(new_acct));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_subscription_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN jsonb_build_object(
    'plans', (SELECT COALESCE(jsonb_agg(row_to_json(p) ORDER BY sort_order), '[]'::jsonb) FROM subscription_plans p),
    'topups', (SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY sort_order), '[]'::jsonb) FROM topup_packs t),
    'credit_rules', (SELECT rules FROM platform_credit_rules WHERE id = 'default'),
    'settings', (SELECT settings FROM platform_subscription_settings WHERE id = 'default'),
    'audit_logs', (
      SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100) a
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_plan(p_plan JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_id TEXT := p_plan->>'id';
  old_row public.subscription_plans;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO old_row FROM subscription_plans WHERE id = plan_id;
  INSERT INTO subscription_plans (
    id, name, monthly_price, monthly_credits, posts_limit, images_limit, videos_limit,
    social_accounts_limit, team_members_limit, access_ads, access_premium_video,
    access_analytics, access_scheduling, access_ai_vault, status, featured, sort_order, updated_at
  ) VALUES (
    plan_id,
    p_plan->>'name',
    (p_plan->>'monthly_price')::numeric,
    (p_plan->>'monthly_credits')::int,
    (p_plan->>'posts_limit')::int,
    (p_plan->>'images_limit')::int,
    (p_plan->>'videos_limit')::int,
    (p_plan->>'social_accounts_limit')::int,
    COALESCE((p_plan->>'team_members_limit')::int, 1),
    COALESCE((p_plan->>'access_ads')::boolean, false),
    COALESCE((p_plan->>'access_premium_video')::boolean, false),
    COALESCE((p_plan->>'access_analytics')::boolean, true),
    COALESCE((p_plan->>'access_scheduling')::boolean, true),
    COALESCE((p_plan->>'access_ai_vault')::boolean, true),
    COALESCE(p_plan->>'status', 'active'),
    COALESCE((p_plan->>'featured')::boolean, false),
    COALESCE((p_plan->>'sort_order')::int, 0),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price = EXCLUDED.monthly_price,
    monthly_credits = EXCLUDED.monthly_credits,
    posts_limit = EXCLUDED.posts_limit,
    images_limit = EXCLUDED.images_limit,
    videos_limit = EXCLUDED.videos_limit,
    social_accounts_limit = EXCLUDED.social_accounts_limit,
    team_members_limit = EXCLUDED.team_members_limit,
    access_ads = EXCLUDED.access_ads,
    access_premium_video = EXCLUDED.access_premium_video,
    access_analytics = EXCLUDED.access_analytics,
    access_scheduling = EXCLUDED.access_scheduling,
    access_ai_vault = EXCLUDED.access_ai_vault,
    status = EXCLUDED.status,
    featured = EXCLUDED.featured,
    sort_order = EXCLUDED.sort_order,
    updated_at = timezone('utc', now());

  PERFORM public.admin_write_audit('save_plan', 'plan', plan_id, to_jsonb(old_row), p_plan);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_plan(p_plan_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_plan_id = 'free' THEN
    RAISE EXCEPTION 'Cannot delete free plan';
  END IF;
  PERFORM public.admin_write_audit('delete_plan', 'plan', p_plan_id, NULL, NULL);
  DELETE FROM subscription_plans WHERE id = p_plan_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_topup(p_pack JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pack_id TEXT := p_pack->>'id';
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO topup_packs (id, name, credits, price, best_value, active, sort_order, updated_at)
  VALUES (
    pack_id,
    p_pack->>'name',
    (p_pack->>'credits')::int,
    (p_pack->>'price')::numeric,
    COALESCE((p_pack->>'best_value')::boolean, false),
    COALESCE((p_pack->>'active')::boolean, true),
    COALESCE((p_pack->>'sort_order')::int, 0),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    price = EXCLUDED.price,
    best_value = EXCLUDED.best_value,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    updated_at = timezone('utc', now());
  PERFORM public.admin_write_audit('save_topup', 'topup', pack_id, NULL, p_pack);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_topup(p_pack_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  PERFORM public.admin_write_audit('delete_topup', 'topup', p_pack_id, NULL, NULL);
  DELETE FROM topup_packs WHERE id = p_pack_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_credit_rules(p_rules JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_rules JSONB;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT rules INTO old_rules FROM platform_credit_rules WHERE id = 'default';
  INSERT INTO platform_credit_rules (id, rules, updated_at)
  VALUES ('default', p_rules, timezone('utc', now()))
  ON CONFLICT (id) DO UPDATE SET rules = EXCLUDED.rules, updated_at = timezone('utc', now());
  PERFORM public.admin_write_audit('save_credit_rules', 'credit_rules', 'default', old_rules, p_rules);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_subscription_settings(p_settings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_settings JSONB;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT settings INTO old_settings FROM platform_subscription_settings WHERE id = 'default';
  INSERT INTO platform_subscription_settings (id, settings, updated_at)
  VALUES ('default', p_settings, timezone('utc', now()))
  ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = timezone('utc', now());
  PERFORM public.admin_write_audit('save_subscription_settings', 'settings', 'default', old_settings, p_settings);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_usage_logs(p_limit INTEGER DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        l.id,
        l.user_id,
        COALESCE(p.display_name, 'User') AS user_name,
        u.email AS user_email,
        l.account_role AS role,
        COALESCE(a.membership_plan, 'free') AS plan,
        l.action_type,
        COALESCE(l.metadata->>'provider', l.metadata->>'function', '—') AS ai_provider,
        l.model_used,
        l.credits_used,
        COALESCE((l.metadata->>'cost_estimate')::numeric, 0) AS cost_estimate,
        l.balance_after,
        l.created_at
      FROM credit_usage_logs l
      JOIN auth.users u ON u.id = l.user_id
      LEFT JOIN profiles p ON p.id = l.user_id
      LEFT JOIN user_credit_accounts a ON a.user_id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT p_limit
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(UUID, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_subscription_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_plan(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_plan(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_topup(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_topup(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_credit_rules(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_subscription_settings(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_usage_logs(INTEGER) TO authenticated;
