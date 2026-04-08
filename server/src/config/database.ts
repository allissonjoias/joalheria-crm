import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../data.db');
const SCHEMA_PATH = path.resolve(__dirname, '../models/database.sql');
const SEED_PATH = path.resolve(__dirname, '../models/seed.sql');
const MIGRATION_META_PATH = path.resolve(__dirname, '../models/migration_meta.sql');
const MIGRATION_KOMMO_PATH = path.resolve(__dirname, '../models/migration_kommo.sql');
const MIGRATION_EVOLUTION_PATH = path.resolve(__dirname, '../models/migration_evolution.sql');
const MIGRATION_DARA_PATH = path.resolve(__dirname, '../models/migration_dara.sql');
const MIGRATION_WHATSAPP_MULTI_PATH = path.resolve(__dirname, '../models/migration_whatsapp_multi.sql');
const MIGRATION_SDR_AGENT_PATH = path.resolve(__dirname, '../models/migration_sdr_agent.sql');
const MIGRATION_MEDIA_PATH = path.resolve(__dirname, '../models/migration_media.sql');
const MIGRATION_BANT_PATH = path.resolve(__dirname, '../models/migration_bant.sql');
const MIGRATION_API_KEYS_PATH = path.resolve(__dirname, '../models/migration_api_keys.sql');
const MIGRATION_SDR_QUALIFIER_PATH = path.resolve(__dirname, '../models/migration_sdr_qualifier.sql');
const MIGRATION_AGENTES_IA_PATH = path.resolve(__dirname, '../models/migration_agentes_ia.sql');
const MIGRATION_FUNIL_LOCAL_PATH = path.resolve(__dirname, '../models/migration_funil_local.sql');
const MIGRATION_INSTAGRAM_MULTI_PATH = path.resolve(__dirname, '../models/migration_instagram_multi.sql');
const MIGRATION_KOMMO_SDR_PATH = path.resolve(__dirname, '../models/migration_kommo_sdr.sql');
const MIGRATION_PONTO_PATH = path.resolve(__dirname, '../models/migration_ponto.sql');
const MIGRATION_CRM_AVANCADO_PATH = path.resolve(__dirname, '../models/migration_crm_avancado.sql');
const MIGRATION_EXTRACAO_IA_PATH = path.resolve(__dirname, '../models/migration_extracao_ia.sql');
const MIGRATION_CICLO_VIDA_PATH = path.resolve(__dirname, '../models/migration_ciclo_vida.sql');
const MIGRATION_ESTORNO_PATH = path.resolve(__dirname, '../models/migration_estorno.sql');
const MIGRATION_META_API_PATH = path.resolve(__dirname, '../models/migration_meta_api.sql');
const MIGRATION_AUTOMACAO_PATH = path.resolve(__dirname, '../models/migration_automacao.sql');
const MIGRATION_MANYCHAT_PATH = path.resolve(__dirname, '../models/migration_manychat.sql');
const MIGRATION_BRECHAS_PATH = path.resolve(__dirname, '../models/migration_brechas.sql');

let db: SqlJsDatabase | null = null;

// Compatibility wrapper that mimics better-sqlite3 API
export interface PreparedLike {
  all(...params: any[]): any[];
  get(...params: any[]): any;
  run(...params: any[]): { changes: number };
}

