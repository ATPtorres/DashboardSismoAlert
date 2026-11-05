<?php
declare(strict_types=1);
function history(array $u,string $path): never {
    $s=sector($u,$_GET['sectorId']??'');
    $cursor=$_GET['cursor']??'0'; if(!preg_match('/^\d{1,20}$/D',$cursor)) fail(400,'INVALID_CURSOR','Cursor inválido.');
    $origin=$_GET['origin']??'REAL'; if(!in_array($origin,['REAL','SIMULATED'],true)) fail(400,'INVALID_ORIGIN','Origen inválido.');
    $limit=filter_var($_GET['limit']??20,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>50]]); if($limit===false) fail(400,'INVALID_LIMIT','Límite entre 1 y 50.');
    $rows=query('SELECT e.id,e.payload,e.ingested_at FROM events e JOIN gateways g ON e.gateway_id=g.id WHERE g.sector_id=? AND e.origin=? AND e.id>? ORDER BY e.id LIMIT '.($limit+1),[$s,$origin,$cursor])->fetchAll();
    $more=count($rows)>$limit; $rows=array_slice($rows,0,$limit);
    $items=array_map(fn($r)=>['storageId'=>(string)$r['id'],'ingestedAt'=>str_replace(' ','T',$r['ingested_at']).'Z','ingestionTimeSource'=>'SERVER_UTC','event'=>json_decode($r['payload'],true)],$rows);
    $cursorMissing=$cursor!=='0'&&!query('SELECT e.id FROM events e JOIN gateways g ON e.gateway_id=g.id WHERE e.id=? AND g.sector_id=? AND e.origin=?',[$cursor,$s,$origin])->fetch();
    $result=['cursorDiscontinuity'=>$cursorMissing,'items'=>$items,'nextCursor'=>$more?(string)end($rows)['id']:null,'lastCursor'=>$rows?(string)end($rows)['id']:$cursor,'origin'=>$origin,'storage'=>'MYSQL','historyCompleteness'=>'NOT_GUARANTEED','retentionDays'=>90,'description'=>'Eventos confirmados; no es una captura completa de muestras.'];
    if($path==='/api/v1/export/events.csv') {
        audit($u['id'],$s,'EXPORT_CSV',$origin);
        header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="sismoalert-events.csv"');
        header('X-Next-Cursor: '.($result['nextCursor']??''));
        $out=fopen('php://output','w');
        fputcsv($out,['storage_id','origin','drill','node_id','node_boot_id','event_id','sequence','type','gateway_uptime_ms','measurement_time_source','ingested_at_utc','ingestion_time_source','freshness','latitude_deg','longitude_deg','profile_id','history_completeness','schema_version'],',','"','');
        foreach($items as $item) {
            $e=$item['event']; $l=$e['locationSnapshot']??[];
            $cells=[$item['storageId'],$e['origin'],$e['drill']?'true':'false',$e['nodeId'],$e['nodeBootId'],$e['id'],$e['sequence'],$e['type'],$e['receivedAtGatewayUptimeMs'],$e['timeSource'],$item['ingestedAt'],'SERVER_UTC',$e['freshness'],$l['latitude']??null,$l['longitude']??null,$e['profileId']??null,'NOT_GUARANTEED',1];
            $cells=array_map(fn($v)=>is_string($v)&&preg_match('/^[\s]*[=+\-@\t\r]/',$v)?"'".$v:$v,$cells);
            fputcsv($out,$cells,',','"','');
        } fclose($out); exit;
    }
    if($path==='/api/v1/export/events.json') { audit($u['id'],$s,'EXPORT_JSON',$origin); header('Content-Disposition: attachment; filename="sismoalert-events.json"'); }
    elseif($path!=='/api/v1/events') fail(404,'NOT_FOUND','Ruta no disponible.');
    reply($result);
}
