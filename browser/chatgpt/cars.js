import { cityReflection } from "./reflections.js";
import {
  T,
  Builder,
  canvasTex,
  material,
  clamp,
  mix,
  solid,
  unlit,
  double,
} from "./mesh.js";
export const paints = [
  0xe85f46, 0x72cfca, 0xe4bf68, 0x488c9a, 0xd7d8d0, 0x395b70, 0xa15565,
  0x608b7f, 0x919daf, 0xc5ab92, 0x323c4c,
];
export const carNames = {
  sport: "Velora Veloce",
  sedan: "Santoro Regent",
  suv: "Caldera Estate",
  taxi: "Azure City Cab",
  police: "Patrol Interceptor",
  classic: "Paloma Caliente",
};
const dark = 0x17242d,
  rubber = 0x242a2f,
  chrome = 0xc3cfcc;
const reflection = cityReflection();
const sheen = new T.MeshPhongMaterial({
  vertexColors: true,
  envMap: reflection,
  combine: T.MixOperation,
  reflectivity: 0.19,
  shininess: 60,
  specular: 0x45433c,
  side: T.DoubleSide,
});
const glass = new T.MeshPhongMaterial({
  vertexColors: true,
  envMap: reflection,
  combine: T.MixOperation,
  reflectivity: 0.58,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  shininess: 100,
  specular: 0x718c94,
  side: T.DoubleSide,
});
const rubberMat = new T.MeshLambertMaterial({ vertexColors: true });
const wheelCache = new Map(),
  carCache = new Map();
