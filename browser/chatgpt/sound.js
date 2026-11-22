import { clamp } from "./mesh.js";
export const STATIONS = [
  "Maré FM 92.6",
  "Velvet 103.1",
  "Nightwire 88.4",
  "Radio off",
];
export class Sound {
  constructor() {
    this.volume = 0.58;
    this.station = 0;
    this.next = 0;
    this.beat = 0;
    this.driving = false;
  }
  unlock() {
    try {
      if (!this.ctx) {
        let ctx = (this.ctx = new AudioContext());
        this.master = ctx.createGain();
        this.master.gain.value = this.volume * 0.48;
        let comp = ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(ctx.destination);
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        let d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.engine = ctx.createOscillator();
        this.engine.type = "sawtooth";
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        this.filter = ctx.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 220;
        this.engine.connect(this.filter);
        this.filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engine.start();
        this.siren = ctx.createOscillator();
        this.siren.type = "triangle";
        this.sirenGain = ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.siren.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.siren.start();
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    } catch {}
  }
  setVolume(v) {
    this.volume = v;
    if (this.master)
      this.master.gain.setTargetAtTime(v * 0.48, this.ctx.currentTime, 0.06);
  }
  tone(f, d, type = "sine", v = 0.2, end = f, at = 0) {
    let ctx = this.ctx;
    if (!ctx) return;
    let t = at || ctx.currentTime,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(15, f), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(15, end), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.00015, v), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + d + 0.01);
  }
  noise(d, v, f = 1800, at = 0, type = "lowpass") {
    if (!this.ctx) return;
    let ctx = this.ctx,
      t = at || ctx.currentTime,
      s = ctx.createBufferSource(),
      g = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    s.buffer = this.noiseBuf;
    filter.type = type;
    filter.frequency.value = f;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + d);
  }
  fx(k, p = 1) {
    if (!this.ctx) return;
    let now = this.ctx.currentTime;
    if (k === "fire") {
      this.noise(0.14, 0.83, 4400);
      this.tone(165, 0.12, "triangle", 0.6, 42);
    }
    if (k === "step") {
      this.noise(0.065, 0.12, 990);
      this.tone(79, 0.052, "sine", 0.11, 39);
    }
    if (k === "crash") {
      this.noise(0.3, 0.23 + p * 0.53, 2220);
      this.tone(108, 0.22, "sawtooth", 0.31, 30);
    }
    if (k === "horn") {
      this.tone(331, 0.33, "sawtooth", 0.13);
      this.tone(406, 0.33, "triangle", 0.14);
    }
    if (k === "hit") {
      this.noise(0.09, 0.32, 1200);
      this.tone(100, 0.09, "triangle", 0.3, 40);
    }
    if (k === "door") {
      this.noise(0.1, 0.27, 1200);
      this.tone(130, 0.09, "sine", 0.28, 39);
    }
    if (k === "reload") {
      this.noise(0.09, 0.23, 4000);
      this.noise(0.07, 0.23, 2800, now + 0.42);
    }
    if (k === "ui") this.tone(622, 0.09, "sine", 0.12, 831);
    if (k === "reward") {
      for (let [i, n] of [64, 67, 71, 76].entries())
        this.tone(
          440 * 2 ** ((n - 69) / 12),
          0.41,
          "triangle",
          0.18,
          440 * 2 ** ((n - 69) / 12),
          now + i * 0.1,
        );
    }
  }
  mix(v, throttle, police, active) {
    if (!this.ctx) return;
    let t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(
      v && active ? 0.065 + Math.min(0.08, Math.abs(v.speed) * 0.002) : 0,
      t,
      0.08,
    );
    if (v) {
      let a = Math.abs(v.speed);
      this.engine.frequency.setTargetAtTime(
        34 + (a % 9) * 5 + a * 0.56 + throttle * 12,
        t,
        0.09,
      );
      this.filter.frequency.setTargetAtTime(
        175 + a * 9 + throttle * 122,
        t,
        0.09,
      );
    }
    this.sirenGain.gain.setTargetAtTime(active ? police * 0.085 : 0, t, 0.12);
    this.siren.frequency.setTargetAtTime(
      680 + (Math.sin(t * 3.7) * 0.5 + 0.5) * 548,
      t,
      0.025,
    );
    if (active && v && this.station < 3) {
      if (this.next < t - 0.1) this.next = t + 0.03;
      let n = 0;
      while (this.next < t + 0.12 && n++ < 4) {
        this.musicTick(this.next);
        this.next += 60 / [108, 88, 124][this.station] / 4;
        this.beat++;
      }
    } else this.next = 0;
  }
  musicTick(t) {
    let s = this.station,
      k = this.beat % 64,
      step = k % 16,
      roots = [
        [53, 50, 55, 48],
        [50, 46, 53, 48],
        [45, 45, 48, 43],
      ][s],
      root = roots[Math.floor(k / 16)],
      freq = (n) => 440 * 2 ** ((n - 69) / 12);
    if (step % 4 === 0) this.tone(125, 0.18, "sine", 0.31, 37, t);
    if (step === 4 || step === 12) {
      this.noise(0.13, 0.21, 2850, t);
      this.tone(175, 0.085, "triangle", 0.09, 73, t);
    }
    if (step % 2 === (s === 1 ? 1 : 0))
      this.noise(step === 14 ? 0.1 : 0.041, 0.064, 6500, t, "highpass");
    if ([0, 3, 6, 10, 14].includes(step)) {
      let f = freq(root - 12 + ([6, 14].includes(step) ? 7 : 0));
      this.tone(
        f,
        0.22,
        s === 2 ? "sawtooth" : "triangle",
        s === 2 ? 0.07 : 0.23,
        f,
        t,
      );
    }
    if (
      (s !== 2 && [2, 7, 10, 15].includes(step)) ||
      (s === 2 && step % 2 === 0)
    ) {
      let notes = [0, s === 1 ? 3 : 4, 7, 10, 12, 7, 4, 2],
        a = freq(root + 12 + notes[(Math.floor(k / 2) + s) % 8]);
      this.tone(
        a,
        s === 1 ? 0.32 : 0.18,
        s === 2 ? "triangle" : "sine",
        0.11,
        a,
        t,
      );
    }
    if (step === (s === 1 ? 0 : 2) || step === 10)
      for (let m of [0, s === 1 ? 3 : 4, 7]) {
        let f = freq(root + m);
        this.tone(f, s === 1 ? 0.65 : 0.24, "triangle", 0.044, f, t);
      }
  }
}
