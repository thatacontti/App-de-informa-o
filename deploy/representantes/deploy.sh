#!/usr/bin/env bash
# Deploy da Plataforma do Representante no VPS.
# Uso:  cd deploy/representantes && ./deploy.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/../../apps/representantes"

echo "== Plataforma do Representante · deploy =="

# 1. .env
if [ ! -f "$APP/.env" ]; then
  echo "[.env] não existe — criando a partir de .env.example"
  cp "$APP/.env.example" "$APP/.env"
  echo "  >>> EDITE $APP/.env (JWT_SECRET, EXCIA_*, SMTP_*) antes de ir a produção."
fi

# 2. pasta de manuais (PDFs)
mkdir -p "$HERE/manuais" "$HERE/certbot-www"

# 3. build + up
echo "[docker] build + up..."
docker compose -f "$HERE/docker-compose.yml" up -d --build

# 4. health
echo -n "[health] aguardando o app ficar saudável"
for i in $(seq 1 30); do
  if docker compose -f "$HERE/docker-compose.yml" exec -T representantes wget -q -O- http://localhost:8080/healthz >/dev/null 2>&1; then
    echo " ... OK"; break
  fi
  echo -n "."; sleep 2
done

echo
echo "== Pronto =="
echo "  App atrás do Nginx na porta 80 (HTTP)."
echo "  Enquanto o domínio não é liberado, teste pelo IP do VPS:  http://SEU_IP/"
echo "  Quando representantes.grupocatarina.com apontar para o VPS, ative o HTTPS"
echo "  com um comando:  ./enable-https.sh ti@grupocatarina.com"
