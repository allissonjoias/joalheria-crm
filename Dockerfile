# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json de todos os workspaces
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

# Instalar dependencias
RUN npm ci

# Copiar todo o codigo
COPY . .

# Build do client (React + Vite)
RUN npm run build --workspace=client

# Build do server (TypeScript + copiar .sql)
RUN npm run build --workspace=server

# ─── Stage 2: Producao ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copiar package.json
COPY package.json package-lock.json ./
COPY server/package.json server/

# Instalar so dependencias de producao do server
RUN npm ci --workspace=server --omit=dev

# Copiar build do server (inclui dist/models/*.sql)
COPY --from=builder /app/server/dist ./server/dist

# Copiar build do client
COPY --from=builder /app/client/dist ./client/dist

# Criar diretorios de dados persistentes
RUN mkdir -p uploads whatsapp-auth

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
