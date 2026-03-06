import { useEffect, useState } from 'react';
import { Key, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../services/api';

interface ApiKeyConfig {
  id: string;
  provider: string;
  api_key: string;
  modelo: string;
  ativo: number;
  has_key: boolean;
  selecionado: number;
}

const PROVIDER_INFO: Record<string, { nome: string; label: string; placeholder: string; cor: string; modelos: string[] }> = {
  anthropic: {
    nome: 'Anthropic (Claude)',
    label: 'Claude API Key',
    placeholder: 'sk-ant-api03-...',
    cor: 'bg-orange-50 border-orange-200',
    modelos: [
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5',
      'claude-opus-4-5',
    ],
  },
  openai: {
    nome: 'OpenAI (GPT)',
    label: 'OpenAI API Key',
    placeholder: 'sk-proj-...',
    cor: 'bg-green-50 border-green-200',
    modelos: [
      'gpt-5.2',
      'gpt-5.2-instant',
      'gpt-4o',
      'gpt-4o-mini',
      'o4-mini',
      'o3-mini',
    ],
  },
  gemini: {
    nome: 'Google (Gemini)',
    label: 'Gemini API Key',
    placeholder: 'AIzaSy...',
    cor: 'bg-blue-50 border-blue-200',
    modelos: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3-pro-preview',
      'gemini-3.1-pro-preview',
    ],
  },
};

export function ApiKeysForm() {
  const [keys, setKeys] = useState<ApiKeyConfig[]>([]);
  const [editando, setEditando] = useState<Record<string, { key: string; modelo: string }>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState<string | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, { ok: boolean; erro?: string }>>({});
  const [msg, setMsg] = useState<Record<string, { tipo: 'sucesso' | 'erro'; texto: string }>>({});
  const [mostrarKey, setMostrarKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/api-keys').then(({ data }) => {
      setKeys(data);
      const edit: Record<string, { key: string; modelo: string }> = {};
      for (const k of data) {
        edit[k.provider] = { key: k.api_key || '', modelo: k.modelo || '' };
      }
      setEditando(edit);
    }).catch(() => {});
  }, []);

  const handleSalvar = async (provider: string) => {
    setSalvando(provider);
    setMsg(prev => ({ ...prev, [provider]: undefined as any }));
    try {
      const { key, modelo } = editando[provider];
      await api.put(`/api-keys/${provider}`, { api_key: key, modelo });
      setMsg(prev => ({ ...prev, [provider]: { tipo: 'sucesso', texto: 'Salvo!' } }));
      // Refresh keys
      const { data } = await api.get('/api-keys');
      setKeys(data);
      const edit: Record<string, { key: string; modelo: string }> = {};
      for (const k of data) {
        edit[k.provider] = { key: k.api_key || '', modelo: k.modelo || '' };
      }
      setEditando(edit);
    } catch (e: any) {
      setMsg(prev => ({ ...prev, [provider]: { tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar' } }));
    } finally {
      setSalvando(null);
    }
  };

  const handleSelecionar = async (provider: string) => {
    setSelecionando(provider);
    try {
      await api.put(`/api-keys/${provider}/selecionar`);
      setKeys(prev => prev.map(k => ({ ...k, selecionado: k.provider === provider ? 1 : 0 })));
    } catch (e: any) {
      setMsg(prev => ({ ...prev, [provider]: { tipo: 'erro', texto: 'Erro ao selecionar provedor' } }));
    } finally {
      setSelecionando(null);
    }
  };

  const handleTestar = async (provider: string) => {
    setTestando(provider);
    setResultados(prev => ({ ...prev, [provider]: undefined as any }));
    try {
      const { data } = await api.post(`/api-keys/${provider}/testar`);
      setResultados(prev => ({ ...prev, [provider]: data }));
    } catch (e: any) {
      setResultados(prev => ({ ...prev, [provider]: { ok: false, erro: e.response?.data?.erro || 'Erro ao testar' } }));
    } finally {
      setTestando(null);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-alisson-600 mb-2 flex items-center gap-2">
        <Key size={20} className="text-alisson-600" /> Chaves de API (Inteligencia Artificial)
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Configure as API Keys dos provedores de IA. Clique em "Usar esta API" para escolher o provedor ativo. Sem seleção, a prioridade é: Anthropic &gt; OpenAI &gt; Gemini.
      </p>

      <div className="space-y-4">
        {keys.map((k) => {
          const info = PROVIDER_INFO[k.provider];
          if (!info) return null;
          const edit = editando[k.provider] || { key: '', modelo: '' };
          const resultado = resultados[k.provider];
          const message = msg[k.provider];

          return (
            <div key={k.provider} className={`rounded-lg border p-4 ${info.cor}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{info.nome}</h3>
                  <span className="text-xs text-gray-500">
                    {k.has_key ? 'Configurada' : 'Nao configurada'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {k.selecionado === 1 && (
                    <span className="text-xs bg-alisson-100 text-alisson-700 px-2 py-0.5 rounded-full font-medium">
                      Em uso
                    </span>
                  )}
                  {k.has_key && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Ativa
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{info.label}</label>
                  <div className="relative">
                    <input
                      type={mostrarKey[k.provider] ? 'text' : 'password'}
                      value={edit.key}
                      onChange={(e) => setEditando(prev => ({
                        ...prev,
                        [k.provider]: { ...prev[k.provider], key: e.target.value }
                      }))}
                      placeholder={info.placeholder}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm font-mono bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarKey(prev => ({ ...prev, [k.provider]: !prev[k.provider] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {mostrarKey[k.provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
                  <select
                    value={edit.modelo}
                    onChange={(e) => setEditando(prev => ({
                      ...prev,
                      [k.provider]: { ...prev[k.provider], modelo: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-alisson-400 text-sm bg-white"
                  >
                    {info.modelos.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {message && (
                  <p className={`text-xs ${message.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
                    {message.texto}
                  </p>
                )}

                {resultado && (
                  <div className="flex items-center gap-2 text-sm">
                    {resultado.ok ? (
                      <>
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="text-green-700">Conexao OK!</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="text-red-500" />
                        <span className="text-red-700">{resultado.erro || 'Falhou'}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    tamanho="sm"
                    onClick={() => handleSalvar(k.provider)}
                    disabled={salvando === k.provider}
                  >
                    {salvando === k.provider ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button
                    tamanho="sm"
                    variante="secundario"
                    onClick={() => handleTestar(k.provider)}
                    disabled={testando === k.provider || !k.has_key}
                  >
                    {testando === k.provider ? (
                      <><Loader2 size={14} className="animate-spin" /> Testando...</>
                    ) : (
                      'Testar Conexao'
                    )}
                  </Button>
                  {k.has_key && (
                    <Button
                      tamanho="sm"
                      variante="secundario"
                      onClick={() => handleSelecionar(k.provider)}
                      disabled={selecionando === k.provider || k.selecionado === 1}
                    >
                      {selecionando === k.provider ? (
                        <><Loader2 size={14} className="animate-spin" /> Selecionando...</>
                      ) : k.selecionado === 1 ? (
                        'Em uso'
                      ) : (
                        'Usar esta API'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
