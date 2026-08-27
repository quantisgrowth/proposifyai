import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  FileText,
  Lock,
  Building2,
  Calendar,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/meus-dados")({
  head: () => ({
    meta: [
      { title: "Meus Dados — Proposify AI" },
      {
        name: "description",
        content: "Gerencie suas informações cadastrais, de segurança e confira as empresas vinculadas.",
      },
    ],
  }),
  component: MeusDadosPage,
});

type ProfileWithExtraFields = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string | null;
  active: boolean;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  cpf?: string | null;
  phone?: string | null;
};

function MeusDadosPage() {
  const { user, profile, accessibleCompanies, refreshProfile } = useAuth();
  const prof = profile as unknown as ProfileWithExtraFields;

  // Personal Info States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  // Password States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status States
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Platform settings states for Admin
  const [platformName, setPlatformName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("platform-name") || "Proposify AI";
    }
    return "Proposify AI";
  });
  const [platformLogo, setPlatformLogo] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("platform-logo-url") || "";
    }
    return "";
  });
  const [savingPlatform, setSavingPlatform] = useState(false);

  const handlePlatformLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPlatformLogo(reader.result as string);
        toast.success("Logo da plataforma carregada!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePlatformSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformName.trim()) {
      toast.error("Nome da plataforma é obrigatório.");
      return;
    }
    setSavingPlatform(true);
    try {
      localStorage.setItem("platform-name", platformName.trim());
      localStorage.setItem("platform-logo-url", platformLogo);
      window.dispatchEvent(new Event("storage"));
      toast.success("Configurações da plataforma atualizadas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações da plataforma.");
    } finally {
      setSavingPlatform(false);
    }
  };

  // Initialize fields
  useEffect(() => {
    if (prof) {
      setFirstName(prof.first_name || prof.full_name?.split(" ")[0] || "");
      setLastName(prof.last_name || prof.full_name?.substring((prof.full_name?.indexOf(" ") ?? -1) + 1) || "");
      setCpf(prof.cpf ? formatCPF(prof.cpf) : "");
      setPhone(prof.phone ? formatPhone(prof.phone) : "");
      setEmail(prof.email || user?.email || "");
    }
  }, [prof, user]);

  // Mask functions
  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, "");
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .substring(0, 14);
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  // CPF digits validation helper
  const validateCPF = (rawCpf: string): boolean => {
    const cleaned = rawCpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return false;
    
    // Check for repetitive digits (e.g. 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Validate digits
    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleaned.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleaned.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

    return true;
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("O campo Nome é obrigatório.");
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf && !validateCPF(cleanCpf)) {
      toast.error("O CPF inserido é inválido.");
      return;
    }

    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          cpf: cleanCpf || null,
          phone: phone.replace(/\D/g, "") || null,
        } as any)
        .eq("id", user!.id);

      if (error) throw error;

      // Update auth user metadata so that on-login triggers don't overwrite it with old values
      await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          cpf: cleanCpf || null,
          phone: phone.replace(/\D/g, "") || null,
        }
      });
      
      toast.success("Dados cadastrais atualizados com sucesso!");
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar informações.");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Senha redefinida com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao redefinir a senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = `${firstName.charAt(0) || ""}${lastName.charAt(0) || ""}`.toUpperCase() || "U";
  const dateFormatted = prof?.created_at
    ? new Date(prof.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Meus Dados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie suas informações cadastrais, de segurança e confira suas permissões na plataforma.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        
        {/* Left Side: Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Personal Info Card */}
          <Card className="border-border shadow-sm bg-card/60 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" />
                Dados Pessoais
              </CardTitle>
              <CardDescription>
                Atualize suas informações básicas de identificação e contato.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveInfo}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="first-name" className="text-xs font-semibold">Nome</Label>
                    <Input
                      id="first-name"
                      placeholder="Ex: Felipe"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="last-name" className="text-xs font-semibold">Sobrenome</Label>
                    <Input
                      id="last-name"
                      placeholder="Ex: Medeiros"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cpf" className="text-xs font-semibold">CPF</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00"
                        className="pl-9"
                        value={cpf}
                        onChange={handleCpfChange}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">Telefone Celular</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="(00) 00000-0000"
                        className="pl-9"
                        value={phone}
                        onChange={handlePhoneChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9 bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed"
                      value={email}
                      disabled
                      title="O email é o identificador de acesso e não pode ser alterado diretamente."
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    O e-mail é utilizado para fazer login e não pode ser alterado por motivos de segurança.
                  </span>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/60 pt-4 flex justify-end">
                <Button type="submit" disabled={savingInfo} className="font-semibold px-6">
                  {savingInfo ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Platform configurations for Platform Admin */}
          {prof?.role === "admin" && (
            <Card className="border-border shadow-sm bg-card/60 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Personalização da Plataforma
                </CardTitle>
                <CardDescription>
                  Personalize a identidade da plataforma (logo e nome exibidos na barra lateral de administração).
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSavePlatformSettings}>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="platform-name" className="text-xs font-semibold">Nome da Plataforma</Label>
                      <Input
                        id="platform-name"
                        placeholder="Ex: Proposify AI"
                        value={platformName}
                        onChange={(e) => setPlatformName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold">Logo da Plataforma</Label>
                      <div className="flex items-center gap-3">
                        {platformLogo ? (
                          <div className="size-10 rounded border border-border bg-white flex items-center justify-center p-1 overflow-hidden shrink-0">
                            <img src={platformLogo} alt="Preview" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <div className="size-10 rounded border border-dashed border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                            Sem Logo
                          </div>
                        )}
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handlePlatformLogoUpload}
                            className="h-8 text-xs cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/60 pt-4 flex justify-end">
                  <Button type="submit" disabled={savingPlatform} className="font-semibold px-6">
                    {savingPlatform ? "Salvando..." : "Salvar Configurações da Plataforma"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* Security / Password Reset Card */}
          <Card className="border-border shadow-sm bg-card/60 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                Redefinição de Senha
              </CardTitle>
              <CardDescription>
                Escolha uma nova senha forte para acessar sua conta com segurança.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdatePassword}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-password" className="text-xs font-semibold">Nova Senha</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        className="pl-9 pr-10"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirm-password" className="text-xs font-semibold">Confirmar Nova Senha</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        className="pl-9 pr-10"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {newPassword && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Certifique-se de usar uma combinação de letras maiúsculas, minúsculas, números e caracteres especiais para maior proteção de sua conta.
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-border/60 pt-4 flex justify-end">
                <Button type="submit" disabled={savingPassword} variant="secondary" className="font-semibold px-6">
                  {savingPassword ? "Alterando..." : "Redefinir Senha"}
                </Button>
              </CardFooter>
            </form>
          </Card>

        </div>

        {/* Right Side: Sidebar Info & Companies */}
        <div className="space-y-6">
          
          {/* User Profile Card Summary */}
          <Card className="border-border shadow-sm bg-gradient-to-br from-primary/5 via-card/90 to-card">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20 text-lg font-bold text-primary shadow-sm">
                {initials}
              </div>
              <h3 className="mt-3 font-semibold text-foreground text-sm">
                {prof?.full_name || "Usuário"}
              </h3>
              <p className="text-xs text-muted-foreground">{email}</p>
              
              <div className="mt-4 flex items-center gap-1">
                <Badge variant={prof?.role === "admin" ? "default" : "secondary"} className="capitalize font-semibold text-[10px] tracking-wide px-2 py-0.5">
                  {prof?.role === "admin" ? (
                    <Shield className="size-3 text-primary-foreground mr-1 inline-block" />
                  ) : null}
                  {prof?.role || "Colaborador"}
                </Badge>
              </div>

              <div className="mt-5 w-full pt-4 border-t border-border/60 space-y-3.5 text-left text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground/80" />
                    Cadastrado em
                  </span>
                  <span className="font-medium text-foreground">{dateFormatted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Status da conta
                  </span>
                  <Badge className="bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 font-semibold border-emerald-500/20 text-[9px] uppercase">
                    Ativo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connected Companies Card */}
          <Card className="border-border shadow-sm bg-card/60 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Empresas Vinculadas
              </CardTitle>
              <CardDescription className="text-[11px]">
                Você tem acesso a {accessibleCompanies.length} empresa(s) vinculadas ao seu perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <div className="divide-y divide-border/60 max-h-[300px] overflow-y-auto px-4">
                {accessibleCompanies.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma empresa vinculada.</p>
                ) : (
                  accessibleCompanies.map((c) => (
                    <div key={c.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground text-xs truncate max-w-[150px]">
                          {c.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-semibold border-primary/20 bg-primary/5 text-primary tracking-wide">
                          {prof?.role === "admin" ? "Admin Master" : "Acesso Permitido"}
                        </Badge>
                      </div>
                      {c.tagline && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {c.tagline}
                        </span>
                      )}
                      {c.document && (
                        <span className="text-[9px] text-muted-foreground/80 font-mono">
                          {c.document}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </AppShell>
  );
}
