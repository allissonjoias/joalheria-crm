import { useEffect, useState, lazy, Suspense } from 'react';
import { Shield, Users, Plus, Lock, Settings, Bot, Smartphone, Zap } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { ApiKeysForm } from '../components/config/ApiKeysForm';
import { InstagramContasForm } from '../components/config/InstagramContasForm';
import { MetaApiForm } from '../components/config/MetaApiForm';
import { UnipileForm } from '../components/config/UnipileForm';
import { FusoHorarioForm } from '../components/config/FusoHorarioForm';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const AgentesIA = lazy(() => import('./AgentesIA'));
const WhatsAppPage = lazy(() => import('./WhatsApp'));
const Simulador = lazy(() => import('./Simulador'));

const ABAS = [
  { id: 'geral', label: 'Geral', icon: Settings },
  { id: 'agentes', label: 'Agentes IA', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  { id: 'simulador', label: 'Simulador', icon: Zap },
] as const;

type AbaId = typeof ABAS[number]['id'];

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: number;
  criado_em: string;
}

export default function Configuracoes({ abaInicial }: { abaInicial?: AbaId }) {
  const { usuario } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<AbaId>(abaInicial || 'geral');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', papel: 'vendedor' });
  const [senhaForm, setSenhaForm] = useState({ senha_atual: '', nova_senha: '', confirmar_senha: '' });
  const [senhaMsg, setSenhaMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const isAdmin = usuario?.papel === 'admin';

  useEffect(() => {
    if (isAdmin) {
      api.get('/auth/usuarios').then(({ data }) => setUsuarios(data)).catch(() => {});
    }
  }, [isAdmin]);

  const handleCriar = async () => {
    try {
      await api.post('/auth/registrar', form);
      setModalAberto(false);
      setForm({ nome: '', email: '', senha: '', papel: 'vendedor' });
      api.get('/auth/usuarios').then(({ data }) => setUsuarios(data)).catch(() => {});
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar usuario');
    }
  };

  const handleToggleAtivo = async (u: Usuario) => {
    await api.put(`/auth/usuarios/${u.id}`, { ativo: u.ativo ? 0 : 1 });
    api.get('/auth/usuarios').then(({ data }) => setUsuarios(data)).catch(() => {});
  };

  const handleAlterarSenha = async () => {
    setSenhaMsg(null);
    if (senhaForm.nova_senha !== senhaForm.confirmar_senha) {
      setSenhaMsg({ tipo: 'erro', texto: 'As senhas nao coincidem' });
      return;
    }
    if (senhaForm.nova_senha.length < 6) {
      setSenhaMsg({ tipo: 'erro', texto: 'Nova senha deve ter pelo menos 6 caracteres' });
      return;
    }
    try {
      await api.put('/auth/alterar-senha', {
        senha_atual: senhaForm.senha_atual,
        nova_senha: senhaForm.nova_senha,
      });
      setSenhaMsg({ tipo: 'sucesso', texto: 'Senha alterada com sucesso!' });
      setSenhaForm({ senha_atual: '', nova_senha: '', confirmar_senha: '' });
    } catch (e: any) {
      setSenhaMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao alterar senha' });
    }
  };

  const LoadingFallback = (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-alisson-600" />
    </div>
  );

  return (
    <div>
      <h1 className="hidden md:block text-2xl font-bold text-alisson-600 mb-4">Configuracoes</h1>

      {/* Abas */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-thin">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              abaAtiva === aba.id
                ? 'bg-alisson-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <aba.icon size={16} />
            {aba.label}
          </button>
        ))}
      </div>

      {/* Conteudo das abas */}
      {abaAtiva === 'agentes' && (
        <Suspense fallback={LoadingFallback}><AgentesIA /></Suspense>
      )}
      {abaAtiva === 'whatsapp' && (
        <Suspense fallback={LoadingFallback}><WhatsAppPage /></Suspense>
      )}
      {abaAtiva === 'simulador' && (
        <Suspense fallback={LoadingFallback}><Simulador /></Suspense>
      )}

      {abaAtiva === 'geral' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Profile */}
        <Card className="p-4 md:p-6">
          <Tooltip texto="Dados do seu perfil de acesso ao CRM" posicao="right">
            <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
              <Shield size={20} className="text-alisson-600" /> Meu Perfil
            </h2>
          </Tooltip>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Nome</p>
              <p className="text-sm font-medium">{usuario?.nome}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium">{usuario?.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Funcao</p>
              <Badge cor={usuario?.papel === 'admin' ? 'purple' : 'blue'}>
                {usuario?.papel === 'admin' ? 'Administrador' : 'Vendedor'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Password change */}
        <Card className="p-6">
          <Tooltip texto="Altere sua senha de acesso ao CRM" posicao="right">
            <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
              <Lock size={20} className="text-alisson-600" /> Alterar Senha
            </h2>
          </Tooltip>
          <div className="space-y-3">
            <Input
              label="Senha Atual"
              type="password"
              value={senhaForm.senha_atual}
              onChange={(e) => setSenhaForm({ ...senhaForm, senha_atual: e.target.value })}
            />
            <Input
              label="Nova Senha"
              type="password"
              value={senhaForm.nova_senha}
              onChange={(e) => setSenhaForm({ ...senhaForm, nova_senha: e.target.value })}
            />
            <Input
              label="Confirmar Nova Senha"
              type="password"
              value={senhaForm.confirmar_senha}
              onChange={(e) => setSenhaForm({ ...senhaForm, confirmar_senha: e.target.value })}
            />
            {senhaMsg && (
              <p className={`text-sm ${senhaMsg.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
                {senhaMsg.texto}
              </p>
            )}
            <Button onClick={handleAlterarSenha}>Alterar Senha</Button>
          </div>
        </Card>

        {/* User management - admin only */}
        {isAdmin && (
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <Tooltip texto="Gerencie usuarios que acessam o CRM: vendedores e administradores" posicao="right">
                <h2 className="text-lg font-semibold text-alisson-600 flex items-center gap-2">
                  <Users size={20} className="text-alisson-600" /> Usuarios
                </h2>
              </Tooltip>
              <Button tamanho="sm" onClick={() => setModalAberto(true)}>
                <Plus size={14} /> Novo
              </Button>
            </div>
            <div className="space-y-3">
              {usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-alisson-600">{u.nome}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge cor={u.papel === 'admin' ? 'purple' : 'blue'}>{u.papel}</Badge>
                    <button
                      onClick={() => handleToggleAtivo(u)}
                      className={`text-xs px-2 py-1 rounded ${u.ativo ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Fuso Horario - admin only */}
        {isAdmin && (
          <div className="lg:col-span-2">
            <FusoHorarioForm />
          </div>
        )}

        {/* API Keys Config - admin only */}
        {isAdmin && (
          <div className="lg:col-span-2">
            <ApiKeysForm />
          </div>
        )}

        {/* Instagram Multi-conta - admin only */}
        {isAdmin && (
          <div className="lg:col-span-2">
            <InstagramContasForm />
          </div>
        )}

        {/* Meta API (WhatsApp Business) - admin only */}
        {isAdmin && (
          <div className="lg:col-span-2">
            <MetaApiForm />
          </div>
        )}

        {/* Unipile - admin only */}
        {isAdmin && (
          <div className="lg:col-span-2">
            <UnipileForm />
          </div>
        )}
      </div>
      )}

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Usuario">
        <div className="space-y-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
          <Input label="Senha" type="password" value={form.senha} onChange={(e) => setForm({...form, senha: e.target.value})} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Funcao</label>
            <select value={form.papel} onChange={(e) => setForm({...form, papel: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400">
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar}>Criar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
