import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { agoraLocal } from '../utils/timezone';

export type Canal = 'whatsapp' | 'instagram_dm' | 'instagram_comment' | 'todos';

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
  foto_perfil?: string;
  nao_lidas?: number;
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
  instagram_media_id?: string | null;
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

export interface ScoringResult {
  nota: number;
  pontos_positivos: string[];
  pontos_melhorar: string[];
  detalhes: string[];
}

export interface InstagramPostInfo {
  id: string;
  ig_media_id: string;
  tipo: string;
  caption?: string | null;
  permalink?: string | null;
  media_product_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
}

export function useMensageria() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos | null>(null);
  const [instagramPost, setInstagramPost] = useState<InstagramPostInfo | null>(null);
  const [instagramPosts, setInstagramPosts] = useState<Record<string, InstagramPostInfo>>({});
  const [enviando, setEnviando] = useState(false);
  const [conversaAtual, setConversaAtual] = useState<Conversa | null>(null);
  const [filtroCanal, setFiltroCanal] = useState<Canal>('todos');
  const [scoring, setScoring] = useState<ScoringResult | null>(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastConversasHashRef = useRef('');

  const carregarConversas = useCallback(async (canal?: Canal) => {
    try {
      const filtro = canal || filtroCanal;
      const params: any = {};
      if (filtro !== 'todos') {
        params.canal = filtro;
      }

      const { data } = await api.get('/mensageria/conversas', { params });
      // So atualizar se realmente mudou (evita re-render da lista inteira)
      const hash = data.map((c: any) => `${c.id}:${c.ultima_msg_em}:${c.nao_lidas}`).join('|');
      if (hash !== lastConversasHashRef.current) {
        lastConversasHashRef.current = hash;
        setConversas(data);
      }
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    }
  }, [filtroCanal]);

  const selecionarConversa = async (id: string) => {
    try {
      const { data } = await api.get(`/mensageria/conversas/${id}`);
      setConversaAtual(data.conversa);
      setMensagens(data.mensagens);
      // Atualizar refs de comparacao
      const msgs = data.mensagens as Mensagem[];
      lastMsgCountRef.current = msgs.length;
      lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : '';
      setDadosExtraidos(data.dadosExtraidos);
      setInstagramPost(data.instagramPost || null);
      setInstagramPosts(data.instagramPosts || {});
      setScoring(null); // Reset scoring ao trocar conversa
      // Zerar contador de nao lidas localmente
      setConversas(prev => prev.map(c => c.id === id ? { ...c, nao_lidas: 0 } : c));
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
      criado_em: agoraLocal(),
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
        criado_em: agoraLocal(),
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
      : 'documento';
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
      criado_em: agoraLocal(),
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

  const solicitarScoring = async () => {
    if (!conversaAtual || scoringLoading) return;
    setScoringLoading(true);
    try {
      const { data } = await api.post(`/mensageria/conversas/${conversaAtual.id}/scoring`);
      setScoring(data);
    } catch (e) {
      console.error('Erro ao solicitar scoring:', e);
    } finally {
      setScoringLoading(false);
    }
  };

  // Ref para comparar se mensagens realmente mudaram
  const lastMsgCountRef = useRef(0);
  const lastMsgIdRef = useRef('');

  // Polling every 5s
  useEffect(() => {
    carregarConversas();

    pollingRef.current = setInterval(() => {
      carregarConversas();
      if (conversaAtual) {
        // Refresh current conversation messages
        api.get(`/mensageria/conversas/${conversaAtual.id}`).then(({ data }) => {
          const newMsgs = data.mensagens as Mensagem[];
          const lastId = newMsgs.length > 0 ? newMsgs[newMsgs.length - 1].id : '';
          // So atualizar se realmente mudou (nova mensagem ou quantidade diferente)
          if (newMsgs.length !== lastMsgCountRef.current || lastId !== lastMsgIdRef.current) {
            lastMsgCountRef.current = newMsgs.length;
            lastMsgIdRef.current = lastId;
            setMensagens(newMsgs);
          }
          if (data.dadosExtraidos) setDadosExtraidos(data.dadosExtraidos);
          if (data.instagramPost) setInstagramPost(data.instagramPost);
          if (data.instagramPosts) setInstagramPosts(data.instagramPosts);
        }).catch(() => {});
      }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [conversaAtual?.id, filtroCanal]);

  const excluirConversa = async (id: string) => {
    try {
      await api.delete(`/mensageria/conversas/${id}`);
      if (conversaAtual?.id === id) {
        setConversaAtual(null);
        setMensagens([]);
      }
      await carregarConversas();
    } catch (e) {
      console.error('Erro ao excluir conversa:', e);
    }
  };

  const excluirTodasConversas = async () => {
    try {
      const { data } = await api.delete('/mensageria/conversas');
      setConversaAtual(null);
      setMensagens([]);
      setConversas([]);
      lastConversasHashRef.current = '';
      await carregarConversas();
      return data;
    } catch (e) {
      console.error('Erro ao apagar todas as conversas:', e);
      throw e;
    }
  };

  const limparMensagens = async (id: string) => {
    try {
      await api.delete(`/mensageria/conversas/${id}/mensagens`);
      if (conversaAtual?.id === id) {
        setMensagens([]);
      }
      await carregarConversas();
    } catch (e) {
      console.error('Erro ao limpar mensagens:', e);
    }
  };

  return {
    conversas,
    mensagens,
    dadosExtraidos,
    instagramPost,
    instagramPosts,
    enviando,
    conversaAtual,
    filtroCanal,
    scoring,
    scoringLoading,
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
    solicitarScoring,
    excluirConversa,
    excluirTodasConversas,
    limparMensagens,
  };
}
