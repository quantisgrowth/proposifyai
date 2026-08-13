import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  MoreHorizontal,
  Search,
  LayoutGrid,
  List,
  Mail,
  Copy,
  ExternalLink,
  MessageSquare,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  nextProposalCode,
  proposalsQuery,
  companiesQuery,
  kanbanColumnsQuery,
  type ProposalStatus,
  type ProposalWithClient,
  type KanbanColumn,
} from "@/lib/proposals";
import { brl, shortDate, statusLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { ResizableDialog } from "@/components/ui/resizable-dialog";
import { ProposalEditor } from "@/components/proposal-editor";

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
  const { profile, company, isAdmin } = useAuth();
  const { data: companies } = useQuery(companiesQuery);

  // Filter state for company select (admins only)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (isAdmin) return "all";
    return profile?.company_id ?? "";
  });

  const activeCompanyFilter = isAdmin
    ? selectedCompanyId === "all"
      ? null
      : selectedCompanyId
    : profile?.company_id || company?.id || null;

  const { data, isLoading } = useQuery(proposalsQuery(activeCompanyFilter));
  const { data: dbColumns } = useQuery(kanbanColumnsQuery(activeCompanyFilter));

  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<string>("all");

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [editingProposalCode, setEditingProposalCode] = useState<string | null>(null);

  // Share proposal email modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingProposal, setSharingProposal] = useState<ProposalWithClient | null>(null);
  const [customEmail, setCustomEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const handleOpenShareModal = (p: ProposalWithClient) => {
    const url = `${window.location.origin}/proposta/${p.proposal_code}`;
    const clientName = p.clients?.contact_name || p.clients?.name || "Prezado(a)";
    const compName = p.companies?.name || "Proposify AI";
    
    setSharingProposal(p);
    setCustomEmail(p.clients?.email || "");
    setEmailSubject(`Proposta Comercial ${p.proposal_code} — ${compName}`);
    setEmailBody(
      `Olá ${clientName},\n\n` +
      `Segue o link para visualização da Proposta Comercial ${p.proposal_code} preparada para você:\n\n` +
      `${url}\n\n` +
      `Qualquer dúvida ou ajuste, estamos à disposição.\n\n` +
      `Atenciosamente,\n` +
      `${compName}`
    );
    setShareModalOpen(true);
  };

  const handleCopyLink = async () => {
    if (!sharingProposal) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/proposta/${sharingProposal.proposal_code}`);
      toast.success("Link da proposta copiado!");
    } catch {
      toast.error("Erro ao copiar o link");
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      toast.success("Mensagem do e-mail copiada!");
    } catch {
      toast.error("Erro ao copiar a mensagem");
    }
  };

  const handleSendLocalEmail = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.open(`mailto:${customEmail}?subject=${subject}&body=${body}`, "_blank");
    setShareModalOpen(false);
  };

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
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
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

  const columns = useMemo((): { slug: string; name: string; color: string }[] => {
    if (activeCompanyFilter && dbColumns && dbColumns.length > 0) {
      return dbColumns.map(col => ({
        slug: col.slug,
        name: col.name,
        color: col.color || "bg-slate-400"
      }));
    }
    return [
      { slug: "draft", name: "Rascunho", color: "bg-slate-400" },
      { slug: "sent", name: "Enviada", color: "bg-blue-500" },
      { slug: "accepted", name: "Ganha (Aceita)", color: "bg-emerald-500" },
      { slug: "rejected", name: "Perdida (Recusada)", color: "bg-destructive" },
      { slug: "expired", name: "Expirada", color: "bg-amber-500" }
    ];
  }, [dbColumns, activeCompanyFilter]);

  const kanbanStatuses = useMemo(() => columns.map(c => c.slug), [columns]);

  const listFilters = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [{ value: "all", label: "Todas" }];
    columns.forEach(c => {
      list.push({ value: c.slug, label: c.name });
    });
    return list;
  }, [columns]);

  const columnsData = useMemo(() => {
    const groups: Record<string, ProposalWithClient[]> = {};
    columns.forEach(col => {
      groups[col.slug] = [];
    });
    rows.forEach((p) => {
      if (groups[p.status]) {
        groups[p.status].push(p);
      } else {
        const firstSlug = columns[0]?.slug || "draft";
        if (groups[firstSlug]) {
          groups[firstSlug].push(p);
        }
      }
    });
    return groups;
  }, [rows, columns]);

  return (
    <AppShell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Propostas</h1>
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
          <Button asChild size="sm" className="h-9">
            <Link to="/nova">Nova proposta</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por código ou cliente..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Admin Company Selector filter */}
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap hidden md:inline">
                Filtrar por Empresa:
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-[180px] h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {viewMode === "list" && (
            <div className="flex flex-wrap gap-1">
              {listFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${
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
                      columns.find(c => c.slug === colStatus)?.color || "bg-slate-400"
                    }`} />
                    <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
                      {columns.find(c => c.slug === colStatus)?.name || colStatus}
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
                    const showCompanyBadge = isAdmin && selectedCompanyId === "all" && p.companies;
                    
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
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-mono text-[9px] font-bold tracking-wider text-muted-foreground">
                              {p.proposal_code}
                            </span>
                            {showCompanyBadge && (
                              <span className="inline-flex items-center gap-1 self-start rounded bg-primary/10 px-1.5 py-0.2 text-[8px] font-medium text-primary">
                                <Building2 className="size-2 shrink-0" />
                                {p.companies.name}
                              </span>
                            )}
                          </div>

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
                                  setEditingProposalCode(p.proposal_code)
                                }
                              >
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenShareModal(p)}
                              >
                                Enviar por E-mail
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
                              {columns
                                .filter((s) => s.slug !== p.status)
                                .map((s) => (
                                  <DropdownMenuItem
                                    key={s.slug}
                                    onClick={() => changeStatus.mutate({ id: p.id, next: s.slug })}
                                    className="text-xs text-muted-foreground"
                                  >
                                    Mover para {s.name.toLowerCase()}
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
        /* Table List View */
        <div className="mt-6 overflow-x-auto border border-border bg-card rounded-xl shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground bg-muted/40">
                <th className="px-4 py-3.5 font-normal">ID</th>
                <th className="px-4 py-3.5 font-normal">Cliente</th>
                {isAdmin && selectedCompanyId === "all" && (
                  <th className="px-4 py-3.5 font-normal">Empresa Emissora</th>
                )}
                <th className="px-4 py-3.5 text-right font-normal">Valor líquido</th>
                <th className="px-4 py-3.5 font-normal">Envio</th>
                <th className="px-4 py-3.5 font-normal">Validade</th>
                <th className="px-4 py-3.5 font-normal">Status</th>
                <th className="px-4 py-3.5 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin && selectedCompanyId === "all" ? 8 : 7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma proposta encontrada.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-b border-border/70 last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3 font-medium tabular-nums">{p.proposal_code}</td>
                    <td className="px-4 py-3">{p.clients?.name ?? "—"}</td>
                    {isAdmin && selectedCompanyId === "all" && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.companies?.name || "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{brl(Number(p.net_amount))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sent_at ? shortDate(p.sent_at) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(p.validity_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`font-normal ${
                        p.status === "draft" ? "border-border bg-secondary text-muted-foreground" :
                        p.status === "sent" ? "border-foreground/20 bg-foreground/5 text-foreground" :
                        p.status === "accepted" ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700" :
                        p.status === "rejected" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                        p.status === "expired" ? "border-amber-600/30 bg-amber-600/10 text-amber-700" :
                        "border-border bg-secondary text-muted-foreground"
                      }`}>
                        {columns.find(c => c.slug === p.status)?.name ?? p.status}
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
                              setEditingProposalCode(p.proposal_code)
                            }
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenShareModal(p)}
                          >
                            Enviar por E-mail
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
                          {columns
                            .filter((s) => s.slug !== p.status)
                            .map((s) => (
                              <DropdownMenuItem
                                key={s.slug}
                                onClick={() => changeStatus.mutate({ id: p.id, next: s.slug })}
                              >
                                Marcar como {s.name.toLowerCase()}
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

      {/* Share Proposal Dialog Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg text-foreground">
              <Mail className="size-5 text-primary" /> Enviar Proposta Comercial
            </DialogTitle>
            <DialogDescription className="text-xs">
              Compartilhe a proposta com o cliente via e-mail corporativo ou WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {sharingProposal && (
            <div className="space-y-4 py-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">E-mail do Destinatário</Label>
                <Input
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Assunto do E-mail</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Assunto da proposta"
                  className="text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Corpo da Mensagem</Label>
                <Textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-3 flex-col sm:flex-row-reverse sm:justify-between items-stretch">
            <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
              <Button onClick={handleSendLocalEmail} className="flex-1 sm:flex-none font-semibold gap-1.5">
                <ExternalLink className="size-4" /> Abrir no E-mail
              </Button>
              <Button variant="outline" onClick={() => setShareModalOpen(false)}>
                Cancelar
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="button" variant="secondary" onClick={handleCopyMessage} className="flex-1 sm:flex-none gap-1">
                <Copy className="size-3.5" /> Copiar Mensagem
              </Button>
              <Button type="button" variant="secondary" onClick={handleCopyLink} className="flex-1 sm:flex-none gap-1">
                <Copy className="size-3.5" /> Copiar Link
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Redimensionável para Edição de Proposta */}
      <ResizableDialog
        open={Boolean(editingProposalCode)}
        onOpenChange={(open) => {
          if (!open) setEditingProposalCode(null);
        }}
        title={`Editar Proposta ${editingProposalCode}`}
        description="Atualize as informações comerciais e salve como rascunho."
      >
        {editingProposalCode && (
          <div className="p-6 h-full flex flex-col overflow-hidden">
            <ProposalEditor
              proposalCode={editingProposalCode}
              onSaveSuccess={() => {
                setEditingProposalCode(null);
                qc.invalidateQueries({ queryKey: ["proposals"] });
              }}
              onCancel={() => setEditingProposalCode(null)}
            />
          </div>
        )}
      </ResizableDialog>
    </AppShell>
  );
}
