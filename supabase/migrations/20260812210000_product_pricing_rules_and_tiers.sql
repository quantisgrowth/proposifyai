-- Migration: Product Pricing Rules (Min/Max/Practiced) and Volume Pricing Tiers (Performance)

-- 1. ADICIONAR COLUNAS NA TABELA PRODUCTS
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_price numeric(12,2) DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_price numeric(12,2) DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_tiers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_tier_notes text DEFAULT '';

-- 2. POPULAR PRODUTO "TRANSAÇÃO" DA FROTLOG COM AS FAIXAS REGRESSIVAS DO PDF
UPDATE public.products
SET 
  unit_price = 5.00,
  min_price = 2.49,
  max_price = 10.00,
  pricing_tiers = '[
    {"range": "Até 200 transações", "price": 4.99},
    {"range": "De 201 a 500 transações", "price": 3.99},
    {"range": "De 501 a 1.000 transações", "price": 2.99},
    {"range": "Acima de 1.000 transações", "price": 2.49}
  ]'::jsonb,
  pricing_tier_notes = '* Nota operacional: O custo operacional padrão de repasse financeiro (PIX Out) já está integralmente absorvido dentro das tarifas por transação listadas acima.'
WHERE name ILIKE '%transaç%' OR name ILIKE '%transac%';
