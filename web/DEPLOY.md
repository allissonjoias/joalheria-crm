# Deploy no EasyPanel

Guia passo-a-passo pra colocar o CRM Alisson no ar via EasyPanel (Hostinger VPS).

---

## Pré-requisitos

- ✅ EasyPanel rodando no VPS
- ✅ Supabase rodando no mesmo VPS (já tem)
- ✅ Domínio apontando pro VPS (você já tem `crm.alissonranyel.com.br`)
- ✅ Acesso ao GitHub do projeto (`github.com/allissonjoias/joalheria-crm`)

---

## Estratégia recomendada

**Não desligue o CRM antigo ainda.** Crie um app NOVO no EasyPanel apontando pro Next.js, com domínio temporário (ex: `crm-novo.alissonranyel.com.br`). Quando confirmar que tudo funciona, troca o domínio.

---

## Passo 1: Criar o app no EasyPanel

1. Login no painel
2. Vai no projeto onde tá o Supabase (ou cria novo)
3. **+ Service** → **App**
4. **Source: GitHub**
   - Repository: `allissonjoias/joalheria-crm`
   - Branch: `main`
   - **Build context: `web`** ← importante (não é a raiz do repo)

## Passo 2: Build Settings

Em **Build**:
- **Method:** `Dockerfile`
- **Dockerfile path:** `web/Dockerfile`

## Passo 3: Variáveis de ambiente

Em **Environment**:

```env
# === Build args (precisa marcar "Build time" no EasyPanel) ===
NEXT_PUBLIC_SUPABASE_URL=https://api.alisson.api.br
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InNlbGYtaG9zdCIsImlhdCI6MTc1NzMwMzUzNiwiZXhwIjoyMDcyNjYzNTM2fQ.6aDnTwDlKSnfMP4M1lt59KVZ1Np3yf0t70tiTYSy_fI
NEXT_PUBLIC_APP_URL=https://crm.alissonranyel.com.br

# === Runtime ===
NODE_ENV=production
PORT=3000
```

⚠️ **Importante**: as `NEXT_PUBLIC_*` precisam estar disponíveis no momento do **build** (são embutidas no JS do browser). No EasyPanel, marca essas como "Build time" se houver opção, ou passa via Build Args.

## Passo 4: Network

Em **Network**:
- **Port:** `3000`
- **Domain:** `crm-novo.alissonranyel.com.br` (ou o que escolher)
- **HTTPS:** ON (Let's Encrypt automático)

## Passo 5: Deploy

Clica em **Deploy** e aguarda o build (~3-5min na primeira vez).

Logs esperados:
```
Step 1/X : FROM node:20-alpine AS base
...
✓ Compiled successfully
✓ Generating static pages (14/14)
Successfully tagged ...
```

## Passo 6: Testar

Abre `https://crm-novo.alissonranyel.com.br/login` → deve aparecer a tela de login.

## Passo 7: Registrar webhook na Unipile

Agora que tem URL pública, no CRM:

1. Login
2. **Configurações → Unipile**
3. Cadastra: API Key + DSN + Account ID (mesmas credenciais do CRM antigo)
4. Clica **Salvar**, depois **Testar conexão** — deve listar as contas
5. Em **Webhook**, o callback URL já estará preenchido como `https://crm-novo.alissonranyel.com.br/api/webhook/unipile`
6. Clica **Registrar webhook na Unipile**

A partir daí, qualquer DM no Instagram cai no CRM novo.

## Passo 8: Trocar domínio (quando estiver confiante)

1. EasyPanel → app antigo → Network → remove domínio `crm.alissonranyel.com.br`
2. EasyPanel → app novo → Network → adiciona `crm.alissonranyel.com.br`
3. Aguarda SSL ser emitido (~2 min)
4. **Re-registra o webhook na Unipile** com a URL final
5. Desliga o app antigo (mas não deleta — guarda como backup por uns dias)

---

## Troubleshooting

### Build falha com "out of memory"
EasyPanel default tem ~1GB RAM no builder. Aumenta via Settings → Build → Memory.

### Build OK mas app crasha
Cheque os logs em runtime — geralmente env var faltando. Verifica se `NEXT_PUBLIC_*` estão disponíveis.

### Erro 502 / Bad Gateway
- Confira que **Port = 3000** no EasyPanel
- App pode estar reiniciando, espera 30s

### Webhook recebe mas conversa não aparece
- Vai em **Configurações → Unipile** e confirma que `account_id` bate com o que vem no webhook
- Olha `crm.webhook_log` no Studio: deve ter linhas com `processado = true` e `erro = null`

### Conexão Supabase falha
- API URL precisa estar acessível do **container** Next.js. Como o Supabase tá no mesmo VPS, pode usar IP interno do Docker (mais rápido) ou o domínio público (mais simples). Recomendado: `https://api.alisson.api.br` (público).

---

## Arquivos relevantes

- `web/Dockerfile` — receita de build
- `web/.dockerignore` — arquivos que ficam de fora
- `web/next.config.ts` — `output: 'standalone'` ativo
- `web/.env.example` — template das variáveis
