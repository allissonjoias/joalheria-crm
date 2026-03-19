import { Request, Response } from 'express';
import { SdrPollingService } from '../services/sdr-polling.service';
import { SdrNotificationService } from '../services/sdr-notification.service';
import { SdrActionEngineService } from '../services/sdr-action-engine.service';
import { SdrQualifierService } from '../services/sdr-qualifier.service';
import { sdrScheduler } from '../services/sdr-scheduler.service';
import { ClaudeService, MensagemChat } from '../services/claude.service';
import { getDb, saveDb } from '../config/database';

const claude = new ClaudeService();

// ─── Helpers de extração BANT ──────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap  = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function detectarNome(historico: any[]): string | null {
  const leadMsgs = historico.filter(m => m.papel === 'lead');
  const textoLead = norm(leadMsgs.map(m => m.conteudo).join(' '));

  // Padrões explícitos
  const padroes = [
    /(?:me chamo|meu nome [eé]|pode me chamar de|aqui [eé] ?[ao]? ?)\s+([a-záàâãéèêíïóôõúüç]{2,20}(?:\s+[a-záàâãéèêíïóôõúüç]{2,20})?)/i,
    /^(?:sou [ao]? ?)\s*([a-záàâãéèêíïóôõúüç]{2,20}(?:\s+[a-záàâãéèêíïóôõúüç]{2,20})?)$/i,
  ];
  for (const p of padroes) {
    const m = textoLead.match(p);
    if (m) return m[1].split(' ').map(cap).join(' ');
  }

  // Resposta curta após pergunta de nome
  const palavrasProibidas = /quero|preciso|tenho|estou|queria|pode|tem|vou|posso|quanto|qual|olha|oi|ola|boa|bom|sim|nao/;
  for (let i = 0; i < historico.length - 1; i++) {
    const atual = historico[i];
    const prox  = historico[i + 1];
    if ((atual.papel === 'dara' || atual.papel === 'assistant') && /com quem|quem eu falo|como posso te chamar|prazer de falar/i.test(atual.conteudo)) {
      if (prox.papel === 'lead') {
        const r = prox.conteudo.trim();
        const palavras = r.split(/\s+/);
        if (palavras.length <= 3 && !palavrasProibidas.test(norm(r)) && r.length >= 2 && r.length <= 30) {
          return r.split(/\s+/).map(cap).join(' ');
        }
      }
    }
  }
  return null;
}

function extrairValorBudget(texto: string): number | null {
  // "3 mil" / "3k" / "tres mil"
  const milMatch = texto.match(/(\d[\d.,]*)\s*(?:mil|k)\b/);
  if (milMatch) return parseFloat(milMatch[1].replace(',', '.')) * 1000;

  // "R$ 3.000" / "R$3000" / "3000 reais" / "uns 4000"
  const numMatch = texto.match(/(?:r\$\s*|orcamento[^0-9]*|gasto[^0-9]*|investimento[^0-9]*|uns?\s+)(\d[\d.]*(?:,\d+)?)/);
  if (numMatch) {
    const n = parseFloat(numMatch[1].replace(/\./g, '').replace(',', '.'));
    if (n >= 50) return n;
  }

  // "3000 reais"
  const reaisMatch = texto.match(/(\d[\d.,]+)\s+reais/);
  if (reaisMatch) return parseFloat(reaisMatch[1].replace(/[.,]/g, ''));

  return null;
}

function ptsBudget(valor: number | null): number {
  if (!valor) return 0;
  if (valor > 5000)  return 30;
  if (valor >= 2000) return 20;
  if (valor >= 1000) return 12;
  if (valor >= 800)  return 6;
  return 0;
}

function diasParaPts(dias: number): number {
  if (dias <= 7)  return 20;
  if (dias <= 15) return 16;
  if (dias <= 30) return 12;
  if (dias <= 60) return 6;
  return 2;
}

