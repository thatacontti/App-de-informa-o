# Sistema de Gestão Orçamentária e Controle de Prestação de Serviços

## O que é este projeto

Sistema de gestão orçamentária corporativa: planejamento anual por centro de custo com distribuição mensal, lançamentos de valores comprometidos e realizados, importação de planilhas de despesas e relatórios de reembolso, cronograma de ações com previsto versus realizado, dashboard executivo com alertas, e anexos de comprovantes em PDF.

O arquivo `src/App.jsx` contém o protótipo funcional completo e validado. Ele é a REFERÊNCIA DE COMPORTAMENTO: toda regra de negócio, validação, fluxo de tela e texto de interface da versão corporativa deve reproduzir o que o protótipo faz, salvo instrução contrária. Os documentos `docs/arquitetura.md` (stack, APIs, fases) e `docs/schema.sql` (modelo PostgreSQL definitivo) definem a versão de deploy.

## Estado atual e destino

- Atual: aplicativo React single-file, usuário único, dados no IndexedDB do navegador (via camada `getStore()` em App.jsx).
- Destino: aplicação corporativa multiusuário com backend Node, banco PostgreSQL conforme `docs/schema.sql`, autenticação com perfis, alçadas de aprovação e anexos em storage dedicado.
- A migração é incremental, pelas fases descritas em `docs/arquitetura.md` e no `ROTEIRO-CLAUDE-CODE.md`. Nunca reescrever tudo de uma vez.

## Stack

- Frontend: React 18 + Vite, Tailwind CSS v4 (plugin @tailwindcss/vite), Recharts, lucide-react, SheetJS (xlsx) para planilhas.
- Backend (a construir): Node.js + Fastify ou NestJS, TypeScript, PostgreSQL 15+, acesso a dados com Prisma ou Knex, validação com Zod, JWT para autenticação.
- O schema do banco em `docs/schema.sql` é a fonte da verdade do modelo de dados. Não inventar tabelas nem colunas: se algo faltar, propor a alteração do schema primeiro.

## Regras de negócio invioláveis

1. Nenhuma exclusão física de lançamentos, linhas orçamentárias ou lotes. Tudo é soft delete via status (ativo, cancelado, estornado, substituido) com registro em log de alterações.
2. Lançamento em centro de custo inativo é BLOQUEADO. Nota fiscal duplicada para o mesmo fornecedor e orçamento insuficiente no mês geram AVISO com confirmação explícita, nunca bloqueio silencioso.
3. Saldo disponível = orçado aprovado − comprometido − realizado. Percentual de consumo = (comprometido + realizado) / orçado.
4. Alertas em 80% (atenção) e 90% (risco) do orçamento, configuráveis; acima de 100% é excedido.
5. Importação sempre em lote com identificador, com estorno que cancela (não apaga) todos os lançamentos do lote.
6. A importação de relatórios de despesas localiza o cabeçalho da tabela automaticamente, ignora linhas de subtotal/total, soma múltiplas colunas de valor por linha, deriva a competência da data, e distingue reembolso de pagamento direto do financeiro.
7. Ações são vinculadas a lançamentos pelo prefixo do motivo (texto antes da barra), com tolerância a pequenas variações de grafia (ver funções normTxt, distanciaTxt e mesmoNome em App.jsx).
8. A data de aprovação de um orçamento não é o mês de competência: valores são distribuídos nos meses de execução do gasto.

## Convenções

- Todo texto de interface, mensagens de erro, comentários de código e commits em português do Brasil.
- Sem emojis na interface e nas mensagens. Tom institucional direto.
- Moeda em BRL com Intl.NumberFormat pt-BR. Datas exibidas em dd/mm/aaaa, armazenadas em ISO.
- Paleta: navy #122A43 (institucional), verde #2F7D5B (dentro do orçamento), amarelo #C79A12 (atenção), laranja #D0662A (risco), vermelho #BE3A40 (excedido). Fonte Archivo.
- Nunca usar window.confirm, window.alert ou window.prompt: sempre modais internos (componentes Modal e ConfirmBox já existem).
- Banco em snake_case, UUIDs como chave, timestamps criado_em e atualizado_em.
- Antes de alterar comportamento existente, ler a implementação correspondente em App.jsx e preservar as validações.

## Comandos

- `npm install` instala dependências
- `npm run dev` sobe o frontend em http://localhost:5173
- `npm run build` gera a versão de produção em dist/

## Como trabalhar neste projeto

- Para tarefas grandes, usar Plan Mode: apresentar o plano antes de editar.
- Uma fase do ROTEIRO-CLAUDE-CODE.md por vez, com o sistema funcionando ao final de cada uma.
- Ao criar o backend, colocar em `server/` sem quebrar o frontend atual; o frontend migra do getStore() para a API por último, atrás de uma camada de serviço.
- Escrever testes para as regras de negócio da seção acima antes de refatorá-las.

## Infraestrutura de produção

- Hospedagem em VPS Hostinger (Ubuntu 24.04 com Docker). Orquestração via docker-compose.yml na raiz: serviços portal (Caddy servindo o build do frontend, HTTPS automático, senha via basic_auth), banco (PostgreSQL 16 com docs/schema.sql aplicado no primeiro boot) e adminer (administração do banco em /adminer).
- O guia operacional completo está em GUIA-HOSTINGER.md. Backups diários via scripts/backup.sh.
- Quando o backend for criado (server/), ativar o serviço api comentado no docker-compose.yml e a rota /api/* no infra/Caddyfile. A string de conexão vem da variável DATABASE_URL montada no compose.
- Nunca expor a porta 5432 publicamente e nunca gravar segredos em arquivos versionados: tudo sensível vive no .env do servidor.

## Implantação no VPS

- A implantação e a atualização do servidor são feitas por bash scripts/implantar.sh (rsync + docker compose up no VPS), configurado pelo .env.implantacao local (nunca versionado). O procedimento autônomo completo está em PROMPT-DEPLOY-HOSTINGER.md.
- Regras ao operar o servidor: confirmação explícita antes de comandos destrutivos (down -v, rm, firewall), segredos apenas no .env do servidor, máximo de três tentativas por etapa antes de consultar o usuário.
