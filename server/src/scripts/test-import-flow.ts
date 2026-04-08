import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.resolve(__dirname, '../../../data.db');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const rawDb = new SQL.Database(buf);

  // Step 1: Create kommo_mapeamento exactly like the import script
  console.log('Step 1: CREATE TABLE...');
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
    console.log('  OK');
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Step 2: Verify table exists
  const stmt0 = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kommo_mapeamento'");
  const hasTable = stmt0.step();
  stmt0.free();
  console.log('  Table exists:', hasTable);

  // Step 3: Insert a client using db.run (same as import script)
  const clienteId = uuidv4();
  console.log('\nStep 2: INSERT into clientes via rawDb.run...');
  try {
    rawDb.run(
      `INSERT INTO clientes (id, nome, telefone, email, cpf, data_nascimento, cep, endereco, numero_endereco, complemento, bairro, cidade, estado, tags, origem, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, 'TESTE IMPORT FLOW', '85999991234', 'test@test.com', '12345678900', '1990-01-01', '60000000', 'Rua Teste', '123', 'Apto 1', 'Centro', 'Fortaleza', 'Ceará', '["teste"]', 'kommo_ganho', '2026-04-08 12:00:00', '2026-04-08 12:00:00']
    );
    console.log('  OK, id:', clienteId);
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Step 4: Insert into pipeline
  const pipelineId = uuidv4();
  console.log('\nStep 3: INSERT into pipeline via rawDb.run...');
  try {
    rawDb.run(
      `INSERT INTO pipeline (id, cliente_id, titulo, valor, estagio, tipo_pedido, itens_pedido, forma_pagamento, parcelas, valor_frete, transportador, endereco_entrega, data_prevista_entrega, data_envio, observacao_pedido, origem_lead, forma_atendimento, desconto, tags, notas, funil_id, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, 'vendido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [pipelineId, clienteId, 'Teste Lead', 1500, 'Fabricação', '[]', 'pix', 3, null, null, null, null, null, null, 'Instagram Feed Loja', 'Somente Online', null, '[]', null, '2026-04-08 12:00:00', '2026-04-08 12:00:00']
    );
    console.log('  OK, id:', pipelineId);
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Step 5: Insert into kommo_mapeamento
  console.log('\nStep 4: INSERT into kommo_mapeamento...');
  try {
    rawDb.run(
      `INSERT INTO kommo_mapeamento (id, tipo, kommo_id, local_id, criado_em) VALUES (?, 'lead', ?, ?, ?)`,
      [uuidv4(), 99999, pipelineId, '2026-04-08 12:00:00']
    );
    console.log('  OK');
  } catch (e: any) {
    console.log('  ERROR:', e.message);
  }

  // Step 6: Verify in-memory
  console.log('\nStep 5: VERIFY in memory...');
  const stmt1 = rawDb.prepare("SELECT COUNT(*) as c FROM clientes WHERE origem = 'kommo_ganho'");
  stmt1.step();
  console.log('  clientes kommo_ganho:', stmt1.getAsObject());
  stmt1.free();

  const stmt2 = rawDb.prepare("SELECT COUNT(*) as c FROM pipeline WHERE estagio = 'vendido'");
  stmt2.step();
  console.log('  pipeline vendido:', stmt2.getAsObject());
  stmt2.free();

  const stmt3 = rawDb.prepare("SELECT COUNT(*) as c FROM kommo_mapeamento");
  stmt3.step();
  console.log('  kommo_mapeamento:', stmt3.getAsObject());
  stmt3.free();

  // Step 7: Export and check size
  console.log('\nStep 6: EXPORT and save...');
  const data = rawDb.export();
  const buffer = Buffer.from(data);
  console.log('  Export size:', buffer.length, 'bytes');
  console.log('  Original file size:', buf.length, 'bytes');
  console.log('  Difference:', buffer.length - buf.length, 'bytes');

  fs.writeFileSync(DB_PATH + '.test', buffer);
  console.log('  Saved to data.db.test');

  // Step 8: Reopen test file and verify
  console.log('\nStep 7: REOPEN and verify...');
  const buf2 = fs.readFileSync(DB_PATH + '.test');
  const db2 = new SQL.Database(buf2);
  const s1 = db2.prepare("SELECT COUNT(*) as c FROM clientes WHERE origem = 'kommo_ganho'");
  s1.step();
  console.log('  clientes kommo_ganho:', s1.getAsObject());
  s1.free();
  const s2 = db2.prepare("SELECT nome, telefone FROM clientes WHERE origem = 'kommo_ganho'");
  if (s2.step()) console.log('  sample:', s2.getAsObject());
  s2.free();

  // Cleanup
  fs.unlinkSync(DB_PATH + '.test');
  console.log('\nDone. Cleaned up test file.');
}

main().catch(e => console.error('FATAL:', e));
