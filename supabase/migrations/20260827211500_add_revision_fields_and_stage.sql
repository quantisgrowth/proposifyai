-- Migration: Add revision fields and stage
-- Description: Alters proposal_status enum (if exists), adds revision_notes column, and updates kanban stages to include 'Revisar Proposta'.

-- 1. Alter proposal_status type to add 'revision' safely
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.proposal_status ADD VALUE 'revision';
  EXCEPTION
    WHEN duplicate_object THEN 
      -- Value already exists
      NULL;
    WHEN undefined_object THEN 
      -- Type public.proposal_status does not exist (e.g., if column was created as text)
      NULL;
  END;
END
$$;

-- 2. Add revision_notes to proposals table
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS revision_notes text;

-- 3. Redefine trigger function to include 'revision' stage for new companies
CREATE OR REPLACE FUNCTION public.handle_new_company_columns()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.kanban_columns (company_id, name, slug, color, position) VALUES
    (new.id, 'Rascunho', 'draft', 'bg-slate-400', 0),
    (new.id, 'Enviada', 'sent', 'bg-blue-500', 1),
    (new.id, 'Ganha (Aceita)', 'accepted', 'bg-emerald-500', 2),
    (new.id, 'Perdida (Recusada)', 'rejected', 'bg-destructive', 3),
    (new.id, 'Expirada', 'expired', 'bg-amber-500', 4),
    (new.id, 'Revisar Proposta', 'revision', 'bg-orange-500', 5)
  ON CONFLICT (company_id, slug) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Insert 'revision' stage for existing companies
INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, 'Revisar Proposta', 'revision', 'bg-orange-500', 5 FROM public.companies c
ON CONFLICT (company_id, slug) DO NOTHING;
