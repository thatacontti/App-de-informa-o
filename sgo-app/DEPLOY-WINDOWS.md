# Implantação a partir do Windows (passo a passo)

Windows 10 e 11 já têm `ssh`, `scp`, `tar` e `curl` embutidos — não precisa instalar nada.
Endereço de fábrica do VPS: **srv1827994.hstgr.cloud** (IP 179.197.73.36). O domínio próprio entra depois (ver `DOMINIO-DEPOIS.md`).

## Passo 0 — Descompactar o projeto
Encontre o arquivo `sistemaorcamentarioapp.zip` (na pasta Downloads), clique com o botão direito → **Extrair tudo**. Isso cria uma pasta `sgo-app`. Anote o caminho dela (ex.: `C:\Users\SeuNome\Downloads\sgo-app`).

## Passo 1 — Abrir o PowerShell na pasta do projeto
Abra a pasta `sgo-app` no Explorador de Arquivos, clique no campo de endereço, digite `powershell` e Enter. (Ou abra o PowerShell e rode `cd "C:\Users\SeuNome\Downloads\sgo-app"`.)

## Passo 2 — Empacotar e enviar ao servidor
Cole as duas linhas (a segunda pede a senha de root do VPS — a que a Hostinger enviou por e-mail):

    tar czf "$env:TEMP\sgo.tar.gz" --exclude .git --exclude node_modules --exclude dist --exclude backups --exclude .env .
    scp "$env:TEMP\sgo.tar.gz" root@179.197.73.36:/root/sgo.tar.gz

## Passo 3 — Entrar no servidor
Cole (pede a senha de root de novo):

    ssh root@179.197.73.36

Agora você está dentro do servidor (Linux).

## Passo 4 — Construir tudo (um bloco só)
Cole o bloco inteiro abaixo e Enter. Ele instala o Docker (se faltar), cria memória de troca, gera as senhas, sobe o portal + banco + Adminer, configura o firewall e agenda o backup diário:

    mkdir -p /root/sgo-app && tar xzf /root/sgo.tar.gz -C /root/sgo-app && cd /root/sgo-app
    command -v docker >/dev/null 2>&1 || { echo "Instalando Docker..."; curl -fsSL https://get.docker.com | sh; }
    if [ "$(free -m 2>/dev/null | awk '/Swap/{print $2}')" = "0" ]; then
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
      chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
      grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    if [ ! -f .env ]; then
      PGP=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
      JWT=$(openssl rand -hex 32)
      W=(sol lua rio mar ceu flor pedra vento chuva fogo terra ouro prata verde azul monte campo praia noite manha)
      N=${#W[@]}
      SENHA="${W[$((RANDOM%N))]}-${W[$((RANDOM%N))]}-${W[$((RANDOM%N))]}-${W[$((RANDOM%N))]}-$((RANDOM%90+10))"
      H=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$SENHA")
      HESC=${H//\$/\$\$}
      printf 'DOMINIO=srv1827994.hstgr.cloud\nPOSTGRES_USER=sgo\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=orcamento\nSENHA_PORTAL_HASH=%s\nJWT_SEGREDO=%s\n' "$PGP" "$HESC" "$JWT" > .env
      printf 'Portal: https://srv1827994.hstgr.cloud\nUsuario: admin\nSenha do portal: %s\n' "$SENHA" > SENHA-PORTAL.txt
      chmod 600 SENHA-PORTAL.txt
    fi
    docker compose up -d --build
    if command -v ufw >/dev/null 2>&1; then ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable >/dev/null; fi
    mkdir -p backups
    ( crontab -l 2>/dev/null | grep -v scripts/backup.sh; echo "0 3 * * * cd /root/sgo-app && bash scripts/backup.sh >> backups/backup.log 2>&1" ) | crontab -
    echo; echo "===== RESUMO ====="; docker compose ps

## Passo 5 — Ver a senha do portal
Ainda dentro do servidor:

    cat /root/sgo-app/SENHA-PORTAL.txt

## Pronto
- Portal:  https://srv1827994.hstgr.cloud  (usuário `admin` + senha do passo 5)
- Adminer: https://srv1827994.hstgr.cloud/adminer

Para sair do servidor: digite `exit`.

## Atualizar depois
Repita os passos 2, 3 e rode só: `cd /root/sgo-app && tar xzf /root/sgo.tar.gz -C /root/sgo-app && docker compose up -d --build` (o `.env` e o banco são preservados).
