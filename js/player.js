/* Dustline - player.js: keyboard and mouse input, the local player's controls,
 * the first-person camera and the spectator camera after death. */
'use strict';
(function (DL) {
  const P = (DL.player = {});
  const I = DL.input;
  let canvas = null;

  const GAME_KEYS = { Space: 1, Tab: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, KeyB: 1, KeyE: 1, KeyG: 1, KeyQ: 1, KeyR: 1 };

  // After repeated refusals (for example inside a frame that forbids it) the game
  // falls back to reading mouse movement without capturing the cursor.
  let lockFails = 0;
  function lockFailed() {
    lockFails++;
    if (lockFails >= 4) I.noLock = true;
    DL.game.onLockChange(false, true);
  }
  P.requestLock = function () {
    if (I.touch || !canvas || I.noLock) return;
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(lockFailed);
    } catch (e) { lockFailed(); }
  };
  P.releaseLock = function () {
    if (document.pointerLockElement) document.exitPointerLock();
  };

  P.bindInput = function (cv) {
    canvas = cv;
    window.addEventListener('keydown', (e) => {
      const G = DL.game;
      if (G.inMatch && (GAME_KEYS[e.code] || e.code.startsWith('Digit'))) e.preventDefault();
      if (e.repeat) return;
      I.pressed[e.code] = true;
      I.keys[e.code] = true;
      G.onKey(e.code, e);
    });
    window.addEventListener('keyup', (e) => {
      I.keys[e.code] = false;
      DL.game.onKeyUp(e.code);
    });
    window.addEventListener('blur', () => { I.keys = Object.create(null); I.lmb = false; I.rmb = false; });
    cv.addEventListener('mousedown', (e) => {
      const G = DL.game;
      if (!G.inMatch || G.paused || G.buyOpen) return;
      if (!I.locked && !I.noLock && !I.touch) { P.requestLock(); return; }
      if (e.button === 0) { I.lmb = true; I.lmbPressed = true; }
      if (e.button === 2) { I.rmb = true; I.rmbPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) I.lmb = false;
      if (e.button === 2) I.rmb = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!(I.locked || I.noLock) || I.touch) return;
      const G = DL.game;
      if (!G.inMatch || G.paused || G.buyOpen) return;
      let dx = e.movementX || 0, dy = e.movementY || 0;
      // Some browsers report a huge jump right after locking; ignore it.
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
      I.mouseDX += dx; I.mouseDY += dy;
    });
    cv.addEventListener('wheel', (e) => { I.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('contextmenu', (e) => { if (DL.game.inMatch) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      I.locked = document.pointerLockElement === canvas;
      if (I.locked) lockFails = 0;
      DL.game.onLockChange(I.locked);
    });
    document.addEventListener('pointerlockerror', lockFailed);
  };

  const key = (c) => !!I.keys[c];

  // Fills the local soldier's input from the keyboard, mouse and touch controls.
  P.update = function (dt) {
    const G = DL.game, s = G.me;
    if (!s) return;
    const inp = s.input;
    inp.wishX = 0; inp.wishZ = 0; inp.walk = false; inp.crouch = false; inp.jump = false;
    inp.fire = false; inp.firePressed = false; inp.alt = false; inp.reload = false; inp.use = false;
    const active = G.inMatch && !G.paused && !G.buyOpen;
    if (!active) return;

    const scopeK = s.alive && s.weapons[s.cur] && s.weapons[s.cur].zoom ? (s.weapons[s.cur].zoom === 1 ? 0.45 : 0.2) : 1;
    const sens = 0.0021 * DL.settings.sens * scopeK;
    if (s.alive) {
      s.yaw = DL.wrapAngle(s.yaw - I.mouseDX * sens);
      s.pitch = DL.clamp(s.pitch - I.mouseDY * sens * (DL.settings.invertY ? -1 : 1), -1.55, 1.55);
    } else {
      if (I.lmbPressed || I.pressed.Space) G.nextSpectate(1);
      if (I.rmbPressed) G.nextSpectate(-1);
      return;
    }

    let fwd = (key('KeyW') || key('ArrowUp') ? 1 : 0) - (key('KeyS') || key('ArrowDown') ? 1 : 0) + I.moveY;
    let side = (key('KeyD') || key('ArrowRight') ? 1 : 0) - (key('KeyA') || key('ArrowLeft') ? 1 : 0) + I.moveX;
    fwd = DL.clamp(fwd, -1, 1); side = DL.clamp(side, -1, 1);
    const sn = Math.sin(s.yaw), cs = Math.cos(s.yaw);
    let wx = -sn * fwd + cs * side, wz = -cs * fwd - sn * side;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    inp.wishX = wx; inp.wishZ = wz;
    inp.walk = key('ShiftLeft') || key('ShiftRight');
    inp.crouch = key('KeyC') || key('ControlLeft') || I.touchCrouch;
    inp.jump = !!I.pressed.Space;
    inp.fire = I.lmb;
    inp.firePressed = I.lmbPressed;
    inp.alt = I.rmbPressed;
    inp.reload = !!I.pressed.KeyR;
    inp.use = key('KeyE');

    // Weapon selection
    for (let i = 1; i <= 5; i++) if (I.pressed['Digit' + i]) G.switchTo(s, i - 1, true);
    if (I.pressed.KeyQ) G.switchTo(s, s.prevCur, true);
    if (I.wheel) G.cycleWeapon(s, I.wheel > 0 ? 1 : -1);
    if (I.pressed.KeyG) G.dropCurrent(s);
  };

  // ---------- Camera ----------
  const tmpDir = { x: 0, y: 0, z: 0 };
  P.camState = { x: 0, y: 2, z: 0, yaw: 0, pitch: 0, init: false };

  P.updateCamera = function (dt) {
    const G = DL.game, s = G.me, cam = DL.three.camera;
    if (!s) return;
    let fov = DL.settings.fov;
    const inst = s.weapons[s.cur];
    if (s.alive) {
      s.eyeH = DL.damp(s.eyeH, 1.62 - s.crouch * 0.44, 18, dt);
      s.landDip = DL.damp(s.landDip || 0, 0, 9, dt);
      const shake = DL.fx.shake;
      const sx = shake ? (Math.random() - 0.5) * shake * 0.04 : 0, sy = shake ? (Math.random() - 0.5) * shake * 0.04 : 0;
      // View punch: the camera follows half of the spray pattern, bullets follow all of it.
      let punchP = 0, punchY = 0;
      if (inst && inst.def.pattern && inst.recoil > 0.01) {
        const p = DL.weapons.pattern(inst.def, Math.max(0, inst.recoil - 1));
        punchP = DL.deg(p[0]) * 0.5;
        punchY = -DL.deg(p[1]) * 0.5;
      }
      s.kick = DL.damp(s.kick || 0, 0, 14, dt);
      s.flinch = DL.damp(s.flinch || 0, 0, 10, dt);
      cam.position.set(s.body.x, s.body.y + s.eyeH - s.landDip, s.body.z);
      cam.rotation.set(s.pitch + punchP + s.kick + s.flinch + sy, s.yaw + punchY + sx, 0);
      if (inst && inst.zoom) fov = inst.zoom === 1 ? 40 : 15;
      P.camState.init = false;
    } else {
      spectateCamera(dt, cam, s);
    }
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = inst && inst.zoom && s.alive ? fov : DL.damp(cam.fov, fov, 20, dt);
      cam.updateProjectionMatrix();
    }
  };

  function spectateCamera(dt, cam, me) {
    const G = DL.game, C = P.camState, now = DL.time;
    let tx, ty, tz, yaw, pitch;
    const deathCam = now - me.deathTime < 2.2;
    const target = deathCam ? null : G.spectateTarget();
    if (!target) {
      // Death cam: stay where we fell and look at the killer.
      tx = me.body.x; ty = me.body.y + 1.1; tz = me.body.z;
      const k = me.killer && me.killer !== me ? me.killer : null;
      if (k) {
        yaw = DL.yawTo(k.body.x - tx, k.body.z - tz);
        pitch = Math.atan2(k.body.y + 1.4 - ty, Math.hypot(k.body.x - tx, k.body.z - tz));
      } else { yaw = me.yaw; pitch = -0.3; }
      // Pull back so the body is in view.
      DL.dirFromAngles(yaw, pitch, tmpDir);
      const back = 2.2;
      const t = DL.phys.raycast(tx, ty, tz, -tmpDir.x, -tmpDir.y + 0.4, -tmpDir.z, back);
      const d = Math.max(0.3, t - 0.3);
      tx -= tmpDir.x * d; ty += 0.4 * d; tz -= tmpDir.z * d;
    } else {
      // Over the shoulder of a teammate.
      yaw = target.yaw; pitch = target.pitch * 0.7 - 0.12;
      DL.dirFromAngles(yaw, pitch, tmpDir);
      const ex = target.body.x, ey = target.body.y + 1.55, ez = target.body.z;
      const rx = Math.cos(yaw) * 0.45, rz = -Math.sin(yaw) * 0.45;
      const bx = -tmpDir.x * 2.4 + rx, by = 0.35 - tmpDir.y * 2.4, bz = -tmpDir.z * 2.4 + rz;
      const bl = Math.hypot(bx, by, bz);
      const t = DL.phys.raycast(ex, ey, ez, bx / bl, by / bl, bz / bl, bl);
      const d = Math.max(0.2, t - 0.25);
      tx = ex + (bx / bl) * d; ty = ey + (by / bl) * d; tz = ez + (bz / bl) * d;
    }
    if (!C.init) { C.x = tx; C.y = ty; C.z = tz; C.yaw = yaw; C.pitch = pitch; C.init = true; }
    C.x = DL.damp(C.x, tx, 10, dt); C.y = DL.damp(C.y, ty, 10, dt); C.z = DL.damp(C.z, tz, 10, dt);
    C.yaw = DL.dampAngle(C.yaw, yaw, 10, dt); C.pitch = DL.damp(C.pitch, pitch, 10, dt);
    cam.position.set(C.x, C.y, C.z);
    cam.rotation.set(C.pitch, C.yaw, 0);
  }
})(window.DL);
