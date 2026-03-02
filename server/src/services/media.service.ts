import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { env } from '../config/env';

const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/webm': '.webm',
  'audio/opus': '.opus',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'video/webm': '.webm',
};

export type TipoMidia = 'imagem' | 'audio' | 'video';

export function detectarTipoMidia(msg: any): { tipo: TipoMidia; mimetype: string } | null {
  if (msg.imageMessage) {
    return { tipo: 'imagem', mimetype: msg.imageMessage.mimetype || 'image/jpeg' };
  }
  if (msg.audioMessage) {
    return { tipo: 'audio', mimetype: msg.audioMessage.mimetype || 'audio/ogg' };
  }
  if (msg.videoMessage) {
    return { tipo: 'video', mimetype: msg.videoMessage.mimetype || 'video/mp4' };
  }
  return null;
}

export async function baixarMidiaBaileys(rawMsg: any): Promise<{ filePath: string; fileName: string } | null> {
  try {
    const buffer = await downloadMediaMessage(rawMsg, 'buffer', {});
    if (!buffer || buffer.length === 0) return null;

    const mediaInfo = detectarTipoMidia(rawMsg.message);
    const mimetype = mediaInfo?.mimetype || 'application/octet-stream';
    const ext = MIME_TO_EXT[mimetype] || '.bin';
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    fs.writeFileSync(filePath, buffer);
    return { filePath, fileName };
  } catch (e) {
    console.error('[Media] Erro ao baixar mídia do Baileys:', e);
    return null;
  }
}

export function salvarBuffer(buffer: Buffer, mimetype: string): { filePath: string; fileName: string } {
  const ext = MIME_TO_EXT[mimetype] || '.bin';
  const fileName = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  return { filePath, fileName };
}

export async function transcreverAudio(filePath: string): Promise<string | null> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'pt',
    });

    return transcription.text || null;
  } catch (e) {
    console.error('[Media] Erro na transcrição Whisper:', e);
    return null;
  }
}

export function mimetypeParaTipo(mimetype: string): TipoMidia {
  if (mimetype.startsWith('image/')) return 'imagem';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'imagem';
}
