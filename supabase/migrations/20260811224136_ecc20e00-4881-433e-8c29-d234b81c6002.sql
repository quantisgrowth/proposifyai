
CREATE TYPE public.pricing_type AS ENUM ('recurring','one_time','setup');
CREATE TYPE public.proposal_status AS ENUM ('draft','sent','accepted','rejected','expired');

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  contact_name text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients public access" ON public.clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  pricing_type public.pricing_type NOT NULL DEFAULT 'one_time',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public access" ON public.products FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_code text NOT NULL UNIQUE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  validity_date date,
  payment_terms text,
  notes text,
  status public.proposal_status NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO anon, authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals public access" ON public.proposals FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  pricing_type public.pricing_type NOT NULL DEFAULT 'one_time',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO anon, authenticated;
GRANT ALL ON public.proposal_items TO service_role;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal_items public access" ON public.proposal_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_proposal_items_proposal ON public.proposal_items(proposal_id);

INSERT INTO public.clients (id, name, document, contact_name, email, phone) VALUES
 ('11111111-1111-4111-8111-111111111111','Vetra Tecnologia LTDA','12.345.678/0001-90','Marina Lopes','marina@vetra.com.br','(11) 98877-1122'),
 ('22222222-2222-4222-8222-222222222222','Casa Nord Arquitetura','98.765.432/0001-11','Rafael Duarte','rafael@casanord.com','(21) 99654-3311'),
 ('33333333-3333-4333-8333-333333333333','Grupo Aurora Varejo','04.556.221/0001-77','Juliana Prado','juliana@grupoaurora.com.br','(31) 98123-4455'),
 ('44444444-4444-4444-8444-444444444444','Studio Meridiano','29.881.004/0001-05','Bruno Tavares','bruno@meridiano.studio','(48) 99777-8080'),
 ('55555555-5555-4555-8555-555555555555','Helena Prado Consultoria','321.654.987-00','Helena Prado','helena@hpconsult.com.br','(11) 97222-6543');

INSERT INTO public.products (id, name, description, unit_price, pricing_type) VALUES
 ('aaaaaaa1-0000-4000-8000-000000000001','Gestão de Tráfego Pago','Planejamento, criação e otimização contínua de campanhas em Meta e Google Ads.',3800.00,'recurring'),
 ('aaaaaaa1-0000-4000-8000-000000000002','Setup de Infraestrutura de Dados','Configuração inicial de pipelines, dashboards e integrações.',6500.00,'setup'),
 ('aaaaaaa1-0000-4000-8000-000000000003','Landing Page de Alta Conversão','Página institucional responsiva com copy e design sob medida.',4200.00,'one_time'),
 ('aaaaaaa1-0000-4000-8000-000000000004','Consultoria Estratégica Mensal','Sessões quinzenais de acompanhamento e plano de ação.',2500.00,'recurring'),
 ('aaaaaaa1-0000-4000-8000-000000000005','Identidade Visual Completa','Marca, manual de aplicação e kit de materiais digitais.',9800.00,'one_time'),
 ('aaaaaaa1-0000-4000-8000-000000000006','Onboarding e Treinamento','Implantação assistida e capacitação do time interno.',1800.00,'setup'),
 ('aaaaaaa1-0000-4000-8000-000000000007','Suporte Premium 24/7','Atendimento prioritário com SLA de 2 horas.',1450.00,'recurring');

