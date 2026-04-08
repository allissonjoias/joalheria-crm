import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.resolve(__dirname, '../../../data.db');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // Test 1: Create table with exec
  console.log('Test 1: CREATE TABLE via exec...');
  try {
    db.exec("CREATE TABLE IF NOT EXISTS test_import (id TEXT, nome TEXT, valor REAL)");
    console.log('  OK');
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Test 2: Insert with db.run
  const id1 = uuidv4();
  console.log('Test 2: INSERT via db.run(sql, params)...');
  try {
    db.run("INSERT INTO test_import (id, nome, valor) VALUES (?, ?, ?)", [id1, 'Teste Run', 100]);
    console.log('  OK');
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Test 3: Check if data exists
  console.log('Test 3: SELECT from test_import...');
  const stmt = db.prepare("SELECT * FROM test_import");
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  console.log('  Rows:', rows.length, rows);

  // Test 4: Insert into clientes with db.run
  const id2 = uuidv4();
  console.log('Test 4: INSERT into clientes via db.run...');
  try {
    db.run(
      "INSERT INTO clientes (id, nome, telefone, origem, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)",
      [id2, 'TESTE KOMMO', '85999999999', 'kommo_ganho', '2026-04-07 12:00:00', '2026-04-07 12:00:00']
    );
    console.log('  OK');
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Test 5: Check clientes
  console.log('Test 5: SELECT from clientes WHERE origem = kommo_ganho...');
  const stmt2 = db.prepare("SELECT id, nome, telefone, origem FROM clientes WHERE origem = 'kommo_ganho'");
  const rows2: any[] = [];
  while (stmt2.step()) rows2.push(stmt2.getAsObject());
  stmt2.free();
  console.log('  Rows:', rows2.length, rows2);

  // Test 6: Save to disk
  console.log('Test 6: Saving to disk...');
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('  Saved. Size:', fs.statSync(DB_PATH).size);

  // Test 7: Reopen and check
  console.log('Test 7: Reopen and verify...');
  const buf2 = fs.readFileSync(DB_PATH);
  const db2 = new SQL.Database(buf2);
  const stmt3 = db2.prepare("SELECT COUNT(*) as c FROM clientes WHERE origem = 'kommo_ganho'");
  stmt3.step();
  console.log('  kommo_ganho count:', stmt3.getAsObject());
  stmt3.free();

  const stmt4 = db2.prepare("SELECT COUNT(*) as c FROM test_import");
  stmt4.step();
  console.log('  test_import count:', stmt4.getAsObject());
  stmt4.free();

  // Cleanup test table
  db2.exec("DROP TABLE IF EXISTS test_import");
  db2.exec("DELETE FROM clientes WHERE origem = 'kommo_ganho'");
  const data2 = db2.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data2));
  console.log('  Cleaned up.');
}

main();
