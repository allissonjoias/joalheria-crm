# Deploy no Easypanel v2.26.3

## Pre-requisitos

- Easypanel v2.26.3 instalado no servidor
- Repositorio GitHub: `allissonjoias/joalheria-crm`
- Chaves de API (Anthropic/OpenAI/Gemini) para os agentes de IA

---

## Passo 1: Criar Projeto

1. No painel do Easypanel, clique em **Create Project**
2. Nome: `whatsalisson` (ou o nome que preferir)

---

## Passo 2: Adicionar App

1. Dentro do projeto, clique em **+ Service**
2. Selecione **App**
3. Nome do servico: `crm`

---

## Passo 3: Configurar Source (GitHub)

Na aba **General > Source**:

1. **Source Type**: GitHub
2. **Repository**: `allissonjoias/joalheria-crm`
3. **Branch**: `main`
4. **Build Type**: Dockerfile
5. **Dockerfile Path**: `./Dockerfile`

Se o Easypanel pedir para conectar ao GitHub, autorize o acesso ao repositorio.

---

## Passo 4: Variaveis de Ambiente

Na aba **Environment**, adicione:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=GERE_UMA_SENHA_FORTE_AQUI_COM_32_CHARS
CLAUDE_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-sonnet-4-6
OPENAI_API_KEY=sk-...
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=alisson_joalheria_2026
```

### Notas sobre as variaveis:

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `JWT_SECRET` | SIM | Chave secreta para tokens de login. Use uma string aleatoria longa |
| `CLAUDE_API_KEY` | NAO* | Chave da Anthropic. Pode configurar depois pela interface |
| `OPENAI_API_KEY` | NAO | Usada para transcricao de audio (Whisper). Opcional |
| `META_APP_ID` | NAO | Para integracao com WhatsApp Business API / Instagram |

*As chaves de API podem ser configuradas pela interface em Configuracoes > Chaves de API.

---

## Passo 5: Volumes (Dados Persistentes)

Na aba **Volumes / Mounts**, crie 3 mounts:

### Volume 1: Banco de Dados
- **Type**: Volume
- **Name**: `crm-data`
- **Mount Path**: `/app/data.db`

> IMPORTANTE: O `data.db` e um arquivo unico. No Easypanel v2.26.3, se nao tiver opcao de montar arquivo, use mount path `/app` e configure `DB_PATH=/app/data.db` nas variaveis de ambiente.

### Volume 2: Uploads (Midias)
- **Type**: Volume
- **Name**: `crm-uploads`
- **Mount Path**: `/app/uploads`

### Volume 3: Sessao WhatsApp
- **Type**: Volume
- **Name**: `crm-whatsapp`
- **Mount Path**: `/app/whatsapp-auth`

---

## Passo 6: Porta e Dominio

Na aba **Domains**:

1. **Container Port**: `3001`
2. **Domain**: escolha uma das opcoes:
   - Subdominio do Easypanel: `crm-seuservidor.easypanel.host`
   - Dominio proprio: `crm.alissonjoias.com.br`
3. **HTTPS**: Ativado (Easypanel gera certificado SSL automaticamente)

---

## Passo 7: Deploy

1. Clique em **Deploy** (ou **Rebuild**)
2. Aguarde o build (primeira vez leva ~2-3 minutos)
3. Quando o status ficar **Running**, acesse pelo dominio configurado

---

## Primeiro Acesso

1. Acesse `https://seu-dominio.com`
2. Login padrao:
   - Email: `admin@alisson.com`
   - Senha: `admin123`
3. **TROQUE A SENHA IMEDIATAMENTE** em Configuracoes

---

## Configuracoes Pos-Deploy

### Chaves de API (IA)
1. Va em **Configuracoes > Chaves de API**
2. Adicione pelo menos uma chave (Anthropic, OpenAI ou Gemini)
3. Selecione o provedor padrao

### WhatsApp
1. Va em **WhatsApp** no menu lateral
2. Escaneie o QR Code com seu celular
3. A sessao fica salva no volume `crm-whatsapp`

### Agentes de IA
1. Va em **Agentes de AI**
2. Crie/configure seus agentes
3. Use o Simulador para testar

---

## Atualizacoes

Para atualizar o sistema apos mudancas no codigo:

1. Faca `git push` para o repositorio
2. No Easypanel, va no servico `crm`
3. Clique em **Rebuild**

Os dados (banco, uploads, sessao WhatsApp) sao preservados nos volumes.

---

## Troubleshooting

### App nao inicia
- Verifique os logs na aba **Logs** do Easypanel
- Confirme que `JWT_SECRET` esta definido
- Confirme que os volumes estao montados

### Erro 502 Bad Gateway
- A porta do container deve ser `3001`
- Verifique se `PORT=3001` esta nas variaveis de ambiente

### WhatsApp desconecta
- O volume `/app/whatsapp-auth` deve estar persistente
- Se perdeu a sessao, escaneie o QR Code novamente

### Banco de dados vazio apos rebuild
- O volume `/app/data.db` (ou `/app`) nao esta montado
- Verifique os volumes no Easypanel

### Upload de midia falha
- Verifique se o volume `/app/uploads` esta montado
- O limite de upload e 50MB

---

## Estrutura de Portas

| Servico | Porta |
|---------|-------|
| API + Frontend | 3001 |

Apenas uma porta. O Express serve tanto a API (`/api/*`) quanto o frontend React em producao.

---

## Backup

Para fazer backup dos dados:

1. **Banco**: Copie o volume `crm-data` (contem `data.db`)
2. **Midias**: Copie o volume `crm-uploads`
3. **WhatsApp**: Copie o volume `crm-whatsapp`

No Easypanel, voce pode fazer isso via SSH no servidor ou usando as ferramentas de backup do Easypanel.
