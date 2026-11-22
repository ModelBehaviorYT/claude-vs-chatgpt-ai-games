import {
  expressFloor,
  mainland,
  northIsland,
  islets,
  inPoly,
  landShape,
  buildBypass,
} from "./geography.js";
import { plantPalms } from "./palms.js";
import {
  T,
  Builder,
  SignAtlas,
  canvasTex,
  material,
  texturedNoise,
  rng,
  TAU,
  clamp,
  mix,
  solid,
  unlit,
  double,
} from "./mesh.js";
import {
  makeFacades,
  shopWindows,
  hotel,
  tower,
  lowrise,
  house,
  nightMats,
} from "./architecture.js";
import {
  skySea,
  shoreline,
  bench,
  parasol,
  cafeSet,
  lifeguard,
  yacht,
} from "./landscape.js";
export const XS = [-322, -252, -182, -112, -42, 18, 76],
  ZS = [-320, -248, -176, -104, -32, 40, 112, 184, 256, 328];
export const SPAWN = { x: 86.3, z: 87.6 },
  HOSPITAL = { x: -52, z: 54 },
  SHOP = { x: 64, z: 119 },
  GARAGE = { x: -103, z: 193 };
export const STREETX = [
  "Mangrove Way",
  "Gulfway 9",
  "Mercado Street",
  "Civic Avenue",
  "Cypress Avenue",
  "Coral Street",
  "Marina Mile",
];
export const STREETZ = [
  "North Quay",
  "Pelican Way",
  "Mirador Boulevard",
  "Belvedere Street",
  "Marlin Street",
  "Camellia Avenue",
  "Seabird Avenue",
  "Saffron Street",
  "Alameda Drive",
  "South Strand",
];
export function locationAt(x, z) {
  if (x < -340 && expressFloor(x, z) !== null)
    return ["Gulfway 9", "Western Bypass"];
  if (z < -342) return ["Northpoint", "Meridian Causeway"];
  if (x > 108) return ["Paloma Beach", "Oceanfront"];
  let i = XS.reduce(
      (a, b, j) => (Math.abs(b - x) < Math.abs(XS[a] - x) ? j : a),
      0,
    ),
    j = ZS.reduce(
      (a, b, k) => (Math.abs(b - z) < Math.abs(ZS[a] - z) ? k : a),
      0,
    ),
    street =
      Math.abs(x - XS[i]) < Math.abs(z - ZS[j]) ? STREETX[i] : STREETZ[j];
  return [
    x > 15
      ? "Marina District"
      : x < -235
        ? "West Palms"
        : z > 118
          ? "Little Sol"
          : z < -167
            ? "Portside"
            : "Civic Center",
    street,
  ];
}
export const roadW = (x) =>
  x === -252 ? 22 : x === 76 ? 18 : x === -112 ? 16 : 13;
