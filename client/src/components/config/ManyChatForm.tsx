import { useEffect, useState } from 'react';
import { Copy, CheckCircle, XCircle, Send, RefreshCw, MessageSquare, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import api from '../../services/api';

interface ManyChatConfig {
  webhook_secret: string | null;
  api_key: string | null;
  ativo: number;
  auto_distribuir: number;
  funil_destino_id: number | null;
  estagio_destino: string;
  origem_padrao: string;
}

interface ManyChatStatus {
  config: ManyChatConfig;
  totalSubscribers: number;
  ultimoWebhook: string | null;
  webhooksHoje: number;
  ultimosLogs: any[];
}

export function ManyChatForm() {
  const [status, setStatus] = useState<ManyChatStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [testando, setTestando] = useState(false);
  const [mostrarLogs, setMostrarLogs] = useState(false);

  const [form, setForm] = useState({
    webhook_secret: '',
    api_key: '',
    ativo: 1,
    auto_distribuir: 1,
    estagio_destino: 'Lead',
    origem_padrao: 'manychat',
  });

  useEffect(() => {
    carregarStatus();
  }, []);

  const carregarStatus = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/manychat/status');
      setStatus(data);
      if (data.config) {
        setForm({
          webhook_secret: data.config.webhook_secret || '',
          api_key: data.config.api_key || '',
          ativo: data.config.ativo ?? 1,
          auto_distribuir: data.config.auto_distribuir ?? 1,
          estagio_destino: data.config.estagio_destino || 'Lead',
          origem_padrao: data.config.origem_padrao || 'manychat',
        });
      }
    } catch (e) {
      console.error('Erro ao carregar status ManyChat:', e);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await api.put('/manychat/config', form);
      setMsg({ tipo: 'sucesso', texto: 'Configuracao salva com sucesso!' });
      carregarStatus();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar' });
    } finally {
      setSalvando(false);
    }
  };

  const copiarUrl = () => {
    const url = `${window.location.origin}/api/manychat/webhook`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleTestar = async () => {
    setTestando(true);
    setMsg(null);
    try {
      const payload = {
        id: 'test_' + Date.now(),
        first_name: 'Teste',
        last_name: 'ManyChat',
        phone: '+5511999990000',
        email: 'teste@manychat.com',
        tags: ['teste', 'manychat'],
        custom_fields: {
          ig_username: 'teste_instagram',
          source: 'teste_manual',
        },
      };
      const { data } = await api.post('/manychat/test', payload);
      setMsg({
        tipo: 'sucesso',
        texto: `Teste OK! Lead ${data.criado ? 'criado' : 'atualizado'} (ID: ${data.clienteId?.slice(0, 8)}...)`,
      });
      carregarStatus();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro no teste' });
    } finally {
      setTestando(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/manychat/webhook`;

  if (carregando) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" /> Carregando ManyChat...
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Tooltip texto="Receba leads automaticamente do ManyChat no seu CRM" posicao="right">
        <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-alisson-600" /> ManyChat
          <Badge cor={form.ativo ? 'green' : 'red'}>
            {form.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </h2>
      </Tooltip>

      {/* Status */}
      {status && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-alisson-600">{status.totalSubscribers}</p>
            <p className="text-xs text-gray-500">Leads mapeados</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-alisson-600">{status.webhooksHoje}</p>
            <p className="text-xs text-gray-500">Webhooks hoje</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-alisson-600">
              {status.ultimoWebhook
                ? new Date(status.ultimoWebhook).toLocaleString('pt-BR')
                : '--'}
            </p>
            <p className="text-xs text-gray-500">Ultimo webhook</p>
          </div>
        </div>
      )}

      {/* Webhook URL */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL do Webhook (copie e cole no ManyChat)
        </label>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm font-mono text-gray-600 truncate">
            {webhookUrl}
          </div>
          <Button tamanho="sm" onClick={copiarUrl}>
            {copiado ? <CheckCircle size={14} /> : <Copy size={14} />}
            {copiado ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      </div>

      {/* Configuracao */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Webhook Secret (opcional)"
            type="password"
            placeholder="Chave para validar requests"
            value={form.webhook_secret}
            onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
          />
          <Input
            label="API Key ManyChat (opcional)"
            type="password"
            placeholder="Para uso futuro"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Estagio destino"
            placeholder="Lead"
            value={form.estagio_destino}
            onChange={(e) => setForm({ ...form, estagio_destino: e.target.value })}
          />
          <Input
            label="Origem padrao"
            placeholder="manychat"
            value={form.origem_padrao}
            onChange={(e) => setForm({ ...form, origem_padrao: e.target.value })}
          />
        </div>

        {/* Toggles */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked ? 1 : 0 })}
              className="w-4 h-4 text-alisson-600 rounded"
            />
            <span className="text-sm text-gray-700">Integracao ativa</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.auto_distribuir}
              onChange={(e) => setForm({ ...form, auto_distribuir: e.target.checked ? 1 : 0 })}
              className="w-4 h-4 text-alisson-600 rounded"
            />
            <span className="text-sm text-gray-700">Auto-distribuir leads</span>
          </label>
        </div>

        {/* Mensagem */}
        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            msg.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {msg.tipo === 'sucesso' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {msg.texto}
          </div>
        )}

        {/* Botoes */}
        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
            Salvar
          </Button>
          <Button variante="secundario" onClick={handleTestar} disabled={testando}>
            {testando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Testar
          </Button>
          <Button variante="secundario" onClick={carregarStatus}>
            <RefreshCw size={14} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Logs recentes */}
      {status && status.ultimosLogs.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setMostrarLogs(!mostrarLogs)}
            className="text-sm text-alisson-600 hover:underline"
          >
            {mostrarLogs ? 'Ocultar' : 'Mostrar'} ultimos webhooks ({status.ultimosLogs.length})
          </button>
          {mostrarLogs && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {status.ultimosLogs.map((log: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-500 py-1 border-b border-gray-50">
                  {log.processado ? (
                    <CheckCircle size={12} className="text-green-500" />
                  ) : log.erro ? (
                    <XCircle size={12} className="text-red-500" />
                  ) : (
                    <RefreshCw size={12} className="text-yellow-500" />
                  )}
                  <span>{new Date(log.criado_em).toLocaleString('pt-BR')}</span>
                  {log.erro && <span className="text-red-400">- {log.erro}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instrucoes */}
      <div className="mt-5 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">Como configurar no ManyChat:</h3>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
          <li>No ManyChat, va em <strong>Automation</strong> e abra seu fluxo</li>
          <li>Adicione uma acao <strong>External Request</strong> (HTTP Request)</li>
          <li>Metodo: <strong>POST</strong></li>
          <li>URL: copie a URL do webhook acima</li>
          <li>Body: selecione <strong>JSON</strong> e inclua os campos desejados</li>
          <li>Campos recomendados: id, first_name, last_name, phone, email, tags</li>
          {form.webhook_secret && (
            <li>Adicione o header: <strong>x-manychat-secret: {'{seu_secret}'}</strong></li>
          )}
        </ol>
      </div>
    </Card>
  );
}
