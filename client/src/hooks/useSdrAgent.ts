import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface SdrConfig {
  ativo: number;
  telefone_admin: string;
  intervalo_polling: number;
  cron_resumo_manha: string;
  cron_resumo_tarde: string;
  auto_criar_tasks: number;
  auto_followup: number;
  auto_mover_leads: number;
  dias_inatividade: number;
  deadline_primeiro_contato: number;
  deadline_followup: number;
  deadline_pos_venda: number;
  prompt_personalizado: string;
  ultimo_polling: string | null;
}

interface SdrStatus {
  rodando: boolean;
  ativo: boolean;
  jobs: string[];
  ultimo_polling: string | null;
  intervalo_polling: number;
  telefone_admin: string | null;
}

interface SdrLog {
  id: number;
  tipo: string;
  prioridade: string;
  lead_id: number | null;
  lead_nome: string | null;
  descricao: string;
  acao_tomada: string | null;
  notificado: number;
  criado_em: string;
}

interface SdrStats {
  total_logs: number;
  logs_hoje: number;
  por_tipo: { tipo: string; total: number }[];
  por_prioridade: { prioridade: string; total: number }[];
}

export function useSdrAgent() {
  const [config, setConfig] = useState<SdrConfig | null>(null);
  const [status, setStatus] = useState<SdrStatus | null>(null);
  const [logs, setLogs] = useState<SdrLog[]>([]);
  const [stats, setStats] = useState<SdrStats | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarTudo = useCallback(async () => {
    try {
      setErro(null);
      const [configRes, statusRes, logsRes, statsRes] = await Promise.all([
        api.get('/sdr-agent/config'),
        api.get('/sdr-agent/status'),
        api.get('/sdr-agent/logs?limite=30'),
        api.get('/sdr-agent/logs/stats'),
      ]);
      setConfig(configRes.data);
      setStatus(statusRes.data);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarTudo();
    const interval = setInterval(carregarTudo, 10000);
    return () => clearInterval(interval);
  }, [carregarTudo]);

  const salvarConfig = async (dados: Partial<SdrConfig>) => {
    try {
      setErro(null);
      await api.post('/sdr-agent/config', dados);
      await carregarTudo();
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    }
  };

  const iniciar = async () => {
    try {
      setErro(null);
      await api.post('/sdr-agent/iniciar');
      await carregarTudo();
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    }
  };

  const parar = async () => {
    try {
      setErro(null);
      await api.post('/sdr-agent/parar');
      await carregarTudo();
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    }
  };

  const executarPolling = async () => {
    try {
      setErro(null);
      const res = await api.post('/sdr-agent/polling');
      await carregarTudo();
      return res.data;
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    }
  };

  const enviarResumo = async (tipo: 'manha' | 'tarde') => {
    try {
      setErro(null);
      const res = await api.post('/sdr-agent/resumo', { tipo });
      return res.data;
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    }
  };

  const testarNotificacao = async () => {
    try {
      setErro(null);
      await api.post('/sdr-agent/testar-notificacao');
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
      throw e;
    }
  };

  const carregarLogs = async (filtros: { tipo?: string; limite?: number; offset?: number } = {}) => {
    try {
      const params = new URLSearchParams();
      if (filtros.tipo) params.set('tipo', filtros.tipo);
      if (filtros.limite) params.set('limite', String(filtros.limite));
      if (filtros.offset) params.set('offset', String(filtros.offset));
      const res = await api.get(`/sdr-agent/logs?${params}`);
      setLogs(res.data);
    } catch (e: any) {
      setErro(e.response?.data?.erro || e.message);
    }
  };

  return {
    config,
    status,
    logs,
    stats,
    carregando,
    erro,
    salvarConfig,
    iniciar,
    parar,
    executarPolling,
    enviarResumo,
    testarNotificacao,
    carregarLogs,
    recarregar: carregarTudo,
  };
}
