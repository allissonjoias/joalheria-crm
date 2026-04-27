import { useState } from 'react';
import { CanalBadge } from './CanalBadge';
import type { Conversa } from '../../hooks/useMensageria';

// Cores variadas para avatares sem foto (estilo WhatsApp/Google)
const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-rose-600',
  'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
  'bg-orange-600', 'bg-pink-600', 'bg-lime-700', 'bg-fuchsia-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

interface ConversaItemProps {
  conversa: Conversa;
  selecionada: boolean;
  onClick: () => void;
}

export function ConversaItem({ conversa, selecionada, onClick }: ConversaItemProps) {
  const nome = conversa.cliente_nome || conversa.meta_contato_nome || 'Contato';
  let msgPreview = conversa.ultima_mensagem || '';
  // Extrair campo "resposta" se for JSON (respostas antigas da IA)
  try {
    if (msgPreview.startsWith('{')) {
      const parsed = JSON.parse(msgPreview);
      if (parsed.resposta) msgPreview = parsed.resposta;
    }
  } catch {}
  const preview = msgPreview
    ? msgPreview.substring(0, 55) + (msgPreview.length > 55 ? '...' : '')
    : 'Nenhuma mensagem';

  // Formatar data: Hoje = HH:MM, Ontem = "Ontem", depois = dd/mm/aaaa
  const dataFormatada = (() => {
    if (!conversa.ultima_msg_em) return '';
    // Extrair data e hora do timestamp do banco (localtime Fortaleza)
    const matchFull = conversa.ultima_msg_em.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!matchFull) {
      const matchHora = conversa.ultima_msg_em.match(/(\d{2}):(\d{2})/);
      return matchHora ? `${matchHora[1]}:${matchHora[2]}` : '';
    }
    const [, ano, mes, dia, hh, mm] = matchFull;
    const dataMsg = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    if (dataMsg.getTime() >= hoje.getTime()) {
      return `${hh}:${mm}`;
    } else if (dataMsg.getTime() >= ontem.getTime()) {
      return 'Ontem';
    } else if (dataMsg.getFullYear() === hoje.getFullYear()) {
      return `${dia}/${mes}`;
    } else {
      return `${dia}/${mes}/${ano.slice(2)}`;
    }
  })();

  const bantScore = conversa.bant_score || 0;
  const bantCor = bantScore >= 3 ? 'bg-green-500' : bantScore >= 2 ? 'bg-yellow-500' : bantScore >= 1 ? 'bg-gray-400' : '';

  const [imgErro, setImgErro] = useState(false);
  const fotoUrl = conversa.foto_perfil || '';
  // Aceitar: URLs locais (/uploads), URLs https que NAO sejam do WhatsApp (expiram rapido)
  const fotoValida = fotoUrl && !imgErro && (
    fotoUrl.startsWith('/uploads') ||
    (fotoUrl.startsWith('http') && !fotoUrl.includes('pps.whatsapp.net'))
  );

  const avatarColor = getAvatarColor(nome);
  const initials = getInitials(nome);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-wa-bg-panel transition-colors border-b border-wa-border ${
        selecionada ? 'bg-wa-bg-panel' : 'bg-white'
      }`}
    >
      {/* Avatar */}
      <div className="relative w-12 h-12 flex-shrink-0">
        {fotoValida ? (
          <img
            src={fotoUrl}
            alt={nome}
            className="w-12 h-12 rounded-full object-cover"
            onError={() => setImgErro(true)}
          />
        ) : (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${avatarColor}`}>
            <span className="text-white font-bold text-sm">{initials}</span>
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
          <span className="text-xs text-wa-time flex-shrink-0 ml-2">{dataFormatada}</span>
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
