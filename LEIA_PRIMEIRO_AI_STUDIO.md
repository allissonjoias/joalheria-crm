# Como usar este projeto no Google AI Studio (Antigravity)

Este projeto é um CRM completo com backend Node+Express e frontend React+Vite.
Ele foi construído para rodar **LOCAL** com PM2 e sql.js (SQLite).

---

## Arquivos importantes para entender o projeto (leia nesta ordem)

1. **DOCUMENTACAO_COMPLETA.md** ← LEIA PRIMEIRO, tem TUDO (arquitetura, features, DB, APIs)
2. **CLAUDE.md** — instruções gerais de desenvolvimento
3. **DEPLOY-EASYPANEL.md** — como fazer deploy

## Estrutura
- `server/src/` — backend TypeScript (controllers, services, routes, models/migrations)
- `client/src/` — frontend React TypeScript (pages, components)
- `server/src/models/*.sql` — 34 migrations SQL
- `data.db` — banco de dados (não incluído, é gerado automaticamente)

## O que NÃO está neste ZIP (por serem pesados ou gerados)
- `node_modules/` — rode `npm install` para gerar
- `server/dist/` — gerado com `npm run build` ou `npx tsc`
- `client/dist/` — gerado com `npx vite build`
- `server/public/` — gerado copiando `client/dist/*` após build
- `data.db` — gerado automaticamente na 1ª execução
- `.git/` — histórico git
- `uploads/` — arquivos enviados por usuários
- `whatsapp-auth/` — sessão do WhatsApp
- `.env` — credenciais (use `.env.example` como base)

---

## Como subir no AI Studio

### Opção A — Usar o Antigravity Agent (recomendado)
1. No AI Studio, crie um novo projeto "Import from ZIP" e carregue este arquivo
2. Cole o conteúdo de `DOCUMENTACAO_COMPLETA.md` como contexto inicial
3. Peça: *"Analise o projeto, entenda a arquitetura e me ajude com [sua tarefa]"*

### Opção B — Análise apenas (chat)
1. Suba arquivos individuais conforme precisar
2. Use `DOCUMENTACAO_COMPLETA.md` como contexto principal
3. Cole arquivos específicos (ex: Pipeline.tsx) quando quiser trabalhar neles

---

## Limitações importantes ao rodar no AI Studio

⚠️ **ATENÇÃO:** Este projeto foi feito para rodar **LOCAL**, não no Firebase/cloud.

### O que NÃO vai funcionar no AI Studio direto:
- **PM2** — é process manager local, o AI Studio não tem
- **sql.js com data.db local** — o AI Studio usa Firebase, não SQLite em arquivo
- **WhatsApp via Baileys** — precisa de sessão persistente local
- **Timezone America/Fortaleza** — pode precisar ajustar

### O que vai funcionar:
- Análise e edição do código
- Gerar novas features
- Refatorar componentes React
- Criar novos endpoints
- Adicionar migrations
- Gerar testes
- Documentação

### Para RODAR de verdade
Você ainda precisa:
1. Baixar o código
2. `npm install`
3. Configurar `.env`
4. `npm run dev` (ou buildar + PM2)

**O AI Studio NÃO vai conseguir rodar o servidor PM2 na sua máquina local.**

---

## Recomendação de uso

**Use o AI Studio para:**
- 🧠 Planejar features novas (contexto de 2M tokens, vê tudo junto)
- ✍️ Gerar código de novas páginas/componentes
- 🔍 Revisar arquitetura
- 📝 Gerar documentação
- 🧪 Brainstormar ideias

**Continue usando o Claude Code local para:**
- ⚡ Executar tarefas no seu Windows (PM2, build, restart)
- 🔧 Editar arquivos com precisão
- 🚀 Deploy
- 🐛 Debug com execução real

---

## Stack resumida

```
Frontend:  React 18 + TypeScript + Vite 6 + Tailwind + react-router 7
Backend:   Node + TypeScript + Express 4 + sql.js + JWT + bcrypt
IA:        Anthropic Claude SDK + OpenAI SDK
WhatsApp:  @whiskeysockets/baileys
Mobile:    Capacitor (Android/iOS)
Deploy:    PM2 + EasyPanel + Docker
```

## Dados do banco (importantes)

- `funil_id = 10` é o funil ativo
- 19 etapas divididas em 6 blocos:
  - **Qualificação**: Contato, BANT, Qualificado
  - **Fechamento**: Orçamento, Negociação, Aguardando Pagamento, Ganho
  - **Logística**: Aguardando Envio, Enviado, Aguardando Retirada, Entregue
  - **Sucesso do Cliente**: Sucesso, Pos-venda
  - **Nutrição**: Recompra, Reconversão, Reengajamento
  - **Arquivo**: Perdido, Opt-out, Completo
- BANT score 0-100 (Budget 30 + Authority 15 + Need 30 + Timeline 20 + Bonus 5)
- Classificação: QUENTE≥80, MORNO≥55, FRIO≥25, DESCARTE<25

---

## Comandos úteis

```bash
# Desenvolvimento (ambos os serviços)
npm run dev

# Build completo
npm run build

# Backend isolado
cd server && npx tsc          # compila TypeScript
cd server && npm run dev      # dev com hot reload

# Frontend isolado
cd client && npx vite build   # build produção
cd client && npm run dev      # dev na porta 5173

# PM2 (produção local)
pm2 start server/dist/index.js --name crm-server
pm2 restart crm-server
pm2 logs crm-server
```

---

Gerado em: 2026-04-18