// Dias aproximados a partir de março/2026
const MESES_DIAS: Record<string, number> = {
  marco: 15, abril: 45, maio: 75, junho: 106, julho: 136,
  agosto: 167, setembro: 197, outubro: 227, novembro: 258,
  dezembro: 288, janeiro: 319, fevereiro: 350,
};

interface BantScore {
  nome:      string | null;
  need:      string | null;
  budget:    string | null;
  timeline:  string | null;
  authority: string | null;
  pts: { need: number; budget: number; authority: number; timeline: number; bonus: number; total: number };
}

function extrairBantComScore(historico: any[], bantAtual: any): BantScore {
  const leadMsgs  = historico.filter(m => m.papel === 'lead');
  const textoLead = norm(leadMsgs.map(m => m.conteudo).join(' '));
  const textoAll  = norm(historico.map(m => m.conteudo).join(' '));

  const b: any = { ...bantAtual };

  // NOME
  if (!b.nome) b.nome = detectarNome(historico);

  // NEED (0–30)
  let ptsN = 0;
  if (!b.need) {
    if ((textoLead.includes('alianca') || textoLead.includes('par de')) && (textoLead.includes('casamento') || textoLead.includes('noivado'))) {
      b.need = 'aliança de casamento'; ptsN = 30;
    } else if (textoLead.includes('solitario') || textoLead.includes('anel de noivado')) {
      b.need = 'solitário / anel de noivado'; ptsN = 28;
    } else if (textoLead.includes('presente') && /aniversario|natal|dia das maes|dia dos namorados|formatura|debutante/.test(textoLead)) {
      b.need = 'presente com data especial'; ptsN = 25;
    } else if (textoLead.includes('presente')) {
      b.need = 'presente'; ptsN = 20;
    } else if (textoLead.includes('alianca')) {
      b.need = 'aliança'; ptsN = 23;
    } else if (/anel|colar|brinco|pulseira|pingente|gargantilha|relogio|bracelete|corrente/.test(textoLead)) {
      const prod = ['anel','colar','brinco','pulseira','pingente','gargantilha','relogio','bracelete','corrente'].find(p => textoLead.includes(p))!;
      b.need = prod; ptsN = 15;
    } else if (/encomenda|personaliz|sob medida/.test(textoLead)) {
      b.need = 'personalizada / sob encomenda'; ptsN = 14;
    } else if (/reparo|conserto|upgrade/.test(textoLead)) {
      b.need = 'reparo / upgrade'; ptsN = 8;
    } else if (/olhando|conhecer|explorar|ver o que tem/.test(textoLead)) {
      b.need = 'explorando'; ptsN = 5;
    }
  } else {
    // Recalcular pts do need já detectado
    const n = norm(b.need);
    if (n.includes('casamento') || n.includes('par')) ptsN = 30;
    else if (n.includes('solitario') || n.includes('noivado')) ptsN = 28;
    else if (n.includes('com data')) ptsN = 25;
    else if (n.includes('presente')) ptsN = 20;
    else if (n.includes('alianca')) ptsN = 23;
    else if (n.includes('personaliz') || n.includes('encomenda')) ptsN = 14;
    else if (n.includes('reparo') || n.includes('upgrade')) ptsN = 8;
    else if (n.includes('explor')) ptsN = 5;
    else ptsN = 15;
  }

  // BUDGET (0–30)
  let ptsB = 0;
  if (!b.budget) {
    const valor = extrairValorBudget(textoLead);
    if (valor) {
      b.budget = `R$ ${valor >= 1000 ? (valor / 1000).toFixed(valor % 1000 === 0 ? 0 : 1) + 'k' : valor.toFixed(0)}`;
      ptsB = ptsBudget(valor);
    } else {
      // Inferência provisória pelo produto
      if (b.need && /alianca|solitario|noivado/.test(norm(b.need))) ptsB = 12;
      else if (b.need && /brinco/.test(norm(b.need))) ptsB = 6;
    }
  } else {
    const valor = extrairValorBudget(norm(b.budget));
    ptsB = ptsBudget(valor);
    if (!ptsB && b.need) {
      if (/alianca|solitario|noivado/.test(norm(b.need))) ptsB = 12;
      else if (/brinco/.test(norm(b.need))) ptsB = 6;
    }
  }

  // AUTHORITY (0–15)
  let ptsA = 0;
  if (!b.authority) {
    if (/eu mesmo|eu mesma|sou eu|eu decido|decido eu|eu que decido|sozinho|sozinha|so eu/.test(textoLead)) {
      b.authority = 'decide sozinho/a'; ptsA = 15;
    } else if (/casal|juntos|eu e minha|eu e meu|a gente decide|nos dois|vamos decidir/.test(textoLead)) {
      b.authority = 'casal'; ptsA = 10;
    } else if (/precisa consultar|perguntar pra|marido decide|esposa decide|ela decide|ele decide|depende dela|depende dele/.test(textoLead)) {
      b.authority = 'precisa consultar'; ptsA = 5;
    }
  } else {
    const a = norm(b.authority);
    if (/sozinho|proprio/.test(a)) ptsA = 15;
    else if (/casal|junto/.test(a)) ptsA = 10;
    else if (/consultar|terceiro/.test(a)) ptsA = 5;
    else ptsA = 10;
  }

  // TIMELINE (0–20)
  let ptsT = 0;
  if (!b.timeline) {
    if (/urgente|hoje|agora|imediato/.test(textoLead)) {
      b.timeline = 'urgente'; ptsT = 20;
    } else if (/amanha|depois de amanha/.test(textoLead)) {
      b.timeline = 'amanhã'; ptsT = 20;
    } else if (/essa semana|proximos dias|essa semana/.test(textoLead)) {
      b.timeline = 'essa semana'; ptsT = 16;
    } else if (/mes que vem|proximo mes|em 30 dias|em um mes/.test(textoLead)) {
      b.timeline = 'próximo mês'; ptsT = 12;
    } else {
      // Nomes de meses
      const mesEncontrado = Object.keys(MESES_DIAS).find(m => textoLead.includes(m));
      if (mesEncontrado) {
        b.timeline = mesEncontrado;
        ptsT = diasParaPts(MESES_DIAS[mesEncontrado]);
      } else {
        // Data numérica dd/mm
        const dataMatch = textoLead.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        if (dataMatch) {
          b.timeline = dataMatch[0];
          const hoje = new Date();
          const ano = dataMatch[3] ? parseInt(dataMatch[3]) : hoje.getFullYear();
          const alvo = new Date(ano < 100 ? 2000 + ano : ano, parseInt(dataMatch[2]) - 1, parseInt(dataMatch[1]));
          const diff = Math.max(0, Math.floor((alvo.getTime() - hoje.getTime()) / 86400000));
          ptsT = diasParaPts(diff);
        }
        // "daqui X dias/semanas"
        if (!b.timeline) {
          const relativoMatch = textoLead.match(/daqui\s+(\d+)\s+(dias?|semanas?|meses?)/);
          if (relativoMatch) {
            b.timeline = relativoMatch[0];
            const n = parseInt(relativoMatch[1]);
            const unit = relativoMatch[2];
            const dias = unit.startsWith('sem') ? n * 7 : unit.startsWith('mes') ? n * 30 : n;
            ptsT = diasParaPts(dias);
          }
        }
      }
    }
  } else {
    const t = norm(b.timeline);
    if (/urgent|hoje|amanha/.test(t)) ptsT = 20;
    else if (/semana|proximos dias/.test(t)) ptsT = 16;
    else if (/proximo mes|mes que vem/.test(t)) ptsT = 12;
    else {
      const mes = Object.keys(MESES_DIAS).find(m => t.includes(m));
      if (mes) ptsT = diasParaPts(MESES_DIAS[mes]);
      else ptsT = 6;
    }
  }

  // BÔNUS (0–5)
  let bonus = 0;
  if (/indicacao|indicou|falaram de voces|recomend/.test(textoAll)) bonus += 4;
  if (/instagram|insta|site|vi online|vi no feed/.test(textoLead)) bonus += 3;
  if (/data especific|\d{1,2}\/\d{1,2}/.test(textoLead) && /casamento|aniversario/.test(textoLead)) bonus += 3;
  if (/modelo exato|igual esse|como esse|referencia|foto/.test(textoLead)) bonus += 2;
  const ptsBonus = Math.min(5, bonus);

  const total = Math.min(100, ptsN + ptsB + ptsA + ptsT + ptsBonus);

  return {
    nome:      b.nome      || null,
    need:      b.need      || null,
    budget:    b.budget    || null,
    timeline:  b.timeline  || null,
    authority: b.authority || null,
    pts: { need: ptsN, budget: ptsB, authority: ptsA, timeline: ptsT, bonus: ptsBonus, total },
  };
}

