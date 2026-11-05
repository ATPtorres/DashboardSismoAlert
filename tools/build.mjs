import {readdir,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url).pathname;
const dist=path.join(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
let compressed=0,raw=0;const manifest=[];
async function walk(dir){for(const entry of await readdir(path.join(root,'web',dir),{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){await walk(file);continue}const data=await readFile(path.join(root,'web',file));const gz=gzipSync(data,{level:9});await mkdir(path.dirname(path.join(dist,file)),{recursive:true});await writeFile(path.join(dist,file),data);await writeFile(path.join(dist,file+'.gz'),gz);if(/\.(html|css|js)$/.test(file)){raw+=data.length;compressed+=gz.length;}manifest.push({file,bytes:data.length,gzipBytes:gz.length});}}
await walk('');await writeFile(path.join(dist,'manifest.json'),JSON.stringify({rawBytes:raw,compressedBytes:compressed,files:manifest},null,2));
console.log(`HTML/CSS/JS: ${raw} bytes; gzip: ${compressed} bytes (budget 204800). ${manifest.length} local assets.`);
if(compressed>200*1024)throw new Error('Embedded resource budget exceeded');
