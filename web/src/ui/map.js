import {sizeCanvas} from './chart.js';
import {validLocation} from '../domain/state.js';
export class LocalMap {
  constructor(canvas, message, attribution) {
    Object.assign(this, {canvas, message, attribution, zoom:1, dx:0, dy:0, location:null, data:null});
    canvas.addEventListener('pointerdown', e => { this.drag = [e.clientX,e.clientY,this.dx,this.dy]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if(this.drag) { this.dx=this.drag[2]+e.clientX-this.drag[0]; this.dy=this.drag[3]+e.clientY-this.drag[1]; this.draw(); } });
    canvas.addEventListener('pointerup', () => this.drag=null); canvas.addEventListener('pointercancel', () => this.drag=null);
  }
  async load() {
    try {
      const r = await fetch('assets/map/local-map.json'); if (!r.ok) throw new Error(); const data = await r.json();
      if (!Array.isArray(data.bounds) || data.bounds.length !== 4 || !data.bounds.every(Number.isFinite) || !Array.isArray(data.lines) || data.lines.length > 10000 || !data.source || !data.license) throw new Error();
      if (data.lines.length) { this.data=data; this.attribution.textContent='© OpenStreetMap contributors · '+data.license; }
    } catch { this.data=null; } this.draw();
  }
  setLocation(location) { this.location=validLocation(location)?location:null; this.draw(); }
  zoomBy(factor) { this.zoom=Math.max(.5,Math.min(8,this.zoom*factor)); this.draw(); }
  center() { this.dx=0;this.dy=0;this.zoom=1;this.draw(); }
  draw() {
    const {ctx:c,width:w,height:h}=sizeCanvas(this.canvas); if(w<10)return;
    c.fillStyle='#eff3f6';c.fillRect(0,0,w,h);c.strokeStyle='#dfe6ed';c.lineWidth=.6;
    for(let x=0;x<w;x+=26){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=26){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    if(!this.data){this.message.textContent='Sin geometrías locales · vista de coordenadas';c.fillStyle='#aab9cb';c.font='36px system-ui';c.textAlign='center';c.fillText('⌖',w/2,h/2-12);c.font='10px system-ui';c.fillStyle='#60728b';c.fillText('Extracto cartográfico pendiente',w/2,h/2+15);return;}
    const [west,south,east,north]=this.data.bounds;
    const project=([lon,lat])=>[(lon-(west+east)/2)/(east-west)*w*this.zoom+w/2+this.dx,((north+south)/2-lat)/(north-south)*h*this.zoom+h/2+this.dy];
    c.strokeStyle='#a5b8cc';c.lineWidth=2;
    for(const line of this.data.lines){if(!Array.isArray(line))continue;c.beginPath();line.slice(0,5000).forEach((p,i)=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))return;const [x,y]=project(p);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();}
    const p=this.location;
    if(p && p.longitude>=west && p.longitude<=east && p.latitude>=south && p.latitude<=north){const [x,y]=project([p.longitude,p.latitude]);c.fillStyle='#1346a0';c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();this.message.textContent='Posición configurada · no GPS';}
    else this.message.textContent=p?'Coordenadas fuera del extracto local':'Sin coordenadas publicadas';
  }
}
