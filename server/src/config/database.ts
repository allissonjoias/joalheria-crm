import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(__dirname, '../../../data.db');
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

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save periodically
let saveTimer: ReturnType<typeof setInterval> | null = null;

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
    await runKommoMigrations(wrapper, db);
    await runEvolutionMigrations(wrapper, db);
    await runDaraMigrations(wrapper, db);
    await runWhatsAppMultiMigrations(wrapper, db);

    await runSdrAgentMigrations(wrapper, db);
    await runMediaMigrations(wrapper, db);
    await runBantMigrations(wrapper, db);

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
