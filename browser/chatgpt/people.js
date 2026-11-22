import {
  T,
  Builder,
  rng,
  TAU,
  canvasTex,
  material,
  solid,
  double,
  clamp,
  mix,
} from "./mesh.js";
import { contact } from "./cars.js";
function tropical() {
  let r = rng(180);
  return canvasTex(
    320,
    320,
    (c, w, h) => {
      c.fillStyle = "#eee1bd";
      c.fillRect(0, 0, w, h);
      for (let j = 0; j < 45; j++) {
        let x = r() * w,
          y = r() * h,
          angle = r() * TAU,
          sc = 0.55 + r() * 0.85;
        for (let ox of [-w, 0, w])
          for (let oy of [-h, 0, h]) {
            c.save();
            c.translate(x + ox, y + oy);
            c.rotate(angle);
            c.scale(sc, sc);
            c.strokeStyle = "#49746a";
            c.lineWidth = 1.3;
            c.beginPath();
            c.moveTo(0, 0);
            c.quadraticCurveTo(8, -9, 5, -27);
            c.stroke();
            for (let k = 0; k < 5; k++) {
              let ty = -k * 4.4,
                tx = Math.sin(k * 0.6) * 3 + 2;
              for (let s of [-1, 1]) {
                c.fillStyle =
                  j % 4 === 0 ? "#9d7953" : j % 3 === 0 ? "#497c70" : "#285b54";
                c.beginPath();
                c.moveTo(tx, ty);
                c.quadraticCurveTo(
                  tx + s * 10,
                  ty - 1,
                  tx + s * (12 - k),
                  ty - 10,
                );
                c.quadraticCurveTo(tx + s * 3, ty - 7, tx, ty);
                c.fill();
              }
            }
            c.restore();
          }
      }
    },
    true,
  );
}
const shirt = material(tropical()),
  denim = material(
    canvasTex(
      64,
      64,
      (c) => {
        c.fillStyle = "#4b5360";
        c.fillRect(0, 0, 64, 64);
        c.strokeStyle = "#acb0a719";
        c.lineWidth = 1;
        for (let i = -64; i < 128; i += 3) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i - 45, 64);
          c.stroke();
        }
      },
      true,
    ),
  );
function loft(b, sections, col, mat = solid, count = 14) {
  let p = [],
    uv = [],
    idx = [];
  for (let j = 0; j < sections.length; j++) {
    let [y, rx, rz, cz = 0, cx = 0] = sections[j];
    for (let k = 0; k <= count; k++) {
      let a = (k * TAU) / count;
      p.push(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz);
      uv.push(k / count, j / (sections.length - 1));
    }
  }
  for (let j = 0; j < sections.length - 1; j++)
    for (let k = 0; k < count; k++) {
      let a = j * (count + 1) + k,
        d = a + count + 1;
      idx.push(a, d, d + 1, a, d + 1, a + 1);
    }
  let g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(g, col, mat);
}
const skins = [
    0xb87b57, 0xd59b72, 0x885c42, 0xe4ae87, 0x9e654c, 0xc88763, 0x754f3f,
  ],
  shirts = [
    0x337d79, 0xde855f, 0xcaca9f, 0x7696ac, 0xab6480, 0xf1c167, 0xcad7ce,
  ],
  pants = [0x39454e, 0x9f8c73, 0x686d78, 0x435469, 0xb5a991];
