import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { getSystemPrompt } from '../utils/prompt';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY nao configurada');
    }
    client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  }
  return client;
}

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeService {
  async enviarMensagem(historico: MensagemChat[]): Promise<string> {
    const anthropic = getClient();
    const systemPrompt = getSystemPrompt();

    const response = await anthropic.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: historico,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async extrairDados(historico: MensagemChat[]): Promise<Record<string, any> | null> {
    const anthropic = getClient();

    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Dara'}: ${m.content}`)
      .join('\n');

    try {
      const response = await anthropic.messages.create({
        model: env.CLAUDE_MODEL,
        max_tokens: 512,
        system: 'Voce e um extrator de dados. Analise conversas e extraia informacoes estruturadas em JSON.',
        messages: [
          {
            role: 'user',
            content: `Analise a conversa abaixo e extraia os dados do cliente em formato JSON.
Retorne APENAS o JSON, sem texto adicional. Se um campo nao foi mencionado, use null.

Formato esperado:
{
  "nome": "nome completo ou null",
  "telefone": "telefone ou null",
  "email": "email ou null",
  "tipo_interesse": "aliancas|aneis|colares|brincos|pulseiras|sob_encomenda ou null",
  "material_preferido": "material ou null",
  "pedra_preferida": "pedra ou null",
  "orcamento_min": null,
  "orcamento_max": null,
  "ocasiao": "casamento|noivado|presente|aniversario|formatura|uso_pessoal ou null",
  "resumo": "breve resumo do interesse"
}

CONVERSA:
${conversaTexto}`,
          },
        ],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock) return null;

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
      return null;
    }
  }
}
