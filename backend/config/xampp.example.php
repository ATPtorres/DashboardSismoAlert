<?php
declare(strict_types=1);

/*
 * Copia este archivo como xampp.local.php.
 * XAMPP suele iniciar MariaDB con root sin contraseña; configura una clave
 * o un usuario dedicado si el equipo no es exclusivamente de desarrollo local.
 */
return [
    'DB_HOST' => '127.0.0.1',
    'MYSQL_DATABASE' => 'sismoalert',
    'MYSQL_USER' => 'root',
    'MYSQL_PASSWORD' => '',
    'APP_ORIGIN' => 'http://localhost',
    'DEMO_ENABLED' => 'false',
];
