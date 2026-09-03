# CLAUDE.md · ESPECIFICAÇÃO MESTRE DE CONSTRUÇÃO
## Plataforma do Representante · Grupo Catarina · representantes.grupocatarina.com

Você (Claude Code) vai construir a aplicação completa a partir deste repositório. Tudo o que precisa está aqui: dados reais, layouts aprovados, regras de negócio e o painel de integração. Leia este arquivo inteiro antes de escrever qualquer código.

---

# 1. O QUE EXISTE NESTE REPOSITÓRIO

```
gc-representantes/
├── CLAUDE.md                    (este arquivo: a especificação)
├── data/
│   ├── CADSTRO_DE_CLIENTES.xlsx (fonte Excia: clientes x coleções x marcas, valores em CENTAVOS)
│   ├── Representantes.xlsx      (roster V27: 32 RCs, aba 'VERÃO 2027', com e-mails)
│   ├── clientes.csv             (2.374 clientes processados: fat24m, curva, tendência)
│   ├── historico_colecoes.csv   (8.313 linhas: codcli x marca x coleção x valor em R$)
│   └── plataforma_data.json     (o mesmo dado consolidado em JSON: {reps, db})
├── frontend/
│   ├── plataforma.html          (LAYOUT APROVADO: design system claro tipo SaaS; funcional com dados embutidos)
│   ├── formulario.html          (Análise da Ação + motor de recomendação + prescrição; funcional)
│   ├── plataforma_sol_e_sombra.html (layout alternativo, referência apenas)
│   └── painel_projeto.html      (painel de aprovação/integração do projeto; publicar em /projeto)
├── docs/
│   ├── TOOLKIT_SELLOUT_GRUPOCATARINA.md   (regras de negócio: cardápio, motor, fluxo de aprovação, alçadas, SLAs)
│   ├── VPS_ARQUITETURA_PLATAFORMA.md      (deploy fase 1 e visão fase 2)
│   ├── WIX_IMPLEMENTACAO_FORMULARIO.md    (esquema de dados de referência: coleções/tabelas e permissões)
│   └── GOOGLE_SITES_GCREP_ESTRUTURA.md    (hub externo; fora do escopo de código)
└── scripts/
    └── atualiza_plataforma.py   (carga: xlsx -> JSON -> regenera HTMLs; já funcional)
```

# 2. DECISÕES JÁ TOMADAS (não rediscutir)

