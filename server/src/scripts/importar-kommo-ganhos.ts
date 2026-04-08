/**
 * Script de importacao de leads GANHOS do Kommo para o CRM local
 *
 * Executa via: npx tsx server/src/scripts/importar-kommo-ganhos.ts
 *
 * Importa: contatos, pipeline (vendido), vendas, notas/interacoes
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ==================== CONFIG ====================

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../data.db');
const DB_WORK_PATH = DB_PATH + '.importing'; // Work file to avoid external overwrites
const MCP_CONFIG_PATH = path.resolve(__dirname, '../../../../kommo-mcp-server/config.json');
const STATUS_GANHO = 142;
const ITEMS_PER_PAGE = 250;
const MIN_INTERVAL_MS = 200; // rate limit: max 5 req/s

// Kommo custom field IDs - Contatos
const FIELD_PHONE = 850482;
const FIELD_EMAIL = 850484;
const FIELD_CPF = 1115979;
const FIELD_DATA_NASCIMENTO = 1096696;
const FIELD_CEP = 1096676;
const FIELD_ENDERECO = 1096678;
const FIELD_NUMERO = 1096680;
const FIELD_COMPLEMENTO = 1096682;
const FIELD_BAIRRO = 1096684;
const FIELD_CIDADE = 1096686;
const FIELD_ESTADO = 1096688;

// Kommo custom field IDs - Leads
const FIELD_ITEM_PEDIDO = 1089266;
const FIELD_ITENS_ESTOQUE = 1089268;
const FIELD_MOTIVO_PERDA = 1091822;
const FIELD_FORMA_ATENDIMENTO = 1091872;
const FIELD_OBSERVACAO = 1093546;
const FIELD_ITENS_FABRICACAO = 1093740;
const FIELD_ITENS_SERVICO = 1093742;
const FIELD_OBS_ITENS = 1093758;
const FIELD_ORIGEM_LEAD_GANHO = 1113580;
const FIELD_VALOR_FRETE_1 = 1116137;
const FIELD_TRANSPORTADOR = 1119445;
const FIELD_PAGAMENTO = 1119481;
const FIELD_CONDICAO = 1119483;
const FIELD_ENDERECO_ENTREGA = 1119497;
const FIELD_DESCONTO = 1119523;
const FIELD_VALOR_FRETE_2 = 1119527;
const FIELD_DATA_PREVISTA = 1119535;
const FIELD_OBSERVACOES = 1119537;
const FIELD_DATA_ENVIO = 1119541;
const FIELD_TIPO_CONTATO = 1103571;
const FIELD_ATENDENTE = 1121476;

// ==================== DB HELPERS ====================

let rawDb: SqlJsDatabase;

function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dbRun(sql: string, params: any[] = []) {
  try {
    rawDb.run(sql, params);
  } catch (e: any) {
    console.error(`[DB ERROR] ${sql}`, params, e.message);
  }
}

function dbGet(sql: string, params: any[] = []): any {
  const stmt = rawDb.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let result: any = undefined;
  if (stmt.step()) result = stmt.getAsObject();
  stmt.free();
  return result;
}

function dbAll(sql: string, params: any[] = []): any[] {
  const stmt = rawDb.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

let saveCount = 0;
function saveDb() {
  saveCount++;
  const data = rawDb.export();
  const buffer = Buffer.from(data);
  // Save to work file (not data.db) to avoid external overwrites
  fs.writeFileSync(DB_WORK_PATH, buffer);
}

// ==================== KOMMO API ====================

let accessToken = '';
let subdomain = 'alissonjoiass';
let lastRequestTime = 0;

async function kommoGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  // Rate limit
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();

  const url = new URL(`https://${subdomain}.kommo.com/api/v4${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '3', 10);
        console.log(`  Rate limit, aguardando ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (res.status === 204) return null;
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
      }
      return res.json();
    } catch (e: any) {
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`  Retry ${attempt + 1}/3 em ${delay}ms: ${e.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
}

// ==================== FIELD EXTRACTION ====================

function getFieldValue(customFields: any[], fieldId: number): string | null {
  if (!customFields) return null;
  const field = customFields.find((f: any) => f.field_id === fieldId);
  if (!field?.values?.[0]) return null;
  return String(field.values[0].value ?? field.values[0].enum ?? '');
}

function getFieldEnumText(customFields: any[], fieldId: number): string | null {
  if (!customFields) return null;
  const field = customFields.find((f: any) => f.field_id === fieldId);
  if (!field?.values?.[0]) return null;
  // For select/multiselect, the value might be the enum text or we need enum
  return field.values[0].value != null ? String(field.values[0].value) : null;
}

function getMultiSelectValues(customFields: any[], fieldId: number): string[] {
  if (!customFields) return [];
  const field = customFields.find((f: any) => f.field_id === fieldId);
  if (!field?.values) return [];
  return field.values.map((v: any) => String(v.value ?? v.enum ?? '')).filter(Boolean);
}

function getSmartAddressValue(customFields: any[], fieldId: number): string | null {
  if (!customFields) return null;
  const field = customFields.find((f: any) => f.field_id === fieldId);
  if (!field?.values) return null;
  // smart_address has subfields: address_line_1, city, state, zip, country
  const parts = field.values.map((v: any) => {
    const subvals: string[] = [];
    if (v.value) {
      // Try to get structured address
      if (typeof v.value === 'object') {
        const addr = v.value;
        if (addr.address_line_1) subvals.push(addr.address_line_1);
        if (addr.address_line_2) subvals.push(addr.address_line_2);
        if (addr.city) subvals.push(addr.city);
        if (addr.state) subvals.push(addr.state);
        if (addr.zip) subvals.push(addr.zip);
      } else {
        subvals.push(String(v.value));
      }
    }
    return subvals.join(', ');
  });
  return parts.filter(Boolean).join(' | ') || null;
}

function getPhoneFromContact(customFields: any[]): string | null {
  if (!customFields) return null;
  // Phone field is multitext with code PHONE or field_id 850482
  const phoneField = customFields.find((f: any) =>
    f.field_id === FIELD_PHONE ||
    f.field_code === 'PHONE' ||
    (f.field_name && /phone|telefone/i.test(f.field_name))
  );
  if (!phoneField?.values?.[0]) return null;
  return String(phoneField.values[0].value || '');
}

function getEmailFromContact(customFields: any[]): string | null {
  if (!customFields) return null;
  const emailField = customFields.find((f: any) =>
    f.field_id === FIELD_EMAIL ||
    f.field_code === 'EMAIL' ||
    (f.field_name && /email/i.test(f.field_name))
  );
  if (!emailField?.values?.[0]) return null;
  return String(emailField.values[0].value || '');
}

function unixToLocal(ts: number | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ==================== IMPORT LOGIC ====================

interface ImportStats {
  totalLeads: number;
  clientesImportados: number;
  pipelineImportados: number;
  vendasImportadas: number;
  notasImportadas: number;
  erros: number;
  jaExistentes: number;
}

// Pipeline IDs from Kommo
const PIPELINE_IDS = [6641943, 6755107, 12831255]; // Funil De Vendas, Pos-venda, Qualificacao

async function fetchAllGanhos(): Promise<any[]> {
  const allLeads: any[] = [];

  console.log('\n[1/4] Buscando leads ganhos do Kommo...');

  for (const pipelineId of PIPELINE_IDS) {
    let page = 1;
    console.log(`\n  Pipeline ${pipelineId}:`);

    while (true) {
      const params: Record<string, string> = {
        'filter[statuses][0][pipeline_id]': String(pipelineId),
        'filter[statuses][0][status_id]': String(STATUS_GANHO),
        'with': 'contacts',
        'limit': String(ITEMS_PER_PAGE),
        'page': String(page),
      };

      const data = await kommoGet('/leads', params);
      if (!data?._embedded?.leads?.length) break;

      const leads = data._embedded.leads;
      // Double-check status_id filter client-side
      const ganhos = leads.filter((l: any) => l.status_id === STATUS_GANHO);
      allLeads.push(...ganhos);
      console.log(`    Pagina ${page}: ${ganhos.length} ganhos de ${leads.length} leads (total: ${allLeads.length})`);

      if (leads.length < ITEMS_PER_PAGE) break;
      page++;
    }
  }

  console.log(`\n  Total de leads ganhos encontrados: ${allLeads.length}`);
  return allLeads;
}

async function fetchContactDetails(contactId: number): Promise<any> {
  try {
    return await kommoGet(`/contacts/${contactId}`);
  } catch (e: any) {
    console.error(`  Erro ao buscar contato ${contactId}: ${e.message}`);
    return null;
  }
}

async function fetchLeadNotes(leadId: number): Promise<any[]> {
  const allNotes: any[] = [];
  let page = 1;

  while (true) {
    try {
      const data = await kommoGet(`/leads/${leadId}/notes`, {
        page: String(page),
        limit: '250',
      });
      if (!data?._embedded?.notes?.length) break;
      allNotes.push(...data._embedded.notes);
      if (data._embedded.notes.length < 250) break;
      page++;
    } catch {
      break;
    }
  }

  return allNotes;
}

async function fetchContactNotes(contactId: number): Promise<any[]> {
  const allNotes: any[] = [];
  let page = 1;

  while (true) {
    try {
      const data = await kommoGet(`/contacts/${contactId}/notes`, {
        page: String(page),
        limit: '250',
      });
      if (!data?._embedded?.notes?.length) break;
      allNotes.push(...data._embedded.notes);
      if (data._embedded.notes.length < 250) break;
      page++;
    } catch {
      break;
    }
  }

  return allNotes;
}

function importarContato(contact: any): string {
  const cf = contact.custom_fields_values || [];

  const clienteId = uuidv4();
  const nome = contact.name || 'Sem nome';
  const telefone = getPhoneFromContact(cf);
  const email = getEmailFromContact(cf);
  const cpf = getFieldValue(cf, FIELD_CPF);
  const dataNascimento = getFieldValue(cf, FIELD_DATA_NASCIMENTO);
  const cep = getFieldValue(cf, FIELD_CEP);
  const endereco = getFieldValue(cf, FIELD_ENDERECO);
  const numero = getFieldValue(cf, FIELD_NUMERO);
  const complemento = getFieldValue(cf, FIELD_COMPLEMENTO);
  const bairro = getFieldValue(cf, FIELD_BAIRRO);
  const cidade = getFieldValue(cf, FIELD_CIDADE);
  const estado = getFieldEnumText(cf, FIELD_ESTADO);

  const tags = contact._embedded?.tags?.map((t: any) => t.name) || [];
  const criadoEm = unixToLocal(contact.created_at) || localNow();

  dbRun(
    `INSERT INTO clientes (id, nome, telefone, email, cpf, data_nascimento, cep, endereco, numero_endereco, complemento, bairro, cidade, estado, tags, origem, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [clienteId, nome, telefone, email, cpf, dataNascimento, cep, endereco, numero, complemento, bairro, cidade, estado, JSON.stringify(tags), 'kommo_ganho', criadoEm, localNow()]
  );

  // Mapeamento para deduplicacao
  dbRun(
    `INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id, criado_em) VALUES (?, 'contato', ?, ?, ?)`,
    [uuidv4(), contact.id, clienteId, localNow()]
  );

  return clienteId;
}

function importarPipeline(lead: any, clienteId: string): string {
  const cf = lead.custom_fields_values || [];
  const pipelineId = uuidv4();

  const titulo = lead.name || 'Lead Kommo';
  const valor = (lead.price || 0) / 1; // Kommo price is already in BRL units
  const criadoEm = unixToLocal(lead.created_at) || localNow();

  // Extract lead custom fields
  const tipoPedido = getFieldEnumText(cf, FIELD_ITEM_PEDIDO);
  const itensEstoque = getMultiSelectValues(cf, FIELD_ITENS_ESTOQUE);
  const itensFabricacao = getMultiSelectValues(cf, FIELD_ITENS_FABRICACAO);
  const itensServico = getMultiSelectValues(cf, FIELD_ITENS_SERVICO);
  const formaPagamento = getFieldEnumText(cf, FIELD_PAGAMENTO);
  const parcelas = getFieldEnumText(cf, FIELD_CONDICAO);
  const valorFrete = getFieldValue(cf, FIELD_VALOR_FRETE_1) || getFieldValue(cf, FIELD_VALOR_FRETE_2);
  const transportador = getFieldEnumText(cf, FIELD_TRANSPORTADOR);
  const enderecoEntrega = getSmartAddressValue(cf, FIELD_ENDERECO_ENTREGA);
  const dataPrevista = getFieldValue(cf, FIELD_DATA_PREVISTA);
  const dataEnvio = getFieldValue(cf, FIELD_DATA_ENVIO);
  const observacao = getFieldValue(cf, FIELD_OBSERVACOES) || getFieldValue(cf, FIELD_OBSERVACAO);
  const obsItens = getFieldValue(cf, FIELD_OBS_ITENS);
  const origemLead = getFieldEnumText(cf, FIELD_ORIGEM_LEAD_GANHO);
  const formaAtendimento = getFieldEnumText(cf, FIELD_FORMA_ATENDIMENTO);
  const desconto = getFieldEnumText(cf, FIELD_DESCONTO);

  // Combine all items into one JSON
  const todosItens = [
    ...itensEstoque.map(i => ({ tipo: 'estoque', item: i })),
    ...itensFabricacao.map(i => ({ tipo: 'fabricacao', item: i })),
    ...itensServico.map(i => ({ tipo: 'servico', item: i })),
  ];

  const tags = lead._embedded?.tags?.map((t: any) => t.name) || [];
  const notas = [observacao, obsItens].filter(Boolean).join(' | ');

  // Parse parcelas number
  const numParcelas = parcelas ? parseInt(parcelas.replace(/[^\d]/g, '')) || null : null;

  dbRun(
    `INSERT INTO pipeline (id, cliente_id, titulo, valor, estagio, tipo_pedido, itens_pedido, forma_pagamento, parcelas, valor_frete, transportador, endereco_entrega, data_prevista_entrega, data_envio, observacao_pedido, origem_lead, forma_atendimento, desconto, tags, notas, funil_id, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, 'vendido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      pipelineId, clienteId, titulo, valor,
      tipoPedido,
      todosItens.length > 0 ? JSON.stringify(todosItens) : '[]',
      formaPagamento, numParcelas,
      valorFrete ? parseFloat(valorFrete) : null,
      transportador, enderecoEntrega,
      dataPrevista, dataEnvio,
      notas || null,
      origemLead, formaAtendimento, desconto,
      JSON.stringify(tags),
      notas || null,
      criadoEm, localNow(),
    ]
  );

  // Mapeamento
  dbRun(
    `INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id, criado_em) VALUES (?, 'lead', ?, ?, ?)`,
    [uuidv4(), lead.id, pipelineId, localNow()]
  );

  return pipelineId;
}

function importarVenda(lead: any, clienteId: string, pipelineId: string) {
  const cf = lead.custom_fields_values || [];
  const vendaId = uuidv4();

  const valor = lead.price || 0;
  const formaPagamento = getFieldEnumText(cf, FIELD_PAGAMENTO);
  const parcelas = getFieldEnumText(cf, FIELD_CONDICAO);
  const numParcelas = parcelas ? parseInt(parcelas.replace(/[^\d]/g, '')) || 1 : 1;

  // Map Kommo payment to local payment method
  let metodoPagamento: string | null = null;
  if (formaPagamento) {
    const fp = formaPagamento.toLowerCase();
    if (fp.includes('pix')) metodoPagamento = 'pix';
    else if (fp.includes('credito') || fp.includes('crédito')) metodoPagamento = 'cartao_credito';
    else if (fp.includes('debito') || fp.includes('débito')) metodoPagamento = 'cartao_debito';
    else if (fp.includes('dinheiro')) metodoPagamento = 'dinheiro';
    else if (fp.includes('transfer')) metodoPagamento = 'transferencia';
    else if (numParcelas > 1) metodoPagamento = 'parcelado';
  }

  const dataVenda = unixToLocal(lead.closed_at) || unixToLocal(lead.updated_at) || localNow();

  dbRun(
    `INSERT INTO vendas (id, cliente_id, pipeline_id, valor, metodo_pagamento, parcelas, data_venda, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [vendaId, clienteId, pipelineId, valor, metodoPagamento, numParcelas, dataVenda, localNow()]
  );
}

function importarNotas(notes: any[], clienteId: string) {
  let count = 0;
  for (const nota of notes) {
    // Check dedup
    const existing = dbGet(
      `SELECT local_id FROM kommo_mapeamento WHERE tipo = 'nota' AND kommo_id = ?`,
      [nota.id]
    );
    if (existing) continue;

    const texto = nota.params?.text || nota.text || nota.params?.uniq || 'Nota importada do Kommo';
    let tipo = 'nota';
    if (nota.note_type === 'call_in' || nota.note_type === 'call_out') tipo = 'ligacao';
    else if (nota.note_type === 'sms_in' || nota.note_type === 'sms_out') tipo = 'whatsapp';

    const criadoEm = unixToLocal(nota.created_at) || localNow();
    const interacaoId = uuidv4();

    dbRun(
      `INSERT INTO interacoes (id, cliente_id, tipo, descricao, criado_em) VALUES (?, ?, ?, ?, ?)`,
      [interacaoId, clienteId, tipo, texto, criadoEm]
    );

    dbRun(
      `INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id, criado_em) VALUES (?, 'nota', ?, ?, ?)`,
      [uuidv4(), nota.id, interacaoId, localNow()]
    );

    count++;
  }
  return count;
}

// ==================== MAIN ====================

async function main() {
  console.log('==============================================');
  console.log('  IMPORTACAO KOMMO → CRM (Leads Ganhos)');
  console.log('==============================================');
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Inicio: ${localNow()}\n`);

  const startTime = Date.now();

  // 1. Abrir banco
  if (!fs.existsSync(DB_PATH)) {
    console.error('ERRO: Banco de dados nao encontrado em', DB_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  rawDb = new SQL.Database(buffer);
  console.log('  Banco SQLite aberto com sucesso.\n');

  // 2. Criar tabela kommo_mapeamento se nao existir
  try {
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS kommo_mapeamento (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        kommo_id INTEGER NOT NULL,
        local_id TEXT NOT NULL,
        criado_em TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_kommo_map ON kommo_mapeamento(tipo, kommo_id);
    `);
    saveDb();
    console.log('  Tabela kommo_mapeamento verificada/criada.\n');
  } catch (e: any) {
    // Index may already exist
    if (!e.message?.includes('already exists')) {
      console.error('Aviso tabela:', e.message);
    }
  }

  // 3. Obter tokens do MCP config
  if (!fs.existsSync(MCP_CONFIG_PATH)) {
    console.error('ERRO: Config do Kommo MCP nao encontrado em', MCP_CONFIG_PATH);
    process.exit(1);
  }
  const mcpConfig = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf-8'));
  accessToken = mcpConfig.access_token;
  subdomain = mcpConfig.subdomain || 'alissonjoiass';
  console.log(`  Kommo subdomain: ${subdomain}`);
  console.log(`  Token encontrado: ${accessToken.substring(0, 20)}...`);
  console.log(`  Token expira em: ${mcpConfig.token_expires_at}`);

  // 3. Buscar todos os leads ganhos
  const leads = await fetchAllGanhos();
  if (leads.length === 0) {
    console.log('\nNenhum lead ganho encontrado. Finalizando.');
    process.exit(0);
  }

  const stats: ImportStats = {
    totalLeads: leads.length,
    clientesImportados: 0,
    pipelineImportados: 0,
    vendasImportadas: 0,
    notasImportadas: 0,
    erros: 0,
    jaExistentes: 0,
  };

  // 4. Processar cada lead
  console.log('\n[2/4] Importando leads ganhos...\n');

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const leadName = lead.name || `Lead #${lead.id}`;

    try {
      // Check dedup
      const existingLead = dbGet(
        `SELECT local_id FROM kommo_mapeamento WHERE tipo = 'lead' AND kommo_id = ?`,
        [lead.id]
      );
      if (existingLead) {
        stats.jaExistentes++;
        continue;
      }

      // Get contact
      let clienteId: string;
      const contactKommoId = lead._embedded?.contacts?.[0]?.id;

      if (contactKommoId) {
        // Check if contact already imported
        const existingContact = dbGet(
          `SELECT local_id FROM kommo_mapeamento WHERE tipo = 'contato' AND kommo_id = ?`,
          [contactKommoId]
        );

        if (existingContact) {
          clienteId = existingContact.local_id;
        } else {
          // Fetch full contact details
          const contact = await fetchContactDetails(contactKommoId);
          if (contact) {
            clienteId = importarContato(contact);
            stats.clientesImportados++;
          } else {
            // Create placeholder
            clienteId = uuidv4();
            dbRun(
              `INSERT INTO clientes (id, nome, origem, criado_em, atualizado_em) VALUES (?, ?, 'kommo_ganho', ?, ?)`,
              [clienteId, leadName, localNow(), localNow()]
            );
            stats.clientesImportados++;
          }
        }
      } else {
        // No contact linked, create placeholder
        clienteId = uuidv4();
        dbRun(
          `INSERT INTO clientes (id, nome, origem, criado_em, atualizado_em) VALUES (?, ?, 'kommo_ganho', ?, ?)`,
          [clienteId, leadName, localNow(), localNow()]
        );
        stats.clientesImportados++;
      }

      // Import pipeline (deal)
      const pipelineId = importarPipeline(lead, clienteId);
      stats.pipelineImportados++;

      // Import venda (if has value)
      if (lead.price > 0) {
        importarVenda(lead, clienteId, pipelineId);
        stats.vendasImportadas++;
      }

      // Progress log every 10 leads
      if ((i + 1) % 10 === 0 || i === leads.length - 1) {
        console.log(`  [${i + 1}/${leads.length}] ${leadName} — R$ ${(lead.price || 0).toLocaleString('pt-BR')}`);
        saveDb();
      }
    } catch (e: any) {
      stats.erros++;
      console.error(`  ERRO lead ${leadName} (${lead.id}): ${e.message}`);
    }
  }

  // 5. Import notes
  console.log('\n[3/4] Importando notas e historico...\n');

  const mappedLeads = dbAll(`SELECT kommo_id, local_id FROM kommo_mapeamento WHERE tipo = 'lead'`);

  for (let i = 0; i < mappedLeads.length; i++) {
    const mapping = mappedLeads[i];
    try {
      // Get clienteId from pipeline
      const pipeline = dbGet(`SELECT cliente_id FROM pipeline WHERE id = ?`, [mapping.local_id]);
      if (!pipeline) continue;

      // Fetch notes for this lead
      const leadNotes = await fetchLeadNotes(mapping.kommo_id);
      const count = importarNotas(leadNotes, pipeline.cliente_id);
      stats.notasImportadas += count;

      if ((i + 1) % 20 === 0 || i === mappedLeads.length - 1) {
        console.log(`  Notas: [${i + 1}/${mappedLeads.length}] ${count} notas importadas`);
        saveDb();
      }
    } catch (e: any) {
      console.error(`  Erro notas lead ${mapping.kommo_id}: ${e.message}`);
    }
  }

  // Also import contact notes
  console.log('\n[4/4] Importando notas dos contatos...\n');

  const mappedContacts = dbAll(`SELECT kommo_id, local_id FROM kommo_mapeamento WHERE tipo = 'contato'`);

  for (let i = 0; i < mappedContacts.length; i++) {
    const mapping = mappedContacts[i];
    try {
      const contactNotes = await fetchContactNotes(mapping.kommo_id);
      const count = importarNotas(contactNotes, mapping.local_id);
      stats.notasImportadas += count;

      if ((i + 1) % 20 === 0 || i === mappedContacts.length - 1) {
        console.log(`  Notas contatos: [${i + 1}/${mappedContacts.length}] ${count} notas`);
        saveDb();
      }
    } catch (e: any) {
      // Silently skip contact note errors
    }
  }

  // Final save
  saveDb();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final save to work file
  saveDb();

  // Now copy work file to data.db (the actual database)
  console.log('\n  Copiando banco final para data.db...');
  fs.copyFileSync(DB_WORK_PATH, DB_PATH);
  // Also keep a backup
  fs.copyFileSync(DB_WORK_PATH, DB_PATH + '.final');
  // Remove work file
  fs.unlinkSync(DB_WORK_PATH);

  // Verify data is in memory before exiting
  console.log('\n=== VERIFICACAO PRE-SAIDA ===');
  const hasTable = dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='kommo_mapeamento'");
  console.log(`  kommo_mapeamento existe: ${hasTable ? 'SIM' : 'NAO'}`);
  const cKommo = dbGet("SELECT COUNT(*) as t FROM clientes WHERE origem = 'kommo_ganho'");
  console.log(`  Clientes kommo_ganho: ${cKommo?.t}`);
  const pVendidos = dbGet("SELECT COUNT(*) as t FROM pipeline WHERE estagio = 'vendido'");
  console.log(`  Pipeline vendidos: ${pVendidos?.t}`);
  const vTotal = dbGet("SELECT COUNT(*) as t FROM vendas");
  console.log(`  Vendas total: ${vTotal?.t}`);
  const iTotal = dbGet("SELECT COUNT(*) as t FROM interacoes");
  console.log(`  Interacoes total: ${iTotal?.t}`);
  const dbSize = fs.statSync(DB_PATH).size;
  console.log(`  Tamanho data.db: ${(dbSize / 1024 / 1024).toFixed(1)} MB`);
  const bakSize = fs.existsSync(DB_PATH + '.final') ? fs.statSync(DB_PATH + '.final').size : 0;
  console.log(`  Tamanho data.db.final: ${(bakSize / 1024 / 1024).toFixed(1)} MB`);

  console.log('\n==============================================');
  console.log('  IMPORTACAO CONCLUIDA!');
  console.log('==============================================');
  console.log(`  Tempo total: ${elapsed}s`);
  console.log(`  Leads processados: ${stats.totalLeads}`);
  console.log(`  Ja existentes (pular): ${stats.jaExistentes}`);
  console.log(`  Clientes importados: ${stats.clientesImportados}`);
  console.log(`  Pipeline (vendidos): ${stats.pipelineImportados}`);
  console.log(`  Vendas registradas: ${stats.vendasImportadas}`);
  console.log(`  Notas/interacoes: ${stats.notasImportadas}`);
  console.log(`  Erros: ${stats.erros}`);
  console.log('==============================================\n');

  process.exit(0);
}

main().catch(e => {
  console.error('ERRO FATAL:', e);
  if (rawDb) saveDb();
  process.exit(1);
});
