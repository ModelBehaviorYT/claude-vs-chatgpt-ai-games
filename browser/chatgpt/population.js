import { T, Builder, rng, TAU, clamp, mix } from "./mesh.js";
import { XS, ZS, roadW, floorAt } from "./city.js";
import { carObject, paints } from "./cars.js";
import { personObject, pose } from "./people.js";
const r = rng(113844),
  choose = (a) => a[Math.floor(r() * a.length)],
  gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function nearestNode(world, x, z) {
  let best = world.nodes[0],
    bd = Infinity;
  for (let n of world.nodes) {
    let d = (x - n.x) ** 2 + (z - n.z) ** 2;
    if (d < bd) {
      best = n;
      bd = d;
    }
  }
  return best.id;
}
export function pathBetween(world, start, end) {
  if (start === end) return [start];
  let open = [start],
    from = new Map(),
    cost = new Map([[start, 0]]);
  while (open.length) {
    let i = 0;
    for (let j = 1; j < open.length; j++)
      if (
        cost.get(open[j]) + gap(world.nodes[open[j]], world.nodes[end]) <
        cost.get(open[i]) + gap(world.nodes[open[i]], world.nodes[end])
      )
        i = j;
    let n = open.splice(i, 1)[0];
    if (n === end) break;
    for (let b of world.nodes[n].links) {
      let next = cost.get(n) + gap(world.nodes[n], world.nodes[b]);
      if (!cost.has(b) || next < cost.get(b)) {
        cost.set(b, next);
        from.set(b, n);
        if (!open.includes(b)) open.push(b);
      }
    }
  }
  let ids = [end];
  while (ids[0] !== start && from.has(ids[0])) ids.unshift(from.get(ids[0]));
  return ids;
}
function bake(object) {
  let b = new Builder();
  object.updateMatrixWorld(true);
  object.traverse((m) => {
    if (!m.isMesh || !m.geometry.attributes.color || m.isSprite) return;
    b.base.copy(m.matrixWorld);
    b.add(m.geometry, 0xffffff, m.material);
  });
  return b.finish();
}
const bakedCars = new Map(),
  pedLow = new Map();
