/* Dustline - touch.js: on-screen controls for phones and tablets.
 * Left stick moves, dragging anywhere on the right half aims, buttons do the rest. */
'use strict';
(function (DL) {
  const T = (DL.touch = {});
  const I = DL.input;

  T.enabled = function () {
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  };

  T.init = function () {
    if (!T.enabled()) return;
    I.touch = true;
    document.body.classList.add('touch');
    const root = document.getElementById('touch');
    const stick = document.getElementById('stick'), knob = document.getElementById('stickKnob');
    const view = document.getElementById('view');
    let stickId = null, sx = 0, sy = 0;
    const lookIds = new Map();
    const R = 55;

    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      sx = r.left + r.width / 2; sy = r.top + r.height / 2;
      moveStick(t);
      e.preventDefault();
    }, { passive: false });
    const moveStick = (t) => {
      let dx = t.clientX - sx, dy = t.clientY - sy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      I.moveX = dx / R;
      I.moveY = -dy / R;
    };

    // Look: any touch that starts on the game view (right side) or on the fire button.
    const startLook = (t) => lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
    view.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) if (t.clientX > window.innerWidth * 0.35) startLook(t);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) moveStick(t);
        const l = lookIds.get(t.identifier);
        if (l) {
          I.mouseDX += (t.clientX - l.x) * 1.6;
          I.mouseDY += (t.clientY - l.y) * 1.6;
          l.x = t.clientX; l.y = t.clientY;
        }
      }
      if (DL.game.inMatch) e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; I.moveX = 0; I.moveY = 0;
          knob.style.transform = '';
        }
        lookIds.delete(t.identifier);
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    const btn = (id, down, up) => {
      const b = document.getElementById(id);
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        down(e);
        b.classList.add('on');
        if (id === 'tFire') for (const t of e.changedTouches) startLook(t);
      }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); b.classList.remove('on'); if (up) up(e); }, { passive: false });
    };
    btn('tFire', () => { I.lmb = true; I.lmbPressed = true; }, () => { I.lmb = false; });
    btn('tAlt', () => { I.rmbPressed = true; });
    btn('tJump', () => { I.pressed.Space = true; });
    btn('tCrouch', () => { I.touchCrouch = !I.touchCrouch; }, () => { document.getElementById('tCrouch').classList.toggle('on', !!I.touchCrouch); });
    btn('tReload', () => { I.pressed.KeyR = true; });
    btn('tSwitch', () => { I.wheel += 1; });
    btn('tUse', () => { I.keys.KeyE = true; I.pressed.KeyE = true; }, () => { I.keys.KeyE = false; });
    btn('tBuy', () => { DL.game.onKey('KeyB'); });
    btn('tScore', () => { I.keys.Tab = !I.keys.Tab; DL.hud.showScoreboard(!!I.keys.Tab); });
    btn('tPause', () => { DL.game.pause(); });
    T.root = root;
  };

  T.show = function (on) {
    if (!I.touch) return;
    document.getElementById('touch').hidden = !on;
  };
})(window.DL);
