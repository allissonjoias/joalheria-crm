import { useState } from 'react';
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

  const bantScore = conversa.bant_score || 0;
  const bantCor = bantScore >= 3 ? 'bg-green-500' : bantScore >= 2 ? 'bg-yellow-500' : bantScore >= 1 ? 'bg-gray-400' : '';

  const [imgErro, setImgErro] = useState(false);
  const temFoto = conversa.foto_perfil && !imgErro;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-wa-bg-panel transition-colors border-b border-wa-border ${
        selecionada ? 'bg-wa-bg-panel' : 'bg-white'
      }`}
    >
      {/* Avatar */}
      <div className="relative w-12 h-12 flex-shrink-0">
        {temFoto ? (
          <img
            src={conversa.foto_perfil}
            alt={nome}
            className="w-12 h-12 rounded-full object-cover"
            onError={() => setImgErro(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-alisson-600">
            <span className="text-white font-bold text-lg">{nome.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {/* BANT badge */}
        {bantScore > 0 && (
          <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 ${bantCor} rounded-full flex items-center justify-center border-2 border-white`}>
            <span className="text-white text-[9px] font-bold">{bantScore}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-base font-normal truncate text-alisson-600">{nome}</p>
          <span className="text-xs text-wa-time flex-shrink-0 ml-2">{hora}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm text-wa-time truncate flex-1">{preview}</p>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <CanalBadge canal={conversa.canal} />
            {conversa.modo_auto ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-wa-green-msg text-alisson-600 font-medium">IA</span>
            ) : null}
            {conversa.nao_lidas != null && conversa.nao_lidas > 0 ? (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25d366] text-white text-[11px] font-bold flex items-center justify-center leading-none">
                {conversa.nao_lidas > 99 ? '99+' : conversa.nao_lidas}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
