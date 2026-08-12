import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Package,
  Trash2,
  Users,
  UserPlus,
  Shield,
  UserCheck,
  Plus,
  Edit2,
  KeyRound,
  Search,
  CheckCircle2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  companiesQuery,
  profilesQuery,
  productsQuery,
  type Company,
  type Profile,
  type Product,
  type PricingType,
  type UserRole,
} from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Central do Administrador — Proposify AI" },
      {
        name: "description",
        content:
          "Gestão global de colaboradores, empresas clientes e catálogo de serviços.",
      },
    ],
  }),
  component: AdminPage,
});

const pricingTypes: PricingType[] = ["recurring", "one_time", "setup", "usage_based"];

/* =========================================================================
   1. ABA COLABORADORES (Listagem Full-Width + Modal de Cadastro/Edição)
   ========================================================================= */

const emptyCollaboratorForm = {
  full_name: "",
  email: "",
  password: "",
  role: "colaborador" as UserRole,
  company_id: "",
};

function CollaboratorsTab() {
  const qc = useQueryClient();
  const { data: profiles, isLoading: loadingProfiles } = useQuery(profilesQuery);
  const { data: companies } = useQuery(companiesQuery);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState(emptyCollaboratorForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);

  const openCreateModal = () => {
    setEditingProfile(null);
    setForm({
      ...emptyCollaboratorForm,
      company_id: companies?.[0]?.id ?? "",
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Profile) => {
    setEditingProfile(p);
    setForm({
      full_name: p.full_name ?? "",
      email: p.email,
      password: "",
      role: p.role,
      company_id: p.company_id ?? (companies?.[0]?.id ?? ""),
    });
    setModalOpen(true);
  };

  const handleSaveCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.full_name) {
      toast.error("Preencha o nome e o e-mail.");
      return;
    }

    setBusy(true);
    try {
      if (editingProfile) {
        // Modo Edição
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: form.full_name,
            email: form.email.trim(),
            role: form.role,
            company_id: form.company_id || null,
          })
          .eq("id", editingProfile.id);

        if (error) throw error;
        toast.success("Cadastro do colaborador atualizado!");
      } else {
        // Modo Criação
        if (!form.password || form.password.length < 6) {
          toast.error("A senha deve ter pelo menos 6 caracteres.");
          setBusy(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              role: form.role,
              company_id: form.company_id || (companies?.[0]?.id ?? null),
            },
          },
        });
        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: authData.user.id,
            email: form.email.trim(),
            full_name: form.full_name,
            role: form.role,
            company_id: form.company_id || (companies?.[0]?.id ?? null),
            active: true,
          });
          if (profileError) throw profileError;
        }
        toast.success("Colaborador cadastrado com sucesso!");
      }

      qc.invalidateQueries({ queryKey: ["profiles"] });
      setModalOpen(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erro ao salvar colaborador.";
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const removeCollaborator = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Colaborador removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredProfiles = (profiles ?? []).filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (p.full_name ?? "").toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      (p.company?.name ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header com Busca e Botão Novo */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <Button onClick={openCreateModal} className="gap-2 h-10">
          <UserPlus className="size-4" /> Novo Colaborador
        </Button>
      </div>

      {/* Tabela / Lista Full-Width */}
      <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {filteredProfiles.map((p) => {
          const companyName = p.company?.name || "Empresa Padrão";
          return (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-secondary/40 transition-colors cursor-pointer"
              onClick={() => openEditModal(p)}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {p.full_name?.charAt(0).toUpperCase() || p.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground hover:underline">
                      {p.full_name || p.email}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        p.role === "admin"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      {p.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3 text-primary" />
                    <span className="font-medium text-foreground/80">{companyName}</span>
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div
                className="flex items-center gap-2 self-end sm:self-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => openEditModal(p)}
                >
                  <Edit2 className="size-3.5" /> Editar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCollaborator.mutate(p.id)}
                  title="Excluir colaborador"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {filteredProfiles.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {loadingProfiles
              ? "Carregando colaboradores..."
              : "Nenhum colaborador encontrado."}
          </div>
        )}
      </div>

      {/* MODAL / POP-UP: Cadastro e Edição de Colaborador */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              {editingProfile ? "Editar Colaborador" : "Cadastrar Novo Colaborador"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingProfile
                ? "Altere os dados cadastrais, cargo ou a empresa vinculada a este colaborador."
                : "Defina o e-mail, senha inicial e a qual empresa este colaborador terá acesso."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCollaborator} className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Ex: Carlos Silva"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">E-mail de Acesso</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="colaborador@empresa.com"
                required
              />
            </div>

            {!editingProfile ? (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Senha Inicial</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Vincular a Empresa</Label>
              <Select
                value={form.company_id}
                onValueChange={(val) => setForm({ ...form, company_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Função / Permissão</Label>
              <Select
                value={form.role}
                onValueChange={(val) => setForm({ ...form, role: val as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador Comercial (Emite Propostas)</SelectItem>
                  <SelectItem value="admin">Administrador (Acesso Total)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Salvando..."
                  : editingProfile
                  ? "Salvar Alterações"
                  : "Cadastrar Colaborador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
   2. ABA EMPRESAS (Listagem Full-Width + Modal de Cadastro/Edição)
   ========================================================================= */

const emptyCompany = {
  name: "",
  tagline: "",
  email: "",
  phone: "",
  document: "",
  default_validity_days: 15,
  default_payment_terms: "Pix",
};

function CompaniesTab() {
  const qc = useQueryClient();
  const { data: companies } = useQuery(companiesQuery);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyCompany);

  const openCreateModal = () => {
    setEditing(null);
    setForm(emptyCompany);
    setModalOpen(true);
  };

  const openEditModal = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name,
      tagline: c.tagline,
      email: c.email,
      phone: c.phone,
      document: c.document,
      default_validity_days: c.default_validity_days,
      default_payment_terms: c.default_payment_terms,
    });
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social da empresa");
      if (editing) {
        const { error } = await supabase.from("companies").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success(editing ? "Empresa atualizada" : "Empresa cadastrada");
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Empresa removida");
    },
    onError: () => toast.error("Não foi possível remover: existem colaboradores ou propostas vinculadas."),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Empresas Cadastradas ({(companies ?? []).length})
        </p>
        <Button onClick={openCreateModal} className="gap-2 h-10">
          <Building2 className="size-4" /> Nova Empresa
        </Button>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {(companies ?? []).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors cursor-pointer"
            onClick={() => openEditModal(c)}
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground hover:underline truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {c.document} · {c.email} · {c.phone}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.tagline}</p>
            </div>
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => openEditModal(c)}
              >
                <Edit2 className="size-3.5" /> Editar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeCompany.mutate(c.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}

        {(companies ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada.
          </div>
        )}
      </div>

      {/* MODAL: Empresa */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {editing ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configurações da empresa exibidas nas propostas comerciais geradas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Razão Social / Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Frotlog Logística S/A"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Slogan / Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Ex: Gestão e Mobilidade Inteligente"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ / Documento</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                placeholder="CNPJ 00.000.000/0001-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">E-mail Comercial</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="comercial@empresa.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Telefone / WhatsApp</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Validade Padrão (dias)</Label>
                <Input
                  type="number"
                  value={form.default_validity_days}
                  onChange={(e) =>
                    setForm({ ...form, default_validity_days: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Condição Padrão</Label>
                <Select
                  value={form.default_payment_terms}
                  onValueChange={(v) => setForm({ ...form, default_payment_terms: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Pix", "Boleto", "Cartão de Crédito", "Parcelado"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : editing ? "Salvar Alterações" : "Cadastrar Empresa"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
   3. ABA CATÁLOGO (Produtos/Serviços Full-Width + Modal)
   ========================================================================= */

const emptyProduct = {
  name: "",
  description: "",
  unit_price: 0,
  pricing_type: "usage_based" as PricingType,
  company_id: "",
};

function CatalogTab() {
  const qc = useQueryClient();
  const { data: companies } = useQuery(companiesQuery);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const { data: products } = useQuery(
    productsQuery(selectedCompanyId === "all" ? null : selectedCompanyId)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      ...emptyProduct,
      company_id: selectedCompanyId !== "all" ? selectedCompanyId : (companies?.[0]?.id ?? ""),
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      unit_price: Number(p.unit_price),
      pricing_type: p.pricing_type,
      company_id: p.company_id ?? "",
    });
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do serviço");
      const payload = {
        ...form,
        company_id: form.company_id || (companies?.[0]?.id ?? null),
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Serviço atualizado" : "Serviço adicionado");
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Serviço removido");
    },
    onError: () =>
      toast.error("Não foi possível remover: o serviço está em uso em alguma proposta."),
  });

  return (
    <div className="space-y-4">
      {/* Filtro por empresa e Botão Novo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Filtrar por Empresa:
          </Label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-[220px] h-9 text-xs">
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

        <Button onClick={openCreateModal} className="gap-2 h-10">
          <Package className="size-4" /> Novo Serviço / Produto
        </Button>
      </div>

      {/* Lista Full-Width */}
      <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {(products ?? []).map((p) => (
          <div
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-secondary/40 transition-colors cursor-pointer"
            onClick={() => openEditModal(p)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground hover:underline truncate">{p.name}</p>
                <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {pricingLabel[p.pricing_type] ?? p.pricing_type}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {p.description || "Sem descrição detalhada."}
              </p>
            </div>

            <div
              className="flex items-center gap-4 self-end sm:self-center"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="tabular-nums font-bold text-base text-foreground whitespace-nowrap">
                {brl(Number(p.unit_price))}
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={p.active}
                  onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                  title={p.active ? "Ativo" : "Inativo"}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => openEditModal(p)}
                >
                  <Edit2 className="size-3.5" /> Editar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(p.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {(products ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum serviço encontrado no catálogo desta empresa.
          </div>
        )}
      </div>

      {/* MODAL: Produto / Serviço */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {editing ? "Editar Serviço / Produto" : "Novo Serviço / Produto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre itens no catálogo para seleção rápida ao montar propostas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome do Serviço</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Transação / Emissão"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Vincular a Empresa</Label>
              <Select
                value={form.company_id}
                onValueChange={(val) => setForm({ ...form, company_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Valor correspondente a cada transação processada..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Preço Unitário (R$)</Label>
                <CurrencyInput
                  value={form.unit_price}
                  onChange={(val) => setForm({ ...form, unit_price: val })}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Cobrança</Label>
                <Select
                  value={form.pricing_type}
                  onValueChange={(v) => setForm({ ...form, pricing_type: v as PricingType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {pricingLabel[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending
                  ? "Salvando..."
                  : editing
                  ? "Salvar Alterações"
                  : "Adicionar ao Catálogo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
   PÁGINA PRINCIPAL ADMIN
   ========================================================================= */

function AdminPage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Central do Administrador
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão global de colaboradores, empresas clientes e catálogos de serviços.
          </p>
        </div>
      </div>

      <Tabs defaultValue="colaboradores" className="mt-6">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="colaboradores" className="gap-2 text-xs">
            <Users className="size-4" /> Colaboradores
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-2 text-xs">
            <Building2 className="size-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-2 text-xs">
            <Package className="size-4" /> Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="mt-6">
          <CollaboratorsTab />
        </TabsContent>
        <TabsContent value="empresas" className="mt-6">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="catalogo" className="mt-6">
          <CatalogTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
