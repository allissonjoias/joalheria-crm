import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
interface FlowNodeData {
  tipo: string;
  subtipo: string;
  label: string;
  config: any;
  [key: string]: unknown;
}

interface NodeConfigPanelProps {
  node: { id: string; data: FlowNodeData; type?: string };
  onUpdate: (nodeId: string, data: any) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({ node, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<any>(node.data.config || {});
  const [label, setLabel] = useState<string>(node.data.label || '');

  useEffect(() => {
    setConfig(node.data.config || {});
    setLabel(node.data.label || '');
  }, [node.id, node.data]);

  const salvar = () => {
    onUpdate(node.id, { config, label });
  };

  const updateConfig = (key: string, value: any) => {
    const novaConfig = { ...config, [key]: value };
    setConfig(novaConfig);
    onUpdate(node.id, { config: novaConfig, label });
  };

  const renderCampos = () => {
    const tipo = node.data.tipo || node.type;
    const subtipo = node.data.subtipo;

    // === TRIGGER ===
    if (tipo === 'trigger') {
      if (subtipo === 'palavra_chave') {
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Palavras-chave (uma por linha)</label>
              <textarea
                value={(config.palavras || []).join('\n')}
                onChange={e => updateConfig('palavras', e.target.value.split('\n').filter(Boolean))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={4}
                placeholder="oi&#10;bom dia&#10;preco&#10;catalogo"
              />
            </div>
          </div>
        );
      }
      if (subtipo === 'mudanca_estagio') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estagio destino (opcional)</label>
            <input
              value={config.estagio_destino || ''}
              onChange={e => updateConfig('estagio_destino', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Nome do estagio"
            />
          </div>
        );
      }
      if (subtipo === 'tag_adicionada') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tag especifica (opcional)</label>
            <input
              value={config.tag || ''}
              onChange={e => updateConfig('tag', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Nome da tag"
            />
          </div>
        );
      }
      return <p className="text-xs text-gray-400">Este gatilho nao tem configuracoes extras.</p>;
    }

    // === ACTION ===
    if (tipo === 'action') {
      if (subtipo === 'enviar_whatsapp' || subtipo === 'enviar_instagram') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
            <textarea
              value={config.mensagem || ''}
              onChange={e => updateConfig('mensagem', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={4}
              placeholder="Ola {{nome}}, tudo bem?"
            />
            <p className="text-xs text-gray-400 mt-1">Variaveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{email}}'}</p>
          </div>
        );
      }
      if (subtipo === 'adicionar_tag') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
            <input
              value={config.tag || ''}
              onChange={e => updateConfig('tag', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="nome-da-tag"
            />
          </div>
        );
      }
      if (subtipo === 'mover_estagio') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estagio destino</label>
            <input
              value={config.estagio || ''}
              onChange={e => updateConfig('estagio', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Nome do estagio"
            />
          </div>
        );
      }
      if (subtipo === 'notificar') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem de notificacao</label>
            <textarea
              value={config.mensagem || ''}
              onChange={e => updateConfig('mensagem', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="Novo lead qualificado: {{nome}}"
            />
          </div>
        );
      }
      return null;
    }

    // === CONDITION ===
    if (tipo === 'condition') {
      if (subtipo === 'if_tag') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tag para verificar</label>
            <input
              value={config.tag || ''}
              onChange={e => updateConfig('tag', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="nome-da-tag"
            />
          </div>
        );
      }
      if (subtipo === 'if_respondeu') {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Janela de tempo (horas)</label>
            <input
              type="number"
              value={config.horas || 24}
              onChange={e => updateConfig('horas', parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        );
      }
      return <p className="text-xs text-gray-400">Condicao automatica, sem configuracao extra.</p>;
    }

    // === WAIT ===
    if (tipo === 'wait') {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tempo</label>
            <input
              type="number"
              value={config.valor || 1}
              onChange={e => updateConfig('valor', parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              min={1}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
            <select
              value={config.unidade || 'minutos'}
              onChange={e => updateConfig('unidade', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="minutos">Minutos</option>
              <option value="horas">Horas</option>
              <option value="dias">Dias</option>
            </select>
          </div>
        </div>
      );
    }

    return null;
  };

  const tipoLabels: Record<string, { label: string; cor: string }> = {
    trigger: { label: 'Gatilho', cor: 'text-green-600' },
    action: { label: 'Acao', cor: 'text-blue-600' },
    condition: { label: 'Condicao', cor: 'text-amber-600' },
    wait: { label: 'Espera', cor: 'text-purple-600' },
  };

  const tipo = node.data.tipo || node.type || 'action';
  const tipoInfo = tipoLabels[tipo] || { label: tipo, cor: 'text-gray-600' };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className={`text-xs font-medium uppercase ${tipoInfo.cor}`}>{tipoInfo.label}</span>
          <h3 className="font-semibold text-gray-800 text-sm">{label || node.data.subtipo}</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome do node</label>
          <input
            value={label}
            onChange={e => {
              setLabel(e.target.value);
              onUpdate(node.id, { label: e.target.value, config });
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {renderCampos()}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={() => onDelete(node.id)}
          className="flex items-center gap-2 text-red-500 text-sm hover:text-red-600 font-medium"
        >
          <Trash2 size={14} />
          Excluir node
        </button>
      </div>
    </div>
  );
}
