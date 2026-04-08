import { getDb, saveDb } from '../config/database';
import { ClaudeService, MensagemChat } from './claude.service';
import { EvolutionService } from './evolution.service';
import { markBotSent } from './whatsapp-queue.service';
import { skillService } from './skill.service';

// Estagios locais do SDR (usados para rastrear progresso BANT)
const STAGES = {
  PRIMEIRO_CONTATO: 1,
  QUALIFICACAO: 2,
  QUALIFICADO: 3,
};

const claudeService = new ClaudeService();
const whatsapp = new EvolutionService();

interface LumaResponse {
  resposta: string;
  nome_lead?: string | null;
  estado_novo?: string;
  pontuacao?: {
    total?: number;
    orcamento?: number;
    decisor?: number;
    necessidade?: number;
    prazo?: number;
    bonus?: number;
  };
  classificacao?: string | null;
  campos_bant?: {
    produto?: string | null;
    ocasiao?: string | null;
    orcamento?: string | null;
    prazo?: string | null;
    decisor?: string | null;
  };
  perfil_lido?: string | null;
  tipo_cliente?: string;
  proxima_acao?: string;
  alertas_consultora?: string[];
  data_estrategica?: any;
}

/**
 * Extract clean text from AI response that might be JSON or markdown-wrapped.
 * Used as fallback when JSON parsing fails.
 */
function limparRespostaIA(raw: string): string {
  let text = raw.trim();
  // Remove markdown code blocks
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed.resposta) return String(parsed.resposta).trim();
  } catch { /* not JSON */ }
  // Try to find JSON object in the middle of text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.resposta) return String(parsed.resposta).trim();
    } catch { /* not valid JSON */ }
  }
  // Regex extract resposta from broken/truncated JSON
  if (text.includes('"resposta"')) {
    // Try with double quotes
    const respostaMatch = text.match(/"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (respostaMatch) return respostaMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    // Try capturing everything after "resposta":" until end or next field
    const fallbackMatch = text.match(/"resposta"\s*:\s*"([^"]*)/);
    if (fallbackMatch && fallbackMatch[1].length > 5) {
      return fallbackMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  // Remove any leading JSON fragments like {"resposta": from the text
  text = text.replace(/^\s*\{[^}]*"resposta"\s*:\s*"?/, '').replace(/"\s*,?\s*"?\w+"?\s*:?[^}]*}?\s*$/, '').trim();
  if (text.length > 5) return text;
  return raw.trim();
}

/**
 * Parse Luma agent's structured JSON response.
 */
function parsearRespostaLuma(raw: string): LumaResponse | null {
  let text = raw.trim();
  // Remove markdown code blocks
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed.resposta) return parsed;
  } catch {}
  // Fallback: try to find JSON in the response
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.resposta) return parsed;
    } catch {}
  }
  return null;
}

class SdrService {
  private schemaReady = false;

  /**
   * Ensure new columns exist in kommo_telefone_lead table.
   */
  private ensureSchema(): void {
    if (this.schemaReady) return;
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(kommo_telefone_lead)").all() as any[];
    const colNames = new Set(cols.map((c: any) => c.name));
    const newCols: [string, string][] = [
      ['estado_sdr', "TEXT DEFAULT 'COLETA_NOME'"],
      ['classificacao', 'TEXT DEFAULT NULL'],
      ['score_total', 'INTEGER DEFAULT 0'],
      ['score_orcamento', 'INTEGER DEFAULT 0'],
      ['score_decisor', 'INTEGER DEFAULT 0'],
      ['score_necessidade', 'INTEGER DEFAULT 0'],
      ['score_prazo', 'INTEGER DEFAULT 0'],
      ['score_bonus', 'INTEGER DEFAULT 0'],
      ['bant_produto', 'TEXT DEFAULT NULL'],
      ['bant_ocasiao', 'TEXT DEFAULT NULL'],
      ['bant_decisor', 'TEXT DEFAULT NULL'],
      ['perfil_lido', 'TEXT DEFAULT NULL'],
      ['tipo_cliente', "TEXT DEFAULT 'normal'"],
      ['tentativas_nome', 'INTEGER DEFAULT 0'],
    ];
    for (const [name, type] of newCols) {
      if (!colNames.has(name)) {
        db.exec(`ALTER TABLE kommo_telefone_lead ADD COLUMN ${name} ${type}`);
      }
    }
    saveDb();
    this.schemaReady = true;
  }

