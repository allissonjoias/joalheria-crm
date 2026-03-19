import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Send, Loader2, Trash2 } from 'lucide-react';
import api from '../../services/api';

interface Mensagem {
  role: 'user' | 'assistant';
  content: string;
}

export function AjudaCrmWidget() {
  const [aberto, setAberto] = useState(false);
  const [input, setInput] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (aberto) inputRef.current?.focus();
  }, [aberto]);

  const enviar = async () => {
    const pergunta = input.trim();
    if (!pergunta || enviando) return;

    setInput('');
    setMensagens(prev => [...prev, { role: 'user', content: pergunta }]);
    setEnviando(true);

    try {
      const { data } = await api.post('/chat/ajuda-crm', {
        pergunta,
        historico: mensagens,
      });
      setMensagens(prev => [...prev, { role: 'assistant', content: data.resposta }]);
    } catch (err: any) {
      const msg = err?.response?.data?.erro || 'Desculpe, nao consegui processar sua pergunta. Tente novamente.';
      setMensagens(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setEnviando(false);
    }
  };

  const limpar = () => {
    setMensagens([]);
  };

  return (
    <>
      {/* Botao flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
          title="Precisa de ajuda?"
        >
          <HelpCircle size={28} />
        </button>
      )}

      {/* Janela de chat */}
      {aberto && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-alisson-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <HelpCircle size={20} />
              <div>
                <p className="font-semibold text-sm">Ajuda do CRM</p>
                <p className="text-xs text-alisson-200">Tire suas duvidas sobre o sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {mensagens.length > 0 && (
                <button onClick={limpar} className="p-1.5 hover:bg-alisson-500 rounded-lg transition-colors" title="Limpar conversa">
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={() => setAberto(false)} className="p-1.5 hover:bg-alisson-500 rounded-lg transition-colors" title="Fechar">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {mensagens.length === 0 && (
              <div className="text-center py-8 px-4">
                <HelpCircle size={40} className="mx-auto text-alisson-300 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-2">Como posso ajudar?</p>
                <p className="text-xs text-gray-400 mb-4">Pergunte qualquer coisa sobre o CRM</p>
                <div className="space-y-2">
                  {[
                    'Como conectar o WhatsApp?',
                    'Como ativar a IA nas conversas?',
                    'O que e ODV no funil?',
                    'Como cadastrar um produto?',
                  ].map((sugestao) => (
                    <button
                      key={sugestao}
                      onClick={() => { setInput(sugestao); }}
                      className="w-full text-left px-3 py-2 text-xs bg-gray-50 hover:bg-alisson-50 rounded-lg text-gray-600 hover:text-alisson-600 transition-colors border border-gray-100"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-alisson-600 text-white rounded-tr-none'
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}>
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-1.5' : ''}>{line}</p>
                  ))}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-tl-none">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-alisson-600 animate-spin" />
                    <p className="text-xs text-gray-400">Pensando...</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Digite sua duvida..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400"
                disabled={enviando}
              />
              <button
                onClick={enviar}
                disabled={enviando || !input.trim()}
                className="p-2 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
