import { useEffect, useState } from 'react';
import { Globe, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../services/api';

interface MetaConfig {
  page_id: string;
  whatsapp_phone_number_id: string;
  instagram_business_account_id: string;
  access_token: string;
  webhook_verify_token: string;
}

interface TesteResult {
  whatsapp: boolean;
  instagram: boolean;
  erros: string[];
}

export function MetaConfigForm() {
  const [config, setConfig] = useState<MetaConfig>({
    page_id: '',
    whatsapp_phone_number_id: '',
    instagram_business_account_id: '',
    access_token: '',
    webhook_verify_token: 'alisson_joalheria_2026',
  });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testeResult, setTesteResult] = useState<TesteResult | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    api.get('/config/meta').then(({ data }) => {
      if (data) {
        setConfig({
          page_id: data.page_id || '',
          whatsapp_phone_number_id: data.whatsapp_phone_number_id || '',
          instagram_business_account_id: data.instagram_business_account_id || '',
          access_token: data.access_token || '',
          webhook_verify_token: data.webhook_verify_token || 'alisson_joalheria_2026',
        });
      }
    }).catch(() => {});
  }, []);

  const handleSalvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await api.post('/config/meta', config);
      setMsg({ tipo: 'sucesso', texto: 'Configuração salva com sucesso!' });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar' });
    } finally {
      setSalvando(false);
    }
  };

  const handleTestar = async () => {
    setTestando(true);
    setTesteResult(null);
    try {
      const { data } = await api.post('/config/meta/testar');
      setTesteResult(data);
    } catch (e: any) {
      setTesteResult({ whatsapp: false, instagram: false, erros: [e.response?.data?.erro || 'Erro ao testar'] });
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
        <Globe size={20} className="text-alisson-600" /> Meta API (WhatsApp + Instagram)
      </h2>

      <div className="space-y-4">
        <Input
          label="Page ID (Facebook)"
          value={config.page_id}
          onChange={(e) => setConfig({ ...config, page_id: e.target.value })}
          placeholder="ID da página do Facebook"
        />
        <Input
          label="WhatsApp Phone Number ID"
          value={config.whatsapp_phone_number_id}
          onChange={(e) => setConfig({ ...config, whatsapp_phone_number_id: e.target.value })}
          placeholder="ID do número WhatsApp Business"
        />
        <Input
          label="Instagram Business Account ID"
          value={config.instagram_business_account_id}
          onChange={(e) => setConfig({ ...config, instagram_business_account_id: e.target.value })}
          placeholder="ID da conta business do Instagram"
        />
        <Input
          label="Access Token"
          value={config.access_token}
          onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
          placeholder="Token de acesso Meta (long-lived)"
        />
        <Input
          label="Webhook Verify Token"
          value={config.webhook_verify_token}
          onChange={(e) => setConfig({ ...config, webhook_verify_token: e.target.value })}
          placeholder="Token de verificação do webhook"
        />

        {msg && (
          <p className={`text-sm ${msg.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.texto}
          </p>
        )}

        {testeResult && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              {testeResult.whatsapp ? (
                <CheckCircle size={16} className="text-green-500" />
              ) : (
                <XCircle size={16} className="text-red-500" />
              )}
              <span className="text-sm">WhatsApp: {testeResult.whatsapp ? 'Conectado' : 'Falhou'}</span>
            </div>
            <div className="flex items-center gap-2">
              {testeResult.instagram ? (
                <CheckCircle size={16} className="text-green-500" />
              ) : (
                <XCircle size={16} className="text-red-500" />
              )}
              <span className="text-sm">Instagram: {testeResult.instagram ? 'Conectado' : 'Falhou'}</span>
            </div>
            {testeResult.erros.length > 0 && (
              <div className="text-xs text-red-600 mt-2">
                {testeResult.erros.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
          <Button variante="secundario" onClick={handleTestar} disabled={testando}>
            {testando ? (
              <><Loader2 size={14} className="animate-spin" /> Testando...</>
            ) : (
              'Testar Conexão'
            )}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
          <p className="font-semibold mb-1">Webhook URL para configurar no Meta:</p>
          <code className="bg-blue-100 px-2 py-0.5 rounded">
            https://SEU_DOMINIO/api/webhook/meta
          </code>
          <p className="mt-2">Campos necessários: messages (WhatsApp + Instagram), comments (Instagram)</p>
        </div>
      </div>
    </Card>
  );
}
