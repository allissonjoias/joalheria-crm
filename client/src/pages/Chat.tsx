import { useEffect, useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { DadosExtraidos } from '../components/chat/DadosExtraidos';
import { useChat } from '../hooks/useChat';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import api from '../services/api';

interface Conversa {
  id: string;
  cliente_nome: string;
  total_mensagens: number;
  atualizado_em: string;
}

export default function Chat() {
  const { mensagens, dadosExtraidos, enviando, conversaId, iniciarConversa, carregarConversa, enviarMensagem } = useChat();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');

  useEffect(() => {
    carregarConversas();
  }, []);

  const carregarConversas = async () => {
    try {
      const { data } = await api.get('/chat/conversas');
      setConversas(data);
    } catch {}
  };

  const handleNovaConversa = async () => {
    try {
      await iniciarConversa(undefined, nomeCliente || undefined);
      setModalAberto(false);
      setNomeCliente('');
      carregarConversas();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar conversa');
    }
  };

  const handleSelecionarConversa = async (id: string) => {
    await carregarConversa(id);
  };

  return (
    <div className="h-[calc(100vh-7rem)]">
      <div className="flex gap-4 h-full">
        {/* Conversation list */}
        <div className="w-72 bg-white rounded-xl border border-charcoal-100 flex flex-col">
          <div className="p-4 border-b border-charcoal-100 flex items-center justify-between">
            <h2 className="font-semibold text-charcoal-900">Conversas</h2>
            <Button tamanho="sm" onClick={() => setModalAberto(true)}>
              <Plus size={16} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversas.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelecionarConversa(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-charcoal-50 hover:bg-charcoal-50 transition-colors ${conversaId === c.id ? 'bg-gold-50 border-l-2 border-l-gold-400' : ''}`}
              >
                <p className="text-sm font-medium text-charcoal-900 truncate">{c.cliente_nome || 'Novo Cliente'}</p>
                <p className="text-xs text-charcoal-400 mt-1">
                  {c.total_mensagens} msgs - {new Date(c.atualizado_em).toLocaleDateString('pt-BR')}
                </p>
              </button>
            ))}
            {conversas.length === 0 && (
              <div className="p-4 text-center text-charcoal-400 text-sm">
                Nenhuma conversa ainda
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-charcoal-50 rounded-xl border border-charcoal-100 overflow-hidden">
          {conversaId ? (
            <ChatWindow
              mensagens={mensagens}
              enviando={enviando}
              onEnviar={enviarMensagem}
              ativo={true}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-charcoal-400">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-4 text-charcoal-300" />
                <p className="text-lg">Selecione ou inicie uma conversa</p>
                <p className="text-sm mt-1">A Dara ira atender o cliente com IA</p>
              </div>
            </div>
          )}
        </div>

        {/* Extracted data panel */}
        <div className="w-72 bg-white rounded-xl border border-charcoal-100 overflow-y-auto">
          <div className="p-4 border-b border-charcoal-100">
            <h2 className="font-semibold text-charcoal-900">Dados do Cliente</h2>
          </div>
          <DadosExtraidos dados={dadosExtraidos} />
        </div>
      </div>

      {/* New conversation modal */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova Conversa">
        <div className="space-y-4">
          <Input
            label="Nome do Cliente (opcional)"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            placeholder="Nome do cliente"
          />
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleNovaConversa}>Iniciar Conversa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
