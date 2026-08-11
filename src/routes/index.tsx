import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  nextProposalCode,
  proposalsQuery,
  type ProposalStatus,
  type ProposalWithClient,
} from "@/lib/proposals";
import { brl, shortDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Propostas — Meridian Propostas Comerciais" },
      {
        name: "description",
        content:
          "Acompanhe todas as propostas comerciais, valores, validade e status em um painel único e minimalista.",
      },
      { property: "og:title", content: "Propostas — Meridian Propostas Comerciais" },
      {
        property: "og:description",
        content: "Painel de propostas comerciais com status, valores e validade.",
      },
    ],
  }),
  component: ProposalsPage,
});

const statusStyles: Record<ProposalStatus, string> = {
  draft: "border-border bg-secondary text-muted-foreground",
  sent: "border-foreground/20 bg-foreground/5 text-foreground",
  accepted: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-amber-600/30 bg-amber-600/10 text-amber-700",
};

const filters: Array<{ value: "all" | ProposalStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Rascunho" },
  { value: "sent", label: "Enviada" },
  { value: "accepted", label: "Aceita" },
  { value: "rejected", label: "Recusada" },
  { value: "expired", label: "Expirada" },
];

function ProposalsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(proposalsQuery);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<"all" | ProposalStatus>("all");

  const rows = useMemo(() => {
    return (data ?? []).filter((p) => {
      const matchStatus = status === "all" || p.status === status;
      const haystack = `${p.proposal_code} ${p.clients?.name ?? ""}`.toLowerCase();
      return matchStatus && haystack.includes(term.toLowerCase().trim());
    });
  }, [data, status, term]);

  const changeStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: ProposalStatus }) => {
      const patch =
        next === "sent"
          ? { status: next, sent_at: new Date().toISOString() }
          : { status: next };
      const { error } = await supabase.from("proposals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (proposal: ProposalWithClient) => {
      const code = await nextProposalCode();
      const { data: created, error } = await supabase
        .from("proposals")
        .insert({
          proposal_code: code,
          client_id: proposal.client_id,
          total_amount: proposal.total_amount,
          discount_amount: proposal.discount_amount,
          net_amount: proposal.net_amount,
          validity_date: proposal.validity_date,
          payment_terms: proposal.payment_terms,
          notes: proposal.notes,
          status: "draft" as const,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: items } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", proposal.id);
      if (items?.length) {
        await supabase.from("proposal_items").insert(
          items.map((item) => ({
            proposal_id: created.id,
            product_id: item.product_id,
            title: item.title,
            description: item.description,
            pricing_type: item.pricing_type,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            position: item.position,
          })),
        );
      }
      return code;
    },
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(`Proposta duplicada como ${code}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Propostas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline comercial completo, do rascunho ao aceite.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/nova">Nova proposta</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por código ou cliente"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
                status === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3 font-normal">ID</th>
              <th className="px-4 py-3 font-normal">Cliente</th>
              <th className="px-4 py-3 text-right font-normal">Valor total</th>
              <th className="px-4 py-3 font-normal">Envio</th>
              <th className="px-4 py-3 font-normal">Validade</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma proposta encontrada.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-border/70 last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-3 font-medium tabular-nums">{p.proposal_code}</td>
                  <td className="px-4 py-3">{p.clients?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(Number(p.net_amount))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(p.sent_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(p.validity_date)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`font-normal ${statusStyles[p.status]}`}>
                      {statusLabel[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({
                              to: "/proposta/$code",
                              params: { code: p.proposal_code },
                            })
                          }
                        >
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({ to: "/nova", search: { code: p.proposal_code } })
                          }
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({
                              to: "/proposta/$code",
                              params: { code: p.proposal_code },
                              search: { print: true },
                            })
                          }
                        >
                          Baixar PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate.mutate(p)}>
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(["draft", "sent", "accepted", "rejected", "expired"] as ProposalStatus[])
                          .filter((s) => s !== p.status)
                          .map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => changeStatus.mutate({ id: p.id, next: s })}
                            >
                              Marcar como {(statusLabel[s] ?? s).toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
