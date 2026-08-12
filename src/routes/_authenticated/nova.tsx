import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, Sparkles, Tag, Layers } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProposalDocument, type DocItem } from "@/components/proposal-document";
import { supabase } from "@/integrations/supabase/client";
import {
  clientsQuery,
  productsQuery,
  proposalByCodeQuery,
  type PricingType,
  type Proposal,
} from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

type Search = { edit?: string };

export const Route = createFileRoute("/_authenticated/nova")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    edit: typeof search['edit'] === "string" ? search['edit'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nova Proposta Comercial — Proposify AI" },
      {
        name: "description",
        content: "Crie propostas comerciais estruturadas com catálogo e condições especiais.",
      },
    ],
  }),
  component: NewProposalPage,
});

const paymentOptions = ["Pix", "Boleto", "Cartão de Crédito", "Parcelado", "Transacional"];

type LineItem = {
  key: string;
  product_id?: string | null;
  title: string;
  description: string;
  pricing_type: PricingType;
  quantity: number;
  unit_price: number;
  original_price?: number | null;
  is_included?: boolean;
};

const emptyItem = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  title: "",
  description: "",
  pricing_type: "usage_based",
  quantity: 1,
  unit_price: 0,
  original_price: null,
  is_included: false,
});

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function NewProposalPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/nova" });
  const qc = useQueryClient();
  const { profile, company } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const { data: clients } = useQuery(clientsQuery(companyId));
  const { data: products } = useQuery(productsQuery(companyId));
  const { data: editing } = useQuery({
    ...proposalByCodeQuery(search.edit ?? ""),
    enabled: Boolean(search.edit),
  });

  const [clientId, setClientId] = useState<string>("");
  const [newClient, setNewClient] = useState({
    name: "",
    document: "",
    contact_name: "",
    email: "",
    phone: "",
  });
  const [creatingClient, setCreatingClient] = useState(false);

  // Metadados da Proposta Frotlog
  const [campaignName, setCampaignName] = useState("Condições Exclusivas - Feira Transporte do Futuro");
  const [solutionName, setSolutionName] = useState(
    company?.solution_name || "Frotlog - Plataforma SaaS de Gestão e Pagamento de Despesas em Rota"
  );
  const [objectiveText, setObjectiveText] = useState(company?.objective_text ?? "");
  const [fidelityPolicy, setFidelityPolicy] = useState(company?.fidelity_policy ?? "");
  const [nextStepsText, setNextStepsText] = useState(company?.next_steps_text ?? "");

  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validity, setValidity] = useState(addDays(15));
  const [paymentTerms, setPaymentTerms] = useState(company?.default_payment_terms || "Pix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.solution_name && !editing) {
      setSolutionName(company.solution_name);
    }
  }, [company, editing]);

  useEffect(() => {
    if (!editing) return;
    setClientId(editing.client_id ?? "");
    setCampaignName(editing.campaign_name || "Condições Exclusivas");
    setSolutionName(editing.solution_name || company?.solution_name || "");
    setObjectiveText(editing.objective_text || "");
    setFidelityPolicy(editing.fidelity_policy || "");
    setNextStepsText(editing.next_steps_text || "");
    setItems(
      editing.proposal_items.map((i) => ({
        key: i.id,
        product_id: i.product_id,
        title: i.title,
        description: i.description ?? "",
        pricing_type: i.pricing_type,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        original_price: i.original_price ? Number(i.original_price) : null,
        is_included: i.is_included ?? false,
      })),
    );
    setDiscountMode("fixed");
    setDiscountValue(Number(editing.discount_amount));
    setValidity(editing.validity_date ?? addDays(15));
    setPaymentTerms(editing.payment_terms ?? "Pix");
    setNotes(editing.notes ?? "");
  }, [editing, company]);

  const selectedClient = useMemo(
    () => (clients ?? []).find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount =
    discountMode === "percent" ? (subtotal * (discountValue || 0)) / 100 : discountValue || 0;
  const net = Math.max(subtotal - discount, 0);

  const docItems: DocItem[] = items
    .filter((i) => i.title.trim())
    .map((i) => ({
      title: i.title,
      description: i.description,
      pricing_type: i.pricing_type,
      quantity: i.quantity,
      unit_price: i.unit_price,
      original_price: i.original_price,
      is_included: i.is_included,
      total_price: i.quantity * i.unit_price,
    }));

  const updateItem = (key: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const applyProduct = (key: string, productId: string) => {
    const product = (products ?? []).find((p) => p.id === productId);
    if (!product) return;
    updateItem(key, {
      product_id: product.id,
      title: product.name,
      description: product.description ?? "",
      pricing_type: product.pricing_type,
      unit_price: Number(product.unit_price),
      original_price: null,
      is_included: Number(product.unit_price) === 0,
    });
  };

  const saveClient = async () => {
    if (!newClient.name.trim()) {
      toast.error("Informe a razão social ou nome");
      return;
    }
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...newClient, company_id: companyId })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["clients"] });
    setClientId(data.id);
    setCreatingClient(false);
    setNewClient({ name: "", document: "", contact_name: "", email: "", phone: "" });
    toast.success("Cliente cadastrado");
  };

  const save = async (status: "draft" | "sent") => {
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (docItems.length === 0) {
      toast.error("Adicione ao menos um item ao escopo");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        company_id: companyId,
        created_by: profile?.id ?? null,
        campaign_name: campaignName.trim(),
        solution_name: solutionName.trim(),
        objective_text: objectiveText.trim() || null,
        fidelity_policy: fidelityPolicy.trim() || null,
        next_steps_text: nextStepsText.trim() || null,
        total_amount: subtotal,
        discount_amount: discount,
        net_amount: net,
        validity_date: validity,
        payment_terms: paymentTerms,
        notes: notes || null,
        status,
        ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
      };

      let proposalId = editing?.id;
      let proposalCode = editing?.proposal_code;

      if (proposalId) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", proposalId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("proposals").insert(payload).select("*").single();
        if (error) throw error;
        proposalId = data.id;
        proposalCode = data.proposal_code;
      }

      await supabase.from("proposal_items").delete().eq("proposal_id", proposalId!);

      const rows = docItems.map((item, index) => ({
        proposal_id: proposalId!,
        product_id: items[index]?.product_id || null,
        title: item.title,
        description: item.description || null,
        pricing_type: item.pricing_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: item.original_price || null,
        is_included: item.is_included || false,
        total_price: item.total_price,
        position: index + 1,
      }));

      const { error: itemsError } = await supabase.from("proposal_items").insert(rows);
      if (itemsError) throw itemsError;

      await qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(status === "sent" ? "Proposta enviada!" : "Rascunho salvo!");
      navigate({ to: `/proposta/${proposalCode}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar proposta.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <div className="space-y-8">
      {/* PASSO 1: CLIENTE E CAMPANHA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <h2 className="text-lg font-semibold">Cliente & Metadados da Proposta</h2>
        </div>

        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">Cliente Destinatário</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setCreatingClient((v) => !v)}
            >
              {creatingClient ? "Escolher existente" : "+ Novo cliente"}
            </Button>
          </div>

          {!creatingClient ? (
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente cadastrado" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.document ? `(${c.document})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {creatingClient ? (
            <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-xs">Razão Social / Nome</Label>
                <Input
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Ex: Transportadora Rápida LTDA"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">CNPJ / CPF</Label>
                <Input
                  value={newClient.document}
                  onChange={(e) => setNewClient({ ...newClient, document: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Nome do Contato</Label>
                <Input
                  value={newClient.contact_name}
                  onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                  placeholder="Ex: Carlos Oliveira"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="sm:col-span-2 pt-1">
                <Button type="button" size="sm" onClick={saveClient}>
                  Salvar e Selecionar Cliente
                </Button>
              </div>
            </div>
          ) : null}

          {/* Metadados da Solução e Campanha Especial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="size-3 text-primary" /> Campanha Especial
              </Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Condições Exclusivas - Feira 2026"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3 text-primary" /> Solução Contratada
              </Label>
              <Input
                value={solutionName}
                onChange={(e) => setSolutionName(e.target.value)}
                placeholder="Ex: Frotlog - Plataforma SaaS de Gestão..."
              />
            </div>
          </div>
        </div>
      </section>

      {/* PASSO 2: ESCOPO E TABELA DE PREÇOS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <h2 className="text-lg font-semibold">Itens do Escopo & Condições Comerciais</h2>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.key} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Select
                    value={item.product_id ?? ""}
                    onValueChange={(v) => applyProduct(item.key, v)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder={`Item ${index + 1} — Selecionar do catálogo`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(products ?? [])
                        .filter((p) => p.active)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {brl(Number(p.unit_price))} ({pricingLabel[p.pricing_type]})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs">Nome do Item / Serviço</Label>
                  <Input
                    value={item.title}
                    onChange={(e) => updateItem(item.key, { title: e.target.value })}
                    placeholder="Ex: Taxa de Setup (Implantação & Onboarding)"
                  />
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs">Descrição do Item</Label>
                  <Textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    placeholder="Detalhes ou escopo específico deste item..."
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Tipo de Cobrança</Label>
                  <Select
                    value={item.pricing_type}
                    onValueChange={(v) => updateItem(item.key, { pricing_type: v as PricingType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["recurring", "one_time", "setup", "usage_based"] as PricingType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {pricingLabel[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Qtd. / Transações</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.key, { quantity: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Condição Especial (R$)</Label>
                    <CurrencyInput
                      value={item.unit_price}
                      onChange={(val) => updateItem(item.key, { unit_price: val })}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>

                {/* Preço de Tabela Riscado (Condição Especial) */}
                <div className="grid gap-1.5 sm:col-span-2 bg-secondary/20 p-3 rounded-lg border border-border">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3.5 text-amber-500" /> Preço de Tabela Original (Opcional - para exibir riscado)
                  </Label>
                  <div className="flex items-center gap-3">
                    <CurrencyInput
                      value={item.original_price ?? 0}
                      onChange={(val) => updateItem(item.key, { original_price: val || null })}
                      placeholder="Ex: R$ 2.500,00"
                      className="max-w-[200px]"
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.original_price && item.original_price > item.unit_price
                        ? `Aparecerá riscado como: ${brl(item.original_price)} ➔ ${brl(item.unit_price)}`
                        : "Informe um valor maior para destacar o desconto na tabela"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="w-full gap-2"
          >
            <Plus className="size-4" /> Adicionar Item ao Escopo
          </Button>

          {/* Desconto Global */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:items-end sm:gap-4">
              <div className="grid min-w-0 gap-1.5 flex-1">
                <Label className="text-xs">Desconto Global Adicional</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex shrink-0 gap-1">
                {(["percent", "fixed"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDiscountMode(mode)}
                    className={`h-9 rounded-md border px-3 text-xs font-semibold transition-colors duration-150 ${
                      discountMode === mode
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground bg-secondary/50"
                    }`}
                  >
                    {mode === "percent" ? "%" : "R$"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-emerald-500 font-medium">
                  <span>Desconto Total</span>
                  <span className="tabular-nums">− {brl(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-1">
                <span>Total Líquido</span>
                <span className="tabular-nums text-lg text-emerald-500">{brl(net)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PASSO 3: CONDIÇÕES & VALIDADE */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            3
          </span>
          <h2 className="text-lg font-semibold">Validade & Observações</h2>
        </div>

        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Validade da Proposta</Label>
            <div className="flex gap-1 mb-1">
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setValidity(addDays(d))}
                  className={`h-8 rounded-md border px-2.5 text-xs transition-colors duration-150 ${
                    validity === addDays(d)
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
            <Input type="date" value={validity} onChange={(e) => setValidity(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Forma / Condição de Pagamento</Label>
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Observações ou Condições Especiais</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Condição válida exclusivamente durante o evento..."
            />
          </div>
        </div>
      </section>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button variant="outline" disabled={saving} onClick={() => save("draft")} className="h-11">
          Salvar Rascunho
        </Button>
        <Button disabled={saving} onClick={() => save("sent")} className="h-11 flex-1 font-semibold">
          {saving ? "Gerando Proposta..." : "Gerar e Finalizar Proposta"}
        </Button>
      </div>
    </div>
  );

  const preview = (
    <ProposalDocument
      data={{
        code: editing?.proposal_code ?? "PRÉ-VISUALIZAÇÃO",
        clientName: selectedClient?.name ?? newClient.name,
        clientDocument: selectedClient?.document ?? newClient.document,
        contactName: selectedClient?.contact_name ?? newClient.contact_name,
        email: selectedClient?.email ?? newClient.email,
        phone: selectedClient?.phone ?? newClient.phone,
        campaignName,
        solutionName,
        objectiveText: objectiveText || undefined,
        fidelityPolicy: fidelityPolicy || undefined,
        nextStepsText: nextStepsText || undefined,
        items: docItems,
        total: subtotal,
        discount,
        net,
        validityDate: validity,
        paymentTerms,
        notes,
        company,
      }}
    />
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {editing ? `Editar Proposta ${editing.proposal_code}` : "Nova Proposta Comercial"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie propostas personalizadas com a identidade oficial da sua empresa.
          </p>
        </div>
      </div>

      <div className="mt-8 hidden gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>{form}</div>
        <div className="sticky top-24 h-fit scale-[0.88] origin-top">{preview}</div>
      </div>

      <Tabs defaultValue="form" className="mt-8 lg:hidden">
        <TabsList className="w-full">
          <TabsTrigger value="form" className="flex-1">
            Formulário
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">
            Pré-visualização
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-6">
          {form}
        </TabsContent>
        <TabsContent value="preview" className="mt-6">
          {preview}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
