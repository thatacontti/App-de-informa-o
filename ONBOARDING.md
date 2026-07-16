# ONBOARDING · Continuar a Plataforma do Representante (Grupo Catarina)

Guia de handoff para uma nova sessão do Claude Code **terminar** este projeto.
Leia inteiro antes de codar. Todo o código já está no branch abaixo.

- **Branch:** `claude/grupo-catarina-domain-setup-hfu1vy`
- **PR:** #14 (aberto, base `main`) — https://github.com/thatacontti/App-de-informa-o/pull/14
- **Destino de produção:** `representantes.grupocatarina.com` (VPS Hostinger)
- **Admin do site:** Thatiane Marques (`thatiane.marques@grupocatarina.com`), login `0`/`0000`.

Para começar: `git fetch && git checkout claude/grupo-catarina-domain-setup-hfu1vy`.

---

## 1. Contexto do repositório

Monorepo com **dois produtos distintos**:
1. **Painel V27** (`apps/web`, Next.js) — BI da diretoria/produto, em `bi.catarina.local/painel/v27`. **Não é o foco** deste branch.
2. **Plataforma do Representante** (`apps/representantes`, Node/Express+SQLite) — **É este trabalho.** Deploy em `representantes.grupocatarina.com`.

Fonte de dados/RPN reutilizável: pasta `painel_v27/` (protótipo estratégico com
`build.py`, `template.html`, `dashboard_produto.js`, `sku_final.json`,
`d_v12.json`, `v26_por_marca.json`, `cidade_perfil.json`). Integração Excia
existente: `scripts/excia-agent.mjs` (EXCIA LAN → Base44).

---

## 2. O que JÁ ESTÁ PRONTO (neste branch)

App `apps/representantes/` (Node 20 + Express + better-sqlite3), verificado
rodando nativamente (`node server/index.js`):

- **Auth** (`server/auth.js`): login Cód RC + senha, JWT em cookie httpOnly,
  troca de senha obrigatória no 1º acesso (`/api/senha` + modal na plataforma),
  rate-limit no login. Papéis: representante, gestor, marketing, admin.
- **Segregação no servidor**: `carteiraRows()` filtra por `rep_cod`; `/api/cliente/:codcli` dá 403 fora da carteira. Diretoria/gestão veem tudo.
- **Seed** (`server/seed.js`): 32 reps + 2.374 clientes de `data/plataforma_data.json`. `fat24m` total = **R$ 837.026.194** (conferir contra Excia). Roda sozinho no 1º boot.
- **Motor de recomendação** (`server/lib/motor.js`): porte fiel do `formulario.html` — dores C1..C10, cardápio de ações, variantes A8, alçada por valor, bloqueios (curva C em queda). Fonte da verdade no POST `/api/prescricao` (valida ≥2 fotos).
- **Fila de aprovações** (`/aprovacoes`, `server/routes/api.js`): transições do toolkit (comercial→marketing→[shopping se P3]→aguardando_termo; reprovar exige justificativa).
- **E-mail** (`server/lib/mailer.js`): nodemailer/SMTP com fallback console; notifica gestor/marketing/rep + admin no fluxo.
- **Status de coleção + Excia** (`server/lib/excia.js`): modo `file` (padrão VPS) lê `data/colecao_data.json`; modo `live` (LAN) puxa `/PedidoLista`. Mapa de coleções V20..V27.
- **Frontend portado** (`views/`): `plataforma.html` e `formulario.html` com dados via API/`window.__BOOT__` (blobs embutidos removidos); `aprovacoes.html` nova; `painel_colecao.html` (painel estratégico completo com 360 imagens) servido em `/painel-colecao`; `painel_projeto.html` em `/projeto` (admin).
- **Deploy** (`deploy/representantes/`): `Dockerfile`, `docker-compose.yml` (app+nginx), `provision-vps.sh` (bootstrap do zero: instala Docker, gera JWT_SECRET, sobe), `deploy.sh` (re-deploy), `enable-https.sh` (certbot + HTTPS turnkey), `nginx-representantes.conf`/`nginx-https.conf`, `README.md`, `GUIA_PASSO_A_PASSO.md`, `EMAIL_SKYMAIL_CONFIG.md`.

