# SismoAlert Offline

Panel local de vibraciones en español, sin dependencias de red en el navegador. HTML/CSS/JavaScript modular y Canvas; API PHP 8.4.14/PDO; MySQL 8.4.7/InnoDB. Dos roles: **USUARIO** y **ADMINISTRADOR**, con autorización efectiva por sector.

> Monitor experimental de vibraciones. No predice terremotos ni sustituye las alertas oficiales.

## Estado de la entrega

Implementados y probados: frontend adaptable, estados independientes y caducidad, demostración explícita, sesiones HTTPS, cuentas/sectores/revocación, protección concurrente del último administrador, configuración versionada, auditoría, historial/exportación, ingesta transaccional e idempotente, copias/restauración de prueba y empaquetado de recursos estáticos.

**No es todavía la entrega física completa.** No se recibieron sketches, contrato binario, respuestas reales de `/api/estado`, geometrías OSM ni inventario de placa/particiones. La aplicación real comienza sin nodos ni lecturas; el adaptador antiguo falla de forma explícita. No se implementó firmware ficticio ni se acreditan pruebas de sensor/radio/actuadores. El servidor de desarrollo aloja temporalmente el frontend; no se afirma que ya se sirva desde un ESP32. Véase [notas de integración](docs/integration-notes.md).

## Inicio local

Requisitos: Docker Engine + Compose ≥2.24.4, Bash, Python 3, OpenSSL, curl y Node ≥22 (probado con Node 24.22.1). No se requieren PHP/MySQL en el host. Imágenes fijadas por digest en Dockerfile/Compose; dependencias JS de pruebas fijadas en package-lock.json.

```sh
npm ci --cache .local/npm
./tools/setup.sh
./tools/admin.sh bootstrap mi-administrador
```

El último comando solicita una contraseña propia sin mostrarla y solo funciona cuando no existen cuentas. No hay cuenta universal ni registro público. La instalación genera credenciales aleatorias en `.local/runtime.env` y una CA/certificado de **desarrollo** en `.local/tls`. Estos archivos están excluidos de Git. No publicar, copiar a documentación ni compartir claves privadas.

El servidor escucha HTTPS en loopback, puerto 8443; la CA de desarrollo es `.local/tls/ca.crt`. Instale únicamente ese certificado público en el almacén de confianza del navegador de pruebas. No desactive TLS. La interfaz HTTP del puerto 8080 no acepta API ni credenciales. MySQL no publica puertos al host; su red Docker es interna y solo compartida con la API. La cuenta de ejecución tiene SELECT/INSERT/UPDATE/DELETE, no DDL. La instalación/migración usa una cuenta de operador distinta.

`tools/setup.sh` puede repetirse: conserva secretos, certificados, cuentas e historial y aplica la migración idempotente 001. No borre volúmenes para actualizar. Renueve certificados antes de expirar (90 días para el de desarrollo).

## Demostración explícita

Desactivada por defecto. Para habilitarla exclusivamente en desarrollo:

```sh
docker compose -f compose.yaml -f deploy/demo.yaml up -d
```

Pulse «Explorar demostración». Datos y eventos del simulador están etiquetados, acotados y solo en memoria del navegador. No se ingieren automáticamente en MySQL ni se envían comandos al hardware. Al salir se vacían gráfica y avisos. Para deshabilitar:

```sh
docker compose up -d
```

## Comprobaciones

```sh
npm test                       # estados, vigencia, colas, cambios de modo
npm run build                  # estáticos y gzip; límite 200 KiB
npm run package:embedded        # cabecera PROGMEM, sin firmware inventado
npm run test:integration        # stack separado sismoalert-test, HTTPS + MySQL reales
npm run test:browser            # Chromium del host; CA local confiable requerida
```

La suite de integración reinicializa **solo** la base del proyecto Docker `sismoalert-test`. No la apunte a una instalación operativa. La suite del navegador también crea cuentas de prueba de contraseña aleatoria en ese proyecto, sin publicarlas. Ejecute las suites de integración y navegador en secuencia, porque la primera reinicializa sus datos y prueba una caída de MySQL. Para detener únicamente las pruebas: `docker compose -p sismoalert-test -f compose.yaml -f deploy/test.yaml stop`.

Resultados y límites: [reporte de pruebas](docs/test-report.md). Los 30 minutos del ensayo unitario son tiempo sintético; no se presentan como una sesión física de 30 minutos.

## Estructura

- `web/`: archivos finales servibles por el receptor, sin PHP ni acceso a MySQL.
- `backend/`: API, migración, utilidades locales de administración y retención.
- `deploy/`: TLS, Compose de pruebas/demo y operación del equipo de apoyo.
- `tests/`: pruebas de dominio, HTTP/roles/MySQL y navegador.
- `tools/`: instalación, construcción y empaquetado.
- `firmware/`: requisitos de integración; sin sketches suministrados.
- `docs/specification.md`: especificación original entregada por el usuario.

[Contrato API](docs/api-v1.md) · [Instalación y TLS](deploy/local-server.md) · [Copias y restauración](deploy/backup-restore.md) · [Plan de pruebas físicas](docs/test-plan.md)