  /**
   * Load the active agent prompt from skills or agentes_ia table.
   * Returns the agent prompt or null if no active SDR agent exists (paused).
   */
  private getAgentePrompt(): string | null {
    try {
      const db = getDb();
      // Try SDR-specific agent first
      let agente = db.prepare(
        "SELECT id, prompt_sistema FROM agentes_ia WHERE ativo = 1 AND area = 'sdr' LIMIT 1"
      ).get() as any;

      if (!agente) {
        // Fallback: first active agent
        agente = db.prepare(
          "SELECT id, prompt_sistema FROM agentes_ia WHERE ativo = 1 ORDER BY id ASC LIMIT 1"
        ).get() as any;
      }

      if (!agente) return null;

      // Try skills-based prompt first
      if (skillService.temSkills(agente.id)) {
        const promptFromSkills = skillService.montarPrompt(agente.id);
        if (promptFromSkills) {
          // Inject dynamic product catalog into {{PRODUTOS}} placeholder
          const produtos = this.getProdutosFormatados();
          return promptFromSkills.replace('{{PRODUTOS}}', produtos);
        }
      }

      // Fallback to monolithic prompt
      if (agente.prompt_sistema) {
        return agente.prompt_sistema;
      }
    } catch (err) {
      console.warn('[SDR] Erro ao buscar agente IA:', err);
    }

    return null;
  }

  private getProdutosFormatados(): string {
    try {
      const db = getDb();
      const produtos = db.prepare('SELECT nome, categoria, material, pedra, preco, estoque FROM produtos WHERE ativo = 1').all() as any[];
      return produtos.map((p: any) => {
        let linha = `- ${p.nome} (${p.material})`;
        if (p.pedra) linha += ` com ${p.pedra}`;
        linha += ` - R$ ${p.preco.toFixed(2).replace('.', ',')}`;
        if (p.estoque === 0) linha += ' [Sob encomenda]';
        return linha;
      }).join('\n');
    } catch {
      return '(catalogo indisponivel)';
    }
  }

  private getAgenteNome(): string {
    try {
      const db = getDb();
      let agente = db.prepare(
        "SELECT nome FROM agentes_ia WHERE ativo = 1 AND area = 'sdr' LIMIT 1"
      ).get() as any;
      if (!agente) {
        agente = db.prepare(
          "SELECT nome FROM agentes_ia WHERE ativo = 1 ORDER BY id ASC LIMIT 1"
        ).get() as any;
      }
      return agente?.nome || 'Agente IA';
    } catch {
      return 'Agente IA';
    }
  }

  /**
   * Build the [CONTEXTO DO LEAD] block for Luma prompt injection.
   */
  private buildContextoLead(record: any, rows: any[]): string {
    const ultimasMsgs = rows.slice(-6); // last 3 pairs
    let historicoResumido = 'primeira interacao';
    if (ultimasMsgs.length > 0) {
      historicoResumido = ultimasMsgs
        .map((r: any) => `${r.papel === 'user' ? 'Lead' : 'Agente'}: ${(r.conteudo || '').substring(0, 80)}`)
        .join(' | ');
    }

    return `[CONTEXTO DO LEAD]
Nome: ${record.nome_contato || 'nao coletado'}
Estado: ${record.estado_sdr || 'COLETA_NOME'}
Score atual: ${record.score_total || 0}
Classificacao: ${record.classificacao || 'nao classificado'}
Canal: WhatsApp
Tipo: ${rows.length <= 1 ? 'novo' : 'cliente_existente'}
Tentativas de coleta de nome: ${record.tentativas_nome || 0}
Campos coletados:
  produto: ${record.bant_produto || 'nao coletado'}
  ocasiao: ${record.bant_ocasiao || 'nao coletado'}
  prazo: ${record.bant_timeline || 'nao coletado'}
  orcamento: ${record.bant_budget || 'nao coletado'}
  decisor: ${record.bant_decisor || 'nao coletado'}
Historico resumido: ${historicoResumido}
[FIM DO CONTEXTO]`;
  }

