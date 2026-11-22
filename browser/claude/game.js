// PALMERA HEAT - original open-world crime game. All names, city, characters and art are original.
import * as THREE from 'three';
import { W, buildWorld, Batch } from './world.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const AUTO = Q.has('autoplay') || Q.has('scene');
const SCENE = Q.get('scene') || '';
function au(f, ...a) { try { const G = window.GameAudio; if (G && G[f]) return G[f](...a); } catch (e) { } }
function rad(f, ...a) { try { const G = window.GameAudio; if (G && G.radio && G.radio[f]) return G.radio[f](...a); } catch (e) { } return -1; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const wrapPi = a => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a; };
const pickR = a => a[Math.floor(Math.random() * a.length)];
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ---------- options / save ----------
const opts = Object.assign({ quality: 2, fov: 70, sens: 1, vol: 0.7, music: 0.5 }, JSON.parse(localStorage.getItem('palmera_opts') || '{}'));
if (Q.has('q')) opts.quality = +Q.get('q');
const saveOpts = () => localStorage.setItem('palmera_opts', JSON.stringify(opts));

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xa9d8f5, 180, 1500);
const cam = new THREE.PerspectiveCamera(opts.fov, innerWidth / innerHeight, 0.3, 4000);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 3); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 700 });
function applyQuality() {
  const q = opts.quality; renderer.setPixelRatio(q === 0 ? 0.7 : q === 1 ? 1 : Math.min(devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight); sun.castShadow = q > 0; const ms = q === 2 ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  cam.aspect = innerWidth / innerHeight; cam.fov = opts.fov; cam.updateProjectionMatrix();
}
applyQuality(); addEventListener('resize', applyQuality);
{ // environment for reflections
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#2f7fd8'); gr.addColorStop(0.45, '#bfe4fb'); gr.addColorStop(0.5, '#fff6e0'); gr.addColorStop(0.56, '#8a8478'); gr.addColorStop(1, '#3a3a36'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(60, 30, 9, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture;
}
// sky
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, night: { value: 0 } },
  vertexShader: 'varying vec3 d; void main(){ d=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top,hor,sunDir,sunCol; uniform float night; varying vec3 d;
   float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
   void main(){ vec3 n=normalize(d); float h=max(n.y,0.0); vec3 c=mix(hor,top,pow(h,0.55)); float s=max(dot(n,normalize(sunDir)),0.0);
     c+=sunCol*(smoothstep(0.9990,0.9996,s)*6.0+pow(s,180.0)*0.8+pow(s,10.0)*0.22);
     vec3 g=floor(n*220.0); float st=step(0.9975,hash(g))*night*smoothstep(0.0,0.25,n.y); c+=vec3(st)*(0.6+0.4*hash(g+1.0));
     float m=max(dot(n,normalize(vec3(-0.4,0.55,0.5))),0.0); c+=vec3(0.9,0.95,1.0)*smoothstep(0.9993,0.9996,m)*night*1.5;
     gl_FragColor=vec4(c,1.0); }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);
const clouds = [];
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 36, r = 18 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 22; i++) { const m = new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }); const s = new THREE.Sprite(m); const a = Math.random() * 6.28, r = 500 + Math.random() * 1600; s.position.set(Math.cos(a) * r, 300 + Math.random() * 260, Math.sin(a) * r); const sc = 380 + Math.random() * 520; s.scale.set(sc, sc * 0.42, 1); scene.add(s); clouds.push(s); }
}

buildWorld(scene);
const P = W.places;

// ---------- time of day ----------
let tod = Q.has('time') ? +Q.get('time') : (SCENE === 'night' ? 22.5 : 10.5), nightF = 0, simT = 0;
const cTop = new THREE.Color(), cHor = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
// weather: tropical showers roll in and out
const weather = { rain: Q.has('rain') ? 1 : 0, target: Q.has('rain') ? 1 : 0, t: Q.has('rain') ? 1e9 : 140 + Math.random() * 200 };
const rainMesh = (() => { const n = 1500, a = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60, y = -10 + Math.random() * 36; a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x + 0.06; a[i * 6 + 4] = y - 1.2; a[i * 6 + 5] = z; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0, depthWrite: false, fog: false })); m.frustumCulled = false; m.visible = false; scene.add(m); return m; })();
function updateSky(dt) {
  tod = (tod + dt * 24 / 960) % 24;
  const ang = (tod - 6) / 12 * Math.PI, sy = Math.sin(ang), sx = Math.cos(ang);
  const day = clamp((sy + 0.08) / 0.3, 0, 1), dusk = clamp(1 - Math.abs(sy) / 0.32, 0, 1) * (sy > -0.2 ? 1 : 0); nightF = 1 - day;
  cTop.set(0x1f72d0).lerp(cA.set(0x070c2a), nightF).lerp(cA.set(0x3a4a8c), dusk * 0.6);
  cHor.set(0xa8d6f4).lerp(cA.set(0x2a2f6a), nightF).lerp(cA.set(0xff9a55), dusk * 0.85);
  weather.t -= dt; if (weather.t <= 0) { weather.target = weather.target ? 0 : (Math.random() < 0.55 ? 1 : 0); weather.t = weather.target ? rnd(50, 110) : rnd(160, 320); }
  weather.rain = lerp(weather.rain, weather.target, Math.min(1, dt * 0.2)); const rn = weather.rain;
  cTop.lerp(cA.set(0x56606c).multiplyScalar(1 - nightF * 0.8), rn * 0.85); cHor.lerp(cA.set(0x8b949d).multiplyScalar(1 - nightF * 0.8), rn * 0.85);
  scene.fog.far = 1500 - 1000 * rn; scene.fog.near = 180 - 130 * rn; rainMesh.visible = rn > 0.03;
  if (rainMesh.visible) { rainMesh.material.opacity = 0.42 * rn; const a = rainMesh.geometry.attributes.position.array, fall = 32 * dt; for (let i = 0; i < a.length; i += 6) { a[i + 1] -= fall; a[i + 4] -= fall; if (a[i + 4] < -10) { const y = 20 + Math.random() * 6; a[i + 1] = y; a[i + 4] = y - 1.2; } } rainMesh.geometry.attributes.position.needsUpdate = true; rainMesh.position.copy(cam.position); }
  skyMat.uniforms.top.value.copy(cTop); skyMat.uniforms.hor.value.copy(cHor); skyMat.uniforms.night.value = nightF;
  const sd = skyMat.uniforms.sunDir.value.set(sx * 0.8, sy, 0.45).normalize();
  skyMat.uniforms.sunCol.value.set(0xfff0d0).lerp(cA.set(0xff7a30), dusk).multiplyScalar(day > 0 ? 1 : 0);
  scene.fog.color.copy(cHor);
  const ld = sy > -0.05 ? sd : cB.set(0, 0, 0) && new THREE.Vector3(-0.4, 0.55, 0.5).normalize();
  const f = focusPos(); sun.target.position.set(f.x, 0, f.z); sun.position.set(f.x + ld.x * 300, Math.max(60, ld.y * 300), f.z + ld.z * 300);
  sun.color.set(0xfff2dc).lerp(cA.set(0xff8a40), dusk * 0.8).lerp(cA.set(0x8aa8ff), nightF);
  sun.intensity = 3.1 * day * (1 - dusk * 0.45) + 0.9 * nightF;
  sun.intensity *= 1 - 0.65 * rn; skyMat.uniforms.sunCol.value.multiplyScalar(1 - rn);
  hemi.intensity = 0.95 * day + 0.8 * nightF + 0.15; hemi.color.set(0xcfe8ff).lerp(cA.set(0x5a6ac8), nightF); hemi.groundColor.set(0x9a8a6a).lerp(cA.set(0x4a3a4a), nightF);
  scene.environmentIntensity = 0.3 + 0.7 * day; renderer.toneMappingExposure = 1.05 + 0.3 * nightF;
  for (const n of W.nightMats) n.m.emissiveIntensity = n.b + n.k * nightF;
  W.poolMat.opacity = nightF * 0.85; W.haloMat.opacity = nightF * 0.9; W.bulbMat.color.setRGB(0.2 + nightF * 0.8, 0.2 + nightF * 0.7, 0.2 + nightF * 0.45);
  W.haloMesh.visible = W.poolMesh.visible = nightF > 0.02;
  const wu = W.waterMat.uniforms; wu.t.value = simT; wu.day.value = day * (1 - dusk * 0.3); wu.fogC.value.copy(cHor); wu.sun.value.copy(sun.color);
  for (const c of clouds) { c.material.color.set(0xffffff).lerp(cA.set(0xffb080), dusk * 0.7).multiplyScalar(1 - nightF * 0.9); c.material.opacity = 0.9 - nightF * 0.55; c.position.x += dt * 4; if (c.position.x > 2200) c.position.x = -2200; }
  sky.position.copy(cam.position); beamMat.opacity = nightF * 0.8; headMat.color.setRGB(1, 0.96, 0.82).multiplyScalar(0.75 + nightF * 0.6);
  W.wheel.rotation.z += dt * 0.12;
  const ba = performance.now() * 0.000022 + 1; blimp.position.set(-140 + Math.cos(ba) * 310, 185, -70 + Math.sin(ba) * 310); blimp.rotation.y = Math.atan2(-Math.sin(ba), Math.cos(ba));
}
// ambient advertising blimp circling downtown
const blimp = (() => {
  const g = new THREE.Group(), teal = new THREE.MeshLambertMaterial({ color: 0x12b5a5 }), gold = new THREE.MeshLambertMaterial({ color: 0xffd84a }), white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), teal); body.scale.set(7, 7, 22);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.012, 24, 6, 0, 6.2832, 1.36, 0.42), gold); stripe.scale.set(7, 7, 22);
  const gond = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 7), white); gond.position.y = -7.4;
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11, 6), gold), f2 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 6), gold); f1.position.z = f2.position.z = -18.5;
  g.add(body, stripe, gond, f1, f2); scene.add(g); return g;
})();

