import { getDb, saveDb } from '../config/database';
import { ClaudeService } from './claude.service';
import { skillService } from './skill.service';

const claudeService = new ClaudeService();

export interface SkillLearning {
  id: number;
  agent_id: number;
  tipo: string;
  descricao: string;
  evidencias: string;
  conteudo_skill: string;
  aprovado: number;
  confianca: number;
  ocorrencias: number;
  criado_em: string;
}

export interface SkillReport {
  id: number;
  agent_id: number;
  tipo: string;
  data_referencia: string;
  conteudo: string;
  metricas: string;
  sugestoes: string;
  criado_em: string;
}

export class SkillLearningService {
  /**
   * Gerar relatorio diario analisando TODAS as conversas do dia.
   */
  async gerarRelatorioDiario(agentId: number): Promise<any> {
    const db = getDb();
    const hoje = new Date().toISOString().split('T')[0];

    // Buscar conversas do dia
    const conversas = db.prepare(`
      SELECT ksc.telefone, ksc.papel, ksc.conteudo, ksc.criado_em,
             ktl.nome_contato, ktl.classificacao, ktl.score_total, ktl.estado_sdr,
             ktl.bant_produto, ktl.bant_ocasiao, ktl.bant_budget, ktl.bant_timeline
      FROM kommo_sdr_conversas ksc
      LEFT JOIN kommo_telefone_lead ktl ON ksc.telefone = ktl.telefone
      WHERE date(ksc.criado_em) = date('now', 'localtime')
      ORDER BY ksc.telefone, ksc.criado_em ASC
    `).all() as any[];

    if (conversas.length === 0) {
      return { resumo: 'Sem conversas hoje', total_conversas: 0 };
    }

    // Agrupar por telefone
    const porTelefone: Record<string, any[]> = {};
    for (const c of conversas) {
      if (!porTelefone[c.telefone]) porTelefone[c.telefone] = [];
      porTelefone[c.telefone].push(c);
    }

    // Buscar ODVs e vendas do dia
    const vendas = db.prepare(`
      SELECT v.*, c.nome as cliente_nome
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE date(v.data_venda) = date('now', 'localtime')
    `).all() as any[];

    const odvsVendidas = db.prepare(`
      SELECT o.*, c.nome as cliente_nome
      FROM pipeline_odvs o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      WHERE o.venda_registrada = 1
      AND date(o.data_venda) = date('now', 'localtime')
    `).all() as any[];

    const odvsPerdidas = db.prepare(`
      SELECT o.*, c.nome as cliente_nome, e.tipo as estagio_tipo
      FROM pipeline_odvs o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      LEFT JOIN pipeline_estagios e ON o.estagio = e.nome
      WHERE e.tipo = 'perdido'
      AND date(o.atualizado_em) = date('now', 'localtime')
    `).all() as any[];

    // Montar resumo das conversas para analise
    const totalTelefones = Object.keys(porTelefone).length;
    const conversasResumo = Object.entries(porTelefone).slice(0, 20).map(([tel, msgs]) => {
      const nome = msgs[0]?.nome_contato || tel;
      const classificacao = msgs[0]?.classificacao || 'N/A';
      const score = msgs[0]?.score_total || 0;
      const resumoMsgs = msgs.map(m => {
        const papel = m.papel === 'user' ? 'Cliente' : 'Luma';
        let conteudo = m.conteudo;
        try {
          const parsed = JSON.parse(conteudo);
          if (parsed.resposta) conteudo = parsed.resposta;
        } catch {}
        return `${papel}: ${conteudo.substring(0, 150)}`;
      }).join('\n');
      return `--- ${nome} (Score: ${score}, Class: ${classificacao}) ---\n${resumoMsgs}`;
    }).join('\n\n');

    // Prompt de analise
    const promptAnalise = `Voce e um analista de vendas da Alisson Joalheria. Analise as conversas do dia e gere um relatorio detalhado.

DADOS DO DIA:
- Total de conversas: ${totalTelefones}
- Vendas fechadas: ${vendas.length + odvsVendidas.length}
- Valor total vendas: R$ ${vendas.reduce((s: number, v: any) => s + (v.valor || 0), 0).toFixed(2)}
- ODVs perdidas: ${odvsPerdidas.length}
${odvsPerdidas.length > 0 ? `- Motivos de perda: ${odvsPerdidas.map((o: any) => o.motivo_perda || 'nao informado').join(', ')}` : ''}

CONVERSAS (amostra):
${conversasResumo}

ANALISE E RETORNE UM JSON:
{
  "resumo": "Resumo executivo de 2-3 frases sobre o dia",
  "vendas_fechadas": {
    "total": ${vendas.length + odvsVendidas.length},
    "valor_total": ${vendas.reduce((s: number, v: any) => s + (v.valor || 0), 0)},
    "insights": "O que funcionou bem nas vendas? Tecnicas que a Luma usou com sucesso?"
  },
  "vendas_perdidas": {
    "total": ${odvsPerdidas.length},
    "motivos": ["motivo1", "motivo2"],
    "melhorias": "O que poderia ter sido feito diferente para nao perder?"
  },
  "objecoes_frequentes": [
    {"tipo": "preco|prazo|indecisao|outro", "frequencia": 0, "exemplo": "frase do cliente", "sugestao_resposta": "como a Luma deveria responder"}
  ],
  "padroes_comportamento": [
    {"padrao": "descricao do padrao", "frequencia": 0, "acao_sugerida": "o que fazer"}
  ],
  "leads_inativos": {
    "total": 0,
    "acao_sugerida": "o que fazer com leads que pararam de responder"
  },
  "taxa_conversao_estimada": "X%",
  "sugestoes_skills": [
    {
      "tipo": "nova_skill|melhoria_skill",
      "skill_id_existente": null,
      "nome": "nome da skill sugerida",
      "categoria": "vendas|tom|qualificacao|etc",
      "descricao": "por que esta skill seria util",
      "conteudo": "texto da instrucao que deve ser adicionada ao prompt da Luma",
      "confianca": 0.8,
      "evidencia": "exemplo especifico da conversa que motivou esta sugestao"
    }
  ],
  "nota_geral": "Nota de 1 a 10 para o desempenho do dia",
  "destaque_positivo": "Melhor momento do dia",
  "ponto_melhoria": "Principal ponto a melhorar"
}

IMPORTANTE: Foque em sugestoes PRATICAS e ACIONAVEIS. Cada sugestao de skill deve ter conteudo pronto para ser adicionado ao prompt da Luma.`;

    let relatorio: any;
    try {
      const resp = await claudeService.simularDara(promptAnalise, [], 2000);
      // Parse JSON
      let text = resp.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        relatorio = JSON.parse(match[0]);
      } else {
        relatorio = JSON.parse(text);
      }
    } catch (err) {
      console.error('[SkillLearning] Erro ao gerar relatorio:', err);
      relatorio = {
        resumo: 'Erro ao gerar relatorio automatico',
        sugestoes_skills: [],
      };
    }

