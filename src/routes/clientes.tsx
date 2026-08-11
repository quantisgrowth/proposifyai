import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { clientsQuery } from "@/lib/proposals";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Meridian Propostas Comerciais" },
      {
        name: "description",
        content:
          "Base de clientes com razão social, CNPJ/CPF, contato, e-mail e telefone para preencher propostas em segundos.",
      },
      { property: "og:title", content: "Clientes — Meridian" },
      {
        property: "og:description",
        content: "Cadastro de clientes usado nas propostas comerciais.",
      },
    ],
  }),
  component: ClientsPage,
});

const empty = { name: "", document: "", contact_name: "", email: "", phone: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(clientsQuery);
  const [form, setForm] = useState(empty);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe a razão social ou nome");
      const { error } = await supabase.from("clients").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setForm(empty);
      toast.success("Cliente cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Quem recebe suas propostas comerciais.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-normal">Cliente</th>
                <th className="px-4 py-3 font-normal">Documento</th>
                <th className="px-4 py-3 font-normal">Contato</th>
                <th className="px-4 py-3 font-normal">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.document}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.contact_name}
                    <span className="block text-xs">
                      {c.email} · {c.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h-fit border border-border bg-card p-4">
          <p className="font-medium">Novo cliente</p>
          <div className="mt-4 space-y-3">
            <div className="grid gap-1.5">
              <Label>Razão Social / Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>CNPJ / CPF</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nome do contato</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={() => create.mutate()}>
              Cadastrar cliente
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
