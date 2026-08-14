
-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','colaborador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles select own" ON public.user_roles;
CREATE POLICY "user_roles select own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "user_roles admin manage" ON public.user_roles;
CREATE POLICY "user_roles admin manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Seed existing users as admins so the back office keeps working
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- Ownership column on proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- clients
DROP POLICY IF EXISTS "clients authenticated access" ON public.clients;
CREATE POLICY "clients read" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients admin write" ON public.clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- products
DROP POLICY IF EXISTS "products authenticated access" ON public.products;
CREATE POLICY "products read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- company_settings
DROP POLICY IF EXISTS "company_settings authenticated access" ON public.company_settings;
CREATE POLICY "company_settings read" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_settings admin write" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- proposals
DROP POLICY IF EXISTS "proposals authenticated access" ON public.proposals;
CREATE POLICY "proposals owner or admin" ON public.proposals FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- proposal_items
DROP POLICY IF EXISTS "proposal_items authenticated access" ON public.proposal_items;
CREATE POLICY "proposal_items via proposal" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
      AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
      AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
