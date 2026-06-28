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
  const HCELL = 4.6, hexLat = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x = cubeLat[i * 3] * 0.72, y = cubeLat[i * 3 + 1] * 0.72;
    if (!hexInside(x, y, 34)) { const a = Math.atan2(y, x), seg = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6, rad = 34 * (Math.cos(Math.PI / 6) / Math.cos(seg)); x = Math.cos(a) * rad; y = Math.sin(a) * rad; }
    // honeycomb: snap toward the nearest hex-grid cell centre so the nest reads as CELLS, not a fuzzy disk
    const gy = Math.round(y / (HCELL * 1.5)), ox = (gy & 1) ? HCELL * Math.sqrt(3) / 2 : 0, gx = Math.round((x - ox) / (HCELL * Math.sqrt(3)));
    const cxC = gx * HCELL * Math.sqrt(3) + ox, cyC = gy * HCELL * 1.5;
    x = lerp(x, cxC, 0.55); y = lerp(y, cyC, 0.55);   // pull 55% toward the cell centre -> visible honeycomb
    hexLat[i * 3] = x - 8; hexLat[i * 3 + 1] = y; hexLat[i * 3 + 2] = cubeLat[i * 3 + 2] * 0.22;   // fairly flat honeycomb disk (deep layers fanned out under rotation)
  }
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

    const texHex = makeSprite('hex'), texCircle = makeSprite('circle'), texSquare = makeSprite('square'), texHeart = makeSprite('heart'), texSnow = makeSprite('snow'), texStripe = makeSprite('stripe'), texDot = makeSprite('dot');

    /* Vincent cloud (hexagons) */
    const targets = makeTargets(N, ids);
    const superpos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const p = inSphere(R * (0.7 + Math.random() * 0.6)); superpos[i * 3] = p[0]; superpos[i * 3 + 1] = p[1]; superpos[i * 3 + 2] = p[2]; }
    const live = new Float32Array(superpos);
    const GREY = new THREE.Color(0x8a8a92);
    const introPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { introPos[i * 3] = rand(-140, 140); introPos[i * 3 + 1] = rand(-82, 82); introPos[i * 3 + 2] = rand(-40, 40); }
    const cgeo = new THREE.BufferGeometry(); cgeo.setAttribute('position', new THREE.BufferAttribute(live, 3));
    const cmat = new THREE.PointsMaterial({ map: texHex, color: VINCENT_TINT.boot, size: isMobile ? 1.7 : 1.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, alphaTest: 0.02, sizeAttenuation: true });
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
    // restart: source = the hydrogen orbital ('pure me'), helix flows out of it and wraps the children. Colour: orbital map on the source, orange on the strand.
    const REST_HEX = Math.floor(0.66 * N), restCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      if (i < REST_HEX) {
        const s = Math.min(N - 1, Math.floor(i / REST_HEX * N)) * 3, k = i * 3;
        targets.restart[k] = -74 + targets.boot[s]; targets.restart[k + 1] = targets.boot[s + 1]; targets.restart[k + 2] = targets.boot[s + 2];   // exact boot orbital shape (no stretch) -> as tight + defined as the boot sequence
        const ry = targets.restart[k + 1];
        let nb = Math.exp(-Math.pow((Math.abs(ry) - 16) / 9, 2)) * 0.7;   // purple emphasis at the heartbeat heights (~+-16)
        nb *= clamp01(1 - bootCol[s + 1] * 1.3);   // ...but ONLY on the already-dim regions, so the bright yellow lobes run uncut to the middle
        restCol[k] = bootCol[s] + (0.416 - bootCol[s]) * nb; restCol[k + 1] = bootCol[s + 1] + (0.173 - bootCol[s + 1]) * nb; restCol[k + 2] = bootCol[s + 2] + (0.788 - bootCol[s + 2]) * nb;
      } else {   // strand = a mix of yellow and purple particles with varying density (bands), springing from the lobe
        const e = smoothstep(0, 0.3, (i - REST_HEX) / (N - REST_HEX)), pf = 0.32 + 0.26 * Math.sin(i * 0.03);   // purple fraction oscillates along the strand
        if (hash2[i] < pf) { restCol[i * 3] = 0.416; restCol[i * 3 + 1] = 0.173; restCol[i * 3 + 2] = 0.788; }   // purple
        else { restCol[i * 3] = 1.0; restCol[i * 3 + 1] = 0.85 + (0.5 - 0.85) * e; restCol[i * 3 + 2] = 0.4 + (0.14 - 0.4) * e; }   // yellow -> orange
      }
    }
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
    while (heartFill.length < NL) { const x = rand(-1.4, 1.4), y = rand(-1.3, 1.4); if (Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y < 0) heartFill.push([x * 28, y * 28 + 4]); }
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
    const famT = new Float32Array(NFam * 3), famOrigin = new Float32Array(NFam * 3), famOff = new Float32Array(NFam), famGone = new Uint8Array(NFam);
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
        famOrigin[k] = rand(-85, 85); famOrigin[k + 1] = rand(-65, 65); famOrigin[k + 2] = rand(-45, 45);   // a scattered debris field — the explosion shards coalesce into the drawing
        famOff[i] = Math.pow(Math.random(), 1.6) * 0.35; }
      famReady = true;
    } catch (e) { console.warn('family drawing skipped:', e.message); }

    // warm SUNRISE glow behind the final (restart) scene — the ending lifts into a dawn
    const sunC = document.createElement('canvas'); sunC.width = sunC.height = 128;
    { const g = sunC.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,228,176,1)'); grd.addColorStop(0.4, 'rgba(255,184,96,0.5)'); grd.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunC), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sun.scale.set(460, 460, 1); sun.position.set(86, 50, -130); scene.add(sun);   // top-right, behind the scene — a sun rising in the corner
    let sunRise = 0;   // time-eased rise progress (so the sun keeps arcing up while you sit at the ending, not just on scroll)

    /* post */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.0); composer.addPass(bloom);
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
      const sweepTone = smoothstep(idx.daemon - 0.5, idx.daemon - 0.05, bf) * (1 - smoothstep(Ne + 0.05, Ne + 0.6, bf));   // green->purple node-sweep: runs daemon -> children -> THROUGH neurotype (under the yellow lobes), fades into panic
      const hexDark = smoothstep(A - 0.6, A - 0.1, bf);   // hexagon goes DARK from attach (bind_partner) onward, like the neurotype base — so the purple sweep + family drawing pop (daemon CUBE stays bright: hexDark=0 there)
      const t0 = targets[ids[i0]], t1 = targets[ids[i1]];
      const cdStagger = (i0 === idx.core_dump);   // street -> cube: convert particles at staggered times for street/cube overlap
      const sxHold = (i0 === idx.syntax_error), sxEase = smoothstep(0.34, 1.0, f);   // hold the complete house briefly (forbidden sits over it) before morphing to the street
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        let x, y, z;
        if (cdStagger) {   // street gathers straight into the blocks at their final SQUARE positions, then the square diffuses into the cube
          const b = tBlock[i];
          const p1 = smoothstep(0.05 + b * 0.06, 0.46 + b * 0.06, f);   // pieces assemble into the square in sequence (one block after another)
          const p3 = smoothstep(0.72, 1.0, f);                         // the filled square then diffuses into the solid cube
          x = lerp(lerp(t0[k], tetSquare[k], p1), t1[k], p3); y = lerp(lerp(t0[k + 1], tetSquare[k + 1], p1), t1[k + 1], p3); z = lerp(lerp(t0[k + 2], tetSquare[k + 2], p1), t1[k + 2], p3);
        } else {
          const e = sxHold ? sxEase : ease;
          x = lerp(t0[k], t1[k], e); y = lerp(t0[k + 1], t1[k + 1], e); z = lerp(t0[k + 2], t1[k + 2], e);
        }
        if (restartFlow > 0) {
          if (i / N >= 0.66) {   // two small fuzzy helixes, one per heartbeat: each springs from a yellow lobe and wraps its child
            const top = (i % 2 === 0) ? 1 : -1, dir = top > 0 ? -1 : 1, v = (((i / N) - 0.66) / 0.34 + t * 0.01) % 1, ang = v * Math.PI * 14 * dir;
            const radBase = smoothstep(0, 0.04, v) * (11 + 12 * v), rad = radBase + Math.sin(t * 0.35 + i * 0.3) * 1.6 * hash[i];   // wider first loop, grows toward the end; gentler shimmer
            const gap = lerp(3, -16, smoothstep(0.96, 1.0, v));   // just-not-touching; cross only at the very end past the heartbeats
            const ay = top * lerp(24, radBase + gap, smoothstep(0.05, 0.4, v));
            x = lerp(x, -74 + v * 156 + Math.sin(t * 0.25 + i) * 1.6, restartFlow); y = lerp(y, ay + Math.sin(ang) * rad, restartFlow); z = lerp(z, Math.cos(ang) * rad, restartFlow);
          } else {   // the hydrogen orbital is ALIVE but CALM: gentle slow swirl + a soft shallow breathe (settled, not frantic)
            const cx = -74, dx = x - cx, a = t * 0.13 + y * 0.012, ca = Math.cos(a), sa = Math.sin(a), br = 1 + 0.035 * Math.sin(t * 0.5 + i * 0.012) * restartFlow;
            const rx = dx * ca - z * sa, rz = dx * sa + z * ca;   // steady swirl; fade the DISPLACEMENT (not the angle) by restartFlow so scrolling in can't sweep through many turns
            x = cx + lerp(dx, rx, restartFlow) * br; z = lerp(z, rz, restartFlow) * br; y = y * br;
          }
        }
        if (pp > 0.05) {                                                     // kernel panic: points shatter individually, not as a connected wobbling slab
          const sh = pp * (1 - restartFlow);                                  // fade the shatter out as restart ramps in -> the two heavy effects never run at full strength together
          x += Math.sin(Math.floor(y / 7) + t * 18) * 22 * hash[i] * sh;      // band tear broken up per-particle (hash) so bands don't move as solid bars
          x += (hash[i] - 0.5) * sh * 56 * (0.5 + 0.5 * Math.sin(t * 26 + i * 7.1));   // flickering per-point datamosh throw (wider = sparser, reads as particles not a cloud)
          y += (hash2[i] - 0.5) * sh * 36;
          z += (hash[i] - 0.5) * sh * 60;
        }
        if (nz > 0.005 && isFwd[i] && hash[i] < 0.6) {                 // a subset of the lit lobe particles tether back to the lattice
          const flatZ = targets.spawn_smurf[k + 2];                    // this particle's flat hexLat z
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.7);       // per-particle phase -> flowing, not a uniform pump
          z = lerp(z, lerp(32, flatZ, pulse), nz);                     // travel between forward lobe (z=32) and the lattice plane, only in the neuro window
        }
        const wob = 1.4 * (1 - 0.6 * pp);                                     // calmer base wobble during panic (less blob-wobble)
        live[k] = x + Math.sin(t * 0.5 + i) * wob; live[k + 1] = y + Math.cos(t * 0.4 + i * 1.3) * wob; live[k + 2] = z + Math.sin(t * 0.3 + i * 0.7) * wob;
      }
      cgeo.attributes.position.needsUpdate = true;
      cloud.rotation.y = Math.sin(t * 0.4) * 0.3 * cen * (1 - restartFlow) * (1 - pp);   // settle -> gentle rotate; no coherent rotation during panic
      cloud.rotation.x = 0;
      if (pp > 0.35 && !cloudStriped) { cmat.map = texDot; cmat.size = isMobile ? 2.2 : 1.9; cmat.needsUpdate = true; cloudStriped = true; }   // panic -> small discrete shattering points (not a red cloud)
      if (pp < 0.2 && cloudStriped) { cmat.map = texHex; cmat.size = isMobile ? 1.7 : 1.5; cmat.needsUpdate = true; cloudStriped = false; }

      // tint / bg / mode
      tmpTint.copy(colOf(VINCENT_TINT, i0)).lerp(colOf(VINCENT_TINT, i1), f); cmat.color.copy(tmpTint).lerp(WHITE, Math.max(bootTone, nz, restTone, smoothstep(0.004, 0.04, sweepTone)));   // white when per-particle colours drive; sweep uses a near-binary ramp so cmat stays white across the WHOLE sweep (no mid-fade product peak = the green/yellow flash on entering neurotype)
      tmpBg.copy(colOf(BEAT_BG, i0)); nextBg.copy(colOf(BEAT_BG, i1)); tmpBg.lerp(nextBg, f); scene.background.copy(tmpBg);
      const lum = 0.2126 * tmpBg.r + 0.7152 * tmpBg.g + 0.0722 * tmpBg.b, light = lum > 0.32;
      document.body.classList.toggle('lum-light', light); setMode(light);
      cmat.opacity = (light ? 0.85 : 0.9) - (light ? 0.16 : 0.32) * bootTone;          // boot: lower opacity so dense cores stay particle-y (less bloom 'vlek'); visibility is gated per-particle by act
      const heartFocus = smoothstep(A - 0.4, A, bf) * (1 - smoothstep(Sm - 0.1, Sm + 0.4, bf));   // gentle dim for Venn read
      cmat.opacity *= (1 - 0.3 * heartFocus);
      cmat.opacity *= (1 - 0.45 * pp);   // panic: dimmer additive so points read as discrete shards, not a glowing red cloud
      cmat.opacity *= (1 - 0.38 * restTone);   // restart: softer / smokier strand + orbital

      // per-particle cloud colour: boot = hydrogen density map (orange core -> purple fringe); neurotype = dim-green hexagon with an orange puzzle piece
      if (bootTone > 0.005) {
        for (let i = 0; i < N; i++) { const k3 = i * 3, act = smoothstep(formOff[i], formOff[i] + FW, bootForm); cCol[k3] = (1 + (bootCol[k3] - 1) * bootTone) * act; cCol[k3 + 1] = (1 + (bootCol[k3 + 1] - 1) * bootTone) * act; cCol[k3 + 2] = (1 + (bootCol[k3 + 2] - 1) * bootTone) * act; }
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (restTone > 0.005) {
        for (let i = 0; i < N; i++) { const k3 = i * 3; cCol[k3] = 1 + (restCol[k3] - 1) * restTone; cCol[k3 + 1] = 1 + (restCol[k3 + 1] - 1) * restTone; cCol[k3 + 2] = 1 + (restCol[k3 + 2] - 1) * restTone; }
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (sweepTone > 0.005) {
        const sweepAmt = smoothstep(idx.daemon - 0.5, idx.daemon - 0.05, bf);               // ramp to full purple sweep BY the daemon centre (was daemon+0.4 = barely 0.1 at centre -> dim purple read as blue)
        for (let i = 0; i < N; i++) { const k3 = i * 3;
          const row = Math.floor((live[k3 + 1] + 60) / 7);                                  // horizontal row by height
          const speed = 0.09 + ((row * 7) % 11) * 0.012;                                    // each row sweeps at its OWN speed
          const band = -56 + ((t * speed + row * 0.17) % 1 + 1) % 1 * 112;
          const dx = live[k3] - band, pulse = Math.exp(-dx * dx / 130) * sweepAmt;
          const baseR = lerp(0.13, 0.045, hexDark), baseG = lerp(0.54, 0.20, hexDark), baseB = lerp(0.31, 0.11, hexDark);   // bright green CUBE (daemon) -> dark green hexagon (attach+), like the neurotype base
          let gr = baseR + (0.78 - baseR) * pulse, gg = baseG + (0.26 - baseG) * pulse, gb = baseB + (1.0 - baseB) * pulse;   // node sweeps to bright purple (pops hard against the dark hexagon)
          if (nz > 0.005 && neuroMask[i]) { gr = lerp(gr, 1.25, nz); gg = lerp(gg, 1.0, nz); gb = lerp(gb, 0.32, nz); }   // neurotype: the lit lobes glow YELLOW over the still-running purple sweep
          cCol[k3] = gr; cCol[k3 + 1] = gg; cCol[k3 + 2] = gb; }   // full strength (cmat is held white across the sweep) — no fade-to-white that would brighten mid-handoff
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (nz > 0.005) {
        for (let i = 0; i < N; i++) { const k3 = i * 3, pz = neuroMask[i]; const tr = pz ? 1.25 : 0.05, tg = pz ? 1.0 : 0.2, tb = pz ? 0.32 : 0.1; cCol[k3] = 1 + (tr - 1) * nz; cCol[k3 + 1] = 1 + (tg - 1) * nz; cCol[k3 + 2] = 1 + (tb - 1) * nz; }   // lobes = bright YELLOW (overdriven), rest = very dim green (does not light up)
        cgeo.attributes.color.needsUpdate = true; neuroDimmed = true;
      } else if (cdStagger) {
        const asm = smoothstep(0.1, 0.5, f) * (1 - smoothstep(0.72, 0.95, f));   // the anomaly piece glows purple in the assembled square, fades as it diffuses into the cube
        for (let i = 0; i < N; i++) { const k3 = i * 3;
          if (tBlock[i] === PURPLE_PIECE) { cCol[k3] = 1; cCol[k3 + 1] = lerp(1, 0.42, asm); cCol[k3 + 2] = lerp(1, 2.2, asm); }   // grey/orange tint * this = violet
          else { cCol[k3] = 1; cCol[k3 + 1] = 1; cCol[k3 + 2] = 1; }
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
        leydi.m.opacity = toIn * 0.9 * (1 - smoothstep(P + 0.1, P + 0.6, bf));
        if (decay > 0.55 && !leydiFrozen) { leydi.m.map = texSnow; leydi.m.needsUpdate = true; leydiFrozen = true; }
        if (decay < 0.4 && leydiFrozen) { leydi.m.map = texHeart; leydi.m.needsUpdate = true; leydiFrozen = false; }
      }

      // children: emerge from cloud at spawn(6), persist, protected, orbit at restart
      // children: own beats (smurf, then boefje); broad ECG heartbeat lanes; calmer at restart
      const orbit = smoothstep(Re - 0.3, Re + 0.1, bf), ampK = lerp(17, 11, orbit), radK = 12;
      const emJ = smoothstep(Sm - 0.4, Sm + 0.1, bf), opJ = smoothstep(Sm - 0.4, Sm - 0.05, bf) * 0.95;
      const emB = smoothstep(Bo - 0.4, Bo + 0.1, bf), opB = smoothstep(Bo - 0.4, Bo - 0.05, bf) * 0.95;
      ribbon(jose, t, 16, ampK, 0.0, radK, emJ, opJ, jOrigin);
      ribbon(ben, t, -16, ampK, 0.5, radK, emB, opB, bOrigin);

      // forbidden sign: grows over the house at the syntax_error centre (in front, toward camera), recedes into the street morph
      {
        const sx = idx.syntax_error;
        const appear = smoothstep(sx - 0.05, sx + 0.12, bf);                       // grows over the held house
        const cloud = smoothstep(sx + 0.16, sx + 0.5, bf);                         // drifts up into a purple CLOUD above the street
        const fallPhase = smoothstep(sx + 0.5, sx + 1.05, bf);                     // then RAINS down onto the street (not a fade)
        if (appear > 0.001) {
          const sc = 0.55 + 0.45 * appear;
          for (let i = 0; i < NF; i++) {
            const fx = forbidPos[i * 3] * sc, fy = forbidPos[i * 3 + 1] * sc, fz = forbidPos[i * 3 + 2] * sc + 16;
            const cx = (hash[i] - 0.5) * 150, cy = 26 + (hash2[i] - 0.5) * 24, cz = (hash2[i] - 0.5) * 50;   // cloud target above the landscape
            const started = clamp01((fallPhase - hash[i] * 0.5) * 2.2);           // per-drop staggered START of the fall (scroll-driven)
            const spd = 0.17 + hash2[i] * 0.6;                                    // each drop's OWN fall speed
            const cyc = ((t * spd + hash[i] * 9.17) % 1 + 1) % 1;                 // continuous TIME-based sawtooth: the drop falls, wraps at the ground, repeats — real individual drops, not a scroll-locked sheet
            const yTop = 30 + (hash2[i] - 0.5) * 24, yBot = -46 + (hash[i] - 0.5) * 12, driftX = (hash2[i] - 0.5) * 16 * started;
            const rainY = lerp(yTop, yBot, cyc);
            forbid.pos[i * 3] = lerp(lerp(fx, cx, cloud), cx + driftX + Math.sin(t * 0.6 + i) * 0.6, started);
            forbid.pos[i * 3 + 1] = lerp(lerp(fy, cy, cloud), rainY + Math.cos(t * 0.5 + i) * 0.3, started);
            forbid.pos[i * 3 + 2] = lerp(fz, cz, cloud);
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
        const famIn = smoothstep(P + 0.02, P + 0.24, bf);                    // appears fast, right out of the explosion
        const famVis = famIn * (1 - smoothstep(Re - 0.2, Re + 0.12, bf));    // holds briefly, fades as the restart scene forms
        const swap = smoothstep(P + 0.3, P + 0.7, bf);                       // then the partner dissolves -> -3
        if (famVis > 0.002) {
          for (let i = 0; i < NFam; i++) { const k = i * 3, act = smoothstep(famOff[i], famOff[i] + 0.4, famIn);   // staggered per-particle stream-in
            family.pos[k]     = lerp(famOrigin[k],     famT[k],     act) + Math.sin(t * 0.5 + i) * 0.6;
            family.pos[k + 1] = lerp(famOrigin[k + 1], famT[k + 1], act) + Math.cos(t * 0.4 + i) * 0.6;
            family.pos[k + 2] = lerp(famOrigin[k + 2], famT[k + 2], act);
            const a = famGone[i] ? (1 - swap) : 1;                            // partner particles fade out at the break; everyone else stays at full
            fCol[k] = FAM_PURP[0] * a; fCol[k + 1] = FAM_PURP[1] * a; fCol[k + 2] = FAM_PURP[2] * a;
          }
          family.g.attributes.position.needsUpdate = true; family.g.attributes.color.needsUpdate = true;
        }
        family.m.opacity = famVis * 0.78;
      }

      // backdrop nest: faint green hex lattice behind the restart orbital with a slow green->purple->green node-sweep
      if (restTone > 0.005) {
        for (let i = 0; i < NB; i++) { const k = i*3, by = backdrop.pos[k+1];
          const row = Math.floor((by + 50) / 7), speed = 0.07 + ((row * 7) % 11) * 0.011;
          const band = -56 + ((t * speed + row * 0.17) % 1 + 1) % 1 * 112;
          const dxb = backdrop.pos[k] + 74 - band, pulse = Math.exp(-dxb * dxb / 130);   // moving sweep band across the nest
          bCol[k] = 0.13 + 0.50 * pulse; bCol[k+1] = 0.54 - 0.34 * pulse; bCol[k+2] = 0.31 + 0.52 * pulse;   // green 0x218b42 -> purple -> green
        }
        backdrop.g.attributes.color.needsUpdate = true;
      }
      backdrop.m.opacity = restTone * 0.42;   // faint, behind the orbital

      // bloom + glitch (no camera shake)
      bloom.strength = light ? 0.04 : Math.max(0.12, 0.6 - 0.36 * bootTone - 0.22 * nz - 0.26 * Math.max(0, hexDark - nz) + 0.18 * smoothstep(Re - 0.4, Re, bf) - 0.4 * pp);   // softer bloom at restart + less at boot/panic; dark-hexagon beats (attach+) get the SAME bloom cut as neurotype so the green matches (was: full bloom made the same green look brighter)
      rgb.uniforms.amount.value = pp * (0.006 + vel * 0.006);   // stronger glitch at panic
      { sunRise += ((restTone > 0.4 ? 1 : 0) - sunRise) * 0.012; const ang = lerp(-0.95, 0.66, sunRise); sun.position.x = 12 + Math.cos(ang) * 100; sun.position.y = -22 + Math.sin(ang) * 100; sun.material.opacity = smoothstep(Re - 0.6, Re, bf) * (0.46 + 0.05 * Math.sin(t * 0.6)); }   // the sun ARCS up on an orbit over time (low-right -> top-right), visibly rising while you're at the ending

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
