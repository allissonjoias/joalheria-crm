import { useEffect, useState } from 'react';
import { Shield, Users, Plus, Lock } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: number;
  criado_em: string;
}

export default function Configuracoes() {
  const { usuario } = useAuth();
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal-900 mb-6">Configuracoes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-charcoal-900 mb-4 flex items-center gap-2">
            <Shield size={20} className="text-gold-400" /> Meu Perfil
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-charcoal-500">Nome</p>
              <p className="text-sm font-medium">{usuario?.nome}</p>
            </div>
            <div>
              <p className="text-xs text-charcoal-500">Email</p>
              <p className="text-sm font-medium">{usuario?.email}</p>
            </div>
            <div>
              <p className="text-xs text-charcoal-500">Funcao</p>
              <Badge cor={usuario?.papel === 'admin' ? 'purple' : 'blue'}>
                {usuario?.papel === 'admin' ? 'Administrador' : 'Vendedor'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Password change */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-charcoal-900 mb-4 flex items-center gap-2">
            <Lock size={20} className="text-gold-400" /> Alterar Senha
          </h2>
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
              <h2 className="text-lg font-semibold text-charcoal-900 flex items-center gap-2">
                <Users size={20} className="text-gold-400" /> Usuarios
              </h2>
              <Button tamanho="sm" onClick={() => setModalAberto(true)}>
                <Plus size={14} /> Novo
              </Button>
            </div>
            <div className="space-y-3">
              {usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-charcoal-50">
                  <div>
                    <p className="text-sm font-medium text-charcoal-900">{u.nome}</p>
                    <p className="text-xs text-charcoal-500">{u.email}</p>
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
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Usuario">
        <div className="space-y-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
          <Input label="Senha" type="password" value={form.senha} onChange={(e) => setForm({...form, senha: e.target.value})} required />
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1">Funcao</label>
            <select value={form.papel} onChange={(e) => setForm({...form, papel: e.target.value})} className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400">
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
