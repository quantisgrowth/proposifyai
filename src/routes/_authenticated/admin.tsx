import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { formatDocument } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  type Company,
  type Profile,
  type UserRole,
} from "@/lib/proposals";

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

            {/* Seção 3: Rodapé e Textos Padrão da Proposta */}
            <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-3">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Rodapé e Textos da Proposta Comercial
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

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Nome da Solução Comercial Padrão</Label>
                <Input
                  value={form.solution_name}
                  onChange={(e) => setForm({ ...form, solution_name: e.target.value })}
                  placeholder="Ex: Frotlog - Plataforma SaaS de Gestão e Pagamento de Despesas em Rota"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Objetivo e Proposta de Valor Padrão</Label>
                <Textarea
                  rows={3}
                  value={form.objective_text}
                  onChange={(e) => setForm({ ...form, objective_text: e.target.value })}
                  placeholder="A presente proposta tem como objetivo apresentar as condições comerciais..."
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Funcionalidades e Escopo Padrão (Uma por linha no formato: Título: Descrição)
                </Label>
                <Textarea
                  rows={4}
                  value={form.scope_text}
                  onChange={(e) => setForm({ ...form, scope_text: e.target.value })}
                  placeholder={`Aplicativo para Motoristas & Gestores: Registro imediato de operações...\nPainel de Gestão: Acompanhamento em tempo real...`}
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Política de Fidelidade Padrão</Label>
                <Textarea
                  rows={2}
                  value={form.fidelity_policy}
                  onChange={(e) => setForm({ ...form, fidelity_policy: e.target.value })}
                  placeholder="A nossa única fidelidade é a sua satisfação com a nossa ferramenta..."
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Próximos Passos para Ativação Padrão</Label>
                <Textarea
                  rows={3}
                  value={form.next_steps_text}
                  onChange={(e) => setForm({ ...form, next_steps_text: e.target.value })}
                  placeholder="1. Validação e aceite...\n2. Reunião de alinhamento..."
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
                setIsDragging(true);
                setDragStart({ x: touch.clientX - cropOffset.x, y: touch.clientY - cropOffset.y });
              }}
              onTouchMove={(e) => {
                if (!isDragging) return;
                const touch = e.touches[0];
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

function AdminPage() {
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

