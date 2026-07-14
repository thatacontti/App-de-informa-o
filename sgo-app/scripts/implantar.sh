#!/bin/bash
# Implantação no VPS: envia o projeto e sobe os serviços.
# Uso: bash scripts/implantar.sh
# Configuração: crie o arquivo .env.implantacao na raiz com:
#   VPS_IP=xxx.xxx.xxx.xxx
#   VPS_USUARIO=root
#   VPS_PASTA=/root/sgo-app
set -e
cd "$(dirname "$0")/.."
if [ ! -f .env.implantacao ]; then
  echo "ERRO: crie o arquivo .env.implantacao (veja o cabeçalho deste script)."
  exit 1
fi
source .env.implantacao

echo "==> Enviando o projeto para $VPS_USUARIO@$VPS_IP:$VPS_PASTA"
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude backups \
  --exclude .env --exclude .env.implantacao --exclude .git \
  ./ "$VPS_USUARIO@$VPS_IP:$VPS_PASTA/"

echo "==> Subindo os serviços no servidor"
ssh "$VPS_USUARIO@$VPS_IP" "cd $VPS_PASTA && docker compose up -d --build && docker compose ps"

echo "==> Implantação concluída"
