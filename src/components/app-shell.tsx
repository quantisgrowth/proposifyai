import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { proposalsQuery } from "@/lib/proposals";
import { brl } from "@/lib/format";

const tabs = [
  { to: "/", label: "Propostas" },
  { to: "/nova", label: "Nova Proposta" },
  { to: "/produtos", label: "Produtos/Serviços" },
  { to: "/clientes", label: "Clientes" },
] as const;

function Metrics() {
  const { data } = useQuery(proposalsQuery);
  const list = data ?? [];
  const sent = list.filter((p) => p.status !== "draft").length;
  const accepted = list.filter((p) => p.status === "accepted").length;
  const conversion = sent ? Math.round((accepted / sent) * 100) : 0;
  const pending = list
    .filter((p) => p.status === "sent")
    .reduce((sum, p) => sum + Number(p.net_amount), 0);

  const items = [
    { label: "Propostas enviadas", value: String(sent) },
    { label: "Taxa de conversão", value: `${conversion}%` },
    { label: "Valor pendente", value: brl(pending) },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-card">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3 sm:px-6 sm:py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-medium tabular-nums sm:text-2xl">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-primary text-[11px] font-semibold text-primary-foreground">
              M
            </span>
            <span className="truncate text-sm font-medium tracking-tight">Meridian Propostas</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                activeOptions={{ exact: tab.to === "/" }}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
              >
                {tab.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Sair
            </button>
          </nav>
        </div>
      </div>
      <div className="no-print mx-auto max-w-6xl border-x border-border">
        <Metrics />
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
