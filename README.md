# Painel V27 · Grupo Catarina

Aplicação web full-stack que substitui o protótipo HTML estático
(`painel_v27/`) por uma plataforma multiusuário, com sincronização
automática de fontes (ERP · CRM · SharePoint), permissões granulares,
e briefing de diretoria com export PDF e disparo automático.

> **Versão atual:** scaffold (etapa 1 de 13). Sem backend, sem auth,
> sem dados reais ainda. Os arquivos de referência do protótipo
> permanecem em `painel_v27/` apenas como fonte de verdade visual.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts |
| API | Next.js API Routes + tRPC v11 |
| Banco | PostgreSQL 16 + Prisma |
| Auth | NextAuth (Auth.js v5) · bcrypt · estrutura pronta para Azure AD / Google |
| Filas | BullMQ + Redis 7 |
| Conectores | `pg` (ERP) · `axios` (CRM) · `@microsoft/microsoft-graph-client` + `xlsx` (SharePoint) |
| Notificações | Nodemailer · `@slack/web-api` |
| PDF | Puppeteer |
| Deploy | Docker Compose (web · postgres · redis · nginx) |
| Testes | Vitest + Playwright |
| Logs | Pino |
| Validação | Zod |

---

## Estrutura

```
.
├── apps/
│   └── web/                        # Next.js (App Router)
│       ├── app/                    # rotas, layout, globals
│       ├── components/ui/          # shadcn/ui (button, ...)
│       ├── lib/                    # utils, env, db, auth
│       ├── prisma/                 # schema + seed
│       ├── e2e/                    # playwright
│       ├── tailwind.config.ts
│       ├── components.json
│       ├── next.config.mjs
│       ├── vitest.config.ts
│       └── playwright.config.ts
├── packages/
│   ├── connectors/                 # ERP · CRM · SharePoint adapters
│   ├── jobs/                       # BullMQ workers
│   └── shared/                     # Zod schemas + domain enums
├── painel_v27/                     # protótipo HTML (referência visual)
├── Dockerfile                      # Next.js standalone
├── docker-compose.yml              # web · postgres · redis · nginx
├── nginx.conf                      # reverse proxy → /painel/v27
├── Makefile                        # tarefas comuns
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env.example
```

---

## Setup local

```bash
# 1. Pré-requisitos: Node 22+, pnpm 10+, Docker 24+, GNU make
node -v && pnpm -v && docker -v

# 2. Instalar deps do workspace
make install            # === pnpm install

# 3. Copiar variáveis de ambiente
cp .env.example .env
#   - NEXTAUTH_SECRET → gere com: openssl rand -base64 32
#   - USE_MOCK_CONNECTORS=true (default) usa as fixtures em painel_v27/
#   - SMTP/Slack/SSO podem ficar vazios em dev

# 4. Subir banco + redis + nginx + web
make up                 # === docker compose up -d
make logs               # acompanha logs

# 5. Migrar e popular o banco
make migrate            # === pnpm --filter web prisma migrate dev
make seed               # === pnpm --filter web prisma db seed

# 6. App pronto em
#    http://localhost:3000             (direto)
#    http://localhost/painel/v27       (atrás do nginx)
```

---

## Variáveis de ambiente (resumo)

Veja `.env.example` para a lista canônica. Trocar antes do primeiro deploy:

- `NEXTAUTH_SECRET` — chave de sessão JWT
- `DATABASE_URL` — Postgres
- `REDIS_URL` — Redis (BullMQ)
- `USE_MOCK_CONNECTORS` — `true` em dev, `false` quando ERP/CRM/SharePoint estiverem disponíveis
- `SMTP_*` — saída de e-mail (briefing, alertas)
- `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_*` — bot do canal `#diretoria-comercial` e `#alertas-painel-v27`
- `AZURE_AD_*` / `GOOGLE_*` — SSO (fase 2)

---

## Comandos úteis

| Comando | Descrição |
|---|---|
| `make up` / `make down` / `make restart` | Compose |
| `make logs` | Tail de todos os serviços |
| `make migrate` | Cria migration nova |
| `make migrate-deploy` | Aplica migrations em produção |
| `make seed` | Popula o banco |
| `make studio` | Abre Prisma Studio |
| `make test` | Vitest em todos os pacotes |
| `make test-e2e` | Playwright |
| `make typecheck` | tsc --noEmit |
| `make format` | Prettier |
| `make clean` | Limpa node_modules e builds |

