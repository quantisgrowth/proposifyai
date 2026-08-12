-- Migration: Company Logo, Custom Footer, Proposal Templates and Special Conditions

-- 1. ADICIONAR CAMPOS NA TABELA COMPANIES
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS footer_text text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS solution_name text DEFAULT 'Frotlog - Plataforma SaaS de Gestão e Pagamento de Despesas em Rota';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS objective_text text DEFAULT 'A presente proposta tem como objetivo apresentar as condições comerciais para a implementação da plataforma. Desenvolvido especificamente para solucionar as maiores dores do gerenciamento operacional e controle financeiro.';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS scope_text text DEFAULT 'Aplicativo para Motoristas, Painel de Gestão em Tempo Real, Filtros Avançados e Relatórios, Usuários Ilimitados.';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fidelity_policy text DEFAULT 'A empresa não impõe cláusulas de fidelidade contratual ou carência de permanência mínima. A nossa única fidelidade é a sua satisfação com a nossa ferramenta.';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS next_steps_text text DEFAULT '1. Validação e aceite desta proposta comercial.\n2. Reunião de alinhamento técnico para parametrização.\n3. Liberação do ambiente Web e envio dos links de download do aplicativo.\n4. Treinamento guiado com o time financeiro e de gestão (Onboarding).';

-- 2. ADICIONAR CAMPOS NA TABELA PROPOSALS
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS campaign_name text DEFAULT 'Condições Exclusivas';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS solution_name text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS objective_text text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS scope_text text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS fidelity_policy text DEFAULT '';
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS next_steps_text text DEFAULT '';

-- 3. ADICIONAR CAMPOS NA TABELA PROPOSAL_ITEMS (Para suportar Preço de Tabela vs Condição Especial)
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS original_price numeric(12,2) DEFAULT NULL;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS is_included boolean DEFAULT false;

-- 4. ATUALIZAR EMPRESA FROTLOG COM DADOS COMPLETOS CASO EXISTA
UPDATE public.companies 
SET 
  footer_text = '© 2026 Frotlog Soluções em Carga e Descarga LTDA — CNPJ: 53.968.073/0001-38',
  solution_name = 'Frotlog - Plataforma SaaS de Gestão e Pagamento de Despesas em Rota',
  fidelity_policy = 'A Frotlog não impõe cláusulas de fidelidade contratual ou carência de permanência mínima. A nossa única fidelidade é a sua satisfação com a nossa ferramenta. O cliente mantém a parceria ativa enquanto a solução faz sentido e gera economia para a operação.',
  next_steps_text = '1. Validação e aceite desta proposta comercial.\n2. Reunião de alinhamento técnico para cadastro do CNPJ master e parametrização das contas de pagamento.\n3. Liberação do ambiente Web e envio dos links de download do aplicativo para os motoristas.\n4. Agendamento do treinamento guiado com o time financeiro e de gestão (Onboarding).'
WHERE name ILIKE '%frotlog%';
