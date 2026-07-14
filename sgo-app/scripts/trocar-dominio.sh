#!/bin/bash
# Troca o dominio do portal e recarrega os servicos, sem mexer no banco.
# Uso (no servidor, dentro da pasta do projeto):
#   bash scripts/trocar-dominio.sh orcamento.suaempresa.com.br
#
# Pre-requisito: o registro A do novo dominio ja deve apontar para o IP do VPS.
# O Caddy emite o novo certificado HTTPS sozinho assim que o portal reinicia.
set -e
cd "$(dirname "$0")/.."

NOVO="$1"
if [ -z "$NOVO" ]; then
  echo "Uso: bash scripts/trocar-dominio.sh SEU.DOMINIO.COM.BR"
  exit 1
fi
if [ ! -f .env ]; then
  echo "ERRO: .env nao encontrado. Rode a implantacao primeiro."
  exit 1
fi

ATUAL=$(grep '^DOMINIO=' .env | cut -d= -f2-)
echo "==> Dominio atual: ${ATUAL:-<nenhum>}"
echo "==> Novo dominio:  $NOVO"

# Atualiza (ou adiciona) a linha DOMINIO no .env
if grep -q '^DOMINIO=' .env; then
  sed -i "s|^DOMINIO=.*|DOMINIO=$NOVO|" .env
else
  echo "DOMINIO=$NOVO" >> .env
fi

echo "==> Recriando o portal para o Caddy emitir o certificado do novo dominio"
docker compose up -d

echo "==> Pronto."
echo "    Acompanhe a emissao do certificado: docker compose logs -f portal"
echo "    Teste em: https://$NOVO"
echo "    (o endereco antigo para de responder assim que o novo assumir)"
