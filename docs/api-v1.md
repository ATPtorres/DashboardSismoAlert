# API implementada · esquema 1

Mismo origen HTTPS. APP_ORIGIN define Host y Origin exactos. Sin CORS abierto. JSON UTF-8, no-store; errores `{ "error": { "code": "...", "message": "..." } }`. IDs MySQL como cadenas; secuencias/tiempos de dispositivo enteros no negativos ≤2^53−1. Cuerpo máximo 64 KiB. PHP no confía en roles enviados por el navegador.

## Acceso humano

- `GET /api/v1/public/state`: resumen vacío del receptor aún no integrado, disponibilidad de API/BD, demoEnabled. Sin coordenadas/diagnóstico/cuentas. Continúa durante caída de MySQL.
- `POST /api/v1/session`: `{username,password}`. Origin requerido, HTTPS, máximo diez intentos por IP/5 min. Devuelve user y csrfToken. Cookie `__Host-sismo_session`, Secure, HttpOnly, SameSite=Strict, 8 horas; DB solo conserva SHA-256 del token criptográfico aleatorio de 256 bits.
- `GET /api/v1/me`: cuenta efectiva y csrfToken. `DELETE /api/v1/session`: revoca la sesión.
- `POST /api/v1/me/password`: `{currentPassword,password}`; mínimo 12 bytes/máximo 128, Argon2id 64 MiB/3 iteraciones. Revoca todas las sesiones de la cuenta.
- `GET /api/v1/state`: proyección para el usuario/sectores, actualmente sin lecturas físicas; incorpora avisos informativos por sector.

Todas las mutaciones humanas requieren Origin; salvo login, también cookie válida y `X-CSRF-Token`. Sesiones se revocan al cambiar permisos, contraseña o estado. API/BD caídas fallan cerrado; nunca se conserva autorización en una caché del cliente.

## Administración

| Ruta | Entrada / resultado |
| --- | --- |
| GET `/api/v1/info` | Capacidades reales del software, receptor integrado=false |
| GET `/api/v1/users` | Hasta 500 cuentas cuyo alcance está íntegramente incluido en el del actor |
| POST `/api/v1/users` | username, password, role, sectors[]; sin registro abierto |
| PATCH `/api/v1/users/{id}` | role, active booleano, sectors[]; sin sectores ajenos; mutex transaccional para último administrador |
| GET `/api/v1/config?sectorId=S01` | version, desired.notice, appliedToHardware=false |
| PATCH `/api/v1/config` | sectorId, expectedVersion, notice (≤1000 bytes); conflicto 409, histórico atómico |
| GET `/api/v1/events?sectorId=S01&origin=REAL&cursor=0&limit=20` | Máximo 50, orden por ID estable; nextCursor, lastCursor, cursorDiscontinuity |
| GET `/api/v1/export/events.csv` o `.json` | Mismos filtros/paginación; exporta una página, no todo el histórico |
| GET `/api/v1/audit?sectorId=S01&cursor=0` | Páginas de 50 acciones autorizadas con tiempo SERVER_UTC |
| `/api/v1/commands...` | 501 CAPABILITY_UNAVAILABLE tras comprobar permisos |
| GET `/api/estado` | 501 LEGACY_UNAVAILABLE, no se inventan campos ni se filtra diagnóstico |

Roles: USUARIO y ADMINISTRADOR. Un administrador solo gestiona cuentas cuyo alcance completo está dentro del suyo; tampoco puede asignar sectores adicionales. Configuración es un aviso informativo, no parámetros de calibración ni una orden de evacuación.

CSV neutraliza fórmulas en texto y conserva negativos numéricos; incluye origen, simulacro, bootId, secuencia, tiempo, coordenadas/unidades, perfil y advertencia de cobertura parcial. JSON conserva snapshot y calidad de tiempo. La página siguiente se solicita con nextCursor; CSV lo devuelve en X-Next-Cursor. Si un cursor desapareció por retención, cursorDiscontinuity=true. No se promete registro completo del sensor.

## Identidad de dispositivo

Aprovisionamiento local, token propio aleatorio de 32 bytes hex por gateway y alcance limitado a sector/nodos registrados. Guardar el token fuera del repositorio; en DB solo se guarda su hash. Rotación con `backend/bin/admin.php provision-device ...`. No usar credenciales MySQL ni sesión humana como credencial de dispositivo. No enviar tokens a JavaScript.

`POST /internal/v1/ingest/events`, Authorization: Bearer TOKEN:

```json
{"schemaVersion":1,"items":[{"id":"event-1","nodeId":"1","nodeBootId":"boot-1","sequence":1,"type":"ANOMALIA","origin":"SIMULATED","drill":false,"receivedAtGatewayUptimeMs":200,"freshness":"HISTORICAL","locationSnapshot":null,"profileId":null,"timeSource":"UNSYNCED","utc":null}]}
```

Este ejemplo es simulado. Tipos permitidos: ANOMALIA, NORMAL, ERROR_SENSOR, SIN_ENLACE, REINICIO, CALIBRANDO, PERFIL_NO_VALIDO. Lotes de 1–20; gateway/nodo aprovisionados; origen ligado al dispositivo. SIMULATED requiere DEMO_ENABLED=true y nunca se mezcla con consultas REAL. Contrato inicial acepta tiempo monotónico UNSYNCED, no UTC de medición no verificada. La fecha de ingesta es SERVER_UTC separada.

Transacción completa o rollback; identidad `(gateway,node,boot,eventId)` única; mismo contenido canónico es idempotente, distinto contenido devuelve 409. ACK `MYSQL_COMMIT` únicamente después de COMMIT. No representa ACK ESP-NOW, orden aplicada ni actuación del buzzer.

`POST /internal/v1/ingest/summaries`: schemaVersion/items, cada registro con nodeId,nodeBootId,sequence,origin,drill,receivedAtGatewayUptimeMs,valid,accelerationG `{x,y,z}` en g, rango ±16; lectura inválida usa null. Identidad `(node,boot,sequence)`. Registro optativo del equipo, no se activa a 4 Hz automáticamente. Retención inicial 7 días; eventos/auditoría 90 días.

`POST /internal/v1/authorize`: `{session,operation,sectorId}`. Solo state/diagnostics, con sesión vigente, alcance y rol comprobados en DB; diagnostics requiere administrador. Respuesta no cacheable. No admite comandos ni confía en identidad humana declarada.

Errores principales: 400 entrada/contrato, 401 sesión, 403 permisos/CSRF/origen, 404 ruta, 409 identidad/versión/último admin, 413 cuerpo, 429 login, 501 capacidad no implementada, 503 DB no disponible. No se exponen trazas ni secretos.
