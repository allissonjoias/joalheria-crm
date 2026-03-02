interface CanalBadgeProps {
  canal: string;
  className?: string;
  tamanho?: 'sm' | 'md';
}

const canalConfig: Record<string, { label: string; cor: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', cor: 'bg-green-100 text-green-800', icon: '' },
  instagram_dm: { label: 'Instagram', cor: 'bg-purple-100 text-purple-800', icon: '' },
  instagram_comment: { label: 'Comentario', cor: 'bg-pink-100 text-pink-800', icon: '' },
  interno: { label: 'Interno', cor: 'bg-alisson-100 text-alisson-600', icon: '' },
};

export function CanalBadge({ canal, className = '', tamanho = 'sm' }: CanalBadgeProps) {
  const config = canalConfig[canal] || canalConfig.interno;
  const size = tamanho === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${size} ${config.cor} ${className}`}>
      {config.label}
    </span>
  );
}
