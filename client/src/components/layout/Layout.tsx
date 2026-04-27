import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  Inbox, Kanban, Settings,
  LogOut, User, Menu, X,
  ChevronRight,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

const navPrincipal = [
  { to: '/mensagens', icon: Inbox, label: 'Mensagens' },
  { to: '/pipeline', icon: Kanban, label: 'Funil de Vendas' },
];

// Label da pagina atual para o header mobile
function getPageLabel(pathname: string): string {
  const item = navPrincipal.find(n => n.to === pathname);
  if (item) return item.label;
  if (pathname === '/configuracoes') return 'Configuracoes';
  return 'IAlisson';
}

export function Layout() {
  const { usuario, carregando, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Fechar drawer ao navegar
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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

  const pageLabel = getPageLabel(location.pathname);
  const isConfig = location.pathname === '/configuracoes';

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#111b21]">
      <div className="flex h-full w-full overflow-hidden">
          {/* Barra lateral - estilo WhatsApp */}
          <nav className="hidden md:flex w-[68px] bg-[#1a2e28] flex-col items-center flex-shrink-0">
            {/* Icones de navegacao */}
            <div className="flex-1 flex flex-col items-center w-full pt-3">
              {navPrincipal.map((item) => (
                <Tooltip key={item.to} texto={item.label} posicao="right">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `relative w-full flex justify-center py-3.5 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-[#8696a0] hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={24} />
                  </NavLink>
                </Tooltip>
              ))}
            </div>

            {/* Rodape */}
            <div className="flex flex-col items-center w-full pb-3">
              <Tooltip texto="Configuracoes" posicao="right">
                <NavLink
                  to="/configuracoes"
                  className={({ isActive }) =>
                    `w-full flex justify-center py-3.5 transition-colors ${
                      isActive ? 'text-white' : 'text-[#8696a0] hover:text-white'
                    }`
                  }
                >
                  <Settings size={24} />
                </NavLink>
              </Tooltip>
              <Tooltip texto={usuario.nome} posicao="right">
                <button
                  onClick={logout}
                  className="w-full flex justify-center py-3.5"
                >
                  <div className="w-8 h-8 bg-alisson-400 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                </button>
              </Tooltip>
            </div>
          </nav>

          {/* Area de conteudo */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#f0f2f5]">
            {/* Header mobile para config */}
            {isConfig && (
              <div className="md:hidden bg-alisson-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="p-1 -ml-1 text-white"
                >
                  <Menu size={22} />
                </button>
                <h1 className="text-white font-semibold text-lg flex-1">{pageLabel}</h1>
                <img src="/leao-branco.svg" alt="" className="w-6 h-6 opacity-70" />
              </div>
            )}

            {/* Header mobile para fullBleed (mensagens/pipeline) - so o hamburger */}
            {!isConfig && (
              <div className="md:hidden absolute top-3 left-3 z-30">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-10 h-10 bg-alisson-600 rounded-full flex items-center justify-center shadow-lg text-white"
                >
                  <Menu size={20} />
                </button>
              </div>
            )}

            {isConfig ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <Outlet />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <Outlet />
              </div>
            )}
          </main>
      </div>

      {/* ===== MOBILE DRAWER (estilo WhatsApp) ===== */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setDrawerOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 transition-opacity" />

          {/* Drawer panel - desliza da esquerda */}
          <div
            className="absolute top-0 left-0 bottom-0 w-[280px] bg-white flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do drawer - verde com info do usuario */}
            <div className="bg-alisson-600 px-4 pt-10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-alisson-400 rounded-full flex items-center justify-center">
                  <User size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-base truncate">{usuario.nome}</p>
                  <p className="text-alisson-200 text-xs">{usuario.papel}</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="text-white/70 p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Links de navegacao */}
            <div className="flex-1 overflow-y-auto py-2">
              {navPrincipal.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-5 py-3.5 transition-colors ${
                      isActive
                        ? 'text-alisson-600 bg-alisson-50 font-semibold border-r-3 border-alisson-600'
                        : 'text-gray-700 active:bg-gray-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={20} className={isActive ? 'text-alisson-600' : 'text-gray-400'} />
                      <span className="text-sm flex-1">{item.label}</span>
                      {isActive && <ChevronRight size={16} className="text-alisson-400" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Rodape: config + sair */}
            <div className="border-t border-gray-200 py-2">
              <NavLink
                to="/configuracoes"
                className={({ isActive }) =>
                  `flex items-center gap-4 px-5 py-3.5 transition-colors ${
                    isActive
                      ? 'text-alisson-600 bg-alisson-50 font-semibold'
                      : 'text-gray-700 active:bg-gray-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Settings size={20} className={isActive ? 'text-alisson-600' : 'text-gray-400'} />
                    <span className="text-sm">Configuracoes</span>
                  </>
                )}
              </NavLink>
              <button
                onClick={logout}
                className="flex items-center gap-4 px-5 py-3.5 w-full text-red-500 active:bg-red-50 transition-colors"
              >
                <LogOut size={20} />
                <span className="text-sm">Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
