import {readFile,writeFile} from 'node:fs/promises';
import './build.mjs';
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
let header='#pragma once\n#include <Arduino.h>\n// Generated static resources only. Not a receiver firmware or API implementation.\nnamespace sismoalert {\n';
const resources=[];let i=0;
for(const entry of manifest.files){
  if(entry.file.endsWith('.md'))continue;
  const data=await readFile('dist/'+entry.file+'.gz'),symbol='asset_'+i++;
  header+=`const unsigned char ${symbol}[] PROGMEM = {\n`;
  for(let start=0;start<data.length;start+=24)header+='  '+[...data.subarray(start,start+24)].map(v=>'0x'+v.toString(16).padStart(2,'0')).join(',')+',\n';
  header+='};\n';
  const type=entry.file.endsWith('.html')?'text/html; charset=utf-8':entry.file.endsWith('.css')?'text/css; charset=utf-8':entry.file.endsWith('.js')?'text/javascript; charset=utf-8':entry.file.endsWith('.svg')?'image/svg+xml':'application/json';
  resources.push(`  {"/${entry.file === 'index.html' ? '' : entry.file}", "${type}", ${symbol}, sizeof(${symbol})}`);
}
header+='struct EmbeddedAsset { const char* path; const char* contentType; const unsigned char* data; size_t size; };\nconst EmbeddedAsset assets[] = {\n'+resources.join(',\n')+'\n};\n}\n';
await writeFile('dist/embedded_assets.h',header);console.log('dist/embedded_assets.h generated. Serve gzip with Content-Encoding: gzip and correct content type. Check real partition and RAM before flashing.');
