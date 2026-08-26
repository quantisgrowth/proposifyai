import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Building2,
  Plus,
  Edit2,
  Trash2,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  Loader2,
  FileText,
  Upload,
  Download,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { clientsQuery, companiesQuery, profilesQuery, proposalsQuery, type Client } from "@/lib/proposals";
import { shortDate, formatDocument, brl } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Proposify AI" },
      {
        name: "description",
        content:
          "Base de clientes com razão social, CNPJ/CPF, contato, e-mail e telefone para preencher propostas em segundos.",
      },
      { property: "og:title", content: "Clientes — Proposify AI" },
      {
        property: "og:description",
        content: "Cadastro de clientes usado nas propostas comerciais.",
      },
    ],
  }),
  component: ClientsPage,
});

const emptyForm = {
  name: "",
  document: "",
  contact_name: "",
  email: "",
  phone: "",
  company_id: "",
};

function ClientsPage() {
  const qc = useQueryClient();
  const { profile, company, isAdmin, activeCompanyId } = useAuth();
  const { data: companies } = useQuery(companiesQuery);

  // View mode and search state
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchTerm, setSearchTerm] = useState("");

  const activeCompanyFilter = activeCompanyId || company?.id || null;

  const { data: clients, isLoading } = useQuery(clientsQuery(activeCompanyFilter));

  // States for CSV import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Load SaaS Platform data if admin
  const { data: allProfiles } = useQuery(profilesQuery);
  const { data: allProposals } = useQuery(proposalsQuery(null));

  const [selectedSaaSCompany, setSelectedSaaSCompany] = useState<any | null>(null);
  const [saasDrawerOpen, setSaasDrawerOpen] = useState(false);

  const handleOpenCompanyDrawer = (c: any) => {
    setSelectedSaaSCompany(c);
    setSaasDrawerOpen(true);
  };

  const saasCompanyDetails = useMemo(() => {
    if (!selectedSaaSCompany) return null;
    const collabs = (allProfiles ?? []).filter((p) => p.company_id === selectedSaaSCompany.id);
    const props = (allProposals ?? []).filter((p) => p.company_id === selectedSaaSCompany.id);
    const totalVal = props.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
    const wonVal = props.filter((p) => p.status === "accepted").reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
    return {
      collabs,
      props,
      totalVal,
      wonVal,
    };
  }, [selectedSaaSCompany, allProfiles, allProposals]);

  // Modal and form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  const openCreateModal = () => {
    setEditingClient(null);
    setForm({
      ...emptyForm,
      company_id: activeCompanyFilter ?? "",
    });
    setModalOpen(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setForm({
      name: c.name,
      document: c.document ?? "",
      contact_name: c.contact_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      company_id: c.company_id ?? (activeCompanyId ?? ""),
    });
    setModalOpen(true);
  };

  // CNPJ autofill feature
  const handleFetchCnpj = async () => {
    const cleanCnpj = form.document.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast.error("Insira um CNPJ com 14 dígitos para buscar");
      return;
    }

    setIsFetchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      
      const data = await res.json();
      
      let formattedPhone = "";
      if (data.ddd_telefone_1) {
        const telClean = data.ddd_telefone_1.replace(/\D/g, "");
        if (telClean.length === 10) {
          formattedPhone = `(${telClean.substring(0, 2)}) ${telClean.substring(2, 6)}-${telClean.substring(6)}`;
        } else if (telClean.length === 11) {
          formattedPhone = `(${telClean.substring(0, 2)}) ${telClean.substring(2, 7)}-${telClean.substring(7)}`;
        } else {
          formattedPhone = data.ddd_telefone_1;
        }
      }

      let contactName = "";
      if (data.qsa && data.qsa.length > 0) {
        contactName = data.qsa[0].nome_socio;
      } else if (data.razao_social) {
        contactName = data.razao_social.replace(/^[\d\.\-\/]+\s+/, "").trim();
      }

      if (contactName) {
        contactName = contactName
          .toLowerCase()
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      } else {
        contactName = "Responsável Legal";
      }

      setForm((prev) => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        email: data.email || prev.email,
        phone: formattedPhone || prev.phone,
        contact_name: contactName,
      }));
      
      toast.success("Dados do CNPJ importados automaticamente!");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível buscar as informações do CNPJ.");
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Nome",
      "CNPJ_CPF",
      "Contato_Responsavel",
      "Email",
      "Telefone"
    ];
    
    const rows = [
      headers.join(";"),
      `Translog Transportes Ltda;12.345.678/0001-99;Carlos Silva;comercial@translog.com.br;(11) 98765-4321`,
      `Frota Veloz Distribuidores;98.765.432/0001-11;Ana Oliveira;financeiro@frotaveloz.com.br;(21) 2555-1234`
    ];

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (!clients || clients.length === 0) {
      toast.error("Nenhum cliente cadastrado para exportar.");
      return;
    }

    const headers = [
      "Nome",
      "CNPJ_CPF",
      "Contato_Responsavel",
      "Email",
      "Telefone"
    ];

    const rows = [
      headers.join(";"),
      ...clients.map((c) => [
        c.name || "",
        c.document || "",
        c.contact_name || "",
        c.email || "",
        c.phone || ""
      ].join(";"))
    ];

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `carteira_clientes_${company?.name?.toLowerCase().replace(/\s+/g, "_") || "proposify"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Clientes exportados com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error("O arquivo está vazio ou não possui dados.");
      return;
    }

    const headerLine = lines[0]!;
    const delimiter = headerLine.includes(";") ? ";" : ",";
    const rawHeaders = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));

    const parsed: any[] = [];
    const errorsList: string[] = [];

    const getHeaderIdx = (name: string) => {
      return rawHeaders.findIndex((h) => h.toLowerCase() === name.toLowerCase() || h.toLowerCase().replace(/[^a-z0-9]/g, "") === name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    };

    const nameIdx = getHeaderIdx("Nome");
    const docIdx = getHeaderIdx("CNPJ_CPF");
    const contactIdx = getHeaderIdx("Contato_Responsavel");
    const emailIdx = getHeaderIdx("Email");
    const phoneIdx = getHeaderIdx("Telefone");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const regex = new RegExp(`\\s*${delimiter}\\s*(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)`);
      const cols = line.split(regex).map((c) => c.trim().replace(/^["']|["']$/g, ""));

      if (cols.length < 2) {
        errorsList.push(`Linha ${i + 1}: Informações insuficientes.`);
        continue;
      }

      const getVal = (idx: number, fallback = "") => (idx !== -1 && cols[idx] !== undefined ? cols[idx] : fallback);

      const name = getVal(nameIdx);
      const documentVal = getVal(docIdx);
      const contact_name = getVal(contactIdx);
      const email = getVal(emailIdx);
      const phone = getVal(phoneIdx);

      if (!name) {
        errorsList.push(`Linha ${i + 1}: O nome do cliente é obrigatório.`);
        continue;
      }

      parsed.push({
        name,
        document: documentVal || null,
        contact_name: contact_name || null,
        email: email || null,
        phone: phone || null,
      });
    }

    setImportPreview(parsed);
    setImportErrors(errorsList);
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0) {
      toast.error("Nenhum cliente válido para importar.");
      return;
    }

    const targetCompanyId = activeCompanyFilter || company?.id;
    if (!targetCompanyId) {
      toast.error("Selecione uma empresa ativa antes de importar.");
      return;
    }

    setImporting(true);
    try {
      const itemsData = importPreview.map((item) => ({
        ...item,
        company_id: targetCompanyId,
      }));

      const { error } = await supabase.from("clients").insert(itemsData);
      if (error) throw error;

      toast.success(`${importPreview.length} clientes importados com sucesso!`);
      qc.invalidateQueries({ queryKey: ["clients"] });
      setImportPreview([]);
      setImportErrors([]);
      setImportModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro na importação: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // Save / Update client
  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social ou nome");
      
      const targetCompanyId = form.company_id || activeCompanyId || (companies?.[0]?.id ?? null);
      
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || null,
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company_id: targetCompanyId,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editingClient ? "Cliente atualizado" : "Cliente cadastrado");
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete client safely
  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Safety check: verify if there are proposals associated with this client
      const { data: proposals, error: checkError } = await supabase
        .from("proposals")
        .select("id")
        .eq("client_id", id)
        .limit(1);
      
      if (checkError) throw checkError;
      
      if (proposals && proposals.length > 0) {
        throw new Error(
          "Não é possível excluir este cliente pois existem propostas vinculadas a ele."
        );
      }

      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter clients locally by search term
  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (clients ?? []).filter((c) => {
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.document ?? "").toLowerCase().includes(term) ||
        (c.contact_name ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [clients, searchTerm]);

  const cleanCnpjLength = form.document.replace(/\D/g, "").length;
  const isCnpjInput = cleanCnpjLength === 14;

  if (isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Empresas Assinantes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe as empresas cadastradas que utilizam o motor de propostas do Proposify AI.
            </p>
          </div>
        </div>

        <div className="mt-6 border border-border bg-card rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground bg-muted/40 font-semibold">
                <th className="px-4 py-3.5 font-normal">Nome</th>
                <th className="px-4 py-3.5 font-normal">CNPJ</th>
                <th className="px-4 py-3.5 font-normal">E-mail</th>
                <th className="px-4 py-3.5 font-normal">Telefone</th>
                <th className="px-4 py-3.5 text-center font-normal">Colaboradores</th>
                <th className="px-4 py-3.5 text-right font-normal">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(companies ?? []).map((c) => {
                const collabsCount = (allProfiles ?? []).filter((p) => p.company_id === c.id).length;
                return (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenCompanyDrawer(c)}
                    className="border-b border-border/70 last:border-0 hover:bg-secondary/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.document || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-center font-bold text-primary tabular-nums">{collabsCount}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="text-xs gap-1 font-semibold text-primary">
                        Ver Detalhes <ChevronRight className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(companies ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* DRAWER LATERAL DE DETALHES DA EMPRESA */}
        <Sheet open={saasDrawerOpen} onOpenChange={setSaasDrawerOpen}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader className="pb-4 border-b border-border">
              <SheetTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="size-5 text-primary" /> {selectedSaaSCompany?.name}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {selectedSaaSCompany?.tagline || "Configurações corporativas e equipe vinculada."}
              </SheetDescription>
            </SheetHeader>

            {saasCompanyDetails && (
              <div className="space-y-6 py-4">
                {/* Indicadores Rápidos da Empresa */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-secondary/10 border border-border rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total em Propostas
                    </p>
                    <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                      {brl(saasCompanyDetails.totalVal)}
                    </p>
                  </div>
                  <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Receita Ganha
                    </p>
                    <p className="mt-1 text-lg font-bold text-emerald-600 tabular-nums">
                      {brl(saasCompanyDetails.wonVal)}
                    </p>
                  </div>
                </div>

                {/* Colaboradores da Empresa */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/40 pb-1">
                    Equipe da Empresa ({saasCompanyDetails.collabs.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {saasCompanyDetails.collabs.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-background border border-border rounded-lg text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{p.full_name || "Sem Nome"}</p>
                          <p className="text-[10px] text-muted-foreground">{p.email}</p>
                        </div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase">
                          {p.role}
                        </span>
                      </div>
                    ))}
                    {saasCompanyDetails.collabs.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">Nenhum colaborador cadastrado.</p>
                    )}
                  </div>
                </div>

                {/* Propostas Geradas */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/40 pb-1">
                    Histórico de Propostas ({saasCompanyDetails.props.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {saasCompanyDetails.props.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-background border border-border rounded-lg text-xs">
                        <div>
                          <p className="font-mono text-[9px] font-bold text-muted-foreground">{p.proposal_code}</p>
                          <p className="font-semibold text-foreground mt-0.5">{p.clients?.name || "Cliente sem nome"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{brl(Number(p.net_amount))}</p>
                          <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 text-[8px] font-semibold uppercase bg-secondary text-muted-foreground">
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {saasCompanyDetails.props.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">Nenhuma proposta criada.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os clientes vinculados para emissão de propostas comerciais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setImportModalOpen(true)}
            variant="outline"
            className="gap-2 h-10 shrink-0 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
          >
            <Upload className="size-4" /> Importar Planilha
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="gap-2 h-10 shrink-0 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
          >
            <Download className="size-4" /> Exportar Planilha
          </Button>
          <Button onClick={openCreateModal} className="gap-2 h-10 shrink-0 font-semibold">
            <Plus className="size-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente por nome, CNPJ, contato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* List/Grid View Mode Toggle */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(val) => {
              if (val) setViewMode(val as "list" | "grid");
            }}
            className="border border-border rounded-lg p-0.5 bg-background"
          >
            <ToggleGroupItem value="list" aria-label="Visualização em Lista" className="size-9 p-0">
              <List className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Visualização em Blocos" className="size-9 p-0">
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-4">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando clientes...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center text-sm border border-dashed border-border bg-card rounded-xl text-muted-foreground">
            Nenhum cliente encontrado para os filtros selecionados.
          </div>
        ) : viewMode === "list" ? (
          /* Table List View */
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground bg-muted/40">
                  <th className="px-4 py-3.5 font-semibold">Cliente</th>
                  <th className="px-4 py-3.5 font-semibold">Documento</th>
                  <th className="px-4 py-3.5 font-semibold">Contato principal</th>
                  {isAdmin && selectedCompanyId === "all" ? (
                    <th className="px-4 py-3.5 font-semibold">Empresa vinculada</th>
                  ) : null}
                  <th className="px-4 py-3.5 font-semibold">Cadastro</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredClients.map((c) => {
                  const comp = companies?.find((company) => company.id === c.company_id);
                  return (
                    <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{c.name}</div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                        {c.document || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.contact_name ? (
                          <div>
                            <span className="font-medium text-foreground">{c.contact_name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.email} {c.phone && `· ${c.phone}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {isAdmin && selectedCompanyId === "all" ? (
                        <td className="px-4 py-3.5">
                          {comp ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              <Building2 className="size-3" />
                              {comp.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {shortDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(c)}
                            title="Editar Cliente"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Deseja realmente excluir o cliente "${c.name}"?`)) {
                                remove.mutate(c.id);
                              }
                            }}
                            title="Excluir Cliente"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid Block View */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((c) => {
              const comp = companies?.find((company) => company.id === c.company_id);
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Name and company badge */}
                    <div className="space-y-1">
                      <h3 className="font-bold text-foreground line-clamp-2 text-base leading-snug">
                        {c.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {c.document && (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                            <FileText className="size-3" />
                            {c.document}
                          </span>
                        )}
                        {comp && isAdmin && selectedCompanyId === "all" && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Building2 className="size-3" />
                            {comp.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                      {c.contact_name && (
                        <div className="flex items-center gap-2">
                          <User className="size-3.5 shrink-0 text-foreground/75" />
                          <span className="font-medium text-foreground">{c.contact_name}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 shrink-0 text-foreground/75" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="size-3.5 shrink-0 text-foreground/75" />
                          <span className="tabular-nums">{c.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border/60 text-[11px] text-muted-foreground">
                    <span>Desde {shortDate(c.created_at)}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(c)}
                        className="h-8 gap-1.5 px-2.5 text-xs"
                      >
                        <Edit2 className="size-3.5" /> Editar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Deseja realmente excluir o cliente "${c.name}"?`)) {
                            remove.mutate(c.id);
                          }
                        }}
                        className="size-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Modal for Create & Edit Client */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg text-foreground">
              {editingClient ? <Edit2 className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
              {editingClient ? "Editar Cadastro de Cliente" : "Novo Cliente Comercial"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados cadastrais do cliente. Use o recurso inteligente de CNPJ para preenchimento automático.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* CPF / CNPJ with Autofill Button */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">CNPJ / CPF</Label>
              <div className="flex gap-2">
                <Input
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  className="flex-1"
                />
                {isCnpjInput && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchCnpj}
                    disabled={isFetchingCnpj}
                    className="gap-1.5 h-10 px-3 font-medium text-xs shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {isFetchingCnpj ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Autopreencher
                  </Button>
                )}
              </div>
              {isCnpjInput && !isFetchingCnpj && (
                <span className="text-[10px] text-emerald-600 font-medium">
                  ✨ CNPJ detectado! Clique em Autopreencher para consultar os dados.
                </span>
              )}
            </div>

            {/* Client Name / Razão Social */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Razão Social / Nome Fantasia</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Transportadora Fadel LTDA"
                required
              />
            </div>

            {/* Primary Contact Name */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Nome do Contato Principal</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Ex: Carlos Alberto"
              />
            </div>

            {/* Email & Phone side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">E-mail Comercial</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            {/* Admin Company Selector */}
            {isAdmin && (
              <div className="grid gap-1.5 pt-1">
                <Label className="text-xs font-semibold text-muted-foreground">Vincular à Empresa</Label>
                <Select
                  value={form.company_id}
                  onValueChange={(val) => setForm({ ...form, company_id: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a empresa proprietária" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Apenas usuários desta empresa terão acesso a este cliente ao emitir propostas.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 sm:flex-row-reverse">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || isFetchingCnpj}
              className="font-medium"
            >
              {save.isPending ? "Salvando..." : editingClient ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={save.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE IMPORTAÇÃO DE CLIENTES CSV */}
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        setImportModalOpen(open);
        if (!open) {
          setImportPreview([]);
          setImportErrors([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5 text-primary" /> Importar Clientes via Planilha CSV
            </DialogTitle>
            <DialogDescription>
              Carregue sua carteira de clientes de forma simplificada a partir de um arquivo CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-secondary/10 p-4 rounded-lg border border-border">
              <div>
                <p className="text-xs font-semibold text-foreground">Passo 1: Baixe a planilha de exemplo</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Preencha as linhas mantendo os nomes e a ordem das colunas originais.
                </p>
              </div>
              <Button type="button" onClick={handleDownloadTemplate} size="sm" variant="outline" className="gap-1.5 shrink-0">
                <Download className="size-3.5" /> Baixar Modelo CSV
              </Button>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-foreground">Passo 2: Selecione o arquivo (.csv)</Label>
              <div className="border border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center bg-background gap-2 hover:border-primary/50 transition-colors">
                <Upload className="size-8 text-muted-foreground" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/95 cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">Formato aceito: CSV delimitado por ponto e vírgula (;)</p>
              </div>
            </div>

            {importErrors.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="size-4 shrink-0" /> Problemas identificados:
                </p>
                <ul className="list-disc list-inside max-h-32 overflow-y-auto pl-1 space-y-0.5">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Passo 3: Visualizar Clientes para Importação ({importPreview.length})</Label>
                <div className="border border-border rounded-lg overflow-x-auto max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold">
                        <th className="p-2">Nome do Cliente</th>
                        <th className="p-2">CNPJ / CPF</th>
                        <th className="p-2">Contato</th>
                        <th className="p-2">E-mail</th>
                        <th className="p-2">Telefone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importPreview.map((item, idx) => (
                        <tr key={idx} className="hover:bg-secondary/10">
                          <td className="p-2 font-medium">{item.name}</td>
                          <td className="p-2">{item.document || "—"}</td>
                          <td className="p-2 text-muted-foreground">{item.contact_name || "—"}</td>
                          <td className="p-2">{item.email || "—"}</td>
                          <td className="p-2 tabular-nums">{item.phone || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportModalOpen(false);
                setImportPreview([]);
                setImportErrors([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={importing || importPreview.length === 0}
              className="gap-1.5"
            >
              {importing ? "Salvando..." : "Confirmar Importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
