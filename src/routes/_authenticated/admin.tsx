import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Package, Trash2, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  clientsQuery,
  companySettingsQuery,
  productsQuery,
  type Client,
  type PricingType,
  type Product,
} from "@/lib/proposals";
import { brl, pricingLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Proposify AI" },
      {
        name: "description",
        content:
          "Back office do Proposify AI: cadastre produtos e valores, gerencie clientes e configure os dados da empresa exibidos nas propostas.",
      },
      { property: "og:title", content: "Admin — Proposify AI" },
      {
        property: "og:description",
        content: "Central de configuração do catálogo, clientes e identidade comercial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const pricingTypes: PricingType[] = ["recurring", "one_time", "setup"];

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* ---------------- Empresa ---------------- */

function CompanyTab() {
  const qc = useQueryClient();
  const { data } = useQuery(companySettingsQuery);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    email: "",
    phone: "",
    document: "",
    default_validity_days: 15,
    default_payment_terms: "Pix",
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      tagline: data.tagline,
      email: data.email,
      phone: data.phone,
      document: data.document,
      default_validity_days: data.default_validity_days,
      default_payment_terms: data.default_payment_terms,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome da empresa");
      if (data) {
        const { error } = await supabase.from("company_settings").update(form).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_settings").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_settings"] });
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Identidade" description="Aparece no cabeçalho e no aceite das propostas.">
        <Field label="Nome da empresa">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Slogan">
          <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        </Field>
        <Field label="CNPJ / documento">
          <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
        </Field>
      </Section>

      <Section title="Contato e padrões" description="Dados de contato e condições sugeridas em novas propostas.">
        <Field label="E-mail comercial">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Validade padrão (dias)">
            <Input
              type="number"
              value={form.default_validity_days}
              onChange={(e) =>
                setForm({ ...form, default_validity_days: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Pagamento padrão">
            <Select
              value={form.default_payment_terms}
              onValueChange={(v) => setForm({ ...form, default_payment_terms: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Pix", "Boleto", "Cartão de Crédito", "Parcelado"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          Salvar configurações
        </Button>
      </Section>
    </div>
  );
}

/* ---------------- Catálogo ---------------- */

const emptyProduct = {
  name: "",
  description: "",
  unit_price: 0,
  pricing_type: "one_time" as PricingType,
};

function CatalogTab() {
  const qc = useQueryClient();
  const { data } = useQuery(productsQuery);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const reset = () => {
    setEditing(null);
    setForm(emptyProduct);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do serviço");
      if (editing) {
        const { error } = await supabase.from("products").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Serviço atualizado" : "Serviço adicionado");
      reset();
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
      reset();
    },
    onError: () =>
      toast.error("Não foi possível remover: o serviço está em uso em alguma proposta."),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="divide-y divide-border border border-border bg-card">
        {(data ?? []).map((p) => (
          <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-4">
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => {
                setEditing(p);
                setForm({
                  name: p.name,
                  description: p.description ?? "",
                  unit_price: Number(p.unit_price),
                  pricing_type: p.pricing_type,
                });
              }}
            >
              <p className="truncate font-medium">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {pricingLabel[p.pricing_type]}
              </p>
            </button>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="tabular-nums">{brl(Number(p.unit_price))}</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={p.active}
                  onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                />
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
        )}
      </div>

      <div className="h-fit border border-border bg-card p-5">
        <p className="font-medium">{editing ? "Editar serviço" : "Novo serviço"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Clique em um item da lista para editá-lo.
        </p>
        <div className="mt-5 space-y-3">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Preço unitário">
            <Input
              type="number"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Tipo de cobrança">
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
          </Field>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Salvar alterações" : "Adicionar ao catálogo"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Clientes ---------------- */

const emptyClient = { name: "", document: "", contact_name: "", email: "", phone: "" };

function ClientsTab() {
  const qc = useQueryClient();
  const { data } = useQuery(clientsQuery);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);

  const reset = () => {
    setEditing(null);
    setForm(emptyClient);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social ou nome");
      if (editing) {
        const { error } = await supabase.from("clients").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editing ? "Cliente atualizado" : "Cliente cadastrado");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido");
      reset();
    },
    onError: () =>
      toast.error("Não foi possível remover: o cliente possui propostas vinculadas."),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="divide-y divide-border border border-border bg-card">
        {(data ?? []).map((c) => (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4">
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => {
                setEditing(c);
                setForm({
                  name: c.name,
                  document: c.document ?? "",
                  contact_name: c.contact_name ?? "",
                  email: c.email ?? "",
                  phone: c.phone ?? "",
                });
              }}
            >
              <p className="truncate font-medium">{c.name}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {c.document} · {c.contact_name}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {c.email} · {c.phone}
              </p>
            </button>
            <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        )}
      </div>

      <div className="h-fit border border-border bg-card p-5">
        <p className="font-medium">{editing ? "Editar cliente" : "Novo cliente"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Clique em um cliente da lista para editá-lo.
        </p>
        <div className="mt-5 space-y-3">
          <Field label="Razão social / Nome">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="CNPJ / CPF">
            <Input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
          </Field>
          <Field label="Nome do contato">
            <Input
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone / WhatsApp">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Página ---------------- */

function AdminPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Back office da plataforma: catálogo, clientes e identidade comercial.
      </p>

      <Tabs defaultValue="catalogo" className="mt-8">
        <TabsList>
          <TabsTrigger value="catalogo" className="gap-2">
            <Package className="size-4" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="size-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 className="size-4" /> Empresa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-6">
          <CatalogTab />
        </TabsContent>
        <TabsContent value="clientes" className="mt-6">
          <ClientsTab />
        </TabsContent>
        <TabsContent value="empresa" className="mt-6">
          <CompanyTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
