DROP POLICY IF EXISTS "clients public access" ON public.clients;
DROP POLICY IF EXISTS "products public access" ON public.products;
DROP POLICY IF EXISTS "proposals public access" ON public.proposals;
DROP POLICY IF EXISTS "proposal_items public access" ON public.proposal_items;

REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.proposals FROM anon;
REVOKE ALL ON public.proposal_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO authenticated;
GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.proposals TO service_role;
GRANT ALL ON public.proposal_items TO service_role;

CREATE POLICY "clients authenticated access" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products authenticated access" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "proposals authenticated access" ON public.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "proposal_items authenticated access" ON public.proposal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);