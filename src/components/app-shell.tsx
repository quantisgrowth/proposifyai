import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  FileText,
  PlusCircle,
  Package,
  Users,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Building2,
  Shield,
  UserCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { proposalsQuery } from "@/lib/proposals";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const allNavItems = [
  { to: "/", label: "Propostas", icon: FileText, exact: true, adminOnly: false },
  { to: "/nova", label: "Nova Proposta", icon: PlusCircle, highlight: true, adminOnly: false },
  { to: "/produtos", label: "Produtos / Serviços", icon: Package, adminOnly: false },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: false },
  { to: "/admin", label: "Admin & Configurações", icon: SlidersHorizontal, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, company, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Filtrar itens de navegação (apenas admins vêem a aba de admin)
  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  const { data: proposalsData } = useQuery(proposalsQuery(profile?.company_id));
  const list = proposalsData ?? [];
  const sent = list.filter((p) => p.status !== "draft").length;
  const accepted = list.filter((p) => p.status === "accepted").length;
  const conversion = sent ? Math.round((accepted / sent) * 100) : 0;
  const pending = list
    .filter((p) => p.status === "sent")
    .reduce((sum, p) => sum + Number(p.net_amount), 0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const companyDisplayName = company?.name || "Proposify AI";

  const SidebarContent = () => (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between pb-5 pt-1">
          <Link to="/" className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-md transition-transform duration-200 group-hover:scale-105">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold tracking-tight text-foreground">{companyDisplayName}</span>
                {isAdmin ? (
                  <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                    Admin
                  </span>
                ) : (
                  <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                    Comercial
                  </span>
                )}
              </div>
              <span className="truncate text-[11px] text-muted-foreground">
                {company?.tagline || "Sistema de Propostas Comerciais"}
              </span>
            </div>
          </Link>
          <button
            type="button"
            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1 pt-2">
          <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            Menu
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.to : pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : item.highlight
                      ? "bg-primary/5 text-foreground hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`size-4 transition-colors ${
                        isActive
                          ? "text-primary-foreground"
                          : item.highlight
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="size-3.5 opacity-80" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick Performance Metrics in Sidebar */}
        <div className="mt-6 space-y-2 rounded-xl border border-border/80 bg-card/60 p-3.5 backdrop-blur-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Pipeline ({companyDisplayName})
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg bg-secondary/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="size-3 text-emerald-500" />
                <span>Conversão</span>
              </div>
              <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{conversion}%</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock className="size-3 text-amber-500" />
                <span>Enviadas</span>
              </div>
              <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{sent}</p>
            </div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <TrendingUp className="size-3 text-sky-500" />
              <span>Valor em Negociação</span>
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{brl(pending)}</p>
          </div>
        </div>
      </div>

      {/* Footer Profile & Logout */}
      <div className="border-t border-border/80 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {profile?.full_name || user?.email?.split("@")[0] || "Usuário"}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isAdmin ? <Shield className="size-2.5 text-amber-500" /> : <UserCheck className="size-2.5 text-primary" />}
                <span className="capitalize">{profile?.role || "Colaborador"}</span>
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSignOut}
            title="Sair da conta"
            className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile Topbar */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-3.5" />
          </div>
          <span className="font-semibold text-sm tracking-tight">{companyDisplayName}</span>
        </Link>
        <Button size="icon" variant="ghost" onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-72 max-w-[85vw] flex-1 flex-col border-r border-border bg-card shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Split View: Left Sidebar + Right Content */}
      <div className="flex min-h-screen">
        {/* Desktop Fixed Sidebar */}
        <aside className="no-print hidden w-64 shrink-0 border-r border-border bg-card/40 backdrop-blur-xl md:block lg:w-72">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarContent />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
