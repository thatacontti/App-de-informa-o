# Implantação autônoma no VPS pelo Claude Code
## O que colar no Claude Code para ele construir tudo no servidor

## Antes de colar (5 minutos, uma vez só)

O Claude Code trabalha do seu computador e alcança o servidor por SSH. Para ele agir sem pedir senha a cada comando, crie a chave de acesso uma única vez, no terminal do seu computador:

    ssh-keygen -t ed25519
    ssh-copy-id root@IP_DO_VPS

(Aceite os padrões com Enter; no segundo comando, digite a senha de root do VPS que veio da Hostinger. Depois disso, nunca mais.)

Tenha em mãos: o IP do VPS (no hPanel) e o subdomínio já apontado para esse IP no DNS (registro A). Sem o DNS apontado, tudo funciona menos o certificado HTTPS, que o Caddy emite sozinho assim que o apontamento propagar.

## O PROMPT-MESTRE

Abra o terminal na pasta do projeto, digite `claude`, e cole o texto abaixo inteiro, substituindo apenas as duas primeiras linhas de dados. Use o Plan Mode se quiser revisar o plano antes (Shift+Tab).

---

Dados da implantação:
- IP do VPS: COLOQUE_O_IP_AQUI
- Domínio do portal: COLOQUE_O_SUBDOMINIO_AQUI (ex.: orcamento.empresa.com.br)
- Usuário SSH: root (chave já configurada, sem senha)
- Pasta de destino no servidor: /root/sgo-app

Missão: implantar este projeto no VPS acima do início ao fim, de forma autônoma, seguindo o GUIA-HOSTINGER.md e usando o scripts/implantar.sh como mecanismo de envio. Execute as etapas abaixo em ordem, validando cada uma antes de seguir, e me traga um relatório final.

1. Pré-checagens: confirme por SSH que o servidor responde, que Docker e Docker Compose estão instalados (se não estiverem, instale o Docker pelo script oficial get.docker.com) e verifique com dig ou nslookup se o domínio já resolve para o IP informado. Se o DNS ainda não propagou, avise e continue mesmo assim, deixando claro que o HTTPS só ativa após a propagação.

2. Segredos: crie o arquivo .env.implantacao local com os dados acima. No servidor, gere o .env a partir do .env.exemplo: preencha DOMINIO com o domínio informado; gere você mesmo uma senha forte aleatória para POSTGRES_PASSWORD e um valor longo aleatório para JWT_SEGREDO; gere uma senha legível de 4 palavras para o portal, produza o hash dela com docker run --rm caddy:2-alpine caddy hash-password e grave o hash em SENHA_PORTAL_HASH (atenção: duplique os cifrões do hash como $$ por causa do Docker Compose, ou envolva em aspas simples). Nunca exiba a senha do banco nem o JWT no chat; a senha do portal em texto claro deve ser gravada apenas no servidor, em /root/sgo-app/SENHA-PORTAL.txt com permissão 600, e você me diz apenas onde ela está.

3. Envio e subida: rode bash scripts/implantar.sh. Acompanhe os logs (docker compose logs) até os serviços banco, portal e adminer estarem saudáveis. Se a compilação do frontend falhar por memória insuficiente no VPS, crie um swapfile de 2 GB e tente de novo.

4. Banco de dados: confirme que o schema foi aplicado listando as tabelas via docker compose exec banco psql (espera-se centros_custo, lancamentos, orcamento_linhas, entre outras). Se o volume já existia de tentativa anterior e o schema não aplicou, me pergunte antes de qualquer down -v, porque isso apaga dados.

5. Segurança: configure o firewall ufw no servidor liberando somente 22, 80 e 443 (confirme comigo antes de ativar, para não derrubar o SSH); agende o backup diário com a linha de crontab indicada no GUIA-HOSTINGER.md; confirme que a porta 5432 não está exposta externamente (ss -tlnp).

6. Validação final: teste com curl que https://DOMINIO responde 401 sem senha e 200 com a senha do portal, e que https://DOMINIO/adminer abre. Se o certificado ainda não emitiu por DNS pendente, valide pelo menos que a porta 80 responde e explique o que falta.

7. Relatório: me entregue um resumo com: endereço do portal, endereço do Adminer, onde está a senha do portal no servidor, status de cada serviço, como restaurar backup, e o comando único de atualização futura (bash scripts/implantar.sh).

Regras: peça confirmação antes de qualquer comando destrutivo (down -v, rm, mudanças de firewall); não grave segredos em arquivos versionados; comandos no servidor sempre via ssh root@IP; se algo falhar, diagnostique pelos logs antes de tentar de novo, no máximo três tentativas por etapa antes de me consultar.

---

## Depois da primeira implantação

Atualizar o sistema no ar passa a ser um comando (ou um pedido ao Claude Code):

    bash scripts/implantar.sh

E os pedidos de manutenção viram prompts curtos no Claude Code, por exemplo: "verifique a saúde dos serviços no VPS e o espaço em disco", "restaure o backup do banco de ontem no VPS", "me mostre os últimos logs do portal".

## Quando o backend nascer (fases do ROTEIRO-CLAUDE-CODE.md)

Prompt para o momento da fase 6: "O backend em server/ está pronto. Ative o serviço api no docker-compose.yml e a rota /api/* no infra/Caddyfile, implante no VPS com o scripts/implantar.sh e valide o login de ponta a ponta."
