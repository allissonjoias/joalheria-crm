# CRM Alisson Joalheria - Documentação Completa

CRM com IA para joalheria. Sistema unificado de vendas do primeiro contato ao pós-venda,
com agente SDR (Luma) que qualifica leads automaticamente via WhatsApp/Instagram.

---

## 1. STACK TECNOLÓGICA

### Backend (`server/`)
- **Node.js** + **TypeScript**
- **Express 4** (API REST)
- **sql.js** (SQLite em memória, persistido em `data.db`)
- **@anthropic-ai/sdk** (integração com Claude)
- **openai** (integração alternativa)
- **@whiskeysockets/baileys** (WhatsApp)
- **jsonwebtoken** + **bcryptjs** (auth)
- **node-cron** (agendamento)
- **fluent-ffmpeg** (processar áudios do WhatsApp)
- **PM2** (process manager em produção)

### Frontend (`client/`)
- **React 18** + **TypeScript**
- **Vite 6** (build tool)
- **Tailwind CSS 3** (estilos)
- **React Router 7** (roteamento)
- **@hello-pangea/dnd** (drag-and-drop do Kanban)
- **lucide-react** (ícones)
- **recharts** (gráficos)
- **axios** (HTTP client)
- **vite-plugin-pwa** (PWA)
- **Capacitor** (build mobile Android/iOS)

### Infraestrutura
- **Deploy**: EasyPanel + Docker
- **Process Manager**: PM2 (`crm-server`)
- **Banco**: `data.db` (SQLite via sql.js)
- **Compilação**: `npx tsc` em server/ → arquivos em `server/dist/`
- **SQL Files**: precisam ser copiados manualmente: `Copy-Item server/src/models/*.sql server/dist/models/`

---

## 2. ARQUITETURA

### Estrutura de Pastas
```
joalheria-crm/
├── client/                  # Frontend React
│   ├── src/
│   │   ├── pages/           # 19 páginas (Pipeline, Mensageria, etc)
│   │   ├── components/      # Componentes UI
│   │   ├── contexts/        # AuthContext
│   │   ├── services/        # api.ts (axios)
│   │   └── App.tsx
│   ├── public/              # Assets estáticos
│   └── package.json
├── server/                  # Backend Express
│   ├── src/
│   │   ├── config/          # database.ts, constants
│   │   ├── controllers/     # 26 controllers
│   │   ├── services/        # 26 services
│   │   ├── routes/          # 27 route files
│   │   ├── models/          # 34 migration SQL files
│   │   ├── middleware/      # auth, cors
│   │   ├── utils/           # helpers (lead-score, etc)
│   │   └── index.ts
│   └── package.json
├── data.db                  # Banco SQLite
├── uploads/                 # Arquivos enviados
├── whatsapp-auth/           # Sessão WhatsApp
├── CLAUDE.md                # Instruções pro Claude Code
├── DEPLOY-EASYPANEL.md      # Deploy docs
└── package.json             # Workspace raiz
```

### Fluxo de Mensagens (Luma SDR)
```
Cliente envia mensagem WhatsApp/Instagram
    ↓
mensageria.service → processarWhatsApp() / processarInstagramDM()
    ↓
brechas.service → middlewareMensagemRecebida() [check opt-out, problemas]
    ↓ (se não é brecha)
skill.service → routeMessage() + gerarResposta() [ou claude.service]
    ↓
Resposta enviada ao cliente
    ↓ (em paralelo, background)
extracao.service → extrairDados() [dados estruturados]
sdr-qualifier.service → qualificarLead() [BANT scoring]
    ↓
ciclo-vida.service → executarAutomacoesGatilho() [move etapas]
```

---

## 3. MODELO DE DADOS (Principais Tabelas)

### Tabelas principais
- `usuarios` — admin, vendedores (auth com JWT + bcrypt)
- `clientes` — base de clientes (nome, telefone, opt_out)
- `pipeline` — ODVs (Oportunidades De Venda) no Kanban
- `pipeline_historico` — histórico de mudança de etapas
- `conversas` — threads de mensagens
- `mensagens` — cada mensagem trocada
- `funis` — configuração de funis (funil_id=10 é o unificado)
- `funil_estagios` — 19 etapas divididas em 6 blocos
- `sdr_lead_qualificacao` — scores BANT por lead
- `automacao_etapas` — regras de automação configuráveis
- `tarefas` — tarefas atribuídas aos vendedores
- `vendas` — vendas fechadas
- `tarifa_mercado_pago` — integração pagamentos
- `config_geral` — configurações (chave/valor)
- `providers_ia` — configuração de providers IA (Anthropic/OpenAI)

