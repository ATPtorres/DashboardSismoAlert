# Copias y restauración

Objetivo inicial: copias diarias cifradas en otro volumen, siete días de retención. Programación/volumen y política deben configurarse en el PC real. No se simula esa disponibilidad en este entorno. Una copia diaria puede perder hasta un día de datos; recuperación a un punto en el tiempo requiere binlogs y pruebas propias.

## Copia de operación

`tools/backup.sh /volumen-separado/copia.sql.enc /ruta-privada/frase` realiza mysqldump --single-transaction y cifra con OpenSSL AES-256-CBC/PBKDF2 de 200000 iteraciones y sal aleatoria. Archivo de frase fuera del repositorio, permisos 0600. El script usa pipefail y produce un SHA-256 del archivo cifrado; conserve ese hash en un lugar confiable separado. El hash detecta corrupción cuando se protege su integridad; no es autenticación contra un atacante que pueda reemplazar ambos archivos. Para un adversario con acceso de escritura a copias, usar un sistema de backup autenticado aprobado antes de producción.

La cuenta raíz usada por la utilidad es exclusivamente de operador y se obtiene dentro del contenedor, no aparece en argumentos o logs. La aplicación continúa con su cuenta DML. Proteger igualmente el acceso a Docker, claves TLS y volumen MySQL.

## Ensayo de recuperación

1. Verificar checksum desde el registro confiable antes de descifrar.
2. Crear instancia/base MySQL aislada con acceso solo local; no importar en datos operativos.
3. Descifrar por pipe: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/ruta-privada/frase -in copia.sql.enc` hacia cliente MySQL de la instancia aislada. No almacenar SQL con hashes de cuentas en un directorio público.
4. Comprobar esquema, recuentos, content_hash de eventos, cuentas/alcances y consultas mediante API. Revocar sesiones restauradas si se va a promover una recuperación, rotar secretos comprometidos y reconciliar la cola del receptor con identidades estables.
5. Registrar fecha, resultado, antigüedad y tiempo de recuperación. Solo después planificar la sustitución del servicio real.

Prueba automatizada ejecutada: mysqldump transaccional y restauración en esquema `sismoalert_restore` del stack aislado de pruebas; comparación de recuento y hash de eventos. Se comprobó el reinicio de MySQL conservando eventos. El flujo cifrado y la programación externa se entregan como herramientas/instrucciones; no se afirma una restauración física ni disponibilidad de un segundo volumen.
