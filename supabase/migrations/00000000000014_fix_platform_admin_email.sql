-- Fix platform admin email rule

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
    WHERE id = p_user_id AND lower(email) = 'tiagocruz3@gmail.com'
  );
$$;

