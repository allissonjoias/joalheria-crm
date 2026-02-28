import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  largura?: string;
}

export function Modal({ aberto, onFechar, titulo, children, largura = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onFechar} />
      <div className={`relative bg-white rounded-xl shadow-2xl ${largura} w-full mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-charcoal-100">
          <h2 className="text-lg font-semibold text-charcoal-900">{titulo}</h2>
          <button onClick={onFechar} className="p-1 hover:bg-charcoal-100 rounded-lg transition-colors">
            <X size={20} className="text-charcoal-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
