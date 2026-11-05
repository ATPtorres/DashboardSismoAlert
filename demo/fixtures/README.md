# Escenarios simulados

La generación explícita y aislada está en `web/src/api/demo.js` para servirla localmente con los mismos estáticos. Escenarios: espera, reposo, anomalía, sensor con error, enlace perdido, calibración y perfil inválido. Todo tiene origen SIMULATED y coordenadas de referencia de demostración, sin instalación verificada. No es una captura de firmware.

Las pruebas de ingesta generan eventos con origen SIMULATED y un dispositivo de pruebas exclusivo en el stack sismoalert-test. No se ingieren eventos ficticios en la base principal.
