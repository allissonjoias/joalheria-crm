import { useState } from 'react';
import { Download, Plug, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { ImportProgress } from '../components/kommo/ImportProgress';
import { useKommoImport } from '../hooks/useKommoImport';
import { useAuth } from '../contexts/AuthContext';

export default function ImportarKommo() {
  const { usuario } = useAuth();
  const {
    config, conectado, importacoes, importando, importAtual, importIds,
    carregando, erro, testResult,
    salvarConfig, gerarAuthUrl, enviarCallback, testarConexao,
    iniciarImportacao, cancelarImportacao, carregarImportacoes,
  } = useKommoImport();

  const [form, setForm] = useState({
    client_id: '',
    client_secret: '',
    redirect_uri: 'https://localhost/kommo/callback',
    subdomain: 'alissonjoiass',
  });
  const [authCode, setAuthCode] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);

  const isAdmin = usuario?.papel === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-alisson-600" size={24} />
      </div>
    );
  }

  const handleSalvarConfig = async () => {
    setSalvando(true);
    try {
      await salvarConfig(form);
    } catch { /* erro ja tratado no hook */ }
    setSalvando(false);
  };

  const handleConectar = async () => {
    try {
      const url = await gerarAuthUrl();
      // Open Kommo authorization in popup
      const popup = window.open(url, 'kommo_auth', 'width=600,height=700');

      // Listen for the code from the popup
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'kommo_callback' && event.data?.code) {
          setAuthCode(event.data.code);
          window.removeEventListener('message', handler);
          popup?.close();
        }
      };
      window.addEventListener('message', handler);
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao gerar URL de autorizacao');
    }
  };

  const handleCallback = async () => {
    if (!authCode) return;
    try {
      await enviarCallback(authCode);
      setAuthCode('');
    } catch { /* erro tratado no hook */ }
  };

  const handleTestar = async () => {
    setTestando(true);
    try {
      await testarConexao();
    } catch { /* erro tratado no hook */ }
    setTestando(false);
  };

  const handleImportar = async () => {
    if (!confirm('Iniciar importacao de todos os dados do Kommo? Isso pode levar alguns minutos.')) return;
    try {
      await iniciarImportacao();
    } catch { /* erro tratado no hook */ }
  };

  const handleCancelarTudo = () => {
    if (!importIds) return;
    cancelarImportacao(importIds.contatosId);
    cancelarImportacao(importIds.leadsId);
    cancelarImportacao(importIds.notasId);
  };

  // Historico - importacoes anteriores (nao do lote atual)
  const historico = importacoes.filter(i =>
    !importIds ||
    (i.id !== importIds.contatosId && i.id !== importIds.leadsId && i.id !== importIds.notasId)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-alisson-600 mb-6 flex items-center gap-2">
        <Download size={24} /> Importar do Kommo CRM
      </h1>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Secao 1: Conexao */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
            <Plug size={20} /> Conexao Kommo
          </h2>

          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            {conectado ? (
              <Badge cor="green">Conectado</Badge>
            ) : (
              <Badge cor="red">Desconectado</Badge>
            )}
          </div>

          <div className="space-y-3">
            <Input
              label="Subdominio"
              placeholder="alissonjoiass"
              value={config?.subdomain || form.subdomain}
              onChange={(e) => setForm({ ...form, subdomain: e.target.value })}
            />
            <Input
              label="Client ID"
              placeholder="ID da integracao Kommo"
              value={form.client_id || (config?.client_id || '')}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            />
            <Input
              label="Client Secret"
              type="password"
              placeholder="Secret da integracao"
              value={form.client_secret}
              onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
            />
            <Input
              label="Redirect URI"
              placeholder="https://localhost/kommo/callback"
              value={form.redirect_uri}
              onChange={(e) => setForm({ ...form, redirect_uri: e.target.value })}
            />

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSalvarConfig} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Config'}
              </Button>

              {config?.client_id && !conectado && (
                <Button variante="secundario" onClick={handleConectar}>
                  Conectar ao Kommo
                </Button>
              )}
            </div>

            {/* Manual code input (fallback if popup doesn't work) */}
            {config?.client_id && !conectado && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">
                  Se a janela nao abrir, cole o authorization code aqui:
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Authorization code"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                  />
                  <Button tamanho="sm" onClick={handleCallback} disabled={!authCode}>
                    Autorizar
                  </Button>
                </div>
              </div>
            )}

            {conectado && (
              <div className="pt-3 border-t border-gray-100">
                <Button variante="secundario" onClick={handleTestar} disabled={testando}>
                  {testando ? 'Testando...' : 'Testar Conexao'}
                </Button>
                {testResult && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">
                    <CheckCircle size={14} className="inline mr-1" />
                    Conexao OK! Amostra: {testResult.amostra?.name || 'N/A'}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Secao 2: Importar */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-alisson-600 mb-4 flex items-center gap-2">
            <Play size={20} /> Importacao
          </h2>

          {!conectado ? (
            <p className="text-sm text-gray-500">Conecte ao Kommo primeiro para iniciar a importacao.</p>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <Button
                  onClick={handleImportar}
                  disabled={importando}
                >
                  {importando ? 'Importando...' : 'Importar Tudo'}
                </Button>
                {importando && (
                  <Button variante="perigo" onClick={handleCancelarTudo}>
                    Cancelar Tudo
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <ImportProgress
                  log={importAtual?.contatos || null}
                  label="Contatos"
                  onCancelar={importIds ? () => cancelarImportacao(importIds.contatosId) : undefined}
                />
                <ImportProgress
                  log={importAtual?.leads || null}
                  label="Leads"
                  onCancelar={importIds ? () => cancelarImportacao(importIds.leadsId) : undefined}
                />
                <ImportProgress
                  log={importAtual?.notas || null}
                  label="Notas"
                  onCancelar={importIds ? () => cancelarImportacao(importIds.notasId) : undefined}
                />
              </div>

              {importAtual && !importando && (
                <div className="mt-4 p-3 bg-creme-200 rounded-lg">
                  <p className="text-sm font-medium text-alisson-600">Importacao finalizada!</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Verifique as paginas de Clientes e Pipeline para conferir os dados importados.
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Secao 3: Historico */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-alisson-600">Historico de Importacoes</h2>
            <Button tamanho="sm" variante="ghost" onClick={carregarImportacoes}>
              <RefreshCw size={14} /> Atualizar
            </Button>
          </div>

          {importacoes.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma importacao realizada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Tipo</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Status</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">Importados</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">Erros</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Detalhes</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {importacoes.map((imp) => (
                    <tr key={imp.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 capitalize">{imp.tipo}</td>
                      <td className="py-2 px-2">
                        <Badge cor={
                          imp.status === 'concluido' ? 'green' :
                          imp.status === 'erro' ? 'red' :
                          imp.status === 'rodando' ? 'blue' :
                          imp.status === 'cancelado' ? 'orange' : 'gray'
                        }>
                          {imp.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">{imp.total_importado.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-2 text-right text-red-500">{imp.total_erros}</td>
                      <td className="py-2 px-2 text-xs text-gray-500 max-w-xs truncate">{imp.detalhes || '-'}</td>
                      <td className="py-2 px-2 text-xs text-gray-500">{imp.criado_em}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
