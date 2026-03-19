import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Plus, Zap, Clock, GitBranch, MessageSquare, Tag, Users, Bell } from 'lucide-react';
import api from '../../services/api';
import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import WaitNode from './nodes/WaitNode';
import NodeConfigPanel from './NodeConfigPanel';

interface FlowEditorProps {
  fluxoId: string;
  onVoltar: () => void;
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
};

// Paleta de nodes disponiveis
const nodePalette = [
  { tipo: 'trigger', subtipo: 'novo_lead', label: 'Novo Lead', icon: Users, cor: '#10b981' },
  { tipo: 'trigger', subtipo: 'mensagem_recebida', label: 'Mensagem Recebida', icon: MessageSquare, cor: '#10b981' },
  { tipo: 'trigger', subtipo: 'mudanca_estagio', label: 'Mudanca Estagio', icon: GitBranch, cor: '#10b981' },
  { tipo: 'trigger', subtipo: 'palavra_chave', label: 'Palavra-chave', icon: Tag, cor: '#10b981' },
  { tipo: 'trigger', subtipo: 'tag_adicionada', label: 'Tag Adicionada', icon: Tag, cor: '#10b981' },
  { tipo: 'action', subtipo: 'enviar_whatsapp', label: 'Enviar WhatsApp', icon: MessageSquare, cor: '#3b82f6' },
  { tipo: 'action', subtipo: 'enviar_instagram', label: 'Enviar Instagram', icon: MessageSquare, cor: '#ec4899' },
  { tipo: 'action', subtipo: 'adicionar_tag', label: 'Adicionar Tag', icon: Tag, cor: '#3b82f6' },
  { tipo: 'action', subtipo: 'mover_estagio', label: 'Mover Estagio', icon: GitBranch, cor: '#3b82f6' },
  { tipo: 'action', subtipo: 'notificar', label: 'Notificar Equipe', icon: Bell, cor: '#3b82f6' },
  { tipo: 'condition', subtipo: 'if_tag', label: 'Se tem Tag', icon: GitBranch, cor: '#f59e0b' },
  { tipo: 'condition', subtipo: 'if_cliente_lead', label: 'Se Cliente/Lead', icon: Users, cor: '#f59e0b' },
  { tipo: 'condition', subtipo: 'if_respondeu', label: 'Se Respondeu', icon: MessageSquare, cor: '#f59e0b' },
  { tipo: 'wait', subtipo: 'esperar', label: 'Esperar', icon: Clock, cor: '#8b5cf6' },
];

let nodeIdCounter = 0;

