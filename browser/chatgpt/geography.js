import { T, clamp, rng, TAU } from "./mesh.js";
import { shoreline } from "./landscape.js";
const path = [
  [-322, 328],
  [-349, 328],
  [-375, 314],
  [-390, 279],
  [-391, 193],
  [-383, 112],
  [-369, 38],
  [-373, -55],
  [-391, -153],
  [-388, -237],
  [-372, -292],
  [-349, -316],
  [-322, -320],
].map(([x, z]) => new T.Vector3(x, 0, z));
let curve = new T.CatmullRomCurve3(path, false, "catmullrom", 0.45);
export const BYPASS = curve
  .getSpacedPoints(28)
  .map((p, i) => ({
    x: p.x,
    z: p.z,
    y: 0.07 + 4.2 * Math.sin((Math.PI * i) / 28) ** 2,
  }));
export function expressFloor(x, z) {
  if (x > -316 || x < -406 || z > 341 || z < -332) return null;
  let bd = 10000,
    alt = null;
  for (let j = 0; j < BYPASS.length - 1; j++) {
    let a = BYPASS[j],
      b = BYPASS[j + 1],
      dx = b.x - a.x,
      dz = b.z - a.z,
      t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1),
      d = (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2;
    if (d < bd && d < 10.6 ** 2) {
      bd = d;
      alt = a.y + (b.y - a.y) * t;
    }
  }
  return alt;
}
export const mainland = [];
for (let z = -350; z < 357; z += 6) mainland.push([shoreline(z), z]);
mainland.push(
  [150, 358],
  [140, 367],
  [116, 370],
  [90, 365],
  [48, 359],
  [10, 369],
  [-30, 390],
  [-82, 404],
  [-125, 398],
  [-162, 378],
  [-209, 362],
  [-256, 370],
  [-295, 386],
  [-325, 380],
  [-347, 359],
);
for (let z = 355; z >= -351; z -= 8)
  mainland.push([-359 - 7 * Math.sin(z * 0.028) - 4 * Math.cos(z * 0.051), z]);
mainland.push(
  [-350, -368],
  [-326, -374],
  [-300, -362],
  [-275, -354],
  [-220, -361],
  [-183, -372],
  [-156, -381],
  [-127, -371],
  [-76, -354],
  [-35, -355],
  [-8, -363],
  [21, -360],
  [55, -353],
  [94, -366],
  [122, -364],
  [144, -356],
);
function island(cx, cz, rx, rz, seed) {
  let pts = [],
    r = rng(seed);
  for (let j = 0; j < 36; j++) {
    let a = (j * TAU) / 36,
      off =
        1 +
        0.066 * Math.sin(a * 3 + seed) +
        0.047 * Math.sin(a * 7) +
        r() * 0.025;
    pts.push([cx + Math.cos(a) * rx * off, cz + Math.sin(a) * rz * off]);
  }
  return pts;
}
export const northIsland = island(15, -553, 88, 81, 7);
export const islets = [
  island(-131, -430, 37, 13, 4),
  island(-182, -454, 19, 9, 8),
  island(116, -414, 24, 9, 3),
  island(-445, 185, 35, 69, 6),
  island(-426, -101, 17, 42, 5),
  island(-394, -389, 83, 28, 10),
];
export function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    let [xi, zi] = pts[i],
      [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}
export function landShape(b, points, col, y) {
  let s = new T.Shape();
  points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  let g = new T.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  b.add(g, col, undefined, 0, y, 0);
}
export function buildBypass(b, at, nodes, link, extraRoads, road) {
  let roadIds = [63];
  for (let j = 1; j < BYPASS.length - 1; j++) {
    let id = nodes.length,
      p = BYPASS[j];
    nodes.push({ id, x: p.x, z: p.z, links: [] });
    roadIds.push(id);
  }
  roadIds.push(0);
  function edgePoint(j, side, off) {
    let p = BYPASS[j],
      a = BYPASS[Math.max(0, j - 1)],
      d = BYPASS[Math.min(BYPASS.length - 1, j + 1)],
      dx = d.x - a.x,
      dz = d.z - a.z,
      len = Math.hypot(dx, dz);
    return [
      p.x - ((side * dz) / len) * off,
      p.y,
      p.z + ((side * dx) / len) * off,
    ];
  }
  for (let j = 0; j < BYPASS.length - 1; j++) {
    let a = BYPASS[j],
      d = BYPASS[j + 1];
    link(roadIds[j], roadIds[j + 1]);
    extraRoads.push({
      xa: a.x,
      za: a.z,
      xb: d.x,
      zb: d.z,
      width: 20,
      express: true,
    });
    let l = edgePoint(j, -1, 10),
      rr = edgePoint(j, 1, 10),
      ll = edgePoint(j + 1, -1, 10),
      rrr = edgePoint(j + 1, 1, 10);
    b.poly([l, rr, rrr, ll], 0xffffff, road, [
      [0, 0],
      [3, 0],
      [3, 5],
      [0, 5],
    ]);
    for (let side of [-1, 1]) {
      let p = edgePoint(j, side, 9.9),
        q = edgePoint(j + 1, side, 9.9);
      b.poly(
        [p, q, [q[0], q[1] - 0.88, q[2]], [p[0], p[1] - 0.88, p[2]]],
        0xb8b8aa,
        undefined,
      );
      b.beam(
        [p[0], p[1] + 0.55, p[2]],
        [q[0], q[1] + 0.55, q[2]],
        0.235,
        0.235,
        0xc7c5b8,
        4,
      );
      let m = edgePoint(j, side, 0.18),
        n = edgePoint(j + 1, side, 0.18);
      b.beam(
        [m[0], m[1] + 0.042, m[2]],
        [n[0], n[1] + 0.042, n[2]],
        0.07,
        0.07,
        0xd9a754,
        4,
      );
      let e = edgePoint(j, side, 4.9),
        f = edgePoint(j + 1, side, 4.9);
      for (let t of [0.1, 0.48, 0.86]) {
        let z1 = e.map((x, i) => x + (f[i] - x) * t),
          z2 = e.map((x, i) => x + (f[i] - x) * Math.min(1, t + 0.13));
        z1[1] += 0.04;
        z2[1] += 0.04;
        b.beam(z1, z2, 0.069, 0.069, 0xe8dfc3, 4);
      }
    }
    if (j % 2 === 0 && a.y > 0.6) {
      b.cyl(a.x, a.y * 0.4 - 0.15, a.z, 0.71, 0.83, a.y + 1.1, 0xb4b9b1, 10);
      b.box(a.x, a.y - 0.58, a.z, 13.5, 0.88, 1.2, 0xbac1b9);
    }
    if (j === 10 || j === 20) {
      b.cyl(a.x - 10, a.y + 3.9, a.z, 0.14, 0.19, 7.9, 0x8d9995, 8);
      b.box(a.x, a.y + 7.8, a.z, 20.5, 0.25, 0.25, 0x7f9392);
      b.box(a.x, a.y + 6.9, a.z, 9.5, 1.8, 0.23, 0x356e60);
      at.sign(
        b,
        a.x,
        a.y + 6.92,
        a.z + 0.13,
        9.2,
        1.6,
        "GULFWAY  9   ↑",
        "#356e60",
        "#fff4d6",
        0,
        "bold 72px Cond",
        "W E S T E R N    B Y P A S S",
      );
    }
  }
}
