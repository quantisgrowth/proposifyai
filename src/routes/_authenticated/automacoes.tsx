import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Cpu,
  Database,
  ArrowDownLeft,
  ArrowUpRight,
  Settings,
  Copy,
  CheckCircle2,
  XCircle,
  Play,
  Save,
  HelpCircle,
  Terminal,
  RefreshCw,
  Search,
  Eye,
  Sliders,
  AlertTriangle,
  ExternalLink,
  Plus,
  GitFork,
  ArrowLeft,
  Trash2,
  Lock,
} from "lucide-react";

import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
  Handle,
  Connection,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações e Logs — Proposify AI" },
      {
        name: "description",
        content: "Configure fluxos de automação, mapeamento de campos (field mapping) do CRM e analise os logs de integração de entrada e saída.",
      },
    ],
  }),
  component: AutomationsPage,
});

const DEFAULT_DATACRAZY_MAPPING = {
  "client.name": "client_name",
  "client.email": "client_email",
  "client.document": "client_document",
  "client.phone": "client_phone",
  "client.contact_name": "contact_name",
  "campaign_name": "deal_title",
  "solution_name": "product_name",
  "payment_terms": "payment_method",
  "notes": "description",
  "discount_amount": "discount_value",
  "validity_date": "validity_limit",
};

// ----------------------------------------------------
// CUSTOM NODE COMPONENTS (React Flow)
// ----------------------------------------------------

const TriggerNode = ({ data, selected }: any) => {
  return (
    <div className={`p-4 rounded-xl border bg-slate-950/90 text-slate-100 min-w-[260px] shadow-2xl transition-all relative ${
      selected ? 'border-primary shadow-primary/20 ring-1 ring-primary' : 'border-border/60 hover:border-border'
    }`}>
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 py-0.5 px-2 rounded-full flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Gatilho
        </span>
        <Play className="size-3.5 text-emerald-400" />
      </div>
      <div className="py-3">
        <h4 className="text-xs font-bold text-foreground">{data.label || "Gatilho de Entrada"}</h4>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">Evento: {data.trigger_type}</p>
      </div>
      <div className="flex gap-4 pt-2 border-t border-border/20 justify-between text-[9px] text-muted-foreground">
        <div>Sucessos: <span className="font-bold text-emerald-400">{data.stats?.success || 0}</span></div>
        <div>Alertas: <span className="font-bold text-amber-500">{data.stats?.alerts || 0}</span></div>
        <div>Erros: <span className="font-bold text-destructive">{data.stats?.errors || 0}</span></div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-500 size-2.5 !border-slate-950" />
    </div>
  );
};

const ConditionNode = ({ data, selected }: any) => {
  return (
    <div className={`p-4 rounded-xl border bg-slate-950/90 text-slate-100 min-w-[260px] shadow-2xl transition-all relative ${
      selected ? 'border-primary shadow-primary/20 ring-1 ring-primary' : 'border-border/60 hover:border-border'
    }`}>
      <Handle type="target" position={Position.Left} className="!bg-blue-500 size-2.5 !border-slate-950" />
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <span className="text-[9px] uppercase font-bold text-blue-400 bg-blue-500/10 py-0.5 px-2 rounded-full flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-blue-400" /> Condição
        </span>
        <GitFork className="size-3.5 text-blue-400" />
      </div>
      <div className="py-3 font-medium">
        <h4 className="text-xs font-bold text-foreground">{data.label || "Filtro Lógico"}</h4>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          Regra: {data.field ? `${data.field} ${data.operator} ${data.value}` : "Configurar regra..."}
        </p>
      </div>
      <div className="flex gap-4 pt-2 border-t border-border/20 justify-between text-[9px] text-muted-foreground">
        <div>Passados: <span className="font-bold text-blue-400">{data.stats?.success || 0}</span></div>
        <div>Ignorados: <span className="font-bold text-amber-500">{data.stats?.errors || 0}</span></div>
      </div>
      
      {/* Yes connection handle */}
      <div className="absolute right-[-8px] top-[30%] flex items-center gap-1">
        <span className="text-[8px] font-bold text-emerald-400 mr-2 bg-emerald-500/5 px-1 rounded">SIM</span>
        <Handle type="source" position={Position.Right} id="true" className="!bg-emerald-500 size-2.5 !border-slate-950 !top-1/2" />
      </div>
      
      {/* No connection handle */}
      <div className="absolute right-[-8px] top-[70%] flex items-center gap-1">
        <span className="text-[8px] font-bold text-destructive mr-2 bg-destructive/5 px-1 rounded">NÃO</span>
        <Handle type="source" position={Position.Right} id="false" className="!bg-destructive/50 size-2.5 !border-slate-950 !top-1/2" />
      </div>
    </div>
  );
};