function finish(b, parent, x = 0, y = 0, z = 0) {
  let o = b.finish();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
const specsCache = new Map();
function craft(variant, hero = false) {
  let r = rng(717 + variant),
    female = !hero && variant % 3 === 1,
    skin = hero ? 0xbb805c : skins[variant % skins.length],
    hair = hero
      ? 0x262324
      : [0x38302b, 0x543b2d, 0x332c2a, 0xa0754e][variant % 4],
    top = hero ? 0xffffff : shirts[variant % 7],
    leg = hero ? 0xffffff : pants[variant % 5],
    sleeve = hero ? shirt : solid,
    jeans = hero ? denim : solid;
  let root = new T.Group(),
    torso = new T.Group();
  root.add(torso);
  let B = new Builder(),
    waist = female ? 0.151 : 0.165,
    shoulder = female ? 0.192 : 0.231;
  loft(
    B,
    [
      [0.855, waist + 0.015, 0.112, 0.007],
      [0.903, waist + 0.036, 0.134, 0.003],
      [1.03, waist + 0.007, 0.125],
      [1.18, waist + 0.023, 0.142, -0.004],
      [1.33, shoulder, 0.146, -0.005],
      [1.405, shoulder * 0.94, 0.111],
      [1.437, 0.111, 0.078],
    ],
    top,
    sleeve,
    18,
  );
  loft(
    B,
    [
      [0.811, 0.162, 0.114],
      [0.875, 0.18, 0.127],
      [0.906, 0.161, 0.112],
    ],
    leg,
    jeans,
  );
  B.cyl(0, 0.893, 0, 0.174, 0.176, 0.043, 0x3f3730, 14);
  B.box(0, 0.898, -0.127, 0.052, 0.039, 0.021, 0xac9c77);
  if (hero) {
    B.poly(
      [
        [-0.066, 1.432, -0.068],
        [0.067, 1.432, -0.068],
        [0.028, 1.213, -0.147],
        [-0.025, 1.213, -0.147],
      ],
      0xe9e7d7,
      double,
    );
    for (let d of [-1, 1]) {
      B.poly(
        [
          [d * 0.066, 1.442, -0.063],
          [d * 0.135, 1.394, -0.103],
          [d * 0.085, 1.3, -0.152],
          [d * 0.027, 1.37, -0.113],
        ],
        0xc4c5a8,
        double,
      );
      B.beam(
        [d * 0.065, 1.425, -0.082],
        [d * 0.037, 1.366, -0.121],
        0.006,
        0.006,
        0xd8ad59,
        5,
      );
    }
    B.beam(
      [-0.037, 1.366, -0.121],
      [0.037, 1.366, -0.121],
      0.006,
      0.006,
      0xd8ad59,
      5,
    );
    for (let j = 0; j < 4; j++)
      B.oval(0, 0.986 + j * 0.087, -0.14, 0.01, 0.01, 0.005, 0xcfba99);
  }
  B.cyl(0, 1.456, 0.008, 0.071, 0.084, 0.137, skin, 12);
  let headY = 1.63;
  loft(
    B,
    [
      [1.485, 0.044, 0.058, -0.022],
      [1.508, 0.08, 0.08, -0.024],
      [1.545, 0.105, 0.098, -0.017],
      [1.605, 0.12, 0.108, -0.008],
      [1.687, 0.12, 0.111],
      [1.737, 0.11, 0.099, 0.006],
      [1.785, 0.068, 0.067, 0.011],
      [1.8, 0.004, 0.008],
    ],
    skin,
    solid,
    18,
  );
  for (let d of [-1, 1]) {
    B.oval(d * 0.118, headY, 0.004, 0.027, 0.043, 0.022, skin);
    B.oval(d * 0.045, 1.653, -0.106, 0.031, 0.016, 0.01, 0xf3dec8);
    B.oval(d * 0.046, 1.653, -0.116, 0.009, 0.011, 0.005, 0x392e29);
    B.box(
      d * 0.047,
      1.677,
      -0.104,
      0.068,
      0.012,
      0.017,
      hair,
      0,
      solid,
      0,
      d * 0.08,
    );
  }
  B.oval(0, 1.623, -0.114, 0.023, 0.043, 0.025, skin);
  B.oval(0, 1.604, -0.131, 0.027, 0.017, 0.023, skin);
  B.box(0, 1.561, -0.108, 0.061, 0.009, 0.009, 0x875447);
  if (hero || variant % 4 === 0) {
    for (let d of [-1, 1]) {
      B.oval(
        d * 0.051,
        1.65,
        -0.112,
        0.052,
        0.035,
        0.014,
        0x253039,
        0,
        0,
        d * 0.075,
      );
      B.box(d * 0.105, 1.657, -0.044, 0.014, 0.012, 0.135, 0x342c27);
    }
    B.box(0, 1.66, -0.121, 0.035, 0.009, 0.009, 0x9b895d);
  }
  B.oval(0, 1.736, 0.009, 0.123, 0.084, 0.119, hair);
  B.oval(0, 1.671, 0.053, 0.122, 0.095, 0.076, hair);
  for (let d of [-1, 1])
    B.oval(d * 0.107, 1.681, -0.001, 0.021, 0.061, 0.069, hair);
  if (hero || variant % 4 === 1) {
    for (let j = 0; j < (hero ? 42 : 21); j++) {
      let a = j * 2.39996,
        st = r(),
        ra = Math.sqrt(1 - st * st);
      B.oval(
        Math.cos(a) * 0.103 * ra,
        1.735 + st * 0.064,
        0.001 + Math.sin(a) * 0.098 * ra,
        0.037 + r() * 0.013,
        0.029 + r() * 0.021,
        0.039,
        j % 4 === 0 ? 0x352c27 : hair,
      );
    }
  }
  if (female) {
    B.oval(0, 1.6, 0.085, 0.13, 0.16, 0.091, hair);
    B.oval(0, 1.7, 0.14, 0.089, 0.09, 0.082, hair);
    for (let s of [-1, 1])
      B.oval(s * 0.124, 1.594, 0, 0.016, 0.024, 0.012, 0xe4be66);
  }
  finish(B, torso);
  let arms = [],
    legs = [];
  for (let s of [-1, 1]) {
    let upper = new T.Group();
    upper.position.set(s * (shoulder - 0.006), 1.366, 0.008);
    torso.add(upper);
    let b = new Builder();
    loft(
      b,
      [
        [-0.294, 0.052, 0.053],
        [-0.223, 0.061, 0.064],
        [-0.106, 0.073, 0.081],
        [-0.006, 0.068, 0.071],
        [0.026, 0.033, 0.043],
      ],
      skin,
    );
    if (!female || hero)
      loft(
        b,
        [
          [-0.167, 0.079, 0.086],
          [-0.131, 0.081, 0.091],
          [-0.018, 0.089, 0.096],
          [0.043, 0.057, 0.065],
        ],
        top,
        sleeve,
      );
    finish(b, upper);
    let fore = new T.Group();
    fore.position.y = -0.273;
    upper.add(fore);
    b = new Builder();
    loft(
      b,
      [
        [-0.223, 0.039, 0.038],
        [-0.171, 0.044, 0.046],
        [-0.1, 0.055, 0.057],
        [-0.01, 0.052, 0.052],
        [0.012, 0.044, 0.045],
      ],
      skin,
    );
    b.oval(0, -0.268, -0.003, 0.043, 0.071, 0.032, skin, 0.12);
    b.oval(-s * 0.035, -0.248, -0.014, 0.019, 0.04, 0.021, skin, -0.25);
    if (hero && s === -1) {
      b.cyl(0, -0.194, 0, 0.044, 0.046, 0.034, 0xb99f60, 10);
      b.box(-0.04, -0.193, 0, 0.02, 0.042, 0.035, 0x43473e);
    }
    finish(b, fore);
    arms.push({ upper, fore, s });
    let hip = new T.Group();
    hip.position.set(s * 0.094, 0.878, 0.009);
    root.add(hip);
    b = new Builder();
    loft(
      b,
      [
        [-0.418, 0.071, 0.076],
        [-0.354, 0.078, 0.078],
        [-0.188, 0.086, 0.1, -0.008],
        [-0.035, 0.099, 0.117],
        [0.03, 0.077, 0.099],
      ],
      leg,
      jeans,
    );
    if (hero) {
      b.poly(
        [
          [-0.066, -0.066, 0.093],
          [0.066, -0.066, 0.093],
          [0.048, -0.18, 0.091],
          [0, -0.198, 0.096],
          [-0.052, -0.179, 0.09],
        ],
        0x535b67,
        double,
      );
      b.beam(
        [-0.055, -0.076, 0.102],
        [0.055, -0.076, 0.102],
        0.003,
        0.003,
        0xac9172,
        4,
      );
    }
    finish(b, hip);
    let knee = new T.Group();
    knee.position.y = -0.398;
    hip.add(knee);
    b = new Builder();
    loft(
      b,
      [
        [-0.405, 0.059, 0.063],
        [-0.36, 0.063, 0.07],
        [-0.219, 0.07, 0.079, 0.011],
        [-0.116, 0.077, 0.082, 0.012],
        [-0.02, 0.072, 0.076],
        [0.025, 0.062, 0.068],
      ],
      leg,
      jeans,
    );
    let sc = hero ? 0xefedda : variant % 3 === 0 ? 0xc6b99f : 0x48474b;
    b.oval(0, -0.385, -0.045, 0.076, 0.064, 0.148, sc);
    b.box(0, -0.424, -0.052, 0.146, 0.033, 0.263, 0xddd5c0);
    b.oval(0, -0.359, -0.104, 0.064, 0.025, 0.07, sc);
    if (hero)
      for (let j = 0; j < 3; j++)
        b.box(
          0,
          -0.338 - j * 0.004,
          -0.082 - j * 0.024,
          0.087,
          0.008,
          0.011,
          0xc6c2ab,
        );
    finish(b, knee);
    legs.push({ hip, knee, s });
  }
  return { root, torso, arms, legs };
}
function makeGun(type) {
  let b = new Builder();
  if (type === 1) {
    b.box(0, -0.258, -0.079, 0.048, 0.058, 0.196, 0x39434b);
    b.box(0, -0.246, -0.096, 0.052, 0.026, 0.188, 0x697175);
    b.box(0, -0.303, -0.009, 0.046, 0.102, 0.061, 0x282e32, 0, solid, 0.2);
  } else {
    b.box(0, -0.266, -0.14, 0.067, 0.09, 0.34, 0x3d494d);
    b.box(0, -0.273, -0.36, 0.062, 0.068, 0.21, 0x455254);
    b.cyl(0, -0.268, -0.516, 0.019, 0.019, 0.2, 0x262e32, 8, Math.PI / 2);
    b.box(0, -0.331, -0.122, 0.051, 0.11, 0.067, 0x384347, 0, solid, -0.15);
    b.box(0, -0.266, 0.11, 0.062, 0.078, 0.23, 0x4c564f);
    b.box(0, -0.225, -0.116, 0.033, 0.024, 0.09, 0x262e31);
  }
  return b.finish();
}
export function personObject(variant, hero = false) {
  let p = craft(variant, hero);
  p.root.add(contact(0.95, 0.78));
  p.phase = variant * 0.93;
  p.heading = 0;
  p.weapon = 0;
  if (hero) {
    p.guns = [null, makeGun(1), makeGun(2)];
    for (let g of p.guns.slice(1)) {
      p.arms[1].fore.add(g);
      g.visible = false;
    }
  }
  return p;
}
export function pose(p, dt, speed, mode = "idle", action = 0) {
  let mv = clamp(speed / 3, 0, 1),
    run = speed > 4.1,
    rate = run ? 10.9 : 7.3;
  p.phase += dt * (mv > 0.015 ? rate * (0.6 + 0.4 * mv) : 1.7);
  let t = p.phase;
  p.torso.position.y =
    mv * Math.abs(Math.cos(t)) * (run ? 0.049 : 0.023) +
    (!mv ? Math.sin(t) * 0.005 : 0);
  p.torso.rotation.x = run ? -0.082 : 0;
  p.torso.rotation.y = Math.sin(t) * mv * 0.066;
  for (let i = 0; i < 2; i++) {
    let { hip, knee } = p.legs[i],
      { upper, fore, s } = p.arms[i],
      stride = Math.sin(t + i * Math.PI);
    hip.rotation.x = stride * mv * (run ? 0.88 : 0.55);
    knee.rotation.x = -Math.max(0, stride) * mv * (run ? 1.45 : 0.72);
    upper.rotation.x = -stride * mv * (run ? 0.7 : 0.44) + 0.03;
    upper.rotation.z = s * (0.085 + 0.06 * mv);
    fore.rotation.x = 0.13 + (run ? 0.79 : 0.12) * mv;
    if (mode === "air") {
      hip.rotation.x = i ? 0.63 : -0.37;
      knee.rotation.x = -0.67;
      upper.rotation.z = s * 0.51;
    }
    if (mode === "aim" && p.weapon > 0) {
      upper.rotation.x = i ? 1.19 : 0.83;
      upper.rotation.z = i ? -0.075 : 0.31;
      fore.rotation.x = i ? 0.32 : 0.78;
      if (i === 0) upper.rotation.y = -0.58;
    } else upper.rotation.y = 0;
    if (mode === "punch" && i === 1) {
      upper.rotation.x = 0.36 + Math.sin(action * Math.PI) * 1.25;
      fore.rotation.x = 0.68 - Math.sin(action * Math.PI) * 0.48;
      p.torso.rotation.y = -Math.sin(action * Math.PI) * 0.39;
    }
  }
  if (p.guns)
    for (let j = 1; j <= 2; j++) {
      let g = p.guns[j];
      g.visible = j === p.weapon;
      g.rotation.x = mode === "aim" ? -1.45 : -0.27;
    }
}
