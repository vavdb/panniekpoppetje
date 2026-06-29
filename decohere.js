// decohere() — engine v2
// Entities with shaped sprites: Vincent = hexagon/orange (the cloud), Leydi = heart->snowflake/pink,
// Josefina = circle/red, Benjamin = square/blue. Cloud decoheres per scroll-beat; bg travels dark->light.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import Lenis from 'lenis';

const fail = (m) => { const e = document.getElementById('err'); e.style.display = 'grid'; e.textContent = 'decohere() boot error:\n' + m; console.error(m); };

/* ---------- content ---------- */
async function loadContent() {
  const r = await fetch('content/decohere.md', { cache: 'no-cache' });
  if (!r.ok) throw new Error('content/decohere.md ' + r.status + ' — serve over http (niet file://)');
  return parseMD(await r.text());
}
function parseMD(txt) {
  const lines = txt.split(/\r?\n/); const beats = []; let footer = null, cur = null, field = null;
  const beatRe = /^<!--\s*beat:\s*([\w]+)\s*\|\s*tag:\s*(.*?)\s*-->/;
  for (const line of lines) {
    let m = line.match(beatRe);
    if (m) { cur = { id: m[1], tag: m[2], date: '', sig: '', doc: [] }; beats.push(cur); field = null; continue; }
    if (/^<!--\s*footer\s*-->/.test(line)) { cur = { id: 'footer', tag: '', date: '', sig: '', doc: [] }; footer = cur; field = null; continue; }
    if (/^<!--/.test(line)) continue;
    if (line.trim() === '::sig') { field = 'sig'; continue; }
    if (line.trim() === '::doc') { field = 'doc'; continue; }
    if (line.trim() === '::date') { field = 'date'; continue; }
    if (!cur || !field) continue;
    if (field === 'sig') { if (line.trim()) cur.sig += (cur.sig ? '\n' : '') + line.trim(); }
    else if (field === 'date') { if (line.trim()) cur.date = line.trim(); }
    else cur.doc.push(line);
  }
  for (const b of [...beats, footer].filter(Boolean)) {
    while (b.doc.length && !b.doc[0].trim()) b.doc.shift();
    while (b.doc.length && !b.doc[b.doc.length - 1].trim()) b.doc.pop();
  }
  return { beats, footer };
}
let uptimeEl = null;
// escape, then add <wbr> break opportunities after . : _ ( so long sigs wrap at logical points (not mid-word) on narrow screens
const wbrify = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/([.:_(])/g, '$1<wbr>');
function buildDOM({ beats, footer }) {
  const root = document.getElementById('beats');
  beats.forEach((b) => {
    const sec = document.createElement('section'); sec.className = 'beat'; sec.id = 'beat-' + b.id;
    const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = b.tag; sec.appendChild(tag);
    const sig = document.createElement('h2'); sig.className = 'sig'; sig.innerHTML = wbrify(b.sig); sec.appendChild(sig);
    const doc = document.createElement('div'); doc.className = 'doc';
    b.doc.forEach(l => {
      const d = document.createElement('div'); d.className = 'line';
      if (l.trim().startsWith('@')) d.classList.add('val');
      if (b.id === 'kernel_panic') d.classList.add('crit');
      if (l.includes('{{uptime}}')) { uptimeEl = d; d._tpl = l; d.textContent = l.replace('{{uptime}}', '0000d 00h 00m'); }
      else d.textContent = l;
      doc.appendChild(d);
    });
    sec.appendChild(doc); root.appendChild(sec);
  });
  if (footer) {
    const f = document.getElementById('foot');
    footer.doc.forEach(l => {
      const d = document.createElement('div');
      if (/Vincability|OnlyVince|vandenbraken/i.test(l)) {
        d.innerHTML = l.replace('Vincability', '<a href="https://vincability.com" target="_blank" rel="noopener">Vincability</a>')
          .replace('OnlyVince.net', '<a href="https://onlyvince.net" target="_blank" rel="noopener">OnlyVince.net</a>')
          .replace('vincent.vandenbraken.com', '<a href="https://vincent.vandenbraken.com" target="_blank" rel="noopener">vincent.vandenbraken.com</a>');
      } else { d.className = 'sign'; d.textContent = l; }
      f.appendChild(d);
    });
  }
  return beats.length;
}

