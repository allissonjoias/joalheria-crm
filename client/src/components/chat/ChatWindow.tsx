import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface Mensagem {
  id: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  criado_em: string;
}

interface ChatWindowProps {
  mensagens: Mensagem[];
  enviando: boolean;
  onEnviar: (mensagem: string) => void;
  ativo: boolean;
}

export function ChatWindow({ mensagens, enviando, onEnviar, ativo }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensagens.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">Inicie a conversa</p>
            <p className="text-sm">Digite a mensagem do cliente para a IA responder</p>
          </div>
        )}
        {mensagens.map((msg) => (
          <ChatMessage key={msg.id} papel={msg.papel} conteudo={msg.conteudo} criado_em={msg.criado_em} />
        ))}
        {enviando && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-alisson-600 flex items-center justify-center">
              <Loader2 size={16} className="text-white animate-spin" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none">
              <p className="text-sm text-gray-400">IA esta digitando...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onEnviar={onEnviar} desabilitado={!ativo || enviando} />
    </div>
  );
}
