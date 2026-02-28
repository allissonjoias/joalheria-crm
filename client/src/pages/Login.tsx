import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gem } from 'lucide-react';

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
    <div className="min-h-screen bg-charcoal-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-400/10 rounded-full mb-4">
            <Gem className="text-gold-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-charcoal-900">Alisson Joalheria</h1>
          <p className="text-charcoal-500 mt-1">CRM com Inteligencia Artificial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-3 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="Sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-gold-400 hover:bg-gold-500 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-charcoal-50 rounded-lg">
          <p className="text-xs text-charcoal-500 font-medium mb-2">Credenciais de teste:</p>
          <p className="text-xs text-charcoal-600">Admin: admin@alisson.com / admin123</p>
          <p className="text-xs text-charcoal-600">Vendedor: maria@alisson.com / vendedor123</p>
        </div>
      </div>
    </div>
  );
}
