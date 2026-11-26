import {Api, Poller} from './api/client.js';
import {validateSnapshot, deriveState, labels, Timeline, validLocation} from './domain/state.js';
import {EventStore} from './domain/events.js';
import {drawChart} from './ui/chart.js';
import {LocalMap} from './ui/map.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const text=(id,value)=>$(id).textContent=value;
const api=new Api();
let user=null,snapshot=null,receivedAt=0,receiver=false,demo=null,demoAllowed=false,paused=false,pauseAt=0,timeline=new Timeline(),events=new EventStore(),configVersion=0,historyCursor='0',nextCursor=null,auditCursor='0',lastError='',previousGateway=null;
const map=new LocalMap($('#map'),$('#map-message'),$('#map-attribution'));map.load();
function feedback(message,error=true){const box=$('#feedback');box.textContent=message;box.hidden=!message;box.classList.toggle('error',error);}
function empty(el,title,detail){const box=document.createElement('div');box.className='empty-events';const strong=document.createElement('strong');strong.textContent=title;box.append(strong,document.createTextNode(detail));el.replaceChildren(box);}
function clearPrivate(){user=null;api.csrf=null;if(!demo){snapshot=null;receiver=false;timeline=new Timeline();events=new EventStore();renderEvents();}for(const id of ['#users-list','#history-results','#diagnostic-output','#audit-results','#published-notices'])$(id).replaceChildren();$('#config-form').reset();configVersion=0;updateAccount();}
async function request(path,options){try{return await api.request(path,options)}catch(e){if([401,503].includes(e.status)){clearPrivate();if(!['panel','eventos','ayuda','cuenta'].includes(location.hash.slice(2)))location.hash='/cuenta';}throw e;}}
function updateAccount(){
  $$('[data-admin]').forEach(el=>el.hidden=user?.role!=='ADMINISTRADOR');
  text('#account-button',user?user.username+' →':'Acceder →');
  $('#login-form').hidden=!!user;$('#profile-card').hidden=!user;
  if(user){text('#profile-name',user.username);text('#profile-role',`${user.role} · Sectores: ${user.sectors.join(', ')}`);}
  $$('.sector-select').forEach(select=>{const old=select.value;select.replaceChildren(...(user?.sectors??[]).map(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;return o}));if(user?.sectors.includes(old))select.value=old;});
}
function eventRows(el,items){
  if(!items.length){empty(el,'Sin avisos registrados','Los eventos recibidos aparecerán aquí. La ausencia de avisos no acredita seguridad.');return;}
  const rows=items.map(e=>{const row=document.createElement('div');row.className='event-row';const mark=document.createElement('span');mark.className='event-mark';mark.textContent=e.type==='ANOMALIA'?'!':'↻';mark.setAttribute('aria-hidden','true');const body=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p'),time=document.createElement('small');title.textContent=labels[e.type]??e.type;detail.textContent=`Nodo ${e.nodeId} · ${e.origin==='SIMULATED'?'SIMULADO':'REAL'} · ${e.freshness==='CURRENT'?'vigencia al recibir':'histórico / vigencia desconocida'}`;time.textContent=`Observado hace ${Math.max(0,Math.floor((performance.now()-e.observedAt)/1000))} s`;body.append(title,detail);row.append(mark,body,time);return row;});el.replaceChildren(...rows);
}
function renderEvents(){eventRows($('#recent-events'),events.items.slice(0,3));eventRows($('#all-events'),events.items);text('#event-count',String(events.items.length));}
function applySnapshot(data){
  validateSnapshot(data);
  if(data.dataOrigin!== (demo?'SIMULATED':'REAL'))throw new Error('Origen de datos inesperado; no se mezclaron las lecturas.');
  const newBoot=data.gateway?.bootId;
  const reconnect=!receiver;
  const sameBoot=snapshot?.gateway?.bootId===newBoot && snapshot?.nodes?.[0]?.bootId===data.nodes[0]?.bootId;
  if(sameBoot && data.nodes[0] && snapshot?.nodes?.[0] && data.nodes[0].sequence<snapshot.nodes[0].sequence)throw new Error('Secuencia atrasada; esperando datos coherentes.');
  snapshot=data;receivedAt=performance.now();receiver=demo?true:data.receiverConnection!=='NO_DISPONIBLE';lastError='';
  if(!demo){demoAllowed=data.demoEnabled??demoAllowed;$('#enter-demo').hidden=!demoAllowed;$('#simulation-nav').hidden=!demoAllowed;}
  const state=deriveState(snapshot,receivedAt,receivedAt,receiver);
  const reboot=previousGateway && previousGateway!==newBoot;previousGateway=newBoot;
  if(!paused)timeline.add(snapshot,state,receivedAt);
  for(const e of (data.events??[]).slice(0,100))events.add(e,receivedAt,!reconnect&&!reboot&&state.detection==='ANOMALIA');
  const notices=(data.notices??[]).slice(0,20).map(n=>{const p=document.createElement('p');p.textContent=`${n.sectorId}: ${n.text}`;return p;});$('#published-notices').replaceChildren(...notices);
  renderEvents();render();
}
const poller=new Poller(async signal=>demo?demo.snapshot():request(user?'/api/v1/state':'/api/v1/public/state',{signal}),applySnapshot,e=>{receiver=false;lastError=e.name==='AbortError'?'Tiempo de respuesta agotado':e.message;timeline.gap(performance.now());render();});
function render(){
  const now=performance.now(),state=deriveState(snapshot,receivedAt,now,receiver),n=state.node;
  if(!state.axes&&!paused)timeline.gap(now);timeline.trim(paused?pauseAt:now);
  text('#receiver-label',demo?'Receptor simulado':receiver?'Receptor disponible':'Receptor no integrado / no disponible');
  text('#last-update',snapshot?lastError||'Lectura local · sin garantía de tiempo real':'Sin recepción confirmada');
  text('#origin-badge',demo?'SIMULACIÓN ACTIVA':n?'REAL':'REAL · SIN DATOS');$('#origin-badge').classList.toggle('simulated',!!demo);
  text('#data-service',demo?'Simulación aislada · datos sintéticos no guardados en MySQL':snapshot?.services?.database==='AVAILABLE'?'Servicio de datos disponible · API y MySQL locales · receptor físico pendiente':`Servicio de datos no disponible${lastError?' · '+lastError:''}. Funciones protegidas suspendidas.`);
  text('#detection-value',labels[state.detection]);$('#detection-value').classList.toggle('danger-text',state.detection==='ANOMALIA');
  text('#detection-description',state.detection==='NORMAL'?'Bajo el criterio configurado; no significa seguridad.':state.sensor==='ERROR_SENSOR'?'Detección suspendida por falla del sensor.':state.link==='SIN_ENLACE'?'Lecturas vencidas. Estado actual desconocido.':n?'La decisión corresponde al emisor.':'Aún no hay una lectura válida.');
  text('#detection-origin',`Origen: ${demo?'SIMULADO':'REAL'}${n?.drill?' · SIMULACRO':''}`);text('#link-value',labels[state.link]);text('#sensor-value',labels[state.sensor]);
  text('#node-label',n?`Nodo ${n.id}${demo?' · simulado':''}`:'Ningún nodo recibido');text('#age-value',state.ageMs===null?'— s':`${(state.ageMs/1000).toFixed(1)} s`);text('#age-description',n?`Vencimiento: ${n.staleAfterMs/1000} s · recepción`:'Desde la última recepción');
  for(const axis of ['x','y','z'])text('#axis-'+axis,state.axes?state.axes[axis].toFixed(3):'—');
  const metrics=snapshot?.capabilities?.windowMetrics&&state.axes&&n?.measurement?.windowMs&&n?.calibration?.profileId;
  text('#rms',metrics?`${Number.isFinite(n.measurement.rmsG)?n.measurement.rmsG.toFixed(3):'—'} / ${Number.isFinite(n.measurement.peakG)?n.measurement.peakG.toFixed(3):'—'}`:'— / —');
  $('#chart-empty').hidden=timeline.points.some(p=>p.axes);text('#chart-status',paused?'PAUSADA':timeline.points.some(p=>p.axes)?`60 s · ${demo?'SIMULADO':'REAL'}`:'Sin muestras');
  drawChart($('#chart'),timeline.points,paused?pauseAt:now);
  const loc=n?.location;map.setLocation(loc);
  text('#location-name',validLocation(loc)?(demo?'Nodo simulado 1':'Ubicación publicada'):'Ubicación no disponible');
  text('#coordinates',validLocation(loc)?`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`:'No se han recibido coordenadas.');
  text('#location-note',`${state.link==='SIN_ENLACE'?'Última posición conocida. ':''}Posición configurada, no GPS. ${loc?.physicalInstallationVerified?'Instalación reportada por el dispositivo.':'Instalación no verificada.'}`);
  $('#active-alert').hidden=!events.active;
  if(events.active){text('#alert-title',state.detection==='ANOMALIA'?'Vibración anómala detectada':'Última anomalía · ya no se acredita vigencia');text('#alert-detail',`Nodo ${events.active.nodeId} · ${events.active.origin==='SIMULATED'?'SIMULADO':'REAL'}. Cerrar no controla el buzzer ni confirma recuperación.`);}
}
const titles={panel:'Vista general',eventos:'Avisos recientes',simulacion:'Simulación',cuenta:'Mi cuenta',diagnostico:'Diagnóstico',historial:'Historial',cuentas:'Cuentas',configuracion:'Configuración',auditoria:'Auditoría',ayuda:'Acerca del sistema'};
async function route(){
  let page=location.hash.slice(2)||'panel';if(!titles[page])page='panel';
  if(['diagnostico','historial','cuentas','configuracion','auditoria'].includes(page)&&user?.role!=='ADMINISTRADOR'){page='cuenta';feedback('Acceso de administrador requerido.');}
  if(page==='simulacion'&&!demoAllowed){page='panel';feedback('La simulación está desactivada en esta instalación.');location.hash='/panel';}
  $$('[data-view]').forEach(el=>el.hidden=el.dataset.view!==page);$$('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));text('#page-title',titles[page]);
  try {if(page==='diagnostico'){text('#diagnostic-output',JSON.stringify(await request('/api/v1/info'),null,2));}if(page==='cuentas')await loadUsers();if(page==='configuracion')await loadConfig();if(page==='panel')render();}catch(e){feedback(e.message);}
}
function bind(id,event,handler){$(id).addEventListener(event,async e=>{try{await handler(e)}catch(error){feedback(error.message)}});}
bind('#account-button','click',()=>location.hash='/cuenta');
bind('#login-form','submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));const r=await request('/api/v1/session',{method:'POST',body});api.csrf=r.csrfToken;user=r.user;e.target.reset();updateAccount();feedback('');location.hash='/panel';});
bind('#logout','click',async()=>{await request('/api/v1/session',{method:'DELETE'});clearPrivate();snapshot=null;timeline=new Timeline();events=new EventStore();renderEvents();location.hash='/panel';});
bind('#password-form','submit',async e=>{e.preventDefault();await request('/api/v1/me/password',{method:'POST',body:Object.fromEntries(new FormData(e.target))});e.target.reset();clearPrivate();feedback('Contraseña actualizada. Vuelva a iniciar sesión.',false);});
bind('#dismiss-alert','click',()=>{events.dismiss();render();});
bind('#pause-chart','click',()=>{paused=!paused;if(paused)pauseAt=performance.now();else timeline.gap(performance.now());text('#pause-chart',paused?'▶':'❚❚');$('#pause-chart').setAttribute('aria-label',paused?'Reanudar gráfica':'Pausar gráfica');render();});
bind('#map-zoom-in','click',()=>map.zoomBy(1.5));bind('#map-zoom-out','click',()=>map.zoomBy(1/1.5));bind('#map-center','click',()=>map.center());
async function switchDemo(on){
  if(on&&!demoAllowed)throw new Error('La simulación está desactivada en esta instalación.');
  poller.stop();
  if(on){const {Demo}=await import('./api/demo.js');demo=new Demo();}else demo=null;
  snapshot=null;previousGateway=null;receiver=false;timeline=new Timeline();events=new EventStore();paused=false;
  $('#demo-banner').hidden=!on;$('#demo-scenario').value='normal';$('#simulation-scenario').value='normal';
  $('#simulation-state').textContent=on?'EN EJECUCIÓN':'DETENIDA';
  $('#simulation-state').classList.toggle('running',on);
  $('#simulation-start').disabled=on;$('#simulation-stop').disabled=!on;
  renderEvents();render();poller.start();
}
bind('#enter-demo','click',async()=>{await switchDemo(true);location.hash='/simulacion';});
bind('#simulation-start','click',async()=>{const scenario=$('#simulation-scenario').value;if(!demo)await switchDemo(true);$('#simulation-scenario').value=scenario;demo?.setScenario(scenario);$('#demo-scenario').value=scenario;render();location.hash='/panel';});
bind('#simulation-stop','click',async()=>{await switchDemo(false);location.hash='/simulacion';});
bind('#leave-demo','click',async()=>{await switchDemo(false);location.hash='/panel';});
bind('#demo-scenario','change',e=>{demo?.setScenario(e.target.value);$('#simulation-scenario').value=e.target.value;render();});
bind('#simulation-scenario','change',e=>{demo?.setScenario(e.target.value);$('#demo-scenario').value=e.target.value;render();});
function table(container,headers,rows){
  if(!rows.length){empty(container,'Sin registros','No hay resultados en esta página y alcance.');return;}
  const wrap=document.createElement('div');wrap.className='table-scroll';const t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
  headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;th.scope='col';tr.append(th)});head.append(tr);t.append(head);const b=document.createElement('tbody');rows.forEach(row=>{const r=document.createElement('tr');row.forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'—');r.append(td)});b.append(r)});t.append(b);wrap.append(t);container.replaceChildren(wrap);
}
function historyQuery(){return new URLSearchParams({sectorId:$('#history-sector').value,origin:$('#history-origin').value,cursor:historyCursor,limit:'20'});}
async function loadHistory(){const data=await request('/api/v1/events?'+historyQuery());nextCursor=data.nextCursor;$('#history-next').hidden=!nextCursor;table($('#history-results'),['ID','EVENTO / NODO','ORIGEN','INGESTA · AMERICA/LA_PAZ','TIEMPO DE MEDICIÓN'],data.items.map(r=>[r.storageId,`${r.event.type} / ${r.event.nodeId}`,r.event.origin,new Intl.DateTimeFormat('es-BO',{dateStyle:'short',timeStyle:'medium',timeZone:'America/La_Paz'}).format(new Date(r.ingestedAt)),r.event.timeSource]));}
bind('#history-load','click',async()=>{historyCursor='0';await loadHistory()});bind('#history-next','click',async()=>{historyCursor=nextCursor;await loadHistory()});
for(const format of ['csv','json'])bind('#export-'+format,'click',async()=>{const response=await fetch(api.url(`/api/v1/export/events.${format}?${historyQuery()}`),{credentials:'same-origin',cache:'no-store'});if(!response.ok){const r=await response.json();throw new Error(r.error.message)}const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=`sismoalert-${$('#history-origin').value.toLowerCase()}-events.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function loadUsers(){
  const {users}=await request('/api/v1/users');const list=$('#users-list');list.replaceChildren();
  for(const u of users){const row=document.createElement('div');row.className='account-row';const name=document.createElement('strong');name.textContent=u.username;const state=document.createElement('small');state.textContent=`${u.active?'Activa':'Desactivada'} · ${u.sectors.join(', ')}`;const controls=document.createElement('div');controls.className='toolbar';const role=document.createElement('select');role.setAttribute('aria-label',`Rol de ${u.username}`);for(const r of ['USUARIO','ADMINISTRADOR']){const o=document.createElement('option');o.value=r;o.textContent=r;role.append(o)}role.value=u.role;
    const scope=document.createElement('select');scope.multiple=true;scope.setAttribute('aria-label',`Sectores de ${u.username}`);for(const s of user.sectors){const o=document.createElement('option');o.value=s;o.textContent=s;o.selected=u.sectors.includes(s);scope.append(o)}
    for(const [label,body] of [['Guardar permisos',()=>({role:role.value,sectors:[...scope.selectedOptions].map(o=>o.value)})],[u.active?'Desactivar':'Activar',()=>({active:!u.active})]]){const button=document.createElement('button');button.className='button secondary';button.textContent=label;button.addEventListener('click',async()=>{try{await request(`/api/v1/users/${u.id}`,{method:'PATCH',body:body()});if(u.id===user?.id){clearPrivate();location.hash='/cuenta';}else await loadUsers();feedback('Cuenta actualizada; sesiones revocadas.',false);}catch(e){feedback(e.message)}});controls.append(button)}row.append(name,state,role,scope,controls);list.append(row);
  }
}
bind('#create-user','submit',async e=>{e.preventDefault();const form=new FormData(e.target);await request('/api/v1/users',{method:'POST',body:{username:form.get('username'),password:form.get('password'),role:form.get('role'),sectors:form.getAll('sectors')}});e.target.reset();await loadUsers();feedback('Cuenta creada.',false)});
async function loadConfig(){const r=await request('/api/v1/config?'+new URLSearchParams({sectorId:$('#config-sector').value}));configVersion=r.version;$('#config-form textarea').value=r.desired.notice;text('#config-version',`Versión ${r.version} · no aplicada al hardware`);}
bind('#config-sector','change',loadConfig);bind('#config-form','submit',async e=>{e.preventDefault();await request('/api/v1/config',{method:'PATCH',body:{sectorId:$('#config-sector').value,expectedVersion:configVersion,notice:e.target.elements.notice.value}});await loadConfig();feedback('Aviso publicado para las cuentas autorizadas del sector.',false)});
let auditNext=null;
async function loadAudit(){const r=await request('/api/v1/audit?'+new URLSearchParams({sectorId:$('#audit-sector').value,cursor:auditCursor}));auditNext=r.nextCursor;$('#audit-next').hidden=!auditNext;table($('#audit-results'),['ID','ACCIÓN','RECURSO','RESULTADO','FECHA UTC'],r.items.map(i=>[i.id,i.action,i.resource,i.outcome,i.created_at]));}
bind('#audit-load','click',async()=>{auditCursor='0';await loadAudit()});bind('#audit-next','click',async()=>{auditCursor=auditNext;await loadAudit()});
window.addEventListener('hashchange',route);window.addEventListener('resize',()=>{render();map.draw()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){receiver=false;timeline.gap(performance.now());render();}});
async function boot(){try{const r=await api.request('/api/v1/me');user=r.user;api.csrf=r.csrfToken;}catch{}updateAccount();renderEvents();await route();poller.start();setInterval(render,500);}
boot();
