import { useEffect, useState } from 'react';
import { Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export function Header() {
  const { usuario, logout } = useAuth();
  const [lembretesPendentes, setLembretesPendentes] = useState(0);

  useEffect(() => {
    api.get('/lembretes/pendentes')
      .then(({ data }) => setLembretesPendentes(data.total))
      .catch(() => {});
  }, []);

  return (
    <header className="h-16 bg-alisson-600 border-b border-alisson-500 flex items-center justify-between px-6 fixed top-0 left-64 right-0 z-10">
      <div className="flex items-center gap-2">
        <img src="/logo-alisson-branco.svg" alt="Alisson" className="h-5 opacity-80" />
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-alisson-500 rounded-lg transition-colors">
          <Bell size={20} className="text-creme-200" />
          {lembretesPendentes > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {lembretesPendentes}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-alisson-500">
          <div className="w-8 h-8 bg-alisson-400 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-creme-100">{usuario?.nome}</p>
            <p className="text-xs text-alisson-200 capitalize">{usuario?.papel}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-alisson-500 rounded-lg transition-colors ml-2"
            title="Sair"
          >
            <LogOut size={18} className="text-creme-300" />
          </button>
        </div>
      </div>
    </header>
  );
}
