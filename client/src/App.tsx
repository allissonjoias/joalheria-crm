import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { AjudaCrmWidget } from './components/ui/AjudaCrmWidget';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { PushNotificationPrompt } from './components/pwa/PushNotifications';
import Login from './pages/Login';
import Mensageria from './pages/Mensageria';
import Pipeline from './pages/Pipeline';
import Configuracoes from './pages/Configuracoes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/mensagens" replace />} />
            <Route path="/mensagens" element={<Mensageria />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/agentes-ia" element={<Configuracoes abaInicial="agentes" />} />
            <Route path="/whatsapp" element={<Configuracoes abaInicial="whatsapp" />} />
            <Route path="/automacoes" element={<Navigate to="/configuracoes" replace />} />
            <Route path="/simulador" element={<Configuracoes abaInicial="simulador" />} />
            {/* Redirects */}
            <Route path="/clientes" element={<Navigate to="/pipeline" replace />} />
            <Route path="/produtos" element={<Navigate to="/pipeline" replace />} />
            <Route path="/vendas" element={<Navigate to="/pipeline" replace />} />
            <Route path="/lembretes" element={<Navigate to="/pipeline" replace />} />
            <Route path="/chat" element={<Navigate to="/mensagens" replace />} />
            <Route path="/sdr-agent" element={<Navigate to="/configuracoes" replace />} />
            <Route path="/simulador-meta" element={<Navigate to="/configuracoes" replace />} />
            <Route path="/ponto" element={<Navigate to="/mensagens" replace />} />
            <Route path="/equipe" element={<Navigate to="/mensagens" replace />} />
          </Route>
        </Routes>
        <AjudaCrmWidget />
        <InstallPrompt />
        <PushNotificationPrompt />
      </AuthProvider>
    </BrowserRouter>
  );
}
