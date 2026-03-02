import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'perigo' | 'ghost';
  tamanho?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const estilos = {
  primario: 'bg-alisson-600 hover:bg-alisson-500 text-white',
  secundario: 'bg-creme-200 hover:bg-creme-300 text-alisson-600',
  perigo: 'bg-red-500 hover:bg-red-600 text-white',
  ghost: 'hover:bg-creme-200 text-alisson-600',
};

const tamanhos = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({ variante = 'primario', tamanho = 'md', children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`${estilos[variante]} ${tamanhos[tamanho]} rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
