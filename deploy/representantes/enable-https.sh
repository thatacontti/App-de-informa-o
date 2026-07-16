#!/usr/bin/env bash
# Emite o certificado Let's Encrypt e ATIVA o HTTPS — turnkey.
# Rodar no VPS DEPOIS que o registro DNS A de representantes.grupocatarina.com
# já aponta para o IP do VPS.
#
#   cd deploy/representantes && ./enable-https.sh ti@grupocatarina.com
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="representantes.grupocatarina.com"
EMAIL="${1:-ti@grupocatarina.com}"
COMPOSE="docker compose -f $HERE/docker-compose.yml"

echo "== Ativar HTTPS · $DOMAIN =="

# 1. O DNS já aponta para este VPS?
resolved="$(dig +short "$DOMAIN" A | tail -1 || true)"
myip="$(curl -4 -s ifconfig.me || true)"
echo "  DNS  $DOMAIN -> ${resolved:-<vazio>}"
echo "  IP deste VPS -> ${myip:-<desconhecido>}"
if [ -z "$resolved" ]; then
  echo "  ✗ O domínio ainda não resolve. Solicite o registro A (host 'representantes' -> IP do VPS) e tente de novo após propagar."
  exit 1
fi
if [ -n "$myip" ] && [ "$resolved" != "$myip" ]; then
  echo "  ⚠ O DNS aponta para $resolved, mas este VPS é $myip. Confirme o A antes de emitir (senão o certbot falha)."
  read -r -p "  Continuar mesmo assim? [s/N] " ok; [ "${ok:-N}" = "s" ] || exit 1
fi

# 2. Garante o app + nginx no ar em HTTP (para servir o desafio ACME).
mkdir -p "$HERE/certbot-www"
$COMPOSE up -d

# 3. Emite o certificado via webroot (nginx já serve /.well-known/acme-challenge/).
echo "  emitindo certificado..."
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v "$HERE/certbot-www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --agree-tos -m "$EMAIL" --no-eff-email --non-interactive

# 4. Ativa a config HTTPS e recarrega o nginx.
cp "$HERE/nginx-https.conf" "$HERE/nginx-representantes.conf"
$COMPOSE restart nginx

echo
echo "== HTTPS ativo em https://$DOMAIN =="
echo
echo "Renovação automática — adicione ao cron do host (crontab -e):"
echo "  0 3 * * * docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v $HERE/certbot-www:/var/www/certbot certbot/certbot renew --quiet && $COMPOSE restart nginx"
