export const labels = {
  NORMAL: 'Sin anomalía detectada', ANOMALIA: 'Vibración anómala', CALIBRANDO: 'Estableciendo referencia',
  PERFIL_NO_VALIDO: 'Perfil no válido', NO_DISPONIBLE: 'Detección no disponible', ESPERANDO_DATOS: 'Esperando datos',
  VIGENTE: 'Enlace vigente', DEGRADADO: 'Enlace degradado', SIN_ENLACE: 'Sin enlace',
  OK: 'Operativo', ERROR_SENSOR: 'Falla del sensor', DESCONOCIDO: 'Desconocido', REINICIO: 'Reinicio detectado',
};
const nonnegative = x => Number.isSafeInteger(x) && x >= 0;
export function validLocation(p) {
  return p != null && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
export function validateSnapshot(s) {
  if (!s || s.schemaVersion !== 1 || !['REAL', 'SIMULATED'].includes(s.dataOrigin) || !Array.isArray(s.nodes) || s.nodes.length > 20) throw new Error('Contrato de estado desconocido o inválido.');
  for (const n of s.nodes) {
    if (!n || !['string', 'number'].includes(typeof n.id) || String(n.id).length > 64 || typeof n.bootId !== 'string' || n.bootId.length > 64 || !nonnegative(n.sequence) || !nonnegative(n.lastRxAgeMs) || !nonnegative(n.staleAfterMs) || n.staleAfterMs < 1 || n.staleAfterMs > 60000) throw new Error('Identidad o vigencia del nodo inválida.');
    if (!['ESPERANDO_DATOS', 'VIGENTE', 'DEGRADADO', 'SIN_ENLACE'].includes(n.linkState) || !['OK', 'ERROR_SENSOR', 'DESCONOCIDO'].includes(n.sensorState) || !['NORMAL', 'ANOMALIA', 'CALIBRANDO', 'PERFIL_NO_VALIDO', 'NO_DISPONIBLE'].includes(n.detectionState)) throw new Error('Estado del nodo inválido.');
  }
  return s;
}
export function deriveState(snapshot, receivedAt, now, receiverAvailable = true) {
  const n = snapshot?.nodes?.[0];
  const base = {receiver: receiverAvailable ? 'DISPONIBLE' : 'NO_DISPONIBLE', link: 'ESPERANDO_DATOS', sensor: 'DESCONOCIDO', detection: 'ESPERANDO_DATOS', ageMs: null, axes: null, node: n ?? null, origin: snapshot?.dataOrigin ?? 'REAL'};
  if (!n) return base;
  const age = n.lastRxAgeMs + Math.max(0, now - receivedAt);
  base.ageMs = age; base.sensor = n.sensorState;
  base.link = age >= n.staleAfterMs ? 'SIN_ENLACE' : n.linkState;
  const m = n.measurement;
  const validAxes = m?.valid === true && ['x', 'y', 'z'].every(a => Number.isFinite(m.accelerationG?.[a]) && Math.abs(m.accelerationG[a]) <= 16);
  const valid = receiverAvailable && base.link === 'VIGENTE' && base.sensor === 'OK' && validAxes;
  base.detection = valid ? n.detectionState : 'NO_DISPONIBLE';
  if (valid && base.detection === 'NORMAL' && !['PROVISIONAL_REFERENCE', 'VALIDATED'].includes(n.calibration?.status)) base.detection = 'PERFIL_NO_VALIDO';
  if (valid && !['CALIBRANDO', 'PERFIL_NO_VALIDO', 'NO_DISPONIBLE'].includes(base.detection)) base.axes = {...m.accelerationG};
  return base;
}
export class Timeline {
  constructor() { this.points = []; this.key = null; this.sequence = null; this.gaps = 0; }
  add(snapshot, state, at) {
    const n = state.node; if (!n) { this.gap(at); return; }
    const key = `${snapshot.dataOrigin}/${snapshot.gateway?.bootId}/${n.id}/${n.bootId}`;
    if (key !== this.key) { if (this.key) this.gaps++; this.points = []; this.sequence = null; this.key = key; }
    if (this.sequence !== null && n.sequence <= this.sequence) { if (!state.axes) this.gap(at); return; }
    if (this.sequence !== null && (n.sequence !== this.sequence + 1 || at - (this.points.at(-1)?.at ?? at) > 1500)) this.gap(at - 1);
    this.sequence = n.sequence; this.points.push({at, axes: state.axes}); this.trim(at);
  }
  gap(at) { if (this.points.length && this.points.at(-1).axes !== null) this.points.push({at, axes: null}); this.trim(at); }
  trim(now) { this.points = this.points.filter(p => now - p.at <= 60000).slice(-240); }
}
