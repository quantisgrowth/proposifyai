"use client";

import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Tag,
  Layers,
  Building2,
  AlertTriangle,
  Mail,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { ProposalDocument, type DocItem } from "@/components/proposal-document";
import { supabase } from "@/integrations/supabase/client";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  clientsQuery,
  productsQuery,
  companiesQuery,
  proposalByCodeQuery,
  nextProposalCode,
  type PricingType,
  type PricingTier,
  type Company,
} from "@/lib/proposals";
import { brl, pricingLabel, formatDocument } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const paymentOptions = ["Pix", "Boleto", "Cartão de Crédito", "Parcelado", "Transacional"];

type LineItem = {
  key: string;
  product_id?: string | null;
  title: string;
  description: string;
  pricing_type: PricingType;
  quantity: number;
  base_price: number;
  unit_price: number;
  original_price?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  pricing_tiers?: PricingTier[] | null;
  pricing_tier_notes?: string | null;
  item_adjustment_mode: "none" | "discount_percent" | "discount_fixed" | "surcharge_percent" | "surcharge_fixed";
  item_adjustment_val: number;
  is_included: boolean;
  // Tire B2B specifics snapshot
  modelo?: string | null;
  medida?: string | null;
  marca?: string | null;
  posicao?: string | null;
  lonas_pr?: number | null;
  profundidade_sulco_mm?: number | null;
  indice_carga_velocidade?: string | null;
  base_price_avista?: number | null;
  forma_pagamento?: string | null;
  condicao_escolhida?: string | null;
  taxa_percentual?: number | null;
  numero_parcelas?: number | null;
};

const emptyItem = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  title: "",
  description: "",
  pricing_type: "usage_based",
  quantity: 1,
  base_price: 0,
  unit_price: 0,
  original_price: null,
  min_price: null,
  max_price: null,
  pricing_tiers: null,
  pricing_tier_notes: null,
  item_adjustment_mode: "none",
  item_adjustment_val: 0,
  is_included: false,
  modelo: null,
  medida: null,
  marca: null,
  posicao: null,
  lonas_pr: null,
  profundidade_sulco_mm: null,
  indice_carga_velocidade: null,
  base_price_avista: null,
  forma_pagamento: null,
  condicao_escolhida: null,
  taxa_percentual: null,
  numero_parcelas: null,
});

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

interface ProposalEditorProps {
  proposalCode?: string;
  onSaveSuccess?: () => void;
  onCancel?: () => void;
}