// ---------- cars ----------
const CT = {
  sedan: { name: 'Calypso', L: 4.6, w: 1.9, max: 40, acc: 12, body: [[-2.3, .3], [-2.3, .82], [-2.2, .93], [-1.5, .99], [1, .96], [2.15, .78], [2.3, .62], [2.3, .3]], cab: [[-1.75, .93], [-1.2, 1.43], [.25, 1.43], [1.05, .93]] },
  sports: { name: 'Marlin GT', L: 4.5, w: 1.95, max: 58, acc: 21, body: [[-2.2, .25], [-2.2, .76], [-2, .86], [-1, .89], [.9, .8], [2.1, .6], [2.25, .45], [2.25, .25]], cab: [[-1.3, .84], [-.7, 1.2], [.15, 1.2], [.95, .8]] },
  suv: { name: 'Tortuga', L: 4.8, w: 2.05, max: 37, acc: 11, body: [[-2.4, .4], [-2.4, 1.05], [-2.3, 1.13], [.9, 1.13], [2.2, 1], [2.4, .85], [2.4, .4]], cab: [[-2.3, 1.1], [-2.1, 1.76], [.3, 1.76], [.95, 1.1]] },
  pickup: { name: 'Gatorback', L: 5.2, w: 2.05, max: 36, acc: 11, body: [[-2.6, .45], [-2.6, 1.12], [.9, 1.12], [2.3, 1], [2.55, .85], [2.55, .45]], cab: [[-.5, 1.1], [-.4, 1.78], [.55, 1.78], [1.05, 1.1]] },
  compact: { name: 'Lowtide', L: 3.9, w: 1.8, max: 36, acc: 12, body: [[-1.9, .3], [-1.9, .9], [1, .93], [1.8, .76], [1.95, .56], [1.95, .3]], cab: [[-1.85, .9], [-1.55, 1.46], [.2, 1.46], [.95, .92]] },
  muscle: { name: 'Riptide 427', L: 4.9, w: 1.98, max: 52, acc: 18, body: [[-2.45, .3], [-2.45, .84], [-2.3, .94], [-1.2, .97], [1.1, .95], [2.3, .82], [2.45, .62], [2.45, .3]], cab: [[-1.5, .94], [-1.05, 1.36], [-.05, 1.36], [.6, .94]] },
};
CT.taxi = Object.assign({}, CT.sedan, { name: 'Sol Cab', color: 0xf7c318 }); CT.police = Object.assign({}, CT.sedan, { name: 'PBPD Cruiser', color: 0xf4f6f8, max: 46, acc: 17 });
const CAR_COLORS = [0xc8102e, 0x1565c0, 0xf2f2f2, 0x16181c, 0xff7a1a, 0x12a88a, 0xf5d020, 0x8a8f96, 0xe2478a, 0x6a1b9a, 0x2e7d32, 0x35b8ff, 0x7a1f1f, 0xd8d0b8];
const paintCache = {}, geoCache = {};
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, metalness: 0.9, roughness: 0.06 }), darkMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0x7a0808 }), brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
const beamMat = new THREE.MeshBasicMaterial({ map: W.glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff0d0 });
const beamGeo = new THREE.PlaneGeometry(6.5, 13).rotateX(-Math.PI / 2);
const redMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a }), blueMat = new THREE.MeshBasicMaterial({ color: 0x1a4aff });
function paint(c) { return paintCache[c] || (paintCache[c] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.28 })); }
function prof(pts, width) {
  const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); const bt = 0.1;
  const g = new THREE.ExtrudeGeometry(s, { depth: width - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: 0.07, bevelSegments: 2, curveSegments: 1 }); g.translate(0, 0, -(width - 2 * bt) / 2); g.rotateY(-Math.PI / 2); return g;
}
function carGeo(k) {
  if (geoCache[k]) return geoCache[k]; const T = CT[k], col = h => new THREE.Color(h);
  const d = new Batch(), wx = T.w / 2 - 0.12, wz = T.L * 0.31, wr = k === 'suv' || k === 'pickup' ? 0.42 : 0.36;
  const wg = new THREE.CylinderGeometry(wr, wr, 0.3, 14).rotateZ(Math.PI / 2), hg = new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.32, 10).rotateZ(Math.PI / 2), m = new THREE.Matrix4();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { m.makeTranslation(sx * wx, wr, sz * wz); d.geo(wg, m, col(0x121212)); d.geo(hg, m, col(0xb8bcc2)); }
  const fy = T.body[0][1] + 0.16; d.box(0, fy - 0.04, T.L / 2, T.w + 0.1, 0.2, 0.3, col(0x25282c)); d.box(0, fy - 0.04, -T.L / 2, T.w + 0.1, 0.2, 0.3, col(0x25282c)); d.box(0, fy + 0.28, -T.L / 2 - 0.075, 0.5, 0.2, 0.04, col(0xe8e8e8));
  d.box(0, fy + 0.22, T.L / 2 + 0.03, T.w * 0.5, 0.2, 0.12, col(0x101214)); d.box(0, T.body[0][1] + 0.02, 0, T.w - 0.3, 0.14, T.L - 0.6, col(0x151515));
  const hl = new Batch(), tl = new Batch(), fh = T.body[T.body.length - 2][1] + 0.06, rh = T.body[1][1] - 0.08;
  for (const sx of [-1, 1]) { hl.box(sx * (T.w / 2 - 0.36), fh, T.L / 2 + 0.05, 0.44, 0.17, 0.14, col(0xffffff)); tl.box(sx * (T.w / 2 - 0.42), rh, -T.L / 2 - 0.045, 0.58, 0.17, 0.12, col(0xffffff)); }
  return geoCache[k] = { body: prof(T.body, T.w), cab: prof(T.cab, T.w * 0.86), dark: d.geometry(), hl: hl.geometry(), tl: tl.geometry() };
}
const cars = []; let carId = 0;
function makeCar(k, x, z, rot, color) {
  const T = CT[k], G = carGeo(k), g = new THREE.Group(); color = T.color || color || pickR(CAR_COLORS);
  const body = new THREE.Mesh(G.body, paint(color)); body.castShadow = true; const cab = new THREE.Mesh(G.cab, glassMat); cab.castShadow = true;
  const tl = new THREE.Mesh(G.tl, tailMat), beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(0, 0.1, T.L / 2 + 6.2); beam.renderOrder = 2;
  g.add(body, cab, new THREE.Mesh(G.dark, darkMat), new THREE.Mesh(G.hl, headMat), tl, beam);
  const top = T.cab[1][1];
  const c = { id: carId++, k, T, g, body, tl, beam, x, z, y: W.groundH(x, z), rot, vx: 0, vz: 0, speed: 0, steer: 0, hp: 100, driver: null, ai: null, parked: true, color, dead: false, fire: 0, stuck: 0, bar: null, sirenT: 0 };
  if (k === 'police') { const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.3), redMat), b2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.3), blueMat); b1.position.set(-0.32, top + 0.12, -0.3); b2.position.set(0.32, top + 0.12, -0.3); const st = new THREE.Mesh(new THREE.BoxGeometry(T.w + 0.03, 0.22, T.L * 0.5), new THREE.MeshLambertMaterial({ color: 0x1a3a7a })); st.position.y = 0.72; g.add(b1, b2, st); c.bar = [b1, b2]; }
  if (k === 'taxi') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff2a0 })); s.position.set(0, top + 0.14, -0.4); g.add(s); }
  scene.add(g); cars.push(c); syncCar(c); return c;
}
function syncCar(c) {
  const fx = Math.sin(c.rot), fz = Math.cos(c.rot), h = W.groundH(c.x, c.z), hf = W.groundH(c.x + fx * 1.6, c.z + fz * 1.6), hb = W.groundH(c.x - fx * 1.6, c.z - fz * 1.6);
  const ty = Math.max(h, (hf + hb) / 2); c.y = c.y > ty + 0.02 ? Math.max(ty, c.y - 0.25) : lerp(c.y, ty, 0.5);
  c.g.position.set(c.x, c.y, c.z); c.g.rotation.set(0, 0, 0); c.g.rotation.order = 'YXZ'; c.g.rotation.y = c.rot; c.g.rotation.x = clamp(-Math.atan2(hf - hb, 3.2), -0.3, 0.3) + (c.braking && c.speed > 3 ? 0.025 : 0);
  c.g.rotation.z = c.driver === 'player' ? clamp(c.steer * c.speed * 0.0035, -0.07, 0.07) : 0; // body roll in corners
  c.inWater = h < -1;
}
function removeCar(c) { scene.remove(c.g); const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1); c.gone = true; }
const laneOff = (e, lane) => e.hw > 8 ? (lane ? 7.4 : 3.6) : (lane ? 5.2 : 1.8);
function initAI(c, node, link, lane) { c.ai = { from: node, link, lane: lane === undefined ? (Math.random() < 0.5 ? 0 : 1) : lane, phase: 'road', next: null, cruise: rnd(9, 14), nav: null, rev: 0, panic: 0 }; c.parked = false; }
function spawnTraffic(near, minD, maxD) {
  for (let tries = 0; tries < 12; tries++) {
    const e = pickR(W.edges), fwd = Math.random() < 0.5, a = fwd ? e.a : e.b, l = a.links.find(k => k.e === e), t = rnd(0.15, 0.85), lane = Math.random() < 0.5 ? 0 : 1, off = laneOff(e, lane);
    const x = a.x + l.dx * e.len * t - l.dz * off, z = a.z + l.dz * e.len * t + l.dx * off, d = dist2(x, z, near.x, near.z);
    if (d < minD || d > maxD || (e.bridge && (x > 370 && x < 680) && Math.random() < 0.6)) continue;
    if (cars.some(c => dist2(c.x, c.z, x, z) < 12)) continue;
    const r = Math.random(), k = r < 0.3 ? 'sedan' : r < 0.45 ? 'compact' : r < 0.6 ? 'suv' : r < 0.72 ? 'pickup' : r < 0.82 ? 'taxi' : r < 0.9 ? 'muscle' : r < 0.97 ? 'sports' : 'police';
    const c = makeCar(k, x, z, Math.atan2(l.dx, l.dz)); c.driver = 'ai'; initAI(c, a, l, lane); c.speed = c.ai.cruise; return c;
  }
}
function steerTo(c, wx, wz, dt, rate) { const diff = wrapPi(Math.atan2(wx - c.x, wz - c.z) - c.rot); c.rot += clamp(diff * 4, -rate, rate) * dt * clamp(Math.abs(c.speed) / 4, 0, 1) * (c.speed < 0 ? -1 : 1); return diff; }
function blockedAhead(c) {
  const fx = Math.sin(c.rot), fz = Math.cos(c.rot), reach = 5 + c.speed * 0.9;
  for (const o of cars) { if (o === c) continue; const rx = o.x - c.x, rz = o.z - c.z, f = rx * fx + rz * fz; if (f < 0.5 || f > reach + 2) continue; if (Math.abs(-rx * fz + rz * fx) < 1.9) return true; }
  for (const p of peds) { if (p.dead) continue; const rx = p.x - c.x, rz = p.z - c.z, f = rx * fx + rz * fz; if (f < 0.5 || f > reach) continue; if (Math.abs(-rx * fz + rz * fx) < 1.5) return true; }
  if (!player.car) { const rx = player.x - c.x, rz = player.z - c.z, f = rx * fx + rz * fz; if (f > 0.5 && f < reach && Math.abs(-rx * fz + rz * fx) < 1.5) return true; }
  return false;
}
function aiDrive(c, dt, fast) {
  const ai = c.ai, l = ai.link, b = l.to, off = laneOff(l.e, ai.lane), rx = -l.dz, rz = l.dx;
  let target = fast ? fast : ai.cruise * (ai.panic > 0 ? 1.9 : 1), wx, wz;
  if (ai.panic > 0) ai.panic -= dt;
  if (ai.phase === 'road') {
    const sx = b.x - l.dx * (b.h + 2.5) + rx * off, sz = b.z - l.dz * (b.h + 2.5) + rz * off, along = (sx - c.x) * l.dx + (sz - c.z) * l.dz;
    if (along < 1.5) {
      const st = b.light ? W.lightState(b, l.dx, l.dz, simT) : 2;
      if (st !== 2 && !fast && ai.panic <= 0) target = 0;
      else { let o = b.links.filter(k => !(k.to === ai.from)); if (!o.length) o = b.links; if (fast && o.length > 1 && Math.random() < 0.6) o = o.filter(k => k.dx === l.dx && k.dz === l.dz).concat(o).slice(0, 1); ai.next = pickR(o); ai.phase = 'turn'; }
      wx = sx + l.dx * 4; wz = sz + l.dz * 4;
    } else {
      if (b.light && !fast && ai.panic <= 0 && along < 26 && W.lightState(b, l.dx, l.dz, simT) !== 2) target = Math.min(target, Math.max(0, along - 1.5) * 0.7);
      const la = Math.min(along, 9); wx = sx - l.dx * (along - la); wz = sz - l.dz * (along - la);
    }
  }
  if (ai.phase === 'turn') {
    const n = ai.next, o2 = laneOff(n.e, ai.lane); wx = b.x + n.dx * (b.h + 2.5) - n.dz * o2; wz = b.z + n.dz * (b.h + 2.5) + n.dx * o2;
    if (n.dx !== l.dx || n.dz !== l.dz) target = Math.min(target, fast ? 13 : 7);
    if ((wx - c.x) * n.dx + (wz - c.z) * n.dz < 1.2) { ai.from = b; ai.link = n; ai.phase = 'road'; }
  }
  if (!fast && target > 0 && blockedAhead(c)) { target = 0; c.stuck += dt; if (c.stuck > 6 && Math.random() < dt * 0.5) honk(c); } else if (target > 0) c.stuck = 0;
  c.speed += clamp(target - c.speed, -16 * dt, (fast ? 12 : 5) * dt);
  steerTo(c, wx, wz, dt, fast ? 2.6 : 2.2);
  c.braking = target < c.speed - 0.5;
  moveKin(c, dt);
}
function moveKin(c, dt) {
  const fx = Math.sin(c.rot), fz = Math.cos(c.rot); c.vx = fx * c.speed; c.vz = fz * c.speed; c.x += c.vx * dt; c.z += c.vz * dt;
  const r = W.collideCircle(c.x + fx * 1.2, c.z + fz * 1.2, 1.15, 0, true); if (r.hit) { c.x = r.x - fx * 1.2; c.z = r.z - fz * 1.2; if (Math.abs(c.speed) > 6) { crashFx(c, Math.abs(c.speed)); } c.speed *= 0.6; c.hitWall = 0.4; }
}
function honk(c) { const d = dist2(c.x, c.z, player.x, player.z); if (d < 60) au('play', 'horn', { vol: clamp(1 - d / 60, 0.05, 0.6) }); }
function crashFx(c, imp) {
  const d = dist2(c.x, c.z, cam.position.x, cam.position.z); if (d < 90) au('play', 'crash', { vol: clamp(imp / 30, 0.15, 1) * clamp(1 - d / 90, 0, 1) });
  damageCar(c, imp * 1.1); for (let i = 0; i < 5; i++) spark(c.x + Math.sin(c.rot) * 2, c.y + 0.7, c.z + Math.cos(c.rot) * 2, 0xffd080);
  c.body.scale.set(1 - rnd(0.03), 1 - rnd(0.05), 1 - Math.min(0.1, (100 - c.hp) * 0.0012)); c.body.rotation.z = rnd(-0.02, 0.02) * (100 - c.hp) / 40;
  if (c === player.car) shake = Math.min(1, imp / 25);
}
function damageCar(c, d) {
  if (c.dead) return; c.hp -= d;
  if (c.hp <= 0) explodeCar(c);
}
function explodeCar(c) {
  if (c.dead) return; c.dead = true; c.hp = 0; c.driver = c.driver === 'player' ? 'player' : null; c.ai = null; c.speed = 0; c.fire = 12;
  c.body.material = paint(0x1a1a1a); explosion(c.x, c.y + 1, c.z);
  if (player.car === c) { exitCar(true); hurtPlayer(70); }
  for (const o of cars) if (o !== c && !o.dead && dist2(o.x, o.z, c.x, c.z) < 7) damageCar(o, 60);
  for (const p of peds) if (!p.dead && dist2(p.x, p.z, c.x, c.z) < 8) hurtPed(p, 200, c.x, c.z);
  if (!player.car && dist2(player.x, player.z, c.x, c.z) < 8) hurtPlayer(60);
  alarm(c.x, c.z, 90); if (mission && mission.onCarDead) mission.onCarDead(c);
}

// ---------- particles / fx ----------
const fx = [];
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function puff(x, y, z, color, size, life, vy = 1, add = false, grow = 2) {
  if (fx.length > 160) return; const m = new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !add });
  const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.setScalar(size); scene.add(s); fx.push({ s, t: 0, life, vx: rnd(-0.5, 0.5), vy, vz: rnd(-0.5, 0.5), size, grow, sprite: true });
}
function spark(x, y, z, color) { if (fx.length > 160) return; const m = new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.setScalar(0.35); scene.add(s); fx.push({ s, t: 0, life: 0.45, vx: rnd(-4, 4), vy: rnd(1, 5), vz: rnd(-4, 4), size: 0.35, grow: 0, sprite: true, grav: 12 }); }
const tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
function tracer(a, b, color = 0xfff0a0) { const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.scale.z = a.distanceTo(b); scene.add(m); fx.push({ s: m, t: 0, life: 0.09, vx: 0, vy: 0, vz: 0, size: 1, grow: 0 }); }
const flashLight = new THREE.PointLight(0xffc060, 0, 30); scene.add(flashLight);
function explosion(x, y, z) {
  au('play', 'explosion', { vol: clamp(1.2 - dist2(x, z, cam.position.x, cam.position.z) / 150, 0.1, 1) }); shake = Math.max(shake, clamp(1.4 - dist2(x, z, player.x, player.z) / 40, 0, 1));
  for (let i = 0; i < 10; i++) puff(x + rnd(-2, 2), y + rnd(0, 2), z + rnd(-2, 2), pickR([0xffb030, 0xff6a1a, 0xffe080]), rnd(3, 6), rnd(0.4, 0.9), rnd(2, 6), true, 6);
  for (let i = 0; i < 8; i++) puff(x + rnd(-2, 2), y + rnd(1, 3), z + rnd(-2, 2), 0x222222, rnd(3, 5), rnd(1.5, 3), rnd(2, 5), false, 4);
  for (let i = 0; i < 14; i++) spark(x, y, z, 0xffc060); flashLight.position.set(x, y + 2, z); flashLight.intensity = 400;
}
function updateFx(dt) {
  flashLight.intensity *= Math.pow(0.001, dt);
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { scene.remove(f.s); f.s.material.dispose(); fx.splice(i, 1); continue; }
    if (f.grav) f.vy -= f.grav * dt; f.s.position.x += f.vx * dt; f.s.position.y += f.vy * dt; f.s.position.z += f.vz * dt;
    if (f.sprite) { f.s.scale.setScalar(f.size + f.grow * k); } f.s.material.opacity = (1 - k) * 0.85;
  }
}

