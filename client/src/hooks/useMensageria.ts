import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

export type Canal = 'whatsapp' | 'instagram_dm' | 'instagram_comment' | 'interno' | 'todos';

export interface Conversa {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  canal: Canal;
  meta_contato_id: string;
  meta_contato_nome: string;
  modo_auto: number;
  total_mensagens: number;
  ultima_mensagem: string;
  ultima_msg_em: string;
  vendedor_id: string;
  ativa: number;
  atualizado_em: string;
  bant_score?: number;
  bant_budget?: string;
  bant_authority?: string;
  bant_need?: string;
  bant_timeline?: string;
  bant_qualificado?: number;
  bant_atualizado_em?: string;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  dados_extraidos?: string;
  canal_origem: string;
  meta_msg_id: string;
  status_envio: string;
  tipo_midia: string;
  midia_url: string;
  transcricao?: string;
  criado_em: string;
}

export interface DadosExtraidos {
  nome?: string;
  telefone?: string;
  email?: string;
  tipo_interesse?: string;
  material_preferido?: string;
  pedra_preferida?: string;
  orcamento_min?: number;
  orcamento_max?: number;
  ocasiao?: string;
  resumo?: string;
}

export function useMensageria() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conversaAtual, setConversaAtual] = useState<Conversa | null>(null);
  const [filtroCanal, setFiltroCanal] = useState<Canal>('todos');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarConversas = useCallback(async (canal?: Canal) => {
    try {
      const filtro = canal || filtroCanal;
      const params: any = {};
      if (filtro !== 'todos') params.canal = filtro;

      const { data } = await api.get('/mensageria/conversas', { params });
      setConversas(data);
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    }
  }, [filtroCanal]);

  const selecionarConversa = async (id: string) => {
    try {
      const { data } = await api.get(`/mensageria/conversas/${id}`);
      setConversaAtual(data.conversa);
      setMensagens(data.mensagens);
      setDadosExtraidos(data.dadosExtraidos);
    } catch (e) {
      console.error('Erro ao carregar conversa:', e);
    }
  };

  const enviarMensagem = async (texto: string) => {
    if (!conversaAtual || !texto.trim()) return;

    setEnviando(true);

    // Optimistic UI
    const tempMsg: Mensagem = {
      id: 'temp-' + Date.now(),
      conversa_id: conversaAtual.id,
      papel: 'assistant',
      conteudo: texto,
      canal_origem: conversaAtual.canal,
      meta_msg_id: '',
      status_envio: 'pendente',
      tipo_midia: 'texto',
      midia_url: '',
      criado_em: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, tempMsg]);

    try {
      const { data } = await api.post(`/mensageria/conversas/${conversaAtual.id}/mensagens`, {
        texto,
        usar_dara: false,
      });

      // Replace temp message with real response
      setMensagens(prev => prev.filter(m => m.id !== tempMsg.id).concat({
        ...tempMsg,
        id: 'sent-' + Date.now(),
        conteudo: data.resposta,
        status_envio: 'enviado',
      }));

      if (data.dados_extraidos) {
        setDadosExtraidos(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.dados_extraidos).filter(([_, v]) => v !== null)
          ),
        }));
      }

      return data;
    } catch (error) {
      setMensagens(prev => prev.filter(m => m.id !== tempMsg.id));
      throw error;
    } finally {
      setEnviando(false);
    }
  };

  const enviarComDara = async () => {
    if (!conversaAtual) return;

    setEnviando(true);

    try {
      const { data } = await api.post(`/mensageria/conversas/${conversaAtual.id}/mensagens`, {
        texto: '',
        usar_dara: true,
      });

      const daraMsg: Mensagem = {
        id: 'dara-' + Date.now(),
        conversa_id: conversaAtual.id,
        papel: 'assistant',
        conteudo: data.resposta,
        canal_origem: conversaAtual.canal,
        meta_msg_id: '',
        status_envio: 'enviado',
        tipo_midia: 'texto',
        midia_url: '',
        criado_em: new Date().toISOString(),
        dados_extraidos: data.dados_extraidos ? JSON.stringify(data.dados_extraidos) : undefined,
      };
      setMensagens(prev => [...prev, daraMsg]);

      if (data.dados_extraidos) {
        setDadosExtraidos(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.dados_extraidos).filter(([_, v]) => v !== null)
          ),
        }));
      }

      return data;
    } finally {
      setEnviando(false);
    }
  };

  const enviarMidia = async (arquivo: File, caption?: string) => {
    if (!conversaAtual) return;

    setEnviando(true);

    // Optimistic UI
    const tipoMidia = arquivo.type.startsWith('image/') ? 'imagem'
      : arquivo.type.startsWith('audio/') ? 'audio'
      : arquivo.type.startsWith('video/') ? 'video'
      : 'imagem';
    const tempUrl = URL.createObjectURL(arquivo);
    const tempMsg: Mensagem = {
      id: 'temp-media-' + Date.now(),
      conversa_id: conversaAtual.id,
      papel: 'assistant',
      conteudo: caption || `[${tipoMidia}]`,
      canal_origem: conversaAtual.canal,
      meta_msg_id: '',
      status_envio: 'pendente',
      tipo_midia: tipoMidia,
      midia_url: tempUrl,
      criado_em: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, tempMsg]);

    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      if (caption) formData.append('caption', caption);

      const { data } = await api.post(
        `/mensageria/conversas/${conversaAtual.id}/midia`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Substituir mensagem temporária
      if (data.mensagem) {
        setMensagens(prev => prev.map(m =>
          m.id === tempMsg.id ? { ...data.mensagem } : m
        ));
      }

      return data;
    } catch (error) {
      setMensagens(prev => prev.filter(m => m.id !== tempMsg.id));
      throw error;
    } finally {
      URL.revokeObjectURL(tempUrl);
      setEnviando(false);
    }
  };

  const toggleModoAuto = async () => {
    if (!conversaAtual) return;

    const novoModo = !conversaAtual.modo_auto;
    try {
      await api.put(`/mensageria/conversas/${conversaAtual.id}/modo-auto`, {
        modo_auto: novoModo,
      });
      setConversaAtual(prev => prev ? { ...prev, modo_auto: novoModo ? 1 : 0 } : null);
    } catch (e) {
      console.error('Erro ao alterar modo auto:', e);
    }
  };

  // Polling every 5s
  useEffect(() => {
    carregarConversas();

    pollingRef.current = setInterval(() => {
      carregarConversas();
      if (conversaAtual) {
        // Refresh current conversation messages
        api.get(`/mensageria/conversas/${conversaAtual.id}`).then(({ data }) => {
          setMensagens(data.mensagens);
          if (data.dadosExtraidos) setDadosExtraidos(data.dadosExtraidos);
        }).catch(() => {});
      }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [conversaAtual?.id, filtroCanal]);

  return {
    conversas,
    mensagens,
    dadosExtraidos,
    enviando,
    conversaAtual,
    filtroCanal,
    setFiltroCanal: (canal: Canal) => {
      setFiltroCanal(canal);
      carregarConversas(canal);
    },
    carregarConversas,
    selecionarConversa,
    enviarMensagem,
    enviarComDara,
    enviarMidia,
    toggleModoAuto,
  };
}