export function ProposalEditor({ proposalCode, onSaveSuccess, onCancel }: ProposalEditorProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, company: userCompany, isAdmin, isGestor, activeCompanyId: authActiveCompanyId } = useAuth();
  const isGestorOrAdmin = isAdmin || isGestor;
  const { data: companies } = useQuery(companiesQuery);
  const isMobile = useIsMobile();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return authActiveCompanyId ?? "";
  });

  useEffect(() => {
    if (authActiveCompanyId) {
      setSelectedCompanyId(authActiveCompanyId);
    }
  }, [authActiveCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId && companies && companies.length > 0 && !authActiveCompanyId) {
      const defaultComp = companies.find((c) => c.name.toLowerCase().includes("frotlog")) || companies[0];
      if (defaultComp) setSelectedCompanyId(defaultComp.id);
    }
  }, [companies, selectedCompanyId, authActiveCompanyId]);

  const fallbackCompanyId = useMemo(() => {
    if (companies && companies.length > 0) {
      const defaultComp = companies.find((c) => c.name.toLowerCase().includes("frotlog")) || companies[0];
      return defaultComp?.id ?? null;
    }
    return null;
  }, [companies]);

  const activeCompanyId = (isAdmin ? selectedCompanyId : authActiveCompanyId || userCompany?.id) || fallbackCompanyId || null;
  const activeCompany = useMemo(() => {
    return companies?.find((c) => c.id === activeCompanyId) ?? userCompany ?? null;
  }, [companies, activeCompanyId, userCompany]);

  const isLBTyres = activeCompany?.name?.toLowerCase().includes("lb tyres") || false;

  const { data: clients } = useQuery(clientsQuery(activeCompanyId));
  const { data: products } = useQuery(productsQuery(activeCompanyId));
  const { data: editing } = useQuery({
    ...proposalByCodeQuery(proposalCode ?? ""),
    enabled: Boolean(proposalCode),
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

  const [campaignName, setCampaignName] = useState("Condições Exclusivas");
  const [solutionName, setSolutionName] = useState("");
  const [objectiveText, setObjectiveText] = useState("");
  const [scopeText, setScopeText] = useState("");
  const [fidelityPolicy, setFidelityPolicy] = useState("");
  const [nextStepsText, setNextStepsText] = useState("");

  const [showObjective, setShowObjective] = useState(true);
  const [showScope, setShowScope] = useState(true);
  const [showFidelity, setShowFidelity] = useState(true);
  const [showNextSteps, setShowNextSteps] = useState(true);
  const [objectiveTitle, setObjectiveTitle] = useState("1. Objetivo e Proposta de Valor");
  const [objectiveSubtitle, setObjectiveSubtitle] = useState("");
  const [scopeTitle, setScopeTitle] = useState("2. Funcionalidades & Escopo da Solução");
  const [scopeSubtitle, setScopeSubtitle] = useState("");
  const [fidelityTitle, setFidelityTitle] = useState("Nossa Política de Fidelidade:");
  const [fidelitySubtitle, setFidelitySubtitle] = useState("");
  const [nextStepsTitle, setNextStepsTitle] = useState("Próximos Passos para Ativação");
  const [nextStepsSubtitle, setNextStepsSubtitle] = useState("");

  const [customBlocks, setCustomBlocks] = useState<any[]>([]);
  const [editingBlock, setEditingBlock] = useState<any | null>(null);
  const [blockForm, setBlockForm] = useState({ title: "", subtitle: "", content: "" });
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const openBlockModal = (block?: any, idx?: number) => {
    if (block) {
      setEditingBlock({ ...block, index: idx });
      setBlockForm({
        title: block.title,
        subtitle: block.subtitle || "",
        content: block.content,
      });
    } else {
      setEditingBlock(null);
      setBlockForm({ title: "", subtitle: "", content: "" });
    }
    setBlockModalOpen(true);
  };

  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.title.trim() || !blockForm.content.trim()) {
      toast.error("Preencha o título e o conteúdo do bloco.");
      return;
    }

    if (editingBlock && editingBlock.index !== undefined) {
      // Edit existing local block
      setCustomBlocks((prev) =>
        prev.map((b, i) =>
          i === editingBlock.index
            ? { ...b, title: blockForm.title.trim(), subtitle: blockForm.subtitle.trim() || null, content: blockForm.content.trim() }
            : b
        )
      );
      toast.success("Bloco atualizado!");
    } else {
      // Add new local block
      setCustomBlocks((prev) => [
        ...prev,
        {
          title: blockForm.title.trim(),
          subtitle: blockForm.subtitle.trim() || null,
          content: blockForm.content.trim(),
          position: prev.length,
        },
      ]);
      toast.success("Bloco adicionado!");
    }
    setBlockModalOpen(false);
  };

  const handleDeleteBlock = (idx: number) => {
    if (!confirm("Tem certeza que deseja excluir este bloco?")) return;
    setCustomBlocks((prev) => prev.filter((_, i) => i !== idx).map((b, i) => ({ ...b, position: i })));
    toast.success("Bloco removido!");
  };

  useEffect(() => {
    const loadBlocks = async () => {
      if (editing?.id) {
        const { data, error } = await supabase
          .from("proposal_custom_blocks")
          .select("*")
          .eq("proposal_id", editing.id)
          .order("position", { ascending: true });
        if (!error && data) {
          setCustomBlocks(data);
        }
      } else if (activeCompany?.id) {
        const { data, error } = await supabase
          .from("proposal_custom_blocks")
          .select("*")
          .eq("company_id", activeCompany.id)
          .is("proposal_id", null)
          .order("position", { ascending: true });
        if (!error && data) {
          setCustomBlocks(data.map(b => ({
            title: b.title,
            subtitle: b.subtitle,
            content: b.content,
            position: b.position
          })));
        }
      }
    };
    loadBlocks();
  }, [editing, activeCompany]);

  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [validity, setValidity] = useState(addDays(15));
  const [paymentTerms, setPaymentTerms] = useState("Pix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal de Simulação (Preview)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [simulationProposalCode, setSimulationProposalCode] = useState<string | null>(null);

  useEffect(() => {
    if (activeCompany && !editing) {
      if (activeCompany.solution_name) setSolutionName(activeCompany.solution_name);
      if (activeCompany.objective_text) setObjectiveText(activeCompany.objective_text);
      if (activeCompany.scope_text) setScopeText(activeCompany.scope_text);
      if (activeCompany.fidelity_policy) setFidelityPolicy(activeCompany.fidelity_policy);
      if (activeCompany.next_steps_text) setNextStepsText(activeCompany.next_steps_text);
      if (activeCompany.default_payment_terms) setPaymentTerms(activeCompany.default_payment_terms);
      
      setShowObjective(activeCompany.show_objective !== false);
      setShowScope(activeCompany.show_scope !== false);
      setShowFidelity(activeCompany.show_fidelity !== false);
      setShowNextSteps(activeCompany.show_next_steps !== false);
      
      setObjectiveTitle(activeCompany.objective_title || "1. Objetivo e Proposta de Valor");
      setObjectiveSubtitle(activeCompany.objective_subtitle || "");
      setScopeTitle(activeCompany.scope_title || "2. Funcionalidades & Escopo da Solução");
      setScopeSubtitle(activeCompany.scope_subtitle || "");
      setFidelityTitle(activeCompany.fidelity_title || "Nossa Política de Fidelidade:");
      setFidelitySubtitle(activeCompany.fidelity_subtitle || "");
      setNextStepsTitle(activeCompany.next_steps_title || "Próximos Passos para Ativação");
      setNextStepsSubtitle(activeCompany.next_steps_subtitle || "");
    }
  }, [activeCompany, editing]);

  useEffect(() => {
    if (!editing) return;
    setClientId(editing.client_id ?? "");
    if (editing.company_id) setSelectedCompanyId(editing.company_id);
    setCampaignName(editing.campaign_name || "Condições Exclusivas");
    setSolutionName(editing.solution_name || activeCompany?.solution_name || "");
    setObjectiveText(editing.objective_text || "");
    setScopeText(editing.scope_text || "");
    setFidelityPolicy(editing.fidelity_policy || "");
    setNextStepsText(editing.next_steps_text || "");

    setShowObjective((editing as any).show_objective !== false);
    setShowScope((editing as any).show_scope !== false);
    setShowFidelity((editing as any).show_fidelity !== false);
    setShowNextSteps((editing as any).show_next_steps !== false);

    setObjectiveTitle((editing as any).objective_title || activeCompany?.objective_title || "1. Objetivo e Proposta de Valor");
    setObjectiveSubtitle((editing as any).objective_subtitle || activeCompany?.objective_subtitle || "");
    setScopeTitle((editing as any).scope_title || activeCompany?.scope_title || "2. Funcionalidades & Escopo da Solução");
    setScopeSubtitle((editing as any).scope_subtitle || activeCompany?.scope_subtitle || "");
    setFidelityTitle((editing as any).fidelity_title || activeCompany?.fidelity_title || "Nossa Política de Fidelidade:");
    setFidelitySubtitle((editing as any).fidelity_subtitle || activeCompany?.fidelity_subtitle || "");
    setNextStepsTitle((editing as any).next_steps_title || activeCompany?.next_steps_title || "Próximos Passos para Ativação");
    setNextStepsSubtitle((editing as any).next_steps_subtitle || activeCompany?.next_steps_subtitle || "");

    setItems(
      editing.proposal_items.map((i) => ({
        key: i.id,
        product_id: i.product_id,
        title: i.title,
        description: i.description ?? "",
        pricing_type: i.pricing_type,
        quantity: Number(i.quantity),
        base_price: i.base_price_avista ? Number(i.base_price_avista) : Number(i.unit_price),
        unit_price: Number(i.unit_price),
        original_price: i.original_price ? Number(i.original_price) : null,
        min_price: (i as any).min_price ? Number((i as any).min_price) : null,
        max_price: (i as any).max_price ? Number((i as any).max_price) : null,
        pricing_tiers: (i as any).pricing_tiers || null,
        pricing_tier_notes: (i as any).pricing_tier_notes || null,
        item_adjustment_mode: "none",
        item_adjustment_val: 0,
        is_included: i.is_included ?? false,
        // Tire fields snapshot
        modelo: i.modelo || null,
        medida: i.medida || null,
        marca: i.marca || null,
        posicao: i.posicao || null,
        lonas_pr: i.lonas_pr ? Number(i.lonas_pr) : null,
        profundidade_sulco_mm: i.profundidade_sulco_mm ? Number(i.profundidade_sulco_mm) : null,
        indice_carga_velocidade: i.indice_carga_velocidade || null,
        base_price_avista: i.base_price_avista ? Number(i.base_price_avista) : null,
        forma_pagamento: i.forma_pagamento || null,
        condicao_escolhida: i.condicao_escolhida || null,
        taxa_percentual: i.taxa_percentual ? Number(i.taxa_percentual) : null,
        numero_parcelas: i.numero_parcelas ? Number(i.numero_parcelas) : null,
      }))
    );
    setDiscountMode("fixed");
    setDiscountValue(Number(editing.discount_amount));
    setValidity(editing.validity_date ?? addDays(15));
    setPaymentTerms(editing.payment_terms ?? "Pix");
    setNotes(editing.notes ?? "");
  }, [editing, activeCompany]);

  const selectedClient = useMemo(
    () => (clients ?? []).find((c) => c.id === clientId) ?? null,
    [clients, clientId]
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
      min_price: i.min_price,
      max_price: i.max_price,
      pricing_tiers: i.pricing_tiers,
      pricing_tier_notes: i.pricing_tier_notes,
      is_included: i.is_included,
      total_price: i.quantity * i.unit_price,
      // Tire snap
      modelo: i.modelo,
      medida: i.medida,
      marca: i.marca,
      posicao: i.posicao,
      lonas_pr: i.lonas_pr,
      profundidade_sulco_mm: i.profundidade_sulco_mm,
      indice_carga_velocidade: i.indice_carga_velocidade,
      base_price_avista: i.base_price_avista,
      forma_pagamento: i.forma_pagamento,
      condicao_escolhida: i.condicao_escolhida,
      taxa_percentual: i.taxa_percentual,
      numero_parcelas: i.numero_parcelas,
    }));

  const updateItem = (key: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, ...patch };

        if (updated.medida) {
          const avista = Number(updated.base_price_avista) || 0;
          const taxa = Number(updated.taxa_percentual) || 0;
          updated.unit_price = Number((avista * (1 + taxa)).toFixed(2));
          updated.base_price = avista;
        } else if (patch.item_adjustment_mode !== undefined || patch.item_adjustment_val !== undefined) {
          const base = updated.base_price || updated.unit_price;
          let calculated = base;
          const val = updated.item_adjustment_val || 0;

          if (updated.item_adjustment_mode === "discount_percent") {
            calculated = Math.max(0, base - (base * val) / 100);
            updated.original_price = base;
          } else if (updated.item_adjustment_mode === "discount_fixed") {
            calculated = Math.max(0, base - val);
            updated.original_price = base;
          } else if (updated.item_adjustment_mode === "surcharge_percent") {
            calculated = base + (base * val) / 100;
            updated.original_price = base;
          } else if (updated.item_adjustment_mode === "surcharge_fixed") {
            calculated = base + val;
            updated.original_price = base;
          } else {
            calculated = base;
          }

          updated.unit_price = calculated;
        }

        return updated;
      })
    );
  };

  const applyProduct = (key: string, productId: string) => {
    const product = (products ?? []).find((p) => p.id === productId);
    if (!product) return;
    const price = Number(product.unit_price) || 0;

    updateItem(key, {
      product_id: product.id,
      title: product.name,
      description: product.description ?? "",
      pricing_type: product.pricing_type,
      base_price: product.base_price_avista ? Number(product.base_price_avista) : price,
      unit_price: price,
      original_price: null,
      min_price: product.min_price ? Number(product.min_price) : null,
      max_price: product.max_price ? Number(product.max_price) : null,
      pricing_tiers: product.pricing_tiers || null,
      pricing_tier_notes: product.pricing_tier_notes || null,
      item_adjustment_mode: "none",
      item_adjustment_val: 0,
      is_included: price === 0,
      // copy tire B2B specific fields
      modelo: product.modelo || null,
      medida: product.medida || null,
      marca: product.marca || null,
      posicao: product.posicao || null,
      lonas_pr: product.lonas_pr ? Number(product.lonas_pr) : null,
      profundidade_sulco_mm: product.profundidade_sulco_mm ? Number(product.profundidade_sulco_mm) : null,
      indice_carga_velocidade: product.indice_carga_velocidade || null,
      base_price_avista: product.base_price_avista ? Number(product.base_price_avista) : null,
      forma_pagamento: product.forma_pagamento || null,
      condicao_escolhida: product.condicao_escolhida || null,
      taxa_percentual: product.taxa_percentual ? Number(product.taxa_percentual) : null,
      numero_parcelas: product.numero_parcelas ? Number(product.numero_parcelas) : null,
    });
  };

  const saveClient = async () => {
    if (!newClient.name.trim()) {
      toast.error("Informe a razão social ou nome");
      return;
    }
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...newClient, company_id: activeCompanyId })
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

  const save = async (status: "draft" | "sent", silent = false): Promise<string | null> => {
    if (!clientId) {
      toast.error("Selecione um cliente");
      return null;
    }
    if (docItems.length === 0) {
      toast.error("Adicione ao menos um item ao escopo");
      return null;
    }

    if (activeCompany?.require_all_fields) {
      if (!campaignName.trim()) {
        toast.error("O campo 'Campanha' é obrigatório para esta empresa.");
        return null;
      }
      if (!solutionName.trim()) {
        toast.error("O campo 'Solução' é obrigatório para esta empresa.");
        return null;
      }
      if (showObjective && !objectiveText.trim()) {
        toast.error("O campo 'Objetivo' é obrigatório para esta empresa.");
        return null;
      }
      if (showScope && !scopeText.trim()) {
        toast.error("O campo 'Funcionalidades e Escopo' é obrigatório para esta empresa.");
        return null;
      }
      if (showFidelity && !fidelityPolicy.trim()) {
        toast.error("O campo 'Fidelidade' é obrigatório para esta empresa.");
        return null;
      }
      if (showNextSteps && !nextStepsText.trim()) {
        toast.error("O campo 'Próximos Passos' é obrigatório para esta empresa.");
        return null;
      }
      if (!validity) {
        toast.error("O campo 'Validade' é obrigatório para esta empresa.");
        return null;
      }
      if (!paymentTerms) {
        toast.error("O campo 'Condição de Pagamento' é obrigatório para esta empresa.");
        return null;
      }
    }

    if (!silent) setSaving(true);

    try {
      const payload = {
        client_id: clientId,
        company_id: activeCompanyId,
        created_by: profile?.id ?? null,
        campaign_name: campaignName.trim(),
        solution_name: solutionName.trim(),
        objective_text: objectiveText.trim() || null,
        scope_text: scopeText.trim() || null,
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
        show_objective: showObjective,
        show_scope: showScope,
        show_fidelity: showFidelity,
        show_next_steps: showNextSteps,
        objective_title: objectiveTitle.trim() || null,
        objective_subtitle: objectiveSubtitle.trim() || null,
        scope_title: scopeTitle.trim() || null,
        scope_subtitle: scopeSubtitle.trim() || null,
        fidelity_title: fidelityTitle.trim() || null,
        fidelity_subtitle: fidelitySubtitle.trim() || null,
        next_steps_title: nextStepsTitle.trim() || null,
        next_steps_subtitle: nextStepsSubtitle.trim() || null,
      };

      let proposalId = editing?.id;
      let proposalCode = editing?.proposal_code;

      if (proposalId) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", proposalId);
        if (error) throw error;
      } else {
        const code = await nextProposalCode();
        const { data, error } = await supabase
          .from("proposals")
          .insert({ ...payload, proposal_code: code })
          .select("*")
          .single();
        if (error) throw error;
        proposalId = data.id;
        proposalCode = data.proposal_code;
      }

      await supabase.from("proposal_items").delete().eq("proposal_id", proposalId!);

      const rows = docItems.map((item, index) => {
        const original = items[index];
        return {
          proposal_id: proposalId!,
          product_id: original?.product_id || null,
          title: item.title,
          description: item.description || null,
          pricing_type: item.pricing_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          original_price: item.original_price || null,
          is_included: item.is_included || false,
          total_price: item.total_price,
          position: index + 1,
          // snapshots
          modelo: original?.modelo || null,
          medida: original?.medida || null,
          marca: original?.marca || null,
          posicao: original?.posicao || null,
          lonas_pr: original?.lonas_pr ? Number(original.lonas_pr) : null,
          profundidade_sulco_mm: original?.profundidade_sulco_mm ? Number(original.profundidade_sulco_mm) : null,
          indice_carga_velocidade: original?.indice_carga_velocidade || null,
          base_price_avista: original?.base_price_avista ? Number(original.base_price_avista) : null,
          forma_pagamento: original?.forma_pagamento || null,
          condicao_escolhida: original?.condicao_escolhida || null,
          taxa_percentual: original?.taxa_percentual ? Number(original.taxa_percentual) : null,
          numero_parcelas: original?.numero_parcelas ? Number(original.numero_parcelas) : null,
        };
      });

      const { error: itemsError } = await supabase.from("proposal_items").insert(rows);
      if (itemsError) throw itemsError;

      // Save custom blocks
      if (proposalId) {
        const { error: deleteBlocksError } = await supabase
          .from("proposal_custom_blocks")
          .delete()
          .eq("proposal_id", proposalId);
        if (deleteBlocksError) throw deleteBlocksError;

        if (customBlocks.length > 0) {
          const insertRows = customBlocks.map((b, idx) => ({
            company_id: activeCompanyId,
            proposal_id: proposalId,
            title: b.title,
            subtitle: b.subtitle || null,
            content: b.content,
            position: idx,
          }));
          const { error: insertBlocksError } = await supabase
            .from("proposal_custom_blocks")
            .insert(insertRows);
          if (insertBlocksError) throw insertBlocksError;
        }
      }

      await qc.invalidateQueries({ queryKey: ["proposals"] });
      
      if (!silent) {
        toast.success(status === "sent" ? "Proposta enviada!" : "Rascunho salvo!");
        if (onSaveSuccess) {
          onSaveSuccess();
        } else {
          navigate({ to: "/" });
        }
      }
      return proposalCode ?? null;
    } catch (err: unknown) {
      console.error("Erro detalhado ao salvar proposta:", err);
      const msg =
        (err as any)?.message ||
        (err as any)?.error_description ||
        (err instanceof Error ? err.message : "Erro ao salvar proposta.");
      toast.error(msg);
      return null;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleVisualizarSimulacao = async () => {
    // 1. Salva como rascunho de forma silenciosa para registrar as alterações
    const code = await save("draft", true);
    if (code) {
      setSimulationProposalCode(code);
      setPreviewOpen(true);
    }
  };

  const handleEnviarPropostaDeSimulacao = async () => {
    if (!simulationProposalCode) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("proposal_code", simulationProposalCode);
      if (error) throw error;
      
      toast.success("Proposta enviada com sucesso!");
      setPreviewOpen(false);
      await qc.invalidateQueries({ queryKey: ["proposals"] });
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar proposta.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!simulationProposalCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/proposta/${simulationProposalCode}`);
      toast.success("Link da proposta copiado!");
    } catch {
      toast.error("Erro ao copiar o link");
    }
  };

  const form = (
    <div className="space-y-8">
      {/* PASSO 1: CLIENTE, EMPRESA EMISSORA E CAMPANHA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <h2 className="text-lg font-semibold">Cliente & Empresa Emissora</h2>
        </div>

        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          {isAdmin && (companies ?? []).length > 0 ? (
            <div className="grid gap-1.5 pb-3 border-b border-border bg-secondary/15 p-3 rounded-lg">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" /> Empresa Emissora da Proposta
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="text-xs bg-background">
                  <SelectValue placeholder="Selecione a empresa emissora" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.document ? `(${c.document})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Carrega o catálogo, logo e regras da empresa selecionada.
              </p>
            </div>
          ) : null}

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
                  placeholder="Ex: Transportadora Fadel LTDA"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">CNPJ / CPF</Label>
                <Input
                  value={newClient.document}
                  onChange={(e) => setNewClient({ ...newClient, document: formatDocument(e.target.value) })}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className={`grid gap-1.5 ${!isGestorOrAdmin ? "sm:col-span-2" : ""}`}>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="size-3 text-primary" /> Campanha Especial
              </Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Condições Exclusivas - Feira 2026"
              />
            </div>
            {isGestorOrAdmin && (
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
            )}
          </div>
        </div>
      </section>

      {/* PASSO 2: ESCOPO, PRODUTOS E REGRAS DE PREÇO */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <h2 className="text-lg font-semibold">Itens do Escopo & Condições Comerciais</h2>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const hasMinViolation = item.min_price && item.unit_price < item.min_price;
            const hasMaxViolation = item.max_price && item.unit_price > item.max_price;

            return (
              <div key={item.key} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Select
                      value={item.product_id ?? ""}
                      onValueChange={(v) => applyProduct(item.key, v)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder={`Item ${index + 1} — Puxar do catálogo (${(products ?? []).length} disponíveis)`} />
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
                    type="button"
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
                      placeholder="Ex: Transação (Pagamento)"
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

                  {item.medida ? (
                    <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 mt-2">
                      <div className="flex items-center justify-between border-b border-primary/10 pb-1.5">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          🚗 Precificação de Pneu (Snap B2B)
                        </span>
                        <span className="text-[10px] text-primary/80 font-bold bg-primary/10 px-2 py-0.5 rounded">
                          {item.marca} {item.modelo} · {item.medida}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="grid gap-1">
                          <Label className="text-[10px] text-muted-foreground">Preço à Vista</Label>
                          <CurrencyInput
                            value={item.base_price_avista || 0}
                            onChange={(val) => updateItem(item.key, { base_price_avista: val })}
                            placeholder="R$ 0,00"
                            className="h-8.5 text-xs"
                          />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[10px] text-muted-foreground">Forma de Pagamento</Label>
                          <Select
                            value={item.forma_pagamento ?? "PIX_AVISTA"}
                            onValueChange={(val) => updateItem(item.key, { forma_pagamento: val })}
                          >
                            <SelectTrigger className="h-8.5 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PIX_AVISTA">PIX à Vista</SelectItem>
                              <SelectItem value="BOLETO_PRAZO">Boleto a Prazo</SelectItem>
                              <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[10px] text-muted-foreground">Condição</Label>
                          <Input
                            value={item.condicao_escolhida ?? ""}
                            onChange={(e) => updateItem(item.key, { condicao_escolhida: e.target.value })}
                            placeholder="Ex: PM60"
                            className="h-8.5 text-xs"
                          />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[10px] text-muted-foreground">Taxa Percentual (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.taxa_percentual ? Number((item.taxa_percentual * 100).toFixed(2)) : ""}
                            onChange={(e) => {
                              const rate = parseFloat(e.target.value) / 100 || 0;
                              updateItem(item.key, { taxa_percentual: rate });
                            }}
                            placeholder="Ex: 4.00"
                            className="h-8.5 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                        <div className="grid gap-1">
                          <Label className="text-[10px] text-muted-foreground">Parcelas</Label>
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            value={item.numero_parcelas || 1}
                            onChange={(e) => updateItem(item.key, { numero_parcelas: parseInt(e.target.value) || 1 })}
                            placeholder="1"
                            className="h-8.5 text-xs"
                          />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-[10px] text-muted-foreground">Quantidade</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) || 1 })}
                            className="h-8.5 text-xs"
                          />
                        </div>

                        <div className="grid gap-1 col-span-2 bg-primary/10 rounded-lg p-2 text-[11px] text-primary font-medium border border-primary/20 space-y-1.5">
                          <div className="flex justify-between">
                            <span>Total Unitário: <strong>{brl(item.unit_price)}</strong></span>
                            <span>Plano: <strong>{item.numero_parcelas}x de {brl(item.unit_price / (item.numero_parcelas || 1))}</strong></span>
                          </div>
                          {item.profundidade_sulco_mm ? (
                            <div className="text-[9px] text-primary/80 border-t border-primary/10 pt-1 flex justify-between">
                              <span>Custo por mm: <strong>{brl((item.base_price_avista || 0) / Number(item.profundidade_sulco_mm))}/mm</strong></span>
                              <span>Sulco: {item.profundidade_sulco_mm}mm | Lonas: {item.lonas_pr}PR</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          <Label className="text-xs font-semibold text-foreground">Condição Especial (R$)</Label>
                          <CurrencyInput
                            value={item.unit_price}
                            onChange={(val) => updateItem(item.key, { unit_price: val })}
                            placeholder="R$ 0,00"
                          />
                        </div>
                      </div>

                      {hasMinViolation ? (
                        <div className="sm:col-span-2 flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-medium">
                          <AlertTriangle className="size-4 shrink-0" />
                          <span>
                            Atenção: O valor de <strong>{brl(item.unit_price)}</strong> está abaixo do piso mínimo permitido de <strong>{brl(item.min_price!)}</strong>.
                          </span>
                        </div>
                      ) : null}

                      {hasMaxViolation ? (
                        <div className="sm:col-span-2 flex items-center gap-2 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-medium">
                          <AlertTriangle className="size-4 shrink-0" />
                          <span>
                            Atenção: O valor de <strong>{brl(item.unit_price)}</strong> ultrapassa o teto máximo permitido de <strong>{brl(item.max_price!)}</strong>.
                          </span>
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:col-span-2 bg-secondary/20 p-3 rounded-lg border border-border">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-primary" /> Ajuste Comercial no Item (Desconto / Acréscimo)
                          </Label>
                          {item.min_price || item.max_price ? (
                            <span className="text-[10px] text-muted-foreground">
                              Limites: Mín {item.min_price ? brl(item.min_price) : "—"} · Máx {item.max_price ? brl(item.max_price) : "—"}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 items-center pt-1">
                          <Select
                            value={item.item_adjustment_mode}
                            onValueChange={(v) =>
                              updateItem(item.key, { item_adjustment_mode: v as any })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem ajuste no item</SelectItem>
                              <SelectItem value="discount_percent">Desconto (%)</SelectItem>
                              <SelectItem value="discount_fixed">Desconto (R$)</SelectItem>
                              <SelectItem value="surcharge_percent">Acréscimo (%)</SelectItem>
                              <SelectItem value="surcharge_fixed">Acréscimo (R$)</SelectItem>
                            </SelectContent>
                          </Select>

                          {item.item_adjustment_mode !== "none" ? (
                            <div className="flex items-center gap-2">
                              {item.item_adjustment_mode.includes("fixed") ? (
                                <CurrencyInput
                                  value={item.item_adjustment_val || 0}
                                  onChange={(val) =>
                                    updateItem(item.key, { item_adjustment_val: val })
                                  }
                                  placeholder="Ex: R$ 1,50"
                                  className="h-8 text-xs"
                                />
                              ) : (
                                <div className="relative flex items-center flex-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    value={item.item_adjustment_val || ""}
                                    onChange={(e) =>
                                      updateItem(item.key, { item_adjustment_val: Number(e.target.value) || 0 })
                                    }
                                    placeholder="Ex: 10"
                                    className="h-8 text-xs pr-7 text-right font-medium"
                                  />
                                  <span className="absolute right-2.5 text-xs text-muted-foreground font-semibold">%</span>
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Preço Tabela:</Label>
                            <CurrencyInput
                              value={item.original_price ?? (item.item_adjustment_mode !== "none" ? item.base_price : 0)}
                              onChange={(val) => updateItem(item.key, { original_price: val || null })}
                              placeholder="Ex: R$ 5,00"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5 hover:border-primary transition-all font-semibold"
          >
            <Plus className="size-4" /> Adicionar Item ao Escopo
          </Button>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:items-end sm:gap-4">
              <div className="grid min-w-0 gap-1.5 flex-1">
                <Label className="text-xs">Desconto Global Adicional (no Total da Proposta)</Label>
                {discountMode === "fixed" ? (
                  <CurrencyInput
                    value={discountValue}
                    onChange={(val) => setDiscountValue(val)}
                    placeholder="Ex: R$ 100,00"
                    className="h-9 text-xs font-semibold text-right"
                  />
                ) : (
                  <div className="relative flex items-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={discountValue || ""}
                      onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                      placeholder="Ex: 10"
                      className="h-9 text-xs pr-7 text-right font-medium"
                    />
                    <span className="absolute right-2.5 text-xs text-muted-foreground font-semibold">%</span>
                  </div>
                )}
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
                  <span>Desconto Global</span>
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
                  type="button"
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

      {/* PASSO 4: TEXTOS DA PROPOSTA */}
      {isGestorOrAdmin && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                4
              </span>
              <h2 className="text-lg font-semibold">Textos & Seções da Proposta</h2>
            </div>
          </div>

          <div className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            {/* Seção 1: Objetivo */}
            <div className="space-y-4 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Objetivo e Proposta de Valor</Label>
                  <p className="text-xs text-muted-foreground">Exibe a apresentação geral e objetivos da solução.</p>
                </div>
                <Switch
                  checked={showObjective}
                  onCheckedChange={setShowObjective}
                />
              </div>

              {showObjective && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={objectiveTitle}
                      onChange={(e) => setObjectiveTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução</Label>
                    <Input
                      value={objectiveSubtitle}
                      onChange={(e) => setObjectiveSubtitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Conteúdo</Label>
                    <Textarea
                      rows={3}
                      value={objectiveText}
                      onChange={(e) => setObjectiveText(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seção 2: Funcionalidades */}
            <div className="space-y-4 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Funcionalidades & Escopo</Label>
                  <p className="text-xs text-muted-foreground">Exibe a lista de funcionalidades ou serviços incluídos.</p>
                </div>
                <Switch
                  checked={showScope}
                  onCheckedChange={setShowScope}
                />
              </div>

              {showScope && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={scopeTitle}
                      onChange={(e) => setScopeTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução</Label>
                    <Input
                      value={scopeSubtitle}
                      onChange={(e) => setScopeSubtitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Conteúdo (Uma por linha: Título: Descrição)</Label>
                    <Textarea
                      rows={4}
                      value={scopeText}
                      onChange={(e) => setScopeText(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seção 3: Fidelidade */}
            <div className="space-y-4 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Política de Fidelidade</Label>
                  <p className="text-xs text-muted-foreground">Termos de permanência, carência ou rescisão contratual.</p>
                </div>
                <Switch
                  checked={showFidelity}
                  onCheckedChange={setShowFidelity}
                />
              </div>

              {showFidelity && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={fidelityTitle}
                      onChange={(e) => setFidelityTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução</Label>
                    <Input
                      value={fidelitySubtitle}
                      onChange={(e) => setFidelitySubtitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Conteúdo</Label>
                    <Textarea
                      rows={2}
                      value={fidelityPolicy}
                      onChange={(e) => setFidelityPolicy(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seção 4: Próximos Passos */}
            <div className="space-y-4 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Próximos Passos para Ativação</Label>
                  <p className="text-xs text-muted-foreground">Etapas numeradas após a assinatura da proposta.</p>
                </div>
                <Switch
                  checked={showNextSteps}
                  onCheckedChange={setShowNextSteps}
                />
              </div>

              {showNextSteps && (
                <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/20">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Título da Seção</Label>
                    <Input
                      value={nextStepsTitle}
                      onChange={(e) => setNextStepsTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Subtítulo / Introdução</Label>
                    <Input
                      value={nextStepsSubtitle}
                      onChange={(e) => setNextStepsSubtitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Conteúdo (Uma por linha)</Label>
                    <Textarea
                      rows={3}
                      value={nextStepsText}
                      onChange={(e) => setNextStepsText(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Blocos Adicionais Customizados Específicos da Proposta */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Layers className="size-4 text-primary" /> Blocos Adicionais Customizados
                  </Label>
                  <p className="text-xs text-muted-foreground">Inclua novos blocos exclusivos para esta proposta.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openBlockModal()}
                  className="gap-1.5 font-semibold text-xs bg-transparent hover:bg-accent"
                >
                  <Plus className="size-3.5" /> Novo Bloco
                </Button>
              </div>

              {customBlocks && customBlocks.length > 0 ? (
                <div className="grid gap-3 pt-2 pl-4 border-l-2 border-primary/20">
                  {customBlocks.map((block: any, idx: number) => (
                    <div key={block.id || idx} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/5">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{block.title}</h4>
                        {block.subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{block.subtitle}</p>}
                        <p className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-1 italic">{block.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openBlockModal(block, idx)}
                        >
                          <Edit2 className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBlock(idx)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* BOTÕES DE AÇÃO */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => save("draft", false)}
          className="h-11 cursor-pointer"
        >
          Salvar Rascunho
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={handleVisualizarSimulacao}
          className="h-11 flex-1 font-semibold cursor-pointer"
        >
          {saving ? "Carregando..." : "Visualizar Simulação (Enviar Proposta)"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="h-11 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancelar
          </Button>
        )}
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
        scopeText: scopeText || undefined,
        fidelityPolicy: fidelityPolicy || undefined,
        nextStepsText: nextStepsText || undefined,
        items: docItems,
        total: subtotal,
        discount,
        net,
        validityDate: validity,
        paymentTerms,
        notes,
        company: activeCompany,
        show_objective: showObjective,
        show_scope: showScope,
        show_fidelity: showFidelity,
        show_next_steps: showNextSteps,
        objective_title: objectiveTitle,
        objective_subtitle: objectiveSubtitle,
        scope_title: scopeTitle,
        scope_subtitle: scopeSubtitle,
        fidelity_title: fidelityTitle,
        fidelity_subtitle: fidelitySubtitle,
        next_steps_title: nextStepsTitle,
        next_steps_subtitle: nextStepsSubtitle,
        custom_blocks: customBlocks,
      }}
    />
  );

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-background">
      <div className="hidden lg:block w-full flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="min-h-[75vh] items-stretch gap-0 border border-border rounded-xl bg-card overflow-hidden">
          <ResizablePanel defaultSize={52} minSize={30} className="p-6 overflow-y-auto max-h-[75vh] scrollbar-thin">
            {form}
          </ResizablePanel>
          <ResizableHandle withHandle className="hover:bg-primary/20 transition-colors" />
          <ResizablePanel defaultSize={48} minSize={30} className="p-6 overflow-y-auto max-h-[75vh] bg-secondary/5 scrollbar-thin">
            {preview}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Tabs defaultValue="form" className="lg:hidden w-full">
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

      {/* Dialog do Modal de Simulação (Visualização Completa com Envio) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-none bg-card overflow-hidden select-text shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card/65">
            <DialogTitle className="text-lg font-bold text-foreground">
              Visualizar Simulação da Proposta
            </DialogTitle>
            <DialogDescription className="text-xs">
              Revise o documento gerado com a identidade oficial antes do envio definitivo para o cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-secondary/15">
            <div className="max-w-3xl mx-auto bg-background rounded-xl shadow-sm border border-border p-4">
              {preview}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card/65 gap-2.5 flex-col sm:flex-row sm:justify-between items-stretch">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="button" variant="secondary" onClick={handleCopyLink} className="flex-1 sm:flex-none gap-1.5 cursor-pointer">
                <Copy className="size-4" /> Copiar Link
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
              <Button onClick={() => setPreviewOpen(false)} variant="outline" className="cursor-pointer">
                Fechar
              </Button>
              <Button onClick={handleEnviarPropostaDeSimulacao} disabled={saving} className="flex-1 sm:flex-none font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95">
                <Check className="size-4" /> Enviar Proposta
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Criar/Editar Bloco Customizado Local */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? "Editar Bloco Customizado" : "Adicionar Bloco Customizado"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBlock} className="space-y-4 pt-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Título do Bloco</Label>
              <Input
                value={blockForm.title}
                onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })}
                placeholder="Ex: Condições de Entrega & Frete"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Subtítulo / Frase de Introdução (Opcional)</Label>
              <Input
                value={blockForm.subtitle}
                onChange={(e) => setBlockForm({ ...blockForm, subtitle: e.target.value })}
                placeholder="Ex: Prazos e termos de frete aplicáveis..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Conteúdo do Bloco</Label>
              <Textarea
                rows={5}
                value={blockForm.content}
                onChange={(e) => setBlockForm({ ...blockForm, content: e.target.value })}
                placeholder="Insira o texto completo do bloco..."
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBlockModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingBlock ? "Salvar Alterações" : "Adicionar Bloco"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
