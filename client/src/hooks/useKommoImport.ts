import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

interface KommoConfig {
  id: string;
  subdomain: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  redirect_uri: string;
  conectado: boolean;
}

interface ImportLog {
  id: string;
  tipo: string;
  total_esperado: number;
  total_importado: number;
  total_erros: number;
  status: string;
  detalhes: string | null;
  iniciado_em: string | null;
  finalizado_em: string | null;
  criado_em: string;
}

interface ImportIds {
  contatosId: string;
  leadsId: string;
  notasId: string;
}

export function useKommoImport() {
  const [config, setConfig] = useState<KommoConfig | null>(null);
  const [conectado, setConectado] = useState(false);
  const [importacoes, setImportacoes] = useState<ImportLog[]>([]);
  const [importIds, setImportIds] = useState<ImportIds | null>(null);
  const [importando, setImportando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load config on mount
  const carregarConfig = useCallback(async () => {
    try {
      const { data } = await api.get('/kommo/config');
      setConfig(data);
      setConectado(!!data?.conectado);
    } catch {
      setConfig(null);
      setConectado(false);
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarImportacoes = useCallback(async () => {
    try {
      const { data } = await api.get('/kommo/importar');
      setImportacoes(data);

      // Check if any are still running
      const algumRodando = data.some((i: ImportLog) => i.status === 'rodando' || i.status === 'pendente');
      setImportando(algumRodando);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    carregarConfig();
    carregarImportacoes();
  }, [carregarConfig, carregarImportacoes]);

  // Polling during import
  useEffect(() => {
    if (importando && importIds) {
      pollingRef.current = setInterval(async () => {
        try {
          const results = await Promise.all([
            api.get(`/kommo/importar/${importIds.contatosId}`),
            api.get(`/kommo/importar/${importIds.leadsId}`),
            api.get(`/kommo/importar/${importIds.notasId}`),
          ]);

          const logs = results.map(r => r.data);
          setImportacoes(prev => {
            const others = prev.filter(i =>
              i.id !== importIds.contatosId &&
              i.id !== importIds.leadsId &&
              i.id !== importIds.notasId
            );
            return [...logs, ...others];
          });

          // Stop polling if all done
          const allDone = logs.every(
            (l: ImportLog) => l.status === 'concluido' || l.status === 'erro' || l.status === 'cancelado'
          );
          if (allDone) {
            setImportando(false);
          }
        } catch { /* ignore */ }
      }, 2000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [importando, importIds]);

  const salvarConfig = async (data: { client_id: string; client_secret: string; redirect_uri?: string; subdomain?: string }) => {
    setErro(null);
    try {
      await api.post('/kommo/config', data);
      await carregarConfig();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao salvar configuracao');
      throw e;
    }
  };

  const gerarAuthUrl = async (): Promise<string> => {
    const { data } = await api.get('/kommo/auth-url');
    return data.url;
  };

  const enviarCallback = async (code: string) => {
    setErro(null);
    try {
      await api.post('/kommo/callback', { code });
      await carregarConfig();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao autorizar');
      throw e;
    }
  };

  const testarConexao = async () => {
    setErro(null);
    setTestResult(null);
    try {
      const { data } = await api.post('/kommo/testar');
      setTestResult(data);
      return data;
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao testar conexao');
      throw e;
    }
  };

  const iniciarImportacao = async () => {
    setErro(null);
    try {
      const { data } = await api.post('/kommo/importar');
      const ids: ImportIds = data.imports;
      setImportIds(ids);
      setImportando(true);
      return ids;
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao iniciar importacao');
      throw e;
    }
  };

  const cancelarImportacao = async (id: string) => {
    try {
      await api.delete(`/kommo/importar/${id}`);
      await carregarImportacoes();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao cancelar');
    }
  };

  // Get current import logs for active imports
  const importAtual = importIds
    ? {
        contatos: importacoes.find(i => i.id === importIds.contatosId) || null,
        leads: importacoes.find(i => i.id === importIds.leadsId) || null,
        notas: importacoes.find(i => i.id === importIds.notasId) || null,
      }
    : null;

  return {
    config,
    conectado,
    importacoes,
    importando,
    importAtual,
    importIds,
    carregando,
    erro,
    testResult,
    salvarConfig,
    gerarAuthUrl,
    enviarCallback,
    testarConexao,
    iniciarImportacao,
    cancelarImportacao,
    carregarImportacoes,
  };
}
