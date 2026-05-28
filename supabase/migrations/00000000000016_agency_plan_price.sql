-- Bump the Agency plan price to $500/mo.
-- The original seed in 00000000000013_admin_subscription.sql uses
-- ON CONFLICT (id) DO NOTHING so any environment already seeded would
-- still see the old $249 price; this migration brings them in line
-- with the latest pricing.

UPDATE public.subscription_plans
SET monthly_price = 500
WHERE id = 'agency';
