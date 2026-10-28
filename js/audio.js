/* Dustline - audio.js: every sound is synthesized with WebAudio, so the game ships no audio files. */
'use strict';
(function (DL) {
  const A = (DL.audio = {});
  let ctx = null, master = null, conv = null, noiseBuf = null;
  A.listener = { x: 0, y: 1.6, z: 0, yaw: 0 };

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain();
    master.gain.value = DL.settings.volume;
    master.connect(comp);
    comp.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Short outdoor slap-back reverb shared by loud sounds.
    conv = ctx.createConvolver();
    conv.buffer = makeImpulse(1.5, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    conv.connect(wet);
    wet.connect(master);
  };

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const early = i > rate * 0.03 && i < rate * 0.05 ? 1.6 : 1; // a wall echo
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.01 ? 0 : early);
      }
    }
    return buf;
  }

  A.setVolume = (v) => { if (master) master.gain.value = v; };
  A.resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  A.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };

  // Builds gain -> lowpass -> panner -> master for one sound and returns its input.
  function out(pos, vol, reverb) {
    if (!ctx) return null;
    let gain = vol, pan = 0, lp = 18000, dist = 0;
    if (pos) {
      const L = A.listener;
      const dx = pos.x - L.x, dy = (pos.y || 0) - L.y, dz = pos.z - L.z;
      dist = Math.hypot(dx, dy, dz);
      gain *= 1 / Math.pow(1 + dist / 7, 1.2);
      if (dist > 0.4) {
        const nx = dx / dist, nz = dz / dist;
        const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
        const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw);
        pan = DL.clamp(nx * rx + nz * rz, -1, 1) * 0.85;
        const front = nx * fx + nz * fz;
        lp = 17000 / (1 + dist / 26);
        if (front < 0) lp *= 0.6 + 0.4 * (1 + front);
      }
      if (gain < 0.003) return null;
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.max(500, lp);
    g.connect(f);
    let tail = f;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      f.connect(p);
      tail = p;
    }
    tail.connect(master);
    if (reverb && conv) {
      const s = ctx.createGain();
      s.gain.value = reverb * (pos ? Math.min(1.6, 0.6 + dist / 25) : 0.6);
      tail.connect(s);
      s.connect(conv);
    }
    return g;
  }

  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function noise(o, t, dur, opt) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.playbackRate.value = opt.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opt.type || 'lowpass';
    f.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1) f.frequency.exponentialRampToValueAtTime(opt.f1, t + dur);
    f.Q.value = opt.q || 0.7;
    const g = ctx.createGain();
    env(g, t, opt.vol == null ? 1 : opt.vol, opt.attack || 0.002, dur);
    s.connect(f); f.connect(g); g.connect(o);
    s.start(t, Math.random() * 1.6);
    s.stop(t + dur + 0.03);
  }

  function tone(o, t, dur, opt) {
    const s = ctx.createOscillator();
    s.type = opt.type || 'sine';
    s.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1) s.frequency.exponentialRampToValueAtTime(opt.f1, t + dur);
    const g = ctx.createGain();
    env(g, t, opt.vol == null ? 1 : opt.vol, opt.attack || 0.002, dur);
    s.connect(g); g.connect(o);
    s.start(t);
    s.stop(t + dur + 0.03);
  }

  // crack = sharp supersonic snap, body = muzzle blast, thump = low punch.
  const SHOTS = {
    pistol: { vol: 0.8, crack: [5200, 1600, 0.07, 0.8], body: [1700, 300, 0.15, 1], thump: [160, 55, 0.09, 0.7], rev: 0.35 },
    deagle: { vol: 1.05, crack: [4200, 900, 0.1, 1], body: [1300, 180, 0.3, 1], thump: [105, 40, 0.18, 1], rev: 0.55 },
    smg: { vol: 0.7, crack: [6200, 2200, 0.05, 0.8], body: [2300, 420, 0.1, 0.9], thump: [170, 60, 0.07, 0.55], rev: 0.3 },
    ak: { vol: 0.95, crack: [4300, 1000, 0.07, 1], body: [1500, 200, 0.22, 1], thump: [118, 42, 0.14, 1], rev: 0.45 },
    m4: { vol: 0.9, crack: [5200, 1400, 0.06, 0.85], body: [1900, 260, 0.17, 0.95], thump: [138, 50, 0.11, 0.85], rev: 0.42 },
    awp: { vol: 1.25, crack: [3600, 600, 0.13, 1], body: [1050, 110, 0.55, 1], thump: [88, 30, 0.32, 1.2], rev: 0.85 },
  };

  A.shot = function (kind, pos, local) {
    if (!ctx) return;
    const p = SHOTS[kind] || SHOTS.ak;
    const o = out(local ? null : pos, p.vol * (local ? 0.5 : 1), p.rev);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, p.crack[2], { type: 'bandpass', f0: p.crack[0], f1: p.crack[1], q: 0.9, vol: p.crack[3] });
    noise(o, t, p.body[2], { type: 'lowpass', f0: p.body[0], f1: p.body[1], q: 1.2, vol: p.body[3] });
    tone(o, t, p.thump[2], { type: 'sine', f0: p.thump[0], f1: p.thump[1], vol: p.thump[3] });
  };

  function click(o, t, f, vol) {
    noise(o, t, 0.035, { type: 'bandpass', f0: f, q: 5, vol: vol });
    tone(o, t, 0.025, { type: 'square', f0: f * 0.45, f1: f * 0.3, vol: vol * 0.12 });
  }

  A.reload = function (dur, pos) {
    if (!ctx) return;
    const o = out(pos || null, pos ? 0.6 : 0.45);
    if (!o) return;
    const t = ctx.currentTime;
    click(o, t + dur * 0.18, 2400, 0.9);
    noise(o, t + dur * 0.2, 0.12, { type: 'bandpass', f0: 900, q: 1.5, vol: 0.25 });
    click(o, t + dur * 0.58, 1700, 1);
    click(o, t + dur * 0.62, 2600, 0.6);
    click(o, t + dur * 0.82, 3200, 0.8);
  };

  A.draw = function () {
    if (!ctx) return;
    const o = out(null, 0.3);
    const t = ctx.currentTime;
    click(o, t, 2800, 0.6);
    click(o, t + 0.08, 2000, 0.5);
  };

  A.dry = function () {
    if (!ctx) return;
    const o = out(null, 0.4);
    click(o, ctx.currentTime, 3500, 0.8);
  };

  A.step = function (pos, local, loud) {
    if (!ctx) return;
    const o = out(local ? null : pos, (local ? 0.12 : 0.55) * (loud || 1));
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 0.09, { type: 'lowpass', f0: 700 + Math.random() * 300, f1: 200, vol: 1 });
    noise(o, t + 0.01, 0.05, { type: 'bandpass', f0: 2600 + Math.random() * 800, q: 2, vol: 0.25 });
  };

  A.land = function () {
    if (!ctx) return;
    const o = out(null, 0.25);
    const t = ctx.currentTime;
    noise(o, t, 0.12, { type: 'lowpass', f0: 500, f1: 150, vol: 1 });
  };

  A.hitBody = function (pos) {
    if (!ctx) return;
    const o = out(pos, 0.7);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 0.08, { type: 'lowpass', f0: 900, f1: 200, vol: 1 });
    tone(o, t, 0.07, { f0: 95, f1: 50, vol: 0.6 });
  };

  A.hitHead = function (pos, helmet) {
    if (!ctx) return;
    const o = out(pos, helmet ? 0.6 : 0.8);
    if (!o) return;
    const t = ctx.currentTime;
    if (helmet) {
      tone(o, t, 0.3, { type: 'triangle', f0: 2900, f1: 2300, vol: 0.5 });
      tone(o, t, 0.22, { type: 'sine', f0: 4100, f1: 3600, vol: 0.25 });
    }
    noise(o, t, 0.1, { type: 'bandpass', f0: 1300, f1: 500, q: 1.2, vol: 1 });
  };

  A.hitmarker = function (kill) {
    if (!ctx) return;
    const o = out(null, kill ? 0.35 : 0.18);
    const t = ctx.currentTime;
    tone(o, t, 0.05, { type: 'triangle', f0: kill ? 1500 : 1900, vol: 1 });
  };

  A.hurt = function () {
    if (!ctx) return;
    const o = out(null, 0.45);
    const t = ctx.currentTime;
    noise(o, t, 0.12, { type: 'lowpass', f0: 600, f1: 150, vol: 1 });
    tone(o, t, 0.1, { f0: 120, f1: 60, vol: 0.5 });
  };

  A.knife = function (pos, local) {
    if (!ctx) return;
    const o = out(local ? null : pos, 0.45);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 0.18, { type: 'bandpass', f0: 700, f1: 3500, q: 2, vol: 1, attack: 0.04 });
  };

  A.knifeHit = function (pos) {
    if (!ctx) return;
    const o = out(pos, 0.7);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 0.1, { type: 'bandpass', f0: 1800, f1: 600, q: 1.5, vol: 1 });
    tone(o, t, 0.08, { f0: 140, f1: 60, vol: 0.5 });
  };

  A.knifeWall = function (pos) {
    if (!ctx) return;
    const o = out(pos, 0.5);
    if (!o) return;
    const t = ctx.currentTime;
    tone(o, t, 0.12, { type: 'triangle', f0: 3200, f1: 2600, vol: 0.4 });
    noise(o, t, 0.05, { type: 'highpass', f0: 3000, vol: 0.6 });
  };

  A.impact = function (pos) {
    if (!ctx) return;
    const o = out(pos, 0.22);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 0.05, { type: 'bandpass', f0: 1800 + Math.random() * 1500, q: 1.5, vol: 1 });
  };

  A.explosion = function (pos) {
    if (!ctx) return;
    const o = out(pos, 1.5, 1.2);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 1.6, { type: 'lowpass', f0: 3500, f1: 80, q: 0.8, vol: 1, attack: 0.005 });
    tone(o, t, 0.9, { f0: 75, f1: 24, vol: 1.2 });
    noise(o, t + 0.05, 0.6, { type: 'bandpass', f0: 600, f1: 150, q: 0.6, vol: 0.6 });
  };

  A.bigExplosion = function (pos) {
    if (!ctx) return;
    const o = out(pos, 2.2, 1.5);
    if (!o) return;
    const t = ctx.currentTime;
    noise(o, t, 2.8, { type: 'lowpass', f0: 2600, f1: 50, q: 0.8, vol: 1, attack: 0.01 });
    tone(o, t, 1.6, { f0: 60, f1: 18, vol: 1.3 });
    noise(o, t + 0.15, 1.6, { type: 'bandpass', f0: 400, f1: 90, q: 0.5, vol: 0.7 });
  };

  A.beep = function (pos, urgent) {
    if (!ctx) return;
    const o = out(pos, 0.5);
    if (!o) return;
    const t = ctx.currentTime;
    tone(o, t, urgent ? 0.06 : 0.09, { type: 'sine', f0: urgent ? 2500 : 2200, vol: 1 });
  };

  A.bounce = function (pos) {
    if (!ctx) return;
    const o = out(pos, 0.35);
    if (!o) return;
    const t = ctx.currentTime;
    tone(o, t, 0.06, { type: 'triangle', f0: 600 + Math.random() * 300, f1: 300, vol: 1 });
    noise(o, t, 0.04, { type: 'bandpass', f0: 2000, q: 2, vol: 0.4 });
  };

  A.pin = function () {
    if (!ctx) return;
    const o = out(null, 0.35);
    const t = ctx.currentTime;
    click(o, t, 4200, 0.8);
    tone(o, t + 0.05, 0.15, { type: 'triangle', f0: 3000, f1: 2500, vol: 0.2 });
  };

  A.pickup = function () {
    if (!ctx) return;
    const o = out(null, 0.4);
    const t = ctx.currentTime;
    click(o, t, 2200, 0.8);
    click(o, t + 0.07, 3000, 0.6);
  };

  A.buy = function () {
    if (!ctx) return;
    const o = out(null, 0.25);
    const t = ctx.currentTime;
    tone(o, t, 0.06, { type: 'triangle', f0: 880, vol: 1 });
    tone(o, t + 0.05, 0.08, { type: 'triangle', f0: 1320, vol: 0.8 });
  };

  A.ui = function () {
    if (!ctx) return;
    const o = out(null, 0.15);
    tone(o, ctx.currentTime, 0.04, { type: 'triangle', f0: 1000, vol: 1 });
  };

  A.denied = function () {
    if (!ctx) return;
    const o = out(null, 0.2);
    const t = ctx.currentTime;
    tone(o, t, 0.12, { type: 'square', f0: 180, vol: 0.5 });
  };

  A.keypad = function () {
    if (!ctx) return;
    const o = out(null, 0.25);
    tone(o, ctx.currentTime, 0.05, { type: 'square', f0: 1400 + Math.random() * 600, vol: 0.35 });
  };

  A.roundStart = function () {
    if (!ctx) return;
    const o = out(null, 0.3);
    const t = ctx.currentTime;
    tone(o, t, 0.15, { type: 'triangle', f0: 440, vol: 0.8 });
    tone(o, t + 0.14, 0.25, { type: 'triangle', f0: 660, vol: 0.8 });
  };

  A.result = function (won) {
    if (!ctx) return;
    const o = out(null, 0.35);
    const t = ctx.currentTime;
    const notes = won ? [392, 494, 587, 784] : [440, 370, 311, 247];
    notes.forEach((f, i) => tone(o, t + i * 0.12, 0.4, { type: 'triangle', f0: f, vol: 0.7 }));
  };

  A.announce = function () {
    if (!ctx) return;
    const o = out(null, 0.3);
    const t = ctx.currentTime;
    tone(o, t, 0.12, { type: 'sine', f0: 1046, vol: 0.7 });
    tone(o, t + 0.13, 0.2, { type: 'sine', f0: 784, vol: 0.7 });
  };
})(window.DL);
