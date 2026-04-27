import { ExternalLink, Image as ImageIcon, Film, Camera } from 'lucide-react';
import type { InstagramPostInfo } from '../../hooks/useMensageria';

interface Props {
  post: InstagramPostInfo;
}

const TIPO_LABEL: Record<string, string> = {
  FEED: 'Post no feed',
  REELS: 'Reels',
  STORY: 'Story',
  AD: 'Anúncio',
};

const TIPO_ICON: Record<string, any> = {
  FEED: Camera,
  REELS: Film,
  STORY: ImageIcon,
};

export function PublicacaoBanner({ post }: Props) {
  const tipo = (post.media_product_type || '').toUpperCase();
  const label = TIPO_LABEL[tipo] || (post.tipo === 'reel' ? 'Reels' : post.tipo === 'story' ? 'Story' : 'Publicação');
  const Icon = TIPO_ICON[tipo] || Camera;

  const thumb = post.thumbnail_url || post.media_url;
  const caption = (post.caption || '').trim();

  return (
    <a
      href={post.permalink || '#'}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-3 py-2 bg-amber-50 border-b border-amber-200 hover:bg-amber-100 transition-colors"
      title="Abrir publicação no Instagram"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="w-12 h-12 rounded object-cover flex-shrink-0 border border-amber-200"
        />
      ) : (
        <div className="w-12 h-12 rounded bg-amber-200 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-amber-700" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 uppercase tracking-wide">
          <Icon size={11} /> Comentário em: {label}
        </div>
        <div className="text-sm text-gray-700 truncate">
          {caption || 'Sem legenda'}
        </div>
      </div>
      {post.permalink && <ExternalLink size={14} className="text-amber-700 flex-shrink-0" />}
    </a>
  );
}
