import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, MoreVertical, Target } from 'lucide-react';
import { MensagemItem } from './MensagemItem';
import { MensageriaInput } from './MensageriaInput';
import { CanalBadge } from './CanalBadge';
import { ModoAutoToggle } from './ModoAutoToggle';
import type { Mensagem, Conversa } from '../../hooks/useMensageria';

function BANTBadge({ conversa }: { conversa: Conversa }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const score = conversa.bant_score || 0;
  const qualificado = conversa.bant_qualificado === 1;

  const bgColor = qualificado
    ? 'bg-green-500'
    : score >= 2
    ? 'bg-yellow-500'
    : 'bg-gray-400';

  const items = [
    { label: 'N', value: conversa.bant_need, name: 'Necessidade' },
    { label: 'B', value: conversa.bant_budget, name: 'Orcamento' },
    { label: 'A', value: conversa.bant_authority, name: 'Decisor' },
    { label: 'T', value: conversa.bant_timeline, name: 'Prazo' },
  ];

  return (
    <div className="relative">
      <button
        className={`${bgColor} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-colors`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <Target size={12} />
        BANT {score}/4
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 bg-gray-900 text-white text-xs rounded-lg p-3 min-w-56 z-50 shadow-lg">
          <p className="font-bold mb-2">
            {qualificado ? 'Lead Qualificado' : 'Em Qualificacao'} ({score}/4)
          </p>
          {items.map(item => (
            <div key={item.label} className="flex gap-2 mb-1">
              <span className={`font-bold ${item.value ? 'text-green-400' : 'text-gray-500'}`}>
                {item.label}:
              </span>
              <span className={item.value ? 'text-gray-200' : 'text-gray-500'}>
                {item.value || 'Nao coletado'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MensageriaWindowProps {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  enviando: boolean;
  onEnviar: (mensagem: string) => void;
  onEnviarComDara: () => void;
  onEnviarMidia: (arquivo: File, caption?: string) => void;
  onToggleModoAuto: () => void;
}

export function MensageriaWindow({
  conversa,
  mensagens,
  enviando,
  onEnviar,
  onEnviarComDara,
  onEnviarMidia,
  onToggleModoAuto,
}: MensageriaWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  if (!conversa) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-creme-200">
        <img src="/leao.svg" alt="WhatsAlisson" className="w-48 h-48 opacity-15 mb-6" />
        <h3 className="text-2xl font-light text-gray-500 mb-2">WhatsAlisson</h3>
        <p className="text-sm text-gray-400 text-center max-w-md">
          Envie e receba mensagens de WhatsApp, Instagram e chat interno.<br/>
          Selecione uma conversa para comecar.
        </p>
      </div>
    );
  }

  const nome = conversa.cliente_nome || conversa.meta_contato_nome || 'Contato';

  return (
    <div className="flex flex-col h-full">
      {/* Header estilo WhatsApp */}
      <div className="bg-alisson-600 px-4 py-2.5 flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-alisson-400 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">{nome.charAt(0).toUpperCase()}</span>
        </div>

        {/* Info do contato */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-white truncate">{nome}</p>
          <div className="flex items-center gap-2">
            {conversa.cliente_telefone && (
              <span className="text-xs text-alisson-200">{conversa.cliente_telefone}</span>
            )}
            <CanalBadge canal={conversa.canal} tamanho="sm" />
          </div>
        </div>

        {/* BANT Badge + Ações */}
        <div className="flex items-center gap-2">
          {conversa.bant_score !== undefined && conversa.bant_score > 0 && (
            <BANTBadge conversa={conversa} />
          )}
          <ModoAutoToggle ativo={!!conversa.modo_auto} onToggle={onToggleModoAuto} />
          <button className="p-2 hover:bg-alisson-500 rounded-full transition-colors">
            <MoreVertical size={20} className="text-creme-200" />
          </button>
        </div>
      </div>

      {/* Area de mensagens com fundo wallpaper WhatsApp */}
      <div className="flex-1 overflow-y-auto px-16 py-4 wa-chat-bg">
        {mensagens.length === 0 && (
          <div className="flex justify-center my-4">
            <div className="bg-white/80 px-4 py-2 rounded-lg shadow-sm text-xs text-wa-time text-center">
              Mensagens aparecerao aqui
            </div>
          </div>
        )}
        {mensagens.map((msg) => (
          <MensagemItem key={msg.id} mensagem={msg} />
        ))}
        {enviando && (
          <div className="flex justify-end mb-1">
            <div className="bg-wa-bubble-out px-4 py-3 rounded-lg rounded-tr-none shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="text-alisson-600 animate-spin" />
                <p className="text-sm text-wa-time">Dara esta digitando...</p>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MensageriaInput
        onEnviar={onEnviar}
        onEnviarComDara={onEnviarComDara}
        onEnviarMidia={onEnviarMidia}
        desabilitado={enviando}
        canalAtual={conversa.canal}
      />
    </div>
  );
}
