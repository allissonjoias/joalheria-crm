import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../../../data.db');

async function main() {
  console.log(`DB: ${DB_PATH}`);
  console.log(`Tamanho: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Modificado: ${fs.statSync(DB_PATH).mtime.toISOString()}\n`);

  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  function q(sql: string): any[] {
    try {
      const stmt = db.prepare(sql);
      const results: any[] = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    } catch (e: any) {
      console.log(`  [ERRO SQL] ${e.message}`);
      return [];
    }
  }

  // Tabelas existentes
  const tables = q("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tableNames = tables.map(t => t.name);
  console.log('=== TABELAS NO BANCO ===');
  console.log(tableNames.join(', '));
  console.log(`Total: ${tableNames.length}\n`);

  // Tem kommo_mapeamento?
  const hasKommoMap = tableNames.includes('kommo_mapeamento');
  console.log(`kommo_mapeamento existe: ${hasKommoMap}`);

  // Clientes
  console.log('\n=== CLIENTES ===');
  const cl = q("SELECT COUNT(*) as t FROM clientes")[0]?.t;
  console.log(`Total: ${cl}`);
  const clKommo = q("SELECT COUNT(*) as t FROM clientes WHERE origem = 'kommo_ganho'")[0]?.t;
  console.log(`Origem kommo_ganho: ${clKommo}`);
  const origens = q("SELECT origem, COUNT(*) as t FROM clientes GROUP BY origem ORDER BY t DESC LIMIT 10");
  console.log('Origens:', origens.map(o => `${o.origem || 'null'}(${o.t})`).join(', '));

  // Amostra com telefone
  const amostra = q("SELECT nome, telefone, email, origem FROM clientes WHERE telefone IS NOT NULL AND telefone != '' LIMIT 5");
  amostra.forEach(c => console.log(`  ${c.nome} | ${c.telefone} | ${c.email || '-'} | ${c.origem || '-'}`));

  // Pipeline
  console.log('\n=== PIPELINE ===');
  const pl = q("SELECT COUNT(*) as t FROM pipeline")[0]?.t;
  console.log(`Total: ${pl}`);
  const estagios = q("SELECT estagio, COUNT(*) as t FROM pipeline GROUP BY estagio ORDER BY t DESC");
  console.log('Estagios:', estagios.map(e => `${e.estagio}(${e.t})`).join(', '));
  const somaPipeline = q("SELECT COALESCE(SUM(valor), 0) as t FROM pipeline WHERE estagio = 'vendido'")[0]?.t;
  console.log(`Soma vendidos: R$ ${Number(somaPipeline).toLocaleString('pt-BR')}`);

  // Top vendas
  const top = q("SELECT titulo, valor FROM pipeline WHERE estagio = 'vendido' ORDER BY valor DESC LIMIT 5");
  top.forEach(p => console.log(`  ${p.titulo} — R$ ${p.valor}`));

  // Vendas
  console.log('\n=== VENDAS ===');
  const vt = q("SELECT COUNT(*) as t FROM vendas")[0]?.t;
  const vs = q("SELECT COALESCE(SUM(valor), 0) as t FROM vendas")[0]?.t;
  console.log(`Total vendas: ${vt}`);
  console.log(`Soma: R$ ${Number(vs).toLocaleString('pt-BR')}`);

  // Interacoes
  console.log('\n=== INTERACOES ===');
  const it = q("SELECT COUNT(*) as t FROM interacoes")[0]?.t;
  console.log(`Total: ${it}`);
  const tipos = q("SELECT tipo, COUNT(*) as t FROM interacoes GROUP BY tipo ORDER BY t DESC");
  console.log('Tipos:', tipos.map(i => `${i.tipo}(${i.t})`).join(', '));

  // Mapeamento Kommo
  if (hasKommoMap) {
    console.log('\n=== KOMMO MAPEAMENTO ===');
    const km = q("SELECT tipo, COUNT(*) as t FROM kommo_mapeamento GROUP BY tipo");
    km.forEach(m => console.log(`  ${m.tipo}: ${m.t}`));
  }
}

main();