export class Population {
  constructor(g) {
    this.g = g;
    this.cars = g.cars = [];
    this.peds = g.peds = [];
    this.seq = 0;
    this.civSeq = 0;
    this.nextCop = 0;
    this.nearestCop = 9999;
    this.visibleCop = false;
    this.simAge = 0;
    let hero = this.spawnCar("sport", 0xeb674f, 82.55, 76.7, -0.035, "parked");
    hero.story = true;
    this.storyCar = hero;
    const add = (t, c, x, z, h) => this.spawnCar(t, c, x, z, h, "parked");
    add("classic", 0x8bcac4, 68.0, 61.4, Math.PI);
    add("suv", 0xd1bf97, 82.5, 52, -0.035);
    add("sedan", 0x3a7c90, 68.15, 86.1, Math.PI - 0.035);
    add("sport", 0xdfaf57, 82.7, 13, -0.015);
    add("taxi", 0xe8ad49, 68.4, 3, Math.PI);
    for (let j = 0; j < 25; j++) {
      let i = Math.floor(r() * XS.length),
        zi = Math.floor(r() * (ZS.length - 1)),
        x = XS[i],
        z = ZS[zi] + 15 + r() * 42,
        side = r() > 0.5 ? 1 : -1;
      if (x === 76 && z > 0 && z < 112) continue;
      add(
        choose(["sedan", "suv", "classic", "sport"]),
        choose(paints),
        x + side * (roadW(x) / 2 - 1.15),
        z,
        side === 1 ? 0 : Math.PI,
      );
    }
    const seeds = [
      [48, 41, 0.45],
      [41, 48, 0.6],
      [41, 34, 0.32],
      [34, 41, 0.66],
      [48, 47, 0.35],
      [40, 41, 0.6],
      [55, 48, 0.32],
      [47, 40, 0.43],
      [33, 34, 0.7],
      [54, 55, 0.4],
      [34, 27, 0.61],
      [27, 34, 0.5],
    ];
    for (let i = 0; i < 51; i++) {
      let ax = seeds[i]?.[0] ?? Math.floor(r() * 70),
        bx = seeds[i]?.[1] ?? choose(g.world.nodes[ax].links);
      if (!g.world.nodes[ax].links.includes(bx))
        bx = choose(g.world.nodes[ax].links);
      let car = this.spawnCar(
        choose(["sedan", "classic", "suv", "sedan", "sport", "taxi"]),
        choose(paints),
        0,
        0,
        0,
        "traffic",
      );
      this.setEdge(car, ax, bx, seeds[i]?.[2] ?? r());
      this.trafficPose(car);
      car.speed = car.cruise * 0.75;
    }
    for (let i = 0; i < 45; i++) {
      let ix = i < 12 ? 5 : Math.floor(r() * 6),
        j = i < 7 ? 5 : i < 12 ? 4 : Math.floor(r() * 9),
        x1 = XS[ix] + roadW(XS[ix]) / 2 + 1.9,
        x2 = XS[ix + 1] - roadW(XS[ix + 1]) / 2 - 1.9,
        z1 = ZS[j] + 8.45,
        z2 = ZS[j + 1] - 8.45;
      if (i < 7) {
        x1 = 91.7;
        x2 = 97.6;
        z1 = 43;
        z2 = 109;
      }
      let path = [
        { x: x1, z: z1 },
        { x: x2, z: z1 },
        { x: x2, z: z2 },
        { x: x1, z: z2 },
      ];
      let step = i < 3 ? 0 : Math.floor(r() * 4),
        f = i < 3 ? [0.25, 0.54, 0.82][i] : r();
      if (i < 3) {
        step = 1;
      }
      let a = path[step],
        b = path[(step + 1) % 4];
      this.spawnPed(
        mix(a.x, b.x, f),
        mix(a.z, b.z, f),
        i % 11,
        path,
        (step + 1) % 4,
      );
    }
  }
  spawnCar(type, paint, x, z, h, mode) {
    let o = carObject(this.g.world.atlas, type, paint, this.seq++);
    o.paint = paint;
    o.x = x;
    o.z = z;
    o.heading = h;
    o.mode = mode;
    o.cruise = 7.3 + r() * 4.7;
    o.aiTime = 0;
    o.lastSeen = 0;
    let key = type + "|" + paint;
    if (!bakedCars.has(key)) bakedCars.set(key, bake(o.root));
    o.low = bakedCars.get(key).clone();
    o.root.add(o.low);
    o.low.visible = false;
    this.g.scene.add(o.root);
    this.cars.push(o);
    this.syncCar(o, 0);
    return o;
  }
  spawnPed(x, z, id, path = null, step = 0) {
    let p = personObject(id),
      key = id % 11;
    p.x = x;
    p.z = z;
    p.id = this.civSeq++;
    p.path = path;
    p.step = step;
    p.speed = 0.72 + r() * 0.48;
    p.fear = 0;
    p.stun = 0;
    p.health = 70;
    p.homeX = x;
    p.homeZ = z;
    p.root.rotation.y = 0;
    let sz = 0.91 + r() * 0.15;
    p.root.scale.setScalar(sz);
    if (!pedLow.has(key)) pedLow.set(key, bake(p.root));
    p.low = pedLow.get(key).clone();
    p.root.add(p.low);
    p.low.visible = false;
    this.g.scene.add(p.root);
    p.root.position.set(x, 0.15, z);
    this.peds.push(p);
    return p;
  }
  setEdge(c, a, b, t = 0) {
    let ns = this.g.world.nodes;
    c.from = a;
    c.to = b;
    let choices = ns[b].links.filter((i) => i !== a),
      n = choices.length ? choose(choices) : a;
    if (c.preferred?.length && ns[b].links.includes(c.preferred[0]))
      n = c.preferred.shift();
    c.next = n;
    c.turning = false;
    c.progress = t;
    this.edgeData(c);
  }
  edgeData(c) {
    let ns = this.g.world.nodes,
      A = ns[c.from],
      B = ns[c.to],
      C = ns[c.next],
      len = gap(A, B) || 1,
      dx = (B.x - A.x) / len,
      dz = (B.z - A.z) / len,
      nlen = gap(B, C) || 1,
      nx = (C.x - B.x) / nlen,
      nz = (C.z - B.z) / nlen,
      lane = A.x === B.x && A.x === -252 ? 4.2 : 2.55,
      nextLane = B.x === C.x && B.x === -252 ? 4.2 : 2.55,
      corner = 7;
    c.a = {
      x: A.x + dx * corner - dz * lane,
      z: A.z + dz * corner + dx * lane,
    };
    c.b = {
      x: B.x - dx * corner - dz * lane,
      z: B.z - dz * corner + dx * lane,
    };
    c.end = {
      x: B.x + nx * corner - nz * nextLane,
      z: B.z + nz * corner + nx * nextLane,
    };
    c.ctrl = {
      x: B.x - dz * lane - nz * nextLane,
      z: B.z + dx * lane + nx * nextLane,
    };
    c.edgeLen = gap(c.a, c.b);
    c.turnLen = Math.max(6, gap(c.b, c.ctrl) + gap(c.ctrl, c.end));
    c.axis = A.x === B.x ? 0 : 1;
  }
  trafficPose(c) {
    let t = c.progress;
    if (c.turning) {
      let q = 1 - t;
      c.x = q * q * c.b.x + 2 * q * t * c.ctrl.x + t * t * c.end.x;
      c.z = q * q * c.b.z + 2 * q * t * c.ctrl.z + t * t * c.end.z;
      c.heading = Math.atan2(
        q * (c.ctrl.x - c.b.x) + t * (c.end.x - c.ctrl.x),
        -(q * (c.ctrl.z - c.b.z) + t * (c.end.z - c.ctrl.z)),
      );
    } else {
      c.x = mix(c.a.x, c.b.x, t);
      c.z = mix(c.a.z, c.b.z, t);
      c.heading = Math.atan2(c.b.x - c.a.x, c.a.z - c.b.z);
    }
  }
  advance(c, dt, flow = true) {
    let g = this.g,
      dist = gap(c, g),
      limit = c.cruise;
    if (c.turning) limit *= 0.68;
    if (flow && dist < 150 && !c.turning) {
      let remain = (1 - c.progress) * c.edgeLen,
        signal = g.world.signals.includes(c.to);
      if (
        signal &&
        g.world.trafficPhase(c.to, g.time) !== c.axis &&
        remain < 12
      )
        limit = Math.min(limit, Math.max(0, (remain - 3.2) * 1.6));
      if (dist < 100) {
        let sx = Math.sin(c.heading),
          sz = -Math.cos(c.heading);
        for (let v of this.cars) {
          if (v === c || Math.abs(v.x - c.x) > 13 || Math.abs(v.z - c.z) > 13)
            continue;
          let dx = v.x - c.x,
            dz = v.z - c.z,
            ahead = dx * sx + dz * sz,
            side = Math.abs(dx * sz - dz * sx);
          if (ahead > 1 && ahead < 12 && side < 1.67)
            limit = Math.min(limit, Math.max(0, (ahead - 5) * 1.2));
        }
      }
      if (
        !g.car &&
        dist < 8 &&
        Math.abs(wrap(Math.atan2(g.x - c.x, c.z - g.z) - c.heading)) < 0.24
      )
        limit = 0;
    }
    c.speed = mix(
      c.speed,
      limit,
      clamp(dt * (limit < c.speed ? 5 : 1.1), 0, 1),
    );
    c.progress +=
      (Math.max(0, c.speed) * dt) / (c.turning ? c.turnLen : c.edgeLen);
    if (c.progress >= 1) {
      let rem = c.progress - 1;
      if (c.turning) {
        let a = c.to,
          b = c.next;
        this.setEdge(c, a, b, 0);
        c.progress = clamp(rem * 0.23, 0, 0.3);
      } else {
        c.turning = true;
        c.progress = clamp((rem * c.edgeLen) / c.turnLen, 0, 0.95);
      }
    }
    this.trafficPose(c);
  }
  syncCar(c, dt) {
    let g = this.g,
      root = c.root,
      dist = Math.hypot(c.x - (g.x ?? 86), c.z - (g.z ?? 83));
    root.visible = dist < 235 || c === g.car;
    if (!root.visible) return;
    let y = Math.max(0, floorAt(c.x, c.z));
    root.position.set(c.x, y + 0.026, c.z);
    root.rotation.y = -c.heading;
    let low = dist > 24 && c !== g.car;
    if (c.low) {
      c.low.visible = low;
      c.body.visible = !low;
      c.driver.visible = !low && c.mode !== "parked" && c.mode !== "wreck";
      c.wheels.forEach((o) => (o.pivot.visible = !low));
    }
    c.body.scale.y = 1 - c.crumple * 0.0008;
    c.body.rotation.z = mix(
      c.body.rotation.z,
      -(c.steer || 0) * Math.min(0.065, Math.abs(c.speed) * 0.002),
      Math.min(1, dt * 8),
    );
    for (let w of c.wheels) {
      w.wheel.rotation.x -= (c.speed * dt) / c.model.R;
      if (w.front) w.pivot.rotation.y = -(c.steer || 0) * 0.28;
    }
    c.beams.visible = g.day < 0.6 && c.mode !== "parked" && dist < 110;
    for (let i = 0; i < c.flares.length; i++)
      c.flares[i].visible =
        c.mode === "police" && (Math.floor(g.time * 8) + i) % 2 === 0;
  }
  scare(x, z, radius) {
    for (let p of this.peds)
      if (!p.stun && Math.hypot(x - p.x, z - p.z) < radius) {
        p.fear = 5 + r() * 5;
        p.danger = { x, z };
      }
  }
  knock(p, hard = true) {
    if (p.stun) return;
    p.stun = hard ? 18 : 4;
    p.fear = 6;
    p.health = 70;
    this.g.hitUntil = this.g.time + 0.24;
    this.scare(p.x, p.z, 34);
  }
  nearestCar(max = 4.6) {
    let best = null,
      bestD = max;
    for (let c of this.cars) {
      let d = gap(c, this.g);
      if (d < bestD && c.health > 0) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }
  policeSpawn() {
    let g = this.g,
      active = this.cars.filter((c) => c.mode === "police"),
      wanted = Math.min(7, g.stars + Math.max(0, g.stars - 2));
    if (!g.stars || active.length >= wanted || g.searching) return;
    let target = g.world.nodes[nearestNode(g.world, g.x, g.z)],
      cands = g.world.nodes.filter(
        (n) => gap(n, g) > 45 && gap(n, g) < 132 && n.links.length > 1,
      );
    if (!cands.length) cands = [target];
    let cand = cands.sort((a, b) => gap(a, g) - gap(b, g))[
        Math.min(cands.length - 1, active.length % 3)
      ],
      b = cand.links
        .slice()
        .sort((a, b) => gap(g.world.nodes[a], g) - gap(g.world.nodes[b], g))[0];
    let reuse = this.cars.find(
        (c) =>
          c.type === "police" &&
          c.mode !== "police" &&
          c !== g.car &&
          gap(c, g) > 70,
      ),
      c =
        reuse || this.spawnCar("police", 0x233844, cand.x, cand.z, 0, "police");
    c.mode = "police";
    c.health = 100;
    c.crumple = 0;
    c.hitCooldown = 0;
    c.aiTime = 0;
    c.speed = 9;
    c.policePath = [];
    c.repath = 0;
    c.shot = g.time + 4;
    this.setEdge(c, cand.id, b, 0.08);
    this.trafficPose(c);
    this.syncCar(c, 0);
  }
  lineClear(x, z, xx, zz) {
    let dx = xx - x,
      dz = zz - z,
      len = Math.hypot(dx, dz),
      steps = Math.ceil(len / 3);
    for (let i = 1; i < steps; i++) {
      let o = this.g.world.hit(
        x + (dx * i) / steps,
        z + (dz * i) / steps,
        0.16,
      );
      if (o && o.type === "building") return false;
    }
    return true;
  }
  police(c, dt) {
    let g = this.g,
      d = gap(c, g);
    this.nearestCop = Math.min(this.nearestCop, d);
    let visible = d < 75 && this.lineClear(c.x, c.z, g.x, g.z);
    if (visible) {
      this.visibleCop = true;
      g.lastKnown = { x: g.x, z: g.z };
    }
    if (!g.stars) {
      c.mode = "traffic";
      let a = nearestNode(g.world, c.x, c.z);
      this.setEdge(c, a, choose(g.world.nodes[a].links));
      return;
    }
    if (d > 245) {
      c.mode = "parked";
      c.speed = 0;
      this.nextCop = g.time + 1;
      return;
    }
    let clue = g.lastKnown || g;
    let target;
    if (visible && d < 62) {
      target = { x: g.x, z: g.z };
      c.repath = 0;
    } else {
      if (g.time >= c.repath || !c.policePath?.length) {
        let n = nearestNode(g.world, c.x, c.z),
          end = nearestNode(g.world, clue.x, clue.z);
        if (g.searching && gap(c, clue) < 21) {
          let links = g.world.nodes[end].links;
          end = links[(c.id + Math.floor(g.time / 6)) % links.length];
        }
        c.policePath = pathBetween(g.world, n, end).map(
          (i) => g.world.nodes[i],
        );
        if (
          c.policePath.length > 1 &&
          gap(c, c.policePath[1]) < gap(c, c.policePath[0]) + 6
        )
          c.policePath.shift();
        c.repath = g.time + 3;
      }
      if (c.policePath.length > 1 && gap(c, c.policePath[0]) < 7)
        c.policePath.shift();
      target = c.policePath[0] || clue;
    }
    let goal = Math.atan2(target.x - c.x, c.z - target.z),
      delta = wrap(goal - c.heading);
    c.steer = clamp(delta * 1.7, -1, 1);
    let desired =
      (g.car ? Math.min(32, 14 + Math.abs(g.car.speed) * 0.69) : 10) +
      g.stars * 0.85;
    if (!visible && g.searching) desired *= 0.49;
    if (d < 7 && !g.car) desired = 1.1;
    if (Math.abs(delta) > 1.2) desired *= 0.55;
    if (c.hitCooldown > 0.1) desired *= 0.5;
    c.heading += clamp(
      delta,
      -dt * (1.5 + Math.abs(c.speed) * 0.045),
      dt * (1.5 + Math.abs(c.speed) * 0.045),
    );
    c.speed = mix(c.speed, desired, Math.min(1, dt * 1.08));
    let nx = c.x + Math.sin(c.heading) * c.speed * dt,
      nz = c.z - Math.cos(c.heading) * c.speed * dt;
    if (g.safe(nx, nz, 1.03)) {
      c.x = nx;
      c.z = nz;
      c.stuck = 0;
    } else {
      c.stuck = (c.stuck || 0) + dt;
      c.speed *= 0.88;
      c.heading += dt * (c.id % 2 ? 1 : -1) * 1.9;
      c.repath = 0;
      if (c.stuck > 1.8) {
        let n = g.world.nodes[nearestNode(g.world, c.x, c.z)];
        c.x = mix(c.x, n.x, 0.12);
        c.z = mix(c.z, n.z, 0.12);
        c.stuck = 0;
      }
    }
    if (d < 3.5 && g.car && c.hitCooldown <= 0) {
      g.carImpact(g.car, Math.max(5, Math.abs(c.speed) * 0.6), c);
      c.hitCooldown = 2;
    }
    if (visible && d < (g.car ? 19 : 25) && g.time > c.shot && !g.dead) {
      c.shot = g.time + (g.car ? 3.8 : 2.9) + r() * 1.8;
      g.tracer(c.x, 1.05, c.z, g.x, 1.06, g.z, 0xffcf80);
      g.damage(3 + g.stars * 1.4);
      if (d < 12) g.sound.fx("fire");
    }
  }
  update(dt) {
    let g = this.g;
    this.nearestCop = 9999;
    this.visibleCop = false;
    if (g.stars && g.time >= this.nextCop) {
      this.policeSpawn();
      this.nextCop = g.time + 3.3;
    }
    for (let c of this.cars) {
      c.hitCooldown = Math.max(0, c.hitCooldown - dt);
      if (c.mode === "traffic") this.advance(c, dt);
      else if (c.mode === "police") this.police(c, dt);
      if (c.mode === "wreck") c.speed = 0;
      this.syncCar(c, dt);
    }
    for (let p of this.peds) {
      let dist = gap(p, g);
      p.root.visible = dist < 128;
      if (!p.root.visible) continue;
      let lo = dist > 30;
      p.low.visible = lo;
      p.torso.visible = !lo;
      for (let l of p.legs) l.hip.visible = !lo;
      if (p.stun > 0) {
        p.stun -= dt;
        p.root.rotation.z = mix(p.root.rotation.z, 1.48, clamp(dt * 8, 0, 1));
        p.root.position.y = 0.21;
        if (p.stun <= 0) {
          p.root.rotation.z = 0;
          p.health = 70;
        }
        continue;
      }
      p.root.rotation.z = 0;
      p.fear = Math.max(0, p.fear - dt);
      let dest = p.path?.[p.step],
        speed = p.speed,
        h = p.heading;
      if (p.fear > 0) {
        let away = Math.atan2(
          p.x - (p.danger?.x ?? g.x),
          (p.danger?.z ?? g.z) - p.z,
        );
        h = away + 0.3 * Math.sin(p.id + g.time);
        speed = 4.3;
      } else if (dest) {
        if (gap(p, dest) < 0.8) {
          p.step = (p.step + 1) % p.path.length;
          dest = p.path[p.step];
        }
        h = Math.atan2(dest.x - p.x, p.z - dest.z);
      } else {
        h = p.heading;
        speed = 0.7;
      }
      let nx = p.x + Math.sin(h) * speed * dt,
        nz = p.z - Math.cos(h) * speed * dt;
      if (!g.safe(nx, nz, 0.25)) {
        h += Math.PI * 0.5;
        if (!p.fear && p.path) p.step = (p.step + 1) % p.path.length;
        nx = p.x + Math.sin(h) * speed * dt;
        nz = p.z - Math.cos(h) * speed * dt;
      }
      if (g.safe(nx, nz, 0.24)) {
        p.x = nx;
        p.z = nz;
      }
      p.heading += wrap(h - p.heading) * Math.min(1, dt * 7);
      p.root.position.set(p.x, Math.max(0.14, floorAt(p.x, p.z)), p.z);
      p.root.rotation.y = -p.heading;
      if (!lo) pose(p, dt, speed);
      else p.low.rotation.z = Math.sin(g.time * 5 + p.id) * 0.018;
      if (
        g.car &&
        Math.abs(g.car.speed) > 5 &&
        Math.hypot(g.x - p.x, g.z - p.z) < 1.8
      ) {
        this.knock(p);
        g.crime(1.04);
        g.sound.fx("hit");
      } else if (g.car && Math.abs(g.car.speed) > 10 && dist < 8 && !p.fear) {
        p.fear = 3 + r() * 3;
        p.danger = { x: g.x, z: g.z };
      }
    }
  }
}
