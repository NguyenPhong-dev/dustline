/* Dustline - weapons.js: weapon stats, spray patterns, accuracy and the first-person viewmodel. */
'use strict';
(function (DL) {
  const W = (DL.weapons = {});

  // Slots: 0 primary, 1 pistol, 2 knife, 3 grenade, 4 bomb.
  // dmg is per bullet at point blank; range is damage kept per 12.7 m; armorPen is the share
  // of damage that goes through armor; spreads are in radians.
  W.DEFS = {
    knife: { id: 'knife', name: 'Combat Knife', short: 'Knife', slot: 2, type: 'knife', dmg: 40, heavy: 65, rate: 0.45, heavyRate: 1.0, range: 1.9, speed: 6.3, draw: 0.3, kill: 1500 },
    glock: { id: 'glock', name: 'V18 Pistol', short: 'V18', desc: 'Starter pistol, 20 rounds', slot: 1, type: 'pistol', team: 'T', price: 200, dmg: 30, armorPen: 0.47, rate: 0.15, auto: false, mag: 20, reserve: 120, reload: 2.2, speed: 6.1, spread: 0.007, moveSpread: 0.035, jumpSpread: 0.09, range: 0.85, pattern: 'pistol', kill: 300, sound: 'pistol', draw: 0.35 },
    p2k: { id: 'p2k', name: 'W2K Pistol', short: 'W2K', desc: 'Starter pistol, 13 rounds', slot: 1, type: 'pistol', team: 'CT', price: 200, dmg: 35, armorPen: 0.505, rate: 0.17, auto: false, mag: 13, reserve: 52, reload: 2.2, speed: 6.1, spread: 0.006, moveSpread: 0.03, jumpSpread: 0.09, range: 0.91, pattern: 'pistol', kill: 300, sound: 'pistol', draw: 0.35 },
    deagle: { id: 'deagle', name: 'Hawk .50', short: 'Hawk', desc: 'Heavy pistol, one-tap to the head', slot: 1, type: 'pistol', price: 700, dmg: 63, armorPen: 0.93, rate: 0.25, auto: false, mag: 7, reserve: 35, reload: 2.2, speed: 5.9, spread: 0.004, moveSpread: 0.08, jumpSpread: 0.15, range: 0.81, pattern: 'deagle', kill: 300, sound: 'deagle', draw: 0.5 },
    mp5: { id: 'mp5', name: 'Ferret SMG', short: 'Ferret', desc: 'Fast-firing SMG, $600 per kill', slot: 0, type: 'smg', price: 1500, dmg: 27, armorPen: 0.625, rate: 0.075, auto: true, mag: 30, reserve: 120, reload: 2.6, speed: 6.0, spread: 0.009, moveSpread: 0.025, jumpSpread: 0.12, range: 0.85, pattern: 'smg', kill: 600, sound: 'smg', draw: 0.5 },
    ak: { id: 'ak', name: 'Krait Rifle', short: 'Krait', desc: '7.62 rifle, one-tap to the head', slot: 0, type: 'rifle', team: 'T', price: 2700, dmg: 36, armorPen: 0.775, rate: 0.1, auto: true, mag: 30, reserve: 90, reload: 2.45, speed: 5.4, spread: 0.004, moveSpread: 0.14, jumpSpread: 0.22, range: 0.98, pattern: 'ak', kill: 300, sound: 'ak', draw: 0.6 },
    m4: { id: 'm4', name: 'Mako Carbine', short: 'Mako', desc: '25 rounds, softer spray', slot: 0, type: 'rifle', team: 'CT', price: 2900, dmg: 38, armorPen: 0.7, rate: 0.095, auto: true, mag: 25, reserve: 75, reload: 3.0, speed: 5.6, spread: 0.0035, moveSpread: 0.12, jumpSpread: 0.22, range: 0.97, pattern: 'm4', kill: 300, sound: 'm4', draw: 0.6 },
    awp: { id: 'awp', name: 'Longbow Sniper', short: 'Longbow', desc: 'Bolt-action, one shot to the body', slot: 0, type: 'sniper', price: 4750, dmg: 115, armorPen: 0.975, rate: 1.46, auto: false, mag: 5, reserve: 30, reload: 3.6, speed: 4.4, spread: 0.0015, unscoped: 0.09, moveSpread: 0.18, jumpSpread: 0.35, range: 0.99, pattern: 'awp', kill: 100, sound: 'awp', draw: 0.8, scope: true },
    he: { id: 'he', name: 'Frag Grenade', short: 'Frag', desc: 'Up to 98 damage', slot: 3, type: 'grenade', price: 300, speed: 6.1, kill: 300, draw: 0.45 },
    c4: { id: 'c4', name: 'C4 Charge', short: 'C4', slot: 4, type: 'c4', speed: 6.1, draw: 0.5 },
  };

  // Cumulative spray pattern in degrees: [up, right] for shot n of a spray.
  const AK = [
    [0, 0], [0.3, 0.05], [0.9, 0.1], [1.7, 0.05], [2.6, -0.05], [3.6, 0], [4.6, 0.1], [5.5, 0.25], [6.2, 0.2], [6.7, 0],
    [7.0, -0.5], [7.2, -1.1], [7.3, -1.8], [7.3, -2.4], [7.4, -2.6], [7.5, -2.2], [7.6, -1.5], [7.6, -0.7], [7.7, 0.2], [7.7, 1.1],
    [7.8, 1.9], [7.8, 2.5], [7.9, 2.6], [7.9, 2.2], [8.0, 1.4], [8.0, 0.6], [8.1, -0.2], [8.1, -1.0], [8.2, -1.6], [8.2, -1.9],
  ];
  const scaled = (p, a, b) => p.map((v) => [v[0] * a, v[1] * b]);
  W.PATTERNS = {
    ak: AK,
    m4: scaled(AK, 0.72, 0.65),
    smg: scaled(AK, 0.5, 0.55),
    pistol: Array.from({ length: 20 }, (_, i) => [i * 1.1, (i % 2 ? 0.3 : -0.3) * Math.min(i, 3)]),
    deagle: Array.from({ length: 8 }, (_, i) => [i * 3.2, (i % 2 ? 0.8 : -0.6) * Math.min(i, 2)]),
    awp: [[0, 0], [2, 0], [2, 0], [2, 0], [2, 0], [2, 0]],
  };
  W.pattern = function (def, idx) {
    const p = W.PATTERNS[def.pattern] || AK;
    const i = Math.min(Math.floor(idx), p.length - 1), j = Math.min(i + 1, p.length - 1), f = Math.min(1, idx - Math.floor(idx));
    return [p[i][0] + (p[j][0] - p[i][0]) * f, p[i][1] + (p[j][1] - p[i][1]) * f];
  };
  // How fast a spray resets, in shots per second, once you stop firing.
  W.recover = { ak: 14, m4: 15, smg: 18, pistol: 7, deagle: 4, awp: 6 };

  W.make = function (id) {
    const d = W.DEFS[id];
    return { id, def: d, mag: d.mag || 0, reserve: d.reserve || 0, nextFire: 0, reloadEnd: 0, recoil: 0, lastShot: -9, zoom: 0, count: id === 'he' ? 1 : 0 };
  };

  W.spread = function (s, inst) {
    const d = inst.def;
    const sp = Math.hypot(s.body.vx, s.body.vz);
    let a = d.spread + d.moveSpread * DL.smoothstep(0.34, 1, sp / d.speed);
    if (!s.body.onGround) a += d.jumpSpread;
    if (d.scope && !inst.zoom) a += d.unscoped;
    a += inst.recoil * (d.type === 'pistol' ? 0.004 : 0.0011);
    if (s.crouch > 0.5 && s.body.onGround) a *= 0.75;
    return a;
  };

  // ---------- First-person viewmodel ----------
  const VM_PLACE = {
    ak: { p: [0.17, -0.2, -0.44], r: [0, 0.05, 0] },
    m4: { p: [0.17, -0.205, -0.44], r: [0, 0.05, 0] },
    mp5: { p: [0.17, -0.19, -0.42], r: [0, 0.05, 0] },
    awp: { p: [0.18, -0.21, -0.46], r: [0, 0.045, 0] },
    glock: { p: [0.16, -0.17, -0.44], r: [0, 0.07, 0] },
    p2k: { p: [0.16, -0.17, -0.44], r: [0, 0.07, 0] },
    deagle: { p: [0.16, -0.175, -0.45], r: [0, 0.07, 0] },
    knife: { p: [0.2, -0.21, -0.4], r: [0.25, 0.35, 0.35] },
    he: { p: [0.19, -0.2, -0.4], r: [0.2, 0.2, 0.1] },
    c4: { p: [0.02, -0.25, -0.44], r: [0.7, 0, 0] },
  };
  const ONE_HAND = { knife: 1, he: 1 };
  const SLEEVE = { T: 0x5e4831, CT: 0x34455c };

  function buildArms(id, team, gun) {
    const M = new DL.models.Merger();
    const sleeve = SLEEVE[team] || SLEEVE.CT, glove = 0x26231f;
    const rh = gun.rh.toArray();
    const rElbow = [rh[0] + 0.07, rh[1] - 0.13, rh[2] + 0.27];
    const rSh = [rh[0] + 0.15, rh[1] - 0.32, rh[2] + 0.56];
    M.segment(rh, rElbow, 0.062, sleeve);
    M.segment(rElbow, rSh, 0.08, sleeve);
    M.box(0.055, 0.07, 0.1, rh[0] + 0.005, rh[1] - 0.005, rh[2] + 0.01, -0.3, 0, 0, glove);
    if (!ONE_HAND[id]) {
      const lh = gun.lh.toArray();
      const lElbow = [lh[0] - 0.15, lh[1] - 0.15, lh[2] + 0.17];
      const lSh = [lh[0] - 0.3, lh[1] - 0.36, lh[2] + 0.4];
      M.segment(lh, lElbow, 0.062, sleeve);
      M.segment(lElbow, lSh, 0.08, sleeve);
      M.box(0.06, 0.06, 0.1, lh[0] - 0.01, lh[1] - 0.012, lh[2], 0, 0, 0.3, glove);
    }
    return new THREE.Mesh(M.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  }

  W.Viewmodel = function (scene, tex) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.holder = new THREE.Group();
    this.root.add(this.holder);
    this.cache = {};
    this.cur = null;
    this.team = 'CT';
    this.kick = 0; this.kickRot = 0; this.kickSide = 0;
    this.bob = 0; this.swayX = 0; this.swayY = 0; this.land = 0;
    this.drawStart = -9; this.drawDur = 0.5;
    this.swingStart = -9; this.swingDur = 0.35; this.swingHeavy = false;
    this.throwStart = -9;
    this.flashT = 0;
    // Muzzle flash: two crossed planes plus a front-facing burst.
    const fm = new THREE.MeshBasicMaterial({ map: tex.flash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.28), fm);
    p1.rotation.x = Math.PI / 2; p1.position.z = -0.1;
    const p2 = p1.clone(); p2.rotation.y = Math.PI / 2;
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), fm);
    this.flash.add(p1, p2, p3);
    this.flash.visible = false;
    // Brass casings
    const cg = new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 6);
    cg.rotateZ(Math.PI / 2);
    const cm = new THREE.MeshPhongMaterial({ color: 0xc9a23e, shininess: 80, specular: 0x886622 });
    this.casings = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(cg, cm);
      m.visible = false;
      this.root.add(m);
      this.casings.push({ m, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    this.nextCasing = 0;
  };

  const VP = W.Viewmodel.prototype;
  VP.setTeam = function (team) {
    if (team === this.team) return;
    this.team = team;
    for (const k in this.cache) { this.holder.remove(this.cache[k].group); }
    this.cache = {};
    const id = this.cur; this.cur = null;
    if (id) this.setWeapon(id, true);
  };
  VP.setWeapon = function (id, silent) {
    if (this.cur && this.cache[this.cur]) this.cache[this.cur].group.visible = false;
    this.cur = id;
    if (!id) return;
    if (!this.cache[id]) {
      const gun = DL.models.vmGun(id);
      const arms = buildArms(id, this.team, gun);
      gun.group.add(arms);
      const pl = VM_PLACE[id];
      gun.group.position.fromArray(pl.p);
      gun.group.rotation.set(pl.r[0], pl.r[1], pl.r[2]);
      gun.base = { p: pl.p, r: pl.r };
      gun.magHome = gun.mag.position.clone();
      this.holder.add(gun.group);
      this.cache[id] = gun;
    }
    const g = this.cache[id];
    g.group.visible = true;
    if (g.mag) { g.mag.visible = true; g.mag.position.copy(g.magHome); }
    if (this.flash.parent) this.flash.parent.remove(this.flash);
    this.flash.position.copy(g.muzzle);
    g.group.add(this.flash);
    this.drawStart = DL.time;
    this.drawDur = (W.DEFS[id].draw || 0.5);
    if (!silent) DL.audio.draw();
  };
  VP.fire = function (def) {
    const heavy = def.type === 'sniper' ? 2.2 : def.type === 'pistol' ? 1.3 : 1;
    this.kick = Math.min(0.06, this.kick + 0.022 * heavy);
    this.kickRot = Math.min(0.2, this.kickRot + 0.045 * heavy);
    this.kickSide = (Math.random() - 0.5) * 0.02;
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 0.8 + Math.random() * 0.5;
    this.flash.scale.set(s, s, s);
    this.flashT = 0.045;
    if (def.type !== 'sniper') this.ejectCasing();
  };
  VP.ejectCasing = function () {
    const g = this.cache[this.cur];
    if (!g) return;
    const c = this.casings[this.nextCasing];
    this.nextCasing = (this.nextCasing + 1) % this.casings.length;
    const port = new THREE.Vector3(0.03, 0.07, -0.08);
    g.group.localToWorld(port);
    this.root.worldToLocal(port);
    c.m.position.copy(port);
    c.v.set(0.9 + Math.random() * 0.5, 0.7 + Math.random() * 0.4, 0.15 + Math.random() * 0.2);
    c.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
    c.life = 0.55;
    c.m.visible = true;
  };
  VP.swing = function (heavy) {
    this.swingStart = DL.time;
    this.swingHeavy = heavy;
    this.swingDur = heavy ? 0.55 : 0.32;
  };
  VP.throwAnim = function () { this.throwStart = DL.time; };
  VP.landed = function (v) { this.land = Math.min(1, this.land + v * 0.08); };

  // s: {speed, onGround, mdx, mdy, reloadP, scoped, dt, crouch, planting, visible}
  VP.update = function (dt, s) {
    const g = this.cache[this.cur];
    this.root.visible = !!g && s.visible !== false && !s.scoped;
    for (const c of this.casings) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.v.y -= 6 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt; c.m.rotation.z += c.spin.z * dt;
      if (c.life <= 0) c.m.visible = false;
    }
    if (!g) return;
    const T = DL.time;
    this.bob += dt * (s.onGround ? s.speed : 0) * 1.35;
    const bobAmt = Math.min(1, s.speed / 6) * (s.onGround ? 1 : 0.15);
    const bx = Math.sin(this.bob) * 0.012 * bobAmt;
    const by = -Math.abs(Math.cos(this.bob)) * 0.01 * bobAmt;
    const vx = dt > 0 ? s.mdx / Math.max(dt, 0.004) : 0, vy = dt > 0 ? s.mdy / Math.max(dt, 0.004) : 0;
    this.swayX = DL.damp(this.swayX, DL.clamp(-vx * 0.000012, -0.025, 0.025), 9, dt);
    this.swayY = DL.damp(this.swayY, DL.clamp(vy * 0.000012, -0.02, 0.02), 9, dt);
    this.kick = DL.damp(this.kick, 0, 16, dt);
    this.kickRot = DL.damp(this.kickRot, 0, 13, dt);
    this.kickSide = DL.damp(this.kickSide, 0, 10, dt);
    this.land = DL.damp(this.land, 0, 7, dt);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }

    const drawP = DL.clamp((T - this.drawStart) / this.drawDur, 0, 1);
    const dr = Math.pow(1 - drawP, 3);
    let rl = 0;
    if (g.mag && g.magHome) g.mag.position.copy(g.magHome);
    if (s.reloadP >= 0) {
      const p = s.reloadP;
      rl = DL.smoothstep(0, 0.15, p) * (1 - DL.smoothstep(0.82, 1, p));
      if (g.mag) {
        if (p > 0.15 && p < 0.5) {
          const k = DL.smoothstep(0.15, 0.35, p);
          g.mag.position.y = g.magHome.y - k * 0.3;
          g.mag.visible = k < 0.95;
        } else if (p >= 0.5 && p < 0.7) {
          const k = 1 - DL.smoothstep(0.5, 0.68, p);
          g.mag.visible = true;
          g.mag.position.y = g.magHome.y - k * 0.25;
        } else g.mag.visible = true;
      }
    }
    let swX = 0, swY = 0, swRY = 0, swRX = 0, swRZ = 0;
    const swP = (T - this.swingStart) / this.swingDur;
    if (swP >= 0 && swP < 1) {
      const k = Math.sin(swP * Math.PI);
      if (this.swingHeavy) { swRX = -k * 1.1; swY = k * 0.05; swX = -k * 0.03; }
      else { swRY = k * 1.2; swX = -k * 0.08; swRZ = -k * 0.4; }
    }
    const thP = (T - this.throwStart) / 0.4;
    if (thP >= 0 && thP < 1) { const k = Math.sin(thP * Math.PI); swY += k * 0.08; swRX += k * 0.9; swX -= k * 0.04; }
    const plant = s.planting ? 1 : 0;

    const b = g.base;
    // Narrow (portrait) screens pull the weapon toward the center so it stays in view.
    const ax = Math.min(1, (s.aspect || 1.6) / 1.5);
    g.group.position.set(
      b.p[0] * ax + bx + this.swayX + swX + this.kickSide,
      b.p[1] + by + this.swayY - dr * 0.28 - rl * 0.04 - this.land * 0.04 + swY - plant * 0.03,
      b.p[2] + this.kick + plant * 0.04
    );
    g.group.rotation.set(
      b.r[0] + this.kickRot - dr * 0.9 - rl * 0.3 + swRX + plant * Math.sin(T * 18) * 0.02,
      b.r[1] + this.swayX * 1.5 + swRY,
      b.r[2] + rl * 0.6 + this.swayX * 2 + swRZ
    );
  };
})(window.DL);
