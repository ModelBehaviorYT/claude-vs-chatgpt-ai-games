/* audio.js - fully synthesized WebAudio sound for the game. Defines window.GameAudio.
   No audio files, no dependencies. Every public method is safe before init(). */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

  var ctx = null, failed = false;
  var comp = null, master = null, sfxBus = null, contBus = null;
  var musicGain = null, musicLP = null, mBus = null, mDelay = null, mFb = null, mFbLP = null;
  var noiseBuf = null, distCurve = null;
  var masterVol = 0.7, musicVol = 0.5;
  var cache = {};
  var lastPlay = {};
  var sess = null;
  var seq = { timer: null, st: null, step: 0, next: 0, sd: 0.125 };
  var eng = null, skd = null, sir = null, hel = null, oce = null, cri = null;

  // ------------------------------------------------------------ utils
  function c01(v) { v = +v; if (v !== v) return 0; return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function running() { return !!ctx && ctx.state === 'running'; }

  function mkGain(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
  function mkFilter(type, f, q) {
    var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = (q === undefined ? 0.7 : q); return b;
  }
  function mkOsc(type, f) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  function loopNoise() {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, Math.random() * 3); return s;
  }
  function noiseSrc(t, dur) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.start(t, Math.random() * 3); s.stop(t + dur + 0.03); return s;
  }
  // smoothed, cached parameter set for per-frame calls
  function sp(key, param, v, tc) {
    var c = cache[key];
    if (c !== undefined && Math.abs(c - v) <= 0.003 * Math.max(Math.abs(v), 0.01)) return;
    cache[key] = v;
    param.setTargetAtTime(v, ctx.currentTime, tc || 0.05);
  }
  function zero(key, node) {
    if (!node) return;
    cache[key] = 0;
    node.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  }

  // ------------------------------------------------------------ init
  function build() {
    var i, n, d;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master = mkGain(masterVol);
    comp.connect(master); master.connect(ctx.destination);

    sfxBus = mkGain(0.85); sfxBus.connect(comp);
    contBus = mkGain(1.0); contBus.connect(comp);

    musicGain = mkGain(musicVol);
    musicLP = mkFilter('lowpass', 5200, 0.5);
    mBus = mkGain(0.9);
    mBus.connect(musicGain); musicGain.connect(musicLP); musicLP.connect(comp);
    mDelay = ctx.createDelay(1.0); mDelay.delayTime.value = 0.3;
    mFbLP = mkFilter('lowpass', 2400, 0.5);
    mFb = mkGain(0.3);
    mDelay.connect(mFbLP); mFbLP.connect(mFb); mFb.connect(mDelay); mFbLP.connect(mBus);

    n = Math.floor(ctx.sampleRate * 4);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    d = noiseBuf.getChannelData(0);
    for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    distCurve = new Float32Array(1024);
    for (i = 0; i < 1024; i++) distCurve[i] = Math.tanh(2.0 * (i / 1023 * 2 - 1));
  }

  function resume() {
    try {
      if (ctx && ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }

  function init() {
    if (failed) return false;
    try {
      if (!ctx) {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) { failed = true; return false; }
        try {
          ctx = new AC();
          build();
        } catch (e1) {
          try { if (ctx && ctx.close) ctx.close(); } catch (e2) {}
          ctx = null; failed = true; return false;
        }
      }
      resume();
      if (radio.index >= 0 && !seq.timer) seqStart(radio.index);
      return true;
    } catch (e) { return false; }
  }

  function setMaster(v) {
    try {
      masterVol = c01(v);
      if (ctx && master) master.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.03);
    } catch (e) {}
  }
  function setMusic(v) {
    try {
      musicVol = c01(v);
      if (ctx && musicGain) musicGain.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.03);
    } catch (e) {}
  }

  // ------------------------------------------------------------ one-shot helpers
  function tone(t, type, f0, f1, dur, vol, o) {
    if (!(vol > 0)) return;
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain(), a = o.attack || 0.003, end, last, f;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + (o.sweep || dur));
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.sustain) {
      end = t + Math.max(a, dur);
      g.gain.setValueAtTime(vol, end);
      end += (o.release || 0.05);
      g.gain.linearRampToValueAtTime(0.0001, end);
    } else {
      end = t + Math.max(dur, a + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    last = osc;
    if (o.cut) {
      f = ctx.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.Q.value = o.q || 0.8;
      f.frequency.setValueAtTime(o.cut, t);
      if (o.cutEnd) f.frequency.exponentialRampToValueAtTime(o.cutEnd, t + (o.cutTime || dur));
      osc.connect(f); last = f;
    }
    last.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(end + 0.03);
  }

  function noise(t, dur, vol, ftype, f0, f1, o) {
    if (!(vol > 0)) return;
    o = o || {};
    var s = noiseSrc(t, dur + 0.02), f = ctx.createBiquadFilter(), g = ctx.createGain(), a = o.attack || 0.002;
    f.type = ftype || 'lowpass'; f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + (o.sweep || dur));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
    s.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
  }

  function brass(t, midi, dur, vol) {
    var f = mtof(midi);
    tone(t, 'sawtooth', f, 0, dur, vol, { sustain: true, attack: 0.015, release: 0.12, cut: 900, cutEnd: 2800, cutTime: 0.08, q: 1 });
    tone(t, 'square', f * 1.003, 0, dur, vol * 0.35, { sustain: true, attack: 0.015, release: 0.12, cut: 1800 });
  }
  function click(t, fr, v) {
    noise(t, 0.03, 1.0 * v, 'bandpass', fr, 0, { q: 5 });
    tone(t, 'square', fr * 0.6, 0, 0.02, 0.12 * v);
    tone(t, 'triangle', fr * 1.5, 0, 0.04, 0.08 * v);
  }

  // ------------------------------------------------------------ one-shots
  var SFX = {
    pistol: function (t, v) {
      noise(t, 0.2, 1.0 * v, 'lowpass', 8000, 500, { sweep: 0.1 });
      noise(t, 0.035, 0.7 * v, 'highpass', 2500);
      tone(t, 'sine', 170, 50, 0.13, 0.9 * v);
      noise(t + 0.02, 0.45, 0.35 * v, 'bandpass', 1200, 500, { q: 0.6 });
    },
    rifle: function (t, v) {
      noise(t, 0.13, 1.3 * v, 'lowpass', 6000, 350, { sweep: 0.07 });
      noise(t, 0.03, 0.8 * v, 'highpass', 3500);
      tone(t, 'sine', 130, 40, 0.12, 1.1 * v);
      tone(t, 'square', 700, 150, 0.04, 0.25 * v);
      noise(t + 0.02, 0.22, 0.3 * v, 'bandpass', 900, 400, { q: 0.6 });
    },
    punch: function (t, v) {
      tone(t, 'sine', 150, 50, 0.11, 0.9 * v);
      noise(t, 0.07, 1.2 * v, 'lowpass', 1100, 300);
      noise(t, 0.02, 0.3 * v, 'bandpass', 2500);
    },
    reload: function (t, v) {
      click(t, 2800, v);
      noise(t + 0.05, 0.1, 0.25 * v, 'bandpass', 1500, 2600, { q: 2, attack: 0.03 });
      click(t + 0.17, 3900, v);
    },
    empty: function (t, v) {
      noise(t, 0.018, 0.5 * v, 'highpass', 2500);
      tone(t, 'triangle', 1500, 800, 0.02, 0.15 * v);
    },
    crash: function (t, v) {
      var d = 0.25 + 0.35 * v, fr = [311, 523, 847, 1290], i;
      noise(t, d, 1.4 * v, 'lowpass', 4500, 250, { sweep: d * 0.7 });
      tone(t, 'sine', 120, 35, 0.22 + 0.1 * v, 1.0 * v);
      for (i = 0; i < fr.length; i++) {
        tone(t, 'square', fr[i] * (0.9 + Math.random() * 0.2), 0, 0.08 + 0.1 * v, 0.07 * v);
      }
      noise(t + 0.05, 0.1 + 0.3 * v, 0.4 * v, 'highpass', 3000, 0, { attack: 0.02 });
    },
    explosion: function (t, v) {
      noise(t, 0.06, 1.0 * v, 'highpass', 1500);
      noise(t, 1.9, 2.6 * v, 'lowpass', 3000, 70, { sweep: 1.4 });
      noise(t + 0.05, 2.6, 3.0 * v, 'lowpass', 220, 60, { attack: 0.08 });
      tone(t, 'sine', 95, 24, 1.1, 1.2 * v, { sweep: 0.9 });
      tone(t, 'triangle', 55, 30, 1.6, 0.5 * v);
    },
    horn: function (t, v) {
      var o = { sustain: true, attack: 0.012, release: 0.05, cut: 2600 };
      tone(t, 'square', 415, 0, 0.38, 0.13 * v, o);
      tone(t, 'sawtooth', 523, 0, 0.38, 0.15 * v, { sustain: true, attack: 0.012, release: 0.05, cut: 3000, detune: 9 });
      tone(t, 'sawtooth', 417, 0, 0.38, 0.1 * v, { sustain: true, attack: 0.012, release: 0.05, cut: 2600, detune: -11 });
    },
    step: function (t, v) {
      var r = 0.8 + Math.random() * 0.4;
      noise(t, 0.05, 0.9 * v, 'lowpass', 650 * r, 250 * r);
      tone(t, 'sine', 95 * r, 60 * r, 0.045, 0.25 * v);
    },
    pickup: function (t, v) {
      tone(t, 'triangle', 784, 0, 0.09, 0.25 * v);
      tone(t + 0.07, 'triangle', 1175, 0, 0.09, 0.25 * v);
      tone(t + 0.14, 'triangle', 1568, 0, 0.24, 0.25 * v);
      tone(t + 0.14, 'sine', 3136, 0, 0.18, 0.07 * v);
    },
    cash: function (t, v) {
      var t2 = t + 0.09;
      noise(t, 0.05, 0.25 * v, 'highpass', 5000);
      tone(t, 'square', 1250, 0, 0.05, 0.1 * v);
      tone(t2, 'sine', 2093, 0, 0.6, 0.22 * v);
      tone(t2, 'sine', 2637, 0, 0.5, 0.16 * v);
      tone(t2, 'sine', 3136, 0, 0.45, 0.1 * v);
      tone(t2, 'triangle', 4186, 0, 0.25, 0.05 * v);
      noise(t2, 0.08, 0.12 * v, 'highpass', 7000);
    },
    ui: function (t, v) {
      tone(t, 'square', 740, 0, 0.05, 0.1 * v, { cut: 2500 });
    },
    uiSelect: function (t, v) {
      tone(t, 'square', 740, 0, 0.06, 0.1 * v, { cut: 2500 });
      tone(t + 0.065, 'square', 1110, 0, 0.13, 0.1 * v, { cut: 3000 });
    },
    missionPass: function (t, v) {
      var a = [70, 74, 77], b = [60, 72, 76, 79, 84], i;
      brass(t, 72, 0.13, 0.14 * v);
      brass(t + 0.15, 76, 0.13, 0.14 * v);
      brass(t + 0.30, 79, 0.13, 0.14 * v);
      brass(t + 0.45, 84, 0.42, 0.16 * v);
      for (i = 0; i < a.length; i++) brass(t + 1.0, a[i], 0.22, 0.09 * v);
      for (i = 0; i < b.length; i++) brass(t + 1.3, b[i], 0.6, 0.08 * v);
      tone(t, 'sine', 130, 65, 0.3, 0.4 * v);
      tone(t + 1.3, 'sine', 130, 65, 0.5, 0.5 * v);
      noise(t + 1.3, 0.9, 0.12 * v, 'highpass', 6000);
    },
    missionFail: function (t, v) {
      var n = [63, 62, 61, 60], i, tt, d, f;
      for (i = 0; i < 4; i++) {
        tt = t + i * 0.34; d = (i < 3) ? 0.28 : 0.8; f = mtof(n[i]);
        tone(tt, 'sawtooth', f, (i === 3) ? f * 0.84 : f * 0.985, d, 0.16 * v,
          { sustain: true, attack: 0.02, release: 0.1, cut: 1500, cutEnd: 500, cutTime: d });
        tone(tt, 'triangle', f / 2, (i === 3) ? f * 0.42 : f * 0.4925, d, 0.14 * v,
          { sustain: true, attack: 0.02, release: 0.1 });
      }
    },
    wasted: function (t, v) {
      var fr = [55, 58.27, 82.41], i;
      tone(t, 'sine', 75, 28, 1.8, 1.1 * v, { sweep: 1.4 });
      noise(t, 2.0, 2.5 * v, 'lowpass', 500, 60, { sweep: 1.5 });
      noise(t, 0.05, 0.6 * v, 'highpass', 1000);
      for (i = 0; i < fr.length; i++) {
        tone(t, 'sawtooth', fr[i], fr[i] * 0.94, 2.2, 0.2 * v, { cut: 700, cutEnd: 120, cutTime: 2, attack: 0.01 });
      }
      tone(t, 'sine', 311.1, 0, 1.8, 0.05 * v);
      tone(t, 'sine', 329.6, 0, 1.8, 0.05 * v);
    },
    hurt: function (t, v) {
      var r = 0.85 + Math.random() * 0.3;
      tone(t, 'sawtooth', 200 * r, 105 * r, 0.16, 0.45 * v, { cut: 700, ftype: 'bandpass', q: 2 });
      noise(t, 0.06, 0.9 * v, 'lowpass', 800, 300);
    },
    scream: function (t, v) {
      var base = 520 + Math.random() * 330, d = 0.28 + Math.random() * 0.2;
      var o = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
      var f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.8, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, t + d * 0.3);
      o.frequency.exponentialRampToValueAtTime(base * 0.75, t + d);
      lfo.frequency.value = 9 + Math.random() * 4; lg.gain.value = base * 0.03;
      lfo.connect(lg); lg.connect(o.frequency);
      f1.type = 'bandpass'; f1.frequency.value = 1100; f1.Q.value = 2.5;
      f2.type = 'bandpass'; f2.frequency.value = 2600; f2.Q.value = 3;
      g2.gain.value = 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5 * v, t + 0.02);
      g.gain.setValueAtTime(0.5 * v, t + d * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f1); f1.connect(g); o.connect(f2); f2.connect(g2); g2.connect(g); g.connect(sfxBus);
      o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
    },
    glass: function (t, v) {
      var i;
      noise(t, 0.22, 0.7 * v, 'highpass', 4500);
      noise(t, 0.05, 0.8 * v, 'bandpass', 3000, 0, { q: 1 });
      for (i = 0; i < 7; i++) {
        tone(t + Math.random() * 0.22, 'sine', 2500 + Math.random() * 5000, 0, 0.05 + Math.random() * 0.12, 0.08 * v);
      }
    },
    door: function (t, v) {
      tone(t, 'sine', 130, 55, 0.1, 0.8 * v);
      noise(t, 0.06, 1.5 * v, 'lowpass', 1000, 300);
      noise(t + 0.045, 0.025, 0.6 * v, 'bandpass', 2600, 0, { q: 3 });
    },
    splash: function (t, v) {
      noise(t, 0.75, 1.4 * v, 'bandpass', 1500, 350, { q: 0.8, attack: 0.03, sweep: 0.5 });
      noise(t, 1.0, 0.25 * v, 'highpass', 3500, 0, { attack: 0.06 });
      tone(t, 'sine', 110, 45, 0.25, 0.5 * v);
    },
    star: function (t, v) {
      tone(t, 'square', 988, 0, 0.1, 0.11 * v, { cut: 4000 });
      tone(t + 0.1, 'square', 1319, 0, 0.1, 0.11 * v, { cut: 4000 });
      tone(t + 0.2, 'square', 1976, 0, 0.32, 0.11 * v, { cut: 5000 });
      tone(t, 'triangle', 494, 0, 0.5, 0.1 * v);
      tone(t, 'sine', 110, 55, 0.2, 0.4 * v);
    }
  };

  function play(name, opts) {
    try {
      if (!running()) return;
      if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(SFX, name)) return;
      var v = 1, now = ctx.currentTime;
      if (opts && typeof opts.vol === 'number' && opts.vol === opts.vol) v = Math.max(0, Math.min(1.5, opts.vol));
      if (v <= 0.001) return;
      if (lastPlay[name] !== undefined && now - lastPlay[name] >= 0 && now - lastPlay[name] < 0.015) return;
      lastPlay[name] = now;
      SFX[name](now + 0.004, v);
    } catch (e) {}
  }

  // ------------------------------------------------------------ continuous: engine
  function buildEngine() {
    var e = {};
    e.o1 = mkOsc('sawtooth', 55); e.o2 = mkOsc('square', 27.5); e.o3 = mkOsc('sawtooth', 55);
    e.o3.detune.value = 14;
    e.g1 = mkGain(0.5); e.g2 = mkGain(0.35); e.g3 = mkGain(0.3);
    e.lp = mkFilter('lowpass', 400, 1.2);
    e.amp = mkGain(0.8); e.out = mkGain(0);
    e.lfo = mkOsc('sine', 7); e.lfoG = mkGain(2);
    e.lfo.connect(e.lfoG);
    e.lfoG.connect(e.o1.frequency); e.lfoG.connect(e.o2.frequency); e.lfoG.connect(e.o3.frequency);
    e.rough = mkOsc('sine', 27.5); e.roughG = mkGain(0.2);
    e.rough.connect(e.roughG); e.roughG.connect(e.amp.gain);
    e.n = loopNoise(); e.nf = mkFilter('lowpass', 250, 0.7); e.ng = mkGain(0.5);
    e.n.connect(e.nf); e.nf.connect(e.ng); e.ng.connect(e.lp);
    e.o1.connect(e.g1); e.g1.connect(e.lp);
    e.o2.connect(e.g2); e.g2.connect(e.lp);
    e.o3.connect(e.g3); e.g3.connect(e.lp);
    e.lp.connect(e.amp); e.amp.connect(e.out); e.out.connect(contBus);
    return e;
  }

  function engine(on, rpm, load) {
    try {
      if (!ctx) return;
      if (!eng) { if (!on) return; eng = buildEngine(); }
      if (!on) { sp('eOut', eng.out.gain, 0, 0.12); return; }
      rpm = c01(rpm); load = c01(load);
      var f = 55 + 205 * rpm;
      sp('eF1', eng.o1.frequency, f, 0.06);
      sp('eF2', eng.o2.frequency, f * 0.5, 0.06);
      sp('eF3', eng.o3.frequency, f, 0.06);
      sp('eRf', eng.rough.frequency, f * 0.5, 0.06);
      sp('eLf', eng.lfo.frequency, 6 + rpm * 9, 0.1);
      sp('eLg', eng.lfoG.gain, 1.2 + rpm * 3.5, 0.1);
      sp('eLp', eng.lp.frequency, 260 + rpm * 1300 + load * 900, 0.08);
      sp('eOut', eng.out.gain, 0.06 + 0.1 * load + 0.05 * rpm, 0.08);
    } catch (e) {}
  }

  // ------------------------------------------------------------ continuous: skid
  function buildSkid() {
    var k = {};
    k.n = loopNoise();
    k.b1 = mkFilter('bandpass', 1400, 6); k.b2 = mkFilter('bandpass', 2200, 8);
    k.g2 = mkGain(0.6); k.out = mkGain(0);
    k.n.connect(k.b1); k.b1.connect(k.out);
    k.n.connect(k.b2); k.b2.connect(k.g2); k.g2.connect(k.out);
    k.out.connect(contBus);
    return k;
  }
  function skid(amount) {
    try {
      if (!ctx) return;
      var a = c01(amount);
      if (!skd) { if (a <= 0) return; skd = buildSkid(); }
      sp('sOut', skd.out.gain, a * 1.3, 0.05);
      if (a > 0) {
        sp('sF1', skd.b1.frequency, 1200 + a * 500, 0.08);
        sp('sF2', skd.b2.frequency, 1900 + a * 700, 0.08);
      }
    } catch (e) {}
  }

  // ------------------------------------------------------------ continuous: siren
  function buildSiren() {
    var s = {};
    s.o1 = mkOsc('sawtooth', 1000); s.o2 = mkOsc('square', 1000);
    s.g2 = mkGain(0.4);
    s.lfo = mkOsc('sine', 0.45); s.lfoG = mkGain(360);
    s.lfo.connect(s.lfoG); s.lfoG.connect(s.o1.frequency); s.lfoG.connect(s.o2.frequency);
    s.bp = mkFilter('bandpass', 1200, 0.7);
    s.out = mkGain(0);
    s.o1.connect(s.bp); s.o2.connect(s.g2); s.g2.connect(s.bp);
    s.bp.connect(s.out); s.out.connect(contBus);
    return s;
  }
  function siren(level) {
    try {
      if (!ctx) return;
      var l = c01(level);
      if (!sir) { if (l <= 0) return; sir = buildSiren(); }
      sp('siOut', sir.out.gain, l * 0.14, 0.08);
    } catch (e) {}
  }

  // ------------------------------------------------------------ continuous: helicopter
  function buildHeli() {
    var h = {};
    h.n = loopNoise(); h.lp = mkFilter('lowpass', 600, 0.7);
    h.th = mkOsc('sine', 62); h.tg = mkGain(0.25);
    h.wh = mkOsc('sawtooth', 380); h.wf = mkFilter('bandpass', 900, 1); h.wg = mkGain(0.03);
    h.chop = mkGain(0.5);
    h.lfo = mkOsc('sawtooth', 12.5); h.lg = mkGain(0.5);
    h.lfo.connect(h.lg); h.lg.connect(h.chop.gain);
    h.out = mkGain(0);
    h.n.connect(h.lp); h.lp.connect(h.chop);
    h.th.connect(h.tg); h.tg.connect(h.chop);
    h.wh.connect(h.wf); h.wf.connect(h.wg); h.wg.connect(h.out);
    h.chop.connect(h.out); h.out.connect(contBus);
    return h;
  }
  function heli(level) {
    try {
      if (!ctx) return;
      var l = c01(level);
      if (!hel) { if (l <= 0) return; hel = buildHeli(); }
      sp('hOut', hel.out.gain, l * 1.3, 0.1);
    } catch (e) {}
  }

  // ------------------------------------------------------------ continuous: ambience
  function buildOcean() {
    var o = {};
    o.n = loopNoise(); o.lp = mkFilter('lowpass', 800, 0.5);
    o.n2 = loopNoise(); o.bp = mkFilter('bandpass', 3000, 0.5); o.hg = mkGain(0.15);
    o.wave = mkGain(0.55);
    o.l1 = mkOsc('sine', 0.1); o.g1 = mkGain(0.35);
    o.l2 = mkOsc('sine', 0.27); o.g2 = mkGain(0.1);
    o.l1.connect(o.g1); o.g1.connect(o.wave.gain);
    o.l2.connect(o.g2); o.g2.connect(o.wave.gain);
    o.out = mkGain(0);
    o.n.connect(o.lp); o.lp.connect(o.wave);
    o.n2.connect(o.bp); o.bp.connect(o.hg); o.hg.connect(o.wave);
    o.wave.connect(o.out); o.out.connect(contBus);
    return o;
  }
  function cricketVoice(freq, trillHz, burstHz, vol, dest) {
    var o = mkOsc('sine', freq), tr = mkGain(0.5), bu = mkGain(0.5), g = mkGain(vol);
    var la = mkOsc('square', trillHz), ga = mkGain(0.5), lb = mkOsc('sine', burstHz), gb = mkGain(0.5);
    la.connect(ga); ga.connect(tr.gain);
    lb.connect(gb); gb.connect(bu.gain);
    o.connect(tr); tr.connect(bu); bu.connect(g); g.connect(dest);
  }
  function buildCrickets() {
    var c = {};
    c.out = mkGain(0);
    cricketVoice(4500, 34, 1.1, 1.0, c.out);
    cricketVoice(4150, 29, 0.7, 0.6, c.out);
    c.out.connect(contBus);
    return c;
  }
  function ambient(day, ocean) {
    try {
      if (!ctx) return;
      var d = (typeof day === 'number') ? c01(day) : 1;
      var oc = c01(ocean);
      var night = c01((0.45 - d) / 0.35);
      if (!oce && oc > 0) oce = buildOcean();
      if (oce) sp('aOc', oce.out.gain, oc * 1.3, 0.3);
      if (!cri && night > 0) cri = buildCrickets();
      if (cri) sp('aCr', cri.out.gain, night * 0.03, 0.5);
    } catch (e) {}
  }

  // ------------------------------------------------------------ music voices
  function mOut(node, send) {
    if (!sess) return;
    node.connect(sess.out);
    if (send > 0) {
      var g = ctx.createGain(); g.gain.value = send;
      node.connect(g); g.connect(sess.send);
    }
  }

  function mKick(t, vol, f0, f1, dur) {
    if (!sess) return;
    f0 = f0 || 150; f1 = f1 || 48; dur = dur || 0.28;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); mOut(g, 0);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function mNoise(t, dur, vol, ftype, freq, q, send, attack) {
    if (!sess || !(vol > 0)) return;
    var s = noiseSrc(t, dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = ftype; f.frequency.value = freq; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); mOut(g, send || 0);
  }

  function mSnare(t, vol, gated) {
    if (!sess) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    var dur = gated ? 0.22 : 0.13;
    var s = noiseSrc(t, dur), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    g.gain.setValueAtTime(vol * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); mOut(g, 0);
    o.start(t); o.stop(t + 0.13);
    f.type = 'highpass'; f.frequency.value = gated ? 1200 : 1800; f.Q.value = 0.6;
    ng.gain.setValueAtTime(vol, t);
    if (gated) {
      ng.gain.exponentialRampToValueAtTime(vol * 0.4, t + 0.16);
      ng.gain.linearRampToValueAtTime(0.0001, t + 0.2);
    } else {
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    }
    s.connect(f); f.connect(ng); mOut(ng, gated ? 0.1 : 0);
  }

  function mClap(t, vol) {
    mNoise(t, 0.025, vol, 'bandpass', 1400, 1.2);
    mNoise(t + 0.011, 0.025, vol, 'bandpass', 1400, 1.2);
    mNoise(t + 0.022, 0.14, vol, 'bandpass', 1500, 1.0, 0.12);
  }
  function mHat(t, vol, dur) { mNoise(t, dur || 0.035, vol, 'highpass', 7500, 0.7); }
  function mShaker(t, vol) { mNoise(t, 0.055, vol, 'bandpass', 6000, 1.2, 0, 0.012); }
  function mTom(t, vol, f) { mKick(t, vol, f, f * 0.55, 0.2); }
  function mRim(t, vol) {
    if (!sess) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(900, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); mOut(g, 0.2);
    o.start(t); o.stop(t + 0.06);
    mNoise(t, 0.02, vol * 0.5, 'bandpass', 2500, 2);
  }

  // generic subtractive voice. p = patch
  function synth(t, midi, dur, p, vmul) {
    if (!sess) return;
    var n = p.type2 ? 2 : 1;
    var vol = (p.vol || 0.1) * (vmul === undefined ? 1 : vmul) * (n === 2 ? 0.65 : 1);
    if (!(vol > 0)) return;
    var f = mtof(midi), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    var a = p.attack || 0.004, r = p.release || 0.05, c0 = p.cut || 2000, c1 = p.cutEnd || c0;
    var end, hold, i, o, fr, lfo = null, lg = null;
    lp.type = 'lowpass'; lp.Q.value = p.q || 1;
    lp.frequency.setValueAtTime(c0, t);
    if (c1 !== c0) lp.frequency.exponentialRampToValueAtTime(c1, t + (p.cutTime || Math.max(dur, 0.02)));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (p.pluck) {
      end = t + Math.max(dur, a + 0.02) + r;
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      hold = t + Math.max(a, dur);
      g.gain.setValueAtTime(vol, hold);
      end = hold + r;
      g.gain.linearRampToValueAtTime(0.0001, end);
    }
    if (p.vib) {
      lfo = ctx.createOscillator(); lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.3);
      lfo.connect(lg);
      lfo.start(t); lfo.stop(end + 0.03);
    }
    for (i = 0; i < n; i++) {
      o = ctx.createOscillator();
      o.type = (i === 0) ? (p.type || 'sawtooth') : p.type2;
      fr = (i === 1 && p.oct2) ? f * Math.pow(2, p.oct2) : f;
      o.frequency.setValueAtTime(fr, t);
      if (p.detune) o.detune.value = (i === 0) ? -p.detune : p.detune;
      if (lg) lg.connect(o.frequency);
      o.connect(lp);
      o.start(t); o.stop(end + 0.03);
    }
    lp.connect(g); mOut(g, p.send || 0);
  }

  function mPad(t, notes, dur, vol, cut, gate, sd, send) {
    if (!sess) return;
    var g = ctx.createGain(), lp = ctx.createBiquadFilter(), end = t + dur + 0.12, i, k, o;
    lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 1;
    g.gain.setValueAtTime(0, t);
    if (gate) {
      for (i = 0; i < gate.length; i++) g.gain.setTargetAtTime(gate[i] ? vol : vol * 0.1, t + i * sd, 0.008);
    } else {
      g.gain.setTargetAtTime(vol, t, 0.08);
    }
    g.gain.setTargetAtTime(0, t + dur - 0.03, 0.02);
    for (i = 0; i < notes.length; i++) {
      for (k = 0; k < 2; k++) {
        o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(mtof(notes[i]), t);
        o.detune.value = k ? 9 : -9;
        o.connect(lp); o.start(t); o.stop(end);
      }
    }
    lp.connect(g); mOut(g, send || 0);
  }

  function mBell(t, midi, dur, vol, send) {
    if (!sess) return;
    var f = mtof(midi), c = ctx.createOscillator(), c2 = ctx.createOscillator(), m = ctx.createOscillator();
    var mg = ctx.createGain(), g = ctx.createGain(), g2 = ctx.createGain(), end = t + dur;
    c.frequency.setValueAtTime(f, t);
    c2.frequency.setValueAtTime(f * 2.005, t);
    m.frequency.setValueAtTime(f * 3.5, t);
    mg.gain.setValueAtTime(f * 2.0, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.8);
    m.connect(mg); mg.connect(c.frequency);
    g2.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    c.connect(g); c2.connect(g2); g2.connect(g); mOut(g, send || 0);
    c.start(t); c2.start(t); m.start(t);
    c.stop(end + 0.03); c2.stop(end + 0.03); m.stop(end + 0.03);
  }

  function mEP(t, midi, dur, vol, send) {
    if (!sess) return;
    var f = mtof(midi), c1 = ctx.createOscillator(), c2 = ctx.createOscillator(), m = ctx.createOscillator();
    var mg = ctx.createGain(), g = ctx.createGain(), end = t + Math.max(dur, 0.04) + 0.15;
    c1.frequency.setValueAtTime(f, t);
    c2.frequency.setValueAtTime(f, t); c2.detune.value = 7;
    m.frequency.setValueAtTime(f, t);
    mg.gain.setValueAtTime(f * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.3);
    m.connect(mg); mg.connect(c1.frequency); mg.connect(c2.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.28, t + Math.max(dur, 0.04));
    g.gain.linearRampToValueAtTime(0.0001, end);
    c1.connect(g); c2.connect(g); mOut(g, send || 0);
    c1.start(t); c2.start(t); m.start(t);
    c1.stop(end + 0.03); c2.stop(end + 0.03); m.stop(end + 0.03);
  }

  function m808(t, midi, dur, vol, slideTo) {
    if (!sess) return;
    var f = mtof(midi), o = ctx.createOscillator(), pre = ctx.createGain(), ws = ctx.createWaveShaper();
    var lp = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 0.1;
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 2.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    if (slideTo) {
      o.frequency.setValueAtTime(f, t + Math.max(0.05, dur * 0.3));
      o.frequency.exponentialRampToValueAtTime(mtof(slideTo), t + Math.max(0.08, dur * 0.8));
    }
    pre.gain.value = 0.9;
    ws.curve = distCurve;
    lp.type = 'lowpass'; lp.frequency.value = 750; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.55, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, end);
    o.connect(pre); pre.connect(ws); ws.connect(lp); lp.connect(g); mOut(g, 0);
    o.start(t); o.stop(end + 0.03);
  }

  function notesAt(arr, s, t, sd, patch, lenMul, vmul) {
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i][0] === s) synth(t, arr[i][1], arr[i][2] * sd * lenMul, patch, vmul);
    }
  }

  // ------------------------------------------------------------ patches
  var P = {
    wBass:  { type: 'sawtooth', type2: 'square', cut: 1100, cutEnd: 220, q: 5, vol: 0.26, attack: 0.003, release: 0.03 },
    wArp:   { type: 'sawtooth', type2: 'square', detune: 6, cut: 4200, cutEnd: 900, q: 2, vol: 0.11, pluck: true, release: 0.08, send: 0.35 },
    wLead:  { type: 'sawtooth', type2: 'sawtooth', detune: 9, cut: 3400, q: 1.5, vol: 0.15, attack: 0.015, release: 0.09, vib: 1, send: 0.4 },
    cBass:  { type: 'triangle', type2: 'square', cut: 750, cutEnd: 220, q: 2, vol: 0.36, attack: 0.004, release: 0.04 },
    cPluck: { type: 'triangle', type2: 'square', oct2: 1, cut: 3200, cutEnd: 700, q: 1, vol: 0.1, pluck: true, release: 0.06, send: 0.2 },
    cLead:  { type: 'sawtooth', type2: 'square', detune: 5, cut: 900, cutEnd: 3000, cutTime: 0.06, q: 2, vol: 0.13, attack: 0.01, release: 0.07, vib: 1, send: 0.3 },
    hPad:   { type: 'triangle', type2: 'sawtooth', detune: 8, cut: 700, q: 0.7, vol: 0.05, attack: 0.25, release: 0.4 },
    lBass:  { type: 'triangle', type2: 'sawtooth', cut: 900, cutEnd: 300, q: 1.5, vol: 0.34, attack: 0.004, release: 0.05 },
    lLead:  { type: 'triangle', type2: 'sine', oct2: 1, cut: 3500, q: 0.7, vol: 0.13, attack: 0.02, release: 0.1, vib: 1, send: 0.35 }
  };

  // ------------------------------------------------------------ station 1: WAVE 99 (synthwave, A minor)
  var W_CH = [
    { b: 45, c: [57, 60, 64] }, { b: 41, c: [57, 60, 65] }, { b: 48, c: [55, 60, 64] }, { b: 43, c: [55, 59, 62] },
    { b: 45, c: [57, 60, 64] }, { b: 41, c: [57, 60, 65] }, { b: 38, c: [57, 62, 65] }, { b: 40, c: [56, 59, 64] }
  ];
  var W_ARP_A = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1];
  var W_ARP_B = [3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 3, 1];
  var W_GATE = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0];
  var W_LEAD = [
    [[0, 76, 3], [4, 72, 2], [6, 74, 2], [8, 76, 4], [14, 79, 2]],
    [[0, 81, 6], [8, 79, 2], [10, 76, 2], [12, 77, 4]],
    [[0, 74, 3], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 72, 2], [14, 74, 2]],
    [[0, 76, 8], [8, 80, 4], [12, 83, 4]]
  ];

  function playWave(step, t, sd) {
    var s = step % 16, bar = Math.floor(step / 16), b = bar % 8, cyc = Math.floor(bar / 8);
    var ch = W_CH[b], leadOn = (cyc % 2 === 1) && b >= 4, ord, ai, an;
    // drums
    if (s === 0 || s === 8 || (s === 10 && (b & 1))) mKick(t, 0.5);
    if (s === 4 || s === 12) mSnare(t, 0.3, true);
    if (b === 3 && s === 14) mSnare(t, 0.15, false);
    if (b === 7 && s >= 12) mTom(t, 0.3, 230 - (s - 12) * 35);
    if (s % 2 === 0) mHat(t, (s % 4 === 2) ? 0.07 : 0.045, (s % 4 === 2) ? 0.07 : 0.035);
    else if (s % 4 === 3) mHat(t, 0.025, 0.03);
    // rolling bass with a ducked downbeat (sidechain feel)
    synth(t, ch.b + ((s === 6 || s === 14) ? 12 : 0), sd * 0.8, P.wBass, (s % 8 === 0) ? 0.5 : 1);
    // gated pad
    if (s === 0) mPad(t, ch.c, sd * 16, 0.05, 1500, W_GATE, sd, 0.15);
    // arpeggio
    ord = (b < 4) ? W_ARP_A : W_ARP_B;
    ai = ord[s];
    an = ((ai === 3) ? ch.c[0] + 12 : ch.c[ai]) + 12;
    synth(t, an, sd * 0.9, P.wArp, leadOn ? 0.55 : 1);
    // lead on alternate cycles
    if (leadOn) notesAt(W_LEAD[b - 4], s, t, sd, P.wLead, 0.95, 1);
  }

  // ------------------------------------------------------------ station 2: Radio Caliente (dembow, D minor)
  var C_CH = [
    { b: 38, c: [62, 65, 69] }, { b: 36, c: [60, 64, 67] }, { b: 34, c: [58, 62, 65] }, { b: 33, c: [57, 61, 64] }
  ];
  var C_MONT = [0, -1, 1, 2, -1, 1, 2, -1, 0, -1, 1, 2, -1, 1, 2, -1];
  var C_BASS = [[0, 0, 3], [3, 0, 2], [6, 7, 2], [8, 0, 3], [11, 0, 2], [14, 7, 2]];
  var C_LEAD_A = [
    [[0, 74, 2], [3, 77, 2], [6, 81, 3], [10, 79, 2], [12, 77, 2], [14, 76, 2]],
    [[0, 76, 3], [3, 79, 3], [6, 76, 2], [10, 72, 2], [12, 74, 3]],
    [[0, 77, 2], [3, 74, 2], [6, 70, 3], [10, 74, 2], [12, 77, 2], [14, 79, 2]],
    [[0, 76, 3], [3, 73, 3], [6, 76, 2], [8, 81, 6]]
  ];
  var C_LEAD_B = [
    [[2, 81, 2], [4, 82, 1], [5, 81, 2], [8, 77, 3], [11, 74, 3], [14, 77, 2]],
    [[0, 79, 4], [6, 76, 2], [8, 79, 2], [11, 84, 4]],
    [[2, 82, 2], [4, 81, 1], [5, 79, 2], [8, 77, 3], [11, 74, 3], [14, 70, 2]],
    [[0, 73, 3], [3, 76, 3], [6, 79, 2], [8, 81, 2], [10, 85, 5]]
  ];

  function playCaliente(step, t, sd) {
    var s = step % 16, bar = Math.floor(step / 16), b = bar % 4, cyc = Math.floor(bar / 4);
    var ch = C_CH[b], mode = cyc % 4, i, e, mi;
    var fill = (b === 3 && (cyc & 1) && s >= 12);
    // dembow drums
    if (s % 4 === 0) mKick(t, 0.5, 150, 50, 0.24);
    if (fill) mSnare(t, 0.1 + (s - 12) * 0.04, false);
    else if (s === 3 || s === 6 || s === 11 || s === 14) mSnare(t, (s === 6 || s === 14) ? 0.22 : 0.17, false);
    if (s % 2 === 0) mHat(t, 0.04, 0.03);
    mShaker(t, (s % 4 === 2) ? 0.03 : 0.014);
    if (b & 1) {
      if (s === 7) mTom(t, 0.14, 330);
      if (s === 15) mTom(t, 0.14, 240);
    } else if (s === 10) {
      mTom(t, 0.1, 290);
    }
    // syncopated bass
    for (i = 0; i < C_BASS.length; i++) {
      e = C_BASS[i];
      if (e[0] === s) synth(t, ch.b + e[1], e[2] * sd * 0.9, P.cBass, 1);
    }
    // montuno pluck
    mi = C_MONT[s];
    if (mi >= 0) synth(t, ch.c[mi], sd * 1.1, P.cPluck, (mode === 0) ? 1.3 : 1);
    // lead: off / A / B / A
    if (mode === 1 || mode === 3) notesAt(C_LEAD_A[b], s, t, sd, P.cLead, 0.9, 1);
    else if (mode === 2) notesAt(C_LEAD_B[b], s, t, sd, P.cLead, 0.9, 1);
  }

  // ------------------------------------------------------------ station 3: Bass Bay FM (hip-hop, C minor)
  // [step, midi, lengthSteps, slideToMidi(0 = none), kick]
  var H_808 = [
    [[0, 36, 6, 0, 1], [10, 36, 2, 0, 1], [12, 39, 4, 36, 0]],
    [[0, 36, 5, 0, 1], [6, 36, 3, 0, 1], [10, 43, 4, 36, 1]],
    [[0, 32, 6, 0, 1], [8, 32, 3, 0, 1], [11, 34, 3, 32, 0], [14, 32, 2, 0, 1]],
    [[0, 31, 6, 0, 1], [8, 31, 2, 0, 1], [10, 31, 2, 0, 1], [12, 34, 4, 36, 0]]
  ];
  var H_CH = [[60, 63, 67], [60, 63, 67], [60, 63, 68], [59, 62, 67]];
  var H_BELL_A = [
    [[0, 72, 3], [3, 75, 3], [6, 79, 4], [12, 75, 4]],
    [[0, 74, 3], [3, 75, 3], [6, 72, 6]],
    [[0, 72, 3], [3, 75, 3], [6, 80, 4], [12, 79, 4]],
    [[0, 74, 4], [6, 71, 4], [12, 67, 4]]
  ];
  var H_BELL_B = [
    [[0, 84, 2], [2, 82, 2], [4, 79, 4], [10, 75, 2], [12, 79, 4]],
    [[0, 80, 6], [8, 79, 2], [10, 75, 6]],
    [[0, 84, 2], [2, 82, 2], [4, 80, 4], [10, 75, 2], [12, 72, 4]],
    [[0, 74, 6], [8, 71, 4], [12, 74, 2], [14, 79, 2]]
  ];

  function playBay(step, t, sd) {
    var s = step % 16, bar = Math.floor(step / 16), b = bar % 4, cyc = Math.floor(bar / 4);
    var drop = (cyc % 4 === 3) && b === 3 && s < 8;
    var arr = H_808[b], i, e, k, ch;
    // 808 + kick
    for (i = 0; i < arr.length; i++) {
      e = arr[i];
      if (e[0] === s) {
        m808(t, e[1], e[2] * sd, 0.5, e[3]);
        if (e[4] && !drop) mKick(t, 0.42, 130, 45, 0.18);
      }
    }
    if (!drop) {
      if (s === 4 || s === 12) { mClap(t, 0.24); mSnare(t, 0.1, false); }
      // sparse hats with rolls
      if (b === 1 && s >= 14) {
        mHat(t, 0.045, 0.025); mHat(t + sd * 0.5, 0.06, 0.025);
      } else if (b === 3 && (s === 6 || s === 7)) {
        for (k = 0; k < 3; k++) mHat(t + k * sd / 3, 0.035 + k * 0.012, 0.022);
      } else if (b === 3 && s >= 14 && (cyc & 1)) {
        mHat(t, 0.05, 0.022); mHat(t + sd * 0.5, 0.04, 0.022);
      } else if (s % 2 === 0 || s === 3 || s === 11) {
        mHat(t, (s % 4 === 0) ? 0.06 : 0.038, 0.03);
      }
      if (!(b & 1) && s === 14) mHat(t, 0.04, 0.16);
      if ((b & 1) && s === 7) mRim(t, 0.12);
    }
    // dark pad
    if (s === 0) {
      ch = H_CH[b];
      for (i = 0; i < ch.length; i++) synth(t, ch[i], sd * 15.5, P.hPad, 1);
    }
    // bell melody, alternate phrase on odd cycles
    arr = ((cyc & 1) ? H_BELL_B : H_BELL_A)[b];
    for (i = 0; i < arr.length; i++) {
      e = arr[i];
      if (e[0] === s) mBell(t, e[1], e[2] * sd * 1.8 + 0.3, 0.1, 0.4);
    }
  }

  // ------------------------------------------------------------ station 4: Coast Lounge (chill funk, D major)
  var L_CH = [
    { c: [54, 57, 61, 64], w: [38, 42, 45, 46] },
    { c: [54, 57, 59, 62], w: [47, 50, 45, 44] },
    { c: [54, 55, 59, 62], w: [43, 47, 50, 44] },
    { c: [55, 57, 62, 64], w: [45, 40, 43, 37] },
    { c: [54, 57, 61, 64], w: [38, 45, 42, 41] },
    { c: [57, 61, 64, 66], w: [42, 45, 49, 44] },
    { c: [54, 55, 59, 62], w: [43, 50, 47, 46] },
    { c: [55, 61, 64, 66], w: [45, 49, 52, 40] }
  ];
  var L_COMP_A = [[0, 5], [6, 1], [10, 3], [14, 1]];
  var L_COMP_B = [[0, 3], [3, 2], [8, 4], [14, 2]];
  var L_SHK = [0.045, 0.018, 0.03, 0.018];
  var L_MEL = [
    [[2, 78, 2], [4, 81, 3], [8, 83, 2], [10, 81, 4]],
    [[0, 78, 3], [4, 76, 2], [6, 74, 4], [12, 76, 2], [14, 78, 2]],
    [[2, 79, 2], [4, 78, 2], [6, 74, 3], [10, 71, 4]],
    [[0, 76, 6], [8, 74, 2], [10, 76, 2], [12, 81, 4]],
    [[2, 78, 2], [4, 81, 3], [8, 85, 2], [10, 83, 4]],
    [[0, 81, 3], [4, 78, 2], [6, 76, 4], [12, 73, 4]],
    [[2, 74, 2], [4, 78, 2], [6, 83, 3], [10, 81, 2], [12, 78, 4]],
    [[0, 76, 4], [6, 73, 2], [8, 76, 2], [10, 79, 2], [12, 78, 4]]
  ];
  var L_LICK_A = [[8, 74, 2], [10, 76, 2], [12, 81, 2], [14, 78, 2]];
  var L_LICK_B = [[8, 81, 1], [9, 78, 1], [10, 76, 2], [12, 74, 4]];

  function playLounge(step, t, sd) {
    var s = step % 16, bar = Math.floor(step / 16), b = bar % 8, cyc = Math.floor(bar / 8);
    var ch = L_CH[b], i, j, arr;
    // drums
    if (s === 0 || s === 10) mKick(t, 0.42, 140, 50, 0.22);
    else if ((b & 1) && s === 7) mKick(t, 0.26, 140, 50, 0.18);
    if (s === 4 || s === 12) mSnare(t, 0.2, false);
    if ((b & 1) && s === 15) mSnare(t, 0.06, false);
    if (b === 7 && (s === 13 || s === 14)) mSnare(t, 0.1, false);
    mShaker(t, L_SHK[s % 4]);
    if (s % 4 === 2) mHat(t, 0.035, 0.03);
    if (b % 4 === 3 && s === 14) mHat(t, 0.05, 0.2);
    // walking bass
    if (s % 4 === 0) synth(t, ch.w[s / 4], sd * 3.3, P.lBass, 1);
    else if (!(b & 1) && s === 7) synth(t, ch.w[0] + 12, sd * 0.7, P.lBass, 0.55);
    // electric piano comping
    arr = (b & 1) ? L_COMP_B : L_COMP_A;
    for (i = 0; i < arr.length; i++) {
      if (arr[i][0] === s) {
        for (j = 0; j < ch.c.length; j++) mEP(t, ch.c[j], arr[i][1] * sd, 0.09, 0.15);
      }
    }
    // melody on odd cycles, short licks otherwise
    arr = (cyc % 2 === 1) ? L_MEL[b] : (b === 3 ? L_LICK_A : (b === 7 ? L_LICK_B : null));
    notesAt(arr, s, t, sd, P.lLead, 0.95, 1);
  }

  var STATIONS = [
    { name: 'WAVE 99', genre: 'Synthwave', bpm: 104, swing: 0, play: playWave },
    { name: 'Radio Caliente', genre: 'Latin heat', bpm: 96, swing: 0, play: playCaliente },
    { name: 'Bass Bay FM', genre: 'Hip-hop', bpm: 84, swing: 0, play: playBay },
    { name: 'Coast Lounge', genre: 'Chill funk', bpm: 112, swing: 0.1, play: playLounge }
  ];

  // ------------------------------------------------------------ sequencer
  function killSession() {
    var old = sess;
    sess = null;
    if (!old || !ctx) return;
    try {
      var now = ctx.currentTime;
      old.out.gain.setTargetAtTime(0, now, 0.03);
      old.send.gain.setTargetAtTime(0, now, 0.03);
      mFb.gain.cancelScheduledValues(now);
      mFb.gain.setValueAtTime(0, now);
      mFb.gain.setTargetAtTime(0.3, now + 0.35, 0.05);
    } catch (e) {}
    setTimeout(function () {
      try { old.out.disconnect(); old.send.disconnect(); } catch (e) {}
    }, 400);
  }

  function newSession() {
    killSession();
    var o = mkGain(1), s = mkGain(1);
    o.connect(mBus); s.connect(mDelay);
    sess = { out: o, send: s };
  }

  function seqStop() {
    if (seq.timer) { clearInterval(seq.timer); seq.timer = null; }
    seq.st = null;
    killSession();
  }

  function seqTick() {
    try {
      var st = seq.st;
      if (!st || !running() || !sess) return;
      var now = ctx.currentTime, missed, tt, guard = 0;
      if (seq.next < now - 0.05) {
        // fell behind (throttled tab etc.): skip ahead but keep musical position
        missed = Math.ceil((now + 0.03 - seq.next) / seq.sd);
        seq.step += missed; seq.next += missed * seq.sd;
      }
      while (seq.next < now + 0.12 && guard++ < 16) {
        tt = seq.next + ((seq.step & 1) ? st.swing * seq.sd : 0);
        try { st.play(seq.step, tt, seq.sd); } catch (e1) {}
        seq.step++; seq.next += seq.sd;
      }
    } catch (e) {}
  }

  function seqStart(i) {
    seqStop();
    if (!ctx) return;
    var st = STATIONS[i];
    if (!st) return;
    newSession();
    seq.st = st; seq.step = 0; seq.sd = 60 / st.bpm / 4;
    seq.next = ctx.currentTime + 0.1;
    try { mDelay.delayTime.setValueAtTime(Math.min(0.95, seq.sd * 3), ctx.currentTime); } catch (e) {}
    seq.timer = setInterval(seqTick, 25);
  }

  // ------------------------------------------------------------ radio
  var radio = {
    stations: [
      { name: STATIONS[0].name, genre: STATIONS[0].genre },
      { name: STATIONS[1].name, genre: STATIONS[1].genre },
      { name: STATIONS[2].name, genre: STATIONS[2].genre },
      { name: STATIONS[3].name, genre: STATIONS[3].genre }
    ],
    index: -1,
    last: 0,
    set: function (i) {
      try {
        i = Math.floor(+i);
        if (!(i >= 0 && i < STATIONS.length)) i = -1;
        radio.index = i;
        if (i >= 0) radio.last = i;
        seqStop();
        if (i >= 0 && ctx) {
          seqStart(i);
          // short tuning-static blip
          if (running()) noise(ctx.currentTime + 0.005, 0.1, 0.12, 'bandpass', 2600, 900, { q: 1, dest: musicGain });
        }
      } catch (e) {}
      return radio.index;
    },
    next: function () {
      var i = radio.index + 1;
      if (!(i >= -1 && i < STATIONS.length)) i = -1;
      return radio.set(i);
    },
    prev: function () {
      var i = radio.index - 1;
      if (i < -1 || !(i < STATIONS.length)) i = STATIONS.length - 1;
      return radio.set(i);
    },
    stop: function () { return radio.set(-1); }
  };

  function stopAll() {
    try { radio.set(-1); } catch (e) {}
    try {
      if (!ctx) return;
      if (eng) zero('eOut', eng.out);
      if (skd) zero('sOut', skd.out);
      if (sir) zero('siOut', sir.out);
      if (hel) zero('hOut', hel.out);
      if (oce) zero('aOc', oce.out);
      if (cri) zero('aCr', cri.out);
    } catch (e) {}
  }

  // resume a suspended context on user gestures (only once a context exists)
  try {
    if (root.addEventListener) {
      root.addEventListener('pointerdown', resume, true);
      root.addEventListener('keydown', resume, true);
      root.addEventListener('touchstart', resume, true);
    }
  } catch (e) {}

  root.GameAudio = {
    init: init,
    setMaster: setMaster,
    setMusic: setMusic,
    play: play,
    engine: engine,
    skid: skid,
    siren: siren,
    heli: heli,
    ambient: ambient,
    radio: radio,
    stopAll: stopAll
  };
})();