const clamp01 = (n) => clamp(n, 0, 1);
export function floorAt(x, z) {
  if (x < -316) {
    let lift = expressFloor(x, z);
    if (lift !== null) return lift;
  }
  if (z < -321 && z > -509 && Math.abs(x - 18) < 9.9) {
    let t = (-321 - z) / 188;
    return 4.1 * Math.sin(t * Math.PI) ** 2 + 0.075;
  }
  if (z < -476 && z > -642 && x > -88 && x < 116 && inPoly(x, z, northIsland))
    return 0;
  if (z < -350 || z > 359 || x < -353) return inPoly(x, z, mainland) ? 0 : -1;
  if (x > shoreline(z) + 0.6) return -1;
  return 0;
}
export function createCity(scene) {
  let r = rng(271771),
    atlas = new SignAtlas(),
    fac = makeFacades();
  shopWindows();
  let weather = skySea(scene);
  let chunks = new Map(),
    solids = [],
    lookup = new Map(),
    palms = [],
    shrubs = [],
    lamps = [],
    lightPoles = [],
    lightBulbs = [],
    signals = [],
    mapBlocks = [],
    mapParks = [],
    nodes = [],
    edges = [],
    extraRoads = [];
  const tile = (x, z) => {
    let key = Math.floor((x + 40) / 116) + "," + Math.floor((z + 37) / 120);
    if (!chunks.has(key)) chunks.set(key, new Builder());
    return chunks.get(key);
  };
  const collider = (x, z, w, d, type = "building") => {
    let o = { x, z, w: w / 2, d: d / 2, type };
    solids.push(o);
    for (
      let xi = Math.floor((x - o.w) / 20);
      xi <= Math.floor((x + o.w) / 20);
      xi++
    )
      for (
        let zi = Math.floor((z - o.d) / 20);
        zi <= Math.floor((z + o.d) / 20);
        zi++
      ) {
        let key = xi + "," + zi;
        if (!lookup.has(key)) lookup.set(key, []);
        lookup.get(key).push(o);
      }
    return o;
  };
  const hit = (x, z, rad = 0.33) => {
    for (
      let xi = Math.floor((x - rad) / 20);
      xi <= Math.floor((x + rad) / 20);
      xi++
    )
      for (
        let zi = Math.floor((z - rad) / 20);
        zi <= Math.floor((z + rad) / 20);
        zi++
      ) {
        for (let o of lookup.get(xi + "," + zi) || []) {
          let dx = Math.max(0, Math.abs(x - o.x) - o.w),
            dz = Math.max(0, Math.abs(z - o.z) - o.d);
          if (dx * dx + dz * dz < rad * rad) return o;
        }
      }
    return null;
  };
  const addPalm = (x, z, s = 1) => {
    palms.push({ x, z, s, a: r() * TAU });
    collider(x, z, 0.34 * s, 0.34 * s, "tree");
  };
  const bush = (x, z, w, d, h = 0.85) =>
    shrubs.push({
      x,
      z,
      w,
      d,
      h,
      y: h * 0.63,
      a: r() * 3,
      c: [0x598948, 0x708a43, 0x477f51, 0x658d4d][Math.floor(r() * 4)],
    });
  const grass = material(texturedNoise("#9faa77", 16)),
    road = material(texturedNoise("#626669", 32, "asphalt")),
    walk = material(texturedNoise("#d5cec0", 17, "concrete")),
    sand = material(texturedNoise("#e8d2a2", 21, "sand"));
  const grd = (b, x, z, w, d, mat, y, col = 0xffffff, scale = 5) =>
    b.quad(x, y, z, w, d, col, 0, -Math.PI / 2, mat, [
      x / scale,
      z / scale,
      w / scale,
      d / scale,
    ]);
  const strip = (b, x, z, w, d, c, y = 0.052) =>
    b.quad(x, y, z, w, d, c, 0, -Math.PI / 2);
  // A continuous shoreline and the shallows keep the coastline visible from the city grid.
  let land = tile(-110, 0);
  landShape(land, mainland, 0xb1ad84, -0.105);
  landShape(tile(10, -551), northIsland, 0xc8bb91, -0.095);
  for (let poly of islets) {
    let cx = poly.reduce((n, v) => n + v[0], 0) / poly.length,
      cz = poly.reduce((n, v) => n + v[1], 0) / poly.length;
    landShape(tile(cx, cz), poly, 0xc3b48a, -0.09);
    for (let j = 0; j < 19; j++) {
      let v = poly[Math.floor(r() * poly.length)],
        q = 0.16 + r() * 0.63;
      bush(
        mix(cx, v[0], q),
        mix(cz, v[1], q),
        2 + r() * 3,
        2 + r() * 3,
        1.4 + r() * 2,
      );
    }
  }
  grd(land, -112, 3, 482, 710, grass, -0.045, 0xffffff, 8);
  for (let z = -351; z < 358; z += 8) {
    let bb = tile(119, z),
      p = shoreline(z),
      q = shoreline(z + 8);
    bb.poly(
      [
        [105, -0.025, z],
        [105, -0.025, z + 8],
        [q, 0.005, z + 8],
        [p, 0.005, z],
      ],
      0xffffff,
      sand,
      [
        [0, z / 7],
        [0, (z + 8) / 7],
        [(q - 105) / 7, (z + 8) / 7],
        [(p - 105) / 7, z / 7],
      ],
    );
    bb.poly(
      [
        [p, 0.005, z],
        [q, 0.005, z + 8],
        [q + 3, -0.52, z + 8],
        [p + 3, -0.52, z],
      ],
      0xe3c99e,
      double,
    );
  }
  let island = tile(15, -550);
  grd(island, 15, -555, 140, 131, sand, -0.05, 0xffffff, 7);
  grd(island, 15, -553, 126, 116, grass, -0.02, 0xffffff, 7);
  // Road surface, centerlines and sidewalks are laid per segment, with openings at every junction.
  for (let i = 0; i < XS.length; i++) {
    let x = XS[i],
      ww = roadW(x);
    for (let j = 0; j < ZS.length - 1; j++) {
      let z = (ZS[j] + ZS[j + 1]) / 2,
        len = ZS[j + 1] - ZS[j],
        b = tile(x, z);
      grd(b, x, z, ww, len, road, 0.009, 0xffffff, 5);
      for (let s of [-1, 1]) {
        strip(b, x + s * 0.16, z, 0.11, len - 15, 0xeab858);
        strip(b, x + s * (ww / 2 - 0.72), z, 0.1, len - 15, 0xdddcc8);
        if (ww >= 16) {
          for (let k = -23; k <= 25; k += 10)
            strip(b, x + s * ww * 0.263, z + k, 0.13, 4.2, 0xf5edd7);
        }
      }
      if (x === 76) {
        for (let k = -22; k < 26; k += 8) {
          strip(b, x + ww / 2 - 1.08, z + k, 0.7, 0.09, 0xefdebf);
          strip(b, x - ww / 2 + 1.08, z + k, 0.7, 0.09, 0xefdebf);
        }
      } else if (x === -252) {
        strip(b, x, z, 1.15, len - 22, 0xc2bda4, 0.065);
        for (let s of [-1, 1])
          strip(b, x + s * 0.69, z, 0.12, len - 22, 0xf1c465, 0.067);
      }
    }
  }
  for (let j = 0; j < ZS.length; j++) {
    let z = ZS[j];
    for (let i = 0; i < XS.length - 1; i++) {
      let x = (XS[i] + XS[i + 1]) / 2,
        len = XS[i + 1] - XS[i],
        b = tile(x, z);
      grd(b, x, z, len, 13, road, 0.012, 0xffffff, 5);
      for (let s of [-1, 1]) {
        strip(
          b,
          x + (roadW(XS[i]) - roadW(XS[i + 1])) * 0.25,
          z + s * 0.14,
          len - (roadW(XS[i]) + roadW(XS[i + 1])) * 0.5 - 2,
          0.095,
          0xe9bd64,
        );
        strip(b, x, z + s * 5.9, len - 20, 0.09, 0xe3e0cd);
      }
    }
  }
  function lamp(b, x, z, ang) {
    b.at(x, 0, z, ang, () => {
      b.cyl(0, 0.32, 0, 0.15, 0.24, 0.64, 0x4a6667, 8);
      b.cyl(0, 3.63, 0, 0.068, 0.12, 6.7, 0x738b89, 8);
      b.beam([0, 6.86, 0], [0.66, 7.52, 0], 0.082, 0.065, 0x718889);
      b.beam([0.66, 7.52, 0], [2.1, 7.58, 0], 0.065, 0.045, 0x718889);
      b.oval(2.17, 7.55, 0, 0.53, 0.14, 0.22, 0x526970);
      b.oval(2.18, 7.49, 0, 0.43, 0.09, 0.18, 0xffe6b0, 0, 0, 0, unlit);
    });
    lamps.push({
      x: x + Math.cos(ang) * 2.17,
      z: z - Math.sin(ang) * 2.17,
      y: 7.4,
    });
  }
  function signal(b, x, z, rot, axis, id) {
    b.at(x, 0, z, rot, () => {
      b.cyl(0, 2.8, 0, 0.09, 0.16, 5.6, 0x617782);
      b.beam([0, 5.5, 0], [0.87, 6, 0], 0.1, 0.082, 0x667d83);
      b.box(2.9, 6.03, 0, 4.1, 0.14, 0.14, 0x667d83);
      b.box(4.79, 5.26, 0, 0.47, 1.28, 0.38, 0xd99e48);
      b.box(4.79, 5.26, 0.21, 0.41, 1.2, 0.09, 0x353e41);
      for (let i = 0; i < 3; i++) {
        b.oval(4.79, 5.65 - i * 0.38, 0.268, 0.148, 0.146, 0.04, 0x384947);
        b.box(4.79, 5.8 - i * 0.38, 0.3, 0.37, 0.045, 0.2, 0x26383a);
      }
      atlas.sign(
        b,
        1.81,
        5.66,
        0.1,
        2.85,
        0.46,
        axis ? "MARINA MILE" : "PORT AZURE",
        "#267b6d",
        "#ffefd8",
        0,
        "bold 65px Cond",
      );
    });
    for (let i = 0; i < 3; i++) {
      let ox = 4.79,
        oz = 0.32;
      lightBulbs.push({
        x: x + Math.cos(rot) * ox + Math.sin(rot) * oz,
        y: 5.65 - i * 0.38,
        z: z - Math.sin(rot) * ox + Math.cos(rot) * oz,
        rot,
        axis,
        id,
        i,
      });
    }
  }
  function bin(b, x, z) {
    b.cyl(x, 0.53, z, 0.315, 0.27, 1.03, 0x46686a, 10);
    b.cyl(x, 1.06, z, 0.337, 0.337, 0.12, 0x284c4e, 10);
    b.cyl(x, 1.13, z, 0.2, 0.22, 0.03, 0x193b3d, 10);
  }
  function hydrant(b, x, z) {
    b.cyl(x, 0.36, z, 0.14, 0.17, 0.72, 0xd46c45);
    b.oval(x, 0.76, z, 0.17, 0.15, 0.17, 0xe08148);
    b.cyl(x, 0.45, z, 0.109, 0.109, 0.56, 0xc9633f, 8, 0, 0, Math.PI / 2);
  }
  function grate(b, x, z, rot) {
    b.at(x, 0, z, rot, () => {
      b.box(0, 0.058, 0, 0.61, 0.03, 1.04, 0x434e4f);
      for (let k = 0; k < 5; k++)
        b.box(0, 0.079, -0.37 + k * 0.18, 0.46, 0.01, 0.065, 0x283a3c);
    });
  }
  for (let i = 0; i < XS.length; i++)
    for (let j = 0; j < ZS.length; j++) {
      let x = XS[i],
        z = ZS[j],
        ww = roadW(x),
        b = tile(x, z),
        id = j * 7 + i;
      nodes[id] = { id, x, z, links: [] };
      grd(b, x, z, ww + 1, 14.2, road, 0.025, 0xffffff, 5);
      for (let s of [-1, 1]) {
        if ((s < 0 && j > 0) || (s > 0 && j < ZS.length - 1)) {
          for (let k = -ww / 2 + 1; k < ww / 2 - 0.6; k += 1.2)
            strip(b, x + k, z + s * 8.25, 0.64, 2, 0xeadfc9, 0.07);
          strip(
            b,
            x + s * ww * 0.25,
            z + s * 10.5,
            ww * 0.45,
            0.27,
            0xf1e8d2,
            0.065,
          );
        }
        if ((s < 0 && i > 0) || (s > 0 && i < XS.length - 1)) {
          for (let k = -5.7; k < 6; k += 1.2)
            strip(b, x + s * (ww / 2 + 1.6), z + k, 2, 0.59, 0xeadfc9, 0.069);
          strip(
            b,
            x + s * (ww / 2 + 3.85),
            z - s * 3,
            0.27,
            5.6,
            0xf1e8d2,
            0.068,
          );
        }
      }
      if ((i + j) % 2 === 0 || i === 6 || i === 1) {
        signal(b, x - ww / 2 - 0.6, z + 7.1, 0, 0, id);
        signal(b, x + ww / 2 + 1, z - 7.7, Math.PI * 0.5, 1, id);
        signals.push(id);
      } else lamp(b, x + ww / 2 + 0.6, z + 7.2, Math.PI);
      if (i === 6 || i === 3) {
        hydrant(b, x - ww / 2 - 1.1, z + 11.8);
        grate(b, x - ww / 2 + 0.49, z + 12.5, 0);
        bin(b, x + ww / 2 + 1.5, z + 12);
      }
    }
  const link = (a, b) => {
    nodes[a].links.push(b);
    nodes[b].links.push(a);
    edges.push([a, b]);
  };
  for (let j = 0; j < ZS.length; j++)
    for (let i = 0; i < XS.length; i++) {
      let id = j * XS.length + i;
      if (i < XS.length - 1) link(id, id + 1);
      if (j < ZS.length - 1) link(id, id + XS.length);
    }
  function sideBlock(x, z, w, d) {
    let b = tile(x, z);
    b.box(x, 0.015, z, w, 0.29, d, 0xb7b3a9);
    grd(b, x, z, w - 0.12, d - 0.12, walk, 0.165, 0xffffff, 5);
  }
  function addBuilding(x, z, w, d, angle, kind, id, h = 0) {
    let b = tile(x, z),
      wx = Math.abs(Math.cos(angle)) > 0.8 ? w : d,
      dz = Math.abs(Math.cos(angle)) > 0.8 ? d : w;
    collider(x, z, wx, dz);
    mapBlocks.push({ x, z, w: wx, d: dz, h, kind });
    if (kind === "hotel") hotel(b, atlas, fac, x, z, w, d, id, angle);
    if (kind === "tower") tower(b, atlas, fac, x, z, w, d, h, id, angle);
    if (kind === "shop") lowrise(b, atlas, fac, x, z, w, d, id, angle);
    if (kind === "house") house(b, x, z, w, d, id, angle);
  }
  for (let i = 0; i < XS.length - 1; i++)
    for (let j = 0; j < ZS.length - 1; j++) {
      let x1 = XS[i] + roadW(XS[i]) / 2,
        x2 = XS[i + 1] - roadW(XS[i + 1]) / 2,
        z1 = ZS[j] + 6.5,
        z2 = ZS[j + 1] - 6.5,
        x = (x1 + x2) / 2,
        z = (z1 + z2) / 2,
        w = x2 - x1,
        d = z2 - z1,
        id = i + 7 * j,
        b = tile(x, z);
      sideBlock(x, z, w, d);
      if (i === 5) {
        let hw = d * 0.67,
          hd = Math.min(w - 11, 24),
          hx = x2 - 5 - hd / 2,
          hz = z - 5;
        addBuilding(hx, hz, hw, hd, Math.PI / 2, "hotel", j);
        let backX = x1 + 6.75;
        addBuilding(backX, z - 12, 18, 10, -Math.PI / 2, "shop", id + 5);
        addBuilding(backX, z + 12, 17, 10, -Math.PI / 2, "shop", id + 17);
        let smallZ = z2 - 5.3;
        addBuilding(
          x + 1,
          smallZ,
          Math.min(27, w - 10),
          7.2,
          0,
          "shop",
          id + 2,
        );
        for (let k of [-1, 1]) {
          let pz = z + k * 17;
          addPalm(x2 - 1.55, pz, 0.82 + r() * 0.18);
          b.cyl(x2 - 1.55, 0.19, pz, 1.15, 1.15, 0.08, 0x9b947c, 16);
        }
        cafeSet(b, x2 - 2.3, z + 2, 0x41968b);
        cafeSet(b, x2 - 2.3, z - 5, 0xd87856);
        lamp(b, x2 - 0.75, z - 22, 0);
        bench(b, x2 - 1.5, z + 10, Math.PI / 2);
        bin(b, x2 - 1.4, z + 14);
        continue;
      }
      if ((i === 3 && j === 5) || (i === 4 && j === 2)) {
        // civic plaza with a fountain and shade trees
        let pw = w - 9,
          pd = d - 9;
        grd(b, x, z, pw, pd, grass, 0.18);
        mapParks.push({ x, z, w: pw, d: pd });
        grd(b, x, z, 4.5, pd, walk, 0.19);
        grd(b, x, z, pw, 4.5, walk, 0.19);
        b.cyl(x, 0.36, z, 4.5, 4.6, 0.58, 0xcfc7ac, 32);
        b.cyl(x, 0.67, z, 4.13, 4.13, 0.07, 0x68b2b6, 30);
        b.cyl(x, 1.05, z, 0.45, 0.82, 1.1, 0xebd6ac, 12);
        b.cyl(x, 1.72, z, 1.48, 0.5, 0.55, 0xd7cbb0, 20);
        for (let k = 0; k < 8; k++) {
          let a = (k * Math.PI) / 4;
          addPalm(
            x + Math.cos(a) * pw * 0.36,
            z + Math.sin(a) * pd * 0.38,
            0.96,
          );
          bush(
            x + Math.cos(a) * pw * 0.29,
            z + Math.sin(a) * pd * 0.32,
            1.5,
            1.1,
          );
        }
        for (let k of [-1, 1]) bench(b, x + 4 * k, z + 6, (k * Math.PI) / 2);
        continue;
      }
      if (i === 0 || ((i === 1 || i === 2) && j >= 6)) {
        grd(b, x, z, w - 5, d - 5, grass, 0.18);
        for (let aa of [-1, 1])
          for (let dd of [-1, 1]) {
            let hx = x + aa * w * 0.247,
              hz = z + dd * d * 0.23;
            addBuilding(
              hx,
              hz,
              12 + r() * 4,
              9 + r() * 3,
              dd === 1 ? 0 : Math.PI,
              "house",
              id + Math.round((aa + 1) * 4 + dd + 1),
            );
            addPalm(hx + 8, hz + dd * 4, 0.68 + r() * 0.19);
            bush(hx - 7, hz + dd * 5, 1.4, 1.7);
            grd(b, hx, hz + dd * 9.4, 2.1, 7, walk, 0.19);
          }
      } else {
        let downtown = i >= 2 && i <= 4 && j >= 2 && j <= 6;
        for (let k of [-1, 1]) {
          let ww = w * (0.63 + r() * 0.19),
            dd = d * (0.29 + r() * 0.07),
            zz = z + k * d * 0.235,
            xx = x + (r() - 0.5) * 3;
          let high = downtown
            ? 17 + Math.pow(r(), 1.3) * 54 + (i === 3 && j === 4 ? 26 : 0)
            : 8 + r() * 17;
          if ((i + j + (k + 1)) % 5 === 0 || high < 14)
            addBuilding(
              xx,
              zz,
              ww,
              dd,
              k === 1 ? 0 : Math.PI,
              "shop",
              id * 2 + (k + 1) / 2,
            );
          else
            addBuilding(
              xx,
              zz,
              ww,
              dd,
              k === 1 ? 0 : Math.PI,
              "tower",
              id * 2 + (k + 1) / 2,
              high,
            );
        }
        for (let k of [-1, 1]) {
          addPalm(x2 - 2.15, z + k * 17, 0.9);
          bush(x1 + 2.7, z + k * 12, 1.25, 1.5);
        }
      }
      lamp(b, x1 + 0.8, z + 14, Math.PI);
      if (i === 4 || i === 3) {
        bench(b, x2 - 2, z, Math.PI / 2);
        bin(b, x2 - 2, z - 4);
      }
    }
  // Upper floors of two waterfront condominiums rise behind the historic hotel frontage.
  for (let [x, z, height, wid, dep, id] of [
    [32.8, -68, 53, 15, 19, 109],
    [33.0, 15.5, 38, 14.2, 17, 103],
    [-21, -129, 76, 20, 20, 112],
  ]) {
    let b = tile(x, z);
    b.at(x, 6, z, 0, () => tower(b, atlas, fac, 0, 0, wid, dep, height, id));
    collider(x, z, wid, dep);
    mapBlocks.push({ x, z, w: wid, d: dep, h: height, kind: "tower" });
  }
  // Beach promenade, dune plants, painted rescue towers and a working marina.
  for (let j = 0; j < ZS.length - 1; j++) {
    let z = (ZS[j] + ZS[j + 1]) / 2,
      b = tile(96, z);
    sideBlock(92.5, z, 15, 72);
    grd(b, 104, z, 8, 72, grass, 0.023);
    grd(b, 111, z, 4.5, 72, walk, 0.04, 0xffecd1, 6);
    for (let k = 0; k < 4; k++) {
      let pz = z - 26 + k * 17.6;
      addPalm(88.3, pz, 0.94 + r() * 0.32);
      if (k % 2 === 0) {
        addPalm(103 + r() * 3, pz - 4, 0.85 + r() * 0.25);
        bench(b, 94, pz, Math.PI / 2);
        lamp(b, 85.9, pz + 7, Math.PI);
      }
      bush(103 + r() * 4, pz, 1 + r(), 1 + r(), 0.55);
      b.cyl(88.3, 0.18, pz, 1.3, 1.3, 0.06, 0xaf9e83, 16);
    }
    for (let k = 0; k < 5; k++) {
      let xx = 119 + r() * 20,
        zz = z - 29 + r() * 58;
      parasol(
        b,
        xx,
        0,
        zz,
        1.55,
        [0xe2765f, 0x54abb3, 0xf2bb62, 0xc67889, 0x7db6a2][(k + j) % 5],
      );
    }
    if (j % 3 === 1) lifeguard(b, atlas, 131, z, j);
    bin(b, 97, z + 11);
    if (j % 2 === 0) {
      let sz = z + 19;
      b.box(98, 1.05, sz, 0.12, 2.1, 0.12, 0x547e78);
      b.box(98, 2.1, sz, 2.2, 1.1, 0.14, 0x397c7a);
      atlas.sign(
        b,
        98,
        2.1,
        sz + 0.08,
        2.1,
        1,
        "BEACH ACCESS",
        "#397c7a",
        "#fff0cf",
        0,
        "bold 58px Cond",
        "P O R T   A Z U R E",
      );
    }
  }
  // Pier planks, railings and moored boats.
  let pier = tile(153, -135);
  grd(pier, 142, -134, 73, 5, walk, 0.52, 0xb99470);
  for (let x = 110; x < 179; x += 2.5) {
    for (let s of [-1, 1]) {
      pier.cyl(x, 0.55, -134 + s * 2.35, 0.105, 0.13, 2.7, 0xa38b69);
      pier.box(x + 1.25, 1.74, -134 + s * 2.35, 2.55, 0.1, 0.1, 0xaf9c7c);
    }
    pier.box(x, 0.54, -134, 0.05, 0.025, 4.9, 0x8d795f);
  }
  yacht(pier, 172, -126, -0.8, 1.25);
  yacht(pier, 160, -142, 1.49, 0.9);
  for (let j = 0; j < 10; j++)
    yacht(
      tile(180, 0),
      172 + r() * 96,
      -320 + r() * 685,
      r() * TAU,
      0.68 + r() * 0.7,
    );
  // The highway meets a drivable arched cable-stayed causeway leading to Northpoint.
  let bridge = tile(18, -417),
    bz = -321,
    len = 188;
  for (let j = 0; j < 36; j++) {
    let z = bz - (len * (j + 0.5)) / 36,
      zz0 = bz - (len * j) / 36,
      zz1 = bz - (len * (j + 1)) / 36,
      y0 = floorAt(18, zz0 - 0.02),
      y1 = floorAt(18, zz1 + 0.02);
    if (j === 0) y0 = 0.065;
    if (j === 35) y1 = 0.065;
    bridge.poly(
      [
        [8.4, y0, zz0],
        [27.6, y0, zz0],
        [27.6, y1, zz1],
        [8.4, y1, zz1],
      ],
      0xffffff,
      road,
      [
        [0, j],
        [3, j],
        [3, j + 1],
        [0, j + 1],
      ],
    );
    for (let s of [-1, 1]) {
      let xx = 18 + s * 9.48;
      bridge.beam(
        [xx, y0 + 0.62, zz0],
        [xx, y1 + 0.62, zz1],
        0.36,
        0.36,
        0xd1cfc0,
        4,
      );
      bridge.beam(
        [18 + s * 0.15, y0 + 0.04, zz0],
        [18 + s * 0.15, y1 + 0.04, zz1],
        0.065,
        0.065,
        0xf3c468,
        4,
      );
    }
    if (j % 4 === 0) {
      lamp(bridge, 27, z, Math.PI);
      bridge.box(18, (y0 - 1.1) / 2, z, 15, y0 + 1.1, 1.5, 0xa0aaa8);
    }
  }
  for (let zz of [-371, -456]) {
    for (let s of [-1, 1]) {
      let xx = 18 + s * 10.1;
      bridge.beam(
        [xx, -1, zz],
        [18 + s * 6.8, 24, zz],
        0.85,
        0.49,
        0xf2dfc0,
        6,
      );
      for (let j = 1; j < 7; j++)
        for (let dz of [-1, 1]) {
          let ez = zz + dz * j * 4.8;
          bridge.beam(
            [18 + s * 7.1, 22 - j * 0.9, zz],
            [xx, floorAt(18, ez) + 1, ez],
            0.066,
            0.066,
            0xeed7ad,
            4,
          );
        }
    }
    bridge.box(18, 19, zz, 15.6, 0.7, 1.1, 0xddd4b9);
  }
  function extra(a, b, width) {
    let xa = nodes[a].x,
      za = nodes[a].z,
      xb = nodes[b].x,
      zb = nodes[b].z;
    link(a, b);
    extraRoads.push({ xa, za, xb, zb, width });
  }
  let prev = 5;
  for (let [x, z] of [
    [18, -508],
    [18, -577],
    [-27, -577],
    [-27, -517],
  ]) {
    let id = nodes.length;
    nodes.push({ id, x, z, links: [] });
    extra(prev, id, 15);
    prev = id;
  }
  extra(prev, 70, 12);
  for (let e of extraRoads.slice(1)) {
    let w = Math.abs(e.xb - e.xa),
      d = Math.abs(e.zb - e.za);
    grd(
      island,
      (e.xa + e.xb) / 2,
      (e.za + e.zb) / 2,
      w + e.width,
      d + e.width,
      road,
      0.032,
    );
  }
  buildBypass(tile(-375, 0), atlas, nodes, link, extraRoads, road);
  for (let j = 0; j < 4; j++) {
    addBuilding(48, -510 - j * 25, 16, 12, Math.PI / 2, "house", j + 90);
    addPalm(33, -511 - j * 25, 1.1);
  }
  addBuilding(-5, -548, 21, 15, Math.PI / 2, "hotel", 6);
  for (let z of [-194, 20, 225]) {
    let b = tile(-252, z);
    b.cyl(-264, 3.8, z, 0.15, 0.2, 7.6, 0x6f878c);
    b.box(-252, 7.5, z, 24, 0.32, 0.35, 0x8a9b99);
    b.box(-252, 6.6, z, 11.2, 1.84, 0.26, 0x2b725e);
    atlas.sign(
      b,
      -252,
      6.66,
      z + 0.15,
      10.8,
      1.55,
      "NORTH   9   ↑",
      "#2b725e",
      "#fff3d7",
      0,
      "bold 68px Cond",
      "N O R T H P O I N T     /     D O W N T O W N",
    );
  }
  // Landmarks are also visible from the road, before their map markers come into view.
  let hb = tile(HOSPITAL.x, HOSPITAL.z);
  hb.at(HOSPITAL.x, 0, HOSPITAL.z, Math.PI / 2, () => {
    hb.box(0, 1.22, 0, 0.22, 2.44, 0.24, 0x578383);
    hb.box(0, 2.73, 0, 3.55, 1.8, 0.21, 0xeeede0);
    atlas.sign(
      hb,
      0,
      2.75,
      0.115,
      3.4,
      1.62,
      "✚ MEDICAL",
      "#eef2dc",
      "#347d78",
      0,
      "bold 60px Arial",
      "A Z U R E   G E N E R A L",
    );
  });
  // Port Azure municipal wayfinding pylon.
  let signB = tile(97, 76);
  signB.at(98.2, 0, 68, 0.22, () => {
    signB.box(0, 0.19, 0, 4.45, 0.38, 1.18, 0xd7c6a7);
    signB.box(0, 1.76, 0, 3.7, 2.9, 0.45, 0x538d87);
    atlas.sign(
      signB,
      0,
      2.04,
      0.236,
      3.55,
      1.78,
      "PALOMA",
      "#538d87",
      "#fff0c7",
      0,
      "italic bold 68px Georgia",
      "B E A C H",
    );
    signB.box(0, 0.74, 0.25, 3.7, 0.12, 0.1, 0xf7c77e);
  });
  const groups = [];
  for (let b of chunks.values()) {
    let g = b.finish();
    scene.add(g);
    groups.push(g);
  }
  plantPalms(scene, palms, shrubs);
  let signalMesh = new T.InstancedMesh(
      new T.SphereGeometry(1, 7, 5),
      new T.MeshBasicMaterial(),
      lightBulbs.length,
    ),
    obj = new T.Object3D();
  lightBulbs.forEach((a, i) => {
    obj.position.set(a.x, a.y, a.z);
    obj.rotation.y = a.rot;
    obj.scale.set(0.145, 0.145, 0.045);
    obj.updateMatrix();
    signalMesh.setMatrixAt(i, obj.matrix);
  });
  scene.add(signalMesh);
  let lampGlowMap = canvasTex(64, 64, (c) => {
    let g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,241,184,1)");
    g.addColorStop(0.14, "rgba(255,210,131,.85)");
    g.addColorStop(0.38, "rgba(255,195,102,.22)");
    g.addColorStop(1, "rgba(255,174,79,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  let lgeo = new T.BufferGeometry();
  lgeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      lamps.flatMap((v) => [v.x, v.y, v.z]),
      3,
    ),
  );
  let lampMat = new T.PointsMaterial({
    map: lampGlowMap,
    transparent: true,
    depthWrite: false,
    size: 2.4,
    blending: T.AdditiveBlending,
    color: 0xffe2a4,
  });
  let lampPts = new T.Points(lgeo, lampMat);
  scene.add(lampPts);
  let pools = new Builder();
  for (let l of lamps)
    pools.quad(
      l.x,
      0.084,
      l.z,
      10,
      11,
      0xffc88a,
      0,
      -Math.PI / 2,
      materialPool(),
    );
  function materialPool() {
    return (poolMat ??= new T.MeshBasicMaterial({
      map: lampGlowMap,
      vertexColors: true,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }));
  }
  function trafficPhase(id, t) {
    return Math.floor((t + id * 0.32) / 8) % 2;
  }
  let pg = pools.finish(false, false);
  scene.add(pg);
  let lastSig = -1;
  function update(t, day) {
    weather.uniforms.uTime.value = t;
    weather.uniforms.uDay.value = day;
    lampMat.opacity = (1 - day) * 0.95;
    lampPts.visible = pg.visible = day < 0.8;
    if (poolMat) poolMat.opacity = (1 - day) * 0.4;
    nightMats.forEach((m) => (m.emissiveIntensity = (1 - day) * 1.05));
    if (Math.floor(t * 3) !== lastSig) {
      lastSig = Math.floor(t * 3);
      lightBulbs.forEach((s, j) => {
        let phase = trafficPhase(s.id, t),
          cycle = (t + s.id * 0.32) % 8,
          go = phase === s.axis,
          lit = go ? (cycle > 6.7 ? 1 : 2) : 0;
        signalMesh.setColorAt(
          j,
          new T.Color(
            s.i === lit
              ? [0xff533e, 0xffc966, 0x67e8ab][s.i]
              : [0x663f3b, 0x524b37, 0x304d43][s.i],
          ),
        );
      });
      signalMesh.instanceColor.needsUpdate = true;
    }
  }
  return {
    scene,
    atlas,
    registerObstacle: collider,
    groups,
    palms,
    lamps,
    nodes,
    edges,
    extraRoads,
    mapBlocks,
    mapParks,
    solids,
    hit,
    update,
    trafficPhase,
    signals,
    weather,
    floorAt,
  };
}
let poolMat;
