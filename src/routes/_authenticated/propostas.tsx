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
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Settings,
  SlidersHorizontal,
  Clock,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  nextProposalCode,
  proposalsQuery,
  companiesQuery,
  kanbanColumnsQuery,
  proposalByCodeQuery,
  profilesQuery,
  type ProposalStatus,
  type ProposalWithClient,
  type KanbanColumn,
  type Company,
} from "@/lib/proposals";
import { brl, shortDate, statusLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { ResizableDialog } from "@/components/ui/resizable-dialog";
import { ProposalEditor } from "@/components/proposal-editor";
import { ProposalDocument } from "@/components/proposal-document";
import { updateProposalStatusServer } from "@/lib/public-proposal.functions";

const colorOptions = [
  { value: "bg-slate-400", label: "Cinza", class: "bg-slate-400" },
  { value: "bg-blue-500", label: "Azul", class: "bg-blue-500" },
  { value: "bg-emerald-500", label: "Verde", class: "bg-emerald-500" },
  { value: "bg-destructive", label: "Vermelho", class: "bg-destructive" },
  { value: "bg-amber-500", label: "Amarelo", class: "bg-amber-500" },
  { value: "bg-purple-500", label: "Roxo", class: "bg-purple-500" },
  { value: "bg-pink-500", label: "Rosa", class: "bg-pink-500" },
  { value: "bg-teal-500", label: "Teal", class: "bg-teal-500" },
];

const colorBorderMap: Record<string, string> = {
  "bg-slate-400": "border-t-slate-400",
  "bg-blue-500": "border-t-blue-500",
  "bg-emerald-500": "border-t-emerald-500",
  "bg-destructive": "border-t-red-500",
  "bg-amber-500": "border-t-amber-500",
  "bg-purple-500": "border-t-purple-500",
  "bg-pink-500": "border-t-pink-500",
  "bg-teal-500": "border-t-teal-500",
};

export const Route = createFileRoute("/_authenticated/propostas")({
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
  const { profile, company, isAdmin, activeCompanyId } = useAuth();
  const { data: companies } = useQuery(companiesQuery);
  const { data: profiles } = useQuery(profilesQuery);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Filter state for company select (admins only)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (isAdmin) return "all";
    return activeCompanyId ?? "";
  });

  const activeCompanyFilter = isAdmin
    ? selectedCompanyId === "all"
      ? null
      : selectedCompanyId
    : activeCompanyId || company?.id || null;

  const activeCompanySettings = useMemo(() => {
    return (companies ?? []).find((c) => c.id === activeCompanyFilter) || company;
  }, [companies, activeCompanyFilter, company]);

  const onlyViewOwn = !isAdmin && Boolean(activeCompanySettings?.only_view_own_proposals);

  const { data, isLoading } = useQuery(proposalsQuery(activeCompanyFilter, onlyViewOwn, profile?.id));
  const { data: dbColumns } = useQuery(kanbanColumnsQuery(activeCompanyFilter));

  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<string>("all");

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [editingProposalCode, setEditingProposalCode] = useState<string | null>(null);
  
  // Custom columns and view states on proposals page
  const [viewingProposalCode, setViewingProposalCode] = useState<string | null>(null);
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [columnForm, setColumnForm] = useState({ name: "", slug: "", color: "bg-blue-500" });
  const [savingColumn, setSavingColumn] = useState(false);

  // New admin rules, deletion permissions, and loss reason states
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossProposalId, setLossProposalId] = useState<string | null>(null);
  const [lossForm, setLossForm] = useState({ reason: "Preço", description: "" });

  const [rulesDraft, setRulesDraft] = useState<{
    only_view_own_proposals: boolean;
    require_all_fields: boolean;
    block_proposal_deletion: boolean;
    delete_allowed_users: string[];
  } | null>(null);
  const [confirmRulesModalOpen, setConfirmRulesModalOpen] = useState(false);

  useEffect(() => {
    if (activeCompanySettings && adminMenuOpen) {
      setRulesDraft({
        only_view_own_proposals: Boolean(activeCompanySettings.only_view_own_proposals),
        require_all_fields: Boolean(activeCompanySettings.require_all_fields),
        block_proposal_deletion: Boolean(activeCompanySettings.block_proposal_deletion),
        delete_allowed_users: activeCompanySettings.delete_allowed_users || [],
      });
    } else {
      setRulesDraft(null);
    }
  }, [activeCompanySettings, adminMenuOpen]);

  const isRulesDirty = useMemo(() => {
    if (!activeCompanySettings || !rulesDraft) return false;
    
    const sameOwn = Boolean(activeCompanySettings.only_view_own_proposals) === rulesDraft.only_view_own_proposals;
    const sameReq = Boolean(activeCompanySettings.require_all_fields) === rulesDraft.require_all_fields;
    const sameDel = Boolean(activeCompanySettings.block_proposal_deletion) === rulesDraft.block_proposal_deletion;
    
    const arrOriginal = [...(activeCompanySettings.delete_allowed_users || [])].sort();
    const arrDraft = [...rulesDraft.delete_allowed_users].sort();
    const sameUsers = arrOriginal.length === arrDraft.length && arrOriginal.every((val, index) => val === arrDraft[index]);
    
    return !sameOwn || !sameReq || !sameDel || !sameUsers;
  }, [activeCompanySettings, rulesDraft]);

  const getRulesChanges = () => {
    if (!activeCompanySettings || !rulesDraft) return [];
    const changes: { label: string; from: string; to: string }[] = [];

    if (Boolean(activeCompanySettings.only_view_own_proposals) !== rulesDraft.only_view_own_proposals) {
      changes.push({
        label: "Visualização Restrita para Vendedores",
        from: activeCompanySettings.only_view_own_proposals ? "Ativado" : "Desativado",
        to: rulesDraft.only_view_own_proposals ? "Ativado" : "Desativado",
      });
    }

    if (Boolean(activeCompanySettings.require_all_fields) !== rulesDraft.require_all_fields) {
      changes.push({
        label: "Obrigatoriedade de Todos os Campos",
        from: activeCompanySettings.require_all_fields ? "Ativado" : "Desativado",
        to: rulesDraft.require_all_fields ? "Ativado" : "Desativado",
      });
    }

    if (Boolean(activeCompanySettings.block_proposal_deletion) !== rulesDraft.block_proposal_deletion) {
      changes.push({
        label: "Bloquear Exclusão de Negócios / Propostas",
        from: activeCompanySettings.block_proposal_deletion ? "Ativado" : "Desativado",
        to: rulesDraft.block_proposal_deletion ? "Ativado" : "Desativado",
      });
    }

    const originalAllowed = activeCompanySettings.delete_allowed_users || [];
    const draftAllowed = rulesDraft.delete_allowed_users;
    
    const addedUsers = draftAllowed.filter(id => !originalAllowed.includes(id));
    const removedUsers = originalAllowed.filter(id => !draftAllowed.includes(id));

    if (addedUsers.length > 0 || removedUsers.length > 0) {
      const getNames = (ids: string[]) => ids.map(id => {
        const p = (profiles ?? []).find(prof => prof.id === id);
        return p ? (p.full_name || p.email) : id;
      }).join(", ");

      if (addedUsers.length > 0) {
        changes.push({
          label: "Permissão de Exclusão concedida para",
          from: "-",
          to: getNames(addedUsers),
        });
      }
      if (removedUsers.length > 0) {
        changes.push({
          label: "Permissão de Exclusão removida para",
          from: getNames(removedUsers),
          to: "-",
        });
      }
    }

    return changes;
  };

  const getInactivityDays = (proposal: ProposalWithClient) => {
    const date = proposal.sent_at ? new Date(proposal.sent_at) : new Date(proposal.created_at);
    const diffTime = Math.abs(new Date().getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const deleteProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Proposta excluída com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao excluir proposta: " + e.message),
  });

  const updateCompanySettings = useMutation({
    mutationFn: async (payload: Partial<Company>) => {
      if (!activeCompanyFilter || activeCompanyFilter === "all") return;
      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", activeCompanyFilter);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Configurações do pipeline atualizadas!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar configurações: " + e.message),
  });

  const updateCollaboratorCompany = useMutation({
    mutationFn: async ({ profileId, companyId }: { profileId: string; companyId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ company_id: companyId })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Colaborador reatribuído!");
    },
    onError: (e: Error) => toast.error("Erro ao reatribuir colaborador: " + e.message),
  });

  const createCompany = useMutation({
    mutationFn: async (newCompany: { name: string; tagline?: string }) => {
      const { data: comp, error } = await supabase
        .from("companies")
        .insert({
          name: newCompany.name,
          tagline: newCompany.tagline || "",
        })
        .select()
        .single();
      if (error) throw error;
      return comp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Novo funil de vendas criado!");
    },
    onError: (e: Error) => toast.error("Erro ao criar funil: " + e.message),
  });

  const canDeleteProposal = (p: ProposalWithClient) => {
    if (isAdmin) return true;
    if (!activeCompanySettings?.block_proposal_deletion) return true;
    const allowedUsers = activeCompanySettings?.delete_allowed_users || [];
    return profile?.id && allowedUsers.includes(profile.id);
  };

  const triggerStatusChange = (id: string, next: string) => {
    if (next === "rejected") {
      setLossProposalId(id);
      setLossForm({ reason: "Preço", description: "" });
      setLossModalOpen(true);
    } else {
      changeStatus.mutate({ id, next });
    }
  };

  const handleSaveLossReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (lossProposalId) {
      changeStatus.mutate({
        id: lossProposalId,
        next: "rejected",
        lossReason: lossForm.reason,
        lossDescription: lossForm.description,
      });
      setLossModalOpen(false);
      setLossProposalId(null);
    }
  };

  const isCompanySelected = activeCompanyFilter !== null;

  const { data: viewingProposal, isLoading: loadingViewingProposal } = useQuery({
    ...proposalByCodeQuery(viewingProposalCode ?? ""),
    enabled: Boolean(viewingProposalCode),
  });

  const handleMoveColumn = async (index: number, direction: "left" | "right") => {
    if (!dbColumns) return;
    const otherIndex = direction === "left" ? index - 1 : index + 1;
    if (otherIndex < 0 || otherIndex >= dbColumns.length) return;

    const colA = dbColumns[index];
    const colB = dbColumns[otherIndex];
    if (!colA || !colB) return;

    try {
      const { error: errA } = await supabase
        .from("kanban_columns")
        .update({ position: colB.position })
        .eq("id", colA.id);
      if (errA) throw errA;

      const { error: errB } = await supabase
        .from("kanban_columns")
        .update({ position: colA.position })
        .eq("id", colB.id);
      if (errB) throw errB;

      qc.invalidateQueries({ queryKey: ["kanban_columns"] });
    } catch (err: any) {
      toast.error("Erro ao ordenar colunas: " + err.message);
    }
  };

  const handleDuplicateColumn = async (col: any) => {
    try {
      const nextPos = dbColumns ? dbColumns.length : 0;
      let newSlug = `${col.slug}-copy-${Math.random().toString(36).slice(2, 5)}`;
      const { error } = await supabase.from("kanban_columns").insert({
        company_id: selectedCompanyId === "all" ? col.company_id : selectedCompanyId,
        name: `${col.name} (Cópia)`,
        slug: newSlug,
        color: col.color,
        position: nextPos,
      });

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["kanban_columns"] });
      toast.success("Etapa duplicada!");
    } catch (err: any) {
      toast.error("Erro ao duplicar etapa: " + err.message);
    }
  };

  const handleDeleteColumn = async (col: any) => {
    const count = columnsData[col.slug]?.length || 0;
    if (count > 0) {
      toast.error(`Não é possível excluir a etapa "${col.name}" porque ela contém ${count} propostas. Mova as propostas para outra etapa antes de excluir.`);
      return;
    }

    if (confirm(`Deseja realmente excluir a etapa "${col.name}"?`)) {
      try {
        const { error } = await supabase.from("kanban_columns").delete().eq("id", col.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["kanban_columns"] });
        toast.success("Etapa excluída!");
      } catch (err: any) {
        toast.error("Erro ao excluir etapa: " + err.message);
      }
    }
  };

  const handleColumnNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const generatedSlug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setColumnForm((prev) => ({ ...prev, name: val, slug: generatedSlug }));
  };

  const handleSaveColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnForm.name.trim() || !columnForm.slug.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setSavingColumn(true);
    try {
      const nextPos = dbColumns ? dbColumns.length : 0;
      const targetCompanyId = selectedCompanyId === "all"
        ? (companies?.[0]?.id ?? null)
        : selectedCompanyId;
      
      if (!targetCompanyId) {
        toast.error("Por favor, selecione uma empresa para adicionar uma etapa.");
        setSavingColumn(false);
        return;
      }

      const { error } = await supabase.from("kanban_columns").insert({
        company_id: targetCompanyId,
        name: columnForm.name.trim(),
        slug: columnForm.slug.trim(),
        color: columnForm.color,
        position: nextPos,
      });

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["kanban_columns"] });
      setColumnModalOpen(false);
      toast.success("Nova etapa criada!");
    } catch (err: any) {
      toast.error("Erro ao criar etapa: " + err.message);
    } finally {
      setSavingColumn(false);
    }
  };

  const openAddColumnModal = () => {
    setColumnForm({ name: "", slug: "", color: "bg-blue-500" });
    setColumnModalOpen(true);
  };

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

  const ensureProposalSent = async (p: ProposalWithClient) => {
    if (p.status === "draft") {
      try {
        const { error } = await supabase
          .from("proposals")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", p.id);
        if (!error) {
          qc.invalidateQueries({ queryKey: ["proposals"] });
          qc.invalidateQueries({ queryKey: ["proposal-view", p.proposal_code] });
          toast.success("Proposta ativada (status alterado para Enviada)!");
        }
      } catch (err) {
        console.error("Error setting proposal to sent:", err);
      }
    }
  };

  const handleCopyLink = async () => {
    if (!sharingProposal) return;
    ensureProposalSent(sharingProposal);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/proposta/${sharingProposal.proposal_code}`);
      toast.success("Link da proposta copiado!");
    } catch {
      toast.error("Erro ao copiar o link");
    }
  };

  const handleCopyMessage = async () => {
    if (sharingProposal) {
      ensureProposalSent(sharingProposal);
    }
    try {
      await navigator.clipboard.writeText(emailBody);
      toast.success("Mensagem do e-mail copiada!");
    } catch {
      toast.error("Erro ao copiar a mensagem");
    }
  };

  const handleSendLocalEmail = () => {
    if (sharingProposal) {
      ensureProposalSent(sharingProposal);
    }
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${customEmail}?subject=${subject}&body=${body}`;
    setShareModalOpen(false);
  };

  const handleSendOfficialEmail = async () => {
    if (!sharingProposal) return;
    setSendingEmail(true);
    toast.loading("Enviando proposta por e-mail...", { id: "send-proposal-email" });
    try {
      const { sendOfficialProposalEmailServer } = await import("@/lib/email.server");
      
      const htmlBody = emailBody.replace(/\n/g, "<br>");
      
      const res = await sendOfficialProposalEmailServer({
        data: {
        proposalId: sharingProposal.id,
        toEmail: customEmail,
        subject: emailSubject,
        bodyHtml: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #334155;">
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">${htmlBody}</p>
          </div>
        `,
        },
      });

      if (res.success) {
        toast.success(
          res.method === "smtp"
            ? "E-mail enviado via SMTP corporativo!"
            : "E-mail enviado com sucesso!",
          { id: "send-proposal-email" }
        );
        setShareModalOpen(false);
        qc.invalidateQueries({ queryKey: ["proposals"] });
      }
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail: " + err.message, { id: "send-proposal-email" });
    } finally {
      setSendingEmail(false);
    }
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
        triggerStatusChange(id, colStatus);
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
    mutationFn: async ({ id, next, lossReason, lossDescription }: { id: string; next: string; lossReason?: string; lossDescription?: string }) => {
      await updateProposalStatusServer({
        data: {
          proposalId: id,
          status: next,
          lossReason: lossReason || null,
          lossDescription: lossDescription || null,
        },
      });
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
          company_id: proposal.company_id ?? null,
          campaign_name: (proposal as any).campaign_name || null,
          solution_name: (proposal as any).solution_name || null,
          objective_text: (proposal as any).objective_text || null,
          scope_text: (proposal as any).scope_text || null,
          fidelity_policy: (proposal as any).fidelity_policy || null,
          next_steps_text: (proposal as any).next_steps_text || null,
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
            original_price: (item as any).original_price ?? null,
            is_included: (item as any).is_included ?? false,
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
      const bucket = groups[p.status];
      if (bucket) {
        bucket.push(p);
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
    <AppShell wide={viewMode === "kanban"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Propostas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline comercial completo, do rascunho ao aceite.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              onClick={() => setAdminMenuOpen(true)}
              title="Configurações Administrativas do Funil"
            >
              <Settings className="size-4" />
            </Button>
          )}

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
            const colColorClass = columns.find(c => c.slug === colStatus)?.color || "bg-slate-400";
            const borderTopColorClass = colorBorderMap[colColorClass] || "border-t-slate-400";

            return (
              <div
                key={colStatus}
                onDragOver={(e) => handleDragOver(e, colStatus)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, colStatus)}
                className={`flex flex-col min-w-[245px] flex-1 max-w-[350px] rounded-xl border border-t-[5px] p-4 bg-card/40 backdrop-blur-sm transition-all duration-200 ${borderTopColorClass} ${
                  dragOverColumn === colStatus
                    ? "border-primary bg-primary/5 ring-2 ring-primary/10 shadow-md"
                    : "border-border/70"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`size-2 rounded-full shrink-0 ${
                      columns.find(c => c.slug === colStatus)?.color || "bg-slate-400"
                    }`} />
                    <span className="font-semibold text-xs text-foreground uppercase tracking-wide truncate" title={columns.find(c => c.slug === colStatus)?.name || colStatus}>
                      {columns.find(c => c.slug === colStatus)?.name || colStatus}
                    </span>
                    <span className="rounded-full bg-secondary/80 text-muted-foreground px-1.5 py-0.2 text-[9px] font-bold tabular-nums">
                      {columnProposals.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {brl(columnTotal)}
                    </span>
                    
                    {isCompanySelected && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground cursor-pointer">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card">
                          <DropdownMenuItem
                            onClick={() => {
                              const idx = columns.findIndex(c => c.slug === colStatus);
                              handleMoveColumn(idx, "left");
                            }}
                            disabled={columns.findIndex(c => c.slug === colStatus) === 0}
                            className="text-xs cursor-pointer"
                          >
                            <ChevronLeft className="size-3.5 mr-2 shrink-0" /> Mover para Esquerda
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const idx = columns.findIndex(c => c.slug === colStatus);
                              handleMoveColumn(idx, "right");
                            }}
                            disabled={columns.findIndex(c => c.slug === colStatus) === columns.length - 1}
                            className="text-xs cursor-pointer"
                          >
                            <ChevronRight className="size-3.5 mr-2 shrink-0" /> Mover para Direita
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const col = columns.find(c => c.slug === colStatus);
                              if (col) handleDuplicateColumn(col);
                            }}
                            className="text-xs cursor-pointer"
                          >
                            <Copy className="size-3.5 mr-2 shrink-0" /> Duplicar Etapa
                          </DropdownMenuItem>
                          
                          {!(colStatus === "draft" || colStatus === "sent") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  const col = columns.find(c => c.slug === colStatus);
                                  if (col) handleDeleteColumn(col);
                                }}
                                className="text-xs text-destructive hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="size-3.5 mr-2 shrink-0" /> Excluir Etapa
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
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
                                {p.companies?.name}
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
                                  setViewingProposalCode(p.proposal_code)
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
                              {canDeleteProposal(p) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (confirm(`Deseja realmente excluir a proposta ${p.proposal_code}?`)) {
                                        deleteProposal.mutate(p.id);
                                      }
                                    }}
                                    className="text-destructive focus:text-destructive cursor-pointer text-xs"
                                  >
                                    <Trash2 className="size-3.5 mr-2 shrink-0" /> Excluir Proposta
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              {columns
                                .filter((s) => s.slug !== p.status)
                                .map((s) => (
                                  <DropdownMenuItem
                                    key={s.slug}
                                    onClick={() => triggerStatusChange(p.id, s.slug)}
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

                        {p.status === "rejected" && p.loss_reason && (
                          <div className="mt-2 text-[10px] text-destructive bg-destructive/5 px-2.5 py-1.5 rounded-lg border border-destructive/10 font-medium">
                            <span className="font-bold">Motivo:</span> {p.loss_reason}
                            {p.loss_description && (
                              <span className="block text-[9px] font-normal text-muted-foreground mt-0.5 leading-normal">
                                {p.loss_description}
                              </span>
                            )}
                          </div>
                        )}

                        {(() => {
                          const inactiveDays = getInactivityDays(p);
                          const isInactive = p.status !== "accepted" && p.status !== "rejected" && p.status !== "expired" && inactiveDays > 7;
                          if (!isInactive) return null;
                          return (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25">
                              <Clock className="size-3 shrink-0 text-amber-500" />
                              <span>Inativo há {inactiveDays} dias</span>
                            </div>
                          );
                        })()}

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

          {/* Botão "+ Adicionar Etapa" no final */}
          {isCompanySelected && (
            <button
              onClick={openAddColumnModal}
              className="flex flex-col min-w-[280px] w-full max-w-[340px] h-[150px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/25 hover:bg-card/45 hover:border-primary/50 transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground shrink-0 self-start mt-0"
            >
              <Plus className="size-6 mb-2 text-primary/75" />
              <span className="font-semibold text-sm">Adicionar Etapa</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">Criar nova coluna no Kanban</span>
            </button>
          )}
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
                          {canDeleteProposal(p) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm(`Deseja realmente excluir a proposta ${p.proposal_code}?`)) {
                                    deleteProposal.mutate(p.id);
                                  }
                                }}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="size-4 mr-2 shrink-0" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          {columns
                            .filter((s) => s.slug !== p.status)
                            .map((s) => (
                              <DropdownMenuItem
                                key={s.slug}
                                onClick={() => triggerStatusChange(p.id, s.slug)}
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
              <Button onClick={handleSendOfficialEmail} disabled={sendingEmail} className="flex-1 sm:flex-none font-semibold gap-1.5">
                <Mail className="size-4" /> {sendingEmail ? "Enviando..." : "Enviar E-mail"}
              </Button>
              <Button variant="outline" onClick={() => setShareModalOpen(false)}>
                Cancelar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button type="button" variant="secondary" onClick={handleSendLocalEmail} className="flex-1 sm:flex-none gap-1">
                <ExternalLink className="size-3.5" /> Abrir no E-mail Local
              </Button>
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

      {/* Dialog para Visualizar Proposta em Pop-up */}
      <Dialog open={Boolean(viewingProposalCode)} onOpenChange={(open) => { if (!open) setViewingProposalCode(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-none bg-card overflow-hidden select-text shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card/65">
            <DialogTitle className="text-lg font-bold text-foreground">
              Visualizar Proposta {viewingProposalCode}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Documento comercial oficial gerado para o cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-secondary/15">
            {loadingViewingProposal ? (
              <p className="p-12 text-center text-sm text-muted-foreground font-semibold">Carregando detalhes da proposta…</p>
            ) : viewingProposal ? (
              <div className="max-w-3xl mx-auto bg-background rounded-xl shadow-sm border border-border p-4">
                <ProposalDocument
                  data={{
                    code: viewingProposal.proposal_code,
                    clientName: viewingProposal.clients?.name ?? "—",
                    clientDocument: viewingProposal.clients?.document ?? "—",
                    contactName: viewingProposal.clients?.contact_name ?? "—",
                    email: viewingProposal.clients?.email ?? "—",
                    phone: viewingProposal.clients?.phone ?? "—",
                    campaignName: viewingProposal.campaign_name || "Condições Exclusivas",
                    solutionName: viewingProposal.solution_name || "",
                    objectiveText: viewingProposal.objective_text || undefined,
                    fidelityPolicy: viewingProposal.fidelity_policy || undefined,
                    nextStepsText: viewingProposal.next_steps_text || undefined,
                    items: (viewingProposal.proposal_items ?? []).map((i) => ({
                      title: i.title,
                      description: i.description ?? "",
                      pricing_type: i.pricing_type,
                      quantity: Number(i.quantity),
                      unit_price: Number(i.unit_price),
                      original_price: i.original_price ? Number(i.original_price) : null,
                      is_included: i.is_included ?? false,
                      total_price: Number(i.total_price),
                    })),
                    total: Number(viewingProposal.total_amount),
                    discount: Number(viewingProposal.discount_amount),
                    net: Number(viewingProposal.net_amount),
                    validityDate: viewingProposal.validity_date || "",
                    paymentTerms: viewingProposal.payment_terms || "",
                    notes: viewingProposal.notes || "",
                    company: viewingProposal.companies,
                  }}
                />
              </div>
            ) : (
              <p className="p-12 text-center text-sm text-muted-foreground font-semibold">Erro ao carregar proposta.</p>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card/65 gap-2.5 flex-col sm:flex-row sm:justify-between items-stretch">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  if (!viewingProposalCode) return;
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/proposta/${viewingProposalCode}`);
                    toast.success("Link da proposta copiado!");
                  } catch {
                    toast.error("Erro ao copiar o link");
                  }
                }}
                className="flex-1 sm:flex-none gap-1.5 cursor-pointer"
              >
                <Copy className="size-4" /> Copiar Link
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
              <Button
                onClick={() => {
                  if (!viewingProposalCode) return;
                  window.open(`/proposta/${viewingProposalCode}?print=true`, "_blank");
                }}
                variant="outline"
                className="gap-1.5 cursor-pointer"
              >
                Imprimir / PDF
              </Button>
              <Button onClick={() => setViewingProposalCode(null)} variant="outline" className="cursor-pointer">
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Adicionar/Editar Coluna */}
      <Dialog open={columnModalOpen} onOpenChange={setColumnModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Nova Etapa do Kanban
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure as propriedades visuais da nova etapa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveColumn} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nome da Etapa</Label>
              <Input
                value={columnForm.name}
                onChange={handleColumnNameChange}
                placeholder="Ex: Em Negociação"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Identificador (Slug)</Label>
              <Input
                value={columnForm.slug}
                placeholder="ex-em-negociacao"
                disabled
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Gerado automaticamente a partir do nome para controle interno.
              </p>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-muted-foreground">Cor do Marcador</Label>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {colorOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setColumnForm((prev) => ({ ...prev, color: opt.value }))}
                    className={`flex items-center gap-1.5 justify-center px-2 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      columnForm.color === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    <span className={`size-2.5 rounded-full ${opt.class}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setColumnModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingColumn}>
                {savingColumn ? "Salvando..." : "Criar Etapa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Administrativo do Funil */}
      <Dialog open={adminMenuOpen} onOpenChange={setAdminMenuOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card/50">
            <DialogTitle className="flex items-center gap-2 font-bold text-lg text-foreground">
              <SlidersHorizontal className="size-5 text-primary" /> Painel do Administrador: {activeCompanySettings?.name || "Pipeline"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gerencie regras, acessos, permissões, atendentes e etapas do funil de vendas.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="regras" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b border-border bg-muted/20">
              <TabsList className="grid grid-cols-4 max-w-full my-2 bg-secondary/50 p-1">
                <TabsTrigger value="regras" className="text-xs py-1.5 cursor-pointer">Regras</TabsTrigger>
                <TabsTrigger value="atendentes" className="text-xs py-1.5 cursor-pointer">Atendentes</TabsTrigger>
                <TabsTrigger value="etapas" className="text-xs py-1.5 cursor-pointer">Etapas</TabsTrigger>
                <TabsTrigger value="funis" className="text-xs py-1.5 cursor-pointer">Funis</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <TabsContent value="regras" className="space-y-5 mt-0">
                {activeCompanyFilter === null || activeCompanyFilter === "all" ? (
                  <div className="text-center p-6 border border-dashed rounded-lg text-xs text-muted-foreground">
                    Selecione uma empresa específica no filtro da página para gerenciar as regras do seu funil.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Visualização Restrita */}
                    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border bg-secondary/15">
                      <div className="space-y-0.5 min-w-0">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          Visualização Restrita para Vendedores
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          Vendedores (colaboradores comerciais) só poderão visualizar e movimentar as propostas que eles mesmos criaram.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(rulesDraft?.only_view_own_proposals)}
                        onChange={(e) => {
                          setRulesDraft((prev) => prev ? { ...prev, only_view_own_proposals: e.target.checked } : null);
                        }}
                        className="rounded border-border text-primary focus:ring-primary size-4 shrink-0 mt-0.5 cursor-pointer"
                      />
                    </div>

                    {/* Obrigatoriedade de Campos */}
                    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border bg-secondary/15">
                      <div className="space-y-0.5 min-w-0">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          Obrigatoriedade de Todos os Campos
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          Exige o preenchimento de todos os campos (campanha, solução, validade, condições) antes de salvar a proposta comercial.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(rulesDraft?.require_all_fields)}
                        onChange={(e) => {
                          setRulesDraft((prev) => prev ? { ...prev, require_all_fields: e.target.checked } : null);
                        }}
                        className="rounded border-border text-primary focus:ring-primary size-4 shrink-0 mt-0.5 cursor-pointer"
                      />
                    </div>

                    {/* Bloqueio de Exclusão */}
                    <div className="space-y-3 p-3 rounded-lg border border-border bg-secondary/15">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 min-w-0">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            Bloquear Exclusão de Negócios / Propostas
                          </Label>
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Impede colaboradores comerciais de excluir propostas do sistema, a menos que tenham permissão explícita.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(rulesDraft?.block_proposal_deletion)}
                          onChange={(e) => {
                            setRulesDraft((prev) => prev ? { ...prev, block_proposal_deletion: e.target.checked } : null);
                          }}
                          className="rounded border-border text-primary focus:ring-primary size-4 shrink-0 mt-0.5 cursor-pointer"
                        />
                      </div>

                      {rulesDraft?.block_proposal_deletion && (
                        <div className="pt-3 border-t border-border/60">
                          <Label className="text-[10px] font-semibold text-foreground uppercase tracking-wide block mb-2">
                            Colaboradores com permissão de exclusão:
                          </Label>
                          <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                            {(profiles ?? [])
                              .filter((p) => p.company_id === activeCompanyFilter)
                              .map((p) => {
                                const isAllowed = (rulesDraft?.delete_allowed_users || []).includes(p.id);
                                return (
                                  <div key={p.id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`allow-delete-${p.id}`}
                                      checked={isAllowed}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        const current = rulesDraft?.delete_allowed_users || [];
                                        const next = checked
                                          ? [...current, p.id]
                                          : current.filter((id) => id !== p.id);
                                        setRulesDraft((prev) => prev ? { ...prev, delete_allowed_users: next } : null);
                                      }}
                                      className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
                                    />
                                    <Label htmlFor={`allow-delete-${p.id}`} className="text-xs cursor-pointer text-foreground/80 hover:text-foreground">
                                      {p.full_name || p.email}
                                    </Label>
                                  </div>
                                );
                              })}
                            {(profiles ?? []).filter((p) => p.company_id === activeCompanyFilter).length === 0 && (
                              <p className="text-[10px] text-muted-foreground italic">Nenhum colaborador vinculado a este funil.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botão de Salvar */}
                    <div className="pt-3 border-t border-border flex justify-end">
                      <Button
                        size="sm"
                        disabled={!isRulesDirty || updateCompanySettings.isPending}
                        onClick={() => setConfirmRulesModalOpen(true)}
                        className="gap-1.5"
                      >
                        {updateCompanySettings.isPending ? "Salvando..." : "Salvar Alterações"}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="atendentes" className="space-y-4 mt-0">
                <div className="text-xs text-muted-foreground pb-2">
                  Atribua colaboradores e vendedores para funis (empresas) específicos.
                </div>
                <div className="space-y-3 divide-y divide-border/60 max-h-[400px] overflow-y-auto pr-1">
                  {(profiles ?? []).map((prof) => (
                    <div key={prof.id} className="flex items-center justify-between py-2.5 first:pt-0">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-foreground truncate">{prof.full_name || prof.email}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{prof.email}</p>
                      </div>
                      <select
                        value={prof.company_id || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          updateCollaboratorCompany.mutate({ profileId: prof.id, companyId: val });
                        }}
                        className="text-xs rounded border border-border bg-background px-2.5 py-1.5 w-[200px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                      >
                        <option value="">Sem Funil</option>
                        {(companies ?? []).map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="etapas" className="space-y-4 mt-0">
                {activeCompanyFilter === null || activeCompanyFilter === "all" ? (
                  <div className="text-center p-6 border border-dashed rounded-lg text-xs text-muted-foreground">
                    Selecione uma empresa específica no filtro da página para gerenciar as etapas do seu funil.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Etapas ordenadas do funil atual</span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => {
                          setAdminMenuOpen(false); // Close admin panel
                          openAddColumnModal(); // Open column modal
                        }}
                      >
                        <Plus className="size-3.5 mr-1" /> Adicionar Etapa
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {columns.map((col, idx) => {
                        const isDefault = col.slug === "draft" || col.slug === "sent";
                        const dbCol = dbColumns?.find(c => c.slug === col.slug);
                        
                        return (
                          <div key={col.slug} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card shadow-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`size-3 rounded-full shrink-0 ${col.color}`} />
                              <span className="font-semibold text-xs text-foreground truncate">{col.name}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">({col.slug})</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {dbCol && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleMoveColumn(idx, "left")}
                                    disabled={idx === 0}
                                    title="Mover para Cima (Esquerda)"
                                  >
                                    <ChevronLeft className="size-3.5 rotate-90" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleMoveColumn(idx, "right")}
                                    disabled={idx === columns.length - 1}
                                    title="Mover para Baixo (Direita)"
                                  >
                                    <ChevronRight className="size-3.5 rotate-90" />
                                  </Button>
                                </>
                              )}

                              {dbCol && !isDefault && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    handleDeleteColumn(dbCol);
                                  }}
                                  title="Excluir Etapa"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="funis" className="space-y-4 mt-0">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-foreground">Criar Novo Funil de Vendas (Empresa)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-[10px] text-muted-foreground">Nome do Funil / Empresa</Label>
                      <Input
                        id="new-funnel-name"
                        placeholder="Ex: Frotlog Transportes"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] text-muted-foreground">Slogan / Tagline</Label>
                      <Input
                        id="new-funnel-tagline"
                        placeholder="Ex: Carga e descarga inteligente"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => {
                      const nameInput = document.getElementById("new-funnel-name") as HTMLInputElement;
                      const taglineInput = document.getElementById("new-funnel-tagline") as HTMLInputElement;
                      if (!nameInput?.value.trim()) {
                        toast.error("Nome do funil é obrigatório.");
                        return;
                      }
                      createCompany.mutate({
                        name: nameInput.value.trim(),
                        tagline: taglineInput?.value.trim() || "",
                      });
                      nameInput.value = "";
                      if (taglineInput) taglineInput.value = "";
                    }}
                  >
                    Criar Funil
                  </Button>
                </div>

                <div className="pt-3 border-t border-border/80">
                  <h4 className="text-xs font-semibold text-foreground mb-2">Funis Cadastrados</h4>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {(companies ?? []).map((comp) => (
                      <div key={comp.id} className="flex items-center justify-between text-xs p-2.5 rounded bg-secondary/30">
                        <span className="font-medium text-foreground">{comp.name}</span>
                        <span className="text-[10px] text-muted-foreground">{comp.tagline || "Sem slogan"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </div>

            <DialogFooter className="px-6 py-3 border-t border-border bg-muted/20">
              <Button onClick={() => setAdminMenuOpen(false)} variant="outline" size="sm" className="text-xs">
                Fechar
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Alteração de Regras */}
      <Dialog open={confirmRulesModalOpen} onOpenChange={setConfirmRulesModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              Confirmar Alterações de Regras
            </DialogTitle>
            <DialogDescription className="text-xs">
              Você tem certeza que deseja salvar as alterações abaixo para a empresa <strong>{activeCompanySettings?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-4 max-h-[250px] overflow-y-auto">
            {getRulesChanges().map((c, idx) => (
              <div key={idx} className="text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <p className="font-semibold text-foreground">{c.label}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  <span className="line-through bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{c.from}</span>
                  <span>→</span>
                  <span className="bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-medium">{c.to}</span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-4 flex sm:justify-end gap-2 pt-2 border-t border-border/30">
            <Button variant="outline" size="sm" onClick={() => setConfirmRulesModalOpen(false)}>
              Voltar
            </Button>
            <Button size="sm" onClick={async () => {
              if (rulesDraft) {
                await updateCompanySettings.mutateAsync(rulesDraft);
                setConfirmRulesModalOpen(false);
              }
            }}>
              Sim, Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Motivo de Perda */}
      <Dialog open={lossModalOpen} onOpenChange={setLossModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg text-foreground text-destructive">
              Registrar Motivo de Perda
            </DialogTitle>
            <DialogDescription className="text-xs">
              Por favor, informe o motivo pelo qual esta proposta comercial foi recusada/perdida.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLossReason} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Motivo Principal</Label>
              <select
                value={lossForm.reason}
                onChange={(e) => setLossForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="text-xs rounded border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-full"
              >
                <option value="Preço">Preço alto / Sem orçamento</option>
                <option value="Concorrente">Perdido para concorrente</option>
                <option value="Prazo">Prazo de entrega / Cronograma</option>
                <option value="Escopo">Escopo / Falta de funcionalidades</option>
                <option value="Postergado">Decisão adiada pelo cliente</option>
                <option value="Outro">Outro motivo</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Detalhes / Observações (Opcional)</Label>
              <Textarea
                rows={3}
                value={lossForm.description}
                onChange={(e) => setLossForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva brevemente o feedback do cliente..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setLossModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive">
                Confirmar Perda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
