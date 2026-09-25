#!/usr/bin/env bash
# Backup do banco em SQL comprimido.
#   DATABASE_URL=postgresql://... ./scripts/backup-db.sh [pasta-destino]
# Restaurar (banco vazio!):
#   gunzip -c locamania-AAAAMMDD-HHMM.sql.gz | psql "$DATABASE_URL"
set -euo pipefail

: "${DATABASE_URL:?defina DATABASE_URL (conexão direta, porta 5432)}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M)"
FILE="$OUT_DIR/locamania-$STAMP.sql.gz"

# O Prisma aceita ?schema=public e ?pgbouncer=true; o pg_dump não.
URL="${DATABASE_URL%%\?*}"

pg_dump "$URL" --no-owner --no-privileges --schema=public --format=plain | gzip -9 > "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
if [ ! -s "$FILE" ] || [ "$(gunzip -c "$FILE" | head -c 1000 | wc -c)" -lt 100 ]; then
  echo "Backup vazio ou inválido: $FILE" >&2
  exit 1
fi
echo "Backup gerado: $FILE ($SIZE)"
