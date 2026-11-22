// PALMERA HEAT - world generation (original city: Palmera Bay)
import * as THREE from 'three';

export const W = { nodes: [], edges: [], blocks: [], raised: [], colliders: [], parking: [], places: {}, nightMats: [], lamps: [], signals: [] };
const XS = [-560, -420, -280, -140, 0, 140, 280], ZS = [-420, -280, -140, 0, 140, 280, 420];
W.XS = XS; W.ZS = ZS;
W.bounds = { x0: -760, x1: 1120, z0: -660, z1: 660 };

let seed = 20261;
function R() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const rr = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)];
const colCache = {};
function C(hex) { return colCache[hex] || (colCache[hex] = new THREE.Color(hex)); }

const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const UBOX = new THREE.BoxGeometry(1, 1, 1), UCYL = new THREE.CylinderGeometry(1, 1, 1, 10), UCONE = new THREE.ConeGeometry(1, 1, 10), USPH = new THREE.IcosahedronGeometry(1, 1);
const UV0 = [[0, 0], [1, 0], [1, 1], [0, 1]];
const YAX = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);

export class Batch {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.ix = []; this.vc = 0; }
  quad(a, b, c, d, n, col, uv) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let k = 0; k < 4; k++) { this.n.push(n[0], n[1], n[2]); this.c.push(col.r, col.g, col.b); }
    uv = uv || UV0; for (let k = 0; k < 4; k++) this.u.push(uv[k][0], uv[k][1]);
    const v = this.vc; this.ix.push(v, v + 1, v + 2, v, v + 2, v + 3); this.vc += 4;
  }
  geo(g, m, col) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv; _nm.getNormalMatrix(m);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); this.n.push(_v.x, _v.y, _v.z);
      if (uv) this.u.push(uv.getX(i), uv.getY(i)); else this.u.push(0, 0);
      this.c.push(col.r, col.g, col.b);
    }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) this.ix.push(this.vc + ia[i]); }
    else for (let i = 0; i < pos.count; i++) this.ix.push(this.vc + i);
    this.vc += pos.count;
  }
  prim(g, cx, cy, cz, sx, sy, sz, col, ry = 0) {
    _q.setFromAxisAngle(YAX, ry); _m.compose(_p.set(cx, cy, cz), _q, _s.set(sx, sy, sz)); this.geo(g, _m, col);
  }
  box(cx, cy, cz, sx, sy, sz, col, ry = 0) { this.prim(UBOX, cx, cy, cz, sx, sy, sz, col, ry); }
  cyl(cx, cy, cz, r, h, col) { this.prim(UCYL, cx, cy, cz, r, h, r, col); }
  cone(cx, cy, cz, r, h, col) { this.prim(UCONE, cx, cy, cz, r, h, r, col); }
  sph(cx, cy, cz, r, col, sy = 1) { this.prim(USPH, cx, cy, cz, r, r * sy, r, col); }
  beam(p0, p1, w, h, col) {
    const d = new THREE.Vector3().subVectors(p1, p0), len = d.length(); d.normalize();
    const x = new THREE.Vector3().crossVectors(YAX, d); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize(); const y = new THREE.Vector3().crossVectors(d, x);
    _m.makeBasis(x, y, d); _m.scale(_s.set(w, h, len)); _m.setPosition((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2); this.geo(UBOX, _m, col);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.ix); return g;
  }
  mesh(mat, cast = true, recv = true) { const m = new THREE.Mesh(this.geometry(), mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
}

function tex(w, h, draw, aniso = 8) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; return t;
}
function noise(g, w, h, n, a) { for (let i = 0; i < n; i++) { const v = R() < .5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${R() * a})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } }

// ---------- facade textures (4 bays x 4 floors) ----------
function facade(kind) {
  const lit = [];
  const map = tex(256, 256, (g) => {
    if (kind === 'glass') {
      g.fillStyle = '#dfe9ee'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const l = 150 + R() * 70; const gr = g.createLinearGradient(0, y * 64, 0, y * 64 + 64);
        gr.addColorStop(0, `rgb(${l - 40},${l - 15},${l})`); gr.addColorStop(1, `rgb(${l - 5},${l + 15},${l + 30})`);
        g.fillStyle = gr; g.fillRect(x * 64 + 2, y * 64 + 3, 60, 58); lit.push([x * 64 + 2, y * 64 + 3, 60, 58]);
      }
      g.fillStyle = '#f4f6f6'; for (let y = 0; y <= 4; y++) g.fillRect(0, y * 64 - 3, 256, 6);
    } else if (kind === 'office') {
      g.fillStyle = '#e4dfd4'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 500, .06);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = '#26384a'; g.fillRect(x * 64 + 10, y * 64 + 12, 44, 38); g.fillStyle = '#5d7e99'; g.fillRect(x * 64 + 10, y * 64 + 12, 44, 10); g.fillStyle = '#f8f5ee'; g.fillRect(x * 64 + 7, y * 64 + 50, 50, 4); lit.push([x * 64 + 10, y * 64 + 12, 44, 38]); }
    } else if (kind === 'deco') {
      g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 300, .04);
      for (let y = 0; y < 4; y++) { g.fillStyle = '#2b4458'; g.fillRect(0, y * 64 + 16, 256, 30); for (let x = 0; x < 8; x++) { g.fillStyle = '#f6f2ea'; g.fillRect(x * 32 + 28, y * 64 + 16, 5, 30); lit.push([x * 32 + 1, y * 64 + 17, 26, 28]); } g.fillStyle = '#ffffff'; g.fillRect(0, y * 64 + 48, 256, 5); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y * 64 + 53, 256, 3); g.fillStyle = '#6fb0c8'; g.fillRect(0, y * 64 + 16, 256, 5); }
    } else if (kind === 'apt') {
      g.fillStyle = '#e9e1d2'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 400, .05);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = '#2a3a4c'; g.fillRect(x * 64 + 8, y * 64 + 10, 22, 34); g.fillRect(x * 64 + 36, y * 64 + 14, 20, 24); lit.push([x * 64 + 8, y * 64 + 10, 22, 34]); lit.push([x * 64 + 36, y * 64 + 14, 20, 24]); g.fillStyle = '#b9b3a6'; g.fillRect(x * 64 + 3, y * 64 + 44, 32, 3); for (let k = 0; k < 6; k++) g.fillRect(x * 64 + 4 + k * 6, y * 64 + 44, 2, 12); g.fillRect(x * 64 + 3, y * 64 + 56, 32, 3); }
    } else if (kind === 'shop') {
      g.fillStyle = '#efe9dd'; g.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 2; x++) { const gr = g.createLinearGradient(0, 60, 0, 256); gr.addColorStop(0, '#34506a'); gr.addColorStop(1, '#7fa6bd'); g.fillStyle = gr; g.fillRect(x * 128 + 8, 70, 76, 150); g.fillRect(x * 128 + 92, 70, 30, 186); lit.push([x * 128 + 8, 70, 76, 150]); lit.push([x * 128 + 92, 70, 30, 186]); g.fillStyle = '#3a3a3a'; g.fillRect(x * 128 + 88, 66, 4, 190); g.fillRect(x * 128 + 6, 66, 118, 5); g.fillStyle = '#c9c2b2'; g.fillRect(x * 128 + 4, 220, 84, 36); }
    } else { // metal
      g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 8) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, 0, 3, 256); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 4, 0, 2, 256); } noise(g, 256, 256, 600, .06);
    }
  });
  const em = tex(256, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    for (const l of lit) { const r = R(); if (kind === 'shop' || r < 0.42) { g.fillStyle = kind === 'shop' ? '#ffe9c0' : (r < 0.3 ? `rgba(255,${205 + R() * 40 | 0},${130 + R() * 60 | 0},${0.5 + R() * 0.5})` : 'rgba(170,215,255,.75)'); g.fillRect(l[0], l[1], l[2], l[3]); } }
  });
  return { map, em };
}