// ---------- humans ----------
const pedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const SKINS = [0xf1c9a5, 0xd9a273, 0xa86f48, 0x7a4a2c, 0xf5d5b8, 0x5a3520], SHIRTS = [0xff5a5a, 0x35b8ff, 0xffd23c, 0xffffff, 0x3cd6a0, 0xff8fc0, 0x8a5cf0, 0x202428, 0xff8a3c, 0x1e88e5, 0xf48fb1, 0x9ccc65], PANTS = [0x2a3a5a, 0x1c1c1e, 0xd8c8a0, 0xf2f2f2, 0x5a4a3a, 0x3a5a8a, 0x7a2a3a];
function outfitGeo(skin, shirt, pants, hair, shorts, extra) {
  const C = h => new THREE.Color(h), b = new Batch();
  b.box(0, 1.22, 0, 0.46, 0.6, 0.26, C(shirt)); b.box(0, 0.92, 0, 0.42, 0.2, 0.25, C(pants)); b.cyl(0, 1.56, 0, 0.06, 0.1, C(skin)); b.sph(0, 1.7, 0, 0.145, C(skin), 1.15); b.sph(0, 1.755, -0.03, 0.15, C(hair), 0.95);
  if (extra === 'shades') b.box(0, 1.72, 0.125, 0.24, 0.05, 0.06, C(0x111111));
  if (extra === 'cop') { b.cyl(0, 1.86, 0, 0.17, 0.08, C(0x16264a)); b.box(0, 1.83, 0.14, 0.2, 0.03, 0.14, C(0x101a30)); b.box(0.13, 1.36, 0.135, 0.08, 0.08, 0.02, C(0xf2c230)); }
  if (extra === 'gang') b.box(0, 1.8, 0, 0.3, 0.08, 0.3, C(0x2aa84a));
  const arm = new Batch(); arm.box(0, -0.15, 0, 0.125, 0.34, 0.14, C(shirt)); arm.box(0, -0.46, 0, 0.1, 0.3, 0.11, C(skin)); arm.box(0, -0.65, 0, 0.1, 0.1, 0.1, C(skin));
  const leg = new Batch(); leg.box(0, -0.22, 0, 0.18, 0.46, 0.2, C(pants)); leg.box(0, -0.6, 0, 0.145, 0.36, 0.16, C(shorts ? skin : pants)); leg.box(0, -0.83, 0.05, 0.16, 0.1, 0.3, C(shorts ? 0xffffff : 0x1a1a1a));
  return { body: b.geometry(), arm: arm.geometry(), leg: leg.geometry() };
}
const OUTFITS = []; for (let i = 0; i < 12; i++) OUTFITS.push(outfitGeo(pickR(SKINS), pickR(SHIRTS), pickR(PANTS), pickR([0x1a1410, 0x3a2a1a, 0xd8b060, 0x6a3a1a, 0x111111, 0xc0c0c0]), Math.random() < 0.5));
const COP_OUT = outfitGeo(0xd9a273, 0x1e3a6a, 0x16264a, 0x1a1410, false, 'cop'), GANG_OUT = outfitGeo(0xa86f48, 0x2aa84a, 0x1c1c1e, 0x111111, false, 'gang'), HERO_OUT = outfitGeo(0xd9a273, 0x12b5a5, 0xf0ead8, 0x1a1410, false, 'shades');
const gunGeo = (() => { const b = new Batch(), c = new THREE.Color(0x15171a); b.box(0, -0.84, 0.05, 0.05, 0.3, 0.1, c); b.box(0, -0.7, -0.02, 0.05, 0.1, 0.16, c); return b.geometry(); })();
const rifleGeo = (() => { const b = new Batch(), c = new THREE.Color(0x15171a); b.box(0, -0.9, 0.06, 0.06, 0.95, 0.1, c); b.box(0, -0.75, -0.06, 0.05, 0.1, 0.2, c); b.box(0, -0.45, 0.07, 0.06, 0.3, 0.13, new THREE.Color(0x5a3a22)); return b.geometry(); })();
function makeHuman(o) {
  const g = new THREE.Group(), body = new THREE.Mesh(o.body, pedMat); body.castShadow = true; g.add(body); const parts = { body };
  for (const [n, x, y, geo] of [['aL', -0.3, 1.5, o.arm], ['aR', 0.3, 1.5, o.arm], ['lL', -0.11, 0.9, o.leg], ['lR', 0.11, 0.9, o.leg]]) { const m = new THREE.Mesh(geo, pedMat); m.position.set(x, y, 0); m.castShadow = true; g.add(m); parts[n] = m; }
  const gun = new THREE.Mesh(gunGeo, pedMat); gun.visible = false; parts.aR.add(gun); parts.gun = gun; scene.add(g); return { g, parts };
}
function animHuman(h, phase, amp, aim, punch) {
  const s = Math.sin(phase) * amp, p = h.parts; p.lL.rotation.x = s; p.lR.rotation.x = -s; p.aL.rotation.x = -s * 0.8; p.aR.rotation.x = aim ? -1.5 : s * 0.8; if (aim === 2) p.aL.rotation.x = -1.4, p.aL.rotation.z = -0.35; else p.aL.rotation.z = 0;
  if (punch > 0) p.aR.rotation.x = -1.6 * Math.sin(punch * Math.PI); p.body.rotation.x = amp > 0.8 ? 0.12 : 0;
}
const peds = [];
function spawnPed(x, z, kind = 'civ') {
  const h = makeHuman(kind === 'cop' ? COP_OUT : kind === 'gang' ? GANG_OUT : pickR(OUTFITS));
  const p = Object.assign(h, { x, z, y: W.groundH(x, z), rot: rnd(6.28), kind, state: kind === 'civ' ? 'walk' : 'fight', hp: kind === 'civ' ? 60 : 100, tx: x, tz: z, block: null, corner: 0, dir: Math.random() < 0.5 ? 1 : -1, speed: rnd(1.3, 1.9), phase: rnd(6), t: 0, dead: false, shootT: rnd(0.5, 1.5), vy: 0, fx: 0, fz: 0 });
  if (kind !== 'civ') p.parts.gun.visible = true;
  peds.push(p); return p;
}
function ringCorner(b, k) { const m = 2.6; k = ((k % 4) + 4) % 4; return k === 0 ? [b.x0 + m, b.z0 + m] : k === 1 ? [b.x1 - m, b.z0 + m] : k === 2 ? [b.x1 - m, b.z1 - m] : [b.x0 + m, b.z1 - m]; }
const BEACH = { x0: 296, x1: 366, z0: -400, z1: 420, cx: 331, cz: 10, i: 99, j: 99 };
function spawnCiv(near, minD, maxD) {
  for (let t = 0; t < 10; t++) {
    const b = near.x > 120 && Math.random() < 0.3 ? BEACH : pickR(W.blocks); if (b !== BEACH && dist2(b.cx, b.cz, near.x, near.z) > maxD + 100) continue;
    const k = Math.floor(rnd(4)), c0 = ringCorner(b, k), c1 = ringCorner(b, k + 1), u = Math.random(), x = lerp(c0[0], c1[0], u), z = lerp(c0[1], c1[1], u), d = dist2(x, z, near.x, near.z);
    if (d < minD || d > maxD) continue; const p = spawnPed(x, z); p.block = b; p.corner = p.dir > 0 ? k + 1 : k; const c = ringCorner(b, p.corner); p.tx = c[0]; p.tz = c[1]; return p;
  }
}
function removePed(p) { scene.remove(p.g); const i = peds.indexOf(p); if (i >= 0) peds.splice(i, 1); }
function alarm(x, z, r, strong) { for (const p of peds) { if (p.dead || p.kind !== 'civ') continue; const d = dist2(p.x, p.z, x, z); if (d < r) { if (p.state !== 'flee' && d < 40 && Math.random() < 0.4) au('play', 'scream', { vol: clamp(1 - d / 40, 0.1, 0.7) }); p.state = 'flee'; p.t = rnd(6, 11); p.fx = x; p.fz = z; } }
  for (const c of cars) if (c.driver === 'ai' && c.ai && dist2(c.x, c.z, x, z) < r * 0.6) c.ai.panic = 6; }
function hurtPed(p, dmg, sx, sz, byPlayer) {
  if (p.dead) return; p.hp -= dmg; for (let i = 0; i < 3; i++) puff(p.x, p.y + 1.3, p.z, 0xa01010, 0.35, 0.4, 0.5, false, 0.6);
  if (p.hp <= 0) {
    p.dead = true; p.t = 0; p.g.rotation.x = -Math.PI / 2; p.g.position.y = p.y + 0.22; p.vy = 0; au('play', 'scream', { vol: 0.5 });
    if (byPlayer) { addCrime(p.kind === 'cop' ? 4 : p.kind === 'gang' ? 0 : 2.2); if (Math.random() < 0.7 || p.kind === 'gang') pickups.push(makePickup(p.x + rnd(-1, 1), p.z + rnd(-1, 1), 'cash', Math.floor(rnd(20, 140)))); }
    if (mission && mission.onPedDead) mission.onPedDead(p);
  } else if (p.kind === 'civ') { p.state = 'flee'; p.t = 10; p.fx = sx; p.fz = sz; }
}
function updatePeds(dt) {
  const tgt = player.car || player;
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    if (p.dead) { p.t += dt; if (p.t > 25 && p.kind !== 'keep') removePed(p); continue; }
    const dP = dist2(p.x, p.z, player.x, player.z);
    if (dP > 260 && p.kind === 'civ') { removePed(p); continue; }
    let sp = 0, aim = 0;
    if (p.state === 'walk') {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.6) {
        const b = p.block;
        if (Math.random() < 0.3) { // cross to a neighbouring block
          const nb = W.blocks.filter(o => o !== b && Math.abs(o.i - b.i) + Math.abs(o.j - b.j) === 1); const n = nb.length ? pickR(nb) : null; let best = 0, bd = 1e9; if (n) for (let k = 0; k < 4; k++) { const c = ringCorner(n, k), dd = dist2(c[0], c[1], p.x, p.z); if (dd < bd) { bd = dd; best = k; } }
          if (n && bd < 30) { p.block = n; p.corner = best; } else p.corner += p.dir;
        } else p.corner += p.dir;
        const c = ringCorner(p.block, p.corner); p.tx = c[0]; p.tz = c[1];
      } else { p.rot = Math.atan2(dx, dz); sp = p.speed; }
      if (!player.car && player.aiming && player.weapon > 0 && dP < 14) alarm(player.x, player.z, 14);
    } else if (p.state === 'flee') {
      p.t -= dt; const a = Math.atan2(p.x - p.fx, p.z - p.fz) + Math.sin(p.phase * 0.2) * 0.4; p.rot = a; sp = 5.6;
      if (p.t <= 0) { p.state = 'walk'; let bb = null, bd = 1e9; for (const b of W.blocks) { const d = dist2(b.cx, b.cz, p.x, p.z); if (d < bd) { bd = d; bb = b; } } p.block = bb; let bk = 0; bd = 1e9; for (let k = 0; k < 4; k++) { const c = ringCorner(bb, k), d = dist2(c[0], c[1], p.x, p.z); if (d < bd) { bd = d; bk = k; } } p.corner = bk; const c = ringCorner(bb, bk); p.tx = c[0]; p.tz = c[1]; }
    } else if (p.state === 'fight') { // cops & gang
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz); p.rot = Math.atan2(dx, dz);
      const hostile = p.kind === 'gang' ? (d < 45 || p.alert) : wanted.stars > 0;
      if (!hostile) { if (p.kind === 'cop' && wanted.stars === 0) { p.t += dt; if (p.t > 8 && dP > 40) { removePed(p); continue; } } }
      else {
        if (p.kind === 'cop' && wanted.stars === 1) { if (!player.car) { if (d > 1.6) sp = 5.2; else { bustT += dt; if (bustT > 1.2) busted(); } } }
        else { aim = 1; if (d > (p.kind === 'gang' ? 22 : 16)) sp = 4.2; p.shootT -= dt;
          if (p.shootT <= 0 && d < 55) { p.shootT = rnd(1.2, 2.5); if (W.los(p.x, p.z, tgt.x, tgt.z)) { au('play', 'pistol', { vol: clamp(1 - d / 70, 0.15, 0.7) }); const a = new THREE.Vector3(p.x, p.y + 1.45, p.z), hit = Math.random() < (player.car ? 0.45 : clamp(0.42 - d / 120, 0.1, 0.36) * (player.sprinting ? 0.55 : 1)); const b = new THREE.Vector3(tgt.x + (hit ? 0 : rnd(-2, 2)), (player.car ? tgt.y : player.y) + 1.1 + (hit ? 0 : rnd(-0.5, 1.5)), tgt.z + (hit ? 0 : rnd(-2, 2))); tracer(a, b, 0xffd0a0); if (hit) { if (player.car) { damageCar(player.car, 4); spark(b.x, b.y, b.z, 0xffd080); if (Math.random() < 0.25) hurtPlayer(5); } else hurtPlayer(p.kind === 'gang' ? 7 : 8); } } }
        }
      }
    }
    if (sp > 0) {
      p.x += Math.sin(p.rot) * sp * dt; p.z += Math.cos(p.rot) * sp * dt; p.phase += dt * sp * 2.6;
      if (p.state !== 'walk') { const r = W.collideCircle(p.x, p.z, 0.4); if (r.hit) { p.x = r.x; p.z = r.z; p.phase += 0.3; if (p.state === 'flee') { p.fx += rnd(-20, 20); p.fz += rnd(-20, 20); } } }
    }
    p.y = Math.max(W.groundH(p.x, p.z), -1.3);
    // hit by cars
    for (const c of cars) { const sp2 = Math.hypot(c.vx, c.vz); if (sp2 < 3.5) continue; const rx = p.x - c.x, rz = p.z - c.z; if (Math.abs(rx) > 4 || Math.abs(rz) > 4) continue; const fxx = Math.sin(c.rot), fzz = Math.cos(c.rot), f = rx * fxx + rz * fzz, s = -rx * fzz + rz * fxx; if (Math.abs(f) < c.T.L / 2 + 0.3 && Math.abs(s) < c.T.w / 2 + 0.3) { au('play', 'punch', { vol: 0.8 }); hurtPed(p, sp2 * 9, c.x, c.z, c === player.car); p.x += c.vx * 0.15; p.z += c.vz * 0.15; if (c === player.car) { addCrime(1.2); alarm(p.x, p.z, 30); } break; } }
    if (!p.dead) { p.g.position.set(p.x, p.y, p.z); p.g.rotation.y = p.rot; animHuman(p, p.phase, sp > 4 ? 1.0 : sp > 0 ? 0.55 : 0, aim, 0); if (p.state === 'flee') { p.parts.aL.rotation.x = p.parts.aR.rotation.x = -2.8; } }
    else p.g.position.set(p.x, p.y + 0.22, p.z);
  }
}

// ---------- player ----------
const hero = makeHuman(HERO_OUT); const heroRifle = new THREE.Mesh(rifleGeo, pedMat); hero.parts.aR.add(heroRifle); heroRifle.visible = false;
const WEAPONS = [{ name: 'Fists', mag: 0, rate: 0.45 }, { name: 'Pistol', mag: 12, rate: 0.22, dmg: 36, snd: 'pistol', spread: 0.012 }, { name: 'Rifle', mag: 30, rate: 0.095, dmg: 30, snd: 'rifle', spread: 0.02, auto: true }];
const player = { x: P.spawn.x, z: P.spawn.z, y: 0.2, vy: 0, rot: 0, hp: 100, armor: 0, money: 250, car: null, weapon: 1, owned: [true, true, false], mag: [0, 12, 30], ammo: [0, 48, 0], phase: 0, punch: 0, fireT: 0, reload: 0, aiming: false, sprinting: false, onGround: true, dead: 0, stepT: 0, done: [], flam: [] };
let camYaw = Math.PI, camPitch = 0.22, camDist = 4.6, shake = 0, lastMouse = 9, bustT = 0;
const keys = {}, mouse = { l: false, r: false, lp: false };
const focusPos = () => player.car || player;

