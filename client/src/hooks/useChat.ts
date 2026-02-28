import { useState } from 'react';
import api from '../services/api';

interface Mensagem {
  id: string;
  conversa_id: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  dados_extraidos?: string;
  criado_em: string;
}

interface DadosExtraidos {
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

export function useChat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);

  const iniciarConversa = async (clienteId?: string, nomeCliente?: string) => {
    const { data } = await api.post('/chat/conversas', {
      cliente_id: clienteId,
      nome_cliente: nomeCliente,
    });
    setConversaId(data.conversa_id);
    setMensagens([]);
    setDadosExtraidos(null);
    return data;
  };

  const carregarConversa = async (id: string) => {
    const { data } = await api.get(`/chat/conversas/${id}`);
    setConversaId(id);
    setMensagens(data.mensagens);

    // Load latest extracted data
    const ultimaMsgComDados = [...data.mensagens]
      .reverse()
      .find((m: Mensagem) => m.dados_extraidos);
    if (ultimaMsgComDados?.dados_extraidos) {
      try {
        setDadosExtraidos(JSON.parse(ultimaMsgComDados.dados_extraidos));
      } catch {}
    }

    return data;
  };

  const enviarMensagem = async (texto: string) => {
    if (!conversaId || !texto.trim()) return;

    setEnviando(true);

    // Optimistic UI - add user message
    const tempMsg: Mensagem = {
      id: 'temp-' + Date.now(),
      conversa_id: conversaId,
      papel: 'user',
      conteudo: texto,
      criado_em: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, tempMsg]);

    try {
      const { data } = await api.post(`/chat/conversas/${conversaId}/mensagens`, {
        mensagem: texto,
      });

      // Add assistant response
      const assistantMsg: Mensagem = {
        id: 'resp-' + Date.now(),
        conversa_id: conversaId,
        papel: 'assistant',
        conteudo: data.resposta,
        dados_extraidos: data.dados_extraidos ? JSON.stringify(data.dados_extraidos) : undefined,
        criado_em: new Date().toISOString(),
      };
      setMensagens(prev => [...prev, assistantMsg]);

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
      // Remove optimistic message on error
      setMensagens(prev => prev.filter(m => m.id !== tempMsg.id));
      throw error;
    } finally {
      setEnviando(false);
    }
  };

  return {
    mensagens,
    dadosExtraidos,
    enviando,
    conversaId,
    iniciarConversa,
    carregarConversa,
    enviarMensagem,
  };
}
