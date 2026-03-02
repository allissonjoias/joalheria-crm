import { CanalBadge } from './CanalBadge';
import type { Conversa } from '../../hooks/useMensageria';

interface ConversaItemProps {
  conversa: Conversa;
  selecionada: boolean;
  onClick: () => void;
}

export function ConversaItem({ conversa, selecionada, onClick }: ConversaItemProps) {
  const nome = conversa.cliente_nome || conversa.meta_contato_nome || 'Contato';
  const preview = conversa.ultima_mensagem
    ? conversa.ultima_mensagem.substring(0, 55) + (conversa.ultima_mensagem.length > 55 ? '...' : '')
    : 'Nenhuma mensagem';

  const hora = conversa.ultima_msg_em
    ? new Date(conversa.ultima_msg_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-wa-bg-panel transition-colors border-b border-wa-border ${
        selecionada ? 'bg-wa-bg-panel' : 'bg-white'
      }`}
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-alisson-600 flex-shrink-0 flex items-center justify-center">
        <span className="text-white font-bold text-lg">{nome.charAt(0).toUpperCase()}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-base font-normal text-alisson-600 truncate">{nome}</p>
          <span className="text-xs text-wa-time flex-shrink-0 ml-2">{hora}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm text-wa-time truncate flex-1">{preview}</p>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <CanalBadge canal={conversa.canal} />
            {conversa.modo_auto ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-wa-green-msg text-alisson-600 font-medium">AI</span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
