import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MoreHorizontal, Search, LayoutGrid, List } from "lucide-react";
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

import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Propostas — Proposify AI" },
      {
        name: "description",
        content:
          "Acompanhe todas as propostas comerciais, valores, validade e status em um painel único e minimalista.",
      },
      { property: "og:title", content: "Propostas — Proposify AI" },
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
  const { profile } = useAuth();
  const { data, isLoading } = useQuery(proposalsQuery(profile?.company_id));
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<"all" | ProposalStatus>("all");

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProposalStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: ProposalStatus) => {
    e.preventDefault();
    if (dragOverColumn !== colStatus) {
      setDragOverColumn(colStatus);
    }
  };

  const handleDrop = async (e: React.DragEvent, colStatus: ProposalStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    setDragOverColumn(null);
    setDraggedId(null);

    if (id) {
      const proposal = (data ?? []).find((p) => p.id === id);
      if (proposal && proposal.status !== colStatus) {
        changeStatus.mutate({ id, next: colStatus });
      }
    }
  };

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
          company_id: proposal.company_id,
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

  const kanbanStatuses: ProposalStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

  const columnsData = useMemo(() => {
    const groups: Record<ProposalStatus, ProposalWithClient[]> = {
      draft: [],
      sent: [],
      accepted: [],
      rejected: [],
      expired: [],
    };
    rows.forEach((p) => {
      if (groups[p.status]) {
        groups[p.status].push(p);
      }
    });
    return groups;
  }, [rows]);

  return (
    <AppShell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Propostas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline comercial completo, do rascunho ao aceite.
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex border border-border rounded-lg p-0.5 bg-secondary/35 text-muted-foreground">
            <button
              type="button"
              className={`flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-all ${
                viewMode === "kanban" ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
              }`}
              onClick={() => setViewMode("kanban")}
              title="Visualização em Quadro"
            >
              <LayoutGrid className="size-3.5 mr-1.5 text-current" />
              Quadro
            </button>
            <button
              type="button"
              className={`flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-all ${
                viewMode === "list" ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
              }`}
              onClick={() => setViewMode("list")}
              title="Visualização em Lista"
            >
              <List className="size-3.5 mr-1.5 text-current" />
              Lista
            </button>
          </div>
          <Button asChild size="sm">
            <Link to="/nova">Nova proposta</Link>
          </Button>
        </div>
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
        
        {viewMode === "list" && (
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
        )}
      </div>

      {isLoading ? (
        <div className="mt-12 text-center text-muted-foreground">Carregando…</div>
      ) : viewMode === "kanban" ? (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none">
          {kanbanStatuses.map((colStatus) => {
            const columnProposals = columnsData[colStatus] || [];
            const columnTotal = columnProposals.reduce((sum, p) => sum + Number(p.net_amount), 0);
            
            return (
              <div
                key={colStatus}
                onDragOver={(e) => handleDragOver(e, colStatus)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, colStatus)}
                className={`flex flex-col min-w-[280px] w-full max-w-[340px] rounded-xl border p-4 bg-card/40 backdrop-blur-sm transition-all duration-200 ${
                  dragOverColumn === colStatus
                    ? "border-primary bg-primary/5 ring-2 ring-primary/10 shadow-md"
                    : "border-border/70"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${
                      colStatus === "draft" ? "bg-slate-400" :
                      colStatus === "sent" ? "bg-blue-500" :
                      colStatus === "accepted" ? "bg-emerald-500" :
                      colStatus === "rejected" ? "bg-destructive" :
                      "bg-amber-500"
                    }`} />
                    <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
                      {colStatus === "accepted" ? "Ganha (Aceita)" :
                       colStatus === "rejected" ? "Perdida (Recusada)" :
                       statusLabel[colStatus] ?? colStatus}
                    </span>
                    <span className="rounded-full bg-secondary/80 text-muted-foreground px-1.5 py-0.2 text-[9px] font-bold tabular-nums">
                      {columnProposals.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                    {brl(columnTotal)}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-[350px] max-h-[600px] pr-1">
                  {columnProposals.map((p) => {
                    const isMoving = changeStatus.isPending && changeStatus.variables?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, p.id)}
                        onDragEnd={handleDragEnd}
                        className={`group relative rounded-xl border border-border/80 bg-card p-4 shadow-sm hover:border-foreground/20 hover:shadow transition-all duration-200 cursor-grab active:cursor-grabbing ${
                          isMoving ? "opacity-45 pointer-events-none" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
                            {p.proposal_code}
                          </span>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-6 -mr-1.5 -mt-1 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="size-3.5" />
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
                              {kanbanStatuses
                                .filter((s) => s !== p.status)
                                .map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    onClick={() => changeStatus.mutate({ id: p.id, next: s })}
                                    className="text-xs text-muted-foreground"
                                  >
                                    Mover para {(statusLabel[s] ?? s).toLowerCase()}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <h4 className="mt-2 font-semibold text-xs text-foreground line-clamp-2">
                          {p.clients?.name ?? "—"}
                        </h4>
                        
                        <div className="mt-4 flex items-end justify-between border-t border-border/40 pt-2">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Valor Líquido</p>
                            <p className="text-xs font-bold text-emerald-600 tabular-nums">
                              {brl(Number(p.net_amount))}
                            </p>
                          </div>
                          
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {p.sent_at ? shortDate(p.sent_at) : shortDate(p.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {columnProposals.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/50 text-center p-4">
                      <span className="text-[10px] text-muted-foreground/60">Arraste propostas aqui</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-border bg-card rounded-xl shadow-sm">
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
              {rows.length === 0 ? (
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
      )}
    </AppShell>
  );
}
