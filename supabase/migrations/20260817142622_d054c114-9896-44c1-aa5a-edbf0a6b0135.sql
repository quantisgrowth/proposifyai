-- Migration: Adicionar campos de configuração administrativa e motivo de perda de propostas

-- 1. Colunas de configurações na tabela companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS only_view_own_proposals boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS require_all_fields boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS block_proposal_deletion boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS delete_allowed_users uuid[] NOT NULL DEFAULT '{}';

-- 2. Colunas de motivos de perda na tabela proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS loss_description text;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#0f172a';

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_document TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_ip TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_by_user_agent TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_signature_url TEXT;

-- Integrations
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS api_key uuid DEFAULT gen_random_uuid();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT md5(random()::text);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_host text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_port integer;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_user text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_pass text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_from text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS smtp_from_name text;

UPDATE public.companies SET api_key = gen_random_uuid() WHERE api_key IS NULL;

CREATE TABLE IF NOT EXISTS public.profile_companies (
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, company_id)
);

ALTER TABLE public.profile_companies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_companies TO authenticated;
GRANT ALL ON public.profile_companies TO service_role;
DROP POLICY IF EXISTS "profile_companies_access" ON public.profile_companies;
CREATE POLICY "profile_companies read own or team" ON public.profile_companies
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR company_id = public.current_company_id());
CREATE POLICY "profile_companies admin manage" ON public.profile_companies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.profile_companies (profile_id, company_id)
SELECT id, company_id
FROM public.profiles
WHERE company_id IS NOT NULL
ON CONFLICT (profile_id, company_id) DO NOTHING;