  /**
   * Apply parsed Luma response to update the database record.
   */
  private applyLumaUpdate(parsed: LumaResponse, record: any, phoneNorm: string): void {
    const db = getDb();

    // Compute bant_score (backward compat: count of non-null among produto, ocasiao, prazo, orcamento, decisor, capped at 4)
    const bantFields = [
      parsed.campos_bant?.produto || record.bant_produto,
      parsed.campos_bant?.ocasiao || record.bant_ocasiao,
      parsed.campos_bant?.prazo || record.bant_timeline,
      parsed.campos_bant?.orcamento || record.bant_budget,
      parsed.campos_bant?.decisor || record.bant_decisor,
    ];
    const bantScore = Math.min(bantFields.filter(f => f != null && f !== '').length, 4);

    db.prepare(
      `UPDATE kommo_telefone_lead
       SET estado_sdr = COALESCE(?, estado_sdr),
           classificacao = COALESCE(?, classificacao),
           score_total = COALESCE(?, score_total),
           score_orcamento = COALESCE(?, score_orcamento),
           score_decisor = COALESCE(?, score_decisor),
           score_necessidade = COALESCE(?, score_necessidade),
           score_prazo = COALESCE(?, score_prazo),
           score_bonus = COALESCE(?, score_bonus),
           bant_produto = COALESCE(?, bant_produto),
           bant_ocasiao = COALESCE(?, bant_ocasiao),
           bant_budget = COALESCE(?, bant_budget),
           bant_timeline = COALESCE(?, bant_timeline),
           bant_decisor = COALESCE(?, bant_decisor),
           bant_need = COALESCE(?, bant_need),
           bant_authority = COALESCE(?, bant_authority),
           perfil_lido = COALESCE(?, perfil_lido),
           tipo_cliente = COALESCE(?, tipo_cliente),
           bant_score = ?,
           nome_contato = COALESCE(?, nome_contato),
           atualizado_em = datetime('now', 'localtime')
       WHERE telefone = ?`
    ).run(
      parsed.estado_novo || null,
      parsed.classificacao || null,
      parsed.pontuacao?.total ?? null,
      parsed.pontuacao?.orcamento ?? null,
      parsed.pontuacao?.decisor ?? null,
      parsed.pontuacao?.necessidade ?? null,
      parsed.pontuacao?.prazo ?? null,
      parsed.pontuacao?.bonus ?? null,
      parsed.campos_bant?.produto || null,
      parsed.campos_bant?.ocasiao || null,
      parsed.campos_bant?.orcamento || null,  // bant_budget
      parsed.campos_bant?.prazo || null,       // bant_timeline
      parsed.campos_bant?.decisor || null,     // bant_decisor
      parsed.campos_bant?.produto || null,     // bant_need (backward compat)
      parsed.campos_bant?.decisor || null,     // bant_authority (backward compat)
      parsed.perfil_lido || null,
      parsed.tipo_cliente || null,
      bantScore,
      parsed.nome_lead || null,
      phoneNorm,
    );

    // Increment tentativas_nome if still in COLETA_NOME
    if (parsed.estado_novo === 'COLETA_NOME') {
      db.prepare(
        `UPDATE kommo_telefone_lead SET tentativas_nome = tentativas_nome + 1 WHERE telefone = ?`
      ).run(phoneNorm);
    }

    saveDb();
  }

