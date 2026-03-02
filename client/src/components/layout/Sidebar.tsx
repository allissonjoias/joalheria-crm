import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, MessageSquare, Users, Package,
  Kanban, DollarSign, Bell, Settings, Download, Smartphone, Bot
} from 'lucide-react';

const menuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/mensagens', icon: Inbox, label: 'WhatsAlisson' },
  { to: '/chat', icon: MessageSquare, label: 'Dara IA' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/vendas', icon: DollarSign, label: 'Vendas' },
  { to: '/lembretes', icon: Bell, label: 'Lembretes' },
  { to: '/whatsapp', icon: Smartphone, label: 'WhatsApp' },
  { to: '/sdr-agent', icon: Bot, label: 'Agente SDR' },
  { to: '/importar', icon: Download, label: 'Importar Kommo' },
  { to: '/configuracoes', icon: Settings, label: 'Configuracoes' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-alisson-600 text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-5 border-b border-alisson-500">
        <div className="flex items-center gap-3">
          <img src="/leao-branco.svg" alt="Alisson" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold text-creme-200">Alisson</h1>
            <p className="text-xs text-alisson-200">Joalheria Premium</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-alisson-500 text-creme-200 border-r-3 border-creme-300'
                  : 'text-alisson-100 hover:text-white hover:bg-alisson-500/50'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-alisson-500">
        <p className="text-xs text-alisson-300 text-center">WhatsAlisson v2.0</p>
      </div>
    </aside>
  );
}
