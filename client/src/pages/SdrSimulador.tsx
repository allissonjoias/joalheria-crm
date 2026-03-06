import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Bot, User, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Mensagem {
  papel: 'lead' | 'dara';
  conteudo: string;
  timestamp: Date;
}

interface Bant {
  need?: string | null;
  budget?: string | null;
  timeline?: string | null;
  authority?: string | null;
}

interface DadosExtraidos {
  need?: string | null;
  budget?: string | null;
  timeline?: string | null;
  authority?: string | null;
  tipo_interesse?: string | null;
  ocasiao?: string | null;
  nome_cliente?: string | null;
  transferir_humano?: boolean;
}

const MENSAGENS_RAPIDAS = [
  'Oi, quero ver alianças de casamento',
  'Quanto custa um anel de ouro?',
  'Preciso de um presente para minha namorada',
  'Tem brincos de ouro?',
  'Quero fazer um colar personalizado',
  'Qual o prazo de entrega?',
];

export default function SdrSimulador() {
  const { token } = useAuth();
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [bant, setBant] = useState<Bant>({});
  const [leadScore, setLeadScore] = useState(0);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [transferirHumano, setTransferirHumano] = useState(false);
  const [mostrarBant, setMostrarBant] = useState(true);
  const [nomeSimulado, setNomeSimulado] = useState('Lead Simulado');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [historico]);

  const enviar = async (mensagemTexto?: string) => {
    const msg = mensagemTexto || texto.trim();
    if (!msg || carregando) return;

    const novaMensagem: Mensagem = { papel: 'lead', conteudo: msg, timestamp: new Date() };
    const novoHistorico = [...historico, novaMensagem];
    setHistorico(novoHistorico);
    setTexto('');
    setCarregando(true);

    try {
      const resp = await fetch('/api/sdr-agent/simular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          historico: novoHistorico.map(m => ({ papel: m.papel, conteudo: m.conteudo })),
          bant,
          leadScore,
        }),
      });

      const data = await resp.json();

      if (data.erro) throw new Error(data.erro);

      setHistorico(prev => [
        ...prev,
        { papel: 'dara', conteudo: data.resposta, timestamp: new Date() },
      ]);

      if (data.bant) setBant(data.bant);
      if (data.lead_score !== undefined) setLeadScore(data.lead_score);
      if (data.transferir_humano) setTransferirHumano(true);
    } catch (e: any) {
      setHistorico(prev => [
        ...prev,
        { papel: 'dara', conteudo: `[Erro: ${e.message}]`, timestamp: new Date() },
      ]);
    } finally {
      setCarregando(false);
    }
  };

  const reiniciar = () => {
    setHistorico([]);
    setBant({});
    setLeadScore(0);
    setTransferirHumano(false);
    setTexto('');
  };

  const scoreColor = leadScore >= 100 ? 'text-green-600' : leadScore >= 50 ? 'text-yellow-600' : 'text-red-500';
  const bantPreenchido = Object.values(bant).filter(v => v).length;

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">

      {/* Coluna esquerda: chat */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Header do chat */}
        <div className="bg-alisson-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-alisson-400 flex items-center justify-center">
              <Bot size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm">Dara — Alisson Joias</p>
              <p className="text-xs text-alisson-200">Consultora virtual</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-alisson-500 px-2 py-0.5 rounded-full">Modo Simulacao</span>
            <button
              onClick={reiniciar}
              title="Reiniciar conversa"
              className="p-1.5 hover:bg-alisson-500 rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Nome do lead simulado */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <User size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">Simulando como:</span>
          <input
            value={nomeSimulado}
            onChange={e => setNomeSimulado(e.target.value)}
            className="text-xs font-medium text-gray-700 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-alisson-400 px-1"
          />
        </div>

        {/* Mensagens */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {historico.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
              <Bot size={48} className="mb-3 opacity-30" />
              <p className="font-medium text-gray-500">Simulador da Dara</p>
              <p className="text-sm mt-1">Digite uma mensagem como se fosse um lead novo</p>
              <p className="text-xs mt-3 text-gray-400">ou escolha uma mensagem rapida abaixo</p>
            </div>
          )}

          {historico.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.papel === 'lead' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.papel === 'dara' && (
                <div className="w-7 h-7 rounded-full bg-alisson-500 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  msg.papel === 'lead'
                    ? 'bg-alisson-500 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                <p className={`text-xs mt-1 ${msg.papel === 'lead' ? 'text-alisson-200' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.papel === 'lead' && (
                <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                  <User size={14} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {carregando && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-alisson-500 flex items-center justify-center mr-2 flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {transferirHumano && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 flex items-center gap-2">
              <Zap size={16} />
              <span>Dara solicitou transferencia para atendente humano</span>
            </div>
          )}
        </div>

        {/* Mensagens rápidas */}
        <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-hide">
          {MENSAGENS_RAPIDAS.map((m, i) => (
            <button
              key={i}
              onClick={() => enviar(m)}
              disabled={carregando}
              className="flex-shrink-0 text-xs bg-alisson-50 hover:bg-alisson-100 text-alisson-700 border border-alisson-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              {m}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Digite como se fosse o lead..."
              disabled={carregando}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400 focus:border-alisson-400 disabled:opacity-50"
            />
            <button
              onClick={() => enviar()}
              disabled={carregando || !texto.trim()}
              className="bg-alisson-500 hover:bg-alisson-600 text-white rounded-xl px-4 py-2.5 disabled:opacity-40 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Coluna direita: painel de qualificação */}
      <div className="w-72 flex flex-col gap-4">

        {/* Score */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lead Score</p>
          <div className="flex items-end gap-2 mb-2">
            <span className={`text-4xl font-bold ${scoreColor}`}>{leadScore}</span>
            <span className="text-gray-400 text-sm mb-1">/150</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                leadScore >= 100 ? 'bg-green-500' : leadScore >= 50 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(100, (leadScore / 150) * 100)}%` }}
            />
          </div>
          <p className={`text-xs mt-2 font-medium ${scoreColor}`}>
            {leadScore >= 100 ? 'Quente — pronto para oferta' : leadScore >= 50 ? 'Morno — qualificando' : 'Frio — inicio da conversa'}
          </p>
        </div>

        {/* BANT */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1">
          <button
            onClick={() => setMostrarBant(!mostrarBant)}
            className="flex items-center justify-between w-full mb-3"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Qualificacao BANT ({bantPreenchido}/4)
            </p>
            {mostrarBant ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {mostrarBant && (
            <div className="space-y-3">
              {[
                { key: 'need', label: 'Need (Necessidade)', emoji: '🎯' },
                { key: 'budget', label: 'Budget (Orcamento)', emoji: '💰' },
                { key: 'timeline', label: 'Timeline (Prazo)', emoji: '📅' },
                { key: 'authority', label: 'Authority (Decisor)', emoji: '👤' },
              ].map(({ key, label, emoji }) => (
                <div key={key} className={`rounded-lg p-3 border ${(bant as any)[key] ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{emoji}</span>
                    <p className="text-xs font-medium text-gray-600">{label}</p>
                    {(bant as any)[key] && <span className="ml-auto text-green-500 text-xs">✓</span>}
                  </div>
                  <p className={`text-xs ${(bant as any)[key] ? 'text-green-700 font-medium' : 'text-gray-400 italic'}`}>
                    {(bant as any)[key] || 'Nao coletado ainda'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dica */}
        <div className="bg-alisson-50 border border-alisson-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-alisson-700 mb-1">Como testar</p>
          <ul className="text-xs text-alisson-600 space-y-1">
            <li>• Escreva como um cliente real faria</li>
            <li>• Veja o BANT sendo preenchido</li>
            <li>• Teste objecoes e pedidos de preco</li>
            <li>• Clique em "Reiniciar" para nova conversa</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
