-- Migration: Adicionar campos de configuração administrativa e motivo de perda de propostas

-- 1. Colunas de configurações na tabela companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS only_view_own_proposals boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS require_all_fields boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS block_proposal_deletion boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS delete_allowed_users uuid[] NOT NULL DEFAULT '{}';

-- 2. Colunas de motivos de perda na tabela proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS loss_reason text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS loss_description text;