INSERT INTO public.proposals (id, proposal_code, client_id, total_amount, discount_amount, net_amount, validity_date, payment_terms, notes, status, sent_at, created_at) VALUES
 ('bbbbbbb1-0000-4000-8000-000000000001','PRP-2026-0001','11111111-1111-4111-8111-111111111111',14100.00,1000.00,13100.00, CURRENT_DATE + 12,'Pix','Início previsto em até 5 dias úteis após o aceite.','sent', now() - interval '3 days', now() - interval '3 days'),
 ('bbbbbbb1-0000-4000-8000-000000000002','PRP-2026-0002','22222222-2222-4222-8222-222222222222',9800.00,0.00,9800.00, CURRENT_DATE + 20,'Parcelado','Parcelamento em 3x sem juros.','accepted', now() - interval '18 days', now() - interval '20 days'),
 ('bbbbbbb1-0000-4000-8000-000000000003','PRP-2026-0003','33333333-3333-4333-8333-333333333333',8300.00,415.00,7885.00, CURRENT_DATE - 4,'Boleto','Proposta válida por 15 dias corridos.','expired', now() - interval '22 days', now() - interval '24 days'),
 ('bbbbbbb1-0000-4000-8000-000000000004','PRP-2026-0004','44444444-4444-4444-8444-444444444444',4200.00,0.00,4200.00, CURRENT_DATE + 7,'Cartão de Crédito',NULL,'draft', NULL, now() - interval '1 day'),
 ('bbbbbbb1-0000-4000-8000-000000000005','PRP-2026-0005','55555555-5555-4555-8555-555555555555',6250.00,250.00,6000.00, CURRENT_DATE + 5,'Pix','Cliente solicitou revisão do escopo.','rejected', now() - interval '9 days', now() - interval '10 days');

INSERT INTO public.proposal_items (proposal_id, product_id, title, description, pricing_type, quantity, unit_price, total_price, position) VALUES
 ('bbbbbbb1-0000-4000-8000-000000000001','aaaaaaa1-0000-4000-8000-000000000001','Gestão de Tráfego Pago','Planejamento, criação e otimização contínua de campanhas em Meta e Google Ads.','recurring',1,3800.00,3800.00,0),
 ('bbbbbbb1-0000-4000-8000-000000000001','aaaaaaa1-0000-4000-8000-000000000002','Setup de Infraestrutura de Dados','Configuração inicial de pipelines, dashboards e integrações.','setup',1,6500.00,6500.00,1),
 ('bbbbbbb1-0000-4000-8000-000000000001','aaaaaaa1-0000-4000-8000-000000000004','Consultoria Estratégica Mensal','Sessões quinzenais de acompanhamento e plano de ação.','recurring',1,2500.00,2500.00,2),
 ('bbbbbbb1-0000-4000-8000-000000000001','aaaaaaa1-0000-4000-8000-000000000006','Onboarding e Treinamento','Implantação assistida e capacitação do time interno.','setup',1,1300.00,1300.00,3),
 ('bbbbbbb1-0000-4000-8000-000000000002','aaaaaaa1-0000-4000-8000-000000000005','Identidade Visual Completa','Marca, manual de aplicação e kit de materiais digitais.','one_time',1,9800.00,9800.00,0),
 ('bbbbbbb1-0000-4000-8000-000000000003','aaaaaaa1-0000-4000-8000-000000000003','Landing Page de Alta Conversão','Página institucional responsiva com copy e design sob medida.','one_time',1,4200.00,4200.00,0),
 ('bbbbbbb1-0000-4000-8000-000000000003','aaaaaaa1-0000-4000-8000-000000000004','Consultoria Estratégica Mensal','Sessões quinzenais de acompanhamento e plano de ação.','recurring',1,2500.00,2500.00,1),
 ('bbbbbbb1-0000-4000-8000-000000000003','aaaaaaa1-0000-4000-8000-000000000007','Suporte Premium 24/7','Atendimento prioritário com SLA de 2 horas.','recurring',1,1600.00,1600.00,2),
 ('bbbbbbb1-0000-4000-8000-000000000004','aaaaaaa1-0000-4000-8000-000000000003','Landing Page de Alta Conversão','Página institucional responsiva com copy e design sob medida.','one_time',1,4200.00,4200.00,0),
 ('bbbbbbb1-0000-4000-8000-000000000005','aaaaaaa1-0000-4000-8000-000000000004','Consultoria Estratégica Mensal','Sessões quinzenais de acompanhamento e plano de ação.','recurring',1,2500.00,2500.00,0),
 ('bbbbbbb1-0000-4000-8000-000000000005','aaaaaaa1-0000-4000-8000-000000000002','Setup de Infraestrutura de Dados','Configuração inicial de pipelines, dashboards e integrações.','setup',1,3750.00,3750.00,1);
