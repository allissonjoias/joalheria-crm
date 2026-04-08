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
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
};

export type TipoMidia = 'imagem' | 'audio' | 'video' | 'sticker' | 'documento';

export function detectarTipoMidia(msg: any): { tipo: TipoMidia; mimetype: string; nomeArquivo?: string } | null {
  if (msg.stickerMessage) {
    return { tipo: 'sticker', mimetype: msg.stickerMessage.mimetype || 'image/webp' };
  }
  if (msg.documentMessage) {
    return {
      tipo: 'documento',
      mimetype: msg.documentMessage.mimetype || 'application/octet-stream',
      nomeArquivo: msg.documentMessage.fileName || 'documento',
    };
  }
  if (msg.documentWithCaptionMessage?.message?.documentMessage) {
    const doc = msg.documentWithCaptionMessage.message.documentMessage;
    return {
      tipo: 'documento',
      mimetype: doc.mimetype || 'application/octet-stream',
      nomeArquivo: doc.fileName || 'documento',
    };
  }
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

/**
 * Extrai um frame de um vídeo e retorna como buffer JPEG.
 * Usa ffmpeg-static para não depender de instalação global.
 */
export async function extrairFrameVideo(videoPath: string): Promise<Buffer | null> {
  try {
    const ffmpegPath = require('ffmpeg-static') as string;
    const { execFileSync } = require('child_process');
    const tmpFrame = path.join(UPLOADS_DIR, `frame-${Date.now()}.jpg`);

    execFileSync(ffmpegPath, [
      '-i', videoPath,
      '-ss', '00:00:01',    // 1 segundo do início
      '-frames:v', '1',
      '-q:v', '3',          // qualidade boa
      '-y',
      tmpFrame,
    ], { timeout: 15000, stdio: 'pipe' });

    if (fs.existsSync(tmpFrame)) {
      const buffer = fs.readFileSync(tmpFrame);
      fs.unlinkSync(tmpFrame); // limpar temp
      return buffer;
    }
    return null;
  } catch (e) {
    console.warn('[Media] Erro ao extrair frame do video:', e);
    return null;
  }
}

export function mimetypeParaTipo(mimetype: string): TipoMidia {
  if (mimetype.startsWith('image/')) return 'imagem';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('application/') || mimetype.startsWith('text/')) return 'documento';
  return 'documento';
}
