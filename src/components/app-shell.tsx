import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, type ReactNode } from "react";
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
  ChevronLeft,
  Sparkles,
  Shield,
  UserCheck,
  LayoutGrid,
  Cpu,
  User,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { proposalsQuery } from "@/lib/proposals";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavItem = {
  to: string;
  label: string;
  icon: typeof FileText;
  exact?: boolean;
  highlight?: boolean;
  adminOnly: boolean;
};

const allNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, adminOnly: false },
  { to: "/propostas", label: "Propostas", icon: FileText, adminOnly: false },
  { to: "/nova", label: "Nova Proposta", icon: PlusCircle, highlight: true, adminOnly: false },
  { to: "/produtos", label: "Catálogo de Produtos", icon: Package, adminOnly: false },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: false },
  { to: "/automacoes", label: "Automações", icon: Cpu, adminOnly: true },
  { to: "/admin", label: "Admin & Configurações", icon: SlidersHorizontal, adminOnly: true },
];


export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Hydrate collapsed state from localStorage client-side
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const { user, profile, company, isAdmin, isGestor, activeCompanyId, accessibleCompanies, setActiveCompany } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });

  // Dynamically filter navigation items based on user roles
  const navItems = useMemo<
    Array<{
      to: string;
      label: string;
      icon: typeof LayoutGrid;
      highlight?: boolean;
      exact?: boolean;
    }>
  >(() => {
    if (isAdmin) {
      return [
        { to: "/dashboard", label: "Dashboard da Plataforma", icon: LayoutGrid },
        { to: "/clientes", label: "Clientes da Plataforma", icon: Users },
        { to: "/admin", label: "Admin & Configurações", icon: SlidersHorizontal },
        { to: "/meus-dados", label: "Meus Dados", icon: User },
      ];
    }
    
    const items = [
      { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { to: "/propostas", label: "Propostas", icon: FileText },
      { to: "/nova", label: "Nova Proposta", icon: PlusCircle, highlight: true },
      { to: "/produtos", label: "Catálogo de Produtos", icon: Package },
      { to: "/clientes", label: "Clientes", icon: Users },
    ];
    
    if (isGestor) {
      items.push(
        { to: "/automacoes", label: "Automações", icon: Cpu },
        { to: "/admin", label: "Minha Equipe", icon: SlidersHorizontal }
      );
    }
    
    items.push({ to: "/meus-dados", label: "Meus Dados", icon: User });
    
    return items;
  }, [isAdmin, isGestor]);

  const { data: proposalsData } = useQuery(proposalsQuery(activeCompanyId));
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

  // Load platform settings from localStorage for platform admins
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

  // Listen to storage changes to keep it in sync
  useEffect(() => {
    const handleStorage = () => {
      setPlatformName(localStorage.getItem("platform-name") || "Proposify AI");
      setPlatformLogo(localStorage.getItem("platform-logo-url") || "");
    };
    window.addEventListener("storage", handleStorage);
    // Also poll/sync locally on pathname change
    handleStorage();
    return () => window.removeEventListener("storage", handleStorage);
  }, [pathname]);

  const companyDisplayName = isAdmin ? platformName : company?.name || "Proposify AI";
  const companyLogo = isAdmin ? platformLogo : company?.logo_url;

  const SidebarContent = () => (
    <div className={`flex h-full flex-col justify-between ${sidebarCollapsed ? "p-3" : "p-4 sm:p-5"}`}>
      {/* Brand Header */}
      <div>
        <div className="flex flex-col pb-5 pt-1 relative">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className={`group flex ${sidebarCollapsed ? "justify-center w-full" : "flex-col items-start w-full"}`}
              onClick={() => setMobileOpen(false)}
            >
              {sidebarCollapsed ? (
                // Collapsed logo: small compact square
                companyLogo ? (
                  <img
                    src={companyLogo}
                    alt={companyDisplayName}
                    className="size-9 object-contain rounded bg-white p-0.5 shadow-sm border border-border/40"
                  />
                ) : (
                  <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-md shrink-0">
                    <Sparkles className="size-4 text-primary-foreground" />
                  </div>
                )
              ) : (
                // Expanded logo: full width top-aligned
                <div className="w-full flex flex-col items-start">
                  <div className="w-full h-16 bg-white/95 dark:bg-slate-900/80 rounded-xl p-2.5 border border-border/45 flex items-center justify-center overflow-hidden shadow-sm transition-all duration-350 hover:border-primary/20">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={companyDisplayName}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="relative flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-sm">
                        <Sparkles className="size-4.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Company Name below logo */}
                  <div className="mt-4 flex flex-col min-w-0 w-full text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm leading-tight tracking-tight text-foreground truncate max-w-[170px]">
                        {companyDisplayName}
                      </span>
                      {isAdmin ? (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-500 shrink-0">
                          Admin
                        </span>
                      ) : (
                        <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary shrink-0">
                          Comercial
                        </span>
                      )}
                    </div>
                    {/* Slogan below name */}
                    <span className="text-[10px] text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                      {company?.tagline || "Sistema de Propostas Comerciais"}
                    </span>
                  </div>
                </div>
              )}
            </Link>
            
            {/* Mobile close button */}
            <button
              type="button"
              className="md:hidden absolute right-0 top-0 p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Company Selector dropdown */}
        {!sidebarCollapsed && !isAdmin && accessibleCompanies.length > 1 && (
          <div className="mb-4 px-1">
            <Label className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
              Empresa Ativa
            </Label>
            <Select value={activeCompanyId || ""} onValueChange={setActiveCompany}>
              <SelectTrigger className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {accessibleCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation Section */}
        <div className={`space-y-1 ${sidebarCollapsed ? "pt-1" : "pt-4"}`}>
          {!sidebarCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
              Menu
            </p>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.to : pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 overflow-hidden ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                      : item.highlight
                      ? "bg-primary/5 text-foreground hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {/* Hover indicator accent line */}
                  {!isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 group-hover:h-5 bg-primary rounded-r-full transition-all duration-250 opacity-0 group-hover:opacity-100" />
                  )}
                  
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`size-4 transition-all duration-200 shrink-0 ${
                        isActive
                          ? "text-primary-foreground"
                          : item.highlight
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">{item.label}</span>
                    )}
                  </div>
                  {!sidebarCollapsed && isActive && <ChevronRight className="size-3.5 opacity-80" />}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Profile & Logout */}
      <div className="border-t border-border/80 pt-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/meus-dados"
            className={`flex min-w-0 items-center hover:opacity-85 transition-all duration-200 ${sidebarCollapsed ? "justify-center w-full" : "gap-2.5"}`}
            title="Ver meus dados"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary hover:ring-2 hover:ring-primary/20 transition-all duration-200">
              {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {profile?.full_name || user?.email?.split("@")[0] || "Usuário"}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {isAdmin ? <Shield className="size-2.5 text-amber-500" /> : <UserCheck className="size-2.5 text-primary" />}
                  <span className="capitalize">{profile?.role || "Colaborador"}</span>
                </div>
              </div>
            )}
          </Link>
          {!sidebarCollapsed && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSignOut}
              title="Sair da conta"
              className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Top Loading Progress Bar */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-indigo-500 to-accent z-50 overflow-hidden">
          <div className="h-full w-full bg-primary-foreground/30 animate-loading-bar" />
        </div>
      )}

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
      <div className="flex min-h-screen relative">
        {/* Desktop Fixed Sidebar */}
        <aside
          className={`no-print relative hidden shrink-0 border-r border-border bg-card/40 backdrop-blur-xl md:block transition-all duration-300 ${
            sidebarCollapsed ? "w-20" : "w-64 lg:w-72"
          }`}
        >
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarContent />
          </div>

          {/* Toggle Sidebar Button for Desktop */}
          <button
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              localStorage.setItem("sidebar-collapsed", String(next));
              setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
            }}
            className="no-print hidden md:flex absolute -right-3 top-6 z-40 size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground hover:scale-105 transition-all cursor-pointer"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronLeft className="size-3.5" />
            )}
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div 
            key={pathname}
            className={`mx-auto animate-fade-in-up transition-all duration-200 ${wide ? "max-w-full" : "max-w-6xl"}`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