function buildContextoBant(bant: any): string {
  const campos: Record<string, any> = {
    nome: bant?.nome, need: bant?.need, budget: bant?.budget,
    timeline: bant?.timeline, authority: bant?.authority,
  };
  const coletados = Object.entries(campos).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const faltando  = Object.entries(campos).filter(([, v]) => !v).map(([k]) => k);

  if (coletados.length === 0) return '';

  return `\n\n[Dados já coletados nesta conversa]\n${coletados.map(c => `• ${c}`).join('\n')}\n[Faltam: ${faltando.join(', ') || 'nenhum'}]`;
}

function getDaraPrompt(): string {
  try {
    const db = getDb();
    const config = db.prepare('SELECT prompt_dara_sdr FROM sdr_agent_config WHERE id = 1').get() as any;
    return config?.prompt_dara_sdr?.trim() || '';
  } catch {
    return '';
  }
}

const polling = new SdrPollingService();
const notificacao = new SdrNotificationService();
const acoes = new SdrActionEngineService();
const qualifier = new SdrQualifierService();

export class SdrAgentController {
  obterConfig(_req: Request, res: Response) {
    try {
      const config = polling.getConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  salvarConfig(req: Request, res: Response) {
    try {
      polling.salvarConfig(req.body);
      // Se mudou config e agente esta rodando, reiniciar
      if (sdrScheduler.isRodando()) {
        sdrScheduler.reiniciar();
      }
      res.json({ ok: true, mensagem: 'Configuracao salva' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  iniciar(_req: Request, res: Response) {
    try {
      const config = polling.getConfig();
      if (!config.telefone_admin) {
        return res.status(400).json({ erro: 'Configure o telefone do admin antes de iniciar' });
      }

      polling.salvarConfig({ ativo: 1 });
      sdrScheduler.iniciar();
      res.json({ ok: true, mensagem: 'Agente SDR iniciado' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  parar(_req: Request, res: Response) {
    try {
      polling.salvarConfig({ ativo: 0 });
      sdrScheduler.parar();
      res.json({ ok: true, mensagem: 'Agente SDR parado' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterStatus(_req: Request, res: Response) {
    try {
      const status = sdrScheduler.obterStatus();
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterLogs(req: Request, res: Response) {
    try {
      const { tipo, limite, offset } = req.query;
      const logs = polling.obterLogs({
        tipo: tipo as string | undefined,
        limite: limite ? parseInt(limite as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterStats(_req: Request, res: Response) {
    try {
      const stats = polling.obterStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async executarPolling(_req: Request, res: Response) {
    try {
      const eventos = await polling.executarPolling();
      if (eventos.length > 0) {
        await notificacao.notificarEventos(eventos);
        await acoes.processarEventos(eventos);
      }
      res.json({ ok: true, eventos_detectados: eventos.length, eventos });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async enviarResumo(req: Request, res: Response) {
    try {
      const tipo = (req.body.tipo as 'manha' | 'tarde') || 'manha';
      const msg = await notificacao.enviarResumo(tipo);
      res.json({ ok: true, mensagem: msg });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async testarNotificacao(_req: Request, res: Response) {
    try {
      await notificacao.testarNotificacao();
      res.json({ ok: true, mensagem: 'Notificacao de teste enviada' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterPromptDara(_req: Request, res: Response) {
    try {
      res.json({ prompt: getDaraPrompt() });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  salvarPromptDara(req: Request, res: Response) {
    try {
      const { prompt } = req.body;
      if (typeof prompt !== 'string') return res.status(400).json({ erro: 'prompt obrigatorio' });
      const db = getDb();
      db.prepare("UPDATE sdr_agent_config SET prompt_dara_sdr = ? WHERE id = 1").run(prompt.trim());
      saveDb();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async simularConversa(req: Request, res: Response) {
    try {
      const { historico, bant } = req.body;

      if (!historico || !Array.isArray(historico)) {
        return res.status(400).json({ erro: 'historico de mensagens obrigatorio' });
      }

      const bantAtual = bant || {};

      // Extrair BANT com scoring ponderado (regex, sem IA)
      const resultado = extrairBantComScore(historico, bantAtual);
      const { pts } = resultado;
      const bant5Completo = !!(resultado.nome && resultado.need && resultado.budget && resultado.timeline && resultado.authority);

      // Pular chamada à IA se transferência já está decidida (economiza tokens)
      let resposta: string;
      if (pts.total >= 80 || bant5Completo) {
        resposta = 'Perfeito! Vou chamar nossa especialista agora mesmo para continuar seu atendimento. Um segundo! 😊';
      } else {
        // Montar system prompt com contexto do BANT atual
        const promptBase = getDaraPrompt();
        const fallback = !promptBase.trim()
          ? 'Voce e uma consultora virtual da Alisson Joias, uma joalheria premium. Seja acolhedora, profissional e consultiva. Faca perguntas para entender a necessidade do cliente (tipo de peca, ocasiao, orcamento, prazo). Responda de forma curta e natural, como no WhatsApp. Nunca invente precos. Se o cliente pedir precos, diga que vai verificar com a consultora. Use emojis com moderacao.'
          : '';
        const systemPrompt = (promptBase || fallback) + buildContextoBant(bantAtual);

        // Janela de histórico: apenas as últimas 8 mensagens para a IA (economia de tokens)
        const mensagensParaIA: MensagemChat[] = historico.slice(-8).map((m: any) => ({
          role: m.papel === 'lead' ? 'user' : 'assistant',
          content: m.conteudo,
        }));

        // Gerar resposta do Agente IA (max_tokens reduzido de 1200 → 512)
        resposta = await claude.simularDara(systemPrompt, mensagensParaIA, 512);

        // Limpar resposta (Gemini às vezes retorna markdown/JSON)
        resposta = resposta.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try {
          const parsed = JSON.parse(resposta);
          if (parsed.resposta) resposta = parsed.resposta;
        } catch { /* não era JSON */ }
      }

      // Transferir se score >= 80, BANT completo, ou agente disse a frase de transicao
      const agenteTransferiu = /nossa especialista|vou chamar|um segundo/i.test(resposta);
      const transferirHumano = pts.total >= 80 || bant5Completo || agenteTransferiu;

      res.json({
        resposta: resposta.trim(),
        bant: {
          nome:      resultado.nome,
          need:      resultado.need,
          budget:    resultado.budget,
          timeline:  resultado.timeline,
          authority: resultado.authority,
        },
        score_breakdown: pts,
        lead_score: pts.total,
        transferir_humano: transferirHumano,
        _debug_prompt_chars: getDaraPrompt().length,
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // ─── Qualificacao Local ─────────────────────────────────────────────

  listarEstagiosFunil(_req: Request, res: Response) {
    try {
      const estagios = qualifier.listarEstagios();
      res.json(estagios);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  listarLeadsQualificados(req: Request, res: Response) {
    try {
      const { classificacao, limite } = req.query;
      const leads = qualifier.listarQualificacoes({
        classificacao: classificacao as string | undefined,
        limite: limite ? parseInt(limite as string) : 50,
      });
      res.json(leads);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