Rodar/testar local:
```bash
cd apps/representantes && npm install && cp .env.example .env
# COOKIE_SECURE=false p/ http local
node server/seed.js --reset && npm start   # http://localhost:8080
```
Logins de teste: Bruno `81`/`81` (102 clientes), Rony `1`/`1`, Diretoria `0`/`0000`, gestor `gestor`/`gestor`, marketing `marketing`/`marketing`.
Clientes de aceite do motor: `144` (A·up), `433` (B·down), `2` (C·down → bloqueia ações caras + alerta).

Prévias publicadas (artefatos, dados de demonstração):
- Plataforma: https://claude.ai/code/artifact/50427555-5b46-412b-8037-8e3589ba5324
- Formulário: https://claude.ai/code/artifact/efd32b2e-e48a-4a14-a4cd-137225b6586c
- Aprovações: https://claude.ai/code/artifact/b93e8824-78c1-42e0-ba55-8f6979853189
- Painel Estratégico (com imagens): https://claude.ai/code/artifact/727514eb-dd04-4ae8-bb44-6cd15bc59067

---

## 3. O QUE FALTA (milestones, em prioridade)

### M1 · Painel rico POR REPRESENTANTE — ✅ FEITO (16/07/2026)
Implementado em `server/lib/painelRep.js` + rota `GET /meu-painel` (alias
`/painel-rep`) em `server/index.js`:
- **Segregação no servidor**: representante abre só o próprio recorte
  (`?rep=` de outro é ignorado); diretoria/gestor/marketing têm picker e `?rep=`.
- Fonte: `data/painel_v27/` (cópia app-local de d_v12/sku_final/v26m/cidade_perfil
  + template/styles/dashboard_produto, para o build Docker) com fallback para
  `painel_v27/` na raiz. Trocar para a API do Excia quando exposta = reescrever
  só o `load()` de `painelRep.js`.
- Payload por rep: `D` filtrado por `NOME_REP` (custos `ct/cu` zerados — não
  vazam ao cliente), `IMG` só dos SKUs usados, `V26M`/`CIDADE_PERFIL` subset,
  `UFYOY` recalculado por rep. Mapeamento `usuarios.rz → NOME_REP` por
  normalização de razão social (7 RCs sem dados V27 ganham aviso amigável).
- Seções novas server-side: **Benchmark Nacional** (SSS por marca/UF rep ×
  nacional), **Assertividade piso 400 pç** (campeões nacionais × gaps com foto)
  e **Cartela por Coordenado** (Marca→Coordenado→SKU com cobertura/gap);
  o mapa dinâmico original continua respondendo aos filtros.
- Imagens deduplicadas: seções estáticas usam `<img data-sku>` hidratado do
  `IMG` (página ~6 MB; cache LRU de 8 painéis em memória).
- Corrigido de passagem: stub `#ins-b` (o dashboard escrevia num id inexistente
  e o `render()` morria no fim — o MESMO bug segue latente em
  `views/painel_colecao.html`, onde hoje é inofensivo/protetor do mapa estático).
- `better-sqlite3` atualizado p/ ^12 (prebuilds Node 22/24; a 11.x não compila
  sem VS Build Tools no Windows).
- Validação: números do painel B2B conferidos contra cálculo independente de
  `d_v12.json` (peças, SSS macro/marca/UF, assertividade) — tudo bate.

