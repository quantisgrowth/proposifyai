
-- ============ SCHEMA (from pending repo migrations) ============
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tagline text DEFAULT '',
  document text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  default_validity_days integer NOT NULL DEFAULT 15,
  default_payment_terms text NOT NULL DEFAULT 'Pix',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.companies (id, name, tagline, document, email, phone, default_validity_days, default_payment_terms)
SELECT id, name, tagline, document, email, phone, default_validity_days, default_payment_terms
FROM public.company_settings
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.companies (name, tagline, document, email, phone)
SELECT 'Proposify AI', 'Estratégia, tecnologia e crescimento', 'CNPJ 40.221.884/0001-32', 'comercial@proposify.ai', '(11) 4000-2200'
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS footer_text text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS solution_name text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS objective_text text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS scope_text text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fidelity_policy text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS next_steps_text text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'colaborador' CHECK (role IN ('admin','colaborador')),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_price numeric(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_price numeric(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_tiers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_tier_notes text DEFAULT '';

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS campaign_name text DEFAULT 'Condições Exclusivas';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS solution_name text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS objective_text text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS scope_text text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS fidelity_policy text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS next_steps_text text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_name text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_email text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS original_price numeric(12,2);
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS is_included boolean DEFAULT false;

UPDATE public.products SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.clients SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.proposals SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;

-- status as text + kanban columns
ALTER TABLE public.proposals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.proposals ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.proposals ALTER COLUMN status SET DEFAULT 'draft';
DROP TYPE IF EXISTS public.proposal_status;

CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text DEFAULT 'bg-slate-400',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

-- profiles sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name, role, company_id)
SELECT id, email, split_part(email,'@',1), 'admin', (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- keep user_roles in sync with existing admins
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_company_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.kanban_columns (company_id, name, slug, color, position) VALUES
    (new.id, 'Rascunho', 'draft', 'bg-slate-400', 0),
    (new.id, 'Enviada', 'sent', 'bg-blue-500', 1),
    (new.id, 'Ganha (Aceita)', 'accepted', 'bg-emerald-500', 2),
    (new.id, 'Perdida (Recusada)', 'rejected', 'bg-destructive', 3),
    (new.id, 'Expirada', 'expired', 'bg-amber-500', 4)
  ON CONFLICT (company_id, slug) DO NOTHING;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_company_columns();

INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, v.name, v.slug, v.color, v.position FROM public.companies c
CROSS JOIN (VALUES
  ('Rascunho','draft','bg-slate-400',0),
  ('Enviada','sent','bg-blue-500',1),
  ('Ganha (Aceita)','accepted','bg-emerald-500',2),
  ('Perdida (Recusada)','rejected','bg-destructive',3),
  ('Expirada','expired','bg-amber-500',4)
) AS v(name, slug, color, position)
ON CONFLICT (company_id, slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_proposals_company_id ON public.proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_code ON public.proposals(proposal_code);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_kanban_columns_company_id ON public.kanban_columns(company_id);

-- ============ ACCESS CONTROL ============
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_company_columns() FROM anon, authenticated, public;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.companies, public.profiles, public.kanban_columns FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_columns TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.kanban_columns TO service_role;

DROP POLICY IF EXISTS "companies_access" ON public.companies;
CREATE POLICY "companies read own" ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY "companies admin write" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND id = public.current_company_id())
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "profiles_access" ON public.profiles;
CREATE POLICY "profiles read team" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = public.current_company_id());
CREATE POLICY "profiles admin write" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id());

DROP POLICY IF EXISTS "kanban_columns_access" ON public.kanban_columns;
CREATE POLICY "kanban read team" ON public.kanban_columns FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "kanban admin write" ON public.kanban_columns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id());

-- clients: team scoped
DROP POLICY IF EXISTS "clients read" ON public.clients;
DROP POLICY IF EXISTS "clients admin write" ON public.clients;
CREATE POLICY "clients team access" ON public.clients FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- products: team reads, admin writes
DROP POLICY IF EXISTS "products read" ON public.products;
DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products team read" ON public.products FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND company_id = public.current_company_id());

-- company_settings: team reads, admin writes (legacy table)
DROP POLICY IF EXISTS "company_settings read" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings admin write" ON public.company_settings;
CREATE POLICY "company_settings team read" ON public.company_settings FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY "company_settings admin write" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND id = public.current_company_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND id = public.current_company_id());

-- proposals: company scoped
DROP POLICY IF EXISTS "proposals owner or admin" ON public.proposals;
CREATE POLICY "proposals team access" ON public.proposals FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "proposal_items via proposal" ON public.proposal_items;
CREATE POLICY "proposal_items team access" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.company_id = public.current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.company_id = public.current_company_id()));
