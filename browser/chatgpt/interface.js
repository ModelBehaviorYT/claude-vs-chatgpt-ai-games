import { T, clamp } from "./mesh.js";
import { locationAt } from "./city.js";
import { STATIONS } from "./sound.js";
const paths = {
  play: '<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
  options:
    '<path d="M3 6h10m5 0h3M3 12h3m5 0h10M3 18h10m5 0h3"/><circle cx="15.5" cy="6" r="2.3"/><circle cx="8.5" cy="12" r="2.3"/><circle cx="15.5" cy="18" r="2.3"/>',
  quit: '<path d="M10 4H5v16h5m5-4 4-4-4-4m-6 4h10"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  job: '<path d="m12 2 10 10-10 10L2 12z"/><path d="M12 7v6m0 3h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  moon: '<path d="M19 16A9 9 0 0 1 9 4a8.7 8.7 0 1 0 10 12z"/>',
  health:
    '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" stroke="none"/>',
  armor:
    '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z" fill="currentColor" stroke="none"/>',
  radio:
    '<path d="m4 6 14-4M3 8h18v12H3zM6 11h10"/><circle cx="16" cy="15.5" r="2"/><path d="M6 15h4m-4 2h4"/>',
  map: '<path d="m2 6 6-3 8 3 6-3v15l-6 3-8-3-6 3zm6-3v15m8-12v15"/>',
  save: '<path d="M3 3h15l3 3v15H3zM7 3v6h9V3M7 21v-8h10v8"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  car: '<path d="m3 12 3-6h12l3 6v6H3zm0 0h18M6 18v2m12-2v2M6 15h2m8 0h2"/>',
  controls:
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M7 15h10"/>',
  pistol:
    '<path d="M2 6h19v5H10l-2 7H4l1-7H2z" fill="currentColor" stroke="none"/>',
  rifle:
    '<path d="M1 11h4l3-3h8V6h2v3h5v3h-9l2 5-3 1-3-5H8l-1 4H4l1-5H1z" fill="currentColor" stroke="none"/>',
  fist: '<path d="M5 12V7q1-3 3 0V5q2-3 3 0v1q2-4 3 0v1q2-3 3 0v4l1-2q3-1 2 2l-3 7-3 3H9l-4-6z" fill="currentColor" stroke="none"/>',
  check: '<path d="m3 12 6 6L21 6"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
  bag: '<path d="M5 8h14l1 13H4zm3 0V6a4 4 0 0 1 8 0v2"/>',
  star: '<path d="m12 2 3 6.6 7 .9-5.2 5.1 1.3 7.2-6.1-3.5-6.1 3.5 1.2-7.2L2 9.5l7-.9z"/>',
  wheel:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="m4 8 7 3m2 0 7-3m-8 6v7"/>',
  signal: '<path d="M2 15v-4m4 8V7m4 15V2m4 16V6m4 10v-6m4 4v-2"/>',
};
export const ico = (name, sz = 18) =>
  '<svg width="' +
  sz +
  '" height="' +
  sz +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  (paths[name] || "") +
  "</svg>";
const brand =
  '<svg class="sunmark" width="48" height="32" viewBox="0 0 48 32" aria-hidden="true"><path d="M4 18a20 20 0 0 1 40 0zM3 21h42l-2 3H5zm4 6h34l-5 3H12z" fill="currentColor"/></svg>';
const key = (t) => "<kbd>" + t + "</kbd>",
  money = (n) => "$" + Math.floor(n).toLocaleString("en-US");
const btn = (id, txt, icon, primary = false) =>
  '<button class="menuBtn ' +
  (primary ? "primary" : "") +
  '" data-act="' +
  id +
  '"><span>' +
  ico(icon) +
  " " +
  txt +
  "</span>" +
  ico("arrow", 18) +
  "</button>";
