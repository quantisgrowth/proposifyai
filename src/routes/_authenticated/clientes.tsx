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
import { clientsQuery, companiesQuery, type Client } from "@/lib/proposals";
import { shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

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
  const { profile, company, isAdmin } = useAuth();
  const { data: companies } = useQuery(companiesQuery);

  // View mode and search state
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchTerm, setSearchTerm] = useState("");

  // Company filtering for admins
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return profile?.company_id ?? "all";
  });

  const activeCompanyFilter = isAdmin
    ? selectedCompanyId === "all"
      ? null
      : selectedCompanyId
    : profile?.company_id || company?.id || null;

  const { data: clients, isLoading } = useQuery(clientsQuery(activeCompanyFilter));

  // Modal and form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  const openCreateModal = () => {
    setEditingClient(null);
    setForm({
      ...emptyForm,
      company_id:
        selectedCompanyId !== "all"
          ? selectedCompanyId
          : profile?.company_id ?? (companies?.[0]?.id ?? ""),
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
      company_id: c.company_id ?? (profile?.company_id ?? ""),
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

      setForm((prev) => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        email: data.email || prev.email,
        phone: formattedPhone || prev.phone,
        contact_name: data.qsa?.[0]?.nome_socio || prev.contact_name || "Responsável Legal",
      }));
      
      toast.success("Dados do CNPJ importados automaticamente!");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível buscar as informações do CNPJ.");
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  // Save / Update client
  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social ou nome");
      
      const targetCompanyId = form.company_id || profile?.company_id || (companies?.[0]?.id ?? null);
      
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
        <Button onClick={openCreateModal} className="gap-2 h-10 shrink-0">
          <Plus className="size-4" /> Novo Cliente
        </Button>
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
          {/* Admin Company Selector */}
          {isAdmin ? (
            <div className="flex items-center gap-2">
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
          ) : null}

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
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
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
    </AppShell>
  );
}
