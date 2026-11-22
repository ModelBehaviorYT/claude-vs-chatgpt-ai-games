import { mainland, northIsland, islets } from "./geography.js";
import { XS, ZS, roadW, HOSPITAL, SHOP, GARAGE } from "./city.js";
import { shoreline } from "./landscape.js";
import { clamp } from "./mesh.js";
const LEFT = -483,
  TOP = -665,
  WIDTH = 708,
  HEIGHT = 1090,
  SCALE = 2;
export class AtlasMap {
  constructor(world) {
    this.world = world;
    this.base = document.createElement("canvas");
    this.base.width = WIDTH * SCALE;
    this.base.height = HEIGHT * SCALE;
    this.zoom = 1;
    this.fullTransform = null;
    this.paintBase();
  }
  paintBase() {
    let c = this.base.getContext("2d");
    c.save();
    c.scale(SCALE, SCALE);
    c.translate(-LEFT, -TOP);
    c.fillStyle = "#35666e";
    c.fillRect(LEFT, TOP, WIDTH, HEIGHT);
    const line = (pts, col, width) => {
      c.beginPath();
      pts.forEach(([x, z], i) => (i ? c.lineTo(x, z) : c.moveTo(x, z)));
      c.strokeStyle = col;
      c.lineWidth = width;
      c.stroke();
    };
    for (let i = -4; i < 9; i++) {
      let points = [];
      for (let z = TOP; z < 410; z += 5)
        points.push([shoreline(z) + i * 8 + 14, z]);
      line(points, "rgba(172,209,197,.14)", 0.65);
    }
    const shape = (pts, col) => {
      c.beginPath();
      pts.forEach(([x, z], i) => (i ? c.lineTo(x, z) : c.moveTo(x, z)));
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = "#cccfac";
      c.lineWidth = 1.6;
      c.stroke();
    };
    for (let p of islets) shape(p, "#819c7e");
    shape(mainland, "#a4ac91");
    shape(northIsland, "#9ca88b");
    c.fillStyle = "#ccb895";
    c.beginPath();
    c.moveTo(110, -351);
    for (let z = -351; z <= 358; z += 3) c.lineTo(shoreline(z), z);
    c.lineTo(110, 358);
    c.fill();
    c.fillStyle = "#819c83";
    c.fillRect(98, -349, 11, 703);
    c.fillStyle = "#91a38b";
    c.fillRect(-49, -615, 126, 116);
    for (let p of this.world.mapParks) {
      c.fillStyle = "#6e9474";
      c.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
    }
    for (let p of this.world.mapBlocks) {
      let col =
        p.kind === "house"
          ? "#8f9382"
          : p.kind === "hotel"
            ? "#b69884"
            : p.kind === "tower"
              ? "#7e8c88"
              : "#999887";
      c.fillStyle = col;
      c.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
      c.strokeStyle = "#c0bda230";
      c.lineWidth = 0.7;
      c.strokeRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
    }
    for (let pass of [0, 1])
      for (let [a, b] of this.world.edges) {
        let p = this.world.nodes[a],
          q = this.world.nodes[b],
          wid = p.x === q.x ? roadW(p.x) * 0.61 : 7.2;
        if (a >= 70 || b >= 70) wid = 6.5;
        if (a >= 74 || b >= 74) wid = 10;
        c.lineCap = "round";
        line(
          [
            [p.x, p.z],
            [q.x, q.z],
          ],
          pass
            ? (p.x === -252 && q.x === -252) || a >= 74 || b >= 74
              ? "#edc78c"
              : "#f5ead3"
            : "#89988d",
          wid + (pass ? 0 : 2),
        );
      }
    line(
      [
        [108, -134],
        [177, -134],
      ],
      "#b7a88c",
      4.5,
    );
    c.strokeStyle = "rgba(255,255,245,.08)";
    c.lineWidth = 0.55;
    for (let i = -650; i < 410; i += 50)
      line(
        [
          [LEFT, i],
          [LEFT + WIDTH, i],
        ],
        "#ffffff15",
        0.45,
      );
    for (let i = LEFT; i < LEFT + WIDTH; i += 50)
      line(
        [
          [i, TOP],
          [i, TOP + HEIGHT],
        ],
        "#ffffff15",
        0.45,
      );
    c.textAlign = "center";
    c.fillStyle = "#4a605a";
    c.font = "bold 8px Cond";
    for (let [t, x, y] of [
      ["WEST  PALMS", -288, 8],
      ["CIVIC  CENTER", -113, -66],
      ["LITTLE  SOL", -80, 220],
      ["PORTSIDE", -149, -263],
      ["NORTHPOINT", 20, -591],
    ])
      c.fillText(t, x, y);
    c.save();
    c.translate(124, 30);
    c.rotate(-Math.PI / 2);
    c.fillStyle = "#756e57";
    c.font = "bold 7px Cond";
    c.fillText("P A L O M A   B E A C H", 0, 0);
    c.restore();
    c.fillStyle = "#ccddd0";
    c.font = "italic 9px Georgia";
    c.fillText("Azure Sound", -129, -434);
    c.restore();
  }
  draw(canvas, g, full = false) {
    let c = canvas.getContext("2d"),
      bounds = canvas.getBoundingClientRect(),
      w = bounds.width,
      h = bounds.height;
    if (w < 1 || h < 1) return;
    let dpr = Math.min(1.7, devicePixelRatio || 1);
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    let scale,
      ox,
      oz,
      px = g.x,
      pz = g.z,
      angle = full && w > h * 1.05 ? Math.PI / 2 : 0;
    let cs = Math.cos(angle),
      sn = Math.sin(angle);
    if (full) {
      scale =
        Math.min(
          (w - 38) / (angle ? HEIGHT : WIDTH),
          (h - 33) / (angle ? WIDTH : HEIGHT),
        ) * this.zoom;
      let cx = LEFT + WIDTH * 0.5,
        cz = TOP + HEIGHT * 0.5;
      ox = w / 2 - (cx * cs - cz * sn) * scale + (this.panX || 0);
      oz = h / 2 - (cx * sn + cz * cs) * scale + (this.panZ || 0);
      this.fullTransform = { scale, ox, oz, cs, sn };
      let north = document.querySelector(".mapnorth");
      if (north) north.innerHTML = angle ? "N →" : "▲<br>N";
    } else {
      scale = g.car ? 0.92 : 1.07;
      ox = w * 0.5 - px * scale;
      oz = h * 0.52 - pz * scale;
    }
    let X = (x, z) => ox + (x * cs - z * sn) * scale,
      Z = (x, z) => oz + (x * sn + z * cs) * scale;
    c.fillStyle = "#35666e";
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(ox, oz);
    c.rotate(angle);
    c.scale(scale, scale);
    c.drawImage(this.base, LEFT, TOP, WIDTH, HEIGHT);
    c.restore();
    let dest = g.waypoint || g.objective;
    let rt = dest ? g.routeTo(dest) : [];
    if (dest) {
      c.save();
      c.lineCap = "round";
      c.lineJoin = "round";
      c.strokeStyle = "#5c3c39";
      c.lineWidth = full ? 4.5 : 4;
      c.beginPath();
      c.moveTo(X(px, pz), Z(px, pz));
      for (let p of rt) c.lineTo(X(p.x, p.z), Z(p.x, p.z));
      c.lineTo(X(dest.x, dest.z), Z(dest.x, dest.z));
      c.stroke();
      c.strokeStyle = g.waypoint ? "#94e8dd" : "#ff985f";
      c.lineWidth = full ? 2.8 : 2.3;
      c.stroke();
      c.restore();
    }
    let pin = (x, z, s, color, mode, text) => {
      let xx = X(x, z),
        zz = Z(x, z);
      c.save();
      c.translate(xx, zz);
      c.fillStyle = color;
      c.strokeStyle = "#243b40";
      c.lineWidth = 1.8;
      c.beginPath();
      if (mode === "diamond") {
        c.moveTo(0, -s);
        c.lineTo(s, 0);
        c.lineTo(0, s);
        c.lineTo(-s, 0);
        c.closePath();
      } else c.arc(0, 0, s, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (text) {
        c.fillStyle = "#1d3235";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = "bold " + s * 1.39 + "px Cond";
        c.fillText(text, 0, 0.4);
      }
      c.restore();
    };
    let ms = full ? 7.5 : 6;
    pin(HOSPITAL.x, HOSPITAL.z, ms, "#9be7ca", "circle", "+");
    pin(SHOP.x, SHOP.z, ms, "#b1d9c6", "circle", "$");
    pin(GARAGE.x, GARAGE.z, ms, "#b1d9c6", "circle", "G");
    if (g.objective)
      pin(
        g.objective.x,
        g.objective.z,
        full ? 9 : 8.3,
        "#ffa36c",
        "diamond",
        "!",
      );
    if (g.waypoint)
      pin(g.waypoint.x, g.waypoint.z, 7, "#87dada", "diamond", "");
    for (let v of g.cars || [])
      if (
        v.mode === "police" &&
        g.stars &&
        Math.hypot(v.x - px, v.z - pz) < 125
      ) {
        c.fillStyle = Math.floor(g.time * 4) % 2 ? "#427fc0" : "#e96d65";
        c.fillRect(X(v.x, v.z) - 2.5, Z(v.x, v.z) - 2.5, 5, 5);
      }
    c.save();
    c.translate(X(px, pz), Z(px, pz));
    c.rotate(angle + (g.car ? g.car.heading : g.heroHeading));
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(6.1, 6.4);
    c.lineTo(0, 3.4);
    c.lineTo(-6.1, 6.4);
    c.closePath();
    c.fillStyle = "#fff8e6";
    c.strokeStyle = "#182e35";
    c.lineWidth = 2;
    c.fill();
    c.stroke();
    c.restore();
    if (full) {
      c.fillStyle = "#e0ede0";
      c.font = "italic 12px Georgia";
      c.textAlign = "center";
      c.save();
      c.translate(X(187, 18), Z(187, 18));
      c.rotate(angle - Math.PI / 2);
      c.fillText("A T L A N T I C   O C E A N", 0, 0);
      c.restore();
      c.font = "11px Cond";
      c.textAlign = "center";
      c.lineWidth = 3;
      c.strokeStyle = "#e9e4c5de";
      c.fillStyle = "#334e4e";
      for (let [name, x, z] of [
        ["NORTHPOINT", 16, -568],
        ["PORTSIDE", -128, -257],
        ["CIVIC CENTER", -107, -41],
        ["LITTLE SOL", -141, 212],
        ["WEST PALMS", -283, 47],
      ]) {
        c.strokeText(name, X(x, z), Z(x, z));
        c.fillText(name, X(x, z), Z(x, z));
      }
      c.fillStyle = "#e4eedf";
      c.textAlign = "left";
      c.font = "11px Cond";
      let bar = 100 * scale;
      c.fillText("100 M", 13, h - 18);
      c.fillRect(13, h - 13, bar, 2);
      c.fillRect(13, h - 17, 1, 6);
      c.fillRect(13 + bar, h - 17, 1, 6);
    }
  }
  worldAt(x, y) {
    let t = this.fullTransform;
    return t
      ? {
          x: ((x - t.ox) * t.cs + (y - t.oz) * t.sn) / t.scale,
          z: (-(x - t.ox) * t.sn + (y - t.oz) * t.cs) / t.scale,
        }
      : null;
  }
}
