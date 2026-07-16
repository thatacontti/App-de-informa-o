# Plataforma do Representante · Grupo Catarina

Aplicação da **representantes.grupocatarina.com**: login por representante,
Painel V27, Minha Carteira (histórico por coleção e marca), Formulário de
Análise da Ação com **motor de recomendação**, fluxo de **aprovações**,
**status de coleção** e integração com o **ERP Excia**.

> Substitui o protótipo estático (dados embutidos no HTML) por um backend
> que **segrega a carteira no servidor** — cada representante vê apenas os
> próprios clientes. Ver a especificação completa em `CLAUDE_SPEC.md`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 20+ · Express |
| Banco | SQLite (better-sqlite3) — suficiente para os 32 usuários; migração p/ Postgres documentada |
| Auth | JWT em cookie httpOnly · bcrypt · rate-limit no login |
| Frontend | Os HTMLs aprovados (`views/`), servidos pelo Express — dados vêm da API, **layout não foi redesenhado** |
| Deploy | Docker Compose + Nginx (subdomínio) · certbot |

## Estrutura

```
apps/representantes/
├── server/
│   ├── index.js            # app Express: estáticos, views e API
│   ├── db.js · schema.sql  # SQLite + schema
│   ├── seed.js             # popula usuarios/clientes/historico do plataforma_data.json
│   ├── auth.js             # JWT, papéis, segregação
│   ├── routes/api.js       # contratos da API
│   └── lib/
│       ├── motor.js        # motor de recomendação (fonte da verdade)
│       └── excia.js        # integração ERP Excia (vendas + status de coleção)
├── views/                  # plataforma, formulario, aprovacoes, painel_colecao, painel_projeto
├── public/                 # assets, produtos, uploads (fotos), manuais (PDFs)
├── data/                   # plataforma_data.json, colecao_data.json, csv/xlsx de origem
└── Dockerfile
```

## Rodar local

```bash
cd apps/representantes
npm install
cp .env.example .env          # ajuste JWT_SECRET; COOKIE_SECURE=false p/ http local
node server/seed.js --reset   # popula o banco (idempotente; boot também semeia se vazio)
npm start                     # http://localhost:8080
```

Acessos de teste (senha inicial = Cód RC; troca obrigatória no 1º acesso):

| Perfil | Cód | Senha | Vê |
|---|---|---|---|
| Representante (Bruno · SP) | `81` | `81` | só a carteira dele (102 clientes) |
| Representante (Rony) | `1` | `1` | só a carteira dele |
| Diretoria / Carteira Casa | `0` | `0000` | tudo (admin) |
| Gestor comercial (aprovações) | `gestor` | `gestor` | fila de aprovação |
| Head marketing (aprovações) | `marketing` | `marketing` | fila de aprovação |

## Páginas

| Rota | Descrição |
|---|---|
| `/` | Plataforma (login + Painel + Carteira + Coleção + Manuais) |
| `/formulario?codcli=XXXX` | Análise da ação + motor + prescrição |
| `/aprovacoes` | Fila de aprovação (gestor/marketing/diretoria) |
| `/painel-colecao` | Painel oficial de coleção |
| `/projeto` | Painel do projeto (restrito a admin) |
| `/healthz` | Probe de saúde |

## API (resumo)

`POST /api/login` · `POST /api/logout` · `GET /api/me` · `POST /api/senha` ·
`GET /api/reps` · `GET /api/carteira[?format=csv]` · `GET /api/cliente/:codcli` (403 se fora da carteira) ·
`GET /api/painel` · `GET /api/colecao` · `POST /api/prescricao` · `GET /api/prescricoes` ·
`GET /api/aprovacoes` · `POST /api/aprovacoes/:protocolo` · `GET /api/cargas` ·
`GET /api/excia/status` · `POST /api/excia/sync` (admin) · `GET /api/manuais`.

**Segregação** é feita no servidor (`WHERE rep_cod = ?`), nunca no cliente.

## Integração Excia (ERP)

A API do Excia só responde na LAN da empresa (`192.168.1.6:211`), então o
VPS (fora da rede) **não a alcança diretamente**. Por isso há dois modos
(`EXCIA_MODE` no `.env`):

- **`file`** (padrão no VPS): a plataforma lê o último export processado
  (`data/colecao_data.json` para status de coleção; banco semeado para vendas).
  A atualização é feita por carga (rodar o `scripts/excia-agent.mjs` dentro
  da rede e publicar os dados, ou o `atualiza_plataforma.py`).
- **`live`** (rodando dentro da rede): `POST /api/excia/sync` ou
  `node server/lib/excia.js --sync --since dd/mm/aaaa` puxa `/PedidoLista`,
  atualiza o histórico V27 por cliente e regenera o status de coleção.

O mapa de coleções (V20…V27) é o mesmo do `scripts/excia-agent.mjs`.

## Deploy no VPS (Hostinger) → representantes.grupocatarina.com

Os artefatos estão em `deploy/representantes/`. Ver o **checklist de go-live**
em `deploy/representantes/README.md`. Resumo:

```bash
cd deploy/representantes
./deploy.sh          # build + up (Docker Compose: app + nginx)
```

Enquanto o domínio **não** está liberado, o app já sobe em HTTP (porta 80) e
pode ser testado pelo IP do VPS. Quando `representantes.grupocatarina.com`
apontar para o VPS, emitir o certificado (certbot) e habilitar o bloco HTTPS
do nginx — passo a passo no README do deploy.

## Fidelidade de dados (critério de aceite)

- Total `fat24m` do seed = **R$ 837.026.194** (2.374 clientes, 32 reps).
  Conferir contra o relatório oficial do Excia a cada carga.
- Clientes de verificação do motor: `144` (curva A · up · 3 marcas),
  `433` (B · down), `2` (C · down → o motor bloqueia ações caras e cai no
  kit de manutenção com alerta). Prescrição sem 2 fotos → 400; reprovação
  sem justificativa → 400; kit acima de R$ 5.000 → alçada comitê.

## Migração para Postgres (futuro)

O schema (`server/schema.sql`) é SQL padrão. Trocar `better-sqlite3` por `pg`
e ajustar `db.js` (prepared statements → parametrizados `$1`). O restante da
API não muda.
