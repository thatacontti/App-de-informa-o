#!/usr/bin/env bash
# =====================================================================
# Implantacao automatica a partir do SEU computador (macOS ou Linux).
# Envia o portal para o VPS e constroi tudo la dentro: Docker, segredos,
# HTTPS, banco, firewall e backup diario. Pede a senha de root UMA vez.
#
# Uso:
#   bash scripts/deploy-local.sh
# (rode de dentro da pasta do projeto)
# =====================================================================
set -euo pipefail

VPS_IP="179.197.73.36"
VPS_USER="root"
DEST="/root/sgo-app"

# Pasta do projeto = pasta acima deste script
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Conexao SSH reutilizavel: a senha e pedida uma unica vez
CTL="${TMPDIR:-/tmp}/sgo-ctl-%r@%h_%p"
SSH=(ssh -o ControlMaster=auto -o "ControlPath=$CTL" -o ControlPersist=600 -o StrictHostKeyChecking=accept-new)

echo "==> Conectando ao VPS. Digite a SENHA DE ROOT (a que a Hostinger enviou por e-mail):"
"${SSH[@]}" "$VPS_USER@$VPS_IP" "mkdir -p '$DEST' && echo conexao-ok"

echo "==> Enviando os arquivos do portal para o servidor..."
tar czf - -C "$PROJ" \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude backups --exclude .env --exclude .env.implantacao \
  . | "${SSH[@]}" "$VPS_USER@$VPS_IP" "tar xzf - -C '$DEST'"

echo "==> Construindo tudo no servidor (pode levar alguns minutos na primeira vez)..."
"${SSH[@]}" "$VPS_USER@$VPS_IP" "DEST='$DEST' bash -s" <<'REMOTO'
set -e
cd "$DEST"

# 1. Docker (instala se faltar)
command -v docker >/dev/null 2>&1 || { echo "==> Instalando Docker..."; curl -fsSL https://get.docker.com | sh; }

# 2. Memoria de troca (evita falha ao compilar em VPS pequeno)
if [ "$(free -m 2>/dev/null | awk '/Swap/{print $2}')" = "0" ]; then
  echo "==> Criando 2GB de swap..."
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 3. Segredos e .env (so gera na primeira vez, para nao trocar senhas em re-deploys)
if [ ! -f .env ]; then
  echo "==> Gerando segredos e .env..."
  PGP=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
  JWT=$(openssl rand -hex 32)
  W=(sol lua rio mar ceu flor pedra vento chuva fogo terra ouro prata verde azul monte campo praia noite manha)
  N=${#W[@]}
  SENHA="${W[$((RANDOM%N))]}-${W[$((RANDOM%N))]}-${W[$((RANDOM%N))]}-${W[$((RANDOM%N))]}-$((RANDOM%90+10))"
  H=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$SENHA")
  HESC=${H//\$/\$\$}
  cat > .env <<EOF
DOMINIO=srv1827994.hstgr.cloud
POSTGRES_USER=sgo
POSTGRES_PASSWORD=$PGP
POSTGRES_DB=orcamento
SENHA_PORTAL_HASH=$HESC
JWT_SEGREDO=$JWT
EOF
  printf 'Portal: https://srv1827994.hstgr.cloud\nUsuario: admin\nSenha do portal: %s\n' "$SENHA" > SENHA-PORTAL.txt
  chmod 600 SENHA-PORTAL.txt
fi

# 4. Subir os servicos
echo "==> Subindo os servicos (a primeira vez compila o portal)..."
docker compose up -d --build

# 5. Firewall minimo (libera 22 antes de ativar, para nao perder o SSH)
if command -v ufw >/dev/null 2>&1; then
  echo "==> Firewall: liberando 22, 80 e 443..."
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

# 6. Backup diario no cron
mkdir -p backups
CRON="0 3 * * * cd $DEST && bash scripts/backup.sh >> backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'scripts/backup.sh'; echo "$CRON" ) | crontab -

# 7. Resumo
echo
echo "===================== RESUMO ====================="
docker compose ps
echo
echo "Portal:  https://srv1827994.hstgr.cloud   (usuario: admin)"
echo "Adminer: https://srv1827994.hstgr.cloud/adminer"
echo "Senha do portal salva em: $DEST/SENHA-PORTAL.txt"
echo "=================================================="
REMOTO

echo
echo "==> Concluido!"
echo "==> Para ver a senha do portal, rode no seu Terminal:"
echo "    ssh $VPS_USER@$VPS_IP 'cat $DEST/SENHA-PORTAL.txt'"