1. **Design system:** o de `frontend/plataforma.html` (fundo #ECEDEF, cartões brancos radius 20, Inter, azul #2563EB, anéis de progresso, badges pastel). Todo componente novo segue esses tokens.
2. **Dados:** valores da planilha Excia estão em centavos (÷100). Coleções agregadas: I25, T25, V26, I26, T26, V27 (Primavera+Verão somadas). Curva A/B/C por tercil da carteira; tendência = I26+T26+V27 vs I25+T25+V26 com corte de ±10%.
3. **Vínculo cliente-representante:** por UF (aproximação) até o export trazer CODREP; o código deve estar pronto para trocar para CODREP com uma flag.
4. **Regra de ouro do fluxo de ações** (docs/TOOLKIT, Seção 7): sem diagnóstico não há ação; alçadas por valor (≤1.500 regional; ≤5.000 gerência+head; acima comitê); SLA 3 dias úteis por instância; justificativa obrigatória em reprovação.
5. **Domínio:** representantes.grupocatarina.com, HTTPS obrigatório.

# 3. STACK E ARQUITETURA A CONSTRUIR

- **Backend:** Node.js 20 + Express. Banco **SQLite** (arquivo `db/gc.sqlite`) via better-sqlite3 — simples, suficiente para 32 usuários; migração p/ Postgres fica documentada.
- **Auth:** sessão JWT em cookie httpOnly. Login por e-mail (Representantes.xlsx) + senha; primeira senha = Cód RC, com troca obrigatória no primeiro acesso. Papéis: `representante`, `gestor`, `marketing`, `admin`.
- **Frontend:** os HTMLs existentes viram templates servidos pelo Express; substituir os blocos `const DATA=...`/`const DB=...` embutidos por `fetch('/api/...')`. NÃO reescrever o visual: portar.
- **Estrutura do projeto:**

```
server/index.js · server/routes/*.js · server/db/schema.sql · server/db/seed.js
public/ (assets) · views/ (plataforma, formulario, aprovacoes, projeto)
scripts/atualiza_plataforma.py (mantido p/ carga offline) 
```

# 4. BANCO DE DADOS (schema.sql)

```sql
CREATE TABLE usuarios (id INTEGER PRIMARY KEY, cod TEXT UNIQUE, nome TEXT, email TEXT UNIQUE,
  senha_hash TEXT, papel TEXT CHECK(papel IN ('representante','gestor','marketing','admin')),
  ufs TEXT, regiao TEXT, precisa_trocar_senha INTEGER DEFAULT 1);
CREATE TABLE clientes (codcli TEXT PRIMARY KEY, nome TEXT, cidade TEXT, uf TEXT,
  fat24m REAL, curva TEXT, tendencia TEXT, rep_cod TEXT);
CREATE TABLE historico (id INTEGER PRIMARY KEY, codcli TEXT, marca TEXT,
  colecao_id TEXT, colecao TEXT, ordem INTEGER, valor REAL);
CREATE TABLE diagnosticos (id INTEGER PRIMARY KEY, protocolo TEXT UNIQUE, codcli TEXT,
  rep_cod TEXT, tipologia TEXT, motivo TEXT, notas TEXT, contrapartida TEXT,
  janela TEXT, fotos TEXT, criado_em TEXT);
CREATE TABLE acoes (id INTEGER PRIMARY KEY, protocolo TEXT, codcli TEXT, kit TEXT,
  invest_min REAL, invest_max REAL, meta REAL, alcada TEXT, alertas TEXT,
  status TEXT DEFAULT 'em_aprovacao_comercial');
CREATE TABLE aprovacoes (id INTEGER PRIMARY KEY, protocolo TEXT, instancia TEXT,
  aprovador TEXT, decisao TEXT, justificativa TEXT, data_decisao TEXT);
CREATE TABLE cargas (id INTEGER PRIMARY KEY, data TEXT, responsavel TEXT,
  total_fat REAL, n_clientes INTEGER, status TEXT);
```

Seed: `server/db/seed.js` lê `data/plataforma_data.json` e `data/Representantes.xlsx` (e-mails) e popula usuarios, clientes e historico. Diretoria: usuário admin `diretoria@grupocatarina.com`.

# 5. API (contratos)

| Método e rota | Papel | Retorna / faz |
|---|---|---|
| POST /api/login · POST /api/senha | todos | sessão; troca de senha |
| GET /api/me | todos | usuário logado |
| GET /api/carteira | representante | SOMENTE os clientes com rep_cod do usuário (admin/gestor: filtros) — a segregação é feita AQUI, no servidor, nunca no cliente |
| GET /api/cliente/:codcli | dono da carteira | detalhe + histórico por coleção e marca (403 se não for da carteira) |
| GET /api/painel | representante | agregados: v26, v27, ativos, risco[], porMarca[], top10[] |
| POST /api/prescricao | representante | grava diagnóstico + ação + 1ª aprovação; retorna protocolo; valida ≥2 fotos |
| GET /api/prescricoes | representante | minhas prescrições com status/timeline |
| GET /api/aprovacoes · POST /api/aprovacoes/:protocolo | gestor/marketing | fila por instância; decisão (justificativa obrigatória se reprovar); avança status conforme docs/TOOLKIT Seção 7 (inclui etapa shopping p/ tipologia P3) |
| POST /api/admin/carga | admin | upload do xlsx; roda a lógica de scripts/atualiza_plataforma.py em Node OU chama o Python; grava em `cargas`; BLOQUEIA publicação se o total não for confirmado |
| GET /api/admin/cargas | admin | histórico de cargas (data no rodapé vem daqui) |
| POST /api/upload/foto | representante | upload de imagem (multer, max 5MB, jpg/png) p/ /uploads |

O motor de recomendação: portar o JavaScript de `frontend/formulario.html` (funções gerar/score/filtros/A8_VARIANTES) para `server/lib/motor.js` e usá-lo no POST /api/prescricao — o cliente mostra a prévia, o servidor é a fonte da verdade.

# 6. PÁGINAS

1. `/` plataforma (views/plataforma) — portar frontend/plataforma.html trocando dados embutidos por /api/painel e /api/carteira; sino = risco.length; exportar CSV via /api/carteira?format=csv.
2. `/formulario` — portar frontend/formulario.html; busca de cliente via /api/cliente/:codcli (aceita ?codcli= para pré-preenchimento); envio via /api/prescricao; tela de protocolo lê /api/prescricoes.
3. `/aprovacoes` — NOVA página (mesmo design system): fila de prescrições da instância do usuário, cartão por protocolo (cliente, motivo, kit, investimento, alçada), botões Aprovar / Ajustar / Reprovar (modal de justificativa), timeline atualizada.
4. `/projeto` — servir frontend/painel_projeto.html como está (restrito a admin).
5. `/manuais` — listar PDFs da pasta `public/manuais` automaticamente nos cards existentes.
6. `/colecao` — aba "Coleção · Produtos" da plataforma (já portada no HTML): status da campanha (dia X de 150), share por faixa Entrada/Médio/Premium vs meta 25/55/20, rank de produtos COM IMAGEM (foto, tipo, cartela, marca, faixa, peças, faturamento) e moodboard. Servir também `frontend/painel_colecao.html` na rota /painel-colecao (painel oficial completo). Dados: tabela `skus` (sku, tipo, marca, linha, cartela, faixa, margem, imagem) + `vendas_sku` (sku, codcli, qtde, faturamento, perfil_pedido), alimentadas pelo export de produto do Excia no mesmo layout do painel de referência (const SKUS/DD/IMG). Na API, GET /api/colecao filtra vendas_sku pelos clientes da carteira do representante logado; imagens servidas de /public/produtos/{sku}.jpg (extrair os base64 do painel de referência no seed).

# 7. MILESTONES (construir nesta ordem, commit por milestone)

1. **M1 Fundação:** scaffold, schema, seed com os dados reais, auth completa com troca de senha.
2. **M2 Plataforma viva:** /api/painel + /api/carteira + página / portada do HTML; teste: login de Bruno (cod 81) vê só a carteira dele; diretoria vê tudo.
3. **M3 Formulário e motor:** /formulario + motor no servidor + prescrição gravada + tela de protocolo real.
4. **M4 Aprovações:** página /aprovacoes + transições de status + e-mail (nodemailer, SMTP via .env; se SMTP ausente, logar no console).
5. **M5 Carga e operação:** POST /api/admin/carga com validação de total, /manuais, /projeto, rate-limit no login, helmet, logs.
6. **M6 Deploy:** Dockerfile + docker-compose OU systemd; Nginx proxy + certbot conforme docs/VPS_ARQUITETURA_PLATAFORMA.md; script `deploy.sh`.

# 8. CRITÉRIOS DE ACEITE (testar antes de encerrar cada milestone)

1. Segregação: um representante NUNCA recebe cliente de outro em nenhuma rota (teste automatizado com dois usuários).
2. Fidelidade de dados: total fat24m da API = total do JSON de seed = relatório Excia (registrar no README o valor).
3. Clientes de teste: 144 (curva A, up, 3 marcas), 433 (B, down), 2 (C, down → motor bloqueia ações caras e recomenda Livro de Colorir).
4. Prescrição sem 2 fotos → 400. Reprovação sem justificativa → 400. Kit > R$5.000 → alçada comitê.
5. Layout: comparar lado a lado com frontend/plataforma.html; tokens idênticos (cores, radius, Inter, anéis).
6. Lighthouse ≥ 90 em performance na plataforma logada.

# 9. O QUE NÃO FAZER

1. Não redesenhar o layout; não introduzir framework de frontend (sem React/Vue): HTML+CSS+JS vanilla como os templates.
2. Não expor a base completa no cliente (o problema da fase estática é exatamente o que esta build resolve).
3. Não inventar valores, regras ou textos: tudo vem de docs/ e dos HTMLs.
4. Não publicar carga cuja soma não bata com a confirmação do admin.
