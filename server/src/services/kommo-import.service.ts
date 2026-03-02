import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { KommoService } from './kommo.service';

const kommoService = new KommoService();

interface ImportLog {
  id: string;
  tipo: string;
  total_esperado: number;
  total_importado: number;
  total_erros: number;
  status: string;
  detalhes: string | null;
  iniciado_em: string | null;
  finalizado_em: string | null;
}

// Pipeline status mapping
const ESTAGIO_MAP: Record<string, string> = {
  // Common Kommo status names
  'incoming leads': 'lead',
  'novo': 'lead',
  'new': 'lead',
  'inicial': 'lead',
  'contatado': 'contatado',
  'contacted': 'contatado',
  'qualificado': 'interessado',
  'qualified': 'interessado',
  'negociacao': 'negociacao',
  'negotiation': 'negociacao',
  'em negociacao': 'negociacao',
  'decision': 'negociacao',
  'ganho': 'vendido',
  'won': 'vendido',
  'closed won': 'vendido',
  'pos-venda': 'pos_venda',
  'pos venda': 'pos_venda',
};

const ESTAGIOS_VALIDOS = ['lead', 'contatado', 'interessado', 'negociacao', 'vendido', 'pos_venda'];

// Map pipeline position to stage
function mapEstagioByPosition(index: number, total: number): string {
  if (total <= 1) return 'lead';
  const ratio = index / (total - 1);
  if (ratio <= 0.1) return 'lead';
  if (ratio <= 0.3) return 'contatado';
  if (ratio <= 0.5) return 'interessado';
  if (ratio <= 0.7) return 'negociacao';
  if (ratio <= 0.9) return 'vendido';
  return 'pos_venda';
}

function isCancelled(importId: string): boolean {
  const db = getDb();
  const log = db.prepare('SELECT status FROM kommo_import_log WHERE id = ?').get(importId) as any;
  return log?.status === 'cancelado';
}

