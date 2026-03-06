import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../config/database';
import { getSystemPrompt, getConsultaPrompt } from '../utils/prompt';
import { getSdrRespostaPrompt, SdrRespostaContexto } from '../utils/sdr-prompt';

export interface BANTResult {
  budget: string | null;
  authority: string | null;
  need: string | null;
  timeline: string | null;
  score: number;
  qualificado: boolean;
}

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
}

type Provider = 'anthropic' | 'openai' | 'gemini';

interface ProviderConfig {
  provider: Provider;
  api_key: string;
  modelo: string;
}

// Cache de clients
let anthropicClient: Anthropic | null = null;
let lastAnthropicKey = '';

function getActiveProvider(): ProviderConfig {
  try {
    const db = getDb();

    // Primeiro: provedor explicitamente selecionado pelo usuário
    const selecionado = db.prepare(
      "SELECT provider, api_key, modelo FROM api_keys WHERE selecionado = 1 AND api_key != '' AND ativo = 1"
    ).get() as any;

    if (selecionado) {
      return { provider: selecionado.provider, api_key: selecionado.api_key, modelo: selecionado.modelo };
    }

    // Fallback: prioridade anthropic > openai > gemini
    const configs = db.prepare(
      "SELECT provider, api_key, modelo FROM api_keys WHERE api_key != '' AND ativo = 1 ORDER BY provider"
    ).all() as any[];

    if (configs.length === 0) {
      throw new Error('Nenhuma API de IA configurada. Va em Configuracoes > Chaves de API e adicione pelo menos uma key.');
    }

    const priority: Provider[] = ['anthropic', 'openai', 'gemini'];
    for (const p of priority) {
      const cfg = configs.find((c: any) => c.provider === p);
      if (cfg) return { provider: cfg.provider, api_key: cfg.api_key, modelo: cfg.modelo };
    }

    return { provider: configs[0].provider, api_key: configs[0].api_key, modelo: configs[0].modelo };
  } catch (e: any) {
    if (e.message?.includes('Nenhuma API')) throw e;
    // Fallback para env se banco não estiver pronto
    const key = process.env.CLAUDE_API_KEY;
    if (key) return { provider: 'anthropic', api_key: key, modelo: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6' };
    throw new Error('Nenhuma API de IA configurada. Va em Configuracoes > Chaves de API e adicione pelo menos uma key.');
  }
}

// --- Anthropic ---
async function callAnthropic(config: ProviderConfig, system: string, messages: MensagemChat[], maxTokens: number): Promise<string> {
  if (!anthropicClient || config.api_key !== lastAnthropicKey) {
    anthropicClient = new Anthropic({ apiKey: config.api_key });
    lastAnthropicKey = config.api_key;
  }

  const response = await anthropicClient.messages.create({
    model: config.modelo || 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

// --- OpenAI ---
async function callOpenAI(config: ProviderConfig, system: string, messages: MensagemChat[], maxTokens: number): Promise<string> {
  const apiMessages = [
    { role: 'system' as const, content: system },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelo || 'gpt-4o',
      messages: apiMessages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err: any = await response.json();
    throw new Error(`OpenAI erro: ${err.error?.message || response.statusText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// --- Gemini ---
async function callGemini(config: ProviderConfig, system: string, messages: MensagemChat[], maxTokens: number): Promise<string> {
  const modelo = config.modelo || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${config.api_key}`;

  // Montar contents no formato Gemini
  // Regras Gemini: (1) deve começar com 'user', (2) sem turnos consecutivos do mesmo role
  let rawContents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Garantir que começa com 'user'
  while (rawContents.length > 0 && rawContents[0].role !== 'user') {
    rawContents = rawContents.slice(1);
  }

  // Fundir mensagens consecutivas do mesmo role
  const contents: any[] = [];
  for (const msg of rawContents) {
    const last = contents[contents.length - 1];
    if (last && last.role === msg.role) {
      last.parts[0].text += '\n' + msg.parts[0].text;
    } else {
      contents.push({ ...msg, parts: [{ text: msg.parts[0].text }] });
    }
  }

  // Exigir ao menos 1 mensagem 'user'
  if (contents.length === 0) {
    throw new Error('Gemini: historico de mensagens vazio ou invalido.');
  }

  const body: any = {
    contents,
    // Incluir systemInstruction apenas quando nao-vazio (Gemini rejeita texto vazio)
    ...(system.trim() ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      maxOutputTokens: maxTokens,
      // Desabilitar thinking no gemini-2.5 para nao consumir tokens de raciocinio
      ...(modelo.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err: any = await response.json();
    throw new Error(`Gemini erro: ${err.error?.message || response.statusText}`);
  }

  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// --- Unified call ---
async function callAI(system: string, messages: MensagemChat[], maxTokens: number = 1024): Promise<string> {
  const config = getActiveProvider();

  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(config, system, messages, maxTokens);
    case 'openai':
      return callOpenAI(config, system, messages, maxTokens);
    case 'gemini':
      return callGemini(config, system, messages, maxTokens);
    default:
      throw new Error(`Provedor desconhecido: ${config.provider}`);
  }
}

// --- Serviço exportado (mantém interface compatível) ---
export class ClaudeService {
  async enviarMensagem(historico: MensagemChat[]): Promise<string> {
    const systemPrompt = getSystemPrompt();
    return callAI(systemPrompt, historico, 1024);
  }

  async consultarDara(historico: MensagemChat[]): Promise<string> {
    const systemPrompt = getConsultaPrompt();
    return callAI(systemPrompt, historico, 800);
  }

  async extrairDados(historico: MensagemChat[]): Promise<Record<string, any> | null> {
    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Dara'}: ${m.content}`)
      .join('\n');

    try {
      const resposta = await callAI(
        'Voce e um extrator de dados. Analise conversas e extraia informacoes estruturadas em JSON.',
        [
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
        512,
      );

      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
      return null;
    }
  }

  async enviarMensagemSDR(contexto: SdrRespostaContexto, historico: MensagemChat[]): Promise<{ resposta: string; dados_extraidos: any } | null> {
    const systemPrompt = getSdrRespostaPrompt(contexto);
    try {
      const respostaRaw = await callAI(systemPrompt, historico, 500);

      // Tentar parsear JSON da resposta
      const jsonMatch = respostaRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          resposta: parsed.resposta || respostaRaw,
          dados_extraidos: parsed.dados_extraidos || {},
        };
      }

      // Se nao retornou JSON, usar resposta como texto direto
      return {
        resposta: respostaRaw,
        dados_extraidos: {},
      };
    } catch (error) {
      console.error('[SDR] Erro ao gerar resposta SDR:', error);
      return null;
    }
  }

  async gerarTexto(conteudo: string, maxTokens: number): Promise<string> {
    return callAI('', [{ role: 'user', content: conteudo }], maxTokens);
  }

  async simularDara(systemPrompt: string, historico: MensagemChat[], maxTokens: number): Promise<string> {
    return callAI(systemPrompt, historico, maxTokens);
  }

  async extrairBANT(historico: MensagemChat[]): Promise<BANTResult | null> {
    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Dara'}: ${m.content}`)
      .join('\n');

    try {
      const resposta = await callAI(
        'Voce e um analisador de qualificacao BANT para uma joalheria premium. Analise conversas e extraia informacoes de qualificacao em JSON.',
        [
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
        512,
      );

      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

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
