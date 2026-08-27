import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

  // Platform brand custom settings
  const [platformName, setPlatformName] = useState("proposify ai");
  const [platformLogo, setPlatformLogo] = useState("");
  const [loginVisualUrl, setLoginVisualUrl] = useState("");
  const [loginVisualType, setLoginVisualType] = useState<"image" | "video">("image");
  const [loginTagline, setLoginTagline] = useState("acelere sua geração de propostas");
  const [loginTitle, setLoginTitle] = useState("Olá,");
  const [loginSubtitle, setLoginSubtitle] = useState("Bom ter você de volta");

  // Footer modals
  const [footerModalOpen, setFooterModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");

  const loadPlatformSettings = () => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("platform-name");
      const storedLogo = localStorage.getItem("platform-logo-url");
      const storedVisualUrl = localStorage.getItem("login-visual-url");
      const storedVisualType = localStorage.getItem("login-visual-type") as "image" | "video";
      const storedTagline = localStorage.getItem("login-tagline");
      const storedTitle = localStorage.getItem("login-title");
      const storedSubtitle = localStorage.getItem("login-subtitle");

      if (storedName) setPlatformName(storedName);
      if (storedLogo) setPlatformLogo(storedLogo);
      if (storedVisualUrl) setLoginVisualUrl(storedVisualUrl);
      if (storedVisualType) setLoginVisualType(storedVisualType);
      if (storedTagline) setLoginTagline(storedTagline);
      if (storedTitle) setLoginTitle(storedTitle);
      if (storedSubtitle) setLoginSubtitle(storedSubtitle);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });

    loadPlatformSettings();

    // Listen to localStorage changes in real time
    window.addEventListener("storage", loadPlatformSettings);
    return () => {
      window.removeEventListener("storage", loadPlatformSettings);
    };
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

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com a conta do Google.");
    }
  };

  const handleOpenFooterModal = (type: "roadmap" | "docs" | "support" | "terms" | "privacy") => {
    let title = "";
    const contentKey = `footer-content-${type}`;
    let defaultContent = "";

    switch (type) {
      case "roadmap":
        title = "Roadmap da Plataforma";
        defaultContent = "Nosso roadmap está focado em trazer integrações com novos CRMs, automação avançada de propostas e relatórios inteligentes.";
        break;
      case "docs":
        title = "Documentação";
        defaultContent = "Bem-vindo à documentação oficial do Proposify AI. Aqui você encontra guias passo-a-passo sobre como criar e gerenciar suas propostas.";
        break;
      case "support":
        title = "Suporte ao Cliente";
        defaultContent = "Precisa de ajuda? Entre em contato com o nosso time de suporte técnico através do e-mail suporte@empresa.com ou pelo telefone oficial.";
        break;
      case "terms":
        title = "Termos de Uso";
        defaultContent = "Termos de Uso da Plataforma: Ao utilizar nossa plataforma, você concorda com nossos termos de prestação de serviços corporativos.";
        break;
      case "privacy":
        title = "Aviso de Privacidade";
        defaultContent = "Sua privacidade é muito importante para nós. Coletamos e processamos seus dados pessoais com o mais alto nível de segurança e em conformidade com a LGPD.";
        break;
    }

    const storedContent = localStorage.getItem(contentKey);
    setModalTitle(title);
    setModalContent(storedContent || defaultContent);
    setFooterModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-[#070101] text-foreground selection:bg-red-500/20">
      {/* Left Column: Login Form */}
      <div className="flex w-full flex-col justify-between p-6 sm:p-12 lg:w-1/2 lg:p-16 xl:p-20 relative z-10 bg-background/80 backdrop-blur-md">
        
        {/* Soft background glow for left column */}
        <div className="absolute top-1/4 left-1/4 -z-10 size-72 rounded-full bg-red-600/5 blur-[100px]" />
        
        <div>
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            {platformLogo ? (
              <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-border p-1.5 overflow-hidden shadow-md shrink-0">
                <img src={platformLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20 shrink-0">
                <Sparkles className="size-5" />
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500/80">
                {loginTagline}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground uppercase">
                {platformName}
              </h2>
            </div>
          </div>

          {/* Greetings */}
          <div className="mt-12 sm:mt-16">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {loginTitle}
            </h1>
            <p className="mt-1 text-2xl font-light text-muted-foreground sm:text-3xl">
              {loginSubtitle}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="mt-8 max-w-md space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className="h-12 rounded-lg border-border bg-card/60 px-4 text-sm transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className="h-12 rounded-lg border-border bg-card/60 px-4 pr-11 text-sm transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
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
              className="mt-2 h-12 w-full rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-600/25 transition-all duration-300 hover:scale-[1.01] uppercase tracking-wider"
            >
              {busy ? "ENTRANDO..." : "LOGIN"}
            </Button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border/40"></div>
              <span className="mx-3 shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ou</span>
              <div className="flex-grow border-t border-border/40"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              className="w-full h-12 rounded-lg border-border hover:bg-secondary/20 dark:hover:bg-slate-900/50 flex items-center justify-center gap-3 text-sm font-semibold transition-all hover:scale-[1.01]"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 5.92 1 1 5.92 1 12s4.92 11 11.24 11c6.6 0 11-4.65 11-11.19 0-.756-.08-1.333-.178-1.813H12.24z"/>
              </svg>
              Entrar com Google
            </Button>

            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="text-xs font-semibold text-muted-foreground transition-colors hover:text-red-500 hover:underline bg-transparent border-0 cursor-pointer"
              >
                Esqueci a senha
              </button>
              <Link
                to="/admin-login"
                className="text-[11px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground hover:underline"
              >
                É administrador? Acessar Portal Admin →
              </Link>
            </div>
          </form>
        </div>

        {/* Footer Navigation Links */}
        <footer className="mt-12 pt-6 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span
              onClick={() => handleOpenFooterModal("roadmap")}
              className="hover:text-red-500 cursor-pointer transition-colors font-medium"
            >
              Roadmap
            </span>
            <span
              onClick={() => handleOpenFooterModal("docs")}
              className="hover:text-red-500 cursor-pointer transition-colors font-medium"
            >
              Documentação
            </span>
            <span
              onClick={() => handleOpenFooterModal("support")}
              className="hover:text-red-500 cursor-pointer transition-colors font-medium"
            >
              Suporte
            </span>
            <span
              onClick={() => handleOpenFooterModal("terms")}
              className="hover:text-red-500 cursor-pointer transition-colors font-medium"
            >
              Termos de Uso
            </span>
            <span
              onClick={() => handleOpenFooterModal("privacy")}
              className="hover:text-red-500 cursor-pointer transition-colors font-medium"
            >
              Aviso de Privacidade
            </span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            © {new Date().getFullYear()} {platformName}. Acesso restrito a usuários autorizados.
          </p>
        </footer>
      </div>

      {/* Right Column: Dynamic Media / Visual Illustration */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-red-950/20 via-background to-[#0D0404] p-12 lg:flex lg:flex-col lg:items-center lg:justify-center border-l border-border/10">
        
        {/* Visual Media or Default Composition */}
        {loginVisualUrl ? (
          <div className="absolute inset-0 z-0 h-full w-full">
            {loginVisualType === "video" ? (
              <video
                src={loginVisualUrl}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={loginVisualUrl}
                alt="Visual"
                className="h-full w-full object-cover"
              />
            )}
            {/* Elegant red gradient overlay to blend into the interface */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#070101] via-[#070101]/10 to-red-950/20 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070101] via-transparent to-transparent opacity-80" />
          </div>
        ) : (
          <>
            {/* Subtle decorative background grids and red blobs */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(220,38,38,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(220,38,38,0.06)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />
            <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-red-600/10 blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-red-500/5 blur-[120px]" />

            {/* Floating AI Proposal Visual Composition */}
            <div className="relative z-10 w-full max-w-lg space-y-6">
              {/* Main Hero Card */}
              <div className="rounded-2xl border border-red-900/30 bg-card/60 p-6 shadow-2xl backdrop-blur-xl transition-transform duration-300 hover:scale-[1.01]">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                      <FileCheck2 className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Proposta Comercial #PR-2026-08</p>
                      <p className="text-[11px] text-muted-foreground">Quantis Growth • Em negociação</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-red-500">
                    Aceite Rápido
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-3 border border-border/10">
                    <div className="flex items-center gap-2.5">
                      <Zap className="size-4 text-red-500" />
                      <span className="text-xs font-medium text-foreground">Estratégia de Aquisição & IA</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-foreground">R$ 14.500,00</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-3 border border-border/10">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="size-4 text-red-500" />
                      <span className="text-xs font-medium text-foreground">Setup de Infraestrutura Cloud</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-foreground">R$ 4.200,00</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">Valor Total Líquido</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">R$ 18.700,00</span>
                </div>
              </div>

              {/* Floating Metric Badge */}
              <div className="flex items-center justify-between rounded-xl border border-red-900/30 bg-card/40 p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                    <TrendingUp className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Taxa Média de Conversão</p>
                    <p className="text-[11px] text-muted-foreground">+34% mais rápida com IA</p>
                  </div>
                </div>
                <p className="text-xl font-bold tabular-nums text-red-500">78.4%</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Forgot Password Modal Dialog */}
      {forgotPasswordOpen && (
        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
          <DialogContent className="sm:max-w-md bg-card/95 border-red-900/30 backdrop-blur">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <Lock className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">Recuperação de Senha</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Enviaremos um link para você redefinir sua senha.
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
                    className="h-11 rounded-lg focus:border-red-500 focus:ring-red-500/20"
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
                  className="rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white shadow shadow-red-600/20"
                >
                  {resetBusy ? "Enviando..." : "Enviar instruções"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Footer Info Modal Dialog */}
      {footerModalOpen && (
        <Dialog open={footerModalOpen} onOpenChange={setFooterModalOpen}>
          <DialogContent className="sm:max-w-lg bg-card/95 border-red-900/30 backdrop-blur max-h-[85vh] overflow-y-auto">
            <DialogHeader className="border-b border-border/40 pb-3">
              <DialogTitle className="text-lg font-bold text-foreground">{modalTitle}</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {modalContent}
            </div>
            <div className="flex justify-end pt-2 border-t border-border/40">
              <Button
                type="button"
                onClick={() => setFooterModalOpen(false)}
                className="rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
