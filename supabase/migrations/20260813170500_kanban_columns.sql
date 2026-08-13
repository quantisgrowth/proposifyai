-- 1. Alterar tipo da coluna status na tabela proposals de enum para text
ALTER TABLE public.proposals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.proposals ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.proposals ALTER COLUMN status SET DEFAULT 'draft';

-- Dropar o tipo enum antigo se ele existia
DROP TYPE IF EXISTS public.proposal_status;

-- 2. Criar a tabela de colunas do kanban
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text DEFAULT 'bg-slate-400',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

-- Habilitar RLS
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.kanban_columns TO authenticated, service_role;
GRANT SELECT ON public.kanban_columns TO anon;

-- Políticas de acesso livre para leitura/escrita de usuários autenticados
CREATE POLICY "kanban_columns_access" ON public.kanban_columns FOR ALL USING (true) WITH CHECK (true);

-- 3. Trigger para criar colunas padrão ao cadastrar uma nova empresa
CREATE OR REPLACE FUNCTION public.handle_new_company_columns()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.kanban_columns (company_id, name, slug, color, position) VALUES
    (new.id, 'Rascunho', 'draft', 'bg-slate-400', 0),
    (new.id, 'Enviada', 'sent', 'bg-blue-500', 1),
    (new.id, 'Ganha (Aceita)', 'accepted', 'bg-emerald-500', 2),
    (new.id, 'Perdida (Recusada)', 'rejected', 'bg-destructive', 3),
    (new.id, 'Expirada', 'expired', 'bg-amber-500', 4)
  ON CONFLICT (company_id, slug) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_company_columns();

-- 4. Inserir colunas padrão para todas as empresas já existentes no banco
INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, 'Rascunho', 'draft', 'bg-slate-400', 0 FROM public.companies c
ON CONFLICT (company_id, slug) DO NOTHING;

INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, 'Enviada', 'sent', 'bg-blue-500', 1 FROM public.companies c
ON CONFLICT (company_id, slug) DO NOTHING;

INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, 'Ganha (Aceita)', 'accepted', 'bg-emerald-500', 2 FROM public.companies c
ON CONFLICT (company_id, slug) DO NOTHING;

INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, 'Perdida (Recusada)', 'rejected', 'bg-destructive', 3 FROM public.companies c
ON CONFLICT (company_id, slug) DO NOTHING;

INSERT INTO public.kanban_columns (company_id, name, slug, color, position)
SELECT c.id, 'Expirada', 'expired', 'bg-amber-500', 4 FROM public.companies c
ON CONFLICT (company_id, slug) DO NOTHING;

-- 5. Otimizações de Performance: Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_proposals_company_id ON public.proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_code ON public.proposals(proposal_code);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_kanban_columns_company_id ON public.kanban_columns(company_id);
