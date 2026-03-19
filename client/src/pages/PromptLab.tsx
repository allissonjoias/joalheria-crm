import { useEffect, useState, useRef } from 'react';
import { Save, Send, Loader2, Trash2, Gem, FlaskConical, Bot, RotateCcw } from 'lucide-react';
import api from '../services/api';

interface TestMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Editor de prompt reutilizável ────────────────────────────────────────────
function EditorPrompt({
  titulo,
  prompt,
  setPrompt,
  promptOriginal,
  salvando,
  salvoMsg,
  onSalvar,
}: {
  titulo: string;
  prompt: string;
  setPrompt: (v: string) => void;
  promptOriginal: string;
  salvando: boolean;
  salvoMsg: string;
  onSalvar: () => void;
}) {
  const temAlteracoes = prompt !== promptOriginal;
  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 min-w-0">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-alisson-600" />
          <h2 className="font-semibold text-alisson-600 text-sm">{titulo}</h2>
        </div>
        <div className="flex items-center gap-2">
          {salvoMsg && (
            <span className={`text-xs ${salvoMsg === 'Salvo!' ? 'text-green-600' : 'text-red-600'}`}>
              {salvoMsg}
            </span>
          )}
          {temAlteracoes && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Nao salvo</span>
          )}
          <button
            onClick={() => setPrompt(promptOriginal)}
            disabled={!temAlteracoes}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            Desfazer
          </button>
          <button
            onClick={onSalvar}
            disabled={salvando || !temAlteracoes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-alisson-600 hover:bg-alisson-500 text-white text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            <Save size={14} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="flex-1 p-4 text-sm font-mono resize-none focus:outline-none leading-relaxed min-h-0"
        placeholder="Cole ou escreva o prompt aqui..."
      />

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
        <p className="text-xs text-gray-400">{prompt.length} caracteres</p>
      </div>
    </div>
  );
}

