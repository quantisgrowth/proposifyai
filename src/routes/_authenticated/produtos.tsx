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
  Copy,
  Upload,
  Download,
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
  modelo: "",
  medida: "",
  marca: "",
  posicao: "Direcional",
  lonas_pr: 16,
  profundidade_sulco_mm: 15.0,
  indice_carga_velocidade: "",
  base_price_avista: 0,
  forma_pagamento: "PIX_AVISTA",
  condicao_escolhida: "PM30",
  taxa_percentual: 0,
  numero_parcelas: 1,
};

function ProductsPage() {
  const qc = useQueryClient();
  const { profile, company, isAdmin, activeCompanyId } = useAuth();
  const { data: companies } = useQuery(companiesQuery);

  // States for CSV import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const activeCompanyFilter = activeCompanyId || company?.id || null;

  const { data: products, isLoading } = useQuery(productsQuery(activeCompanyFilter));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [searchTerm, setSearchTerm] = useState("");

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      ...emptyProduct,
      company_id: activeCompanyFilter ?? "",
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
      company_id: p.company_id ?? (activeCompanyId ?? ""),
      pricing_tiers: Array.isArray(p.pricing_tiers) ? p.pricing_tiers : [],
      pricing_tier_notes: p.pricing_tier_notes ?? "",
      modelo: p.modelo ?? "",
      medida: p.medida ?? "",
      marca: p.marca ?? "",
      posicao: p.posicao ?? "Direcional",
      lonas_pr: p.lonas_pr ? Number(p.lonas_pr) : 16,
      profundidade_sulco_mm: p.profundidade_sulco_mm ? Number(p.profundidade_sulco_mm) : 15.0,
      indice_carga_velocidade: p.indice_carga_velocidade ?? "",
      base_price_avista: p.base_price_avista ? Number(p.base_price_avista) : 0,
      forma_pagamento: p.forma_pagamento ?? "PIX_AVISTA",
      condicao_escolhida: p.condicao_escolhida ?? "PM30",
      taxa_percentual: p.taxa_percentual ? Number(p.taxa_percentual) : 0,
      numero_parcelas: p.numero_parcelas ? Number(p.numero_parcelas) : 1,
    });
    setModalOpen(true);
  };

  const handleDuplicate = (p: Product) => {
    setEditing(null);
    setForm({
      name: `${p.name} (Cópia)`,
      description: p.description ?? "",
      unit_price: Number(p.unit_price) || 0,
      min_price: p.min_price ? Number(p.min_price) : 0,
      max_price: p.max_price ? Number(p.max_price) : 0,
      pricing_type: p.pricing_type,
      company_id: p.company_id ?? (activeCompanyId ?? ""),
      pricing_tiers: Array.isArray(p.pricing_tiers) ? p.pricing_tiers.map(t => ({ ...t })) : [],
      pricing_tier_notes: p.pricing_tier_notes ?? "",
      modelo: p.modelo ?? "",
      medida: p.medida ?? "",
      marca: p.marca ?? "",
      posicao: p.posicao ?? "Direcional",
      lonas_pr: p.lonas_pr ? Number(p.lonas_pr) : 16,
      profundidade_sulco_mm: p.profundidade_sulco_mm ? Number(p.profundidade_sulco_mm) : 15.0,
      indice_carga_velocidade: p.indice_carga_velocidade ?? "",
      base_price_avista: p.base_price_avista ? Number(p.base_price_avista) : 0,
      forma_pagamento: p.forma_pagamento ?? "PIX_AVISTA",
      condicao_escolhida: p.condicao_escolhida ?? "PM30",
      taxa_percentual: p.taxa_percentual ? Number(p.taxa_percentual) : 0,
      numero_parcelas: p.numero_parcelas ? Number(p.numero_parcelas) : 1,
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
      next[idx] = { range: "", price: 0, ...next[idx], ...patch };
      return { ...prev, pricing_tiers: next };
    });
  };

  const removeTier = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      pricing_tiers: prev.pricing_tiers.filter((_, i) => i !== idx),
    }));
  };

  const currentCompany = companies?.find((c) => c.id === (editing ? form.company_id : activeCompanyFilter)) || company;
  const isLBTyres = currentCompany?.name?.toLowerCase().includes("lb tyres") || false;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do serviço");
      const targetCompanyId = form.company_id || activeCompanyId || (companies?.[0]?.id ?? null);
      const activeComp = companies?.find((c) => c.id === targetCompanyId) || company;
      const isLBTyresSave = activeComp?.name?.toLowerCase().includes("lb tyres") || false;
      
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
        // Tire fields
        modelo: isLBTyresSave ? form.modelo.trim() || null : null,
        medida: isLBTyresSave ? form.medida.trim() || null : null,
        marca: isLBTyresSave ? form.marca.trim() || null : null,
        posicao: isLBTyresSave ? form.posicao : null,
        lonas_pr: isLBTyresSave ? Number(form.lonas_pr) || null : null,
        profundidade_sulco_mm: isLBTyresSave ? Number(form.profundidade_sulco_mm) || null : null,
        indice_carga_velocidade: isLBTyresSave ? form.indice_carga_velocidade.trim() || null : null,
        base_price_avista: isLBTyresSave ? Number(form.base_price_avista) || null : null,
        forma_pagamento: isLBTyresSave ? form.forma_pagamento : null,
        condicao_escolhida: isLBTyresSave ? form.condicao_escolhida.trim() || null : null,
        taxa_percentual: isLBTyresSave ? Number(form.taxa_percentual) || 0 : null,
        numero_parcelas: isLBTyresSave ? Number(form.numero_parcelas) || 1 : null,
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


  const handleDownloadTemplate = () => {
    const headers = [
      "Nome",
      "Descricao",
      "Preco_Base_Avista",
      "Marca",
      "Modelo",
      "Medida",
      "Posicao",
      "Lonas",
      "Sulco_mm",
      "Indice_Carga",
      "Forma_Pagamento",
      "Condicao_Prazo",
      "Taxa_Percentual",
      "Parcelas"
    ];
    
    const rows = [
      headers.join(";"),
      `XBRI CAR-603 - 295/80R22.5;Pneu de alta tração e durabilidade;1500.00;XBRI;CAR-603;295/80R22.5;Tração;18;22.0;152/149M;BOLETO_PRAZO;PM60;0.04;3`,
      `Neo Curve P1 - 275/80R22.5;Pneu direcional premium;1420.00;Chengshan;Neo Curve P1;275/80R22.5;Direcional;16;15.5;149/146L;PIX_AVISTA;PM30;0.00;1`
    ];

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_proposify.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      toast.error("Nenhum produto cadastrado para exportar.");
      return;
    }

    const headers = [
      "Nome",
      "Descricao",
      "Preco_Base_Avista",
      "Marca",
      "Modelo",
      "Medida",
      "Posicao",
      "Lonas",
      "Sulco_mm",
      "Indice_Carga",
      "Forma_Pagamento",
      "Condicao_Prazo",
      "Taxa_Percentual",
      "Parcelas"
    ];

    const rows = [
      headers.join(";"),
      ...products.map((p) => [
        p.name || "",
        (p.description || "").replace(/;/g, ","),
        p.base_price_avista || p.unit_price || 0,
        p.marca || "",
        p.modelo || "",
        p.medida || "",
        p.posicao || "",
        p.lonas_pr || "",
        p.profundidade_sulco_mm || "",
        p.indice_carga_velocidade || "",
        p.forma_pagamento || "",
        p.condicao_escolhida || "",
        p.taxa_percentual || "",
        p.numero_parcelas || ""
      ].join(";"))
    ];

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `catalogo_produtos_${currentCompany?.name?.toLowerCase().replace(/\s+/g, "_") || "proposify"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Catálogo exportado com sucesso!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error("O arquivo está vazio ou não possui dados.");
      return;
    }

    const headerLine = lines[0]!;
    const delimiter = headerLine.includes(";") ? ";" : ",";
    const rawHeaders = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));

    const parsed: any[] = [];
    const errorsList: string[] = [];

    const getHeaderIdx = (name: string) => {
      return rawHeaders.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    };

    const nameIdx = getHeaderIdx("Nome");
    const descIdx = getHeaderIdx("Descricao");
    const priceIdx = getHeaderIdx("Preco_Base_Avista");
    const brandIdx = getHeaderIdx("Marca");
    const modelIdx = getHeaderIdx("Modelo");
    const sizeIdx = getHeaderIdx("Medida");
    const posIdx = getHeaderIdx("Posicao");
    const lonasIdx = getHeaderIdx("Lonas");
    const sulcoIdx = getHeaderIdx("Sulco_mm");
    const indexIdx = getHeaderIdx("Indice_Carga");
    const payIdx = getHeaderIdx("Forma_Pagamento");
    const condIdx = getHeaderIdx("Condicao_Prazo");
    const rateIdx = getHeaderIdx("Taxa_Percentual");
    const installmentIdx = getHeaderIdx("Parcelas");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const regex = new RegExp(`\\s*${delimiter}\\s*(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)`);
      const cols = line.split(regex).map((c) => c.trim().replace(/^["']|["']$/g, ""));

      if (cols.length < 3) {
        errorsList.push(`Linha ${i + 1}: Quantidade de colunas insuficiente.`);
        continue;
      }

      const getVal = (idx: number, fallback = "") => (idx !== -1 && cols[idx] !== undefined ? cols[idx] : fallback);

      const rawName = getVal(nameIdx);
      const marca = getVal(brandIdx);
      const modelo = getVal(modelIdx);
      const medida = getVal(sizeIdx);
      const posicao = getVal(posIdx, "Direcional");
      const lonas_pr = parseInt(getVal(lonasIdx)) || null;
      const profundidade_sulco_mm = parseFloat(getVal(sulcoIdx)) || null;
      const indice_carga_velocidade = getVal(indexIdx);
      const basePrice = parseFloat(getVal(priceIdx)) || 0;
      const forma_pagamento = getVal(payIdx, "PIX_AVISTA");
      const condicao_escolhida = getVal(condIdx, "PM30");
      const taxa_percentual = parseFloat(getVal(rateIdx)) || 0;
      const numero_parcelas = parseInt(getVal(installmentIdx)) || 1;

      const finalName = rawName || (marca && modelo && medida ? `${marca} ${modelo} - ${medida}` : `Produto ${i}`);

      if (!marca || !modelo || !medida) {
        if (!rawName || isNaN(basePrice)) {
          errorsList.push(`Linha ${i + 1}: Dados de pneu incompletos (Marca, Modelo, Medida são obrigatórios) ou nome/preço inválido.`);
          continue;
        }
      }

      parsed.push({
        name: finalName,
        description: getVal(descIdx) || null,
        base_price_avista: basePrice || null,
        marca: marca || null,
        modelo: modelo || null,
        medida: medida || null,
        posicao: posicao || null,
        lonas_pr,
        profundidade_sulco_mm,
        indice_carga_velocidade: indice_carga_velocidade || null,
        forma_pagamento: forma_pagamento || null,
        condicao_escolhida: condicao_escolhida || null,
        taxa_percentual,
        numero_parcelas,
        unit_price: Number((basePrice * (1 + taxa_percentual)).toFixed(2)) || basePrice,
        pricing_type: "one_time",
        active: true,
      });
    }

    setImportPreview(parsed);
    setImportErrors(errorsList);
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0) {
      toast.error("Nenhum produto válido para importar.");
      return;
    }

    const targetCompanyId = activeCompanyFilter || company?.id;
    if (!targetCompanyId) {
      toast.error("Por favor, selecione uma empresa antes de importar.");
      return;
    }

    setImporting(true);
    try {
      const itemsData = importPreview.map((item) => ({
        ...item,
        company_id: targetCompanyId,
      }));

      const { error } = await supabase.from("products").insert(itemsData);
      if (error) throw error;

      toast.success(`${importPreview.length} produtos importados com sucesso!`);
      qc.invalidateQueries({ queryKey: ["products"] });
      setImportPreview([]);
      setImportErrors([]);
      setImportModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro na importação: " + e.message);
    } finally {
      setImporting(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Button onClick={openCreateModal} className="gap-2 h-10 shrink-0 font-semibold shadow-sm w-full sm:w-auto justify-center">
            <Plus className="size-4" /> Novo Serviço / Produto
          </Button>
        </div>
      </div>

      {/* Barra de Filtros & Busca & Ações de Planilha */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setImportModalOpen(true)}
            variant="outline"
            className="gap-2 h-10 flex-1 sm:flex-none justify-center border-primary/30 text-primary hover:bg-primary/5 font-semibold text-xs sm:text-sm"
          >
            <Upload className="size-4" /> Importar Planilha
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="gap-2 h-10 flex-1 sm:flex-none justify-center border-primary/30 text-primary hover:bg-primary/5 font-semibold text-xs sm:text-sm"
          >
            <Download className="size-4" /> Exportar Planilha
          </Button>
        </div>
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
                  {comp && isAdmin && !activeCompanyFilter ? (
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
                {p.medida && (
                  <div className="mt-1.5 text-[11px] text-primary font-medium flex flex-wrap items-center gap-1.5 bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 w-fit">
                    <span className="font-bold text-primary">{p.marca} {p.modelo}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>{p.medida} ({p.posicao})</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>{p.lonas_pr} PR</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>Sulco: {p.profundidade_sulco_mm}mm</span>
                    {p.base_price_avista && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span>Base: <strong>{brl(Number(p.base_price_avista))}</strong></span>
                      </>
                    )}
                    {p.taxa_percentual ? (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span>Taxa: <strong>{(Number(p.taxa_percentual) * 100).toFixed(2)}%</strong></span>
                      </>
                    ) : null}
                    {p.profundidade_sulco_mm && p.base_price_avista && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">Custo/mm: {brl(Number(p.base_price_avista) / Number(p.profundidade_sulco_mm))}/mm</span>
                      </>
                    )}
                  </div>
                )}
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
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleDuplicate(p)}
                  >
                    <Copy className="size-3.5" /> Duplicar
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

            {isLBTyres && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <Label className="text-sm font-bold text-primary flex items-center gap-1.5">
                    🚗 Especificações de Pneu & Regra B2B (LB Tyres)
                  </Label>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                    Pneu Catálogo
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Marca</Label>
                    <Input
                      value={form.marca}
                      onChange={(e) => setForm({ ...form, marca: e.target.value })}
                      placeholder="Ex: XBRI"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Modelo</Label>
                    <Input
                      value={form.modelo}
                      onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                      placeholder="Ex: CAR-603"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Medida</Label>
                    <Input
                      value={form.medida}
                      onChange={(e) => setForm({ ...form, medida: e.target.value })}
                      placeholder="Ex: 295/80R22.5"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Posição</Label>
                    <Select
                      value={form.posicao}
                      onValueChange={(val) => setForm({ ...form, posicao: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Direcional">Direcional</SelectItem>
                        <SelectItem value="Tração">Tração</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Lonas (PR)</Label>
                    <Input
                      type="number"
                      value={form.lonas_pr || ""}
                      onChange={(e) => setForm({ ...form, lonas_pr: parseInt(e.target.value) || 0 })}
                      placeholder="Ex: 18"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Prof. Sulco (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.profundidade_sulco_mm || ""}
                      onChange={(e) => setForm({ ...form, profundidade_sulco_mm: parseFloat(e.target.value) || 0 })}
                      placeholder="Ex: 22.0"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Índice Carga/Vel.</Label>
                    <Input
                      value={form.indice_carga_velocidade}
                      onChange={(e) => setForm({ ...form, indice_carga_velocidade: e.target.value })}
                      placeholder="Ex: 152/149M"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold text-primary">Preço Base à Vista</Label>
                    <CurrencyInput
                      value={form.base_price_avista}
                      onChange={(val) => {
                        const calculated = Number((val * (1 + form.taxa_percentual)).toFixed(2));
                        setForm({
                          ...form,
                          base_price_avista: val,
                          unit_price: calculated,
                          min_price: val,
                          max_price: Number((val * 1.5).toFixed(2)),
                        });
                      }}
                      placeholder="R$ 1.500,00"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-primary/10 pt-3 space-y-3">
                  <span className="text-[11px] font-bold text-primary block uppercase tracking-wider">
                    Regra Financeira Comercial (Taxas e Prazos)
                  </span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
                      <Select
                        value={form.forma_pagamento}
                        onValueChange={(val) => setForm({ ...form, forma_pagamento: val })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PIX_AVISTA">PIX à Vista</SelectItem>
                          <SelectItem value="BOLETO_PRAZO">Boleto a Prazo</SelectItem>
                          <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Condição/Prazo</Label>
                      <Input
                        value={form.condicao_escolhida}
                        onChange={(e) => setForm({ ...form, condicao_escolhida: e.target.value })}
                        placeholder="Ex: PM60"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Taxa Percentual (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.taxa_percentual ? Number((form.taxa_percentual * 100).toFixed(2)) : ""}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) / 100 || 0;
                          const calculated = Number((form.base_price_avista * (1 + rate)).toFixed(2));
                          setForm({
                            ...form,
                            taxa_percentual: rate,
                            unit_price: calculated,
                          });
                        }}
                        placeholder="Ex: 4.00"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Nº Parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={form.numero_parcelas || ""}
                        onChange={(e) => setForm({ ...form, numero_parcelas: parseInt(e.target.value) || 1 })}
                        placeholder="Ex: 3"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  {form.base_price_avista > 0 && (
                    <div className="bg-primary/10 rounded-lg p-3 text-xs text-primary font-medium space-y-2 border border-primary/20">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>Valor Final no Prazo (Praticado): <strong>{brl(form.base_price_avista * (1 + form.taxa_percentual))}</strong></span>
                        <span>Plano: <strong>{form.numero_parcelas}x de {brl((form.base_price_avista * (1 + form.taxa_percentual)) / form.numero_parcelas)}</strong></span>
                      </div>
                      {form.profundidade_sulco_mm > 0 && (
                        <div className="text-[10px] text-primary/80 border-t border-primary/10 pt-1.5 flex justify-between">
                          <span>Eficiência do Sulco: <strong>{brl(form.base_price_avista / form.profundidade_sulco_mm)} por mm</strong> de borracha</span>
                          <span className="italic">Proposta gerada no formato Executivo</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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

      {/* MODAL DE IMPORTAÇÃO DE PLANILHA CSV */}
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        setImportModalOpen(open);
        if (!open) {
          setImportPreview([]);
          setImportErrors([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5 text-primary" /> Importar Catálogo via Planilha CSV
            </DialogTitle>
            <DialogDescription>
              Baixe a planilha modelo de exemplo, preencha os produtos ou pneus de sua empresa e faça o upload para realizar o cadastro em lote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-secondary/10 p-4 rounded-lg border border-border">
              <div>
                <p className="text-xs font-semibold text-foreground">Passo 1: Baixe o modelo oficial</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  A planilha deve seguir a estrutura de colunas e cabeçalhos oficiais.
                </p>
              </div>
              <Button type="button" onClick={handleDownloadTemplate} size="sm" variant="outline" className="gap-1.5 shrink-0">
                <Download className="size-3.5" /> Baixar Modelo CSV
              </Button>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-foreground">Passo 2: Selecione o arquivo preenchido (.csv)</Label>
              <div className="border border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center bg-background gap-2 hover:border-primary/50 transition-colors">
                <Upload className="size-8 text-muted-foreground" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/95 cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">Formato aceito: CSV delimitado por vírgula (,) ou ponto e vírgula (;)</p>
              </div>
            </div>

            {importErrors.length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="size-4 shrink-0" /> Avisos / Erros encontrados na planilha:
                </p>
                <ul className="list-disc list-inside max-h-32 overflow-y-auto pl-1 space-y-0.5">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Passo 3: Visualizar Produtos identificados ({importPreview.length})</Label>
                <div className="border border-border rounded-lg overflow-x-auto max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold">
                        <th className="p-2">Nome do Produto</th>
                        <th className="p-2">Marca / Medida</th>
                        <th className="p-2 text-right">Preço Vista</th>
                        <th className="p-2 text-center">Taxa</th>
                        <th className="p-2 text-center">Parcelas</th>
                        <th className="p-2 text-right">Preço Prazo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importPreview.map((item, idx) => (
                        <tr key={idx} className="hover:bg-secondary/10">
                          <td className="p-2 font-medium">{item.name}</td>
                          <td className="p-2 text-muted-foreground">
                            {item.medida ? `${item.marca} · ${item.medida}` : "Produto Geral"}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {item.base_price_avista ? brl(item.base_price_avista) : "—"}
                          </td>
                          <td className="p-2 text-center tabular-nums">
                            {item.taxa_percentual ? `${(item.taxa_percentual * 100).toFixed(2)}%` : "0%"}
                          </td>
                          <td className="p-2 text-center">{item.numero_parcelas}x</td>
                          <td className="p-2 text-right tabular-nums font-semibold">{brl(item.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportModalOpen(false);
                setImportPreview([]);
                setImportErrors([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={importing || importPreview.length === 0}
              className="gap-1.5"
            >
              {importing ? "Salvando..." : "Confirmar Importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