### Estrutura `funil_estagios` com blocos
```sql
CREATE TABLE funil_estagios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funil_id INTEGER,
  nome TEXT,               -- Ex: "Contato", "BANT", "Qualificado"
  cor TEXT,
  ordem INTEGER,
  tipo TEXT,               -- aberto, ganho, perdido
  fase TEXT,               -- qualificacao, fechamento, logistica, sucesso, nutricao, arquivo
  bloco TEXT,              -- Bloco visual: Qualificacao, Fechamento, etc
  ativo INTEGER
)
```

### Estrutura `sdr_lead_qualificacao` (BANT)
```sql
CREATE TABLE sdr_lead_qualificacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id TEXT,
  telefone TEXT,
  lead_score INTEGER,         -- 0-100
  classificacao TEXT,         -- QUENTE, MORNO, FRIO, DESCARTE
  bant_budget TEXT,           -- resposta textual sobre orçamento
  bant_budget_score INTEGER,  -- 0-30
  bant_authority TEXT,
  bant_authority_score INTEGER,  -- 0-15
  bant_need TEXT,
  bant_need_score INTEGER,    -- 0-30
  bant_timeline TEXT,
  bant_timeline_score INTEGER,  -- 0-20
  bant_bonus_score INTEGER,   -- 0-5
  criado_em TEXT,
  atualizado_em TEXT
)
```

### Lead Score BANT (0-100) — Lógica
- **Budget** (30): >5k=30, 2-5k=20, 1-2k=12, 800-1k=6, <800=0
- **Authority** (15): sozinho=15, lidera=10, consulta=5, terceiro=0
- **Need** (30): aliança+casamento=30, solitário=28, presente+data=25, coleção=23, produto=15, personalizado=14, presente=10, reparo=8, explorando=5
- **Timeline** (20): 7d=20, 8-15d=16, 16-30d=12, 31-60d=6, +60d=2
- **Bonus** (5): cliente_existente=5, recorrente=4, engajamento=1-3

**Classificação:**
- QUENTE ≥ 80
- MORNO ≥ 55
- FRIO ≥ 25
- DESCARTE < 25

---

## 4. FUNIL UNIFICADO (19 etapas em 6 blocos)

### Bloco 1: Qualificação (roxo/índigo)
1. **Contato** — Primeiro contato recebido
2. **BANT** — Qualificação em andamento (BANT preenchido em tempo real)
3. **Qualificado** — Score ≥ 80 (QUENTE)

### Bloco 2: Fechamento (âmbar)
4. **Orçamento** — Enviado orçamento pro cliente
5. **Negociação** — Negociando preço, prazo, objeções
6. **Aguardando Pagamento** — Cliente vai pagar
7. **Ganho** (tipo=ganho) — Venda fechada, dispara registro de venda

### Bloco 3: Logística (azul)
8. **Aguardando Envio** — Produto pronto, aguardando despacho
9. **Enviado** — Despachado (com rastreio)
10. **Aguardando Retirada** — Cliente vai buscar na loja
11. **Entregue** — Entrega confirmada

### Bloco 4: Sucesso do Cliente (verde)
12. **Sucesso** — Cliente satisfeito
13. **Pos-venda** — Atendimento pós-entrega

### Bloco 5: Nutrição (rosa)
14. **Recompra** — Cliente ativo para nova compra
15. **Reconversão** — Lead qualificado perdido (viu produtos)
16. **Reengajamento** — Lead frio, tentando reativar

### Bloco 6: Arquivo (cinza)
17. **Perdido** (tipo=perdido) — Lead desqualificado (DESCARTE)
18. **Opt-out** — Cliente pediu para parar
19. **Completo** — Ciclo de vida finalizado

---

## 5. PRINCIPAIS FEATURES