// ─── Chat de teste ────────────────────────────────────────────────────────────
function ChatTestar({ endpoint }: { endpoint: string }) {
  const [mensagens, setMensagens] = useState<TestMsg[]>([]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  const handleEnviar = async () => {
    if (!input.trim() || enviando) return;
    const texto = input.trim();
    setInput('');
    const userMsg: TestMsg = { id: 'u-' + Date.now(), role: 'user', content: texto };
    setMensagens(prev => [...prev, userMsg]);
    setEnviando(true);
    try {
      const historico = [...mensagens, userMsg].map(m => ({ role: m.role, content: m.content }));
      const { data } = await api.post(endpoint, { historico });
      setMensagens(prev => [...prev, { id: 'a-' + Date.now(), role: 'assistant', content: data.resposta }]);
    } catch {
      setMensagens(prev => [...prev, { id: 'e-' + Date.now(), role: 'assistant', content: 'Erro ao testar.' }]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 min-w-0">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-alisson-600 flex items-center justify-center">
            <Gem size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-alisson-600 text-sm">Testar IA</h2>
            <p className="text-xs text-gray-400">Converse como se fosse um cliente</p>
          </div>
        </div>
        {mensagens.length > 0 && (
          <button onClick={() => setMensagens([])} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
            Recomecar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 wa-chat-bg">
        {mensagens.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Gem size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm mb-2">Teste o prompt da IA</p>
            <div className="mt-4 flex flex-col gap-2 items-center">
              {['Oi, boa tarde!', 'Quero ver aliancas de casamento', 'Quanto custa um anel de noivado?'].map(s => (
                <button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-500 hover:border-alisson-300 hover:text-alisson-600 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensagens.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} mb-1`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg shadow-sm text-sm ${msg.role === 'user' ? 'bg-white rounded-tl-none text-gray-800' : 'bg-wa-bubble-out rounded-tr-none text-gray-800'}`}>
              <p className={`text-xs font-medium mb-1 ${msg.role === 'user' ? 'text-blue-600' : 'text-alisson-600'}`}>
                {msg.role === 'user' ? 'Cliente (voce)' : 'Agente IA'}
              </p>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-end mb-1">
            <div className="bg-wa-bubble-out px-3 py-2 rounded-lg rounded-tr-none shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-alisson-600 animate-spin" />
                <p className="text-xs text-gray-400">IA esta digitando...</p>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
            placeholder="Escreva como cliente..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm"
            disabled={enviando}
          />
          <button onClick={handleEnviar} disabled={enviando || !input.trim()} className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat de teste SDR (com BANT) ─────────────────────────────────────────────
function ChatTestarSdr() {
  const [historico, setHistorico] = useState<{ papel: string; conteudo: string }[]>([]);
  const [msgs, setMsgs] = useState<TestMsg[]>([]);
  const [bant, setBant] = useState<any>({});
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, enviando]);

  const handleEnviar = async () => {
    if (!input.trim() || enviando) return;
    const texto = input.trim();
    setInput('');
    const novaMsgDisplay: TestMsg = { id: 'u-' + Date.now(), role: 'user', content: texto };
    const novoHistorico = [...historico, { papel: 'lead', conteudo: texto }];
    setMsgs(prev => [...prev, novaMsgDisplay]);
    setHistorico(novoHistorico);
    setEnviando(true);
    try {
      const { data } = await api.post('/sdr-agent/simular', { historico: novoHistorico, bant });
      setMsgs(prev => [...prev, { id: 'a-' + Date.now(), role: 'assistant', content: data.resposta }]);
      setHistorico(prev => [...prev, { papel: 'dara', conteudo: data.resposta }]);
      if (data.bant) setBant(data.bant);
    } catch (err: any) {
      const msg = err?.response?.data?.erro || err?.message || 'Erro desconhecido';
      setMsgs(prev => [...prev, { id: 'e-' + Date.now(), role: 'assistant', content: `Erro: ${msg}` }]);
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => { setMsgs([]); setHistorico([]); setBant({}); };

  const bantFields = [
    { key: 'nome', label: 'Nome' },
    { key: 'need', label: 'Necessidade' },
    { key: 'budget', label: 'Orcamento' },
    { key: 'timeline', label: 'Prazo' },
    { key: 'authority', label: 'Decisor' },
  ];

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0">
      {/* Chat */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 min-h-0">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-alisson-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-alisson-600 text-sm">Testar Agente SDR</h2>
              <p className="text-xs text-gray-400">Simulacao com BANT em tempo real</p>
            </div>
          </div>
          {msgs.length > 0 && (
            <button onClick={reiniciar} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <RotateCcw size={14} />
              Reiniciar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 wa-chat-bg">
          {msgs.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Bot size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Teste o fluxo completo do Agente SDR</p>
              <p className="text-xs mt-1">O BANT e atualizado a cada resposta</p>
            </div>
          )}
          {msgs.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} mb-1`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-lg shadow-sm text-sm ${msg.role === 'user' ? 'bg-white rounded-tl-none text-gray-800' : 'bg-wa-bubble-out rounded-tr-none text-gray-800'}`}>
                <p className={`text-xs font-medium mb-1 ${msg.role === 'user' ? 'text-blue-600' : 'text-alisson-600'}`}>
                  {msg.role === 'user' ? 'Lead (voce)' : 'Agente SDR'}
                </p>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex justify-end mb-1">
              <div className="bg-wa-bubble-out px-3 py-2 rounded-lg rounded-tr-none shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-alisson-600 animate-spin" />
                  <p className="text-xs text-gray-400">IA esta digitando...</p>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-gray-100 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
              placeholder="Escreva como lead..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm"
              disabled={enviando}
            />
            <button onClick={handleEnviar} disabled={enviando || !input.trim()} className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-40">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* BANT mini */}
      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">BANT detectado</p>
        <div className="grid grid-cols-5 gap-1">
          {bantFields.map(({ key, label }) => {
            const val = bant[key];
            return (
              <div key={key} className={`rounded p-1.5 text-center ${val ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className="text-[10px] text-gray-500">{label}</p>
                <p className={`text-[10px] font-medium truncate mt-0.5 ${val ? 'text-green-700' : 'text-gray-300'}`}>{val || '—'}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function PromptLab() {
  // Dara Chat
  const [promptChat, setPromptChat] = useState('');
  const [promptChatOriginal, setPromptChatOriginal] = useState('');
  const [salvandoChat, setSalvandoChat] = useState(false);
  const [salvoMsgChat, setSalvoMsgChat] = useState('');

  // Dara SDR
  const [promptSdr, setPromptSdr] = useState('');
  const [promptSdrOriginal, setPromptSdrOriginal] = useState('');
  const [salvandoSdr, setSalvandoSdr] = useState(false);
  const [salvoMsgSdr, setSalvoMsgSdr] = useState('');

  useEffect(() => {
    api.get('/chat/config').then(({ data }) => {
      setPromptChat(data.prompt_personalizado || '');
      setPromptChatOriginal(data.prompt_personalizado || '');
    }).catch(() => {});

    api.get('/sdr-agent/prompt-dara').then(({ data }) => {
      setPromptSdr(data.prompt || '');
      setPromptSdrOriginal(data.prompt || '');
    }).catch(() => {});
  }, []);

  const salvarChat = async () => {
    setSalvandoChat(true);
    setSalvoMsgChat('');
    try {
      await api.put('/chat/config', { prompt_personalizado: promptChat });
      setPromptChatOriginal(promptChat);
      setSalvoMsgChat('Salvo!');
      setTimeout(() => setSalvoMsgChat(''), 3000);
    } catch {
      setSalvoMsgChat('Erro ao salvar');
    } finally {
      setSalvandoChat(false);
    }
  };

  const salvarSdr = async () => {
    setSalvandoSdr(true);
    setSalvoMsgSdr('');
    try {
      await api.put('/sdr-agent/prompt-dara', { prompt: promptSdr });
      setPromptSdrOriginal(promptSdr);
      setSalvoMsgSdr('Salvo!');
      setTimeout(() => setSalvoMsgSdr(''), 3000);
    } catch {
      setSalvoMsgSdr('Erro ao salvar');
    } finally {
      setSalvandoSdr(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Agente Chat */}
      <div className="flex gap-4 flex-1 min-h-0">
        <EditorPrompt
          titulo="Prompt do Agente — Chat WhatsApp"
          prompt={promptChat}
          setPrompt={setPromptChat}
          promptOriginal={promptChatOriginal}
          salvando={salvandoChat}
          salvoMsg={salvoMsgChat}
          onSalvar={salvarChat}
        />
        <ChatTestar endpoint="/chat/conversas/test-prompt" />
      </div>

      <div className="border-t border-gray-200" />

      {/* Agente SDR */}
      <div className="flex gap-4 flex-1 min-h-0">
        <EditorPrompt
          titulo="Prompt do Agente SDR"
          prompt={promptSdr}
          setPrompt={setPromptSdr}
          promptOriginal={promptSdrOriginal}
          salvando={salvandoSdr}
          salvoMsg={salvoMsgSdr}
          onSalvar={salvarSdr}
        />
        <ChatTestarSdr />
      </div>
    </div>
  );
}
