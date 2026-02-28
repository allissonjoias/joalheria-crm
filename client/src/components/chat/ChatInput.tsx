import { useState, FormEvent, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onEnviar: (mensagem: string) => void;
  desabilitado: boolean;
}

export function ChatInput({ onEnviar, desabilitado }: ChatInputProps) {
  const [texto, setTexto] = useState('');

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

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-charcoal-100 bg-white">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite a mensagem do cliente..."
        className="flex-1 px-4 py-3 border border-charcoal-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm"
        disabled={desabilitado}
      />
      <button
        type="submit"
        disabled={desabilitado || !texto.trim()}
        className="px-4 py-3 bg-gold-400 hover:bg-gold-500 text-white rounded-xl transition-colors disabled:opacity-50"
      >
        <Send size={20} />
      </button>
    </form>
  );
}
