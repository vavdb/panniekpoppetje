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
    if (m) { cur = { id: m[1], tag: m[2], sig: '', doc: [] }; beats.push(cur); field = null; continue; }
    if (/^<!--\s*footer\s*-->/.test(line)) { cur = { id: 'footer', tag: '', sig: '', doc: [] }; footer = cur; field = null; continue; }
    if (/^<!--/.test(line)) continue;
    if (line.trim() === '::sig') { field = 'sig'; continue; }
    if (line.trim() === '::doc') { field = 'doc'; continue; }
    if (!cur || !field) continue;
    if (field === 'sig') { if (line.trim()) cur.sig += (cur.sig ? '\n' : '') + line.trim(); }
    else cur.doc.push(line);
  }
  for (const b of [...beats, footer].filter(Boolean)) {
    while (b.doc.length && !b.doc[0].trim()) b.doc.shift();
    while (b.doc.length && !b.doc[b.doc.length - 1].trim()) b.doc.pop();
  }
  return { beats, footer };
}
let uptimeEl = null;
function buildDOM({ beats, footer }) {
  const root = document.getElementById('beats');
  beats.forEach((b) => {
    const sec = document.createElement('section'); sec.className = 'beat'; sec.id = 'beat-' + b.id;
    const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = b.tag; sec.appendChild(tag);
    const sig = document.createElement('h2'); sig.className = 'sig'; sig.textContent = b.sig; sec.appendChild(sig);
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
      if (/Vincability|OnlyVince/i.test(l)) {
        d.innerHTML = l.replace('Vincability', '<a href="https://vincability.com" target="_blank" rel="noopener">Vincability</a>')
          .replace('OnlyVince.net', '<a href="https://onlyvince.net" target="_blank" rel="noopener">OnlyVince.net</a>');
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
function heart(a) { const s = 2.1; const x = 16 * Math.pow(Math.sin(a), 3); const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [x * s, y * s + 6, 0]; }
const gauss = (p, mu, sd) => Math.exp(-Math.pow((p - mu) / sd, 2));
function ecg(p) { return 0.12 * gauss(p, 0.32, 0.035) - 0.18 * gauss(p, 0.47, 0.012) + 1.0 * gauss(p, 0.5, 0.012) - 0.28 * gauss(p, 0.54, 0.014) + 0.22 * gauss(p, 0.68, 0.045); }

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
    boot: () => { const r = Math.sqrt(Math.random()) * 13; const a = Math.floor(Math.random() * 6) * Math.PI / 3 + rand(-0.28, 0.28); return [Math.cos(a) * r, Math.sin(a) * r, rand(-7, 7)]; },   // dense fluffy hexagon (baby)
    syntax_error: (i) => { if (i % 5 === 0) { const t = (i / N) * 2 - 1; return [t * 42, t * 42, rand(-3, 3)]; } const a = (i / N) * Math.PI * 2, r = 42 + rand(-2, 2); return [Math.cos(a) * r, Math.sin(a) * r, rand(-3, 3)]; },
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
    restart: (i) => { const u = i / N, ang = u * Math.PI * 18; return [(u - 0.5) * 150, Math.sin(ang) * 22, Math.cos(ang) * 22]; },   // helix enveloping the two heartbeats
  };
  ids.forEach(id => { T[id] = fill(gens[id] || gens.boot); });
  // hexagon derived from the daemon lattice -> per-particle correlated, so daemon->hexagon morphs cleanly (no centre blob)
  const D = T.daemon, hexLat = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x = D[i * 3] * 0.72, y = D[i * 3 + 1] * 0.72;
    if (!hexInside(x, y, 34)) { const a = Math.atan2(y, x), seg = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6, rad = 34 * (Math.cos(Math.PI / 6) / Math.cos(seg)); x = Math.cos(a) * rad; y = Math.sin(a) * rad; }
    hexLat[i * 3] = x - 8; hexLat[i * 3 + 1] = y; hexLat[i * 3 + 2] = D[i * 3 + 2] * 0.4;
  }
  T.attach = hexLat; T.spawn_smurf = hexLat; T.spawn_boefje = hexLat;
  // neurotype: keep the hexagon, push 3 wedges forward (brighter via proximity to camera)
  const neuro = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const x = hexLat[i * 3], y = hexLat[i * 3 + 1], ang = Math.atan2(y, x + 8), r = Math.hypot(x + 8, y);
    const wedge = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 6) % 6, fwd = (wedge === 0 || wedge === 2 || wedge === 4) && r > 14;
    neuro[i * 3] = x; neuro[i * 3 + 1] = y; neuro[i * 3 + 2] = fwd ? 32 : hexLat[i * 3 + 2];
  }
  T.neurotype_export = neuro;
  return T;
}

