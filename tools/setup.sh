#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p .local/tls
if [ ! -f .local/runtime.env ]; then
  python3 - <<'PY'
import secrets
from pathlib import Path
p=Path('.local/runtime.env')
p.write_text('MYSQL_DATABASE=sismoalert\nMYSQL_USER=sismoapp\nMYSQL_PASSWORD='+secrets.token_hex(32)+'\nMYSQL_ROOT_PASSWORD='+secrets.token_hex(32)+'\n')
PY
fi
if [ ! -f .local/tls/ca.crt ]; then
  openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 365 -keyout .local/tls/ca.key -out .local/tls/ca.crt -subj '/CN=SismoAlert Development CA' 2>/dev/null
fi
if [ ! -f .local/tls/server.crt ]; then
  openssl req -newkey rsa:3072 -nodes -sha256 -keyout .local/tls/server.key -out .local/tls/server.csr -subj '/CN=localhost' 2>/dev/null
  printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > .local/tls/extensions
  openssl x509 -req -in .local/tls/server.csr -CA .local/tls/ca.crt -CAkey .local/tls/ca.key -CAcreateserial -out .local/tls/server.crt -days 90 -sha256 -extfile .local/tls/extensions
fi
# Apache master requires read access to development TLS keys mounted into the container.
chmod 755 .local/tls
chmod 644 .local/tls/server.crt .local/tls/ca.crt
chmod 600 .local/tls/server.key .local/tls/ca.key
find web backend -type d -exec chmod 755 {} +
find web backend -type f -exec chmod 644 {} +
docker compose up -d --build --wait
docker compose exec -T -u root db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"' < backend/migrations/001.sql
# The runtime account has DML only; migrations use the distinct local root operator.
docker compose exec -T -u root db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot' <<'SQL'
REVOKE ALL PRIVILEGES ON sismoalert.* FROM 'sismoapp'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON sismoalert.* TO 'sismoapp'@'%';
SQL
curl --fail --silent --show-error --cacert .local/tls/ca.crt https://localhost:8443/api/v1/public/state
