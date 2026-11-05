# Firmware no suministrado

No hay sketches para adaptar. No se sustituyen por un emisor/receptor inventados. Entregar ambos sketches y recursos actuales, versiones, contrato V3, ejemplos JSON y tabla de particiones para continuar según `docs/integration-notes.md`.

`npm run package:embedded` produce `dist/embedded_assets.h` con recursos gzip en PROGMEM y tabla de rutas/MIME. Es un artefacto de empaquetado, no un firmware compilado ni una implementación de HTTPS/API/ESP-NOW. La integración debe conservar el canal, señalización autónoma y protección de rutas existentes.
