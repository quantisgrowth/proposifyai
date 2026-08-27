import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDocument } from "@/lib/format";
import {
  ArrowLeft,
  Link2,
  Printer,
  CheckCircle2,
  FileCheck2,
  CheckSquare,
  AlertTriangle,
  Loader2,
  Mail,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ProposalDocument } from "@/components/proposal-document";
import { supabase } from "@/integrations/supabase/client";
import { proposalByCodeQuery } from "@/lib/proposals";
import { getPublicProposal } from "@/lib/public-proposal.functions";
import type { FullProposal } from "@/lib/proposals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
};

type Search = { print?: boolean };

export const Route = createFileRoute("/proposta/$code")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    print: search['print'] === true || search['print'] === "true",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Proposta ${params.code} — Proposify AI` },
      {
        name: "description",
        content: `Documento da proposta comercial ${params.code}: escopo, valores, validade e aceite.`,
      },
      { property: "og:title", content: `Proposta ${params.code} — Proposify AI` },
      {
        property: "og:description",
        content: "Proposta comercial pronta para leitura, impressão e aceite.",
      },
    ],
  }),
  component: ProposalView,
});

function ProposalView() {
  const { code } = Route.useParams();
  const { print } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerDocument, setSignerDocument] = useState("");
  const [signerIp, setSignerIp] = useState("—");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      fetch("https://api.ipify.org?format=json")
        .then((res) => res.json())
        .then((data) => setSignerIp(data.ip))
        .catch((err) => {
          console.error("Error fetching IP:", err);
          setSignerIp("—");
        });
    }
  }, [modalOpen]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    if (e.cancelable) e.preventDefault();

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef) return { x: 0, y: 0 };
    const rect = canvasRef.getBoundingClientRect();
    
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0]!.clientX - rect.left,
        y: e.touches[0]!.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const clearCanvas = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    setHasSigned(false);
  };

  // Authentication session check and generation state
  const [hasSession, setHasSession] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-view", code],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session.session) return proposalByCodeQuery(code).queryFn();
      return (await getPublicProposal({ data: code })) as unknown as FullProposal | null;
    },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  useEffect(() => {
    if (data) {
      setCustomEmail(data.clients?.email || "");
      const compName = data.companies?.name || "Proposify AI";
      setEmailSubject(`Proposta Comercial ${data.proposal_code} — ${compName}`);
      
      const clientName = data.clients?.contact_name || data.clients?.name || "Prezado(a)";
      const url = `${window.location.origin}/proposta/${data.proposal_code}`;
      setEmailBody(
        `Olá ${clientName},\n\n` +
        `Segue o link para visualização da Proposta Comercial ${data.proposal_code} preparada para você:\n\n` +
        `${url}\n\n` +
        `Qualquer dúvida ou ajuste, estamos à disposição.\n\n` +
        `Atenciosamente,\n` +
        `${compName}`
      );
    }
  }, [data]);

  useEffect(() => {
    if (print && data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [print, data]);

  if (isLoading) {
    return <p className="p-12 text-center text-sm text-muted-foreground">Carregando proposta…</p>;
  }

  if (!data) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted-foreground">Proposta não encontrada.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/">Voltar</Link>
        </Button>
      </div>
    );
  }

  const ensureProposalSent = async () => {
    if (data && data.status === "draft") {
      try {
        const { error } = await supabase
          .from("proposals")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", data.id);
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["proposal-view", code] });
          queryClient.invalidateQueries({ queryKey: ["proposals"] });
          toast.success("Proposta ativada (status alterado para Enviada)!");
        }
      } catch (err) {
        console.error("Error setting proposal to sent:", err);
      }
    }
  };

  const copyLink = async () => {
    ensureProposalSent();
    try {
      await navigator.clipboard.writeText(window.location.origin + `/proposta/${code}`);
      toast.success("Link da proposta copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleCopyMessage = async () => {
    ensureProposalSent();
    try {
      await navigator.clipboard.writeText(emailBody);
      toast.success("Mensagem do e-mail copiada!");
    } catch {
      toast.error("Erro ao copiar a mensagem");
    }
  };

  const handleSendLocalEmail = () => {
    ensureProposalSent();
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${customEmail}?subject=${subject}&body=${body}`;
    setShareModalOpen(false);
  };

  const handleSendOfficialEmail = async () => {
    if (!data) return;
    setSendingEmail(true);
    toast.loading("Enviando proposta por e-mail...", { id: "send-proposal-email" });
    try {
      const { sendOfficialProposalEmailServer } = await import("@/lib/email.server");
      
      const htmlBody = emailBody.replace(/\n/g, "<br>");
      
      const res = await sendOfficialProposalEmailServer({
        data: {
        proposalId: data.id,
        toEmail: customEmail,
        subject: emailSubject,
        bodyHtml: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #334155;">
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">${htmlBody}</p>
          </div>
        `,
        },
      });

      if (res.success) {
        toast.success(
          res.method === "smtp"
            ? "E-mail enviado via SMTP corporativo!"
            : "E-mail enviado com sucesso!",
          { id: "send-proposal-email" }
        );
        setShareModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["proposal-view", code] });
        queryClient.invalidateQueries({ queryKey: ["proposals"] });
      }
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail: " + err.message, { id: "send-proposal-email" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleGenerateOfficial = async () => {
    setIsGenerating(true);
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw error;
      
      toast.success("Proposta Oficial gerada e disponibilizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proposal-view", code] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar proposta oficial.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !signerEmail.trim() || !signerDocument.trim() || !acceptedTerms) {
      toast.error("Por favor, preencha todos os campos e aceite os termos.");
      return;
    }
    if (!hasSigned) {
      toast.error("Por favor, desenhe sua assinatura no canvas.");
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureUrl = canvasRef ? canvasRef.toDataURL("image/png") : "";
      const { acceptProposalServer } = await import("@/lib/public-proposal.functions");
      const result = await acceptProposalServer({
        data: {
          code,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          signerDocument: signerDocument.trim(),
          signerIp,
          signerUserAgent: navigator.userAgent,
          signatureUrl,
        },
      });

      if (result.success) {
        toast.success("Proposta aceita com sucesso! O vendedor foi notificado.");
        setModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["proposal-view", code] });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ocorreu um erro ao aceitar a proposta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="no-print sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-0">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="size-4" /> Propostas
          </Button>
          <div className="flex gap-2">
            {hasSession && data.status !== "draft" && (
              <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)}>
                <Mail className="size-4" /> Enviar por E-mail
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Link2 className="size-4" /> Copiar link
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Draft/Simulation top alert banner for logged in sellers */}
      {hasSession && data.status === "draft" && (
        <div className="no-print bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
          <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span>Você está visualizando a simulação desta proposta (Rascunho). Revise os dados abaixo e clique em Gerar Proposta para oficializá-la.</span>
            </p>
            <Button
              size="sm"
              disabled={isGenerating}
              onClick={handleGenerateOfficial}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 font-semibold shrink-0"
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileCheck2 className="size-3.5" />
              )}
              Gerar Proposta Oficial
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 py-8 sm:px-6">
        <ProposalDocument
          data={{
            code: data.proposal_code,
            id: data.id,
            clientName: data.clients?.name ?? "",
            clientDocument: data.clients?.document,
            contactName: data.clients?.contact_name,
            email: data.clients?.email,
            phone: data.clients?.phone,
            campaignName: (data as any).campaign_name,
            solutionName: (data as any).solution_name,
            objectiveText: (data as any).objective_text,
            scopeText: (data as any).scope_text,
            fidelityPolicy: (data as any).fidelity_policy,
            nextStepsText: (data as any).next_steps_text,
            items: data.proposal_items.map((i) => ({
              title: i.title,
              description: i.description,
              pricing_type: i.pricing_type,
              quantity: Number(i.quantity),
              unit_price: Number(i.unit_price),
              original_price: (i as any).original_price ? Number((i as any).original_price) : null,
              is_included: (i as any).is_included,
              total_price: Number(i.total_price),
            })),
            total: Number(data.total_amount),
            discount: Number(data.discount_amount),
            net: Number(data.net_amount),
            validityDate: data.validity_date,
            paymentTerms: data.payment_terms,
            notes: data.notes,
            company: (data as any).companies ?? null,
            status: data.status,
            acceptedAt: (data as any).accepted_at,
            acceptedByName: (data as any).accepted_by_name,
            acceptedByEmail: (data as any).accepted_by_email,
            acceptedByDocument: (data as any).accepted_by_document,
            acceptedByIp: (data as any).accepted_by_ip,
            acceptedByUserAgent: (data as any).accepted_by_user_agent,
            acceptedSignatureUrl: (data as any).accepted_signature_url,
            show_objective: (data as any).show_objective,
            show_scope: (data as any).show_scope,
            show_fidelity: (data as any).show_fidelity,
            show_next_steps: (data as any).show_next_steps,
            objective_title: (data as any).objective_title,
            objective_subtitle: (data as any).objective_subtitle,
            scope_title: (data as any).scope_title,
            scope_subtitle: (data as any).scope_subtitle,
            fidelity_title: (data as any).fidelity_title,
            fidelity_subtitle: (data as any).fidelity_subtitle,
            next_steps_title: (data as any).next_steps_title,
            next_steps_subtitle: (data as any).next_steps_subtitle,
          }}
        />
      </div>

      {/* Client Acceptance Panel */}
      <div className="no-print mx-auto mt-8 max-w-3xl px-4 sm:px-6">
        {data.status === "accepted" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-6 text-emerald-800 dark:text-emerald-300 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" /> Proposta Formalmente Aceita!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Assinado digitalmente por <strong className="text-foreground">{(data as any).accepted_by_name || "Cliente"}</strong> ({(data as any).accepted_by_email || "—"}) em { (data as any).accepted_at ? new Date((data as any).accepted_at).toLocaleString("pt-BR") : "—" }.
                </p>
              </div>
              <div className="rounded border border-emerald-600/30 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Ganha / Aceita
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <FileCheck2 className="size-4 text-emerald-600" /> Detalhes do Aceite Digital
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 text-xs text-muted-foreground text-left">
                  <p>
                    <strong className="text-foreground font-medium">Assinante:</strong> {(data as any).accepted_by_name}
                  </p>
                  <p>
                    <strong className="text-foreground font-medium">E-mail:</strong> {(data as any).accepted_by_email}
                  </p>
                  <p>
                    <strong className="text-foreground font-medium">CPF/CNPJ:</strong> {(data as any).accepted_by_document || "—"}
                  </p>
                  <p>
                    <strong className="text-foreground font-medium">Data/Hora:</strong> { (data as any).accepted_at ? new Date((data as any).accepted_at).toLocaleString("pt-BR") : "—" }
                  </p>
                  <p className="truncate">
                    <strong className="text-foreground font-medium">IP de Registro:</strong> {(data as any).accepted_by_ip || "—"}
                  </p>
                  <p className="text-[10px] leading-relaxed max-w-sm truncate">
                    <strong className="text-foreground font-medium">Navegador:</strong> {(data as any).accepted_by_user_agent || "—"}
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center border border-dashed border-border bg-slate-50/50 rounded-lg p-3 h-32">
                  {(data as any).accepted_signature_url ? (
                    <>
                      <img
                        src={(data as any).accepted_signature_url}
                        alt="Assinatura Manual"
                        className="max-h-20 max-w-full object-contain mb-1"
                      />
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                        Assinatura Eletrônica
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sem assinatura visual</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : data.status === "sent" ? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-md space-y-4">
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <CheckSquare className="size-5 text-primary" /> Aceite da Proposta Comercial
              </h3>
              <p className="text-sm text-muted-foreground">
                Se você está de acordo com o escopo, cronograma, valores e condições descritos no documento acima, finalize a contratação realizando o aceite digital.
              </p>
            </div>

            <div className="pt-2">
              <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow" onClick={() => setModalOpen(true)}>
                <CheckSquare className="size-4" /> Aceitar Proposta Comercial
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status da proposta:</span>
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {STATUS_LABELS[data.status] ?? data.status}
            </span>
          </div>
        )}
      </div>

      {/* Acceptance Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Aceitar Proposta Comercial</DialogTitle>
            <DialogDescription className="text-sm">
              Preencha os dados abaixo para formalizar o aceite desta proposta digitalmente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAcceptSubmit} className="space-y-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="signer-name" className="text-xs font-semibold">Nome Completo do Responsável</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Ex: Marina Lopes"
                required
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="signer-email" className="text-xs font-semibold">E-mail Corporativo</Label>
              <Input
                id="signer-email"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="Ex: marina@empresa.com.br"
                required
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="signer-document" className="text-xs font-semibold">CPF / CNPJ do Responsável</Label>
              <Input
                id="signer-document"
                value={signerDocument}
                onChange={(e) => setSignerDocument(formatDocument(e.target.value))}
                placeholder="Ex: 000.000.000-00"
                required
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Assinatura Manual</Label>
              <div className="relative border border-border bg-slate-50/50 rounded-lg overflow-hidden h-[120px] w-full select-none cursor-crosshair">
                <canvas
                  ref={(ref) => {
                    if (ref) {
                      setCanvasRef(ref);
                      if (ref.width !== ref.clientWidth || ref.height !== ref.clientHeight) {
                        ref.width = ref.clientWidth;
                        ref.height = ref.clientHeight;
                      }
                    }
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
                <span>Desenhe sua assinatura no quadro acima</span>
                <button type="button" onClick={clearCanvas} className="text-primary hover:underline font-medium">
                  Limpar
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2">
              <input
                id="accept-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 size-4 rounded border-border text-emerald-600 focus:ring-emerald-500 bg-background"
                required
                disabled={isSubmitting}
              />
              <Label htmlFor="accept-terms" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none">
                Confirmo que sou representante legal/autorizado da empresa contratante e aceito formalmente as condições financeiras, de escopo e prazos estipuladas nesta proposta comercial.
              </Label>
            </div>

            <DialogFooter className="gap-2 pt-3 sm:flex-row-reverse">
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-sm" disabled={isSubmitting || !acceptedTerms}>
                {isSubmitting ? "Processando..." : "Confirmar Assinatura & Aceite"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={isSubmitting} className="text-sm">
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share Proposal Dialog Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg text-foreground">
              <Mail className="size-5 text-primary" /> Enviar Proposta Comercial
            </DialogTitle>
            <DialogDescription className="text-xs">
              Compartilhe a proposta com o cliente via e-mail corporativo ou WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">E-mail do Destinatário</Label>
              <Input
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="text-sm"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Assunto do E-mail</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Assunto da proposta"
                className="text-sm"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Corpo da Mensagem</Label>
              <Textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 flex-col sm:flex-row-reverse sm:justify-between items-stretch">
            <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
              <Button onClick={handleSendOfficialEmail} disabled={sendingEmail} className="flex-1 sm:flex-none font-semibold gap-1.5">
                <Mail className="size-4" /> {sendingEmail ? "Enviando..." : "Enviar E-mail"}
              </Button>
              <Button variant="outline" onClick={() => setShareModalOpen(false)}>
                Cancelar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button type="button" variant="secondary" onClick={handleSendLocalEmail} className="flex-1 sm:flex-none gap-1">
                <ExternalLink className="size-3.5" /> Abrir no E-mail Local
              </Button>
              <Button type="button" variant="secondary" onClick={handleCopyMessage} className="flex-1 sm:flex-none gap-1">
                <Copy className="size-3.5" /> Copiar Mensagem
              </Button>
              <Button type="button" variant="secondary" onClick={copyLink} className="flex-1 sm:flex-none gap-1">
                <Copy className="size-3.5" /> Copiar Link
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
