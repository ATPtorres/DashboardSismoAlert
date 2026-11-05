<?php
declare(strict_types=1);
function handleInternal(string $path,string $method): never {
    if($method!=='POST') fail(404,'NOT_FOUND','Ruta no disponible.');
    $token=$_SERVER['HTTP_AUTHORIZATION']??(array_change_key_case(getallheaders())['authorization']??'');
    if(!preg_match('/^Bearer ([a-f0-9]{64})$/D',$token,$m)) fail(401,'DEVICE_REQUIRED','Identidad de dispositivo requerida.');
    $gw=query('SELECT * FROM gateways WHERE token_hash=? AND active=1',[hash('sha256',$m[1])])->fetch();
    if(!$gw) fail(403,'DEVICE_FORBIDDEN','Dispositivo no autorizado.');
    if($gw['origin']==='SIMULATED' && getenv('DEMO_ENABLED')!=='true') fail(403,'DEMO_DISABLED','La ingesta simulada está desactivada.');
    $b=body();
    if($path==='/internal/v1/authorize') {
        noExtra($b,['session','operation','sectorId']);
        if(!is_string($b['session']??null)||!preg_match('/^[a-f0-9]{64}$/D',$b['session'])) fail(401,'SESSION_REQUIRED','Sesión requerida.');
        if(($b['sectorId']??null)!==$gw['sector_id']) fail(403,'SECTOR_FORBIDDEN','Sector fuera de alcance.');
        if(!in_array($b['operation']??null,['state','diagnostics'],true)) fail(403,'CAPABILITY_UNAVAILABLE','Operación no autorizada.');
        $u=query('SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN user_sector_access a ON a.user_id=u.id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND s.auth_version=u.auth_version AND u.active=1 AND a.sector_id=?',[hash('sha256',$b['session']),$gw['sector_id']])->fetch();
        if(!$u||($b['operation']==='diagnostics'&&$u['role']!=='ADMINISTRADOR')) fail(403,'FORBIDDEN','Operación no autorizada.');
        reply(['authorized'=>true,'userId'=>(string)$u['id'],'operation'=>$b['operation'],'sectorId'=>$gw['sector_id'],'cacheable'=>false]);
    }
    if(!in_array($path,['/internal/v1/ingest/events','/internal/v1/ingest/summaries'],true)) fail(404,'NOT_FOUND','Ruta no disponible.');
    noExtra($b,['schemaVersion','items']);
    if(($b['schemaVersion']??null)!==1||!is_array($b['items']??null)||!array_is_list($b['items'])||count($b['items'])<1||count($b['items'])>20) fail(400,'INVALID_BATCH','Lote inválido (máximo 20 registros).');
    $isEvent=str_ends_with($path,'/events');
    $ack=transaction(function()use($b,$gw,$isEvent){
        $acks=[];
        foreach($b['items'] as $e) {
            if(!is_array($e)||array_is_list($e)) fail(400,'INVALID_ITEM','Registro inválido.');
            $node=identifier($e['nodeId']??null); $boot=identifier($e['nodeBootId']??null); $seq=integer($e['sequence']??null);
            if(($e['origin']??null)!==$gw['origin']) fail(403,'ORIGIN_MISMATCH','Origen de datos no autorizado.');
            if(!is_bool($e['drill']??null)) fail(400,'INVALID_DRILL','Bandera de simulacro requerida.');
            integer($e['receivedAtGatewayUptimeMs']??null);
            $nodeRow=query('SELECT id FROM nodes WHERE gateway_id=? AND public_id=?',[$gw['id'],$node])->fetch();
            if(!$nodeRow) fail(403,'NODE_FORBIDDEN','Nodo no aprovisionado.');
            if($isEvent) {
                noExtra($e,['id','nodeId','nodeBootId','sequence','type','origin','drill','receivedAtGatewayUptimeMs','freshness','locationSnapshot','profileId','ack','timeSource','utc']);
                $eventId=identifier($e['id']??null);
                if(!in_array($e['type']??null,['ANOMALIA','NORMAL','ERROR_SENSOR','SIN_ENLACE','REINICIO','CALIBRANDO','PERFIL_NO_VALIDO'],true)) fail(400,'INVALID_TYPE','Tipo de evento inválido.');
                if(!in_array($e['freshness']??null,['CURRENT','HISTORICAL','UNKNOWN'],true)) fail(400,'INVALID_FRESHNESS','Vigencia inválida.');
                if(($e['timeSource']??null)!=='UNSYNCED'||($e['utc']??null)!==null) fail(400,'TIME_NOT_SUPPORTED','Contrato inicial: tiempo monotónico sin UTC de medición.');
                if(($e['profileId']??null)!==null) identifier($e['profileId']);
                $loc=$e['locationSnapshot']??null;
                if($loc!==null) {
                    if(!is_array($loc)) fail(400,'INVALID_LOCATION','Ubicación inválida.');
                    noExtra($loc,['latitude','longitude','source','physicalInstallationVerified']);
                    foreach(['latitude'=>90,'longitude'=>180] as $key=>$max) if(!isset($loc[$key])||!is_numeric($loc[$key])||!is_finite((float)$loc[$key])||abs((float)$loc[$key])>$max) fail(400,'INVALID_LOCATION','Coordenadas inválidas.');
                    textField($loc['source']??null); if(!is_bool($loc['physicalInstallationVerified']??null)) fail(400,'INVALID_LOCATION','Verificación de ubicación requerida.');
                }
                $hash=contentHash($e);
                query('INSERT INTO events(gateway_id,node_id,node_boot_id,event_id,sequence,type,origin,drill,payload,content_hash) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',[$gw['id'],$nodeRow['id'],$boot,$eventId,$seq,$e['type'],$e['origin'],(int)$e['drill'],json_encode($e,JSON_THROW_ON_ERROR),$hash]);
                $row=query('SELECT id,content_hash FROM events WHERE gateway_id=? AND node_id=? AND node_boot_id=? AND event_id=?',[$gw['id'],$nodeRow['id'],$boot,$eventId])->fetch();
                if(!hash_equals($row['content_hash'],$hash)) fail(409,'IDENTITY_CONFLICT','Identidad repetida con contenido diferente.');
                $acks[]=['id'=>$eventId,'nodeId'=>$node,'nodeBootId'=>$boot,'storageId'=>(string)$row['id']];
            } else {
                noExtra($e,['nodeId','nodeBootId','sequence','origin','drill','receivedAtGatewayUptimeMs','accelerationG','valid']);
                if(!is_bool($e['valid']??null)) fail(400,'INVALID_MEASUREMENT','Validez requerida.');
                if($e['valid']) {
                    $axes=$e['accelerationG']??null; if(!is_array($axes)) fail(400,'INVALID_MEASUREMENT','Ejes requeridos.');
                    noExtra($axes,['x','y','z']);
                    foreach(['x','y','z'] as $a) if(!isset($axes[$a])||(!is_float($axes[$a])&&!is_int($axes[$a]))||!is_finite((float)$axes[$a])||abs($axes[$a])>16) fail(400,'INVALID_MEASUREMENT','Ejes fuera de rango (g).');
                } elseif(($e['accelerationG']??null)!==null) fail(400,'INVALID_MEASUREMENT','Ejes inválidos deben ser null.');
                $hash=contentHash($e);
                query('INSERT INTO telemetry_summaries(node_id,node_boot_id,sequence,payload,content_hash) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',[$nodeRow['id'],$boot,$seq,json_encode($e),$hash]);
                $row=query('SELECT content_hash FROM telemetry_summaries WHERE node_id=? AND node_boot_id=? AND sequence=?',[$nodeRow['id'],$boot,$seq])->fetch();
                if(!hash_equals($row['content_hash'],$hash)) fail(409,'IDENTITY_CONFLICT','Resumen repetido con contenido diferente.');
                $acks[]=['nodeId'=>$node,'nodeBootId'=>$boot,'sequence'=>$seq];
            }
        }
        audit(null,$gw['sector_id'],$isEvent?'INGEST_EVENTS':'INGEST_SUMMARIES',$gw['id']); return $acks;
    });
    reply(['committed'=>true,'acknowledgements'=>$ack,'ackType'=>'MYSQL_COMMIT']);
}