export interface DatabaseLike {
  prepare(sql: string): PreparedLike;
  exec(sql: string): void;
  pragma(pragma: string): void;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save periodically
let saveTimer: ReturnType<typeof setInterval> | null = null;

// Gera datetime local no formato 'YYYY-MM-DD HH:MM:SS' respeitando process.env.TZ
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Cache de tabelas que possuem coluna criado_em (populado no init)
const tabelasComCriadoEm = new Set<string>();

function buildTabelasCriadoEmCache(rawDb: SqlJsDatabase) {
  tabelasComCriadoEm.clear();
  try {
    const tables = rawDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (!tables.length) return;
    for (const row of tables[0].values) {
      const tableName = row[0] as string;
      const cols = rawDb.exec(`PRAGMA table_info('${tableName}')`);
      if (cols.length && cols[0].values.some((c: any) => c[1] === 'criado_em')) {
        tabelasComCriadoEm.add(tableName);
      }
    }
  } catch { /* ignore */ }
}

// Regex para extrair nome da tabela de um INSERT
const insertRegex = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i;

// Apos um INSERT em tabela com criado_em, corrige o timestamp se nao foi fornecido explicitamente
function fixInsertTimestamp(rawDb: SqlJsDatabase, sql: string) {
  if (!sql.trimStart().toUpperCase().startsWith('INSERT')) return;
  // Se o SQL ja inclui criado_em explicitamente, nao precisa corrigir
  if (/criado_em/i.test(sql)) return;
  const match = sql.match(insertRegex);
  if (!match) return;
  const table = match[1];
  if (!tabelasComCriadoEm.has(table)) return;
  try {
    const rowid = rawDb.exec('SELECT last_insert_rowid()');
    if (rowid.length && rowid[0].values.length) {
      const id = rowid[0].values[0][0];
      rawDb.run(`UPDATE ${table} SET criado_em = ? WHERE rowid = ?`, [localNow(), id]);
    }
  } catch { /* ignore */ }
}

function createWrapper(rawDb: SqlJsDatabase): DatabaseLike {
  return {
    prepare(sql: string): PreparedLike {
      return {
        all(...params: any[]): any[] {
          try {
            const stmt = rawDb.prepare(sql);
            if (params.length > 0) stmt.bind(params);
            const results: any[] = [];
            while (stmt.step()) {
              results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
          } catch (e) {
            console.error('SQL all error:', sql, params, e);
            return [];
          }
        },
        get(...params: any[]): any {
          try {
            const stmt = rawDb.prepare(sql);
            if (params.length > 0) stmt.bind(params);
            let result = undefined;
            if (stmt.step()) {
              result = stmt.getAsObject();
            }
            stmt.free();
            return result;
          } catch (e) {
            console.error('SQL get error:', sql, params, e);
            return undefined;
          }
        },
        run(...params: any[]): { changes: number } {
          try {
            rawDb.run(sql, params);
            fixInsertTimestamp(rawDb, sql);
            saveDb();
            return { changes: rawDb.getRowsModified() };
          } catch (e) {
            console.error('SQL run error:', sql, params, e);
            return { changes: 0 };
          }
        },
      };
    },
    exec(sql: string) {
      rawDb.exec(sql);
      saveDb();
    },
    pragma(_pragma: string) {
      // sql.js doesn't support pragmas the same way, skip
    },
  };
}

async function runMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  // Check if migration already applied by looking for 'canal' column in conversas
  const columns = wrapper.prepare(
    "PRAGMA table_info(conversas)"
  ).all() as any[];

  const hasCanal = columns.some((col: any) => col.name === 'canal');
  if (hasCanal) return;

  console.log('Rodando migration Meta (WhatsApp + Instagram)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_META_PATH, 'utf-8');
    // Remove comment lines, then split by semicolon
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        // Ignore "duplicate column" errors for idempotency
        if (!e.message?.includes('duplicate column')) {
          console.error('Migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Meta aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Meta:', e);
  }
}

async function runKommoMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='kommo_config'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Kommo CRM...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_KOMMO_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Kommo migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Kommo aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Kommo:', e);
  }
}

async function runEvolutionMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='evolution_config'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Evolution API (WhatsApp QR)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_EVOLUTION_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Evolution migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Evolution aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Evolution:', e);
  }
}

async function runDaraMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='dara_config'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Dara IA...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_DARA_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Dara migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Dara aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Dara:', e);
  }
}

async function runWhatsAppMultiMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='whatsapp_instances'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration WhatsApp Multi-instancia...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_WHATSAPP_MULTI_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('WhatsApp Multi migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration WhatsApp Multi aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration WhatsApp Multi:', e);
  }
}

async function runSdrAgentMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='sdr_agent_config'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Agente SDR...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_SDR_AGENT_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('SDR Agent migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Agente SDR aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Agente SDR:', e);
  }
}

async function runMediaMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const columns = wrapper.prepare(
    "PRAGMA table_info(mensagens)"
  ).all() as any[];

  const hasTranscricao = columns.some((col: any) => col.name === 'transcricao');
  if (hasTranscricao) return;

  console.log('Rodando migration Media (transcrição)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_MEDIA_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column')) {
          console.error('Media migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Media aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Media:', e);
  }
}

