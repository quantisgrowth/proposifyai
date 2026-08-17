import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, ArrowRight, Eye, EyeOff, Building2, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="flex min-h-screen items-center justify-center bg-[#07090E] px-4 text-foreground selection:bg-primary/20">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="size-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0E1118]/90 p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
        {/* Header Badge */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">Portal Admin</h1>
              <p className="text-[11px] text-muted-foreground">Proposify AI Enterprise</p>
            </div>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
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
            <Label htmlFor="admin-email" className="text-xs font-medium text-muted-foreground">
              E-mail do Administrador
            </Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@empresa.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/30 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">
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
                className="h-11 rounded-lg border-white/10 bg-white/5 px-3.5 pr-10 text-sm text-white placeholder:text-white/30 focus:border-primary focus:ring-1 focus:ring-primary"
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
            className="mt-2 h-11 w-full rounded-lg bg-zinc-800 text-sm font-bold text-white shadow-md transition-all hover:bg-zinc-900 uppercase tracking-wider"
          >
            {busy ? "VALIDANDO CREDENCIAIS..." : "ENTRAR NO PAINEL ADMIN"}
          </Button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-4 text-center">
          <Link
            to="/auth"
            className="text-xs text-muted-foreground transition-colors hover:text-white hover:underline"
          >
            ← Voltar para o Login do Colaborador
          </Link>
        </div>
      </div>
    </div>
  );
}
