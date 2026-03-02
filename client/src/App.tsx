import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Mensageria from './pages/Mensageria';
import Clientes from './pages/Clientes';
import Produtos from './pages/Produtos';
import Pipeline from './pages/Pipeline';
import Vendas from './pages/Vendas';
import Lembretes from './pages/Lembretes';
import Configuracoes from './pages/Configuracoes';
import ImportarKommo from './pages/ImportarKommo';
import WhatsAppPage from './pages/WhatsApp';
import SdrAgent from './pages/SdrAgent';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mensagens" element={<Mensageria />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/lembretes" element={<Lembretes />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/importar" element={<ImportarKommo />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/sdr-agent" element={<SdrAgent />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