async function runBantMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const columns = wrapper.prepare(
    "PRAGMA table_info(conversas)"
  ).all() as any[];

  const hasBantScore = columns.some((col: any) => col.name === 'bant_score');
  if (hasBantScore) return;

  console.log('Rodando migration BANT (qualificacao de leads)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_BANT_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column')) {
          console.error('BANT migration statement error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration BANT aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration BANT:', e);
  }
}

async function runApiKeysMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration API Keys...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_API_KEYS_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('API Keys migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration API Keys aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration API Keys:', e);
  }
}

async function runAgentesIaMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agentes_ia'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Agentes IA...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_AGENTES_IA_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
          console.error('Migration agentes_ia error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Agentes IA concluida');
  } catch (e: any) {
    console.error('Erro na migration Agentes IA:', e.message);
  }
}

async function runSdrQualifierMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='sdr_lead_qualificacao'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration SDR Qualificador...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_SDR_QUALIFIER_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('SDR Qualifier migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration SDR Qualificador aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration SDR Qualificador:', e);
  }
}

async function runFunilLocalMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='funil_estagios'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Funil Local...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_FUNIL_LOCAL_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Funil Local migration error:', e.message);
        }
      }
    }

    // Migrar estagios antigos (lowercase) para nomes capitalizados
    const estagiosAntigos: Record<string, string> = {
      'lead': 'Lead',
      'contatado': 'Contatado',
      'interessado': 'Interessado',
      'negociacao': 'Negociacao',
      'vendido': 'Vendido',
      'pos_venda': 'Pos-venda',
    };
    for (const [antigo, novo] of Object.entries(estagiosAntigos)) {
      try {
        rawDb.exec(`UPDATE pipeline SET estagio = '${novo}' WHERE estagio = '${antigo}'`);
      } catch (e) { /* ignore */ }
    }

    // Recriar tabela pipeline sem CHECK constraint para suportar estagios dinamicos
    // So faz se o CHECK constraint ainda existir
    try {
      const tableSql = wrapper.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='pipeline'"
      ).get() as any;
      if (tableSql?.sql && String(tableSql.sql).includes('CHECK')) {
        console.log('Migrando tabela pipeline para remover CHECK constraint...');
        rawDb.exec(`
          CREATE TABLE pipeline_new (
            id TEXT PRIMARY KEY,
            cliente_id TEXT NOT NULL,
            vendedor_id TEXT,
            titulo TEXT NOT NULL,
            valor REAL,
            estagio TEXT NOT NULL DEFAULT 'Lead',
            produto_interesse TEXT,
            notas TEXT,
            criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
          )
        `);
        rawDb.exec('INSERT INTO pipeline_new SELECT * FROM pipeline');
        rawDb.exec('DROP TABLE pipeline');
        rawDb.exec('ALTER TABLE pipeline_new RENAME TO pipeline');
        console.log('Tabela pipeline migrada com sucesso!');
      }
    } catch (e: any) {
      console.error('Erro ao migrar pipeline:', e.message);
    }

    saveDb();
    console.log('Migration Funil Local aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Funil Local:', e);
  }
}

async function runInstagramMultiMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='instagram_contas'"
  ).get();

  // Verificar se coluna instagram_conta_id existe em conversas
  const conversaCols = wrapper.prepare("PRAGMA table_info(conversas)").all() as any[];
  const hasIgContaId = conversaCols.some((c: any) => c.name === 'instagram_conta_id');

  if (tableExists && hasIgContaId) return;

  console.log('Rodando migration Instagram Multi-conta...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_INSTAGRAM_MULTI_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Instagram Multi migration error:', e.message);
        }
      }
    }
    // Adicionar coluna instagram_conta_id na tabela conversas
    try {
      rawDb.exec("ALTER TABLE conversas ADD COLUMN instagram_conta_id TEXT DEFAULT NULL");
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        console.error('Erro ao adicionar instagram_conta_id:', e.message);
      }
    }

    // Adicionar colunas de config de eventos na tabela instagram_contas
    const configCols = ['receber_dm', 'receber_comentarios', 'receber_mencoes', 'responder_comentarios_auto', 'responder_mencoes_auto'];
    const igCols = wrapper.prepare("PRAGMA table_info(instagram_contas)").all() as any[];
    const igColNames = igCols.map((c: any) => c.name);
    for (const col of configCols) {
      if (!igColNames.includes(col)) {
        try {
          const defaultVal = col.startsWith('responder_') ? 0 : 1;
          rawDb.exec(`ALTER TABLE instagram_contas ADD COLUMN ${col} INTEGER DEFAULT ${defaultVal}`);
        } catch (e: any) {
          if (!e.message?.includes('duplicate column')) {
            console.error(`Erro ao adicionar ${col}:`, e.message);
          }
        }
      }
    }

    saveDb();
    console.log('Migration Instagram Multi aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Instagram Multi:', e);
  }
}

