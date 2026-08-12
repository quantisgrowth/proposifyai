import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ProposalDocument, type DocItem } from "@/components/proposal-document";
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
import { supabase } from "@/integrations/supabase/client";
import {
  clientsQuery,
  nextProposalCode,
  productsQuery,
  proposalByCodeQuery,
  type PricingType,
} from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";

import { useAuth } from "@/lib/auth-context";

type Search = { code?: string };

export const Route = createFileRoute("/_authenticated/nova")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search['code'] === "string" ? { code: search['code'] } : {},
  head: () => ({
    meta: [
      { title: "Nova proposta — Proposify AI" },
      {
        name: "description",
        content:
          "Monte uma proposta comercial em três passos: cliente, escopo de serviços e condições, com pré-visualização em tempo real.",
      },
      { property: "og:title", content: "Nova proposta — Proposify AI" },
      {
        property: "og:description",
        content: "Construtor de propostas com catálogo de serviços e pré-visualização ao vivo.",
      },
    ],
  }),
  component: NewProposalPage,
});

type LineItem = {
  key: string;
  product_id: string | null;
  title: string;
  description: string;
  pricing_type: PricingType;
  quantity: number;
  unit_price: number;
};

const emptyItem = (): LineItem => ({
  key: crypto.randomUUID(),
  product_id: null,
  title: "",
  description: "",
  pricing_type: "one_time",
  quantity: 1,
  unit_price: 0,
});

