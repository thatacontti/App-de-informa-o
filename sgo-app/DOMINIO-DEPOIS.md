# Incluir o domínio próprio depois

O portal sobe e funciona desde o primeiro dia no endereço de fábrica do VPS:

    https://srv1827994.hstgr.cloud

Esse endereço já tem DNS válido e HTTPS automático — **não é preciso configurar domínio nenhum para começar a usar**. Quando quiser um endereço próprio (ex.: `orcamento.grupocatarina.com.br`), siga os 3 passos abaixo. O banco de dados **não é afetado**: nenhum dado é perdido.

## Passo 1 — Criar o registro A

No gerenciador de DNS do domínio da empresa (na Hostinger ou onde o domínio estiver):

- Tipo: **A**
- Nome/host: o subdomínio desejado (ex.: `orcamento`)
- Valor/aponta para: **179.197.73.36** (IP do VPS)
- TTL: o padrão

Aguarde a propagação (de minutos a poucas horas). Para conferir, no seu computador:

    ping orcamento.grupocatarina.com.br

Deve responder com `179.197.73.36`.

## Passo 2 — Trocar o domínio no servidor

No Terminal do navegador do hPanel (ou por SSH), dentro da pasta do projeto:

    cd ~/App-de-informa-o/sgo-app
    bash scripts/trocar-dominio.sh orcamento.grupocatarina.com.br

O script atualiza o `.env` e recria só o portal. O Caddy emite o certificado HTTPS do novo domínio sozinho.

## Passo 3 — Conferir

    docker compose logs -f portal        # aguarde a linha de certificado emitido (Ctrl+C para sair)

Abra `https://orcamento.grupocatarina.com.br` — pede usuário `admin` e a mesma senha do portal (em `SENHA-PORTAL.txt`).

## Observações

- **Requer a porta 80 aberta** no firewall para o Caddy validar e emitir o certificado. Já está aberta na configuração padrão.
- Se algo der errado, o endereço antigo (`srv1827994.hstgr.cloud`) volta a funcionar rodando o script de novo com o hostname antigo.
- Só depois que o novo domínio estiver no ar é que o endereço de fábrica deixa de responder.