  /**
   * Process an incoming client response. Returns true if the phone belongs
   * to an active SDR lead (SDR handled it), false otherwise.
   */
  async processarRespostaCliente(telefone: string, texto: string, remoteJid?: string): Promise<boolean> {
    this.ensureSchema();

    // Normalize phone to digits only
    const phoneNorm = telefone.replace(/\D/g, '');

    const db = getDb();
    let record = db.prepare(
      'SELECT * FROM kommo_telefone_lead WHERE telefone = ? AND ativo = 1'
    ).get(phoneNorm) as any;

    if (!record) {
      // Criar registro local para o SDR funcionar
      db.prepare(
        `INSERT OR IGNORE INTO kommo_telefone_lead (telefone, kommo_lead_id, kommo_contact_id, nome_contato, estagio_atual, estado_sdr)
         VALUES (?, 0, 0, ?, 0, 'COLETA_NOME')`
      ).run(phoneNorm, 'Cliente');
      saveDb();
      record = db.prepare('SELECT * FROM kommo_telefone_lead WHERE telefone = ? AND ativo = 1').get(phoneNorm) as any;
      if (!record) return false;
      console.log(`[SDR] Novo atendimento local criado para ${phoneNorm}`);
    }

    // Save user message
    db.prepare(
      `INSERT INTO kommo_sdr_conversas (kommo_lead_id, telefone, papel, conteudo)
       VALUES (?, ?, 'user', ?)`
    ).run(record.kommo_lead_id, phoneNorm, texto);
    saveDb();

    // Load local conversation history
    const rows = db.prepare(
      'SELECT papel, conteudo FROM kommo_sdr_conversas WHERE kommo_lead_id = ? ORDER BY criado_em ASC'
    ).all(record.kommo_lead_id) as any[];

    const historico: MensagemChat[] = [];

    // Build context block for the lead
    const contextoLead = this.buildContextoLead(record, rows);

    // Add local conversation - inject context into the LAST user message
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isLastMessage = i === rows.length - 1;

      if (isLastMessage && r.papel === 'user') {
        // Inject context block before the last user message
        historico.push({
          role: 'user' as const,
          content: `${contextoLead}\n\nMensagem do lead: "${r.conteudo}"`,
        });
      } else {
        historico.push({
          role: r.papel === 'user' ? 'user' as const : 'assistant' as const,
          content: r.conteudo,
        });
      }
    }

    // Check if agent uses multi-agent architecture
    const db2 = getDb();
    let agente = db2.prepare("SELECT id FROM agentes_ia WHERE ativo = 1 AND area = 'sdr' LIMIT 1").get() as any;
    if (!agente) agente = db2.prepare("SELECT id FROM agentes_ia WHERE ativo = 1 ORDER BY id ASC LIMIT 1").get() as any;

    if (!agente) {
      console.log('[SDR] Agente SDR pausado, nao respondendo');
      return false;
    }

    const isMultiAgente = skillService.isMultiAgente(agente.id);
    let respostaTexto = '';
    let lumaResponse: LumaResponse | null = null;

    if (isMultiAgente) {
      // ===== FLUXO MULTI-AGENTE (2 chamadas) =====
      try {
        // CHAMADA 1: Router decide qual sub-agente
        const subAgenteSelecionado = await skillService.routeMessage(
          agente.id, texto, contextoLead, historico
        );
        console.log(`[SDR] Router → Sub-agente: ${subAgenteSelecionado}`);

        // CHAMADA 2: Sub-agente gera resposta
        const produtos = this.getProdutosFormatados();
        const rawResp = await skillService.gerarResposta(
          agente.id, subAgenteSelecionado, historico, contextoLead, produtos
        );

        lumaResponse = parsearRespostaLuma(rawResp);
        if (lumaResponse) {
          respostaTexto = lumaResponse.resposta;
        } else {
          respostaTexto = limparRespostaIA(rawResp);
        }
      } catch (err) {
        console.error('[SDR] Erro no fluxo multi-agente:', err);
        return true;
      }
    } else {
      // ===== FLUXO LEGADO (1 chamada, prompt monolitico) =====
      const agentePrompt = this.getAgentePrompt();
      if (!agentePrompt) {
        console.log('[SDR] Agente SDR pausado, nao respondendo');
        return false;
      }

      try {
        const config = skillService.getAgenteConfig(agente.id);
        const rawResp = await claudeService.simularDara(agentePrompt, historico, config.max_tokens, config.temperatura);
        lumaResponse = parsearRespostaLuma(rawResp);
        if (lumaResponse) {
          respostaTexto = lumaResponse.resposta;
        } else {
          respostaTexto = limparRespostaIA(rawResp);
        }
      } catch (err) {
        console.error('[SDR] Erro ao gerar resposta SDR:', err);
        return true;
      }
    }

