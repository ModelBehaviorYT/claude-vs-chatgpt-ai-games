import { T, Builder, canvasTex, material, rng, TAU, solid } from "./mesh.js";
const bark = material(
  canvasTex(
    192,
    200,
    (c, w, h) => {
      let r = rng(774);
      c.fillStyle = "#ad9c82";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9500; i++) {
        c.fillStyle = r() > 0.5 ? "#eae1ca35" : "#372f2634";
        c.fillRect(r() * w, r() * h, r() * 1.7 + 0.4, r() * 3.7 + 0.3);
      }
      for (let j = -1; j < 7; j++) {
        let y = j * 34 + 8;
        for (let l = 0; l < 5; l++) {
          c.beginPath();
          c.moveTo(-5, y + l);
          for (let i = 0; i <= w; i += 4)
            c.lineTo(i, y + 2 * Math.sin(i * 0.037 + 3 * j) + r() * 2 + l);
          c.strokeStyle = l < 3 ? "#655f4f85" : "#e4d0ae97";
          c.lineWidth = 1.2;
          c.stroke();
        }
      }
      for (let i = 0; i < 29; i++) {
        let x = r() * w,
          y = r() * h;
        c.strokeStyle = "#5b544630";
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 2, y + 12);
        c.lineTo(x + 1, y + 17 + r() * 21);
        c.stroke();
      }
    },
    true,
  ),
);
const frondTexture = canvasTex(256, 512, (c, w, h) => {
  let r = rng(1927);
  c.clearRect(0, 0, w, h);
  for (let j = 0; j < 46; j++) {
    let t = j / 46,
      y = 490 - t * 455,
      ax = 128 + 3 * Math.sin(t * Math.PI),
      width =
        (0.18 + 0.8 * Math.sin(Math.PI * (t * 0.98 + 0.02)) ** 0.6) *
        (1 - 0.18 * t) *
        114;
    for (let s of [-1, 1]) {
      let len = width * (0.88 + r() * 0.14),
        tipX = ax + s * len,
        tipY = y - 16 - 34 * Math.sin(Math.PI * t * 0.86);
      let colors = [
        "#46813e",
        "#4b8740",
        "#578e43",
        "#689a45",
        "#377141",
        "#629440",
      ];
      c.fillStyle = colors[(j + Math.floor(r() * 4)) % colors.length];
      c.beginPath();
      c.moveTo(ax, y + 5);
      c.quadraticCurveTo(ax + s * len * 0.47, y - 2, tipX, tipY);
      c.quadraticCurveTo(ax + s * len * 0.57, y + 8, ax, y + 12);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(176,193,99,.48)";
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(ax, y + 5);
      c.quadraticCurveTo(ax + s * len * 0.55, y - 1, tipX, tipY);
      c.stroke();
    }
  }
  c.strokeStyle = "#95a85a";
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(128, 512);
  c.quadraticCurveTo(132, 265, 128, 17);
  c.stroke();
});
frondTexture.anisotropy = 8;
const leafMat = material(frondTexture, true, {
  side: T.DoubleSide,
  alphaTest: 0.35,
  shadowSide: T.DoubleSide,
});
function palm(v) {
  let b = new Builder(),
    r = rng(481 + v),
    h = 7.7 + r() * 2.2,
    bend = (r() - 0.36) * 2.7,
    zB = (r() - 0.5) * 1.4,
    prev = [0, 0, 0];
  for (let j = 1; j <= 8; j++) {
    let t = j / 8,
      p = [bend * t * t, h * t, zB * t * t];
    b.beam(
      prev,
      p,
      (0.29 - (0.135 * (j - 1)) / 8) * (j === 1 ? 1.32 : 1),
      0.29 - 0.135 * t,
      0xffffff,
      11,
      bark,
    );
    prev = p;
  }
  b.oval(bend, h - 0.14, zB, 0.34, 0.62, 0.34, 0x697c46);
  for (let j = 0; j < 5; j++)
    b.oval(
      bend + (r() - 0.5) * 0.54,
      h - 0.32 - r() * 0.34,
      zB + (r() - 0.5) * 0.5,
      0.15,
      0.18,
      0.15,
      0x76633d,
    );
  for (let f = 0; f < 18; f++) {
    let ang = f * 2.39996 + r() * 0.24,
      len = 3.55 + r() * 1.8,
      high = f < 5,
      mid = f >= 5 && f < 13,
      rise = high
        ? 2.8 + r() * 0.8
        : mid
          ? 1.65 + r() * 0.6
          : 0.75 + r() * 0.45,
      drop = high ? 0.38 + r() * 0.9 : mid ? 1 + r() * 0.95 : 2.4 + r(),
      width = 0.74 + r() * 0.21,
      ca = Math.cos(ang),
      sa = Math.sin(ang),
      p = [],
      uv = [],
      idx = [],
      seg = 10;
    for (let i = 0; i <= seg; i++) {
      let t = i / seg,
        cx = bend + ca * len * t,
        cy = h + rise * Math.sin(t * Math.PI * 0.78) - drop * t * t,
        cz = zB + sa * len * t;
      for (let j = -1; j <= 1; j++) {
        let off = j * width;
        p.push(
          cx - sa * off,
          cy - (j ? 0.12 + 0.28 * Math.sin(t * Math.PI) : 0.0),
          cz + ca * off,
        );
        uv.push((j + 1) / 2, t);
      }
      if (i < seg)
        for (let k = 0; k < 2; k++) {
          let a = i * 3 + k;
          idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        }
    }
    let geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    b.add(geo, high ? 0xcbd998 : mid ? 0xaec18f : 0x9aaf83, leafMat);
  }
  return b.finish();
}
export function plantPalms(scene, palms, shrubs) {
  let obj = new T.Object3D(),
    templates = [palm(0), palm(1), palm(2)];
  let batches = new Map();
  palms.forEach((p, i) => {
    let key =
      Math.floor(p.x / 100) + ":" + Math.floor(p.z / 104) + ":" + (i % 3);
    if (!batches.has(key)) batches.set(key, { type: i % 3, items: [] });
    batches.get(key).items.push(p);
  });
  for (let { type, items } of batches.values())
    for (let source of templates[type].children) {
      let mesh = new T.InstancedMesh(
        source.geometry,
        source.material,
        items.length,
      );
      items.forEach((p, i) => {
        obj.position.set(p.x, p.y || 0, p.z);
        obj.rotation.set(0, p.a, 0);
        obj.scale.setScalar(p.s);
        obj.updateMatrix();
        mesh.setMatrixAt(i, obj.matrix);
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
  let geo = new T.IcosahedronGeometry(1, 1),
    m = new T.InstancedMesh(geo, new T.MeshLambertMaterial(), shrubs.length);
  shrubs.forEach((p, i) => {
    obj.position.set(p.x, p.y, p.z);
    obj.rotation.set(0.24, p.a, 0);
    obj.scale.set(p.w, p.h, p.d);
    obj.updateMatrix();
    m.setMatrixAt(i, obj.matrix);
    m.setColorAt(i, new T.Color(p.c));
  });
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
