-- Migration: Fix profiles RLS recursion by using SECURITY DEFINER functions instead of inline subqueries
-- and reading company_id from JWT claims to prevent infinite loops during SELECT.

-- 1. Redefine current_company_id() to read from JWT claims first (avoiding RLS recursion)
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims jsonb;
  cid uuid;
BEGIN
  claims := current_setting('request.jwt.claims', true)::jsonb;
  IF claims IS NOT NULL THEN
    cid := NULLIF(claims -> 'user_metadata' ->> 'company_id', '')::uuid;
    IF cid IS NOT NULL THEN
      RETURN cid;
    END IF;
  END IF;
  
  -- Fallback logic only when not inside a JWT request
  SELECT company_id INTO cid FROM public.profiles WHERE id = auth.uid();
  RETURN cid;
END;
$$;

-- 2. Create is_gestor helper function if not exists
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'gestor');
$$;

REVOKE EXECUTE ON FUNCTION public.is_gestor(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated;

-- 3. Recreate the RLS policies for profiles to ensure they are clean
DROP POLICY IF EXISTS "profiles read team" ON public.profiles;
CREATE POLICY "profiles read team" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid() 
    OR company_id = public.current_company_id()
    OR company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

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
