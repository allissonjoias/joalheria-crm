import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, RefreshCw, Send, FileText, Phone, Shield, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../services/api';

interface MetaConfig {
  phone_number_id: string;
  waba_id: string;
  token_tipo: string;
  token_expira_em?: string;
  criado_em?: string;
  atualizado_em?: string;
}

interface Template {
  name: string;
  status: string;
  category: string;
  language: string;
  components?: any[];
}

interface NumeroMeta {
  id: string;
  verified_name: string;
  display_phone_number: string;
  quality_rating: string;
  code_verification_status: string;
  status?: string;
  name_status?: string;
  messaging_limit_tier?: string;
}

export function MetaApiForm() {
  const [configurado, setConfigurado] = useState(false);
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [tokenValido, setTokenValido] = useState<boolean | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);
  const [mostrarTemplates, setMostrarTemplates] = useState(false);

  // Form
  const [form, setForm] = useState({
    access_token: '',
    phone_number_id: '',
    waba_id: '',
    token_tipo: 'temporario',
  });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Teste de envio
  const [testeTelefone, setTesteTelefone] = useState('');
  const [testeTexto, setTesteTexto] = useState('Teste da API oficial do WhatsApp Business!');
  const [enviando, setEnviando] = useState(false);

  // Numeros
  const [numeros, setNumeros] = useState<NumeroMeta[]>([]);
  const [carregandoNumeros, setCarregandoNumeros] = useState(false);
  const [mostrarNumeros, setMostrarNumeros] = useState(false);

  // Verificacao de numero
  const [verificandoNumero, setVerificandoNumero] = useState<string | null>(null);
  const [codigoVerificacao, setCodigoVerificacao] = useState('');
  const [aguardandoCodigo, setAguardandoCodigo] = useState(false);
  const [solicitandoCodigo, setSolicitandoCodigo] = useState(false);
  const [registrando, setRegistrando] = useState(false);


  useEffect(() => {
    carregarConfig();
  }, []);

  const carregarConfig = async () => {
    try {
      const { data } = await api.get('/meta-api/config');
      setConfigurado(data.configurado);
      setConfig(data.config);
      if (data.config) {
        setForm(f => ({
          ...f,
          phone_number_id: data.config.phone_number_id || '',
          waba_id: data.config.waba_id || '',
          token_tipo: data.config.token_tipo || 'temporario',
        }));
      }
    } catch {}
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await api.post('/meta-api/config', form);
      setMsg({ tipo: 'sucesso', texto: 'Configuracao salva!' });
      setTokenValido(null);
      carregarConfig();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar' });
    }
    setSalvando(false);
  };

  const handleVerificar = async () => {
    setVerificando(true);
    try {
      const { data } = await api.get('/meta-api/verificar-token');
      setTokenValido(data.valido);
      if (!data.valido) {
        setMsg({ tipo: 'erro', texto: `Token invalido: ${data.erro}` });
      } else {
        setMsg({ tipo: 'sucesso', texto: `Token valido! Numero: ${data.info?.display_phone_number || 'OK'}` });
      }
    } catch {
      setTokenValido(false);
      setMsg({ tipo: 'erro', texto: 'Erro ao verificar token' });
    }
    setVerificando(false);
  };

  const handleCarregarTemplates = async () => {
    setCarregandoTemplates(true);
    try {
      const { data } = await api.get('/meta-api/templates');
      setTemplates(data);
      setMostrarTemplates(true);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao carregar templates: ' + (e.response?.data?.erro || e.message) });
    }
    setCarregandoTemplates(false);
  };

  const handleTesteEnvio = async () => {
    if (!testeTelefone) return;
    setEnviando(true);
    setMsg(null);
    try {
      await api.post('/meta-api/enviar-texto', {
        telefone: testeTelefone,
        texto: testeTexto,
      });
      setMsg({ tipo: 'sucesso', texto: 'Mensagem de teste enviada!' });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao enviar' });
    }
    setEnviando(false);
  };

  // === Numeros ===

  const carregarNumeros = async () => {
    setCarregandoNumeros(true);
    setMostrarNumeros(true);
    try {
      const { data } = await api.get('/meta-api/numeros');
      setNumeros(data);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao carregar numeros: ' + (e.response?.data?.erro || e.message) });
    }
    setCarregandoNumeros(false);
  };

  const handleSolicitarCodigo = async (phoneNumberId: string, metodo: 'SMS' | 'VOICE') => {
    setSolicitandoCodigo(true);
    setMsg(null);
    try {
      await api.post('/meta-api/numeros/solicitar-codigo', {
        phone_number_id: phoneNumberId,
        metodo,
      });
      setVerificandoNumero(phoneNumberId);
      setAguardandoCodigo(true);
      setMsg({ tipo: 'sucesso', texto: `Codigo enviado por ${metodo}! Verifique seu telefone.` });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao solicitar codigo' });
    }
    setSolicitandoCodigo(false);
  };

  const handleVerificarCodigo = async () => {
    if (!verificandoNumero || !codigoVerificacao) return;
    setSolicitandoCodigo(true);
    setMsg(null);
    try {
      await api.post('/meta-api/numeros/verificar-codigo', {
        phone_number_id: verificandoNumero,
        codigo: codigoVerificacao,
      });
      setMsg({ tipo: 'sucesso', texto: 'Numero verificado com sucesso!' });
      setAguardandoCodigo(false);
      setVerificandoNumero(null);
      setCodigoVerificacao('');
      carregarNumeros();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Codigo invalido' });
    }
    setSolicitandoCodigo(false);
  };

  const handleRegistrar = async (phoneNumberId: string) => {
    setRegistrando(true);
    setMsg(null);
    try {
      await api.post('/meta-api/numeros/registrar', { phone_number_id: phoneNumberId });
      setMsg({ tipo: 'sucesso', texto: 'Numero registrado na Cloud API!' });
      carregarNumeros();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao registrar' });
    }
    setRegistrando(false);
  };

  const handleSelecionar = async (phoneNumberId: string) => {
    try {
      await api.post('/meta-api/numeros/selecionar', { phone_number_id: phoneNumberId });
      setMsg({ tipo: 'sucesso', texto: 'Numero selecionado como ativo!' });
      carregarConfig();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao selecionar' });
    }
  };

  const qualityColor = (q: string) => {
    if (q === 'GREEN') return 'bg-green-100 text-green-700';
    if (q === 'YELLOW') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Send size={20} className="text-green-600" /> WhatsApp Business API (Meta)
        </h2>
        <div className="flex items-center gap-2">
          {configurado && tokenValido === true && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle size={12} /> Conectado
            </span>
          )}
          {configurado && tokenValido === false && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
              <XCircle size={12} /> Token invalido
            </span>
          )}
          {!configurado && (
            <span className="text-xs text-gray-400">Nao configurado</span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        API oficial da Meta para envio de templates aprovados e campanhas em massa.
        O Baileys continua ativo para conversas individuais e auto-resposta IA.
      </p>

      <div className="space-y-4">
        <div>
          <Input
            label="Access Token"
            type="password"
            value={form.access_token}
            onChange={(e) => setForm({ ...form, access_token: e.target.value })}
            placeholder="EAAORGDykwFs..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Cole o token da pagina de configuracao do app Meta. Tokens temporarios expiram em ~24h.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone Number ID"
            value={form.phone_number_id}
            onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
            placeholder="1019889491205217"
          />
          <Input
            label="WABA ID"
            value={form.waba_id}
            onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
            placeholder="1627462128455718"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Token</label>
          <select
            value={form.token_tipo}
            onChange={(e) => setForm({ ...form, token_tipo: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          >
            <option value="temporario">Temporario (~24h)</option>
            <option value="permanente">Permanente (System User)</option>
          </select>
        </div>

        {msg && (
          <p className={`text-sm ${msg.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.texto}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
          {configurado && (
            <Button variante="secundario" onClick={handleVerificar} disabled={verificando}>
              <RefreshCw size={14} className={verificando ? 'animate-spin' : ''} />
              {verificando ? 'Verificando...' : 'Verificar Token'}
            </Button>
          )}
        </div>

        {/* === NUMEROS DE TELEFONE === */}
        {configurado && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Phone size={14} /> Numeros Conectados
              </h3>
              <Button tamanho="sm" variante="secundario" onClick={carregarNumeros} disabled={carregandoNumeros}>
                {carregandoNumeros ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {carregandoNumeros ? 'Carregando...' : 'Carregar Numeros'}
              </Button>
            </div>

            {mostrarNumeros && numeros.length === 0 && !carregandoNumeros && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <Phone size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 mb-1">Nenhum numero encontrado</p>
                <p className="text-xs text-gray-400">Adicione numeros no Meta Business Suite ou clique em "Conectar Numero Manualmente"</p>
              </div>
            )}

            {mostrarNumeros && numeros.length > 0 && (
              <div className="space-y-3">
                {numeros.map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Phone size={18} className="text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-800">{n.display_phone_number}</p>
                            {n.verified_name === 'Test Number' && (
                              <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">TESTE</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{n.verified_name || 'Sem nome verificado'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${qualityColor(n.quality_rating)}`}>
                          {n.quality_rating}
                        </span>
                        {config?.phone_number_id === n.id && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            Ativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs text-gray-500 mb-3">
                      <span>ID: {n.id}</span>
                      <span>Verificacao: {
                        n.code_verification_status === 'VERIFIED' ? 'Verificado' :
                        n.code_verification_status === 'NOT_VERIFIED' ? 'Nao verificado' :
                        n.code_verification_status
                      }</span>
                      {n.messaging_limit_tier && <span>Limite: {n.messaging_limit_tier}</span>}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {/* Selecionar como ativo */}
                      {config?.phone_number_id !== n.id && (
                        <button
                          onClick={() => handleSelecionar(n.id)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Usar este numero
                        </button>
                      )}

                      {/* Verificar numero */}
                      {n.code_verification_status !== 'VERIFIED' && verificandoNumero !== n.id && (
                        <>
                          <button
                            onClick={() => handleSolicitarCodigo(n.id, 'SMS')}
                            disabled={solicitandoCodigo}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1">
                              <Shield size={12} /> Verificar via SMS
                            </span>
                          </button>
                          <button
                            onClick={() => handleSolicitarCodigo(n.id, 'VOICE')}
                            disabled={solicitandoCodigo}
                            className="text-xs bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            Verificar via Ligacao
                          </button>
                        </>
                      )}

                      {/* Registrar na Cloud API */}
                      {n.code_verification_status === 'VERIFIED' && (
                        <button
                          onClick={() => handleRegistrar(n.id)}
                          disabled={registrando}
                          className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          {registrando ? 'Registrando...' : 'Registrar na Cloud API'}
                        </button>
                      )}
                    </div>

                    {/* Input de codigo de verificacao */}
                    {aguardandoCodigo && verificandoNumero === n.id && (
                      <div className="mt-3 flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Codigo recebido
                          </label>
                          <input
                            value={codigoVerificacao}
                            onChange={e => setCodigoVerificacao(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="000000"
                            maxLength={6}
                          />
                        </div>
                        <button
                          onClick={handleVerificarCodigo}
                          disabled={solicitandoCodigo || !codigoVerificacao}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {solicitandoCodigo ? 'Verificando...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => { setAguardandoCodigo(false); setVerificandoNumero(null); }}
                          className="text-gray-400 hover:text-gray-600 px-2 py-2 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Templates */}
        {configurado && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <FileText size={14} /> Templates Aprovados
              </h3>
              <Button tamanho="sm" variante="secundario" onClick={handleCarregarTemplates} disabled={carregandoTemplates}>
                {carregandoTemplates ? 'Carregando...' : 'Carregar Templates'}
              </Button>
            </div>

            {mostrarTemplates && templates.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum template encontrado. Crie templates no Gerenciador de WhatsApp da Meta.</p>
            )}

            {mostrarTemplates && templates.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {templates.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.category} | {t.language}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      t.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teste de envio */}
        {configurado && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Teste de Envio</h3>
            <div className="flex gap-2">
              <Input
                label=""
                placeholder="Telefone (ex: 5585998639142)"
                value={testeTelefone}
                onChange={(e) => setTesteTelefone(e.target.value)}
              />
              <Button onClick={handleTesteEnvio} disabled={enviando || !testeTelefone}>
                <Send size={14} /> {enviando ? 'Enviando...' : 'Testar'}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Envio de texto livre so funciona se o destinatario enviou mensagem nas ultimas 24h. Para fora da janela, use templates.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
