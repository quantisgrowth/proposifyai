import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  Trash2,
  Users,
  UserPlus,
  UserCheck,
  Edit2,
  Search,
  Image as ImageIcon,
  FileText,
  Upload,
  X,
  Check,
  ChevronsUpDown,
  SlidersHorizontal,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { formatDocument } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  companiesQuery,
  profilesQuery,
  type Company,
  type Profile,
  type UserRole,
} from "@/lib/proposals";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Central do Administrador — Proposify AI" },
      {
        name: "description",
        content:
          "Gestão global de colaboradores, empresas clientes e configurações corporativas.",
      },
    ],
  }),
  component: AdminPage,
});

/* =========================================================================
   1. ABA COLABORADORES (Listagem Full-Width + Modal de Cadastro/Edição)
   ========================================================================= */

const emptyCollaboratorForm = {
  full_name: "",
  email: "",
  password: "",
  role: "colaborador" as UserRole,
  company_ids: [] as string[],
};

function CollaboratorsTab() {
  const qc = useQueryClient();
  const { profile: loggedProfile, isGestor, activeCompanyId } = useAuth();
  const { data: profiles, isLoading: loadingProfiles } = useQuery(profilesQuery);
  const { data: companies } = useQuery(companiesQuery);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState(emptyCollaboratorForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);

  const openCreateModal = () => {
    setEditingProfile(null);
    const userCompanyId = loggedProfile?.company_id || activeCompanyId;
    setForm({
      ...emptyCollaboratorForm,
      company_ids: isGestor && userCompanyId ? [userCompanyId] : companies?.[0]?.id ? [companies[0].id] : [],
      role: "colaborador",
    });
    setModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProfile(p);
    setForm({
      full_name: p.full_name ?? "",
      email: p.email,
      password: "",
      role: p.role,
      company_ids: Array.isArray(p.company_ids) && p.company_ids.length > 0 
        ? p.company_ids 
        : p.company_id 
        ? [p.company_id] 
        : [],
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
      const primaryCompanyId = form.company_ids[0] || null;

      if (editingProfile) {
        // Modo Edição
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: form.full_name,
            email: form.email.trim(),
            role: form.role,
            company_id: primaryCompanyId,
          })
          .eq("id", editingProfile.id);

        if (error) throw error;

        // Atualizar relacionamentos profile_companies
        const { error: delError } = await supabase
          .from("profile_companies")
          .delete()
          .eq("profile_id", editingProfile.id);
        if (delError) throw delError;

        if (form.company_ids.length > 0) {
          const mappingRows = form.company_ids.map((cid) => ({
            profile_id: editingProfile.id,
            company_id: cid,
          }));
          const { error: insError } = await supabase
            .from("profile_companies")
            .insert(mappingRows);
          if (insError) throw insError;
        }

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
              company_id: primaryCompanyId,
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
            company_id: primaryCompanyId,
            active: true,
          });
          if (profileError) throw profileError;

          // Inserir relacionamentos profile_companies
          if (form.company_ids.length > 0) {
            const mappingRows = form.company_ids.map((cid) => ({
              profile_id: authData.user!.id,
              company_id: cid,
            }));
            const { error: insError } = await supabase
              .from("profile_companies")
              .insert(mappingRows);
            if (insError) throw insError;
          }
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

  const filteredProfiles = (profiles ?? [])
    .filter((p) => {
      if (isGestor) {
        const userCompanyId = loggedProfile?.company_id || activeCompanyId;
        return p.company_id === userCompanyId || p.company_ids?.includes(userCompanyId || "");
      }
      return true;
    })
    .filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      const linkedCompanies = (companies ?? []).filter((c) => p.company_ids?.includes(c.id));
      const companyNamesMatch = linkedCompanies.some((c) => c.name.toLowerCase().includes(term));
      return (
        (p.full_name ?? "").toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        (p.company?.name ?? "").toLowerCase().includes(term) ||
        companyNamesMatch
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
          const linkedCompanies = (companies ?? []).filter((c) => p.company_ids?.includes(c.id));
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
                  
                  {/* Visualização das Empresas Associadas (Badges) */}
                  <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                    <Building2 className="size-3.5 text-primary shrink-0 mr-0.5" />
                    {linkedCompanies.length > 0 ? (
                      linkedCompanies.map((c) => (
                        <span
                          key={c.id}
                          className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-foreground border border-border"
                        >
                          {c.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sem empresas vinculadas</span>
                    )}
                  </div>
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
                ? "Altere os dados cadastrais, cargo ou as empresas vinculadas a este colaborador."
                : "Defina o e-mail, senha inicial e a quais empresas este colaborador terá acesso."}
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

            {!isGestor && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Vincular a Empresas</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between text-left font-normal text-xs h-10 border-input bg-background hover:bg-accent"
                    >
                      <span className="truncate">
                        {form.company_ids.length === 0
                          ? "Selecione as empresas"
                          : form.company_ids.length === 1
                          ? companies?.find((c) => c.id === form.company_ids[0])?.name
                          : `${form.company_ids.length} empresas selecionadas`}
                      </span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-2 bg-popover border border-border rounded-lg shadow-md z-50">
                    <div className="space-y-1 max-h-[220px] overflow-y-auto">
                      {(companies ?? []).map((c) => {
                        const isChecked = form.company_ids.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer text-xs select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({ ...form, company_ids: [...form.company_ids, c.id] });
                                } else {
                                  setForm({ ...form, company_ids: form.company_ids.filter((id) => id !== c.id) });
                                }
                              }}
                              className="rounded border-input text-primary focus:ring-primary size-4"
                            />
                            <span className="font-medium text-foreground">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

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
                  <SelectItem value="gestor">Gestor / Administrador Master (Acesso Total da Empresa)</SelectItem>
                  {!isGestor && <SelectItem value="admin">Administrador da Plataforma (Acesso Total)</SelectItem>}
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
   2. ABA EMPRESAS (Listagem Full-Width + Modal com Logo & Rodapé)
   ========================================================================= */

const emptyCompany = {
  name: "",
  tagline: "",
  email: "",
  phone: "",
  document: "",
  logo_url: "",
  brand_color: "#0f172a",
  footer_text: "",
  solution_name: "",
  objective_text: "",
  scope_text: "",
  fidelity_policy: "",
  next_steps_text: "",
  default_validity_days: 15,
  default_payment_terms: "Pix",
  api_key: "",
  webhook_url: "",
  webhook_secret: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
  smtp_from_name: "",
};

function CompaniesTab() {
  const qc = useQueryClient();
  const { data: companies } = useQuery(companiesQuery);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyCompany);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleCropSave = () => {
    const img = new Image();
    img.src = rawImageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 300, 100);
        const baseWidth = 300;
        const baseHeight = 300 * (img.naturalHeight / img.naturalWidth);
        ctx.drawImage(
          img,
          cropOffset.x,
          cropOffset.y,
          baseWidth * cropZoom,
          baseHeight * cropZoom
        );
        const croppedBase64 = canvas.toDataURL("image/png");
        setForm((prev) => ({ ...prev, logo_url: croppedBase64 }));
        toast.success("Logo ajustada e carregada!");
      }
      setCropperOpen(false);
      setRawImageSrc("");
    };
  };

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
      logo_url: c.logo_url ?? "",
      brand_color: c.brand_color ?? "#0f172a",
      footer_text: c.footer_text ?? "",
      solution_name: c.solution_name ?? "",
      objective_text: c.objective_text ?? "",
      scope_text: c.scope_text ?? "",
      fidelity_policy: c.fidelity_policy ?? "",
      next_steps_text: c.next_steps_text ?? "",
      default_validity_days: c.default_validity_days,
      default_payment_terms: c.default_payment_terms,
      api_key: c.api_key ?? "",
      webhook_url: c.webhook_url ?? "",
      webhook_secret: c.webhook_secret ?? "",
      smtp_host: c.smtp_host ?? "",
      smtp_port: c.smtp_port ?? 587,
      smtp_user: c.smtp_user ?? "",
      smtp_pass: c.smtp_pass ?? "",
      smtp_from: c.smtp_from ?? "",
      smtp_from_name: c.smtp_from_name ?? "",
    });
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social da empresa");
      const payload = {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        document: form.document.trim(),
        logo_url: form.logo_url?.trim() || null,
        brand_color: form.brand_color?.trim() || "#0f172a",
        footer_text: form.footer_text?.trim() || null,
        solution_name: form.solution_name?.trim() || null,
        objective_text: form.objective_text?.trim() || null,
        scope_text: form.scope_text?.trim() || null,
        fidelity_policy: form.fidelity_policy?.trim() || null,
        next_steps_text: form.next_steps_text?.trim() || null,
        default_validity_days: form.default_validity_days,
        default_payment_terms: form.default_payment_terms,
        webhook_url: form.webhook_url?.trim() || null,
        webhook_secret: form.webhook_secret?.trim() || null,
        smtp_host: form.smtp_host?.trim() || null,
        smtp_port: form.smtp_port ? Number(form.smtp_port) : null,
        smtp_user: form.smtp_user?.trim() || null,
        smtp_pass: form.smtp_pass || null,
        smtp_from: form.smtp_from?.trim() || null,
        smtp_from_name: form.smtp_from_name?.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(payload);
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
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-secondary/40 transition-colors cursor-pointer"
            onClick={() => openEditModal(c)}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              {c.logo_url ? (
                <img
                  src={c.logo_url}
                  alt={c.name}
                  className="size-11 object-contain rounded-lg border border-border bg-white p-1"
                />
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-bold text-primary">
                  {c.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-foreground hover:underline truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.document} · {c.email} · {c.phone}
                </p>
                {c.footer_text ? (
                  <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                    Rodapé: {c.footer_text}
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className="flex items-center gap-2 self-end sm:self-center"
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

      {/* MODAL: Empresa (com Logo, Rodapé e Textos) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {editing ? "Editar Empresa & Identidade" : "Nova Empresa"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina a logo, dados cadastrais e as informações padrão de rodapé e proposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seção 1: Identidade Visual e Logo (Arquivo PNG, JPG, SVG ou URL) */}
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-primary" /> Logo da Empresa (Arquivo PNG, JPG, SVG)
                </Label>
                {form.logo_url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-destructive hover:bg-destructive/10 gap-1 px-2"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                  >
                    <X className="size-3" /> Remover Logo
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1.5 shadow-sm">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo Preview"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">Sem Logo</span>
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="company-logo-upload"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 4 * 1024 * 1024) {
                          toast.error("O arquivo deve ter no máximo 4MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setRawImageSrc(base64);
                          setCropZoom(1);
                          setCropOffset({ x: 0, y: 0 });
                          setCropperOpen(true);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-9"
                      onClick={() => document.getElementById("company-logo-upload")?.click()}
                    >
                      <Upload className="size-3.5" /> Escolher Arquivo (PNG, JPG, SVG)
                    </Button>
                  </div>

                  <p className="text-[10px] text-muted-foreground/90">
                    Dimensão recomendada: <strong>300x100px</strong> (proporção 3:1) com fundo transparente.
                  </p>

                  <Input
                    value={form.logo_url.startsWith("data:") ? "Arquivo enviado (" + form.logo_url.slice(0, 30) + "...)" : form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="Ou cole a URL direta da imagem (ex: https://.../logo.png)"
                    className="text-xs h-8"
                  />

                  <div className="flex items-center gap-3 pt-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      Cor de Marca da Proposta:
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.brand_color || "#0f172a"}
                        onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                        className="size-8 rounded border cursor-pointer bg-transparent shrink-0"
                      />
                      <Input
                        type="text"
                        value={form.brand_color || "#0f172a"}
                        onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                        placeholder="#0f172a"
                        className="text-xs h-8 w-24 font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Dados Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Razão Social / Nome da Empresa</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Frotlog Soluções em Carga e Descarga LTDA"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">CNPJ</Label>
                <Input
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value) })}
                  placeholder="CNPJ 53.968.073/0001-38"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  placeholder="(11) 4000-2200"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Slogan / Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Ex: Gestão e Mobilidade Inteligente"
              />
            </div>

            {/* Seção 3: Rodapé da Proposta */}
            <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-3">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Rodapé da Proposta Comercial
              </Label>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Texto do Rodapé Oficial da Empresa (Impresso em cada página)
                </Label>
                <Input
                  value={form.footer_text}
                  onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
                  placeholder="Ex: © 2026 Frotlog Soluções em Carga e Descarga LTDA — CNPJ: 53.968.073/0001-38"
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
                    {["Pix", "Boleto", "Cartão de Crédito", "Parcelado", "Transacional"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seção 4: Integrações, Webhooks e E-mail (SMTP) */}
            <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-4">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-primary" /> Integrações e Configurações de API/SMTP
              </Label>

              {/* API Token Section */}
              {editing && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Token de API (Integração de Entrada)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.api_key}
                      readOnly
                      className="bg-muted font-mono text-xs cursor-text flex-1 h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(form.api_key);
                        toast.success("Token copiado!");
                      }}
                      className="text-xs"
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Use este token no cabeçalho <code>Authorization: Bearer &lt;token&gt;</code> para enviar dados via CRM.
                  </p>
                </div>
              )}

              {/* Webhook Configuration */}
              <div className="space-y-3 pt-1 border-t border-border/55">
                <Label className="text-[11px] font-bold text-foreground block">Saída de Dados (Webhooks)</Label>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                    <Input
                      value={form.webhook_url}
                      onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                      placeholder="Ex: https://api.seu-crm.com/webhooks/proposify"
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Segredo do Webhook (Webhook Secret)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.webhook_secret}
                        onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                        placeholder="Gerado automaticamente"
                        className="text-xs h-9 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const randHex = Array.from({ length: 32 }, () =>
                            Math.floor(Math.random() * 16).toString(16)
                          ).join("");
                          setForm({ ...form, webhook_secret: randHex });
                          toast.success("Novo segredo gerado (salve para aplicar)!");
                        }}
                        className="text-xs"
                      >
                        Gerar
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Assina o payload via HMAC-SHA256 no cabeçalho <code>X-Proposify-Signature</code>.
                    </p>
                  </div>
                </div>
              </div>

              {/* SMTP Settings */}
              <div className="space-y-3 pt-3 border-t border-border/55">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-foreground block">Envio de E-mail Corporativo (SMTP)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!form.smtp_host || !form.smtp_port || !form.smtp_user || !form.smtp_pass) {
                        toast.error("Preencha todos os campos do SMTP antes de testar.");
                        return;
                      }
                      const portNum = Number(form.smtp_port);
                      if (isNaN(portNum)) {
                        toast.error("A porta do SMTP deve ser um número.");
                        return;
                      }
                      toast.loading("Testando conexão SMTP...", { id: "smtp-test" });
                      try {
                        const { testSmtpConnectionServer } = await import("@/lib/email.server");
                        const res = await testSmtpConnectionServer({
                          data: {
                            host: form.smtp_host,
                            port: portNum,
                            user: form.smtp_user,
                            pass: form.smtp_pass,
                          },
                        });
                        if (res.success) {
                          toast.success("Conexão SMTP efetuada com sucesso!", { id: "smtp-test" });
                        }
                      } catch (err: any) {
                        toast.error("Erro no teste SMTP: " + err.message, { id: "smtp-test" });
                      }
                    }}
                    className="text-[10px] h-7 px-2"
                  >
                    Testar Conexão
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1.5 col-span-2">
                    <Label className="text-xs text-muted-foreground">Host do SMTP</Label>
                    <Input
                      value={form.smtp_host}
                      onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                      placeholder="Ex: smtp.titan.email"
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Porta</Label>
                    <Input
                      type="number"
                      value={form.smtp_port}
                      onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) || 587 })}
                      placeholder="587"
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Usuário SMTP</Label>
                    <Input
                      value={form.smtp_user}
                      onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                      placeholder="comercial@empresa.com"
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Senha SMTP</Label>
                    <Input
                      type="password"
                      value={form.smtp_pass}
                      onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                      placeholder="••••••••"
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">E-mail Remetente</Label>
                    <Input
                      value={form.smtp_from}
                      onChange={(e) => setForm({ ...form, smtp_from: e.target.value })}
                      placeholder="Ex: comercial@empresa.com"
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Nome Remetente</Label>
                    <Input
                      value={form.smtp_from_name}
                      onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })}
                      placeholder="Ex: Frotlog Comercial"
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : editing ? "Salvar Alterações" : "Cadastrar Empresa"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CORTE DE LOGO */}
      <Dialog open={cropperOpen} onOpenChange={setCropperOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Logotipo</DialogTitle>
            <DialogDescription className="text-xs">
              Arraste a imagem e use o zoom para enquadrar a logo dentro do retângulo pontilhado (proporção ideal de 3:1).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Container do Cropper */}
            <div
              className="relative w-full h-[240px] bg-slate-950/5 overflow-hidden rounded-lg border border-border flex items-center justify-center select-none"
              onMouseDown={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                setCropOffset({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y,
                });
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                setIsDragging(true);
                setDragStart({ x: touch.clientX - cropOffset.x, y: touch.clientY - cropOffset.y });
              }}
              onTouchMove={(e) => {
                if (!isDragging) return;
                const touch = e.touches[0];
                if (!touch) return;
                setCropOffset({
                  x: touch.clientX - dragStart.x,
                  y: touch.clientY - dragStart.y,
                });
              }}
              onTouchEnd={() => setIsDragging(false)}
            >
              {/* Imagem a ser cortada */}
              {rawImageSrc && (
                <img
                  src={rawImageSrc}
                  alt="Crop Target"
                  style={{
                    position: "absolute",
                    left: "calc(50% - 150px)", // align with crop area left
                    top: "calc(50% - 50px)",  // align with crop area top
                    transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                    transformOrigin: "0 0",
                    cursor: "move",
                    maxWidth: "none",
                    width: "300px",
                    height: "auto",
                    pointerEvents: "none", // dragging handled by parent container
                  }}
                  id="cropper-image"
                />
              )}

              {/* Área de Recorte Overlay */}
              <div
                className="absolute w-[300px] h-[100px] border-2 border-dashed border-primary pointer-events-none rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                style={{
                  top: "calc(50% - 50px)",
                  left: "calc(50% - 150px)",
                }}
              />
            </div>

            {/* Controle de Zoom */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Zoom</span>
                <span>{Math.round(cropZoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setCropperOpen(false);
                  setRawImageSrc("");
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleCropSave}>
                Cortar e Confirmar
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


/* =========================================================================
   ABA DE CONFIGURAÇÃO DA EMPRESA ATIVA (PARA GESTORES)
   ========================================================================= */

function ActiveCompanyTab() {
  const qc = useQueryClient();
  const { company, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    email: "",
    phone: "",
    document: "",
    logo_url: "",
    brand_color: "#0f172a",
    footer_text: "",
    solution_name: "",
    objective_text: "",
    scope_text: "",
    fidelity_policy: "",
    next_steps_text: "",
    default_validity_days: 15,
    default_payment_terms: "Pix",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
    smtp_from_name: "",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        tagline: company.tagline || "",
        email: company.email || "",
        phone: company.phone || "",
        document: company.document || "",
        logo_url: company.logo_url || "",
        brand_color: company.brand_color || "#0f172a",
        footer_text: company.footer_text || "",
        solution_name: company.solution_name || "",
        objective_text: company.objective_text || "",
        scope_text: company.scope_text || "",
        fidelity_policy: company.fidelity_policy || "",
        next_steps_text: company.next_steps_text || "",
        default_validity_days: company.default_validity_days || 15,
        default_payment_terms: company.default_payment_terms || "Pix",
        smtp_host: company.smtp_host || "",
        smtp_port: company.smtp_port || 587,
        smtp_user: company.smtp_user || "",
        smtp_pass: company.smtp_pass || "",
        smtp_from: company.smtp_from || "",
        smtp_from_name: company.smtp_from_name || "",
      });
    }
  }, [company]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, logo_url: reader.result as string }));
        toast.success("Logo carregada com sucesso!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!form.name.trim()) {
      toast.error("Informe a Razão Social da empresa.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name.trim(),
          tagline: form.tagline.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          document: form.document.trim(),
          logo_url: form.logo_url.trim() || null,
          brand_color: form.brand_color.trim() || "#0f172a",
          footer_text: form.footer_text.trim() || null,
          solution_name: form.solution_name.trim() || null,
          objective_text: form.objective_text.trim() || null,
          scope_text: form.scope_text.trim() || null,
          fidelity_policy: form.fidelity_policy.trim() || null,
          next_steps_text: form.next_steps_text.trim() || null,
          default_validity_days: Number(form.default_validity_days) || 15,
          default_payment_terms: form.default_payment_terms.trim(),
          smtp_host: form.smtp_host.trim() || null,
          smtp_port: form.smtp_port ? Number(form.smtp_port) : null,
          smtp_user: form.smtp_user.trim() || null,
          smtp_pass: form.smtp_pass || null,
          smtp_from: form.smtp_from.trim() || null,
          smtp_from_name: form.smtp_from_name.trim() || null,
        })
        .eq("id", company.id);

      if (error) throw error;

      toast.success("Configurações da empresa atualizadas!");
      qc.invalidateQueries({ queryKey: ["companies"] });
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar dados da empresa.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <Card className="border-border bg-card/60 backdrop-blur shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Dados da Empresa
          </CardTitle>
          <CardDescription>
            Informações básicas de cadastro e personalização de marca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Razão Social / Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: LB Tyres Ltda"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Slogan / Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Ex: Tecnologia em Carga e Pneus"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">CNPJ / CPF</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value) })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">E-mail de Contato</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="comercial@empresa.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 4000-2200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
            <div className="grid gap-1.5 col-span-2">
              <Label className="text-xs font-semibold">Logotipo da Empresa</Label>
              <div className="flex items-center gap-3">
                {form.logo_url && (
                  <div className="size-12 rounded border border-border bg-white p-1 flex items-center justify-center shrink-0">
                    <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="cursor-pointer text-xs h-9"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Cor da Marca</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="w-12 h-9 p-0.5 border border-input cursor-pointer"
                />
                <Input
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="font-mono text-xs uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/60 backdrop-blur shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Proposta Base (Template Padrão)
          </CardTitle>
          <CardDescription>
            Defina os textos padrão que serão sugeridos para novas propostas comerciais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Nome da Solução Comercial</Label>
            <Input
              value={form.solution_name}
              onChange={(e) => setForm({ ...form, solution_name: e.target.value })}
              placeholder="Ex: Frotlog - Plataforma SaaS de Gestão de Frotas"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Objetivo e Proposta de Valor</Label>
            <Textarea
              rows={3}
              value={form.objective_text}
              onChange={(e) => setForm({ ...form, objective_text: e.target.value })}
              placeholder="Descreva o propósito principal da sua solução..."
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Funcionalidades e Escopo (Uma por linha: Título: Descrição)</Label>
            <Textarea
              rows={4}
              value={form.scope_text}
              onChange={(e) => setForm({ ...form, scope_text: e.target.value })}
              placeholder="Ex: Módulo Financeiro: Gestão de contas..."
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Política de Fidelidade</Label>
            <Textarea
              rows={2}
              value={form.fidelity_policy}
              onChange={(e) => setForm({ ...form, fidelity_policy: e.target.value })}
              placeholder="Descreva as condições de permanência ou rescisão..."
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Próximos Passos (Um por linha)</Label>
            <Textarea
              rows={4}
              value={form.next_steps_text}
              onChange={(e) => setForm({ ...form, next_steps_text: e.target.value })}
              placeholder="Ex: 1. Aceite digital...\n2. Configuração de conta..."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/60 backdrop-blur shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            Preferências e Envio (SMTP)
          </CardTitle>
          <CardDescription>
            Configure o servidor SMTP de envio de e-mails para propostas assinadas e rodapés oficiais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Validade Padrão das Propostas (dias)</Label>
              <Input
                type="number"
                value={form.default_validity_days}
                onChange={(e) => setForm({ ...form, default_validity_days: parseInt(e.target.value) || 15 })}
                placeholder="Ex: 15"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Forma de Pagamento Padrão</Label>
              <Input
                value={form.default_payment_terms}
                onChange={(e) => setForm({ ...form, default_payment_terms: e.target.value })}
                placeholder="Ex: Pix ou Boleto Bancário"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Texto do Rodapé do PDF</Label>
            <Input
              value={form.footer_text}
              onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
              placeholder="Ex: © 2026 Minha Empresa - CNPJ 00.000.000/0001-00"
            />
          </div>

          <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-1.5 col-span-2">
              <Label className="text-xs font-semibold">Servidor SMTP Host</Label>
              <Input
                value={form.smtp_host}
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                placeholder="smtp.zoho.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Porta SMTP</Label>
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Usuário SMTP</Label>
              <Input
                value={form.smtp_user}
                onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Senha SMTP</Label>
              <Input
                type="password"
                value={form.smtp_pass}
                onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">E-mail Remetente</Label>
              <Input
                type="email"
                value={form.smtp_from}
                onChange={(e) => setForm({ ...form, smtp_from: e.target.value })}
                placeholder="envios@empresa.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Nome do Remetente</Label>
              <Input
                value={form.smtp_from_name}
                onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })}
                placeholder="Ex: Comercial LB Tyres"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/40 pt-4 flex justify-end">
          <Button type="submit" disabled={busy} className="font-semibold px-6">
            {busy ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

/* =========================================================================
   PÁGINA PRINCIPAL ADMIN
   ========================================================================= */

function AdminPage() {
  const { profile, isAdmin, isGestor } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && !isAdmin && !isGestor) {
      navigate({ to: "/dashboard" });
    }
  }, [profile, isAdmin, isGestor, navigate]);

  if (!isAdmin && !isGestor) {
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">Acesso restrito para administradores e gestores.</p>
        </div>
      </AppShell>
    );
  }
  
  if (isGestor) {
    return (
      <AppShell>
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Painel de Gestão da Empresa
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie colaboradores e personalize os modelos de propostas da sua empresa.
            </p>
          </div>
        </div>

        <Tabs defaultValue="colaboradores" className="mt-6">
          <TabsList className="grid grid-cols-2 max-w-xs">
            <TabsTrigger value="colaboradores" className="gap-2 text-xs">
              <Users className="size-4" /> Minha Equipe
            </TabsTrigger>
            <TabsTrigger value="empresa" className="gap-2 text-xs">
              <Building2 className="size-4" /> Dados da Empresa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="colaboradores" className="mt-6">
            <CollaboratorsTab />
          </TabsContent>
          <TabsContent value="empresa" className="mt-6">
            <ActiveCompanyTab />
          </TabsContent>
        </Tabs>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Central do Administrador
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão global de colaboradores, empresas clientes e configurações corporativas.
          </p>
        </div>
      </div>

      <Tabs defaultValue="colaboradores" className="mt-6">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="colaboradores" className="gap-2 text-xs">
            <Users className="size-4" /> Colaboradores
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-2 text-xs">
            <Building2 className="size-4" /> Empresas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="mt-6">
          <CollaboratorsTab />
        </TabsContent>
        <TabsContent value="empresas" className="mt-6">
          <CompaniesTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

