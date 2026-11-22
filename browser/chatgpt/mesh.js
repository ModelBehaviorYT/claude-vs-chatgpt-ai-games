import * as T from "./lib/three.module.min.js";
export { T };
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n)),
  mix = (a, b, t) => a + (b - a) * t,
  TAU = Math.PI * 2;
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function canvasTex(w, h, paint, repeat = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
export const solid = new T.MeshLambertMaterial({ vertexColors: true });
export const unlit = new T.MeshBasicMaterial({ vertexColors: true });
export const double = new T.MeshLambertMaterial({
  vertexColors: true,
  side: T.DoubleSide,
});
export const material = (map, lit = true, opts = {}) =>
  new (lit ? T.MeshLambertMaterial : T.MeshBasicMaterial)({
    map,
    vertexColors: true,
    ...opts,
  });
const cube = new T.BoxGeometry(1, 1, 1),
  plane = new T.PlaneGeometry(1, 1),
  geomCache = new Map(),
  colorCache = new Map();
const mat4 = new T.Matrix4(),
  euler = new T.Euler(),
  quat = new T.Quaternion(),
  pos = new T.Vector3(),
  size = new T.Vector3(),
  vec = new T.Vector3(),
  normal = new T.Vector3(),
  normMat = new T.Matrix3();
function matrix(x, y, z, sx, sy, sz, rx, ry, rz) {
  return mat4.compose(
    pos.set(x, y, z),
    quat.setFromEuler(euler.set(rx, ry, rz, "YXZ")),
    size.set(sx, sy, sz),
  );
}
function colorOf(c) {
  if (c?.isColor) return c;
  if (!colorCache.has(c)) colorCache.set(c, new T.Color(c));
  return colorCache.get(c);
}
// Groups compatible parts into a single draw call while retaining local lighting and texture coordinates.
export class Builder {
  constructor() {
    this.buffers = new Map();
    this.base = new T.Matrix4();
  }
  at(x, y, z, ry, fn) {
    let old = this.base;
    this.base = old.clone().multiply(matrix(x, y, z, 1, 1, 1, 0, ry, 0));
    fn();
    this.base = old;
  }
  add(
    g,
    c,
    m = solid,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
    uv = null,
  ) {
    let b = this.buffers.get(m);
    if (!b) {
      b = { p: [], n: [], uv: [], c: [], i: [] };
      this.buffers.set(m, b);
    }
    let a = g.attributes,
      tm = matrix(x, y, z, sx, sy, sz, rx, ry, rz).premultiply(this.base);
    normMat.getNormalMatrix(tm);
    let offset = b.p.length / 3,
      cc = colorOf(c);
    for (let i = 0; i < a.position.count; i++) {
      vec.fromBufferAttribute(a.position, i).applyMatrix4(tm);
      normal.fromBufferAttribute(a.normal, i).applyMatrix3(normMat).normalize();
      b.p.push(vec.x, vec.y, vec.z);
      b.n.push(normal.x, normal.y, normal.z);
      let tint = a.color;
      b.c.push(
        cc.r * (tint ? tint.getX(i) : 1),
        cc.g * (tint ? tint.getY(i) : 1),
        cc.b * (tint ? tint.getZ(i) : 1),
      );
      let u = a.uv?.getX(i) || 0,
        v = a.uv?.getY(i) || 0;
      b.uv.push(uv ? uv[0] + u * uv[2] : u, uv ? uv[1] + v * uv[3] : v);
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++)
        b.i.push(offset + g.index.getX(i));
    } else for (let i = 0; i < a.position.count; i++) b.i.push(offset + i);
  }
  box(x, y, z, w, h, d, c, ry = 0, m = solid, rx = 0, rz = 0) {
    this.add(cube, c, m, x, y, z, w, h, d, rx, ry, rz);
  }
  quad(x, y, z, w, h, c, ry = 0, rx = 0, m = solid, uv = null) {
    this.add(plane, c, m, x, y, z, w, h, 1, rx, ry, 0, uv);
  }
  cyl(x, y, z, rt, rb, h, c, sides = 10, rx = 0, ry = 0, rz = 0, m = solid) {
    let k = "c" + [rt, rb, sides].join();
    if (!geomCache.has(k))
      geomCache.set(k, new T.CylinderGeometry(rt, rb, 1, sides));
    this.add(geomCache.get(k), c, m, x, y, z, 1, h, 1, rx, ry, rz);
  }
  oval(x, y, z, w, h, d, c, rx = 0, ry = 0, rz = 0, m = solid) {
    let k = "sphere";
    if (!geomCache.has(k)) geomCache.set(k, new T.SphereGeometry(1, 12, 9));
    this.add(geomCache.get(k), c, m, x, y, z, w, h, d, rx, ry, rz);
  }
  beam(a, b, r1, r2, c, sides = 8, m = solid) {
    let d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
      len = d.length();
    let q = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      d.normalize(),
    );
    let e = new T.Euler().setFromQuaternion(q, "YXZ");
    this.cyl(
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      r2,
      r1,
      len,
      c,
      sides,
      e.x,
      e.y,
      e.z,
      m,
    );
  }
  poly(points, c, m = solid, uvs) {
    let g = new T.BufferGeometry(),
      p = [],
      u = [];
    for (let i = 1; i < points.length - 1; i++)
      for (let j of [0, i, i + 1]) {
        p.push(...points[j]);
        u.push(...(uvs?.[j] || [0, 0]));
      }
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(u, 2));
    g.computeVertexNormals();
    this.add(g, c, m);
  }
  finish(cast = true, receive = true) {
    let group = new T.Group();
    for (let [m, b] of this.buffers) {
      let g = new T.BufferGeometry();
      for (let [k, key, n] of [
        ["position", "p", 3],
        ["normal", "n", 3],
        ["color", "c", 3],
        ["uv", "uv", 2],
      ])
        g.setAttribute(k, new T.Float32BufferAttribute(b[key], n));
      g.setIndex(b.i);
      g.computeBoundingSphere();
      let mesh = new T.Mesh(g, m);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      group.add(mesh);
    }
    this.buffers.clear();
    return group;
  }
}
export function texturedNoise(base, spread = 16, style = "grain") {
  let r = rng(style.length * 150 + spread);
  return canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      let id = ctx.getImageData(0, 0, w, h),
        d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        let v = (r() - 0.5) * spread;
        for (let j = 0; j < 3; j++) d[i + j] += v;
      }
      ctx.putImageData(id, 0, 0);
      if (style === "concrete") {
        ctx.strokeStyle = "#8b898033";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, 128, 128);
        ctx.strokeRect(128, 128, 128, 128);
      }
      if (style === "asphalt") {
        for (let j = 0; j < 500; j++) {
          let x = r() * w,
            y = r() * h;
          ctx.fillStyle = r() > 0.5 ? "#c1c0af44" : "#26262e55";
          ctx.fillRect(x, y, r() * 1.8 + 0.5, r() * 1.5 + 0.5);
        }
      }
    },
    true,
  );
}
// All commercial artwork and lettering share a local texture atlas.
export class SignAtlas {
  constructor() {
    this.c = document.createElement("canvas");
    this.c.width = 2048;
    this.c.height = 4096;
    this.ctx = this.c.getContext("2d");
    this.tex = new T.CanvasTexture(this.c);
    this.tex.colorSpace = T.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.mat = material(this.tex, false, { side: T.DoubleSide });
    this.cache = new Map();
  }
  get(label, bg, fg, font = "bold 80px Cond", sub = "", aspect = 8) {
    let key = [label, bg, fg, font, sub, Math.round(aspect * 10)].join("|");
    if (this.cache.has(key)) return this.cache.get(key);
    const i = this.cache.size % 512,
      w = Math.min(256, 64 * aspect),
      h = Math.min(64, 256 / aspect),
      x = (i % 8) * 256,
      y = Math.floor(i / 8) * 64;
    let c = this.ctx;
    c.save();
    c.fillStyle = bg;
    c.fillRect(x, y, w, h);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = fg;
    c.font = font;
    c.save();
    let tw = c.measureText(label).width,
      scale = Math.min(
        (w - 20) / tw,
        (sub ? h * 0.65 : h * 0.84) /
          Math.max(1, parseFloat(font.match(/([\d.]+)px/)?.[1] || 60) * 0.78),
      );
    c.translate(x + w / 2, y + (sub ? h * 0.37 : h * 0.5));
    c.scale(scale, scale);
    c.fillText(label, 0, 0);
    c.restore();
    if (sub) {
      c.font = "bold 12px Arial";
      c.fillText(sub, x + w / 2, y + h * 0.82);
    }
    c.restore();
    this.tex.needsUpdate = true;
    const uv = [
      (x + 1) / 2048,
      1 - (y + h - 1) / 4096,
      (w - 2) / 2048,
      (h - 2) / 4096,
    ];
    this.cache.set(key, uv);
    return uv;
  }
  sign(b, x, y, z, w, h, txt, bg, fg, ry = 0, font, sub) {
    b.quad(
      x,
      y,
      z,
      w,
      h,
      0xffffff,
      ry,
      0,
      this.mat,
      this.get(txt, bg, fg, font, sub, w / h),
    );
  }
}