    // Salvar relatorio
    db.prepare(`
      INSERT INTO skill_reports (agent_id, tipo, data_referencia, conteudo, metricas, sugestoes)
      VALUES (?, 'diario', ?, ?, ?, ?)
    `).run(
      agentId,
      hoje,
      JSON.stringify(relatorio),
      JSON.stringify({
        total_conversas: totalTelefones,
        vendas: vendas.length + odvsVendidas.length,
        perdas: odvsPerdidas.length,
        nota: relatorio.nota_geral || null,
      }),
      JSON.stringify(relatorio.sugestoes_skills || []),
    );

    // Criar skill_learnings para cada sugestao
    if (relatorio.sugestoes_skills && Array.isArray(relatorio.sugestoes_skills)) {
      for (const sug of relatorio.sugestoes_skills) {
        db.prepare(`
          INSERT INTO skill_learnings (agent_id, tipo, descricao, evidencias, conteudo_skill, confianca)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          agentId,
          sug.tipo || 'padrao_comportamento',
          sug.descricao || sug.nome || '',
          JSON.stringify({ evidencia: sug.evidencia, categoria: sug.categoria }),
          sug.conteudo || '',
          sug.confianca || 0.5,
        );
      }
    }

    saveDb();
    return relatorio;
  }

  /**
   * Listar relatorios de um agente
   */
  listarRelatorios(agentId: number, limit = 30): SkillReport[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM skill_reports WHERE agent_id = ? ORDER BY data_referencia DESC LIMIT ?'
    ).all(agentId, limit) as SkillReport[];
  }

  /**
   * Listar sugestoes de aprendizado pendentes
   */
  listarSugestoes(agentId: number): SkillLearning[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM skill_learnings WHERE agent_id = ? AND aprovado = 0 ORDER BY confianca DESC, criado_em DESC'
    ).all(agentId) as SkillLearning[];
  }

  /**
   * Listar todas as sugestoes (incluindo aprovadas e rejeitadas)
   */
  listarTodasSugestoes(agentId: number, limit = 50): SkillLearning[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM skill_learnings WHERE agent_id = ? ORDER BY criado_em DESC LIMIT ?'
    ).all(agentId, limit) as SkillLearning[];
  }

  /**
   * Aprovar sugestao → cria skill automaticamente
   */
  aprovarSugestao(learningId: number): number {
    const db = getDb();
    const learning = db.prepare('SELECT * FROM skill_learnings WHERE id = ?').get(learningId) as SkillLearning;
    if (!learning) throw new Error('Sugestao nao encontrada');

    let evidencias: any = {};
    try { evidencias = JSON.parse(learning.evidencias || '{}'); } catch {}

    // Criar skill a partir da sugestao
    const skillId = skillService.criar(learning.agent_id, {
      nome: learning.descricao.substring(0, 80),
      categoria: evidencias.categoria || 'aprendido',
      conteudo: learning.conteudo_skill,
      prioridade: 60,
      icone: 'sparkles',
      origem: 'aprendizado',
    });

    // Marcar como aprovada
    db.prepare("UPDATE skill_learnings SET aprovado = 1, atualizado_em = datetime('now','localtime') WHERE id = ?").run(learningId);
    saveDb();

    return skillId;
  }

  /**
   * Rejeitar sugestao
   */
  rejeitarSugestao(learningId: number): void {
    const db = getDb();
    db.prepare("UPDATE skill_learnings SET aprovado = -1, atualizado_em = datetime('now','localtime') WHERE id = ?").run(learningId);
    saveDb();
  }

  /**
   * Aprovar com edicao - edita o conteudo antes de criar a skill
   */
  aprovarComEdicao(learningId: number, conteudoEditado: string): number {
    const db = getDb();
    // Atualizar conteudo da sugestao
    db.prepare("UPDATE skill_learnings SET conteudo_skill = ? WHERE id = ?").run(conteudoEditado, learningId);
    saveDb();
    // Aprovar normalmente
    return this.aprovarSugestao(learningId);
  }
}

export const skillLearningService = new SkillLearningService();
