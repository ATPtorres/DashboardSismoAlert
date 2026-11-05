# Integración: evidencia y pendientes

## Inventario recibido

Repositorio inicialmente vacío, sin commits, firmware ni recursos web anteriores. Se recibió únicamente la especificación 1.1. No se consultó el informe externo para deducir contratos ausentes.

Implementación de software local: PHP/MySQL en contenedores y frontend estático. `GET /api/v1/public/state` en este servidor ofrece una proyección vacía, con disponibilidad del servicio y `receiverConnection: NO_DISPONIBLE`. El estado privado conserva esa ausencia; el historial ingestable no se transforma en una lectura vigente. La ingesta de eventos/resúmenes no prueba recepción física ni genera actuaciones.

La versión 1 usa un enum de dos roles por cuenta en `users`, en lugar de tablas de roles múltiples: evita permisos ambiguos y conserva el alcance por sector en `user_sector_access`. Máximo inicial 500 cuentas, 50 sectores por cuenta. S01 es una referencia sin instalación verificada, no un piso ni un despliegue real.

## Material que falta para conectar hardware

1. Sketches emisor/receptor, bibliotecas/versiones y recursos embebidos actuales.
2. Modelo de placa, flash, tabla de particiones, heap/PSRAM y procedimiento de carga.
3. JSON anonimizado de `/api/estado` en reposo, anomalía, calibración, sensor ausente y pérdida del enlace.
4. Contrato binario V3: tamaños, bootIds, secuencias, rollover, eventos y ACK. No derivar IDs del reloj del navegador.
5. Credenciales de dispositivo aprovisionadas localmente, sin colocarlas en el repositorio.
6. Extracto vectorial con licencia/procedencia y área; hoy la interfaz muestra ausencia de geometrías.

Hasta inspeccionarlos, `legacyAdapter` lanza un error y `/api/estado` responde 501 sin datos. No actualizamos Arduino-ESP32 ni asumimos que 3.3.12 corresponde al firmware actual. Capacidades V4 y comandos están apagados; no hay botones de buzzer, reinicio o calibración.

## Objetivo del receptor (pendiente de implementar y medir)

Mantener SoftAP canal 6, alarma autónoma y callback ESP-NOW mínimo. Servir recursos de `dist/` o `dist/embedded_assets.h` sin Node/PHP. Encabezados correctos para gzip, CSP y no-store para APIs. Conservar PROGMEM si es viable; no cambiar particiones ni LittleFS sin inventario. Comprobar al menos 20 % de margen de partición en la placa real.

Implementar un router de pasarela de rutas explícitas, nunca un proxy de URL libre: rutas humanas de `docs/api-v1.md`, métodos exactos, cuerpos ≤64 KiB, respuestas/páginas acotadas, timeout definido tras medir TLS y un máximo de trabajos de red que no bloquee actuadores. Las credenciales de dispositivo no otorgan roles humanos. Las rutas privadas locales requieren autorización por petición con la sesión humana y el sector.

`/internal/v1/authorize` permite por ahora solo `state` y `diagnostics`, con dispositivo y sesión válidos, sector coincidente y administrador para diagnóstico. Devuelve `cacheable:false`; no es un token reutilizable, no autoriza hardware. Añadir comandos exige diseño e implementación posteriores de expiración, idempotencia y ACK aplicado.

El ESP32 debe devolver resumen público directamente aunque el PC esté apagado. El resumen del servidor de desarrollo no sustituye esa ruta física. Ocultar la API antigua que filtre diagnóstico privado hasta implementar una proyección/autorización apropiada.

HTTPS navegador–ESP32 y ESP32–API con identidad correcta, CA local y reloj válido offline son requisitos pendientes en la placa. Actualmente se verifica HTTPS navegador–servidor local de desarrollo. Si el dispositivo no sostiene la carga, documentar y acordar la alternativa de servir el mismo frontend desde el equipo de apoyo: no confundirla con el origen ESP32 solicitado.

## Semántica de la interfaz

Consulta cada 500 ms, una petición vigente por instancia, timeout 2 s tras conexión y 8 s inicial; retroceso hasta 5 s más variación. Son parámetros de desarrollo para medir, no promesas de latencia ni tasas de adquisición. Vencimiento procede de `staleAfterMs`; 3 s aparece solo en fixtures simulados. Cambiar de origen descarta respuestas tardías del modo anterior.

NORMAL requiere enlace vigente, sensor OK, ejes finitos, lectura válida y referencia provisional/validada. Un hueco o reinicio corta la gráfica. Eventos anteriores permanecen en la cola tras fallas; cerrar no modifica la detección ni controla actuadores. Históricos y eventos recibidos justo al reconectar no disparan un aviso vigente sin prueba adicional.

Máximo 240 puntos/60 s, 100 eventos visibles, 1000 identidades recordadas. Rotación de memoria no acredita historial completo. La posición es configurada, no GPS; (0,0) es válido. Sin extracto no se dibujan calles ni cobertura ficticia.
