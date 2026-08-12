import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Link2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ProposalDocument } from "@/components/proposal-document";
import { supabase } from "@/integrations/supabase/client";
import { proposalByCodeQuery } from "@/lib/proposals";
import { getPublicProposal } from "@/lib/public-proposal.functions";

type Search = { print?: boolean };

export const Route = createFileRoute("/proposta/$code")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    print: search['print'] === true || search['print'] === "true",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Proposta ${params.code} — Proposify AI` },
      {
        name: "description",
        content: `Documento da proposta comercial ${params.code}: escopo, valores, validade e aceite.`,
      },
      { property: "og:title", content: `Proposta ${params.code} — Proposify AI` },
      {
        property: "og:description",
        content: "Proposta comercial pronta para leitura, impressão e aceite.",
      },
    ],
  }),
  component: ProposalView,
});

function ProposalView() {
  const { code } = Route.useParams();
  const { print } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["proposal-view", code],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session.session) return proposalByCodeQuery(code).queryFn();
      return getPublicProposal({ data: code });
    },
  });

  useEffect(() => {
    if (print && data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [print, data]);

  if (isLoading) {
    return <p className="p-12 text-center text-sm text-muted-foreground">Carregando proposta…</p>;
  }

  if (!data) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted-foreground">Proposta não encontrada.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/">Voltar</Link>
        </Button>
      </div>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/proposta/${code}`);
      toast.success("Link da proposta copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="no-print sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-0">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="size-4" /> Propostas
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Link2 className="size-4" /> Copiar link
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-8 sm:px-6">
        <ProposalDocument
          data={{
            code: data.proposal_code,
            clientName: data.clients?.name ?? "",
            clientDocument: data.clients?.document,
            contactName: data.clients?.contact_name,
            email: data.clients?.email,
            phone: data.clients?.phone,
            items: data.proposal_items.map((i) => ({
              title: i.title,
              description: i.description,
              pricing_type: i.pricing_type,
              quantity: Number(i.quantity),
              unit_price: Number(i.unit_price),
              total_price: Number(i.total_price),
            })),
            total: Number(data.total_amount),
            discount: Number(data.discount_amount),
            net: Number(data.net_amount),
            validityDate: data.validity_date,
            paymentTerms: data.payment_terms,
            notes: data.notes,
          }}
        />
      </div>
    </div>
  );
}
