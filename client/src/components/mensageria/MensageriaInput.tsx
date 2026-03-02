import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { Send, Bot, Smile, Paperclip, Mic, Square } from 'lucide-react';

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
    if (file) {
      onEnviarMidia(file);
      e.target.value = '';
    }
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) {
          const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
          onEnviarMidia(file);
        }

        chunksRef.current = [];
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

  const formatarTempo = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const placeholder = canalAtual === 'interno'
    ? 'Digite a mensagem do cliente...'
    : 'Digite uma resposta...';

  // Modo gravação
  if (gravando) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-wa-bg-panel border-t border-wa-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-600 font-medium">Gravando</span>
          <span className="text-sm text-gray-500 font-mono">{formatarTempo(tempoGravacao)}</span>
        </div>
        <button
          type="button"
          onClick={pararGravacao}
          className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex-shrink-0"
          title="Parar gravação"
        >
          <Square size={20} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 bg-wa-bg-panel border-t border-wa-border">
      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Botão Dara */}
      <button
        type="button"
        onClick={onEnviarComDara}
        disabled={desabilitado}
        className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
        title="Dara responde automaticamente"
      >
        <Bot size={20} />
      </button>

      {/* Botão anexar */}
      <button
        type="button"
        onClick={handleAnexar}
        disabled={desabilitado}
        className="text-gray-500 hover:text-gray-600 flex-shrink-0 disabled:opacity-50"
        title="Anexar foto ou vídeo"
      >
        <Paperclip size={24} />
      </button>

      {/* Input estilo WhatsApp */}
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-white rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none border border-wa-border"
        disabled={desabilitado}
      />

      {/* Botão enviar ou microfone */}
      {texto.trim() ? (
        <button
          type="submit"
          disabled={desabilitado || !texto.trim()}
          className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
          title="Enviar"
        >
          <Send size={20} />
        </button>
      ) : (
        <button
          type="button"
          onClick={iniciarGravacao}
          disabled={desabilitado}
          className="p-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
          title="Gravar áudio"
        >
          <Mic size={20} />
        </button>
      )}
    </form>
  );
}
