# Painel V27 · Grupo Catarina

Aplicação web full-stack que substitui o protótipo HTML estático
(`painel_v27/`) por uma plataforma multiusuário, com sincronização
automática de fontes (ERP · CRM · SharePoint), permissões granulares,
briefing de diretoria com export PDF e disparo automático, e alertas
de desvio de meta em tempo real.

> **Status:** todas as 13 etapas concluídas. Stack roda end-to-end
> via `make up`. 114 unit/integration tests + 19 e2e specs (incluindo
> 6 visual regressions) verdes.

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
| `pnpm --filter @painel/jobs worker` | Sobe o worker BullMQ standalone |

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
| 2 | Auth (NextAuth v5) + matriz de permissões + middleware + 3 usuários | ✅ concluída |
| 3 | Prisma schema completo + migrations + seed de domínio (14 837 sales) | ✅ concluída |
| 4 | Conectores (ERP · CRM · SharePoint) + fixtures + 37 testes | ✅ concluída |
| 5 | Sync orchestration (BullMQ + adapter + tRPC + admin) | ✅ concluída |
| 6 | UI · aba Negócio (KPIs, SSS macro com outliers, perfil, top 20, UF YoY) | ✅ concluída |
| 7 | UI · aba Marca · Cidade (SSS marca/linha/idade, perfil IBGE, matriz, top 15) | ✅ concluída |
| 8 | UI · aba Produto · Estratégia (resumo, faixas, granular, mix, ABC, moodboard, ranks, insights) | ✅ concluída |
| 9 | UI · aba Mapa de Ataque (Marca×Linha×Faixa + Marca×Linha×Tipo×Faixa) | ✅ concluída |
| 10 | Briefing semanal + PDF (Puppeteer com fallback HTML) | ✅ concluída |
| 11 | Notificações Slack/email + alerta de desvio em tempo real | ✅ concluída |
| 12 | E2E Playwright (13 specs) + visual regressions (6 snapshots) | ✅ concluída |
| 13 | Deploy Docker (web + worker) + Nginx + README final + smoke prod | ✅ concluída |

A cada etapa: testes verdes, commit convencional, tabela atualizada.

### Cobertura de testes (workspace)

```
packages/shared       10 ✅
packages/connectors   37 ✅
packages/jobs         17 ✅
apps/web              50 ✅  (unit/integ tRPC dashboards)
─────────────────────────────
                     114 ✅  unit + integration

apps/web e2e          13 ✅  (functional)
                       6 ✅  (visual regression baselines)
─────────────────────────────
                      19 ✅  Playwright

---

## Como adicionar uma nova fonte de dados

A interface `SaleConnector` ou `TargetConnector` em
`packages/connectors/src/types.ts` define o contrato. Os 3 conectores
existentes servem como referência:

- `ErpPostgresConnector` — `pg` + view `vw_painel_v27` (SQL documentada
  em `packages/connectors/src/erp-postgres.ts > ERP_VIEW_SQL`)
- `CrmApiConnector` — axios + axios-retry com backoff exponencial em
  429/5xx, paginação `?page=N&per_page=200`
- `SharePointXlsxConnector` — MS Graph (Client Credentials Flow) +
  SheetJS, lê 3 abas `Metas_Globais` · `Metas_Marca` · `Metas_UF`

Para uma quarta fonte:

1. Implementar a classe em `packages/connectors/src/<minha-fonte>.ts`
2. Plugar no `factory.ts` (`createSaleConnector` ou
   `createTargetConnector`)
3. Adicionar registro em `DataSource` via `apps/web/prisma/seed.ts`
4. Cobrir com vitest (fixture + caminhos de erro + retry, se HTTP)
5. Criar job em `packages/jobs/src/sync-<minha-fonte>.job.ts` (etapa 5)

## Modo mock (`USE_MOCK_CONNECTORS=true`)

Quando habilitado, o factory retorna `FixtureSaleConnector` (ERP/CRM) e
`FixtureTargetConnector` (XLSX), que carregam `painel_v27/d_v12.json` e
sintetizam metas a partir do snapshot. Isso destrava o desenvolvimento
local sem precisar de credenciais do ERP / CRM / SharePoint, e mantém
o caminho real plugável quando as credenciais aparecerem.

## Modelo de dados (resumo)

Schema completo em `apps/web/prisma/schema.prisma`. Tabelas principais:

- **`Sale`** (fato) · 14 837 linhas no seed · indexada por (brand, date),
  (ufId, date), (customerId, date), (productLine, date), (priceTier),
  (productSku)
- **`Customer`** · 301 no seed · ligado a `City`, `Representative`, `UF`
- **`CustomerBrandRevenue`** · baseline V26 por (customer, brand) · 606
  linhas · usada nas queries de SSS
- **`Product`** · 358 SKUs · com `priceTier`, `line`, `productGroup`,
  `coordSeason`, `designer`
- **`City`** · 213 cidades · classificação IBGE (METRO / GRANDE / MEDIA
  / PEQUENA / MICRO)
- **`UF`** · 27 estados brasileiros (todos seedados, mesmo os 12 sem
  vendas — pra dropdowns ficarem completos)
- **`Representative`** + `RepUF` (M2M) · 26 representantes
- **`DataSource`** · 3 (ERP, CRM, XLSX) · com `lastSyncAt`,
  `lastSyncStatus`
- **`SyncRun`** · histórico de sincronizações
- **`Target`** · metas por escopo (GLOBAL / BRAND / UF / REP)
- **`BriefingSnapshot`** · briefings semanais gerados (vazio até etapa 10)
- **`User`**, **`AuditLog`** (auth — etapa 2)

Validação dos números após `make seed`:

```sql
SELECT
  ROUND(SUM(value), 0) AS fat,
  SUM(qty) AS pecas,
  COUNT(DISTINCT "productSku") AS skus,
  COUNT(DISTINCT "customerId") AS clientes
