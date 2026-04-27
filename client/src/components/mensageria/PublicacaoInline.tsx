import { ExternalLink, Image as ImageIcon, Film, Camera, MessageCircle, Reply } from 'lucide-react';
import type { InstagramPostInfo } from '../../hooks/useMensageria';

interface Props {
  post: InstagramPostInfo;
  /** 'instagram_comment' = comentou na publicação; 'instagram_dm' = respondeu story/post */
  canalOrigem?: string;
  /** alinhamento (lado da bolha) */
  align?: 'left' | 'right';
}

const TIPO_LABEL: Record<string, string> = {
  FEED: 'post',
  REELS: 'reels',
  STORY: 'story',
  AD: 'anúncio',
};

const TIPO_ICON: Record<string, any> = {
  FEED: Camera,
  REELS: Film,
  STORY: ImageIcon,
};

export function PublicacaoInline({ post, canalOrigem, align = 'left' }: Props) {
  const tipo = (post.media_product_type || '').toUpperCase();
  const tipoLabel = TIPO_LABEL[tipo] || (post.tipo === 'reel' ? 'reels' : post.tipo === 'story' ? 'story' : 'publicação');
  const Icon = TIPO_ICON[tipo] || Camera;
  const thumb = post.thumbnail_url || post.media_url;
  const caption = (post.caption || '').trim();

  const isComment = canalOrigem === 'instagram_comment';
  const ContextIcon = isComment ? MessageCircle : Reply;
  const contextLabel = isComment
    ? `Comentou no ${tipoLabel}`
    : `Respondeu ao seu ${tipoLabel}`;

  return (
    <a
      href={post.permalink || '#'}
      target="_blank"
      rel="noreferrer"
      className={`flex flex-col mb-2 w-[340px] max-w-full rounded-xl overflow-hidden border-2 border-amber-300 bg-white hover:border-amber-400 hover:shadow-md transition-all shadow-sm ${align === 'right' ? 'self-end' : 'self-start'}`}
      title="Abrir publicação no Instagram"
    >
      {/* Cabeçalho com tipo + abrir */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border-b border-amber-200">
        <ContextIcon size={13} className="text-amber-800" />
        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex-1 truncate">
          {contextLabel}
        </span>
        <Icon size={13} className="text-amber-700" />
        <span className="text-[10px] font-medium text-amber-700 uppercase">{tipoLabel}</span>
      </div>

      {/* Imagem grande */}
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="w-full aspect-square object-cover bg-gray-100"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-amber-100 to-amber-200 flex flex-col items-center justify-center gap-2">
          <Icon size={48} className="text-amber-400" />
          <span className="text-xs text-amber-700">Prévia indisponível</span>
        </div>
      )}

      {/* Legenda completa (limitada a 5 linhas) */}
      {caption && (
        <div className="px-3 py-2 bg-white border-t border-amber-100">
          <p className="text-[13px] text-gray-700 leading-snug whitespace-pre-wrap line-clamp-5">
            {caption}
          </p>
        </div>
      )}

      {/* Rodapé com call-to-action */}
      {post.permalink && (
        <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 border-t border-amber-200 hover:bg-amber-100 transition-colors">
          <ExternalLink size={12} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-800">Abrir no Instagram</span>
        </div>
      )}
    </a>
  );
}
