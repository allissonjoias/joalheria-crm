import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'vendedor';
}

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  carregando: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsuario = localStorage.getItem('usuario');
    if (storedToken && storedUsuario) {
      setToken(storedToken);
      setUsuario(JSON.parse(storedUsuario));
    }
    setCarregando(false);
  }, []);

  const login = async (email: string, senha: string) => {
    const { data } = await api.post('/auth/login', { email, senha });
    setToken(data.token);
    setUsuario(data.usuario);
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
  };

  const logout = () => {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  };

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