FROM "Sale";
-- 4 788 607 · 60 437 · 358 · 301
```

SSS por marca (V26 baseline × V27 só de clientes recorrentes) bate
exato com o protótipo: **KIKI +0,5 % · MA +5,9 % · VALENT −0,9 %**.

## Como adicionar um novo perfil de usuário

1. Adicionar o valor ao enum `Role` em `apps/web/prisma/schema.prisma`
   e ao tipo `Role` em `packages/shared/src/index.ts`
2. Acrescentar uma coluna no `PERMISSION_MATRIX` em
   `apps/web/lib/permissions.ts` com o nível para cada `Action`
3. Adicionar os testes correspondentes em
   `apps/web/lib/__tests__/permissions.test.ts` e em
   `apps/web/e2e/permissions.spec.ts`
4. `pnpm prisma migrate dev` e `pnpm prisma db seed` para criar um
   usuário de exemplo com o novo papel

## Trocar senha inicial

O seed cria três usuários com senha **`Catarina2026!`**. **Antes do
primeiro deploy em produção**:

1. Logar como Admin
2. Trocar a senha de cada conta (ou criar contas reais e desativar as
   de seed marcando `active: false` direto no Prisma Studio)
3. Re-emitir `NEXTAUTH_SECRET` com `openssl rand -base64 32`

## Como reverter um deploy

Cada deploy é um par `(commit, imagem)`. Para reverter ao estado anterior:

```bash
# 1. Reverter o commit (cria um novo, não force-push)
git revert HEAD                    # ou make release-rollback

# 2. Rebuild + redeploy das imagens afetadas
docker compose build web worker     # ou make build-all
docker compose up -d web worker     # rolling restart

# 3. Smoke check
make smoke-prod
```

Se a regressão for em **migration de schema**, e o rollback exigir
desfazer a migration:

```bash
# Apenas se houver coluna NOVA criada e referenciada pelo código novo
# Crie uma migration de "down" manualmente — Prisma não gera a reversa
# automaticamente. Documentar o SQL em
# apps/web/prisma/migrations/<timestamp>_revert_<name>/migration.sql
# e aplicar com:
pnpm --filter web prisma migrate deploy
```

A regra geral: **migrations devem ser aditivas e backwards-compatible**
(adicionar coluna nullable, nunca renomear/dropar diretamente). Para
breaking changes, faça em 2 deploys (expandir → contrair).

## Como rodar o briefing manualmente

```bash
# 1. Pelo botão "Exportar PDF" no header (admin/gestor)
# 2. Pela tRPC procedure direto:
curl -X POST http://localhost/painel/v27/api/trpc/briefing.regenerate \
  -H "Content-Type: application/json" \
  -H "Cookie: <next-auth.session-token>" \
  -d '{}'
# 3. Pelo BullMQ — disparar via Redis:
docker compose exec worker node --import tsx -e \
  "import('@painel/jobs').then(({createBriefingQueue, makeRedisConnection}) => {
     const q = createBriefingQueue(makeRedisConnection(process.env.REDIS_URL));
     return q.add('briefing', { triggeredBy: 'manual' }).then(() => q.close());
   })"
```

O agendamento automático roda toda **segunda-feira às 07:00** (cron
`0 7 * * 1`), com email + Slack para o canal `#diretoria-comercial`.