/* ---------- helpers ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function inSphere(r) { let x, y, z, d; do { x = rand(-1, 1); y = rand(-1, 1); z = rand(-1, 1); d = x * x + y * y + z * z; } while (d > 1 || d < 1e-4); return [x * r, y * r, z * r]; }
function hexPt(R) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()), seg = (a % (Math.PI / 3)) - Math.PI / 6, rad = R * (Math.cos(Math.PI / 6) / Math.cos(seg)) * rr; return [Math.cos(a) * rad, Math.sin(a) * rad]; }
function hexInside(x, y, R) { const a = Math.atan2(y, x), seg = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6, rad = R * (Math.cos(Math.PI / 6) / Math.cos(seg)); return Math.hypot(x, y) <= rad; }
function hexLatticeTarget(N, R, off) { const pts = [], s = 5.4; for (let z = -2; z <= 2; z++) for (let gx = -9; gx <= 9; gx++) for (let gy = -9; gy <= 9; gy++) { const x = gx * s + (gy % 2) * s * 0.5, y = gy * s * 0.9; if (hexInside(x, y, R)) pts.push([x, y, z * 6]); } const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = pts[i % pts.length]; a[i * 3] = p[0] + off; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; } return a; }
function fmtUptime(s) { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return `${String(d).padStart(4, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`; }
// beat ::date -> ms timestamp. Takes the FIRST date token (range start); ranges/year-only allowed. null if none.
function parseDate(s) { if (!s) return null; const m = s.match(/(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/); return m ? Date.UTC(+m[1], m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1) : null; }
function heart(a) { const s = 2.1; const x = 16 * Math.pow(Math.sin(a), 3); const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [x * s, y * s + 6, 0]; }
const gauss = (p, mu, sd) => Math.exp(-Math.pow((p - mu) / sd, 2));
function ecg(p) { return 0.12 * gauss(p, 0.32, 0.035) - 0.18 * gauss(p, 0.47, 0.012) + 1.0 * gauss(p, 0.5, 0.012) - 0.28 * gauss(p, 0.54, 0.014) + 0.22 * gauss(p, 0.68, 0.045); }
// hydrogen |psi_{4,3,0}|^2 sampled as points (the 4f orbital, m=0). R_{4,3} ∝ r^3 e^{-r/4}, Y_3^0 ∝ P3(cosθ).
// point density ∝ |psi|^2 dV = r^8 e^{-r/2} * P3(cosθ)^2  -> radius ~ Gamma(9, scale 2); polar by rejection on P3^2; symmetry axis = screen Y
function hydrogen430() {
  let s = 0; for (let j = 0; j < 9; j++) s += -Math.log(1 - Math.random());   // Gamma(9, 1)
  const r = s * 2.2;                                                          // a0 -> scene units (mean radius ~20)
  let u = 1; for (let tr = 0; tr < 48; tr++) { u = Math.random() * 2 - 1; const p = 0.5 * (5 * u * u * u - 3 * u); if (Math.random() < Math.pow(p * p, 0.6)) break; }   // u = cosθ weighted by P3(cosθ)^2 (gamma 0.6 so all 4 lobes read, like the density plots)
  const st = Math.sqrt(Math.max(0, 1 - u * u)), ph = Math.random() * Math.PI * 2;
  return [r * st * Math.cos(ph), r * u, r * st * Math.sin(ph)];   // axis vertical -> the stacked lobes face the camera
}

// sample N points from an image's dark/opaque pixels (the drawn lines) -> world-space silhouette (aspect kept). Promise.
// sample N points from an image's dark/opaque pixels -> world space. Maps with a SHARED frame (refW + x0/y0 left/bottom anchor)
// so two drawings of the same scene (e.g. -4 with the partner, -3 without) overlay exactly on their common figures.
function sampleImagePoints(url, N, opts = {}) {
  const { scale = 92, bThresh = 165, refW = null, x0 = -scale / 2, y0 = 0 } = opts;
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
      c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      let data; try { data = x.getImageData(0, 0, W, H).data; } catch (e) { return rej(e); }
      const wpp = scale / (refW || W);   // world units per pixel — SHARED across drawings so absolute pixel cols line up
      const out = new Float32Array(N * 3); let n = 0, guard = 0, cap = N * 600;
      while (n < N && guard < cap) { guard++;
        const px = (Math.random() * W) | 0, py = (Math.random() * H) | 0, q = (py * W + px) * 4;
        if (data[q + 3] < 40) continue;                                   // skip transparent
        if ((data[q] + data[q + 1] + data[q + 2]) / 3 > bThresh) continue; // keep the darker drawn lines, drop light/white bg
        out[n * 3] = px * wpp + x0; out[n * 3 + 1] = (H - py) * wpp + y0; out[n * 3 + 2] = rand(-3, 3); n++;   // left anchor at x0, feet (bottom) anchored at y0
      }
      if (n === 0) return rej(new Error('no sampled points (threshold?)'));
      for (let i = n; i < N; i++) { const j = (Math.random() * n) | 0; out[i * 3] = out[j * 3]; out[i * 3 + 1] = out[j * 3 + 1]; out[i * 3 + 2] = rand(-3, 3); }  // pad if sparse
      res(out);
    };
    img.onerror = () => rej(new Error('img load ' + url)); img.src = url;
  });
}

/* sprite shapes */
function makeSprite(kind) {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
  x.translate(s / 2, s / 2); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineCap = 'round';
  const R = 24;
  if (kind === 'hex') { x.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, px = Math.cos(a) * R, py = Math.sin(a) * R; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fill(); }
  else if (kind === 'spikehex') { x.beginPath(); for (let i = 0; i < 12; i++) { const a = Math.PI / 6 + i * Math.PI / 6, rr = (i % 2 === 0) ? R : R * 0.4, px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fill(); }   // 6 sharp spikes at the hexagon vertices, valleys caving in
  else if (kind === 'circle') { x.beginPath(); x.arc(0, 0, R * 0.92, 0, 7); x.fill(); }
  else if (kind === 'square') { x.fillRect(-R * 0.78, -R * 0.78, R * 1.56, R * 1.56); }
  else if (kind === 'heart') { x.beginPath(); x.moveTo(0, R * 0.66); x.bezierCurveTo(R * 1.12, -R * 0.18, R * 0.5, -R * 0.96, 0, -R * 0.22); x.bezierCurveTo(-R * 0.5, -R * 0.96, -R * 1.12, -R * 0.18, 0, R * 0.66); x.fill(); }
  else if (kind === 'snow') { for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -R); x.moveTo(0, -R * 0.55); x.lineTo(R * 0.3, -R * 0.82); x.moveTo(0, -R * 0.55); x.lineTo(-R * 0.3, -R * 0.82); x.stroke(); x.restore(); } }
  else if (kind === 'stripe') { x.fillRect(-R, -R * 0.16, R * 2, R * 0.32); }
  else { x.beginPath(); x.arc(0, 0, R * 0.5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

/* cloud (Vincent) per-beat target shapes */
const R = 55;
function makeTargets(N, ids) {
  const T = {};
  const fill = (fn) => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = fn(i); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; } return a; };
  const gens = {
    start: () => [rand(-2, 2), rand(-2, 2), rand(-2, 2)],   // seed point (hidden); cloud grows from here into boot
    boot: () => hydrogen430(),   // |psi_{4,3,0}|^2 hydrogen orbital — the unmeasured electron cloud decohering into a state
    syntax_error: () => {                                   // grey HOUSE silhouette: forms first, then the forbidden sign grows over it, then morphs to street
      for (let tr = 0; tr < 6; tr++) {
        if (Math.random() < 0.30) { const s = Math.sqrt(Math.random()), v = Math.random(), r1 = 1 - s, r2 = s * (1 - v), r3 = s * v; return [-30 * r2 + 30 * r3, 40 * r1 + 8 * r2 + 8 * r3, rand(-5, 5)]; }   // roof triangle: apex(0,40) base(-30,8)/(30,8)
        const x = rand(-24, 24), y = rand(-34, 8); if (Math.abs(x) < 6 && y < -12) continue;   // body box, carve a door gap
        return [x, y, rand(-5, 5)];
      }
      return [rand(-24, 24), rand(-34, 8), rand(-5, 5)];
    },
    core_dump: (i) => { const r = i % 100;
      if (r < 24) return [rand(-62, 62), -42 + rand(-1.2, 1.2), rand(-12, 12)];          // ground
      if (r < 33) return [-30 + rand(-1.6, 1.6), rand(-42, -6), rand(-4, 4)];             // tree trunk
      if (r < 46) { const a = Math.random() * 7, rr = Math.random() * 13; return [-30 + Math.cos(a) * rr, 6 + Math.sin(a) * rr, rand(-4, 4)]; } // canopy
      if (r < 70) { const bx = rand(2, 30), seat = Math.random() < 0.55 ? -28 : (Math.random() < 0.5 ? -22 : -34); return [bx, seat + rand(-1, 1), rand(-3, 3)]; } // bench
      if (r < 84) return [42 + rand(-4, 4), rand(-40, -25), rand(-3, 3)];                 // bin
      return [-52 + rand(-1, 1), rand(-40, 26), rand(-2, 2)];                              // lamp post
    },
    bootstrap: () => [rand(-26, 26), rand(-26, 26), rand(-26, 26)],   // shapely solid cube (no grid pattern)
    daemon: (i) => { const c = 16, x = i % c, y = Math.floor(i / c) % c, z = Math.floor(i / (c * c)) % c; return [(x - c / 2) * 6, (y - c / 2) * 6, (z - c / 2) * 6]; },
    attach: () => { const p = hexPt(34); return [p[0] - 8, p[1], rand(-6, 6)]; },          // Vincent hexagon, overlaps heart
    spawn_smurf: () => { const p = hexPt(34); return [p[0] - 8, p[1], rand(-6, 6)]; },
    spawn_boefje: () => { const p = hexPt(34); return [p[0] - 8, p[1], rand(-6, 6)]; },
    neurotype_export: (i) => { const cl = i % 4, cx = [[-30, 18, 0], [30, 18, 0], [-30, -18, 0], [30, -18, 0]][cl]; if (i % 9 === 0) return inSphere(10); const p = inSphere(14); return [p[0] + cx[0], p[1] + cx[1], p[2] + cx[2]]; },
    kernel_panic: () => inSphere(R * 1.1),
    restart: (i) => {                                                                 // hexagon SOURCE at far left, helix growing OUT of its centre to the right around the heartbeats
      const u = i / N;
      if (u < 0.66) return [-74, 0, 0];                                               // orbital source — overwritten in main()
      const top = (i % 2 === 0) ? 1 : -1, dir = top > 0 ? -1 : 1, v = (u - 0.66) / 0.34, ang = v * Math.PI * 14 * dir;
      const radBase = smoothstep(0, 0.04, v) * (11 + 12 * v);   // wider first loop (flows from the lobe), grows toward the end
      const gap = lerp(3, -16, smoothstep(0.96, 1.0, v));       // axes spread with the radius so the strands stay JUST clear of the centre; they cross only at the very end (past the heartbeats)
      const ay = top * lerp(24, radBase + gap, smoothstep(0.05, 0.4, v));   // springs from the lobe, then holds the gap
      return [-74 + v * 156, ay + Math.sin(ang) * radBase, Math.cos(ang) * radBase];   // reaches further right so the last loops stay open
    },
  };
  ids.forEach(id => { T[id] = fill(gens[id] || gens.boot); });
  // the gen filled T.daemon with a CUBE lattice; keep it as the internal source for both the hexagon nest and the bootstrap cube
  const cubeLat = T.daemon;
  // hexagon nest derived from the cube lattice -> per-particle correlated, so cube(03) -> hexagon(04) is a clean reshape (the solid cube folds into the nest)
  const HCELL = 4.6, hexLat = new Float32Array(N * 3), hexLoose = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x = cubeLat[i * 3] * 0.72, y = cubeLat[i * 3 + 1] * 0.72;
    if (!hexInside(x, y, 34)) { const a = Math.atan2(y, x), seg = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6, rad = 34 * (Math.cos(Math.PI / 6) / Math.cos(seg)); x = Math.cos(a) * rad; y = Math.sin(a) * rad; }
    const z = cubeLat[i * 3 + 2] * 0.22;
    hexLoose[i * 3] = x - 8; hexLoose[i * 3 + 1] = y; hexLoose[i * 3 + 2] = z;   // pre-snap: the smooth, fuzzy hex DISK (no cells yet) — runtime crystallisation front lerps loose -> snapped
    // honeycomb: snap toward the nearest hex-grid cell centre so the nest reads as CELLS, not a fuzzy disk
    const gy = Math.round(y / (HCELL * 1.5)), ox = (gy & 1) ? HCELL * Math.sqrt(3) / 2 : 0, gx = Math.round((x - ox) / (HCELL * Math.sqrt(3)));
    const cxC = gx * HCELL * Math.sqrt(3) + ox, cyC = gy * HCELL * 1.5;
    x = lerp(x, cxC, 0.66); y = lerp(y, cyC, 0.66);   // pull hard toward the cell centre -> clear honeycomb cells at every hexagon beat (not just the bright daemon)
    hexLat[i * 3] = x - 8; hexLat[i * 3 + 1] = y; hexLat[i * 3 + 2] = z;   // fairly flat honeycomb disk (deep layers fanned out under rotation)
  }
  T._hexLoose = hexLoose;   // exposed for the daemon crystallisation-front animation (not a beat target; never morphed)
  T.daemon = hexLat;   // 04 is the hexagon nest straight away (not another cube)
  T.attach = hexLat; T.spawn_smurf = hexLat; T.spawn_boefje = hexLat;
  // neurotype: keep the hexagon, push 3 wedges forward (brighter via proximity to camera)
  const neuro = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const x = hexLat[i * 3], y = hexLat[i * 3 + 1], ang = Math.atan2(y, x + 8), r = Math.hypot(x + 8, y);
    const wedge = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 6) % 6, fwd = (wedge === 0 || wedge === 2 || wedge === 4) && r > 14;
    neuro[i * 3] = x; neuro[i * 3 + 1] = y; neuro[i * 3 + 2] = fwd ? 32 : hexLat[i * 3 + 2];
  }
  T.neurotype_export = neuro;
  // kernel_panic: the hexagon (lobes flattened) drifts LEFT toward where the hydrogen 'pure me' will be, then morphs into it
  const panicHex = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { panicHex[i * 3] = hexLat[i * 3] - 34; panicHex[i * 3 + 1] = hexLat[i * 3 + 1]; panicHex[i * 3 + 2] = hexLat[i * 3 + 2] * 0.6; }
  T.kernel_panic = panicHex;
  // bootstrap derived from the daemon lattice: a smaller, jittered (less-defined) cube. Each particle keeps its own lattice node,
  // so bootstrap->daemon is a pure grow + sharpen (pattern crystallises) instead of a full reshuffle/mix.
  const bs = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    bs[i * 3] = cubeLat[i * 3] * 0.5 + rand(-4.5, 4.5);
    bs[i * 3 + 1] = cubeLat[i * 3 + 1] * 0.5 + rand(-4.5, 4.5);
    bs[i * 3 + 2] = cubeLat[i * 3 + 2] * 0.5 + rand(-4.5, 4.5);
  }
  T.bootstrap = bs;
  T.start = new Float32Array(T.boot);   // start = the orbital already at full shape (invisible). It FORMS by gaining opacity + infall density, not by scaling up.
  // restart hexagon source = the REAL Vincent hexagon (hexLat), recentred + scaled + moved far left, so it matches the earlier (green) hexagon exactly
  // restart source (hydrogen orbital) + colours are set in main(), where the orbital positions + bootCol colour map are available
  return T;
}

const VINCENT_TINT = { boot: 0xe67e22, syntax_error: 0x9a9aa2, core_dump: 0x9a9aa2, bootstrap: 0xe67e22, daemon: 0x35e06a, attach: 0x0d331a, spawn_smurf: 0x0d331a, spawn_boefje: 0x0d331a, neurotype_export: 0x0d331a, kernel_panic: 0xff3b3b, restart: 0xe67e22 };   // hexagon beats = dark green base (like neurotype); daemon CUBE stays bright
const BEAT_BG = { boot: 0x070708, syntax_error: 0x08070a, core_dump: 0x070a0d, bootstrap: 0x0a0708, daemon: 0x08090c, attach: 0x0a080e, spawn_smurf: 0x0b0809, spawn_boefje: 0x0a0a0c, neurotype_export: 0x0d0a0e, kernel_panic: 0x020203, restart: 0x140d06 };   // restart = warm dawn dark (sunrise glow added on top)