export default function FlowEditor({ fluxoId, onVoltar }: FlowEditorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fluxoNome, setFluxoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [nodeSelecionado, setNodeSelecionado] = useState<any>(null);

  // Carregar fluxo
  useEffect(() => {
    const carregar = async () => {
      try {
        const resp = await api.get(`/automacao/fluxos/${fluxoId}`);
        const fluxo = resp.data;
        setFluxoNome(fluxo.nome);

        if (fluxo.fluxo_json) {
          const flow = JSON.parse(fluxo.fluxo_json);
          if (flow.nodes && flow.nodes.length > 0) {
            // Converter nodes do backend para ReactFlow nodes
            const rfNodes = flow.nodes.map((n: any, i: number) => ({
              id: n.id,
              type: n.tipo,
              position: n.position || { x: 250, y: i * 150 },
              data: { ...n, label: n.label || n.subtipo },
            }));
            setNodes(rfNodes);
            nodeIdCounter = flow.nodes.length;
          }
          if (flow.edges && flow.edges.length > 0) {
            const rfEdges = flow.edges.map((e: any) => ({
              id: e.id || `e-${e.source}-${e.target}`,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle || null,
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }));
            setEdges(rfEdges);
          }
        }
      } catch (e) {
        console.error('Erro ao carregar fluxo:', e);
      }
    };
    carregar();
  }, [fluxoId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes(nds => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges(eds => addEdge({
      ...connection,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    }, eds)),
    [],
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setNodeSelecionado(node);
  }, []);

  const adicionarNode = (item: typeof nodePalette[0]) => {
    const newId = `node_${Date.now()}_${nodeIdCounter++}`;
    const newNode: Node = {
      id: newId,
      type: item.tipo,
      position: { x: 250, y: (nodes.length) * 150 + 50 },
      data: {
        id: newId,
        tipo: item.tipo,
        subtipo: item.subtipo,
        label: item.label,
        config: {},
      },
    };
    setNodes(nds => [...nds, newNode]);
    setPaletaAberta(false);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      // Converter ReactFlow nodes de volta para o formato do backend
      const flowNodes = nodes.map(n => ({
        id: n.id,
        tipo: n.type,
        subtipo: n.data.subtipo,
        label: n.data.label,
        config: n.data.config || {},
        position: n.position,
      }));

      const flowEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
      }));

      await api.put(`/automacao/fluxos/${fluxoId}`, {
        fluxo_json: JSON.stringify({ nodes: flowNodes, edges: flowEdges }),
      });
    } catch (e) {
      console.error('Erro ao salvar:', e);
    } finally {
      setSalvando(false);
    }
  };

  const atualizarNodeData = useCallback((nodeId: string, novaData: any) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...novaData } } : n
    ));
    setNodeSelecionado((prev: any) =>
      prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...novaData } } : prev
    );
  }, []);

  const excluirNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setNodeSelecionado(null);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 z-10">
        <button onClick={onVoltar} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-800">{fluxoNome}</h2>
          <p className="text-xs text-gray-400">{nodes.length} nodes, {edges.length} conexoes</p>
        </div>
        <button
          onClick={() => setPaletaAberta(!paletaAberta)}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200"
        >
          <Plus size={16} />
          Adicionar
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 bg-alisson-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-alisson-700 disabled:opacity-50"
        >
          <Save size={16} />
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="flex-1 flex relative">
        {/* Paleta de nodes */}
        {paletaAberta && (
          <div className="absolute left-4 top-4 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-20 w-64 max-h-[70vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Adicionar Node</h3>

            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-medium uppercase mt-2 mb-1">Gatilhos</p>
              {nodePalette.filter(n => n.tipo === 'trigger').map(item => (
                <button
                  key={item.subtipo}
                  onClick={() => adicionarNode(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: item.cor + '20' }}>
                    <item.icon size={14} style={{ color: item.cor }} />
                  </div>
                  {item.label}
                </button>
              ))}

              <p className="text-xs text-gray-400 font-medium uppercase mt-3 mb-1">Acoes</p>
              {nodePalette.filter(n => n.tipo === 'action').map(item => (
                <button
                  key={item.subtipo}
                  onClick={() => adicionarNode(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: item.cor + '20' }}>
                    <item.icon size={14} style={{ color: item.cor }} />
                  </div>
                  {item.label}
                </button>
              ))}

              <p className="text-xs text-gray-400 font-medium uppercase mt-3 mb-1">Condicoes</p>
              {nodePalette.filter(n => n.tipo === 'condition').map(item => (
                <button
                  key={item.subtipo}
                  onClick={() => adicionarNode(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-yellow-50 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: item.cor + '20' }}>
                    <item.icon size={14} style={{ color: item.cor }} />
                  </div>
                  {item.label}
                </button>
              ))}

              <p className="text-xs text-gray-400 font-medium uppercase mt-3 mb-1">Espera</p>
              {nodePalette.filter(n => n.tipo === 'wait').map(item => (
                <button
                  key={item.subtipo}
                  onClick={() => adicionarNode(item)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-purple-50 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: item.cor + '20' }}>
                    <item.icon size={14} style={{ color: item.cor }} />
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ReactFlow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#10b981';
                if (n.type === 'action') return '#3b82f6';
                if (n.type === 'condition') return '#f59e0b';
                if (n.type === 'wait') return '#8b5cf6';
                return '#94a3b8';
              }}
            />
          </ReactFlow>
        </div>

        {/* Painel de config do node selecionado */}
        {nodeSelecionado && (
          <NodeConfigPanel
            node={nodeSelecionado}
            onUpdate={atualizarNodeData}
            onDelete={excluirNode}
            onClose={() => setNodeSelecionado(null)}
          />
        )}
      </div>
    </div>
  );
}