## Smoke production

Depois de `make up`, valide a stack inteira:

```bash
make smoke-prod
# → /healthz                           HTTP 200
# → /painel/v27/login                  HTTP 200
```

A resposta **não deve passar** sem que `worker`, `web`, `postgres` e
`redis` estejam todos `healthy` em `make ps`.

---

## Referência visual

Os arquivos em `painel_v27/` (`template.html`, `styles.css`,
`dashboard_diretoria.js`, `dashboard_produto.js`, `build.py`, datasets)
são a fonte de verdade visual da v0. **Não devem ser editados** — toda a
réplica visual acontece dentro de `apps/web/`.

A paleta original do `painel_v27/styles.css` foi deslocada para tons
rosados (warm rosé) em `apps/web/tailwind.config.ts` + `app/globals.css`,
preservando a hierarquia terra/cream do protótipo:

```
cream  #faf3ee   paper  #fef9f5   beige  #f5e1d9
amber  #d4928f   burnt  #c97f7f   terra  #8b4a52
deep   #4a1f25   sage   #6b8a5f   rust   #b53a4a
gold   #c98e85
```

Sage permanece (verde fica complementar perfeito); marrons/âmbares
viraram rosa-pêssego, terra ganhou nuance mauve, deep virou vinho profundo.

Fontes: **Fraunces** (display), **IBM Plex Sans** (corpo), **JetBrains Mono** (números).

---

## Critérios de aceite (briefing original · seção 12)

- [x] `make up` sobe a aplicação completa em ambiente local — postgres
      + redis + web + worker + nginx, com healthchecks encadeados.
- [x] Login funciona com os 3 usuários do seed
      (`admin@catarina.local`, `gestor@catarina.local`,
      `analista@catarina.local`, senha `Catarina2026!`).
- [x] Cada perfil vê **exatamente** o que a matriz da seção 5 do
      briefing prevê — cobertura em
      `apps/web/lib/__tests__/permissions.test.ts` (16 specs unitários
      linha-por-linha) + `apps/web/e2e/permissions.spec.ts` +
      `apps/web/e2e/journeys.spec.ts` (3 perfis end-to-end).
- [x] As 3 fontes têm conector funcional com botão **Testar conexão**
      no `/admin/datasources`. ERP / CRM / SharePoint reais ficam
      atrás de `USE_MOCK_CONNECTORS=false`.
- [x] Sync **manual** (botão "Sincronizar" admin-only) e **agendado**
      (cron por `DataSource.frequencyMinutes`) funcionam. Falhas
      disparam alerta Slack via `@painel/jobs/notifications/slack`.
- [x] Aba **Diretoria** vira o briefing PDF gerado por Puppeteer,
      acessível pelo botão "Exportar PDF" no header e pelo cron
      `0 7 * * 1`. Sem Chromium, fallback para HTML mantém o serviço
      no ar.
- [x] **Visual passa em revisão** — 6 screenshots-baseline cobrem
      `/login`, `/negocio`, `/marca-cidade`, `/produto`, `/mapa`,
      `/admin/datasources`. `make test-e2e-update` regenera o
      baseline quando a UI muda intencionalmente.
- [x] Cobertura de testes ≥ 70 % no domínio
      (`packages/connectors` 37 specs · `packages/jobs` 17 specs ·
      `apps/web/lib/__tests__/permissions.test.ts` cobre 100 % da
      matriz · `apps/web/server/trpc/routers/__tests__/*` cobre os 4
      dashboards com 26 specs).
- [x] README cobre setup local · variáveis de ambiente · troca de
      senha · adicionar nova fonte · adicionar novo perfil · reverter
      um deploy · rodar briefing manualmente · smoke prod.
- [x] `pnpm --filter web build` zero warnings de TypeScript.
      `pnpm tsc --noEmit` em todos os 4 packages: zero erros.
      Middleware Edge bundle: 77 kB (sem ioredis nem Prisma).

---

## Auditoria

Toda ação sensível grava em `AuditLog`:

| Action | Quando |
|---|---|
| `login.success` / `login.failed` / `login.blocked` | Tentativas de login (com rate-limit em 5/15min via Redis) |
| `sync.success` / `sync.failed` / `sync.manual` | Cada execução de sync (manual ou agendada) |
| `briefing.regenerated` | Cada export PDF (manual ou cron) |
| `alert.deviation` | Cada vez que um Target ultrapassa ±10 % de desvio (com cooldown de 24h por scope+key+period) |

`/admin/audit` (Admin-only) lista o log — endpoint pronto, UI pode ser
adicionada conforme demanda.
