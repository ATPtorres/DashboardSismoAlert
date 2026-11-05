# SismoAlert Offline — Especificación para desarrollar la plataforma web

Versión: 1.1 · Fecha: 5 de noviembre de 2026 · Idioma de la interfaz: español.

Actualización 1.1: el dashboard servido por el ESP32 receptor es la interfaz principal de comunicación con usuarios y administrador. Los roles y permisos son parte de la primera entrega. MySQL será la base de datos persistente, ejecutada en un equipo local de apoyo mediante una API; no dentro del ESP32.

Documento de requisitos y guía de implementación. Entregable preparado a partir de [SISMOALERT OFFLINE — Informe final de Telecomunicaciones](https://docs.google.com/document/d/1sFDkKq3-kHG6fzVWfiIo3BOtMp9eCCUq4v2gjMKPLuM/edit?tab=t.0), incluyendo su evolución V4. No contiene código de una web terminada ni acredita nuevas pruebas físicas.

Las etiquetas **Documentado**, **Propuesto** y **Pendiente** distinguen el contenido del informe, las decisiones de diseño de esta especificación y lo que exige inspección del firmware o ejecución física. Los contratos JSON y límites de recursos siguientes son propuestas; no son una transcripción de una API existente.

## 1. Resumen y propósito

Construir un panel local para consultar vibraciones medidas por un MPU6050 conectado a un ESP32 emisor. El emisor comunica datos mediante ESP-NOW cifrado a un ESP32 receptor, que administra LEDs/buzzer y sirve la web al teléfono por su propia red Wi-Fi. El sistema debe seguir funcionando sin router externo ni internet.

La web será ese mismo dashboard del ESP32, con vistas adaptadas al rol. El usuario verá estados, avisos e información publicada; el administrador accederá además a diagnóstico, historial, cuentas y configuración autorizada. No hace falta otra página independiente para la comunicación principal. Será ligera, adaptable a celulares y extensible a varios nodos sin presentar dispositivos virtuales como instalados.

El ESP32 conserva detección/actuación, interfaz y datos actuales. Un servidor local de apoyo ejecutará la API de cuentas, permisos e historial y MySQL. Este equipo debe estar encendido para esas funciones, pero no necesita internet. Si falla, el ESP32 seguirá mostrando un resumen público de contingencia y manejando sus actuadores; las funciones protegidas quedarán indisponibles. No se promete MySQL, cuentas y administración completas con únicamente los dos ESP32.

Mensaje permanente breve: **«Monitor experimental de vibraciones. No predice terremotos ni sustituye las alertas oficiales».** Una anomalía no demuestra un sismo, una magnitud, un epicentro ni la seguridad estructural del inmueble.

### 1.1 Base técnica y alcance comprobado

| Elemento | Situación según el informe | Consecuencia para la web |
| --- | --- | --- |
| Montaje físico | Un emisor y un receptor ESP32, MPU6050 | Un nodo real en la primera entrega |
| Acceso | SoftAP `SismoAlert_Offline`, canal 6, receptor AP+STA, `http://192.168.4.1` | Todos los recursos deben servirse localmente |
| API existente | `GET /api/estado` | Inspeccionar su JSON real antes de integrar |
| Integral V3 | Operación física confirmada por el desarrollador: sensor, diagnóstico remoto, ACK, recuperación y panel | Mantener compatibilidad; no atribuirle métricas V2 |
| V2 | Mensajes de 56 bytes; telemetría nominal cada 250 ms | Referencia histórica, diferente del formato V3 |
| V3 | Mensajes de 104 bytes; decisión en el emisor | El navegador representa el estado recibido |
| V4 | Diseño de adquisición a 100 Hz, resúmenes a 4 Hz, ventanas y perfil persistente | Mostrar estas funciones solo si el firmware las anuncia |
| Cartografía | Canvas y geometrías OSM precargadas; funcionamiento local confirmado | Preservar mapa local y atribución |
| ULAT | Caracterización documental y sectorización conceptual | No afirmar instalación, cobertura o calibración en el inmueble |

Resultados que pueden aparecer únicamente en «Antecedentes de pruebas»: V2, 900/900 mensajes a 2 m y 898/900 a 6 m con pared y muebles; RSSI medios aproximados −66,93 y −83,32 dBm. El informe añade escenarios hasta 250 m, con resúmenes aproximados C–G y versión no especificada. No representan cobertura garantizada ni mediciones actuales del panel. Los tiempos V2 reportados, unos 850 ms hasta alarma y otros 400 ms hasta actualización web, son observaciones funcionales y no una garantía de latencia.

### 1.2 Ubicaciones que no deben confundirse

| Referencia | Coordenadas | Interpretación |
| --- | --- | --- |
| Nodo de demostración 1 | −17.39779, −66.14954 | Posición fija configurada, persistencia comprobada |
| Sede ULAT de referencia | −17.397618, −66.149506 | Referencia documental del caso de estudio |

El radio histórico de 100 m es exclusivamente una referencia gráfica. No representa alcance del sensor, cobertura de radio, área de daño ni propagación sísmica. Las coordenadas configuradas no son GPS. La cantidad de decimales no acredita exactitud física.

## 2. Decisiones de producto y prioridades

### 2.1 Primera entrega: dashboard principal con roles y MySQL

1. Carga completamente local, incluso en un teléfono que nunca abrió la web antes.
2. Lectura de la API del receptor, supervisión independiente de enlace y sensor, y antigüedad visible.
3. Panel con estado, lecturas con unidades, gráfica temporal acotada y diagnóstico básico.
4. Mapa offline con nodo, coordenadas, zoom, desplazamiento y centrado.
5. Avisos de anomalía sin duplicación por cada consulta; cierre exclusivamente visual.
6. Cola temporal acotada, historial persistente en MySQL y exportación CSV/JSON autorizada con origen y calidad de tiempo.
7. Demostración separada, etiquetada y desactivada en producción por defecto.
8. Diseño adaptable con azul, amarillo, fondo blanco y texto negro/blanco.
9. Inicio/cierre de sesión, roles USUARIO y ADMINISTRADOR, y autorización efectiva en servidor desde la primera entrega.
10. API local de apoyo con MySQL para cuentas, permisos, historial persistente, configuración versionada y auditoría.
11. Indicador de disponibilidad del servicio de datos y modo de contingencia cuando no esté disponible.

La primera entrega completa incluye administración de cuentas y permisos, historial persistente y diagnóstico protegido. Las operaciones sobre hardware dependen además de sus capacidades reales: no ofrecer botones para calibrar, modificar umbrales, reiniciar equipos o silenciar el buzzer si el firmware no implementa y protege esas acciones. En tal caso, mostrar la configuración del equipo en modo lectura. Un prototipo HTTP de consulta puede ser un hito intermedio, pero no cumple por sí solo la entrega con roles.

### 2.2 Evolución: comandos y calibración soportados por firmware

Propuesta condicionada a soporte del firmware: aplicar cambios de ubicación y parámetros al dispositivo, perfiles de calibración y simulacro controlado. Los comandos al emisor necesitan un protocolo propio, confirmación, expiración e idempotencia; un HTTP 200 del receptor no demuestra que el emisor haya aplicado el cambio. Cuentas, roles, MySQL y auditoría no se posponen a esta etapa.

### 2.3 Ampliaciones posteriores

Varios nodos por sector, varias pasarelas y agregación mediante MQTT/TLS. MySQL y la API local de la primera entrega podrán ampliarse para atender varios sectores. La operación local y la alarma de cada sector deben continuar si el servidor falla.

Excluir del alcance inicial: nube obligatoria, cuentas de estudiantes, pagos, geolocalización del teléfono, mapas externos en tiempo de ejecución, notificaciones push obligatorias, FFT en el navegador, inteligencia artificial para afirmar sismos y órdenes automáticas de evacuación. No se requieren LoRaWAN, malla ni satélite para la primera web.

### 2.4 Roles, permisos y alcance de acceso

Las cuentas son de acceso al sistema, sin expedientes académicos ni información estudiantil. Dos roles iniciales; no añadir un tercer rol operativo sin necesidad concreta.

| Acción | USUARIO | ADMINISTRADOR |
| --- | --- | --- |
| Ver estados, avisos vigentes y ayuda | Sí, de sus sectores autorizados | Sí, de sus sectores autorizados |
| Ver ubicación publicada y gráfica básica | Sí, según sector | Sí |
| Ver sus datos de cuenta/cambiar contraseña | Sí | Sí |
| Consultar diagnóstico y métricas técnicas | No | Sí |
| Consultar/exportar historial completo | No | Sí, dentro de su alcance |
| Crear, desactivar cuentas o asignar roles | No | Sí |
| Consultar auditoría | No | Sí |
| Publicar instrucciones informativas | No | Sí; nunca evacuación automática |
| Cambiar configuración del sistema | No | Sí, con validación y auditoría |
| Aplicar comandos/calibración al hardware | No | Sí, solo con soporte confirmado |
| Cerrar un aviso en su navegador | Sí | Sí; no controla el buzzer |

Propuesta de contingencia: visitantes sin sesión pueden ver únicamente un resumen público de estado y avisos generales, sin cuentas, coordenadas privadas, diagnóstico ni exportaciones. Este acceso público es limitado y no adquiere el rol USUARIO. No existe registro abierto: el administrador aprovisiona cuentas. No permitir desactivar o degradar al último administrador activo.

Autorizar en cada petición y por recurso/sector; no aceptar el rol enviado por el navegador como prueba. Las rutas protegidas del ESP32 también deben rechazar accesos directos sin autorización, incluida la API antigua si expone diagnóstico privado. Aplicar denegación por defecto, mínimo privilegio y revocación efectiva de sesiones al desactivar cuentas o cambiar sus permisos [OWASP, referencia 9].

## 3. Arquitectura recomendada

```text
MPU6050 ─I²C─> ESP32 emisor
                  │ adquisición, validación y decisión local V3/V4
                  │ ESP-NOW unicast cifrado + eventos/ACK
                  ▼
             ESP32 receptor ──> LEDs y buzzer
                  │ dashboard estático, API local y cola de eventos
                  │ SoftAP local + HTTPS objetivo para sesiones
                  ▼
           Navegador: una misma interfaz
           USUARIO / ADMINISTRADOR, según permisos

ESP32 receptor ─HTTPS autenticado─> API local de apoyo ─> MySQL
                                    │ cuentas, sesiones, roles
                                    │ historial, configuración y auditoría
                                    └ PC/miniPC local conectado al SoftAP

Sin API/MySQL: continúan detección, actuadores y resumen público local.
Futuro: varias pasarelas ─MQTT/TLS─> agregación de varios sectores.
```

### 3.1 Tecnologías

**Propuesto:** HTML semántico, CSS con variables y JavaScript con módulos. Canvas para gráfica y mapa; SVG local para iconos. Sin framework pesado en la versión embebida. Herramienta de empaquetado opcional durante el desarrollo; los archivos finales serán estáticos, sin Node.js ejecutándose en el ESP32.

**Servidor de apoyo propuesto:** PHP en una versión con soporte vigente, API JSON con PDO y controlador PDO_MYSQL, MySQL 8.4 LTS/InnoDB y servidor web HTTPS. PHP y MySQL corren en el PC/miniPC, nunca en el ESP32. Fijar versiones concretas compatibles al implementar. PDO permite consultas preparadas; usar las funciones estándar de hash/verificación de contraseñas y verificar soporte Argon2id [referencias 10–11]. No mezclar PHP con los archivos estáticos que sirve el ESP32.

Firmware C++ sobre Arduino-ESP32, conservando inicialmente las dependencias del proyecto existente. El informe cita Arduino-ESP32 3.3.12 para los ensayos V2; verificar la versión del firmware actual y fijarla para reproducibilidad, sin actualizarla automáticamente. Comprobar placa, flash, particiones y bibliotecas antes de elegir almacenamiento o servidor.

Mantener inicialmente el mecanismo existente de recursos en memoria de programa si funciona y cabe. LittleFS es una alternativa para separar archivos; requiere definir particiones y un procedimiento coherente de actualización de firmware y recursos. No cambiarlo solo para añadir complejidad.

El frontend no calculará la alarma física ni reconstruirá una captura de 100 Hz a partir de cuatro resúmenes por segundo. La decisión de detección pertenece al firmware del emisor en V3/V4; la salida física pertenece al receptor.

### 3.2 Límites iniciales de ingeniería

Objetivos propuestos, pendientes de medir en la placa real:

- HTML, CSS y JavaScript: objetivo conjunto ≤200 KiB comprimidos; mapa con presupuesto separado según flash disponible.
- Reservar margen de partición, como mínimo inicial de diseño 20 %, y medir tamaño real antes de cargar.
- Un cliente móvil y el servidor de apoyo como configuración de referencia; probar tres teléfonos más ese servidor antes de declarar ese soporte. Contabilizar el servidor como cliente del SoftAP y medir el coste de TLS.
- Gráfica de 60 s a 4 puntos/s: máximo 240 puntos por serie; no crecer indefinidamente.
- Cola temporal: 100 eventos en RAM del receptor, con pérdidas por rotación/reinicio explícitas. Historial persistente confirmado en MySQL; no confundir ambos niveles.
- Exportaciones paginadas o por streaming con límites; no reservar en RAM el historial completo en una sola cadena.
- Medir heap libre/mínimo, colas, descartes, reinicios y respuesta HTTP con gráfica y mapa activos. Ajustar límites con estos resultados.

Las rutinas de recepción de radio deben copiar lo imprescindible a una cola acotada. Procesamiento, serialización HTTP y escrituras persistentes se ejecutarán fuera de los callbacks críticos.

### 3.3 Red local y flujo de servicios

**Supuesto de despliegue inicial:** un PC o miniPC permanece encendido y se conecta como cliente a `SismoAlert_Offline`. Configurar para él una dirección fija o asignación estable sin colisiones dentro de la subred del SoftAP, después de verificar su DHCP. El ESP32 seguirá en canal 6; no asociarlo a otro AP que cambie el canal e interrumpa ESP-NOW. No se requiere salida a internet ni un router externo.

Flujo objetivo de la misma web:

1. El ESP32 sirve HTML/CSS/JS/mapa; su API entrega el estado actual y resumen público directamente.
2. Las rutas protegidas `/api/v1/session`, cuentas e historial actúan como una pasarela acotada hacia la API PHP local mediante HTTPS. El navegador usa el mismo origen del dashboard: no hay credenciales MySQL en JavaScript ni llamadas SQL desde el ESP32.
3. La API autentica a la persona y consulta MySQL. El ESP32 transmite la sesión de forma segura, sin aceptar encabezados que suplanten usuario o rol. El backend devuelve la decisión autorizada y el alcance permitido.
4. Para diagnóstico o cambios locales protegidos, el ESP32 solicita al backend la autorización del usuario para esa operación/recurso y después valida capacidad, parámetros y vigencia antes de ejecutar. La credencial de dispositivo por sí sola no otorga privilegios administrativos a una persona.
5. El receptor envía eventos en lotes pequeños con su identidad de dispositivo. La API confirma persistencia únicamente después de confirmar la transacción en MySQL.

La pasarela no es un proxy de URL libre: solo rutas y tamaños permitidos, timeouts acotados y ninguna operación de soporte bloqueando el control de alarma. Identidad de dispositivo separada de sesiones humanas, credenciales rotables y validación TLS sin desactivar la comprobación de certificados.

El dashboard con sesiones requiere HTTPS de extremo a extremo, incluido navegador–ESP32. Espressif ofrece un servidor HTTPS; su integración con el firmware/entorno Arduino existente, memoria, concurrencia y confianza de certificados debe probarse [referencia 8]. Usar un certificado con identidad correcta y una CA local instalada en los equipos autorizados, o un esquema de confianza equivalente verificado. Resolver el reloj para validación de certificados offline mediante RTC/aprovisionamiento confiable; no omitir validaciones porque no hay NTP.

Si la placa no sostiene HTTPS más la pasarela bajo carga, evaluar otra placa o terminar TLS en el equipo local y servir allí el mismo frontend. Esa alternativa cambia el origen principal de acceso y debe documentarse como decisión de arquitectura; no afirmar que cumple literalmente «servido por el ESP32» sin explicarlo. El objetivo de esta especificación conserva el ESP32 como origen principal.

### 3.4 Funcionamiento ante fallas del servicio de datos

| Situación | Sigue disponible | Se suspende o limita |
| --- | --- | --- |
| Sin internet | Todo el servicio local si los equipos están encendidos | Integraciones externas opcionales |
| API de apoyo caída | Sensor, radio, actuadores, dashboard y resumen público actual | Login, permisos privados, comandos y consultas históricas |
| MySQL caído | Operación física y resumen público; cola temporal | Nuevas escrituras confirmadas y operaciones protegidas dependientes de BD |
| Reinicio del servidor | Operación del ESP32; reintentos acotados | Funciones de apoyo hasta recuperación |
| Reinicio del receptor | Datos históricos ya confirmados en MySQL | RAM no persistida; marcar discontinuidad |

No conservar privilegios ilimitados en caché para sortear una caída: fallar cerrado en acciones protegidas. La API devolverá 503 y el dashboard indicará «Servicio de datos no disponible». Al restaurar servicio, reenviar registros pendientes con deduplicación; no activar alarmas por eventos históricos. La cola RAM no garantiza cero pérdidas ante corte eléctrico: un registro crítico duradero exige almacenamiento local adicional y pruebas de desgaste/integridad.

## 4. Diseño visual y experiencia

### 4.1 Paleta

```css
:root {
  --color-primary: #1346A0;
  --color-primary-hover: #0D3478;
  --color-accent: #FACC15;
  --color-background: #FFFFFF;
  --color-surface: #F5F8FD;
  --color-text: #111827;
  --color-text-muted: #475569;
  --color-on-primary: #FFFFFF;
  --color-on-accent: #111827;
  --color-border: #CBD5E1;
  --color-danger: #B91C1C;
  --color-success: #166534;
}
```

Azul para navegación, encabezados y acción principal; amarillo para avisos y acentos con texto negro. Texto blanco sobre azul; negro sobre blanco o amarillo. Rojo y verde se reservan para estados técnicos cuando aporten claridad y correspondencia con los LEDs; acompañarlos siempre de palabras e iconos. Si se restringen esos colores, mantener estados legibles mediante rótulos y símbolos.

Tipografía del sistema, sin descargar fuentes. Texto base 16 px, controles táctiles de unos 44 px, foco visible y contraste verificado. Respetar reducción de movimiento; evitar destellos y pulsaciones continuas. Los valores técnicos pueden usar una fuente monoespaciada del sistema.

### 4.2 Organización de la pantalla

```text
SismoAlert Offline                     [Conexión al receptor]
Monitor experimental                 [REAL / DEMOSTRACIÓN]

[Estado de detección] [Enlace del nodo] [Sensor] [Antigüedad]

[Gráfica de vibración / aceleración]   [Mapa offline]
[Valores X/Y/Z y RMS/pico disponibles] [Nodo y ubicación]

[Eventos recientes: hora relativa, tipo, nodo y vigencia]
[Acceder / Mi cuenta] [Ayuda]
Administrador: [Diagnóstico] [Historial/Exportar] [Cuentas] [Configuración]
```

Móvil: una columna, estado primero y mapa después de lecturas. Escritorio: dos columnas para gráfica/mapa. Evitar desplazamiento horizontal a partir de 360 px. Usar navegación por secciones o rutas hash (`#/panel`, `#/eventos`) para no requerir reescritura de rutas en el ESP32.

### 4.3 Pantallas y componentes

| Vista | Contenido | Acciones permitidas |
| --- | --- | --- |
| Panel | Estado, antigüedad, lecturas y gráfica | Pausar solo gráfica, elegir serie, centrar mapa |
| Mapa y nodo | Posición, condición de ubicación y radio visual | Zoom, desplazamiento, centrar |
| Eventos | Avisos visibles por sector; historial completo para administrador | Filtrar y abrir; exportar requiere permiso |
| Diagnóstico | Versiones, RSSI, secuencias, colas, capacidades y tiempo | Solo administrador; copiar sin secretos |
| Configuración | Valores y funciones soportadas | Administrador; aplicar al hardware solo si está soportado |
| Acceso y cuenta | Inicio/cierre de sesión, contraseña y rol efectivo | Gestionar la propia sesión |
| Cuentas y auditoría | Usuarios activos, roles, alcances y cambios | Solo administrador |
| Ayuda | Conexión local, significado de estados, alcance | Consultar contenido local |

Gráfica: eje de tiempo relativo, unidades visibles, huecos ante datos inválidos y pausa identificada. No conectar con una línea intervalos perdidos. En V3 mostrar aceleración/giro y magnitud solo si está disponible o su cálculo de presentación queda explícitamente definido. En V4 mostrar RMS/pico únicamente si el emisor los entrega con ventana y perfil identificados. No usar escalas Richter/Mercalli.

Mapa: consumir geometrías vectoriales locales; atribución visible «© OpenStreetMap contributors» y archivo local de licencia/procedencia. Separar marcador del nodo y sede conceptual. Si faltan geometrías, mostrar coordenadas y aviso; la telemetría debe seguir funcionando. Fuera del extracto, avisar sin mover artificialmente el marcador al borde. Ofrecer alternativa textual accesible al Canvas.

El modelo `ULAT-CBBA-UR/N01–N10/S01` es conceptual. No llenar diez pisos con supuestas lecturas, rutas o sensores instalados. «Ruta autorizada» y «Punto de reunión» permanecerán «No configurado / pendiente de verificación».

## 5. Estados, vigencia y avisos

### 5.1 Separar dimensiones

No resumir toda la condición en un booleano `alerta`. Representar por separado:

- Conexión navegador–receptor: `CONECTANDO`, `DISPONIBLE`, `NO_DISPONIBLE`.
- Enlace receptor–nodo: `ESPERANDO_DATOS`, `VIGENTE`, `DEGRADADO`, `SIN_ENLACE`.
- Sensor: `OK`, `ERROR_SENSOR`, `DESCONOCIDO`.
- Detección: `CALIBRANDO`, `NORMAL`, `ANOMALIA`, `PERFIL_NO_VALIDO`, `NO_DISPONIBLE`.
- Origen: `REAL`, `SIMULADO`; simulacro de hardware como bandera adicional independiente.

Solo mostrar NORMAL como vigente cuando exista lectura válida, enlace vigente, sensor OK y referencia/perfil requerido válido. NORMAL significa «bajo el criterio configurado», no «edificio seguro».

| Condición | Mensaje | Tratamiento |
| --- | --- | --- |
| Antes de la primera lectura | Esperando datos del nodo | Sin valores ficticios ni estado normal |
| Referencia en preparación | Estableciendo referencia | Detección no disponible |
| Dato válido bajo criterio | Sin anomalía detectada | Valores vigentes |
| Evento vigente | Vibración anómala detectada | Aviso con nodo, origen y vigencia |
| Sensor con error | Falla del sensor; detección suspendida | Ejes inválidos como `—`, gráfica con huecos |
| Perfil inválido V4 | Perfil no válido; revisar calibración | No declarar detección calibrada |
| Nodo sin mensajes frescos | Sin enlace con el nodo | Última posición conocida y edad visibles |
| HTTP sin respuesta | No se puede consultar el receptor | No atribuir automáticamente la falla al sensor |
| Demostración | DEMOSTRACIÓN — DATOS SIMULADOS | Rótulo permanente, también en exportaciones |

Las fallas se presentan con prioridad para describir el estado actual, pero no borran una anomalía anterior: conservarla como «Última anomalía; estado actual desconocido» si se pierde el enlace durante ella. No inferir recuperación por cerrar un aviso ni por recibir un JSON incompleto.

### 5.2 Caducidad y relojes

El receptor calcula la edad de la última recepción con reloj monotónico y distingue edad de recepción de edad de medición. La recepción de un paquete atrasado no lo convierte por sí sola en una medición actual: validar sesión, secuencia y vigencia del protocolo. No restar relojes independientes sin sincronización.

Propuesta inicial de consulta HTTP(S): cada 500 ms con una sola solicitud en curso, timeout de respuesta de 2 s en conexiones establecidas y reintento progresivo hasta 5 s con pequeña variación aleatoria. La negociación TLS inicial tendrá un plazo mayor configurable, determinado en pruebas; no confundirla con falla del sensor. Reutilizar conexiones para evitar un handshake por consulta. Registrar esta configuración y ajustarla según carga medida. El periodo del navegador no cambia la adquisición del sensor ni garantiza actualización a 4 Hz.

Para nodo sin enlace, adoptar inicialmente 3 s sin mensaje válido como hipótesis de prueba, publicada por la API como `staleAfterMs`. Mantener el valor ya implementado si difiere hasta revisar el firmware; no cambiar silenciosamente el comportamiento del actuador. El umbral de evento vigente debe definirse aparte en el protocolo. Si no se puede demostrar la vigencia de un evento antiguo tras reconexión, tratarlo como histórico.

Mientras no haya hora absoluta confiable, mostrar «hace 2 s» o «t+120 s desde arranque». La hora del teléfono puede acompañar el registro como `browser_observed`, sin presentarse como hora del ESP32. Si existe UTC fiable, guardar zona/origen de tiempo y mostrar hora local de Cochabamba, `America/La_Paz`. No depender de NTP para operar offline.

### 5.3 Reglas de eventos

1. Identidad estable por `nodeId + nodeBootId + eventId`; secuencia para ordenar mensajes dentro de la sesión.
2. Una misma identidad genera una sola entrada aunque haya reintentos, ACK o varias consultas HTTP.
3. Cerrar significa «Cerrar aviso en esta pantalla». No enviar comandos al buzzer ni modificar la detección.
4. Nuevos eventos se anuncian una vez. Históricos recuperados se agregan al historial sin abrir aviso actual.
5. Separar ACK de radio/aplicación, confirmación de comando y revisión humana. Ninguno acredita por sí solo que el buzzer sonó físicamente.
6. Mantener visibles las fallas aunque se cierre el aviso de anomalía.
7. No prometer sonidos de navegador: requieren interacción y pueden suspenderse al bloquear el teléfono. La señalización física debe ser autónoma.

## 6. Contrato de integración y API

### 6.1 Primero inspeccionar el sistema existente

Antes de programar la integración: obtener ambos sketches y recursos web, versiones de dependencias, estructura binaria V3 y respuestas reales de `GET /api/estado` para reposo, anomalía, sensor ausente, calibración y pérdida de enlace. No se proporcionaron esos archivos ni el JSON en el informe.

Crear un adaptador `legacyAdapter` que traduzca el JSON observado al modelo interno. No sobrescribir `GET /api/estado` ni inventar sus nombres de campos. Si un dato no existe, usar `null` o una capacidad no disponible. V2 no permite deducir ERROR_SENSOR remoto cuando solo informa ausencia de telemetría.

### 6.2 API nueva propuesta, con versión

Prefijo `/api/v1`; JSON UTF-8 y `Cache-Control: no-store` para estado, eventos y sesiones. Rutas nuevas requieren implementación explícita del receptor y, donde corresponda, de la API de apoyo. La consulta pública devuelve únicamente una proyección limitada; los datos privados nunca deben enviarse al navegador para luego ocultarlos con CSS.

| Método y ruta | Función | Acceso |
| --- | --- | --- |
| `GET /api/estado` | Compatibilidad; proteger campos privados | Inspeccionar y adecuar antes de publicar |
| `GET /api/v1/public/state` | Resumen mínimo para contingencia | Público local, limitado |
| `GET /api/v1/info` | Versiones, capacidades y límites | Administrador |
| `GET /api/v1/state` | Snapshot consistente filtrado por sector/rol | Usuario o administrador autorizado |
| `GET /api/v1/events?cursor=...&limit=20` | Historial MySQL, límite máximo 50 | Administrador dentro de su alcance |
| `GET /api/v1/config` | Configuración sin secretos | Administrador |
| `GET /api/v1/export/events.csv` | Exportación acotada | Administrador |
| `POST /api/v1/session` | Login, primera entrega | HTTPS, limitación de intentos y defensa de origen |
| `GET /api/v1/me` | Cuenta, rol y permisos efectivos | Sesión válida |
| `DELETE /api/v1/session` | Cierre de sesión | Sesión válida + CSRF |
| `POST /api/v1/me/password` | Cambiar contraseña y revocar sesiones | Sesión válida + verificación actual + CSRF |
| `GET/POST /api/v1/users` | Listar/crear cuentas | Administrador; POST con CSRF |
| `PATCH /api/v1/users/{id}` | Rol, alcance o desactivación | Administrador + CSRF + auditoría |
| `GET /api/v1/audit` | Consultar auditoría | Administrador |
| `PATCH /api/v1/config` | Cambio validado/versionado | Administrador + CSRF |
| `POST /api/v1/commands` | Comando al nodo, evolución de firmware | Administrador + CSRF + idempotencia |
| `GET /api/v1/commands/{id}` | Estado real del comando | Administrador |

No habrá rutas GET que alteren umbrales, claves, alarmas o estado del hardware. Login, cuentas, permisos e historial pertenecen a la primera entrega; comandos y calibración se habilitan por capacidad. Endpoints de servicio internos, inaccesibles para sesiones humanas: `POST /internal/v1/ingest/events`, `POST /internal/v1/ingest/summaries` y `POST /internal/v1/authorize`, con identidad y alcance de dispositivo. No exponer el puerto MySQL a navegadores o al SoftAP.

### 6.3 Ejemplo de modelo normalizado

Ejemplo **ilustrativo y simulado**, con cifras elegidas para describir la estructura:

```json
{
  "schemaVersion": 1,
  "dataOrigin": "SIMULATED",
  "gateway": {
    "id": "GW01",
    "bootId": "demo-gw-boot-01",
    "uptimeMs": 120000,
    "firmwareVersion": "example-only",
    "timeSource": "UNSYNCED",
    "utc": null
  },
  "capabilities": {
    "remoteSensorStatus": true,
    "windowMetrics": false,
    "eventHistory": true,
    "configWrite": false,
    "rawSampleExport": false
  },
  "services": {
    "identityApi": "AVAILABLE",
    "database": "AVAILABLE",
    "pendingEvents": 0,
    "droppedEvents": 0
  },
  "nodes": [{
    "id": 1,
    "bootId": "demo-node-boot-01",
    "sequence": 420,
    "receivedAtGatewayUptimeMs": 119900,
    "lastRxAgeMs": 100,
    "staleAfterMs": 3000,
    "linkState": "VIGENTE",
    "sensorState": "OK",
    "detectionState": "NORMAL",
    "drill": false,
    "rssiDbm": -70,
    "measurement": {
      "valid": true,
      "accelerationG": {"x": 0.001, "y": 0.002, "z": 1.0},
      "angularVelocityDps": null,
      "dynamicMagnitudeG": null,
      "rmsG": null,
      "peakG": null,
      "windowMs": null,
      "acquisitionHzMeasured": null,
      "telemetryHzNominal": 4
    },
    "location": {
      "latitude": -17.39779,
      "longitude": -66.14954,
      "visualReferenceRadiusM": 100,
      "source": "CONFIGURED_DEMO_REFERENCE",
      "physicalInstallationVerified": false,
      "buildingId": null,
      "levelId": null,
      "sectorId": null
    },
    "calibration": {
      "profileId": null,
      "status": "PROVISIONAL_REFERENCE"
    }
  }]
}
```

En modo real `dataOrigin` debe ser `REAL` y las cifras provenir del receptor. Si un snapshot contiene orígenes distintos, cada registro tendrá su origen y la interfaz los separará; preferir no mezclarlos en la primera entrega.

### 6.4 Validaciones del contrato

- Enteros no negativos para secuencias/tiempos; identificadores acotados; resolver reinicio y desbordamiento de contadores en firmware/adaptador.
- Latitud entre −90 y 90; longitud entre −180 y 180; ambos valores finitos. `(0,0)` es una coordenada válida, no un indicador de ausencia.
- Radio visual positivo con máximo definido por configuración; propuesta inicial de interfaz 1–1000 m, sin reemplazar un límite diferente del protocolo existente.
- Lecturas numéricas finitas y coherentes con rango/unidad; JSON usa `null`, nunca `NaN` ni valores de relleno.
- Diferenciar `targetAcquisitionHz` de `acquisitionHzMeasured`; no llenar el segundo con 100 porque sea la meta.
- PDR solo si se conocen intentos y recepciones únicas de una misma sesión/ventana. RSSI aislado no es una tasa de entrega ni se traduce a metros.
- Validar firma, versión, longitud, MAC autorizada, identidad y coherencia en receptor antes de publicar. Repetir validación de forma en frontend para tolerar errores, sin convertirla en la barrera de seguridad.
- Construir cada respuesta desde un snapshot consistente para evitar mezclar ejes/estado de secuencias diferentes.

Evento mínimo: `id`, `nodeId`, `nodeBootId`, `type`, `origin`, `drill`, `sequence`, `receivedAtGatewayUptimeMs`, `freshness`, `locationSnapshot`, `profileId` y estado de ACK si existe. Guardar la ubicación del momento, sin reescribir eventos antiguos cuando cambia la configuración.

Errores uniformes: `{ "error": { "code": "INVALID_CONFIG", "message": "Revise los valores indicados" } }`. Usar 400 para entrada inválida, 401/403 para acceso, 404 para recurso ausente, 409 para conflicto de versión, 413 para tamaño excesivo, 429 para límites y 503 para indisponibilidad. No devolver claves ni trazas internas.

El cursor de historial MySQL utiliza una clave estable y no se invalida solo porque reinicie el ESP32. Si caduca por retención, devolver un indicador explícito de discontinuidad y un nuevo cursor. Un cursor de la cola RAM sí puede invalidarse por rotación o reinicio: identificar ese origen. No aparentar que el historial está completo.

## 7. Modelo de datos y persistencia

La base de datos persistente será **MySQL**, por elección del usuario. El ESP32 usa RAM/NVS para operación; la API PHP conecta con MySQL en el equipo local. El navegador y el firmware no tendrán usuario/contraseña de MySQL ni ejecutarán SQL directamente.

Entidades propuestas:

| Entidad | Campos esenciales | Almacenamiento inicial |
| --- | --- | --- |
| Pasarela | ID, versión, bootId, uptime, capacidades | Firmware + RAM |
| Nodo | ID, bootId, versión, ubicación y correspondencia física | Configuración persistente donde corresponda |
| Snapshot | Secuencia, ejes, estados, RSSI y edad | RAM, última lectura |
| Evento | Identidad, tipo, origen, ubicación y tiempo | RAM temporal → MySQL al confirmar persistencia |
| Cuenta/rol/sesión | Identidad, hash de contraseña, alcance y revocación | MySQL, acceso exclusivo de la API |
| Auditoría | Actor, acción, recurso, resultado y fecha del servidor | MySQL, sin secretos |
| Perfil V4 | Versión, montaje, filtros, tasas, umbrales y calidad | NVS solo al implementar V4 |
| Preferencias visuales | Serie, zoom, disposición | Navegador, sin secretos |

Mantener configuraciones pequeñas en NVS; no escribir cada lectura ni cada ventana en flash. La ubicación ya es persistente según el informe; no confundirla con el perfil V4 A/B, cuya persistencia física está pendiente. Si se agrega persistencia de eventos, fijar política de rotación, desgaste y recuperación ante corte de energía.

El historial persistente confirmado reside en MySQL; distinguirlo de «Pendiente de sincronización» en RAM y de los puntos guardados en el navegador. El historial del navegador no es el registro oficial ni garantiza retención tras cerrar la pestaña. Detectar un nuevo `gateway.bootId`, limpiar la continuidad gráfica y marcar el reinicio. Mostrar cuándo existe discontinuidad y no presentar un historial parcial como completo.

CSV: incluir origen, simulacro, versiones, unidades, sesión, secuencia, tipo de tiempo, antigüedad y discontinuidades. Escapar comillas y neutralizar celdas de texto que puedan interpretarse como fórmulas (`=`, `+`, `-`, `@`) sin convertir los valores numéricos negativos legítimos en texto. Exportar también un manifiesto JSON cuando haya calibración o sesiones de ensayo.

La señal rápida de 100 Hz requiere registro local específico y transporte separado. Una exportación de puntos recibidos por HTTP debe llamarse «Telemetría recibida», nunca «Muestras completas del sensor».

### 7.1 Esquema MySQL propuesto

InnoDB, `utf8mb4`, claves foráneas y migraciones versionadas. Identificadores internos `BIGINT UNSIGNED`; devolverlos como cadenas JSON cuando puedan superar el rango entero seguro de JavaScript. Tiempo del servidor en UTC (`DATETIME(3)` por convención explícita), separado del tiempo monotónico del dispositivo y de la hora física de medición, que puede ser desconocida.

| Tabla | Campos principales y restricciones |
| --- | --- |
| `users` | `id`, `username VARCHAR(80) UNIQUE`, `password_hash VARCHAR(255)`, `active`, `auth_version`, fechas |
| `roles` | `id`, `code UNIQUE` con USUARIO/ADMINISTRADOR |
| `user_roles` | PK compuesta `user_id, role_id`; claves foráneas |
| `sectors` | `id`, código compuesto único de edificio/nivel/sector, `installation_verified` |
| `user_sector_access` | PK `user_id, sector_id`; alcance autorizado |
| `gateways` | `id`, identificador público único, estado, versión, referencia a credencial de dispositivo protegida |
| `nodes` | `id`, `gateway_id`, identificador de nodo, sector opcional, ubicación; UNIQUE de pasarela/nodo |
| `device_boots` | `id`, dispositivo y bootId; sesión de arranque y calidad de tiempo |
| `events` | `id`, `gateway_id`, `node_id`, `node_boot_id`, `event_id`, secuencia, tipo, origen, simulacro, tiempos y snapshot de ubicación/perfil |
| `telemetry_summaries` | `node_id`, bootId, secuencia, tiempo local/ingesta, ejes o RMS/pico con unidades y flags |
| `sessions` | Hash del token único, `user_id`, versión de autorización, expiración y revocación; nunca token en claro en logs |
| `config_versions` | Recurso, versión, JSON validado, actor, fecha; estado deseado y estado aplicado separados |
| `commands` | ID único, usuario, destino, parámetros validados, expiración y resultado; idempotency key por actor |
| `audit_logs` | Actor humano/dispositivo, acción, recurso, resultado, fecha y correlationId; sin contraseñas/tokens |

En `events`, restricción UNIQUE `(gateway_id, node_id, node_boot_id, event_id)`; en resúmenes UNIQUE `(node_id, node_boot_id, sequence)`. Verificar que los IDs reales del firmware permiten esa identidad; no inventarlos a partir de la hora del navegador. Índices de consulta por `(node_id, ingested_at, id)` y `(type, ingested_at, id)`, ajustados a consultas reales. Ubicación/estado/perfil del evento se guardan como snapshot para preservar trazabilidad.

La tabla de roles de la aplicación no equivale a los roles/usuarios internos de MySQL. La aplicación usará una cuenta MySQL de mínimo privilegio; migraciones con una cuenta distinta. No dar a la API privilegios de administración global ni usar `root`.

### 7.2 Escritura, sincronización y retención

1. Recibir lote acotado con identidad de dispositivo, versión de esquema, origen y claves de deduplicación.
2. Validar dispositivos/sectores permitidos y unidades; insertar dentro de una transacción. Un duplicado solo se acepta como tal si conserva contenido coherente; registrar conflictos de la misma identidad con datos diferentes.
3. Confirmar al ESP32 únicamente las identidades persistidas tras COMMIT. El ACK de almacenamiento es distinto del ACK de evento ESP-NOW.
4. Reintentar con espera progresiva, sin bloquear radio ni actuar de nuevo sobre un evento histórico. Eliminar de cola solo registros confirmados.
5. Publicar `pendingEvents`, `droppedEvents`, `lastSyncAt` y disponibilidad del servicio para que el administrador conozca pérdidas o atraso.

Persistir eventos/fallas/cambios, no todas las muestras rápidas por defecto. Guardar cuatro resúmenes por segundo produce 345.600 filas diarias por nodo: dimensionar espacio/índices antes de activarlo. Propuesta inicial configurable: resúmenes a 1 Hz conservados 7 días; eventos y auditoría 90 días, pendiente de necesidades reales. Los avisos significativos no se reducen a 1 Hz: se registran por evento. Si se exige 4 Hz o captura a 100 Hz, redefinir almacenamiento y retención.

Copias de seguridad diarias cifradas en otro volumen, retención inicial de 7 días y ensayo documentado de restauración en una instancia aislada. Contemplar que una copia diaria puede perder hasta un día de datos; si no es aceptable, planificar recuperación a un punto en el tiempo. No declarar recuperación garantizada sin prueba. Las tareas de borrado por retención no deben saturar el ESP32 ni la API.

### 7.3 Seguridad de la base de datos

MySQL escuchará solo en loopback si comparte equipo con la API; firewall sin acceso al puerto 3306 desde teléfonos. Si se separa la API de la base, usar red restringida y TLS con verificación de identidad [referencia 7]. Credenciales en configuración privada del servidor, fuera de la raíz pública y del repositorio; entregar solo una plantilla sin valores reales.

PDO con consultas parametrizadas y listas permitidas para nombres de columnas/ordenación; nunca concatenar entrada del usuario en SQL. Hash de contraseñas con `password_hash`/`password_verify`, preferentemente Argon2id disponible y dimensionado para el servidor, con rehash cuando corresponda. Prohibir texto plano, MD5 o SHA-256 simple para contraseñas. Proteger cambios de roles y último administrador con transacciones y control de concurrencia.

## 8. Seguridad y continuidad

### 8.1 Modelo de amenazas práctico

Contemplar dispositivos no autorizados en el Wi-Fi, peticiones desde páginas de otro origen, escalamiento de privilegios, inyección SQL, campos malformados, duplicados/repeticiones, saturación de consultas, pérdida de alimentación y acceso físico a placas. La clave de ESP-NOW, contraseña Wi-Fi, sesión humana, credencial de dispositivo y cuenta MySQL protegen funciones diferentes.

### 8.2 Medidas de la primera entrega

- SoftAP protegido con una contraseña larga, exclusiva y cambiable; nunca publicar una contraseña universal. Limitar conexiones y no exponer el receptor mediante reenvío de puertos.
- ESP-NOW unicast con PMK/LMK explícitas y únicas según el esquema de aprovisionamiento. No poner claves en JS, mapas, CSV, diagnósticos, repositorios o documentación pública.
- Aceptar nodos autorizados y mensajes con sesión/secuencia coherentes; aplicar deduplicación y protección contra reactivación de eventos antiguos.
- Rutas públicas solo de consulta; autenticación y autorización en todas las protegidas. Sin CORS abierto; validar `Host` esperado como defensa adicional contra acceso mediante nombres ajenos.
- Representar texto recibido con `textContent`, sin `innerHTML` ni `eval`. Acotar tamaños de nombres, consultas, JSON y recursos.
- Servir recursos de origen propio. Propuesta de CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. Ajustar solo si existe una necesidad verificada.
- Añadir `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`. HSTS solo tras validar el despliegue HTTPS y su identidad; nunca como sustituto de TLS.
- Limitar frecuencia de peticiones y tamaño de respuesta; colas y memoria acotadas. Un navegador lento o un mapa complejo no deben bloquear la alarma física.
- Registrar fallas y reinicios sin secretos. Ocultar coordenadas detalladas de futuros montajes privados cuando el contexto lo requiera.

### 8.3 Acceso y administración desde la primera entrega

Sobre HTTP la contraseña, sesión y contenido no tienen protección TLS. El cifrado de ESP-NOW no protege el tramo web. El modo HTTP existente puede conservarse para un resumen público de contingencia o redirección; no recibirá contraseñas, cookies de sesión o comandos. La primera entrega con cuentas requiere resolver HTTPS según la sección 3.3, no omitir los roles ni posponerlos silenciosamente.

Implementar dos vistas de una misma aplicación según permisos efectivos. Primer administrador por procedimiento local de un solo uso y contraseña propia, sin credenciales publicadas por defecto. Restablecimiento de contraseña mediante proceso local auditado; no exigir correo ni internet. Desactivar la cuenta revoca sesiones, y cambiar permisos se refleja en la siguiente operación protegida.

En el entorno HTTPS: credenciales sin valores por defecto, sesiones opacas aleatorias generadas con fuente criptográfica, expiración e invalidación, cookies `HttpOnly`, `SameSite=Strict` y `Secure`; autenticación/autorización comprobadas en servidor. No guardar tokens en `localStorage`. Aplicar verificación estricta de origen y token CSRF a operaciones mutantes; limitar intentos de acceso. No inventar criptografía ni usar un hash rápido simple como almacenamiento de contraseñas.

Cambios de configuración: validar esquema y límites en servidor, exigir versión esperada, guardar de forma atómica y conservar último perfil válido. Comandos remotos: `commandId`, destino, vigencia, versión, estados `PENDING/APPLIED/FAILED/EXPIRED`, confirmación del nodo y reintentos acotados. No exponer un control de alarma física en la primera entrega. Un administrador puede registrar revisión humana de un evento, pero eso no implica que el emisor lo haya procesado ni que el actuador funcionó.

Actualización de firmware: proceso local documentado al inicio. OTA y firma de actualizaciones son una etapa posterior con particiones, recuperación y verificación propias.

### 8.4 Restricciones offline del navegador

`http://192.168.4.1` es el acceso histórico y no equivale a `localhost` ni a un contexto HTTPS. La versión con roles tendrá un origen HTTPS de confianza configurado y documentado. Aun así, no basar la operación esencial en Service Workers, push, GPS o instalación PWA: la carga local se consigue sirviendo todos los archivos desde el receptor. Si el teléfono abandona el Wi-Fi, el panel pierde acceso aunque conserve contenido en caché. Teléfono bloqueado/pestaña suspendida no garantizan avisos; el buzzer y LEDs permanecen autónomos.

No consultar CDNs, fuentes, analítica o APIs externas durante la operación. No descargar masivamente teselas del servidor estándar de OpenStreetMap: preparar un extracto vectorial con procedencia y licencia, o usar un proveedor que permita expresamente ese uso. Conservar los avisos de licencia y las obligaciones de redistribución aplicables al extracto.

## 9. V4 y calibración: capacidades condicionadas

El diseño V4 del informe propone adquisición efectiva objetivo de 100 Hz, telemetría de 4 Hz, DLPF candidato CFG=4 (~21 Hz aceleración), ventanas de 1 s y paso de 250 ms. Son objetivos de ingeniería pendientes de validar físicamente.

En V2/V3 documentadas se leen registros aproximadamente a 4 Hz pese a una actualización interna del sensor a 100 Hz. No presentar esas lecturas como adquisición real a 100 Hz ni como espectro fiel. La web no puede corregir el aliasing ocurrido antes de recibir los datos.

Si se implementa V4, el perfil contendrá versión, nodo/montaje, orientación, escala, DLPF, tasa objetivo y medida, ventana/paso, filtros, mediana/MAD, umbrales de entrada/salida, persistencia y calidad de validación. Almacenamiento A/B con verificación de integridad propuesto en NVS; invalidar ante cambio incompatible de montaje o configuración.

Los umbrales históricos 0,12 g y 0,06 g son provisionales. No convertirlos en valores sísmicos certificados ni recalibrar silenciosamente desde el navegador. Valores candidatos derivados de mediana/MAD necesitan sesiones separadas de ajuste y evaluación. Si faltan RMS, perfil o tasa medida, mostrar «No disponible en este firmware».

## 10. Estructura de proyecto propuesta

```text
sismoalert/
  README.md
  docs/
    specification.md
    integration-notes.md
    api-v1.md
    test-plan.md
  firmware/
    emitter/                  # firmware existente, después evolución V4
    receiver/                 # API, radio, estado y actuadores
    shared/                   # contrato binario y versión, sin secretos
  web/
    index.html
    styles/tokens.css
    styles/app.css
    src/main.js
    src/api/client.js
    src/api/legacy-adapter.js
    src/domain/state.js
    src/domain/events.js
    src/ui/dashboard.js
    src/ui/chart.js
    src/ui/map.js
    src/ui/export.js
    src/ui/auth.js
    src/ui/accounts.js
    src/config/public-config.js
    assets/map/local-map.json
    assets/icons/
    licenses/
  backend/                    # en PC/miniPC local, no en ESP32
    public/index.php          # router de API; sin archivos de configuración privados
    src/Auth/
    src/Authorization/
    src/Ingestion/
    src/History/
    src/Database/
    src/Audit/
    migrations/               # tablas/índices MySQL y evolución de esquema
    config/                   # plantilla; secretos reales fuera del repositorio
    tests/
  deploy/
    local-server.md           # HTTPS, confianza, servicio PHP/MySQL y firewall
    backup-restore.md
  demo/
    fixtures/                 # todos los escenarios etiquetados SIMULATED
    server/                   # solo entorno de desarrollo
  tests/
    state-and-freshness/
    api-contract/
    roles-and-permissions/
    mysql-and-recovery/
    integration/
  tools/
    build-web/
    package-embedded-assets/
```

Separar transporte, modelo interno, presentación y configuración pública. Las claves se aprovisionan fuera de `web/` y fuera del control de versiones. Versionar el contrato binario y la API de forma independiente; no cambiar a ciegas el tamaño de las estructuras ESP-NOW ni confundir su versión de aplicación con la versión del protocolo ESP-NOW de Espressif.

Para adaptar el proyecto, centralizar textos, colores, nombre, área cartográfica, capacidades y correspondencias verificadas de nodos/sectores. Evitar copiar lógica para cada nodo. Un futuro `nodes[]` no implica que el firmware actual soporte varios emisores.

## 11. Plan de desarrollo y entregables

| Paso | Trabajo | Evidencia de cierre |
| --- | --- | --- |
| 1. Inventario | Firmware, recursos, particiones, JSON y equipo local para MySQL | Notas de integración y fixtures anonimizados |
| 2. Red y HTTPS | SoftAP, IP estable del servidor, certificados y pasarela acotada | Acceso confiable desde teléfonos, radio sin cambios de canal |
| 3. API y MySQL | Migraciones, cuentas, roles, alcance, sesiones y auditoría | Permisos comprobados por petición y datos persistidos |
| 4. Interfaz | Una misma web con vistas por rol, estados y mapa | Revisión a 360, 768 y 1440 px |
| 5. Integración | Adaptador, consulta, caducidad, ingesta y deduplicación | Secuencia/valores trazables; eventos confirmados tras COMMIT |
| 6. Empaquetado/pruebas | Archivos en receptor, varios clientes y fallas de API/BD | Recursos medidos, contingencia y restauración probadas |
| 7. Evolución V4 | Solo capacidades implementadas de comandos/calibración | Confirmación remota, persistencia y mediciones propias |

Entregables de la implementación: fuentes web y API PHP, migraciones MySQL, configuración de roles, firmware receptor adaptado, contrato/adaptador documentado, recursos/licencias del mapa y modo demo aislado. Incluir instrucciones reproducibles de compilación/carga, aprovisionamiento del primer administrador, instalación del equipo local y certificados, copias/restauración, plantillas sin secretos y reporte de pruebas. No declarar completa la primera entrega con una maqueta o una vista de consulta sin permisos efectivos.

## 12. Pruebas de aceptación

### 12.1 Comportamiento y seguridad funcional

- [ ] Teléfono sin datos móviles, conectado al SoftAP: primera carga completa sin internet y sin recursos precargados en caché.
- [ ] Antes de la primera recepción: «Esperando datos»; no aparecen ceros ficticios ni NORMAL.
- [ ] Reposo real: secuencia, valores y unidades coinciden entre recepción, API y pantalla.
- [ ] Anomalía: un evento genera un aviso; consultas repetidas y reintentos no duplican entradas.
- [ ] Cerrar aviso deja intacta la señalización física. La prueba se hace en banco controlado.
- [ ] Pérdida del emisor: API sigue accesible y muestra SIN_ENLACE, datos vencidos y posición como última conocida.
- [ ] Pérdida del receptor: se distingue de sensor ausente; no se conserva NORMAL como vigente.
- [ ] ERROR_SENSOR V3: ejes inválidos ocultos, gráfica interrumpida y diagnóstico visible. En V2 no se inventa ese diagnóstico remoto.
- [ ] Reconexión y reinicios: se detectan bootIds, se reinicia continuidad y se evita disparar eventos atrasados.
- [ ] Evento anómalo seguido de falla: no se inventa retorno a normal ni desaparece su historial.
- [ ] Coordenadas inválidas, `(0,0)`, fuera de extracto y mapa ausente reciben tratamiento correcto.
- [ ] Demo/simulacro: origen visible en tarjetas, avisos y exportaciones; no envían comandos a equipos reales.
- [ ] Mapa y sectores no implican instalación ni rutas de evacuación verificadas.

### 12.2 Robustez, seguridad web y rendimiento

- [ ] JSON parcial, malformado, versión desconocida y respuesta lenta muestran diagnóstico sin bloquear la interfaz.
- [ ] Nombres con HTML o scripts se presentan como texto sin ejecución.
- [ ] API y recursos no filtran credenciales. Peticiones a servicios de internet durante operación: cero; sí se permite el servicio de apoyo local autenticado.
- [ ] Límites de cuerpos, historial, consultas y memoria se cumplen; no hay crecimiento continuo durante una sesión de prueba de al menos 30 minutos.
- [ ] Verificar un cliente y ensayar tres concurrentes; registrar carga HTTP, heap mínimo, descartes y capacidad real sin afectar actuadores.
- [ ] Exportaciones identifican origen, unidades y calidad de tiempo; distinguen telemetría de señal rápida.
- [ ] Desde la primera entrega: cambios sin sesión/CSRF, origen ajeno y conflicto de versión se rechazan. Comandos vencidos se rechazan cuando se implementen.
- [ ] Vista de 360 px, teclado, foco, contraste, lectores de pantalla y reducción de movimiento revisados.

### 12.3 Roles, MySQL y recuperación

- [ ] USUARIO no puede consultar diagnóstico privado, cuentas, exportaciones o configuración mediante llamadas directas, aunque altere botones, URLs o el rol del frontend.
- [ ] Cambiar un ID de nodo/evento/usuario no permite acceder fuera del alcance asignado; tampoco la ruta antigua `/api/estado` evita los permisos.
- [ ] Visitante sin sesión solo ve la proyección pública definida; nunca recibe primero un JSON privado completo.
- [ ] Desactivar usuario/cambiar rol invalida permisos efectivos; no es posible eliminar al último administrador por acciones concurrentes.
- [ ] Login, sesión y comandos usan HTTPS de confianza; el listener HTTP no acepta credenciales ni cookies protegidas.
- [ ] Peticiones SQL maliciosas se tratan como datos; consultas parametrizadas y cuenta MySQL de mínimo privilegio verificadas.
- [ ] Caída de API o MySQL mantiene detección, actuadores y resumen público; bloquea acciones protegidas sin ampliar privilegios.
- [ ] Una respuesta de ingesta exitosa implica COMMIT; reenvíos no duplican eventos, y un ID con contenido distinto se detecta como conflicto.
- [ ] Reiniciar receptor/servidor conserva lo ya confirmado en MySQL y declara los registros RAM perdidos o pendientes.
- [ ] Restauración de copia en instancia aislada comprobada; retención y crecimiento medidos.
- [ ] El puerto MySQL no es accesible desde los teléfonos; firmware y JavaScript no contienen su contraseña.

Las pruebas sintéticas cubren lógica de estados, vigencia, contratos, duplicados y exportación. Las pruebas físicas cubren radio, sensor y actuadores; una no reemplaza a la otra. No repetir cifras del informe como si fueran resultados de esta implementación.

Registrar tiempos de adquisición/decisión, actuación y presentación por separado con instrumento/base temporal válidos. Informar mediana/p95 cuando el tamaño de muestra lo permita. No prometer «tiempo real garantizado» ni usar los 1,25 s históricos como límite máximo. Fijar objetivos de latencia y tolerancias antes de la campaña física.

## 13. Datos pendientes y decisiones por defecto

Estos puntos no impiden construir una maqueta útil, pero sí condicionan una integración física terminada:

| Pendiente | Decisión mientras se verifica |
| --- | --- |
| Sketches actuales y JSON de `/api/estado` | Diseñar interfaz con fixtures explícitamente simulados; dejar adaptador pendiente |
| Flash/particiones y librerías reales | No prometer capacidad de mapas ni cambiar almacenamiento |
| Contrato de eventos/ACK V3 y formato de reinicio | No fabricar IDs ni estado de confirmación en modo real |
| Umbral de vencimiento implementado | Conservar el actual; 3 s es solo una hipótesis de diseño |
| Registro de eventos del receptor | Implementar IDs y cola antes de ingesta MySQL confiable; si solo hay snapshots, no afirmar que capturan todos los eventos |
| Implementación V4 | Capacidades apagadas hasta inspección y validación |
| Correspondencia física de nodos con ULAT | Mantener etiquetas conceptuales; sin pisos ocupados inventados |
| Equipo de apoyo MySQL | Suponer un PC/miniPC local dedicado; confirmar equipo, memoria, disco y disponibilidad antes del despliegue |
| Administración y certificados | Roles desde la primera entrega; HTTPS y confianza pendientes de implementar/probar en la placa y teléfonos |
| Red y API PHP | Dirección estable, servicio de arranque, firewall, reloj y comunicación TLS por validar |

## 14. Instrucción lista para iniciar la programación

> Implementa SismoAlert Offline como una sola interfaz principal servida por el ESP32 receptor, con vistas USUARIO y ADMINISTRADOR, permisos efectivos desde la primera entrega y MySQL como base persistente. Usa HTML/CSS/JavaScript ligeros, Canvas, mapa local y paleta azul #1346A0, amarillo #FACC15, blanco y texto negro/blanco. Ejecuta PHP/PDO y MySQL en un PC/miniPC conectado a la red local del ESP32; no conectes el navegador ni el firmware directamente a MySQL. Resuelve HTTPS de confianza y una pasarela API acotada en el receptor para cuentas, permisos, historial y auditoría. Inspecciona primero el firmware y GET /api/estado; preserva compatibilidad sin exponer datos privados. Separa estados de receptor, enlace, sensor y detección; aplica caducidad, deduplicación, registro transaccional, reintentos y exportación autorizada. Ante caída de API/BD, mantén detección, actuadores y resumen público local; suspende acciones protegidas. Cerrar un aviso no controla el buzzer. Solo habilita comandos/calibración si el firmware los soporta. No inventes mediciones, capacidades V4, sismos ni rutas de evacuación. Entrega fuentes web/API, migraciones MySQL, instrucciones de instalación/carga/certificados, aprovisionamiento del primer administrador, copias/restauración y pruebas de permisos y fallas. Demo siempre etiquetada y separada de datos reales.

## 15. Fuentes y referencias de implementación

1. [Informe del proyecto SismoAlert Offline](https://docs.google.com/document/d/1sFDkKq3-kHG6fzVWfiIo3BOtMp9eCCUq4v2gjMKPLuM/edit?tab=t.0). Fuente principal: arquitectura, validaciones V2/V3, propuesta V4, cartografía y alcance académico. Lectura del 5 de noviembre de 2026; no se modificó el documento original.
2. [Espressif — ESP-NOW](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_now.html). Cifrado y separación entre éxito de envío MAC y recepción de aplicación. Consultar además la documentación de la versión realmente instalada.
3. [MDN — Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). Restricciones de contexto seguro, incluyendo Service Workers; no asumir equivalencia entre una IP privada HTTP y localhost.
4. [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Referencia para protección de operaciones administrativas mediante tokens y validación de origen.
5. [OpenStreetMap Foundation — Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). El servidor estándar de teselas no permite descarga masiva/prefetch para uso offline; usar un extracto permitido y conservar atribución/licencia.
6. [MySQL 8.4 — Instalación](https://dev.mysql.com/doc/refman/8.4/en/installing.html). Referencia de despliegue en sistemas de servidor/PC; MySQL se aloja en el equipo de apoyo.
7. [MySQL — Conexiones cifradas](https://dev.mysql.com/doc/refman/8.4/en/using-encrypted-connections.html). Configuración y verificación TLS cuando la base se conecta por red.
8. [Espressif — HTTPS Server](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_https_server.html). Soporte de servidor TLS y necesidad de evaluar recursos en el firmware concreto.
9. [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Denegación por defecto y comprobación de permisos en cada petición.
10. [PHP — PDO](https://www.php.net/manual/en/book.pdo.php). API de acceso a datos y consultas preparadas; requiere controlador MySQL.
11. [PHP — password_hash](https://www.php.net/manual/en/function.password-hash.php). Hash estándar de contraseñas y disponibilidad de Argon2id según compilación.

Las decisiones de arquitectura, presupuestos y endpoints nuevos de este archivo son recomendaciones específicas para el proyecto, sujetas a inspección y medición. La finalización de este documento no equivale a compilación, despliegue o validación de la web y del firmware.
