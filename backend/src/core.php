<?php
declare(strict_types=1);
final class ApiError extends RuntimeException {
    public function __construct(public int $status, public string $errorCode, string $message) { parent::__construct($message); }
}
function fail(int $status, string $code, string $message): never { throw new ApiError($status,$code,$message); }
function appSetting(string $key, mixed $default=null): mixed {
    $file=__DIR__.'/../config/xampp.local.php';
    static $local=null;
    if($local===null) $local=is_file($file)?require $file:[];
    $env=getenv($key);
    return $env!==false?$env:(is_array($local)?($local[$key]??$default):$default);
}
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO('mysql:host='.(appSetting('DB_HOST','db')).';dbname='.appSetting('MYSQL_DATABASE','sismoalert').';charset=utf8mb4', appSetting('MYSQL_USER','sismoapp'), appSetting('MYSQL_PASSWORD',''), [PDO::ATTR_TIMEOUT=>2,PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}
function query(string $sql,array $args=[]): PDOStatement { $s=db()->prepare($sql); $s->execute($args); return $s; }
function transaction(callable $fn): mixed {
    db()->beginTransaction();
    try { $result=$fn(); db()->commit(); return $result; }
    catch(Throwable $e) { if(db()->inTransaction()) db()->rollBack(); throw $e; }
}
function reply(mixed $data,int $status=200): never {
    http_response_code($status); echo json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit;
}
function body(): array {
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) fail(400,'JSON_REQUIRED','Se requiere JSON.');
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>65536) fail(413,'BODY_TOO_LARGE','Solicitud demasiado grande.');
    $raw=file_get_contents('php://input',false,null,0,65537);
    if(strlen($raw)>65536) fail(413,'BODY_TOO_LARGE','Solicitud demasiado grande.');
    try { $data=json_decode($raw,true,32,JSON_THROW_ON_ERROR); } catch(JsonException) { fail(400,'INVALID_JSON','JSON inválido.'); }
    if(!is_array($data) || array_is_list($data)) fail(400,'INVALID_JSON','Se requiere un objeto JSON.');
    return $data;
}
function textField(mixed $value,int $max=64): string {
    if(!is_string($value)||strlen($value)<1||strlen($value)>$max||preg_match('/[\x00-\x1f]/',$value)) fail(400,'INVALID_FIELD','Texto inválido.');
    return $value;
}
function identifier(mixed $value): string {
    $v=textField($value); if(!preg_match('/^[a-zA-Z0-9_.:-]+$/D',$v)) fail(400,'INVALID_ID','Identificador inválido.'); return $v;
}
function integer(mixed $v, int $max=9007199254740991): int {
    if(!is_int($v)||$v<0||$v>$max) fail(400,'INVALID_NUMBER','Entero fuera de rango.'); return $v;
}
function passwordValue(mixed $v): string { $s=textField($v,128); if(strlen($s)<12) fail(400,'WEAK_PASSWORD','Use al menos 12 caracteres.'); return $s; }
function hashPassword(string $p): string {
    if(!defined('PASSWORD_ARGON2ID')) throw new RuntimeException('Argon2id required');
    return password_hash($p,PASSWORD_ARGON2ID,['memory_cost'=>65536,'time_cost'=>3,'threads'=>1]);
}
function scopes(string $id): array { return array_column(query('SELECT sector_id FROM user_sector_access WHERE user_id=? ORDER BY sector_id',[$id])->fetchAll(),'sector_id'); }
function csrfToken(string $token): string { return hash('sha256','csrf:'.$token); }
function sessionCookieName(): string {
    return parse_url((string)appSetting('APP_ORIGIN','https://localhost:8443'),PHP_URL_SCHEME)==='https'?'__Host-sismo_session':'sismo_session';
}
function sessionToken(): string { return (string)($_COOKIE[sessionCookieName()]??''); }
function sessionUser(bool $admin=false,bool $mutate=false): array {
    $token=sessionToken();
    if(!preg_match('/^[a-f0-9]{64}$/D',$token)) fail(401,'SESSION_REQUIRED','Inicie sesión.');
    $u=query('SELECT u.id,u.username,u.role,u.auth_version FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND u.active=1 AND s.auth_version=u.auth_version',[hash('sha256',$token)])->fetch();
    if(!$u) fail(401,'SESSION_EXPIRED','La sesión terminó.');
    if($admin && $u['role']!=='ADMINISTRADOR') fail(403,'FORBIDDEN','Permiso de administrador requerido.');
    if($mutate && !hash_equals(csrfToken($token),$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail(403,'CSRF','Solicitud no autorizada.');
    $u['id']=(string)$u['id']; $u['sectors']=scopes($u['id']); unset($u['auth_version']);
    return $u;
}
function sector(array $u,mixed $value): string {
    $s=identifier($value); if(!in_array($s,$u['sectors'],true)) fail(403,'SECTOR_FORBIDDEN','Sector fuera de su alcance.'); return $s;
}
function scopeList(array $u,mixed $value): array {
    if(!is_array($value)||!array_is_list($value)||count($value)<1||count($value)>50) fail(400,'INVALID_SECTORS','Seleccione sectores.');
    return array_values(array_unique(array_map(fn($s)=>sector($u,$s),$value)));
}
function roleValue(mixed $v): string { if(!in_array($v,['USUARIO','ADMINISTRADOR'],true)) fail(400,'INVALID_ROLE','Rol inválido.'); return $v; }
function audit(?string $actor,string $sector,string $action,string $resource,string $outcome='OK'): void {
    query('INSERT INTO audit_logs(actor_id,sector_id,action,resource,outcome,correlation_id) VALUES (?,?,?,?,?,?)',[$actor,$sector,$action,$resource,$outcome,bin2hex(random_bytes(16))]);
}
function cookie(string $value,int $expires): void {
    $secure=parse_url((string)appSetting('APP_ORIGIN','https://localhost:8443'),PHP_URL_SCHEME)==='https';
    setcookie(sessionCookieName(),$value,['expires'=>$expires,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Strict']);
}
function noExtra(array $data,array $keys): void { if(array_diff(array_keys($data),$keys)) fail(400,'UNKNOWN_FIELD','Campo no permitido.'); }
function canonical(mixed $v): mixed { if(!is_array($v)) return $v; if(!array_is_list($v)) ksort($v); return array_map('canonical',$v); }
function contentHash(array $v): string { return hash('sha256',json_encode(canonical($v),JSON_THROW_ON_ERROR|JSON_PRESERVE_ZERO_FRACTION)); }
function publicState(): array {
    $available=false; try { query('SELECT 1'); $available=true; } catch(Throwable) {}
    return ['schemaVersion'=>1,'dataOrigin'=>'REAL','gateway'=>null,'nodes'=>[], 'receiverConnection'=>'NO_DISPONIBLE',
        'message'=>'Receptor físico pendiente de integración. Esperando datos.',
        'services'=>['identityApi'=>$available?'AVAILABLE':'UNAVAILABLE','database'=>$available?'AVAILABLE':'UNAVAILABLE'],
        'capabilities'=>['configWrite'=>false,'windowMetrics'=>false,'eventHistory'=>$available],
        'notices'=>[], 'demoEnabled'=>in_array(appSetting('DEMO_ENABLED','false'),[true,'true',1,'1'],true)];
}
