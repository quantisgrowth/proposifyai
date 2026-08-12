import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  Layers,
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
  clientsQuery,
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
          "Gestão de empresas, cadastro de colaboradores vinculados, catálogo e clientes.",
      },
    ],
  }),
  component: AdminPage,
});

const pricingTypes: PricingType[] = ["recurring", "one_time", "setup", "usage_based"];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* =========================================================================
   1. ABA COLABORADORES (Cadastro & Gestão por Empresa)
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
  const [form, setForm] = useState(emptyCollaboratorForm);
  const [busy, setBusy] = useState(false);

  const handleCreateCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) {
      toast.error("Preencha nome, e-mail e senha inicial.");
      return;
    }
    if (!form.company_id && (companies ?? []).length > 0) {
      toast.error("Selecione a empresa à qual o colaborador será vinculado.");
      return;
    }

    setBusy(true);
    try {
      // 1. Criar usuário no Supabase Auth
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

      // 2. Garantir registro na tabela profiles
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
      qc.invalidateQueries({ queryKey: ["profiles"] });
      setForm(emptyCollaboratorForm);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erro ao cadastrar colaborador.";
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

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Função do usuário atualizada");
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, company_id }: { id: string; company_id: string }) => {
      const { error } = await supabase.from("profiles").update({ company_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Empresa vinculada atualizada");
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]">
      {/* Lista de Colaboradores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            Colaboradores Cadastrados ({(profiles ?? []).length})
          </p>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {(profiles ?? []).map((p) => {
            const companyName = p.company?.name || "Empresa Padrão";
            return (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {p.full_name?.charAt(0).toUpperCase() || p.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.full_name || p.email}
                      </p>
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
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="size-3 text-primary" />
                      <span className="font-medium text-foreground/80">{companyName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Select
                    value={p.company_id || ""}
                    onValueChange={(company_id) =>
                      updateCompany.mutate({ id: p.id, company_id })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <SelectValue placeholder="Mudar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

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

          {(profiles ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {loadingProfiles ? "Carregando colaboradores..." : "Nenhum colaborador cadastrado."}
            </div>
          )}
        </div>
      </div>

      {/* Formulário Novo Colaborador */}
      <div className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <UserPlus className="size-4 text-primary" />
          <p className="font-medium text-foreground">Novo Colaborador</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          O colaborador receberá o acesso para gerar propostas apenas da empresa vinculada.
        </p>

        <form onSubmit={handleCreateCollaborator} className="mt-5 space-y-3.5">
          <Field label="Nome Completo">
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Ex: Carlos Silva"
              required
            />
          </Field>

          <Field label="E-mail de Acesso">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="colaborador@empresa.com"
              required
            />
          </Field>

          <Field label="Senha Inicial">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </Field>

          <Field label="Empresa Vinculada">
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
          </Field>

          <Field label="Função no Sistema">
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
          </Field>

          <Button type="submit" disabled={busy} className="w-full mt-2">
            {busy ? "Cadastrando..." : "Cadastrar Colaborador"}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   2. ABA EMPRESAS (Multi-Empresa)
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
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyCompany);

  const reset = () => {
    setEditing(null);
    setForm(emptyCompany);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social ou nome da empresa");
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
      reset();
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
      reset();
    },
    onError: () => toast.error("Não foi possível remover a empresa pois existem vínculos ativos."),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]">
      {/* Lista de Empresas */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          Empresas Cadastradas ({(companies ?? []).length})
        </p>

        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {(companies ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4">
              <button
                type="button"
                className="text-left min-w-0"
                onClick={() => {
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
                }}
              >
                <p className="font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.document} · {c.email}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{c.tagline}</p>
              </button>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => {
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
                  }}
                >
                  <Edit2 className="size-3.5" />
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
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada.
            </div>
          )}
        </div>
      </div>

      {/* Formulário Empresa */}
      <div className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="font-medium text-foreground">
          {editing ? "Editar Empresa" : "Nova Empresa"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Configuração da identidade e padrões exibidos nas propostas geradas.
        </p>

        <div className="mt-5 space-y-3.5">
          <Field label="Razão Social / Nome Fantasia">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Minha Empresa S/A"
            />
          </Field>
          <Field label="Slogan / Tagline">
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Ex: Consultoria e Tecnologia"
            />
          </Field>
          <Field label="CNPJ / Documento">
            <Input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
              placeholder="CNPJ 00.000.000/0001-00"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail Comercial">
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Validade Padrão (dias)">
              <Input
                type="number"
                value={form.default_validity_days}
                onChange={(e) =>
                  setForm({ ...form, default_validity_days: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Condição Padrão">
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
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Salvar Alterações" : "Cadastrar Empresa"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. ABA CATÁLOGO (Produtos/Serviços com filtro por Empresa)
   ========================================================================= */

const emptyProduct = {
  name: "",
  description: "",
  unit_price: 0,
  pricing_type: "one_time" as PricingType,
  company_id: "",
};

function CatalogTab() {
  const qc = useQueryClient();
  const { data: companies } = useQuery(companiesQuery);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const { data: products } = useQuery(
    productsQuery(selectedCompanyId === "all" ? null : selectedCompanyId)
  );

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const reset = () => {
    setEditing(null);
    setForm(emptyProduct);
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
      reset();
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
      reset();
    },
    onError: () =>
      toast.error("Não foi possível remover: o serviço está em uso em alguma proposta."),
  });

  return (
    <div className="space-y-4">
      {/* Filtro por empresa */}
      <div className="flex items-center gap-3">
        <Label className="text-xs font-medium text-muted-foreground">Filtrar por Empresa:</Label>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {(products ?? []).map((p) => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => {
                  setEditing(p);
                  setForm({
                    name: p.name,
                    description: p.description ?? "",
                    unit_price: Number(p.unit_price),
                    pricing_type: p.pricing_type,
                    company_id: p.company_id ?? "",
                  });
                }}
              >
                <p className="truncate font-medium text-foreground">{p.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {p.description}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {pricingLabel[p.pricing_type]}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="tabular-nums font-semibold text-sm">
                  {brl(Number(p.unit_price))}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.active}
                    onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {(products ?? []).length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Nenhum serviço encontrado no catálogo desta empresa.
            </p>
          )}
        </div>

        <div className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="font-medium text-foreground">
            {editing ? "Editar Serviço" : "Novo Serviço"}
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Nome do Serviço">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Vincular a Empresa">
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
            </Field>
            <Field label="Descrição">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Preço Unitário (R$)">
              <CurrencyInput
                value={form.unit_price}
                onChange={(val) => setForm({ ...form, unit_price: val })}
                placeholder="R$ 0,00"
              />
            </Field>
            <Field label="Tipo de Cobrança">
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
            </Field>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
                {editing ? "Salvar Alterações" : "Adicionar ao Catálogo"}
              </Button>
              {editing && (
                <Button variant="outline" onClick={reset}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PÁGINA PRINCIPAL ADMIN
   ========================================================================= */

function AdminPage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between pb-2 border-b border-border">
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
