import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const username='ui-'+randomBytes(6).toString('hex'),password=randomBytes(20).toString('hex');
const fixtureCode=`require '/app/backend/src/core.php'; $v=json_decode(stream_get_contents(STDIN),true); query('DELETE FROM login_attempts'); query('INSERT INTO users(username,password_hash,role) VALUES (?,?,?)',[$v['username'],hashPassword($v['password']),'ADMINISTRADOR']); $id=db()->lastInsertId(); query('INSERT INTO user_sector_access VALUES (?,?)',[$id,'S01']);`;
execFileSync('docker',['compose','-p','sismoalert-test','-f','compose.yaml','-f','deploy/test.yaml','exec','-T','app','php','-r',fixtureCode],{input:JSON.stringify({username,password}),stdio:['pipe','pipe','pipe']});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext();
const page=await context.newPage();const failures=[],external=[];
page.on('pageerror',e=>failures.push(e.message));page.on('request',r=>{if(!r.url().startsWith('https://localhost:9443'))external.push(r.url())});
await mkdir('.local/screenshots',{recursive:true});
try {
  await page.goto('https://localhost:9443');await page.waitForFunction(()=>document.querySelector('#data-service').textContent.includes('Servicio de datos disponible'));
  assert.equal(await page.locator('#detection-value').textContent(),'Esperando datos');
  assert.equal(await page.locator('#axis-x').textContent(),'—');
  for(const width of [360,768,1440]){
    await page.setViewportSize({width,height:1000});await page.screenshot({path:`.local/screenshots/real-${width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Horizontal overflow at ${width}`);
  }
  await page.locator('#enter-demo').click();await page.waitForFunction(()=>document.querySelector('#detection-value').textContent==='Sin anomalía detectada');
  assert.equal(await page.locator('#simulation-nav').isVisible(),true);assert.equal(await page.locator('[data-view="simulacion"]').isVisible(),true);
  assert.equal(await page.locator('#demo-banner').isVisible(),true);assert.match(await page.locator('#origin-badge').textContent(),/SIMULADO/);
  await page.selectOption('#demo-scenario','anomaly');await page.waitForFunction(()=>!document.querySelector('#active-alert').hidden);
  assert.equal(await page.locator('#event-count').textContent(),'1');await page.locator('#dismiss-alert').click();
  await page.waitForFunction(()=>document.querySelector('#detection-value').textContent==='Vibración anómala');assert.equal(await page.locator('#active-alert').isVisible(),false);
  await page.selectOption('#demo-scenario','sensor');await page.waitForFunction(()=>document.querySelector('#sensor-value').textContent==='Falla del sensor');assert.equal(await page.locator('#axis-x').textContent(),'—');
  await page.selectOption('#demo-scenario','link');await page.waitForFunction(()=>document.querySelector('#link-value').textContent==='Sin enlace');
  await page.selectOption('#demo-scenario','normal');await page.waitForFunction(()=>document.querySelector('#detection-value').textContent==='Sin anomalía detectada');
  await page.screenshot({path:'.local/screenshots/demo-1440.png',fullPage:true});
  await page.locator('#leave-demo').click();await page.waitForFunction(()=>document.querySelector('#detection-value').textContent==='Esperando datos');assert.equal(await page.locator('#event-count').textContent(),'0');
  await page.locator('#simulation-nav').click();await page.waitForFunction(()=>!document.querySelector('[data-view="simulacion"]').hidden);
  await page.selectOption('#simulation-scenario','anomaly');await page.locator('#simulation-start').click();await page.waitForFunction(()=>document.querySelector('#detection-value').textContent==='Vibración anómala');
  assert.match(await page.locator('#origin-badge').textContent(),/SIMULACIÓN/);assert.equal(await page.locator('#simulation-stop').isEnabled(),true);
  await page.locator('#leave-demo').click();await page.waitForFunction(()=>document.querySelector('#detection-value').textContent==='Esperando datos');
  // Direct navigation cannot expose protected view without a server session.
  await page.goto('https://localhost:9443/#/cuentas');await page.waitForFunction(()=>!document.querySelector('[data-view="cuenta"]').hidden);assert.equal(await page.locator('[data-view="cuentas"]').isVisible(),false);
  await page.locator('#login-form [name=username]').fill(username);await page.locator('#login-form [name=password]').fill(password);await page.locator('#login-form button').click();
  await page.waitForFunction(()=>!document.querySelector('[data-page="cuentas"]').hidden);
  await page.locator('[data-page="cuentas"]').click();await page.waitForSelector('#users-list .account-row');
  const operator='operator-'+randomBytes(4).toString('hex');
  await page.locator('#create-user [name=username]').fill(operator);await page.locator('#create-user [name=password]').fill(randomBytes(20).toString('hex'));await page.locator('#create-user [name=sectors]').selectOption('S01');await page.locator('#create-user button').click();
  await page.waitForFunction(name=>document.querySelector('#users-list').textContent.includes(name),operator);
  await page.locator('[data-page="configuracion"]').click();await page.waitForFunction(()=>document.querySelector('#config-version').textContent.includes('Versión'));
  const xss='<img src=x onerror="window.xssRan=true"> Información de prueba';
  await page.locator('#config-form textarea').fill(xss);await page.locator('#config-form button').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Aviso publicado'));
  await page.locator('[data-page="panel"]').click();await page.waitForFunction(()=>document.querySelector('#published-notices').textContent.includes('<img'));
  assert.equal(await page.locator('#published-notices img').count(),0);assert.equal(await page.evaluate(()=>window.xssRan),undefined);
  await page.locator('[data-page="diagnostico"]').click();await page.waitForFunction(()=>document.querySelector('#diagnostic-output').textContent.includes('receiverIntegrated'));
  await page.locator('[data-page="historial"]').click();await page.locator('#history-origin').selectOption('SIMULATED');await page.locator('#history-load').click();await page.waitForSelector('#history-results table');
  await page.locator('#account-button').click();await page.locator('#logout').click();await page.waitForFunction(()=>document.querySelector('[data-page="cuentas"]').hidden);
  assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
  console.log('Browser passed: trusted TLS, 360/768/1440 px, no horizontal overflow, empty real state, opt-in demo, dedicated simulation navigation/start/stop, anomaly dedup/dismissal, sensor/link failure, mode isolation, protected navigation, admin login, account creation, versioned notice, stored-XSS rendering, protected history/diagnostics, logout, no external requests or JS errors.');
} finally {await browser.close();}
