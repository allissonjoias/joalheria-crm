import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { Send, Bot, Smile, Paperclip, Mic, Square, Trash2, X, FileText } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

const EMOJI_CATEGORIAS = [
  {
    nome: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫣','😐','😑','😶','🫡','🤐','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬'],
  },
  {
    nome: 'Gestos',
    emojis: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','🫵','👋','🤚','🖐️','✋','🖖','🫱','🫲','👏','🤝','🙏'],
  },
  {
    nome: 'Coracoes',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝'],
  },
  {
    nome: 'Objetos',
    emojis: ['💎','💍','🔥','⭐','✨','🎉','🎊','💰','📱','💻','🕐','👀','🎁','📷','🎵','🏠'],
  },
];

interface MensageriaInputProps {
  onEnviar: (mensagem: string) => void;
  onEnviarComDara: () => void;
  onEnviarMidia: (arquivo: File, caption?: string) => void;
  desabilitado: boolean;
  canalAtual: string;
}

export function MensageriaInput({ onEnviar, onEnviarComDara, onEnviarMidia, desabilitado, canalAtual }: MensageriaInputProps) {
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelarGravacaoRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Estado do preview de midia
  const [previewArquivo, setPreviewArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTipo, setPreviewTipo] = useState<'image' | 'video' | null>(null);
  const [caption, setCaption] = useState('');

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    if (!emojiAberto) return;
    const handleClickFora = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [emojiAberto]);

  const inserirEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setTexto(prev => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? texto.length;
    const end = input.selectionEnd ?? texto.length;
    const novoTexto = texto.slice(0, start) + emoji + texto.slice(end);
    setTexto(novoTexto);
    // Reposicionar cursor apos o emoji
    requestAnimationFrame(() => {
      input.focus();
      const novaPosicao = start + emoji.length;
      input.setSelectionRange(novaPosicao, novaPosicao);
    });
  };

  // Limpar object URL ao fechar o preview
  const fecharPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewArquivo(null);
    setPreviewUrl(null);
    setPreviewTipo(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmarEnvioMidia = () => {
    if (previewArquivo) {
      onEnviarMidia(previewArquivo, caption.trim() || undefined);
    }
    fecharPreview();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (texto.trim() && !desabilitado) {
      onEnviar(texto.trim());
      setTexto('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAnexar = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewArquivo(file);
      setPreviewUrl(url);
      setPreviewTipo('image');
      setCaption('');
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setPreviewArquivo(file);
      setPreviewUrl(url);
      setPreviewTipo('video');
      setCaption('');
    } else {
      // Documentos e outros: enviar imediatamente sem preview
      onEnviarMidia(file);
      e.target.value = '';
    }
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelarGravacaoRef.current = false;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Parar todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        if (!cancelarGravacaoRef.current) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          if (blob.size > 0) {
            const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
            onEnviarMidia(file);
          }
        }

        chunksRef.current = [];
        cancelarGravacaoRef.current = false;
        setGravando(false);
        setTempoGravacao(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setGravando(true);
      setTempoGravacao(0);

      timerRef.current = setInterval(() => {
        setTempoGravacao(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.error('Erro ao acessar microfone:', e);
    }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelarGravacao = () => {
    cancelarGravacaoRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatarTempo = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const placeholder = 'Digite uma resposta...';

  // Modo gravacao
  if (gravando) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-wa-bg-panel border-t border-wa-border">
        <Tooltip texto="Cancelar gravacao e descartar o audio" posicao="top">
          <button
            type="button"
            onClick={cancelarGravacao}
            className="p-2.5 text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
          >
            <Trash2 size={20} />
          </button>
        </Tooltip>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-600 font-medium">Gravando</span>
          <span className="text-sm text-gray-500 font-mono">{formatarTempo(tempoGravacao)}</span>
        </div>
        <Tooltip texto="Parar gravacao e enviar o audio" posicao="top">
          <button
            type="button"
            onClick={pararGravacao}
            className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex-shrink-0"
          >
            <Square size={20} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 bg-wa-bg-panel border-t border-wa-border">
      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Botao IA */}
      <Tooltip texto="A IA gera uma resposta automatica para o cliente com base no historico da conversa" posicao="top">
        <button
          type="button"
          onClick={onEnviarComDara}
          disabled={desabilitado}
          className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <Bot size={20} />
        </button>
      </Tooltip>

      {/* Botao anexar */}
      <Tooltip texto="Anexar foto ou video para enviar ao cliente" posicao="top">
        <button
          type="button"
          onClick={handleAnexar}
          disabled={desabilitado}
          className="text-gray-500 hover:text-gray-600 flex-shrink-0 disabled:opacity-50"
        >
          <Paperclip size={24} />
        </button>
      </Tooltip>

      {/* Botao emoji + picker */}
      <div className="relative flex-shrink-0" ref={emojiPickerRef}>
        <Tooltip texto="Inserir emoji" posicao="top">
          <button
            type="button"
            onClick={() => setEmojiAberto(prev => !prev)}
            disabled={desabilitado}
            className={`text-gray-500 hover:text-gray-600 disabled:opacity-50 transition-colors ${emojiAberto ? 'text-alisson-600' : ''}`}
          >
            <Smile size={24} />
          </button>
        </Tooltip>

        {emojiAberto && (
          <div className="absolute bottom-10 left-0 z-50 w-72 bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col">
            {/* Abas de categorias */}
            <div className="flex border-b border-gray-100">
              {EMOJI_CATEGORIAS.map((cat, i) => (
                <button
                  key={cat.nome}
                  type="button"
                  onClick={() => setCategoriaSelecionada(i)}
                  className={`flex-1 text-xs py-2 font-medium transition-colors ${
                    categoriaSelecionada === i
                      ? 'text-alisson-600 border-b-2 border-alisson-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>
            {/* Grade de emojis */}
            <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
              {EMOJI_CATEGORIAS[categoriaSelecionada].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => inserirEmoji(emoji)}
                  className="text-xl p-1 rounded hover:bg-gray-100 transition-colors leading-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input estilo WhatsApp */}
      <input
        ref={inputRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-white rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none border border-wa-border"
        disabled={desabilitado}
      />

      {/* Botao enviar ou microfone */}
      {texto.trim() ? (
        <Tooltip texto="Enviar mensagem para o cliente" posicao="top">
          <button
            type="submit"
            disabled={desabilitado || !texto.trim()}
            className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Send size={20} />
          </button>
        </Tooltip>
      ) : (
        <Tooltip texto="Gravar audio para enviar ao cliente" posicao="top">
          <button
            type="button"
            onClick={iniciarGravacao}
            disabled={desabilitado}
            className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Mic size={20} />
          </button>
        </Tooltip>
      )}
    </form>

      {/* Modal de preview de midia */}
      {previewArquivo && previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          {/* Botao fechar */}
          <button
            type="button"
            onClick={fecharPreview}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X size={28} />
          </button>

          {/* Preview */}
          <div className="flex-1 flex items-center justify-center p-8 max-w-3xl w-full">
            {previewTipo === 'image' ? (
              <img src={previewUrl} alt="Preview" className="max-h-[60vh] max-w-full rounded-lg object-contain" />
            ) : previewTipo === 'video' ? (
              <video src={previewUrl} controls className="max-h-[60vh] max-w-full rounded-lg" />
            ) : null}
          </div>

          {/* Nome do arquivo */}
          <p className="text-white/60 text-xs mb-2">{previewArquivo.name}</p>

          {/* Caption + Enviar */}
          <div className="w-full max-w-xl px-4 pb-6 flex items-center gap-3">
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarEnvioMidia(); } }}
              placeholder="Adicionar legenda..."
              className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-full text-sm placeholder-white/50 focus:outline-none focus:bg-white/20 border border-white/20"
              autoFocus
            />
            <button
              type="button"
              onClick={confirmarEnvioMidia}
              className="p-3 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors flex-shrink-0"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
