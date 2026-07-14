#!/bin/bash
# Backup diário do banco de dados. Guarda os últimos 30 dias em ./backups
# Agendar no servidor com: crontab -e
#   0 3 * * * cd /root/sgo-app && bash scripts/backup.sh >> backups/backup.log 2>&1
set -e
cd "$(dirname "$0")/.."
source .env
DATA=$(date +%F)
docker compose exec -T banco pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "backups/banco-$DATA.sql.gz"
ls -1t backups/banco-*.sql.gz | tail -n +31 | xargs -r rm --
echo "$(date '+%F %T') backup concluído: banco-$DATA.sql.gz"
