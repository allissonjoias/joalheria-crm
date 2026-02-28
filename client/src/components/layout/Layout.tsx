import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-400" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-charcoal-50">
      <Sidebar />
      <Header />
      <main className="ml-64 mt-16 p-6">
        <Outlet />
      </main>
    </div>
  );
}
