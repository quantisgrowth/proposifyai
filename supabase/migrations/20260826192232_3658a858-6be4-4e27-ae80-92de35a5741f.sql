CREATE TABLE IF NOT EXISTS public.automation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  mapping_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_flows TO authenticated;
GRANT ALL ON public.automation_flows TO service_role;
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_flows team access" ON public.automation_flows;
CREATE POLICY "automation_flows team access" ON public.automation_flows FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  flow_id uuid REFERENCES public.automation_flows(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  event_type text NOT NULL,
  status_code integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_logs TO authenticated;
GRANT ALL ON public.integration_logs TO service_role;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_logs team access" ON public.integration_logs;
CREATE POLICY "integration_logs team access" ON public.integration_logs FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_automation_flows_updated_at ON public.automation_flows;
CREATE TRIGGER update_automation_flows_updated_at BEFORE UPDATE ON public.automation_flows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS modelo text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS medida text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS posicao text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lonas_pr integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profundidade_sulco_mm numeric(5,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS indice_carga_velocidade text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_price_avista numeric(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condicao_escolhida text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS taxa_percentual numeric(5,4);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS numero_parcelas integer;

ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS modelo text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS medida text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS posicao text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS lonas_pr integer;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS profundidade_sulco_mm numeric(5,2);
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS indice_carga_velocidade text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS base_price_avista numeric(12,2);
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS condicao_escolhida text;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS taxa_percentual numeric(5,4);
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS numero_parcelas integer;

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS asaas_payment_id text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS asaas_payment_url text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS idx_products_company_active ON public.products (company_id, active);
CREATE INDEX IF NOT EXISTS idx_proposals_company_created ON public.proposals (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_company_status ON public.proposals (company_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients (company_id, name);