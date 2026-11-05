#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${1:?Indique una ruta de copia cifrada en otro volumen}"
: "${2:?Indique un archivo privado con la frase de cifrado (fuera del repositorio)}"
umask 077
# Requires pipefail: a failed dump must not be reported as a successful backup.
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces "$MYSQL_DATABASE"' |
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$2" -out "$1"
openssl dgst -sha256 "$1" > "$1.sha256"