const ActionNode = ({ data, selected }: any) => {
  const isEmail = data.action_type === "email";
  return (
    <div className={`p-4 rounded-xl border bg-slate-950/90 text-slate-100 min-w-[260px] shadow-2xl transition-all relative ${
      selected ? 'border-primary shadow-primary/20 ring-1 ring-primary' : 'border-border/60 hover:border-border'
    }`}>
      <Handle type="target" position={Position.Left} className="!bg-amber-500 size-2.5 !border-slate-950" />
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 py-0.5 px-2 rounded-full flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-400" /> Ação
        </span>
        {isEmail ? <Terminal className="size-3.5 text-amber-400" /> : <ExternalLink className="size-3.5 text-amber-400" />}
      </div>
      <div className="py-3">
        <h4 className="text-xs font-bold text-foreground">{data.label || "Chamar Webhook"}</h4>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {isEmail ? "Enviar E-mail Customizado" : "Webhook: " + (data.url || "Configurar URL...")}
        </p>
      </div>
      <div className="flex gap-4 pt-2 border-t border-border/20 justify-between text-[9px] text-muted-foreground">
        <div>Sucessos: <span className="font-bold text-amber-400">{data.stats?.success || 0}</span></div>
        <div>Erros: <span className="font-bold text-destructive">{data.stats?.errors || 0}</span></div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 size-2.5 !border-slate-950" />
    </div>
  );
};

// Types list for React Flow
const NODE_TYPES = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};

// ----------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------

