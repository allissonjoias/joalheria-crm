// Timezone padrao (sera sobrescrito pelo banco apos inicializacao)
process.env.TZ = 'America/Fortaleza';

import { env } from './config/env';
import { setupDatabase, getDb } from './config/database';
import app from './app';

async function main() {
  // Initialize database before starting server
  await setupDatabase();
  console.log('Banco de dados conectado.');

  // Carregar fuso horario salvo no banco
  try {
    const db = getDb();
    const row = db.prepare("SELECT valor FROM config_geral WHERE chave = 'fuso_horario'").get() as any;
    if (row?.valor) {
      process.env.TZ = row.valor;
      console.log(`Fuso horario carregado do banco: ${row.valor}`);
    }
  } catch { /* tabela ainda nao existe na primeira execucao */ }

  app.listen(env.PORT, () => {
    console.log(`Servidor rodando na porta ${env.PORT}`);
    console.log(`API: http://localhost:${env.PORT}/api`);
  });
}

main().catch((err) => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
