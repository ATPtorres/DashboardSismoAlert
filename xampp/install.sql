-- Importar una sola vez desde phpMyAdmin.
-- Esquema idéntico a la migración oficial backend/migrations/001.sql.
CREATE DATABASE IF NOT EXISTS sismoalert CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sismoalert;

CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)));
CREATE TABLE IF NOT EXISTS auth_lock (id INT PRIMARY KEY);
INSERT IGNORE INTO auth_lock VALUES (1);
CREATE TABLE IF NOT EXISTS sectors (id VARCHAR(64) PRIMARY KEY, name VARCHAR(120) NOT NULL, installation_verified BOOLEAN NOT NULL DEFAULT FALSE);
INSERT IGNORE INTO sectors VALUES ('S01', 'Sector de referencia — instalación no verificada', FALSE);
CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, role ENUM('USUARIO','ADMINISTRADOR') NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, auth_version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3))
);
CREATE TABLE IF NOT EXISTS user_sector_access (user_id BIGINT UNSIGNED NOT NULL, sector_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(user_id,sector_id), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(sector_id) REFERENCES sectors(id));
CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, auth_version INT UNSIGNED NOT NULL,
 expires_at DATETIME(3) NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id), INDEX(expires_at));
CREATE TABLE IF NOT EXISTS login_attempts (bucket CHAR(64) PRIMARY KEY, attempts INT NOT NULL, expires_at DATETIME(3) NOT NULL);
CREATE TABLE IF NOT EXISTS gateways (id VARCHAR(64) PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE, sector_id VARCHAR(64) NOT NULL,
 origin ENUM('REAL','SIMULATED') NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, FOREIGN KEY(sector_id) REFERENCES sectors(id));
CREATE TABLE IF NOT EXISTS nodes (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, gateway_id VARCHAR(64) NOT NULL, public_id VARCHAR(64) NOT NULL,
 UNIQUE(gateway_id,public_id), FOREIGN KEY(gateway_id) REFERENCES gateways(id));
CREATE TABLE IF NOT EXISTS events (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, gateway_id VARCHAR(64) NOT NULL,
 node_id BIGINT UNSIGNED NOT NULL, node_boot_id VARCHAR(64) NOT NULL, event_id VARCHAR(64) NOT NULL,
 sequence BIGINT UNSIGNED NOT NULL, type VARCHAR(40) NOT NULL, origin ENUM('REAL','SIMULATED') NOT NULL,
 drill BOOLEAN NOT NULL, payload JSON NOT NULL, content_hash CHAR(64) NOT NULL,
 ingested_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 UNIQUE(gateway_id,node_id,node_boot_id,event_id), INDEX(node_id,ingested_at,id), INDEX(type,ingested_at,id),
 FOREIGN KEY(gateway_id) REFERENCES gateways(id), FOREIGN KEY(node_id) REFERENCES nodes(id));
CREATE TABLE IF NOT EXISTS telemetry_summaries (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, node_id BIGINT UNSIGNED NOT NULL,
 node_boot_id VARCHAR(64) NOT NULL, sequence BIGINT UNSIGNED NOT NULL, payload JSON NOT NULL, content_hash CHAR(64) NOT NULL,
 ingested_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), UNIQUE(node_id,node_boot_id,sequence),
 FOREIGN KEY(node_id) REFERENCES nodes(id));
CREATE TABLE IF NOT EXISTS config_versions (sector_id VARCHAR(64) NOT NULL, version INT UNSIGNED NOT NULL, payload JSON NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 PRIMARY KEY(sector_id,version), FOREIGN KEY(sector_id) REFERENCES sectors(id), FOREIGN KEY(actor_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS audit_logs (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_id BIGINT UNSIGNED NULL,
 sector_id VARCHAR(64) NOT NULL, action VARCHAR(64) NOT NULL, resource VARCHAR(120) NOT NULL, outcome VARCHAR(40) NOT NULL,
 correlation_id CHAR(32) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), INDEX(sector_id,id));
INSERT IGNORE INTO schema_migrations(version) VALUES (1);