function wheel(rad, type) {
  let key = rad + type;
  if (wheelCache.has(key)) return wheelCache.get(key);
  let b = new Builder(),
    s = rad / 0.35;
  b.cyl(0, 0, 0, rad, rad, 0.235 * s, rubber, 18, 0, 0, Math.PI / 2);
  for (let a of [-1, 1]) {
    let x = a * 0.119 * s;
    b.cyl(
      x,
      0,
      0,
      rad * 0.86,
      rad * 0.91,
      0.025 * s,
      0x34383c,
      20,
      0,
      0,
      Math.PI / 2,
    );
    b.cyl(
      x + a * 0.018 * s,
      0,
      0,
      rad * 0.67,
      rad * 0.67,
      0.022 * s,
      chrome,
      20,
      0,
      0,
      Math.PI / 2,
    );
    b.cyl(
      x + a * 0.031 * s,
      0,
      0,
      rad * 0.55,
      rad * 0.55,
      0.018 * s,
      0x414c56,
      18,
      0,
      0,
      Math.PI / 2,
    );
    for (let j = 0; j < (type === "sport" ? 7 : 6); j++) {
      let ang = (j * Math.PI * 2) / (type === "sport" ? 7 : 6);
      b.box(
        x + a * 0.046 * s,
        Math.sin(ang) * rad * 0.32,
        Math.cos(ang) * rad * 0.32,
        0.027 * s,
        rad * 0.155,
        rad * 0.58,
        type === "sport" ? 0xd1c8ab : 0xc1c9ca,
        0,
        solid,
        -ang,
      );
    }
    b.cyl(
      x + a * 0.061 * s,
      0,
      0,
      rad * 0.2,
      rad * 0.2,
      0.034 * s,
      0x818d90,
      12,
      0,
      0,
      Math.PI / 2,
    );
  }
  let obj = b.finish();
  wheelCache.set(key, obj);
  return obj;
}
function plate(b, atlas, z, y, angle, id) {
  b.box(0, y, z, 0.68, 0.245, 0.032, 0xc1c8bf);
  atlas.sign(
    b,
    0,
    y,
    z + (angle ? -0.019 : 0.019),
    0.64,
    0.22,
    "AZ " +
      String(id * 137 + 470)
        .padStart(4, "0")
        .slice(-4),
    "#f2e2b7",
    "#244455",
    angle,
    "bold 72px Cond",
  );
}
function surface(b, points, col, mat = sheen) {
  b.poly(points, col, mat);
}
function hull(b, rows, col, type) {
  let verts = rows.map(([z, w, low, side, top]) => [
    [-w * 0.89, low, z],
    [-w, low + 0.09, z],
    [-w, side, z],
    [-w * 0.86, top, z],
    [w * 0.86, top, z],
    [w, side, z],
    [w, low + 0.09, z],
    [w * 0.89, low, z],
  ]);
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < 8; i++) {
      let k = (i + 1) % 8;
      surface(
        b,
        [verts[j][i], verts[j + 1][i], verts[j + 1][k], verts[j][k]],
        i === 0 || i === 6 ? new T.Color(col).multiplyScalar(0.7) : col,
      );
    }
  surface(b, verts[0], col);
  surface(b, verts.at(-1), col);
  return verts;
}
function cabin(b, p, body, type) {
  let { wf, wr, wtf, wtr, zf, zr, ztf, ztr, yb, yt } = p;
  let a = [-wf, yb, zf],
    d = [wf, yb, zf],
    e = [-wr, yb, zr],
    f = [wr, yb, zr],
    A = [-wtf, yt, ztf],
    D = [wtf, yt, ztf],
    E = [-wtr, yt, ztr],
    F = [wtr, yt, ztr];
  surface(b, [a, d, D, A], 0x6c9aa7, glass);
  surface(b, [e, f, F, E], 0x537b8e, glass);
  surface(b, [a, e, E, A], 0x3f6272, glass);
  surface(b, [d, f, F, D], 0x466d7a, glass);
  surface(b, [A, D, F, E], body);
  let interpolate = (u, v, t) => u.map((n, i) => mix(n, v[i], t));
  for (let pts of [
    [a, A],
    [d, D],
    [e, E],
    [f, F],
  ])
    b.beam(
      pts[0],
      pts[1],
      type === "sport" ? 0.041 : 0.062,
      type === "sport" ? 0.042 : 0.058,
      body,
      5,
    );
  for (let s of [-1, 1]) {
    let base0 = s === 1 ? d : a,
      base1 = s === 1 ? f : e,
      top0 = s === 1 ? D : A,
      top1 = s === 1 ? F : E;
    b.beam(base0, base1, 0.035, 0.037, chrome, 5);
    b.beam(top0, top1, 0.042, 0.043, body, 6);
    let bot = interpolate(base0, base1, type === "sport" ? 0.65 : 0.54),
      top = interpolate(top0, top1, type === "sport" ? 0.77 : 0.54);
    b.beam(bot, top, 0.044, 0.047, 0x26373f, 5);
    // Reflected sky, mirror trim and quarterlights emphasize the glass rake.
    let p0 = interpolate(base0, top0, 0.53),
      p1 = interpolate(base1, top1, 0.58),
      p2 = interpolate(base1, top1, 0.67),
      p3 = interpolate(base0, top0, 0.6);
    for (let point of [p0, p1, p2, p3]) point[0] += s * 0.005;
    surface(b, [p0, p1, p2, p3], 0x74959f, glass);
    b.beam(
      [s * wf, yb + 0.045, zf + 0.27],
      [s * (wf + 0.2), yb + 0.12, zf + 0.3],
      0.039,
      0.039,
      dark,
      5,
    );
    b.oval(s * (wf + 0.24), yb + 0.15, zf + 0.29, 0.139, 0.082, 0.15, body);
  }
  for (let d of [0.19, 0.25]) {
    let p0 = interpolate(a, A, d),
      p1 = interpolate(d === 1 ? A : a, A, d + 0.018);
    p0[2] -= 0.004;
    p1[2] -= 0.004;
    surface(
      b,
      [p0, [-p0[0], p0[1], p0[2]], [-p1[0], p1[1], p1[2]], p1],
      0x83a7ae,
      glass,
    );
  }
  for (let j = 1; j <= 6; j++) {
    let v = j / 8,
      p0 = interpolate(e, E, v),
      p1 = interpolate(f, F, v);
    p0[2] += 0.006;
    p1[2] += 0.006;
    b.beam(p0, p1, 0.003, 0.003, 0x7c8584, 4);
  }
  b.beam(a, d, 0.032, 0.032, 0x283a41, 5);
  b.beam(A, D, 0.036, 0.036, body, 5);
  b.beam(E, F, 0.04, 0.04, body, 5);
}
export function paintEnvironment(day) {
  sheen.reflectivity = 0.045 + 0.145 * day;
  glass.reflectivity = 0.1 + 0.48 * day;
}
function createModel(type, paint, at, variant) {
  let b = new Builder(),
    sports = type === "sport",
    suv = type === "suv",
    classic = type === "classic",
    cop = type === "police",
    taxi = type === "taxi";
  let col = cop ? 0x26333d : taxi ? 0xe8ab49 : paint;
  let L = sports ? 4.65 : suv ? 4.65 : classic ? 5.02 : 4.54,
    W = sports ? 2.06 : suv ? 2.04 : 1.94,
    R = suv ? 0.391 : sports ? 0.344 : 0.355,
    wb = sports ? 1.42 : suv ? 1.43 : classic ? 1.57 : 1.38,
    H = sports ? 0.85 : suv ? 1.1 : 0.985,
    w = W / 2,
    l = L / 2;
  let bump = suv ? 0.31 : 0.23;
  let rows = [
    [-l + 0.02, w * 0.79, bump + 0.09, H * 0.67, H * 0.72],
    [-l + 0.19, w * 0.97, bump, H * 0.76, H * 0.84],
    [-wb, w, bump, H * 0.83, H * 0.94],
    [-l * 0.34, w, bump, H * 0.9, H],
    [l * 0.31, w, bump, H * 0.93, H * 1.06],
    [wb, w * 0.99, bump, H * 0.95, H * 1.04],
    [l - 0.13, w * 0.975, bump + 0.025, H * 0.91, H * 0.99],
    [l, w * 0.86, bump + 0.1, H * 0.85, H * 0.93],
  ];
  hull(b, rows, col, type);
  // The shadowed wheel wells, rocker mouldings and belt line run around the lower body.
  for (let s of [-1, 1]) {
    b.box(s * (w - 0.02), bump + 0.055, 0, 0.11, 0.115, wb * 1.53, dark);
    for (let z of [-wb, wb]) {
      b.cyl(
        s * (w - 0.08),
        R + 0.052,
        z,
        R * 1.05,
        R * 1.05,
        0.25,
        0x1c2429,
        18,
        0,
        0,
        Math.PI / 2,
      );
      for (let j = 0; j < 10; j++) {
        let a = (j * Math.PI) / 10,
          c = ((j + 1) * Math.PI) / 10,
          rx = R + 0.058;
        b.beam(
          [s * (w + 0.015), R + Math.sin(a) * rx, z + Math.cos(a) * rx],
          [s * (w + 0.015), R + Math.sin(c) * rx, z + Math.cos(c) * rx],
          0.024,
          0.024,
          col,
          4,
        );
      }
    }
    let sw = type === "police" ? 0xe0e4da : col;
    if (cop) b.box(s * (w + 0.008), H * 0.665, 0, 0.028, 0.42, 2.2, sw);
    b.box(
      s * (w + 0.017),
      H * 0.62,
      0,
      0.031,
      0.065,
      L * 0.91,
      classic ? chrome : dark,
    );
    let doorEnd = sports ? 0.77 : 0.14;
    b.box(s * (w + 0.027), H * 0.66, doorEnd, 0.013, 0.37, 0.016, 0x485156);
    if (!sports)
      b.box(s * (w + 0.027), H * 0.7, 1.02, 0.012, 0.37, 0.016, 0x475258);
    for (let z of sports ? [0.58] : [-0.03, 0.87])
      b.box(
        s * (w + 0.035),
        H * 0.86,
        z,
        0.04,
        0.04,
        0.22,
        classic ? chrome : dark,
      );
    if (sports) {
      for (let k = 0; k < 4; k++)
        b.box(
          s * (w + 0.028),
          0.49 + k * 0.066,
          0.81,
          0.026,
          0.026,
          0.44 + k * 0.045,
          0x333d43,
        );
    }
    if (cop) {
      at.sign(
        b,
        s * (w + 0.045),
        0.665,
        -0.12,
        0.89,
        0.245,
        "POLICE",
        "#e1e3d9",
        "#223642",
        (s * Math.PI) / 2,
        "italic bold 68px Cond",
      );
      b.box(s * w, 0.75, 1.66, 0.045, 0.05, 0.56, 0xeae9d7);
    }
  }
  let seatCol = sports ? 0x574a42 : suv ? 0x635b50 : 0x444c50;
  for (let s of [-1, 1]) {
    b.oval(s * 0.435, H * 0.96, 0.14, 0.235, 0.13, 0.315, seatCol);
    b.oval(s * 0.435, H + 0.14, 0.37, 0.218, 0.236, 0.071, seatCol, -0.14);
    b.oval(s * 0.435, H + 0.31, 0.397, 0.144, 0.095, 0.069, seatCol);
  }
  b.box(0, H + 0.015, -0.68, W * 0.74, 0.12, 0.33, 0x384347);
  b.box(0, H + 0.01, 1.03, W * 0.73, 0.09, 0.34, 0x3c4a4d);
  for (let j = 0; j < 12; j++) {
    let a = (j * Math.PI) / 6,
      n = ((j + 1) * Math.PI) / 6;
    b.beam(
      [-0.43 + Math.cos(a) * 0.128, H + 0.11 + Math.sin(a) * 0.11, -0.43],
      [-0.43 + Math.cos(n) * 0.128, H + 0.11 + Math.sin(n) * 0.11, -0.43],
      0.016,
      0.016,
      0x30373b,
      5,
    );
  }
  let yb = H * 0.975,
    yt = sports ? 1.28 : suv ? 1.77 : classic ? 1.44 : 1.48;
  cabin(
    b,
    {
      wf: w * 0.87,
      wr: w * 0.89,
      wtf: w * (sports ? 0.67 : 0.74),
      wtr: w * (sports ? 0.69 : 0.76),
      zf: sports ? -0.83 : -0.97,
      zr: suv ? 1.91 : 1.38,
      ztf: sports ? -0.12 : -0.43,
      ztr: suv ? 1.54 : sports ? 0.63 : 0.7,
      yb,
      yt,
    },
    col,
    type,
  );
  // Front fascia and inset headlamp lenses.
  b.box(0, H * 0.49, -l + 0.015, W * 0.76, 0.18, 0.102, dark);
  for (let k = 0; k < 4; k++)
    b.box(
      0,
      H * 0.425 + k * 0.034,
      -l - 0.041,
      W * 0.61,
      0.012,
      0.014,
      0x798486,
    );
  b.box(
    0,
    bump + 0.035,
    -l + 0.075,
    W * 0.86,
    0.087,
    0.17,
    classic ? chrome : 0x343e41,
  );
  for (let s of [-1, 1]) {
    b.box(
      s * w * 0.68,
      H * 0.725,
      -l + 0.038,
      W * 0.212,
      0.144,
      0.11,
      0xd8e4d9,
    );
    b.box(
      s * w * 0.69,
      H * 0.73,
      -l - 0.023,
      W * 0.16,
      0.081,
      0.02,
      0xfff0bf,
      0,
      unlit,
    );
    b.box(s * w * 0.887, H * 0.703, -l + 0.095, 0.115, 0.108, 0.08, 0xe49d53);
  }
  // The Veloce has recessed black louvres and four round rear lamps in a wide satin panel.
  b.box(0, H * 0.72, l - 0.013, W * 0.85, 0.245, 0.089, 0x242c33);
  for (let s of [-1, 1]) {
    if (sports || classic) {
      for (let k = 0; k < 2; k++) {
        b.cyl(
          s * w * (0.54 + k * 0.215),
          H * 0.74,
          l + 0.045,
          0.085,
          0.085,
          0.04,
          0x781f28,
          16,
          Math.PI / 2,
        );
        b.cyl(
          s * w * (0.54 + k * 0.215),
          H * 0.74,
          l + 0.07,
          0.062,
          0.062,
          0.018,
          0xeb4c40,
          16,
          Math.PI / 2,
          0,
          0,
          unlit,
        );
      }
    } else {
      b.box(s * w * 0.68, H * 0.75, l + 0.04, 0.46, 0.17, 0.035, 0x972d36);
      b.box(
        s * w * 0.68,
        H * 0.79,
        l + 0.06,
        0.405,
        0.055,
        0.019,
        0xfd6957,
        0,
        unlit,
      );
    }
    b.cyl(
      s * w * 0.67,
      bump + 0.01,
      l - 0.05,
      0.07,
      0.075,
      0.21,
      chrome,
      12,
      Math.PI / 2,
    );
    b.cyl(
      s * w * 0.67,
      bump + 0.01,
      l + 0.059,
      0.055,
      0.055,
      0.008,
      0x263034,
      12,
      Math.PI / 2,
    );
  }
  b.box(
    0,
    bump + 0.12,
    l - 0.014,
    W * 0.86,
    0.115,
    0.11,
    classic ? chrome : dark,
  );
  plate(b, at, l + 0.052, H * 0.46, 0, variant + 3);
  plate(b, at, -l - 0.044, H * 0.49, Math.PI, variant + 3);
  if (sports) {
    for (let k = 0; k < 6; k++)
      b.box(
        0,
        H * 1.064 + 0.009,
        1.38 + k * 0.083,
        1.37,
        0.033,
        0.043,
        0x26373b,
      );
    for (let s of [-1, 1])
      b.beam(
        [s * 0.71, H * 0.971, -1.21],
        [s * 0.66, H * 0.866, -1.95],
        0.011,
        0.01,
        0x994d42,
        4,
      );
    for (let s of [-1, 1])
      b.box(s * 0.66, H * 1.045 + 0.11, l - 0.29, 0.08, 0.19, 0.2, dark);
    b.box(
      0,
      H * 1.045 + 0.23,
      l - 0.29,
      1.89,
      0.069,
      0.265,
      col,
      0,
      sheen,
      -0.05,
    );
  }
  if (classic) {
    b.box(0, yt + 0.014, 0.13, 1.39, 0.045, 1.14, 0xe1d5b7);
    for (let s of [-1, 1]) {
      b.box(s * 0.87, H * 0.97, 1.66, 0.1, 0.19, 1.19, col, 0, sheen, -0.07);
      b.box(s * 0.87, H * 1.09, 1.7, 0.098, 0.032, 1.14, chrome);
    }
    b.box(0, H * 0.5, -l - 0.02, 1.48, 0.16, 0.075, chrome);
    for (let q = 0; q < 18; q++)
      b.box(-0.65 + q * 0.077, H * 0.5, -l - 0.061, 0.035, 0.133, 0.013, dark);
  }
  if (suv) {
    for (let s of [-1, 1])
      b.box(s * 0.59, yt + 0.072, 0.55, 0.05, 0.085, 1.77, dark);
    for (let j of [-0.09, 1.16])
      b.box(0, yt + 0.105, j, 1.23, 0.055, 0.087, dark);
  }
  if (taxi) {
    b.box(0, yt + 0.13, 0, 0.71, 0.25, 0.34, 0xf5c861);
    at.sign(b, 0, yt + 0.15, 0.18, 0.66, 0.2, "TAXI", "#f5c861", "#24313a");
  }
  if (cop) {
    b.box(0, yt + 0.083, 0, 1.21, 0.075, 0.31, 0x343c44);
    b.box(-0.31, yt + 0.17, 0, 0.53, 0.14, 0.28, 0xf24a43, 0, unlit);
    b.box(0.31, yt + 0.17, 0, 0.53, 0.14, 0.28, 0x4789ff, 0, unlit);
    b.cyl(-0.69, H + 0.44, 1.75, 0.014, 0.027, 0.77, dark, 6);
  }
  let body = b.finish(),
    wh = wheel(R, type);
  return { body, wh, W, L, R, wb, yt };
}
const haloTex = canvasTex(64, 64, (c) => {
  let g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.14, "rgba(255,255,255,.95)");
  g.addColorStop(0.37, "rgba(255,255,255,.29)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
});
export { haloTex };
const beamMat = new T.MeshBasicMaterial({
  map: canvasTex(128, 256, (c, w, h) => {
    let im = c.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let t = y / h,
          k = (2 * (x / w - 0.5)) / (0.95 - 0.72 * t),
          strength =
            Math.exp(-k * k * 2.7) *
            Math.pow(t, 0.75) *
            (0.68 + 0.32 * Math.sin(Math.PI * t));
        let i = (y * w + x) * 4;
        im.data[i] = 255;
        im.data[i + 1] = 234;
        im.data[i + 2] = 187;
        im.data[i + 3] = strength * 80;
      }
    c.putImageData(im, 0, 0);
  }),
  transparent: true,
  depthWrite: false,
  blending: T.AdditiveBlending,
  side: T.DoubleSide,
});
const beamGeom = new T.PlaneGeometry(4.2, 11);
beamGeom.rotateX(-Math.PI / 2);
const contactTex = canvasTex(64, 64, (c) => {
  let g = c.createRadialGradient(32, 32, 3, 32, 32, 32);
  g.addColorStop(0, "rgba(12,22,28,.85)");
  g.addColorStop(0.6, "rgba(12,22,28,.55)");
  g.addColorStop(1, "rgba(12,22,28,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
});
export function contact(w, d) {
  let mesh = new T.Mesh(
    new T.PlaneGeometry(w, d),
    new T.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.075;
  mesh.renderOrder = 1;
  return mesh;
}
export function carObject(at, type, paint, id) {
  let k = type + paint;
  if (!carCache.has(k)) carCache.set(k, createModel(type, paint, at, id));
  let p = carCache.get(k),
    root = new T.Group(),
    body = p.body.clone(),
    wheels = [];
  root.add(body);
  for (let s of [-1, 1])
    for (let axle of [-1, 1]) {
      let pivot = new T.Group(),
        wheel = p.wh.clone();
      pivot.position.set(s * (p.W / 2 - 0.083), p.R, axle * p.wb);
      pivot.add(wheel);
      root.add(pivot);
      wheels.push({ pivot, wheel, front: axle < 0 });
    }
  let db = new Builder();
  db.oval(-0.43, p.yt - 0.32, 0.15, 0.16, 0.17, 0.12, 0xadae99);
  db.oval(-0.43, p.yt - 0.19, 0.12, 0.1, 0.13, 0.095, 0xb58263);
  db.oval(-0.43, p.yt - 0.113, 0.128, 0.106, 0.082, 0.1, 0x36302c);
  let driver = db.finish();
  root.add(driver);
  root.add(contact(p.W * 1.62, p.L * 1.23));
  let beams = new T.Group();
  for (let s of [-1, 1]) {
    let beam = new T.Mesh(beamGeom, beamMat);
    beam.position.set(s * 0.64, 0.105, -p.L / 2 - 5.2);
    beams.add(beam);
  }
  root.add(beams);
  beams.visible = false;
  let flares = [];
  if (type === "police") {
    for (let s of [-1, 1]) {
      let spr = new T.Sprite(
        new T.SpriteMaterial({
          map: haloTex,
          color: s === -1 ? 0xff2922 : 0x286dff,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      spr.position.set(s * 0.36, p.yt + 0.22, 0);
      spr.scale.setScalar(1.35);
      root.add(spr);
      flares.push(spr);
    }
  }
  return {
    root,
    body,
    driver,
    wheels,
    beams,
    flares,
    model: p,
    type,
    name: carNames[type],
    health: 100,
    speed: 0,
    heading: 0,
    steer: 0,
    mode: "parked",
    x: 0,
    z: 0,
    hitCooldown: 0,
    crumple: 0,
    id,
  };
}
