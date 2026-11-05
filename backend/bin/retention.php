<?php
declare(strict_types=1);
require __DIR__.'/../src/core.php';
if(PHP_SAPI!=='cli') exit(1);
// Bounded operator maintenance. Run hourly; no work on the ESP32.
$deleted=[];
foreach(['telemetry_summaries'=>7,'events'=>90,'audit_logs'=>90] as $table=>$days) {
    $column=$table==='audit_logs'?'created_at':'ingested_at';
    $deleted[$table]=query("DELETE FROM $table WHERE $column<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL $days DAY) LIMIT 1000")->rowCount();
}
query('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3) LIMIT 1000');
query('DELETE FROM login_attempts WHERE expires_at<UTC_TIMESTAMP(3) LIMIT 1000');
echo json_encode(['deleted'=>$deleted,'batchLimit'=>1000]),PHP_EOL;
