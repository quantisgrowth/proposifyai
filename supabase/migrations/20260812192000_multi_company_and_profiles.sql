-- Migration: Multi-company architecture, profiles and role-based access

-- 0. ADICIONAR TIPO DE COBRANÇA POR DEMANDA
ALTER TYPE public.pricing_type ADD VALUE IF NOT EXISTS 'usage_based';

-- 1. COMPANIES TABLE
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

-- Copiar dados existentes de company_settings para companies caso existam
INSERT INTO public.companies (id, name, tagline, document, email, phone, default_validity_days, default_payment_terms)
SELECT id, name, tagline, document, email, phone, default_validity_days, default_payment_terms
FROM public.company_settings
ON CONFLICT (id) DO NOTHING;

-- Garantir pelo menos uma empresa padrão
INSERT INTO public.companies (name, tagline, document, email, phone)
SELECT 'Proposify AI', 'Estratégia, tecnologia e crescimento', 'CNPJ 40.221.884/0001-32', 'comercial@proposify.ai', '(11) 4000-2200'
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- 2. PROFILES TABLE (vinculado ao auth.users e à empresa)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'colaborador' CHECK (role IN ('admin', 'colaborador')),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. ADICIONAR COMPANY_ID NAS TABELAS PRINCIPAIS
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Vincular registros sem empresa à primeira empresa
UPDATE public.products SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.clients SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;
UPDATE public.proposals SET company_id = (SELECT id FROM public.companies LIMIT 1) WHERE company_id IS NULL;

-- 4. TRIGGER PARA SINCRONIZAR NOVOS USUÁRIOS NO PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'colaborador'),
    COALESCE((new.raw_user_meta_data->>'company_id')::uuid, (SELECT id FROM public.companies LIMIT 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sincronizar usuários que já existam no auth.users para o profiles
INSERT INTO public.profiles (id, email, full_name, role, company_id)
SELECT 
  id, 
  email, 
  split_part(email, '@', 1), 
  'admin', 
  (SELECT id FROM public.companies LIMIT 1)
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 5. GRANTS & RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.companies TO authenticated, service_role;
GRANT ALL ON public.profiles TO authenticated, service_role;

DROP POLICY IF EXISTS "companies_access" ON public.companies;
CREATE POLICY "companies_access" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_access" ON public.profiles;
CREATE POLICY "profiles_access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