function enterCar(c) {
  if (c.dead) return; if (c.driver === 'ai' || c.driver === 'cop') { const p = spawnPed(c.x - Math.cos(c.rot) * 2, c.z + Math.sin(c.rot) * 2); p.state = 'flee'; p.t = 12; p.fx = c.x; p.fz = c.z; let bb = W.blocks[0]; p.block = bb; addCrime(c.k === 'police' ? 3 : 1.1); alarm(c.x, c.z, 18); au('play', 'scream', { vol: 0.5 }); }
  c.driver = 'player'; c.ai = null; c.parked = false; player.car = c; hero.g.visible = false; au('play', 'door'); camYaw = c.rot; lastMouse = 9;
  showZone(c.T.name, c.k === 'police' ? 'Police vehicle' : c.k === 'sports' || c.k === 'muscle' ? 'Sports' : 'Vehicle');
  if (radioIdx >= 0) { rad('set', radioIdx); showRadio(); }
  if (mission && mission.onEnter) mission.onEnter(c);
}
function exitCar(force) {
  const c = player.car; if (!c) return; if (!force && Math.hypot(c.vx, c.vz) > 22) { toast('Slow down to bail out.'); return; }
  let ox = Math.cos(c.rot) * 1.9, oz = -Math.sin(c.rot) * 1.9; if (W.collideCircle(c.x + ox, c.z + oz, 0.4).hit) { ox = -ox; oz = -oz; }
  player.x = c.x + ox; player.z = c.z + oz; player.y = Math.max(c.y, W.groundH(player.x, player.z)); player.rot = c.rot; c.driver = null; c.speed = Math.hypot(c.vx, c.vz); player.car = null; hero.g.visible = true; au('play', 'door'); rad('set', -1); au('engine', false, 0, 0); au('skid', 0);
}
function hurtPlayer(d) {
  if (player.dead || state !== 'play') return; if (player.armor > 0) { const a = Math.min(player.armor, d * 0.8); player.armor -= a; d -= a; }
  player.hp -= d; dmgFlash = 0.6; player.hurtT = simT; au('play', 'hurt', { vol: 0.5 });
  if (player.hp <= 0) { player.hp = 0; player.dead = 0.001; if (player.car) exitCar(true); hero.g.rotation.x = -Math.PI / 2; banner('WIPED OUT', 'Palmera General patched you up  ·  -$' + Math.min(player.money, 250), 'bad'); au('play', 'wasted'); rad('set', -1); if (mission) failMission('You were wiped out.'); }
}
function respawn(where, cost) {
  player.dead = 0; player.hp = 100; player.x = where.x; player.z = where.z; player.y = 0.2; player.vy = 0; hero.g.rotation.x = 0; hero.g.visible = true; player.money = Math.max(0, player.money - cost); clearWanted(); camYaw = 0; tod = (tod + 6) % 24; $('fade').style.opacity = 0;
}
function busted() { if (player.dead) return; bustT = 0; player.dead = 0.001; player.busted = true; banner('BUSTED', 'The PBPD kept your ammo  ·  -$' + Math.min(player.money, 400), 'blue'); au('play', 'busted'); au('play', 'missionFail'); if (mission) failMission('You got busted.'); }

function updatePlayer(dt) {
  if (player.dead) { player.dead += dt; if (player.dead > 2.6) $('fade').style.opacity = 1; if (player.dead > 3.8) { if (player.busted) { player.busted = false; player.ammo = [0, 24, 0]; respawn(P.police, 400); } else respawn(P.hospital, 250); save(); } return; }
  const inp = input(); player.fireT -= dt;
  if (player.hp < 40 && simT - (player.hurtT || 0) > 8) player.hp = Math.min(40, player.hp + dt * 3); // catch your breath out of combat
  if (player.car) { if (player.car.driver !== 'bot') driveCar(player.car, dt, inp); else au('engine', true, clamp(player.car.speed / 40, 0, 1), 0.6); player.x = player.car.x; player.z = player.car.z; player.y = player.car.y; tickReload(dt); if (inp.fire && player.weapon > 0 && player.car && player.car.driver === 'player') attack(inp); return; }
  const fwx = Math.sin(camYaw), fwz = Math.cos(camYaw); let mx = fwx * inp.f + -fwz * -inp.s * -1, mz = fwz * inp.f + fwx * -inp.s * -1;
  // right vector = (-fz, fx)
  mx = fwx * inp.f + (-fwz) * inp.s; mz = fwz * inp.f + fwx * inp.s;
  const ml = Math.hypot(mx, mz); player.aiming = (inp.aim || player.fireT > -0.5) && player.weapon > 0; player.sprinting = inp.sprint && ml > 0 && !inp.aim;
  const gh = W.groundH(player.x, player.z), swim = gh < -0.9; let sp = swim ? 2.6 : player.sprinting ? 7.6 : inp.aim ? 2.6 : 4.4;
  if (ml > 0.01) { mx /= ml; mz /= ml; player.x += mx * sp * dt; player.z += mz * sp * dt; if (!player.aiming) player.rot += wrapPi(Math.atan2(mx, mz) - player.rot) * Math.min(1, dt * 12); player.phase += dt * sp * 2.4; player.stepT -= dt * sp; if (player.stepT <= 0 && player.onGround && !swim) { player.stepT = 2.4; au('play', 'step', { vol: player.sprinting ? 0.5 : 0.3 }); } } else sp = 0;
  if (player.aiming) player.rot += wrapPi(camYaw - player.rot) * Math.min(1, dt * 18);
  let r = W.collideCircle(player.x, player.z, 0.42, player.y); player.x = r.x; player.z = r.z;
  for (const c of cars) { const rx = player.x - c.x, rz = player.z - c.z; if (Math.abs(rx) > 4 || Math.abs(rz) > 4) continue; const fx2 = Math.sin(c.rot), fz2 = Math.cos(c.rot), f = rx * fx2 + rz * fz2, s = -rx * fz2 + rz * fx2, hl = c.T.L / 2 + 0.4, hw = c.T.w / 2 + 0.4; if (Math.abs(f) < hl && Math.abs(s) < hw && player.y < c.y + 1.3) { const cs = Math.hypot(c.vx, c.vz); if (cs > 5 && c.driver !== 'player') { hurtPlayer(cs * 2.2); player.vy = 4; } const pf = hl - Math.abs(f), ps = hw - Math.abs(s); let nf = f, ns = s; if (pf < ps) nf = Math.sign(f) * hl; else ns = Math.sign(s) * hw; player.x = c.x + fx2 * nf + -fz2 * ns * 1; player.z = c.z + fz2 * nf + fx2 * ns; player.x = c.x + fx2 * nf - fz2 * ns; } }
  player.x = clamp(player.x, -1100, 1300); player.z = clamp(player.z, -900, 900);
  const g2 = W.groundH(player.x, player.z), floor = Math.max(g2, -1.35);
  if (inp.jump && player.onGround && !swim) { player.vy = 6.6; player.onGround = false; }
  player.vy -= 21 * dt; player.y += player.vy * dt; if (player.y <= floor) { if (player.vy < -13) hurtPlayer((-player.vy - 12) * 6); player.y = floor; player.vy = 0; player.onGround = true; } else if (player.y > floor + 0.3) player.onGround = false;
  if (player.punch > 0) player.punch -= dt / 0.4;
  tickReload(dt);
  if (inp.fire) attack(inp);
  hero.g.position.set(player.x, player.y - (swim ? 0.15 : 0), player.z); hero.g.rotation.y = player.rot; animHuman(hero, player.phase, sp > 6 ? 1.05 : sp > 0 ? 0.6 : 0, player.aiming ? (player.weapon === 2 ? 2 : 1) : 0, player.punch);
  hero.parts.gun.visible = player.weapon === 1; heroRifle.visible = player.weapon === 2;
}
function tickReload(dt) { if (player.reload > 0) { player.reload -= dt; if (player.reload <= 0) { const w = player.weapon, n = Math.min(WEAPONS[w].mag - player.mag[w], player.ammo[w]); player.mag[w] += n; player.ammo[w] -= n; } } }
function switchWeapon(w) { if (player.owned[w] && w !== player.weapon) { player.weapon = w; player.reload = 0; au('play', 'reload', { vol: 0.4 }); } }
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3();
function attack(inp) {
  const w = player.weapon, WP = WEAPONS[w]; if (player.fireT > 0 || player.reload > 0) return; if (!WP.auto && !inp.firePressed && w > 0) return;
  player.fireT = WP.rate;
  if (w === 0) { player.punch = 1; au('play', 'punch', { vol: 0.5 }); for (const p of peds) { if (p.dead) continue; const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz); if (d < 1.8 && Math.abs(wrapPi(Math.atan2(dx, dz) - player.rot)) < 1.1) { hurtPed(p, 34, player.x, player.z, true); addCrime(0.7); alarm(player.x, player.z, 16); break; } } return; }
  if (player.mag[w] <= 0) { if (player.ammo[w] > 0) startReload(); else au('play', 'empty'); player.fireT = 0.3; return; }
  player.mag[w]--; au('play', WP.snd); player.rot = camYaw; shake = Math.max(shake, 0.12); camPitch -= 0.006;
  cam.getWorldDirection(_d); _d.x += rnd(-WP.spread, WP.spread); _d.y += rnd(-WP.spread, WP.spread); _d.z += rnd(-WP.spread, WP.spread); _d.normalize(); _o.copy(cam.position).addScaledVector(_d, camDist * 0.9);
  const hit = shootRay(_o, _d, 220); _h.copy(_o).addScaledVector(_d, hit.t);
  const muzzle = new THREE.Vector3(player.x + Math.sin(player.rot) * 0.8 - Math.cos(player.rot) * 0.3, player.y + 1.45, player.z + Math.cos(player.rot) * 0.8 + Math.sin(player.rot) * 0.3);
  tracer(muzzle, _h.clone()); puff(muzzle.x, muzzle.y, muzzle.z, 0xffd070, 0.6, 0.07, 0, true, 0.5); flashLight.position.copy(muzzle); flashLight.intensity = 30;
  if (hit.ped) { hurtPed(hit.ped, WP.dmg * (hit.head ? 2.5 : 1), player.x, player.z, true); if (hit.ped.kind === 'gang') hit.ped.alert = true; hitMark(); if (hit.ped.kind !== 'gang') addCrime(0.5); }
  else if (hit.car) { damageCar(hit.car, WP.dmg * 0.28); for (let i = 0; i < 3; i++) spark(_h.x, _h.y, _h.z, 0xffd080); hitMark(); if (hit.car.driver === 'ai' && hit.car.ai) hit.car.ai.panic = 8; if (hit.car.k === 'police') addCrime(1); }
  else if (hit.t < 220) { puff(_h.x, _h.y, _h.z, 0xcfc8b8, 0.4, 0.35, 0.6, false, 0.8); }
  alarm(player.x, player.z, 55); if (peds.some(p => !p.dead && p.kind !== 'gang' && dist2(p.x, p.z, player.x, player.z) < 60)) addCrime(0.35);
  for (const p of peds) if (p.kind === 'gang' && dist2(p.x, p.z, player.x, player.z) < 70) p.alert = true;
  if (player.mag[w] <= 0 && player.ammo[w] > 0) startReload();
}
function startReload() { const w = player.weapon; if (w === 0 || player.reload > 0 || player.mag[w] >= WEAPONS[w].mag || player.ammo[w] <= 0) return; player.reload = 1.3; au('play', 'reload'); }
function hitMark() { const c = $('cross'); c.classList.add('hit'); setTimeout(() => c.classList.remove('hit'), 120); }
function shootRay(o, d, maxD) {
  const res = { t: W.rayCast(o.x, o.y, o.z, d.x, d.y, d.z, maxD), ped: null, car: null, head: false };
  if (d.y < -0.001) { const tg = (W.groundH(o.x + d.x * 10, o.z + d.z * 10) - o.y) / d.y; if (tg > 0 && tg < res.t) res.t = tg; }
  for (const p of peds) { if (p.dead) continue; const rx = p.x - o.x, rz = p.z - o.z, hl = Math.hypot(d.x, d.z) || 1e-6, t = (rx * d.x + rz * d.z) / (hl * hl); if (t < 0 || t > res.t) continue; const px = o.x + d.x * t - p.x, pz = o.z + d.z * t - p.z, yy = o.y + d.y * t - p.y; if (px * px + pz * pz < 0.2 && yy > 0 && yy < 1.95) { res.t = t; res.ped = p; res.car = null; res.head = yy > 1.55; } }
  for (const c of cars) { const rx = o.x - c.x, rz = o.z - c.z; if (Math.abs(rx) > maxD || Math.abs(rz) > maxD) continue; const fx2 = Math.sin(c.rot), fz2 = Math.cos(c.rot), lo = [-rx * fz2 + rz * fx2, o.y - c.y, rx * fx2 + rz * fz2], ld = [-d.x * fz2 + d.z * fx2, d.y, d.x * fx2 + d.z * fz2], mn = [-c.T.w / 2, 0.2, -c.T.L / 2], mxx = [c.T.w / 2, 1.5, c.T.L / 2]; let t0 = 0, t1 = res.t, ok = true; for (let k = 0; k < 3; k++) { if (Math.abs(ld[k]) < 1e-6) { if (lo[k] < mn[k] || lo[k] > mxx[k]) { ok = false; break; } } else { let a = (mn[k] - lo[k]) / ld[k], b = (mxx[k] - lo[k]) / ld[k]; if (a > b) { const q = a; a = b; b = q; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) { ok = false; break; } } } if (ok && t0 < res.t && c !== player.car) { res.t = t0; res.car = c; res.ped = null; } }
  return res;
}