---

## Decisões arquiteturais firmadas

1. **Versão Diretoria vs Produto** — não são dois apps, é um toggle no
   header (`R$ ↔ Peças`) controlado por permissão. ANALISTA fica
   travado em **Peças**; ADMIN/GESTOR podem alternar.
2. **Sem aba "Diretoria · Briefing"** — as 4 abas do protótipo
   (`Negócio · Marca·Cidade · Produto·Estratégia · Mapa de Ataque`)
   permanecem. O briefing semanal automático com PDF/Slack/email
   continua existindo, mas como **job de background + botão "Exportar
   PDF" no header**, sem aba dedicada.
3. **Conectores começam em modo mock** — `USE_MOCK_CONNECTORS=true`
   carrega `painel_v27/d_v12.json` e amigos como fixtures. ERP/CRM/SharePoint
   reais ficam plugáveis quando as credenciais existirem.
4. **SSO é fase 2** — login fase 1 é Credentials (e-mail + senha bcrypt).
   A estrutura `next-auth/providers` já está pronta para receber Azure AD
   e Google Workspace sem refactor.
5. **Domínio de publicação** — `https://bi.catarina.local/painel/v27`.

---

## Status de Implementação

| Etapa | Descrição | Status |
|---|---|---|
| 1 | Scaffold (monorepo · Next.js · Tailwind · paleta · Docker · Make) | ✅ concluída |
| 2 | Auth + matriz de permissões + middleware | ⏳ pendente |
| 3 | Prisma schema completo + migrations + seed de domínio | ⏳ pendente |
| 4 | Conectores (ERP · CRM · SharePoint) com testes mock | ⏳ pendente |
| 5 | Jobs BullMQ + admin "Testar / Sincronizar agora" | ⏳ pendente |
| 6 | UI · aba Negócio (KPIs, SSS macro, perfil, top clientes, UF YoY) | ⏳ pendente |
| 7 | UI · aba Marca · Cidade (SSS por marca, perfil IBGE, top cidades) | ⏳ pendente |
| 8 | UI · aba Produto · Estratégia (faixas, ABC, top 30, mix) | ⏳ pendente |
| 9 | UI · aba Mapa de Ataque | ⏳ pendente |
| 10 | Briefing semanal + PDF (Puppeteer) | ⏳ pendente |
| 11 | Notificações Slack/email + alerta de desvio em tempo real | ⏳ pendente |
| 12 | E2E Playwright + screenshot diff vs protótipo | ⏳ pendente |
| 13 | Deploy Docker + Nginx + README final + smoke prod | ⏳ pendente |

A cada etapa: rodar testes, commit convencional, atualizar a tabela acima.

---

## Como adicionar uma nova fonte de dados

(Será documentado em detalhe na etapa 4.)

1. Implementar `Connector` em `packages/connectors/src/<minha-fonte>.ts`
2. Adicionar registro em `DataSource` (Prisma) via seed
3. Criar job em `packages/jobs/src/sync-<minha-fonte>.job.ts`
4. Registrar no scheduler de jobs (BullMQ)

## Como adicionar um novo perfil de usuário

(Será documentado em detalhe na etapa 2.)

1. Adicionar valor ao enum `Role` em `prisma/schema.prisma`
2. Atualizar a matriz em `apps/web/lib/permissions.ts`
3. Cobrir com teste e2e

## Como reverter um deploy

(Será documentado em detalhe na etapa 13.)

```bash
git revert <sha>
make build && make up
```

---

## Referência visual

Os arquivos em `painel_v27/` (`template.html`, `styles.css`,
`dashboard_diretoria.js`, `dashboard_produto.js`, `build.py`, datasets)
são a fonte de verdade visual da v0. **Não devem ser editados** — toda a
réplica visual acontece dentro de `apps/web/`.

A paleta foi extraída de `painel_v27/styles.css` e está fixada em
`apps/web/tailwind.config.ts` + `apps/web/app/globals.css`:

```
cream  #faf5ed   paper  #fefbf5   beige  #f5ecd9
amber  #d4a574   burnt  #c9885f   terra  #8b4a3a
deep   #4a2318   sage   #6b8a5f   rust   #b54a2a
gold   #c9a855
```

Fontes: **Fraunces** (display), **IBM Plex Sans** (corpo), **JetBrains Mono** (números).