function updateProgress(importId: string, importado: number, erros: number, detalhes?: string) {
  const db = getDb();
  const sets = ['total_importado = ?', 'total_erros = ?'];
  const params: any[] = [importado, erros];
  if (detalhes !== undefined) {
    sets.push('detalhes = ?');
    params.push(detalhes);
  }
  params.push(importId);
  db.prepare(`UPDATE kommo_import_log SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

function finishImport(importId: string, status: 'concluido' | 'erro' | 'cancelado', detalhes?: string) {
  const db = getDb();
  db.prepare(
    `UPDATE kommo_import_log SET status = ?, finalizado_em = datetime('now'), detalhes = COALESCE(?, detalhes) WHERE id = ?`
  ).run(status, detalhes || null, importId);
}

export class KommoImportService {
  criarImportLogs(): { contatosId: string; leadsId: string; notasId: string } {
    const db = getDb();
    const contatosId = uuidv4();
    const leadsId = uuidv4();
    const notasId = uuidv4();

    db.prepare(
      'INSERT INTO kommo_import_log (id, tipo, status) VALUES (?, ?, ?)'
    ).run(contatosId, 'contatos', 'pendente');

    db.prepare(
      'INSERT INTO kommo_import_log (id, tipo, status) VALUES (?, ?, ?)'
    ).run(leadsId, 'leads', 'pendente');

    db.prepare(
      'INSERT INTO kommo_import_log (id, tipo, status) VALUES (?, ?, ?)'
    ).run(notasId, 'notas', 'pendente');

    return { contatosId, leadsId, notasId };
  }

  obterImport(id: string): ImportLog | null {
    const db = getDb();
    return db.prepare('SELECT * FROM kommo_import_log WHERE id = ?').get(id) as ImportLog | null;
  }

  listarImports(): ImportLog[] {
    const db = getDb();
    return db.prepare('SELECT * FROM kommo_import_log ORDER BY criado_em DESC').all() as ImportLog[];
  }

  cancelar(id: string): boolean {
    const db = getDb();
    const log = db.prepare('SELECT status FROM kommo_import_log WHERE id = ?').get(id) as any;
    if (!log || (log.status !== 'pendente' && log.status !== 'rodando')) return false;
    db.prepare("UPDATE kommo_import_log SET status = 'cancelado', finalizado_em = datetime('now') WHERE id = ?").run(id);
    return true;
  }

  async importarTudo(ids: { contatosId: string; leadsId: string; notasId: string }) {
    try {
      await this.importarContatos(ids.contatosId);
      if (!isCancelled(ids.leadsId)) {
        await this.importarLeads(ids.leadsId);
      }
      if (!isCancelled(ids.notasId)) {
        await this.importarNotas(ids.notasId);
      }
    } catch (e: any) {
      console.error('Erro geral na importacao Kommo:', e.message);
    }
  }

  private async importarContatos(importId: string) {
    const db = getDb();
    db.prepare(
      "UPDATE kommo_import_log SET status = 'rodando', iniciado_em = datetime('now') WHERE id = ?"
    ).run(importId);

    let importado = 0;
    let erros = 0;

    try {
      // Get first page to estimate ID range
      const firstPage = await kommoService.fetchContatos(1);
      if (!firstPage?._embedded?.contacts?.length) {
        finishImport(importId, 'concluido', 'Nenhum contato encontrado no Kommo');
        return;
      }

      // Get total from first response
      const totalEsperado = firstPage?._page_count
        ? firstPage._page_count * 250
        : firstPage._embedded.contacts.length;

      db.prepare('UPDATE kommo_import_log SET total_esperado = ? WHERE id = ?').run(totalEsperado, importId);

      // Find min/max IDs from first batch
      const firstContacts = firstPage._embedded.contacts;
      let minId = firstContacts[0].id;
      let maxId = firstContacts[firstContacts.length - 1].id;

      // Process first page
      for (const contato of firstContacts) {
        if (isCancelled(importId)) {
          finishImport(importId, 'cancelado');
          return;
        }
        try {
          this.processarContato(contato);
          importado++;
        } catch (e: any) {
          erros++;
          console.error(`Erro ao importar contato ${contato.id}:`, e.message);
        }
      }
      updateProgress(importId, importado, erros);

      // Iterate remaining pages
      let page = 2;
      let hasMore = (firstPage._links?.next) ? true : false;
      let fetchErrors = 0;

      while (hasMore && page <= 100) {
        if (isCancelled(importId)) {
          finishImport(importId, 'cancelado');
          return;
        }

        let data: any;
        try {
          data = await kommoService.fetchContatos(page);
        } catch (e: any) {
          fetchErrors++;
          console.error(`Erro fetch contatos pag ${page}:`, e.message);
          updateProgress(importId, importado, erros, `Erro na pagina ${page}, tentando proxima...`);
          if (fetchErrors > 5) break; // muitos erros consecutivos, para
          page++;
          continue;
        }
        fetchErrors = 0; // reset on success

        if (!data?._embedded?.contacts?.length) break;

        for (const contato of data._embedded.contacts) {
          if (isCancelled(importId)) {
            finishImport(importId, 'cancelado');
            return;
          }
          try {
            this.processarContato(contato);
            importado++;
          } catch (e: any) {
            erros++;
          }
          if (importado % 250 === 0) {
            updateProgress(importId, importado, erros, `Processando pagina ${page}...`);
          }
        }

        // Track max ID
        const contacts = data._embedded.contacts;
        const lastId = contacts[contacts.length - 1].id;
        if (lastId > maxId) maxId = lastId;

        hasMore = !!data._links?.next;
        page++;
      }

      // If we hit page 100, need to use ID ranges for remaining contacts
      if (page > 100 && hasMore) {
        // Continue fetching with ID filter from after maxId
        let currentIdFrom = maxId + 1;
        const RANGE_SIZE = 25000;

        while (true) {
          if (isCancelled(importId)) {
            finishImport(importId, 'cancelado');
            return;
          }

          let rangePage = 1;
          let rangeHasMore = true;
          let foundAny = false;

          while (rangeHasMore && rangePage <= 100) {
            if (isCancelled(importId)) {
              finishImport(importId, 'cancelado');
              return;
            }

            let data: any;
            try {
              data = await kommoService.fetchContatos(rangePage, currentIdFrom, currentIdFrom + RANGE_SIZE);
            } catch (e: any) {
              console.error(`Erro fetch faixa ${currentIdFrom} pag ${rangePage}:`, e.message);
              break;
            }
            if (!data?._embedded?.contacts?.length) break;

            foundAny = true;
            for (const contato of data._embedded.contacts) {
              try {
                this.processarContato(contato);
                importado++;
              } catch (e: any) {
                erros++;
              }
              if (importado % 250 === 0) {
                updateProgress(importId, importado, erros, `Faixa ID ${currentIdFrom}-${currentIdFrom + RANGE_SIZE}, pag ${rangePage}`);
              }
            }

            rangeHasMore = !!data._links?.next;
            rangePage++;
          }

          if (!foundAny) break;
          currentIdFrom += RANGE_SIZE + 1;
        }
      }

      // Update total with actual count
      db.prepare('UPDATE kommo_import_log SET total_esperado = ? WHERE id = ?').run(importado + erros, importId);
      updateProgress(importId, importado, erros);
      finishImport(importId, 'concluido', `${importado} contatos importados, ${erros} erros`);
    } catch (e: any) {
      updateProgress(importId, importado, erros);
      finishImport(importId, 'erro', e.message);
    }
  }

  private processarContato(contato: any) {
    const db = getDb();

    // Check if already mapped
    const existing = db.prepare(
      "SELECT local_id FROM kommo_mapeamento WHERE tipo = 'contato' AND kommo_id = ?"
    ).get(contato.id) as any;

    if (existing) return;

    const id = uuidv4();
    const nome = contato.name || 'Sem nome';

    // Extract phone and email from custom fields
    let telefone: string | null = null;
    let email: string | null = null;
    const extraFields: string[] = [];

    if (contato.custom_fields_values) {
      for (const field of contato.custom_fields_values) {
        const value = field.values?.[0]?.value;
        if (!value) continue;

        if (field.field_code === 'PHONE' || field.field_name?.toLowerCase()?.includes('phone') || field.field_name?.toLowerCase()?.includes('telefone')) {
          telefone = telefone || String(value);
        } else if (field.field_code === 'EMAIL' || field.field_name?.toLowerCase()?.includes('email')) {
          email = email || String(value);
        } else {
          extraFields.push(`${field.field_name}: ${value}`);
        }
      }
    }

    // Tags
    const tags = contato._embedded?.tags?.map((t: any) => t.name) || [];

    // Notes from extra fields
    const notas = extraFields.length > 0 ? extraFields.join('\n') : null;

    // Created date
    const criadoEm = contato.created_at
      ? new Date(contato.created_at * 1000).toISOString().replace('T', ' ').substring(0, 19)
      : new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(
      `INSERT INTO clientes (id, nome, telefone, email, tags, notas, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, nome, telefone, email, JSON.stringify(tags), notas, criadoEm);

    // Save mapping
    db.prepare(
      'INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), 'contato', contato.id, id);
  }

  private async importarLeads(importId: string) {
    const db = getDb();
    db.prepare(
      "UPDATE kommo_import_log SET status = 'rodando', iniciado_em = datetime('now') WHERE id = ?"
    ).run(importId);

    let importado = 0;
    let erros = 0;

    try {
      // Fetch pipelines for status mapping
      const pipelinesData = await kommoService.fetchPipelines();
      const statusMap = new Map<number, string>();

      if (pipelinesData?._embedded?.pipelines) {
        for (const pipeline of pipelinesData._embedded.pipelines) {
          if (pipeline._embedded?.statuses) {
            const statuses = pipeline._embedded.statuses.sort((a: any, b: any) => a.sort - b.sort);
            for (let i = 0; i < statuses.length; i++) {
              const status = statuses[i];
              const name = (status.name || '').toLowerCase().trim();

              // Try name mapping first
              let estagio = ESTAGIO_MAP[name];
              if (!estagio) {
                // Map by position
                estagio = mapEstagioByPosition(i, statuses.length);
              }
              // Special: Kommo system statuses
              if (status.type === 'win' || status.id === 142) estagio = 'vendido';
              if (status.type === 'lose' || status.id === 143) estagio = 'lead'; // lost leads go back

              statusMap.set(status.id, estagio);
            }
          }
        }
      }

      // Iterate leads pages
      let page = 1;
      let hasMore = true;
      let fetchErrors = 0;

      while (hasMore && page <= 100) {
        if (isCancelled(importId)) {
          finishImport(importId, 'cancelado');
          return;
        }

        let data: any;
        try {
          data = await kommoService.fetchLeads(page);
        } catch (e: any) {
          fetchErrors++;
          console.error(`Erro fetch leads pag ${page}:`, e.message);
          if (fetchErrors > 5) break;
          page++;
          continue;
        }
        fetchErrors = 0;

        if (!data?._embedded?.leads?.length) break;

        if (page === 1) {
          const total = data._page_count ? data._page_count * 250 : data._embedded.leads.length;
          db.prepare('UPDATE kommo_import_log SET total_esperado = ? WHERE id = ?').run(total, importId);
        }

        for (const lead of data._embedded.leads) {
          if (isCancelled(importId)) {
            finishImport(importId, 'cancelado');
            return;
          }
          try {
            this.processarLead(lead, statusMap);
            importado++;
          } catch (e: any) {
            erros++;
          }
          if (importado % 250 === 0) {
            updateProgress(importId, importado, erros, `Processando pagina ${page}...`);
          }
        }

        hasMore = !!data._links?.next;
        page++;
      }

      // Continue with ID ranges if needed (same pattern as contacts)
      if (page > 100 && hasMore) {
        let currentIdFrom = 1;
        const RANGE_SIZE = 25000;
        let rangeAttempts = 0;

        while (rangeAttempts < 20) {
          if (isCancelled(importId)) { finishImport(importId, 'cancelado'); return; }

          let rangePage = 1;
          let foundAny = false;

          while (rangePage <= 100) {
            let data: any;
            try {
              data = await kommoService.fetchLeads(rangePage, currentIdFrom, currentIdFrom + RANGE_SIZE);
            } catch (e: any) {
              console.error(`Erro fetch leads faixa ${currentIdFrom} pag ${rangePage}:`, e.message);
              break;
            }
            if (!data?._embedded?.leads?.length) break;
            foundAny = true;

            for (const lead of data._embedded.leads) {
              try {
                this.processarLead(lead, statusMap);
                importado++;
              } catch (e: any) { erros++; }
            }
            updateProgress(importId, importado, erros);
            if (!data._links?.next) break;
            rangePage++;
          }

          if (!foundAny) break;
          currentIdFrom += RANGE_SIZE + 1;
          rangeAttempts++;
        }
      }

      db.prepare('UPDATE kommo_import_log SET total_esperado = ? WHERE id = ?').run(importado + erros, importId);
      updateProgress(importId, importado, erros);
      finishImport(importId, 'concluido', `${importado} leads importados, ${erros} erros`);
    } catch (e: any) {
      updateProgress(importId, importado, erros);
      finishImport(importId, 'erro', e.message);
    }
  }

  private processarLead(lead: any, statusMap: Map<number, string>) {
    const db = getDb();

    const existing = db.prepare(
      "SELECT local_id FROM kommo_mapeamento WHERE tipo = 'lead' AND kommo_id = ?"
    ).get(lead.id) as any;
    if (existing) return;

    // Find linked contact
    let clienteId: string | null = null;
    const linkedContacts = lead._embedded?.contacts;
    if (linkedContacts?.length) {
      const mapped = db.prepare(
        "SELECT local_id FROM kommo_mapeamento WHERE tipo = 'contato' AND kommo_id = ?"
      ).get(linkedContacts[0].id) as any;
      if (mapped) clienteId = mapped.local_id;
    }

    if (!clienteId) {
      // Create a placeholder client
      clienteId = uuidv4();
      db.prepare(
        `INSERT INTO clientes (id, nome, criado_em, atualizado_em) VALUES (?, ?, datetime('now'), datetime('now'))`
      ).run(clienteId, lead.name || 'Lead sem contato');
    }

    const id = uuidv4();
    const estagio = statusMap.get(lead.status_id) || 'lead';
    const criadoEm = lead.created_at
      ? new Date(lead.created_at * 1000).toISOString().replace('T', ' ').substring(0, 19)
      : new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(
      `INSERT INTO pipeline (id, cliente_id, titulo, valor, estagio, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, clienteId, lead.name || 'Lead Kommo', lead.price || 0, estagio, criadoEm);

    db.prepare(
      'INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), 'lead', lead.id, id);
  }

  private async importarNotas(importId: string) {
    const db = getDb();
    db.prepare(
      "UPDATE kommo_import_log SET status = 'rodando', iniciado_em = datetime('now') WHERE id = ?"
    ).run(importId);

    let importado = 0;
    let erros = 0;

    try {
      // Get all mapped contacts
      const mappedContacts = db.prepare(
        "SELECT kommo_id, local_id FROM kommo_mapeamento WHERE tipo = 'contato'"
      ).all() as any[];

      db.prepare('UPDATE kommo_import_log SET total_esperado = ? WHERE id = ?').run(mappedContacts.length, importId);

      for (const mapped of mappedContacts) {
        if (isCancelled(importId)) {
          finishImport(importId, 'cancelado');
          return;
        }

        try {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const data = await kommoService.fetchNotas('contacts', mapped.kommo_id, page);
            if (!data?._embedded?.notes?.length) break;

            for (const nota of data._embedded.notes) {
              try {
                this.processarNota(nota, mapped.local_id);
                importado++;
              } catch (e: any) {
                erros++;
              }
            }

            hasMore = !!data._links?.next;
            page++;
          }
        } catch (e: any) {
          // Some contacts may not have notes, that's ok
        }

        if (importado % 100 === 0) {
          updateProgress(importId, importado, erros, `Processando notas dos contatos...`);
        }
      }

      updateProgress(importId, importado, erros);
      finishImport(importId, 'concluido', `${importado} notas importadas, ${erros} erros`);
    } catch (e: any) {
      updateProgress(importId, importado, erros);
      finishImport(importId, 'erro', e.message);
    }
  }

  private processarNota(nota: any, clienteId: string) {
    const db = getDb();

    const existing = db.prepare(
      "SELECT local_id FROM kommo_mapeamento WHERE tipo = 'nota' AND kommo_id = ?"
    ).get(nota.id) as any;
    if (existing) return;

    // Map note type
    let tipo: string;
    switch (nota.note_type) {
      case 'call_in':
      case 'call_out':
        tipo = 'ligacao';
        break;
      case 'sms_in':
      case 'sms_out':
        tipo = 'whatsapp';
        break;
      case 'common':
      case 'attachment':
      default:
        tipo = 'nota';
        break;
    }

    const descricao = nota.params?.text || nota.text || nota.params?.uniq || 'Nota importada do Kommo';
    const criadoEm = nota.created_at
      ? new Date(nota.created_at * 1000).toISOString().replace('T', ' ').substring(0, 19)
      : new Date().toISOString().replace('T', ' ').substring(0, 19);

    const id = uuidv4();
    db.prepare(
      `INSERT INTO interacoes (id, cliente_id, tipo, descricao, criado_em)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, clienteId, tipo, descricao, criadoEm);

    db.prepare(
      'INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), 'nota', nota.id, id);
  }
}
