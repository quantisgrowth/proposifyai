-- Migration: Add dynamic template settings columns and custom blocks table
-- Description: Adds title, subtitle, and show/hide toggles for each proposal section to both companies and proposals tables, and creates proposal_custom_blocks table.

-- 1. Add columns to public.companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_objective boolean DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_scope boolean DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_fidelity boolean DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_next_steps boolean DEFAULT true;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS objective_title text DEFAULT '1. Objetivo e Proposta de Valor';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS objective_subtitle text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS scope_title text DEFAULT '2. Funcionalidades & Escopo da Solução';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS scope_subtitle text DEFAULT 'A contratação da plataforma engloba o acesso completo às seguintes ferramentas, sem qualquer restrição de recursos ou cobrança de licenças adicionais:';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fidelity_title text DEFAULT 'Nossa Política de Fidelidade:';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fidelity_subtitle text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS next_steps_title text DEFAULT 'Próximos Passos para Ativação';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS next_steps_subtitle text DEFAULT '';

-- 2. Add columns to public.proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS show_objective boolean DEFAULT true;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS show_scope boolean DEFAULT true;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS show_fidelity boolean DEFAULT true;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS show_next_steps boolean DEFAULT true;

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS objective_title text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS objective_subtitle text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS scope_title text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS scope_subtitle text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS fidelity_title text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS fidelity_subtitle text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS next_steps_title text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS next_steps_subtitle text;

-- 3. Create proposal_custom_blocks table
CREATE TABLE IF NOT EXISTS public.proposal_custom_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  content text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.proposal_custom_blocks ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Allow read for authenticated users" ON public.proposal_custom_blocks
  FOR SELECT USING (true);

CREATE POLICY "Allow all for authenticated users" ON public.proposal_custom_blocks
  FOR ALL USING (true);
