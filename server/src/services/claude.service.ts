import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../config/database';
import { getSystemPrompt, getConsultaPrompt, getAjudaCrmPrompt } from '../utils/prompt';
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

// Bloco de conteudo multimodal (texto + imagem) para Claude Vision
export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface MensagemMultimodal {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
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
async function callAnthropic(config: ProviderConfig, system: string, messages: MensagemChat[], maxTokens: number, temperature?: number): Promise<string> {
  if (!anthropicClient || config.api_key !== lastAnthropicKey) {
    anthropicClient = new Anthropic({ apiKey: config.api_key });
    lastAnthropicKey = config.api_key;
  }

  const response = await anthropicClient.messages.create({
    model: config.modelo || 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages,
    ...(temperature !== undefined ? { temperature } : {}),
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

// --- Anthropic com Vision (multimodal) ---
async function callAnthropicVision(config: ProviderConfig, system: string, messages: MensagemMultimodal[], maxTokens: number, temperature?: number): Promise<string> {
  if (!anthropicClient || config.api_key !== lastAnthropicKey) {
    anthropicClient = new Anthropic({ apiKey: config.api_key });
    lastAnthropicKey = config.api_key;
  }

  const response = await anthropicClient.messages.create({
    model: config.modelo || 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: messages as any,
    ...(temperature !== undefined ? { temperature } : {}),
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? (textBlock as any).text : '';
}

// --- OpenAI ---
async function callOpenAI(config: ProviderConfig, system: string, messages: MensagemChat[], maxTokens: number, temperature?: number): Promise<string> {
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
      ...(temperature !== undefined ? { temperature } : {}),
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
async function callGemini(config: ProviderConfig, system: string, messages: MensagemChat[], maxTokens: number, temperature?: number): Promise<string> {
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
      ...(temperature !== undefined ? { temperature } : {}),
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
async function callAI(system: string, messages: MensagemChat[], maxTokens: number = 1024, temperature?: number): Promise<string> {
  const config = getActiveProvider();

  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(config, system, messages, maxTokens, temperature);
    case 'openai':
      return callOpenAI(config, system, messages, maxTokens, temperature);
    case 'gemini':
      return callGemini(config, system, messages, maxTokens, temperature);
    default:
      throw new Error(`Provedor desconhecido: ${config.provider}`);
  }
}

// --- Serviço exportado (mantém interface compatível) ---
export class ClaudeService {
  async enviarMensagem(historico: MensagemChat[]): Promise<string> {
    const systemPrompt = getSystemPrompt();
    // Limpar histórico: extrair apenas "resposta" de mensagens JSON antigas
    const historicoLimpo = historico.map(m => ({
      ...m,
      content: this.limparConteudo(m.content),
    }));
    const respostaRaw = await callAI(systemPrompt, historicoLimpo, 1024);
    return this.extrairResposta(respostaRaw);
  }

  // Extrai campo "resposta" de JSON, retorna texto puro
  private extrairResposta(texto: string): string {
    try {
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.resposta) return parsed.resposta;
      }
    } catch {}
    return texto;
  }

  // Limpa conteúdo JSON salvo anteriormente no histórico
  private limparConteudo(conteudo: string): string {
    try {
      if (conteudo.trimStart().startsWith('{')) {
        const parsed = JSON.parse(conteudo);
        if (parsed.resposta) return parsed.resposta;
      }
    } catch {}
    return conteudo;
  }

  async consultarDara(historico: MensagemChat[]): Promise<string> {
    const systemPrompt = getConsultaPrompt();
    return callAI(systemPrompt, historico, 800);
  }

  async ajudaCrm(historico: MensagemChat[]): Promise<string> {
    const systemPrompt = getAjudaCrmPrompt();
    return callAI(systemPrompt, historico, 800);
  }

  async extrairDados(historico: MensagemChat[]): Promise<Record<string, any> | null> {
    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
      .join('\n');

    try {
      const resposta = await callAI(
        `Voce e um extrator de dados especializado em joalheria. Analise conversas entre clientes e vendedoras de uma joalheria de ouro 18k e extraia TODAS as informacoes estruturadas em JSON.
Seja inteligente: interprete o contexto. Ex: "quero uma alianca pra casar" = ocasiao casamento, tipo aliancas. "parcelo em 3x?" = parcelas 3. "tem desconto a vista?" = cliente perguntando sobre desconto.
Extraia APENAS o que foi CLARAMENTE mencionado ou fortemente implicado. Nao invente dados.`,
        [
          {
            role: 'user',
            content: `Analise a conversa e extraia os dados em JSON. Retorne APENAS o JSON.
Se um campo nao foi mencionado, use null. Para arrays vazios use [].

{
  "nome": "nome completo ou null",
  "telefone": "telefone ou null",
  "email": "email ou null",
  "tipo_interesse": "aliancas|aneis|colares|brincos|pulseiras|escapularios|correntes|tornozeleiras|pingentes|braceletes|piercings|sob_encomenda ou null",
  "material_preferido": "ouro_18k|ouro_branco|ouro_rose ou null",
  "pedra_preferida": "diamante|esmeralda|rubi|safira|nenhuma ou null",
  "orcamento_min": null,
  "orcamento_max": null,
  "ocasiao": "casamento|noivado|presente|aniversario|formatura|uso_pessoal|batizado|nascimento ou null",
  "resumo": "breve resumo do interesse",

  "tipo_pedido": "produto|servico|fabricacao|garantia|multiplos ou null",
  "itens_pedido": ["alianca", "anel"],
  "desconto": "porcentagem ou valor mencionado, ex: '10%' ou 'R$200' ou null",
  "parcelas": null,
  "forma_pagamento": "pix|cartao|dinheiro|transferencia|boleto ou null",
  "valor_frete": null,
  "endereco_entrega": "endereco completo se mencionado ou null",
  "data_prevista_entrega": "data ISO se mencionado ou null",
  "observacao_pedido": "qualquer detalhe especifico sobre o pedido (gravacao, tamanho, personalizacao) ou null",
  "forma_atendimento": "online|presencial|hibrido ou null",
  "tipo_cliente": "primeiro_contato|cliente_base ou null"
}

ITENS VALIDOS para itens_pedido: alianca, anel, corrente, brinco, pulseira, tornozeleira, pingente, bracelete, escapulario, piercing, anel_formatura

CONVERSA:
${conversaTexto}`,
          },
        ],
        800,
      );

      const jsonMatch = resposta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
      return null;
    }
  }

  async enviarMensagemSDR(contexto: SdrRespostaContexto, historico: MensagemChat[], maxTokens?: number, temperature?: number): Promise<{ resposta: string; dados_extraidos: any } | null> {
    const systemPrompt = getSdrRespostaPrompt(contexto);
    try {
      const respostaRaw = await callAI(systemPrompt, historico, maxTokens || 500, temperature);

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

  async simularDara(systemPrompt: string, historico: MensagemChat[], maxTokens: number, temperature?: number): Promise<string> {
    return callAI(systemPrompt, historico, maxTokens, temperature);
  }

  /**
   * Enviar mensagem com suporte a visão (imagens inline).
   * Usa Claude Vision para analisar imagens enviadas pelo cliente.
   */
  async enviarMensagemComVisao(systemPrompt: string, messages: MensagemMultimodal[], maxTokens: number = 1024, temperature?: number): Promise<string> {
    const config = getActiveProvider();
    if (config.provider === 'anthropic') {
      return callAnthropicVision(config, systemPrompt, messages, maxTokens, temperature);
    }
    // Fallback: converter para texto puro para outros provedores
    const textMessages: MensagemChat[] = messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.filter(b => b.type === 'text').map(b => b.text || '').join('\n'),
    }));
    return callAI(systemPrompt, textMessages, maxTokens, temperature);
  }

  async scoringAtendimento(historico: MensagemChat[]): Promise<{
    nota: number;
    pontos_positivos: string[];
    pontos_melhorar: string[];
    detalhes: string[];
  } | null> {
    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Vendedora'}: ${m.content}`)
      .join('\n');

    try {
      const resposta = await callAI(
        'Voce e um avaliador de qualidade de atendimento em joalheria premium. Analise a conversa e de uma nota de 0 a 100 para a vendedora.',
        [
          {
            role: 'user',
            content: `Analise o atendimento da vendedora nesta conversa de joalheria e de uma nota de 0 a 100.
Retorne APENAS o JSON, sem texto adicional.

Criterios de avaliacao (cada um vale ate 20 pontos):
1. Cordialidade e empatia (saudacao, tom amigavel, personalizacao)
2. Coleta de informacoes (perguntar nome, ocasiao, orcamento, preferencias)
3. Conhecimento do produto (explicar materiais, pedras, qualidades)
4. Tecnica de venda (apresentar opcoes, criar urgencia, oferecer alternativas)
5. Fechamento (direcionar para decisao, proximo passo, follow-up)

Formato:
{
  "nota": 75,
  "pontos_positivos": ["foi cordial e atenciosa", "perguntou sobre a ocasiao"],
  "pontos_melhorar": ["nao perguntou o orcamento", "nao ofereceu alternativas"],
  "detalhes": ["Cordialidade: 18/20", "Coleta: 12/20", "Produto: 15/20", "Venda: 15/20", "Fechamento: 15/20"]
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
      return {
        nota: Math.min(100, Math.max(0, parsed.nota || 0)),
        pontos_positivos: parsed.pontos_positivos || [],
        pontos_melhorar: parsed.pontos_melhorar || [],
        detalhes: parsed.detalhes || [],
      };
    } catch (error) {
      console.error('Erro ao gerar scoring:', error);
      return null;
    }
  }

  async extrairBANT(historico: MensagemChat[]): Promise<BANTResult | null> {
    const conversaTexto = historico
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
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
