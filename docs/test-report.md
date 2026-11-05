# Resultados de validación local

Fecha: 5 de noviembre de 2026. Son resultados de esta implementación de software; no cifras históricas del informe ni pruebas físicas del ESP32.

## Ejecutado

- **17 pruebas unitarias aprobadas** con Node 24.22.1: estados iniciales, normal con referencia válida, caducidad sin depender del HTTP, pérdida de receptor separada del sensor, ejes inválidos, perfil ausente, contratos desconocidos, coordenadas (incluido 0,0), huecos/reinicios/secuencias, retención de 240 puntos, deduplicación, cierre visual, eventos históricos, memoria acotada y cambio de modo sin aceptar respuestas tardías.
- **40 comprobaciones de integración aprobadas** con PHP 8.4.14 y MySQL 8.4.7 reales, stack aislado `sismoalert-test`. TLS verificado por CA local. Acceso público mínimo, denegación por rol/sector/origen/CSRF, cookies seguras, SQL parametrizado, protección concurrente del último administrador, configuración/versiones, ingesta con COMMIT, duplicados/conflictos/rollback, aislamiento REAL/SIMULATED, CSV, resúmenes, revocación, caída y reinicio de DB, restauración de dump en esquema aislado y límite de login.
- **Chromium 155** con CA local confiable, sin desactivar verificación TLS: vistas de 360/768/1440 px sin desbordamiento horizontal; espera sin valores ficticios; demo explícita, anomalía y cierre sin duplicados, sensor/enlace perdido, salida limpia de demo, acceso protegido, login administrativo, creación de cuentas, publicación versionada, representación segura de HTML almacenado, historial/diagnóstico y logout. Cero errores JavaScript y cero peticiones a internet durante el recorrido.
- Instalación repetida satisfactoria, conserva datos y credenciales. HTTP rechazó POST de sesión con 403 y sirvió estáticos con 200. PHP/PDO_MYSQL y Argon2id disponibles. Todos los PHP pasan `php -l`.
- Build de estáticos y gzip bajo 200 KiB (aproximadamente 21 KiB HTML/CSS/JS). Generación de `dist/embedded_assets.h` y manifiesto de tamaños; no compilación de firmware.

Capturas locales generadas por la suite: `.local/screenshots/real-{360,768,1440}.png` y `demo-1440.png`. Son artefactos de desarrollo ignorados por Git.

## Distinciones y pruebas no realizadas

El ensayo de 7200 iteraciones unitarias representa 30 minutos sintéticos a 4 Hz; no acredita una sesión sostenida de radio/hardware ni heap del ESP32. La restauración probada fue un dump transaccional en un esquema aislado; no se verificó almacenamiento de copias en otro volumen físico. El flujo cifrado se entrega como herramienta con límites documentados.

Pendientes: firmware real, adaptador `/api/estado`, HTTPS/pasarela en receptor y confianza en teléfonos, recursos flash/heap, pruebas de actuadores/ESP-NOW/cortes, concurrencia de teléfonos, cartografía con licencia, retención bajo caudal continuo y revisión de accesibilidad asistiva. Consulte `test-plan.md`.

No se afirma cumplimiento de la primera entrega física completa hasta resolver esos puntos. El entorno permite desarrollar y probar frontend, permisos, API y persistencia sin depender de hardware ni inventar mediciones.
