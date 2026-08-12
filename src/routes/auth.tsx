import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Login — Proposify AI" },
      {
        name: "description",
        content:
          "Plataforma inteligente de propostas comerciais. Acesso restrito para equipe comercial e administração.",
      },
      { property: "og:title", content: "Login — Proposify AI" },
      {
        property: "og:description",
        content: "Acesso comercial: propostas, clientes e catálogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor, preencha seu e-mail e senha");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Credenciais inválidas. Tente novamente.";
      toast.error(errorMsg);
    } finally {
      setBusy(false);
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
        redirectTo: `${window.location.origin}/auth`,
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

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Left Column: Login Form */}
      <div className="flex w-full flex-col justify-between p-6 sm:p-12 lg:w-1/2 lg:p-16 xl:p-20">
        <div>
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                acelere sua geração de propostas
              </p>
              <h2 className="text-xl font-bold tracking-tight text-foreground">proposify ai</h2>
            </div>
          </div>

          {/* Greetings */}
          <div className="mt-12 sm:mt-16">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Olá,
            </h1>
            <p className="mt-1 text-2xl font-normal text-muted-foreground sm:text-3xl">
              Bom ter você de volta
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="mt-8 max-w-md space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Usuário / E-mail:
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-lg border-border bg-card/60 px-4 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Senha:
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-lg border-border bg-card/60 px-4 pr-11 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-12 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              {busy ? "Entrando..." : "Login"}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
              >
                Esqueci a senha
              </button>
            </div>
          </form>
        </div>

        {/* Footer Navigation Links */}
        <footer className="mt-12 pt-6 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer transition-colors">Roadmap</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Documentação</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Suporte</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Termos de Uso</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Aviso de Privacidade</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            © {new Date().getFullYear()} Proposify AI Inc. Acesso restrito a usuários autorizados.
          </p>
        </footer>
      </div>

      {/* Right Column: High-Tech Visual Illustration (SpaceX / Modern AI Aesthetics) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-secondary/40 via-secondary/20 to-background p-12 lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Subtle decorative background grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

        {/* Floating AI Proposal Visual Composition */}
        <div className="relative z-10 w-full max-w-lg space-y-6">
          {/* Main Hero Card */}
          <div className="rounded-2xl border border-border/80 bg-card/80 p-6 shadow-2xl backdrop-blur-xl transition-transform duration-300 hover:scale-[1.01]">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileCheck2 className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Proposta Comercial #PR-2026-08</p>
                  <p className="text-[11px] text-muted-foreground">Quantis Growth • Em negociação</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Aceite Rápido
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <div className="flex items-center gap-2.5">
                  <Zap className="size-4 text-amber-500" />
                  <span className="text-xs font-medium text-foreground">Estratégia de Aquisição & IA</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-foreground">R$ 14.500,00</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="size-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Setup de Infraestrutura Cloud</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-foreground">R$ 4.200,00</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60">
              <span className="text-xs text-muted-foreground">Valor Total Líquido</span>
              <span className="text-lg font-bold tabular-nums text-foreground">R$ 18.700,00</span>
            </div>
          </div>

          {/* Floating Metric Badge */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card/60 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
                <TrendingUp className="size-3.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Taxa Média de Conversão</p>
                <p className="text-[11px] text-muted-foreground">+34% mais rápida com IA</p>
              </div>
            </div>
            <p className="text-xl font-bold tabular-nums text-primary">78.4%</p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal Dialog */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setForgotPasswordOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="size-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Recuperação de Senha</h3>
                <p className="text-xs text-muted-foreground">
                  Enviaremos um link para você redefinir sua senha.
                </p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
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
                    className="h-11 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="rounded-lg text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={resetBusy}
                  className="rounded-lg text-xs"
                >
                  {resetBusy ? "Enviando..." : "Enviar instruções"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
