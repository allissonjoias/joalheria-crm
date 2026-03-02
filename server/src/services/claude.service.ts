import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { getSystemPrompt, getConsultaPrompt } from '../utils/prompt';

export interface BANTResult {
  budget: string | null;
  authority: string | null;
  need: string | null;
  timeline: string | null;
  score: number;
  qualificado: boolean;
}

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

  async consultarDara(historico: MensagemChat[]): Promise<string> {
    const anthropic = getClient();
    const systemPrompt = getConsultaPrompt();

    const response = await anthropic.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 2048,
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

  async extrairBANT(historico: MensagemChat[]): Promise<BANTResult | null> {
    const anthropic = getClient();

    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Dara'}: ${m.content}`)
      .join('\n');

    try {
      const response = await anthropic.messages.create({
        model: env.CLAUDE_MODEL,
        max_tokens: 512,
        system: 'Voce e um analisador de qualificacao BANT para uma joalheria premium. Analise conversas e extraia informacoes de qualificacao em JSON.',
        messages: [
          {
            role: 'user',
            content: `Analise a conversa abaixo e extraia os dados de qualificacao BANT do lead.
Retorne APENAS o JSON, sem texto adicional. Se um campo nao foi mencionado, use null.

BANT para Joalheria:
- need: O que o cliente procura (peca, tipo de joia, ocasiao). Ex: "aliancas de casamento", "anel de noivado com diamante"
- budget: Faixa de orcamento mencionada. Ex: "R$3000-5000", "ate R$2000"
- timeline: Quando precisa (data, prazo, evento). Ex: "marco 2027", "mes que vem", "natal"
- authority: Quem decide a compra. Ex: "casal", "ela mesma", "presente do marido"
- score: Quantidade de campos preenchidos (0 a 4)
- qualificado: true se score >= 3

Formato:
{
  "need": "descricao da necessidade ou null",
  "budget": "faixa de orcamento ou null",
  "timeline": "prazo/data ou null",
  "authority": "quem decide ou null",
  "score": 0,
  "qualificado": false
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

      const parsed = JSON.parse(jsonMatch[0]);

      // Recalcular score para garantir consistencia
      let score = 0;
      if (parsed.need) score++;
      if (parsed.budget) score++;
      if (parsed.timeline) score++;
      if (parsed.authority) score++;

      return {
        need: parsed.need || null,
        budget: parsed.budget || null,
        timeline: parsed.timeline || null,
        authority: parsed.authority || null,
        score,
        qualificado: score >= 3,
      };
    } catch (error) {
      console.error('Erro ao extrair BANT:', error);
      return null;
    }
  }
}
