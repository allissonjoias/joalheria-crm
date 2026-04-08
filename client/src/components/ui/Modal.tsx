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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onFechar} />
      <div className={`relative bg-white md:rounded-xl rounded-t-2xl shadow-2xl ${largura} w-full md:mx-4 max-h-[92vh] md:max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b border-gray-100 rounded-t-2xl md:rounded-t-xl">
          {/* Drag handle for mobile */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full md:hidden" />
          <h2 className="text-lg font-semibold text-alisson-600 mt-1 md:mt-0">{titulo}</h2>
          <button onClick={onFechar} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
