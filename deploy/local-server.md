# Equipo de apoyo, HTTPS y operación

## Desarrollo verificado

`tools/setup.sh` genera secretos aleatorios y certificados locales, inicia Apache/PHP y MySQL y aplica migraciones con credencial distinta de la API. Puerto 8443 HTTPS, 8080 solo estáticos, ambos loopback. El script es repetible. Mantener Docker, Bash, Python, OpenSSL, curl y Node disponibles; versiones verificadas en README.

El certificado de desarrollo tiene SAN localhost/127.0.0.1, firma SHA-256/RSA y 90 días. `.local/tls/ca.crt` es público; la clave de CA y server.key son privadas. Para Chromium/Linux, incorporar la CA pública al almacén NSS del usuario con certutil. Ejemplo, para un almacén ya existente:

```sh
certutil -A -d sql:"$HOME/.pki/nssdb" -n SismoAlert-development-local -t 'C,,' -i .local/tls/ca.crt
```

El almacén debe ser accesible/escribible al proceso del navegador. No usar ignoreHTTPSErrors, curl -k ni desactivar validación. Para otro navegador o móvil, instalar únicamente la CA pública mediante el procedimiento del sistema. No exportar la clave privada. No usar los certificados localhost como certificados del ESP32.

Primer administrador: `./tools/admin.sh bootstrap nombre`. Restablecimiento offline auditado: `./tools/admin.sh reset-password nombre`. El operador local debe tener acceso protegido al equipo/Docker. No mostrar ni guardar la contraseña en argumentos/historial. Para cambiar roles, alcance y cuentas, usar la interfaz HTTPS.

Arranque posterior: `docker compose up -d --wait`. Comprobación: `curl --fail --cacert .local/tls/ca.crt https://localhost:8443/api/v1/public/state`; verificar JSON y servicios. `docker compose logs --tail=30 app` para errores sin secretos. Política de reinicio unless-stopped. Los procesos de este entorno no se restauran solo por conservar sus archivos.

## Despliegue físico: bloqueado por inventario

No abrir este stack de desarrollo a internet ni reenviar puertos. Para PC conectado al SoftAP:

1. Confirmar IP fija/reserva sin colisiones y canal 6; no asociar el receptor a otro AP que cambie canal.
2. Certificados distintos para receptor y API, SAN correcto, CA confiable, renovación y reloj offline válido (RTC/aprovisionamiento).
3. APP_ORIGIN debe ser el origen HTTPS exacto del dashboard en el receptor. El proxy acotado conserva Host/Origin según contrato validado y transmite cookie/sesión sin aceptar encabezados de rol del cliente. Apache de desarrollo con localhost no es esa configuración final.
4. Vincular interfaz del servidor a IP local y firewall permitiendo solo receptor/autorizados; MySQL permanece en red interna sin puertos públicos. Si PHP y MySQL se separan físicamente, TLS con verificación de identidad y red restringida; la red Docker de este desarrollo es privada y confinada al equipo de apoyo.
5. Aprovisionar dispositivos fuera de web/ y rotar tokens; no enviar secretos a un destino sin verificar certificado.
6. Desactivar DEMO_ENABLED, medir TLS/heap/concurrencia y probar falla de servidor sin afectar radio/actuadores.

No se incluye una supuesta configuración de pasarela en firmware sin conocer su servidor HTTP/TLS ni librerías. `docs/integration-notes.md` enumera las condiciones para implementarla. No hay credenciales de hardware por defecto.

## Mantenimiento

Ejecutar `docker compose exec -T app php /app/backend/bin/retention.php` cada hora mediante el programador local: elimina hasta 1000 filas por tabla y ejecución, resúmenes de más de 7 días y eventos/auditoría de más de 90 días. También limpia sesiones/intentos vencidos. Dimensionar intervalo/lotes con disco e índices antes de producción: el script no garantiza retención bajo cualquier tasa de ingreso. No registrar muestras rápidas por defecto. Supervisar crecimiento, colas y descartes en el receptor cuando se integre.

No se habilitó HSTS en desarrollo; hacerlo únicamente después de validar identidad y confianza del despliegue físico. La versión final requiere revisión de seguridad y medición de recursos bajo carga, no solo estas pruebas funcionales.
