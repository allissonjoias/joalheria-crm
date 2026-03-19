import { ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: ReactNode;
  texto: string;
  posicao?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ children, texto, posicao = 'top', className = '' }: TooltipProps) {
  const [visivel, setVisivel] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (visivel && triggerRef.current && tooltipRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (posicao) {
        case 'top':
          top = trigger.top - tooltip.height - 8;
          left = trigger.left + trigger.width / 2 - tooltip.width / 2;
          break;
        case 'bottom':
          top = trigger.bottom + 8;
          left = trigger.left + trigger.width / 2 - tooltip.width / 2;
          break;
        case 'left':
          top = trigger.top + trigger.height / 2 - tooltip.height / 2;
          left = trigger.left - tooltip.width - 8;
          break;
        case 'right':
          top = trigger.top + trigger.height / 2 - tooltip.height / 2;
          left = trigger.right + 8;
          break;
      }

      // Manter dentro da tela
      if (left < 8) left = 8;
      if (left + tooltip.width > window.innerWidth - 8) left = window.innerWidth - tooltip.width - 8;
      if (top < 8) {
        top = trigger.bottom + 8;
      }

      setCoords({ top, left });
    }
  }, [visivel, posicao]);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setVisivel(true), 400);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisivel(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex ${className}`}
      >
        {children}
      </div>
      {visivel && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg max-w-xs pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {texto}
          <div
            className={`absolute w-2 h-2 bg-gray-800 rotate-45 ${
              posicao === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
              posicao === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
              posicao === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
              'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </>
  );
}
