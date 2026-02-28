import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Users, Package,
  Kanban, DollarSign, Bell, Settings, Gem
} from 'lucide-react';

const menuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/chat', icon: MessageSquare, label: 'Chat IA' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/vendas', icon: DollarSign, label: 'Vendas' },
  { to: '/lembretes', icon: Bell, label: 'Lembretes' },
  { to: '/configuracoes', icon: Settings, label: 'Configuracoes' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-charcoal-900 text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-charcoal-700">
        <div className="flex items-center gap-3">
          <Gem className="text-gold-400" size={28} />
          <div>
            <h1 className="text-lg font-bold text-gold-400">Alisson</h1>
            <p className="text-xs text-charcoal-400">Joalheria Premium</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-gold-400/10 text-gold-400 border-r-2 border-gold-400'
                  : 'text-charcoal-300 hover:text-white hover:bg-charcoal-800'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-charcoal-700">
        <p className="text-xs text-charcoal-500 text-center">Dara CRM v1.0</p>
      </div>
    </aside>
  );
}
