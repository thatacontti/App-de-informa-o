# Roteiro de construção com o Claude Code
## Da versão protótipo à versão corporativa, uma fase por vez

Use este roteiro dentro do Claude Code, na pasta do projeto. Copie um prompt por vez, revise o plano que o Claude Code apresentar, aprove as mudanças e só passe para a fase seguinte quando a atual estiver funcionando. Os prompts estão prontos para colar.

## Fase 0: reconhecimento (primeira sessão)

    Leia o CLAUDE.md, o docs/arquitetura.md, o docs/schema.sql e o src/App.jsx.
    Me dê um resumo de 10 linhas do que o sistema faz, das regras de negócio
    invioláveis e do plano de fases. Não altere nada ainda.

## Fase 1: fundação do backend

    Em modo plano: crie a estrutura do backend em server/ com Node, TypeScript e
    Fastify, conectando ao PostgreSQL local. Aplique o docs/schema.sql como
    migração inicial. Crie o endpoint GET /api/v1/saude que verifica a conexão
    com o banco. Adicione ao package.json os scripts para subir o backend e
    rodar as migrações. Não mexa no frontend.

## Fase 2: cadastros mestres via API

    Implemente as rotas REST de cadastros conforme a seção 2 do
    docs/arquitetura.md: centros de custo, categorias, subcategorias,
    fornecedores e ações. Sem DELETE físico, apenas PATCH de status. Validação
    com Zod. Escreva testes para: código de centro de custo duplicado,
    inativação e reativação.

## Fase 3: autenticação e perfis

    Implemente login com JWT e os seis perfis do schema (administrador,
    financeiro, gestor de área, operacional, diretoria, auditoria), com a
    tabela usuario_centros_custo limitando o que gestor de área e operacional
    enxergam. Crie o usuário administrador inicial via script de seed.

## Fase 4: orçamento e lançamentos

    Implemente as rotas de orçamento (versões, linhas, distribuição mensal) e
    de lançamentos, reproduzindo exatamente as validações do protótipo em
    src/App.jsx: bloqueio de centro de custo inativo, aviso de NF duplicada por
    fornecedor, aviso de orçamento insuficiente no mês com confirmação
    explícita no segundo request, cancelamento com motivo obrigatório, e log de
    alterações em toda escrita. Inclua a view vw_consolidado_mensal nas
    consultas do dashboard. Testes para cada validação.

## Fase 5: importação de planilhas no servidor

    Mova a lógica de importação do src/App.jsx para o backend: análise do
    arquivo com detecção automática do cabeçalho, mapeamento, validação linha a
    linha, confirmação em transação única com lote, hash SHA-256 do arquivo
    para detectar reimportação, estorno de lote, criação automática de
    fornecedores e ações com a mesma tolerância de grafia (funções normTxt,
    distanciaTxt e mesmoNome). Reembolso versus pagamento direto preservados.

## Fase 6: migrar o frontend para a API

    Crie em src/servicos/ uma camada de acesso à API e migre o frontend do
    getStore() para essas chamadas, tela por tela, começando por Cadastros.
    Adicione a tela de login. O visual e os textos não mudam. Ao final, o
    IndexedDB fica apenas como rascunho offline opcional ou é removido.

## Fase 7: anexos, aprovações e fechamento

    Implemente upload de anexos para storage de arquivos (S3 ou compatível,
    conforme tabela anexos), o fluxo de aprovação por alçadas (tabelas alcadas
    e aprovacoes) com notificações, e os relatórios com exportação XLSX.
    Prepare o docker-compose para desenvolvimento e o guia de deploy.

## Dicas de condução

- Se o Claude Code propuser algo que contrarie o CLAUDE.md, aponte: "isso fere a regra X do CLAUDE.md". Ele corrige.
- Ao final de cada fase, peça: "rode os testes e me mostre um resumo do que foi construído e do que ficou pendente".
- Se uma sessão ficar longa, encerre e abra outra: o CLAUDE.md recoloca o contexto automaticamente.
- Commits frequentes: peça "faça um commit com o que concluímos" ao fechar cada bloco de trabalho.
