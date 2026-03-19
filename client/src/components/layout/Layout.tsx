import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Inbox, Users, Package,
  Kanban, DollarSign, Bell, Settings, Smartphone,
  Bot, Zap, Workflow, LogOut, User,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import api from '../../services/api';

const navPrincipal = [
  { to: '/mensagens', icon: Inbox, label: 'Mensagens' },
  { to: '/', icon: LayoutDashboard, label: 'Painel' },
  { to: '/pipeline', icon: Kanban, label: 'Funil de Vendas' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/vendas', icon: DollarSign, label: 'Vendas' },
  { to: '/lembretes', icon: Bell, label: 'Lembretes' },
  { to: '/agentes-ia', icon: Bot, label: 'Agentes IA' },
  { to: '/whatsapp', icon: Smartphone, label: 'WhatsApp' },
  { to: '/automacoes', icon: Workflow, label: 'Automacoes' },
  { to: '/simulador', icon: Zap, label: 'Simulador' },
];

export function Layout() {
  const { usuario, carregando, logout } = useAuth();
  const [lembretes, setLembretes] = useState(0);
  const location = useLocation();

  const fullBleed = location.pathname === '/mensagens' || location.pathname === '/pipeline';

  useEffect(() => {
    api.get('/lembretes/pendentes')
      .then(({ data }) => setLembretes(data.total))
      .catch(() => {});
  }, []);

  if (carregando) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#d1d7db]">
        <div className="flex flex-col items-center gap-4">
          <img src="/leao.svg" alt="Alisson" className="w-16 h-16 animate-pulse" />
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-alisson-600" />
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#d1d7db]">
      {/* Faixa verde no topo - estilo WhatsApp */}
      <div className="fixed top-0 left-0 right-0 h-[127px] bg-alisson-600 z-0" />

      {/* Container principal */}
      <div
        className="relative z-10 mx-auto flex shadow-2xl overflow-hidden"
        style={{ marginTop: '19px', height: 'calc(100vh - 38px)', maxWidth: 'calc(100% - 38px)' }}
      >
        {/* Barra de icones lateral - estilo WhatsApp */}
        <nav className="w-[68px] bg-[#1a2e28] flex flex-col items-center flex-shrink-0">
          {/* Avatar do usuario */}
          <div className="w-full flex justify-center py-4 bg-alisson-600 border-b border-alisson-500">
            <Tooltip texto={`${usuario.nome} (${usuario.papel})`} posicao="right">
              <div className="w-10 h-10 bg-alisson-400 rounded-full flex items-center justify-center cursor-default">
                <User size={18} className="text-white" />
              </div>
            </Tooltip>
          </div>

          {/* Itens de navegacao */}
          <div className="flex-1 flex flex-col items-center w-full py-2 overflow-y-auto scrollbar-thin">
            {navPrincipal.map((item) => (
              <Tooltip key={item.to} texto={item.label} posicao="right">
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `relative w-full flex justify-center py-3 transition-colors ${
                      isActive
                        ? 'text-white bg-white/10'
                        : 'text-[#8696a0] hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-creme-300 rounded-r-full" />
                      )}
                      <item.icon size={22} />
                      {item.to === '/lembretes' && lembretes > 0 && (
                        <span className="absolute top-1.5 right-2.5 bg-[#25d366] text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5">
                          {lembretes > 9 ? '9+' : lembretes}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </Tooltip>
            ))}
          </div>

          {/* Rodape: config + sair */}
          <div className="flex flex-col items-center w-full border-t border-white/10">
            <Tooltip texto="Configuracoes" posicao="right">
              <NavLink
                to="/configuracoes"
                className={({ isActive }) =>
                  `relative w-full flex justify-center py-3 transition-colors ${
                    isActive
                      ? 'text-white bg-white/10'
                      : 'text-[#8696a0] hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-creme-300 rounded-r-full" />
                    )}
                    <Settings size={22} />
                  </>
                )}
              </NavLink>
            </Tooltip>
            <Tooltip texto="Sair" posicao="right">
              <button
                onClick={logout}
                className="w-full flex justify-center py-3 text-[#8696a0] hover:text-red-400 hover:bg-white/5 transition-colors"
              >
                <LogOut size={22} />
              </button>
            </Tooltip>
          </div>
        </nav>

        {/* Area de conteudo */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#f0f2f5]">
          {fullBleed ? (
            <Outlet />
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
