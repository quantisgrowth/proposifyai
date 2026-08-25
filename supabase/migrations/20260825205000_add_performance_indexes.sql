-- Migration: Add composite indexes for multi-tenant performance optimization

-- 1. INDEX FOR PRODUCTS CATALOGUE BY COMPANY AND ACTIVE STATUS
CREATE INDEX IF NOT EXISTS idx_products_company_active ON public.products (company_id, active);

-- 2. INDEX FOR PROPOSALS BY COMPANY, ORDERED BY CREATION DATE (DESCENDING)
CREATE INDEX IF NOT EXISTS idx_proposals_company_created ON public.proposals (company_id, created_at DESC);

-- 3. INDEX FOR PROPOSALS BY COMPANY AND STATUS
CREATE INDEX IF NOT EXISTS idx_proposals_company_status ON public.proposals (company_id, status);

-- 4. INDEX FOR CLIENTS BY COMPANY, ORDERED BY NAME
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients (company_id, name);
