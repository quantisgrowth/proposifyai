-- Migration: Add B2B Tire Specific Fields and Financial Rules to Products and Proposal Items

-- 1. ADD COLUMNS TO PRODUCTS (CATALOGUE)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS modelo text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS medida text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS marca text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS posicao text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lonas_pr integer DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profundidade_sulco_mm numeric(5,2) DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS indice_carga_velocidade text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_price_avista numeric(12,2) DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condicao_escolhida text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS taxa_percentual numeric(5,4) DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS numero_parcelas integer DEFAULT NULL;

-- 2. ADD COLUMNS TO PROPOSAL_ITEMS (PROPOSAL ITEMS SNAPSHOT)
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS modelo text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS medida text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS marca text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS posicao text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS lonas_pr integer DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS profundidade_sulco_mm numeric(5,2) DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS indice_carga_velocidade text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS base_price_avista numeric(12,2) DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS condicao_escolhida text DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS taxa_percentual numeric(5,4) DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS numero_parcelas integer DEFAULT NULL;