// ---------- driving (player) ----------
function driveCar(c, dt, inp) {
  const T = c.T; let fxx = Math.sin(c.rot), fzz = Math.cos(c.rot); let vf = c.vx * fxx + c.vz * fzz, vl = -c.vx * fzz + c.vz * fxx;
  const dmgK = c.dead ? 0 : c.hp < 25 ? 0.55 : 1, water = c.inWater ? 0.15 : 1; let thr = inp.f;
  if (thr > 0) vf += T.acc * dmgK * water * (1 - clamp(vf / T.max, 0, 1) * 0.85) * dt * (vf < 0 ? 2.5 : 1);
  else if (thr < 0) { if (vf > 1) vf -= 30 * dt; else vf -= 9 * dmgK * water * dt * (vf > -13 ? 1 : 0); }
  vf -= vf * 0.12 * dt + Math.sign(vf) * Math.min(Math.abs(vf), 1.4 * dt) + (c.inWater ? vf * 2 * dt : 0);
  const hb = inp.jump; if (hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt);
  const grip = hb ? 1.6 : 7.5 - 3 * clamp(Math.abs(vf) / 55, 0, 1); vl *= Math.exp(-grip * dt);
  c.steer = lerp(c.steer, -inp.s, Math.min(1, dt * 7)); const yaw = c.steer * clamp(vf / 7, -1, 1) * (2.3 / (1 + Math.abs(vf) / 34)) * (hb ? 1.5 : 1);
  c.vx = fxx * vf - fzz * vl; c.vz = fzz * vf + fxx * vl; c.rot += yaw * dt; c.speed = vf; c.braking = thr < 0 && vf > 1 || hb;
  c.x += c.vx * dt; c.z += c.vz * dt;
  for (const o of [1.25, -1.25]) { fxx = Math.sin(c.rot); fzz = Math.cos(c.rot); const px = c.x + fxx * o, pz = c.z + fzz * o, r = W.collideCircle(px, pz, 1.05); if (r.hit) { c.x += r.x - px; c.z += r.z - pz; const imp = -(c.vx * r.nx + c.vz * r.nz); if (imp > 0) { c.vx += r.nx * imp * 1.25; c.vz += r.nz * imp * 1.25; if (imp > 4) { crashFx(c, imp); alarm(c.x, c.z, 22); } c.rot += (r.nx * fzz - r.nz * fxx) * o * 0.012 * imp; } } }
  c.x = clamp(c.x, -1100, 1300); c.z = clamp(c.z, -900, 900);
  const sk = clamp((Math.abs(vl) - 3) / 8, 0, 1) * (c.inWater ? 0 : 1); au('skid', sk); if (sk > 0.3 && Math.random() < 0.5) puff(c.x - fxx * 1.5, c.y + 0.2, c.z - fzz * 1.5, 0xdddddd, 0.8, 0.6, 0.5, false, 1.5);
  au('engine', !c.dead, clamp(Math.abs(vf) / T.max * 0.85 + (thr > 0 ? 0.15 : 0), 0, 1) * ((Math.abs(vf) % 14) / 14 * 0.35 + 0.65), Math.abs(thr));
  if (inp.horn) { if (!c.hornT || c.hornT <= 0) { au('play', 'horn'); c.hornT = 0.5; alarm(c.x + fxx * 8, c.z + fzz * 8, 10); } } if (c.hornT > 0) c.hornT -= dt;
}
function updateCars(dt) {
  const f = focusPos();
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i], d = dist2(c.x, c.z, f.x, f.z);
    if (c.driver === 'ai' && c.ai) { if (d > 420 && c !== mission?.car) { removeCar(c); continue; } aiDrive(c, dt); if (c.stuck > 22 && d > 70) { removeCar(c); continue; } }
    else if (c.driver === 'cop' && c.ai) copDrive(c, dt);
    else if (c.driver === 'bot' && c.ai) { const ai = c.ai; if (ai.rev > 0) { ai.rev -= dt; c.speed += clamp(-7 - c.speed, -20 * dt, 20 * dt); c.rot += dt * 0.8; moveKin(c, dt); } else { aiDrive(c, dt, 25); if (Math.abs(c.speed) < 2.5) { ai.st = (ai.st || 0) + dt; if (ai.st > 1.2) { ai.rev = 1.4; ai.st = 0; } } else ai.st = 0; } }
    else if (c.driver !== 'player') { // coasting / parked
      const sp = Math.hypot(c.vx, c.vz); if (sp > 0.05) { const k = Math.exp(-1.6 * dt); c.vx *= k; c.vz *= k; c.x += c.vx * dt; c.z += c.vz * dt; const r = W.collideCircle(c.x, c.z, 1.2); if (r.hit) { c.x = r.x; c.z = r.z; c.vx *= -0.3; c.vz *= -0.3; } } else { c.vx = c.vz = 0; }
      c.speed = 0; if (c.dead && d > 200) { removeCar(c); continue; }
    }
    if (c.dead) { c.fire -= dt; if (c.fire > 0 && Math.random() < 0.5) { puff(c.x + rnd(-1, 1), c.y + 1.2, c.z + rnd(-1, 1), 0xff8a20, 1.6, 0.5, 3, true, 1); puff(c.x, c.y + 2, c.z, 0x1a1a1a, 1.5, 2, 3, false, 3); } }
    else if (c.hp < 45 && Math.random() < 0.3) puff(c.x + Math.sin(c.rot) * 1.7, c.y + 1, c.z + Math.cos(c.rot) * 1.7, c.hp < 20 ? 0x222222 : 0xbbbbbb, 0.7, 1.2, 2.2, false, 2);
    if (!c.dead && c.hp < 12) { c.hp -= dt * 2; if (Math.random() < 0.4) puff(c.x + Math.sin(c.rot) * 1.7, c.y + 1, c.z + Math.cos(c.rot) * 1.7, 0xff8a20, 0.9, 0.4, 2, true, 1); if (c.hp <= 0) explodeCar(c); }
    if (c.inWater && !c.dead && c.driver === 'player') { c.hp -= dt * 30; if (c.hp <= 5) { c.dead = true; exitCar(true); } }
    c.tl.material = c.braking ? brakeMat : tailMat; c.beam.visible = nightF > 0.05 && !c.dead && (c.driver !== null || c === player.car);
    if (c.bar) { const on = c.driver === 'cop' && wanted.stars > 0, ph = Math.floor(simT * 6) % 2; c.bar[0].material = on && ph ? redMat : tailMat; c.bar[1].material = on && !ph ? blueMat : glassMat; }
    syncCar(c);
  }
  // car-car collisions
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j]; let dx = b.x - a.x, dz = b.z - a.z; if (Math.abs(dx) > 5.5 || Math.abs(dz) > 5.5) continue;
    for (const oa of [1.15, -1.15]) for (const ob of [1.15, -1.15]) {
      const ax = a.x + Math.sin(a.rot) * oa, az = a.z + Math.cos(a.rot) * oa, bx = b.x + Math.sin(b.rot) * ob, bz = b.z + Math.cos(b.rot) * ob; dx = bx - ax; dz = bz - az; const d = Math.hypot(dx, dz); if (d >= 2.05 || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, pen = (2.05 - d) / 2, ma = a.driver === null && a.parked ? 0.5 : 1; a.x -= nx * pen; a.z -= nz * pen; b.x += nx * pen; b.z += nz * pen;
      const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; if (rv > 0) {
        const jv = rv * 0.75; if (a.driver !== 'ai' && a.driver !== 'cop' && a.driver !== 'bot') { a.vx -= nx * jv; a.vz -= nz * jv; } else a.speed *= 0.5; if (b.driver !== 'ai' && b.driver !== 'cop' && b.driver !== 'bot') { b.vx += nx * jv; b.vz += nz * jv; } else b.speed *= 0.5;
        if (rv > 4) { crashFx(a, rv * 0.7); crashFx(b, rv * 0.7); const pl = a === player.car ? b : b === player.car ? a : null; if (pl) { if (pl.k === 'police') addCrime(1.2); else if (pl.driver === 'ai') { addCrime(0.25); if (pl.ai) pl.ai.panic = 5; } alarm(a.x, a.z, 20); } }
      }
    }
  }
}

// ---------- wanted / police ----------
const wanted = { stars: 0, heat: 0, hidden: 0, seen: false, spawnT: 0 };
const TH = [0, 1, 3, 6, 10, 15];
function addCrime(h) { if (player.dead) return; const s0 = wanted.stars; wanted.heat = Math.min(16, wanted.heat + h); let s = 0; for (let k = 1; k <= 5; k++) if (wanted.heat >= TH[k]) s = k; if (s > s0) { wanted.stars = s; au('play', 'star'); } wanted.hidden = 0; }
function setWanted(s) { wanted.heat = TH[s]; wanted.stars = s; wanted.hidden = 0; if (s) au('play', 'star'); }
function clearWanted() { wanted.stars = 0; wanted.heat = 0; wanted.hidden = 0; for (const c of cars) if (c.driver === 'cop') { c.driver = 'ai'; let n = nearestNode(c.x, c.z); initAI(c, n, pickR(n.links)); } }
function nearestNode(x, z) { let b = null, bd = 1e9; for (const n of W.nodes) { const d = dist2(n.x, n.z, x, z); if (d < bd) { bd = d; b = n; } } return b; }
function spawnCop(f) {
  const ns = W.nodes.filter(n => { const d = dist2(n.x, n.z, f.x, f.z); return d > 110 && d < 260; }); if (!ns.length) return; const n = pickR(ns);
  if (cars.some(c => dist2(c.x, c.z, n.x, n.z) < 10)) return; const c = makeCar('police', n.x, n.z, Math.atan2(f.x - n.x, f.z - n.z)); c.driver = 'cop'; c.parked = false; c.ai = { nav: null, rev: 0, deployed: false, losT: 0, los: false }; c.speed = 12; return c;
}
function copDrive(c, dt) {
  const ai = c.ai, f = focusPos(), d = dist2(c.x, c.z, f.x, f.z); ai.losT -= dt; if (ai.losT <= 0) { ai.losT = 0.4; ai.los = d < 70 && W.los(c.x, c.z, f.x, f.z); }
  let wx, wz, target = 31;
  if (ai.los || d < 14) { wx = f.x + (f.vx || 0) * 0.4; wz = f.z + (f.vz || 0) * 0.4; ai.nav = null; }
  else { if (!ai.nav || dist2(c.x, c.z, ai.nav.x, ai.nav.z) < 10) { const n = ai.nav || nearestNode(c.x, c.z); let best = null, bd = 1e9; for (const l of n.links) { const dd = dist2(l.to.x, l.to.z, f.x, f.z) + (l.to === ai.prev ? 80 : 0); if (dd < bd) { bd = dd; best = l.to; } } ai.prev = n; ai.nav = ai.nav ? best : n; } wx = ai.nav.x; wz = ai.nav.z; if (dist2(c.x, c.z, wx, wz) < 26) target = 15; }
  if (!player.car && d < 13) { target = 0; if (!ai.deployed && Math.abs(c.speed) < 3) { ai.deployed = true; const n = wanted.stars > 2 ? 2 : 1; for (let k = 0; k < n; k++) { const p = spawnPed(c.x + Math.cos(c.rot) * (k ? 2 : -2), c.z - Math.sin(c.rot) * (k ? 2 : -2), 'cop'); p.t = 0; } } }
  else if (d < 25) target = Math.max(12, Math.hypot(f.vx || 0, f.vz || 0) + 6);
  if (ai.rev > 0) { ai.rev -= dt; c.speed += clamp(-6 - c.speed, -20 * dt, 20 * dt); c.rot += dt * 0.9; }
  else { c.speed += clamp(target - c.speed, -22 * dt, 13 * dt); const diff = steerTo(c, wx, wz, dt, 2.7); if (Math.abs(diff) > 1.2 && c.speed > 12) c.speed -= 20 * dt; }
  c.hitWall = Math.max(0, (c.hitWall || 0) - dt); moveKin(c, dt);
  if (Math.abs(c.speed) < 1.5 && target > 0) { c.stuck += dt; if (c.stuck > 1.2) { ai.rev = 1.3; c.stuck = 0; ai.nav = null; } } else c.stuck = 0;
  if (wanted.stars >= 3 && d < 38 && ai.los && player.car && Math.random() < dt * 0.9) { au('play', 'pistol', { vol: 0.4 }); tracer(new THREE.Vector3(c.x, c.y + 1.2, c.z), new THREE.Vector3(f.x + rnd(-1, 1), f.y + 1, f.z + rnd(-1, 1)), 0xffd0a0); if (Math.random() < 0.5) damageCar(player.car, 3); }
}
function updateWanted(dt) {
  const f = focusPos(); let nearest = 1e9, seen = false, n = 0;
  for (const c of cars) if (c.driver === 'cop' && !c.dead) { n++; const d = dist2(c.x, c.z, f.x, f.z); if (d < nearest) nearest = d; if (d < 28 || (d < 85 && c.ai.los)) seen = true; if (d > 420) removeCar(c); }
  for (const p of peds) if (p.kind === 'cop' && !p.dead) { const d = dist2(p.x, p.z, f.x, f.z); if (d < 60) seen = true; if (d < nearest) nearest = d; }
  wanted.seen = seen; au('siren', wanted.stars > 0 && nearest < 200 ? clamp(1.1 - nearest / 200, 0.08, 0.8) : 0);
  if (wanted.stars > 0) {
    const want = [0, 2, 3, 5, 6, 8][wanted.stars]; wanted.spawnT -= dt; if (n < want && wanted.spawnT <= 0) { spawnCop(f); wanted.spawnT = 1.5; }
    if (!seen) { wanted.hidden += dt; if (wanted.hidden > 9 + wanted.stars * 4) { clearWanted(); toast('You lost the heat.'); } } else wanted.hidden = 0;
  } else bustT = 0;
  if (wanted.stars === 0 && wanted.heat > 0) wanted.heat = Math.max(0, wanted.heat - dt * 0.05);
}

// ---------- police helicopter (3+ stars) ----------
const heli = (() => {
  const g = new THREE.Group(), b = new Batch(), C = h => new THREE.Color(h);
  b.sph(0, 0, 0.2, 1.5, C(0x16264a), 0.8); b.sph(0, 0.1, 1.1, 1.05, C(0x9fd0ff), 0.8); b.box(0, 0.25, -3, 0.4, 0.4, 4.2, C(0x16264a)); b.box(0, 0.95, -4.9, 0.12, 1.3, 0.8, C(0xf2f2f2)); b.box(0, 1.1, 0, 0.3, 0.5, 0.3, C(0x333333));
  for (const s of [-1, 1]) { b.box(s * 0.95, -1.35, 0.2, 0.1, 0.1, 2.8, C(0x222222)); b.box(s * 0.8, -1, 0.2, 0.08, 0.7, 0.08, C(0x222222)); }
  const body = new THREE.Mesh(b.geometry(), pedMat), rotor = new THREE.Group(), rm = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 });
  rotor.add(new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.05, 0.35), rm), new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 9.5), rm)); rotor.position.y = 1.4;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 60, 20, 1, true).translate(0, -30, 0), new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: W.glowTex, color: 0xcfe6ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(spot); spot.visible = false;
  g.add(body, rotor, cone); g.visible = false; g.position.set(0, 300, 0); scene.add(g); return { g, rotor, cone, spot, on: false };
})();
const _hd = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
function updateHeli(dt) {
  const f = focusPos(), want = wanted.stars >= 3 && !player.dead;
  if (want && !heli.on) { heli.on = true; heli.g.visible = true; heli.g.position.set(f.x + 160, 90, f.z - 120); }
  if (!heli.on) { au('heli', 0); return; }
  const tx = want ? f.x + Math.sin(simT * 0.35) * 26 : heli.g.position.x + 40, tz = want ? f.z + Math.cos(simT * 0.35) * 26 : heli.g.position.z - 40, ty = want ? Math.max(f.y, 0) + 36 : 140, k = Math.min(1, dt * 0.9);
  const p = heli.g.position, ox = p.x, oz = p.z; p.x = lerp(p.x, tx, k); p.z = lerp(p.z, tz, k); p.y = lerp(p.y, ty, k);
  if (Math.hypot(p.x - ox, p.z - oz) > 0.01) heli.g.rotation.y = Math.atan2(p.x - ox, p.z - oz); heli.rotor.rotation.y += dt * 28;
  _hd.set(f.x - p.x, f.y - p.y, f.z - p.z).normalize(); heli.cone.quaternion.setFromUnitVectors(_down, _hd); heli.cone.quaternion.premultiply(heli.g.quaternion.clone().invert());
  heli.cone.visible = heli.spot.visible = want; heli.cone.material.opacity = 0.02 + nightF * 0.08; heli.spot.material.opacity = 0.12 + nightF * 0.5; heli.spot.position.set(f.x, W.groundH(f.x, f.z) + 0.12, f.z);
  const d = Math.hypot(p.x - f.x, p.z - f.z, p.y - f.y); au('heli', clamp(1.1 - d / 160, 0, 0.8));
  if (!want && d > 260) { heli.on = false; heli.g.visible = false; }
}

