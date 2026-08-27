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
  Layers,
  Plus,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { formatDocument } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import { ImageCropperDialog } from "@/components/image-cropper";
import { UploadProgressOverlay } from "@/components/upload-progress";

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
    const userCompanyId = activeCompanyId || loggedProfile?.company_id;
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
        const userCompanyId = activeCompanyId || loggedProfile?.company_id;
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
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
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
    show_objective: true,
    show_scope: true,
    show_fidelity: true,
    show_next_steps: true,
    objective_title: "1. Objetivo e Proposta de Valor",
    objective_subtitle: "",
    scope_title: "2. Funcionalidades & Escopo da Solução",
    scope_subtitle: "A contratação da plataforma engloba o acesso completo às seguintes ferramentas, sem qualquer restrição de recursos ou cobrança de licenças adicionais:",
    fidelity_title: "Nossa Política de Fidelidade:",
    fidelity_subtitle: "",
    next_steps_title: "Próximos Passos para Ativação",
    next_steps_subtitle: "",
  });

  const { data: customBlocks, refetch: refetchBlocks } = useQuery({
    queryKey: ["company_custom_blocks", company?.id],
    enabled: Boolean(company?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_custom_blocks")
        .select("*")
        .eq("company_id", company!.id)
        .is("proposal_id", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const [editingBlock, setEditingBlock] = useState<any | null>(null);
  const [blockForm, setBlockForm] = useState({ title: "", subtitle: "", content: "" });
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const openBlockModal = (block?: any) => {
    if (block) {
      setEditingBlock(block);
      setBlockForm({
        title: block.title,
        subtitle: block.subtitle || "",
        content: block.content,
      });
    } else {
      setEditingBlock(null);
      setBlockForm({ title: "", subtitle: "", content: "" });
    }
    setBlockModalOpen(true);
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!blockForm.title.trim() || !blockForm.content.trim()) {
      toast.error("Preencha o título e o conteúdo do bloco.");
      return;
    }

    try {
      if (editingBlock) {
        // Edit existing
        const { error } = await supabase
          .from("proposal_custom_blocks")
          .update({
            title: blockForm.title.trim(),
            subtitle: blockForm.subtitle.trim() || null,
            content: blockForm.content.trim(),
          })
          .eq("id", editingBlock.id);
        if (error) throw error;
        toast.success("Bloco atualizado!");
      } else {
        // Create new
        const position = customBlocks ? customBlocks.length : 0;
        const { error } = await supabase
          .from("proposal_custom_blocks")
          .insert({
            company_id: company.id,
            title: blockForm.title.trim(),
            subtitle: blockForm.subtitle.trim() || null,
            content: blockForm.content.trim(),
            position,
          });
        if (error) throw error;
        toast.success("Bloco adicionado!");
      }
      refetchBlocks();
      setBlockModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar bloco.");
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este bloco?")) return;
    try {
      const { error } = await supabase
        .from("proposal_custom_blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Bloco removido!");
      refetchBlocks();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover bloco.");
    }
  };

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
        show_objective: company.show_objective !== false,
        show_scope: company.show_scope !== false,
        show_fidelity: company.show_fidelity !== false,
        show_next_steps: company.show_next_steps !== false,
        objective_title: company.objective_title || "1. Objetivo e Proposta de Valor",
        objective_subtitle: company.objective_subtitle || "",
        scope_title: company.scope_title || "2. Funcionalidades & Escopo da Solução",
        scope_subtitle: company.scope_subtitle || "A contratação da plataforma engloba o acesso completo às seguintes ferramentas, sem qualquer restrição de recursos ou cobrança de licenças adicionais:",
        fidelity_title: company.fidelity_title || "Nossa Política de Fidelidade:",
        fidelity_subtitle: company.fidelity_subtitle || "",
        next_steps_title: company.next_steps_title || "Próximos Passos para Ativação",
        next_steps_subtitle: company.next_steps_subtitle || "",
      });
    }
  }, [company]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("O logotipo deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setRawImageSrc(event.target?.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmLogoCrop = (croppedBase64: string) => {
    setForm((prev) => ({ ...prev, logo_url: croppedBase64 }));
    toast.success("Logo recortada e carregada!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!form.name.trim()) {
      toast.error("Informe a Razão Social da empresa.");
      return;
    }

    setProgressOpen(true);
    setSaveProgress(0);
    setSaveStatus("Enviando dados da empresa...");

    // Simulated progress bar (1.2 seconds total)
    const interval = setInterval(() => {
      setSaveProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 10;
        if (next < 40) {
          setSaveStatus("Enviando logotipo e dados...");
        } else if (next < 80) {
          setSaveStatus("Salvando configurações no banco...");
        } else {
          setSaveStatus("Finalizando...");
        }
        return next;
      });
    }, 100);

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
          show_objective: form.show_objective,
          show_scope: form.show_scope,
          show_fidelity: form.show_fidelity,
          show_next_steps: form.show_next_steps,
          objective_title: form.objective_title.trim() || "1. Objetivo e Proposta de Valor",
          objective_subtitle: form.objective_subtitle.trim() || null,
          scope_title: form.scope_title.trim() || "2. Funcionalidades & Escopo da Solução",
          scope_subtitle: form.scope_subtitle.trim() || null,
          fidelity_title: form.fidelity_title.trim() || "Nossa Política de Fidelidade:",
          fidelity_subtitle: form.fidelity_subtitle.trim() || null,
          next_steps_title: form.next_steps_title.trim() || "Próximos Passos para Ativação",
          next_steps_subtitle: form.next_steps_subtitle.trim() || null,
        })
        .eq("id", company.id);

      if (error) throw error;

      setSaveProgress(100);
      setSaveStatus("Concluído!");
      toast.success("Configurações da empresa atualizadas!");
      qc.invalidateQueries({ queryKey: ["companies"] });
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar dados da empresa.");
    } finally {
      clearInterval(interval);
      setBusy(false);
      setTimeout(() => setProgressOpen(false), 500);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <form onSubmit={handleSubmit} className="space-y-6">
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
                  <div className="flex-1 space-y-1">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleLogoUpload}
                      className="cursor-pointer text-xs h-9"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Dimensão ideal: <strong>180x60 pixels</strong> (proporção 3:1) | PNG ou JPG de até 2MB.
                </p>
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
              Proposta Base (Seções Modulares)
            </CardTitle>
            <CardDescription>
              Ative ou desative cada seção padrão e customize os títulos e textos de introdução.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 divide-y divide-border/40">
            {/* Nome da Solução Comercial */}
            <div className="grid gap-1.5 pb-4">
              <Label className="text-xs font-semibold">Nome da Solução Comercial Padrão</Label>
              <Input
                value={form.solution_name}
                onChange={(e) => setForm({ ...form, solution_name: e.target.value })}
                placeholder="Ex: Frotlog - Plataforma SaaS de Gestão de Frotas"
              />
            </div>

            {/* Seção 1: Objetivo e Proposta de Valor */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    Seção 1: Objetivo e Proposta de Valor
                  </Label>
                  <p className="text-xs text-muted-foreground">Exibe a apresentação geral e objetivos da solução.</p>
                </div>
                <Switch
                  checked={form.show_objective}
                  onCheckedChange={(checked) => setForm({ ...form, show_objective: checked })}
                />
              </div>

              {form.show_objective && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={form.objective_title}
                      onChange={(e) => setForm({ ...form, objective_title: e.target.value })}
                      placeholder="Ex: 1. Objetivo e Proposta de Valor"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução (Opcional)</Label>
                    <Input
                      value={form.objective_subtitle}
                      onChange={(e) => setForm({ ...form, objective_subtitle: e.target.value })}
                      placeholder="Subtítulo ou parágrafo introdutório..."
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Conteúdo Padrão</Label>
                    <Textarea
                      rows={3}
                      value={form.objective_text}
                      onChange={(e) => setForm({ ...form, objective_text: e.target.value })}
                      placeholder="Descreva o propósito principal da sua solução..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seção 2: Funcionalidades e Escopo */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    Seção 2: Funcionalidades & Escopo
                  </Label>
                  <p className="text-xs text-muted-foreground">Exibe a lista de funcionalidades ou serviços incluídos.</p>
                </div>
                <Switch
                  checked={form.show_scope}
                  onCheckedChange={(checked) => setForm({ ...form, show_scope: checked })}
                />
              </div>

              {form.show_scope && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={form.scope_title}
                      onChange={(e) => setForm({ ...form, scope_title: e.target.value })}
                      placeholder="Ex: 2. Funcionalidades & Escopo da Solução"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução</Label>
                    <Input
                      value={form.scope_subtitle}
                      onChange={(e) => setForm({ ...form, scope_subtitle: e.target.value })}
                      placeholder="Ex: A contratação da plataforma engloba o acesso..."
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Funcionalidades (Uma por linha: Título: Descrição)</Label>
                    <Textarea
                      rows={4}
                      value={form.scope_text}
                      onChange={(e) => setForm({ ...form, scope_text: e.target.value })}
                      placeholder="Ex: Módulo Financeiro: Gestão de contas..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seção 3: Política de Fidelidade */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    Seção 3: Política de Fidelidade
                  </Label>
                  <p className="text-xs text-muted-foreground">Termos de permanência, carência ou rescisão contratual.</p>
                </div>
                <Switch
                  checked={form.show_fidelity}
                  onCheckedChange={(checked) => setForm({ ...form, show_fidelity: checked })}
                />
              </div>

              {form.show_fidelity && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={form.fidelity_title}
                      onChange={(e) => setForm({ ...form, fidelity_title: e.target.value })}
                      placeholder="Ex: Nossa Política de Fidelidade:"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução (Opcional)</Label>
                    <Input
                      value={form.fidelity_subtitle}
                      onChange={(e) => setForm({ ...form, fidelity_subtitle: e.target.value })}
                      placeholder="Subtítulo ou parágrafo introdutório..."
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Conteúdo Padrão</Label>
                    <Textarea
                      rows={2}
                      value={form.fidelity_policy}
                      onChange={(e) => setForm({ ...form, fidelity_policy: e.target.value })}
                      placeholder="Descreva as condições de permanência ou rescisão..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seção 4: Próximos Passos */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    Seção 4: Próximos Passos para Ativação
                  </Label>
                  <p className="text-xs text-muted-foreground">Etapas numeradas após a assinatura da proposta.</p>
                </div>
                <Switch
                  checked={form.show_next_steps}
                  onCheckedChange={(checked) => setForm({ ...form, show_next_steps: checked })}
                />
              </div>

              {form.show_next_steps && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={form.next_steps_title}
                      onChange={(e) => setForm({ ...form, next_steps_title: e.target.value })}
                      placeholder="Ex: Próximos Passos para Ativação"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução (Opcional)</Label>
                    <Input
                      value={form.next_steps_subtitle}
                      onChange={(e) => setForm({ ...form, next_steps_subtitle: e.target.value })}
                      placeholder="Subtítulo ou parágrafo introdutório..."
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Etapas (Uma por linha)</Label>
                    <Textarea
                      rows={3}
                      value={form.next_steps_text}
                      onChange={(e) => setForm({ ...form, next_steps_text: e.target.value })}
                      placeholder="Ex: 1. Aceite digital...\n2. Configuração de conta..."
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Blocos Adicionais Customizados */}
        <Card className="border-border bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                Blocos Adicionais da Proposta (Customizados)
              </CardTitle>
              <CardDescription>
                Adicione seções customizadas ilimitadas específicas para o seu modelo de proposta.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openBlockModal()}
              className="gap-1.5 font-semibold text-xs shrink-0 bg-transparent hover:bg-accent"
            >
              <Plus className="size-4" /> Novo Bloco
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {customBlocks && customBlocks.length > 0 ? (
              <div className="grid gap-3">
                {customBlocks.map((block: any, idx: number) => (
                  <div key={block.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/5">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{block.title}</h4>
                      {block.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{block.subtitle}</p>}
                      <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1 italic">{block.content}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openBlockModal(block)}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteBlock(block.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 border border-dashed border-border rounded-xl">
                <p className="text-xs text-muted-foreground">Nenhum bloco adicional cadastrado.</p>
              </div>
            )}
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

      {/* Dialog para Criar/Editar Bloco Customizado */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? "Editar Bloco Customizado" : "Adicionar Bloco Customizado"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBlock} className="space-y-4 pt-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Título do Bloco</Label>
              <Input
                value={blockForm.title}
                onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })}
                placeholder="Ex: Condições de Entrega & Frete"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Subtítulo / Frase de Introdução (Opcional)</Label>
              <Input
                value={blockForm.subtitle}
                onChange={(e) => setBlockForm({ ...blockForm, subtitle: e.target.value })}
                placeholder="Ex: Os prazos e termos abaixo são aplicáveis a todo o território nacional..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Conteúdo do Bloco</Label>
              <Textarea
                rows={5}
                value={blockForm.content}
                onChange={(e) => setBlockForm({ ...blockForm, content: e.target.value })}
                placeholder="Insira o texto completo do bloco..."
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBlockModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingBlock ? "Salvar Alterações" : "Adicionar Bloco"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Cropper Dialog */}
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        rawImageSrc={rawImageSrc}
        aspectRatio={3}
        title="Ajustar Logotipo da Empresa"
        description="Arraste a imagem e use o zoom para enquadrar a logo (proporção de 3:1)."
        onConfirm={handleConfirmLogoCrop}
      />

      {/* Upload/Save Progress overlay */}
      <UploadProgressOverlay
        open={progressOpen}
        progress={saveProgress}
        statusText={saveStatus}
        title="Salvando Configurações da Empresa"
      />
    </div>
  );
}

/* =========================================================================
   3. ABA CONFIGURAÇÕES (Gestão da Identidade Visual e Informações de Rodapé)
   ========================================================================= */

function PlatformSettingsTab() {
  const [platformName, setPlatformName] = useState("proposify ai");
  const [platformLogo, setPlatformLogo] = useState("");
  const [platformFavicon, setPlatformFavicon] = useState("");

  const [loginTagline, setLoginTagline] = useState("acelere sua geração de propostas");
  const [loginTitle, setLoginTitle] = useState("Olá,");
  const [loginSubtitle, setLoginSubtitle] = useState("Bom ter você de volta");
  const [loginVisualUrl, setLoginVisualUrl] = useState("");
  const [loginVisualType, setLoginVisualType] = useState<"image" | "video">("image");

  const [footerRoadmap, setFooterRoadmap] = useState("");
  const [footerDocs, setFooterDocs] = useState("");
  const [footerSupport, setFooterSupport] = useState("");
  const [footerTerms, setFooterTerms] = useState("");
  const [footerPrivacy, setFooterPrivacy] = useState("");

  // Simulated progress overlay states
  const [progressOpen, setProgressOpen] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");

  // Reusable Image Cropper states
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState("");
  const [cropperAspectRatio, setCropperAspectRatio] = useState(3);
  const [cropperTarget, setCropperTarget] = useState<"logo" | "favicon">("logo");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPlatformName(localStorage.getItem("platform-name") || "proposify ai");
      setPlatformLogo(localStorage.getItem("platform-logo-url") || "");
      setPlatformFavicon(localStorage.getItem("platform-favicon-url") || "");

      setLoginTagline(localStorage.getItem("login-tagline") || "acelere sua geração de propostas");
      setLoginTitle(localStorage.getItem("login-title") || "Olá,");
      setLoginSubtitle(localStorage.getItem("login-subtitle") || "Bom ter você de volta");
      setLoginVisualUrl(localStorage.getItem("login-visual-url") || "");
      setLoginVisualType((localStorage.getItem("login-visual-type") as "image" | "video") || "image");

      setFooterRoadmap(localStorage.getItem("footer-content-roadmap") || "");
      setFooterDocs(localStorage.getItem("footer-content-docs") || "");
      setFooterSupport(localStorage.getItem("footer-content-support") || "");
      setFooterTerms(localStorage.getItem("footer-content-terms") || "");
      setFooterPrivacy(localStorage.getItem("footer-content-privacy") || "");
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, typeSetter?: (type: "image" | "video") => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error("O arquivo excede o limite de tamanho de 15MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
        if (typeSetter) {
          if (file.type.startsWith("video/")) {
            typeSetter("video");
          } else {
            typeSetter("image");
          }
        }
        toast.success("Mídia visual carregada com sucesso!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("O logotipo deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setRawImageSrc(event.target?.result as string);
        setCropperAspectRatio(3); // 3:1
        setCropperTarget("logo");
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        toast.error("O favicon deve ter no máximo 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setRawImageSrc(event.target?.result as string);
        setCropperAspectRatio(1); // 1:1
        setCropperTarget("favicon");
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = (croppedBase64: string) => {
    if (cropperTarget === "logo") {
      setPlatformLogo(croppedBase64);
    } else {
      setPlatformFavicon(croppedBase64);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setProgressOpen(true);
    setSaveProgress(0);
    setSaveStatus("Enviando arquivos...");

    // Simulated progress bar animation (1.6 seconds total)
    const interval = setInterval(() => {
      setSaveProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          try {
            localStorage.setItem("platform-name", platformName.trim());
            localStorage.setItem("platform-logo-url", platformLogo);
            localStorage.setItem("platform-favicon-url", platformFavicon);

            localStorage.setItem("login-tagline", loginTagline.trim());
            localStorage.setItem("login-title", loginTitle.trim());
            localStorage.setItem("login-subtitle", loginSubtitle.trim());
            localStorage.setItem("login-visual-url", loginVisualUrl);
            localStorage.setItem("login-visual-type", loginVisualType);

            localStorage.setItem("footer-content-roadmap", footerRoadmap.trim());
            localStorage.setItem("footer-content-docs", footerDocs.trim());
            localStorage.setItem("footer-content-support", footerSupport.trim());
            localStorage.setItem("footer-content-terms", footerTerms.trim());
            localStorage.setItem("footer-content-privacy", footerPrivacy.trim());

            window.dispatchEvent(new Event("storage"));
            toast.success("Configurações visuais da plataforma salvas com sucesso!");
          } catch (err) {
            toast.error("Erro ao salvar configurações no navegador.");
          } finally {
            setTimeout(() => setProgressOpen(false), 500);
          }
          return 100;
        }

        const next = prev + 5;
        if (next < 30) {
          setSaveStatus("Enviando arquivos...");
        } else if (next < 65) {
          setSaveStatus("Processando e recortando imagens...");
        } else if (next < 90) {
          setSaveStatus("Persistindo configurações...");
        } else {
          setSaveStatus("Concluído!");
        }
        return next;
      });
    }, 80);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card/50 backdrop-blur shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-red-500" />
            Configurações de Identidade Visual e Layout
          </CardTitle>
          <CardDescription>
            Personalize a marca da plataforma, os elementos visuais e de copy da tela de login, e as páginas de informação.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSaveSettings}>
          <CardContent className="space-y-6">
            
            {/* Seção 1: Identidade da Marca */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b border-border pb-1 text-foreground">1. Identidade da Marca</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="platform-name" className="text-xs font-semibold">Nome da Plataforma</Label>
                  <Input
                    id="platform-name"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="Ex: Proposify AI"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Logotipo da Plataforma (Tela de Login)</Label>
                  <div className="flex items-center gap-3">
                    {platformLogo ? (
                      <div className="size-10 rounded border border-border bg-white flex items-center justify-center p-1 overflow-hidden shrink-0">
                        <img src={platformLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="size-10 rounded border border-dashed border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                        Sem Logo
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleLogoFileSelect}
                        className="h-9 text-xs cursor-pointer"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Dimensão ideal: <strong>180x60 pixels</strong> (proporção 3:1) | PNG ou JPG de até 2MB.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Favicon da Plataforma</Label>
                  <div className="flex items-center gap-3">
                    {platformFavicon ? (
                      <div className="size-10 rounded border border-border bg-white flex items-center justify-center p-1 overflow-hidden shrink-0">
                        <img src={platformFavicon} alt="Favicon" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="size-10 rounded border border-dashed border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                        Sem Icon
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <Input
                        type="file"
                        accept="image/x-icon,image/png,image/jpeg"
                        onChange={handleFaviconFileSelect}
                        className="h-9 text-xs cursor-pointer"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Dimensão ideal: <strong>32x32 pixels</strong> (proporção 1:1) | ICO ou PNG de até 500KB.
                  </p>
                </div>
              </div>
            </div>

            {/* Seção 2: Personalização da Tela de Login */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold border-b border-border pb-1 text-foreground">2. Copy e Visual da Tela de Login</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="login-tagline" className="text-xs font-semibold">Slogan Superior (Tagline)</Label>
                  <Input
                    id="login-tagline"
                    value={loginTagline}
                    onChange={(e) => setLoginTagline(e.target.value)}
                    placeholder="Ex: acelere sua geração de propostas"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="login-title" className="text-xs font-semibold">Título de Boas-vindas</Label>
                  <Input
                    id="login-title"
                    value={loginTitle}
                    onChange={(e) => setLoginTitle(e.target.value)}
                    placeholder="Ex: Olá,"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="login-subtitle" className="text-xs font-semibold">Subtítulo de Boas-vindas</Label>
                  <Input
                    id="login-subtitle"
                    value={loginSubtitle}
                    onChange={(e) => setLoginSubtitle(e.target.value)}
                    placeholder="Ex: Bom ter você de volta"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Mídia Visual Lateral (Vídeo MP4 ou Imagem)</Label>
                <div className="flex items-center gap-4">
                  {loginVisualUrl ? (
                    <div className="size-24 rounded border border-border bg-slate-950 flex items-center justify-center p-0.5 overflow-hidden shrink-0 relative">
                      {loginVisualType === "video" ? (
                        <video src={loginVisualUrl} muted className="max-h-full max-w-full object-cover" />
                      ) : (
                        <img src={loginVisualUrl} alt="Visual" className="max-h-full max-w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => { setLoginVisualUrl(""); setLoginVisualType("image"); }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 size-4 flex items-center justify-center hover:bg-red-700"
                        title="Remover mídia"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="size-24 rounded border border-dashed border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0 text-center p-2">
                      Usando card padrão (fallback comercial)
                    </div>
                  )}
                  <div className="flex-1 grid gap-2">
                    <Input
                      type="file"
                      accept="image/*,video/mp4"
                      onChange={(e) => handleFileUpload(e, setLoginVisualUrl, setLoginVisualType)}
                      className="h-9 text-xs cursor-pointer"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Suba uma imagem (.png, .jpg) ou vídeo (.mp4). Vídeos tocarão em loop no painel direito da tela de login.
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Dimensão ideal: <strong>proporção vertical/quadrada (ex: 1080x1080)</strong> | Vídeo: até 15MB, Imagem: até 5MB.
                </p>
              </div>
            </div>

            {/* Seção 3: Informações do Rodapé */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold border-b border-border pb-1 text-foreground">3. Conteúdo Informativo do Rodapé (Telas de Login)</h3>
              <p className="text-xs text-muted-foreground">
                Insira as informações que serão exibidas em modais quando os usuários clicarem nos links do rodapé da tela de login.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="footer-roadmap" className="text-xs font-semibold">Conteúdo: Roadmap</Label>
                  <Textarea
                    id="footer-roadmap"
                    value={footerRoadmap}
                    onChange={(e) => setFooterRoadmap(e.target.value)}
                    placeholder="Quais são as próximas funcionalidades planejadas?"
                    rows={3}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="footer-docs" className="text-xs font-semibold">Conteúdo: Documentação</Label>
                  <Textarea
                    id="footer-docs"
                    value={footerDocs}
                    onChange={(e) => setFooterDocs(e.target.value)}
                    placeholder="Instruções de uso ou links rápidos para guias da plataforma."
                    rows={3}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="footer-support" className="text-xs font-semibold">Conteúdo: Suporte</Label>
                  <Textarea
                    id="footer-support"
                    value={footerSupport}
                    onChange={(e) => setFooterSupport(e.target.value)}
                    placeholder="Instruções de contato suporte comercial ou de atendimento técnico."
                    rows={3}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="footer-terms" className="text-xs font-semibold">Conteúdo: Termos de Uso</Label>
                  <Textarea
                    id="footer-terms"
                    value={footerTerms}
                    onChange={(e) => setFooterTerms(e.target.value)}
                    placeholder="Texto completo dos termos de serviço da plataforma."
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid gap-1.5 max-w-xl">
                <Label htmlFor="footer-privacy" className="text-xs font-semibold">Conteúdo: Aviso de Privacidade</Label>
                <Textarea
                  id="footer-privacy"
                  value={footerPrivacy}
                  onChange={(e) => setFooterPrivacy(e.target.value)}
                  placeholder="Detalhamento sobre o tratamento de dados pessoais (em conformidade com a LGPD)."
                  rows={3}
                />
              </div>
            </div>

          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end gap-2 bg-muted/20">
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/10"
            >
              Salvar Configurações Visuais
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Image Cropper Dialog */}
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        rawImageSrc={rawImageSrc}
        aspectRatio={cropperAspectRatio}
        title={cropperTarget === "logo" ? "Ajustar Logotipo da Plataforma" : "Ajustar Favicon da Plataforma"}
        description={
          cropperTarget === "logo"
            ? "Arraste a imagem e use o zoom para enquadrar a logo (proporção de 3:1)."
            : "Arraste a imagem e use o zoom para enquadrar o favicon (proporção quadrada de 1:1)."
        }
        onConfirm={handleConfirmCrop}
      />

      {/* Upload/Save Progress overlay */}
      <UploadProgressOverlay
        open={progressOpen}
        progress={saveProgress}
        statusText={saveStatus}
        title="Salvando Configurações Visuais"
      />
    </div>
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
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="colaboradores" className="gap-2 text-xs">
            <Users className="size-4" /> Colaboradores
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-2 text-xs">
            <Building2 className="size-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2 text-xs">
            <SlidersHorizontal className="size-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="mt-6">
          <CollaboratorsTab />
        </TabsContent>
        <TabsContent value="empresas" className="mt-6">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="configuracoes" className="mt-6">
          <PlatformSettingsTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

