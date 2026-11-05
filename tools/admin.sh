#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -s -p 'Contraseña propia (mínimo 12 caracteres): ' sismo_password
printf '\n'
printf '%s' "$sismo_password" | docker compose exec -T app php /app/backend/bin/admin.php "${1:-bootstrap}" "${2:?Indique el nombre de cuenta}"
unset sismo_password