const VINCENT_TINT = { boot: 0xe67e22, syntax_error: 0xb23bff, core_dump: 0x9a9aa2, bootstrap: 0xe67e22, daemon: 0xe67e22, attach: 0xe67e22, spawn_smurf: 0xe67e22, spawn_boefje: 0xe67e22, neurotype_export: 0xffb066, kernel_panic: 0xff3b3b, restart: 0xe67e22 };
const BEAT_BG = { boot: 0x070708, syntax_error: 0x08070a, core_dump: 0x070a0d, bootstrap: 0x0a0708, daemon: 0x08090c, attach: 0x0a080e, spawn_smurf: 0x0b0809, spawn_boefje: 0x0a0a0c, neurotype_export: 0x0d0a0e, kernel_panic: 0x020203, restart: 0x0b1a33 };

(async function main() {
  try {
    const content = await loadContent();
    const nBeats = buildDOM(content);
    const ids = content.beats.map(b => b.id);
    const idx = {}; ids.forEach((id, i) => idx[id] = i);
    const A = idx.attach, P = idx.kernel_panic, Sm = idx.spawn_smurf, Bo = idx.spawn_boefje, Ne = idx.neurotype_export, Re = idx.restart, Bs = idx.bootstrap;
    const isMobile = window.innerWidth < 768;
    const N = isMobile ? 3500 : 9000, NL = isMobile ? 800 : 1700, NK = isMobile ? 280 : 560;

    const canvas = document.getElementById('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(BEAT_BG.boot);
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000); camera.position.set(0, 0, 130);

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

    /* entity factory */
    function ent(n, tex, color, size, blend = THREE.AdditiveBlending) {
      const pos = new Float32Array(n * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ map: tex, color, size, transparent: true, opacity: 0, blending: blend, depthWrite: false, alphaTest: 0.02, sizeAttenuation: true });
      const p = new THREE.Points(g, m); scene.add(p); return { p, pos, m, g, n };
    }
    const COL = { vincent: 0xe67e22, leydi: 0xff7ac1, leydiCold: 0x3a7bff, jose: 0xff5147, ben: 0x2e7bff };
    const cPink = new THREE.Color(COL.leydi), cCold = new THREE.Color(COL.leydiCold);
    const leydi = ent(NL, texHeart, COL.leydi, isMobile ? 2.4 : 2.2);
    const jose = ent(NK, texCircle, COL.jose, isMobile ? 3.0 : 2.8);
    const ben = ent(NK, texSquare, COL.ben, isMobile ? 3.0 : 2.8);
    // continual slow influx: grey 'static' particles falling into the child (boot)
    const NIF = isMobile ? 400 : 760;
    const infall = ent(NIF, texDot, 0xccccd4, isMobile ? 3.6 : 4.2);
    const ifx = new Float32Array(NIF), ify = new Float32Array(NIF), ifz = new Float32Array(NIF), ifS = new Float32Array(NIF), ifT = new Int32Array(NIF);
    const ifhx = new Float32Array(NIF), ifhy = new Float32Array(NIF), ifhz = new Float32Array(NIF);   // roaming 'home' field
    const ifSpawn = (i) => { const a = rand(0, Math.PI * 2), r = rand(120, 185); ifx[i] = Math.cos(a) * r; ify[i] = Math.sin(a) * r * 0.8; ifz[i] = rand(-45, 45); ifT[i] = (Math.random() * N) | 0; ifS[i] = rand(0.3, 0.8); };
    for (let i = 0; i < NIF; i++) { ifhx[i] = rand(-150, 150); ifhy[i] = rand(-85, 85); ifhz[i] = rand(-45, 45); ifSpawn(i); ifx[i] = ifhx[i]; ify[i] = ifhy[i]; ifz[i] = ifhz[i]; }
    const upEl = document.getElementById('uptime');
    const woven = []; const lA = new Float32Array(NL), lR = new Float32Array(NL);
    for (let i = 0; i < NL; i++) { woven.push(inSphere(44)); lA[i] = Math.random() * Math.PI * 2; lR[i] = Math.sqrt(Math.random()); }
    // filled heart silhouette via implicit curve (x^2+y^2-1)^3 - x^2 y^3 < 0
    const heartFill = [];
    while (heartFill.length < NL) { const x = rand(-1.4, 1.4), y = rand(-1.3, 1.4); if (Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y < 0) heartFill.push([x * 28, y * 28 + 4]); }
    // children originate from elements INSIDE the heart (x=14) and the Vincent hexagon-cloud (x=-8)
    const mkOrigin = (n) => { const s = new Float32Array(n * 3); for (let i = 0; i < n; i++) { if (i % 2 === 0) { const h = heartFill[i % heartFill.length]; s[i * 3] = 14 + h[0] * 0.7; s[i * 3 + 1] = h[1] * 0.7; s[i * 3 + 2] = rand(-4, 4); } else { const p = inSphere(20); s[i * 3] = -8 + p[0]; s[i * 3 + 1] = p[1]; s[i * 3 + 2] = p[2]; } } return s; };
    const jOrigin = mkOrigin(NK), bOrigin = mkOrigin(NK);
    let leydiFrozen = false;

    /* post */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.0); composer.addPass(bloom);
    const rgb = new ShaderPass(RGBShiftShader); rgb.uniforms.amount.value = 0; composer.addPass(rgb);

    /* scroll */
    const lenis = new Lenis({ smoothWheel: true, lerp: 0.08 }); window.__lenis = lenis;
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
      const cloudShow = smoothstep(idx.boot - 0.26, idx.boot + 0.04, bf);   // boot forms only after the infall is fully running (birth FROM the infall)
      const puff = (i0 === Bs) ? Math.sin(Math.PI * f) : 0;                // cloudish in-between step on bootstrap -> daemon
      const t0 = targets[ids[i0]], t1 = targets[ids[i1]];
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        let x = lerp(t0[k], t1[k], ease), y = lerp(t0[k + 1], t1[k + 1], ease), z = lerp(t0[k + 2], t1[k + 2], ease);
        if (puff > 0.001) { x += Math.sin(i * 1.3) * puff * 34; y += Math.cos(i * 2.1) * puff * 34; z += Math.sin(i * 0.7) * puff * 34; }
        if (restartFlow > 0) { const u = ((i / N) + t * 0.05) % 1, ang = u * Math.PI * 18; x = lerp(x, (u - 0.5) * 150, restartFlow); y = lerp(y, Math.sin(ang) * 22, restartFlow); z = lerp(z, Math.cos(ang) * 22, restartFlow); }   // particles flow THROUGH the helix
        if (pp > 0.05) x += Math.sin(Math.floor(y / 7) + t * 18) * pp * 22;   // glitch: horizontal band tear
        live[k] = x + Math.sin(t * 0.5 + i) * 1.4; live[k + 1] = y + Math.cos(t * 0.4 + i * 1.3) * 1.4; live[k + 2] = z + Math.sin(t * 0.3 + i * 0.7) * 1.4;
      }
      cgeo.attributes.position.needsUpdate = true;
      cloud.rotation.y = Math.sin(t * 0.4) * 0.3 * cen * (1 - restartFlow);   // settle -> gentle rotate; helix itself stays put
      cloud.rotation.x = 0;
      if (pp > 0.35 && !cloudStriped) { cmat.map = texStripe; cmat.size = isMobile ? 3.8 : 3.6; cmat.needsUpdate = true; cloudStriped = true; }   // panic -> bigger stripe particles
      if (pp < 0.2 && cloudStriped) { cmat.map = texHex; cmat.size = isMobile ? 1.7 : 1.5; cmat.needsUpdate = true; cloudStriped = false; }

      // tint / bg / mode
      tmpTint.copy(colOf(VINCENT_TINT, i0)).lerp(colOf(VINCENT_TINT, i1), f); cmat.color.copy(tmpTint);
      tmpBg.copy(colOf(BEAT_BG, i0)); nextBg.copy(colOf(BEAT_BG, i1)); tmpBg.lerp(nextBg, f); scene.background.copy(tmpBg);
      const lum = 0.2126 * tmpBg.r + 0.7152 * tmpBg.g + 0.0722 * tmpBg.b, light = lum > 0.32;
      document.body.classList.toggle('lum-light', light); setMode(light);
      cmat.opacity = (light ? 0.85 : 0.92) * cloudShow;
      const heartFocus = smoothstep(A - 0.4, A, bf) * (1 - smoothstep(Sm - 0.1, Sm + 0.4, bf));   // gentle dim for Venn read
      cmat.opacity *= (1 - 0.3 * heartFocus);

      // Leydi: heart flies IN from outside the viewport -> FILLED heart -> re-tighten -> EXPLODE (the break)
      {
        const HX = 14;                                                  // heart sits right, partially overlaps Vincent hexagon
        const toIn = smoothstep(A - 0.85, A - 0.12, bf);                // particles arrive from off-screen
        const toHeart = smoothstep(A - 0.32, A + 0.05, bf);
        const tight = lerp(1, 0.72, smoothstep(P - 0.5, P - 0.12, bf));
        const decay = smoothstep(P - 1.3, P - 0.2, bf);                // colour-shift + disintegration BEFORE the break
        const eP = smoothstep(P - 0.12, P + 0.18, bf);                 // explodes at kernel panic
        const beatPulse = 1 + 0.06 * Math.sin(t * 4);
        for (let i = 0; i < NL; i++) {
          const ang = lA[i]; const hf = heartFill[i];
          const ox = Math.cos(ang) * 240, oy = Math.sin(ang) * 240;     // off-screen origin
          const rx = HX + Math.cos(ang) * 48, ry = Math.sin(ang) * 48;  // ring midpoint
          const dil = 1 + decay * 0.9;                                  // dilate (grow/dilute) before exploding
          const fx = HX + hf[0] * tight * dil, fy = hf[1] * tight * dil;  // FILLED heart silhouette
          const pulse = toHeart > 0.5 ? beatPulse : 1;
          const midx = lerp(rx, fx, toHeart) * pulse, midy = lerp(ry, fy, toHeart) * pulse;
          let tx = lerp(ox, midx, toIn), ty = lerp(oy, midy, toIn), tz = lerp(0, lerp(8, 0, toHeart), toIn);
          tx += Math.sin(t * 1.6 + i * 1.7) * decay * 16; ty += Math.cos(t * 1.4 + i * 2.1) * decay * 16; tz += Math.sin(t * 1.1 + i) * decay * 16;   // disintegrate
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
      }
      infall.g.attributes.position.needsUpdate = true;
      const startVis = 1 - smoothstep(idx.boot + 0.4, idx.boot + 1.4, bf);   // bright through start+boot, dim after
      infall.m.opacity = (0.16 + 0.74 * Math.max(startVis, wander)) * (0.85 + 0.15 * Math.abs(Math.sin(t * 30)));

      // bloom + glitch (no camera shake)
      bloom.strength = light ? 0.04 : (0.6 + 0.6 * Math.max(smoothstep(Ne - 0.6, Ne, bf) - smoothstep(Ne, Ne + 0.8, bf), 0) + 0.5 * smoothstep(Re - 0.4, Re, bf) + 0.7 * pp);
      rgb.uniforms.amount.value = pp * (0.006 + vel * 0.006);   // stronger glitch at panic

      // uptime
      if (upEl) { const now = new Date(); let y = now.getFullYear() - 1980; const an = new Date(now.getFullYear(), 1, 18); if (now < an) y--; const base = new Date(now.getFullYear() - (now < an ? 1 : 0), 1, 18); const ms = now - base, dd = Math.floor(ms / 86400000), r = ms - dd * 86400000, hh = Math.floor(r / 3600000), mm = Math.floor(r % 3600000 / 60000), ss = Math.floor(r % 60000 / 1000); upEl.textContent = `uptime ${y}y ${dd}d ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; }

      // text: blur active sig by (1-c), measurement pulse on rising c
      document.querySelectorAll('.beat').forEach((el, i) => {
        if (i === active) { const sig = el.querySelector('.sig'); if (sig) sig.style.filter = `blur(${(1 - cen) * 6}px)`; }
        if (i === active && cen > 0.5 && !measured[i]) { el.classList.add('measured'); measured[i] = true; }
        if (i === active && cen < 0.2 && measured[i]) { el.classList.remove('measured'); measured[i] = false; }
      });

      composer.render();
      requestAnimationFrame(frame);
    }

    function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); calcCenters(); }
    addEventListener('resize', onResize); calcCenters(); addEventListener('load', calcCenters); setTimeout(calcCenters, 600);
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf); requestAnimationFrame(frame);
  } catch (e) { fail(e.message || String(e)); }
})();
