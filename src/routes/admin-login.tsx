import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, ArrowRight, Eye, EyeOff, Building2, Users2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Portal do Administrador — Proposify AI" },
      {
        name: "description",
        content: "Acesso restrito para gestão corporativa, colaboradores e empresas.",
      },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  // Platform brand custom settings
  const [platformName, setPlatformName] = useState("Proposify AI");
  const [platformLogo, setPlatformLogo] = useState("");

  const loadPlatformSettings = () => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("platform-name");
      const storedLogo = localStorage.getItem("platform-logo-url");

      if (storedName) setPlatformName(storedName);
      if (storedLogo) setPlatformLogo(storedLogo);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Informe seu e-mail para receber as instruções.");
      return;
    }

    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/admin-login`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setForgotPasswordOpen(false);
      setResetEmail("");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação.";
      toast.error(errorMsg);
    } finally {
      setResetBusy(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        // Verificar se é admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          navigate({ to: "/admin" });
        } else {
          navigate({ to: "/" });
        }
      }
    });

    loadPlatformSettings();

    // Listen to localStorage changes in real time
    window.addEventListener("storage", loadPlatformSettings);
    return () => {
      window.removeEventListener("storage", loadPlatformSettings);
    };
  }, [navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Informe suas credenciais de administrador.");
      return;
    }

    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      if (authData.user) {
        // Verificar perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile && profile.role !== "admin") {
          toast.error("Esta conta não possui privilégios de Administrador. Redirecionando para a área comercial...");
          setTimeout(() => navigate({ to: "/" }), 1500);
          return;
        }

        toast.success("Autenticado como Administrador!");
        navigate({ to: "/admin" });
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erro ao acessar o portal administrativo.";
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070101] px-4 text-foreground selection:bg-red-500/20">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="size-[500px] rounded-full bg-red-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/5 bg-[#0E0707]/90 p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
        {/* Header Badge */}
        <div className="flex items-center justify-between pb-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            {platformLogo ? (
              <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-white/10 p-1.5 overflow-hidden shadow-lg shrink-0">
                <img src={platformLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shrink-0">
                <ShieldCheck className="size-5" />
              </div>
            )}
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white uppercase">Portal Admin</h1>
              <p className="text-[11px] font-semibold text-red-500">{platformName} Enterprise</p>
            </div>
          </div>
          <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500">
            Restrito
          </span>
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            Acesso exclusivo para administradores e gestores da plataforma.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              E-mail do Administrador
            </Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@empresa.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border-white/5 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/30 focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Senha de Acesso
            </Label>
            <div className="relative flex items-center">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-lg border-white/5 bg-white/5 px-3.5 pr-10 text-sm text-white placeholder:text-white/30 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-muted-foreground transition-colors hover:text-white focus:outline-none"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="mt-2 h-11 w-full rounded-lg bg-red-600 hover:bg-red-700 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition-all duration-300 hover:scale-[1.01] uppercase tracking-wider"
          >
            {busy ? "VALIDANDO CREDENCIAIS..." : "ENTRAR NO PAINEL ADMIN"}
          </Button>

          <div className="pt-2 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setForgotPasswordOpen(true)}
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-red-500 hover:underline bg-transparent border-0 cursor-pointer"
            >
              Esqueci a senha
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-white/5 pt-4 text-center">
          <Link
            to="/auth"
            className="text-xs text-muted-foreground transition-colors hover:text-white hover:underline"
          >
            ← Voltar para o Login do Colaborador
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal Dialog */}
      {forgotPasswordOpen && (
        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
          <DialogContent className="sm:max-w-md bg-card/95 border-red-900/30 backdrop-blur text-white">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <Lock className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white">Recuperação de Senha</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Enviaremos um link para você redefinir sua senha de acesso.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleResetPassword} className="mt-2 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">
                  Seu e-mail cadastrado:
                </Label>
                <div className="relative">
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="nome@empresa.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="h-11 rounded-lg border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="rounded-lg text-xs border-white/10 bg-transparent text-white hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={resetBusy}
                  className="rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white shadow shadow-red-600/20"
                >
                  {resetBusy ? "Enviando..." : "Enviar instruções"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