export function buildWorld(scene) {
  const B = {}; for (const k of ['flat', 'glass', 'office', 'deco', 'apt', 'shop', 'metal', 'road', 'hwy', 'inter', 'walk', 'grass', 'sand', 'lot', 'sign', 'neon', 'win', 'pool']) B[k] = new Batch();
  const TW = { glass: 12, office: 14, deco: 14, apt: 16, shop: 16, metal: 12 }, TH = { glass: 12, office: 13, deco: 13, apt: 12.5, shop: 4.6, metal: 10 };
  const palms = [], trees = [], lamps = [], sigs = [];

  // ---------- colliders ----------
  const CELL = 50, grid = new Map();
  function addCol(x0, x1, z0, z1, h, t = 'b') {
    const c = { x0, x1, z0, z1, h, t }; W.colliders.push(c);
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = i * 1000 + j; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); }
    return c;
  }
  const res = { x: 0, z: 0, hit: false, nx: 0, nz: 0, col: null };
  W.collideCircle = function (x, z, r, y = 0, solid = false) {
    res.hit = false; res.col = null;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = grid.get(i * 1000 + j); if (!a) continue;
      for (let k = 0; k < a.length; k++) {
        const c = a[k]; if (y > c.h || (solid && c.t !== 'b')) continue;
        const cx = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x, cz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
        let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); dx /= d; dz /= d; x += dx * (r - d); z += dz * (r - d); res.nx = dx; res.nz = dz; }
        else { const a0 = x - c.x0, a1 = c.x1 - x, b0 = z - c.z0, b1 = c.z1 - z, m = Math.min(a0, a1, b0, b1);
          if (m === a0) { x = c.x0 - r; res.nx = -1; res.nz = 0; } else if (m === a1) { x = c.x1 + r; res.nx = 1; res.nz = 0; } else if (m === b0) { z = c.z0 - r; res.nx = 0; res.nz = -1; } else { z = c.z1 + r; res.nx = 0; res.nz = 1; } }
        res.hit = true; res.col = c;
      }
    }
    res.x = x; res.z = z; return res;
  };
  W.rayCast = function (ox, oy, oz, dx, dy, dz, maxD, solidOnly) {
    let best = maxD; const cs = W.colliders;
    for (let k = 0; k < cs.length; k++) {
      const c = cs[k]; if (solidOnly && c.t !== 'b') continue;
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-6) { if (ox < c.x0 || ox > c.x1) continue; } else { let a = (c.x0 - ox) / dx, b = (c.x1 - ox) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-6) { if (oz < c.z0 || oz > c.z1) continue; } else { let a = (c.z0 - oz) / dz, b = (c.z1 - oz) / dz; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
      if (Math.abs(dy) < 1e-6) { if (oy < 0 || oy > c.h) continue; } else { let a = (0 - oy) / dy, b = (c.h - oy) / dy; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
      if (t0 < best) best = t0;
    }
    return best;
  };
  W.los = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz); if (d < 1) return true; return W.rayCast(ax, 1.4, az, dx / d, 0, dz / d, d, true) >= d - 0.5; };

  // ---------- heights ----------
  const bridgeH = x => 0.05 + 11 * Math.sin(Math.PI * (x - 375) / 300);
  W.groundH = function (x, z) {
    if (x > 375 && x < 675 && Math.abs(z + 420) < 12.2) return bridgeH(x);
    if (x > 362 && x < 484 && Math.abs(z - 140) < 12) return 0.9;
    if (x > 600) { const ex = (x - 850) / 190, ez = (z + 420) / 150, er = ex * ex + ez * ez; if (er < 0.85) return 0; if (er < 1.2) return -3.5 * (er - 0.85) / 0.35; return -3.5; }
    if (x < -650 || z < -500 || z > 500) return -3.5;
    if (x > 370) return x < 415 ? 0.2 - (x - 370) / 45 * 3.7 : -3.5;
    const ra = W.raised; for (let k = 0; k < ra.length; k++) { const r = ra[k]; if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return 0.2; }
    return 0;
  };
  W.zoneAt = function (x, z) {
    if (x > 372 && x < 678 && Math.abs(z + 420) < 14) return 'Sunspan Bridge';
    if (x > 640) return 'Isla Corona';
    if (x > 360 && Math.abs(z - 140) < 14) return 'Lucky Gull Pier';
    if (x > 286) return 'Costa Azul Beach';
    if (z < -400 || x < -545) return 'Gulfline Highway';
    if (x > 140) return 'Sol Strand';
    if (x > 0) return (z > -140 && z < 0) ? 'Egret Park' : 'Mercado';
    if (x > -280) return (z > -280 && z < 140) ? 'Midtown Spires' : (z > 280 ? 'Bayview Flats' : 'Mercado');
    return z > 140 ? 'Port Palmera' : 'Hibiscus Heights';
  };

  // ---------- helpers ----------
  function topQuad(b, x0, x1, z0, z1, y, tile, col) { b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], col || C(0xffffff), [[x0 / tile, z1 / tile], [x1 / tile, z1 / tile], [x1 / tile, z0 / tile], [x0 / tile, z0 / tile]]); }
  function walls(b, x0, x1, z0, z1, y0, y1, tw, th, col) {
    const ux = Math.max(1, Math.round((x1 - x0) / tw * 2) / 2), uz = Math.max(1, Math.round((z1 - z0) / tw * 2) / 2), v = Math.max(0.25, Math.round((y1 - y0) / th * 4) / 4);
    b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, [[0, 0], [ux, 0], [ux, v], [0, v]]);
    b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, [[0, 0], [ux, 0], [ux, v], [0, v]]);
    b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, [[0, 0], [uz, 0], [uz, v], [0, v]]);
    b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, [[0, 0], [uz, 0], [uz, v], [0, v]]);
  }
  function building(x0, x1, z0, z1, h, type, col, roofCol) {
    walls(B[type], x0, x1, z0, z1, 0.2, h, TW[type], TH[type], col);
    topQuad(B.flat, x0, x1, z0, z1, h, 1, C(roofCol || 0x6a6d70));
    B.flat.box((x0 + x1) / 2, h + 0.25, z0 + 0.2, x1 - x0, 0.9, 0.4, C(0xdedede)); B.flat.box((x0 + x1) / 2, h + 0.25, z1 - 0.2, x1 - x0, 0.9, 0.4, C(0xdedede));
    B.flat.box(x0 + 0.2, h + 0.25, (z0 + z1) / 2, 0.4, 0.9, z1 - z0, C(0xdedede)); B.flat.box(x1 - 0.2, h + 0.25, (z0 + z1) / 2, 0.4, 0.9, z1 - z0, C(0xdedede));
    addCol(x0, x1, z0, z1, h);
  }
  const SIGNS = ['GATOR GUNS', 'MOJO MOTORS', 'BAY BURGER', "TIKI TOM'S", 'FLAMINGO LIQUOR', 'SUNDROP PHARMACY', 'COCO LOCO', 'PELICAN PAWN', 'CORAL CROWN', 'PALMERA GENERAL', 'P.B.P.D.', 'SPLASH COLA', 'WAVE 99 FM', 'FLY PALMERA', "CARMELA'S DINER", 'SURF SHACK', '24/7 MART', 'TACO TIDE', 'NEON LANES', 'CLUB MIRAGE', 'LAUNDROMAT', 'INK & ANCHOR', 'EL SOL BANK', 'HOTEL MARISOL', 'THE PELICAN', 'AZURE SUITES', 'PORT PALMERA', "SKIP'S MARINE", 'GELATO', 'VINYL VAULT', 'CASA CORONA', 'LUCKY GULL PIER'];
  const SBG = ['#1d2b3a', '#b3261e', '#f2c230', '#0f7d6d', '#e2478a', '#1565c0', '#ff7f2a', '#5b2b8c', '#0e8fa8', '#ffffff', '#12305a', '#d81b3c', '#241a52', '#0aa0d8', '#c62828', '#f5a623', '#2e7d32', '#ef6c00', '#6a1b9a', '#101018', '#4fa3d1', '#222', '#c9a227', '#e86a92', '#00897b', '#1e88e5', '#37474f', '#00695c', '#f48fb1', '#3949ab', '#8d6e63', '#d32f2f'];
  const signTex = tex(1024, 1024, (g) => {
    for (let i = 0; i < 32; i++) {
      const x = (i % 4) * 256, y = Math.floor(i / 4) * 128; g.fillStyle = SBG[i]; g.fillRect(x, y, 256, 128);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.strokeRect(x + 7, y + 7, 242, 114);
      const light = ['#f2c230', '#ffffff', '#f5a623', '#f48fb1', '#4fa3d1'].includes(SBG[i]); g.fillStyle = light ? '#1a1a22' : '#fff';
      const words = SIGNS[i].split(' '); let fs = 60; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = words.length > 1 && SIGNS[i].length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [SIGNS[i]];
      do { g.font = `italic 900 ${fs}px "Arial Black", Impact, sans-serif`; fs -= 3; } while (Math.max(...lines.map(l => g.measureText(l).width)) > 224 && fs > 12);
      lines.forEach((l, k) => g.fillText(l, x + 128, y + 66 + (k - (lines.length - 1) / 2) * (fs + 6)));
    }
  });
  function sign(idx, cx, cy, cz, w, h, face) { // face 0:+z 1:-z 2:+x 3:-x
    const u0 = (idx % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(idx / 4) / 8, v0 = v1 - 0.125, uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c = C(0xffffff), a = w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
    if (face === 0) B.sign.quad([cx - a, y0, cz], [cx + a, y0, cz], [cx + a, y1, cz], [cx - a, y1, cz], [0, 0, 1], c, uv);
    else if (face === 1) B.sign.quad([cx + a, y0, cz], [cx - a, y0, cz], [cx - a, y1, cz], [cx + a, y1, cz], [0, 0, -1], c, uv);
    else if (face === 2) B.sign.quad([cx, y0, cz + a], [cx, y0, cz - a], [cx, y1, cz - a], [cx, y1, cz + a], [1, 0, 0], c, uv);
    else B.sign.quad([cx, y0, cz - a], [cx, y0, cz + a], [cx, y1, cz + a], [cx, y1, cz - a], [-1, 0, 0], c, uv);
  }
  function billboard(x, z, idx, alongX) {
    B.flat.cyl(x, 6, z, 0.5, 12, C(0x555b61)); B.flat.box(x, 15, z, alongX ? 16.6 : 0.8, 7.2, alongX ? 0.8 : 16.6, C(0x2c3136)); addCol(x - .6, x + .6, z - .6, z + .6, 12, 'p');
    if (alongX) { sign(idx, x, 15, z + 0.45, 16, 6.6, 0); sign(idx, x, 15, z - 0.45, 16, 6.6, 1); } else { sign(idx, x + 0.45, 15, z, 16, 6.6, 2); sign(idx, x - 0.45, 15, z, 16, 6.6, 3); }
  }
  function palm(x, z, s) { palms.push({ x, y: W.groundH(x, z), z, ry: R() * 6.28, s: s || rr(0.85, 1.35) }); addCol(x - .3, x + .3, z - .3, z + .3, 6, 'p'); }
  function tree(x, z, s) { trees.push({ x, y: W.groundH(x, z), z, ry: R() * 6.28, s: s || rr(0.8, 1.4) }); addCol(x - .35, x + .35, z - .35, z + .35, 5, 'p'); }
  function block(x0, x1, z0, z1, inner, ring = 5) {
    W.raised.push({ x0, x1, z0, z1 }); const y = 0.2;
    B.flat.box((x0 + x1) / 2, -0.06, (z0 + z1) / 2, x1 - x0, 0.5, z1 - z0, C(0xa9a59c));
    if (ring > 0) {
      topQuad(B.walk, x0, x1, z0, z0 + ring, y, 4); topQuad(B.walk, x0, x1, z1 - ring, z1, y, 4); topQuad(B.walk, x0, x0 + ring, z0 + ring, z1 - ring, y, 4); topQuad(B.walk, x1 - ring, x1, z0 + ring, z1 - ring, y, 4);
      topQuad(B[inner], x0 + ring, x1 - ring, z0 + ring, z1 - ring, y, inner === 'walk' ? 4 : 12);
    } else topQuad(B[inner], x0, x1, z0, z1, y, 12);
  }
  function car(x, z, rot, type) { W.parking.push({ x, z, rot, type }); }

  // ---------- road network ----------
  const N = [];
  function addNode(x, z, h) { const n = { id: W.nodes.length, x, z, h, links: [], light: false, off: 0 }; W.nodes.push(n); return n; }
  function link(a, b, hw, bridge) { const len = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len; const e = { a, b, hw, len, bridge }; W.edges.push(e); a.links.push({ to: b, e, dx, dz }); b.links.push({ to: a, e, dx: -dx, dz: -dz }); }
  for (let i = 0; i < 7; i++) { N[i] = []; for (let j = 0; j < 7; j++) { N[i][j] = addNode(XS[i], ZS[j], (i === 0 || j === 0) ? 11 : 7); N[i][j].off = ((i + j) % 2) * 8; } }
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { if (i < 6) link(N[i][j], N[i + 1][j], j === 0 ? 11 : 7); if (j < 6) link(N[i][j], N[i][j + 1], i === 0 ? 11 : 7); }
  const I1 = addNode(820, -420, 11), I2 = addNode(960, -420, 7), I3 = addNode(820, -530, 7), I4 = addNode(820, -310, 7);
  link(N[6][0], I1, 11, true); link(I1, I2, 7); link(I1, I3, 7); link(I1, I4, 7);
  for (const n of W.nodes) n.light = n.links.length >= 3 && n.x < 400;

  function roadQuad(b, x0, x1, z0, z1, alongX, y = 0) {
    const L = Math.max(1, Math.round((alongX ? x1 - x0 : z1 - z0) / 16)), c = C(0xffffff);
    b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], c, alongX ? [[0, 0], [0, L], [1, L], [1, 0]] : [[0, L], [1, L], [1, 0], [0, 0]]);
  }
  for (const e of W.edges) {
    const b = e.hw > 8 ? B.hwy : B.road, ax = e.a.x, az = e.a.z, bx = e.b.x, bz = e.b.z, y = ax > 600 ? 0.04 : 0;
    if (e.bridge) {
      roadQuad(b, ax + e.a.h, 375, az - 11, az + 11, true); roadQuad(b, 675, bx - e.b.h, az - 11, az + 11, true, 0.04);
      for (let s = 0; s < 30; s++) {
        const xa = 375 + s * 10, xb = xa + 10, ya = bridgeH(xa), yb = bridgeH(xb), c = C(0xffffff);
        B.hwy.quad([xa, ya, az + 11], [xb, yb, az + 11], [xb, yb, az - 11], [xa, ya, az - 11], [0, 1, 0], c, [[0, 0], [0, 1], [1, 1], [1, 0]]);
        B.flat.beam(new THREE.Vector3(xa, ya - 0.75, az), new THREE.Vector3(xb, yb - 0.75, az), 25, 1.4, C(0xd9d6cf));
        for (const sd of [-1, 1]) B.flat.beam(new THREE.Vector3(xa, ya + 0.6, az + sd * 11.8), new THREE.Vector3(xb, yb + 0.6, az + sd * 11.8), 0.5, 1.2, C(0xf2f2f2));
        if (s % 5 === 2) B.flat.box(xa + 5, (ya - 6) / 2 - 1, az, 5, ya + 6, 16, C(0xcfccc4));
      }
      for (const sd of [-1, 1]) addCol(377, 673, az + sd * 12 - 0.3, az + sd * 12 + 0.3, 14, 'b');
      for (const tx of [455, 595]) {
        const dy = bridgeH(tx);
        for (const sd of [-1, 1]) { B.flat.box(tx, (dy + 48) / 2 - 2, az + sd * 13.6, 3, dy + 52, 3, C(0xf4f1ea)); for (const off of [-75, -55, -35, -18, 18, 35, 55, 75]) B.flat.beam(new THREE.Vector3(tx, dy + 45, az + sd * 13), new THREE.Vector3(tx + off, bridgeH(tx + off) + 1, az + sd * 12), 0.22, 0.22, C(0xffffff)); }
        B.flat.box(tx, dy + 46, az, 3, 2.5, 30, C(0xf4f1ea)); B.flat.box(tx, dy + 26, az, 2.4, 2, 30, C(0xf4f1ea));
      }
    } else if (az === bz) roadQuad(b, Math.min(ax, bx) + (ax < bx ? e.a.h : e.b.h), Math.max(ax, bx) - (ax < bx ? e.b.h : e.a.h), az - e.hw, az + e.hw, true, y);
    else roadQuad(b, ax - e.hw, ax + e.hw, Math.min(az, bz) + (az < bz ? e.a.h : e.b.h), Math.max(az, bz) - (az < bz ? e.b.h : e.a.h), false, y);
  }
  for (const n of W.nodes) {
    const y = n.x > 600 ? 0.04 : 0; B.inter.quad([n.x - n.h, y, n.z + n.h], [n.x + n.h, y, n.z + n.h], [n.x + n.h, y, n.z - n.h], [n.x - n.h, y, n.z - n.h], [0, 1, 0], C(0xffffff));
    if (n.light) for (const l of n.links) {
      const dx = -l.dx, dz = -l.dz; // approach direction = from neighbor toward node
      const rx = -dz, rz = dx, px = n.x + dx * (n.h + 1.6) + rx * (n.h + 1.6), pz = n.z + dz * (n.h + 1.6) + rz * (n.h + 1.6);
      const s = { node: n, ns: Math.abs(dz) > 0.5, x: px, z: pz, ry: Math.atan2(-dx, -dz), bx: px - rx * (n.h - 0.6) - dx * 0.34, bz: pz - rz * (n.h - 0.6) - dz * 0.34, arm: n.h - 0.6, state: -1 };
      sigs.push(s); addCol(px - .25, px + .25, pz - .25, pz + .25, 6, 'p');
    }
  }
  W.signals = sigs;

  // ---------- land ----------
  B.flat.box(-140, -3.3, 0, 1020, 6, 1000, C(0x4a4d52));
  topQuad(B.road, -650, 370, -500, 500, -0.28, 14, C(0x777777));
  B.sand.quad([370, 0.2, 500], [415, -3.5, 500], [415, -3.5, -500], [370, 0.2, -500], [0.08, 1, 0], C(0xffffff), [[0, 0], [4, 0], [4, 80], [0, 80]]);
  { // island
    const g = new THREE.CylinderGeometry(0.93, 1.12, 3.6, 56); _m.compose(_p.set(850, -1.8, -420), _q.identity(), _s.set(190, 1, 150)); B.sand.geo(g, _m, C(0xffffff));
    const cg = new THREE.CircleGeometry(1, 56); cg.rotateX(-Math.PI / 2); _m.compose(_p.set(850, 0.02, -420), _q.identity(), _s.set(160, 1, 122)); B.grass.geo(cg, _m, C(0xffffff));
    const ug = B.grass.u, pg = B.grass.p; for (let i = 0; i < ug.length / 2; i++) { ug[i * 2] = pg[i * 3] / 12; ug[i * 2 + 1] = pg[i * 3 + 2] / 12; }
  }
  // grid blocks
  const hwx = i => i === 0 ? 11 : 7, hwz = j => j === 0 ? 11 : 7;
  function district(i, j) {
    if (i === 1 && j === 2) return 'hospital'; if (i === 4 && j === 4) return 'police'; if (i === 4 && j === 2) return 'park';
    if (i === 5) return 'hotel'; if ((i === 2 || i === 3) && j >= 1 && j <= 3) return 'downtown';
    if (i <= 1) return j >= 4 ? 'industrial' : 'suburb'; if (j === 5) return 'apartments'; return 'commercial';
  }
  const PASTEL = [0xf7b5c2, 0x9fe0d0, 0xfde49a, 0xa7d3f2, 0xffc9a3, 0xffffff, 0xd9c2f0, 0xf6f0e0];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const x0 = XS[i] + hwx(i), x1 = XS[i + 1] - hwx(i + 1), z0 = ZS[j] + hwz(j), z1 = ZS[j + 1] - hwz(j + 1), type = district(i, j), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const b = { x0, x1, z0, z1, type, i, j, cx, cz }; W.blocks.push(b);
    block(x0, x1, z0, z1, type === 'suburb' || type === 'park' ? 'grass' : type === 'industrial' || type === 'commercial' || type === 'police' ? 'lot' : 'walk');
    // sidewalk props
    for (let s = 0; s < 4; s++) {
      const horiz = s < 2, len = horiz ? x1 - x0 : z1 - z0;
      for (let k = 1; k < 6; k++) {
        const t = k / 6 * len, px = horiz ? x0 + t : (s === 2 ? x0 + 1.3 : x1 - 1.3), pz = horiz ? (s === 0 ? z0 + 1.3 : z1 - 1.3) : z0 + t;
        if (k % 2 === 1) { const ry = horiz ? (s === 0 ? Math.PI : 0) : (s === 2 ? -Math.PI / 2 : Math.PI / 2); lamps.push({ x: px, y: 0.2, z: pz, ry, s: 1 }); addCol(px - .2, px + .2, pz - .2, pz + .2, 7, 'p'); }
        else if (type !== 'industrial') { if (type === 'suburb' && R() < 0.5) tree(px, pz); else palm(px, pz); }
      }
    }
    if (type === 'downtown') {
      const hero = (i === 2 && j === 2);
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        const ax0 = x0 + 7 + a * 57, ax1 = ax0 + 55 - 0, az0 = z0 + 7 + c * 57, az1 = az0 + 55;
        const ins = rr(0, 4), bx0 = ax0 + ins, bx1 = ax1 - ins - 1, bz0 = az0 + ins, bz1 = az1 - ins - 1;
        const H = hero && a === 0 && c === 0 ? 215 : rr(45, 150), ph = rr(9, 15), tint = pick([0x4f9fc4, 0x3c7fa8, 0x5fb9b0, 0x8a9db8, 0xc79a6b, 0x6f8fd0, 0x9fc7d8]);
        walls(B.office, bx0, bx1, bz0, bz1, 0.2, ph, TW.office, TH.office, C(pick([0xffffff, 0xe8dcc8, 0xd9d9d9, 0xf0e6d6])));
        topQuad(B.flat, bx0, bx1, bz0, bz1, ph, 1, C(0x7a7d80));
        const s1 = rr(2.5, 7), t1 = R() < 0.6 ? H * rr(0.6, 0.8) : H, kind = R() < 0.75 ? 'glass' : 'office';
        walls(B[kind], bx0 + s1, bx1 - s1, bz0 + s1, bz1 - s1, ph, t1, TW[kind], TH[kind], C(kind === 'glass' ? tint : 0xf0ece4));
        topQuad(B.flat, bx0 + s1, bx1 - s1, bz0 + s1, bz1 - s1, t1, 1, C(0x5c6064));
        if (t1 < H) { const s2 = s1 + rr(3, 7); walls(B[kind], bx0 + s2, bx1 - s2, bz0 + s2, bz1 - s2, t1, H, TW[kind], TH[kind], C(kind === 'glass' ? tint : 0xf0ece4)); topQuad(B.flat, bx0 + s2, bx1 - s2, bz0 + s2, bz1 - s2, H, 1, C(0x5c6064)); }
        const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2;
        B.flat.box(mx, H + 2, mz, 9, 4, 9, C(0xcfd2d4)); if (H > 100) { B.flat.cyl(mx, H + 4 + H * 0.09, mz, 0.5, H * 0.18, C(0xe9e9e9)); B.neon.sph(mx, H + 4 + H * 0.18, mz, 0.9, C(0xff3030)); }
        if (R() < 0.6) B.neon.box(mx, t1 - 1.2, bz1 - s1 + 0.15, (bx1 - bx0 - 2 * s1) * 0.9, 0.7, 0.2, C(pick([0x35e0ff, 0xff4fa0, 0xffd23c, 0x7dff8a])));
        addCol(bx0, bx1, bz0, bz1, H);
        if (R() < 0.5) palm(ax0 + 1, az0 + 1);
      }
    } else if (type === 'hotel') {
      const special = j === 2;
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        if (special && c === 1) continue;
        const ax0 = x0 + 8 + a * 57, az0 = z0 + 8 + c * 57, w = rr(40, 50), d = rr(36, 48), H = rr(20, 58), col = pick(PASTEL);
        building(ax0, ax0 + w, az0, az0 + d, H, 'deco', C(col), 0xe8e4da);
        const nc = C(pick([0xff4fa0, 0x35e0ff, 0xffd23c, 0x7dff8a, 0xff8a3c]));
        B.neon.box(ax0 + w + 0.2, H * 0.55, az0 + d * 0.3, 0.5, H * 0.6, 1.6, nc); B.neon.box(ax0 + w / 2, H + 0.9, az0 + d + 0.1, w, 0.35, 0.3, nc);
        B.flat.box(ax0 + w / 2, 4.2, az0 + d + 1.5, w * 0.5, 0.4, 3.4, C(0xffffff));
        if (a === 1) sign(pick([23, 24, 25, 19]), ax0 + w + 0.12, 7, az0 + d * 0.65, 10, 3.2, 2); else sign(pick([23, 24, 25, 28, 6]), ax0 + w / 2, 6.5, az0 + d + 0.12, 10, 3.2, 0);
        palm(ax0 + w + 3, az0 + 4); palm(ax0 + 4, az0 + d + 4);
      }
      if (special) { // Coral Crown forecourt
        sign(8, x0 + 31, 9, z0 + 8 + 46.2, 14, 4, 0); topQuad(B.lot, x0 + 8, x1 - 8, z1 - 46, z1 - 8, 0.22, 12);
        B.pool.box(cx + 28, 0.5, z1 - 28, 9, 0.7, 9, C(0x49c6e8)); B.flat.box(cx + 28, 0.35, z1 - 28, 10.4, 0.6, 10.4, C(0xffffff)); addCol(cx + 22.8, cx + 33.2, z1 - 33.2, z1 - 22.8, 1, 'p');
        W.places.hotelCar = { x: cx - 10, z: z1 - 22, rot: -Math.PI / 2 }; car(cx - 30, z1 - 34, Math.PI / 2); for (let k = 0; k < 5; k++) palm(x0 + 14 + k * 24, z1 - 10);
      }
    } else if (type === 'commercial') {
      for (const side of [0, 1]) {
        let x = x0 + 7; const zf = side === 0 ? z0 + 7 : z1 - 7;
        while (x < x1 - 20) {
          const w = Math.min(rr(15, 23), x1 - 7 - x), h = rr(7.2, 10), d = 20, za = side === 0 ? zf : zf - d, zb = side === 0 ? zf + d : zf, col = C(pick(PASTEL));
          walls(B.shop, x, x + w, za, zb, 0.2, 4.8, w > 19 ? 9.5 : 8, 4.6, col); B.flat.box(x + w / 2, (4.8 + h) / 2, (za + zb) / 2, w, h - 4.8, d, col); addCol(x, x + w, za, zb, h);
          B.flat.box(x + w / 2, h + 0.2, (za + zb) / 2, w + 0.4, 0.5, d + 0.4, C(0xf4f4f4));
          const ac = C(pick([0xd83a3a, 0x1f8a70, 0x2a6fd0, 0xf0a020, 0xe2478a, 0x444a55])); B.flat.box(x + w / 2, 4.1, side === 0 ? za - 1 : zb + 1, w - 1.5, 0.22, 2.2, ac);
          let si = pick([3, 4, 5, 6, 7, 15, 16, 17, 18, 20, 21, 22, 28, 29]);
          if (i === 4 && j === 1 && side === 1 && !W.places.gunshop) { si = 0; W.places.gunshop = { x: x + w / 2, z: zb + 3.2 }; }
          if (i === 4 && j === 3 && side === 0 && !W.places.diner) { si = 14; W.places.diner = { x: x + w / 2, z: za - 3.2 }; }
          sign(si, x + w / 2, 4.8 + (h - 4.8) / 2 + 0.2, side === 0 ? za - 0.08 : zb + 0.08, Math.min(w - 3, 11), Math.min(h - 5.2, 2.6), side === 0 ? 1 : 0);
          x += w + (R() < 0.25 ? 4 : 0.0);
        }
      }
      for (let k = 0; k < 9; k++) { const px = x0 + 14 + k * 12; B.flat.box(px - 1.6, 0.23, cz, 0.15, 0.02, 30, C(0xf0f0f0)); if (R() < 0.42) car(px + 1.4 - 3 + 4.4, cz - 8 + (R() < .5 ? 0 : 16), R() < .5 ? 0 : Math.PI); }
      for (let k = 0; k < 4; k++) palm(x0 + 12 + k * 32, cz);
    } else if (type === 'suburb') {
      const lw = (x1 - x0 - 12) / 4;
      for (const side of [0, 1]) for (let k = 0; k < 4; k++) {
        const lx = x0 + 6 + k * lw, hw = rr(13, 17), hd = rr(10, 13), hh = R() < 0.4 ? 6.4 : 3.6, hx = lx + 3 + hw / 2, hz = side === 0 ? z0 + 22 : z1 - 22;
        const safe = i === 0 && j === 1 && side === 1 && k === 1, col = C(safe ? 0x2fb8a8 : pick([0xffffff, 0xfde8c8, 0xcfe8f5, 0xf7c9c0, 0xe8f0c8, 0xf5e6a8, 0xd8d0f0])), rc = C(pick([0xb5533a, 0xc96a45, 0x7a4a3a, 0x59606a]));
        B.flat.box(hx, 0.2 + hh / 2, hz, hw, hh, hd, col); addCol(hx - hw / 2, hx + hw / 2, hz - hd / 2, hz + hd / 2, hh + 3);
        // pitched roof
        const rx0 = hx - hw / 2 - 0.6, rx1 = hx + hw / 2 + 0.6, rz0 = hz - hd / 2 - 0.6, rz1 = hz + hd / 2 + 0.6, ry = 0.2 + hh, rt = ry + 2.6;
        B.flat.quad([rx0, ry, rz1], [rx1, ry, rz1], [rx1, rt, hz], [rx0, rt, hz], [0, 0.7, 0.7], rc); B.flat.quad([rx1, ry, rz0], [rx0, ry, rz0], [rx0, rt, hz], [rx1, rt, hz], [0, 0.7, -0.7], rc);
        B.flat.quad([rx0, ry, rz0], [rx0, ry, rz1], [rx0, rt, hz], [rx0, rt, hz], [-1, 0, 0], col); B.flat.quad([rx1, ry, rz1], [rx1, ry, rz0], [rx1, rt, hz], [rx1, rt, hz], [1, 0, 0], col);
        const fz = side === 0 ? hz - hd / 2 - 0.06 : hz + hd / 2 + 0.06;
        B.flat.box(hx - hw * 0.1, 1.3, fz, 1.1, 2.2, 0.12, C(0x5a3a2a)); for (const wx of [-0.34, 0.26]) B.win.box(hx + wx * hw, 2.0, fz, 2.2, 1.4, 0.12, C(0xffffff));
        if (hh > 5) for (const wx of [-0.3, 0, 0.3]) B.win.box(hx + wx * hw, 5, fz, 1.8, 1.3, 0.12, C(0xffffff));
        // driveway + garage
        const dx = lx + lw - 6, dz0 = side === 0 ? z0 + 5 : hz - 3, dz1 = side === 0 ? hz + 3 : z1 - 5;
        topQuad(B.walk, dx - 2.6, dx + 2.6, dz0, dz1, 0.215, 4, C(0xcccccc));
        if (safe) { W.places.safehouse = { x: dx, z: z1 - 9 }; W.places.spawn = { x: dx - 5, z: z1 - 12 }; car(dx, z1 - 16, 0, 'sports'); }
        else if (R() < 0.55) car(dx, side === 0 ? z0 + 13 : z1 - 13, side === 0 ? Math.PI : 0);
        if (R() < 0.5) { const pz = side === 0 ? hz + hd / 2 + 9 : hz - hd / 2 - 9; B.pool.box(hx, 0.24, pz, 8, 0.1, 5, C(0x49c6e8)); B.flat.box(hx, 0.2, pz, 9.2, 0.08, 6.2, C(0xf2efe6)); }
        if (R() < 0.8) (R() < 0.5 ? palm : tree)(lx + 3, side === 0 ? z0 + 11 : z1 - 11);
        B.flat.box(lx, 0.75, side === 0 ? z0 + 24 : z1 - 24, 0.7, 1.1, 30, C(0x3f7a3a));
      }
      B.flat.box(cx, 0.9, cz, x1 - x0 - 14, 1.4, 0.8, C(0x3f7a3a)); addCol(x0 + 7, x1 - 7, cz - .4, cz + .4, 1.6, 'p');
    } else if (type === 'industrial') {
      const gang = i === 0 && j === 4, garage = i === 1 && j === 5, skip = i === 0 && j === 5;
      if (garage) {
        building(cx - 22, cx + 22, z0 + 22, z0 + 52, 9, 'metal', C(0xf2c230)); sign(1, cx, 7, z0 + 21.9, 18, 3.6, 1); B.flat.box(cx, 2.4, z0 + 21.8, 9, 4.6, 0.3, C(0x23262a));
        W.places.garage = { x: cx, z: z0 + 13 }; topQuad(B.walk, cx - 6, cx + 6, z0, z0 + 22, 0.215, 4, C(0xbbbbbb)); car(cx + 30, z0 + 14, Math.PI / 2);
        building(cx - 50, cx - 10, z1 - 48, z1 - 10, 11, 'metal', C(0x8fb0c8));
      } else if (skip) {
        building(cx - 40, cx + 5, z0 + 30, z0 + 62, 10, 'metal', C(0x4fb3a5)); sign(27, cx - 17, 7.5, z0 + 29.9, 16, 3.6, 1); W.places.skip = { x: cx - 17, z: z0 + 20 };
        car(cx + 25, z0 + 16, Math.PI / 2, 'pickup'); building(cx + 15, cx + 50, z1 - 50, z1 - 12, 12, 'metal', C(0xd8d2c0)); sign(26, cx + 32, 9, z1 - 50.1, 14, 3.4, 1);
      } else if (gang) {
        building(x0 + 10, x0 + 50, z0 + 10, z0 + 40, 10, 'metal', C(0xb0563a)); W.places.gang = { x: cx + 8, z: cz + 12 };
      } else { building(x0 + 10, x0 + 60, z0 + 10, z0 + 45, 11, 'metal', C(0x9fb8c8)); building(x1 - 55, x1 - 10, z1 - 50, z1 - 12, 9, 'metal', C(0xd8c890)); car(cx, cz, 0, 'pickup'); }
      const CC = [0xc0392b, 0x2471a3, 0x1e8449, 0xd68910, 0x884ea0, 0x566573, 0xe8e8e8];
      for (let k = 0; k < (gang ? 14 : 18); k++) {
        const px = rr(x0 + 14, x1 - 14), pz = rr(z0 + 14, z1 - 14), al = R() < 0.5, sx = al ? 12 : 2.5, sz = al ? 2.5 : 12;
        if (W.collideCircle(px, pz, 9).hit || Math.hypot(px - cx, pz - (z0 + 13)) < 16 || (W.places.gang && gang && Math.hypot(px - W.places.gang.x, pz - W.places.gang.z) < 7)) continue;
        const n = 1 + Math.floor(R() * 3); for (let q = 0; q < n; q++) B.metal.box(px, 0.2 + 1.3 + q * 2.6, pz, sx, 2.6, sz, C(pick(CC))); addCol(px - sx / 2, px + sx / 2, pz - sz / 2, pz + sz / 2, 0.2 + n * 2.6);
      }
      if (!gang) { B.flat.cyl(x1 - 20, 5.2, z0 + 20, 7, 10, C(0xe9e9e9)); B.flat.cone(x1 - 20, 11.2, z0 + 20, 7, 2, C(0xcfcfcf)); addCol(x1 - 26, x1 - 14, z0 + 14, z0 + 26, 11); }
    } else if (type === 'apartments') {
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) { const ax0 = x0 + 9 + a * 57, az0 = z0 + 9 + c * 57; building(ax0, ax0 + rr(38, 48), az0, az0 + rr(34, 46), rr(18, 34), 'apt', C(pick([0xffffff, 0xf3d9c0, 0xd6e6ee, 0xf0e2b8, 0xe6c8c8])), 0x8a6a5a); palm(ax0 + 52, az0 + 20); }
      car(cx, cz + 2, Math.PI / 2); car(cx - 20, cz - 3, -Math.PI / 2);
    } else if (type === 'park') {
      topQuad(B.walk, x0 + 5, x1 - 5, cz - 2.5, cz + 2.5, 0.215, 4, C(0xe6dcc0)); topQuad(B.walk, cx - 2.5, cx + 2.5, z0 + 5, z1 - 5, 0.215, 4, C(0xe6dcc0));
      B.flat.cyl(cx, 0.55, cz, 8, 0.7, C(0xe8e4da)); B.pool.cyl(cx, 0.62, cz, 7.2, 0.62, C(0x49c6e8)); B.flat.cyl(cx, 1.6, cz, 1, 2.6, C(0xe8e4da)); B.flat.cyl(cx, 3, cz, 2.4, 0.3, C(0xe8e4da)); addCol(cx - 7, cx + 7, cz - 7, cz + 7, 1.2, 'p');
      for (let k = 0; k < 46; k++) { const px = rr(x0 + 9, x1 - 9), pz = rr(z0 + 9, z1 - 9); if (Math.abs(px - cx) < 5 || Math.abs(pz - cz) < 5 || Math.hypot(px - cx, pz - cz) < 12) continue; (R() < 0.35 ? palm : tree)(px, pz, rr(1, 1.9)); }
      for (const [bx, bz] of [[cx - 14, cz - 4], [cx + 14, cz - 4], [cx - 14, cz + 4], [cx + 14, cz + 4]]) { B.flat.box(bx, 0.65, bz, 2.4, 0.15, 0.7, C(0x8a5a3a)); B.flat.box(bx, 0.42, bz, 2.2, 0.45, 0.2, C(0x444444)); }
      W.places.park = { x: cx + 11, z: cz + 11 };
    } else if (type === 'hospital') {
      building(cx - 34, cx + 34, z0 + 12, z0 + 56, 30, 'office', C(0xffffff), 0xdfe3e6); building(cx - 50, cx - 34, z0 + 20, z0 + 50, 14, 'office', C(0xeaf2f6)); building(cx + 34, cx + 50, z0 + 20, z0 + 50, 14, 'office', C(0xeaf2f6));
      B.neon.box(cx, 26, z0 + 56.2, 3, 9, 0.3, C(0x2f7de0)); B.neon.box(cx, 26, z0 + 56.25, 9, 3, 0.3, C(0x2f7de0)); sign(9, cx, 7.5, z0 + 56.15, 20, 4, 0);
      B.flat.box(cx, 4.6, z0 + 61, 20, 0.5, 10, C(0xffffff)); for (const sx of [-9, 9]) B.flat.cyl(cx + sx, 2.4, z0 + 65, 0.3, 4.4, C(0xdddddd));
      topQuad(B.lot, x0 + 6, x1 - 6, z1 - 44, z1 - 6, 0.215, 12); W.places.hospital = { x: cx, z: z0 + 74 };
      for (let k = 0; k < 6; k++) if (R() < 0.6) car(x0 + 18 + k * 18, z1 - 16, 0); for (let k = 0; k < 4; k++) palm(x0 + 12 + k * 34, z1 - 30);
    } else if (type === 'police') {
      building(cx - 28, cx + 28, z0 + 12, z0 + 50, 11, 'office', C(0xc8d6e6), 0x3a5f8a); B.flat.box(cx, 13.5, z0 + 31, 18, 4, 14, C(0xdfe7ef)); B.neon.box(cx, 11.8, z0 + 50.2, 56, 0.5, 0.3, C(0x3d8bff));
      sign(10, cx, 7.6, z0 + 50.15, 14, 4, 0); B.flat.box(cx, 4.4, z0 + 54, 14, 0.4, 8, C(0x3a5f8a)); W.places.police = { x: cx, z: z0 + 66 };
      for (let k = 0; k < 4; k++) car(x0 + 20 + k * 9, z1 - 20, 0, 'police');
      B.flat.cyl(cx + 40, 9, z0 + 20, 0.25, 18, C(0xcccccc));
    }
  }
  // outer strips
  block(-650, -571, -500, 500, 'grass', 0); block(-571, 287, -500, -431, 'grass', 0); block(287, 370, -500, -431, 'sand', 0); block(-571, 370, 427, 500, 'grass', 0);
  W.raised.push({ x0: 287, x1: 370, z0: -409, z1: 427 }); B.flat.box(328.5, -0.06, 9, 83, 0.5, 836, C(0xd9c9a0));
  topQuad(B.walk, 287, 297, -409, 427, 0.2, 4); topQuad(B.sand, 297, 370, -409, 427, 0.2, 12);
  for (let z = -480; z < 480; z += 22) { (R() < 0.6 ? tree : palm)(rr(-640, -590), z + rr(-6, 6), rr(1.2, 2)); if (R() < 0.6) tree(rr(-630, -580), z + 9, rr(1, 1.8)); }
  for (let x = -560; x < 280; x += 20) { (R() < 0.5 ? tree : palm)(x + rr(-5, 5), rr(-492, -445), rr(1.1, 1.9)); (R() < 0.6 ? palm : tree)(x + rr(-5, 5), rr(440, 490), rr(1.1, 1.9)); }
  billboard(-380, -440, 11, true); billboard(-100, -440, 12, true); billboard(160, -440, 13, true); billboard(-580, -200, 12, false); billboard(-580, 180, 11, false); billboard(-200, 437, 13, true); billboard(100, 437, 26, true);
  // beach
  for (let z = -396; z < 420; z += 17) { palm(292, z, rr(1.1, 1.6)); if (R() < 0.75) { const ux = rr(306, 356), uz = z + rr(-5, 5); if (Math.abs(uz - 140) < 16) continue; const uc = C(pick([0xff5a5a, 0xffd23c, 0x35b8ff, 0xff8fc0, 0xffffff, 0x3cd6a0])); B.flat.cyl(ux, 1.3, uz, 0.06, 2.2, C(0xeeeeee)); B.flat.cone(ux, 2.5, uz, 1.9, 0.7, uc); B.flat.box(ux + 1.2, 0.26, uz, 1, 0.06, 2, C(pick([0xff8a3c, 0x3c8aff, 0xff4fa0, 0xffffff]))); B.flat.box(ux - 1.2, 0.5, uz + 0.3, 0.7, 0.12, 1.9, C(0xfafafa)); } if (R() < 0.3) palm(rr(300, 330), z + 6); }
  for (const lz of [-300, -120, 30, 260]) { B.flat.box(350, 2.2, lz, 3.4, 0.3, 3.4, C(0xffffff)); B.flat.box(350, 3.4, lz, 3, 2.2, 3, C(0xe8443a)); B.flat.box(350, 4.7, lz, 3.8, 0.3, 3.8, C(0xffffff)); for (const a of [-1.4, 1.4]) for (const c of [-1.4, 1.4]) B.flat.box(350 + a, 1.1, lz + c, 0.25, 2.2, 0.25, C(0xd8c8a0)); addCol(348.3, 351.7, lz - 1.7, lz + 1.7, 5, 'p'); }
  // pier + ferris wheel
  B.flat.box(423, 0.6, 140, 122, 0.6, 24, C(0x9a7350)); for (let x = 372; x < 484; x += 14) for (const s of [-10, 10]) B.flat.cyl(x, -1.6, 140 + s, 0.5, 4.4, C(0x6a4a30));
  for (const s of [-1, 1]) { B.flat.box(428, 1.5, 140 + s * 11.7, 108, 0.12, 0.2, C(0xffffff)); for (let x = 376; x < 484; x += 6) B.flat.box(x, 1.2, 140 + s * 11.7, 0.15, 0.7, 0.15, C(0xffffff)); addCol(374, 484, 140 + s * 12 - 0.2, 140 + s * 12 + 0.2, 2, 'b'); }
  addCol(484, 484.4, 128, 152, 2, 'b'); sign(31, 372, 6.2, 140, 14, 3.2, 3); for (const s of [-8, 8]) B.flat.cyl(372.2, 3.2, 140 + s, 0.25, 6.4, C(0xffffff));
  for (const [bx, bc, si] of [[400, 0xff4fa0, 28], [420, 0x35b8ff, 17], [440, 0xffd23c, 6]]) { B.flat.box(bx, 2.4, 132, 8, 3, 5, C(bc)); B.flat.box(bx, 4.1, 132.5, 9, 0.3, 6.5, C(0xffffff)); sign(si, bx, 3.2, 134.56, 6, 1.6, 0); addCol(bx - 4, bx + 4, 129.5, 134.5, 4, 'b'); }
  W.places.pier = { x: 388, z: 144 };
  const wheel = new THREE.Group(); wheel.position.set(468, 19, 140);
  { const wb = new Batch(), nb = new Batch(); const g = new THREE.TorusGeometry(15, 0.28, 6, 40); wb.geo(g, _m.identity(), C(0xffffff)); const g2 = new THREE.TorusGeometry(11, 0.18, 6, 32); wb.geo(g2, _m.identity(), C(0xffffff));
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; wb.beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 15, Math.sin(a) * 15, 0), 0.18, 0.18, C(0xffffff)); nb.sph(Math.cos(a) * 15, Math.sin(a) * 15 - 1, 0, 1.25, C([0xff4fa0, 0x35e0ff, 0xffd23c, 0x7dff8a][k % 4])); }
    wheel.add(wb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), nb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false, false)); }
  scene.add(wheel); W.wheel = wheel;
  for (const s of [-1, 1]) B.flat.beam(new THREE.Vector3(468 - 7, 0.9, 140 + s * 3), new THREE.Vector3(468, 19, 140 + s * 1.2), 0.6, 0.6, C(0xf0f0f0)), B.flat.beam(new THREE.Vector3(468 + 7, 0.9, 140 + s * 3), new THREE.Vector3(468, 19, 140 + s * 1.2), 0.6, 0.6, C(0xf0f0f0));
  addCol(459, 477, 136, 144, 6, 'b');
  // island
  for (const [mx, mz, mw, md, mh, mc] of [[900, -350, 44, 26, 9, 0xfff6e8], [740, -360, 34, 24, 8, 0xf7d9c8], [745, -485, 36, 24, 9, 0xe6f0f5], [895, -490, 38, 26, 8, 0xfde8b8]]) {
    building(mx - mw / 2, mx + mw / 2, mz - md / 2, mz + md / 2, mh, 'deco', C(mc), 0xb5533a); B.flat.box(mx, mh + 1.2, mz, mw * 0.5, 2.4, md * 0.6, C(mc)); B.flat.box(mx, mh + 2.6, mz, mw * 0.55, 0.5, md * 0.66, C(0xb5533a));
    const pz = mz + (mz > -420 ? -1 : 1) * (md / 2 + 12); B.pool.box(mx, 0.12, pz, 16, 0.12, 8, C(0x49c6e8)); B.flat.box(mx, 0.08, pz, 18, 0.1, 10, C(0xf5f1e6));
    for (let k = 0; k < 5; k++) palm(mx - mw / 2 - 6 + k * (mw + 12) / 4, mz + (mz > -420 ? 1 : -1) * (md / 2 + 6), rr(1.2, 1.7)); car(mx + (mx > 820 ? -mw / 2 - 8 : mw / 2 + 8), mz, 0, R() < .6 ? 'sports' : 'suv');
  }
  sign(30, 900, 5.5, -363.1, 12, 3, 1); W.places.mansion = { x: 900, z: -372 };
  for (let k = 0; k < 40; k++) { const a = R() * 6.28, r = rr(0.45, 0.86), px = 850 + Math.cos(a) * 190 * r, pz = -420 + Math.sin(a) * 150 * r; if (Math.abs(pz + 420) < 16 || Math.abs(px - 820) < 14 || W.collideCircle(px, pz, 6).hit) continue; palm(px, pz, rr(1.1, 1.8)); }
  // boats
  for (const [bx, bz, br] of [[470, -80, 0.4], [520, 300, 2], [560, -250, 1.2], [450, 360, 4], [700, -200, -1], [600, 80, 3], [-700, 100, 1], [-100, 560, 2.5], [1000, -200, 0.3]]) {
    B.flat.box(bx, -0.4, bz, 3.4, 1.4, 11, C(0xffffff), br); B.flat.box(bx, 0.9, bz, 2.4, 1.2, 4.5, C(0xe8eef2), br); B.flat.box(bx, 0.36, bz, 3.5, 0.14, 11.1, C(pick([0x1c5fa8, 0xd83a3a, 0x0f7d6d])), br); if (R() < 0.6) { B.flat.cyl(bx, 6, bz, 0.12, 11, C(0xdddddd)); B.flat.box(bx, 6.5, bz, 0.08, 8, 4.4, C(0xfdfdf5), br); }
  }

  // ---------- materials + meshes ----------
  const roadTex = tex(256, 256, (g) => { g.fillStyle = '#44474c'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2600, .07); g.fillStyle = '#e8c33a'; g.fillRect(123, 0, 3, 256); g.fillRect(130, 0, 3, 256); g.fillStyle = '#e9e9e9'; g.fillRect(63, 20, 3, 100); g.fillRect(191, 20, 3, 100); g.fillRect(6, 0, 3, 256); g.fillRect(247, 0, 3, 256); });
  const hwyTex = tex(256, 256, (g) => { g.fillStyle = '#3e4146'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2600, .07); g.fillStyle = '#8e8e88'; g.fillRect(122, 0, 12, 256); g.fillStyle = '#e8c33a'; g.fillRect(118, 0, 3, 256); g.fillRect(135, 0, 3, 256); g.fillStyle = '#e9e9e9'; for (const x of [42, 80, 174, 212]) g.fillRect(x, 20, 3, 100); g.fillRect(5, 0, 3, 256); g.fillRect(248, 0, 3, 256); });
  const interTex = tex(256, 256, (g) => { g.fillStyle = '#44474c'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 2600, .07); g.fillStyle = '#ececec'; for (let k = 14; k < 242; k += 22) { g.fillRect(k, 6, 12, 30); g.fillRect(k, 220, 12, 30); g.fillRect(6, k, 30, 12); g.fillRect(220, k, 30, 12); } });
  const walkTex = tex(128, 128, (g) => { g.fillStyle = '#c9c5bb'; g.fillRect(0, 0, 128, 128); noise(g, 128, 128, 900, .06); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 0, 64, 64); g.strokeRect(0, 64, 64, 64); g.strokeRect(64, 64, 64, 64); });
  const grassTex = tex(256, 256, (g) => { g.fillStyle = '#5c9a3e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${40 + R() * 70 | 0},${120 + R() * 80 | 0},${30 + R() * 40 | 0},.5)`; g.fillRect(R() * 256, R() * 256, 2, 3); } });
  const sandTex = tex(256, 256, (g) => { g.fillStyle = '#ecd9a6'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${200 + R() * 55 | 0},${180 + R() * 50 | 0},${120 + R() * 50 | 0},.5)`; g.fillRect(R() * 256, R() * 256, 2, 2); } });
  const lotTex = tex(256, 256, (g) => { g.fillStyle = '#5a5d61'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 3000, .08); });
  const L = (o) => new THREE.MeshLambertMaterial(o);
  const M = { flat: L({ vertexColors: true }), road: L({ map: roadTex, vertexColors: true }), hwy: L({ map: hwyTex }), inter: L({ map: interTex }), walk: L({ map: walkTex, vertexColors: true }), grass: L({ map: grassTex }), sand: L({ map: sandTex }), lot: L({ map: lotTex }),
    neon: new THREE.MeshBasicMaterial({ vertexColors: true }), pool: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2 }),
    sign: L({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.05 }), win: L({ color: 0x2d4558, emissive: 0xffc878, emissiveIntensity: 0 }) };
  W.nightMats.push({ m: M.sign, k: 0.85, b: 0.05 }, { m: M.win, k: 1.3, b: 0 });
  for (const k of ['glass', 'office', 'deco', 'apt', 'shop', 'metal']) {
    const f = facade(k);
    M[k] = k === 'glass' ? new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, metalness: 0.55, roughness: 0.22 }) : L({ map: f.map, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
    if (k !== 'metal') W.nightMats.push({ m: M[k], k: k === 'shop' ? 1.1 : 0.95, b: 0 });
  }
  W.neonMat = M.neon;
  for (const k in B) { if (!B[k].vc) continue; const flatGround = ['road', 'hwy', 'inter', 'walk', 'grass', 'sand', 'lot'].includes(k); const m = B[k].mesh(M[k], !flatGround && k !== 'sign' && k !== 'neon', k !== 'neon'); m.name = k; scene.add(m); }

  // ---------- instanced props ----------
  function inst(geo, mat, list, cast = true) {
    const im = new THREE.InstancedMesh(geo, mat, list.length); const e = new THREE.Euler();
    list.forEach((o, i) => { _q.setFromEuler(e.set(0, o.ry || 0, 0)); _m.compose(_p.set(o.x, o.y, o.z), _q, _s.set(o.s || 1, o.sy || o.s || 1, o.s || 1)); im.setMatrixAt(i, _m); });
    im.castShadow = cast; im.receiveShadow = false; im.frustumCulled = false; scene.add(im); return im;
  }
  { // palm
    const b = new Batch(); let ox = 0; for (let k = 0; k < 4; k++) { _m.compose(_p.set(ox, 0.9 + k * 1.75, 0), _q.identity(), _s.set(0.26 - k * 0.035, 1.8, 0.26 - k * 0.035)); b.geo(new THREE.CylinderGeometry(1, 1.12, 1, 6), _m, C(k % 2 ? 0x8a6a4a : 0x7a5c40)); ox += 0.1 * k; }
    const top = 7.1;
    for (let f = 0; f < 10; f++) { const a = f / 10 * 6.283 + (f % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), dr = f % 2 ? 2.6 : 1.7, len = f % 2 ? 3.3 : 3.8;
      for (let s = 0; s < 4; s++) { const t0 = s / 4, t1 = (s + 1) / 4, P = (t, sd) => { const r = 0.2 + len * t, y = top + 1.0 * t - dr * t * t, w = 0.62 * (1 - t * 0.85) * (t < 0.05 ? 0.4 : 1) * sd; return [ox + r * ca - w * sa, y - Math.abs(sd) * 0.0, r * sa + w * ca]; };
        b.quad(P(t0, -1), P(t0, 1), P(t1, 1), P(t1, -1), [0, 1, 0], C(f % 2 ? 0x3f8f3a : 0x56a845)); } }
    for (let k = 0; k < 3; k++) b.sph(ox + Math.cos(k * 2.1) * 0.25, top - 0.2, Math.sin(k * 2.1) * 0.25, 0.17, C(0x5a4028));
    inst(b.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), palms);
    const t = new Batch(); t.cyl(0, 1.3, 0, 0.22, 2.6, C(0x6a5038)); t.sph(0, 4, 0, 2.1, C(0x3f8a3a), 0.85); t.sph(1.1, 3.3, 0.5, 1.4, C(0x4c9a44)); t.sph(-0.9, 3.5, -0.7, 1.5, C(0x377a34)); t.sph(0.1, 5, -0.2, 1.3, C(0x55a54a));
    inst(t.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), trees);
  }
  { // street lamps
    const b = new Batch(); b.cyl(0, 3.5, 0, 0.11, 7, C(0x4a4f55)); b.box(0, 7, 0.9, 0.14, 0.14, 2, C(0x4a4f55)); b.box(0, 6.95, 1.9, 0.5, 0.2, 0.9, C(0x33373c)); b.cyl(0, 0.25, 0, 0.2, 0.5, C(0x33373c));
    inst(b.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), lamps, false);
    const bulbs = lamps.map(l => ({ x: l.x + Math.sin(l.ry) * 1.9, y: 7.02, z: l.z + Math.cos(l.ry) * 1.9, s: 1 }));
    W.lampPos = bulbs;
    W.bulbMat = new THREE.MeshBasicMaterial({ color: 0x333333 }); inst(new THREE.BoxGeometry(0.4, 0.12, 0.8), W.bulbMat, bulbs, false);
    const gt = tex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.4, 'rgba(255,190,110,.42)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    W.glowTex = gt;
    const pg = new THREE.PlaneGeometry(17, 17); pg.rotateX(-Math.PI / 2);
    W.poolMat = new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    W.poolMesh = inst(pg, W.poolMat, bulbs.map(b => ({ x: b.x, y: W.groundH(b.x, b.z) + 0.06, z: b.z, s: 1 })), false);
    const hg = new THREE.PlaneGeometry(2.6, 2.6);
    W.haloMat = new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    W.haloMesh = inst(hg, W.haloMat, bulbs.map(b => ({ x: b.x, y: 6.9, z: b.z, s: 1 })), false);
  }
  { // traffic signals
    const b = new Batch(); b.cyl(0, 3.2, 0, 0.14, 6.4, C(0x3a3f45)); b.box(0, 0.3, 0, 0.5, 0.6, 0.5, C(0x2c3035));
    const a7 = new Batch(), a11 = new Batch();
    for (const [bb, arm] of [[a7, 6.4], [a11, 10.4]]) { bb.geo(b.geometry(), _m.identity(), C(0xffffff)); const c = bb.c; for (let i = 0; i < c.length; i++) c[i] = 0.06; bb.box(-arm / 2, 6.2, 0, arm, 0.16, 0.16, C(0x3a3f45)); bb.box(-arm, 5.75, 0, 0.5, 1.5, 0.45, C(0xd8a520)); }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    inst(a7.geometry(), mat, sigs.filter(s => s.arm < 8), false); inst(a11.geometry(), mat, sigs.filter(s => s.arm > 8), false);
    const bl = []; for (const s of sigs) for (let k = 0; k < 3; k++) bl.push({ x: s.bx, y: 6.2 - k * 0.45, z: s.bz, s: 1 });
    const im = inst(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bl, false);
    const ON = [new THREE.Color(0xff2a1a), new THREE.Color(0xffc21a), new THREE.Color(0x2aff5a)], OFF = [new THREE.Color(0x2a0503), new THREE.Color(0x2a1f03), new THREE.Color(0x03200a)];
    W.lightState = function (n, dx, dz, t) { const ph = (t + n.off) % 16; if (Math.abs(dz) > 0.5) return ph < 6 ? 2 : ph < 8 ? 1 : 0; return ph < 8 ? 0 : ph < 14 ? 2 : 1; };
    W.updateSignals = function (t) {
      let ch = false;
      sigs.forEach((s, i) => { const st = W.lightState(s.node, 0, s.ns ? 1 : 0, t); if (st === s.state) return; s.state = st; ch = true; for (let k = 0; k < 3; k++) im.setColorAt(i * 3 + k, (k === 0 && st === 0) || (k === 1 && st === 1) || (k === 2 && st === 2) ? ON[k] : OFF[k]); });
      if (ch && im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    W.updateSignals(0);
  }
  // ---------- water ----------
  W.waterMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, c1: { value: new THREE.Color(0x1fb5c9) }, c2: { value: new THREE.Color(0x0a5f9a) }, sun: { value: new THREE.Color(0xffffff) }, fogC: { value: new THREE.Color(0xa9d8f5) }, day: { value: 1 } },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w=modelMatrix*vec4(position,1.0); wp=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float t,day; uniform vec3 c1,c2,sun,fogC; varying vec3 wp;
      void main(){ vec2 p=wp.xz; float d=length(cameraPosition-wp);
        float w=sin(p.x*0.11+t*1.1)+sin(p.y*0.13-t*0.9)+sin((p.x+p.y)*0.07+t*0.6)+sin((p.x-p.y)*0.23+t*1.7)*0.5;
        float sp=pow(max(0.0,sin(p.x*0.9+t*2.0+sin(p.y*0.7))*sin(p.y*1.1-t*1.6+sin(p.x*0.5))),14.0)*smoothstep(260.0,20.0,d);
        float shore=smoothstep(60.0,0.0,min(abs(p.x-398.0),60.0))*step(-500.0,p.y)*step(p.y,500.0);
        vec3 c=mix(c2,c1,clamp(0.45+w*0.09+shore*0.5,0.0,1.0))*(0.25+0.75*day);
        c+=sun*sp*0.8*day; c+=vec3(1.0)*smoothstep(0.75,1.0,sin(p.x*0.6-t*0.8+sin(p.y*0.08)*2.0))*shore*shore*0.5*day;
        float f=smoothstep(200.0,1500.0,d); gl_FragColor=vec4(mix(c,fogC,f),1.0); }`
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000).rotateX(-Math.PI / 2), W.waterMat); water.position.set(150, -0.8, 0); scene.add(water);

  // ---------- map canvas ----------
  const SC = 1.1, mb = W.bounds, mc = document.createElement('canvas'); mc.width = Math.round((mb.x1 - mb.x0) * SC); mc.height = Math.round((mb.z1 - mb.z0) * SC);
  const g = mc.getContext('2d'); W.mapCanvas = mc; W.mapScale = SC; const X = x => (x - mb.x0) * SC, Z = z => (z - mb.z0) * SC;
  g.fillStyle = '#17405f'; g.fillRect(0, 0, mc.width, mc.height);
  g.fillStyle = '#d9c58c'; g.fillRect(X(-650), Z(-500), 1060 * SC, 1000 * SC); g.beginPath(); g.ellipse(X(850), Z(-420), 195 * SC, 155 * SC, 0, 0, 6.3); g.fill();
  g.fillStyle = '#2d3640'; g.fillRect(X(-650), Z(-500), 937 * SC, 1000 * SC); g.fillStyle = '#3f6f48'; g.beginPath(); g.ellipse(X(850), Z(-420), 160 * SC, 122 * SC, 0, 0, 6.3); g.fill();
  g.fillRect(X(-650), Z(-500), 79 * SC, 1000 * SC); g.fillRect(X(-571), Z(-500), 858 * SC, 69 * SC); g.fillRect(X(-571), Z(427), 858 * SC, 73 * SC);
  const DC = { downtown: '#3d4756', hotel: '#4a4458', commercial: '#3b4450', suburb: '#34503f', industrial: '#454038', apartments: '#3f4450', park: '#3f7a4a', hospital: '#4a4f58', police: '#35465c' };
  for (const b of W.blocks) { g.fillStyle = DC[b.type]; g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * SC, (b.z1 - b.z0) * SC); }
  g.fillStyle = 'rgba(255,255,255,.13)'; for (const c of W.colliders) if (c.t === 'b' && c.x1 - c.x0 > 3 && c.z1 - c.z0 > 3) g.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * SC, (c.z1 - c.z0) * SC);
  g.fillStyle = '#9a7350'; g.fillRect(X(362), Z(128), 122 * SC, 24 * SC);
  g.lineCap = 'square';
  for (const pass of [0, 1]) for (const e of W.edges) { g.strokeStyle = pass === 0 ? '#11161c' : (e.hw > 8 ? '#f0c060' : '#a9b2bf'); g.lineWidth = (e.hw * 2 + (pass === 0 ? 4 : -2)) * SC * (pass ? 0.8 : 0.8); g.beginPath(); g.moveTo(X(e.a.x), Z(e.a.z)); g.lineTo(X(e.b.x), Z(e.b.z)); g.stroke(); }
  return W;
}