### A. Kanban Inteligente (`Pipeline.tsx`)
- 6 colunas visuais (uma por bloco)
- Cards mostram sub-etapa como badge
- Drag-and-drop entre blocos
- Score BANT em tempo real nos cards (qualificação)
- Barras visuais B/A/N/T/+ (5 bars com max 30/15/30/20/5)
- Classificação QUENTE/MORNO/FRIO/DESCARTE com ícones (flame/thermo/snow)
- Painel lateral de detalhes com BANT detalhado
- Automações por etapa (botão ⚡)

### B. Mensageria (`Mensageria.tsx`)
- Caixa de entrada unificada (WhatsApp + Instagram DM)
- Auto-resposta com IA (Luma SDR)
- Modo Auto vs Modo Manual
- Middleware de brechas (opt-out, problemas)
- Extração automática de dados em background
- Processamento de áudios (STT via Whisper)
- Processamento de imagens (vision)

### C. Sistema de Automações Configuráveis
Cada etapa pode ter N automações, com 3 tipos de gatilho:
1. **ao_entrar_etapa** — quando ODV entra na etapa
2. **ao_cliente_responder** — quando cliente responde mensagem
3. **por_lead_score** — quando score BANT atinge range

Ações disponíveis:
- mover_etapa (move pra outra etapa)
- enviar_mensagem (envia mensagem IA ou pré-definida)
- criar_tarefa
- notificar_vendedor
- adicionar_tag

### D. IA Generativa para Automações
Endpoint `POST /api/automacao-etapas/ia`:
- Recebe descrição em linguagem natural
- Gera configuração estruturada da automação
- Preview antes de salvar
- Salva individual ou em lote

### E. Simulador Visual (`Simulador.tsx`)
Mostra o fluxo completo do funil em ação:
1. Lead chega → ODV em Contato
2. BANT preenchido em tempo real (5 barras animadas conforme respostas)
3. Dados extraídos progressivamente
4. Cliente cadastrado
5. Score ≥ 80 → Qualificado (handoff SDR → Vendas)
6. Tarefas auto-criadas
7. Distribuição para vendedora
8. Negociação → Ganho
9. Logística (Aguardando Envio → Enviado → Entregue)
10. Sucesso/Pós-venda
11. Nutrição → Recompra
12. Nova ODV de recompra (ciclo recomeça)

### F. Providers IA Configuráveis
- Anthropic (Claude Sonnet/Opus)
- OpenAI (GPT-4o)
- Escolha do modelo ativo via UI
- Sistema de skills (sub-agentes) para roteamento

### G. Agentes especializados por bloco (conceito)
- **Agente SDR** (Qualificação) — Luma, usa BANT
- **Agente Vendas** (Fechamento) — negocia, envia orçamento
- **Agente Logística** (Logística) — rastreio, prazos
- **Agente Sucesso** (Sucesso do Cliente) — satisfação, pós-venda
- **Agente Nutrição** (Nutrição) — recompra, reengajamento

### H. Dashboard
- Leads ativos, taxa conversão, ticket médio
- Tempo médio de fechamento
- ODVs em risco (>48h sem responder pgto)
- Reengajamentos
- Filtros por consultora, canal, produto, período

### I. WhatsApp Integration
- Conexão via Baileys (biblioteca WhatsApp Web)
- QR Code para parear
- Queue de envio (rate limiting)
- Suporte a texto, imagem, áudio, documento

### J. Dados BANT visíveis no painel lateral
- Score total /100
- Badge de classificação (QUENTE/MORNO/FRIO/DESCARTE)
- Contador de campos preenchidos (/5)
- 5 barras individuais com textos extraídos do cliente
- Ex: Orçamento: "R$ 3.000" (25/30)

---

## 6. ENDPOINTS DA API (Principais)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

### Pipeline
- `GET /api/pipeline` — lista ODVs (com BANT detalhado via JOIN)
- `POST /api/pipeline` — cria ODV
- `PUT /api/pipeline/:id` — atualiza
- `DELETE /api/pipeline/:id`
- `PUT /api/pipeline/:id/estagio` — move etapa
- `GET /api/pipeline/metricas`

### Funil
- `GET /api/funil/estagios?funil_id=10`
- `POST /api/funil/estagios`
- `PUT /api/funil/estagios/:id`
- `DELETE /api/funil/estagios/:id`

