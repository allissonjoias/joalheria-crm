import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve(__dirname, '../../../data.db');
const SCHEMA_PATH = path.resolve(__dirname, '../models/database.sql');
const SEED_PATH = path.resolve(__dirname, '../models/seed.sql');

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
