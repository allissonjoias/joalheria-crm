import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-creme-200">
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
    <div className="min-h-screen bg-creme-200">
      <Sidebar />
      <Header />
      <main className="ml-64 mt-16 p-6">
        <Outlet />
      </main>
    </div>
  );
}
