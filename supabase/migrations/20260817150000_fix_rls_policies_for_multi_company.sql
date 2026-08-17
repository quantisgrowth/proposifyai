-- Migration: Fix Row Level Security (RLS) policies for multi-company scoping
-- This unblocks administrators and multi-company collaborators from viewing and managing
-- entities (proposals, clients, products, profiles) across all companies they have access to.

-- 0. CREATE FUNCTIONS IF MISSING
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 1. COMPANIES POLICIES
DROP POLICY IF EXISTS "companies read own" ON public.companies;
DROP POLICY IF EXISTS "companies read own or linked" ON public.companies;
CREATE POLICY "companies read own or linked" ON public.companies FOR SELECT TO authenticated
  USING (
    id = public.current_company_id()
    OR id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "companies admin write" ON public.companies;
CREATE POLICY "companies admin write" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. PROFILES POLICIES
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
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. CLIENTS POLICIES
DROP POLICY IF EXISTS "clients team access" ON public.clients;
CREATE POLICY "clients team access" ON public.clients FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 4. PRODUCTS POLICIES
DROP POLICY IF EXISTS "products team read" ON public.products;
CREATE POLICY "products team read" ON public.products FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 5. KANBAN COLUMNS POLICIES
DROP POLICY IF EXISTS "kanban read team" ON public.kanban_columns;
CREATE POLICY "kanban read team" ON public.kanban_columns FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "kanban admin write" ON public.kanban_columns;
CREATE POLICY "kanban admin write" ON public.kanban_columns FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 6. PROPOSALS POLICIES
DROP POLICY IF EXISTS "proposals team access" ON public.proposals;
CREATE POLICY "proposals team access" ON public.proposals FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 7. PROPOSAL ITEMS POLICIES
DROP POLICY IF EXISTS "proposal_items team access" ON public.proposal_items;
CREATE POLICY "proposal_items team access" ON public.proposal_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p 
      WHERE p.id = proposal_id 
      AND (
        p.company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposals p 
      WHERE p.id = proposal_id 
      AND (
        p.company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    )
  );
