# Instalación rápida en XAMPP (Windows)

Esta modalidad sirve el mismo panel y la misma API PHP desde Apache + MariaDB incluidos en XAMPP. No necesita Docker, Node, Bash ni certificados para ejecutarse en localhost. Mantén el despliegue Docker como alternativa.

## Requisitos

- XAMPP para Windows con Apache, PHP y MariaDB.
- Extensiones PHP `pdo_mysql` y `argon2id` disponibles. Comprueba con `C:\\xampp\\php\\php.exe -m`.
- El puerto 80 libre para Apache y el 3306 libre para MariaDB.

## Instalación

1. Descarga/clona este repositorio dentro de `C:\\xampp\\htdocs\\DashboardSismoAlert`. No cambies la estructura de carpetas.
2. Abre el panel de XAMPP e inicia **Apache** y **MySQL**.
3. Entra a [phpMyAdmin](http://localhost/phpmyadmin), selecciona **Importar** y carga `xampp/install.sql`. Esto crea la base `sismoalert` y todas las tablas.
4. Copia `backend/config/xampp.example.php` como `backend/config/xampp.local.php`. Por defecto usa el usuario `root` sin contraseña, que es la configuración inicial habitual de XAMPP. Si tu MariaDB tiene contraseña, actualiza `MYSQL_PASSWORD`. Para un equipo compartido, crea un usuario MariaDB exclusivo y limita su acceso a localhost; no uses root.
5. Abre [http://localhost/DashboardSismoAlert/](http://localhost/DashboardSismoAlert/).

La configuración local está excluida de Git. No publiques `xampp.local.php`, contraseñas ni copias de la base.

## Crear el primer administrador

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
$secure = Read-Host "Contraseña (mínimo 12 caracteres)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $plain | & "C:\\xampp\\php\\php.exe" ".\\backend\\bin\\admin.php" bootstrap "admin"
  if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el administrador" }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable plain, secure -ErrorAction SilentlyContinue
}
```

Cambia `admin` por el nombre que quieras. La contraseña no se escribe en el historial ni se muestra al escribirla. El bootstrap solo funciona si la tabla de usuarios está vacía.

## Simulación del dashboard

La plantilla `xampp.example.php` habilita el modo **Simulación** para pruebas locales. Tras iniciar sesión o abrir el panel, espera a que cargue el estado y selecciona **Simulación** en el menú lateral. Permite probar reposo, anomalía, falla de sensor, pérdida de enlace, calibración, perfil no válido y espera de datos. Son valores sintéticos generados en el navegador: no proceden del MPU6050/ESP32, no activan LEDs ni buzzer, no se envían al backend y no se guardan en MySQL. Para ocultar la opción, cambia `DEMO_ENABLED` a `false` en `xampp.local.php`.

## Uso y límites

- URL local: `http://localhost/DashboardSismoAlert/`.
- Para detenerlo, detén Apache y MySQL desde XAMPP.
- La API solo acepta HTTP cuando el origen y el cliente son localhost/loopback. No publiques este modo en una LAN ni abras el puerto 80 al exterior. Para uso en red, conserva HTTPS y configura certificados válidos.
- La demostración continúa desactivada por defecto. No hay firmware real ni receptor físico integrado; el panel indicará que espera datos.
- Para restablecer la contraseña de un usuario usa el comando CLI existente `backend/bin/admin.php reset-password NOMBRE`, pasando la contraseña por stdin.
- XAMPP distribuye MariaDB en lugar de Oracle MySQL. La migración usa sintaxis compatible con MariaDB 10.11 y MySQL 8.

## Solución de problemas

- **Apache no inicia:** revisa que el puerto 80 no esté ocupado (IIS/World Wide Web Publishing Service suele reservarlo).
- **MySQL no inicia:** revisa que no exista otro servicio MariaDB/MySQL usando el 3306.
- **No conecta a la base:** confirma que importaste `xampp/install.sql`, que el servicio MySQL está activo y que los datos de `xampp.local.php` coinciden.
- **Error Argon2id:** instala una versión actual de XAMPP/PHP que exponga Argon2id; no se rebaja el algoritmo de hash de contraseñas.
- **Error 404 en API:** confirma que `.htaccess` se encuentra en la raíz del proyecto y que Apache permite `AllowOverride All` para `htdocs`.

Documentación oficial: [FAQ de XAMPP para Windows](https://www.apachefriends.org/es/faq_windows.html).