function AutomationsPage() {
  const qc = useQueryClient();
  const { company, isAdmin, activeCompanyId } = useAuth();

  const [activeTab, setActiveTab] = useState("flows");
  const [editingFlow, setEditingFlow] = useState<any>(null);

  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Configurator Drawer state
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeConfig, setNodeConfig] = useState<any>({});

  // Logs filters
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [logDirectionFilter, setLogDirectionFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Webhook settings state
  const [webhookUrl, setWebhookUrl] = useState(company?.webhook_url || "");
  const [webhookSecret, setWebhookSecret] = useState(company?.webhook_secret || "");

  // Safe window.location.origin for SSR
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Sync state when company loads
  useEffect(() => {
    if (company) {
      setWebhookUrl(company.webhook_url || "");
      setWebhookSecret(company.webhook_secret || "");
    }
  }, [company]);

  // 1. Fetch Flows
  const { data: flows, isLoading: isLoadingFlows } = useQuery({
    queryKey: ["automation_flows", activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return [];
      const { data, error } = await supabase
        .from("automation_flows")
        .select("*")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeCompanyId,
  });

  // 2. Fetch Logs
  const { data: logs, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["integration_logs", activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return [];
      const { data, error } = await supabase
        .from("integration_logs")
        .select(`
          *,
          automation_flows (
            name
          )
        `)
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeCompanyId,
  });

  // 3. Upsert/Update Flow Mutation
  const saveFlowMutation = useMutation({
    mutationFn: async (flowData: any) => {
      if (!activeCompanyId) throw new Error("No active company");
      const { data, error } = await supabase
        .from("automation_flows")
        .upsert({
          ...flowData,
          company_id: activeCompanyId,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["automation_flows", activeCompanyId] });
      toast.success("Automação salva com sucesso!");
      
      // Update local edit flow state
      if (editingFlow && editingFlow.id === data.id) {
        setEditingFlow(data);
      }
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar automação: " + err.message);
    },
  });

  // 4. Update Webhook Settings Mutation
  const saveWebhookMutation = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("No active company");
      const { error } = await supabase
        .from("companies")
        .update({
          webhook_url: webhookUrl.trim() || null,
          webhook_secret: webhookSecret.trim() || null,
        })
        .eq("id", activeCompanyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações de Webhook atualizadas!");
      qc.invalidateQueries({ queryKey: ["auth_user"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar Webhook: " + err.message);
    },
  });

  // Toggle Flow Active status
  const handleToggleFlow = async (flow: any, isChecked: boolean) => {
    try {
      await saveFlowMutation.mutateAsync({
        id: flow.id,
        name: flow.name,
        trigger_type: flow.trigger_type,
        mapping_rules: flow.mapping_rules,
        steps: flow.steps,
        is_active: isChecked,
      });
    } catch (err) {
      // Toast already handled by mutation
    }
  };

  // Generate a random Webhook secret
  const handleGenerateSecret = () => {
    const randHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    setWebhookSecret(randHex);
    toast.success("Novo segredo gerado! Salve para aplicar.");
  };

  // Filtered Logs list
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log: any) => {
      const matchesSearch = logSearch
        ? log.event_type.toLowerCase().includes(logSearch.toLowerCase()) ||
          (log.error_message && log.error_message.toLowerCase().includes(logSearch.toLowerCase())) ||
          (log.response_body && log.response_body.toLowerCase().includes(logSearch.toLowerCase())) ||
          JSON.stringify(log.payload).toLowerCase().includes(logSearch.toLowerCase())
        : true;

      const isSuccess = log.status_code >= 200 && log.status_code < 300;
      const matchesStatus =
        logStatusFilter === "all"
          ? true
          : logStatusFilter === "success"
          ? isSuccess
          : !isSuccess;

      const matchesDirection =
        logDirectionFilter === "all" ? true : log.direction === logDirectionFilter;

      return matchesSearch && matchesStatus && matchesDirection;
    });
  }, [logs, logSearch, logStatusFilter, logDirectionFilter]);

  // Seed default flows if they do not exist
  const handleSeedDefaultFlows = async () => {
    if (!activeCompanyId) return;
    try {
      const defaultFlows = [
        {
          name: "Importar do DataCrazy (Criação de Propostas)",
          trigger_type: "crm.incoming_proposal",
          mapping_rules: DEFAULT_DATACRAZY_MAPPING,
          steps: {
            nodes: [
              { id: "1", type: "trigger", position: { x: 100, y: 150 }, data: { label: "Gatilho de Entrada (DataCrazy)", trigger_type: "crm.incoming_proposal", mapping_rules: DEFAULT_DATACRAZY_MAPPING, stats: { success: 2, alerts: 0, errors: 0 } } },
              { id: "2", type: "action", position: { x: 480, y: 150 }, data: { label: "Criar Rascunho de Proposta", action_type: "create_proposal_draft", stats: { success: 2, errors: 0 } } }
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", animated: true }
            ]
          },
          is_active: true,
        },
        {
          name: "Notificar Envio de Proposta para o DataCrazy",
          trigger_type: "proposal.sent",
          mapping_rules: {},
          steps: {
            nodes: [
              { id: "1", type: "trigger", position: { x: 100, y: 150 }, data: { label: "Proposta Enviada", trigger_type: "proposal.sent", stats: { success: 5, alerts: 0, errors: 0 } } },
              { id: "2", type: "action", position: { x: 480, y: 150 }, data: { label: "Notificar DataCrazy CRM", action_type: "webhook", url: "https://api.datacrazy-crm.com/webhooks/deals", stats: { success: 5, errors: 0 } } }
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", animated: true }
            ]
          },
          is_active: true,
        },
        {
          name: "Notificar Aceite (Ganho) para o DataCrazy",
          trigger_type: "proposal.accepted",
          mapping_rules: {},
          steps: {
            nodes: [
              { id: "1", type: "trigger", position: { x: 100, y: 150 }, data: { label: "Proposta Aceita (Assinada)", trigger_type: "proposal.accepted", stats: { success: 3, alerts: 0, errors: 0 } } },
              { id: "2", type: "action", position: { x: 480, y: 150 }, data: { label: "Mudar Oportunidade para Ganho", action_type: "webhook", url: "https://api.datacrazy-crm.com/webhooks/deals", stats: { success: 3, errors: 0 } } }
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", animated: true }
            ]
          },
          is_active: true,
        },
      ];

      for (const flow of defaultFlows) {
        const { data: existing } = await supabase
          .from("automation_flows")
          .select("id")
          .eq("company_id", activeCompanyId)
          .eq("trigger_type", flow.trigger_type)
          .maybeSingle();

        if (!existing) {
          await supabase.from("automation_flows").insert({
            ...flow,
            company_id: activeCompanyId,
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["automation_flows", activeCompanyId] });
      toast.success("Fluxos padrões ativados com sucesso!");
    } catch (seedErr: any) {
      toast.error("Falha ao configurar fluxos padrões: " + seedErr.message);
    }
  };

  const handleCopyText = (text: string, msg: string = "Copiado!") => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  // ----------------------------------------------------
  // VISUAL FLOW BUILDER FUNCTIONS
  // ----------------------------------------------------

  const handleStartEditFlow = (flow: any) => {
    setEditingFlow(flow);
    
    // Parse steps from DB
    let initialNodes = [];
    let initialEdges = [];

    const steps = flow.steps as any;
    if (steps && Array.isArray(steps.nodes)) {
      initialNodes = steps.nodes;
      initialEdges = steps.edges || [];
    } else {
      // Fallback/generate default visual nodes
      const isIncoming = flow.trigger_type === "crm.incoming_proposal";
      initialNodes = [
        {
          id: "1",
          type: "trigger",
          position: { x: 100, y: 150 },
          data: {
            label: isIncoming ? "Gatilho de Entrada (DataCrazy)" : "Gatilho: " + flow.name,
            trigger_type: flow.trigger_type,
            mapping_rules: flow.mapping_rules || {},
            stats: { success: 0, alerts: 0, errors: 0 },
          },
        },
        {
          id: "2",
          type: "action",
          position: { x: 480, y: 150 },
          data: {
            label: isIncoming ? "Criar Rascunho de Proposta" : "Disparar Webhook de Retorno",
            action_type: isIncoming ? "create_proposal_draft" : "webhook",
            url: company?.webhook_url || "",
            stats: { success: 0, errors: 0 },
          },
        },
      ];
      initialEdges = [
        { id: "e1-2", source: "1", target: "2", animated: true },
      ];
    }

    setNodes(initialNodes);
    setEdges(initialEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const handleAddConditionNode = () => {
    const id = String(nodes.length + 1);
    const newNode = {
      id,
      type: "condition",
      position: { x: 280, y: 220 },
      data: {
        label: "Filtrar Regra",
        field: "net_amount",
        operator: ">",
        value: "10000",
        stats: { success: 0, errors: 0 },
      },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success("Nó de Condição adicionado! Faça as conexões no canvas.");
  };

  const handleAddActionNode = (type: "webhook" | "email") => {
    const id = String(nodes.length + 1);
    const newNode = {
      id,
      type: "action",
      position: { x: 480, y: 250 },
      data: {
        label: type === "email" ? "Enviar E-mail de Confirmação" : "Chamar API/Webhook do CRM",
        action_type: type,
        url: type === "webhook" ? (company?.webhook_url || "") : "",
        email_subject: "Sua proposta comercial está pronta!",
        email_body: "Olá, segue link da proposta: {{proposal_url}}",
        stats: { success: 0, errors: 0 },
      },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success(`Nó de Ação (${type === "email" ? "E-mail" : "Webhook"}) adicionado!`);
  };

  const handleNodeClick = (_: any, node: any) => {
    setSelectedNode(node);
    setNodeLabel(node.data.label || "");
    setNodeConfig(node.data);
    setConfigDrawerOpen(true);
  };

  const handleApplyNodeConfig = () => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              label: nodeLabel,
              ...nodeConfig,
            },
          };
        }
        return n;
      })
    );

    toast.success("Configuração do nó salva localmente! Lembre-se de Salvar o Fluxo.");
    setConfigDrawerOpen(false);
    setSelectedNode(null);
  };

  const handleLoadDataCrazyPreset = () => {
    setNodeConfig({
      ...nodeConfig,
      mapping_rules: DEFAULT_DATACRAZY_MAPPING,
    });
    toast.success("Preset do DataCrazy carregado! Clique em 'Aplicar Regras' para confirmar.");
  };

  const handleSaveFlowCanvas = () => {
    if (!editingFlow) return;

    // Find trigger node mapping rules
    const triggerNode = nodes.find((n) => n.type === "trigger");
    const mappingRules = triggerNode?.data?.mapping_rules || {};

    const payload = {
      id: editingFlow.id,
      name: editingFlow.name,
      trigger_type: editingFlow.trigger_type,
      mapping_rules: mappingRules, // Sync mapping rules column
      steps: {
        nodes,
        edges,
      },
      is_active: editingFlow.is_active,
    };

    saveFlowMutation.mutate(payload);
  };

  const handleNodeDelete = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    toast.success("Nó removido do canvas!");
    setConfigDrawerOpen(false);
    setSelectedNode(null);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Cpu className="size-4.5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Painel de Automações</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte o DataCrazy CRM à Proposify AI, gerencie o mapeamento de campos e audite chamadas em tempo real.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="text-xs h-9">
              <RefreshCw className="size-3.5 mr-1.5" /> Atualizar Logs
            </Button>
            {flows && flows.length === 0 && !editingFlow && (
              <Button size="sm" onClick={handleSeedDefaultFlows} className="text-xs h-9">
                <Sliders className="size-3.5 mr-1.5" /> Configurar Fluxos Iniciais
              </Button>
            )}
          </div>
        </div>

        {editingFlow ? (
          // ----------------------------------------------------
          // VISUAL GRAPH WORKFLOW EDITOR (React Flow canvas)
          // ----------------------------------------------------
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Bar for Flow Editor */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 border border-border p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="size-8" onClick={() => setEditingFlow(null)}>
                  <ArrowLeft className="size-4" />
                </Button>
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    {editingFlow.name}
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Modo Editor Visual ➡️ Clique duplo ou clique nos cards para parametrizar regras e campos.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Node adder toolbar */}
                <div className="flex gap-2 border-r border-border/80 pr-4">
                  <Button variant="outline" size="sm" onClick={handleAddConditionNode} className="text-xs h-8 bg-background border-blue-500/30 text-blue-600 hover:bg-blue-500/10">
                    <Plus className="size-3 mr-1" /> Add Condição
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleAddActionNode("webhook")} className="text-xs h-8 bg-background border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                    <Plus className="size-3 mr-1" /> Add Webhook
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleAddActionNode("email")} className="text-xs h-8 bg-background border-purple-500/30 text-purple-600 hover:bg-purple-500/10">
                    <Plus className="size-3 mr-1" /> Add E-mail
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold">Ativo:</span>
                  <Switch
                    checked={editingFlow.is_active}
                    onCheckedChange={(checked) => setEditingFlow({ ...editingFlow, is_active: checked })}
                  />
                </div>

                <Button size="sm" className="text-xs font-semibold h-8" onClick={handleSaveFlowCanvas} disabled={saveFlowMutation.isPending}>
                  <Save className="size-3.5 mr-1.5" />
                  {saveFlowMutation.isPending ? "Salvando..." : "Salvar Fluxo"}
                </Button>
              </div>
            </div>

            {/* React Flow Canvas */}
            <div className="w-full h-[580px] border border-border rounded-xl overflow-hidden bg-slate-950/20 relative shadow-inner">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={NODE_TYPES}
                onNodeClick={handleNodeClick}
                fitView
                className="bg-slate-900/10 dark:bg-slate-950/40"
              >
                <Controls className="bg-background text-foreground border-border rounded shadow" />
                <MiniMap className="bg-background border-border border rounded shadow !right-4 !bottom-4" />
                <Background color="#ccc" gap={16} size={1} />
              </ReactFlow>

              <div className="absolute left-4 top-4 bg-background/90 backdrop-blur border border-border/80 p-2.5 rounded-lg shadow-md max-w-xs pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-primary block">Dica</span>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  Arraste das chaves de saída (bolinhas coloridas na direita) e solte nas entradas dos blocos seguintes para criar as automações.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // ----------------------------------------------------
          // DASHBOARD LIST OF TABS (Flows, Logs, Credentials)
          // ----------------------------------------------------
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-slate-100 dark:bg-slate-900 border border-border p-1 rounded-lg w-full md:w-auto flex md:inline-flex">
              <TabsTrigger value="flows" className="flex-1 md:flex-none py-1.5 px-4 text-xs font-semibold rounded-md">
                <Cpu className="size-3.5 mr-2" /> Fluxos de Automação
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex-1 md:flex-none py-1.5 px-4 text-xs font-semibold rounded-md">
                <Terminal className="size-3.5 mr-2" /> Histórico de Logs
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 md:flex-none py-1.5 px-4 text-xs font-semibold rounded-md">
                <Settings className="size-3.5 mr-2" /> Chaves e Conexões
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FLOWS LIST */}
            <TabsContent value="flows" className="space-y-6 mt-6">
              <div className="grid gap-6 md:grid-cols-3">
                {isLoadingFlows ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="animate-pulse border-border">
                      <CardHeader className="h-28 bg-muted/30" />
                      <CardContent className="h-24 bg-muted/10" />
                    </Card>
                  ))
                ) : flows && flows.length > 0 ? (
                  flows.map((flow) => {
                    const isIncoming = flow.trigger_type === "crm.incoming_proposal";
                    return (
                      <Card key={flow.id} className="border-border hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <Badge variant={isIncoming ? "default" : "secondary"} className="text-[10px] uppercase font-bold py-0.5 px-1.5">
                              {isIncoming ? "Entrada" : "Saída"}
                            </Badge>
                            <Switch
                              checked={flow.is_active}
                              onCheckedChange={(checked) => handleToggleFlow(flow, checked)}
                            />
                          </div>
                          <CardTitle className="text-base font-bold mt-2.5 leading-snug">
                            {flow.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
                            {isIncoming
                              ? "Recebe os dados do negócio do DataCrazy CRM pós-reunião e insere uma nova proposta como Rascunho."
                              : flow.trigger_type === "proposal.sent"
                              ? "Quando você envia a proposta na Proposify, dispara um webhook avisando o DataCrazy."
                              : "Quando o cliente assina/aceita a proposta, dispara uma confirmação e muda a oportunidade para Ganho."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-4 pt-1 flex-grow">
                          <div className="bg-slate-50 dark:bg-slate-900/50 border border-border/60 rounded-md p-2.5 space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-muted-foreground font-medium">Gatilho:</span>
                              <span className="font-mono text-primary font-semibold">{flow.trigger_type}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-muted-foreground font-medium">Formato:</span>
                              <span className="text-foreground font-semibold">
                                Construtor Visual (React Flow)
                              </span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-2 border-t border-border/50 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs font-semibold h-8"
                            onClick={() => handleStartEditFlow(flow)}
                          >
                            <Sliders className="size-3.5 mr-1.5 text-primary" /> Abrir Construtor Visual
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-3 text-center py-12 border border-dashed border-border rounded-xl bg-slate-50/40 dark:bg-slate-950/20">
                    <Cpu className="size-10 mx-auto text-muted-foreground/60 mb-3" />
                    <h3 className="font-bold text-foreground">Nenhuma Automação Configurada</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                      Crie os fluxos padrões de integração com o DataCrazy CRM para iniciar a automação.
                  </p>
                    <Button onClick={handleSeedDefaultFlows} className="mt-4 text-xs font-semibold">
                      Configurar Fluxos Padrões do DataCrazy
                    </Button>
                  </div>
                )}
              </div>

              {/* Visual Diagram Explanation */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Database className="size-4 text-primary" /> Ciclo de Automação Proposify ↔ DataCrazy CRM
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Entenda o fluxo dinâmico de informações e status entre as plataformas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid md:grid-cols-3 gap-6 relative">
                    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/50">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center font-bold text-sm shadow-sm mb-3">
                        1
                      </div>
                      <h4 className="text-xs font-bold text-foreground">Nova Oportunidade (DataCrazy)</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
                        Após a reunião de vendas, o CRM envia o webhook. O Proposify AI cria a proposta no status de rascunho com os campos mapeados.
                      </p>
                    </div>
                    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/50">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center font-bold text-sm shadow-sm mb-3">
                        2
                      </div>
                      <h4 className="text-xs font-bold text-foreground">Proposta Enviada (Notificação)</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
                        Quando o vendedor clica para enviar a proposta por e-mail, o Proposify avisa o DataCrazy, mudando o estágio para "Proposta Enviada".
                      </p>
                    </div>
                    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border/50">
                      <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center font-bold text-sm shadow-sm mb-3">
                        3
                      </div>
                      <h4 className="text-xs font-bold text-foreground">Assinada/Ganho (Ganho no CRM)</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
                        Assim que o cliente aceita e assina a proposta comercial, o Proposify altera o status no DataCrazy para "Ganho/Fechado".
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: LOGS */}
            <TabsContent value="logs" className="space-y-4 mt-6">
              {/* Filters Bar */}
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 dark:bg-slate-900/50 border border-border p-3 rounded-lg">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar logs (eventos, payload...)"
                    className="pl-9 text-xs h-9 bg-background"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                </div>
                <div className="flex w-full md:w-auto gap-2.5">
                  <div className="flex-1 md:w-40">
                    <Select value={logDirectionFilter} onValueChange={setLogDirectionFilter}>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Direção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">Todas as Direções</SelectItem>
                        <SelectItem value="incoming" className="text-xs">Entrada (CRM ➡️ App)</SelectItem>
                        <SelectItem value="outgoing" className="text-xs">Saída (App ➡️ CRM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 md:w-40">
                    <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                        <SelectItem value="success" className="text-xs">Sucesso (2xx)</SelectItem>
                        <SelectItem value="error" className="text-xs">Erros (4xx / 5xx)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-border rounded-lg bg-background overflow-hidden">
                {isLoadingLogs ? (
                  <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="size-6 animate-spin text-primary" />
                    <span className="text-xs font-semibold">Carregando logs de integração...</span>
                  </div>
                ) : filteredLogs.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-foreground">Direção</TableHead>
                        <TableHead className="text-xs font-bold text-foreground">Evento</TableHead>
                        <TableHead className="text-xs font-bold text-foreground">Status HTTP</TableHead>
                        <TableHead className="text-xs font-bold text-foreground">Data/Hora</TableHead>
                        <TableHead className="text-xs font-bold text-foreground text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log: any) => {
                        const isSuccess = log.status_code >= 200 && log.status_code < 300;
                        return (
                          <TableRow key={log.id} className="border-border hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                            <TableCell className="py-2.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                                {log.direction === "incoming" ? (
                                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <ArrowDownLeft className="size-3.5" /> Entrada
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <ArrowUpRight className="size-3.5" /> Saída
                                  </span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs font-semibold text-foreground font-mono">
                              {log.event_type}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant={isSuccess ? "outline" : "destructive"}
                                className={`text-[10px] font-semibold py-0.5 px-2 ${
                                  isSuccess
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : ""
                                }`}
                              >
                                {isSuccess ? <CheckCircle2 className="size-2.5 mr-1 shrink-0" /> : <XCircle className="size-2.5 mr-1 shrink-0" />}
                                {log.status_code || "Error"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                              {shortDate(log.created_at)} {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] font-bold px-2.5"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setLogModalOpen(true);
                                }}
                              >
                                <Eye className="size-3 mr-1" /> Payload
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 bg-slate-50/20">
                    <Terminal className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                    <h4 className="text-xs font-bold text-foreground">Nenhum Log Encontrado</h4>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto mt-1">
                      Não existem chamadas registradas para os filtros selecionados.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: SETTINGS & CREDENTIALS */}
            <TabsContent value="settings" className="space-y-6 mt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Credentials / API Key Card */}
                <Card className="border-border shadow-sm flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Sliders className="size-4.5 text-primary" /> Credenciais de Entrada (DataCrazy ➡️ Proposify)
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Copie a chave da API ativa e envie dados para criar propostas automaticamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Token de API da Empresa</Label>
                      <div className="flex gap-2">
                        <Input
                          value={company?.api_key || "Não gerado"}
                          readOnly
                          className="bg-slate-50 dark:bg-slate-900/50 font-mono text-xs cursor-text flex-1 select-all h-9"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyText(company?.api_key || "", "Token de API copiado!")}
                          className="text-xs font-semibold h-9 shrink-0"
                        >
                          <Copy className="size-3.5 mr-1" /> Copiar
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 dark:bg-slate-900 border border-border p-3 text-xs space-y-2">
                      <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                        <Terminal className="size-3.5 text-primary" /> Instrução de Integração:
                      </p>
                      <p className="text-muted-foreground leading-relaxed text-[11px]">
                        Configure a automação no DataCrazy CRM para fazer uma chamada HTTP POST no seguinte endereço:
                      </p>
                      <code className="block bg-slate-100 dark:bg-slate-950 p-2 rounded text-[10px] font-mono text-primary font-semibold select-all break-all border border-border/80">
                        {origin || "http://localhost:3000"}/api/v1/proposals
                      </code>
                      <p className="text-[10px] text-muted-foreground leading-normal pt-1">
                        Adicione o cabeçalho HTTP: <br />
                        <span className="font-mono bg-slate-100 dark:bg-slate-950 py-0.5 px-1 rounded border border-border/60 text-primary font-semibold">
                          Authorization: Bearer &lt;token_acima&gt;
                        </span>
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                    Garante que todas as propostas importadas respeitarão as regras de Field Mapping configuradas.
                  </CardFooter>
                </Card>

                {/* Webhook Configuration Card */}
                <Card className="border-border shadow-sm flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ExternalLink className="size-4.5 text-primary" /> Webhook de Saída (Proposify ➡️ DataCrazy)
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Configure para onde o Proposify enviará informações de propostas criadas, enviadas ou assinadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">URL de Destino do Webhook</Label>
                      <Input
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="Ex: https://api.datacrazy-crm.com/webhooks/v1"
                        className="text-xs h-9 bg-background"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Segredo do Webhook (Webhook Secret)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={webhookSecret}
                          onChange={(e) => setWebhookSecret(e.target.value)}
                          placeholder="Código de criptografia HMAC"
                          className="text-xs h-9 font-mono bg-background"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateSecret}
                          className="text-xs font-semibold h-9 shrink-0"
                        >
                          Gerar
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                        Gera uma assinatura via HMAC-SHA256 no cabeçalho <code className="font-mono text-primary bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded border border-border/50">X-Proposify-Signature</code>.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t border-border/50 w-full flex justify-end">
                    <Button
                      size="sm"
                      className="text-xs font-semibold h-8"
                      onClick={() => saveWebhookMutation.mutate()}
                      disabled={saveWebhookMutation.isPending}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      {saveWebhookMutation.isPending ? "Salvando..." : "Salvar Configuração"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ----------------------------------------------------
      // DIALOG 1: DETAILED NODE CONFIGURATION SIDE DRAWER / DIALOG
      // ---------------------------------------------------- */}
      <Dialog open={configDrawerOpen} onOpenChange={setConfigDrawerOpen}>
        <DialogContent className="max-w-2xl text-foreground bg-background border-border max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sliders className="size-4.5 text-primary" /> Configurar Bloco: {selectedNode?.type === "trigger" ? "Gatilho" : selectedNode?.type === "condition" ? "Condição" : "Ação"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Edite as propriedades de execução e lógica para este bloco no fluxo de automação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 border-t border-b border-border/60">
            {/* Title / Label Config */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Nome Identificador do Bloco</Label>
              <Input
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                placeholder="Ex: Importar Negócio do CRM"
                className="text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border h-9"
              />
            </div>

            {/* 1. CONFIGURATION FOR TRIGGER (FIELD MAPPING) */}
            {selectedNode?.type === "trigger" && (
              <div className="space-y-4">
                {/* Webhook Endpoint Info Panel */}
                <div className="rounded-lg border border-border bg-slate-50 dark:bg-slate-900/50 p-3.5 space-y-2.5">
                  <div>
                    <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Terminal className="size-3.5 text-primary" /> Webhook da API de Entrada:
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                      Configure no seu CRM (DataCrazy) um Webhook do tipo HTTP POST apontando para esta URL e inclua o cabeçalho de autenticação:
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 rounded text-[10px] font-mono text-primary font-semibold select-all break-all border border-border/60">
                      {origin || "http://localhost:3000"}/api/v1/proposals
                    </code>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyText(`${origin || "http://localhost:3000"}/api/v1/proposals`, "URL do Webhook copiada!")}
                      className="text-[10px] font-bold h-8 px-2.5"
                    >
                      <Copy className="size-3 mr-1" /> Copiar URL
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 rounded text-[10px] font-mono text-primary font-semibold select-all break-all border border-border/60">
                      Authorization: Bearer {company?.api_key || "Não gerado"}
                    </code>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyText(`Bearer ${company?.api_key || ""}`, "Cabeçalho de Autorização copiado!")}
                      className="text-[10px] font-bold h-8 px-2.5"
                      disabled={!company?.api_key}
                    >
                      <Copy className="size-3 mr-1" /> Copiar Header
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center rounded-lg bg-indigo-500/10 border border-indigo-500/25 p-3">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="size-4.5 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-left">
                      <p className="text-[11px] font-bold text-foreground">Deseja usar as chaves padrão do DataCrazy?</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Preenche os caminhos JSON com a estrutura padrão enviada pelo DataCrazy CRM.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs font-bold border-indigo-500/35 hover:bg-indigo-500/20 text-primary shrink-0 h-8" onClick={handleLoadDataCrazyPreset}>
                    Preset DataCrazy
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-primary border-b border-border/40 pb-1 flex items-center gap-1">
                      <Database className="size-3.5" /> Dados do Cliente (Payload)
                    </h4>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Razão Social / Nome do Cliente</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["client.name"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "client.name": e.target.value }
                        })}
                        placeholder="client_name"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">E-mail do Cliente</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["client.email"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "client.email": e.target.value }
                        })}
                        placeholder="client_email"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Documento (CNPJ / CPF)</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["client.document"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "client.document": e.target.value }
                        })}
                        placeholder="client_document"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Telefone</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["client.phone"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "client.phone": e.target.value }
                        })}
                        placeholder="client_phone"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-primary border-b border-border/40 pb-1 flex items-center gap-1">
                      <Terminal className="size-3.5" /> Campos da Proposta
                    </h4>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Campanha (Nome Oportunidade)</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["campaign_name"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "campaign_name": e.target.value }
                        })}
                        placeholder="deal_title"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Solução (Título Proposta)</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["solution_name"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "solution_name": e.target.value }
                        })}
                        placeholder="product_name"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Forma de Pagamento</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["payment_terms"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "payment_terms": e.target.value }
                        })}
                        placeholder="payment_method"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Valor Desconto (R$)</Label>
                      <Input
                        value={nodeConfig.mapping_rules?.["discount_amount"] || ""}
                        onChange={(e) => setNodeConfig({
                          ...nodeConfig,
                          mapping_rules: { ...nodeConfig.mapping_rules, "discount_amount": e.target.value }
                        })}
                        placeholder="discount_value"
                        className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. CONFIGURATION FOR CONDITION (FILTERS) */}
            {selectedNode?.type === "condition" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary border-b border-border/40 pb-1">Regra de Filtro Lógico</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="grid gap-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">Campo Proposta</Label>
                    <Select
                      value={nodeConfig.field || "net_amount"}
                      onValueChange={(val) => setNodeConfig({ ...nodeConfig, field: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net_amount" className="text-xs">Valor Líquido</SelectItem>
                        <SelectItem value="total_amount" className="text-xs">Valor Bruto</SelectItem>
                        <SelectItem value="discount_amount" className="text-xs">Desconto</SelectItem>
                        <SelectItem value="payment_terms" className="text-xs">Forma Pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">Operador</Label>
                    <Select
                      value={nodeConfig.operator || ">"}
                      onValueChange={(val) => setNodeConfig({ ...nodeConfig, operator: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">" className="text-xs">Maior que (&gt;)</SelectItem>
                        <SelectItem value="<" className="text-xs">Menor que (&lt;)</SelectItem>
                        <SelectItem value="=" className="text-xs">Igual a (=)</SelectItem>
                        <SelectItem value="!=" className="text-xs">Diferente de (!=)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">Valor de Comparação</Label>
                    <Input
                      value={nodeConfig.value || ""}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, value: e.target.value })}
                      placeholder="Ex: 10000 ou Pix"
                      className="h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. CONFIGURATION FOR ACTIONS (EMAIL OR WEBHOOK) */}
            {selectedNode?.type === "action" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary border-b border-border/40 pb-1">Configurar Ação</h4>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Tipo de Ação</Label>
                  <Select
                    value={nodeConfig.action_type || "webhook"}
                    onValueChange={(val) => setNodeConfig({ ...nodeConfig, action_type: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webhook" className="text-xs">Disparar Webhook de Saída</SelectItem>
                      <SelectItem value="email" className="text-xs">Enviar E-mail via SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {nodeConfig.action_type === "webhook" ? (
                  <div className="space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Webhook URL de Destino</Label>
                      <Input
                        value={nodeConfig.url || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, url: e.target.value })}
                        placeholder="https://api.datacrazy-crm.com/webhooks/deals"
                        className="text-xs h-9 bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Assunto do E-mail</Label>
                      <Input
                        value={nodeConfig.email_subject || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, email_subject: e.target.value })}
                        placeholder="Sua proposta comercial está pronta!"
                        className="text-xs h-9 bg-slate-50/50 dark:bg-slate-900/50 border-border"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Mensagem / Corpo do E-mail</Label>
                      <Textarea
                        value={nodeConfig.email_body || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, email_body: e.target.value })}
                        placeholder="Escreva a mensagem aqui. Use chaves {{proposal_code}} ou {{proposal_url}} para campos dinâmicos."
                        className="text-xs bg-slate-50/50 dark:bg-slate-900/50 border-border min-h-[100px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex justify-between items-center w-full">
            <div className="flex justify-start">
              {selectedNode?.type !== "trigger" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleNodeDelete(selectedNode.id)}
                  className="text-xs h-8 bg-destructive/10 text-destructive hover:bg-destructive/20 border-0"
                >
                  <Trash2 className="size-3.5 mr-1" /> Deletar Bloco
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfigDrawerOpen(false)} className="text-xs h-8">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleApplyNodeConfig} className="text-xs h-8">
                <CheckCircle2 className="size-3.5 mr-1" /> Aplicar Regras
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: LOG PAYLOAD VIEW DIALOG */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="max-w-3xl text-foreground bg-background border-border max-h-[85vh] overflow-y-auto flex flex-col justify-between">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-1.5 font-mono">
              <Terminal className="size-4.5 text-primary" /> Detalhes do Log: {selectedLog?.event_type}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Exibindo as informações de chamada de integração executada em {selectedLog ? shortDate(selectedLog.created_at) : ""}.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2 pb-4 flex-grow">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-border/50 text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[10px] font-medium block">Direção:</span>
                  <span className="font-bold flex items-center gap-1 text-[11px]">
                    {selectedLog.direction === "incoming" ? (
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1"><ArrowDownLeft className="size-3.5" /> Entrada (CRM ➡️ App)</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowUpRight className="size-3.5" /> Saída (App ➡️ CRM)</span>
                    )}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[10px] font-medium block">Código HTTP:</span>
                  <span className={`font-bold font-mono text-[11px] ${selectedLog.status_code >= 200 && selectedLog.status_code < 300 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {selectedLog.status_code || "Desconhecido"}
                  </span>
                </div>
                <div className="space-y-0.5 col-span-1">
                  <span className="text-muted-foreground text-[10px] font-medium block">Executado em:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedLog.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                  </span>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/25 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="size-4.5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-destructive uppercase tracking-wider block">Erro da Operação</span>
                    <p className="text-xs text-destructive font-medium leading-relaxed">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}

              {/* Payload Block */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Database className="size-3.5 text-primary" /> Corpo da Requisição (Payload JSON)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopyText(JSON.stringify(selectedLog.payload, null, 2))}
                  >
                    <Copy className="size-3 mr-1" /> Copiar JSON
                  </Button>
                </div>
                <pre className="bg-slate-50 dark:bg-slate-900/80 border border-border p-3.5 rounded-lg text-[10px] font-mono text-foreground leading-relaxed max-h-[190px] overflow-auto select-all">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>

              {/* Response Block */}
              {selectedLog.response_body && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-foreground block">Retorno / Resposta do Servidor</span>
                  <pre className="bg-slate-50 dark:bg-slate-900/80 border border-border p-3.5 rounded-lg text-[10px] font-mono text-muted-foreground leading-relaxed max-h-[120px] overflow-auto break-all select-all">
                    {selectedLog.response_body}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border/50">
            <Button size="sm" onClick={() => setLogModalOpen(false)} className="text-xs h-8">
              Fechar Detalhes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