async function runKommoSdrMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='kommo_telefone_lead'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Kommo SDR...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_KOMMO_SDR_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Kommo SDR migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Kommo SDR aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Kommo SDR:', e);
  }
}

async function runPontoMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='ponto'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Ponto...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_PONTO_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Ponto migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Ponto aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Ponto:', e);
  }
}

async function runCrmAvancadoMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='funis'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration CRM Avancado (campos cliente, funis, motivos, origens, distribuicao)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_CRM_AVANCADO_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
          console.error('CRM Avancado migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration CRM Avancado aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration CRM Avancado:', e);
  }
}

async function runExtracaoIaMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const columns = wrapper.prepare("PRAGMA table_info(pipeline)").all() as any[];
  const hasItens = columns.some((col: any) => col.name === 'itens_pedido');
  if (hasItens) return;

  console.log('Rodando migration Extracao IA (campos auto-preenchidos no deal)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_EXTRACAO_IA_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
          console.error('Extracao IA migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Extracao IA aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Extracao IA:', e);
  }
}

async function runCicloVidaMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  // Verificar se coluna fase ja existe em funil_estagios
  const columns = wrapper.prepare("PRAGMA table_info(funil_estagios)").all() as any[];
  const hasFase = columns.some((col: any) => col.name === 'fase');
  if (hasFase) return;

  console.log('Rodando migration Ciclo de Vida (pos-venda, nutricao, recompra)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_CICLO_VIDA_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
          console.error('Ciclo de Vida migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Ciclo de Vida aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Ciclo de Vida:', e);
  }
}

async function runEstornoMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const columns = wrapper.prepare("PRAGMA table_info(vendas)").all() as any[];
  const hasEstornada = columns.some((col: any) => col.name === 'estornada');
  if (hasEstornada) return;

  console.log('Rodando migration Estorno (cancelamento pos-venda)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_ESTORNO_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
          console.error('Estorno migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Estorno aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Estorno:', e);
  }
}

async function runMetaApiMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='meta_api_config'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Meta API (WhatsApp Business Cloud API)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_META_API_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Meta API migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Meta API aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Meta API:', e);
  }
}

async function runAutomacaoMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='automacao_fluxos'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Automacao (fluxos, campanhas, templates)...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_AUTOMACAO_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('Automacao migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Automacao aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Automacao:', e);
  }
}

async function runBrechasMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='brechas_log'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration Brechas Engine...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_BRECHAS_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists') && !e.message?.includes('duplicate column')) {
          console.error('Brechas migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration Brechas Engine aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration Brechas:', e);
  }
}

async function runManyChatMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='manychat_config'"
  ).get();

  if (tableExists) return;

  console.log('Rodando migration ManyChat...');
  try {
    const migrationSql = fs.readFileSync(MIGRATION_MANYCHAT_PATH, 'utf-8');
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        rawDb.exec(stmt + ';');
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('ManyChat migration error:', e.message);
        }
      }
    }
    saveDb();
    console.log('Migration ManyChat aplicada com sucesso!');
  } catch (e) {
    console.error('Erro ao rodar migration ManyChat:', e);
  }
}

