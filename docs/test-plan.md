# Pruebas pendientes para aceptación física

Consultar la lista íntegra de aceptación de `specification.md`. Las pruebas de software no sustituyen radio, sensor ni actuadores.

- Capturar y versionar fixtures reales de `/api/estado`; integrar el adaptador y comprobar secuencias, bootIds, ejes, unidades, caducidad, fallas y reconexión.
- Primera carga desde teléfono sin internet ni caché sobre el SoftAP; cero recursos remotos, confianza TLS completa, reloj offline correcto.
- Preservar sensor/radio/LEDs/buzzer cuando caen API y MySQL; cerrar aviso no actúa sobre hardware.
- Cola receptora ≤100, descartes y reenvíos explícitos. Un ACK de almacenamiento requiere COMMIT, no una respuesta HTTP previa. Cortes de energía pueden perder RAM.
- Mapa con extracto real/licencia, coordenadas inválidas, (0,0), fuera de área, ausencia de mapa; ningún piso/nodo conceptual presentado como instalado.
- Medir al menos 30 minutos continuos en placa; memoria/heap mínimo, reinicios, descartes, latencias por componente, límites HTTP. Probar un móvil+servidor y luego tres móviles+servidor sin prometer capacidad antes de medirla.
- Flash/particiones: tamaño final de firmware y recursos, margen ≥20 % objetivo. Compilar con toolchain realmente instalado y fijado.
- Probar TLS/pasarela bajo carga, denegación directa de diagnóstico y API antigua, scopes entre nodos, revocación, expiración y caída del servicio.
- Copia cifrada en otro volumen y recuperación completa; retención medida al caudal previsto. Revisar credenciales y privilegios del despliegue.
- Revisión con teclado, lector de pantalla y contraste de todos los estados; no limitar accesibilidad a capturas de pantalla.

V4: sin tasa medida, perfil/ventana y firmware inspeccionado, RMS/pico se muestran no disponibles. No afirmar 100 Hz ni asignar Richter/Mercalli. No se implementan simulacro físico, silenciado, reinicio o calibración remota.