(async function main() {
  try {
    const content = await loadContent();
    const nBeats = buildDOM(content);
    const ids = content.beats.map(b => b.id);
    const idx = {}; ids.forEach((id, i) => idx[id] = i);
    // simulation-time: one timestamp per beat (from ::date), gap-filled + forced non-decreasing so the sim clock never runs backward while scrolling down
    const birthMs = Date.UTC(1980, 1, 18);
    const beatTimes = content.beats.map(b => parseDate(b.date));
    for (let i = 0; i < beatTimes.length; i++) {
      if (beatTimes[i] == null) beatTimes[i] = i > 0 ? beatTimes[i - 1] : birthMs;
      if (i > 0 && beatTimes[i] < beatTimes[i - 1]) beatTimes[i] = beatTimes[i - 1];
    }
    const A = idx.attach, P = idx.kernel_panic, Sm = idx.spawn_smurf, Bo = idx.spawn_boefje, Ne = idx.neurotype_export, Re = idx.restart, Bs = idx.bootstrap;
    const isMobile = window.innerWidth < 768;
    const N = isMobile ? 4000 : 13000, NL = isMobile ? 1150 : 2600, NK = isMobile ? 280 : 560;

    const canvas = document.getElementById('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(BEAT_BG.boot);
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000); camera.position.set(0, 0, 130);
    // keep the WIDE scenes (orbital at x=-74, helixes to +82) on screen in portrait: pull the camera back so the horizontal extent fits. Desktop (aspect > ~1.15) stays at z=130.
    const fitCam = () => { const asp = innerWidth / innerHeight; camera.aspect = asp; camera.position.z = Math.max(130, 149 / asp); camera.updateProjectionMatrix(); };
    fitCam();

    const texHex = makeSprite('hex'), texSpike = makeSprite('spikehex'), texCircle = makeSprite('circle'), texSquare = makeSprite('square'), texHeart = makeSprite('heart'), texSnow = makeSprite('snow'), texStripe = makeSprite('stripe'), texDot = makeSprite('dot');

    /* Vincent cloud (hexagons) */
    const targets = makeTargets(N, ids);
    const superpos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const p = inSphere(R * (0.7 + Math.random() * 0.6)); superpos[i * 3] = p[0]; superpos[i * 3 + 1] = p[1]; superpos[i * 3 + 2] = p[2]; }
    const live = new Float32Array(superpos);
    const GREY = new THREE.Color(0x8a8a92);
    const introPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { introPos[i * 3] = rand(-140, 140); introPos[i * 3 + 1] = rand(-82, 82); introPos[i * 3 + 2] = rand(-40, 40); }
    const cgeo = new THREE.BufferGeometry(); cgeo.setAttribute('position', new THREE.BufferAttribute(live, 3));
    const cmat = new THREE.PointsMaterial({ map: texSpike, color: VINCENT_TINT.boot, size: isMobile ? 1.7 : 1.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, alphaTest: 0.02, sizeAttenuation: true });
    const cloud = new THREE.Points(cgeo, cmat); scene.add(cloud);
    // per-particle brightness (vertex colour multiplies cmat tint) — used to light ONLY the neurotype lobes
    const cCol = new Float32Array(N * 3).fill(1);
    cgeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3)); cmat.vertexColors = true;
    let neuroDimmed = false;
    // forward-lobe flag: which hexagon particles belong to the 3 pushed-forward wedges (same rule as the neuro target)
    const isFwd = new Uint8Array(N);
    { const hx = targets.spawn_smurf; for (let i = 0; i < N; i++) { const X = hx[i * 3], Y = hx[i * 3 + 1], ang = Math.atan2(Y, X + 8), rr = Math.hypot(X + 8, Y), wedge = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 6) % 6; isFwd[i] = ((wedge === 0 || wedge === 2 || wedge === 4) && rr > 14) ? 1 : 0; } }
    // neurotype highlight: a jigsaw puzzle-piece shape lit up INSIDE the flat hexagon. Reversible: set neuroPuzzle=false to go back to the 3 forward lobes.
    const neuroPuzzle = false;   // false = 3 highlighted lobes (orange on green); true = jigsaw puzzle piece
    const isPuzzle = new Uint8Array(N);
    { const hx = targets.spawn_smurf, S = 18, R2 = 10 * 10; for (let i = 0; i < N; i++) {
        const lx = hx[i * 3] + 8, ly = hx[i * 3 + 1];
        const inSq = Math.abs(lx) <= S && Math.abs(ly) <= S;
        const rightTab = lx > S && ((lx - S) * (lx - S) + ly * ly < R2);          // tab pokes out right
        const bottomTab = ly < -S && (lx * lx + (ly + S) * (ly + S) < R2);        // tab pokes out bottom
        const topBlank = lx * lx + (ly - S) * (ly - S) < R2;                      // notch cut from top
        const leftBlank = (lx + S) * (lx + S) + ly * ly < R2;                     // notch cut from left
        isPuzzle[i] = ((inSq && !topBlank && !leftBlank) || rightTab || bottomTab) ? 1 : 0;
      } }
    if (neuroPuzzle) targets.neurotype_export = targets.spawn_smurf;   // puzzle mode = flat hexagon; lobe mode keeps the forward z-push target so the lit lobes come TOWARD the camera
    const neuroMask = neuroPuzzle ? isPuzzle : isFwd;
    // per-particle hashes for the kernel-panic shatter (so points break up individually, not as connected bands)
    const hash = new Float32Array(N), hash2 = new Float32Array(N);
    for (let i = 0; i < N; i++) { hash[i] = Math.random(); hash2[i] = Math.random(); }
    // staggered core_dump -> bootstrap: each particle converts at its own time, so the street and the forming cube OVERLAP
    // (cube assembles from the centre outward + jitter, while the rest of the street is still visible)
    const cdOff = new Float32Array(N);
    { const bs = targets.bootstrap; for (let i = 0; i < N; i++) { const d = Math.hypot(bs[i * 3], bs[i * 3 + 1], bs[i * 3 + 2]); cdOff[i] = (0.6 * clamp01(d / 42) + 0.4 * Math.random()) * 0.58; } }
    const CDW = 0.4;   // per-particle conversion window
    // tetromino rebuild: street gathers into 6 INTERLOCKING T/L pieces; the 7th (centre) is the PURPLE anomaly, made from the forbidden rain. Together they tile a filled square that then diffuses into the cube.
    const BLOCK_CELLS = [
      [[0, 0], [1, 0], [2, 0], [1, 1]],   // T  (pinwheel)
      [[3, 0], [2, 1], [3, 1], [3, 2]],   // T  (pinwheel)   <- PURPLE (filled by the rain)
      [[2, 2], [1, 3], [2, 3], [3, 3]],   // T  (pinwheel)
      [[0, 1], [0, 2], [1, 2], [0, 3]],   // T  (pinwheel)
      [[4, 0], [5, 0], [6, 0], [5, 1]],   // T
      [[4, 1], [4, 2], [5, 2], [4, 3]],   // L
      [[6, 1], [6, 2], [5, 3], [6, 3]],   // L  (interlocks with the one above)
    ];   // 7 interlocking pieces tile a 7x4 board EXACTLY -> a real filled square (tall cells make it square overall)
    const NTB = BLOCK_CELLS.length, PURPLE_PIECE = 1, CW = 6.6, CH = 13.2;
    // random fall order for the 7 pieces so they drop ONE BY ONE in a shuffled order (not left->right, which the spatial piece-index would give)
    const pieceOrder = [...Array(NTB).keys()];
    for (let i = NTB - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const tmp = pieceOrder[i]; pieceOrder[i] = pieceOrder[j]; pieceOrder[j] = tmp; }
    const cellWorld = (col, row) => [(col - 3) * CW, (row - 1.5) * CH];
    const CELL_PIECE = {}; BLOCK_CELLS.forEach((cells, pi) => cells.forEach(c => CELL_PIECE[c[0] + ',' + c[1]] = pi));   // (col,row) -> piece
    // square = the bootstrap cube PROJECTED flat onto the 7x4 board: each particle keeps its bootstrap x,y region, so square<->cube is just depth (no scatter) AND bootstrap stays daemon-correlated (03->04 grows into the lattice)
    const tBlock = new Uint8Array(N), tetSquare = new Float32Array(N * 3), Bp = targets.bootstrap;
    for (let i = 0; i < N; i++) {
      const col = Math.min(6, Math.max(0, ((Bp[i * 3] + 24) / 48 * 7) | 0)), row = Math.min(3, Math.max(0, ((Bp[i * 3 + 1] + 24) / 48 * 4) | 0));
      tBlock[i] = CELL_PIECE[col + ',' + row];
      const w = cellWorld(col, row);
      tetSquare[i * 3] = w[0] + rand(-CW * 0.46, CW * 0.46);
      tetSquare[i * 3 + 1] = w[1] + rand(-CH * 0.46, CH * 0.46);
      tetSquare[i * 3 + 2] = rand(-1.5, 1.5);
    }
    // the BUILD beat IS the purple hexagon (no in-between cube): the tetris completes into a flat square, which then SWEEPS straight into the hexagon. So bootstrap target = the hexagon itself; the tetris->hexagon sweep happens during core_dump->bootstrap (see cdStagger). (col/row map above already used the original cube positions.)
    targets.bootstrap.set(targets.daemon);
    // boot orbital colour map like the hydrogen density plot: orange/yellow in the dense lobe cores -> purple at the thin fringes
    const WHITE = new THREE.Color(1, 1, 1);
    const bootCol = new Float32Array(N * 3);
    { const B = targets.boot, cLo = new THREE.Color(0x6a2cc9), cMid = new THREE.Color(0xe67e22), cHi = new THREE.Color(0xffd25e), tc = new THREE.Color();
      for (let i = 0; i < N; i++) {
        const x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2], r = Math.hypot(x, y, z) || 1, u = y / r;
        const P3 = 0.5 * (5 * u * u * u - 3 * u), gr = Math.exp(-Math.pow((r - 16) / 12, 2));   // angular lobe strength * radial shell = local density proxy
        const tt = smoothstep(0.03, 0.5, clamp01(gr * P3 * P3));
        if (tt < 0.5) tc.copy(cLo).lerp(cMid, tt / 0.5); else tc.copy(cMid).lerp(cHi, (tt - 0.5) / 0.5);
        bootCol[i * 3] = tc.r; bootCol[i * 3 + 1] = tc.g; bootCol[i * 3 + 2] = tc.b;
      }
    }
    // restart: the WHOLE cloud becomes the hydrogen orbital ('pure me'), 1:1 with the boot orbital -> the hexagon->hydrogen morph is clean (everything goes left, nothing splits off). The helix is a SEPARATE fed stream (helixP below).
    const restCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const s = i * 3, k = i * 3;
      targets.restart[k] = -74 + targets.boot[s]; targets.restart[k + 1] = targets.boot[s + 1]; targets.restart[k + 2] = targets.boot[s + 2];   // exact boot orbital shape, shifted to the left ('pure me')
      const ry = targets.restart[k + 1];
      let nb = Math.exp(-Math.pow((Math.abs(ry) - 16) / 9, 2)) * 0.7;   // purple emphasis at the heartbeat heights (~+-16)
      nb *= clamp01(1 - bootCol[s + 1] * 1.3);   // ...only on the already-dim regions, so the bright yellow lobes run uncut to the middle
      restCol[k] = bootCol[s] + (0.416 - bootCol[s]) * nb; restCol[k + 1] = bootCol[s + 1] + (0.173 - bootCol[s + 1]) * nb; restCol[k + 2] = bootCol[s + 2] + (0.788 - bootCol[s + 2]) * nb;
      // keep the YELLOW lobes prominent — they were getting lost under the purple + the restart dimming. Boost where it's yellow, and stretch the yellow band a bit higher up the lobes.
      const yel = smoothstep(0.42, 0.78, bootCol[s + 1]) * (1 - nb);
      restCol[k] += yel * 0.45; restCol[k + 1] += yel * 0.4; restCol[k + 2] *= (1 - yel * 0.55);
    }
    // indices of the PURPLE hydrogen particles (the heartbeat-height purple bands) — the partner merges ONTO these exact positions so it becomes part of the hydrogen, not a separate blob
    const purpIdx = []; for (let i = 0; i < N; i++) if (restCol[i * 3 + 2] > 0.55 && restCol[i * 3 + 1] < 0.5) purpIdx.push(i);
    // per-particle activation time so the cloud forms unevenly: a few points snap bright first, then more fill in
    const formOff = new Float32Array(N); for (let i = 0; i < N; i++) formOff[i] = Math.pow(Math.random(), 1.6) * 0.62;
    const FW = 0.32;   // per-particle activation window

    /* entity factory */
    function ent(n, tex, color, size, blend = THREE.AdditiveBlending) {
      const pos = new Float32Array(n * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ map: tex, color, size, transparent: true, opacity: 0, blending: blend, depthWrite: false, alphaTest: 0.02, sizeAttenuation: true });
      const p = new THREE.Points(g, m); scene.add(p); return { p, pos, m, g, n };
    }
    const COL = { vincent: 0xe67e22, leydi: 0xff7ac1, leydiCold: 0xbfe9ff, jose: 0xff5147, ben: 0x2e7bff };
    const cPink = new THREE.Color(COL.leydi), cCold = new THREE.Color(COL.leydiCold);
    const leydi = ent(NL, texHeart, COL.leydi, isMobile ? 2.4 : 2.2);
    const jose = ent(NK, texCircle, COL.jose, isMobile ? 3.0 : 2.8);
    const ben = ent(NK, texSquare, COL.ben, isMobile ? 3.0 : 2.8);
    // continual slow influx: grey 'static' particles falling into the child (boot)
    const NIF = isMobile ? 400 : 760;
    const infall = ent(NIF, texDot, 0xccccd4, isMobile ? 3.6 : 4.2);
    const ifCol = new Float32Array(NIF * 3);   // per-dot colour: grey while roaming -> Vincent orange as it falls into the cloud
    infall.g.setAttribute('color', new THREE.BufferAttribute(ifCol, 3));
    infall.m.vertexColors = true; infall.m.color.setHex(0xffffff); infall.m.needsUpdate = true;
    const IF_GREY = [0.80, 0.80, 0.83];   // roaming colour; near the cloud each dot takes the scene/orbital colour (set per frame)
    const PCL = [0.416, 0.173, 0.788], PCM = [0.902, 0.494, 0.133], PCH = [1.0, 0.824, 0.369];   // orbital colormap stops: purple -> orange -> yellow (matches the cloud)
    const ifx = new Float32Array(NIF), ify = new Float32Array(NIF), ifz = new Float32Array(NIF), ifS = new Float32Array(NIF), ifT = new Int32Array(NIF);
    const ifhx = new Float32Array(NIF), ifhy = new Float32Array(NIF), ifhz = new Float32Array(NIF);   // roaming 'home' field
    const ifSpawn = (i) => { const a = rand(0, Math.PI * 2), r = rand(120, 185); ifx[i] = Math.cos(a) * r; ify[i] = Math.sin(a) * r * 0.8; ifz[i] = rand(-45, 45); ifT[i] = (Math.random() * N) | 0; ifS[i] = rand(0.3, 0.8); };
    for (let i = 0; i < NIF; i++) { ifhx[i] = rand(-150, 150); ifhy[i] = rand(-85, 85); ifhz[i] = rand(-45, 45); ifSpawn(i); ifx[i] = ifhx[i]; ify[i] = ifhy[i]; ifz[i] = ifhz[i]; }
    const upEl = document.getElementById('uptime');
    const simEl = document.getElementById('simtime');
    const COMPILE = ['$ make decohere --clean --no-cache', '[ 0%] gathering /dev/street …', '[18%] cc self.core.c', '[39%] cc trauma.o (warnings: 47)', '[61%] ld resilience.a', '[78%] strip debug symbols', '[92%] WARN: no toolchain — shipping untested', '[100%] build OK -> ./decohere'];
    const compileEl = document.getElementById('compile');
    // persistent console: one stdout line per beat (bootstrap shows the full build log instead)
    const LOG = {
      start: 'decohere: awaiting measurement …',
      boot: 'decohere: collapse |ψ⟩ -> state · output_buffer: direct',
      syntax_error: 'parser: grammar not found · input flagged "difficult"',
      core_dump: 'SIGSEGV: home not found · core dumped to /dev/street',
      bootstrap: 'make: rebuilding from source · no toolchain',
      daemon: 'daemon[1]: running · carries household · since boot',
      attach: 'net: partner bound on shared interface · firewall extended',
      spawn_smurf: "fork() -> child 'smurf' · pid red · firewall extended",
      spawn_boefje: "fork() -> child 'boefje' · pid blue · firewall extended",
      neurotype_export: 'deobfuscate: neurotype decoded · softie.core = true',
      kernel_panic: 'kernel_panic: shared memory violation · repair_loop -> overflow',
      restart: 'main(resilience:true): online · resynced with children · exit 0 ♥',
    };
    const logLines = ids.map((id) => { const d = document.createElement('div'); d.className = 'logline'; d.textContent = LOG[id] || ''; compileEl.appendChild(d); return d; });   // one persistent line per beat — the whole process log, always visible
    const SIM_MO = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    // faux system monitor (btop-style), top-left. Values are STORY-driven: mem fills as processes (partner + kids) load, load spikes at stress beats.
    const mon = document.getElementById('mon'), mctx = mon && mon.getContext('2d');
    const MONN = 56, cpuH = new Float32Array(MONN).fill(12), memH = new Float32Array(MONN).fill(16); let monLast = -1;
    const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
    const loadColor = (v) => v < 0.5 ? `rgb(${Math.round(84 + v * 2 * 150)},${Math.round(240 - v * 2 * 70)},${Math.round(166 - v * 2 * 120)})` : `rgb(255,${Math.round(180 - (v - 0.5) * 2 * 90)},${Math.round(46 + (v - 0.5) * 2 * 76)})`;   // green -> amber -> red
    const memColor = (v) => `rgb(${Math.round(96 + v * 70)},${Math.round(120 - v * 50)},${Math.round(210 + v * 45)})`;   // cyan-ish -> deep purple
    function drawMon() {
      const W = mon.width, H = mon.height, lblH = 20, gap = 6, gh = (H - lblH * 2 - gap) / 2, bw = W / MONN;
      mctx.clearRect(0, 0, W, H); mctx.font = '15px "Kode Mono", monospace'; mctx.textBaseline = 'alphabetic';
      const graph = (hist, top, label, col) => {
        for (let i = 0; i < MONN; i++) { const v = Math.min(1, hist[i] / 100), bh = Math.max(0.5, v * gh); mctx.fillStyle = col(v); mctx.globalAlpha = 0.35 + 0.65 * (i / MONN); mctx.fillRect(i * bw, top + lblH + gh - bh, bw - 1, bh); }
        mctx.globalAlpha = 1; const cur = hist[MONN - 1];
        mctx.fillStyle = 'rgba(232,232,239,.85)'; mctx.fillText(label, 0, top + 14);
        const s = String(Math.round(cur)).padStart(2, ' ') + '%'; mctx.fillStyle = col(Math.min(1, cur / 100)); mctx.fillText(s, W - mctx.measureText(s).width, top + 14);
      };
      graph(cpuH, 0, 'load', loadColor);
      graph(memH, lblH + gh + gap, 'mem', memColor);
    }
    const woven = []; const lA = new Float32Array(NL), lR = new Float32Array(NL);
    for (let i = 0; i < NL; i++) { woven.push(inSphere(44)); lA[i] = Math.random() * Math.PI * 2; lR[i] = Math.sqrt(Math.random()); }
    // filled heart silhouette via implicit curve (x^2+y^2-1)^3 - x^2 y^3 < 0
    const heartFill = [];
    while (heartFill.length < NL) { const x = rand(-1.4, 1.4), y = rand(-1.3, 1.4); if (Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y < 0) { const keep = lerp(0.4, 1.0, clamp01((x + 1.4) / 2.8)); if (Math.random() < keep) heartFill.push([x * 28, y * 28 + 4]); } }   // density GRADIENT: sparser on the left, denser on the right
    // children originate from ACTUAL points on the heart silhouette (x=14) and the Vincent hexagon-cloud (the real hexLat points, x=-8)
    const hexT = targets.spawn_smurf, nHex = hexT.length / 3;   // the Vincent hexagon cloud shape
    const mkOrigin = (n) => { const s = new Float32Array(n * 3); for (let i = 0; i < n; i++) {
      if (i % 2 === 0) { const h = heartFill[(Math.random() * heartFill.length) | 0]; s[i * 3] = 14 + h[0]; s[i * 3 + 1] = h[1]; s[i * 3 + 2] = rand(-3, 3); }   // peel off the heart
      else { const j = (Math.random() * nHex) | 0; s[i * 3] = hexT[j * 3]; s[i * 3 + 1] = hexT[j * 3 + 1]; s[i * 3 + 2] = hexT[j * 3 + 2]; }                       // peel off the hexagon
    } return s; };
    const jOrigin = mkOrigin(NK), bOrigin = mkOrigin(NK);
    let leydiFrozen = false;

    // forbidden sign (purple ⊘) — grows OVER the grey house during syntax_error, then recedes as house morphs to street
    const NF = isMobile ? 500 : 1000;
    const forbid = ent(NF, texDot, 0xb23bff, isMobile ? 3.0 : 2.6);
    const forbidPos = new Float32Array(NF * 3);
    for (let i = 0; i < NF; i++) {
      let x, y;
      if (i % 5 === 0) { const u = rand(-1, 1); x = u * 22; y = -u * 22; }                            // diagonal slash (the "no")
      else { const a = rand(0, Math.PI * 2), rr = 30 + rand(-1.6, 1.6); x = Math.cos(a) * rr; y = Math.sin(a) * rr; }   // ring
      forbidPos[i * 3] = x; forbidPos[i * 3 + 1] = y + 2; forbidPos[i * 3 + 2] = rand(-3, 3);
    }
    // the forbidden rain later becomes the PURPLE anomaly piece of the tetris square — its final cells
    const forbidSquare = new Float32Array(NF * 3);
    { const cells = BLOCK_CELLS[PURPLE_PIECE]; for (let i = 0; i < NF; i++) { const c = cells[(Math.random() * cells.length) | 0], w = cellWorld(c[0], c[1]); forbidSquare[i * 3] = w[0] + rand(-CW * 0.46, CW * 0.46); forbidSquare[i * 3 + 1] = w[1] + rand(-CH * 0.46, CH * 0.46); forbidSquare[i * 3 + 2] = rand(-1.5, 1.5); } }

    // green hex 'nest' lattice behind the restart orbital — the daemon still ticking behind 'pure me'
    const NB = isMobile ? 700 : 1600;
    const backdrop = ent(NB, texHex, 0x218b42, isMobile ? 2.0 : 1.7);
    { const lat = hexLatticeTarget(NB, 42, -74); for (let i = 0; i < NB; i++) { backdrop.pos[i*3] = lat[i*3]; backdrop.pos[i*3+1] = lat[i*3+1]; backdrop.pos[i*3+2] = lat[i*3+2] - 48; } backdrop.g.attributes.position.needsUpdate = true; }  // hex nest framed around the left orbital, pushed behind it
    const bCol = new Float32Array(NB * 3).fill(1); backdrop.g.setAttribute('color', new THREE.BufferAttribute(bCol, 3)); backdrop.m.vertexColors = true; backdrop.m.color.setHex(0xffffff); backdrop.m.needsUpdate = true;

    // family drawing: streams in after the 2nd child (low in the viewport), holds through neurotype, then at kernel_panic the partner is removed (-4 -> -3) with everyone else staying put
    const NFam = isMobile ? 1200 : 3000;
    const family = ent(NFam, texDot, 0xffffff, isMobile ? 2.8 : 2.5);   // white base; per-particle colour/alpha via fCol so the partner can fade out individually
    const famT = new Float32Array(NFam * 3), famOrigin = new Float32Array(NFam * 3), famOff = new Float32Array(NFam), famGone = new Uint8Array(NFam), famMerge = new Float32Array(NFam * 3);
    const fCol = new Float32Array(NFam * 3); family.g.setAttribute('color', new THREE.BufferAttribute(fCol, 3)); family.m.vertexColors = true; family.m.needsUpdate = true;
    const FAM_PURP = [0.61, 0.36, 1.0];   // 0x9b5cff
    let famReady = false;
    try {
      const FOPT = { scale: 92, refW: 649, x0: -46, y0: -16 };   // shared frame; sits roughly centred (it now emerges from the panic explosion)
      const p4 = await sampleImagePoints('content/vandenbraken-4.png', NFam, FOPT);
      const p3 = await sampleImagePoints('content/vandenbraken-3.png', NFam, FOPT);
      for (let i = 0; i < NFam; i++) { const k = i * 3; famT[k] = p4[k]; famT[k + 1] = p4[k + 1]; famT[k + 2] = p4[k + 2];   // -4 = whole family; everyone stays put
        const ax = p4[k], ay = p4[k + 1]; let bd = Infinity;
        for (let j = 0; j < NFam; j++) { const dx = p3[j * 3] - ax, dy = p3[j * 3 + 1] - ay, d = dx * dx + dy * dy; if (d < bd) bd = d; }   // distance to the NEAREST -3 point
        famGone[i] = bd > 49 ? 1 : 0;   // no -3 point within ~7u => this particle is the partner (the one figure -3 lacks); it just FADES in place at the break (no collapse, no edge pile-up)
        fCol[k] = FAM_PURP[0]; fCol[k + 1] = FAM_PURP[1]; fCol[k + 2] = FAM_PURP[2];
        const oa = rand(0, Math.PI * 2), or = rand(35, 175); famOrigin[k] = 14 + Math.cos(oa) * or; famOrigin[k + 1] = 6 + Math.sin(oa) * or * 0.85; famOrigin[k + 2] = rand(-55, 55);   // burst OUT of the (exploding blue heart at 14,6) -> the family is built from the shattered heart
        famOff[i] = Math.pow(Math.random(), 1.6) * 0.45;
        // the PARTNER (famGone) doesn't just vanish: it MERGES onto the actual PURPLE hydrogen particles (so it becomes part of 'pure me', not a separate blob)
        const ph = purpIdx.length ? purpIdx[(Math.random() * purpIdx.length) | 0] * 3 : k; famMerge[k] = targets.restart[ph] + rand(-2, 2); famMerge[k + 1] = targets.restart[ph + 1] + rand(-2, 2); famMerge[k + 2] = targets.restart[ph + 2] + rand(-2, 2); }
      famReady = true;
    } catch (e) { console.warn('family drawing skipped:', e.message); }

    // helix: a SEPARATE stream FED from the hydrogen — two mirrored spirals the NEW particles trace OUT of the hydrogen, wrapping the heartbeats. (The main cloud is now purely the hydrogen, so the morph stays clean.)
    const NH = isMobile ? 1300 : 3200;
    const helixP = ent(NH, texDot, 0xffffff, isMobile ? 3.4 : 3.0);   // bigger soft dots -> smokier strand
    const hCol = new Float32Array(NH * 3); helixP.g.setAttribute('color', new THREE.BufferAttribute(hCol, 3)); helixP.m.vertexColors = true; helixP.m.color.setHex(0xffffff); helixP.m.needsUpdate = true;
    const hBase = new Float32Array(NH * 3), hTop = new Int8Array(NH), hHj = new Float32Array(NH), hOff = new Float32Array(NH * 3);   // hBase = strand colour; hOff = tube cross-section offset direction (fuzzy tube)
    for (let i = 0; i < NH; i++) {
      hTop[i] = (i % 2 === 0) ? 1 : -1;             // which heartbeat it wraps
      hHj[i] = Math.random();
      const o = inSphere(1); hOff[i * 3] = o[0]; hOff[i * 3 + 1] = o[1]; hOff[i * 3 + 2] = o[2];
      const e = smoothstep(0, 0.3, i / NH);
      if (Math.random() < 0.32 + 0.26 * Math.sin(i * 0.03)) { hBase[i * 3] = 0.416; hBase[i * 3 + 1] = 0.173; hBase[i * 3 + 2] = 0.788; }   // purple bands
      else { hBase[i * 3] = 1.0; hBase[i * 3 + 1] = 0.85 + (0.5 - 0.85) * e; hBase[i * 3 + 2] = 0.4 + (0.14 - 0.4) * e; }                    // yellow -> orange
    }
    // helix HOSE centreline at along-path position v (v=0 at the hydrogen end, v=1 at the far tip) for one strand. COIL radius is FIXED (original 'fine' hose); the TUBE thickness is added per-particle in the loop.
    const helixPos = (v, top) => {
      const dir = top > 0 ? -1 : 1, ang = v * Math.PI * 14 * dir;
      const radBase = smoothstep(0, 0.04, v) * (11 + 12 * v);   // COIL radius (the spiral circle) — fixed, not grown
      const gap = lerp(2, -24, smoothstep(0.62, 1.0, v)), ay = top * lerp(24, radBase + gap, smoothstep(0.05, 0.4, v));   // strands pull together from ~60% along the path -> inner edges (bottom-of-top, top-of-bottom) overlap more, growing toward the tip
      return [-74 + v * 156, ay + Math.sin(ang) * radBase, Math.cos(ang) * radBase];
    };
    let helixFlowT = 0, helixFlowStart = -1;   // flow clock: particles are generated on the LEFT (hydrogen) and flow RIGHT through the hose; starts once the hydrogen scene has STOOD

    // warm SUNRISE behind the final (restart) scene — a SMALL sun: soft halo + a star-burst of godray spikes
    const haloC = document.createElement('canvas'); haloC.width = haloC.height = 128;
    { const g = haloC.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,226,176,0.95)'); grd.addColorStop(0.45, 'rgba(255,180,96,0.32)'); grd.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }
    const starC = document.createElement('canvas'); starC.width = starC.height = 256;
    { const g = starC.getContext('2d'); g.translate(128, 128);
      let grd = g.createRadialGradient(0, 0, 0, 0, 0, 56); grd.addColorStop(0, 'rgba(255,238,200,1)'); grd.addColorStop(0.4, 'rgba(255,196,118,0.55)'); grd.addColorStop(1, 'rgba(255,160,70,0)'); g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 56, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * Math.PI / 3); const sg = g.createLinearGradient(0, 0, 0, -126); sg.addColorStop(0, 'rgba(255,224,170,0.85)'); sg.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = sg; g.beginPath(); g.moveTo(-5, 0); g.lineTo(0, -126); g.lineTo(5, 0); g.closePath(); g.fill(); g.restore(); }   // godray spikes
    }
    const mkSun = (cv, sc) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(sc, sc, 1); scene.add(s); return s; };
    const sunHalo = mkSun(haloC, 120), sunStar = mkSun(starC, 82);   // small sun (460 -> 220/145 -> 160/110 -> smaller still)
    let sunRise = 0;   // time-eased rise progress (so the sun keeps arcing up while you sit at the ending, not just on scroll)

    /* post */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.35); composer.addPass(bloom);
    const rgb = new ShaderPass(RGBShiftShader); rgb.uniforms.amount.value = 0; composer.addPass(rgb);

    /* scroll */
    // chapter weight: scale wheel/touch input down near a chapter centre (virtualScroll is read live; mutating e.delta* before Lenis consumes it = real resistance)
    const scrollWeight = () => {
      if (!centers.length) return { w: 0, dir: 0 };
      const vc = (window.scrollY || pageYOffset || 0) + innerHeight / 2;
      let nd = Infinity, nc = 0; for (let i = 0; i < centers.length; i++) { const dd = vc - centers[i]; if (Math.abs(dd) < Math.abs(nd)) { nd = dd; nc = centers[i]; } }
      const heavy = clamp01(1 - Math.abs(nd) / (innerHeight * 0.62));
      return { w: heavy * heavy, dir: Math.sign(nc - vc) };   // w: 0..1 proximity to nearest centre; dir: which way to scroll to reach it
    };
    const lenis = new Lenis({
      smoothWheel: true, lerp: 0.08,
      virtualScroll: (e) => {
        const { w, dir } = scrollWeight(); if (w < 1e-4) return;
        const approaching = dir === 0 || Math.sign(e.deltaY) === dir;   // scrolling toward the centre = falling in
        const mult = lerp(1, approaching ? 0.12 : 0.5, w);              // heavy IN (anchors the chapter), lighter OUT (releases you)
        e.deltaX *= mult; e.deltaY *= mult;
      }
    }); window.__lenis = lenis;
    lenis.on('scroll', () => { document.getElementById('scrollhint').style.opacity = lenis.scroll > 40 ? 0 : ''; });
    let vel = 0, centers = [];
    const calcCenters = () => { centers = [...document.querySelectorAll('.beat')].map(s => s.offsetTop + s.offsetHeight / 2); };
    function beatFrom() {
      const vc = (window.scrollY || pageYOffset || 0) + innerHeight / 2;
      if (!centers.length) return 0;
      if (vc <= centers[0]) return 0;
      if (vc >= centers[centers.length - 1]) return centers.length - 1;
      for (let i = 0; i < centers.length - 1; i++) if (vc >= centers[i] && vc <= centers[i + 1]) { const fr = (vc - centers[i]) / (centers[i + 1] - centers[i]); return i + smoothstep(0.16, 0.84, fr); }   // dwell near each centre: scrolling has less effect the closer a chapter is to screen centre
      return 0;
    }

    /* light/dark mode */
    let lightOn = null;
    const kids = [jose, ben];
    function setMode(light) {
      if (light === lightOn) return; lightOn = light;
      const b = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      cmat.blending = b; cmat.needsUpdate = true;
      [leydi, ...kids].forEach(e => { e.m.blending = b; e.m.needsUpdate = true; });
      jose.m.color.setHex(light ? 0xe11d48 : COL.jose); ben.m.color.setHex(light ? 0x1e63ff : COL.ben);
      [jose, ben].forEach(e => e.m.size = (light ? (isMobile ? 4 : 3.8) : (isMobile ? 3 : 2.8)));
    }

    /* helpers for entity flow */
    // children: broad ECG heartbeat; particles fly OUT from heart/cloud elements to final-size wave
    function ribbon(e, t, yBase, amp, phase, radius, emerge, op, origin) {
      const a = e.pos, n = e.n, cycles = 3;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), ph = ((u * cycles) + t * 0.22 + phase) % 1;
        const rx = (u - 0.5) * 150, ry = yBase + ecg(ph < 0 ? ph + 1 : ph) * amp, rz = Math.cos(u * Math.PI * 4 + phase) * radius * 0.25;
        a[i * 3] = lerp(origin[i * 3], rx, emerge); a[i * 3 + 1] = lerp(origin[i * 3 + 1], ry, emerge); a[i * 3 + 2] = lerp(origin[i * 3 + 2], rz, emerge);
      }
      e.g.attributes.position.needsUpdate = true; e.m.opacity = op;
    }

    const measured = new Array(nBeats).fill(false);
    let cloudStriped = false;
    const tmpTint = new THREE.Color(), tmpBg = new THREE.Color(), nextBg = new THREE.Color();
    const colOf = (map, i) => new THREE.Color(map[ids[i]] ?? 0x070708);

    function frame(time) {
      const t = time * 0.001;
      vel = Math.min(1, Math.abs(lenis.velocity || 0) / 40);
      const bf = beatFrom();
      const active = Math.round(bf);
      const i0 = Math.floor(bf), i1 = Math.min(nBeats - 1, i0 + 1), f = bf - i0;
      const ease = f, cen = 1 - 2 * Math.min(f, 1 - f);   // (scroll dwell handled in beatFrom)
      const pp = Math.max(0, 1 - Math.abs(bf - P) / 0.95);                 // kernel-panic proximity
      const restartFlow = smoothstep(Re - 1, Re, bf);
      const cloudShow = smoothstep(idx.boot - 0.72, idx.boot + 0.22, bf);   // boot coalesces gradually as the infall feeds it (birth FROM the infall) — wide ramp = slow grow
      const bootForm = cloudShow;                                                     // per-particle activation reads this (0->1)
      const bootTone = 1 - smoothstep(idx.boot + 0.15, idx.boot + 0.75, bf);          // orbital colours (white tint + density map) through boot, fade into the grey house
      const nz = smoothstep(Ne - 0.5, Ne - 0.05, bf) * (1 - smoothstep(Ne + 0.05, Ne + 0.6, bf));   // neurotype proximity (drives the puzzle highlight)
      const restTone = smoothstep(Re - 0.7, Re - 0.15, bf);   // restart: hydrogen orbital + orange-strand colours
      const sweepTone = smoothstep(Bs - 0.5, Bs - 0.05, bf) * (1 - smoothstep(Ne + 0.05, Ne + 0.6, bf));   // the hexagon is shown from the BUILD beat onward (purple), automation greens it daemon->partner, holds green through neurotype, fades into panic
      const hexDark = smoothstep(A - 0.6, A - 0.1, bf);   // hexagon goes DARK from attach (bind_partner) onward, like the neurotype base — so the purple sweep + family drawing pop (daemon CUBE stays bright: hexDark=0 there)
      // honeycomb crystallisation: only around the daemon beat — the lattice GEOMETRY reorganises as traveling bands of snapped cells flow L->R (cellular-automaton wave), then settles to the static honeycomb by attach
      const dm = idx.daemon, cryst = smoothstep(Bs + 0.4, dm - 0.2, bf) * (1 - smoothstep(dm + 0.25, A - 0.05, bf));
      const t0 = targets[ids[i0]], t1 = targets[ids[i1]];
      const cdStagger = (i0 === idx.core_dump);   // street -> cube: convert particles at staggered times for street/cube overlap
      const cdFront = lerp(-30, 42, smoothstep(0.76, 1.0, f));   // block->hexagon materialisation plane (L->R): runs AFTER the tetris blocks have settled, so the assembled square morphs straight into the (purple) hexagon — no cube. The COLOUR change to purple rides this morph.
      const sxHold = (i0 === idx.syntax_error), sxEase = smoothstep(0.34, 1.0, f);   // hold the complete house briefly (forbidden sits over it) before morphing to the street
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        let x, y, z;
        if (cdStagger) {   // street gathers into each 4-cell TETROMINO block, DROPS into place (staggered), forming a filled square — which then SWEEPS straight into the hexagon (no cube)
          const b = pieceOrder[tBlock[i]];   // shuffled drop slot -> blocks fall one by one in random order, not left->right
          const s0 = 0.05 + b * 0.055;
          const g1 = smoothstep(s0, s0 + 0.16, f);            // street particles GATHER into the 4-cell block shape, floating above the slot
          const g2 = smoothstep(s0 + 0.16, s0 + 0.34, f);     // then the whole block DROPS straight down into its slot (tetris)
          const pm = smoothstep(cdFront + 9, cdFront - 9, tetSquare[k]);   // tetris-completion -> hexagon plane: 1 behind (hexagon), 0 ahead (still the square)
          const DROP = 64;                                    // block forms this far above its final row, then falls
          const gx = lerp(t0[k], tetSquare[k], g1), gy = lerp(t0[k + 1], tetSquare[k + 1] + DROP, g1), gz = lerp(t0[k + 2], tetSquare[k + 2], g1);
          const dxp = gx, dyp = lerp(gy, tetSquare[k + 1], g2), dzp = gz;   // drop = just the Y falling from spawn to the cell
          x = lerp(dxp, t1[k], pm); y = lerp(dyp, t1[k + 1], pm); z = lerp(dzp, t1[k + 2], pm);   // the assembled square sweeps into the hexagon
        } else {
          const e = sxHold ? sxEase : ease;
          x = lerp(t0[k], t1[k], e); y = lerp(t0[k + 1], t1[k + 1], e); z = lerp(t0[k + 2], t1[k + 2], e);
        }
        if (restartFlow > 0) {   // the WHOLE cloud is the hydrogen 'pure me' now (helix is a separate fed stream). ALIVE but CALM: a soft shallow breathe only — NO rotation, so the hexagon doesn't spin or split as it morphs into the hydrogen
          const cx = -74, dx = x - cx, br = 1 + 0.03 * Math.sin(t * 0.5 + i * 0.012) * restartFlow;
          x = cx + dx * br; z = z * br; y = y * br;
        }
        if (cryst > 0.002) {   // honeycomb crystallisation front: traveling bands of snapped cells flow L->R through the looser hex disk, so the geometry reorganises in an organic wave
          const hl = targets._hexLoose;
          const wave = 0.5 + 0.5 * Math.sin(hl[k] * 0.16 - t * 1.1);    // bands sweep left->right across the lattice
          const snap = lerp(0.62, 1.0, wave);                          // crest = crisp honeycomb cells, trough = slightly looser (stays clearly honeycomb, just breathes/reorganises)
          const bx = lerp(hl[k], x, snap), by = lerp(hl[k + 1], y, snap), bz = lerp(hl[k + 2], z, snap);
          x = lerp(x, bx, cryst); y = lerp(y, by, cryst); z = lerp(z, bz, cryst);
        }
        if (nz > 0.005 && isFwd[i] && hash[i] < 0.6) {                 // a subset of the lit lobe particles tether back to the lattice
          const flatZ = targets.spawn_smurf[k + 2];                    // this particle's flat hexLat z
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.7);       // per-particle phase -> flowing, not a uniform pump
          z = lerp(z, lerp(32, flatZ, pulse), nz);                     // travel between forward lobe (z=32) and the lattice plane, only in the neuro window
        }
        const wob = 1.4 * (1 - 0.98 * pp);                                    // the panic hexagon does NOT wobble — held still while it flashes red
        live[k] = x + Math.sin(t * 0.5 + i) * wob; live[k + 1] = y + Math.cos(t * 0.4 + i * 1.3) * wob; live[k + 2] = z + Math.sin(t * 0.3 + i * 0.7) * wob;
      }
      cgeo.attributes.position.needsUpdate = true;
      cloud.rotation.y = Math.sin(t * 0.4) * 0.3 * cen * (1 - restartFlow) * (1 - pp) * (1 - smoothstep(P - 0.6, P - 0.2, bf));   // settle -> gentle rotate; rotation fully OFF from just before the panic through the hexagon->hydrogen morph (no spin while it becomes the hydrogen)
      cloud.rotation.x = 0;
      // (panic keeps the hexagon sprites now — the lattice flashes + waves rather than shattering into points)

      // tint / bg / mode
      tmpTint.copy(colOf(VINCENT_TINT, i0)).lerp(colOf(VINCENT_TINT, i1), f); cmat.color.copy(tmpTint).lerp(WHITE, Math.max(bootTone, nz, restTone, smoothstep(0.004, 0.04, sweepTone), smoothstep(0.08, 0.4, pp), cdStagger ? smoothstep(0.76, 0.9, f) : 0));   // white when per-particle colours drive; sweep uses a near-binary ramp so cmat stays white across the WHOLE sweep (no mid-fade product peak = the green/yellow flash on entering neurotype)
      tmpBg.copy(colOf(BEAT_BG, i0)); nextBg.copy(colOf(BEAT_BG, i1)); tmpBg.lerp(nextBg, f); scene.background.copy(tmpBg);
      const lum = 0.2126 * tmpBg.r + 0.7152 * tmpBg.g + 0.0722 * tmpBg.b, light = lum > 0.32;
      document.body.classList.toggle('lum-light', light); setMode(light);
      cmat.opacity = (light ? 0.85 : 0.9) - (light ? 0.16 : 0.32) * bootTone;          // boot: lower opacity so dense cores stay particle-y (less bloom 'vlek'); visibility is gated per-particle by act
      const heartFocus = smoothstep(A - 0.4, A, bf) * (1 - smoothstep(Sm - 0.1, Sm + 0.4, bf));   // gentle dim for Venn read
      cmat.opacity *= (1 - 0.3 * heartFocus);
      cmat.opacity *= (1 - 0.15 * pp);   // panic: keep the flashing lattice fairly bright
      cmat.opacity *= (1 - 0.4 * restTone);   // restart: softer (the hydrogen is the whole cloud now) but still clearly present — not a blinding vlek, not too faint either
      cmat.size = (isMobile ? 1.7 : 1.5) * (1 - 0.12 * restTone);   // only slightly smaller at restart

      // per-particle cloud colour: boot = hydrogen density map (orange core -> purple fringe); neurotype = dim-green hexagon with an orange puzzle piece
      if (bootTone > 0.005) {
        for (let i = 0; i < N; i++) { const k3 = i * 3, act = smoothstep(formOff[i], formOff[i] + FW, bootForm); cCol[k3] = (1 + (bootCol[k3] - 1) * bootTone) * act; cCol[k3 + 1] = (1 + (bootCol[k3 + 1] - 1) * bootTone) * act; cCol[k3 + 2] = (1 + (bootCol[k3 + 2] - 1) * bootTone) * act; }
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (restTone > 0.005) {
        for (let i = 0; i < N; i++) { const k3 = i * 3; cCol[k3] = 1 + (restCol[k3] - 1) * restTone; cCol[k3 + 1] = 1 + (restCol[k3 + 1] - 1) * restTone; cCol[k3 + 2] = 1 + (restCol[k3 + 2] - 1) * restTone; }   // strand particles carry their colour the whole way; they're hidden inside the hydrogen until they stream out into the helix
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (sweepTone > 0.005 && !cdStagger) {   // (cdStagger handles its own colour below — the tetris assembly must not be hijacked by the automation sweep)
        // AUTOMATION: build hexagon starts PURPLE; the normal continually-flowing L->R line-sweep (per-row repeating bands) runs across it, and the base lattice slowly fills GREEN left->right until the whole thing is green by the partner beat
        const autoProg = smoothstep(idx.daemon, A - 0.1, bf);                               // overall purple -> green progress (0 at daemon, 1 by partner)
        for (let i = 0; i < N; i++) { const k3 = i * 3;
          const row = Math.floor((live[k3 + 1] + 60) / 7);                                  // horizontal row by height
          const speed = 0.09 + ((row * 7) % 11) * 0.012;                                    // each row flows at its OWN speed
          const band = -56 + (((t * speed + row * 0.17) % 1) + 1) % 1 * 112;                // continually flowing L->R band (repeats forever)
          const dx = live[k3] - band, pulse = Math.exp(-dx * dx / 130);                     // the bright flowing line
          const lr = clamp01((live[k3] + 34) / 68);                                         // 0 = left edge, 1 = right edge
          const localProg = smoothstep(0, 1, autoProg * 1.5 - lr * 0.5);                    // green fills left->right as automation progresses; all green by autoProg=1
          const gR = lerp(0.21, 0.11, hexDark), gG = lerp(0.88, 0.46, hexDark), gB = lerp(0.42, 0.27, hexDark);   // GREEN (dims toward partner = less bright / less bloom)
          const baseR = lerp(0.560, gR, localProg), baseG = lerp(0.300, gG, localProg), baseB = lerp(0.960, gB, localProg);   // base lattice: purple -> green, left->right
          let gr = baseR + (0.35 - baseR) * pulse, gg = baseG + (1.0 - baseG) * pulse, gb = baseB + (0.5 - baseB) * pulse;   // the flowing line paints bright GREEN over whatever it crosses
          if (nz > 0.005 && neuroMask[i]) { gr = lerp(gr, 1.25, nz); gg = lerp(gg, 1.0, nz); gb = lerp(gb, 0.32, nz); }   // neurotype: lit lobes glow YELLOW over the green lattice
          cCol[k3] = gr; cCol[k3 + 1] = gg; cCol[k3 + 2] = gb; }
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (nz > 0.005) {
        for (let i = 0; i < N; i++) { const k3 = i * 3, pz = neuroMask[i]; const tr = pz ? 1.25 : 0.05, tg = pz ? 1.0 : 0.2, tb = pz ? 0.32 : 0.1; cCol[k3] = 1 + (tr - 1) * nz; cCol[k3 + 1] = 1 + (tg - 1) * nz; cCol[k3 + 2] = 1 + (tb - 1) * nz; }   // lobes = bright YELLOW (overdriven), rest = very dim green (does not light up)
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (cdStagger) {   // tetris stays UNCHANGED (grey debris -> orange square, with the violet anomaly piece); the colour change to PURPLE rides the block->hexagon morph only
        const asm = smoothstep(0.1, 0.5, f) * (1 - smoothstep(0.72, 0.95, f));   // anomaly piece violet glow (original timing)
        const tf = clamp01(f), cr = cmat.color.r, cg = cmat.color.g, cb = cmat.color.b;   // original tetris look = lerp(grey, orange, f); cmat may be forced white during the morph, so drive colour absolutely via cCol = desired / cmat
        for (let i = 0; i < N; i++) { const k3 = i * 3;
          const pm = smoothstep(cdFront + 9, cdFront - 9, tetSquare[k3]);                        // 1 = morphed into the hexagon (purple), 0 = still the tetris square
          const crest = Math.exp(-Math.pow(tetSquare[k3] - cdFront, 2) / 80) * smoothstep(0.78, 0.86, f) * (1 - smoothstep(0.96, 1.0, f));   // bright crest riding the morph plane
          let dr = lerp(0.604, 0.902, tf), dg = lerp(0.604, 0.494, tf), db = lerp(0.635, 0.133, tf);   // ORIGINAL tetris colour (grey 0x9a9aa2 -> orange 0xe67e22)
          if (tBlock[i] === PURPLE_PIECE) { dg *= lerp(1, 0.42, asm); db *= lerp(1, 2.2, asm); }       // the forbidden-rain anomaly piece glows violet (unchanged)
          dr = lerp(dr, 0.560, pm) + crest * 0.5; dg = lerp(dg, 0.300, pm) + crest * 0.7; db = lerp(db, 0.960, pm) + crest * 0.5;   // morphed cells -> PURPLE hexagon, with a bright materialisation crest
          cCol[k3] = dr / Math.max(cr, 0.001); cCol[k3 + 1] = dg / Math.max(cg, 0.001); cCol[k3 + 2] = db / Math.max(cb, 0.001);   // compensate for the material tint so the displayed colour is exactly 'd'
        }
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (pp > 0.05) {   // kernel panic: lattice points randomly error — flash WHITE then stay RED — accumulating until the whole hexagon is red (cmat is forced white, so cCol IS the colour)
        const redden = smoothstep(P - 0.62, P - 0.02, bf);   // fraction of points that have errored — ramps to (near) FULLY red BY the panic centre, so the lattice reads red, not half-green
        for (let i = 0; i < N; i++) { const k3 = i * 3, e = hash[i];
          if (Math.abs(redden - e) < 0.028) { cCol[k3] = 1.15; cCol[k3 + 1] = 1.0; cCol[k3 + 2] = 0.55; }   // brief amber-white SPARK at the instant it errors (narrow + dim so it doesn't bloom the scene white)
          else if (redden > e) { cCol[k3] = 1.3; cCol[k3 + 1] = 0.06; cCol[k3 + 2] = 0.06; }                // errored -> stays deep saturated RED (R boosted, G/B near zero so additive+bloom reads red, not pink/white)
          else { cCol[k3] = 0.07; cCol[k3 + 1] = 0.24; cCol[k3 + 2] = 0.15; }                                // not yet errored -> dim green (kept dark so the red dominates the read even mid-cascade)
        }
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (neuroDimmed) { cCol.fill(1); cgeo.attributes.color.needsUpdate = true; neuroDimmed = false; }

      // Leydi: heart flies IN from outside the viewport -> FILLED heart -> re-tighten -> EXPLODE (the break)
      {
        const HX = 14;                                                  // heart sits right, partially overlaps Vincent hexagon
        const toIn = smoothstep(A - 0.28, A + 0.28, bf);               // heart starts flying in a bit earlier, after the hexagon reads (4a.5 -> 4b)
        const toHeart = smoothstep(A - 0.12, A + 0.28, bf);            // then fills into the heart silhouette (Venn with the hexagon)
        const tight = lerp(1, 0.72, smoothstep(P - 0.5, P - 0.12, bf));
        const decay = smoothstep(P - 0.7, P - 0.15, bf);               // colour-shift + disintegration just BEFORE the break (starts AFTER neurotype, so the heart holds steady through that beat)
        const eP = smoothstep(P - 0.12, P + 0.18, bf);                 // explodes at kernel panic
        for (let i = 0; i < NL; i++) {
          const ang = lA[i]; const hf = heartFill[i];
          const ox = Math.cos(ang) * 240, oy = Math.sin(ang) * 240;     // off-screen origin
          const rx = HX + Math.cos(ang) * 48, ry = Math.sin(ang) * 48;  // ring midpoint
          const dil = 1 + decay * 0.9;                                  // dilate (grow/dilute) before exploding
          const fx = HX + hf[0] * tight * dil, fy = hf[1] * tight * dil;  // FILLED heart silhouette
          const edgeF = Math.min(1, Math.hypot(hf[0], hf[1]) / 34);            // 0 = heart centre, 1 = outer edge
          const beat = 1 + 0.025 * Math.sin(t * 2.6) * edgeF * smoothstep(0.5, 0.8, toHeart);   // ONLY the edge breathes, gently (centre barely moves)
          const midx = lerp(rx, fx, toHeart) * beat, midy = lerp(ry, fy, toHeart) * beat;
          let tx = lerp(ox, midx, toIn), ty = lerp(oy, midy, toIn), tz = lerp(0, lerp(8, 0, toHeart), toIn);
          const wobIn = (1 - edgeF) * smoothstep(0.5, 0.9, toHeart) * (1 - decay) * 0.5;   // the inside just wobbles a touch (not a full pulse)
          tx += Math.sin(t * 2.1 + i * 0.7) * wobIn; ty += Math.cos(t * 1.8 + i * 1.3) * wobIn;
          const dj = decay * 16 * (1 - 0.7 * smoothstep(0.55, 0.95, decay));   // soft jitter, scaled down as the ice spikes grow
          tx += Math.sin(t * 1.6 + i * 1.7) * dj; ty += Math.cos(t * 1.4 + i * 2.1) * dj; tz += Math.sin(t * 1.1 + i) * dj;   // disintegrate
          const spike = smoothstep(0.55, 0.95, decay);                         // ice-crystal spiky phase just before the break
          if (spike > 0) {
            const sdx = tx - HX, sdy = ty, sar = Math.atan2(sdy, sdx);
            const teeth = Math.pow(Math.abs(Math.sin(sar * 6 + i * 0.3)), 6);  // sharp radial spikes (glass shards), not a smooth swell
            tx += Math.cos(sar) * teeth * spike * 26; ty += Math.sin(sar) * teeth * spike * 26; tz += (hash[i] - 0.5) * spike * 10;
          }
          const dx = tx - HX, dy = ty, len = Math.hypot(dx, dy) || 1, burst = eP * (120 + (i % 50) * 2.4);
          tx += (dx / len) * burst; ty += (dy / len) * burst + eP * 15; tz += (lR[i] - 0.5) * eP * 130;
          leydi.pos[i * 3] = tx; leydi.pos[i * 3 + 1] = ty; leydi.pos[i * 3 + 2] = tz;
        }
        leydi.g.attributes.position.needsUpdate = true;
        leydi.m.color.copy(cPink).lerp(cCold, decay);                  // pink -> cold as it decays
        leydi.m.opacity = toIn * 1.15 * (1 - smoothstep(P + 0.1, P + 0.6, bf)) * (1 - 0.85 * nz);   // brighter heart at the partner stage; still fades away during neurotype so the honeycomb is the focus
        if (decay > 0.55 && !leydiFrozen) { leydi.m.map = texSnow; leydi.m.needsUpdate = true; leydiFrozen = true; }
        if (decay < 0.4 && leydiFrozen) { leydi.m.map = texHeart; leydi.m.needsUpdate = true; leydiFrozen = false; }
      }

      // children: emerge from cloud at spawn(6), persist, protected, orbit at restart
      // children: own beats (smurf, then boefje); broad ECG heartbeat lanes; calmer at restart
      const orbit = smoothstep(Re - 0.3, Re + 0.1, bf), ampK = lerp(17, 11, orbit), radK = 12;
      const neuroDim = 1 - 0.85 * nz;   // fade the kids' heartbeats too during neurotype — only the honeycomb + lobes stay
      const panicHush = smoothstep(P - 0.5, P - 0.12, bf) * (1 - smoothstep(Re - 0.45, Re - 0.1, bf));   // children heartbeat ribbons go quiet through the panic so it reads as a clean red hexagon (no stripes); they return as the restart orbit forms
      const emJ = smoothstep(Sm - 0.4, Sm + 0.1, bf), opJ = smoothstep(Sm - 0.4, Sm - 0.05, bf) * 0.95 * neuroDim * (1 - panicHush);
      const emB = smoothstep(Bo - 0.4, Bo + 0.1, bf), opB = smoothstep(Bo - 0.4, Bo - 0.05, bf) * 0.95 * neuroDim * (1 - panicHush);
      ribbon(jose, t, 16, ampK, 0.0, radK, emJ, opJ, jOrigin);
      ribbon(ben, t, -16, ampK, 0.5, radK, emB, opB, bOrigin);

      // forbidden sign: grows over the house at the syntax_error centre (in front, toward camera), recedes into the street morph
      {
        const sx = idx.syntax_error;
        const appear = smoothstep(sx - 0.05, sx + 0.12, bf);                       // grows over the held house
        const cloud = smoothstep(sx + 0.16, sx + 0.5, bf);                         // drifts up into a purple CLOUD above the street
        const fallPhase = smoothstep(sx + 0.8, sx + 0.96, bf);                     // RAINS only once the house has fully morphed into the STREET scene (bench / lamp / bin reads) — not before; narrow/fast window so the downpour comes all at once
        if (appear > 0.001) {
          const sc = 0.55 + 0.45 * appear;
          for (let i = 0; i < NF; i++) {
            const fx = forbidPos[i * 3] * sc, fy = forbidPos[i * 3 + 1] * sc, fz = forbidPos[i * 3 + 2] * sc + 16;   // the ⊘ sign over the house
            const rx = (i * 0.6180339887) % 1;                                                                       // even L->R spread, DECORRELATED from the drop-test hash (else all drops land on one side)
            const cx = (rx - 0.5) * 150, cyTop = 24 + (hash2[i] - 0.5) * 14, cz = (hash2[i] - 0.5) * 50;             // CLOUD: wide band across the WHOLE top, sits HIGH, and STAYS there
            const started = clamp01((fallPhase - hash[i] * 0.12) * 5);            // small stagger, fast
            let px = lerp(fx, cx, cloud), py = lerp(fy, cyTop, cloud), pz = lerp(fz, cz, cloud);                      // ⊘ sign -> drifts up into the cloud
            if (hash[i] < 0.72) {   // ~72% of the cloud sheds as falling drops (rain across the full width); the rest stays as the cloud BODY, so the cloud doesn't stretch down — drops DETACH and fall out of it
              const spd = 0.5 + hash2[i] * 1.7;                                   // each drop its own fall speed
              const cyc = ((t * spd + hash[i] * 9.17) % 1 + 1) % 1;              // time loop: drop falls from the cloud bottom, wraps at the ground, repeats
              const fallY = lerp(cyTop - 3, -46 + (hash[i] - 0.5) * 10, cyc);    // straight DOWN from the cloud to the ground
              py = lerp(py, fallY + Math.cos(t * 0.5 + i) * 0.3, started);        // only detaches + falls once the rain has started; the cloud body holds position
              px = lerp(px, cx + Math.sin(t * 0.6 + i) * 0.6, started);          // stays in its own column (no sideways slide of the whole cloud)
            }
            forbid.pos[i * 3] = px; forbid.pos[i * 3 + 1] = py; forbid.pos[i * 3 + 2] = pz;
          }
          forbid.g.attributes.position.needsUpdate = true;
        }
        // the forbidden rain rises into the PURPLE anomaly piece of the rebuild square, then dissolves as the cube diffuses (cf tracks the main square's assemble/diffuse timing)
        if (Math.floor(bf) === idx.core_dump) {
          const cf = bf - idx.core_dump, gather = smoothstep(0.06, 0.5, cf), dissolve = smoothstep(0.72, 1.0, cf);
          for (let i = 0; i < NF; i++) { const k = i * 3; forbid.pos[k] = lerp(forbid.pos[k], forbidSquare[k], gather); forbid.pos[k + 1] = lerp(forbid.pos[k + 1], forbidSquare[k + 1], gather); forbid.pos[k + 2] = lerp(forbid.pos[k + 2], forbidSquare[k + 2], gather); }
          forbid.g.attributes.position.needsUpdate = true;
          forbid.m.opacity = (1 - dissolve) * 0.92;   // stays visible: fallen rain lingers, rises into the block, then dissolves into the cube — no gap
        } else {
          forbid.m.opacity = smoothstep(0.16, 0.55, appear) * (1 - smoothstep(idx.core_dump + 0.5, idx.bootstrap, bf)) * 0.9;   // visible through the rain + lingering on the street; only the rebuild branch (above) fades it out
        }
      }

      // infall: at the very start the static just roams; then it begins infalling and feeds the actual cloud
      const bootVis = 1 - smoothstep(0.4, 1.1, bf);
      const wander = 1 - smoothstep(idx.boot - 0.75, idx.boot - 0.35, bf);   // infall fully running before boot coalesces from it
      for (let i = 0; i < NIF; i++) {
        const ti = ifT[i] * 3, dx = live[ti] - ifx[i], dy = live[ti + 1] - ify[i], dz = live[ti + 2] - ifz[i], d = Math.hypot(dx, dy, dz) || 1;
        if (d < 6 && wander < 0.4) ifSpawn(i);
        const spd = ifS[i] * (d > 60 ? 1.7 : 1);
        const vx = dx / d * spd, vy = dy / d * spd, vz = dz / d * spd;                                  // seek the cloud
        const hx = ifhx[i] + Math.sin(t * 0.7 + i) * 11, hy = ifhy[i] + Math.cos(t * 0.6 + i * 1.7) * 11;   // roam home
        const wx = (hx - ifx[i]) * 0.05, wy = (hy - ify[i]) * 0.05, wz = (ifhz[i] - ifz[i]) * 0.05;
        ifx[i] += lerp(vx, wx, wander); ify[i] += lerp(vy, wy, wander); ifz[i] += lerp(vz, wz, wander);
        infall.pos[i * 3] = ifx[i]; infall.pos[i * 3 + 1] = ify[i]; infall.pos[i * 3 + 2] = ifz[i];
        const prox = clamp01(1 - d / 80) * (1 - wander);   // nearer the cloud + infalling -> takes the orbital colour at the dot's own position (purple fringe -> orange core) at boot, else the scene tint
        let cr, cg, cb;
        if (bootTone > 0.005) {
          const rd = Math.hypot(ifx[i], ify[i], ifz[i]) || 1;
          const tt = smoothstep(52, 14, rd);   // far from the cloud = purple, nearing the core = orange -> yellow
          if (tt < 0.5) { const kk = tt / 0.5; cr = lerp(PCL[0], PCM[0], kk); cg = lerp(PCL[1], PCM[1], kk); cb = lerp(PCL[2], PCM[2], kk); }
          else { const kk = (tt - 0.5) / 0.5; cr = lerp(PCM[0], PCH[0], kk); cg = lerp(PCM[1], PCH[1], kk); cb = lerp(PCM[2], PCH[2], kk); }
        } else { cr = tmpTint.r; cg = tmpTint.g; cb = tmpTint.b; }
        ifCol[i * 3] = lerp(IF_GREY[0], cr, prox); ifCol[i * 3 + 1] = lerp(IF_GREY[1], cg, prox); ifCol[i * 3 + 2] = lerp(IF_GREY[2], cb, prox);
      }
      infall.g.attributes.position.needsUpdate = true; infall.g.attributes.color.needsUpdate = true;
      const startVis = 1 - smoothstep(idx.boot - 0.15, idx.boot + 0.5, bf);   // bright while the cloud forms; dims once it's formed
      infall.m.opacity = (0.1 + 0.64 * Math.max(startVis, wander)) * (0.85 + 0.15 * Math.abs(Math.sin(t * 30)));

      // family drawing: ONLY at the kernel panic — once the heart + hexagon explode, the -4 family coalesces FAST out of the shards, then quickly morphs to -3 (partner removed)
      if (famReady) {
        const famIn = smoothstep(P + 0.05, P + 0.5, bf);                     // streams IN from outside (infall) after the explosion — builds the family
        const famVis = famIn * (1 - smoothstep(Re - 0.15, Re + 0.12, bf));   // holds, fades as the restart scene forms
        const merge = smoothstep(P + 0.5, Re - 0.05, bf);                    // the PARTNER travels INTO the purple part of the hydrogen 'pure me' as the restart forms (merged, not just gone)
        if (famVis > 0.002) {
          for (let i = 0; i < NFam; i++) { const k = i * 3, act = smoothstep(famOff[i], famOff[i] + 0.4, famIn);   // staggered per-particle stream-in
            let px = lerp(famOrigin[k], famT[k], act) + Math.sin(t * 0.5 + i) * 0.6;
            let py = lerp(famOrigin[k + 1], famT[k + 1], act) + Math.cos(t * 0.4 + i) * 0.6;
            let pz = lerp(famOrigin[k + 2], famT[k + 2], act);
            if (famGone[i]) { px = lerp(px, famMerge[k], merge); py = lerp(py, famMerge[k + 1], merge); pz = lerp(pz, famMerge[k + 2], merge); }   // partner merges into the hydrogen purple
            family.pos[k] = px; family.pos[k + 1] = py; family.pos[k + 2] = pz;
            fCol[k] = lerp(0.749, FAM_PURP[0], act); fCol[k + 1] = lerp(0.914, FAM_PURP[1], act); fCol[k + 2] = lerp(1.0, FAM_PURP[2], act);   // start as the heart's icy cyan (0xbfe9ff), turn purple as the family forms
          }
          family.g.attributes.position.needsUpdate = true; family.g.attributes.color.needsUpdate = true;
        }
        family.m.opacity = famVis * 0.78;
      }

      // backdrop nest REMOVED from the ending — the green lattice no longer runs behind 'pure me' (Vincent wanted it gone)
      backdrop.m.opacity = 0;

      // helix HOSE: particles are GENERATED on the LEFT (at the hydrogen) and FLOW RIGHT through the hose. A flow clock starts once the hydrogen scene has STOOD; each particle turns on as the fill-front passes its phase, then keeps flowing right (recycling at the left) -> the hose fills from the left and keeps flowing
      if (restTone > 0.9) { if (helixFlowStart < 0) helixFlowStart = t; helixFlowT = (t - helixFlowStart) * 0.06; }   // slower flow
      else { helixFlowStart = -1; helixFlowT = 0; }
      if (restTone > 0.005) {
        const tubeR = 1.3 + 5.0 * smoothstep(0, 1.8, helixFlowT);   // TUBE thickness — starts thin, slowly grows (the hose tube WIDENS, not the coil circle); a bit fatter hose
        for (let i = 0; i < NH; i++) {
          const g = i / NH, raw = helixFlowT - g;                 // time since this particle was generated on the left
          const gen = smoothstep(0, 0.02, raw);                   // off until generated, then stays on
          const v = raw <= 0 ? 0 : (raw % 1);                     // flows from the left (v=0) to the right (v=1), then recycles
          const p = helixPos(v, hTop[i]);
          const wob = Math.sin(t * 0.6 + i) * 0.5;               // gentle smoke movement
          helixP.pos[i * 3] = p[0] + hOff[i * 3] * tubeR + wob; helixP.pos[i * 3 + 1] = p[1] + hOff[i * 3 + 1] * tubeR; helixP.pos[i * 3 + 2] = p[2] + hOff[i * 3 + 2] * tubeR;
          const fade = gen * smoothstep(0, 0.04, v) * (1 - smoothstep(0.94, 1.0, v));   // fade in at the left, out at the right tip (hides the recycle wrap)
          hCol[i * 3] = hBase[i * 3] * fade; hCol[i * 3 + 1] = hBase[i * 3 + 1] * fade; hCol[i * 3 + 2] = hBase[i * 3 + 2] * fade;
        }
        helixP.g.attributes.position.needsUpdate = true;
        helixP.g.attributes.color.needsUpdate = true;
      }
      helixP.m.opacity = restTone * 0.72;   // softer / smokier

      // bloom + glitch (no camera shake)
      bloom.strength = light ? 0.04 : Math.max(0.12 - 0.07 * pp, 0.6 - 0.36 * bootTone - 0.22 * nz - 0.1 * Math.max(0, hexDark - nz) - 0.18 * restTone - 0.55 * pp);   // panic + restart: trim bloom so neither the red lattice nor the hydrogen blooms into a big white blob (but keep the hydrogen present)
      rgb.uniforms.amount.value = pp * vel * 0.007;   // RGB-shift glitch ONLY while actively scrolling through the panic — when you dwell it goes to ~0 so the hexagon reads as a clean RED shape, not red/blue split stripes
      { sunRise += ((restTone > 0.4 ? 1 : 0) - sunRise) * 0.012; const ang = lerp(-0.95, 0.66, sunRise), op = smoothstep(Re - 0.6, Re, bf), pulse = 1 + 0.06 * Math.sin(t * 0.6);
        const orbX = Math.cos(t * 0.07) * 28 * sunRise, orbY = Math.sin(t * 0.07) * 20 * sunRise;   // the sun ORBITS slowly along an ellipse around its risen position
        const px = 12 + Math.cos(ang) * 100 + orbX, py = -22 + Math.sin(ang) * 100 + orbY;
        sunHalo.position.set(px, py, -130); sunStar.position.set(px, py, -128);
        sunHalo.material.opacity = op * 0.34 * pulse; sunStar.material.opacity = op * 0.5 * pulse; sunStar.material.rotation += 0.0011; }   // the sun ARCS up on an orbit over time; small godray star slowly turns

      // uptime
      if (upEl) { const now = new Date(); let y = now.getFullYear() - 1980; const an = new Date(now.getFullYear(), 1, 18); if (now < an) y--; const base = new Date(now.getFullYear() - (now < an ? 1 : 0), 1, 18); const ms = now - base, dd = Math.floor(ms / 86400000), r = ms - dd * 86400000, hh = Math.floor(r / 3600000), mm = Math.floor(r % 3600000 / 60000), ss = Math.floor(r % 60000 / 1000); upEl.textContent = `uptime ${y}y ${dd}d ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; }
      // simulation-time: interpolate the life-timeline by scroll fraction (where this scroll position sits between the two chapters' dates)
      if (simEl) { const simMs = lerp(beatTimes[i0], beatTimes[i1], f), sd = new Date(simMs), ageY = Math.max(0, Math.floor((simMs - birthMs) / 31556952000)); simEl.textContent = `sim-time ${SIM_MO[sd.getUTCMonth()]} ${sd.getUTCFullYear()} · age ${ageY}`; }
      // system monitor: load spikes at stress (boot infall, homeless street, kernel panic, scroll velocity), mem fills as the partner + 2 child processes load (partner freed at the panic)
      if (mctx && t - monLast > 0.08) {
        monLast = t;
        let mem = 16 + (bf >= A - 0.2 ? 16 : 0) + (bf >= Sm - 0.2 ? 22 : 0) + (bf >= Bo - 0.2 ? 22 : 0) - (bf >= P - 0.1 ? 20 : 0) + 5 * Math.sin(t * 0.7) + smoothstep(0, nBeats - 1, bf) * 6;
        const bootLoad = smoothstep(idx.boot - 0.6, idx.boot, bf) * (1 - smoothstep(idx.boot + 0.2, idx.boot + 0.9, bf));
        const hardship = smoothstep(idx.syntax_error - 0.6, idx.syntax_error - 0.1, bf) * (1 - smoothstep(idx.core_dump + 0.5, idx.core_dump + 1.0, bf));   // welfare (01) -> homeless (02): sustained heavy load across the whole hardship stretch
        let load = 13 + vel * 32 + pp * 72 + hardship * 52 + Math.max(0, 1 - Math.abs(bf - idx.core_dump) / 0.55) * 18 + bootLoad * 30 + 5 * Math.sin(t * 2.3 + bf * 2);
        load *= (1 - 0.82 * restTone);   // restart = calm / idle (recovered, nominal)
        for (let i = 0; i < MONN - 1; i++) { cpuH[i] = cpuH[i + 1]; memH[i] = memH[i + 1]; }
        cpuH[MONN - 1] = clampN(load, 2, 99); memH[MONN - 1] = clampN(mem, 3, 98);
        drawMon();
      }
      // console: the process log accrues — every beat ALREADY reached is shown (future ones hidden); active line highlighted + blinking cursor; bootstrap expands into the build-log
      if (logLines.length) {
        const cur = (Math.sin(t * 4) > 0) ? ' █' : '';
        const tail = isMobile ? 6 : 999;   // phone: keep just the last few lines so the log doesn't fill the screen
        for (let i = 0; i < logLines.length; i++) {
          const d = logLines[i];
          const show = (i <= active) && (i > active - tail);
          if (d._show !== show) { d.style.display = show ? '' : 'none'; d._show = show; }
          if (!show) continue;
          const on = (i === active);
          if (d._on !== on) { d.classList.toggle('on', on); d._on = on; }
          if (i === idx.bootstrap && !isMobile) {   // desktop: bootstrap entry IS the build-log (reveals, then stays full). Phone: keep it one line to save space
            const n = (active > i) ? COMPILE.length : Math.floor(smoothstep(Bs - 0.5, Bs + 0.4, bf) * COMPILE.length);
            d.textContent = COMPILE.slice(0, Math.max(1, n)).join('\n') + (on && n < COMPILE.length ? ' █' : '');
          } else {
            d.textContent = (LOG[ids[i]] || '') + (on ? cur : '');
          }
        }
      }

      // text: blur active sig by (1-c), measurement pulse on rising c
      document.querySelectorAll('.beat').forEach((el, i) => {
        if (i === active) { const sig = el.querySelector('.sig'); if (sig) sig.style.filter = `blur(${(1 - cen) * 6}px)`; }
        if (i === active && cen > 0.5 && !measured[i]) { el.classList.add('measured'); measured[i] = true; }
        if (i === active && cen < 0.2 && measured[i]) { el.classList.remove('measured'); measured[i] = false; }
      });

      // chapter weight: the actual scroll resists near a chapter centre, so chapters feel heavy / anchored
      { const w = scrollWeight().w; lenis.options.lerp = lerp(0.09, 0.045, w); }   // heavier easing near centre -> slow settle (options.lerp IS read live)

      composer.render();
      requestAnimationFrame(frame);
    }

    function onResize() { fitCam(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); calcCenters(); }
    addEventListener('resize', onResize); calcCenters(); addEventListener('load', calcCenters); setTimeout(calcCenters, 600);
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf); requestAnimationFrame(frame);
  } catch (e) { fail(e.message || String(e)); }
})();
