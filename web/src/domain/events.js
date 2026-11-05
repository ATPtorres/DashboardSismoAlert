export class EventStore {
  constructor(limit = 100) { this.limit = limit; this.items = []; this.seen = new Set(); this.seenOrder = []; this.dismissed = new Set(); this.active = null; this.dropped = 0; }
  add(e, observedAt, allowCurrent = false) {
    if (!e || !['REAL','SIMULATED'].includes(e.origin) || !['id','nodeId','nodeBootId'].every(k => ['string','number'].includes(typeof e[k]) && String(e[k]).length > 0 && String(e[k]).length <= 64)) return false;
    const key = `${e.origin}/${e.nodeId}/${e.nodeBootId}/${e.id}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key); this.seenOrder.push(key);
    if (this.seenOrder.length > 1000) { const old = this.seenOrder.shift(); this.seen.delete(old); this.dismissed.delete(old); }
    const event = {...e, key, observedAt, observationTimeSource: 'browser_observed'};
    this.items.unshift(event);
    if (this.items.length > this.limit) { this.items.pop(); this.dropped++; }
    if (allowCurrent && e.freshness === 'CURRENT' && e.type === 'ANOMALIA') this.active = event;
    return true;
  }
  dismiss() { if (this.active) this.dismissed.add(this.active.key); this.active = null; }
}
