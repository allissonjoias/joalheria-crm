import { useEffect, useState, useRef } from 'react';
import { Plus, MessageSquare, Settings, Send, Loader2, Trash2, Gem, Save, Sparkles } from 'lucide-react';
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

interface ConsultaMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type TabAtiva = 'consultar' | 'atendimentos';

export default function Chat() {
  const { mensagens, dadosExtraidos, enviando, conversaId, iniciarConversa, carregarConversa, enviarMensagem } = useChat();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');
  const [tabAtiva, setTabAtiva] = useState<TabAtiva>('consultar');

  // Consultar Dara
  const [consultaPergunta, setConsultaPergunta] = useState('');
  const [consultaMsgs, setConsultaMsgs] = useState<ConsultaMsg[]>([]);
  const [consultando, setConsultando] = useState(false);
  const consultaEndRef = useRef<HTMLDivElement>(null);

  // Config Prompt
  const [configAberto, setConfigAberto] = useState(false);
  const [promptCustom, setPromptCustom] = useState('');
  const [salvandoPrompt, setSalvandoPrompt] = useState(false);

  useEffect(() => {
    carregarConversas();
    carregarConfig();
  }, []);

  useEffect(() => {
    consultaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consultaMsgs, consultando]);

  const carregarConversas = async () => {
    try {
      const { data } = await api.get('/chat/conversas');
      setConversas(data);
    } catch {}
  };

  const carregarConfig = async () => {
    try {
      const { data } = await api.get('/chat/config');
      setPromptCustom(data.prompt_personalizado || '');
    } catch {}
  };

  const handleSalvarPrompt = async () => {
    setSalvandoPrompt(true);
    try {
      await api.put('/chat/config', { prompt_personalizado: promptCustom });
      setConfigAberto(false);
    } catch (e: any) {
      alert('Erro ao salvar prompt');
    } finally {
      setSalvandoPrompt(false);
    }
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

  // Consultar Dara
  const handleConsultar = async () => {
    if (!consultaPergunta.trim() || consultando) return;

    const pergunta = consultaPergunta.trim();
    setConsultaPergunta('');

    const userMsg: ConsultaMsg = {
      id: 'u-' + Date.now(),
      role: 'user',
      content: pergunta,
    };
    setConsultaMsgs(prev => [...prev, userMsg]);
    setConsultando(true);

    try {
      // Send history for context
      const historico = consultaMsgs.map(m => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/chat/consultar', { pergunta, historico });

      const assistantMsg: ConsultaMsg = {
        id: 'a-' + Date.now(),
        role: 'assistant',
        content: data.resposta,
      };
      setConsultaMsgs(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errorMsg: ConsultaMsg = {
        id: 'e-' + Date.now(),
        role: 'assistant',
        content: 'Erro ao consultar. Verifique se a chave da API Claude esta configurada.',
      };
      setConsultaMsgs(prev => [...prev, errorMsg]);
    } finally {
      setConsultando(false);
    }
  };

  const handleConsultaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConsultar();
    }
  };

  return (
    <div className="h-[calc(100vh-7rem)]">
      {/* Header com tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setTabAtiva('consultar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tabAtiva === 'consultar'
                ? 'bg-alisson-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sparkles size={16} />
            Consultar Dara
          </button>
          <button
            onClick={() => setTabAtiva('atendimentos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tabAtiva === 'atendimentos'
                ? 'bg-alisson-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare size={16} />
            Atendimentos
          </button>
        </div>
        <button
          onClick={() => setConfigAberto(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-alisson-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Configurar prompt da Dara"
        >
          <Settings size={18} />
          Prompt
        </button>
      </div>

      {/* Tab: Consultar Dara */}
      {tabAtiva === 'consultar' && (
        <div className="h-[calc(100%-3.5rem)] bg-white rounded-xl border border-gray-100 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-alisson-600 flex items-center justify-center">
                <Gem size={16} className="text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-alisson-600 text-sm">Dara IA</h2>
                <p className="text-xs text-gray-400">Assistente para consultoras</p>
              </div>
            </div>
            {consultaMsgs.length > 0 && (
              <button
                onClick={() => setConsultaMsgs([])}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
                Limpar
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {consultaMsgs.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Sparkles size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">Pergunte a Dara</p>
                <p className="text-sm max-w-md mx-auto">
                  Cole uma conversa de cliente, tire duvidas sobre produtos ou peca sugestoes de resposta. A Dara vai ajudar com base no conhecimento da Alisson.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {[
                    'Como responder um cliente que quer desconto?',
                    'Sugira aliancas para casamento ate R$5.000',
                    'Qual a melhor abordagem para reativar clientes?',
                  ].map((sugestao) => (
                    <button
                      key={sugestao}
                      onClick={() => { setConsultaPergunta(sugestao); }}
                      className="text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-alisson-50 hover:border-alisson-300 hover:text-alisson-600 transition-colors text-left"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {consultaMsgs.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'assistant' ? 'bg-alisson-600' : 'bg-gray-600'}`}>
                  {msg.role === 'assistant' ? <Gem size={16} className="text-white" /> : <span className="text-white text-xs font-bold">Eu</span>}
                </div>
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-none'
                      : 'bg-alisson-600 text-white rounded-tr-none'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {msg.role === 'assistant' ? 'Dara IA' : 'Voce'}
                  </p>
                </div>
              </div>
            ))}
            {consultando && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-alisson-600 flex items-center justify-center">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
                <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none">
                  <p className="text-sm text-gray-400">Dara esta pensando...</p>
                </div>
              </div>
            )}
            <div ref={consultaEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4 bg-white">
            <div className="flex gap-2">
              <textarea
                value={consultaPergunta}
                onChange={(e) => setConsultaPergunta(e.target.value)}
                onKeyDown={handleConsultaKeyDown}
                placeholder="Cole a conversa do cliente, tire duvidas ou peca sugestoes..."
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm resize-none"
                rows={2}
                disabled={consultando}
              />
              <button
                onClick={handleConsultar}
                disabled={consultando || !consultaPergunta.trim()}
                className="px-4 py-3 bg-alisson-600 hover:bg-alisson-500 text-white rounded-xl transition-colors disabled:opacity-50 self-end"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Atendimentos */}
      {tabAtiva === 'atendimentos' && (
        <div className="flex gap-4 h-[calc(100%-3.5rem)]">
          {/* Conversation list */}
          <div className="w-72 bg-white rounded-xl border border-gray-100 flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-alisson-600">Conversas</h2>
              <Button tamanho="sm" onClick={() => setModalAberto(true)}>
                <Plus size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelecionarConversa(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${conversaId === c.id ? 'bg-alisson-50 border-l-2 border-l-alisson-400' : ''}`}
                >
                  <p className="text-sm font-medium text-alisson-600 truncate">{c.cliente_nome || 'Novo Cliente'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.total_mensagens} msgs - {new Date(c.atualizado_em).toLocaleDateString('pt-BR')}
                  </p>
                </button>
              ))}
              {conversas.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Nenhuma conversa ainda
                </div>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
            {conversaId ? (
              <ChatWindow
                mensagens={mensagens}
                enviando={enviando}
                onEnviar={enviarMensagem}
                ativo={true}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Selecione ou inicie uma conversa</p>
                  <p className="text-sm mt-1">A Dara ira atender o cliente com IA</p>
                </div>
              </div>
            )}
          </div>

          {/* Extracted data panel */}
          <div className="w-72 bg-white rounded-xl border border-gray-100 overflow-y-auto">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-alisson-600">Dados do Cliente</h2>
            </div>
            <DadosExtraidos dados={dadosExtraidos} />
          </div>
        </div>
      )}

      {/* Modal: Nova Conversa */}
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

      {/* Modal: Configurar Prompt */}
      <Modal aberto={configAberto} onFechar={() => setConfigAberto(false)} titulo="Configurar Prompt da Dara">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Adicione instrucoes personalizadas para a Dara. Essas instrucoes serao adicionadas ao comportamento padrao dela nos atendimentos e nas consultas.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrucoes adicionais
            </label>
            <textarea
              value={promptCustom}
              onChange={(e) => setPromptCustom(e.target.value)}
              placeholder="Ex: Sempre oferecer a colecao nova primeiro. Mencionar a promocao de aniversario de 10% para aliancas. Nunca dar desconto acima de 5%..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm resize-none"
              rows={8}
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              A Dara ja tem conhecimento padrao sobre: identidade, tom de voz, produtos, precos, regras de atendimento e coleta de dados. Use este campo para adicionar instrucoes especificas como promocoes, regras de desconto, novos produtos ou orientacoes de campanha.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setConfigAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvarPrompt} disabled={salvandoPrompt}>
              <Save size={16} />
              {salvandoPrompt ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
