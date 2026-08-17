-- Migration: Create Automation Flows and Integration Logs tables

-- 1. Create automation_flows table
CREATE TABLE IF NOT EXISTS public.automation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL, -- 'crm.incoming_proposal', 'proposal.sent', 'proposal.accepted'
  mapping_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for automation_flows
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.automation_flows TO authenticated, service_role;

-- Policies for automation_flows
DROP POLICY IF EXISTS "automation_flows team access" ON public.automation_flows;
CREATE POLICY "automation_flows team access" ON public.automation_flows FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 2. Create integration_logs table
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  flow_id uuid REFERENCES public.automation_flows(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  event_type text NOT NULL,
  status_code integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for integration_logs
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.integration_logs TO authenticated, service_role;

-- Policies for integration_logs
DROP POLICY IF EXISTS "integration_logs team access" ON public.integration_logs;
CREATE POLICY "integration_logs team access" ON public.integration_logs FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profile_companies WHERE profile_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 3. Add default trigger function to update updated_at on automation_flows
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