    if (!respostaTexto) {
      console.error('[SDR] Resposta SDR vazia');
      return true;
    }

    // Safety: never send raw JSON to the client
    if (respostaTexto.trim().startsWith('{') || respostaTexto.trim().startsWith('[')) {
      console.warn('[SDR] Resposta ainda parece JSON, tentando limpar:', respostaTexto.substring(0, 100));
      respostaTexto = limparRespostaIA(respostaTexto);
    }
    // Final safety: strip any remaining JSON-like prefixes
    if (respostaTexto.trim().startsWith('{') || respostaTexto.trim().startsWith('"resposta"')) {
      // Last resort: extract anything that looks like readable text
      const textoLimpo = respostaTexto.replace(/[{}"]/g, '').replace(/resposta\s*:/gi, '').replace(/,\s*\w+_?\w*\s*:/g, '').trim();
      if (textoLimpo.length > 10) {
        respostaTexto = textoLimpo;
      } else {
        console.error('[SDR] Impossivel extrair texto da resposta JSON, nao enviando');
        return true;
      }
    }

    // Send response via WhatsApp (only the text, not the raw JSON)
    try {
      markBotSent(phoneNorm); // Mark as bot message so we don't trigger human takeover
      await whatsapp.enviarTexto(remoteJid || phoneNorm, respostaTexto);
    } catch (err) {
      console.error(`[SDR] Erro ao enviar resposta WhatsApp para ${phoneNorm}:`, err);
      return true;
    }

    // Save assistant message — store full JSON so Luma keeps state in future turns
    const conteudoParaSalvar = lumaResponse
      ? JSON.stringify(lumaResponse)
      : respostaTexto;
    db.prepare(
      `INSERT INTO kommo_sdr_conversas (kommo_lead_id, telefone, papel, conteudo)
       VALUES (?, ?, 'assistant', ?)`
    ).run(record.kommo_lead_id, phoneNorm, conteudoParaSalvar);
    saveDb();

    // If Luma JSON was parsed successfully, apply all structured updates
    if (lumaResponse) {
      this.applyLumaUpdate(lumaResponse, record, phoneNorm);

      // Nome do lead atualizado localmente via applyLumaUpdate

      // Compute bant_score for stage movement and notes
      const bantFields = [
        lumaResponse.campos_bant?.produto || record.bant_produto,
        lumaResponse.campos_bant?.ocasiao || record.bant_ocasiao,
        lumaResponse.campos_bant?.prazo || record.bant_timeline,
        lumaResponse.campos_bant?.orcamento || record.bant_budget,
        lumaResponse.campos_bant?.decisor || record.bant_decisor,
      ];
      const bantScore = Math.min(bantFields.filter(f => f != null && f !== '').length, 4);

      // Atualizar estagio local baseado no BANT score
      const bantScoreForStage = Math.min(bantFields.filter(f => f != null && f !== '').length, 4);
      if (bantScoreForStage >= 3) {
        db.prepare('UPDATE kommo_telefone_lead SET estagio_atual = ? WHERE telefone = ?').run(STAGES.QUALIFICADO, phoneNorm);
        saveDb();
      } else if (bantScoreForStage >= 2) {
        db.prepare('UPDATE kommo_telefone_lead SET estagio_atual = ? WHERE telefone = ?').run(STAGES.QUALIFICACAO, phoneNorm);
        saveDb();
      }

    } else {
      // Fallback: use separate BANT extraction if JSON parsing failed
      let bantResult: any = null;
      try {
        bantResult = await claudeService.extrairBANT(historico);
      } catch (err) {
        console.warn('[SDR] Erro ao extrair BANT:', err);
      }

      const dados = bantResult || {};
      const bantNeed = dados.need || record.bant_need || null;
      const bantBudget = dados.budget || record.bant_budget || null;
      const bantTimeline = dados.timeline || record.bant_timeline || null;
      const bantAuthority = dados.authority || record.bant_authority || null;

      let bantScore = 0;
      if (bantNeed) bantScore++;
      if (bantBudget) bantScore++;
      if (bantTimeline) bantScore++;
      if (bantAuthority) bantScore++;

      // Update kommo_telefone_lead with BANT fields
      db.prepare(
        `UPDATE kommo_telefone_lead
         SET bant_need = ?, bant_budget = ?, bant_timeline = ?, bant_authority = ?,
             bant_score = ?, atualizado_em = datetime('now', 'localtime')
         WHERE telefone = ?`
      ).run(bantNeed, bantBudget, bantTimeline, bantAuthority, bantScore, phoneNorm);
      saveDb();

      // Atualizar estagio local baseado no BANT score (fallback)
      if (bantScore >= 3) {
        db.prepare('UPDATE kommo_telefone_lead SET estagio_atual = ? WHERE telefone = ?').run(STAGES.QUALIFICADO, phoneNorm);
        saveDb();
      } else if (bantScore >= 2) {
        db.prepare('UPDATE kommo_telefone_lead SET estagio_atual = ? WHERE telefone = ?').run(STAGES.QUALIFICACAO, phoneNorm);
        saveDb();
      }

    }

    return true;
  }

  /**
   * Return stats about the SDR pipeline.
   */
  obterStats(): any {
    const db = getDb();

    try {
      const total = db.prepare(
        'SELECT COUNT(*) as total FROM kommo_telefone_lead'
      ).get() as any;

      const porEstagio = db.prepare(
        'SELECT estagio_atual, COUNT(*) as total FROM kommo_telefone_lead WHERE ativo = 1 GROUP BY estagio_atual'
      ).all() as any[];

      const porBantScore = db.prepare(
        'SELECT bant_score, COUNT(*) as total FROM kommo_telefone_lead WHERE ativo = 1 GROUP BY bant_score'
      ).all() as any[];

      const conversasRecentes = db.prepare(
        "SELECT COUNT(*) as total FROM kommo_sdr_conversas WHERE criado_em > datetime('now', '-24 hours')"
      ).get() as any;

      return {
        total: total?.total || 0,
        por_estagio: porEstagio || [],
        por_bant_score: porBantScore || [],
        conversas_24h: conversasRecentes?.total || 0,
      };
    } catch (err) {
      console.error('[SDR] Erro ao obter stats:', err);
      return {
        total: 0,
        por_estagio: [],
        por_bant_score: [],
        conversas_24h: 0,
      };
    }
  }

  /**
   * Reset all SDR data for a phone number — conversation starts fresh.
   * Called when a lead/card is deleted from the CRM.
   */
  resetarAtendimento(telefone: string): void {
    const phoneNorm = telefone.replace(/\D/g, '');
    const db = getDb();

    // Get the lead_id before deleting
    const record = db.prepare('SELECT kommo_lead_id FROM kommo_telefone_lead WHERE telefone = ?').get(phoneNorm) as any;

    // Delete conversation history
    if (record?.kommo_lead_id) {
      db.prepare('DELETE FROM kommo_sdr_conversas WHERE kommo_lead_id = ?').run(record.kommo_lead_id);
    }
    db.prepare('DELETE FROM kommo_sdr_conversas WHERE telefone = ?').run(phoneNorm);

    // Delete the tracking record
    db.prepare('DELETE FROM kommo_telefone_lead WHERE telefone = ?').run(phoneNorm);

    saveDb();
    console.log(`[SDR] Atendimento resetado para ${phoneNorm}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const sdrService = new SdrService();
export const kommoSdr = sdrService; // backward compat alias
export default sdrService;
