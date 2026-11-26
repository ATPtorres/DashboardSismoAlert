<?php
declare(strict_types=1);
require __DIR__.'/../src/core.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $path=is_string($_GET['route']??null)?$_GET['route']:parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
    $method=$_SERVER['REQUEST_METHOD'];
    $origin=(string)appSetting('APP_ORIGIN','https://localhost:8443');
    $expected=parse_url($origin,PHP_URL_HOST).(parse_url($origin,PHP_URL_PORT)?':'.parse_url($origin,PHP_URL_PORT):'');
    if(($_SERVER['HTTP_HOST']??'')!==$expected) fail(403,'HOST_REJECTED','Host no permitido.');
    if(parse_url($origin,PHP_URL_SCHEME)!=='https') {
        $localHost=in_array(strtolower(parse_url($origin,PHP_URL_HOST)??''),['localhost','127.0.0.1'],true);
        $localClient=in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true);
        if(!$localHost||!$localClient) fail(403,'HTTPS_REQUIRED','HTTP solo está permitido en localhost.');
    } elseif(($_SERVER['HTTPS']??'')!=='on') fail(403,'HTTPS_REQUIRED','Se requiere HTTPS.');
    $mutation=!in_array($method,['GET','HEAD'],true);
    $internal=str_starts_with($path,'/internal/');
    if($mutation && !$internal && ($_SERVER['HTTP_ORIGIN']??'')!==$origin) fail(403,'ORIGIN_REJECTED','Origen no permitido.');
    if($path==='/api/v1/public/state' && $method==='GET') reply(publicState());
    if($path==='/api/estado') fail(501,'LEGACY_UNAVAILABLE','Adaptador pendiente del JSON real del receptor.');
    if($path==='/api/v1/session' && $method==='POST') {
        $b=body(); noExtra($b,['username','password']); $name=textField($b['username']??null,80); $pass=textField($b['password']??null,128);
        $bucket=hash('sha256',$_SERVER['REMOTE_ADDR']??'local');
        $allowed=transaction(function()use($bucket){
            query('INSERT IGNORE INTO login_attempts VALUES (?,0,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE))',[$bucket]);
            $r=query('SELECT attempts,expires_at<=UTC_TIMESTAMP(3) AS expired FROM login_attempts WHERE bucket=? FOR UPDATE',[$bucket])->fetch();
            if($r['expired']) query('UPDATE login_attempts SET attempts=0,expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE) WHERE bucket=?',[$bucket]);
            elseif($r['attempts']>=10) return false;
            query('UPDATE login_attempts SET attempts=attempts+1 WHERE bucket=?',[$bucket]); return true;
        });
        if(!$allowed) fail(429,'RATE_LIMIT','Demasiados intentos. Espere cinco minutos.');
        $u=query('SELECT * FROM users WHERE username=?',[$name])->fetch();
        // Fixed dummy Argon2 hash preserves password work for unknown accounts.
        $dummy='$argon2id$v=19$m=65536,t=3,p=1$MDEyMzQ1Njc4OWFiY2RlZg$UPoZhUNwEOnHbueN8iCT0OXVCXFOcBNVCpMFdD3F2zA';
        $valid=password_verify($pass,$u?$u['password_hash']:$dummy);
        if(!$valid||!$u||!$u['active']) fail(401,'INVALID_CREDENTIALS','Identificación o contraseña incorrectas.');
        $token=bin2hex(random_bytes(32));
        transaction(function()use($u,$token){
            query('INSERT INTO sessions VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 8 HOUR))',[hash('sha256',$token),$u['id'],$u['auth_version']]);
            foreach(scopes((string)$u['id']) as $s) audit((string)$u['id'],$s,'LOGIN',(string)$u['id']);
        });
        cookie($token,time()+28800); reply(['csrfToken'=>csrfToken($token),'user'=>['id'=>(string)$u['id'],'username'=>$u['username'],'role'=>$u['role'],'sectors'=>scopes((string)$u['id'])]]);
    }
    if($internal) { require __DIR__.'/../src/ingest.php'; handleInternal($path,$method); }
    $admin=in_array($path,['/api/v1/info','/api/v1/events','/api/v1/config','/api/v1/users','/api/v1/audit'],true)||str_starts_with($path,'/api/v1/users/')||str_starts_with($path,'/api/v1/export/')||str_starts_with($path,'/api/v1/commands');
    $u=sessionUser($admin,$mutation);
    if($path==='/api/v1/me' && $method==='GET') reply(['user'=>$u,'csrfToken'=>csrfToken($_COOKIE['__Host-sismo_session'])]);
    if($path==='/api/v1/session' && $method==='DELETE') {
        query('DELETE FROM sessions WHERE token_hash=?',[hash('sha256',$_COOKIE['__Host-sismo_session'])]); cookie('',time()-3600); reply(['ok'=>true]);
    }
    if($path==='/api/v1/me/password' && $method==='POST') {
        $b=body(); $pass=passwordValue($b['password']??null); $old=textField($b['currentPassword']??null,128);
        transaction(function()use($u,$pass,$old){
            $record=query('SELECT password_hash FROM users WHERE id=? FOR UPDATE',[$u['id']])->fetch();
            if(!password_verify($old,$record['password_hash'])) fail(403,'INVALID_PASSWORD','Contraseña actual incorrecta.');
            query('UPDATE users SET password_hash=?, auth_version=auth_version+1 WHERE id=?',[hashPassword($pass),$u['id']]);
            query('DELETE FROM sessions WHERE user_id=?',[$u['id']]); foreach($u['sectors'] as $s) audit($u['id'],$s,'PASSWORD_CHANGE',$u['id']);
        }); cookie('',time()-3600); reply(['ok'=>true,'sessionRevoked'=>true]);
    }
    if($path==='/api/v1/state' && $method==='GET') {
        $state=publicState(); $state['authorizedSectors']=$u['sectors'];
        foreach($u['sectors'] as $s) {
            $row=query('SELECT payload FROM config_versions WHERE sector_id=? ORDER BY version DESC LIMIT 1',[$s])->fetch();
            if($row) $state['notices'][]=['sectorId'=>$s,'text'=>json_decode($row['payload'],true)['notice']];
        }
        reply($state);
    }
    if($path==='/api/v1/info' && $method==='GET') reply(['apiVersion'=>1,'receiverIntegrated'=>false,'firmwareVersion'=>null,'capabilities'=>['hardwareCommands'=>false,'windowMetrics'=>false,'legacyAdapter'=>false],'limits'=>['eventPage'=>50,'batch'=>20,'bodyBytes'=>65536,'chartPoints'=>240],'sectors'=>$u['sectors']]);
    if($path==='/api/v1/users' && $method==='GET') {
        $rows=query('SELECT id,username,role,active FROM users ORDER BY id LIMIT 501')->fetchAll();
        $rows=array_values(array_filter(array_map(function($r){$r['id']=(string)$r['id'];$r['active']=(bool)$r['active'];$r['sectors']=scopes($r['id']);return $r;},$rows),fn($r)=>count($r['sectors'])>0&&!array_diff($r['sectors'],$u['sectors'])));
        reply(['users'=>array_slice($rows,0,500),'limit'=>500]);
    }
    if($path==='/api/v1/users' && $method==='POST') {
        $b=body(); noExtra($b,['username','password','role','sectors']); $name=textField($b['username']??null,80); $pw=passwordValue($b['password']??null); $role=roleValue($b['role']??null); $ss=scopeList($u,$b['sectors']??null);
        $id=transaction(function()use($name,$pw,$role,$ss,$u){
            query('SELECT id FROM auth_lock WHERE id=1 FOR UPDATE');
            $u=sessionUser(true,true); foreach($ss as $s) sector($u,$s);
            if((int)query('SELECT COUNT(*) FROM users')->fetchColumn()>=500) fail(409,'USER_LIMIT','Límite inicial: 500 cuentas.');
            if(query('SELECT id FROM users WHERE username=?',[$name])->fetch()) fail(409,'USERNAME_EXISTS','La cuenta ya existe.');
            query('INSERT INTO users(username,password_hash,role) VALUES (?,?,?)',[$name,hashPassword($pw),$role]); $id=db()->lastInsertId();
            foreach($ss as $s) { query('INSERT INTO user_sector_access VALUES (?,?)',[$id,$s]); audit($u['id'],$s,'USER_CREATE',$id); } return $id;
        }); reply(['id'=>$id],201);
    }
    if(preg_match('#^/api/v1/users/([1-9][0-9]*)$#D',$path,$match) && $method==='PATCH') {
        $id=$match[1]; $b=body(); noExtra($b,['role','active','sectors']);
        transaction(function()use($id,$b,$u){
            query('SELECT id FROM auth_lock WHERE id=1 FOR UPDATE');
            // Recheck permissions after taking the lock to prevent concurrent privilege changes.
            $u=sessionUser(true,true);
            $target=query('SELECT id,role,active FROM users WHERE id=? FOR UPDATE',[$id])->fetch();
            if(!$target) fail(404,'NOT_FOUND','Cuenta no encontrada.');
            $old=scopes($id); if(!$old||array_diff($old,$u['sectors'])) fail(403,'SECTOR_FORBIDDEN','Cuenta fuera de su alcance.');
            $ss=array_key_exists('sectors',$b)?scopeList($u,$b['sectors']):$old;
            $role=array_key_exists('role',$b)?roleValue($b['role']):$target['role'];
            $active=$b['active']??(bool)$target['active']; if(!is_bool($active)) fail(400,'INVALID_ACTIVE','Estado inválido.');
            $count=(int)query("SELECT COUNT(*) FROM users WHERE role='ADMINISTRADOR' AND active=1")->fetchColumn();
            if($target['role']==='ADMINISTRADOR' && $target['active'] && (!$active||$role!=='ADMINISTRADOR') && $count<=1) fail(409,'LAST_ADMIN','No se puede desactivar o degradar al último administrador.');
            query('UPDATE users SET role=?,active=?,auth_version=auth_version+1 WHERE id=?',[$role,(int)$active,$id]); query('DELETE FROM sessions WHERE user_id=?',[$id]);
            query('DELETE FROM user_sector_access WHERE user_id=?',[$id]); foreach($ss as $s) query('INSERT INTO user_sector_access VALUES (?,?)',[$id,$s]);
            foreach(array_unique([...$old,...$ss]) as $s) audit($u['id'],$s,'USER_UPDATE',$id);
        }); reply(['ok'=>true,'sessionsRevoked'=>true]);
    }
    if($path==='/api/v1/config') {
        $b=$method==='PATCH'?body():[]; $s=sector($u,$b['sectorId']??$_GET['sectorId']??'');
        if($method==='GET') {
            $r=query('SELECT version,payload FROM config_versions WHERE sector_id=? ORDER BY version DESC LIMIT 1',[$s])->fetch();
            reply(['sectorId'=>$s,'version'=>$r?(int)$r['version']:0,'desired'=>$r?json_decode($r['payload'],true):['notice'=>''],'appliedToHardware'=>false,'hardwareWritable'=>false]);
        }
        if($method==='PATCH') {
            noExtra($b,['sectorId','expectedVersion','notice']); $expectedVersion=integer($b['expectedVersion']??null,2147483646);
            $notice=$b['notice']??null; if(!is_string($notice)||strlen($notice)>1000) fail(400,'INVALID_CONFIG','Aviso demasiado largo.');
            $version=transaction(function()use($u,$s,$notice,$expectedVersion){
                query('SELECT id FROM auth_lock WHERE id=1 FOR UPDATE');
                $u=sessionUser(true,true); sector($u,$s);
                query('SELECT id FROM sectors WHERE id=? FOR UPDATE',[$s]);
                $v=(int)(query('SELECT MAX(version) FROM config_versions WHERE sector_id=?',[$s])->fetchColumn()?:0);
                if($v!==$expectedVersion) fail(409,'VERSION_CONFLICT','La configuración cambió. Recargue antes de guardar.');
                query('INSERT INTO config_versions(sector_id,version,payload,actor_id) VALUES (?,?,?,?)',[$s,$v+1,json_encode(['notice'=>$notice]),$u['id']]); audit($u['id'],$s,'CONFIG_UPDATE',(string)($v+1)); return $v+1;
            }); reply(['version'=>$version,'appliedToHardware'=>false]);
        }
    }
    if($path==='/api/v1/audit' && $method==='GET') {
        $s=sector($u,$_GET['sectorId']??''); $cursor=$_GET['cursor']??'0'; if(!preg_match('/^\d{1,20}$/D',$cursor)) fail(400,'INVALID_CURSOR','Cursor inválido.');
        $rows=query('SELECT id,actor_id,action,resource,outcome,created_at,correlation_id FROM audit_logs WHERE sector_id=? AND id>? ORDER BY id LIMIT 50',[$s,$cursor])->fetchAll();
        foreach($rows as &$r) { $r['id']=(string)$r['id']; $r['actor_id']=$r['actor_id']===null?null:(string)$r['actor_id']; }
        reply(['items'=>$rows,'timeSource'=>'SERVER_UTC','nextCursor'=>$rows?end($rows)['id']:null]);
    }
    if(($path==='/api/v1/events'||str_starts_with($path,'/api/v1/export/')) && $method==='GET') { require __DIR__.'/../src/history.php'; history($u,$path); }
    if(str_starts_with($path,'/api/v1/commands')) fail(501,'CAPABILITY_UNAVAILABLE','El firmware no anuncia comandos autorizados.');
    fail(404,'NOT_FOUND','Ruta no disponible.');
} catch(ApiError $e) { reply(['error'=>['code'=>$e->errorCode,'message'=>$e->getMessage()]],$e->status); }
catch(PDOException $e) { error_log('Database operation unavailable: '.$e->getCode()); reply(['error'=>['code'=>'DATA_UNAVAILABLE','message'=>'Servicio de datos no disponible.']],503); }
catch(Throwable $e) { error_log('API failure: '.get_class($e)); reply(['error'=>['code'=>'INTERNAL_ERROR','message'=>'No se pudo completar la operación.']],500); }
