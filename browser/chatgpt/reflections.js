import { T, rng, clamp, TAU } from "./mesh.js";
export function cityReflection() {
  let r = rng(8751),
    p = document.createElement("canvas");
  p.width = 1024;
  p.height = 512;
  let c = p.getContext("2d"),
    g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#4088ad");
  g.addColorStop(0.34, "#91c7d9");
  g.addColorStop(0.485, "#e1dfbf");
  g.addColorStop(0.51, "#b1ae9d");
  g.addColorStop(0.63, "#787e7c");
  g.addColorStop(1, "#454e51");
  c.fillStyle = g;
  c.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 66; i++) {
    let x = i * 17,
      h = 6 + r() * 37;
    c.fillStyle = ["#8facae", "#99b3b4", "#72949a", "#bbb1a2", "#c5bfad"][
      i % 5
    ];
    c.fillRect(x, 255 - h, 14 + r() * 9, h + 3);
    c.fillStyle = "#51727c";
    for (let yy = 259 - h; yy < 253; yy += 5) c.fillRect(x + 1, yy, 13, 1);
  }
  for (let i = 0; i < 26; i++) {
    let x = r() * 1024,
      y = 210 + r() * 31;
    c.strokeStyle = "#385057";
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(x, 264);
    c.quadraticCurveTo(x + 5, 235, x + 2, y);
    c.stroke();
    for (let k = 0; k < 10; k++) {
      let a = k * 2.4,
        len = 9 + r() * 8,
        xx = x + Math.cos(a) * len,
        yy = y + Math.sin(a) * 6;
      c.fillStyle = "#47645e";
      c.beginPath();
      c.moveTo(x + 2, y);
      c.quadraticCurveTo((x + xx) / 2, yy - 7, xx, yy + 2);
      c.quadraticCurveTo((x + xx) / 2, yy - 3, x + 2, y);
      c.fill();
    }
  }
  c.fillStyle = "#e9dec3";
  c.fillRect(50, 267, 191, 4);
  c.fillRect(445, 273, 311, 5);
  let raw = c.getImageData(0, 0, 1024, 512).data,
    faces = [];
  const n = 160;
  for (let f = 0; f < 6; f++) {
    let el = document.createElement("canvas");
    el.width = el.height = n;
    let cc = el.getContext("2d"),
      out = cc.createImageData(n, n),
      d = out.data;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let a = (2 * (x + 0.5)) / n - 1,
          b = 1 - (2 * (y + 0.5)) / n;
        let [vx, vy, vz] = [
          [1, b, -a],
          [-1, b, a],
          [a, 1, -b],
          [a, -1, b],
          [a, b, 1],
          [-a, b, -1],
        ][f];
        let u = (((Math.atan2(vz, vx) / TAU + 0.5) * 1024) | 0) % 1024,
          v = clamp(
            ((0.5 - Math.asin(vy / Math.hypot(vx, vy, vz)) / Math.PI) * 512) |
              0,
            0,
            511,
          ),
          i = (v * 1024 + u) * 4,
          j = (y * n + x) * 4;
        d[j] = raw[i];
        d[j + 1] = raw[i + 1];
        d[j + 2] = raw[i + 2];
        d[j + 3] = 255;
      }
    cc.putImageData(out, 0, 0);
    faces.push(el);
  }
  let env = new T.CubeTexture(faces);
  env.colorSpace = T.SRGBColorSpace;
  env.needsUpdate = true;
  return env;
}