// ---------- pickups / markers ----------
const pickups = [], markers = [];
const cashMat = new THREE.MeshBasicMaterial({ color: 0x4aff7a }), caseMat = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.8, roughness: 0.3, emissive: 0x6a5000 });
const flamMat = new THREE.MeshBasicMaterial({ color: 0xff5ab0 }), healthMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b }), armorMat = new THREE.MeshBasicMaterial({ color: 0x3a9bff });
const FLAMINGOS = [[480, 149], [525, -411], [975, -420], [70, -56], [345, 37], [-490, 470], [-610, -300], [330, -470], [-130, -130], [700, -404]];
let flamSpawned = false;
function spawnFlamingos() { // hidden collectibles
  if (flamSpawned) return; flamSpawned = true;
  for (const [x, z] of [[P.gunshop.x + 5, P.gunshop.z], [P.garage.x + 9, P.garage.z], [P.safehouse.x - 6, P.safehouse.z + 2]]) { const pk = makePickup(x, z, 'armor'); pk.m.material = armorMat; pk.onTake = () => { player.armor = Math.min(100, player.armor + 50); toast('Body armor +50'); }; pickups.push(pk); }
  for (const [x, z] of [[P.hospital.x + 6, P.hospital.z], [440, 146], [P.skip.x + 8, P.skip.z], [860, -406], [P.park.x - 22, P.park.z], [P.police.x + 8, P.police.z]]) { const pk = makePickup(x, z, 'health'); pk.onTake = () => { player.hp = Math.min(100, player.hp + 50); toast('First-aid kit  ·  health +50'); }; pickups.push(pk); }
  FLAMINGOS.forEach((p, i) => { if (player.flam.includes(i)) return; const pk = makePickup(p[0], p[1], 'flamingo'); pk.onTake = () => { player.flam.push(i); addMoney(250); toast(`Neon flamingo found  ${player.flam.length} / ${FLAMINGOS.length}   +$250`); if (player.flam.length === FLAMINGOS.length) { addMoney(5000); banner('FLOCK COMPLETE', 'All neon flamingos found   +$5,000'); au('play', 'missionPass'); } save(); }; pickups.push(pk); });
}
function makePickup(x, z, type, val) { const m = new THREE.Mesh(type === 'cash' ? new THREE.BoxGeometry(0.5, 0.12, 0.28) : type === 'flamingo' ? new THREE.OctahedronGeometry(0.5) : new THREE.BoxGeometry(0.8, 0.55, 0.22), type === 'cash' ? cashMat : type === 'flamingo' ? flamMat : type === 'health' ? healthMat : caseMat); m.position.set(x, W.groundH(x, z) + 0.6, z); scene.add(m); return { m, x, z, type, val, t: 0 }; }
function updatePickups(dt) { for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.t += dt; p.m.rotation.y += dt * 3; p.m.position.y = W.groundH(p.x, p.z) + 0.6 + Math.sin(p.t * 3) * 0.12; if (dist2(p.x, p.z, player.x, player.z) < (player.car ? 3 : 1.4)) { if (p.type === 'cash') { addMoney(p.val); } else if (p.onTake) p.onTake(); au('play', p.type === 'cash' ? 'cash' : 'pickup'); scene.remove(p.m); pickups.splice(i, 1); } else if (p.t > 60 && p.type === 'cash') { scene.remove(p.m); pickups.splice(i, 1); } } }
function makeMarker(x, z, color, r = 2.2) {
  const g = new THREE.Group(), m1 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.1, 28, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m1.position.y = 0.55;
  const m2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m2.position.y = 30;
  const m3 = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })); m3.position.y = 0.08;
  g.add(m1, m2, m3); g.position.set(x, W.groundH(x, z), z); scene.add(g); const mk = { g, x, z, r, color }; markers.push(mk); return mk;
}
function removeMarker(m) { if (!m) return; scene.remove(m.g); const i = markers.indexOf(m); if (i >= 0) markers.splice(i, 1); }
const inMarker = (m, extra = 0) => m && dist2(m.x, m.z, player.x, player.z) < m.r + extra + (player.car ? 1.5 : 0);

// ---------- missions ----------
let mission = null, objMarker = null, objBlip = null, missionTimer = -1;
const subQ = []; let subT = 0;
function say(who, text, t = 4) { subQ.push({ html: who ? `<b>${who}:</b> ${text}` : text, t }); }
function toast(t) { subQ.length = 0; subT = 0; say('', t, 3.5); }
function setObj(html, x, z, color = 0xff5a8a, r = 3) { $('obj').innerHTML = html; $('obj').classList.remove('hide'); removeMarker(objMarker); objMarker = null; objBlip = null; if (x !== undefined) { objMarker = makeMarker(x, z, color, r); objBlip = { x, z }; } }
function banner(h, p, cls = '') { $('bh').textContent = h; $('bh').className = cls; $('bp').textContent = p || ''; $('banner').style.opacity = 1; clearTimeout(banner.t); banner.t = setTimeout(() => $('banner').style.opacity = 0, 4200); }
function addMoney(n) { player.money = Math.max(0, player.money + n); }
const MISSIONS = [
  { id: 'm1', name: 'Hot Property', giver: 'Skip', letter: 'S', place: 'skip', reward: 1500,
    start(m) { say('SKIP', "Dante! A client wants a cherry-red Marlin GT. There's one sunning itself at the Coral Crown Hotel."); say('SKIP', 'Bring it to my shop in one piece and we both eat tonight.'); m.car = makeCar('sports', P.hotelCar.x, P.hotelCar.z, P.hotelCar.rot, 0xc8102e); m.step = 0; setObj('Steal the <em>Marlin GT</em> at the Coral Crown Hotel', P.hotelCar.x, P.hotelCar.z); },
    onEnter(c) { if (c === mission.car && mission.step === 0) { mission.step = 1; setWanted(Math.max(wanted.stars, 2)); say('DANTE', 'Valet saw me. Great. Company is coming.'); setObj('<em>Lose the cops</em>'); } },
    onCarDead(c) { if (c === mission.car) failMission('The Marlin GT was destroyed.'); },
    update(m) { if (m.step === 1 && wanted.stars === 0) { m.step = 2; setObj("Deliver the car to <em>Skip's Marine</em>", P.skip.x, P.skip.z, 0xffd84a, 4); } else if (m.step === 2) { if (wanted.stars > 0) { m.step = 1; setObj('<em>Lose the cops</em>'); } else if (player.car === m.car && inMarker(objMarker) && Math.abs(m.car.speed) < 4) { exitCar(true); m.car.parked = true; passMission(m.car.hp > 70 ? 500 : 0); } } if (objBlip && m.step === 0) { objBlip.x = m.car.x; objBlip.z = m.car.z; } } },
  { id: 'm2', name: 'Rush Hour', giver: 'Tía Carmela', letter: 'C', place: 'diner', reward: 1200,
    start(m) { say('CARMELA', 'Mijo, my delivery boy quit and I have four hot orders going cold!'); say('CARMELA', 'Grab any wheels and get them out there. Rápido!'); m.pts = [P.park, { x: -350, z: -143 }, P.pier, { x: -212, z: 285 }].map(p => ({ x: p.x, z: p.z })); m.pts[0] = { x: 70, z: -143 }; m.pts[2] = { x: 283, z: 140 }; m.i = 0; missionTimer = 75; this.next(m); },
    next(m) { const p = m.pts[m.i]; setObj(`Deliver order <em>${m.i + 1} / ${m.pts.length}</em> before it goes cold`, p.x, p.z, 0xffd84a, 4.5); },
    update(m, dt) { if (inMarker(objMarker, 1)) { m.i++; au('play', 'pickup'); addMoney(100); if (m.i >= m.pts.length) { passMission(Math.floor(missionTimer) * 10); return; } missionTimer += 38; this.next(m); } if (missionTimer <= 0) failMission('The food went cold.'); } },
  { id: 'm3', name: 'Pest Control', giver: 'Nova', letter: 'N', place: 'park', reward: 3000,
    start(m) { say('NOVA', 'The Gator Boys are sitting on a container yard in Port Palmera that belongs to my employer.'); say('NOVA', "Evict them. Here's ammo and a vest. Finish the job and the rifle is yours."); player.ammo[1] += 60; player.armor = Math.max(player.armor, 60); if (player.weapon === 0) player.weapon = 1; m.en = []; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, p = spawnPed(P.gang.x + Math.cos(a) * rnd(4, 14), P.gang.z + Math.sin(a) * rnd(4, 14), 'gang'); let r = W.collideCircle(p.x, p.z, 1); p.x = r.x; p.z = r.z; m.en.push(p); } setObj('Clear out the <em>Gator Boys</em> in Port Palmera', P.gang.x, P.gang.z, 0xff5a5a, 5); },
    update(m) { const left = m.en.filter(p => !p.dead).length; if (dist2(player.x, player.z, P.gang.x, P.gang.z) < 60 && objMarker) { removeMarker(objMarker); objMarker = null; } if (left === 0) { if (!player.owned[2]) { player.owned[2] = true; player.ammo[2] += 90; toast('Rifle acquired'); } else player.ammo[2] += 60; passMission(0); } else $('obj').innerHTML = `Take out the <em>Gator Boys</em> — ${left} left`; },
    blips(m) { return m.en.filter(p => !p.dead); } },
  { id: 'm4', name: 'Island Time', giver: 'Skip', letter: 'S', place: 'pier', reward: 5000, need: 3,
    start(m) { say('SKIP', "Big one. A crooked developer on Isla Corona keeps his ledger in a gold case at Casa Corona."); say('SKIP', 'Cross the Sunspan, grab it, and get back to your place. Expect noise.'); m.step = 0; setObj('Go to <em>Casa Corona</em> on Isla Corona', P.mansion.x, P.mansion.z, 0xff5a8a, 3); const pk = makePickup(P.mansion.x, P.mansion.z, 'case'); pk.onTake = () => { m.step = 1; setWanted(3); say('DANTE', 'Got it. And there go the alarms.'); setObj('Take the ledger to your <em>safehouse</em> and lose the cops', P.safehouse.x, P.safehouse.z, 0x6fe0ff, 3.5); }; pickups.push(pk); m.pk = pk; },
    update(m) { if (m.step === 1 && inMarker(objMarker)) { if (wanted.stars > 0) $('obj').innerHTML = '<em>Lose the cops</em> before going home'; else passMission(0); } },
    cleanup(m) { const i = pickups.indexOf(m.pk); if (i >= 0) { scene.remove(m.pk.m); pickups.splice(i, 1); } } },
];
const giverMarkers = {};
function refreshGivers() { for (const M of MISSIONS) { const avail = !mission && !player.done.includes(M.id) && (!M.need || player.done.length >= M.need); if (avail && !giverMarkers[M.id]) giverMarkers[M.id] = makeMarker(P[M.place].x, P[M.place].z, 0xffd84a, 2); else if (!avail && giverMarkers[M.id]) { removeMarker(giverMarkers[M.id]); delete giverMarkers[M.id]; } } }
function startMission(M) { mission = Object.assign({ def: M }, M); mission.onEnter = M.onEnter; refreshGivers(); banner(M.name, 'A job for ' + M.giver, ''); au('play', 'uiSelect'); M.start(mission); }
function endMission() { if (mission && mission.def.cleanup) mission.def.cleanup(mission); if (mission && mission.en) for (const p of mission.en) if (!p.dead) removePed(p); mission = null; missionTimer = -1; removeMarker(objMarker); objMarker = null; objBlip = null; $('obj').classList.add('hide'); $('timer').classList.add('hide'); refreshGivers(); }
function passMission(bonus) { const M = mission.def; player.done.push(M.id); addMoney(M.reward + bonus); banner('JOB DONE', `${M.name}   +$${(M.reward + bonus).toLocaleString()}` + (bonus ? '  (bonus included)' : '')); au('play', 'missionPass'); endMission(); save(); if (player.done.length === 3) say('SKIP', 'Meet me at Lucky Gull Pier. I have something big.', 5); if (player.done.length === 4) say('', 'Palmera Bay is yours. Keep causing trouble.', 6); }
function failMission(why) { if (!mission) return; if (!player.dead) { banner('JOB FAILED', why, 'bad'); au('play', 'missionFail'); } endMission(); }
function updateMissions(dt) {
  if (mission) { if (missionTimer >= 0) { missionTimer -= dt; $('timer').classList.remove('hide'); $('timer').textContent = Math.floor(Math.max(0, missionTimer) / 60) + ':' + String(Math.floor(Math.max(0, missionTimer) % 60)).padStart(2, '0'); } mission.def.update.call(mission.def, mission, dt); }
  else for (const M of MISSIONS) { const mk = giverMarkers[M.id]; if (mk && inMarker(mk) && wanted.stars === 0 && !player.dead) { startMission(M); break; } }
  if (subT > 0) { subT -= dt; if (subT <= 0) $('sub').innerHTML = ''; } if (subT <= 0 && subQ.length) { const s = subQ.shift(); $('sub').innerHTML = s.html; subT = s.t; }
}
// shops & services
const svc = {};
function setupServices() { svc.gun = makeMarker(P.gunshop.x, P.gunshop.z, 0xff7043, 1.6); svc.garage = makeMarker(P.garage.x, P.garage.z, 0xb388ff, 3.4); svc.safe = makeMarker(P.safehouse.x, P.safehouse.z, 0x6fe0ff, 1.6); }
let svcCool = 0, promptHtml = '';
function updateServices(dt) {
  svcCool -= dt; promptHtml = '';
  if (!player.car && inMarker(svc.gun)) { promptHtml = 'Press <kbd>E</kbd> to browse <b>Gator Guns</b>'; if (keys.KeyE) openShop(); }
  if (!player.car && inMarker(svc.safe) && !mission) { promptHtml = 'Press <kbd>E</kbd> to rest and save at your <b>safehouse</b>'; if (keys.KeyE && svcCool < 0) { svcCool = 3; player.hp = 100; tod = (tod + 8) % 24; save(); toast('Game saved. You feel rested.'); au('play', 'pickup'); } }
  if (player.car && inMarker(svc.garage) && svcCool < 0) { if (wanted.stars > 2) promptHtml = 'Mojo Motors: too much heat. Come back with fewer stars.'; else if (player.money < 300) promptHtml = 'Mojo Motors: repair &amp; respray costs <b>$300</b>'; else { promptHtml = 'Press <kbd>E</kbd> for repair &amp; respray — <b>$300</b>'; if (keys.KeyE) { svcCool = 4; addMoney(-300); const c = player.car; c.hp = 100; c.body.scale.set(1, 1, 1); c.body.rotation.z = 0; if (!c.T.color) { c.color = pickR(CAR_COLORS); c.body.material = paint(c.color); } clearWanted(); au('play', 'cash'); toast('Fresh paint. The cops are looking for a different car.'); } } }
  if (!player.car && !promptHtml) { let best = null, bd = 4.6; for (const c of cars) { const d = dist2(c.x, c.z, player.x, player.z); if (d < bd && !c.dead) { bd = d; best = c; } } if (best) promptHtml = `Press <kbd>F</kbd> to ${best.driver ? 'jack' : 'enter'} the <b>${best.T.name}</b>`; nearCar = best; } else nearCar = null;
  if (!AUTO && !promptHtml && document.pointerLockElement !== canvas) promptHtml = 'Click the game to capture the mouse';
}
let nearCar = null;
function openShop() {
  state = 'shop'; document.exitPointerLock && document.exitPointerLock(); $('shop').classList.remove('hide');
  const buy = (cost, fn) => () => { if (player.money >= cost) { addMoney(-cost); fn(); au('play', 'cash'); openShop(); } else au('play', 'empty'); };
  buildMenu('smenu', [
    ['Pistol ammo ×24', '$120', buy(120, () => player.ammo[1] += 24)],
    player.owned[2] ? ['Rifle ammo ×60', '$350', buy(350, () => player.ammo[2] += 60)] : ['Tidewater Rifle', '$1,800', buy(1800, () => { player.owned[2] = true; player.ammo[2] += 60; player.mag[2] = 30; })],
    ['Body armor', '$400', buy(400, () => player.armor = 100)],
    ['Leave', 'Cash: $' + player.money.toLocaleString(), () => { $('shop').classList.add('hide'); state = 'play'; keys.KeyE = false; lockPointer(); }]]);
}

