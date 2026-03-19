import { useEffect, useState } from 'react';
import { Instagram, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader2, ExternalLink, Settings, MessageSquare, AtSign, Heart } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import api from '../../services/api';

interface InstagramConta {
  id: string;
  nome: string;
  username: string | null;
  ig_user_id: string | null;
  page_id: string | null;
  page_name: string | null;
  access_token: string;
  token_expira_em: string | null;
  ativo: number;
  criado_em: string;
  receber_dm?: number;
  receber_comentarios?: number;
  receber_mencoes?: number;
  responder_comentarios_auto?: number;
  responder_mencoes_auto?: number;
}

interface ContaConfig {
  receber_dm: number;
  receber_comentarios: number;
  receber_mencoes: number;
  responder_comentarios_auto: number;
  responder_mencoes_auto: number;
}

export function InstagramContasForm() {
  const [contas, setContas] = useState<InstagramConta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [testeResults, setTesteResults] = useState<Record<string, { ok: boolean; erro?: string }>>({});
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [configAberta, setConfigAberta] = useState<string | null>(null);
  const [contaConfigs, setContaConfigs] = useState<Record<string, ContaConfig>>({});

  const carregarContas = () => {
    setCarregando(true);
    api.get('/instagram/contas')
      .then(({ data }) => setContas(data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregarContas();

    // Verificar query params de retorno do OAuth
    const params = new URLSearchParams(window.location.search);
    const igOk = params.get('instagram_ok');
    const igErro = params.get('instagram_erro');

    if (igOk) {
      setMsg({ tipo: 'sucesso', texto: `${igOk} conta(s) Instagram conectada(s) com sucesso!` });
      window.history.replaceState({}, '', window.location.pathname);
      carregarContas();
    } else if (igErro) {
      setMsg({ tipo: 'erro', texto: `Erro ao conectar: ${igErro}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const carregarConfig = async (contaId: string) => {
    try {
      const { data } = await api.get(`/instagram/contas/${contaId}/config`);
      setContaConfigs(prev => ({ ...prev, [contaId]: data }));
    } catch {}
  };

  const handleToggleConfig = async (contaId: string, campo: keyof ContaConfig, valor: number) => {
    const novaConfig = { ...contaConfigs[contaId], [campo]: valor };
    setContaConfigs(prev => ({ ...prev, [contaId]: novaConfig }));
    try {
      await api.put(`/instagram/contas/${contaId}/config`, { [campo]: valor });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar configuracao' });
    }
  };

  const abrirConfig = (contaId: string) => {
    if (configAberta === contaId) {
      setConfigAberta(null);
    } else {
      setConfigAberta(contaId);
      if (!contaConfigs[contaId]) carregarConfig(contaId);
    }
  };

  const handleConectar = async () => {
    setConectando(true);
    setMsg(null);
    try {
      const { data } = await api.get('/instagram/auth-url');
      // Abrir em nova janela
      window.open(data.url, '_self');
    } catch (e: any) {
      const erro = e.response?.data?.erro || 'Erro ao gerar URL de autorizacao';
      if (erro.includes('META_APP_ID')) {
        setMsg({ tipo: 'erro', texto: 'Configure META_APP_ID e META_APP_SECRET no arquivo .env do servidor. Crie um app em developers.facebook.com e copie o App ID e App Secret.' });
      } else {
        setMsg({ tipo: 'erro', texto: erro });
      }
      setConectando(false);
    }
  };

  const handleTestar = async (id: string) => {
    setTestando(id);
    try {
      const { data } = await api.post(`/instagram/contas/${id}/testar`);
      setTesteResults(prev => ({ ...prev, [id]: data }));
    } catch (e: any) {
      setTesteResults(prev => ({ ...prev, [id]: { ok: false, erro: e.response?.data?.erro || 'Erro' } }));
    } finally {
      setTestando(null);
    }
  };

  const handleToggle = async (conta: InstagramConta) => {
    try {
      await api.put(`/instagram/contas/${conta.id}/toggle`, { ativo: !conta.ativo });
      carregarContas();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao alterar status' });
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta conta Instagram?')) return;
    try {
      await api.delete(`/instagram/contas/${id}`);
      carregarContas();
      setMsg({ tipo: 'sucesso', texto: 'Conta removida com sucesso' });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao remover' });
    }
  };

  const handleRenovar = async (id: string) => {
    try {
      await api.post(`/instagram/contas/${id}/renovar-token`);
      setMsg({ tipo: 'sucesso', texto: 'Token renovado com sucesso!' });
      carregarContas();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao renovar token' });
    }
  };

  const tokenExpirando = (expiraEm: string | null) => {
    if (!expiraEm) return false;
    const diff = new Date(expiraEm).getTime() - Date.now();
    return diff < 7 * 24 * 60 * 60 * 1000; // menos de 7 dias
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-alisson-600 flex items-center gap-2">
          <Instagram size={20} className="text-pink-500" /> Instagram - Contas Conectadas
        </h2>
        <Button tamanho="sm" onClick={handleConectar} disabled={conectando}>
          {conectando ? (
            <><Loader2 size={14} className="animate-spin" /> Conectando...</>
          ) : (
            <><Plus size={14} /> Conectar Instagram</>
          )}
        </Button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${msg.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.texto}
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Carregando...
        </div>
      ) : contas.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Instagram size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Nenhuma conta Instagram conectada</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Conectar Instagram" para vincular sua conta</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contas.map((conta) => (
            <div
              key={conta.id}
              className={`p-4 rounded-lg border ${
                conta.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {(conta.username || conta.nome || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {conta.username ? `@${conta.username}` : conta.nome}
                    </p>
                    <Badge cor={conta.ativo ? 'green' : 'gray'}>
                      {conta.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                    {conta.ig_user_id && (
                      <Badge cor="purple">Business</Badge>
                    )}
                    {tokenExpirando(conta.token_expira_em) && (
                      <Badge cor="orange">Token expirando</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Pagina: {conta.page_name || conta.page_id || '-'}
                    {conta.criado_em && ` | Conectado em: ${formatarData(conta.criado_em)}`}
                  </p>
                  {testeResults[conta.id] && (
                    <div className="flex items-center gap-1 mt-1">
                      {testeResults[conta.id].ok ? (
                        <><CheckCircle size={12} className="text-green-500" /><span className="text-xs text-green-600">Conexao OK</span></>
                      ) : (
                        <><XCircle size={12} className="text-red-500" /><span className="text-xs text-red-600">{testeResults[conta.id].erro}</span></>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => abrirConfig(conta.id)}
                  className={`p-2 rounded-lg transition-colors ${configAberta === conta.id ? 'text-alisson-600 bg-alisson-50' : 'text-gray-400 hover:text-alisson-500 hover:bg-alisson-50'}`}
                  title="Configurar eventos"
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => handleTestar(conta.id)}
                  disabled={testando === conta.id}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Testar conexao"
                >
                  {testando === conta.id ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                </button>
                {tokenExpirando(conta.token_expira_em) && (
                  <button
                    onClick={() => handleRenovar(conta.id)}
                    className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                    title="Renovar token"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleToggle(conta)}
                  className={`p-2 rounded-lg transition-colors text-xs font-medium ${
                    conta.ativo
                      ? 'text-yellow-600 hover:bg-yellow-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                  title={conta.ativo ? 'Desativar' : 'Ativar'}
                >
                  {conta.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => handleRemover(conta.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover conta"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              </div>

            {/* Painel de configuracao de eventos */}
            {configAberta === conta.id && contaConfigs[conta.id] && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-3">O que receber no CRM:</p>
                <div className="space-y-3">
                  {/* DMs */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Mensagens Diretas (DM)</p>
                        <p className="text-xs text-gray-400">Receber DMs do Instagram no CRM</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleConfig(conta.id, 'receber_dm', contaConfigs[conta.id].receber_dm ? 0 : 1)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${contaConfigs[conta.id].receber_dm ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${contaConfigs[conta.id].receber_dm ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  {/* Comentarios */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart size={16} className="text-pink-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Comentarios</p>
                        <p className="text-xs text-gray-400">Receber comentarios dos posts no CRM</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleConfig(conta.id, 'receber_comentarios', contaConfigs[conta.id].receber_comentarios ? 0 : 1)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${contaConfigs[conta.id].receber_comentarios ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${contaConfigs[conta.id].receber_comentarios ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  {/* Mencoes */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AtSign size={16} className="text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Mencoes (Tags)</p>
                        <p className="text-xs text-gray-400">Receber quando marcarem voce em posts/stories</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleConfig(conta.id, 'receber_mencoes', contaConfigs[conta.id].receber_mencoes ? 0 : 1)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${contaConfigs[conta.id].receber_mencoes ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${contaConfigs[conta.id].receber_mencoes ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-3">Respostas automaticas:</p>

                    {/* Auto-responder comentarios */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Heart size={16} className="text-pink-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Auto-responder comentarios</p>
                          <p className="text-xs text-gray-400">IA responde comentarios automaticamente</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleConfig(conta.id, 'responder_comentarios_auto', contaConfigs[conta.id].responder_comentarios_auto ? 0 : 1)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${contaConfigs[conta.id].responder_comentarios_auto ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${contaConfigs[conta.id].responder_comentarios_auto ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Auto-responder mencoes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AtSign size={16} className="text-purple-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Auto-responder mencoes</p>
                          <p className="text-xs text-gray-400">Enviar DM automatica quando mencionarem voce</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleConfig(conta.id, 'responder_mencoes_auto', contaConfigs[conta.id].responder_mencoes_auto ? 0 : 1)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${contaConfigs[conta.id].responder_mencoes_auto ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${contaConfigs[conta.id].responder_mencoes_auto ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
        <p className="font-semibold mb-1">Como funciona:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Clique em "Conectar Instagram" para autorizar via Facebook</li>
          <li>Faca login e selecione as paginas que deseja conectar</li>
          <li>As contas Instagram vinculadas as paginas serao conectadas automaticamente</li>
          <li>DMs e comentarios serao recebidos no CRM via webhook</li>
        </ol>
        <p className="mt-2 text-blue-600">
          Requisitos: Conta Instagram Professional/Business vinculada a uma Pagina do Facebook
        </p>
      </div>
    </Card>
  );
}
