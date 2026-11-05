<?php
declare(strict_types=1);
require __DIR__.'/../src/core.php';
if(PHP_SAPI!=='cli') exit(1);
// Password/token is read from stdin, never command-line arguments or logs.
try {
    $command=$argv[1]??'';
    if($command==='bootstrap') {
        $username=textField($argv[2]??null,80); $password=passwordValue(rtrim(stream_get_contents(STDIN),"\r\n"));
        transaction(function()use($username,$password){
            query('SELECT id FROM auth_lock WHERE id=1 FOR UPDATE');
            if((int)query('SELECT COUNT(*) FROM users')->fetchColumn()>0) fail(409,'ALREADY_INITIALIZED','El administrador inicial ya fue creado.');
            query("INSERT INTO users(username,password_hash,role) VALUES (?,?,'ADMINISTRADOR')",[$username,hashPassword($password)]); $id=db()->lastInsertId();
            query("INSERT INTO user_sector_access VALUES (?,'S01')",[$id]); audit($id,'S01','BOOTSTRAP',$id);
        });
    } elseif($command==='reset-password') {
        $name=textField($argv[2]??null,80); $password=passwordValue(rtrim(stream_get_contents(STDIN),"\r\n"));
        transaction(function()use($name,$password){
            $u=query('SELECT id FROM users WHERE username=? FOR UPDATE',[$name])->fetch(); if(!$u) fail(404,'NOT_FOUND','Cuenta no encontrada.');
            query('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?',[hashPassword($password),$u['id']]); query('DELETE FROM sessions WHERE user_id=?',[$u['id']]); foreach(scopes((string)$u['id']) as $s) audit(null,$s,'LOCAL_PASSWORD_RESET',(string)$u['id']);
        });
    } elseif($command==='provision-device') {
        $id=identifier($argv[2]??null); $sector=identifier($argv[3]??null); $node=identifier($argv[4]??null); $origin=$argv[5]??'REAL';
        if(!in_array($origin,['REAL','SIMULATED'],true)) throw new RuntimeException('Invalid origin');
        $token=trim(stream_get_contents(STDIN)); if(!preg_match('/^[a-f0-9]{64}$/D',$token)) throw new RuntimeException('Supply a cryptographically random 32-byte hex token on stdin');
        transaction(function()use($id,$sector,$node,$origin,$token){
            query('INSERT INTO gateways(id,token_hash,sector_id,origin) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),active=1',[$id,hash('sha256',$token),$sector,$origin]);
            query('INSERT IGNORE INTO nodes(gateway_id,public_id) VALUES (?,?)',[$id,$node]); audit(null,$sector,'DEVICE_PROVISION',$id);
        });
    } else throw new RuntimeException('Use bootstrap USER | reset-password USER | provision-device GATEWAY SECTOR NODE REAL|SIMULATED');
    echo "Operación local completada.\n";
} catch(Throwable $e) { fwrite(STDERR,$e instanceof ApiError?$e->getMessage()."\n":"Operación local fallida; verifique parámetros y base de datos.\n"); exit(1); }
