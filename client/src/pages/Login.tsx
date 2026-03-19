import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
    } catch (err: any) {
      setErro(err.response?.data?.erro || 'Erro ao fazer login');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-alisson-600 flex flex-col">
      {/* Barra superior verde escuro estilo WhatsApp */}
      <div className="h-56 bg-alisson-600" />

      {/* Card centralizado */}
      <div className="flex-1 bg-creme-200 -mt-32 flex items-start justify-center pt-0">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md -mt-24 relative">
          <div className="text-center mb-8">
            <img src="/leao.svg" alt="Alisson" className="w-20 h-20 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-alisson-600">IAlisson</h1>
            <p className="text-gray-500 mt-1 text-sm">Caixa de entrada unificada</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {erro}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400"
                placeholder="Sua senha"
                required
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-alisson-600 hover:bg-alisson-500 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-creme-100 rounded-lg">
            <p className="text-xs text-gray-500 font-medium mb-2">Credenciais de teste:</p>
            <p className="text-xs text-gray-600">Admin: admin@alisson.com / admin123</p>
            <p className="text-xs text-gray-600">Vendedor: maria@alisson.com / vendedor123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
