import { env } from './config/env';
import { setupDatabase } from './config/database';
import app from './app';

async function main() {
  // Initialize database before starting server
  await setupDatabase();
  console.log('Banco de dados conectado.');

  app.listen(env.PORT, () => {
    console.log(`Servidor rodando na porta ${env.PORT}`);
    console.log(`API: http://localhost:${env.PORT}/api`);
  });
}

main().catch((err) => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
