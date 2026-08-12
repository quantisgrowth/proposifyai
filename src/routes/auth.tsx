import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Proposify AI — Propostas Comerciais" },
      {
        name: "description",
        content:
          "Acesso restrito da equipe comercial Proposify AI para criar e gerenciar propostas, clientes e catálogo.",
      },
      { property: "og:title", content: "Entrar — Proposify AI" },
      {
        property: "og:description",
        content: "Área da equipe comercial: propostas, clientes e catálogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se necessário.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Proposify AI</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Área da equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre para acessar propostas, clientes e catálogo.
        </p>

        <div className="mt-6 space-y-3">
          <div className="grid gap-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={busy} onClick={submit}>
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Já tenho conta" : "Criar uma conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
