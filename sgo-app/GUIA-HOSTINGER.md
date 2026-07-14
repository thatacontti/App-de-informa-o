# Fluxo de trabalho: hospedagem na Hostinger (VPS)
## Portal de acesso, banco de dados PostgreSQL e infraestrutura da gestão orçamentária

Este guia leva do zero ao portal no ar, em endereço próprio com HTTPS e senha, com o banco PostgreSQL provisionado e pronto para receber o backend das fases do ROTEIRO-CLAUDE-CODE.md. Tudo já está preparado nos arquivos deste projeto (Dockerfile, docker-compose.yml, infra/Caddyfile, .env.exemplo, scripts/backup.sh): o trabalho no servidor se resume a configurar e subir.

O que fica no ar ao final:
- Portal: https://orcamento.suaempresa.com.br (o sistema, protegido por senha)
- Gestor do banco: https://orcamento.suaempresa.com.br/adminer (consulta e administração do PostgreSQL pelo navegador, mesma senha)
- Banco PostgreSQL 16 com o schema.sql aplicado, acessível apenas de dentro do servidor
- Backup diário automático do banco, com 30 dias de retenção

## Etapa 1: contratar o VPS

1. Em hostinger.com.br, contrate um plano VPS KVM. O KVM 2 (2 vCPU, 8 GB RAM) é confortável para portal, banco e o futuro backend; o KVM 1 funciona para começar.
2. Durante a criação, escolha o template de sistema operacional "Ubuntu 24.04 com Docker". Ele já vem com Docker e Docker Compose instalados, dispensando configuração manual.
3. Escolha o data center de São Paulo (menor latência no Brasil).
4. Defina a senha de root e, se souber usar, cadastre uma chave SSH. As credenciais chegam por e-mail e ficam no hPanel.

## Etapa 2: apontar o domínio

No gerenciador de DNS do domínio da empresa (na própria Hostinger ou onde o domínio estiver):
1. Crie um registro do tipo A com o nome do subdomínio (ex.: orcamento) apontando para o IP do VPS (visível no hPanel, em VPS, Visão geral).
2. Aguarde a propagação (minutos a poucas horas). Teste com ping orcamento.suaempresa.com.br: deve responder com o IP do VPS.

O HTTPS é automático: o Caddy (embutido no projeto) emite e renova o certificado sozinho assim que o domínio apontar para o servidor.

## Etapa 3: acessar o servidor e enviar o projeto

Pelo terminal do seu computador (ou pelo terminal do navegador no hPanel):

    ssh root@IP_DO_VPS

Envie o projeto. Caminho recomendado: repositório Git privado (GitHub), que também serve o Claude Code:

    cd /root
    git clone https://github.com/SEU_USUARIO/sgo-app.git
    cd sgo-app

Alternativa sem Git, do seu computador:

    scp -r ./sgo-app root@IP_DO_VPS:/root/

## Etapa 4: configurar as senhas

No servidor, dentro da pasta do projeto:

    cp .env.exemplo .env
    nano .env

Preencha: DOMINIO (o subdomínio da etapa 2), POSTGRES_PASSWORD (senha forte do banco) e SENHA_PORTAL_HASH. Para gerar o hash da senha do portal:

    docker run --rm caddy:2-alpine caddy hash-password --plaintext 'SuaSenhaDoPortal'

Copie a saída (começa com $2a$) para SENHA_PORTAL_HASH no .env. Atenção: no .env, envolva o hash em aspas simples se contiver cifrões, ou duplique cada $ como $$ (exigência do Docker Compose). Guarde as senhas no cofre de senhas da empresa.

## Etapa 5: subir tudo

    docker compose up -d --build

Na primeira execução isso compila o portal, sobe o PostgreSQL e aplica o docs/schema.sql automaticamente. Verifique:

    docker compose ps          # os três serviços devem estar "running/healthy"
    docker compose logs -f     # acompanhar os registros (Ctrl+C para sair)

Abra https://orcamento.suaempresa.com.br no navegador: pedirá usuário (admin) e a senha do portal, e o sistema abre. Em /adminer, entre no banco com: sistema PostgreSQL, servidor banco, usuário e senha do .env, base orcamento. As tabelas do schema devem estar listadas.

## Etapa 6: segurança mínima

1. Firewall: no hPanel (VPS, Configurações, Firewall) ou via ufw no servidor, deixe abertas apenas as portas 22 (SSH), 80 e 443. O PostgreSQL não é exposto à internet (está amarrado ao 127.0.0.1 no compose): a administração é pelo Adminer ou por túnel SSH.
2. Backups da Hostinger: mantenha os backups semanais do VPS ativos no hPanel e considere os snapshots antes de mudanças grandes.
3. Backup do banco: agende o script diário no servidor:

    crontab -e
    0 3 * * * cd /root/sgo-app && bash scripts/backup.sh >> backups/backup.log 2>&1

4. Atualizações do sistema: mensalmente, apt update && apt upgrade -y e docker compose pull seguido de docker compose up -d.

## Etapa 7: rotina de atualização do sistema

Quando houver nova versão (gerada no Claude ou pelo Claude Code):

    cd /root/sgo-app
    git pull                          # ou substitua os arquivos alterados
    docker compose up -d --build

Sem tirar o banco do ar: só o portal é reconstruído.

## Etapa 8: encaixe com o Claude Code (backend)

O banco desta infraestrutura é o mesmo que as fases 1 a 7 do ROTEIRO-CLAUDE-CODE.md usam. Quando o backend nascer na pasta server/:
1. Descomente o bloco api no docker-compose.yml e o bloco /api/* no infra/Caddyfile.
2. Preencha JWT_SEGREDO no .env.
3. docker compose up -d --build.

A partir da fase 6 (login próprio no sistema), a senha única do portal (basic_auth do Caddyfile) pode ser removida, porque o controle de acesso passa a ser por usuário e perfil dentro do sistema.

## Entendendo os limites de cada momento

Enquanto o backend não existe (hoje): o portal no ar é a versão de um usuário; os dados de quem acessa ficam no navegador de quem acessa, não no PostgreSQL. O banco já está provisionado e com o schema aplicado, aguardando o backend. A senha do portal impede acesso de estranhos ao endereço.

Depois da fase 6: dados centralizados no PostgreSQL, vários usuários com login e perfil, mesmos dados de qualquer dispositivo. É quando o VPS passa a entregar o valor completo.

## Resolução de problemas comuns

- Portal não abre com HTTPS: o DNS ainda não propagou ou as portas 80/443 estão fechadas no firewall. O Caddy precisa da porta 80 aberta para emitir o certificado.
- "unhealthy" no banco: senha do .env alterada depois da primeira subida. Ou corrija o .env para a senha original, ou zere o volume (docker compose down -v, apaga os dados) e suba de novo.
- Esqueci a senha do portal: gere um novo hash (etapa 4), atualize o .env e rode docker compose up -d --build.
- Restaurar um backup do banco: gunzip -c backups/banco-AAAA-MM-DD.sql.gz | docker compose exec -T banco psql -U sgo -d orcamento
