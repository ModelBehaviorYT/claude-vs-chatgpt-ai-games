import { streetArt } from "./streetart.js";
import { T, rng, TAU, mix, clamp, Builder, unlit, double } from "./mesh.js";
import {
  createCity,
  SPAWN,
  HOSPITAL,
  SHOP,
  GARAGE,
  XS,
  ZS,
  locationAt,
} from "./city.js";
import { personObject, pose } from "./people.js";
import { Population, nearestNode, pathBetween, wrap } from "./population.js";
import { AtlasMap } from "./map.js";
import { Interface } from "./interface.js";
import { Sound, STATIONS } from "./sound.js";
import { haloTex, paintEnvironment } from "./cars.js";
const rand = rng(4203),
  SAVE = "sundown.portazure.story.v2",
  PREF = "sundown.portazure.settings.v2",
  dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const JOBS = [
  ["Borrowed Sunshine", "Take the coral Veloce from the valet stand."],
  ["Borrowed Sunshine", "Deliver the Veloce to Pelican Motors."],
  ["Dead Air", "Collect Imani’s master tape at Costa Records."],
  ["Dead Air", "Take the tape to the Northpoint transmitter."],
  ["The Long Way Home", "Meet Imani at the Paloma fishing pier."],
  ["The Long Way Home", "Collect the ledger from the North Quay office."],
  ["The Long Way Home", "Lose the patrols and stay out of sight."],
  ["The Long Way Home", "Bring the ledger to the Bellamar Hotel."],
  ["Port Azure is yours", "Explore the coast. Shops and garages are open."],
];
const tape = { x: 65, z: -50 },
  tower = { x: 19.5, z: -557 },
  pier = { x: 98.1, z: -134 },
  quay = { x: -178.6, z: -250 },
  hotel = { x: 65, z: 65.2 };
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export class Game {
  constructor() {
    this.options = {
      quality: "High",
      fov: 62,
      sens: 70,
      volume: 55,
      ...read(PREF),
    };
    this.keys = {};
    this.time = 0;
    this.hour = 15.28;
    this.day = 1;
    this.health = 100;
    this.armor = 45;
    this.cash = 420;
    this.heat = 0;
    this.stars = 0;
    this.stage = 0;
    this.weapon = 0;
    this.mag = [0, 12, 30];
    this.reserve = [0, 72, 150];
    this.reloadEnd = 0;
    this.hurtUntil = 0;
    this.hitUntil = 0;
    this.dead = false;
    this.aim = false;
    this.firing = false;
    this.nextShot = 0;
    this.fightUntil = 0;
    this.x = SPAWN.x;
    this.z = SPAWN.z;
    this.y = 0.16;
    this.heroHeading = this.yaw = -0.58;
    this.pitch = -0.105;
    this.car = null;
    this.jumpV = 0;
    this.speed = 0;
    this.walkSpeed = 0;
    this.stepTime = 0;
    this.autoSave = 0;
    this.clockTick = 0;
    this.renderCount = 0;
    this.camOrbit = 0;
    this.camUp = 0;
    this.lastLook = -20;
    this.camSnap = true;
    this.hudAt = 0;
    this.routeStamp = "";
    this.saveStatus = true;
    this.dangerTime = -50;
    this.searchTimer = 0;
    this.searching = false;
    this.particles = [];
    this.traces = [];
    this.tracks = [];
    this.grace = 0;
    this.auto = false;
    this.demo = false;
    this.demoAge = 0;
    this.sound = new Sound();
    this.scene = new T.Scene();
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x95cadd);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D view of Port Azure",
    );
    document.querySelector("#game").append(this.renderer.domElement);
    this.camera = new T.PerspectiveCamera(
      this.options.fov,
      innerWidth / innerHeight,
      0.08,
      3700,
    );
    this.scene.fog = new T.FogExp2(0xd5e6df, 0.00365);
    this.hemi = new T.HemisphereLight(0xfff7e9, 0x91aab5, 1.57);
    this.sun = new T.DirectionalLight(0xffebcc, 2.16);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.00036;
    this.sun.shadow.normalBias = 0.031;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -47,
      right: 47,
      top: 47,
      bottom: -47,
      near: 0.8,
      far: 240,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.radius = 2;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.world = createCity(this.scene);
    this.streetLighting = streetArt(this.scene, this.world);
    this.hero = personObject(0, true);
    this.scene.add(this.hero.root);
    this.pop = new Population(this);
    this.minimap = new AtlasMap(this.world);
    this.createEffects();
    this.configureLandmarks();
    this.refreshJob();
    this.ui = new Interface(this);
    this.input();
    this.applyOptions(false);
    this.setEnvironment(true);
    this.initQuery();
    this.cameraUpdate(1, true);
    this.lastFrame = this.demoClock = performance.now();
    this.loop = this.loop.bind(this);
    if (this.ui.screen === "play") {
      this.step(0.001);
      this.cameraUpdate(0, true);
      this.drawFrame(0.001);
    } else if (this.ui.screen === "pause")
      this.renderer.render(this.scene, this.camera);
    setInterval(() => {
      if (!this.auto || !this.demo || this.ui.screen !== "play") return;
      let now = performance.now();
      this.advanceDemo(now);
      if (now - this.lastDraw > 420) this.drawFrame(0.1);
    }, 66);
    requestAnimationFrame(this.loop);
  }
  hasSave() {
    let d = read(SAVE);
    return !!d && d.version === 2;
  }
  applyOptions(write = true) {
    let o = this.options;
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        o.quality === "High" ? 1.6 : o.quality === "Medium" ? 1.12 : 0.78,
      ) * (o.quality === "Low" ? 0.85 : 1),
    );
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = o.quality !== "Low";
    let res = o.quality === "High" ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== res) {
      this.sun.shadow.mapSize.set(res, res);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.fov = o.fov;
    this.camera.updateProjectionMatrix();
    this.sound.setVolume(o.volume / 100);
    if (write)
      try {
        localStorage.setItem(PREF, JSON.stringify(o));
      } catch {}
  }
  configureLandmarks() {
    let w = this.world,
      b = new Builder();
    b.at(tower.x + 7, 0, tower.z, 0, () => {
      for (let s of [-1, 1]) {
        b.beam([s * 2, 0, -1.5], [0, 21, 0], 0.16, 0.065, 0xb7aca0);
        b.beam([s * 2, 0, 1.5], [0, 21, 0], 0.16, 0.065, 0xc8947d);
      }
      for (let j = 0; j < 6; j++) {
        let h = j * 3,
          a = 2 * (1 - h / 21),
          q = 2 * (1 - (h + 3) / 21);
        b.beam([-a, h, -a * 0.7], [q, h + 3, -q * 0.7], 0.067, 0.067, 0xb8735d);
        b.beam([a, h, -a * 0.7], [-q, h + 3, -q * 0.7], 0.067, 0.067, 0xb8735d);
      }
      b.cyl(0, 22, 0, 0.045, 0.09, 3, 0xccc3b5);
      b.oval(0, 23.6, 0, 0.115, 0.115, 0.115, 0xff583d, 0, 0, 0, unlit);
      w.atlas.sign(
        b,
        0,
        2,
        1.48,
        3.4,
        1.15,
        "MARÉ FM",
        "#23736e",
        "#f8e0a7",
        0,
        "bold 67px Cond",
        "N O R T H P O I N T",
      );
    });
    for (let [p, txt, bg] of [
      [SHOP, "SUNSET SUPPLY", "#486d68"],
      [GARAGE, "PELICAN MOTORS", "#aa674e"],
      [tape, "COSTA RECORDS", "#437c83"],
    ]) {
      b.cyl(p.x + 0.9, 1.4, p.z, 0.09, 0.12, 2.8, 0x708680, 8);
      b.box(p.x + 0.9, 2.9, p.z, 3.15, 1.07, 0.19, bg);
      w.atlas.sign(
        b,
        p.x + 0.9,
        2.92,
        p.z + 0.103,
        3.01,
        0.89,
        txt,
        bg,
        "#fff2cd",
        0,
        "bold 65px Cond",
      );
    }
    this.scene.add(b.finish());
    this.imani = this.pop.spawnPed(pier.x + 0.85, pier.z - 0.7, 1);
    this.imani.story = true;
    this.imani.speed = 0;
    this.imani.homeX = this.imani.x;
    this.imani.homeZ = this.imani.z;
  }
  createEffects() {
    this.dustGeo = new T.IcosahedronGeometry(1, 0);
    this.sparkGeo = new T.SphereGeometry(1, 5, 3);
    this.smokeMat = new T.MeshBasicMaterial({
      color: 0x657073,
      transparent: true,
      opacity: 0.39,
      depthWrite: false,
    });
    this.sparkMat = new T.MeshBasicMaterial({ color: 0xffc37c });
    this.fxLine = new T.LineBasicMaterial({
      color: 0xffda88,
      transparent: true,
      opacity: 0.9,
    });
    this.ring = new T.Mesh(
      new T.RingGeometry(1.28, 1.44, 48),
      new T.MeshBasicMaterial({
        color: 0xffaf66,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.skidMat = new T.MeshBasicMaterial({
      color: 0x323a3b,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
    this.skidGeo = new T.PlaneGeometry(0.15, 1);
    this.skidGeo.rotateX(-Math.PI / 2);
    this.temp = new T.Vector3();
    this.target = new T.Vector3();
    this.ideal = new T.Vector3();
    this.forward = new T.Vector3();
    this.carLamps = [
      new T.SpotLight(0xffe7bd, 0, 37, 0.47, 0.6, 1.05),
      new T.SpotLight(0xffe7bd, 0, 37, 0.47, 0.6, 1.05),
    ];
    for (let l of this.carLamps) this.scene.add(l, l.target);
  }
  initQuery() {
    let q = new URLSearchParams(location.search),
      names = [
        "title",
        "options",
        "quit",
        "pause",
        "controls",
        "driving",
        "chase",
        "night",
        "map",
        "walk",
        "shop",
        "bridge",
        "beach",
        "downtown",
        "combat",
      ];
    let scene = (
      q.get("scene") ||
      q.get("view") ||
      q.get("screen") ||
      q.get("menu") ||
      names.find((s) => q.has(s)) ||
      ""
    ).toLowerCase();
    scene =
      {
        drive: "driving",
        police: "chase",
        game: "walk",
        start: "title",
        onfoot: "walk",
      }[scene] || scene;
    if (
      (q.get("autoplay") === "1" &&
        !["title", "options", "quit"].includes(scene)) ||
      (scene && !["options", "title", "quit"].includes(scene))
    ) {
      this.demo = true;
      this.start(false, true);
      this.auto = q.get("autoplay") === "1";
      this.demoScene = scene || "tour";
      if (["driving", "night", "chase", "bridge", "downtown"].includes(scene)) {
        let c = this.pop.storyCar;
        this.enter(c, true);
        this.stage = 1;
        c.x = 78.65;
        c.z = scene === "chase" ? 30.8 : scene === "night" ? 61.8 : 82.5;
        c.heading = 0;
        c.speed = scene === "chase" ? 17 : 11.8;
        if (scene === "bridge") {
          c.x = 15.45;
          c.z = -469;
          c.heading = Math.PI;
          c.speed = 16;
        } else if (scene === "downtown") {
          c.x = -109.4;
          c.z = -7;
          c.speed = 13;
        }
        for (let v of this.cars) {
          if (
            v !== c &&
            v.mode === "traffic" &&
            Math.abs(v.x - c.x) < 2.4 &&
            Math.abs(v.z - c.z) < 25
          ) {
            this.pop.setEdge(v, 41, 34, 0.32 + (v.id % 4) * 0.13);
            this.pop.trafficPose(v);
          }
        }
        this.x = c.x;
        this.z = c.z;
        this.demoAge = 4.5;
        this.camOrbit =
          scene === "chase" ? -0.24 : scene === "bridge" ? 0.11 : -0.28;
        this.lastLook = this.time + 5;
        if (scene === "chase") {
          this.heat = 3.4;
          this.stars = 3;
          this.dangerTime = 0;
          let v = this.pop.spawnCar("police", 0x273744, 74, 14, 0.39, "police");
          v.speed = 8;
          v.repath = 0;
          v.shot = 7;
          let v2 = this.pop.spawnCar(
            "police",
            0x283943,
            82.2,
            40,
            -0.18,
            "police",
          );
          v2.speed = 13;
          v2.shot = 7;
          v2.repath = 0;
          this.nextPolice = 7;
        }
        if (scene === "night") this.hour = 22.28;
      }
      if (scene === "beach") {
        this.x = 129;
        this.z = 16;
        this.yaw = this.heroHeading = 1.15;
        this.pitch = -0.08;
      }
      if (scene === "combat") {
        this.weapon = this.hero.weapon = 2;
        this.aim = true;
        this.yaw = this.heroHeading = -0.45;
        this.heat = 2.3;
        this.stars = 3;
        this.lastKnown = { x: this.x, z: this.z };
        this.pop.policeSpawn();
      }
      if (["map", "pause", "controls", "shop"].includes(scene)) {
        if (scene === "shop") this.shopType = "supply";
        this.ui.show(scene, "play");
      }
      this.refreshJob();
      this.setEnvironment(true);
    } else if (scene === "options" || scene === "quit")
      this.ui.show(scene, "title");
    if (q.get("time") === "night" || q.get("night") === "1") this.hour = 22.3;
    if (q.has("quality")) {
      let val = q.get("quality");
      if (["High", "Medium", "Low"].includes(val)) this.options.quality = val;
      this.applyOptions(false);
    }
    if (this.auto && q.has("t")) {
      let seek = clamp(Number(q.get("t")) || 0, 0, 120);
      for (let j = 0; j < Math.ceil(seek * 30); j++) this.step(1 / 30);
      this.camSnap = true;
    }
  }
  safe(x, z, rad = 0.35) {
    return this.world.floorAt(x, z) > -0.5 && !this.world.hit(x, z, rad);
  }
  clearSpot(x, z, r = 0.4) {
    if (this.safe(x, z, r)) return { x, z };
    for (let n = 1; n <= 28; n++)
      for (let a = 0; a < 12; a++) {
        let xx = x + Math.cos((a * TAU) / 12) * n * 0.7,
          zz = z + Math.sin((a * TAU) / 12) * n * 0.7;
        if (this.safe(xx, zz, r)) return { x: xx, z: zz };
      }
    return { ...SPAWN };
  }
  save(feedback = false) {
    if (this.demo || this.dead) return false;
    let c = this.car,
      d = {
        version: 2,
        x: this.x,
        z: this.z,
        yaw: this.yaw,
        heading: this.heroHeading,
        hour: this.hour,
        health: this.health,
        armor: this.armor,
        cash: this.cash,
        weapon: this.weapon,
        mag: this.mag,
        reserve: this.reserve,
        heat: this.heat,
        stage: this.stage,
        station: this.sound.station,
        car: c
          ? {
              type: c.type,
              paint: c.paint,
              x: c.x,
              z: c.z,
              h: c.heading,
              health: c.health,
              story: !!c.story,
            }
          : null,
        story: {
          x: this.pop.storyCar.x,
          z: this.pop.storyCar.z,
          h: this.pop.storyCar.heading,
          health: this.pop.storyCar.health,
        },
        waypoint: this.waypoint,
      };
    try {
      localStorage.setItem(SAVE, JSON.stringify(d));
      return true;
    } catch {
      return false;
    }
  }
  start(load = false, preview = false) {
    if (!preview) {
      this.demo = false;
      this.auto = false;
      this.demoScene = "";
      this.sound.unlock();
    }
    if (this.car) {
      this.car.mode = "parked";
      this.car.speed = 0;
    }
    this.car = null;
    this.demoAge = 0;
    this.heat = this.stars = 0;
    this.stage = 0;
    this.health = 100;
    this.armor = 45;
    this.cash = 420;
    this.weapon = 0;
    this.mag = [0, 12, 30];
    this.reserve = [0, 72, 150];
    this.x = SPAWN.x;
    this.z = SPAWN.z;
    this.hour = 15.28;
    this.heroHeading = this.yaw = -0.58;
    this.pitch = -0.085;
    this.dead = false;
    this.y = 0.16;
    this.jumpV = 0;
    this.fightUntil = this.reloadEnd = 0;
    this.speed = this.walkSpeed = 0;
    this.searchTimer = 0;
    this.searching = false;
    this.grace = this.time + 2;
    this.waypoint = null;
    this.camSnap = true;
    this.camOrbit = 0;
    this.ui.toastEnd = 0;
    this.ui.bannerEnd = 0;
    let sc = this.pop.storyCar;
    Object.assign(sc, {
      x: 82.55,
      z: 76.7,
      heading: -0.035,
      health: 100,
      crumple: 0,
      mode: "parked",
      speed: 0,
    });
    for (let c of this.cars)
      if (c.mode === "police") {
        c.mode = "parked";
        c.speed = 0;
      }
    if (load) {
      let d = read(SAVE);
      if (d?.version === 2) {
        let spot = this.clearSpot(d.x, d.z);
        this.x = spot.x;
        this.z = spot.z;
        this.yaw = d.yaw;
        this.heroHeading = d.heading;
        this.hour = d.hour;
        this.health = clamp(d.health, 1, 100);
        this.armor = clamp(d.armor, 0, 100);
        this.cash = d.cash;
        this.weapon = d.weapon;
        this.mag = d.mag.slice();
        this.reserve = d.reserve.slice();
        this.heat = d.heat || 0;
        this.stars = Math.ceil(this.heat);
        this.dangerTime = this.time;
        this.stage = clamp(d.stage, 0, 8);
        this.waypoint = d.waypoint;
        this.sound.station = d.station || 0;
        if (d.story)
          Object.assign(sc, {
            x: d.story.x,
            z: d.story.z,
            heading: d.story.h,
            health: Math.max(25, d.story.health),
          });
        if (d.car) {
          let v = d.car.story
            ? sc
            : this.pop.spawnCar(
                d.car.type,
                d.car.paint,
                d.car.x,
                d.car.z,
                d.car.h,
                "parked",
              );
          Object.assign(v, {
            x: d.car.x,
            z: d.car.z,
            heading: d.car.h,
            health: Math.max(10, d.car.health),
            speed: 0,
            mode: "player",
          });
          this.car = v;
          this.x = v.x;
          this.z = v.z;
        }
      }
    }
    this.hero.root.visible = !this.car;
    this.hero.weapon = this.weapon;
    this.ui.show("play");
    this.refreshJob();
    this.setEnvironment(true);
    this.cameraUpdate(1, true);
    this.autoSave = this.time + 8;
    if (!preview) {
      this.lock();
      if (load) this.ui.notify("Save loaded", "Welcome back to Port Azure.");
      else
        this.ui.notify("Imani Cruz", "“The coral coupe. Keys are in it.”", 4);
    }
  }
  lock() {
    try {
      let p = this.renderer.domElement.requestPointerLock?.();
      p?.catch?.(() => {});
    } catch {}
  }
  input() {
    let canvas = this.renderer.domElement;
    onresize = () => {
      this.applyOptions(false);
      this.ui.drawMap();
    };
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
      if (
        ["Space", "Tab", "KeyM", "ArrowUp", "ArrowDown"].includes(e.code) &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement)
      )
        e.preventDefault();
      if (this.ui.screen !== "play") {
        if (
          !e.repeat &&
          !(e.target instanceof HTMLSelectElement) &&
          !(e.target instanceof HTMLInputElement)
        )
          this.ui.nav(e.code);
        else if (e.code === "Escape") this.ui.act("back");
        return;
      }
      this.keys[e.code] = true;
      if (e.repeat) return;
      if (!this.sound.ctx) this.sound.unlock();
      if (this.auto) {
        this.auto = false;
        this.demoScene = "";
        this.ui.notify("Manual control", "You have the wheel.");
      }
      if (e.code === "Escape") {
        this.ui.show("pause", "play");
        return;
      }
      if (e.code === "KeyM") {
        this.ui.show("map", "play");
        return;
      }
      if (e.code === "Tab") {
        this.ui.show("controls", "play");
        return;
      }
      if (this.dead) return;
      if (e.code === "KeyF") {
        if (this.car) this.exitCar();
        else {
          let v = this.pop.nearestCar(5);
          if (v) this.enter(v);
          else
            this.ui.notify(
              "No vehicle in reach",
              "Walk up to a driver’s door.",
              1.8,
            );
        }
      }
      if (e.code === "KeyE") this.interact();
      if (e.code === "Space" && !this.car && this.grounded) {
        this.jumpV = 5.5;
        this.grounded = false;
      }
      if (/^Digit[123]$/.test(e.code) && !this.car) {
        this.weapon = Number(e.code.at(-1)) - 1;
        this.hero.weapon = this.weapon;
        this.reloadEnd = 0;
        this.sound.fx("ui");
      }
      if (e.code === "KeyR" && !this.car) this.reload();
      if (this.car && e.code === "KeyT") {
        this.sound.station = (this.sound.station + 1) % 4;
        this.sound.next = 0;
        this.ui.notify("Radio", STATIONS[this.sound.station]);
      }
      if (this.car && e.code === "KeyH") {
        this.sound.fx("horn");
        this.pop.scare(this.x, this.z, 6);
      }
    });
    document.addEventListener("keyup", (e) => {
      delete this.keys[e.code];
    });
    document.addEventListener("mousemove", (e) => {
      if (
        this.ui.screen !== "play" ||
        this.dead ||
        (!document.pointerLockElement && !this.dragLook)
      )
        return;
      let sens = (0.0024 * this.options.sens) / 70;
      if (this.car) {
        this.camOrbit += e.movementX * sens;
        this.camUp = clamp(this.camUp + e.movementY * sens, -0.25, 0.45);
      } else {
        this.yaw += e.movementX * sens;
        this.pitch = clamp(this.pitch - e.movementY * sens, -0.85, 0.65);
      }
      this.lastLook = this.time;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.ui.screen !== "play") return;
      this.sound.unlock();
      if (this.auto) {
        this.auto = false;
        this.demoScene = "";
      }
      this.lock();
      this.dragLook = true;
      if (e.button === 0) {
        this.firing = true;
        if (!this.car) this.attack();
      }
      if (e.button === 2) this.aim = true;
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.aim = false;
      this.dragLook = false;
    });
    document.addEventListener("pointerlockchange", () => {
      if (
        !document.pointerLockElement &&
        this.hadLock &&
        this.ui.screen === "play" &&
        !this.dead
      ) {
        this.ui.show("pause", "play");
      }
      this.hadLock = !!document.pointerLockElement;
    });
    window.addEventListener("blur", () => {
      this.keys = {};
      this.firing = this.aim = false;
      if (this.ui.screen === "play" && !this.demo)
        this.ui.show("pause", "play");
    });
    window.addEventListener("pagehide", () => {
      if (this.ui.screen !== "title") this.save();
    });
  }
  refreshJob() {
    [this.jobTitle, this.jobText] = JOBS[this.stage];
    this.jobNum = this.stage < 2 ? 1 : this.stage < 4 ? 2 : 3;
    this.objective = [
      this.pop.storyCar,
      GARAGE,
      tape,
      tower,
      pier,
      quay,
      null,
      hotel,
      null,
    ][this.stage];
    if (this.stage === 6 && this.stars && this.searching)
      this.jobText =
        "Stay hidden. Search ends in " +
        Math.max(1, Math.ceil(this.clearTime() - this.searchTimer)) +
        " s.";
    if (this.stage === 1 && this.car !== this.pop.storyCar) {
      this.objective = this.pop.storyCar;
      this.jobText = "Get back in the coral Veloce.";
    }
    this.imani.root.visible = this.stage <= 4;
    this.ring.visible = !!this.objective;
  }
  progress(stage) {
    if (stage === this.stage) return;
    this.stage = stage;
    this.invalidateRoute();
    this.refreshJob();
    if (stage === 2 || stage === 4 || stage === 8) {
      let [name, reward] =
        stage === 2
          ? ["Borrowed Sunshine", 650]
          : stage === 4
            ? ["Dead Air", 950]
            : ["The Long Way Home", 1800];
      this.cash += reward;
      this.ui.banner(
        "JOB COMPLETE",
        name,
        "+$" + reward.toLocaleString("en-US"),
      );
      this.sound.fx("reward");
    } else {
      this.sound.fx("ui");
      let quote = {
        1: "“Easy on the paint. Pelican Motors is west of here.”",
        3: "“That tape goes live from the Northpoint mast.”",
        5: "“The harbor office has a ledger. I want it back.”",
        6: "“They know. Break sight before we go home.”",
        7: "“Clear skies. I’ll meet you at the Bellamar.”",
      }[stage];
      if (quote) this.ui.notify("Imani Cruz", quote, 4);
    }
    this.save();
  }
  prompt() {
    if (this.dead) return null;
    let d = this.objective ? dist(this, this.objective) : 1e4;
    if (this.stage === 1 && this.car?.story && d < 8)
      return ["E", "Deliver Veloce"];
    if (d < 5.5 && [2, 3, 4, 5, 7].includes(this.stage))
      return [
        "E",
        {
          2: "Collect master tape",
          3: "Go on air",
          4: "Meet Imani",
          5: "Take the ledger",
          7: "Deliver ledger",
        }[this.stage],
      ];
    if (dist(this, SHOP) < 5.2) return ["E", "Browse supplies"];
    if (dist(this, GARAGE) < 6) return ["E", "Visit Pelican Motors"];
    if (dist(this, HOSPITAL) < 5) return ["E", "Receive treatment"];
    if (!this.car) {
      let c = this.pop.nearestCar(5);
      if (c) return ["F", "Enter " + c.name];
      if (!this.demo && this.time < 12)
        return ["WASD", "Move　·　Mouse to look　·　Tab for controls"];
    }
    return null;
  }
  interact() {
    let d = this.objective ? dist(this, this.objective) : 9999;
    if (this.stage === 1 && this.car?.story && d < 8) {
      this.car.speed = 0;
      this.progress(2);
      return;
    }
    if (d < 5.5 && [2, 3, 4, 5, 7].includes(this.stage)) {
      if (this.stage === 4 && !this.car) {
        this.ui.notify(
          "Imani Cruz",
          "“Bring a ride. We’re going to the port.”",
        );
        return;
      }
      if (this.stage === 5) this.crime(2.6);
      this.progress(this.stage + 1);
      return;
    }
    if (dist(this, SHOP) < 5.2 || dist(this, GARAGE) < 6) {
      this.shopType = dist(this, SHOP) < 5.2 ? "supply" : "garage";
      this.shopNote = "";
      this.ui.show("shop", "play");
    } else if (dist(this, HOSPITAL) < 5) {
      if (this.health >= 100) {
        this.ui.notify("Azure General", "You’re in good health.");
        return;
      }
      this.health = 100;
      this.ui.notify("Treated", "Health restored.");
      this.save();
    }
  }
  buy(item) {
    let price = { repair: 180, armor: 160, ammo: 75, health: 45 }[item];
    if (item === "repair" && !this.car) {
      this.shopNote = "Bring a vehicle into the service bay.";
      return;
    }
    if (
      (item === "repair" && this.car.health >= 99.9) ||
      (item === "health" && this.health === 100) ||
      (item === "armor" && this.armor === 100)
    ) {
      this.shopNote = "Already in full condition.";
      return;
    }
    if (this.cash < price) {
      this.shopNote = "Insufficient funds.";
      return;
    }
    this.cash -= price;
    if (item === "repair") {
      this.car.health = 100;
      this.car.crumple = 0;
    } else if (item === "armor") this.armor = 100;
    else if (item === "health") this.health = 100;
    else {
      this.reserve[1] += 36;
      this.reserve[2] += 90;
    }
    this.shopNote = {
      repair: "Repairs complete.",
      health: "Health restored.",
      ammo: "Added 36 pistol and 90 rifle rounds.",
      armor: "Armor replenished.",
    }[item];
    this.sound.fx("reward");
    this.save();
  }
  setWaypoint(p) {
    if (!p) return;
    let n = this.world.nodes[nearestNode(this.world, p.x, p.z)],
      best = null,
      bd = Infinity;
    for (let [a, b] of this.world.edges) {
      let A = this.world.nodes[a],
        B = this.world.nodes[b],
        dx = B.x - A.x,
        dz = B.z - A.z,
        t = clamp(
          ((p.x - A.x) * dx + (p.z - A.z) * dz) / (dx * dx + dz * dz),
          0,
          1,
        ),
        x = A.x + dx * t,
        z = A.z + dz * t,
        d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) {
        bd = d;
        best = { x, z };
      }
    }
    this.waypoint = best || { x: n.x, z: n.z };
    this.invalidateRoute();
  }
  invalidateRoute() {
    this.routeStamp = "";
  }
  routeTo(p) {
    let a = nearestNode(this.world, this.x, this.z),
      b = nearestNode(this.world, p.x, p.z),
      stamp = a + "/" + b;
    if (stamp !== this.routeStamp) {
      this.routeStamp = stamp;
      this.routeCache = pathBetween(this.world, a, b).map(
        (i) => this.world.nodes[i],
      );
    }
    if (dist(this, p) < 33) return [];
    let path = this.routeCache.slice();
    if (path.length >= 2 && dist(this, path[1]) < dist(path[0], path[1]))
      path.shift();
    if (
      path.length > 1 &&
      dist(p, path.at(-2)) < dist(path.at(-1), path.at(-2))
    )
      path.pop();
    return path;
  }
  enter(c, quiet = false) {
    if (!c || this.dead || c.health <= 0) return;
    if (c.mode === "traffic" || c.mode === "police") {
      let spot = this.clearSpot(
        c.x - Math.cos(c.heading) * 1.45,
        c.z - Math.sin(c.heading) * 1.45,
      );
      let driver = this.pop.spawnPed(spot.x, spot.z, c.id % 11);
      driver.fear = 9;
      driver.danger = { x: c.x, z: c.z };
    }
    if (!quiet) {
      this.crime(c.type === "police" ? 1.3 : 0.49);
      this.pop.scare(c.x, c.z, 12);
      this.sound.fx("door");
    }
    c.mode = "player";
    this.car = c;
    this.x = c.x;
    this.z = c.z;
    this.hero.root.visible = false;
    this.firing = this.aim = false;
    this.reloadEnd = 0;
    this.camOrbit = 0;
    this.camUp = 0;
    this.carCameraHeading = c.heading;
    this.camSnap = true;
    if (c.story && this.stage === 0 && !quiet) this.progress(1);
    this.refreshJob();
  }
  exitCar(forced = false) {
    let c = this.car;
    if (!c) return;
    let e = this.clearSpot(
      c.x - Math.cos(c.heading) * 1.66,
      c.z - Math.sin(c.heading) * 1.66,
    );
    let speed = Math.abs(c.speed);
    this.x = e.x;
    this.z = e.z;
    this.y = Math.max(0.12, this.world.floorAt(this.x, this.z));
    this.yaw = this.heroHeading = c.heading;
    this.pitch = -0.12;
    this.walkSpeed = 0;
    this.jumpV = 0;
    c.mode = c.health <= 0 ? "wreck" : "parked";
    c.speed = 0;
    this.car = null;
    this.hero.root.visible = true;
    this.camSnap = true;
    this.sound.fx("door");
    if (speed > 13 && !forced) this.damage((speed - 12) * 0.8);
    this.refreshJob();
  }
  crime(amount) {
    if (this.dead) return;
    this.heat = clamp(this.heat + amount, 0, 5);
    let old = this.stars;
    this.lastKnown = { x: this.x, z: this.z };
    this.stars = Math.ceil(this.heat);
    this.dangerTime = this.time;
    this.searchTimer = 0;
    this.searching = false;
    if (this.stars > old && old > 0)
      this.ui.notify("Dispatch", this.stars + "-star response", 2.5);
    if (this.stars > old)
      this.pop.nextCop = Math.min(this.pop.nextCop, this.time + 0.5);
  }
  clearTime() {
    return 9 + this.stars * 4;
  }
  wanted(dt) {
    if (!this.stars) return;
    let seen =
      this.pop.visibleCop && this.pop.nearestCop < (this.car ? 58 : 42);
    if (seen) this.lastSighting = this.time;
    let hiding =
      this.time - this.dangerTime > 4 &&
      !seen &&
      this.time - (this.lastSighting || -99) > 1.6;
    this.searching = hiding;
    if (hiding) this.searchTimer += dt;
    else this.searchTimer = Math.max(0, this.searchTimer - dt * 0.86);
    if (this.searchTimer >= this.clearTime()) {
      this.heat = this.stars = this.searchTimer = 0;
      this.searching = false;
      this.ui.notify("Clear", "Patrols called off.");
      if (this.stage === 6) this.progress(7);
      this.save();
    }
  }
  damage(n) {
    if (this.dead || this.grace > this.time) return;
    this.hurtUntil = this.time + 0.4;
    let a = Math.min(n, this.armor);
    this.armor -= a;
    this.health = clamp(this.health - (n - a), 0, 100);
    if (this.health <= 0) {
      this.dead = true;
      this.deadAt = this.time;
      this.firing = this.aim = false;
      this.heat = this.stars = 0;
      this.ui.bannerEnd = 0;
      this.sound.fx("hit");
    }
  }
  respawn() {
    if (this.car) this.exitCar(true);
    let p = this.clearSpot(HOSPITAL.x, HOSPITAL.z);
    this.x = p.x;
    this.z = p.z;
    this.y = 0.18;
    this.health = 100;
    this.armor = 0;
    this.cash = Math.max(0, this.cash - 90);
    this.weapon = 0;
    this.hero.weapon = 0;
    this.heat = this.stars = 0;
    this.searchTimer = 0;
    this.grace = this.time + 5;
    this.dead = false;
    this.walkSpeed = 0;
    this.jumpV = 0;
    this.camSnap = true;
    if (this.stage === 6) this.progress(7);
    this.ui.notify("Azure General", "Discharged · $90 treatment", 4);
    this.save();
  }
  reload() {
    let k = this.weapon;
    if (
      !k ||
      this.reloadEnd > this.time ||
      this.mag[k] >= (k === 1 ? 12 : 30) ||
      !this.reserve[k]
    )
      return;
    this.reloadEnd = this.time + (k === 1 ? 1.1 : 1.5);
    this.sound.fx("reload");
  }
  tracer(x, y, z, xx, yy, zz, col = 0xffd886) {
    let g = new T.BufferGeometry().setFromPoints([
        new T.Vector3(x, y, z),
        new T.Vector3(xx, yy, zz),
      ]),
      m = new T.Line(g, this.fxLine);
    this.scene.add(m);
    this.traces.push({ m, end: this.time + 0.075 });
  }
  burst(x, y, z, smoke = false, count = 8) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 110) break;
      let m = new T.Mesh(
          smoke ? this.dustGeo : this.sparkGeo,
          smoke ? this.smokeMat : this.sparkMat,
        ),
        s = smoke ? 0.15 + rand() * 0.25 : 0.017 + rand() * 0.027;
      m.position.set(x + (rand() - 0.5) * 0.25, y, z + (rand() - 0.5) * 0.25);
      m.scale.setScalar(s);
      this.scene.add(m);
      this.particles.push({
        m,
        dx: (rand() - 0.5) * (smoke ? 1 : 5),
        dy: rand() * (smoke ? 1.3 : 4) + 0.3,
        dz: (rand() - 0.5) * (smoke ? 1 : 5),
        end: this.time + (smoke ? 1.4 : 0.52),
        smoke,
      });
    }
  }
  attack() {
    if (
      this.car ||
      this.dead ||
      this.time < this.nextShot ||
      this.reloadEnd > this.time
    )
      return;
    let k = this.weapon;
    if (!k) {
      this.fightUntil = this.time + 0.4;
      this.nextShot = this.time + 0.46;
      this.sound.fx("hit");
      let hit = false;
      for (let p of this.peds) {
        if (
          !p.stun &&
          dist(p, this) < 2.05 &&
          Math.abs(wrap(Math.atan2(p.x - this.x, this.z - p.z) - this.yaw)) <
            1.35
        ) {
          p.health -= 38;
          p.fear = 5;
          p.danger = { x: this.x, z: this.z };
          if (p.health <= 0) this.pop.knock(p, false);
          hit = true;
          break;
        }
      }
      if (hit) {
        this.crime(0.55);
        this.pop.scare(this.x, this.z, 18);
      }
      return;
    }
    if (!this.mag[k]) {
      if (this.reserve[k]) this.reload();
      else this.ui.notify("Out of ammunition", "Visit Sunset Supply.", 1.9);
      return;
    }
    this.mag[k]--;
    this.nextShot = this.time + (k === 1 ? 0.27 : 0.113);
    this.sound.fx("fire");
    this.heroHeading = this.yaw;
    this.kick = 0.027;
    this.fightUntil = this.time + 0.22;
    this.pop.scare(this.x, this.z, 47);
    if (this.time > (this.lastCrimeShot || -1) + 0.68) {
      this.crime(0.23);
      this.lastCrimeShot = this.time;
    }
    let ray = this.camera.getWorldDirection(new T.Vector3()),
      o = this.camera.position.clone(),
      best = 130,
      hit = null,
      aimpoint = new T.Vector3();
    const test = (x, y, z, rad, obj) => {
      let p = new T.Vector3(x, y, z).sub(o),
        t = p.dot(ray);
      if (t < 0.15 || t >= best) return;
      let d2 = p.lengthSq() - t * t;
      if (d2 <= rad * rad) {
        best = t - Math.sqrt(rad * rad - d2);
        hit = obj;
      }
    };
    for (let p of this.peds)
      if (!p.stun) {
        test(p.x, 1.12, p.z, 0.53, p);
        test(p.x, 1.63, p.z, 0.25, p);
      }
    for (let c of this.cars) test(c.x, 0.77, c.z, 1.23, c);
    for (let i = 1; i < best; i += 0.65) {
      aimpoint.copy(o).addScaledVector(ray, i);
      if (
        (aimpoint.y < 11 && this.world.hit(aimpoint.x, aimpoint.z, 0.07)) ||
        aimpoint.y < 0.08
      ) {
        best = i;
        hit = null;
        break;
      }
    }
    aimpoint.copy(o).addScaledVector(ray, best);
    let h = this.yaw,
      sx = this.x + Math.sin(h) * 0.68 + Math.cos(h) * 0.2,
      sz = this.z - Math.cos(h) * 0.68 + Math.sin(h) * 0.2;
    this.tracer(sx, this.y + 1.31, sz, aimpoint.x, aimpoint.y, aimpoint.z);
    this.burst(sx, this.y + 1.3, sz, false, 3);
    this.burst(aimpoint.x, aimpoint.y, aimpoint.z, false, 4);
    if (hit) {
      this.hitUntil = this.time + 0.24;
      if (hit.model) {
        hit.health -= k === 1 ? 9 : 12;
        hit.crumple = 100 - hit.health;
        if (hit.health <= 0) this.wreck(hit);
        if (hit.type === "police") this.crime(0.34);
      } else {
        hit.health -= k === 1 ? 38 : 42;
        if (hit.health <= 0) {
          this.pop.knock(hit);
          this.crime(0.72);
        }
      }
    }
  }
  wreck(c) {
    if (c.mode === "wreck") return;
    c.health = 0;
    c.crumple = 100;
    this.burst(c.x, 0.7, c.z, true, 20);
    this.burst(c.x, 0.65, c.z, false, 19);
    this.sound.fx("crash");
    if (c === this.car) {
      this.exitCar(true);
      this.damage(21);
      this.ui.notify("Engine destroyed", "Find another vehicle.");
    }
    c.mode = "wreck";
    c.speed = 0;
    if (c.story && this.stage < 2) {
      Object.assign(c, {
        x: 82.55,
        z: 76.7,
        heading: -0.035,
        health: 100,
        crumple: 0,
        mode: "parked",
      });
      this.stage = 0;
      this.refreshJob();
      this.ui.notify(
        "Valet recovery",
        "A replacement Veloce is at the stand.",
        4,
      );
    }
  }
  carImpact(c, impact, other) {
    if (c.hitCooldown > 0) return;
    let damage = clamp((impact - 2) * 1.23, 1, 34);
    c.health = Math.max(0, c.health - damage);
    c.crumple = 100 - c.health;
    c.hitCooldown = 0.72;
    c.speed *= -0.26;
    this.sound.fx("crash", clamp(impact / 22, 0.1, 1));
    this.shake = clamp(impact * 0.018, 0.05, 0.42);
    this.burst(
      c.x + Math.sin(c.heading) * 1.8,
      0.55,
      c.z - Math.cos(c.heading) * 1.8,
      false,
      8,
    );
    this.pop.scare(c.x, c.z, 23);
    if (impact > 14) this.damage((impact - 12) * 0.49);
    if (other) {
      other.health -= damage * 0.53;
      other.crumple = 100 - other.health;
      other.hitCooldown = 1.1;
      if (other.mode === "traffic" && impact > 8) {
        other.mode = "parked";
        other.speed = 0;
      }
      if (other.type === "police") this.crime(0.25);
      else if (impact > 8) this.crime(0.16);
      if (other.health <= 0) this.wreck(other);
    }
    if (!c.health) this.wreck(c);
  }
  updateFoot(dt, autoInput) {
    let k = this.keys,
      dx = 0,
      dz = 0,
      want = 0;
    if (autoInput) {
      dx = autoInput.dx;
      dz = autoInput.dz;
      want = 3;
    } else {
      let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0),
        s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      dx = Math.sin(this.yaw) * f + Math.cos(this.yaw) * s;
      dz = -Math.cos(this.yaw) * f + Math.sin(this.yaw) * s;
      want = this.aim ? 2 : k.ShiftLeft || k.ShiftRight ? 6.3 : 3.15;
    }
    let l = Math.hypot(dx, dz);
    this.walkSpeed = mix(this.walkSpeed, l ? want : 0, Math.min(1, dt * 12));
    if (l) {
      dx /= l;
      dz /= l;
      let step = this.walkSpeed * dt,
        can = (x, z) => {
          if (!this.safe(x, z, 0.28)) return false;
          for (let c of this.cars) {
            if (Math.abs(c.x - x) > 3 || Math.abs(c.z - z) > 3) continue;
            let ax = x - c.x,
              az = z - c.z,
              lx = ax * Math.cos(c.heading) + az * Math.sin(c.heading),
              lz = ax * Math.sin(c.heading) - az * Math.cos(c.heading);
            if (
              Math.abs(lx) < c.model.W * 0.52 + 0.12 &&
              Math.abs(lz) < c.model.L * 0.49 + 0.13
            )
              return false;
          }
          return true;
        };
      if (can(this.x + dx * step, this.z)) this.x += dx * step;
      if (can(this.x, this.z + dz * step)) this.z += dz * step;
      let targetH = this.aim ? this.yaw : Math.atan2(dx, -dz);
      this.heroHeading +=
        wrap(targetH - this.heroHeading) * Math.min(1, dt * 12);
    }
    let ground = Math.max(0.09, this.world.floorAt(this.x, this.z) + 0.08);
    this.jumpV -= dt * 15;
    this.y += this.jumpV * dt;
    if (this.y <= ground) {
      this.y = ground;
      this.jumpV = 0;
      this.grounded = true;
    }
    if (this.aim || this.time < this.fightUntil)
      this.heroHeading +=
        wrap(this.yaw - this.heroHeading) * Math.min(1, dt * 18);
    this.hero.root.rotation.set(0, -this.heroHeading, 0);
    this.hero.root.position.set(this.x, this.y, this.z);
    this.hero.weapon = this.weapon;
    pose(
      this.hero,
      dt,
      this.walkSpeed,
      !this.grounded
        ? "air"
        : this.time < this.fightUntil && !this.weapon
          ? "punch"
          : this.weapon && (this.aim || this.time < this.fightUntil)
            ? "aim"
            : "idle",
      clamp(1 - (this.fightUntil - this.time) / 0.4, 0, 1),
    );
    if (l && this.grounded && this.stepTime < this.time) {
      this.sound.fx("step");
      this.stepTime = this.time + (want > 4 ? 0.26 : 0.4);
    }
    if (this.firing) this.attack();
    if (this.reloadEnd && this.time >= this.reloadEnd) {
      let n = Math.min(
        (this.weapon === 1 ? 12 : 30) - this.mag[this.weapon],
        this.reserve[this.weapon],
      );
      this.mag[this.weapon] += n;
      this.reserve[this.weapon] -= n;
      this.reloadEnd = 0;
    }
  }
  drive(dt, bot = null) {
    let c = this.car,
      k = this.keys;
    if (!c) return;
    let accel = bot
        ? bot.gas
        : (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0),
      turn = bot
        ? bot.turn
        : (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0),
      hand = !bot && k.Space;
    let sport = c.type === "sport",
      top = sport ? 46 : 36,
      brake = accel * c.speed < -0.1,
      acc = brake
        ? 17
        : accel > 0
          ? (sport ? 10.5 : 8.4) * (1 - Math.max(c.speed, 0) / top)
          : 5.7;
    c.speed += accel * acc * dt;
    let drag =
      (accel ? 0.22 : 1.45) + 0.0022 * c.speed * c.speed + (hand ? 12 : 0);
    c.speed = Math.sign(c.speed) * Math.max(0, Math.abs(c.speed) - drag * dt);
    c.speed = clamp(c.speed, -10, top);
    let offRoad =
      this.x > 98 ||
      Math.min(
        ...XS.map((x) => Math.abs(x - this.x)),
        ...ZS.map((z) => Math.abs(z - this.z)),
      ) > 11;
    if (offRoad && c.speed > 18) c.speed -= dt * 3.3;
    c.steer = mix(c.steer, turn, Math.min(1, dt * (hand ? 9 : 5.8)));
    let yaw =
      (c.steer *
        Math.sign(c.speed) *
        Math.min(Math.abs(c.speed) * 0.24, 1.53) *
        (hand ? 1.65 : 1)) /
      (1 + Math.abs(c.speed) * 0.014);
    c.heading += yaw * dt;
    let nx = c.x + Math.sin(c.heading) * c.speed * dt,
      nz = c.z - Math.cos(c.heading) * c.speed * dt,
      heading = c.heading,
      front = Math.sign(c.speed) * c.model.L * 0.37,
      valid =
        this.safe(nx, nz, 0.87) &&
        this.safe(
          nx + Math.sin(heading) * front,
          nz - Math.cos(heading) * front,
          0.73,
        ),
      other = null;
    if (valid) {
      for (let v of this.cars) {
        if (v === c || Math.abs(v.x - nx) > 4.8 || Math.abs(v.z - nz) > 4.8)
          continue;
        let vd = v.heading,
          ad = nx - v.x,
          zd = nz - v.z,
          side = Math.abs(ad * Math.cos(vd) + zd * Math.sin(vd)),
          long = Math.abs(ad * Math.sin(vd) - zd * Math.cos(vd));
        if (
          side < (c.model.W + v.model.W) * 0.43 &&
          long < (c.model.L + v.model.L) * 0.43 &&
          dist({ x: nx, z: nz }, v) < dist(c, v) + 0.001
        ) {
          other = v;
          valid = false;
          break;
        }
      }
    }
    if (valid) {
      c.x = nx;
      c.z = nz;
    } else if (Math.abs(c.speed) > 1) {
      this.carImpact(
        c,
        Math.abs(c.speed) + (other ? Math.abs(other.speed) * 0.21 : 0),
        other,
      );
      if (c.hitCooldown > 0 && Math.abs(c.speed) < 0.8) c.speed = 0;
    } else c.speed = 0;
    if (this.car !== c) return;
    this.x = c.x;
    this.z = c.z;
    this.y = Math.max(0, this.world.floorAt(c.x, c.z));
    if (
      hand &&
      Math.abs(c.speed) > 5 &&
      this.time > (this.lastSkid || 0) + 0.065
    ) {
      this.lastSkid = this.time;
      for (let s of [-1, 1]) {
        let m = new T.Mesh(this.skidGeo, this.skidMat);
        m.position.set(
          c.x + Math.cos(heading) * s * 0.83 - Math.sin(heading) * 1.25,
          this.y + 0.081,
          c.z + Math.sin(heading) * s * 0.83 + Math.cos(heading) * 1.25,
        );
        m.rotation.y = -heading;
        m.scale.z = Math.abs(c.speed) * 0.085;
        this.scene.add(m);
        this.tracks.push(m);
      }
      while (this.tracks.length > 100) this.scene.remove(this.tracks.shift());
    }
    if (c.health < 40 && Math.random() < dt * 5)
      this.burst(
        c.x + Math.sin(heading) * 1.5,
        1,
        c.z - Math.cos(heading) * 1.5,
        true,
        1,
      );
    this.throttle = Math.max(0, accel);
  }
  autoInput(dt) {
    this.demoAge += dt;
    if (
      this.car &&
      this.demoScene === "tour" &&
      !this.demoShootDone &&
      this.demoAge > 24
    ) {
      this.demoShootDone = true;
      this.demoReturn = this.car;
      this.exitCar(true);
      this.weapon = this.hero.weapon = 2;
      this.shootUntil = this.time + 2.9;
      this.reloadEnd = 0;
    }
    if (!this.car && this.shootUntil > this.time) {
      let target = this.cars
        .filter(
          (c) =>
            c !== this.demoReturn && c.mode !== "wreck" && dist(c, this) > 6,
        )
        .sort(
          (a, b) =>
            (a.mode === "police" ? -26 : 0) +
            dist(a, this) -
            (b.mode === "police" ? -26 : 0) -
            dist(b, this),
        )[0];
      if (target) {
        this.yaw +=
          wrap(Math.atan2(target.x - this.x, this.z - target.z) - this.yaw) *
          Math.min(1, dt * 8);
        this.pitch = -0.045;
        this.aim = this.firing = true;
      }
      return { dx: 0, dz: 0 };
    }
    if (!this.car) {
      this.firing = this.aim = false;
      let c =
          this.demoReturn && this.demoReturn.health > 0
            ? this.demoReturn
            : this.stage === 0
              ? this.pop.storyCar
              : this.cars
                  .filter((v) => v.health > 0 && dist(v, this) < 100)
                  .sort((a, b) => dist(a, this) - dist(b, this))[0] ||
                this.pop.storyCar,
        goal = { x: c.x + 1.5, z: c.z + 0.6 },
        d = dist(this, goal);
      if (d < 0.78 || (this.demoAge > 4.2 && dist(c, this) < 4.8)) {
        this.enter(c);
        this.demoReturn = null;
        this.demoAge = Math.max(this.demoAge, 3.1);
        return null;
      }
      let dx = goal.x - this.x,
        dz = goal.z - this.z;
      let heading = Math.atan2(dx, -dz);
      this.yaw += wrap(heading - this.yaw) * dt * 0.95;
      return { dx, dz };
    }
    let c = this.car;
    if (!this.autoRoute) {
      this.autoRoute = [
        { x: 78.6, z: 65 },
        { x: 78.7, z: -26 },
        { x: 75, z: -36 },
        { x: 21, z: -35 },
        { x: 15, z: -37 },
        { x: 15, z: -96 },
        { x: 16, z: -109 },
        { x: 65, z: -106 },
        { x: 74, z: -113 },
        { x: 79, z: -239 },
        { x: 75, z: -250 },
        { x: -37, z: -250 },
        { x: -42, z: -240 },
        { x: -39, z: 34 },
        { x: -34, z: 43 },
        { x: 71, z: 43 },
        { x: 79, z: 37 },
      ];
      this.autoIndex = c.z < 55 ? 1 : 0;
    }
    let aim = this.autoRoute[this.autoIndex];
    if (dist(c, aim) < 7) {
      this.autoIndex = (this.autoIndex + 1) % this.autoRoute.length;
      aim = this.autoRoute[this.autoIndex];
    }
    let theta = wrap(Math.atan2(aim.x - c.x, c.z - aim.z) - c.heading);
    let desired =
      Math.abs(theta) > 0.4 ? 8 : this.demoScene === "chase" ? 19 : 14;
    if (this.demoAge > 9 && this.demoScene === "tour" && this.heat < 1.4) {
      this.crime(1.1);
      this.sound.fx("horn");
      this.pop.scare(c.x, c.z, 30);
    }
    if (Math.abs(c.speed) < 1.3) this.autoStuck = (this.autoStuck || 0) + dt;
    else this.autoStuck = 0;
    if (this.autoStuck > 1.4) {
      this.autoDodge = this.time + 1.2;
      this.autoStuck = 0;
    }
    if (this.autoDodge > this.time)
      return { gas: -1, turn: theta > 0 ? -1 : 1 };
    return {
      turn: clamp(theta * 2.25, -1, 1),
      gas: c.speed < desired ? 1 : c.speed > desired + 1 ? -0.45 : 0,
    };
  }
  cameraUpdate(dt, snap = false) {
    let camera = this.camera,
      distCam,
      lookH,
      lookY,
      lookZ = 0;
    let car = this.car;
    let desiredFov =
      this.options.fov +
      (car ? Math.min(7, Math.abs(car.speed) * 0.18) : this.aim ? -11 : 0);
    if (Math.abs(camera.fov - desiredFov) > 0.04) {
      camera.fov = mix(camera.fov, desiredFov, snap ? 1 : Math.min(1, dt * 6));
      camera.updateProjectionMatrix();
    }
    if (car) {
      let hh = car.heading;
      if (this.time - this.lastLook > 1.8) {
        this.camOrbit *= Math.exp(-dt * 2.4);
        this.camUp *= Math.exp(-dt * 2.4);
      }
      if (snap || this.camSnap || this.carCameraHeading === undefined)
        this.carCameraHeading = hh;
      else
        this.carCameraHeading +=
          wrap(hh - this.carCameraHeading) * Math.min(1, dt * 5.6);
      lookH =
        this.carCameraHeading + this.camOrbit + (this.keys.KeyC ? Math.PI : 0);
      distCam = 5.7 + Math.min(1.8, Math.abs(car.speed) * 0.047);
      lookY = 0.93;
      this.target.set(
        this.x + Math.sin(lookH) * 1.33,
        this.y + lookY,
        this.z - Math.cos(lookH) * 1.33,
      );
      this.ideal.set(
        this.x - Math.sin(lookH) * distCam,
        this.y + 2.65 + distCam * this.camUp,
        this.z + Math.cos(lookH) * distCam,
      );
    } else {
      lookH = this.yaw;
      let pitch = this.pitch + (this.kick || 0);
      this.kick = (this.kick || 0) * Math.exp(-dt * 17);
      distCam = this.aim ? 2.24 : 4.28;
      let shoulder = this.aim ? 0.59 : 0.36;
      this.forward.set(
        Math.sin(lookH) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(lookH) * Math.cos(pitch),
      );
      this.target.set(
        this.x + Math.cos(lookH) * shoulder,
        this.y + (this.aim ? 1.49 : 1.42),
        this.z + Math.sin(lookH) * shoulder,
      );
      this.ideal.copy(this.target).addScaledVector(this.forward, -distCam);
      this.target.addScaledVector(this.forward, 1.25);
      if (this.dead) this.ideal.y += 1.8;
    }
    // Pull the camera in before a wall or palm trunk can occupy the foreground.
    let px = this.x,
      pz = this.z,
      py = this.y + 1.35;
    let d = Math.hypot(this.ideal.x - px, this.ideal.z - pz),
      steps = Math.max(1, Math.ceil(d / 0.3));
    for (let i = 1; i <= steps; i++) {
      let q = i / steps,
        xx = mix(px, this.ideal.x, q),
        zz = mix(pz, this.ideal.z, q),
        hit = this.world.hit(xx, zz, 0.24);
      if (hit) {
        let rr = Math.max(0.15, (i - 1) / steps);
        this.ideal.set(
          mix(px, this.ideal.x, rr),
          mix(py, this.ideal.y, rr) + 0.16,
          mix(pz, this.ideal.z, rr),
        );
        break;
      }
    }
    this.ideal.y = Math.max(
      this.ideal.y,
      0.39 + Math.max(0, this.world.floorAt(this.ideal.x, this.ideal.z)),
    );
    if (snap || this.camSnap) {
      camera.position.copy(this.ideal);
      this.camSnap = false;
    } else
      camera.position.lerp(this.ideal, 1 - Math.exp(-dt * (car ? 12 : 28)));
    if (this.shake > 0.006) {
      camera.position.x += (rand() - 0.5) * this.shake;
      camera.position.y += (rand() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 7);
    }
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
    this.world.weather.sky.position.copy(camera.position);
  }
  setEnvironment(force = false) {
    let angle = ((this.hour - 6) * Math.PI) / 12,
      alt = Math.sin(angle),
      day = clamp((alt + 0.13) / 0.38, 0, 1);
    this.day = day;
    paintEnvironment(day);
    this.streetLighting(day);
    let dir = this.world.weather.uniforms.uSun.value;
    dir
      .set(
        0.58 * Math.sin(angle * 0.68 + 0.38),
        alt,
        0.67 * Math.cos(angle * 0.7 - 0.4),
      )
      .normalize();
    let lit = dir.clone();
    if (alt < -0.02) lit.multiplyScalar(-1);
    this.sun.target.position.set(this.x, 0, this.z);
    this.sun.position.set(
      this.x + lit.x * 87,
      Math.max(12, lit.y * 87),
      this.z + lit.z * 87,
    );
    this.sun.intensity = mix(0.63, 2.04, day);
    this.sun.color.setHex(day > 0.5 ? 0xffecd1 : 0x9cbce2);
    this.hemi.intensity = mix(0.68, 1.58, day);
    this.hemi.color.setHex(day > 0.5 ? 0xfff6df : 0x80a3d3);
    this.hemi.groundColor.setHex(day > 0.5 ? 0xa0b4bb : 0x384757);
    this.scene.fog.color.setRGB(
      mix(0.045, 0.66, day),
      mix(0.078, 0.8, day),
      mix(0.126, 0.82, day),
    );
    this.world.update(this.time, day);
    for (let i = 0; i < 2; i++) {
      let l = this.carLamps[i],
        c = this.car;
      l.intensity = c && day < 0.75 ? (1 - day) * 40 : 0;
      if (l.intensity) {
        let s = i ? 1 : -1,
          dx = Math.sin(c.heading),
          dz = -Math.cos(c.heading),
          rx = Math.cos(c.heading),
          rz = Math.sin(c.heading);
        l.position.set(
          c.x + dx * 1.8 + rx * s * 0.69,
          this.y + 0.7,
          c.z + dz * 1.8 + rz * s * 0.69,
        );
        l.target.position.set(
          l.position.x + dx * 16,
          l.position.y - 0.9,
          l.position.z + dz * 16,
        );
      }
    }
  }
  step(dt) {
    this.time += dt;
    this.hour = (this.hour + dt * 0.028) % 24;
    this.renderCount++;
    if (this.dead) {
      if (this.time - this.deadAt > 3.1) this.respawn();
      else {
        this.hero.root.rotation.z = 1.35;
        this.hero.root.position.y = 0.67;
      }
    } else {
      let inp = this.auto ? this.autoInput(dt) : null;
      if (this.car) this.drive(dt, inp);
      else this.updateFoot(dt, inp);
      this.wanted(dt);
      if (this.stage === 6 && !this.stars) this.progress(7);
    }
    this.pop.update(dt);
    if (this.imani) {
      if (this.stage > 4) this.imani.root.visible = false;
      else if (!this.imani.fear) {
        this.imani.x = pier.x + 0.85;
        this.imani.z = pier.z - 0.7;
        this.imani.heading = 0.7;
      }
    }
    this.refreshJob();
    if (this.objective) {
      this.ring.position.set(
        this.objective.x,
        0.2 +
          Math.max(0, this.world.floorAt(this.objective.x, this.objective.z)),
        this.objective.z,
      );
      this.ring.scale.setScalar(
        this.stage === 0 ? 1.4 : 1.25 + Math.sin(this.time * 2) * 0.08,
      );
      this.ring.visible = dist(this, this.objective) < 100;
    }
    if (this.waypoint && dist(this, this.waypoint) < 5) {
      this.waypoint = null;
      this.invalidateRoute();
      this.ui.notify("Waypoint reached");
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      if (this.time > p.end) {
        this.scene.remove(p.m);
        this.particles.splice(i, 1);
        continue;
      }
      p.m.position.x += p.dx * dt;
      p.m.position.y += p.dy * dt;
      p.m.position.z += p.dz * dt;
      if (p.smoke) p.m.scale.multiplyScalar(1 + 0.52 * dt);
      else p.dy -= dt * 8;
    }
    while (this.traces.length && this.traces[0].end < this.time) {
      let a = this.traces.shift();
      this.scene.remove(a.m);
      a.m.geometry.dispose();
    }
    if (this.time > this.autoSave) {
      this.save();
      this.autoSave = this.time + 7.5;
    }
  }
  advanceDemo(now) {
    let dt = clamp((now - this.demoClock) / 1000, 0, 1);
    this.demoClock = Math.max(this.demoClock, now);
    let n = Math.ceil(dt / 0.05);
    for (let i = 0; i < n; i++) this.step(dt / n);
  }
  drawFrame(dt) {
    this.setEnvironment();
    this.cameraUpdate(dt);
    this.sound.mix(
      this.car,
      this.throttle || 0,
      this.stars ? clamp(1 - this.pop.nearestCop / 90, 0, 1) : 0,
      !this.dead,
    );
    this.ui.refresh();
    this.renderer.render(this.scene, this.camera);
    this.lastDraw = performance.now();
  }
  loop(now) {
    requestAnimationFrame(this.loop);
    let elapsed = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.ui.screen !== "play") {
      if (this.ui.screen === "pause" && !this.pausedRendered) {
        this.renderer.render(this.scene, this.camera);
        this.pausedRendered = true;
      }
      return;
    }
    this.pausedRendered = false;
    let dt = Math.min(0.15, elapsed);
    if (this.demo && this.auto) this.advanceDemo(now);
    else {
      let steps = Math.max(1, Math.ceil(dt / 0.032));
      for (let j = 0; j < steps; j++) this.step(dt / steps);
    }
    this.drawFrame(dt);
  }
}
