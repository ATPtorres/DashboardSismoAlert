export class Api {
  constructor() { this.csrf = null; this.base = new URL('api/', document.baseURI).pathname; }
  url(path) { return path.startsWith('/api/') ? this.base + path.slice(5) : path; }
  async request(path, {method = 'GET', body, signal} = {}) {
    if (method !== 'GET' && location.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('El acceso con credenciales requiere HTTPS, salvo en localhost.');
    const response = await fetch(this.url(path), {method, credentials: 'same-origin', cache: 'no-store', signal,
      headers: {Accept: 'application/json', ...(body ? {'Content-Type':'application/json'} : {}), ...(this.csrf ? {'X-CSRF-Token':this.csrf} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})});
    let data; try { data = await response.json(); } catch { throw new Error('Respuesta JSON inválida.'); }
    if (!response.ok) { const error = new Error(data.error?.message ?? 'Servicio no disponible.'); error.status = response.status; error.code = data.error?.code; throw error; }
    return data;
  }
}
export class Poller {
  constructor(fetcher, success, failure, {period = 500, timeout = 2000, initialTimeout = 8000} = {}) { Object.assign(this, {fetcher, success, failure, period, timeout, initialTimeout}); this.running = false; this.failures = 0; this.first = true; this.generation = 0; }
  start() { if (this.running) return; this.running = true; this.generation++; this.tick(this.generation); }
  stop() { this.running = false; this.generation++; clearTimeout(this.timer); this.controller?.abort(); }
  async tick(generation) {
    if (!this.running || generation !== this.generation) return;
    const controller = new AbortController(); this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), this.first ? this.initialTimeout : this.timeout);
    try { const data = await this.fetcher(controller.signal); if (!this.running || generation !== this.generation) return; this.success(data); this.failures = 0; this.first = false; }
    catch (error) { if (!this.running || generation !== this.generation) return; this.failures++; this.failure(error); }
    finally { clearTimeout(timeout); if (this.running && generation === this.generation) this.timer = setTimeout(() => this.tick(generation), this.failures ? Math.min(5000, 500 * 2 ** Math.min(this.failures, 4)) + Math.random() * 150 : this.period); }
  }
}