const controls = [
  [
    "On foot",
    [
      ["W A S D", "Move"],
      ["MOUSE", "Look"],
      ["SHIFT", "Sprint"],
      ["SPACE", "Jump"],
      ["F", "Enter a vehicle"],
      ["E", "Interact"],
    ],
  ],
  [
    "Combat",
    [
      ["1 / 2 / 3", "Fists / pistol / rifle"],
      ["RMB", "Aim"],
      ["LMB", "Punch or fire"],
      ["R", "Reload"],
    ],
  ],
  [
    "Driving",
    [
      ["W / S", "Throttle / brake / reverse"],
      ["A / D", "Steer"],
      ["SPACE", "Handbrake"],
      ["F", "Exit vehicle"],
      ["H", "Horn"],
      ["T", "Change station"],
      ["C", "Look behind"],
    ],
  ],
  [
    "Navigation",
    [
      ["M", "City map"],
      ["ESC", "Pause / back"],
      ["TAB", "Controls"],
    ],
  ],
];
export class Interface {
  constructor(g) {
    this.g = g;
    this.overlay = document.querySelector("#overlay");
    this.hud = document.querySelector("#hud");
    this.screen = "title";
    this.from = "title";
    this.menuCache = "";
    this.markerVec = new T.Vector3();
    this.hud.innerHTML =
      '<div class="hudshade"></div><div class="jobhud"><div class="jobstripe"></div><div class="jobicon">' +
      ico("job", 23) +
      '</div><div><div class="tiny" id="jobtop"></div><strong id="jobname"></strong><div id="jobstep"></div></div></div><div class="stats"><div class="time" id="clock"></div><div id="cash"></div><div class="stars" id="stars"></div><div id="weap"></div></div><div id="objectivePin"></div><div id="reticle"><i></i><i></i><i></i><i></i></div><div class="navhud"><div class="radar"><canvas id="mini" aria-label="Minimap"></canvas><b class="north">N</b><span class="mapkey">M</span></div><div class="meters"><span>' +
      ico("health", 11) +
      '<i><em id="hpbar"></em></i></span><span>' +
      ico("armor", 12) +
      '<i><em id="apbar"></em></i></span></div></div><div class="locale"><div class="tiny" id="district"></div><div id="street"></div></div><div id="carhud"></div><div id="prompt"></div><div id="toast"></div><div id="targetflash"></div><div id="damageflash"></div><div id="storybanner"></div><div id="deathscreen"></div>';
    this.el = {};
    for (let o of this.hud.querySelectorAll("[id]")) this.el[o.id] = o;
    this.overlay.onclick = (e) => {
      let bt = e.target.closest("[data-act]");
      if (bt) this.act(bt.dataset.act);
    };
    this.show("title");
  }
  show(name, from) {
    let g = this.g;
    if (from) this.from = from;
    this.screen = name;
    this.hud.style.display = name === "play" ? "" : "none";
    this.overlay.innerHTML = "";
    document.body.dataset.screen = name;
    if (name !== "play") {
      g.firing = g.aim = false;
      g.keys = {};
      if (document.pointerLockElement) document.exitPointerLock();
      g.sound?.mix(null, 0, 0, false);
    }
    if (name === "play") {
      this.overlay.style.display = "none";
      return;
    }
    this.overlay.style.display = "";
    let footer =
      '<div class="menufoot"><span>' +
      brand +
      " AZURE COAST</span><span>" +
      key("↑ ↓") +
      " Navigate　" +
      key("ENTER") +
      " Select</span></div>";
    if (name === "title" || name === "quit" || name === "newconfirm") {
      let hasSave = g.hasSave();
      let content =
        name === "title"
          ? '<div class="edition"><i></i> PORT AZURE, FLORIDA</div><h1>Sundown<br><em>Syndicate</em></h1><div class="menulist">' +
            (hasSave ? btn("continue", "Continue", "play", true) : "") +
            btn("start", "Start", "play", !hasSave) +
            btn("options", "Options", "options") +
            btn("quit", "Quit", "quit") +
            "</div>"
          : name === "quit"
            ? '<div class="edition">SUNDOWN SYNDICATE</div><h2>Session closed</h2>' +
              btn("title", "Return to title", "back", true)
            : '<div class="edition">STORY MODE</div><h2>Start a new story?</h2><p>Your next save will replace your current progress.</p>' +
              btn("confirmstart", "Start new game", "play", true) +
              btn("title", "Back", "back");
      this.overlay.innerHTML =
        '<div class="front cover"><div class="frontcontent">' +
        content +
        "</div>" +
        footer +
        "</div>";
    }
    if (name === "pause") {
      this.overlay.innerHTML =
        '<div class="front paused"><div class="edition">SUNDOWN SYNDICATE</div><h2>Paused</h2><div class="menulist">' +
        btn("resume", "Resume", "play", true) +
        btn("map", "City map", "map") +
        btn("save", "Save progress", "save") +
        (g.hasSave() ? btn("load", "Load progress", "back") : "") +
        btn("options", "Options", "options") +
        btn("controls", "Controls", "controls") +
        btn("leave", "Return to title", "quit") +
        "</div></div>";
    }
    if (name === "options") {
      let o = g.options;
      let range = (i, label, min, max, val, unit) =>
        '<label class="optrow"><span>' +
        label +
        '</span><input type="range" id="opt-' +
        i +
        '" min="' +
        min +
        '" max="' +
        max +
        '" value="' +
        val +
        '"><output>' +
        val +
        unit +
        "</output></label>";
      this.overlay.innerHTML =
        '<div class="settingsbg"><div class="sheet"><div class="edition">' +
        brand +
        ' SUNDOWN SYNDICATE</div><h2>Options</h2><div class="optrow"><label for="quality">Graphics quality</label><select id="quality"><option>Low</option><option>Medium</option><option>High</option></select></div>' +
        range("fov", "Field of view", 45, 90, o.fov, "°") +
        range("sens", "Mouse sensitivity", 10, 150, o.sens, "%") +
        range("volume", "Master volume", 0, 100, o.volume, "%") +
        '<div class="sheetfoot">' +
        btn("back", "Back", "back") +
        "</div></div></div>";
      let q = this.overlay.querySelector("#quality");
      q.value = o.quality;
      q.onchange = () => {
        o.quality = q.value;
        g.applyOptions();
      };
      for (let id of ["fov", "sens", "volume"]) {
        let ip = this.overlay.querySelector("#opt-" + id);
        ip.oninput = () => {
          o[id] = +ip.value;
          ip.nextElementSibling.textContent =
            ip.value + (id === "fov" ? "°" : "%");
          g.applyOptions();
        };
      }
    }
    if (name === "controls") {
      this.overlay.innerHTML =
        '<div class="settingsbg"><div class="sheet controls"><div class="edition">FIELD GUIDE</div><h2>Controls</h2><div class="controlgrid">' +
        controls
          .map(
            ([h, rows]) =>
              "<section><h3>" +
              h +
              "</h3>" +
              rows
                .map(
                  ([k, t]) => "<div>" + key(k) + "<span>" + t + "</span></div>",
                )
                .join("") +
              "</section>",
          )
          .join("") +
        "</div>" +
        btn("back", "Back", "back") +
        "</div></div>";
    }
    if (name === "map") {
      this.overlay.innerHTML =
        '<div class="mapview"><header><div class="edition">' +
        brand +
        " PORT AZURE</div><div>" +
        key("M") +
        ' Close map</div></header><div class="maplayout"><aside><div class="edition">NAVIGATION</div><h2>City map</h2><div class="mapjob"><div class="tiny">CURRENT OBJECTIVE</div><h3>' +
        g.jobTitle +
        "</h3><p>" +
        g.jobText +
        '</p></div><div class="legend"><div><i class="lg player"></i>Your position</div><div><i class="lg mission"></i>Story objective</div><div><i class="lg medical">+</i>Hospital</div><div><i class="lg store">$</i>Supply shop</div><div><i class="lg store">G</i>Auto garage</div></div><div class="mapbottom"><p>Click a road to set a waypoint.<br>Scroll to zoom. Drag to pan.</p>' +
        btn("clearway", "Clear waypoint", "pin") +
        btn("back", "Back", "back") +
        '</div></aside><div class="mapfield"><canvas id="fullmap" aria-label="Interactive city map"></canvas><div class="mapnorth">▲<br>N</div><div class="zoom"><button data-act="zoomout" aria-label="Zoom out">−</button><button data-act="zoomin" aria-label="Zoom in">+</button></div></div></div></div>';
      let cv = this.overlay.querySelector("#fullmap"),
        m = g.minimap,
        down;
      m.draw(cv, g, true);
      cv.onwheel = (e) => {
        e.preventDefault();
        m.zoom = clamp(m.zoom * (e.deltaY < 0 ? 1.22 : 0.82), 0.7, 4);
        m.draw(cv, g, true);
      };
      cv.onpointerdown = (e) => {
        down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY };
        cv.setPointerCapture(e.pointerId);
      };
      cv.onpointermove = (e) => {
        if (!down) return;
        m.panX = (m.panX || 0) + e.clientX - down.lx;
        m.panZ = (m.panZ || 0) + e.clientY - down.ly;
        down.lx = e.clientX;
        down.ly = e.clientY;
        m.draw(cv, g, true);
      };
      cv.onpointerup = (e) => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
          let rect = cv.getBoundingClientRect();
          g.setWaypoint(m.worldAt(e.clientX - rect.left, e.clientY - rect.top));
          m.draw(cv, g, true);
        }
        down = null;
      };
    }
    if (name === "shop") {
      let garage = g.shopType === "garage";
      this.overlay.innerHTML =
        '<div class="settingsbg"><div class="sheet supply"><div class="edition">' +
        ico(garage ? "car" : "bag") +
        " MARINA DISTRICT</div><h2>" +
        (garage ? "Pelican Motors" : "Sunset Supply") +
        '</h2><div class="wallet">Wallet <strong>' +
        money(g.cash) +
        '</strong></div><div class="buylist">' +
        (garage
          ? btn("buy-repair", "Repair vehicle　$180", "car", true)
          : btn("buy-armor", "Body armor　$160", "armor", true) +
            btn("buy-ammo", "Ammunition　$75", "target") +
            btn("buy-health", "First aid　$45", "health")) +
        '</div><p id="purchase">' +
        (g.shopNote || "") +
        "</p>" +
        btn("back", "Back", "back") +
        "</div></div>";
    }
    this.navIndex = 0;
  }
  act(id) {
    let g = this.g;
    g.sound.unlock();
    g.sound.fx("ui");
    if (id === "start") {
      if (g.hasSave()) this.show("newconfirm");
      else g.start(false);
    } else if (id === "confirmstart") g.start(false);
    else if (id === "continue" || id === "load") g.start(true);
    else if (id === "title" || id === "quit") this.show(id);
    else if (id === "leave") {
      g.save(true);
      this.show("title");
    } else if (id === "options" || id === "controls" || id === "map")
      this.show(id, this.screen);
    else if (id === "resume") {
      this.show("play");
      g.lock();
    } else if (id === "back") {
      let s = this.screen === "shop" ? "play" : this.from || "play";
      this.show(s);
      if (s === "play") g.lock();
    } else if (id === "save") {
      let saved = g.save(true);
      let b = this.overlay.querySelector("[data-act=save]");
      b.innerHTML =
        "<span>" +
        ico("check") +
        " " +
        (saved ? "Progress saved" : g.demo ? "Preview session" : "Storage unavailable") +
        "</span>";
    } else if (id.startsWith("buy-")) {
      g.buy(id.slice(4));
      this.show("shop", "play");
    } else if (id === "clearway") {
      g.waypoint = null;
      g.invalidateRoute();
      this.drawMap();
    } else if (id === "zoomin" || id === "zoomout") {
      g.minimap.zoom = clamp(
        g.minimap.zoom * (id === "zoomin" ? 1.25 : 0.8),
        0.7,
        4,
      );
      this.drawMap();
    }
  }
  drawMap() {
    let cv = document.querySelector("#fullmap");
    if (cv) this.g.minimap.draw(cv, this.g, true);
  }
  nav(code) {
    if (["Escape", "KeyM", "Tab"].includes(code)) {
      if (this.screen === "pause") this.act("resume");
      else if (
        this.screen === "map" ||
        this.screen === "shop" ||
        this.screen === "controls" ||
        this.screen === "options"
      )
        this.act("back");
      else if (this.screen !== "title") this.show("title");
      return;
    }
    let btns = [...this.overlay.querySelectorAll("button")];
    if (!btns.length) return;
    let pos = btns.indexOf(document.activeElement);
    if (code === "ArrowDown" || code === "ArrowUp") {
      this.navIndex =
        (pos + (code === "ArrowDown" ? 1 : -1) + btns.length) % btns.length;
      btns[this.navIndex].focus();
    }
    if (code === "Enter" && pos < 0) btns[0].click();
  }
  notify(title, sub = "", seconds = 3) {
    this.el.toast.innerHTML =
      "<b>" + title + "</b>" + (sub ? "<span>" + sub + "</span>" : "");
    this.toastEnd = this.g.time + seconds;
  }
  banner(k, title, sub) {
    this.el.storybanner.innerHTML =
      '<div class="tiny">' +
      k +
      "</div><strong>" +
      title +
      "</strong><span>" +
      sub +
      "</span>";
    this.bannerEnd = this.g.time + 4.2;
  }
  refresh() {
    let g = this.g;
    if (this.screen !== "play") return;
    let e = this.el,
      loc = locationAt(g.x, g.z),
      m = Math.floor(g.hour * 60) % 1440,
      clock =
        String(Math.floor(m / 60)).padStart(2, "0") +
        ":" +
        String(m % 60).padStart(2, "0");
    const html = (e, v) => {
      if (e._value !== v) {
        e.innerHTML = v;
        e._value = v;
      }
    };
    const txt = (e, v) => {
      if (e.textContent !== v) e.textContent = v;
    };
    txt(
      e.jobtop,
      g.stage >= 8
        ? "STORY COMPLETE"
        : "STORY JOB　" + String(g.jobNum).padStart(2, "0") + " / 03",
    );
    txt(e.jobname, g.jobTitle);
    txt(e.jobstep, g.jobText);
    html(e.clock, ico(g.day > 0.5 ? "sun" : "moon", 15) + " " + clock);
    txt(e.cash, money(g.cash));
    html(
      e.stars,
      Array.from(
        { length: 5 },
        (_, i) =>
          '<i class="' +
          (i < g.stars ? "lit" : "") +
          '">' +
          ico("star", 18) +
          "</i>",
      ).join(""),
    );
    e.stars.classList.toggle("search", g.searching);
    let weapon = ["Bare hands", "Pistol", "Rifle"][g.weapon];
    html(
      e.weap,
      g.car
        ? ""
        : ico(["fist", "pistol", "rifle"][g.weapon], 25) +
            "<span>" +
            (g.weapon
              ? g.reloadEnd > g.time
                ? "RELOADING"
                : g.mag[g.weapon] +
                  " <small>/ " +
                  g.reserve[g.weapon] +
                  "</small>"
              : weapon) +
            "</span>",
    );
    e.hpbar.style.width = g.health + "%";
    e.apbar.style.width = g.armor + "%";
    txt(e.district, loc[0]);
    txt(e.street, loc[1]);
    g.minimap.draw(e.mini, g);
    if (g.car) {
      let mph = Math.abs(g.car.speed) * 2.237,
        gear =
          g.car.speed < -0.4
            ? "R"
            : g.car.speed < 0.7
              ? "N"
              : Math.min(6, 1 + Math.floor(mph / 16));
      html(
        e.carhud,
        '<div class="radioline">' +
          ico("signal", 15) +
          " " +
          STATIONS[g.sound.station] +
          '</div><div class="speed"><i>' +
          gear +
          "</i><b>" +
          Math.round(mph).toString().padStart(2, "0") +
          "</b><small>MPH</small></div><strong>" +
          g.car.name +
          '</strong><div class="condition"><i style="width:' +
          g.car.health +
          '%"></i></div>',
      );
    } else html(e.carhud, "");
    let p = g.prompt();
    html(e.prompt, p ? key(p[0]) + " " + p[1] : "");
    e.prompt.style.visibility = p ? "visible" : "hidden";
    e.toast.style.display = this.toastEnd > g.time ? "flex" : "none";
    e.storybanner.style.display = this.bannerEnd > g.time ? "grid" : "none";
    e.reticle.style.display =
      !g.car && g.weapon && g.health > 0 ? "block" : "none";
    e.reticle.classList.toggle("aim", g.aim);
    e.damageflash.style.opacity = clamp((g.hurtUntil - g.time) * 1.5, 0, 0.75);
    e.targetflash.style.opacity = clamp((g.hitUntil - g.time) * 4, 0, 1);
    e.deathscreen.style.display = g.dead ? "grid" : "none";
    if (g.dead)
      html(
        e.deathscreen,
        '<div><span class="tiny">AZURE GENERAL HOSPITAL</span><strong>Down for the count</strong><span>Emergency transport en route</span></div>',
      );
    let obj = g.waypoint || g.objective;
    if (obj && !g.dead) {
      let dist = Math.hypot(obj.x - g.x, obj.z - g.z);
      this.markerVec
        .set(
          obj.x,
          g.world.floorAt(obj.x, obj.z) + 2.05 + Math.min(4, dist * 0.026),
          obj.z,
        )
        .project(g.camera);
      let v = this.markerVec;
      if (
        v.z > -1 &&
        v.z < 1 &&
        Math.abs(v.x) < 0.96 &&
        Math.abs(v.y) < 0.79 &&
        dist > 2.2
      ) {
        e.objectivePin.style.display = "flex";
        e.objectivePin.style.left = (v.x * 0.5 + 0.5) * 100 + "%";
        e.objectivePin.style.top = (-v.y * 0.5 + 0.5) * 100 + "%";
        html(
          e.objectivePin,
          "<i>" +
            ico(g.waypoint ? "pin" : g.stage === 0 ? "wheel" : "job", 17) +
            "</i><span>" +
            Math.round(dist) +
            " m</span>",
        );
      } else e.objectivePin.style.display = "none";
    } else e.objectivePin.style.display = "none";
  }
}
