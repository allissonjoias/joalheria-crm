/**
 * Desabilita o SDR auto-start e inicia o servidor de forma segura.
 * O SDR polling com 13k leads trava o event loop.
 */
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../../../data.db');

async function main() {
  console.log('Abrindo banco...');
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // Disable SDR auto-start
  console.log('Desabilitando SDR auto-start...');
  try {
    db.run("UPDATE sdr_agent_config SET ativo = 0 WHERE id = 1");
    console.log('  SDR desabilitado.');
  } catch (e: any) {
    console.log('  SDR config nao encontrado:', e.message);
  }

  // Verify data is there
  const stmt1 = db.prepare("SELECT COUNT(*) as c FROM pipeline WHERE estagio = 'vendido'");
  stmt1.step();
  const pipeline = stmt1.getAsObject();
  stmt1.free();
  console.log(`  Pipeline vendidos: ${pipeline.c}`);

  const stmt2 = db.prepare("SELECT COUNT(*) as c FROM vendas");
  stmt2.step();
  const vendas = stmt2.getAsObject();
  stmt2.free();
  console.log(`  Vendas: ${vendas.c}`);

  const stmt3 = db.prepare("SELECT COUNT(*) as c FROM clientes");
  stmt3.step();
  const clientes = stmt3.getAsObject();
  stmt3.free();
  console.log(`  Clientes: ${clientes.c}`);

  // Save
  console.log('Salvando...');
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log(`  Salvo: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);
  console.log('Pronto! Agora inicie o servidor.');
}

main();
