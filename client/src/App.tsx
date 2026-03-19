import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { AjudaCrmWidget } from './components/ui/AjudaCrmWidget';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mensageria from './pages/Mensageria';
import Clientes from './pages/Clientes';
import Produtos from './pages/Produtos';
import Pipeline from './pages/Pipeline';
import Vendas from './pages/Vendas';
import Lembretes from './pages/Lembretes';
import Configuracoes from './pages/Configuracoes';
import WhatsAppPage from './pages/WhatsApp';
import AgentesIA from './pages/AgentesIA';
import Simulador from './pages/Simulador';
import Automacoes from './pages/Automacoes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/mensagens" element={<Mensageria />} />
            <Route path="/lembretes" element={<Lembretes />} />
            <Route path="/agentes-ia" element={<AgentesIA />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/automacoes" element={<Automacoes />} />
            {/* Redirects */}
            <Route path="/chat" element={<Navigate to="/agentes-ia" replace />} />
            <Route path="/sdr-agent" element={<Navigate to="/agentes-ia" replace />} />
            <Route path="/ponto" element={<Navigate to="/" replace />} />
            <Route path="/equipe" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <AjudaCrmWidget />
      </AuthProvider>
    </BrowserRouter>
  );
}