async function runConfigGeralMigrations(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  const tableExists = wrapper.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='config_geral'"
  ).get();

  if (!tableExists) {
    console.log('Rodando migration Config Geral...');
    try {
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS config_geral (
          chave TEXT PRIMARY KEY,
          valor TEXT NOT NULL,
          atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
        );
        INSERT OR IGNORE INTO config_geral (chave, valor) VALUES ('fuso_horario', 'America/Fortaleza');
      `);
      saveDb();
      console.log('Migration Config Geral aplicada com sucesso!');
    } catch (e) {
      console.error('Erro ao rodar migration Config Geral:', e);
    }
  }

}

async function runStickerMigration(wrapper: DatabaseLike, rawDb: SqlJsDatabase) {
  // Atualizar CHECK constraint de tipo_midia para incluir 'sticker'
  try {
    const tableInfo = rawDb.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='mensagens'");
    if (tableInfo.length > 0) {
      const sql = tableInfo[0].values[0][0] as string;
      if (sql && sql.includes("tipo_midia") && (!sql.includes("'sticker'") || !sql.includes("'documento'"))) {
        console.log('Rodando migration Sticker/Documento...');
        const newSql = sql.replace(
          /tipo_midia IN\s*\([^)]+\)/,
          "tipo_midia IN ('texto', 'imagem', 'audio', 'video', 'comentario', 'sticker', 'documento')"
        );
        rawDb.exec('PRAGMA writable_schema = ON');
        rawDb.exec(`UPDATE sqlite_master SET sql = '${newSql.replace(/'/g, "''")}' WHERE type='table' AND name='mensagens'`);
        rawDb.exec('PRAGMA writable_schema = OFF');
        rawDb.exec('PRAGMA integrity_check');
        saveDb();
        console.log('Migration Sticker aplicada com sucesso!');
      }
    }
  } catch (e) {
    console.error('Erro ao rodar migration Sticker:', e);
    // Fallback: se nao conseguir alterar constraint, stickers serao salvos como 'imagem'
  }
}

let initPromise: Promise<DatabaseLike> | null = null;

