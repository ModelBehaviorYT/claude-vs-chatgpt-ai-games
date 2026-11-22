import { artTexture } from "./art.js";
import {
  T,
  Builder,
  canvasTex,
  material,
  rng,
  solid,
  unlit,
  double,
} from "./mesh.js";
const tones = [
  ["#f3c6aa", "#498b91", "#1c414f", "#f6e1bb"],
  ["#addacb", "#58989d", "#274b57", "#f3e5cb"],
  ["#f0c2bd", "#60949c", "#253f50", "#fff0cf"],
  ["#e4deca", "#6b989d", "#354c57", "#f3e7d7"],
  ["#82abb4", "#53969f", "#294c61", "#afc9ca"],
  ["#7d929c", "#4e8498", "#273d51", "#d3c6a9"],
  ["#dbb487", "#65838c", "#343f48", "#efdbc1"],
  ["#99c0bc", "#76a4ae", "#344550", "#c6d7ca"],
];
export const nightMats = [];
export function makeFacades() {
  return tones.map((p, n) => {
    let rand = rng(99 + n),
      isGlass = n === 4 || n === 5 || n === 7;
    let lights = [];
    let texture = canvasTex(
      512,
      512,
      (c, w, h) => {
        c.fillStyle = p[0];
        c.fillRect(0, 0, w, h);
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            let xx = x * 128,
              yy = y * 128,
              wx = xx + (isGlass ? 3 : 12),
              wy = yy + (isGlass ? 3 : 17),
              ww = isGlass ? 122 : 104,
              wh = isGlass ? 111 : 81;
            lights.push(rand() > 0.38);
            c.fillStyle = "rgba(44,44,41,.23)";
            c.fillRect(wx - 3, wy - 3, ww + 6, wh + 9);
            let grad = c.createLinearGradient(0, wy, 0, wy + wh);
            grad.addColorStop(0, p[1]);
            grad.addColorStop(0.52, p[1]);
            grad.addColorStop(1, p[2]);
            c.fillStyle = grad;
            c.fillRect(wx, wy, ww, wh);
            c.save();
            c.beginPath();
            c.rect(wx, wy, ww, wh);
            c.clip();
            c.fillStyle = "#e1eff122";
            c.beginPath();
            c.moveTo(wx + ww * 0.8, wy);
            c.lineTo(wx + ww * 0.99, wy);
            c.lineTo(wx - ww * 0.1, wy + wh);
            c.lineTo(wx - ww * 0.36, wy + wh);
            c.fill();
            if (!isGlass) {
              c.fillStyle = rand() > 0.4 ? "#dbdbca" : "#b2b3a6";
              let curtain = rand() * 22 + 5;
              c.fillRect(wx, wy, curtain, wh);
              c.fillRect(wx + ww - curtain * 0.6, wy, curtain * 0.6, wh);
              c.fillStyle = "rgba(246,233,202,.4)";
              for (let l = 0; l < curtain; l += 5)
                c.fillRect(wx + l, wy, 1.3, wh);
              if (rand() > 0.45) {
                let lh = rand() * 34 + 8;
                c.fillStyle = "#c3c8bb";
                c.fillRect(wx, wy, ww, lh);
                c.strokeStyle = "#737f7955";
                for (let l = 2; l < lh; l += 3) {
                  c.beginPath();
                  c.moveTo(wx, wy + l);
                  c.lineTo(wx + ww, wy + l);
                  c.stroke();
                }
              }
            }
            c.restore();
            c.fillStyle = p[2];
            c.fillRect(wx + ww * 0.48, wy, 3, wh);
            c.fillRect(wx, wy + wh * 0.72, ww, 2.5);
            c.fillStyle = p[3];
            c.fillRect(wx - 3, wy + wh + 1, ww + 6, 3);
            c.fillStyle = "#223b4624";
            c.fillRect(xx, yy + 122, 128, 5);
            c.fillStyle = "#ffffff55";
            c.fillRect(xx, yy + 120, 128, 2);
          }
        for (let i = 0; i < 6200; i++) {
          c.fillStyle = rand() > 0.5 ? "#fff1" : "#14282e0d";
          c.fillRect(rand() * w, rand() * h, 1, rand() * 3 + 1);
        }
      },
      true,
    );
    let emission = canvasTex(
      512,
      512,
      (c) => {
        c.fillStyle = "#000";
        c.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            if (!lights[y * 4 + x]) continue;
            let wx = x * 128 + (isGlass ? 4 : 13),
              wy = y * 128 + (isGlass ? 4 : 18),
              w = isGlass ? 121 : 102,
              h = isGlass ? 109 : 80;
            c.fillStyle = ["#dc9b60", "#e0bb8c", "#73b7b6", "#406e79"][
              Math.floor(rand() * 4)
            ];
            c.fillRect(wx, wy, w, h);
            c.fillStyle = "#201d22";
            c.fillRect(wx + w * 0.48, wy, 4, h);
            c.fillRect(wx, wy + h * 0.7, w, 3);
            for (let l = 0; l < 4; l++)
              c.fillRect(wx + rand() * w, wy + h - 8, rand() * 10 + 2, 8);
          }
      },
      true,
    );
    let m = material(texture, true, {
      emissive: 0xffffff,
      emissiveMap: emission,
      emissiveIntensity: 0,
    });
    nightMats.push(m);
    return m;
  });
}
const shopMats = [];
export function shopWindows() {
  for (let k = 0; k < 4; k++) {
    let image = artTexture("shop-" + k);
    image.colorSpace = T.SRGBColorSpace;
    image.wrapS = image.wrapT = T.RepeatWrapping;
    image.anisotropy = 8;
    let m = material(image, true, {
      emissiveMap: image,
      emissive: 0xffdfbc,
      emissiveIntensity: 0.04,
    });
    shopMats.push(m);
    nightMats.push(m);
  }
  return shopMats;
}
export const hotelNames = [
  ["Cavalier", "OCEAN CLUB", "#eb9c88", "#306266"],
  ["Paloma", "HOTEL & SWIM CLUB", "#97c9b8", "#c75e49"],
  ["Solaire", "BEACH HOTEL", "#f2c381", "#338284"],
  ["Mariposa", "HOTEL & TERRACE", "#efacbb", "#277b7e"],
  ["Bellamar", "HOTEL • EST. 1936", "#a6d6c6", "#b64e3e"],
  ["Paradiso", "PALM ROOM", "#e8ac9f", "#276e77"],
  ["Blue Heron", "BEACH RESORT", "#9fc8d1", "#d86a48"],
  ["Solana", "BUNGALOWS", "#e8c593", "#3e8780"],
  ["Coralina", "OCEAN HOTEL", "#e59a9d", "#206971"],
];
const shops = [
  "COSTA RECORDS",
  "TAMARIND CAFÉ",
  "SUNSET SUPPLY",
  "MAR AZUL",
  "ORANGE BLOSSOM",
  "CASA LUNA",
  "PELICAN MOTORS",
  "CALETA MARKET",
  "THE PALM ROOM",
  "FLAMINGO DINER",
  "TIDE & TACKLE",
  "BLUE FIN SEAFOOD",
];
function facadeBox(b, x, y, z, w, h, d, mat, color = 0xffffff, step = 3) {
  b.box(x, y + h / 2, z, w - 0.14, h, d - 0.14, 0xc9c4b3);
  b.quad(x, y + h / 2, z + d / 2, w, h, color, 0, 0, mat, [
    0,
    0,
    Math.max(1, Math.round((w / (step * 4)) * 2) / 2),
    h / (3.15 * 4),
  ]);
  b.quad(x, y + h / 2, z - d / 2, w, h, color, Math.PI, 0, mat, [
    0,
    0,
    w / (step * 4),
    h / (3.15 * 4),
  ]);
  for (let s of [-1, 1])
    b.quad(
      x + (s * w) / 2,
      y + h / 2,
      z,
      d,
      h,
      color,
      (s * Math.PI) / 2,
      0,
      mat,
      [0, 0, d / (step * 4), h / (3.15 * 4)],
    );
}
function canopy(b, x, y, z, w, d, col) {
  b.box(x, y, z, w, 0.22, d, col);
  b.box(x, y - 0.22, z + d * 0.46, w, 0.28, 0.14, col);
  for (let i = 0; i < Math.floor(w / 0.9); i += 2) {
    b.box(
      x - w * 0.5 + (i + 0.65) * 0.9,
      y + 0.12,
      z,
      0.86,
      0.035,
      d,
      0xf8e8c8,
    );
    b.box(
      x - w * 0.5 + (i + 0.65) * 0.9,
      y - 0.21,
      z + d * 0.46 + 0.08,
      0.86,
      0.27,
      0.05,
      0xf8e8c8,
    );
  }
}
export function storefront(b, at, x, z, w, k, bg, sign, awning = true) {
  let h = 3.1;
  b.quad(
    x,
    1.75,
    z,
    w - 0.4,
    h,
    0xffffff,
    0,
    0,
    shopMats[
      /RECORDS/.test(sign)
        ? 0
        : /CAFÉ|DINER|ROOM|SEAFOOD/.test(sign)
          ? 1
          : /SUPPLY|BUNGALOW|CLUB|PALM/.test(sign)
            ? 2
            : k % 4
    ],
    [0, 0, Math.max(1, Math.round(w / 6)), 1],
  );
  b.box(x, 3.79, z + 0.14, w, 0.85, 0.5, bg);
  at.sign(
    b,
    x,
    3.8,
    z + 0.4,
    w - 0.3,
    0.76,
    sign,
    bg,
    "#fff4d8",
    0,
    "bold 60px Cond",
  );
  let doorX = x + w * 0.25;
  b.box(doorX, 1.32, z + 0.09, 1.15, 2.55, 0.12, 0x6f898b);
  b.box(doorX, 1.47, z + 0.17, 0.95, 2.02, 0.04, 0x33525c);
  b.box(doorX + 0.29, 1.12, z + 0.22, 0.045, 0.38, 0.075, 0xdad5ba);
  if (awning) canopy(b, x, 3.15, z + 0.9, w, 1.8, bg);
}
function roofBits(b, x, y, z, w, d, r) {
  for (let j = 0; j < Math.min(4, w / 8); j++) {
    let ax = x + (r() - 0.5) * w * 0.6,
      az = z + (r() - 0.5) * d * 0.55;
    b.box(ax, y + 0.6, az, 2.1, 1.2, 1.55, 0xb6bab0);
    b.box(ax, y + 1.23, az, 2.18, 0.11, 1.62, 0xdcddd0);
    for (let k = 0; k < 5; k++)
      b.box(
        ax - 0.8 + k * 0.39,
        y + 0.6,
        az + 0.79,
        0.14,
        0.65,
        0.04,
        0x7b8b87,
      );
  }
}
export function hotel(b, at, mats, x, z, w, d, id, rot = Math.PI / 2) {
  let n = hotelNames[id % 9],
    r = rng(100 + id),
    front = d / 2,
    floors = 3 + ((id * 7) % 4),
    h = 4.2 + floors * 3.15;
  let tint = n[2],
    trim = n[3],
    cream = "#ffebcd";
  b.at(x, 0, z, rot, () => {
    b.box(0, 2, 0, w, 4, d, tint);
    facadeBox(b, 0, 4, 0, w, floors * 3.15, d, mats[[0, 1, 2, 3][id % 4]]);
    let wing = w * (id % 2 ? 0.35 : 0.29),
      wx = -w * 0.5 + wing * 0.5 + 0.28;
    facadeBox(b, wx, h, 0, wing, 3.15, d, mats[id % 4]);
    for (let y of [4, 4.42, h - 0.12, h + 0.34])
      b.box(0, y, 0, w + 0.75, 0.26, d + 0.68, cream);
    for (let y of [h + 3.12, h + 3.6])
      b.box(wx, y, 0, wing + 0.6, 0.32, d + 0.65, cream);
    let frontX = w * 0.27,
      rad = w * 0.155;
    b.cyl(frontX, (h + 4.2) / 2, front - 0.55, rad, rad, h - 4.2, tint, 22);
    for (let j = 0; j < floors; j++) {
      let yy = 5.3 + j * 3.15;
      b.cyl(
        frontX,
        yy,
        front - 0.55,
        rad + 0.03,
        rad + 0.03,
        1.54,
        0x54878b,
        24,
      );
      for (let a = 0; a < 6; a++) {
        let ang = (a * Math.PI) / 5;
        b.box(
          frontX + Math.cos(ang) * (rad + 0.04),
          yy,
          front - 0.55 + Math.sin(ang) * (rad + 0.04),
          0.18,
          1.6,
          0.18,
          cream,
        );
      }
      b.cyl(
        frontX,
        yy + 1.15,
        front - 0.55,
        rad + 0.55,
        rad + 0.55,
        0.29,
        cream,
        28,
      );
      b.cyl(
        frontX,
        yy + 1.34,
        front - 0.55,
        rad + 0.37,
        rad + 0.37,
        0.1,
        trim,
        28,
      );
    }
    let bladeX = wx - wing * 0.25,
      top = h + 5;
    b.box(bladeX, top * 0.62, front + 0.86, 2.5, top * 0.77, 1.7, tint);
    for (let q of [-1, 1]) {
      b.box(
        bladeX + q * 1.04,
        top * 0.62,
        front + 1.76,
        0.14,
        top * 0.75,
        0.12,
        cream,
      );
      b.box(
        bladeX + q * 0.82,
        top * 0.62,
        front + 1.77,
        0.08,
        top * 0.73,
        0.12,
        trim,
      );
    }
    b.box(bladeX, top + 0.7, front + 0.88, 1.7, 1.4, 1.5, tint);
    b.box(bladeX, top + 1.64, front + 0.87, 1, 0.55, 1.15, cream);
    let word = "HOTEL";
    for (let j = 0; j < 5; j++)
      at.sign(
        b,
        bladeX,
        top - 0.9 - j * 1.55,
        front + 1.77,
        1.32,
        1.42,
        word[j],
        trim,
        "#fff0c8",
        0,
        "bold 75px Cond",
      );
    b.box(0, 4.58, front + 1.45, w + 0.65, 0.64, 3.15, cream);
    b.box(0, 4.57, front + 3.05, w + 0.7, 0.2, 0.14, trim);
    let sw = w * 0.42;
    storefront(
      b,
      at,
      -w * 0.25,
      front + 0.06,
      sw,
      id,
      trim,
      shops[(id * 3) % shops.length],
      id % 2 === 0,
    );
    storefront(b, at, w * 0.25, front + 0.06, sw, id + 1, trim, n[1], false);
    let nameX = wx + wing * 0.16;
    b.box(nameX, h + 1.6, front + 0.24, wing * 1.04, 2.45, 0.5, trim);
    at.sign(
      b,
      nameX,
      h + 1.6,
      front + 0.51,
      wing,
      2.3,
      n[0],
      trim,
      "#fff0c9",
      0,
      "italic bold 66px Georgia",
    );
    for (let k of [-1, 1])
      b.cyl(k * (w / 2 - 0.6), 2.17, front + 2.5, 0.24, 0.3, 4.32, tint, 12);
    for (let k = 0; k < 3; k++)
      b.box(
        -w * 0.04,
        h + (0.7 + k * 0.4),
        -d * 0.17,
        w * 0.14 - k * 0.55,
        0.43,
        d * 0.36,
        cream,
      );
    roofBits(b, 0, h + 0.42, 0, w, d, r);
  });
}
export function tower(b, at, mats, x, z, w, d, h, id, rot = 0) {
  let r = rng(id + 342),
    front = d / 2,
    pal = [0xcbd7cc, 0xe2c9b8, 0xa9c8c4, 0xb5c0ca],
    col = pal[id % 4];
  b.at(x, 0, z, rot, () => {
    b.box(0, 2.3, 0, w, 4.6, d, col);
    storefront(
      b,
      at,
      0,
      front + 0.04,
      w - 0.4,
      id,
      "#31575b",
      shops[id % shops.length],
      id % 3 === 0,
    );
    const tier = id % 3 === 0 ? Math.max(10, h * 0.27) : 0;
    facadeBox(b, 0, 4.59, 0, w, h - 4.59 - tier, d, mats[4 + (id % 2)]);
    let roof = h - tier;
    if (tier) {
      b.box(0, roof, 0, w + 0.55, 0.45, d + 0.5, col);
      facadeBox(b, 0, roof, 0, w * 0.78, tier, d * 0.81, mats[4 + (id % 2)]);
    }
    for (let xx of [-1, 1])
      for (let zz of [-1, 1])
        b.box(
          xx * (w / 2 - 0.13),
          (roof + 4.6) / 2,
          zz * (d / 2 - 0.13),
          0.38,
          roof - 4.6,
          0.38,
          col,
        );
    if (id % 3 === 1) {
      for (let j = 7.7; j < roof; j += 3.15)
        b.box(0, j, 0, w + 0.8, 0.27, d + 0.8, col);
    }
    if (id % 4 === 0) {
      for (let j = 0; j < 4; j++)
        b.box(
          (j - 1.5) * w * 0.21,
          roof * 0.52,
          front + 0.09,
          0.58,
          roof * 0.92,
          0.4,
          col,
        );
    }
    b.box(
      0,
      h + 0.18,
      0,
      (tier ? w * 0.78 : w) + 0.55,
      0.46,
      (tier ? d * 0.81 : d) + 0.55,
      col,
    );
    b.box(0, h + 1.25, 0, w * 0.48, 2.25, d * 0.45, 0xbac1b9);
    roofBits(b, 0, h + 2.4, 0, w * 0.5, d * 0.44, r);
    if (h > 55 && id % 2 === 0) {
      b.cyl(0, h + 5.5, 0, 0.13, 0.43, 7, 0xaeb9ba);
      b.oval(0, h + 9.1, 0, 0.2, 0.2, 0.2, 0xff6158, 0, 0, 0, unlit);
    }
  });
}
export function lowrise(b, at, mats, x, z, w, d, id, rot = 0) {
  let r = rng(id + 77),
    h = 4.4 + Math.floor(r() * 3) * 3.15,
    col = tones[id % 4][0];
  b.at(x, 0, z, rot, () => {
    b.box(0, 2.25, 0, w, 4.5, d, col);
    if (h > 4.5) facadeBox(b, 0, 4.4, 0, w, h - 4.4, d, mats[id % 4]);
    for (let y of [h, h + 0.45]) b.box(0, y, 0, w + 0.4, 0.25, d + 0.45, col);
    b.box(0, h + 0.65, 0, w - 0.45, 0.35, d - 0.45, 0xa3a598);
    storefront(
      b,
      at,
      0,
      d / 2 + 0.08,
      w - 0.3,
      id,
      ["#c56d53", "#318c88", "#ac605f", "#35737d"][id % 4],
      shops[id % shops.length],
      true,
    );
    roofBits(b, 0, h + 0.85, 0, w, d, r);
  });
}
export function house(b, x, z, w, d, id, rot = 0) {
  let r = rng(id + 870),
    col = [0xd2c4a2, 0xc4d7b6, 0xe2baa6, 0xaacac6, 0xefcd9c][id % 5];
  b.at(x, 0, z, rot, () => {
    b.box(0, 1.8, 0, w, 3.6, d, col);
    let y = 3.65,
      pk = 5.05 + 1.1 * r(),
      xw = w / 2 + 0.65,
      zd = d / 2 + 0.65,
      roof = [0xa36045, 0x6e8178, 0x866956, 0xba795b][id % 4];
    b.poly(
      [
        [-xw, y, zd],
        [xw, y, zd],
        [xw * 0.7, pk, 0],
        [-xw * 0.7, pk, 0],
      ],
      roof,
      double,
    );
    b.poly(
      [
        [xw, y, -zd],
        [-xw, y, -zd],
        [-xw * 0.7, pk, 0],
        [xw * 0.7, pk, 0],
      ],
      roof,
      double,
    );
    for (let s of [-1, 1])
      b.poly(
        [
          [s * xw, y, -zd],
          [s * xw, y, zd],
          [s * xw * 0.7, pk, 0],
        ],
        roof,
        double,
      );
    b.box(0, y - 0.12, 0, w + 1.2, 0.22, d + 1.2, 0xffe5c7);
    b.box(0, 0.14, d / 2 + 0.85, w * 0.65, 0.28, 2.5, 0xc3bba8);
    b.box(0, 1.28, d / 2 + 0.03, 1.14, 2.5, 0.1, 0x467477);
    for (let s of [-1, 1]) {
      b.box(s * w * 0.29, 1.95, d / 2 + 0.03, 2.1, 1.33, 0.12, 0x315661);
      b.box(s * w * 0.29, 1.94, d / 2 + 0.1, 0.09, 1.33, 0.08, col);
      for (let k of [-1, 1])
        b.box(
          s * w * 0.29 + k * 1.27,
          1.94,
          d / 2 + 0.12,
          0.38,
          1.4,
          0.12,
          0x597b73,
        );
      b.cyl(s * w * 0.3, 1.54, d / 2 + 1.7, 0.12, 0.12, 3.08, 0xf8ebce);
    }
    b.box(0, 3.17, d / 2 + 1, w * 0.74, 0.25, 2.5, roof);
  });
}
