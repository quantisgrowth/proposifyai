import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Edit2, Trash2 } from "lucide-react";

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
import { productsQuery, type PricingType, type Product } from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Catálogo de Produtos & Serviços — Proposify AI" },
      {
        name: "description",
        content:
          "Catálogo de produtos e serviços com preço unitário e tipo de cobrança recorrente, pontual, setup ou por demanda.",
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
  pricing_type: "usage_based" as PricingType,
};

function ProductsPage() {
  const qc = useQueryClient();
  const { profile, company } = useAuth();
  const companyId = profile?.company_id || company?.id || null;

  const { data: products, isLoading } = useQuery(productsQuery(companyId));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const openCreateModal = () => {
    setEditing(null);
    setForm(emptyProduct);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      unit_price: Number(p.unit_price),
      pricing_type: p.pricing_type,
    });
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do serviço");
      const payload = {
        ...form,
        company_id: companyId,
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

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Catálogo de Produtos & Serviços
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo comercial da sua empresa usado para montar propostas em segundos.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2 h-10 shrink-0">
          <Plus className="size-4" /> Novo Serviço / Produto
        </Button>
      </div>

      <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {(products ?? []).map((p) => (
          <div
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-secondary/40 transition-colors cursor-pointer"
            onClick={() => openEditModal(p)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground hover:underline truncate">{p.name}</p>
                <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {pricingLabel[p.pricing_type] ?? p.pricing_type}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {p.description || "Sem descrição detalhada."}
              </p>
            </div>

            <div
              className="flex items-center gap-4 self-end sm:self-center"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="tabular-nums font-bold text-base text-foreground whitespace-nowrap">
                {brl(Number(p.unit_price))}
              </span>
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
        ))}

        {(products ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {isLoading
              ? "Carregando catálogo..."
              : "Nenhum produto cadastrado para sua empresa."}
          </div>
        )}
      </div>

      {/* MODAL: Produto / Serviço */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {editing ? "Editar Serviço" : "Novo Serviço / Produto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre itens no catálogo para seleção rápida ao montar propostas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome do Serviço</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Transação / Emissão"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Valor correspondente a cada transação processada..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Preço Unitário (R$)</Label>
                <CurrencyInput
                  value={form.unit_price}
                  onChange={(val) => setForm({ ...form, unit_price: val })}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="grid gap-1.5">
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
