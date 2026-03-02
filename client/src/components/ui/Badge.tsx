import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  cor?: 'gold' | 'green' | 'red' | 'blue' | 'gray' | 'purple' | 'orange';
  className?: string;
}

const cores = {
  gold: 'bg-alisson-50 text-alisson-700',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export function Badge({ children, cor = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cores[cor]} ${className}`}>
      {children}
    </span>
  );
}
