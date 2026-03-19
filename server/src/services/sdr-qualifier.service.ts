import { getDb, saveDb } from '../config/database';
import { calcularLeadScore, classificarLead } from '../utils/lead-score';

export class SdrQualifierService {

  // Listar estagios do funil local
  listarEstagios(): { id: number; nome: string; cor: string; tipo: string }[] {
    const db = getDb();
    return db.prepare(
      'SELECT id, nome, cor, tipo FROM funil_estagios WHERE ativo = 1 ORDER BY ordem ASC'
    ).all() as any[];
  }

  // Qualificar lead: calcular score, salvar, mover no pipeline local
  async qualificarLead(params: {
    telefone: string;
    clienteId?: string;
    pipelineId?: string;
    bant: { budget?: string | null; authority?: string | null; need?: string | null; timeline?: string | null };
    engajamento?: number;
  }): Promise<{ score: number; classificacao: string; movido: boolean }> {
    const { telefone, clienteId, pipelineId, bant, engajamento } = params;

    // Calcular score BANT
    const resultado = calcularLeadScore({
      budget: bant.budget,
      authority: bant.authority,
      need: bant.need,
      timeline: bant.timeline,
      engajamento: engajamento || 0,
    });

    const { total, classificacao, scores } = resultado;

    const db = getDb();

    // Salvar/atualizar na tabela sdr_lead_qualificacao
    const existente = db.prepare(
      'SELECT id FROM sdr_lead_qualificacao WHERE telefone = ?'
    ).get(telefone) as any;

    if (existente) {
      db.prepare(
        `UPDATE sdr_lead_qualificacao SET
          cliente_id = COALESCE(?, cliente_id),
          lead_score = ?, classificacao = ?,
          bant_budget = ?, bant_budget_score = ?,
          bant_authority = ?, bant_authority_score = ?,
          bant_need = ?, bant_need_score = ?,
          bant_timeline = ?, bant_timeline_score = ?,
          ultima_interacao = datetime('now', 'localtime'),
          atualizado_em = datetime('now', 'localtime')
        WHERE id = ?`
      ).run(
        clienteId || null,
        total, classificacao,
        bant.budget || null, scores.budget_score,
        bant.authority || null, scores.authority_score,
        bant.need || null, scores.need_score,
        bant.timeline || null, scores.timeline_score,
        existente.id
      );
    } else {
      db.prepare(
        `INSERT INTO sdr_lead_qualificacao
          (telefone, cliente_id, lead_score, classificacao,
           bant_budget, bant_budget_score, bant_authority, bant_authority_score,
           bant_need, bant_need_score, bant_timeline, bant_timeline_score,
           ultima_interacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`
      ).run(
        telefone, clienteId || null,
        total, classificacao,
        bant.budget || null, scores.budget_score,
        bant.authority || null, scores.authority_score,
        bant.need || null, scores.need_score,
        bant.timeline || null, scores.timeline_score
      );
    }

    // Mover deal no pipeline local baseado na classificacao
    let movido = false;
    if (pipelineId) {
      const estagioAlvo = this.classificacaoParaEstagio(classificacao);
      if (estagioAlvo) {
        db.prepare(
          "UPDATE pipeline SET estagio = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(estagioAlvo, pipelineId);

        // Registrar no historico
        db.prepare(
          `INSERT INTO pipeline_historico (pipeline_id, estagio_novo, automatico, motivo)
           VALUES (?, ?, 1, ?)`
        ).run(pipelineId, estagioAlvo, `Qualificacao BANT: ${classificacao} (score ${total})`);

        movido = true;
        console.log(`[SDR-Qualifier] Deal ${pipelineId} movido para ${estagioAlvo} (${classificacao}, score ${total})`);
      }
    }

    saveDb();
    return { score: total, classificacao, movido };
  }

  // Mapear classificacao BANT para estagio do funil local
  private classificacaoParaEstagio(classificacao: string): string | null {
    switch (classificacao) {
      case 'QUENTE': return 'Interessado';
      case 'MORNO': return 'Contatado';
      case 'FRIO': return 'Lead';
      case 'DESCARTE': return 'Perdido';
      default: return null;
    }
  }

  // Listar leads qualificados
  listarQualificacoes(filtros?: { classificacao?: string; limite?: number }): any[] {
    const db = getDb();
    let sql = 'SELECT * FROM sdr_lead_qualificacao';
    const params: any[] = [];

    if (filtros?.classificacao) {
      sql += ' WHERE classificacao = ?';
      params.push(filtros.classificacao);
    }

    sql += ' ORDER BY atualizado_em DESC';

    if (filtros?.limite) {
      sql += ' LIMIT ?';
      params.push(filtros.limite);
    }

    return db.prepare(sql).all(...params);
  }
}