export function initDatabase(): Promise<DatabaseLike> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    const wrapper = createWrapper(db);

    // Check if tables exist
    const tableExists = wrapper.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
    ).get();

    if (!tableExists) {
      console.log('Inicializando banco de dados...');
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      db.exec(schema);

      const seed = fs.readFileSync(SEED_PATH, 'utf-8');
      db.exec(seed);

      saveDb();
      console.log('Banco de dados inicializado com sucesso!');
    }

    // Run migrations if needed
    await runMigrations(wrapper, db);
    // Limpar tabelas Kommo obsoletas (integração desvinculada)
    try {
      db.exec('DROP TABLE IF EXISTS kommo_config');
      db.exec('DROP TABLE IF EXISTS kommo_import_log');
      db.exec('DROP TABLE IF EXISTS kommo_mapeamento');
      saveDb();
    } catch {}
    await runEvolutionMigrations(wrapper, db);
    await runDaraMigrations(wrapper, db);
    await runWhatsAppMultiMigrations(wrapper, db);

    await runSdrAgentMigrations(wrapper, db);
    await runMediaMigrations(wrapper, db);
    await runBantMigrations(wrapper, db);
    await runApiKeysMigrations(wrapper, db);
    await runSdrQualifierMigrations(wrapper, db);
    await runAgentesIaMigrations(wrapper, db);
    await runFunilLocalMigrations(wrapper, db);
    await runInstagramMultiMigrations(wrapper, db);
    await runKommoSdrMigrations(wrapper, db);
    await runPontoMigrations(wrapper, db);
    await runCrmAvancadoMigrations(wrapper, db);
    await runExtracaoIaMigrations(wrapper, db);
    await runCicloVidaMigrations(wrapper, db);
    await runEstornoMigrations(wrapper, db);
    await runMetaApiMigrations(wrapper, db);
    await runAutomacaoMigrations(wrapper, db);
    await runManyChatMigrations(wrapper, db);
    await runBrechasMigrations(wrapper, db);
    await runConfigGeralMigrations(wrapper, db);
    await runStickerMigration(wrapper, db);

    // Construir cache de tabelas com criado_em para o interceptor de INSERT
    buildTabelasCriadoEmCache(db);

    // Marcar que o interceptor de timezone esta ativo
    // A partir daqui, todo INSERT sem criado_em tera o timestamp corrigido pelo wrapper
    // Dados anteriores ja foram corrigidos na v1 da migration
    try {
      const jaCorrigiu = wrapper.prepare(
        "SELECT valor FROM config_geral WHERE chave = 'tz_fix_v2'"
      ).get() as any;
      if (!jaCorrigiu) {
        db.exec("INSERT OR REPLACE INTO config_geral (chave, valor) VALUES ('tz_fix_v2', '1')");
        saveDb();
        console.log('Interceptor de timezone ativo para novos INSERTs.');
      }
    } catch { /* ignore */ }

    // Atualizar modelos descontinuados para versoes atuais
    try {
      const oldModels: Record<string, string> = {
        'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
        'claude-opus-4-20250514': 'claude-opus-4-6',
        'gpt-4-turbo': 'gpt-4o',
      };
      for (const [old, novo] of Object.entries(oldModels)) {
        db.exec(`UPDATE api_keys SET modelo = '${novo}' WHERE modelo = '${old}'`);
      }
      // Forçar qualquer modelo gemini-2.0 ou gemini-1.x para gemini-2.5-flash
      db.exec(`UPDATE api_keys SET modelo = 'gemini-2.5-flash' WHERE provider = 'gemini' AND modelo LIKE 'gemini-2.0%'`);
      db.exec(`UPDATE api_keys SET modelo = 'gemini-2.5-flash' WHERE provider = 'gemini' AND modelo LIKE 'gemini-1%'`);
      saveDb();
    } catch (e) { /* tabela pode nao existir */ }

    // Carregar API keys do banco para process.env
    try {
      const keys = wrapper.prepare('SELECT provider, api_key, modelo FROM api_keys WHERE api_key != ""').all() as any[];
      for (const k of keys) {
        if (k.provider === 'anthropic' && k.api_key) {
          process.env.CLAUDE_API_KEY = k.api_key;
          if (k.modelo) process.env.CLAUDE_MODEL = k.modelo;
        } else if (k.provider === 'openai' && k.api_key) {
          process.env.OPENAI_API_KEY = k.api_key;
        } else if (k.provider === 'gemini' && k.api_key) {
          process.env.GEMINI_API_KEY = k.api_key;
        }
      }
    } catch (e) { /* tabela pode nao existir ainda */ }

    // Add prompt_personalizado column to sdr_agent_config if missing
    try {
      const sdrCols = wrapper.prepare("PRAGMA table_info(sdr_agent_config)").all() as any[];
      if (sdrCols.length > 0 && !sdrCols.some((c: any) => c.name === 'prompt_personalizado')) {
        db.exec("ALTER TABLE sdr_agent_config ADD COLUMN prompt_personalizado TEXT DEFAULT ''");
        saveDb();
        console.log('Coluna prompt_personalizado adicionada ao sdr_agent_config');
      }
      if (sdrCols.length > 0 && !sdrCols.some((c: any) => c.name === 'sdr_auto_responder')) {
        db.exec("ALTER TABLE sdr_agent_config ADD COLUMN sdr_auto_responder INTEGER DEFAULT 0");
        saveDb();
        console.log('Coluna sdr_auto_responder adicionada ao sdr_agent_config');
      }
      if (sdrCols.length > 0 && !sdrCols.some((c: any) => c.name === 'prompt_dara_sdr')) {
        db.exec("ALTER TABLE sdr_agent_config ADD COLUMN prompt_dara_sdr TEXT DEFAULT ''");
        saveDb();
        console.log('Coluna prompt_dara_sdr adicionada ao sdr_agent_config');
      }
      // Colunas kommo_qual_* removidas — integração Kommo desvinculada
    } catch (e) { /* already exists */ }

    // Add selecionado column to api_keys if missing
    try {
      const apiKeysCols = wrapper.prepare("PRAGMA table_info(api_keys)").all() as any[];
      if (apiKeysCols.length > 0 && !apiKeysCols.some((c: any) => c.name === 'selecionado')) {
        db.exec("ALTER TABLE api_keys ADD COLUMN selecionado INTEGER DEFAULT 0");
        saveDb();
        console.log('Coluna selecionado adicionada ao api_keys');
      }
    } catch (e) { /* already exists */ }

    // Colunas de config do Instagram (receber_dm, receber_comentarios, receber_mencoes)
    try {
      const igCols = wrapper.prepare("PRAGMA table_info(instagram_contas)").all() as any[];
      if (igCols.length > 0 && !igCols.some((c: any) => c.name === 'receber_dm')) {
        db.exec("ALTER TABLE instagram_contas ADD COLUMN receber_dm INTEGER DEFAULT 1");
        db.exec("ALTER TABLE instagram_contas ADD COLUMN receber_comentarios INTEGER DEFAULT 1");
        db.exec("ALTER TABLE instagram_contas ADD COLUMN receber_mencoes INTEGER DEFAULT 1");
        db.exec("ALTER TABLE instagram_contas ADD COLUMN responder_comentarios_auto INTEGER DEFAULT 0");
        db.exec("ALTER TABLE instagram_contas ADD COLUMN responder_mencoes_auto INTEGER DEFAULT 0");
        saveDb();
        console.log('Colunas de config Instagram adicionadas');
      }
    } catch (e) { /* already exists */ }

    // Migration: foto_perfil na tabela clientes
    try {
      const clienteCols = wrapper.prepare("PRAGMA table_info(clientes)").all() as any[];
      if (clienteCols.length > 0 && !clienteCols.some((c: any) => c.name === 'foto_perfil')) {
        db.exec("ALTER TABLE clientes ADD COLUMN foto_perfil TEXT DEFAULT NULL");
        saveDb();
        console.log('Coluna foto_perfil adicionada em clientes');
      }
    } catch (e) { /* already exists */ }

    // Migration: ultima_leitura na tabela conversas (contador de nao lidas)
    try {
      const conversasCols = wrapper.prepare("PRAGMA table_info(conversas)").all() as any[];
      if (conversasCols.length > 0 && !conversasCols.some((c: any) => c.name === 'ultima_leitura')) {
        db.exec("ALTER TABLE conversas ADD COLUMN ultima_leitura TEXT DEFAULT NULL");
        saveDb();
        console.log('Coluna ultima_leitura adicionada em conversas');
      }
    } catch (e) { /* already exists */ }

    // Migration: agent_skills table
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS agent_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'prompt',
        categoria TEXT NOT NULL DEFAULT 'geral',
        conteudo TEXT NOT NULL DEFAULT '',
        ativo INTEGER DEFAULT 1,
        prioridade INTEGER DEFAULT 50,
        icone TEXT DEFAULT 'brain',
        origem TEXT DEFAULT 'manual',
        criado_em TEXT DEFAULT (datetime('now','localtime')),
        atualizado_em TEXT DEFAULT (datetime('now','localtime'))
      )`);
    } catch (e) { /* already exists */ }

    // Migration: tipo_skill column on agent_skills
    try {
      const skillCols = wrapper.prepare("PRAGMA table_info(agent_skills)").all() as any[];
      if (skillCols.length > 0 && !skillCols.some((c: any) => c.name === 'tipo_skill')) {
        db.exec("ALTER TABLE agent_skills ADD COLUMN tipo_skill TEXT DEFAULT 'sub_agente'");
        saveDb();
      }
    } catch (e) { /* already exists */ }

    // Migration: max_tokens, temperatura columns on agentes_ia
    try {
      const agCols = wrapper.prepare("PRAGMA table_info(agentes_ia)").all() as any[];
      if (agCols.length > 0 && !agCols.some((c: any) => c.name === 'max_tokens')) {
        db.exec("ALTER TABLE agentes_ia ADD COLUMN max_tokens INTEGER DEFAULT 500");
        saveDb();
      }
      if (agCols.length > 0 && !agCols.some((c: any) => c.name === 'temperatura')) {
        db.exec("ALTER TABLE agentes_ia ADD COLUMN temperatura REAL DEFAULT 0.7");
        saveDb();
      }
    } catch (e) { /* already exists */ }

    // Migration: skill_learnings table
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS skill_learnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        evidencias TEXT,
        conteudo_skill TEXT,
        aprovado INTEGER DEFAULT 0,
        confianca REAL DEFAULT 0,
        ocorrencias INTEGER DEFAULT 1,
        criado_em TEXT DEFAULT (datetime('now','localtime')),
        atualizado_em TEXT DEFAULT (datetime('now','localtime'))
      )`);
    } catch (e) { /* already exists */ }

    // Migration: skill_reports table
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS skill_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'diario',
        data_referencia TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        metricas TEXT,
        sugestoes TEXT,
        criado_em TEXT DEFAULT (datetime('now','localtime'))
      )`);
    } catch (e) { /* already exists */ }

    // Auto-save every 5 seconds
    if (!saveTimer) {
      saveTimer = setInterval(saveDb, 5000);
    }

    return wrapper;
  })();

  return initPromise;
}

let syncDb: DatabaseLike | null = null;

export function getDb(): DatabaseLike {
  if (!syncDb) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return syncDb;
}

export async function setupDatabase(): Promise<DatabaseLike> {
  syncDb = await initDatabase();
  return syncDb;
}

export default getDb;
