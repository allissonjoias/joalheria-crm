import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  erro?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, erro, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-charcoal-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent transition-colors ${erro ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
        {erro && <p className="mt-1 text-sm text-red-500">{erro}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
