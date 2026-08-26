-- Migration: Fix profiles RLS recursion by using SECURITY DEFINER functions instead of inline subqueries

-- 1. Create is_gestor helper function
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'gestor');
$$;

REVOKE EXECUTE ON FUNCTION public.is_gestor(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated;

-- 2. Recreate profiles admin write policy
DROP POLICY IF EXISTS "profiles admin write" ON public.profiles;
CREATE POLICY "profiles admin write" ON public.profiles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    (public.is_gestor(auth.uid()) AND company_id = public.current_company_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    (public.is_gestor(auth.uid()) AND company_id = public.current_company_id())
  );
