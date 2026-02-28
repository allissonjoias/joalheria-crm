import { Gem, User } from 'lucide-react';

interface ChatMessageProps {
  papel: 'user' | 'assistant';
  conteudo: string;
  criado_em: string;
}

export function ChatMessage({ papel, conteudo, criado_em }: ChatMessageProps) {
  const isAssistant = papel === 'assistant';

  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isAssistant ? 'bg-gold-400' : 'bg-charcoal-600'}`}>
        {isAssistant ? <Gem size={16} className="text-white" /> : <User size={16} className="text-white" />}
      </div>
      <div className={`max-w-[70%] ${isAssistant ? '' : 'text-right'}`}>
        <div className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${isAssistant ? 'bg-white border border-charcoal-100 text-charcoal-800 rounded-tl-none' : 'bg-gold-400 text-white rounded-tr-none'}`}>
          {conteudo.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
          ))}
        </div>
        <p className="text-xs text-charcoal-400 mt-1">
          {isAssistant ? 'Dara' : 'Voce'} - {new Date(criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