const paymentOptions = ["Pix", "Boleto", "Cartão de Crédito", "Parcelado"];

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewProposalPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, company } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const { data: clients } = useQuery(clientsQuery(companyId));
  const { data: products } = useQuery(productsQuery(companyId));
  const { data: editing } = useQuery({
    ...proposalByCodeQuery(code ?? ""),
    enabled: Boolean(code),
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
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validity, setValidity] = useState(addDays(15));
  const [paymentTerms, setPaymentTerms] = useState("Pix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setClientId(editing.client_id ?? "");
    setItems(
      editing.proposal_items.map((i) => ({
        key: i.id,
        product_id: i.product_id,
        title: i.title,
        description: i.description ?? "",
        pricing_type: i.pricing_type,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      })),
    );
    setDiscountMode("fixed");
    setDiscountValue(Number(editing.discount_amount));
    setValidity(editing.validity_date ?? addDays(15));
    setPaymentTerms(editing.payment_terms ?? "Pix");
    setNotes(editing.notes ?? "");
  }, [editing]);

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
    });
  };

  const saveClient = async () => {
    if (!newClient.name.trim()) {
      toast.error("Informe a razão social ou nome");
      return;
    }
    const { data, error } = await supabase.from("clients").insert(newClient).select("*").single();
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
        await supabase.from("proposal_items").delete().eq("proposal_id", proposalId);
      } else {
        proposalCode = await nextProposalCode();
        const { data, error } = await supabase
          .from("proposals")
          .insert({ ...payload, proposal_code: proposalCode })
          .select("id")
          .single();
        if (error) throw error;
        proposalId = data.id;
      }

      const { error: itemsError } = await supabase.from("proposal_items").insert(
        items
          .filter((i) => i.title.trim())
          .map((i, index) => ({
            proposal_id: proposalId as string,
            product_id: i.product_id,
            title: i.title,
            description: i.description || null,
            pricing_type: i.pricing_type,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.quantity * i.unit_price,
            position: index,
          })),
      );
      if (itemsError) throw itemsError;

      await qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success(status === "sent" ? "Proposta enviada" : "Rascunho salvo");
      navigate({ to: "/proposta/$code", params: { code: proposalCode as string } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <div className="space-y-10">
      <section>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Passo 1</p>
        <h2 className="mt-1 text-lg font-medium">Informações do cliente</h2>
        <div className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <div className="flex flex-wrap gap-2">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue placeholder="Selecionar cliente existente" />
                </SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreatingClient((v) => !v)}
              >
                {creatingClient ? "Cancelar" : "Novo cliente"}
              </Button>
            </div>
          </div>

          {creatingClient ? (
            <div className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Razão Social / Nome</Label>
                <Input
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>CNPJ / CPF</Label>
                <Input
                  value={newClient.document}
                  onChange={(e) => setNewClient({ ...newClient, document: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nome do contato</Label>
                <Input
                  value={newClient.contact_name}
                  onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="button" size="sm" onClick={saveClient}>
                  Salvar cliente
                </Button>
              </div>
            </div>
          ) : selectedClient ? (
            <div className="border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{selectedClient.name}</p>
              <p>{selectedClient.document}</p>
              <p>
                {selectedClient.contact_name} · {selectedClient.email} · {selectedClient.phone}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Passo 2</p>
        <h2 className="mt-1 text-lg font-medium">Escopo e produtos/serviços</h2>
        <div className="mt-4 space-y-4">
          {items.map((item, index) => (
            <div key={item.key} className="border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <Select
                  value={item.product_id ?? ""}
                  onValueChange={(v) => applyProduct(item.key, v)}
                >
                  <SelectTrigger className="min-w-0">
                    <SelectValue placeholder={`Item ${index + 1} — escolher do catálogo`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(products ?? [])
                      .filter((p) => p.active)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {brl(Number(p.unit_price))}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground"
                  onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Serviço</Label>
                  <Input
                    value={item.title}
                    onChange={(e) => updateItem(item.key, { title: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => updateItem(item.key, { description: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tipo</Label>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Qtd. / Transações</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.key, { quantity: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Valor unitário</Label>
                    <CurrencyInput
                      value={item.unit_price}
                      onChange={(val) => updateItem(item.key, { unit_price: val })}
                      placeholder="R$ 0,00"
                    />
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
          >
            <Plus className="size-4" /> Adicionar item
          </Button>

          <div className="border border-border bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:items-end sm:gap-4">
              <div className="grid min-w-0 gap-1.5">
                <Label>Desconto</Label>
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
                    className={`h-9 rounded-md border px-3 text-sm transition-colors duration-150 ${
                      discountMode === mode
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {mode === "percent" ? "%" : "R$"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Desconto</span>
                <span className="tabular-nums">− {brl(discount)}</span>
              </div>
              <div className="flex justify-between text-base font-medium">
                <span>Total</span>
                <span className="tabular-nums">{brl(net)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Passo 3</p>
        <h2 className="mt-1 text-lg font-medium">Condições comerciais e validade</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Validade</Label>
            <div className="flex gap-1">
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setValidity(addDays(d))}
                  className={`h-9 rounded-md border px-3 text-sm transition-colors duration-150 ${
                    validity === addDays(d)
                      ? "border-foreground bg-foreground text-background"
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
            <Label>Forma de pagamento</Label>
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
            <Label>Observações e cláusulas especiais</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button variant="outline" disabled={saving} onClick={() => save("draft")}>
          Salvar rascunho
        </Button>
        <Button disabled={saving} onClick={() => save("sent")}>
          Finalizar e enviar
        </Button>
      </div>
    </div>
  );

  const preview = (
    <ProposalDocument
      data={{
        code: editing?.proposal_code ?? "Pré-visualização",
        clientName: selectedClient?.name ?? newClient.name,
        clientDocument: selectedClient?.document ?? newClient.document,
        contactName: selectedClient?.contact_name ?? newClient.contact_name,
        email: selectedClient?.email ?? newClient.email,
        phone: selectedClient?.phone ?? newClient.phone,
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
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
        {editing ? `Editar ${editing.proposal_code}` : "Nova proposta"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preencha os três passos e acompanhe o documento sendo montado ao lado.
      </p>

      <div className="mt-8 hidden gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>{form}</div>
        <div className="sticky top-28 h-fit scale-[0.92] origin-top">{preview}</div>
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
