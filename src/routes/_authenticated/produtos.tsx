import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery, type PricingType } from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos e serviços — Proposify AI" },
      {
        name: "description",
        content:
          "Catálogo de produtos e serviços com preço unitário e tipo de cobrança recorrente, pontual ou setup.",
      },
      { property: "og:title", content: "Produtos e serviços — Proposify AI" },
      {
        property: "og:description",
        content: "Catálogo comercial usado para montar propostas em segundos.",
      },
    ],
  }),
  component: ProductsPage,
});

const pricingTypes: PricingType[] = ["recurring", "one_time", "setup"];

function ProductsPage() {
  const qc = useQueryClient();
  const { profile, company } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const { data } = useQuery(productsQuery(companyId));
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit_price: 0,
    pricing_type: "one_time" as PricingType,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do serviço");
      const { error } = await supabase.from("products").insert({
        ...form,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setForm({ name: "", description: "", unit_price: 0, pricing_type: "one_time" });
      toast.success("Serviço adicionado");
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

  return (
    <AppShell>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Catálogo de Produtos & Serviços
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Catálogo comercial da sua empresa usado para montar propostas em segundos.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {(data ?? []).map((p) => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {pricingLabel[p.pricing_type]}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="tabular-nums font-semibold text-sm">
                  {brl(Number(p.unit_price))}
                </span>
                <Switch
                  checked={p.active}
                  onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                />
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado para sua empresa.
            </p>
          )}
        </div>

        <div className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="font-medium text-foreground">Novo serviço / produto</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Disponível imediatamente para montar propostas.
          </p>

          <div className="mt-5 space-y-3.5">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Consultoria de Tráfego"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que está incluso neste serviço..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Preço unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unit_price}
                onChange={(e) =>
                  setForm({ ...form, unit_price: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de cobrança</Label>
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
            <Button
              className="w-full mt-2"
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              Adicionar ao catálogo
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
