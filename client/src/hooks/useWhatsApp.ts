import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export interface Instancia {
  id: string;
  nome: string;
  status: 'conectado' | 'conectando' | 'desconectado';
  tem_qr: boolean;
  criado_em: string;
}

interface Warmup {
  enviados: number;
  limite: number;
  dia: number;
  dentroHorario: boolean;
}

interface Campanha {
  id: string;
  nome: string;
  mensagem_template: string;
  total_contatos: number;
  total_enviados: number;
  total_erros: number;
  status: string;
  criado_em: string;
}

export function useWhatsApp() {
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [warmup, setWarmup] = useState<Warmup | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const conectado = instancias.some(i => i.status === 'conectado');

  const carregarInstancias = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/instancias');
      setInstancias(data);
    } catch {
      setInstancias([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarWarmup = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/warmup');
      setWarmup(data);
    } catch {}
  }, []);

  const carregarCampanhas = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/campanhas');
      setCampanhas(data);
    } catch {}
  }, []);

  useEffect(() => {
    carregarInstancias();
    carregarWarmup();
    carregarCampanhas();
  }, [carregarInstancias, carregarWarmup, carregarCampanhas]);

  // Polling enquanto tem instancia conectando
  useEffect(() => {
    const temConectando = instancias.some(i => i.status === 'conectando');
    if (temConectando) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        carregarInstancias();
      }, 3000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [instancias, carregarInstancias]);

  // --- Instancias ---

  const adicionarInstancia = async (nome: string) => {
    setErro(null);
    try {
      await api.post('/whatsapp/instancias', { nome });
      await carregarInstancias();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao criar instancia');
      throw e;
    }
  };

  const removerInstancia = async (id: string) => {
    setErro(null);
    try {
      await api.delete(`/whatsapp/instancias/${id}`);
      await carregarInstancias();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao remover');
      throw e;
    }
  };

  const conectarInstancia = async (id: string) => {
    setErro(null);
    try {
      await api.post(`/whatsapp/instancias/${id}/conectar`);
      await carregarInstancias();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao conectar');
    }
  };

  const desconectarInstancia = async (id: string) => {
    setErro(null);
    try {
      await api.post(`/whatsapp/instancias/${id}/desconectar`);
      await carregarInstancias();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao desconectar');
    }
  };

  const obterQRCode = async (id: string): Promise<string | null> => {
    try {
      const { data } = await api.get(`/whatsapp/instancias/${id}/qrcode`);
      return data?.base64 || null;
    } catch {
      return null;
    }
  };

  // --- Envio e campanhas ---

  const enviarMensagem = async (clienteId: string, telefone: string, texto: string) => {
    setErro(null);
    try {
      const { data } = await api.post('/whatsapp/enviar', { cliente_id: clienteId, telefone, texto });
      await carregarWarmup();
      return data;
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao enviar');
      throw e;
    }
  };

  const criarCampanha = async (nome: string, template: string, clienteIds: string[]) => {
    setErro(null);
    try {
      const { data } = await api.post('/whatsapp/campanhas', {
        nome, mensagem_template: template, cliente_ids: clienteIds,
      });
      await carregarCampanhas();
      return data;
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao criar campanha');
      throw e;
    }
  };

  const iniciarCampanha = async (id: string) => {
    try {
      await api.post(`/whatsapp/campanhas/${id}/iniciar`);
      await carregarCampanhas();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao iniciar');
    }
  };

  const pausarCampanha = async (id: string) => {
    try {
      await api.post(`/whatsapp/campanhas/${id}/pausar`);
      await carregarCampanhas();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao pausar');
    }
  };

  const cancelarCampanha = async (id: string) => {
    try {
      await api.post(`/whatsapp/campanhas/${id}/cancelar`);
      await carregarCampanhas();
    } catch (e: any) {
      setErro(e.response?.data?.erro || 'Erro ao cancelar');
    }
  };

  return {
    instancias, conectado, warmup, campanhas,
    carregando, erro,
    carregarInstancias, carregarWarmup, carregarCampanhas,
    adicionarInstancia, removerInstancia,
    conectarInstancia, desconectarInstancia, obterQRCode,
    enviarMensagem,
    criarCampanha, iniciarCampanha, pausarCampanha, cancelarCampanha,
  };
}
