export function sizeCanvas(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); return {ctx, width:r.width, height:r.height};
}
export function drawChart(canvas, points, now) {
  const {ctx:c, width:w, height:h} = sizeCanvas(canvas), left = 36, right = w - 15, top = 18, bottom = h - 26;
  if (w < 10) return;
  const values = points.flatMap(p => p.axes ? Object.values(p.axes) : []);
  const min = Math.min(-.1, ...values), max = Math.max(1.1, ...values), range = max - min;
  c.font = '9px system-ui'; c.fillStyle = '#7a899e'; c.strokeStyle = '#e9eef5'; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = top + (bottom - top) * i / 4; c.beginPath(); c.moveTo(left,y); c.lineTo(right,y); c.stroke(); c.fillText((max - range * i / 4).toFixed(1), 5, y+3); }
  for (let i = 0; i <= 4; i++) { const x = left + (right-left)*i/4; c.fillText(i === 4 ? 'ahora' : `−${60-15*i}s`, x-12, h-6); }
  for (const [axis,color] of [['x','#1346a0'],['y','#987800'],['z','#798da9']]) {
    c.strokeStyle = color; c.lineWidth = 1.7; c.beginPath(); let open = false;
    for (const p of points) {
      if (!p.axes || now-p.at > 60000) { open = false; continue; }
      const x = right - (now-p.at)/60000*(right-left), y = bottom - (p.axes[axis]-min)/range*(bottom-top);
      if (open) c.lineTo(x,y); else c.moveTo(x,y); open = true;
    } c.stroke();
  }
}
