import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads/instagram');

// Garante a pasta
function ensureDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Baixa uma URL e salva em uploads/instagram/{filename}.
 * Retorna a URL local (/uploads/instagram/...) ou null se falhar.
 */
async function baixar(url: string, filenameSemExt: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!res.ok) {
      console.warn(`[IG Cache] Falha ${res.status} baixando ${url.substring(0, 80)}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('mp4')) ext = '.mp4';
    else if (contentType.includes('quicktime')) ext = '.mov';

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) {
      console.warn(`[IG Cache] Arquivo muito pequeno (${buf.length}b) — provavelmente erro`);
      return null;
    }

    ensureDir();
    const filename = `${filenameSemExt}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buf);
    return `/uploads/instagram/${filename}`;
  } catch (e: any) {
    console.warn('[IG Cache] erro baixar:', e.message);
    return null;
  }
}

/**
 * Cacheia thumbnail e media de um post Instagram localmente.
 * Importante para stories que expiram em 24h.
 *
 * @param igMediaId id único do media (usado como nome do arquivo)
 * @param urls { thumbnail_url, media_url } — URLs originais do CDN
 * @returns { thumbnail_url_local, media_url_local } URLs locais (ou null se falhou)
 */
export async function cachearMidiaPost(
  igMediaId: string,
  urls: { thumbnail_url?: string | null; media_url?: string | null }
): Promise<{ thumbnail_url_local: string | null; media_url_local: string | null }> {
  if (!igMediaId) return { thumbnail_url_local: null, media_url_local: null };

  // Sanitiza id pra ser nome de arquivo
  const safeId = String(igMediaId).replace(/[^a-zA-Z0-9_-]/g, '_');

  let thumbLocal: string | null = null;
  let mediaLocal: string | null = null;

  // Baixa thumbnail (sempre é imagem)
  if (urls.thumbnail_url) {
    thumbLocal = await baixar(urls.thumbnail_url, `${safeId}_thumb`);
  }

  // Baixa media (pode ser imagem ou video)
  if (urls.media_url) {
    mediaLocal = await baixar(urls.media_url, `${safeId}_media`);
    // Se não tem thumb e media é imagem, usa media como thumb
    if (!thumbLocal && mediaLocal && /\.(jpg|jpeg|png|webp)$/i.test(mediaLocal)) {
      thumbLocal = mediaLocal;
    }
  }

  return { thumbnail_url_local: thumbLocal, media_url_local: mediaLocal };
}

/**
 * Verifica se já tem cópia local válida do media.
 */
export function temCacheLocal(igMediaId: string): { thumb: string | null; media: string | null } {
  if (!igMediaId) return { thumb: null, media: null };
  const safeId = String(igMediaId).replace(/[^a-zA-Z0-9_-]/g, '_');
  ensureDir();
  const arquivos = fs.readdirSync(UPLOADS_DIR);

  let thumb: string | null = null;
  let media: string | null = null;
  for (const f of arquivos) {
    if (f.startsWith(`${safeId}_thumb.`)) thumb = `/uploads/instagram/${f}`;
    if (f.startsWith(`${safeId}_media.`)) media = `/uploads/instagram/${f}`;
  }
  return { thumb, media };
}