// ---------- input ----------
const bot = { t: 0, car: null, shot: 0 };
function input() {
  if (AUTO) return botInput();
  return { f: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), sprint: keys.ShiftLeft || keys.ShiftRight, jump: keys.Space, fire: mouse.l, firePressed: mouse.lp, aim: mouse.r, horn: keys.KeyH };
}
function botInput() {
  const i = { f: 0, s: 0, sprint: true, jump: false, fire: false, firePressed: false, aim: false, horn: false };
  if (player.car) { if (SCENE === 'pdrive') { i.f = 1; i.s = Math.sin(bot.t * 0.9) * 0.3; i.jump = bot.t > 4 && bot.t < 4.6; i.fire = true; i.firePressed = Math.floor(bot.t * 3) !== Math.floor((bot.t - 0.04) * 3); if (bot.t > 9) exitCar(true); } return i; }
  if (SCENE === 'pdrive') return i;
  if (SCENE === 'shoot') { i.aim = true; i.fire = true; i.firePressed = Math.floor(bot.t * 4) !== Math.floor((bot.t - 0.02) * 4); return i; }
  if (SCENE === 'walk' || SCENE === 'beach' || SCENE === 'downtown') { i.f = 1; i.sprint = false; camYaw += Math.sin(bot.t * 0.4) * 0.003; return i; }
  let best = null, bd = 1e9; for (const c of cars) { if (c.dead || c.k === 'police') continue; const d = dist2(c.x, c.z, player.x, player.z); if (d < bd) { bd = d; best = c; } }
  if (best) { const want = Math.atan2(best.x - player.x, best.z - player.z); camYaw += wrapPi(want - camYaw) * 0.08; i.f = 1; if (bd < 4.2 && bot.t > 1.5) { enterCar(best); botTakeCar(best); } }
  if (SCENE === '' && bot.t > 0.6 && bot.t < 1.4) { i.fire = true; i.firePressed = Math.random() < 0.2; }
  return i;
}
function botTakeCar(c) { // join the nearest road in the direction the car is facing
  let best = W.edges[0], bd = 1e9; for (const e of W.edges) { const ex = e.b.x - e.a.x, ez = e.b.z - e.a.z, t = clamp(((c.x - e.a.x) * ex + (c.z - e.a.z) * ez) / (e.len * e.len), 0, 1), d = dist2(c.x, c.z, e.a.x + ex * t, e.a.z + ez * t); if (d < bd) { bd = d; best = e; } }
  const la = best.a.links.find(k => k.e === best), lb = best.b.links.find(k => k.e === best), fa = la.dx * Math.sin(c.rot) + la.dz * Math.cos(c.rot);
  c.driver = 'bot'; if (fa >= 0) initAI(c, best.a, la, 0); else initAI(c, best.b, lb, 0); }