### Mensageria
- `GET /api/conversas`
- `GET /api/conversas/:id/mensagens`
- `POST /api/conversas/:id/mensagens` — envia mensagem
- `POST /api/conversas/:id/ia` — gera resposta IA
- `PUT /api/conversas/:id/modo` — muda modo auto/manual

### SDR / BANT
- `POST /api/sdr/qualificar` — força qualificação BANT
- `GET /api/sdr/qualificacoes`
- `GET /api/sdr/estatisticas`

### Automações
- `GET /api/automacao-etapas`
- `POST /api/automacao-etapas`
- `PUT /api/automacao-etapas/:id`
- `DELETE /api/automacao-etapas/:id`
- `POST /api/automacao-etapas/ia` — gera automação com IA

### Clientes
- `GET /api/clientes`
- `POST /api/clientes`
- `PUT /api/clientes/:id`
- `DELETE /api/clientes/:id`

### Vendas
- `GET /api/vendas`
- `POST /api/vendas`

### WhatsApp
- `GET /api/whatsapp/status`
- `GET /api/whatsapp/qr`
- `POST /api/whatsapp/conectar`
- `POST /api/whatsapp/desconectar`

### IA Providers
- `GET /api/providers`
- `POST /api/providers`
- `PUT /api/providers/:id/ativo`

---

## 7. COMO RODAR LOCAL

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- (Opcional) PM2 global: `npm install -g pm2`

### Setup
```bash
# 1. Instalar dependências (workspaces)
npm install

# 2. Copiar .env
cp .env.example .env
# Editar .env com:
#   JWT_SECRET=...
#   ANTHROPIC_API_KEY=...  (opcional)
#   OPENAI_API_KEY=...     (opcional)

# 3. Rodar em dev (frontend + backend concorrentes)
npm run dev

# OU em produção:
# 3a. Build
cd client && npx vite build
# Copiar build para server/public
xcopy /E /Y client\dist server\public

cd ../server && npx tsc
# Copiar SQL para dist
xcopy /E /Y src\models\*.sql dist\models\

# 3b. Start com PM2
pm2 start dist/index.js --name crm-server
```

### URLs
- Frontend dev: http://localhost:5173
- Backend: http://localhost:3001
- Backend API: http://localhost:3001/api

### Credenciais padrão
- Admin: `admin@alisson.com` / `admin123`
- Vendedor: `maria@alisson.com` / `vendedor123`

---

## 8. MIGRATIONS (34 arquivos SQL)

Todas em `server/src/models/`. Principais:
- `migration_funil_local.sql` — cria estrutura inicial
- `migration_crm_avancado.sql` — adiciona funil_id
- `migration_funil_v2.sql` — multi-pipeline v2
- `migration_funil_unificado.sql` — unifica em funil_id=10
- `migration_funil_blocos.sql` — **atual**, 19 etapas em 6 blocos
- `migration_sdr_qualifier.sql` — tabela BANT
- `migration_bant_bonus.sql` — adiciona campo bonus_score
- `migration_automacao_etapas.sql` — automações
- `migration_automacao_gatilhos.sql` — gatilhos (ao_entrar, ao_cliente_responder, por_lead_score)
- `migration_automacao_nullable.sql` — estagio_destino pode ser NULL
- `migration_ciclo_vida.sql` — fases de ciclo de vida
- `migration_brechas.sql` — middleware de exceções
- `migration_extracao_ia.sql` — extração de dados
- `migration_sticker.sql` — stickers WhatsApp
- `migration_estorno.sql` — cancelamentos

Ordem de execução em `database.ts`:
1. Schema inicial
2. CRM avançado
3. Extração IA
4. Ciclo de vida
5. Estorno
6. Meta API
7. Automação
8. ManyChat
9. Brechas
10. Funil V2
11. Funil V3
12. Config Geral
13. Sticker
14. Funil Unificado
15. Limpar Funil
16. Automação Etapas
17. Automação Gatilhos
18. Automação Nullable
19. BANT Bonus
20. Funil Blocos

---

## 9. CONCEITOS ÚNICOS DO PROJETO

