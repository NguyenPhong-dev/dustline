/* Dustline - open-source tactical shooter. MIT License.
 * core.js: shared namespace, math helpers, settings and input state. */
'use strict';
window.DL = window.DL || {};

(function (DL) {
  const PI = Math.PI;

  DL.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  DL.lerp = (a, b, t) => a + (b - a) * t;
  DL.rand = (a, b) => a + Math.random() * (b - a);
  DL.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  DL.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  DL.deg = (d) => (d * PI) / 180;
  DL.smoothstep = (a, b, x) => {
    const t = DL.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  DL.wrapAngle = (a) => {
    while (a > PI) a -= 2 * PI;
    while (a < -PI) a += 2 * PI;
    return a;
  };
  // Frame-rate independent exponential smoothing.
  DL.damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  DL.dampAngle = (a, b, lambda, dt) => a + DL.wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
  DL.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  // Deterministic RNG (mulberry32) so the map looks the same every load.
  DL.makeRng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // yaw = 0 looks down -Z, positive yaw turns left (three.js convention), pitch > 0 looks up.
  DL.dirFromAngles = (yaw, pitch, out) => {
    const cp = Math.cos(pitch);
    out = out || { x: 0, y: 0, z: 0 };
    out.x = -Math.sin(yaw) * cp;
    out.y = Math.sin(pitch);
    out.z = -Math.cos(yaw) * cp;
    return out;
  };
  DL.yawTo = (dx, dz) => Math.atan2(-dx, -dz);
  DL.dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  DL.dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  // ---------- Settings (stored per browser, never required) ----------
  const DEFAULTS = { sens: 1.2, fov: 74, volume: 0.7, quality: 'high', invertY: false, showFps: false, difficulty: 'normal', matchLen: 8 };
  DL.settings = Object.assign({}, DEFAULTS);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('dustline.settings') || '{}') || {}; } catch (e) { /* storage blocked: keep defaults */ }
  Object.assign(DL.settings, saved);
  // Phones get the light renderer unless the player picked a quality themselves.
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !('quality' in saved)) DL.settings.quality = 'low';
  DL.saveSettings = () => {
    try { localStorage.setItem('dustline.settings', JSON.stringify(DL.settings)); } catch (e) { /* ignore */ }
  };

  // ---------- Input state ----------
  DL.input = {
    keys: Object.create(null),      // currently held, by KeyboardEvent.code
    pressed: Object.create(null),   // pressed since last frame
    mouseDX: 0, mouseDY: 0,
    lmb: false, rmb: false, lmbPressed: false, rmbPressed: false,
    wheel: 0,
    locked: false,
    touch: false,
    // virtual axes written by touch controls
    moveX: 0, moveY: 0,
  };
  DL.input.endFrame = () => {
    const I = DL.input;
    I.pressed = Object.create(null);
    I.mouseDX = 0; I.mouseDY = 0;
    I.lmbPressed = false; I.rmbPressed = false;
    I.wheel = 0;
  };

  DL.time = 0; // game clock in seconds (stops while paused)
})(window.DL);
