import { artTexture } from "./art.js";
import {
  T,
  Builder,
  canvasTex,
  material,
  rng,
  TAU,
  solid,
  double,
  unlit,
} from "./mesh.js";
import { hotelNames } from "./architecture.js";
import { ZS, XS } from "./city.js";
export function streetArt(scene, w) {
  let r = rng(9221),
    groups = new Map(),
    at = w.atlas,
    tex = artTexture("posters");
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  let posters = material(tex),
    glow = new T.MeshLambertMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0xff9e7e,
      emissiveIntensity: 0.1,
    });
  let textMats = [],
    lamps = [];
  let tubes = new Builder(),
    tubeMat = new T.MeshBasicMaterial({ vertexColors: true });
  const tile = (x, z) => {
    let k = Math.floor(x / 80) + "," + Math.floor(z / 120);
    if (!groups.has(k)) groups.set(k, new Builder());
    return groups.get(k);
  };
  function poster(b, x, y, z, ww, hh, id, ang = 0) {
    let u = (id % 2) * 0.5,
      v = id < 2 ? 0.5 : 0;
    b.quad(x, y, z, ww, hh, 0xffffff, ang, 0, posters, [
      u + 0.001,
      v + 0.001,
      0.498,
      0.498,
    ]);
  }
  function lettering(
    b,
    x,
    y,
    z,
    ww,
    hh,
    word,
    fg,
    font,
    ang = 0,
    script = false,
  ) {
    let tx = canvasTex(768, 192, (c, tw, th) => {
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = font;
      let length = c.measureText(word).width;
      c.translate(tw / 2, th * 0.49);
      c.scale((tw - 24) / length, (th - 24) / 118);
      c.lineJoin = "round";
      c.strokeStyle = script ? "#693d45" : "#384b4c";
      c.lineWidth = script ? 5 : 4;
      c.strokeText(word, 1, 3);
      c.fillStyle = fg;
      c.fillText(word, 0, 0);
    });
    let m = new T.MeshLambertMaterial({
      map: tx,
      alphaTest: 0.28,
      transparent: false,
      emissiveMap: tx,
      emissive: 0xffffff,
      emissiveIntensity: 0.11,
      side: T.DoubleSide,
    });
    textMats.push(m);
    b.quad(x, y, z, ww, hh, 0xffffff, ang, 0, m);
  }
  function planter(b, x, z, s = 0.9) {
    b.cyl(x, 0.37 * s, z, 0.44 * s, 0.32 * s, 0.74 * s, 0xc68f6d, 13);
    b.cyl(x, 0.71 * s, z, 0.46 * s, 0.46 * s, 0.11 * s, 0xd5a785, 13);
    b.cyl(x, 0.775 * s, z, 0.39 * s, 0.39 * s, 0.03 * s, 0x665238, 13);
    for (let j = 0; j < 13; j++) {
      let a = j * 2.399 + z,
        ca = Math.cos(a),
        sa = Math.sin(a),
        len = (0.45 + r() * 0.55) * s,
        ht = (0.72 + r() * 0.8) * s,
        base = [x, 0.75 * s, z],
        v = [x + ca * len * 0.45, 0.75 * s + ht * 0.72, z + sa * len * 0.45],
        end = [x + ca * len, 0.75 * s + ht, z + sa * len];
      let p = [v[0] - sa * 0.13 * s, v[1] - 0.05, v[2] + ca * 0.13 * s],
        q = [v[0] + sa * 0.14 * s, v[1] - 0.04, v[2] - ca * 0.14 * s];
      b.poly([base, p, end, v], j % 3 ? 0x487d49 : 0x6c9956, double);
      b.poly([base, v, end, q], j % 3 ? 0x6b9758 : 0x87a45a, double);
    }
  }
  function cabinet(b, x, z, rot) {
    b.at(x, 0, z, rot, () => {
      b.box(0, 0.71, 0, 0.69, 1.17, 0.49, 0x548a90);
      b.box(0, 1.35, 0.03, 0.76, 0.15, 0.57, 0x62969b);
      b.box(0, 0.91, 0.26, 0.55, 0.57, 0.04, 0xe9dbb8);
      at.sign(
        b,
        0,
        1.14,
        0.29,
        0.53,
        0.12,
        "AZURE TIMES",
        "#ddcfb1",
        "#34585a",
        0,
        "bold 72px Georgia",
      );
      for (let j = 0; j < 7; j++)
        b.box(-0.12, 0.76 + j * 0.041, 0.285, 0.23, 0.016, 0.017, 0x818479);
      b.box(0.15, 0.87, 0.286, 0.18, 0.3, 0.02, 0x909f98);
      b.box(0, 0.38, 0.26, 0.37, 0.052, 0.015, 0x27464d);
    });
  }
  function billboard(x, z, hh, width, height, id, ang) {
    let b = tile(x, z);
    b.at(x, 0, z, ang, () => {
      for (let s of [-1, 1]) {
        b.beam(
          [s * width * 0.28, 0, -0.32],
          [s * width * 0.28, hh + height * 0.39, -0.32],
          0.145,
          0.11,
          0x768482,
          8,
        );
        b.beam(
          [s * width * 0.28, hh - height * 0.52, -0.32],
          [-s * width * 0.28, hh + height * 0.42, -0.32],
          0.057,
          0.057,
          0x66797c,
          5,
        );
      }
      b.box(0, hh, 0, width + 0.24, height + 0.24, 0.3, 0x4e6364);
      poster(b, 0, hh, 0.165, width, height, id);
      b.box(0, hh - height * 0.52, 0.29, width + 0.42, 0.15, 0.77, 0x8e958b);
      for (let s of [-1, 0, 1]) {
        b.beam(
          [s * width * 0.35, hh - height * 0.51, 0.22],
          [s * width * 0.35, hh - height * 0.57, 0.82],
          0.036,
          0.036,
          0x657778,
        );
        b.box(
          s * width * 0.35,
          hh - height * 0.56,
          0.84,
          0.49,
          0.15,
          0.19,
          0xf3e4bb,
        );
      }
    });
  }
  for (let j = 0; j < 9; j++) {
    let z = (ZS[j] + ZS[j + 1]) / 2 - 5,
      x = 62,
      bb = tile(x, z),
      n = hotelNames[j],
      color = n[3],
      cream = "#ffefd0";
    // Each hotel gets street-facing dimensional lettering, blade signage and individual entry details.
    let ww = 59 * 0.67,
      rr = ww * 0.155,
      neon = [0xff8d81, 0x79ebde, 0xffbd74, 0xff8bb4][j % 4];
    for (let level = 0; level < 3 + ((j * 7) % 4); level++) {
      let ring = new T.TorusGeometry(rr + 0.39, 0.048, 5, 36);
      tubes.add(
        ring,
        neon,
        tubeMat,
        61.45,
        6.65 + level * 3.15,
        z - ww * 0.27,
        1,
        1,
        1,
        Math.PI / 2,
        0,
        0,
      );
    }
    tubes.box(65.09, 4.66, z, 0.055, 0.062, ww + 0.65, neon, 0, tubeMat);
    for (let s of [-1, 1])
      tubes.box(
        63.3 + s * 0.98,
        8.18,
        z + 16.72,
        0.073,
        6.45,
        0.064,
        0xff986a,
        0,
        tubeMat,
      );
    let wt = j === 5 ? 14 : 10.5;
    bb.at(x, 0, z, Math.PI / 2, () => {
      let ax = -5;
      bb.box(ax, 5.8, 1.31, wt + 0.68, 1.97, 0.38, n[2]);
      bb.box(ax, 6.78, 1.34, wt + 0.9, 0.12, 0.53, cream);
      bb.box(ax, 4.83, 1.34, wt + 0.9, 0.13, 0.53, cream);
      lettering(
        bb,
        ax,
        5.79,
        1.52,
        wt,
        1.8,
        n[0],
        color,
        "italic bold 136px Georgia",
        0,
        true,
      );
      for (let k of [-1, 1]) planter(bb, ax + k * (wt / 2 + 0.6), 2.29, 0.82);
      bb.box(9.8, 3.12, 2.16, 1.45, 0.16, 1.24, color);
      bb.box(9.8, 0.73, 2.14, 0.94, 1.46, 0.71, 0xb58c69);
      at.sign(bb, 9.8, 1.02, 2.51, 0.84, 0.31, "VALET", "#405c5c", "#f8dfac");
      // Slender illuminated fins make the boulevard easy to recognize after dark.
      for (let d of [-1, 1])
        bb.box(
          ax,
          5.8 + d * 0.82,
          1.58,
          wt + 0.2,
          0.045,
          0.06,
          0xffbd8c,
          0,
          glow,
        );
    });
    let sideZ = z + 16.5;
    bb.at(63.3, 0, sideZ, 0, () => {
      bb.box(0, 8.14, 0, 2.2, 6.4, 0.36, color);
      bb.box(0, 11.42, 0, 1.7, 0.29, 0.35, n[2]);
      bb.box(0, 11.72, 0, 1.08, 0.31, 0.32, cream);
      for (let s of [-1, 1])
        bb.box(s * 0.98, 8.18, 0.2, 0.07, 6.45, 0.055, 0xffbf89, 0, glow);
      let letters = j === 5 ? "ROOMS" : "HOTEL";
      for (let k = 0; k < 5; k++)
        at.sign(
          bb,
          0,
          10.54 - k * 1.19,
          0.202,
          1.47,
          1.06,
          letters[k],
          color,
          cream,
          0,
          "bold 75px Cond",
        );
      bb.box(-1.5, 7.16, -0.02, 1.9, 0.21, 0.19, 0x698481);
      bb.box(-1.5, 9.84, -0.02, 1.9, 0.21, 0.19, 0x698481);
    });
    cabinet(bb, 64.8, z - 13, 0.4);
    if (j % 2 === 1) {
      let bz = ZS[j] + 16.7;
      billboard(49, bz, 24.4, 10.8, 6.8, j === 5 ? 0 : j % 4, 0.55);
    }
  }
  // Oceanfront concession stands break up the promenade with little pockets of activity.
  for (let [j, x, z, ang] of [
    [0, 105.5, 52, -1.23],
    [1, 106.5, -86, -1.45],
    [2, 105.5, 207, -1.35],
    [3, 102, -231, -1.5],
  ]) {
    let b = tile(x, z),
      col = ["#db9471", "#e9b76e", "#cba7ad", "#9abbb5"][j];
    b.at(x, 0, z, ang, () => {
      b.box(0, 1.48, 0, 4.9, 2.95, 3.12, col);
      for (let k = 0; k < 14; k++)
        b.box(-2.35 + k * 0.36, 1.45, 1.568, 0.023, 2.8, 0.025, 0xb47e65);
      b.box(0, 1.87, 1.59, 3.79, 1.12, 0.08, 0x29494c);
      b.box(0, 1.29, 1.89, 4.3, 0.15, 0.73, 0x698c81);
      b.box(0, 2.91, 0, 5.6, 0.24, 3.9, 0xd4dcc7);
      b.box(0, 3.14, 0, 5.4, 0.22, 3.62, 0x8eaea5);
      at.sign(
        b,
        0,
        2.68,
        1.595,
        4.32,
        0.48,
        ["CITRUS BAR", "BLUE FIN", "BEACH RENTALS", "MARÉ RECORDS"][j],
        "#386863",
        "#ffedc6",
        0,
        "bold 70px Cond",
      );
      poster(b, -2.465, 1.58, 0, 2.64, 1.8, [2, 1, 0, 3][j], -Math.PI / 2);
      for (let k = 0; k < 4; k++) {
        b.cyl(-1.34 + k * 0.86, 0.52, 2.44, 0.052, 0.09, 1.03, 0x6b8480, 8);
        b.cyl(-1.34 + k * 0.86, 1.06, 2.44, 0.27, 0.27, 0.13, 0xe4bd85, 12);
      }
      planter(b, 2.8, 1.36, 0.72);
    });
    w.registerObstacle?.(x, z, 3.35, 5, "building");
  }
  billboard(95, 38, 5.65, 6.9, 4.6, 0, -0.31);
  billboard(48, 13, 19.85, 10.2, 6.7, 1, 0.53);
  billboard(95, -145, 5.6, 6.45, 4.3, 2, -0.57);
  billboard(-240, 39, 9.6, 12.7, 7.6, 2, 0.06);
  billboard(-236, -218, 12, 15, 9, 0, -0.1);
  billboard(-117, 126, 12, 11.6, 7.8, 3, 0.3);
  billboard(-155, -260, 11, 11, 7, 1, 1.05);
  // Bus shelters with transparent end panels, roof slats, route numbers and illustrated advertising.
  for (let [x, z, ang, id] of [
    [87.2, -6, Math.PI / 2, 0],
    [64.5, 162, -Math.PI / 2, 3],
    [-34, -63, Math.PI / 2, 2],
    [-104, 75, Math.PI / 2, 1],
  ]) {
    let b = tile(x, z);
    b.at(x, 0, z, ang, () => {
      for (let dx of [-1.8, 1.8])
        b.box(dx, 1.45, 0, 0.095, 2.9, 0.13, 0x577374);
      b.box(0, 2.87, 0.28, 4.24, 0.18, 1.63, 0x769895);
      b.box(-1.79, 1.54, 0.32, 0.13, 2.18, 1.27, 0x3e6666);
      poster(b, -1.715, 1.54, 0.32, 1.16, 1.94, id, Math.PI / 2);
      b.box(0, 0.51, 0.12, 2.8, 0.12, 0.54, 0x987858);
      b.box(0, 0.93, -0.12, 2.8, 0.27, 0.08, 0x9c7e5b);
      for (let sx of [-1.14, 1.14])
        b.box(sx, 0.28, 0.13, 0.08, 0.55, 0.43, 0x577574);
      at.sign(
        b,
        0.7,
        2.56,
        0.08,
        1.7,
        0.35,
        "09  •  COAST",
        "#285d60",
        "#ffefd6",
      );
      b.box(2.4, 1.5, 0.62, 0.075, 3, 0.075, 0x56706d);
      b.box(2.4, 2.72, 0.63, 0.6, 0.82, 0.12, 0xe4cd9d);
      at.sign(b, 2.4, 2.72, 0.7, 0.53, 0.62, "09", "#37636a", "#fff3d7");
    });
  }
  for (let b of groups.values()) scene.add(b.finish());
  let tubeGroup = tubes.finish(false, false);
  scene.add(tubeGroup);
  return (day) => {
    tubeGroup.visible = day < 0.76;
    glow.emissiveIntensity = 0.12 + (1 - day) * 2.1;
    for (let m of textMats) m.emissiveIntensity = 0.06 + (1 - day) * 0.85;
  };
}