### "Brechas"
Sistema de middleware que intercepta mensagens ANTES da IA responder. Trata casos especiais:
- Opt-out (cliente pediu pra parar)
- Reclamações/problemas
- Reengajamento pós-perda
- Mensagem fora do horário

### "Modo Auto vs Manual"
Cada conversa tem uma flag. Se Auto: IA responde tudo. Se Manual: vendedor responde, IA só sugere.

### "Extração IA"
Em paralelo à resposta, a IA extrai dados estruturados da conversa:
- Nome, produto, ocasião
- Orçamento, parcelas
- Prazo, endereço entrega
- Forma de pagamento
- Forma de atendimento

Os campos preenchidos pela IA ficam marcados com badge violeta no CRM.

### "Handoffs entre agentes"
Ao final de cada bloco, um evento é disparado:
- `lead_qualificado` → SDR passa pra Vendas
- `venda_fechada` → Vendas passa pra Logística
- `pedido_entregue` → Logística passa pra Sucesso
- `cliente_satisfeito` → Sucesso passa pra Nutrição

### "Score no banco ≠ Score exibido"
O `score_bant` antigo era 0-150. O novo `bant_lead_score` é 0-100. No Kanban usa o `bant_lead_score` (novo), mas há fallback pra compatibilidade.

---

## 10. ARQUIVO `.env` (VARIÁVEIS)

```bash
# Server
PORT=3001
JWT_SECRET=sua_chave_secreta_aqui

# IA Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# (opcional) Meta/Instagram
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# (opcional) Mercado Pago
MP_ACCESS_TOKEN=

# Timezone
TZ=America/Fortaleza
```

---

## 11. ROADMAP / TODO

### Implementado ✅
- Kanban com 6 blocos
- BANT em tempo real (score 0-100)
- Automações configuráveis com IA
- Simulador visual (BANT progressivo)
- Mensageria unificada
- WhatsApp + Instagram DM
- Extração IA
- Handoffs entre agentes (conceito)

### Pendente / Próximos passos
- Agentes especializados por bloco (hoje é 1 agente Luma, ideal é 5 agentes específicos)
- Métricas por bloco (hoje só globais)
- App mobile (Capacitor configurado, falta publicar)
- Integração com Mercado Pago (parcial)
- Notificações push
- Dashboard de performance dos agentes
- A/B testing de prompts

---

## 12. CONVENÇÕES DE CÓDIGO

### Backend
- TypeScript estrito
- Controllers retornam `{ data, erro }`
- Services são singletons (exports default)
- Uso de `wrapper.prepare(...).get()` e `.all()` pro sql.js
- `saveDb()` após cada escrita
- Erros: `console.error` + retornar 500

### Frontend
- Componentes funcionais + hooks
- Props tipadas
- Tailwind para estilos (sem CSS modules)
- Estado global via Context (AuthContext)
- API calls via `api` (axios configurado)
- Ícones lucide-react
- Cores temáticas: `alisson-*` (verde escuro), `creme-*` (fundo)

### Idioma
- **PT-BR em toda UI e comentários**
- Identificadores em inglês (variáveis, funções)
- Emoji com moderação (só onde fizer sentido no UX)

---

## 13. INSTRUÇÕES PARA IA STUDIO

Se for analisar/modificar este projeto:

1. **NÃO mude o schema do banco** sem criar nova migration em `server/src/models/`
2. **Sempre compile o server** após mudanças: `cd server && npx tsc`
3. **Copie os SQL** para dist: `Copy-Item server/src/models/*.sql server/dist/models/`
4. **Rebuild o client** se mexer em `client/src/`: `cd client && npx vite build`
5. **Reinicie o PM2**: `pm2 restart crm-server`
6. **Mantenha PT-BR** em UI e mensagens
7. **Cores padrão**:
   - Qualificação = índigo/roxo
   - Fechamento = âmbar
   - Logística = azul
   - Sucesso = verde
   - Nutrição = rosa
   - Arquivo = cinza
8. **BANT sempre 0-100** (não voltar pra escala 0-150 antiga)
9. **`funil_id=10`** é o funil ativo (unificado)
10. **Testar no navegador** em http://localhost:3001 (não 5173 — o server serve o frontend buildado)

---

Gerado em: 2026-04-18
Versão do projeto: 1.0.0
