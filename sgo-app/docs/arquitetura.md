# Sistema de Gestão Orçamentária e Controle de Prestação de Serviços
## Documento de arquitetura (v1)

Este documento orienta a versão de deploy do sistema. O protótipo funcional (sistema-orcamentario.jsx) valida as regras de negócio; o schema.sql define o modelo de dados definitivo. A implementação do backend segue este documento.

## 1. Stack sugerida

Frontend: React com Vite, TypeScript, Tailwind CSS e Recharts. A base visual e os componentes do protótipo são reaproveitáveis diretamente.

Backend: Node.js com NestJS (ou Fastify para uma versão mais enxuta), TypeScript, Prisma ou Knex como camada de acesso ao banco. Validação de payloads com Zod.

Banco de dados: PostgreSQL 15 ou superior, conforme schema.sql. Armazenamento de anexos em S3 ou compatível (a tabela anexos guarda apenas o caminho).

Autenticação: JWT com refresh token, senhas com bcrypt. Perfis e permissões conforme tabelas perfis, permissoes e perfil_permissoes.

Processamento de planilhas: no backend, com a biblioteca SheetJS (xlsx) em worker separado para arquivos grandes. O hash SHA-256 do arquivo (lotes_importacao.hash_arquivo) impede reimportação silenciosa do mesmo arquivo.

Infraestrutura: Docker Compose para desenvolvimento (app, api, postgres). Em produção, qualquer provedor com PostgreSQL gerenciado (Railway, Render, AWS RDS ou equivalente).

## 2. Estrutura de APIs (REST)

Convenção: /api/v1, autenticação obrigatória, respostas em JSON, paginação por cursor nas listagens.

Cadastros:
- GET/POST/PUT /centros-custo, /categorias, /subcategorias, /fornecedores, /projetos, /acoes, /contas-contabeis
- PATCH /centros-custo/:id/status (inativar e reativar; nunca DELETE físico)

Orçamento:
- GET/POST /orcamento/versoes
- POST /orcamento/versoes/:id/vigente (torna a versão vigente e encerra a anterior)
- GET/POST/PUT /orcamento/linhas (payload inclui a distribuição mensal; a API grava orcamento_mensal)

Lançamentos:
- GET /lancamentos (filtros: exercício, mês, centro de custo, categoria, ação, fornecedor, tipo, status, origem, busca textual)
- POST /lancamentos (executa as validações da seção 3 e retorna avisos não bloqueantes para confirmação)
- PUT /lancamentos/:id
- POST /lancamentos/:id/cancelar (motivo obrigatório; grava em log_alteracoes)
- POST /lancamentos/:id/realizar (gera lançamento realizado a partir de um comprometido, vinculado por lancamento_origem_id)

Importação:
- POST /importacoes/analisar (upload; retorna colunas detectadas e sugestão de mapeamento)
- POST /importacoes/validar (mapeamento; retorna relatório linha a linha com erros e avisos)
- POST /importacoes/confirmar (cria o lote e os lançamentos em transação única)
- POST /importacoes/:loteId/estornar

Aprovações:
- GET /aprovacoes/pendentes
- POST /aprovacoes/:id/aprovar e /aprovacoes/:id/rejeitar (parecer obrigatório na rejeição)

Consolidados e relatórios:
- GET /dashboard/consolidado (baseado na view vw_consolidado_mensal)
- GET /dashboard/alertas
- GET /relatorios/execucao, /relatorios/fornecedores, /relatorios/acoes (com exportação XLSX e PDF)

## 3. Regras de negócio no backend

Validações bloqueantes: centro de custo inexistente ou inativo, categoria obrigatória, valor menor ou igual a zero, mês de competência inválido, exercício encerrado.

Validações com aviso (retornam warning e exigem confirmação explícita no segundo request): nota fiscal duplicada para o mesmo fornecedor, orçamento insuficiente no mês, fornecedor não cadastrado na importação.

Rastreabilidade: nenhuma exclusão física. Toda escrita gera registro em log_alteracoes com usuário, ação, campo, valor anterior, valor novo e motivo quando aplicável.

Alçadas: ao criar um lançamento do tipo solicitado, o backend consulta a tabela alcadas pelo valor e gera as etapas em aprovacoes na ordem definida. O lançamento só passa a comprometido após a última aprovação.

Alertas: job periódico (ou trigger por escrita) avalia regras_alerta contra a view consolidada e grava em notificacoes para os responsáveis dos centros de custo afetados.

## 4. Plano de implementação por fases

Fase 1: cadastros mestres, autenticação e perfis.
Fase 2: planejamento orçamentário com versões e distribuição mensal.
Fase 3: lançamentos manuais com validações e trilha de auditoria.
Fase 4: importação de planilhas com lotes e estorno.
Fase 5: dashboard executivo, mapa de calor e alertas.
Fase 6: fluxo de aprovação por alçadas e notificações.
Fase 7: relatórios com exportação e leituras automáticas em linguagem natural.

O protótipo entregue já cobre funcionalmente as fases 2, 3, 4 e 5 em modo usuário único, servindo como referência de comportamento esperado para o desenvolvimento.
