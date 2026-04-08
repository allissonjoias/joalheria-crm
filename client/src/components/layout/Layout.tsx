import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Inbox, Users, Package,
  Kanban, DollarSign, Bell, Settings, Smartphone,
  Bot, Zap, Workflow, LogOut, User, Menu, X,
  ChevronRight,
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

// Label da pagina atual para o header mobile
function getPageLabel(pathname: string): string {
  const item = navPrincipal.find(n => n.to === pathname);
  if (item) return item.label;
  if (pathname === '/configuracoes') return 'Configuracoes';
  return 'IAlisson';
}

export function Layout() {
  const { usuario, carregando, logout } = useAuth();
  const [lembretes, setLembretes] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const fullBleed = location.pathname === '/mensagens' || location.pathname === '/pipeline';

  useEffect(() => {
    api.get('/lembretes/pendentes')
      .then(({ data }) => setLembretes(data.total))
      .catch(() => {});
  }, []);

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#d1d7db]">
      {/* Faixa verde no topo - escondida no mobile */}
      <div className="hidden md:block fixed top-0 left-0 right-0 h-[127px] bg-alisson-600 z-0" />

      {/* Container principal */}
      <div
        className="relative z-10 flex overflow-hidden
          h-screen w-screen
          md:mx-auto md:shadow-2xl"
      >
        {/* Desktop: estilo com margens */}
        <style>{`
          @media (min-width: 768px) {
            .layout-container {
              margin-top: 19px !important;
              height: calc(100vh - 38px) !important;
              max-width: calc(100% - 38px) !important;
              margin-left: auto !important;
              margin-right: auto !important;
            }
          }
        `}</style>
        <div
          className="layout-container relative z-10 flex overflow-hidden w-full h-full md:shadow-2xl"
        >
          {/* Barra de icones lateral - DESKTOP ONLY */}
          <nav className="hidden md:flex w-[68px] bg-[#1a2e28] flex-col items-center flex-shrink-0">
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
            {/* Header mobile - estilo WhatsApp */}
            {!fullBleed && (
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
            {fullBleed && (
              <div className="md:hidden absolute top-3 left-3 z-30">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-10 h-10 bg-alisson-600 rounded-full flex items-center justify-center shadow-lg text-white"
                >
                  <Menu size={20} />
                </button>
              </div>
            )}

            {fullBleed ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <Outlet />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <Outlet />
              </div>
            )}
          </main>
        </div>
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
                  end={item.to === '/'}
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
                      {item.to === '/lembretes' && lembretes > 0 && (
                        <span className="bg-[#25d366] text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                          {lembretes > 9 ? '9+' : lembretes}
                        </span>
                      )}
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

      {/* Safe area bottom padding for iOS */}
      <style>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </div>
  );
}
