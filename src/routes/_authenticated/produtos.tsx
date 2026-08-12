import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  Building2,
  Layers,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import {
  productsQuery,
  companiesQuery,
  type PricingType,
  type PricingTier,
  type Product,
} from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Catálogo de Produtos & Serviços — Proposify AI" },
      {
        name: "description",
        content:
          "Catálogo comercial com regras de preço mínimo, máximo, praticado e faixas de volume.",
      },
    ],
  }),
  component: ProductsPage,
});

const pricingTypes: PricingType[] = ["recurring", "one_time", "setup", "usage_based"];

const emptyProduct = {
  name: "",
  description: "",
  unit_price: 0,
  min_price: 0,
  max_price: 0,
  pricing_type: "usage_based" as PricingType,
  company_id: "",
  pricing_tiers: [] as PricingTier[],
  pricing_tier_notes: "",
};

function ProductsPage() {
  const qc = useQueryClient();
  const { profile, company, isAdmin } = useAuth();
  const { data: companies } = useQuery(companiesQuery);

  // Se for admin, permite selecionar qualquer empresa ou "all"
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return profile?.company_id ?? "all";
  });

  const activeCompanyFilter = isAdmin
    ? selectedCompanyId === "all"
      ? null
      : selectedCompanyId
    : profile?.company_id || company?.id || null;

  const { data: products, isLoading } = useQuery(productsQuery(activeCompanyFilter));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [searchTerm, setSearchTerm] = useState("");

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      ...emptyProduct,
      company_id:
        selectedCompanyId !== "all"
          ? selectedCompanyId
          : profile?.company_id ?? (companies?.[0]?.id ?? ""),
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      unit_price: Number(p.unit_price) || 0,
      min_price: p.min_price ? Number(p.min_price) : 0,
      max_price: p.max_price ? Number(p.max_price) : 0,
      pricing_type: p.pricing_type,
      company_id: p.company_id ?? (profile?.company_id ?? ""),
      pricing_tiers: Array.isArray(p.pricing_tiers) ? p.pricing_tiers : [],
      pricing_tier_notes: p.pricing_tier_notes ?? "",
    });
    setModalOpen(true);
  };

  const addTier = () => {
    setForm((prev) => ({
      ...prev,
      pricing_tiers: [...prev.pricing_tiers, { range: "", price: 0 }],
    }));
  };

  const updateTier = (idx: number, patch: Partial<PricingTier>) => {
    setForm((prev) => {
      const next = [...prev.pricing_tiers];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, pricing_tiers: next };
    });
  };

  const removeTier = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      pricing_tiers: prev.pricing_tiers.filter((_, i) => i !== idx),
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do serviço");
      const targetCompanyId = form.company_id || profile?.company_id || (companies?.[0]?.id ?? null);
      
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        unit_price: form.unit_price,
        min_price: form.min_price || null,
        max_price: form.max_price || null,
        pricing_type: form.pricing_type,
        company_id: targetCompanyId,
        pricing_tiers: form.pricing_tiers.filter((t) => t.range.trim()),
        pricing_tier_notes: form.pricing_tier_notes?.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Serviço atualizado" : "Serviço adicionado ao catálogo");
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Serviço removido");
    },
    onError: () =>
      toast.error("Não foi possível remover: o serviço está em uso em alguma proposta."),
  });

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (products ?? []).filter((p) => {
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Catálogo de Produtos & Serviços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina preços praticados, limites de desconto para os vendedores e tabelas de faixas por volume.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2 h-10 shrink-0">
          <Plus className="size-4" /> Novo Serviço / Produto
        </Button>
      </div>

      {/* Barra de Filtros & Busca */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2.5">
            <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Filtrar por Empresa:
            </Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-[200px] h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {/* Lista de Produtos */}
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {filteredProducts.map((p) => {
          const comp = companies?.find((c) => c.id === p.company_id);
          const hasTiers = Array.isArray(p.pricing_tiers) && p.pricing_tiers.length > 0;

          return (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-secondary/40 transition-colors cursor-pointer"
              onClick={() => openEditModal(p)}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground hover:underline truncate">{p.name}</p>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {pricingLabel[p.pricing_type] ?? p.pricing_type}
                  </span>
                  {comp && isAdmin && selectedCompanyId === "all" ? (
                    <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Building2 className="size-3" />
                      {comp.name}
                    </span>
                  ) : null}
                  {hasTiers ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/20">
                      <Layers className="size-3" />
                      {p.pricing_tiers?.length} Faixas de Volume
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {p.description || "Sem descrição detalhada."}
                </p>
                {(p.min_price || p.max_price) && (
                  <p className="mt-1 text-[11px] text-muted-foreground/80 flex items-center gap-2">
                    {p.min_price ? <span>Mín: <strong className="text-foreground">{brl(Number(p.min_price))}</strong></span> : null}
                    {p.max_price ? <span>Máx: <strong className="text-foreground">{brl(Number(p.max_price))}</strong></span> : null}
                  </p>
                )}
              </div>

              <div
                className="flex items-center gap-4 self-end sm:self-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Preço Praticado</span>
                  <span className="tabular-nums font-bold text-base text-foreground whitespace-nowrap">
                    {brl(Number(p.unit_price))}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.active}
                    onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                    title={p.active ? "Ativo" : "Inativo"}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openEditModal(p)}
                  >
                    <Edit2 className="size-3.5" /> Editar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove.mutate(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {isLoading
              ? "Carregando catálogo..."
              : "Nenhum produto encontrado para o filtro selecionado."}
          </div>
        )}
      </div>

      {/* MODAL: Produto / Serviço Completo com Regras e Faixas */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {editing ? "Editar Serviço / Produto" : "Novo Serviço / Produto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina preços de referência, limites de segurança para a equipe de vendas e regras de faixas por volume.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Nome do Serviço</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Transação / Emissão de Pagamento"
                  required
                />
              </div>

              {isAdmin ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Vincular a Empresa</Label>
                  <Select
                    value={form.company_id}
                    onValueChange={(val) => setForm({ ...form, company_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Valor correspondente a cada pagamento efetuado em rota..."
              />
            </div>

            {/* Configuração de Preços: Praticado, Mínimo e Máximo */}
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-primary" /> Regras de Precificação & Limites de Negociação
                </Label>
                <span className="text-[11px] text-muted-foreground">Previne descontos excessivos</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Preço Praticado (Tabela Padrão)
                  </Label>
                  <CurrencyInput
                    value={form.unit_price}
                    onChange={(val) => setForm({ ...form, unit_price: val })}
                    placeholder="R$ 5,00"
                  />
                  <span className="text-[10px] text-muted-foreground">Valor exibido por padrão</span>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Preço Mínimo (Piso / Limite de Desconto)
                  </Label>
                  <CurrencyInput
                    value={form.min_price}
                    onChange={(val) => setForm({ ...form, min_price: val })}
                    placeholder="Ex: R$ 2,49"
                  />
                  <span className="text-[10px] text-muted-foreground">Vendedor não pode cobrar menos</span>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Preço Máximo (Teto com Acréscimo)
                  </Label>
                  <CurrencyInput
                    value={form.max_price}
                    onChange={(val) => setForm({ ...form, max_price: val })}
                    placeholder="Ex: R$ 10,00"
                  />
                  <span className="text-[10px] text-muted-foreground">Vendedor não pode cobrar mais</span>
                </div>
              </div>

              <div className="grid gap-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">Tipo de Cobrança</Label>
                <Select
                  value={form.pricing_type}
                  onValueChange={(v) => setForm({ ...form, pricing_type: v as PricingType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {pricingLabel[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Construtor de Tabela de Faixas por Volume (Performance) */}
            <div className="rounded-lg border border-border bg-secondary/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="size-4 text-primary" /> Tabela de Precificação por Faixas de Volume (Opcional)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Exibida na proposta comercial como tabela regressiva de performance.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addTier} className="h-8 text-xs gap-1.5">
                  <Plus className="size-3.5" /> Adicionar Faixa
                </Button>
              </div>

              {form.pricing_tiers.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {form.pricing_tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-background p-2.5 rounded-lg border border-border">
                      <div className="flex-1">
                        <Input
                          placeholder="Faixa (Ex: De 201 a 500 transações)"
                          value={tier.range}
                          onChange={(e) => updateTier(idx, { range: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="w-36">
                        <CurrencyInput
                          placeholder="Valor (R$)"
                          value={tier.price}
                          onChange={(val) => updateTier(idx, { price: val })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeTier(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}

                  <div className="grid gap-1.5 pt-2">
                    <Label className="text-xs text-muted-foreground">
                      Nota Operacional da Tabela (Exibida no rodapé da tabela)
                    </Label>
                    <Input
                      value={form.pricing_tier_notes}
                      onChange={(e) => setForm({ ...form, pricing_tier_notes: e.target.value })}
                      placeholder="* Nota operacional: O custo operacional padrão de repasse (PIX Out) já está absorvido..."
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-md">
                  Nenhuma faixa de volume adicionada. Clique em "+ Adicionar Faixa" para criar preços regressivos (ex: Até 200, 201 a 500, etc).
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending
                  ? "Salvando..."
                  : editing
                  ? "Salvar Alterações"
                  : "Adicionar ao Catálogo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
