import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Link2, RefreshCw, Webhook } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../services/api';

interface UnipileConfig {
  id: string;
  api_key: string;
  dsn: string;
  account_id: string;
  account_username: string;
  account_provider: string;
  webhook_id: string;
  webhook_url: string;
  status: 'desconectado' | 'conectado' | 'erro';
  ultimo_erro?: string;
  atualizado_em?: string;
}

interface ContaUnipile {
  id?: string;
  account_id?: string;
  type?: string;
  name?: string;
  username?: string;
  status?: string;
}

export function UnipileForm() {
  const [config, setConfig] = useState<UnipileConfig | null>(null);
  const [form, setForm] = useState({
    api_key: '',
    dsn: '',
    account_id: '',
    account_username: '',
    account_provider: 'INSTAGRAM',
  });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [registrandoWebhook, setRegistrandoWebhook] = useState(false);
  const [contas, setContas] = useState<ContaUnipile[]>([]);
  const [carregandoContas, setCarregandoContas] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [webhookCallbackUrl, setWebhookCallbackUrl] = useState('');

  useEffect(() => {
    carregarConfig();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol;
      const host = window.location.hostname;
      setWebhookCallbackUrl(`${proto}//${host}:3001/api/unipile/webhook`);
    }
  }, []);

  const carregarConfig = async () => {
    try {
      const { data } = await api.get('/unipile/config');
      if (data) {
        setConfig(data);
        setForm({
          api_key: data.api_key.includes('...') ? data.api_key : '',
          dsn: data.dsn || '',
          account_id: data.account_id || '',
          account_username: data.account_username || '',
          account_provider: data.account_provider || 'INSTAGRAM',
        });
      }
    } catch {}
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await api.post('/unipile/config', form);
      setMsg({ tipo: 'sucesso', texto: 'Configuração salva!' });
      await carregarConfig();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar' });
    } finally {
      setSalvando(false);
    }
  };

  const handleTestar = async () => {
    setTestando(true);
    setMsg(null);
    try {
      const { data } = await api.post('/unipile/testar');
      if (data.ok) {
        setMsg({ tipo: 'sucesso', texto: `Conexão OK — ${data.contas?.length || 0} conta(s) Unipile.` });
        setContas(data.contas || []);
        await carregarConfig();
      } else {
        setMsg({ tipo: 'erro', texto: data.erro || 'Falha na conexão' });
      }
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro de rede' });
    } finally {
      setTestando(false);
    }
  };

  const handleListarContas = async () => {
    setCarregandoContas(true);
    setMsg(null);
    try {
      const { data } = await api.get('/unipile/contas');
      setContas(data.contas || []);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao listar contas' });
    } finally {
      setCarregandoContas(false);
    }
  };

  const handleRegistrarWebhook = async () => {
    setRegistrandoWebhook(true);
    setMsg(null);
    try {
      await api.post('/unipile/webhook/registrar', {
        callback_url: webhookCallbackUrl,
        source: 'messaging',
      });
      setMsg({ tipo: 'sucesso', texto: 'Webhook registrado! Mensagens novas vão cair no CRM.' });
      await carregarConfig();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao registrar webhook' });
    } finally {
      setRegistrandoWebhook(false);
    }
  };

  const usarContaSelecionada = (c: ContaUnipile) => {
    setForm(f => ({
      ...f,
      account_id: c.account_id || c.id || '',
      account_username: c.username || c.name || '',
      account_provider: (c.type || 'INSTAGRAM').toUpperCase(),
    }));
  };

  const isConectado = config?.status === 'conectado';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-alisson-600 flex items-center gap-2">
          <Link2 size={20} /> Unipile (Instagram via API multicanal)
        </h2>
        {config && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
            isConectado ? 'bg-green-50 text-green-700' :
            config.status === 'erro' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isConectado ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {isConectado ? 'Conectado' : config.status === 'erro' ? 'Erro' : 'Desconectado'}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Conecte sua conta Unipile (DSN + API Key) e o ID da conta Instagram já vinculada lá.
        Quando ativo, DMs do Instagram caem direto no CRM via webhook — sem precisar da aprovação Meta.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Input
          label="API Key (X-API-KEY)"
          type="password"
          value={form.api_key}
          placeholder={config?.api_key || 'Cole sua API Key da Unipile'}
          onChange={(e) => setForm({ ...form, api_key: e.target.value })}
        />
        <Input
          label="DSN (ex: api1.unipile.com:443)"
          value={form.dsn}
          placeholder="api1.unipile.com:443"
          onChange={(e) => setForm({ ...form, dsn: e.target.value })}
        />
        <Input
          label="Account ID (Instagram conectado)"
          value={form.account_id}
          placeholder="UUID da conta Instagram na Unipile"
          onChange={(e) => setForm({ ...form, account_id: e.target.value })}
        />
        <Input
          label="Username Instagram"
          value={form.account_username}
          placeholder="alissonjoias"
          onChange={(e) => setForm({ ...form, account_username: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button onClick={handleSalvar} disabled={salvando}>
          {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
        </Button>
        <Button onClick={handleTestar} disabled={testando} variante="secundario">
          {testando && <Loader2 size={14} className="animate-spin" />} Testar conexão
        </Button>
        <Button onClick={handleListarContas} disabled={carregandoContas} variante="secundario">
          {carregandoContas ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Listar contas
        </Button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          msg.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {msg.texto}
        </div>
      )}

      {contas.length > 0 && (
        <div className="mb-4 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Contas conectadas na Unipile
          </p>
          <div className="space-y-1">
            {contas.map((c, i) => (
              <button
                key={c.id || c.account_id || i}
                onClick={() => usarContaSelecionada(c)}
                className="w-full text-left p-2 rounded hover:bg-gray-50 flex justify-between items-center text-sm"
              >
                <div>
                  <span className="font-medium">{c.username || c.name || c.account_id || c.id}</span>
                  <span className="ml-2 text-xs text-gray-400">{c.type || c.status}</span>
                </div>
                <span className="text-xs text-alisson-600">usar →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Webhook size={12} /> Webhook (recebimento de mensagens)
        </p>
        <Input
          label="Callback URL"
          value={webhookCallbackUrl}
          onChange={(e) => setWebhookCallbackUrl(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-1">
          A Unipile chama esta URL toda vez que chega DM. Precisa ser pública (use ngrok/cloudflared em dev).
        </p>
        <Button onClick={handleRegistrarWebhook} disabled={registrandoWebhook} className="mt-2">
          {registrandoWebhook && <Loader2 size={14} className="animate-spin" />} Registrar webhook na Unipile
        </Button>
        {config?.webhook_id && (
          <p className="text-xs text-gray-500 mt-2">
            Webhook atual: <code className="text-alisson-600">{config.webhook_id}</code>
          </p>
        )}
      </div>
    </Card>
  );
}
