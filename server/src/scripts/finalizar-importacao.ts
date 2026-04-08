/**
 * Script de segurança para finalizar a importação.
 * Executa APÓS o importar-kommo-ganhos.ts terminar.
 *
 * 1. Verifica se data.db.importing ou data.db.final existe
 * 2. Mata qualquer processo CRM rodando
 * 3. Faz backup do data.db atual
 * 4. Copia o arquivo importado para data.db
 * 5. Verifica os dados
 *
 * Uso: npx tsx server/src/scripts/finalizar-importacao.ts
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DB_PATH = path.resolve(__dirname, '../../../data.db');
const IMPORT_PATH = DB_PATH + '.importing';
const FINAL_PATH = DB_PATH + '.final';
const BACKUP_PATH = DB_PATH + '.pre-import-backup';

async function main() {
  console.log('=== FINALIZAR IMPORTACAO KOMMO ===\n');

  // 1. Find the import file
  let sourcePath = '';
  if (fs.existsSync(IMPORT_PATH)) {
    sourcePath = IMPORT_PATH;
    console.log(`Arquivo fonte: ${IMPORT_PATH} (${(fs.statSync(IMPORT_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
  } else if (fs.existsSync(FINAL_PATH)) {
    sourcePath = FINAL_PATH;
    console.log(`Arquivo fonte: ${FINAL_PATH} (${(fs.statSync(FINAL_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.error('ERRO: Nenhum arquivo de importacao encontrado (.importing ou .final)');
    console.error('Execute primeiro: npx tsx server/src/scripts/importar-kommo-ganhos.ts');
    process.exit(1);
  }

  // 2. Verify the import file has data
  console.log('\nVerificando dados no arquivo importado...');
  const SQL = await initSqlJs();
  const importBuf = fs.readFileSync(sourcePath);
  const importDb = new SQL.Database(importBuf);

  function q(db: any, sql: string): any {
    const stmt = db.prepare(sql);
    let result: any = undefined;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    return result;
  }

  const clientesKommo = q(importDb, "SELECT COUNT(*) as c FROM clientes WHERE origem = 'kommo_ganho'")?.c || 0;
  const pipelineVendidos = q(importDb, "SELECT COUNT(*) as c FROM pipeline WHERE estagio = 'vendido'")?.c || 0;
  const vendas = q(importDb, "SELECT COUNT(*) as c FROM vendas")?.c || 0;
  const interacoes = q(importDb, "SELECT COUNT(*) as c FROM interacoes")?.c || 0;

  console.log(`  Clientes (kommo_ganho): ${clientesKommo}`);
  console.log(`  Pipeline (vendidos): ${pipelineVendidos}`);
  console.log(`  Vendas: ${vendas}`);
  console.log(`  Interacoes: ${interacoes}`);

  if (pipelineVendidos === 0) {
    console.error('\nERRO: Arquivo de importacao nao contem dados de pipeline. Abortando.');
    process.exit(1);
  }

  // 3. Kill CRM server processes
  console.log('\nParando processos CRM...');
  try {
    const result = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine 2>/dev/null', { encoding: 'utf-8' });
    const lines = result.split('\n').filter(l => l.includes('joalheria') && !l.includes('finalizar-importacao'));
    for (const line of lines) {
      const pidMatch = line.match(/(\d+)\s*$/);
      if (pidMatch) {
        const pid = pidMatch[1];
        try {
          execSync(`taskkill //F //PID ${pid} 2>/dev/null`);
          console.log(`  Processo ${pid} parado.`);
        } catch { /* ignore */ }
      }
    }
    if (lines.length === 0) console.log('  Nenhum processo CRM rodando.');
  } catch {
    console.log('  Nao foi possivel verificar processos (OK se nao estiver no Windows).');
  }

  // 4. Backup current data.db
  console.log('\nFazendo backup do data.db atual...');
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log(`  Backup salvo em: ${BACKUP_PATH}`);
  }

  // 5. Copy import file to data.db
  console.log('\nCopiando arquivo importado para data.db...');
  fs.copyFileSync(sourcePath, DB_PATH);
  console.log(`  Copiado! Tamanho: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(1)} MB`);

  // 6. Verify the final data.db
  console.log('\nVerificando data.db final...');
  const finalBuf = fs.readFileSync(DB_PATH);
  const finalDb = new SQL.Database(finalBuf);

  const fClientes = q(finalDb, "SELECT COUNT(*) as c FROM clientes WHERE origem = 'kommo_ganho'")?.c || 0;
  const fPipeline = q(finalDb, "SELECT COUNT(*) as c FROM pipeline WHERE estagio = 'vendido'")?.c || 0;
  const fVendas = q(finalDb, "SELECT COUNT(*) as c FROM vendas")?.c || 0;
  const fInteracoes = q(finalDb, "SELECT COUNT(*) as c FROM interacoes")?.c || 0;

  console.log(`  Clientes (kommo_ganho): ${fClientes}`);
  console.log(`  Pipeline (vendidos): ${fPipeline}`);
  console.log(`  Vendas: ${fVendas}`);
  console.log(`  Interacoes: ${fInteracoes}`);

  if (fPipeline === pipelineVendidos) {
    console.log('\n  SUCESSO! Dados verificados e consistentes.');
  } else {
    console.error('\n  AVISO: Contagens divergem! Verifique manualmente.');
  }

  // 7. Cleanup
  if (fs.existsSync(IMPORT_PATH) && sourcePath === IMPORT_PATH) {
    fs.renameSync(IMPORT_PATH, FINAL_PATH);
    console.log(`\n  Arquivo .importing renomeado para .final (backup).`);
  }

  console.log('\n=== FINALIZACAO CONCLUIDA ===');
  console.log('Agora pode reiniciar o servidor: npm run dev --workspace=server');
}

main().catch(e => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
