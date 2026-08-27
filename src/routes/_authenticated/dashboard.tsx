import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  FileText,
  Building2,
  Calendar,
  ChevronRight,
  TrendingDown,
  Percent,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { proposalsQuery, companiesQuery, profilesQuery, type Proposal } from "@/lib/proposals";
import { brl, shortDate, statusLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Proposify AI" },
      {
        name: "description",
        content: "Indicadores visuais de conversão, propostas enviadas e receita comercial.",
      },
    ],
  }),
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "oklch(0.65 0.015 260)",     // Slate/Muted
  sent: "oklch(0.6 0.22 255)",        // Electric Blue
  accepted: "oklch(0.62 0.16 140)",    // Emerald Green
  rejected: "oklch(0.55 0.22 25)",     // Red
  expired: "oklch(0.75 0.15 85)",      // Amber/Gold
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
};

function DashboardPage() {
  const { profile, company, isAdmin, activeCompanyId } = useAuth();
  const { data: companies } = useQuery(companiesQuery);
  const { data: profiles } = useQuery(profilesQuery);
  const { data: proposals, isLoading } = useQuery(proposalsQuery(isAdmin ? null : activeCompanyId));

  const list = useMemo(() => proposals ?? [], [proposals]);

  // Platform billing history states
  const [billingSearch, setBillingSearch] = useState("");
  const [billingStatusFilter, setBillingStatusFilter] = useState<"all" | "paid" | "pending" | "unpaid">("all");
  const [billingCompanyFilter, setBillingCompanyFilter] = useState("all");

  const billingHistory = useMemo(() => {
    if (!companies) return [];
    
    // We generate 3 billing cycles for each company
    const cycles = [
      { month: "Setembro/2026", dueDate: "2026-09-10" },
      { month: "Agosto/2026", dueDate: "2026-08-10" },
      { month: "Julho/2026", dueDate: "2026-07-10" },
    ];
    
    const history: any[] = [];
    
    companies.forEach((comp) => {
      // Find collabs count for this company to get plan price
      const collabsCount = (profiles ?? []).filter((p) => p.company_id === comp.id).length;
      let planPrice = 299;
      let planName = "Básico";
      if (collabsCount > 5) {
        planName = "Enterprise";
        planPrice = 1199;
      } else if (collabsCount >= 3) {
        planName = "Pro";
        planPrice = 599;
      }
      
      cycles.forEach((cycle, idx) => {
        let status: "paid" | "pending" | "unpaid" = "paid";
        let paymentMethod: string | null = "Pix";
        let paidAt: string | null = cycle.dueDate;
        
        // Let's vary the status for realistic demonstration
        if (cycle.month === "Setembro/2026") {
          if (comp.name.toLowerCase().includes("achemaq")) {
            status = "pending";
            paymentMethod = null;
            paidAt = null;
          } else if (comp.name.toLowerCase().includes("quantis")) {
            status = "unpaid";
            paymentMethod = null;
            paidAt = null;
          }
        }
        
        if (idx === 1) paymentMethod = "Boleto";
        if (idx === 2) paymentMethod = "Cartão de Crédito";
        
        history.push({
          id: `${comp.id}-${cycle.month}`,
          companyId: comp.id,
          companyName: comp.name,
          month: cycle.month,
          planName,
          amount: planPrice,
          dueDate: cycle.dueDate,
          status,
          paymentMethod,
          paidAt,
        });
      });
    });
    
    // Sort by due date descending
    return history.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [companies, profiles]);

  const filteredBillingHistory = useMemo(() => {
    return billingHistory.filter((item) => {
      const matchesSearch = item.companyName.toLowerCase().includes(billingSearch.toLowerCase());
      const matchesStatus = billingStatusFilter === "all" || item.status === billingStatusFilter;
      const matchesCompany = billingCompanyFilter === "all" || item.companyId === billingCompanyFilter;
      return matchesSearch && matchesStatus && matchesCompany;
    });
  }, [billingHistory, billingSearch, billingStatusFilter, billingCompanyFilter]);

  const saasStats = useMemo(() => {
    if (!isAdmin) return null;
    const comps = companies ?? [];
    const profs = profiles ?? [];
    const props = proposals ?? [];

    let totalMrr = 0;
    const companyPlans = comps.map((c) => {
      const collabsCount = profs.filter((p) => p.company_id === c.id).length;
      let planName = "Básico";
      let planPrice = 299;
      if (collabsCount > 5) {
        planName = "Enterprise";
        planPrice = 1199;
      } else if (collabsCount >= 3) {
        planName = "Pro";
        planPrice = 599;
      }
      totalMrr += planPrice;
      return {
        id: c.id,
        name: c.name,
        collabsCount,
        planName,
        planPrice,
      };
    });

    const averageArpu = comps.length ? totalMrr / comps.length : 0;
    const estimatedLtv = averageArpu * 12;

    const totalProposalAmount = props.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
    const acceptedProps = props.filter((p) => p.status === "accepted");
    const totalAcceptedAmount = acceptedProps.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);

    const monthlyCompsGrowth = [
      { name: "Jan", empresas: Math.max(1, Math.round(comps.length * 0.4)), mrr: Math.max(299, Math.round(totalMrr * 0.4)) },
      { name: "Fev", empresas: Math.max(1, Math.round(comps.length * 0.5)), mrr: Math.max(299, Math.round(totalMrr * 0.5)) },
      { name: "Mar", empresas: Math.max(1, Math.round(comps.length * 0.65)), mrr: Math.max(299, Math.round(totalMrr * 0.65)) },
      { name: "Abr", empresas: Math.max(1, Math.round(comps.length * 0.8)), mrr: Math.max(299, Math.round(totalMrr * 0.8)) },
      { name: "Mai", empresas: comps.length, mrr: totalMrr },
    ];

    return {
      totalMrr,
      averageArpu,
      estimatedLtv,
      totalProposalAmount,
      totalAcceptedAmount,
      companyPlans,
      monthlyCompsGrowth,
      acceptedCount: acceptedProps.length,
    };
  }, [companies, profiles, proposals, isAdmin]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const totalCount = list.length;
    const draftCount = list.filter((p) => p.status === "draft").length;
    const sentCount = list.filter((p) => p.status === "sent").length;
    const acceptedCount = list.filter((p) => p.status === "accepted").length;
    const rejectedCount = list.filter((p) => p.status === "rejected").length;
    const expiredCount = list.filter((p) => p.status === "expired").length;

    // Total de propostas finalizadas ou em andamento (excluindo rascunhos para cálculo de conversão)
    const evaluatedCount = sentCount + acceptedCount + rejectedCount + expiredCount;
    const conversionRate = evaluatedCount > 0 ? Math.round((acceptedCount / evaluatedCount) * 100) : 0;

    // Valores
    const pendingValue = list
      .filter((p) => p.status === "sent")
      .reduce((sum, p) => sum + Number(p.net_amount), 0);

    const wonValue = list
      .filter((p) => p.status === "accepted")
      .reduce((sum, p) => sum + Number(p.net_amount), 0);

    return {
      totalCount,
      draftCount,
      sentCount,
      acceptedCount,
      rejectedCount,
      expiredCount,
      conversionRate,
      pendingValue,
      wonValue,
    };
  }, [list]);

  // Dados para o gráfico de pizza (Distribuição de status)
  const pieData = useMemo(() => {
    return [
      { name: "Rascunho", value: stats.draftCount, key: "draft" },
      { name: "Enviada", value: stats.sentCount, key: "sent" },
      { name: "Aceita", value: stats.acceptedCount, key: "accepted" },
      { name: "Recusada", value: stats.rejectedCount, key: "rejected" },
      { name: "Expirada", value: stats.expiredCount, key: "expired" },
    ].filter((item) => item.value > 0);
  }, [stats]);

  // Dados para o gráfico de linha/área (Evolução de ganhos por data)
  const areaData = useMemo(() => {
    // Agrupa e ordena propostas aceitas por data de criação
    const acceptedProposals = list
      .filter((p) => p.status === "accepted" && p.created_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let accumValue = 0;
    return acceptedProposals.map((p) => {
      accumValue += Number(p.net_amount);
      return {
        date: shortDate(p.created_at),
        valor: Number(p.net_amount),
        acumulado: accumValue,
        cliente: p.clients?.name || "Cliente",
      };
    });
  }, [list]);

  // As 5 últimas propostas criadas
  const recentProposals = useMemo(() => {
    return [...list]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [list]);

  if (isAdmin && saasStats) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Dashboard de Clientes da Plataforma
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe a receita recorrente (MRR), usuários cadastrados e desempenho financeiro SaaS do Proposify AI.
            </p>
          </div>

          {/* Cards de Indicadores do SaaS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                MRR (Mensal Recorrente)
              </p>
              <p className="mt-2 text-2xl font-bold text-primary tabular-nums">
                {brl(saasStats.totalMrr)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Faturamento recorrente mensal
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Empresas Assinantes
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                {companies?.length || 0}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Empresas ativas cadastradas
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ARPU (Receita Média por Conta)
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                {brl(saasStats.averageArpu)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ticket médio mensal por empresa
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Propostas Ganhas (Geral)
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 tabular-nums">
                {saasStats.acceptedCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Total acumulado de propostas aceitas
              </p>
            </div>
          </div>

          {/* Gráfico de Crescimento do SaaS */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-foreground mb-4">Crescimento de Receita (MRR) & Assinaturas</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={saasStats.monthlyCompsGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="name" stroke="currentColor" className="text-[10px] text-muted-foreground" />
                    <YAxis stroke="currentColor" className="text-[10px] text-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area type="monotone" dataKey="mrr" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorMrr)" name="MRR (R$)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribuição por Planos */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-2">Empresas por Planos</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribuição com base em colaboradores.</p>
              <div className="space-y-4">
                {saasStats.companyPlans.map((plan, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{plan.name}</p>
                      <p className="text-[10px] text-muted-foreground">{plan.collabsCount} colaboradores</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                        {plan.planName}
                      </span>
                      <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{brl(plan.planPrice)}/mês</p>
                    </div>
                  </div>
                ))}
                {saasStats.companyPlans.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-10">Nenhuma empresa ativa cadastrada.</p>
                )}
              </div>
            </div>
          </div>

          {/* Histórico de Pagamentos / Cobranças do SaaS */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" /> Histórico de Cobranças das Assinaturas
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lista completa de faturas mensais emitidas para os clientes da plataforma.
                </p>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    className="pl-8 h-8 text-xs w-full"
                    value={billingSearch}
                    onChange={(e) => setBillingSearch(e.target.value)}
                  />
                </div>

                {/* Status Filter */}
                <Select value={billingStatusFilter} onValueChange={(val: any) => setBillingStatusFilter(val)}>
                  <SelectTrigger className="h-8 text-xs w-28 bg-transparent">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todos</SelectItem>
                    <SelectItem value="paid" className="text-xs">Pagos</SelectItem>
                    <SelectItem value="pending" className="text-xs">Pendentes</SelectItem>
                    <SelectItem value="unpaid" className="text-xs">Vencidos</SelectItem>
                  </SelectContent>
                </Select>

                {/* Company Filter */}
                <Select value={billingCompanyFilter} onValueChange={setBillingCompanyFilter}>
                  <SelectTrigger className="h-8 text-xs w-36 bg-transparent">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas Empresas</SelectItem>
                    {(companies ?? []).map((comp) => (
                      <SelectItem key={comp.id} value={comp.id} className="text-xs">
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Invoices List / Table */}
            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted-foreground font-semibold border-b border-border/80 uppercase tracking-wider">
                  <tr>
                    <th className="p-3 pl-4">Empresa</th>
                    <th className="p-3">Referência</th>
                    <th className="p-3 text-right">Valor Mensal</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Data de Pagamento</th>
                    <th className="p-3">Método</th>
                    <th className="p-3 pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBillingHistory.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="p-3 pl-4">
                        <div className="font-semibold text-foreground">{invoice.companyName}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Plano {invoice.planName}</div>
                      </td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        {invoice.month}
                      </td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {brl(invoice.amount)}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(invoice.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-3">
                        {invoice.paymentMethod ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {invoice.paymentMethod}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="p-3 pr-4 text-center">
                        {invoice.status === "paid" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Pago
                          </span>
                        ) : invoice.status === "pending" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            Vencido
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredBillingHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                        Nenhuma cobrança encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Painel Comercial (Dashboard)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe em tempo real a receita, conversão e progresso da equipe de vendas da {company?.name || "sua empresa"}.
          </p>
        </div>

        {/* Cards de Indicadores Rápidos */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Receita Ganha (Aceitas)
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
              {brl(stats.wonValue)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total de propostas ganhas fechadas
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pipeline Ativo (Pendentes)
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Clock className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
              {brl(stats.pendingValue)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Propostas enviadas aguardando retorno
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taxa de Conversão
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Percent className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
              {stats.conversionRate}%
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aceitas vs. total de propostas avaliadas
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total de Propostas
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <FileText className="size-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
              {stats.totalCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Propostas cadastradas no total
            </p>
          </div>
        </div>

        {/* Seção de Gráficos */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Gráfico 1: Evolução de Receita Acumulada */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <TrendingUp className="size-4 text-emerald-500" /> Evolução Comercial (Receita Acumulada)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Acompanhamento do ganho financeiro consolidado por propostas aceitas.
              </p>
            </div>
            <div className="h-64 w-full">
              {areaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.62 0.16 140)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="oklch(0.62 0.16 140)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.89 0.005 260 / 50%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="oklch(0.5 0.01 260)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="oklch(0.5 0.01 260)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                      formatter={(value: any, name: string, props: any) => {
                        if (name === "acumulado") return [brl(value), "Total Acumulado"];
                        if (name === "valor") return [brl(value), `Fechado (${props.payload.cliente})`];
                        return [value, name];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acumulado"
                      stroke="oklch(0.62 0.16 140)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAcumulado)"
                      name="acumulado"
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="oklch(0.6 0.22 255)"
                      strokeWidth={1}
                      fillOpacity={0}
                      name="valor"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center border border-dashed rounded-lg text-xs text-muted-foreground">
                  Sem propostas aceitas no período para gerar o gráfico.
                </div>
              )}
            </div>
          </div>

          {/* Gráfico 2: Distribuição de Propostas */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Status das Propostas
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Divisão percentual das propostas geradas no catálogo.
              </p>
            </div>
            <div className="h-64 w-full flex flex-col justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center border border-dashed rounded-lg text-xs text-muted-foreground">
                  Nenhuma proposta cadastrada para exibir.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Propostas Recentes */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Propostas Recentes
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Acompanhe o andamento das últimas propostas comerciais cadastradas.
              </p>
            </div>
            <Link
              to="/"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Ver todas <ChevronRight className="size-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead>
                <tr className="border-b border-border text-foreground/80 font-medium">
                  <th className="py-2.5">Código</th>
                  <th className="py-2.5">Cliente</th>
                  <th className="py-2.5">Solução / Campanha</th>
                  <th className="py-2.5">Data</th>
                  <th className="py-2.5 text-right">Valor Líquido</th>
                  <th className="py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentProposals.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 font-semibold text-foreground">{p.proposal_code}</td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{p.clients?.name || "Cliente"}</span>
                        {p.clients?.contact_name && (
                          <span className="text-[10px] text-muted-foreground/80">{p.clients.contact_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{p.solution_name}</span>
                        {p.campaign_name && (
                          <span className="text-[10px] text-muted-foreground/80">{p.campaign_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">{shortDate(p.created_at)}</td>
                    <td className="py-3 text-right font-bold text-foreground tabular-nums">
                      {brl(Number(p.net_amount))}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${STATUS_COLORS[p.status]}12`,
                          color: STATUS_COLORS[p.status],
                          border: `1px solid ${STATUS_COLORS[p.status]}25`,
                        }}
                      >
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {recentProposals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {isLoading ? "Carregando..." : "Nenhuma proposta cadastrada."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