**Golden Rules inegociáveis (doc v2.0 §2) — aplicar em qualquer cálculo:**
- SSS só no perfil **Moda** (`DESCRICAO='COLEÇÃO'`); isolar ESPECIAL(atacado)/SALDO.
- Filtro coleção: `COLECAO in (40,41)` p/ V27; `(36,37)` p/ V26; excluir `DESC_GRUPO='SACOLAS'`.
- Tamanho = `DESC_LINHA`; estampa = `DESC_COORDENADO`.
- **Bug recorrente:** nunca rodar `.replace(',', '.')` em string com base64 (corrompe `data:image/jpeg;base64,`). Formatar números ANTES de embutir imagens, ou corrigir `base64.`→`base64,` depois.
- base64 das imagens vem **sem** prefixo; adicionar `data:image/jpeg;base64,` na render.
- Painel é por **representação (NOME_REP)**, não por pessoa (titular × preposto).
- Normalizar datas (serial Excel → ISO) e cortar V26 no mesmo "dia da temporada" do V27.

### M2 · Logo do Grupo Catarina (bloqueado — precisa de asset)
O arquivo `public/assets/logo_gc_horizontal.png` (e derivados embutidos) está com
o wordmark **invertido/espelhado** (lê "GRUPO CATARINA" ao contrário). Nenhum
flip/rotação simples corrige (inverte as letras). **Ação:** pedir à usuária a arte
correta (SVG/PNG horizontal, fundo transparente) e re-embutir em login + topo.
(No topo já se trocou o monograma vertical pela horizontal — commit `1bcd038` —
mas o asset horizontal ainda é o invertido.)

### M3 · Go-live no VPS Hostinger (operacional, guiar a usuária)
`provision-vps.sh` → site em HTTP no IP; passar IP à TI para o registro A no
GoDaddy; `enable-https.sh` após o DNS propagar. Guia não-técnico em `GUIA_PASSO_A_PASSO.md`.
A usuária NÃO é técnica e fará manualmente em modo copiloto; a TI (Anderson) só cria o DNS.

### M4 · E-mail e DNS de e-mail (SkyMail) — confirmar com TI
Preencher `SMTP_PASS` no `.env` do VPS. Confirmar os **4 pontos** de
`EMAIL_SKYMAIL_CONFIG.md`: selector DKIM real (provável placeholder "selector"),
contradição Q9×Q12, porta IMAP (usar 993), DMARC subir em `p=none` antes de quarantine + autorizar `rua` externo.

### M5 · Validações que faltaram no sandbox
- Build Docker num daemon real (aqui não havia dockerd).
- Excia `live` dentro da LAN (192.168.1.6:211, inacessível fora da rede).

---

## 4. Decisões e regras a respeitar (não rediscutir)

- **Não redesenhar** os layouts aprovados; sem framework de frontend (HTML+CSS+JS vanilla).
- **Segregação sempre no servidor**, nunca expor a base inteira no cliente.
- **Não inventar** valores/regras/textos — vêm de `apps/representantes/docs/` e dos HTMLs.
- Dados reais de clientes são sensíveis: nas prévias públicas use **dados de demonstração** (não subir clientes reais a host externo).
- Nunca commitar segredos (`.env`, `SMTP_PASS`, tokens). `db/*.sqlite` e `node_modules` são gitignored.

---

## 5. Mapa rápido de arquivos

```
apps/representantes/
  server/index.js        app Express (rotas de view + estáticos + /api)
  server/routes/api.js    todos os endpoints
  server/auth.js·db.js·seed.js·schema.sql
  server/lib/motor.js·excia.js·mailer.js
  views/*.html            plataforma, formulario, aprovacoes, painel_colecao, painel_projeto
  data/                   plataforma_data.json, colecao_data.json, csv/xlsx de origem
  docs/                   TOOLKIT, VPS_ARQUITETURA, WIX, GOOGLE_SITES (regras de negócio)
  CLAUDE_SPEC.md          especificação mestre original
deploy/representantes/    Dockerfile, compose, scripts de deploy/HTTPS, guias
painel_v27/               fonte do painel estratégico/RPN (build.py + dados)
scripts/excia-agent.mjs   sync EXCIA→Base44 (referência do contrato Excia)
```

Ponto de partida sugerido para a próxima sessão: **M2** (pedir a arte correta do
logo à usuária) e **M3** (go-live no VPS em modo copiloto) — o M1 já está no branch.