addEventListener('keydown', e => {
  if (e.repeat) { return; } keys[e.code] = true; au('init');
  if (state === 'play') {
    if (e.code === 'KeyF') { if (player.car) exitCar(); else if (nearCar) enterCar(nearCar); }
    if (e.code === 'Digit1') switchWeapon(0); if (e.code === 'Digit2') switchWeapon(1); if (e.code === 'Digit3') switchWeapon(2);
    if (e.code === 'KeyR') startReload();
    if (e.code === 'KeyQ' && player.car) { radioIdx = rad('next'); if (radioIdx === undefined) radioIdx = -1; showRadio(); }
    if (e.code === 'KeyM') openMap(); if (e.code === 'Escape' || e.code === 'KeyP') openPause();
    if (e.code === 'Tab') e.preventDefault();
  } else if (state === 'map') { if (e.code === 'KeyM' || e.code === 'Escape') closeMap(); }
  else menuKey(e);
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousedown', e => { au('init'); if (state !== 'play') return; if (document.pointerLockElement !== canvas) { lockPointer(); return; } if (e.button === 0) { mouse.l = true; mouse.lp = true; } if (e.button === 2) mouse.r = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (state !== 'play' || document.pointerLockElement !== canvas) return; const s = 0.0023 * opts.sens * (mouse.r ? 0.6 : 1); camYaw -= e.movementX * s; camPitch = clamp(camPitch + e.movementY * s, -0.9, 1.25); lastMouse = 0; });
addEventListener('wheel', e => { if (state !== 'play' || player.car) return; let w = player.weapon; for (let k = 0; k < 3; k++) { w = (w + (e.deltaY > 0 ? 1 : 2)) % 3; if (player.owned[w]) break; } switchWeapon(w); });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && state === 'play' && !AUTO && Date.now() - lockT > 400) openPause(); });
let lockT = 0; function lockPointer() { lockT = Date.now(); try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
let radioIdx = 0;
function showRadio() { const G = window.GameAudio, st = G && G.radio && G.radio.stations && G.radio.stations[radioIdx]; $('rname').textContent = st ? st.name : 'Radio Off'; $('rgenre').textContent = st ? st.genre : ''; $('radio').style.opacity = 1; clearTimeout(showRadio.t); showRadio.t = setTimeout(() => $('radio').style.opacity = 0, 2600); }
function showZone(a, b) { $('zname').textContent = a; $('zsub').textContent = b || ''; $('zone').style.opacity = 1; clearTimeout(showZone.t); showZone.t = setTimeout(() => $('zone').style.opacity = 0, 3200); }

// ---------- camera ----------
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(); let dmgFlash = 0, fovCur = opts.fov, titleAng = 0;
function updateCamera(dt) {
  if (state === 'title' || state === 'options' && prevState === 'title' || state === 'quit') { titleAng += dt * 0.035; const r = 330; cam.position.set(120 + Math.cos(titleAng) * r, 70 + Math.sin(titleAng * 0.7) * 18, -40 + Math.sin(titleAng) * r); cam.lookAt(-140, 60, -60); cam.fov = 55; cam.updateProjectionMatrix(); return; }
  const c = player.car; lastMouse += dt; let tgtDist, fov = opts.fov;
  if (c) {
    const sp = Math.hypot(c.vx, c.vz); if (lastMouse > 1.6 || AUTO || keys.KeyC) { const back = SCENE === 'chase' ? c.rot + 2.55 : keys.KeyC ? c.rot + Math.PI : c.speed < -2 ? c.rot + Math.PI : c.rot; if (keys.KeyC) camYaw += wrapPi(back - camYaw) * Math.min(1, dt * 10); camYaw += wrapPi(back - camYaw) * Math.min(1, dt * (2.2 + sp * 0.06)); camPitch = lerp(camPitch, 0.2, Math.min(1, dt * 2)); }
    camTgt.set(c.x, c.y + 1.5, c.z); tgtDist = 7.6 + sp * 0.045; fov += clamp(sp * 0.28, 0, 14);
  } else { const aim = player.aiming && mouse.r || SCENE === 'shoot'; camTgt.set(player.x, player.y + 1.62, player.z); tgtDist = aim ? 2.3 : 4.4; if (aim) { fov *= 0.72; camTgt.x += -Math.cos(camYaw) * 0.55; camTgt.z += Math.sin(camYaw) * 0.55; } if (AUTO && SCENE !== 'shoot') camPitch = 0.16; }
  camDist = lerp(camDist, tgtDist, Math.min(1, dt * 6)); fovCur = lerp(fovCur, fov, Math.min(1, dt * 6)); if (Math.abs(cam.fov - fovCur) > 0.05) { cam.fov = fovCur; cam.updateProjectionMatrix(); }
  const cp = Math.cos(camPitch), dx = -Math.sin(camYaw) * cp, dy = Math.sin(camPitch), dz = -Math.cos(camYaw) * cp;
  let d = W.rayCast(camTgt.x, camTgt.y, camTgt.z, dx, dy, dz, camDist + 0.4, true) - 0.4; d = clamp(d, 0.6, camDist);
  camPos.set(camTgt.x + dx * d, camTgt.y + dy * d, camTgt.z + dz * d); const gh = W.groundH(camPos.x, camPos.z) + 0.35; if (camPos.y < gh) camPos.y = gh; if (camPos.y < -0.5) camPos.y = -0.5;
  if (shake > 0.01) { camPos.x += rnd(-1, 1) * shake * 0.25; camPos.y += rnd(-1, 1) * shake * 0.25; shake *= Math.pow(0.02, dt); }
  cam.position.copy(camPos); cam.lookAt(camTgt.x - dx * 0.001, camTgt.y - dy * 2 * 0 + (c ? 0.3 : 0.15), camTgt.z);
  if (!c) { cam.lookAt(camTgt.x - dx * 20, camTgt.y - dy * 20 + 0.0, camTgt.z - dz * 20); }
}

// ---------- HUD ----------
const mini = $('mini').getContext('2d'); let hudT = 0, lastZone = '';
const BL = { safe: '#6fe0ff', gun: '#ff7043', garage: '#b388ff', hospital: '#66e08a', police: '#4a8dff' };
function staticBlips() { const a = [{ x: P.safehouse.x, z: P.safehouse.z, c: BL.safe, t: '⌂' }, { x: P.gunshop.x, z: P.gunshop.z, c: BL.gun, t: 'G' }, { x: P.garage.x, z: P.garage.z, c: BL.garage, t: 'M' }, { x: P.hospital.x, z: P.hospital.z, c: BL.hospital, t: '+' }, { x: P.police.x, z: P.police.z, c: BL.police, t: 'P' }];
  for (const M of MISSIONS) if (giverMarkers[M.id]) a.push({ x: P[M.place].x, z: P[M.place].z, c: '#ffd84a', t: M.letter, big: true }); if (objBlip) a.push({ x: objBlip.x, z: objBlip.z, c: '#ff5a8a', t: '', big: true, obj: true });
  if (mission && mission.def.blips) for (const p of mission.def.blips(mission)) a.push({ x: p.x, z: p.z, c: '#ff3a3a', t: '', small: true }); return a; }
// GPS: shortest road route (by intersections) from the player to the current objective
const gps = { t: -9, path: null, key: '' };
function gpsTarget() { if (objBlip) return objBlip; if (!mission) for (const M of MISSIONS) if (giverMarkers[M.id]) return P[M.place]; return null; }
function gpsRoute() {
  const tg = gpsTarget(); if (!tg) { gps.path = null; return null; }
  if (simT - gps.t < 0.5 && gps.path) return gps.path; gps.t = simT;
  const f = focusPos(); if (dist2(f.x, f.z, tg.x, tg.z) < 90) return gps.path = [[f.x, f.z], [tg.x, tg.z]];
  const s = nearestNode(f.x, f.z), e = nearestNode(tg.x, tg.z), prev = new Map([[s, null]]), q = [s];
  while (q.length) { const n = q.shift(); if (n === e) break; for (const l of n.links) if (!prev.has(l.to)) { prev.set(l.to, n); q.push(l.to); } }
  const pts = [[tg.x, tg.z]]; let n = e, guard = 0; while (n && guard++ < 80) { pts.push([n.x, n.z]); n = prev.get(n); }
  if (pts.length > 2) { const a = pts[pts.length - 1], b = pts[pts.length - 2]; if ((f.x - a[0]) * (b[0] - a[0]) + (f.z - a[1]) * (b[1] - a[1]) > 0) pts.pop(); }
  if (pts.length > 2) { const a = pts[1], b = pts[2], o = pts[0]; if ((o[0] - a[0]) * (b[0] - a[0]) + (o[1] - a[1]) * (b[1] - a[1]) > 0) pts.splice(1, 1); }
  pts.push([f.x, f.z]); gps.path = pts.reverse(); return gps.path;
}
function drawBlip(g, x, y, b, s = 1) { g.fillStyle = b.c; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); if (b.obj) { g.rect(x - 6 * s, y - 6 * s, 12 * s, 12 * s); } else g.arc(x, y, (b.small ? 4 : b.big ? 9 : 7.5) * s, 0, 6.3); g.fill(); g.stroke(); if (b.t) { g.fillStyle = '#10151c'; g.font = `900 ${11 * s}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.t, x, y + 0.5); } }
function drawMini() {
  const g = mini, w = 232, h = 164, f = focusPos(), mb = W.bounds, SC = W.mapScale, zoom = player.car ? 0.62 : 0.85, cx = w / 2, cy = h * 0.62;
  g.fillStyle = '#17405f'; g.fillRect(0, 0, w, h); g.save(); g.translate(cx, cy); g.rotate(Math.PI + camYaw); g.scale(zoom / SC, zoom / SC); g.drawImage(W.mapCanvas, -(f.x - mb.x0) * SC, -(f.z - mb.z0) * SC); g.restore();
  const tr = (x, z) => { const dx = (x - f.x) * zoom, dz = (z - f.z) * zoom, a = Math.PI + camYaw, c = Math.cos(a), s = Math.sin(a); return [cx + dx * c - dz * s, cy + dx * s + dz * c]; };
  for (const b of staticBlips()) { let [x, y] = tr(b.x, b.z); const out = x < 10 || x > w - 10 || y < 10 || y > h - 10; if (out && !b.big) continue; x = clamp(x, 11, w - 11); y = clamp(y, 11, h - 11); drawBlip(g, x, y, b, out ? 0.8 : 1); }
  const route = gpsRoute(); if (route) { g.strokeStyle = objBlip ? 'rgba(255,90,170,.9)' : 'rgba(255,216,74,.9)'; g.lineWidth = 4.5; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); route.forEach((p, i) => { const [x, y] = tr(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
  for (const c of cars) if (c.driver === 'cop' && !c.dead) { const [x, y] = tr(c.x, c.z); if (x < 0 || x > w || y < 0 || y > h) continue; g.fillStyle = Math.floor(simT * 5) % 2 ? '#ff3030' : '#3a7dff'; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); }
  g.save(); g.translate(cx, cy); g.rotate(camYaw - (player.car ? player.car.rot : player.rot)); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
  const na = Math.PI + camYaw, nx = cx + Math.sin(na) * 0 - Math.cos(na) * 0; g.fillStyle = '#fff'; g.font = '900 13px Arial'; g.textAlign = 'center'; const nxx = clamp(cx + (0 * Math.cos(na) - (-400) * Math.sin(na)), 12, w - 12), nyy = clamp(cy + (0 * Math.sin(na) + (-400) * Math.cos(na)), 12, h - 12); g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(nxx, nyy, 9, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.fillText('N', nxx, nyy + 1);
}
function updateHUD(dt) {
  hudT -= dt; drawMini(); if (hudT > 0) return; hudT = 0.1;
  $('hp').style.width = player.hp + '%'; $('ar').style.width = player.armor + '%'; $('money').textContent = '$' + Math.floor(player.money).toLocaleString();
  let s = ''; for (let k = 1; k <= 5; k++) s += `<b class="${k <= wanted.stars ? 'on' : ''}">★</b>`; if ($('stars').dataset.s !== s) { $('stars').innerHTML = s; $('stars').dataset.s = s; } $('stars').classList.toggle('blink', wanted.stars > 0 && !wanted.seen);
  const hh = Math.floor(tod), mm = Math.floor((tod % 1) * 60); $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  const w = player.weapon; $('wname').textContent = WEAPONS[w].name; $('ammo').textContent = w ? (player.reload > 0 ? 'RELOADING' : player.mag[w] + ' / ' + player.ammo[w]) : '';
  $('cross').classList.toggle('hide', player.weapon === 0 || !!player.dead || (!!player.car && !mouse.l && player.fireT < -1.5));
  $('mini').style.borderColor = wanted.stars ? (Math.floor(simT * 3) % 2 ? '#ff4a4a' : '#4a8dff') : 'rgba(255,255,255,.85)';
  $('speed').classList.toggle('hide', !player.car); if (player.car) $('spd').textContent = Math.round(Math.hypot(player.car.vx, player.car.vz) * 2.237);
  const pr = $('prompt'); if (promptHtml) { if (pr.dataset.h !== promptHtml) { pr.innerHTML = promptHtml; pr.dataset.h = promptHtml; } pr.classList.remove('hide'); } else pr.classList.add('hide');
  const z = W.zoneAt(player.x, player.z); if (z !== lastZone) { lastZone = z; showZone(z, 'Palmera Bay'); }
  $('dmg').style.opacity = dmgFlash + (player.hp < 25 ? 0.25 : 0); dmgFlash = Math.max(0, dmgFlash - 0.12);
}
function openMap() { state = 'map'; $('mapscreen').classList.remove('hide'); drawBigMap(); }
function closeMap() { state = 'play'; $('mapscreen').classList.add('hide'); }
function drawBigMap() {
  const c = $('bigmap'), src = W.mapCanvas, mb = W.bounds, SCm = W.mapScale, cx0 = (-700 - mb.x0) * SCm, cz0 = (-595 - mb.z0) * SCm, cw = 1790 * SCm, ch = 1150 * SCm, k = Math.min(innerWidth / cw, innerHeight / ch);
  c.width = cw * k; c.height = ch * k; const g = c.getContext('2d'); g.drawImage(src, cx0, cz0, cw, ch, 0, 0, c.width, c.height);
  const tr = (x, z) => [((x - mb.x0) * SCm - cx0) * k, ((z - mb.z0) * SCm - cz0) * k];
  g.font = 'italic 900 ' + Math.round(15 * k * 1.6) + 'px "Arial Black",Arial'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.5)';
  for (const [n, x, z] of [['MIDTOWN SPIRES', -140, -70], ['SOL STRAND', 210, 210], ['HIBISCUS HEIGHTS', -490, -140], ['PORT PALMERA', -420, 350], ['MERCADO', 70, -350], ['ISLA CORONA', 850, -300], ['COSTA AZUL BEACH', 470, -40], ['SUNSPAN BRIDGE', 525, -450], ['BAYVIEW FLATS', -140, 350], ['EGRET PARK', 70, -70]]) { const [px, py] = tr(x, z); g.fillText(n, px, py); }
  gps.t = -9; const route = gpsRoute(); if (route) { g.strokeStyle = objBlip ? 'rgba(255,90,170,.9)' : 'rgba(255,216,74,.9)'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); route.forEach((p, i) => { const [x, y] = tr(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
  for (const b of staticBlips()) { const [x, y] = tr(b.x, b.z); drawBlip(g, x, y, b, 1.5); }
  for (const cc of cars) if (cc.driver === 'cop') { const [x, y] = tr(cc.x, cc.z); g.fillStyle = '#ff3030'; g.beginPath(); g.arc(x, y, 6, 0, 6.3); g.fill(); }
  const [px, py] = tr(player.x, player.z); g.save(); g.translate(px, py); g.rotate(Math.PI - (player.car ? player.car.rot : player.rot)); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -15); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
}

// ---------- menus ----------
let state = 'load', prevState = 'title', menuItems = [], menuSel = 0, menuEl = null;
function buildMenu(id, items) {
  const ul = $(id); ul.innerHTML = ''; menuItems = items; menuEl = ul; menuSel = Math.min(menuSel, items.length - 1);
  items.forEach((it, i) => { const li = document.createElement('li'); li.innerHTML = `${it[0]}<span>${it[1] || ''}</span>`; li.onmouseenter = () => { menuSel = i; hiMenu(); }; li.onclick = (e) => { if (e.target.tagName === 'INPUT') return; menuSel = i; au('init'); au('play', 'uiSelect'); it[2] && it[2](1); }; if (it[3]) { const inp = li.querySelector('input'); if (inp) inp.oninput = () => it[3](+inp.value); } ul.appendChild(li); }); hiMenu();
}
function hiMenu() { if (!menuEl) return; [...menuEl.children].forEach((li, i) => li.classList.toggle('sel', i === menuSel)); }
function menuKey(e) {
  if (!menuItems.length) return; if (e.code === 'ArrowDown' || e.code === 'KeyS') { menuSel = (menuSel + 1) % menuItems.length; au('play', 'ui'); hiMenu(); } else if (e.code === 'ArrowUp' || e.code === 'KeyW') { menuSel = (menuSel + menuItems.length - 1) % menuItems.length; au('play', 'ui'); hiMenu(); }
  else if (e.code === 'Enter' || e.code === 'Space') { au('play', 'uiSelect'); menuItems[menuSel][2] && menuItems[menuSel][2](1); } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { menuItems[menuSel][2] && menuItems[menuSel][2](e.code === 'ArrowLeft' ? -1 : 1); }
  else if (e.code === 'Escape') { if (state === 'pause') resume(); else if (state === 'options') closeOptions(); else if (state === 'shop') { $('shop').classList.add('hide'); state = 'play'; lockPointer(); } }
}
function hideAll() { for (const id of ['title', 'pause', 'options', 'shop', 'quit', 'mapscreen']) $(id).classList.add('hide'); }
function showTitle() {
  state = 'title'; hideAll(); $('title').classList.remove('hide'); $('hud').classList.add('hide'); au('stopAll'); menuSel = 0; hero.g.visible = false;
  const items = []; if (localStorage.getItem('palmera_save')) items.push(['Continue', '', () => startGame(true)]);
  items.push(['Start', localStorage.getItem('palmera_save') ? 'New game' : '', () => startGame(false)], ['Options', '', () => openOptions()], ['Quit', '', () => { state = 'quit'; hideAll(); $('quit').classList.remove('hide'); menuSel = 0; buildMenu('qmenu', [['Back to title', '', showTitle]]); try { window.close(); } catch (e) { } }]); buildMenu('tmenu', items);
}
function openOptions() {
  prevState = state; state = 'options'; hideAll(); $('options').classList.remove('hide'); menuSel = 0; const QN = ['Low', 'Medium', 'High'];
  const sl = (v, a, b, st) => `<input type="range" min="${a}" max="${b}" step="${st}" value="${v}">`;
  const render = () => buildMenu('omenu', [
    ['Graphics quality', '◀ ' + QN[opts.quality] + ' ▶', (d) => { opts.quality = (opts.quality + d + 3) % 3; applyQuality(); saveOpts(); render(); }],
    ['Field of view', sl(opts.fov, 50, 100, 1) + ' ' + opts.fov + '°', (d) => { opts.fov = clamp(opts.fov + d * 5, 50, 100); applyQuality(); saveOpts(); render(); }, v => { opts.fov = v; applyQuality(); saveOpts(); }],
    ['Mouse sensitivity', sl(opts.sens, 0.2, 3, 0.1) + ' ' + opts.sens.toFixed(1), (d) => { opts.sens = clamp(+(opts.sens + d * 0.1).toFixed(1), 0.2, 3); saveOpts(); render(); }, v => { opts.sens = v; saveOpts(); }],
    ['Master volume', sl(opts.vol, 0, 1, 0.05) + ' ' + Math.round(opts.vol * 100) + '%', (d) => { opts.vol = clamp(+(opts.vol + d * 0.05).toFixed(2), 0, 1); au('setMaster', opts.vol); saveOpts(); render(); }, v => { opts.vol = v; au('setMaster', v); saveOpts(); }],
    ['Radio volume', sl(opts.music, 0, 1, 0.05) + ' ' + Math.round(opts.music * 100) + '%', (d) => { opts.music = clamp(+(opts.music + d * 0.05).toFixed(2), 0, 1); au('setMusic', opts.music); saveOpts(); render(); }, v => { opts.music = v; au('setMusic', v); saveOpts(); }],
    ['Back', '', closeOptions]]);
  render();
}
function closeOptions() { $('options').classList.add('hide'); if (prevState === 'title') showTitle(); else openPause(); }
function openPause() {
  if (state !== 'play' && state !== 'options') return; state = 'pause'; hideAll(); $('pause').classList.remove('hide'); document.exitPointerLock && document.exitPointerLock(); au('stopAll'); menuSel = 0;
  $('pstats').textContent = `Jobs ${player.done.length} / ${MISSIONS.length}   ·   Neon flamingos ${player.flam.length} / ${FLAMINGOS.length}   ·   Cash $${Math.floor(player.money).toLocaleString()}   ·   ${W.zoneAt(player.x, player.z)}`;
  buildMenu('pmenu', [['Resume', '', resume], ['Save game', '', () => { save(); menuItems[1][1] = 'Saved ✓'; buildMenu('pmenu', menuItems); }], ['Map', '', () => { hideAll(); openMap(); }], ['Options', '', openOptions], ['Quit to title', '', () => { save(); location.href = location.pathname; }]]);
}
function resume() { hideAll(); state = 'play'; lockPointer(); if (player.car && radioIdx >= 0) rad('set', radioIdx); }
function save() { if (AUTO) return; try { localStorage.setItem('palmera_save', JSON.stringify({ money: player.money, hp: player.hp, armor: player.armor, owned: player.owned, mag: player.mag, ammo: player.ammo, done: player.done, flam: player.flam, x: player.x, z: player.z, tod, weapon: player.weapon })); } catch (e) { } }
function startGame(cont) {
  hideAll(); $('hud').classList.remove('hide'); state = 'play'; hero.g.visible = true; au('init'); au('setMaster', opts.vol); au('setMusic', opts.music);
  if (cont) { try { const s = JSON.parse(localStorage.getItem('palmera_save')); Object.assign(player, { money: s.money, hp: Math.max(30, s.hp), armor: s.armor, owned: s.owned, mag: s.mag, ammo: s.ammo, done: s.done || [], flam: s.flam || [], weapon: s.weapon || 0 }); if (W.groundH(s.x, s.z) > -0.5 && !W.collideCircle(s.x, s.z, 0.5).hit) { player.x = s.x; player.z = s.z; } tod = s.tod; } catch (e) { } }
  else { localStorage.removeItem('palmera_save'); banner('PALMERA HEAT', 'Welcome to Palmera Bay', ''); say('SKIP', "Dante! You're finally out. Come see me at Skip's Marine down in the port — follow the yellow S on your map.", 6); say('', 'WASD move · Mouse look · F enter cars · M map', 6); }
  refreshGivers(); spawnFlamingos(); if (!AUTO) lockPointer(); populate();
}
function populate() { const f = focusPos(); for (let i = 0; i < 26; i++) spawnTraffic(f, 40, 330); for (let i = 0; i < 30; i++) spawnCiv(f, 10, 170); }

// ---------- scenes for screenshots ----------
function setupScene() {
  startGame(false); subQ.length = 0; $('banner').style.opacity = 0;
  const put = (x, z, yaw) => { player.x = x; player.z = z; camYaw = yaw; player.rot = yaw; cars.filter(c => c.driver === 'ai').forEach(removeCar); peds.slice().forEach(removePed); populate(); };
  const drive = (x, z, rot, k = 'sports') => { put(x, z, rot); const c = makeCar(k, x, z, rot, 0xc8102e); enterCar(c); botTakeCar(c); c.speed = 20; return c; };
  if (SCENE === 'drive') drive(-200, 5.2 - 10, Math.PI / 2 * -1 + Math.PI, 'sports');
  else if (SCENE === 'chase' || SCENE === 'night') { drive(-420 + 1.8, -100, 0, 'muscle'); setWanted(SCENE === 'night' ? 2 : 3); for (let k = 0; k < 3; k++) { const c = makeCar('police', -420 + (k === 1 ? 5.4 : k === 0 ? -1.8 : 1.8), k === 1 ? -84 : k === 0 ? -80 : -125, 0); c.driver = 'cop'; c.parked = false; c.ai = { nav: null, rev: 0, deployed: false, losT: 0, los: true }; c.speed = 22; } }
  else if (SCENE === 'beach') put(292, 60, 0.2); else if (SCENE === 'downtown') put(-140 + 4, 20, Math.PI); else if (SCENE === 'bridge') drive(330, -420 + 3.6, Math.PI / 2, 'sports');
  else if (SCENE === 'shoot') { put(40, 143, Math.PI / 2); for (let k = 0; k < 4; k++) spawnPed(60 + k * 5, 146 + k, k === 3 ? 'cop' : 'civ').state = k === 3 ? 'fight' : 'flee'; setWanted(2); } else if (SCENE === 'mission') { put(P.hotelCar.x - 9, P.hotelCar.z + 5, Math.PI / 2); startMission(MISSIONS[0]); }
  else if (SCENE === 'shop') { put(P.gunshop.x, P.gunshop.z, Math.PI); openShop(); } else if (SCENE === 'map') openMap(); else if (SCENE === 'pause') openPause(); else if (SCENE === 'walk') put(P.spawn.x, P.spawn.z, 0);
  else if (SCENE === 'pdrive') { put(-250, 1.8, Math.PI / 2); enterCar(makeCar('muscle', -250, 1.8, Math.PI / 2, 0xff7a1a)); }
  else if (SCENE === 'die') { put(P.spawn.x, P.spawn.z, 0); setTimeout(() => { hurtPlayer(500); player.dead = 3.5; }, 400); }
  if (Q.has('at')) { const a = Q.get('at').split(',').map(Number); put(a[0], a[1], a[2] === undefined ? Math.PI : a[2]); }
  if (Q.has('m')) { clearWanted(); startMission(MISSIONS[+Q.get('m')]); }
  if (Q.has('wanted')) setWanted(+Q.get('wanted'));
}

// ---------- main loop ----------
let last = performance.now(), popT = 0, zoneT = 0;
function frame(now) {
  requestAnimationFrame(frame); let real = Math.min(AUTO ? 1.6 : 0.1, (now - last) / 1000); last = now; if (real <= 0) real = 0.016; const steps = Math.max(1, Math.ceil(real / 0.035)), dt = real / steps;
  for (let st = 0; st < steps; st++) if (state === 'play') {
    simT += dt; bot.t += dt;
    updatePlayer(dt); updateCars(dt); updatePeds(dt); updateWanted(dt); updateHeli(dt); updatePickups(dt); updateMissions(dt); updateServices(dt); updateFx(dt);
    W.updateSignals(simT); mouse.lp = false;
    popT -= dt; if (popT <= 0) { popT = 0.5; const f = focusPos(); const nT = cars.filter(c => c.driver === 'ai').length, nP = peds.filter(p => p.kind === 'civ').length; const maxT = [16, 24, 30][opts.quality], maxP = [16, 26, 34][opts.quality]; if (nT < maxT) spawnTraffic(f, 130, 340); if (nT < maxT - 6) spawnTraffic(f, 130, 340); if (nP < maxP) spawnCiv(f, 60, 190); if (nP < maxP - 8) spawnCiv(f, 60, 190); for (const m of markers) m.g.rotation.y += 0.1; if (!AUTO && Math.random() < 0.03) save(); }
    for (const m of markers) { m.g.children[0].scale.y = 1 + Math.sin(simT * 4) * 0.2; }
    if (AUTO && SCENE === '' && bot.t > 9 && wanted.stars < 2 && bot.t < 9.2) setWanted(2);
    const oc = clamp(1 - Math.abs(player.x - 400) / 220, 0, 1); au('ambient', 1 - nightF, oc);
    updateCamera(dt);
  }
  if (state === 'play') updateHUD(real); else updateCamera(real);
  updateSky(state === 'play' ? real : real * 0.2);
  renderer.render(scene, cam);
}
// parked cars
for (const s of W.parking) { const r = Math.random(), k = s.type || (r < 0.3 ? 'sedan' : r < 0.5 ? 'compact' : r < 0.68 ? 'suv' : r < 0.82 ? 'pickup' : r < 0.93 ? 'muscle' : 'sports'); makeCar(k, s.x, s.z, s.rot); }
setupServices(); $('load').classList.add('hide');
if (AUTO) setupScene(); else { showTitle(); if (Q.get('menu') === 'options') openOptions(); if (Q.get('menu') === 'quit') { state = 'quit'; hideAll(); $('quit').classList.remove('hide'); buildMenu('qmenu', [['Back to title', '', showTitle]]); } }
if (Q.get('menu') === 'play') startGame(false);
if (Q.get('menu') === 'continue') { startGame(false); player.money = 777; player.done.push('m1'); save(); player.money = 0; player.done = []; startGame(true); } // save/load self-test
if (Q.get('menu') === 'pause') { startGame(false); openPause(); } if (Q.get('menu') === 'map') { startGame(false); openMap(); }
updateSky(0.001); requestAnimationFrame(frame);
window.__game = { player, cars, peds, wanted, W };
