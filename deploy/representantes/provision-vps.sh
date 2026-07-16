#!/usr/bin/env bash
# ============================================================
# Bootstrap COMPLETO da VPS Hostinger (Ubuntu) — do zero ao site no ar.
# Instala Docker, gera segredos, sobe a Plataforma do Representante.
#
# Rodar UMA vez, como root, com o código do projeto já na VPS:
#
#     sudo bash deploy/representantes/provision-vps.sh
#
# Depois que o DNS de representantes.grupocatarina.com apontar para esta
# VPS, rode:  bash deploy/representantes/enable-https.sh ti@grupocatarina.com
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/../../apps/representantes"

echo "== Plataforma do Representante · provisionamento da VPS =="

# 0. precisa ser root
if [ "$(id -u)" -ne 0 ]; then
  echo "  ✗ Rode como root:  sudo bash $0"; exit 1
fi

# 1. Docker + Docker Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/4] instalando Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/4] Docker já instalado."
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "      instalando plugin docker compose..."
  apt-get update -y && apt-get install -y docker-compose-plugin || true
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# 2. .env com segredo forte gerado automaticamente
echo "[2/4] configurando variáveis (.env)..."
if [ ! -f "$APP/.env" ]; then
  cp "$APP/.env.example" "$APP/.env"
  SECRET="$(openssl rand -base64 48 | tr -d '\n/' )"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" "$APP/.env"
  sed -i "s|^COOKIE_SECURE=.*|COOKIE_SECURE=true|" "$APP/.env"
  sed -i "s|^EXCIA_MODE=.*|EXCIA_MODE=file|" "$APP/.env"
  echo "      .env criado com JWT_SECRET aleatório."
  echo "      (Depois, para e-mails saírem, preencha SMTP_PASS no $APP/.env.)"
else
  echo "      .env já existe — mantido."
fi

# 3. build + up
echo "[3/4] construindo e subindo os containers (pode levar alguns minutos)..."
docker compose -f "$HERE/docker-compose.yml" up -d --build

# 4. healthcheck
echo -n "[4/4] aguardando o app responder"
ok=""
for i in $(seq 1 40); do
  if docker compose -f "$HERE/docker-compose.yml" exec -T representantes wget -q -O- http://localhost:8080/healthz >/dev/null 2>&1; then
    ok=1; echo " ... OK"; break
  fi
  echo -n "."; sleep 3
done
[ -z "$ok" ] && { echo; echo "  ⚠ App não respondeu a tempo. Veja logs: docker compose -f $HERE/docker-compose.yml logs -f"; exit 1; }

IP="$(curl -4 -s ifconfig.me || echo 'SEU_IP')"
echo
echo "==================================================================="
echo " ✅ SITE NO AR (HTTP) nesta VPS."
echo "    Teste agora no navegador:   http://$IP/"
echo "    (login: Diretoria 0 / 0000  ·  troca de senha no 1º acesso)"
echo
echo " PRÓXIMOS PASSOS:"
echo " 1) DNS: criar registro A  'representantes'  ->  $IP   (no GoDaddy)"
echo " 2) Quando o domínio apontar, ativar o HTTPS:"
echo "      bash $HERE/enable-https.sh ti@grupocatarina.com"
echo "==================================================================="
