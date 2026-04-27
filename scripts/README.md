# Scripts de migração

Migra dados do CRM antigo (`data.db` SQLite + `uploads/`) pro Postgres + Supabase Storage.

## Setup

```bash
cd scripts
npm install
```

## Rodar

```bash
# 1) Preview (não escreve nada)
npm run migrate:dry

# 2) Migrar de verdade
npm run migrate

# 3) Re-rodar após mudanças (limpa migrados antes)
npm run migrate:reset
```

## O que migra

| SQLite | → Postgres |
|---|---|
| `clientes` (7.935) | `public.contatos` (dedup) + `crm.contato_canais` |
| `conversas` (164) | `crm.conversas` |
| `mensagens` (283) | `crm.mensagens` |
| `instagram_posts` (20) | `crm.instagram_posts` |
| `agentes_ia` (1) | `crm.agentes_ia` + `crm.prompt_templates` |
| `unipile_config` (1) | `crm.unipile_config` |
| `meta_api_config` (1) | `crm.meta_config` |
| `sdr_lead_qualificacao` (30) | `crm.sdr_runs` |

## O que NÃO migra (intencional)

- `vendas` (8.656) — já em `alissonerp.vendas_erp`
- `pipeline` (13.263) — sobreposto com Kommo (`public.leads`)
- `interacoes` (28.473) / `sdr_agent_log` (5.256) / `webhook_log` (881) — logs antigos
- `usuarios` — já em `auth.users` + `alissonerp.usuarios`

## Idempotência

O script é **seguro pra rodar várias vezes**:
- Contatos: dedup por nome normalizado (`crm.normalizar_nome`)
- Conversas: dedup por `(canal, canal_thread_id)`
- Mensagens: dedup por `(conversa_id, canal_message_id)`
- Posts: PK em `ig_media_id`

## Reverter

```bash
npm run migrate:reset
```

Apaga só os dados marcados com `metadata.migrated_from = 'sqlite'`. Não toca em dados criados via webhook/UI.

## Variáveis de ambiente (opcional)

```bash
PG_HOST=72.60.55.140
PG_PORT=5543
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=...
```

Padrão: usa as credenciais do banco compartilhado.
