/* Dustline - game.js: renderer setup, rounds and economy, shooting and damage, the bomb,
 * grenades, dropped weapons, menus and the main loop. */
'use strict';
(function (DL) {
  const G = (DL.game = {});
  const I = DL.input;
  const FREEZE = 5, ROUND_TIME = 115, BOMB_TIME = 40, PLANT_TIME = 3.2, DEFUSE_TIME = 10, KIT_TIME = 5;
  const BUY_TIME = 20, END_TIME = 5.5, MAX_MONEY = 16000;

  G.soldiers = []; G.me = null; G.state = 'menu'; G.inMatch = false; G.paused = false; G.buyOpen = false;
  G.score = { T: 0, CT: 0 }; G.round = 0; G.winTarget = 8; G.diffName = 'normal';
  G.plan = { site: 'A' }; G.intel = { site: null, time: -99, count: 0 }; G.intelSeen = { A: {}, B: {} };
  G.bomb = { state: 'none', x: 0, y: 0, z: 0 }; G.drops = []; G.grenades = [];
  G.lossStreak = { T: 0, CT: 0 };

  const NAMES = {
    T: ['Rook', 'Saber', 'Dune', 'Kestrel', 'Mamba', 'Jinx', 'Vandal', 'Hex', 'Talon', 'Viper'],
    CT: ['Atlas', 'Bishop', 'Cobalt', 'Delta', 'Falcon', 'Granite', 'Harbor', 'Iron', 'Juno', 'Maple'],
  };
  let R = null; // three.js objects
  const W = () => DL.weapons;
  const BUYZONE = { T: { x: 0, z: 38, r: 21 }, CT: { x: 0, z: -39, r: 19 } };
  const tmpV = new THREE.Vector3();

  // ---------- Boot ----------
  G.boot = async function () {
    THREE.ColorManagement.legacyMode = false;
    const ld = document.getElementById('ldSub');
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([document.fonts.load('40px "Saira Stencil One"'), document.fonts.load('600 16px "Saira Condensed"')]),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      }
    } catch (e) { /* fonts are optional */ }
    await new Promise((r) => setTimeout(r, 30));

    const canvas = document.getElementById('view');
    const q = DL.settings.quality;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    } catch (e) {
      ld.textContent = 'WebGL is not available in this browser, so the game cannot start.';
      return;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9c9a5);
    scene.fog = new THREE.Fog(0xe2cfa6, 80, 300);
    const camera = new THREE.PerspectiveCamera(DL.settings.fov, 1, 0.05, 900);
    camera.rotation.order = 'YXZ';
    const vmScene = new THREE.Scene();
    const vmCamera = new THREE.PerspectiveCamera(56, 1, 0.01, 10);

    const hemi = new THREE.HemisphereLight(0xc4dbf5, 0xb08d5e, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffeccc, 1.9);
    sun.position.set(42, 78, 30);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 220;
    sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const sunDir = sun.position.clone().normalize();

    const vmHemi = new THREE.HemisphereLight(0xc4dbf5, 0x8a6f4c, 0.95);
    const vmSun = new THREE.DirectionalLight(0xffeccc, 1.4);
    vmSun.position.set(0.6, 1, 0.4);
    vmScene.add(vmHemi, vmSun);

    R = DL.three = { renderer, scene, camera, vmScene, vmCamera, sun, hemi, vmSun, vmHemi, sunDir };

    ld.textContent = 'Painting textures';
    await new Promise((r) => setTimeout(r, 20));
    const tex = DL.tex.build(renderer);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1;
    scene.add(sky);
    R.sky = sky;
    // Sun disc
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false, transparent: true, opacity: 0.95, map: tex.soft, depthWrite: false }));
    sunDisc.position.copy(sunDir).multiplyScalar(400);
    sunDisc.lookAt(0, 0, 0);
    sky.add(sunDisc);

    ld.textContent = 'Building the map';
    await new Promise((r) => setTimeout(r, 20));
    DL.map.build(scene, tex);
    DL.phys.buildNav();
    DL.fx.init(scene, tex);
    G.vm = new DL.weapons.Viewmodel(vmScene, tex);
    DL.hud.init();
    DL.player.bindInput(canvas);
    DL.touch.init();
    bindMenus();
    window.addEventListener('resize', resize);
    resize();
    applyQuality();
    DL.hud.setFps(DL.settings.showFps);
    setupFlythrough();
    document.getElementById('loading').classList.add('gone');
    setTimeout(() => { document.getElementById('loading').hidden = true; }, 600);
    last = performance.now();
    requestAnimationFrame(loop);
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    R.renderer.setSize(w, h, false);
    R.camera.aspect = w / h;
    R.camera.updateProjectionMatrix();
    R.vmCamera.aspect = w / h;
    R.vmCamera.updateProjectionMatrix();
  }

  function applyQuality() {
    const q = DL.settings.quality;
    R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.25 : 1));
    const shadows = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (R.renderer.shadowMap.enabled !== shadows) {
      R.renderer.shadowMap.enabled = shadows;
      R.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    if (R.sun.shadow.mapSize.x !== size) {
      R.sun.shadow.mapSize.set(size, size);
      if (R.sun.shadow.map) { R.sun.shadow.map.dispose(); R.sun.shadow.map = null; }
    }
    for (const s of G.soldiers) s.model.setShadows(q === 'high');
    resize();
  }

  // ---------- Menu fly-through ----------
  let fly = null;
  function setupFlythrough() {
    const pts = [[23, 44], [25, 32], [25, 22], [23, 16], [23, 10], [30, 11], [37, 9], [42, 4], [44, 12], [42, 24], [42, 38], [36, 41], [26, 43], [14, 39], [5, 35], [3, 26], [3, 15], [6, 9], [9, 11], [13, 15], [16, 18], [22, 19], [22, 27]]
      .map((c) => { const p = DL.map.cellPos(c); return new THREE.Vector3(p.x, 2.3, p.z); });
    fly = { curve: new THREE.CatmullRomCurve3(pts, true, 'centripetal'), u: Math.random() };
    fly.len = fly.curve.getLength();
  }
  function updateFly(dt) {
    fly.u = (fly.u + (dt * 3.2) / fly.len) % 1;
    const p = fly.curve.getPointAt(fly.u), a = fly.curve.getPointAt((fly.u + 0.012) % 1);
    R.camera.position.copy(p);
    R.camera.position.y += Math.sin(DL.time * 0.4) * 0.25;
    const yaw = DL.yawTo(a.x - p.x, a.z - p.z);
    fly.yaw = fly.yaw == null ? yaw : DL.dampAngle(fly.yaw, yaw, 1.5, dt);
    R.camera.rotation.set(-0.04, fly.yaw, 0);
    if (Math.abs(R.camera.fov - DL.settings.fov) > 0.01) { R.camera.fov = DL.settings.fov; R.camera.updateProjectionMatrix(); }
  }

  // ---------- Main loop ----------
  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    if (!G.paused) {
      DL.time += dt;
      if (G.inMatch) update(dt);
      else updateFly(dt);
      DL.fx.update(dt, R.camera, R.renderer);
    }
    if (G.inMatch) DL.hud.update(dt);
    render();
    I.endFrame();
  }

  // Advances the game without animation frames (used by automated tests and bot-only runs).
  G.simulate = function (seconds, step) {
    step = step || 1 / 60;
    for (let t = 0; t < seconds; t += step) {
      DL.time += step;
      if (G.inMatch) update(step);
      DL.fx.update(step, R.camera, R.renderer);
      I.endFrame();
    }
    if (G.inMatch) DL.hud.update(step);
    render();
  };

  function render() {
    const r = R.renderer;
    R.sky.position.copy(R.camera.position);
    r.autoClear = true;
    r.render(R.scene, R.camera);
    if (G.inMatch && G.me && G.me.alive && R.vmVisible !== false) {
      r.autoClear = false;
      r.clearDepth();
      r.render(R.vmScene, R.vmCamera);
      r.autoClear = true;
    }
  }

  // ---------- Soldiers ----------
  function makeSoldier(team, name, isBot) {
    const s = {
      id: G.soldiers.length, team, name, isBot,
      alive: true, hp: 100, armor: 0, helmet: false, kit: false, money: 800,
      kills: 0, deaths: 0, assists: 0, mvps: 0, roundKills: 0,
      body: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.32, h: 1.8, onGround: true, landed: 0 },
      yaw: 0, pitch: 0, crouch: 0, crouching: false, eyeH: 1.62,
      weapons: [null, null, null, null, null], cur: 1, prevCur: 2,
      hasBomb: false, reloadEnd: 0, reloadStart: 0, drawEnd: 0, lastShot: -9, stepT: 0,
      action: null, actionStart: 0, actionProgress: 0,
      input: { wishX: 0, wishZ: 0, walk: false, crouch: false, jump: false, fire: false, firePressed: false, alt: false, reload: false, use: false },
      prevUse: false, damagedBy: {}, spottedUntil: 0, deathTime: -99, killer: null, tagUntil: 0, hurtUntil: 0,
      model: DL.models.soldier(team), brain: isBot ? DL.ai.newBrain() : null,
      rescopeAt: 0, rescopeZoom: 0, survived: false, firedThisFrame: false,
      hitboxes: [{ part: 'head' }, { part: 'chest' }, { part: 'legs' }],
    };
    s.model.setShadows(DL.settings.quality === 'high');
    R.scene.add(s.model.root);
    return s;
  }

  function defaultLoadout(s) {
    s.weapons = [null, W().make(s.team === 'T' ? 'glock' : 'p2k'), W().make('knife'), null, null];
    s.armor = 0; s.helmet = false; s.kit = false;
  }

  G.headY = (e) => e.body.y + 0.95 - 0.36 * e.crouch + 0.72;
  G.chestY = (e) => e.body.y + 0.95 - 0.36 * e.crouch + 0.3;
  G.eyeY = (e) => e.body.y + (e === G.me ? e.eyeH : 1.62 - e.crouch * 0.44);

  function updateHitboxes(e) {
    const hip = e.body.y + 0.95 - 0.36 * e.crouch;
    const hb = e.hitboxes, x = e.body.x, z = e.body.z;
    Object.assign(hb[0], { cx: x, cy: hip + 0.72, cz: z, hx: 0.14, hy: 0.14, hz: 0.14 });
    Object.assign(hb[1], { cx: x, cy: hip + 0.3, cz: z, hx: 0.24, hy: 0.31, hz: 0.22 });
    const lh = Math.max(0.1, (hip - e.body.y) / 2);
    Object.assign(hb[2], { cx: x, cy: e.body.y + lh, cz: z, hx: 0.2, hy: lh, hz: 0.17 });
  }

  // ---------- Match flow ----------
  G.startMatch = function (team) {
    clearMatchObjects();
    G.diffName = DL.settings.difficulty;
    G.winTarget = DL.settings.matchLen || 8;
    G.score = { T: 0, CT: 0 };
    G.round = 0;
    G.lossStreak = { T: 0, CT: 0 };
    G.soldiers = [];
    const tNames = DL.shuffle(NAMES.T.slice()), ctNames = DL.shuffle(NAMES.CT.slice());
    for (let i = 0; i < 5; i++) {
      for (const tm of ['T', 'CT']) {
        const isMe = tm === team && i === 0;
        const s = makeSoldier(tm, isMe ? 'You' : (tm === 'T' ? tNames[i] : ctNames[i]), !isMe);
        G.soldiers.push(s);
        if (isMe) G.me = s;
      }
    }
    G.soldiers.forEach((s, i) => { s.id = i; defaultLoadout(s); });
    G.vm.setTeam(team);
    G.inMatch = true;
    G.paused = false;
    G.matchOver = false;
    document.getElementById('menu').hidden = true;
    document.getElementById('matchEnd').hidden = true;
    DL.hud.reset();
    DL.hud.show(true);
    DL.touch.show(true);
    G.startRound();
  };

  function clearMatchObjects() {
    for (const s of G.soldiers) R.scene.remove(s.model.root);
    clearDrops();
    clearGrenades();
    removeBombMesh();
    G.bomb = { state: 'none', x: 0, y: 0, z: 0 };
  }

  G.toMenu = function () {
    clearMatchObjects();
    G.soldiers = [];
    G.me = null;
    G.inMatch = false;
    G.paused = false;
    G.state = 'menu';
    G.closeBuy(false);
    DL.player.releaseLock();
    DL.hud.show(false);
    DL.hud.showScoreboard(false);
    DL.touch.show(false);
    DL.fx.clear();
    for (const id of ['pause', 'settings', 'controls', 'matchEnd', 'clickToPlay']) document.getElementById(id).hidden = true;
    document.getElementById('menu').hidden = false;
  };

  G.startRound = function () {
    G.round++;
    DL.fx.clear();
    clearDrops();
    clearGrenades();
    removeBombMesh();
    const spT = DL.shuffle(DL.map.spawns.T.slice()), spCT = DL.shuffle(DL.map.spawns.CT.slice());
    let iT = 0, iCT = 0;
    for (const s of G.soldiers) {
      if (!s.survived) defaultLoadout(s);
      s.hasBomb = false;
      s.weapons[4] = null;
      spawnSoldier(s, s.team === 'T' ? spT[iT++ % spT.length] : spCT[iCT++ % spCT.length]);
      s.survived = false;
    }
    G.state = 'freeze';
    G.freezeEnd = DL.time + FREEZE;
    G.liveStart = G.freezeEnd;
    G.buyEnd = G.freezeEnd + BUY_TIME;
    G.winner = null;
    G.planted = false;
    G.intel = { site: null, time: -99, count: 0 };
    G.intelSeen = { A: {}, B: {} };
    G.spec = null;
    G.retakeGo = false;
    const Ts = G.soldiers.filter((s) => s.team === 'T');
    const botTs = Ts.filter((s) => s.isBot);
    const carrier = G.me.team === 'T' && (Math.random() < 0.4 || !botTs.length) ? G.me : DL.choice(botTs);
    G.bomb = { state: 'carried', carrier, x: carrier.body.x, y: 0, z: carrier.body.z };
    giveBomb(carrier);
    DL.ai.planRound(G);
    for (const s of G.soldiers) if (s.isBot) botBuy(s);
    for (const s of G.soldiers) { s.cur = s.weapons[0] ? 0 : 1; s.prevCur = 2; s.model.setWeapon(s.weapons[s.cur].id); }
    G.vm.setWeapon(G.me.weapons[G.me.cur].id, true);
    DL.hud.hideBanner();
    DL.hud.center(G.me.hasBomb ? 'You have the bomb. Plant it at A or B.' : 'Round ' + G.round, 2.5);
    DL.player.camState.init = false;
  };

  function spawnSoldier(s, spot) {
    const b = s.body;
    b.x = spot.x + DL.rand(-0.35, 0.35); b.z = spot.z + DL.rand(-0.35, 0.35); b.y = 0;
    b.vx = b.vy = b.vz = 0; b.onGround = true; b.h = 1.8;
    s.yaw = spot.yaw; s.pitch = 0; s.crouch = 0; s.crouching = false; s.eyeH = 1.62;
    s.alive = true; s.hp = 100; s.action = null; s.reloadEnd = 0; s.drawEnd = 0; s.roundKills = 0;
    s.damagedBy = {}; s.killer = null; s.deathTime = -99; s.kick = 0; s.flinch = 0;
    s.model.reset();
    s.model.root.visible = s !== G.me;
    s.model.pack.visible = false;
    for (const w of s.weapons) if (w) { w.recoil = 0; w.zoom = 0; w.nextFire = 0; }
  }

  function giveBomb(s) {
    s.hasBomb = true;
    s.weapons[4] = W().make('c4');
    s.model.pack.visible = true;
  }

  G.timeLeft = () => ROUND_TIME - (DL.time - G.liveStart);
  G.bombTimeLeft = () => BOMB_TIME - (DL.time - G.bomb.plantTime);
  G.roundClock = () => DL.time - G.liveStart;
  G.buyTimeLeft = () => G.buyEnd - DL.time;

  function endRound(winner, reason) {
    if (G.state === 'roundEnd' || G.state === 'matchEnd') return;
    G.state = 'roundEnd';
    G.winner = winner;
    G.endAt = DL.time + END_TIME;
    G.score[winner]++;
    const loser = winner === 'T' ? 'CT' : 'T';
    const bombWin = reason === 'bombed' || reason === 'defused';
    const lossPay = 1400 + 500 * G.lossStreak[loser];
    for (const s of G.soldiers) {
      let pay = s.team === winner ? (bombWin ? 3500 : 3250) : lossPay;
      if (s.team === 'T' && s.team === loser && G.planted) pay += 800;
      s.money = Math.min(MAX_MONEY, s.money + pay);
      if (s === G.me) DL.hud.moneyDelta(pay);
      s.survived = s.alive;
      s.action = null;
    }
    G.lossStreak[loser] = Math.min(4, G.lossStreak[loser] + 1);
    G.lossStreak[winner] = Math.max(0, G.lossStreak[winner] - 1);
    // MVP
    let mvp = null;
    if (reason === 'bombed' && G.bomb.planter && G.bomb.planter.team === winner) mvp = G.bomb.planter;
    else if (reason === 'defused') mvp = G.bomb.defuserDone;
    if (!mvp) {
      let best = -1;
      for (const s of G.soldiers) if (s.team === winner && s.roundKills > best) { best = s.roundKills; mvp = s; }
    }
    if (mvp) mvp.mvps++;
    const title = winner === 'T' ? 'Terrorists win' : 'Counter-Terrorists win';
    const why = { elim: 'All enemies eliminated', time: 'Time ran out', bombed: 'The bomb exploded', defused: 'The bomb was defused' }[reason];
    DL.hud.banner(winner, title, why + (mvp ? ' · MVP: ' + mvp.name : ''));
    DL.audio.result(winner === G.me.team);
    if (G.score[winner] >= G.winTarget) G.matchOver = true;
    G.closeBuy(true);
  }

  function roundLogic() {
    const now = DL.time;
    if (G.state === 'freeze' && now >= G.freezeEnd) {
      G.state = 'live';
      DL.audio.roundStart();
      if (!G.buyOpen) DL.hud.center('Go go go', 1.2);
    }
    const aliveT = G.soldiers.some((s) => s.team === 'T' && s.alive);
    const aliveCT = G.soldiers.some((s) => s.team === 'CT' && s.alive);
    if (G.state === 'live') {
      if (!aliveT) endRound('CT', 'elim');
      else if (!aliveCT) endRound('T', 'elim');
      else if (G.timeLeft() <= 0) endRound('CT', 'time');
    } else if (G.state === 'planted') {
      if (!aliveCT) endRound('T', 'elim');
    } else if (G.state === 'roundEnd' && now >= G.endAt) {
      if (G.matchOver) showMatchEnd();
      else G.startRound();
    }
  }

  function showMatchEnd() {
    G.state = 'matchEnd';
    G.closeBuy(false);
    DL.player.releaseLock();
    const me = G.me, won = G.score[me.team] >= G.winTarget;
    document.getElementById('meTitle').textContent = won ? 'Victory' : 'Defeat';
    document.getElementById('meSub').textContent = (me.team === 'T' ? 'Terrorists ' : 'Counter-Terrorists ') + G.score[me.team] + ' – ' + G.score[me.team === 'T' ? 'CT' : 'T'];
    const kd = me.deaths ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2);
    document.getElementById('meStats').innerHTML = [['Kills', me.kills], ['Deaths', me.deaths], ['K/D', kd], ['MVPs', me.mvps]]
      .map((p) => '<div><b>' + p[1] + '</b><span>' + p[0] + '</span></div>').join('');
    document.getElementById('matchEnd').hidden = false;
    DL.audio.result(won);
  }

  // ---------- Buying ----------
  G.inBuyZone = (s) => {
    const c = BUYZONE[s.team];
    return Math.hypot(s.body.x - c.x, s.body.z - c.z) < c.r;
  };
  G.canBuyNow = (s) => s.alive && (G.state === 'freeze' || (G.state === 'live' && DL.time < G.buyEnd)) && G.inBuyZone(s);

  G.buyState = function (s, id) {
    const D = W().DEFS[id];
    let price, owned = false;
    if (id === 'kevlar') { price = 650; owned = s.armor >= 100; }
    else if (id === 'helmet') { owned = s.helmet && s.armor >= 100; price = s.armor >= 100 && !s.helmet ? 350 : 1000; }
    else if (id === 'kit') { price = 400; owned = s.kit; if (s.team !== 'CT') return { ok: false, owned: false, price }; }
    else if (id === 'he') { price = 300; owned = !!s.weapons[3]; }
    else {
      price = D.price;
      const cur = s.weapons[D.slot];
      owned = !!cur && cur.id === id;
      if (D.team && D.team !== s.team) return { ok: false, owned: false, price };
    }
    return { ok: !owned && s.money >= price && G.canBuyNow(s), owned, price };
  };

  G.buy = function (s, id) {
    if (!s) return false;
    const st = G.buyState(s, id);
    if (!st.ok) { if (s === G.me) DL.audio.denied(); return false; }
    s.money -= st.price;
    if (id === 'kevlar') s.armor = 100;
    else if (id === 'helmet') { s.armor = 100; s.helmet = true; }
    else if (id === 'kit') s.kit = true;
    else if (id === 'he') s.weapons[3] = W().make('he');
    else {
      const D = W().DEFS[id];
      if (s.weapons[D.slot] && !s.isBot) dropWeapon(s, D.slot, true);
      s.weapons[D.slot] = W().make(id);
      forceSwitch(s, D.slot);
    }
    if (s === G.me) { DL.audio.buy(); DL.hud.refreshBuy(); DL.hud.moneyDelta(-st.price); }
    return true;
  };

  function botBuy(s) {
    const D = W().DEFS, rifle = s.team === 'T' ? 'ak' : 'm4';
    const r = Math.random();
    if (G.round === 1) {
      if (r < 0.45) G.buy(s, 'kevlar');
      else if (r < 0.7) G.buy(s, 'deagle');
      return;
    }
    if (!s.weapons[0]) {
      if (s.money >= D.awp.price + 1000 && r < 0.16) G.buy(s, 'awp');
      else if (s.money >= D[rifle].price + 650) G.buy(s, rifle);
      else if (s.money >= D.mp5.price + 650 && (G.lossStreak[s.team] >= 2 || r < 0.25)) G.buy(s, 'mp5');
    }
    if (s.weapons[0] || s.money > 3000) {
      if (s.money >= 1000 && !(s.helmet && s.armor >= 100)) G.buy(s, 'helmet');
      else if (s.money >= 650 && s.armor < 100) G.buy(s, 'kevlar');
    }
    if (s.team === 'CT' && s.money >= 400 && Math.random() < 0.6) G.buy(s, 'kit');
    if (!s.weapons[0] && s.money >= 700 && s.weapons[1] && s.weapons[1].id !== 'deagle' && Math.random() < 0.4) G.buy(s, 'deagle');
  }

  G.openBuy = function () {
    const me = G.me;
    if (!G.canBuyNow(me)) {
      DL.hud.center(G.inBuyZone(me) ? 'Buy time is over' : 'You can only buy in your spawn area', 1.8);
      DL.audio.denied();
      return;
    }
    G.buyOpen = true;
    DL.hud.showBuy(true);
    DL.player.releaseLock();
  };
  G.closeBuy = function (relock) {
    if (!G.buyOpen) return;
    G.buyOpen = false;
    DL.hud.showBuy(false);
    if (relock && G.inMatch && !G.paused) G.ensureLock();
  };

  // ---------- Weapons ----------
  function bestSlot(s) {
    for (const i of [0, 1, 2]) if (s.weapons[i]) return i;
    return 2;
  }
  function forceSwitch(s, slot) {
    const w = s.weapons[slot];
    if (!w) return;
    const cur = s.weapons[s.cur];
    if (cur) cur.zoom = 0;
    if (s.cur !== slot) s.prevCur = s.cur;
    s.cur = slot;
    s.reloadEnd = 0;
    s.drawEnd = DL.time + (w.def.draw || 0.4);
    if (s === G.me) { G.vm.setWeapon(w.id); DL.hud.showSlots(); }
    s.model.setWeapon(w.id);
  }
  G.switchTo = function (s, slot) {
    if (slot == null || slot < 0 || slot > 4 || slot === s.cur || !s.weapons[slot] || s.action) return;
    forceSwitch(s, slot);
  };
  G.cycleWeapon = function (s, dir) {
    for (let k = 1; k <= 5; k++) {
      const i = (((s.cur + dir * k) % 5) + 5) % 5;
      if (s.weapons[i]) { G.switchTo(s, i); return; }
    }
  };
  G.dropCurrent = function (s) {
    if (!s.alive || s.action) return;
    if (s.cur === 4 && s.hasBomb) { dropBomb(s, true); return; }
    if (s.cur === 0 || s.cur === 1) dropWeapon(s, s.cur, false);
  };

  function startReload(s) {
    const inst = s.weapons[s.cur];
    if (!inst || !inst.def.mag || s.reloadEnd > 0 || inst.mag >= inst.def.mag || inst.reserve <= 0) return;
    inst.zoom = 0;
    s.reloadStart = DL.time;
    s.reloadEnd = DL.time + inst.def.reload;
    DL.audio.reload(inst.def.reload, s === G.me ? null : s.body);
    emitSound(s, s.body, 8);
  }

  function handleWeapon(s, dt) {
    const inst = s.weapons[s.cur];
    const now = DL.time, inp = s.input;
    s.firedThisFrame = false;
    if (!inst) return;
    const d = inst.def;
    if (s.reloadEnd > 0 && now >= s.reloadEnd) {
      const need = d.mag - inst.mag, take = Math.min(need, inst.reserve);
      inst.mag += take; inst.reserve -= take; s.reloadEnd = 0;
    }
    // Recoil recovers once you stop firing.
    for (const w of s.weapons) {
      if (w && w.recoil > 0 && now - w.lastShot > Math.max(0.12, w.def.rate * 1.15)) {
        w.recoil = Math.max(0, w.recoil - dt * (W().recover[w.def.pattern] || 10));
      }
    }
    if (s.rescopeAt && now >= s.rescopeAt) {
      if (inst.def.scope && s.reloadEnd <= 0) inst.zoom = s.rescopeZoom;
      s.rescopeAt = 0;
    }
    if (now < s.drawEnd || s.action || G.state === 'freeze' || !s.alive) return;
    if (inp.reload) startReload(s);
    const fireEdge = s.isBot ? inp.fire : inp.firePressed;
    if (d.type === 'knife') {
      if (inp.fire && now >= inst.nextFire) knifeAttack(s, inst, false);
      else if (inp.alt && now >= inst.nextFire) knifeAttack(s, inst, true);
      return;
    }
    if (d.type === 'grenade') {
      if (fireEdge && now >= inst.nextFire) throwGrenade(s, inst);
      return;
    }
    if (d.type === 'c4') return;
    if (d.scope && inp.alt && s.reloadEnd <= 0) {
      inst.zoom = (inst.zoom + 1) % 3;
      s.rescopeAt = 0;
      if (s === G.me) DL.audio.ui();
    }
    const want = d.auto ? inp.fire : fireEdge;
    if (want && now >= inst.nextFire && s.reloadEnd <= 0) {
      if (inst.mag > 0) shoot(s, inst);
      else {
        inst.nextFire = now + 0.25;
        if (s === G.me) DL.audio.dry();
        if (inst.reserve > 0) startReload(s);
      }
    }
    if (inst.mag === 0 && inst.reserve > 0 && s.reloadEnd <= 0 && !inp.fire && now > inst.nextFire) startReload(s);
  }

  const dirTmp = { x: 0, y: 0, z: 0 };
  function shoot(s, inst) {
    const d = inst.def, now = DL.time, b = s.body;
    inst.mag--;
    inst.nextFire = now + d.rate;
    inst.lastShot = now;
    s.lastShot = now;
    s.firedThisFrame = true;
    const spread = W().spread(s, inst);
    const pat = W().pattern(d, inst.recoil);
    const ctrl = s.isBot ? (DL.ai.D || DL.ai.DIFF.normal).recoilControl : 0;
    let pitch = s.pitch + DL.deg(pat[0]) * (1 - ctrl);
    let yaw = s.yaw - DL.deg(pat[1]) * (1 - ctrl);
    inst.recoil += 1;
    const a = Math.random() * Math.PI * 2, rr = spread * Math.sqrt(Math.random());
    yaw += Math.cos(a) * rr;
    pitch += Math.sin(a) * rr;
    const dir = DL.dirFromAngles(yaw, pitch, dirTmp);
    const ex = b.x, ey = G.eyeY(s), ez = b.z;
    const hit = traceBullet(s, ex, ey, ez, dir, d);
    // Muzzle position for effects
    const fw = DL.dirFromAngles(s.yaw, s.pitch);
    const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    let mx, my, mz;
    if (s === G.me) {
      mx = ex + fw.x * 0.6 + rx * 0.12; my = ey + fw.y * 0.6 - 0.12; mz = ez + fw.z * 0.6 + rz * 0.12;
      G.vm.fire(d);
      s.kick = (s.kick || 0) + (d.type === 'sniper' ? 0.03 : d.type === 'pistol' ? 0.012 : 0.006);
      DL.fx.muzzle(ex + fw.x, ey + fw.y, ez + fw.z, fw.x, fw.y, fw.z, false);
      if (inst.mag % 2 === 0 || d.type === 'sniper') DL.fx.tracer(mx, my, mz, hit.x, hit.y, hit.z);
    } else {
      mx = ex + fw.x * 0.8 + rx * 0.12; my = ey + fw.y * 0.8 - 0.25; mz = ez + fw.z * 0.8 + rz * 0.12;
      DL.fx.muzzle(mx, my, mz, fw.x, fw.y, fw.z, true);
      DL.fx.tracer(mx, my, mz, hit.x, hit.y, hit.z);
    }
    DL.audio.shot(d.sound, { x: ex, y: ey, z: ez }, s === G.me);
    emitSound(s, b, d.type === 'sniper' ? 70 : 50);
    if (d.scope && inst.zoom) {
      s.rescopeZoom = inst.zoom;
      inst.zoom = 0;
      s.rescopeAt = now + Math.min(d.rate * 0.85, 1.15);
    }
  }

  const hitOut = { x: 0, y: 0, z: 0 };
  function traceBullet(s, ex, ey, ez, dir, d) {
    const maxD = 220;
    const tWorld = DL.phys.raycast(ex, ey, ez, dir.x, dir.y, dir.z, maxD);
    const H = DL.phys.hit;
    const wnx = H.nx, wny = H.ny, wnz = H.nz, wbox = H.box, whit = H.hit;
    let best = tWorld, victim = null, part = null;
    for (const e of G.soldiers) {
      if (!e.alive || e === s || e.team === s.team) continue;
      // Quick reject by distance from the ray.
      const ox = e.body.x - ex, oz = e.body.z - ez;
      const along = ox * dir.x + oz * dir.z;
      if (along < -1) continue;
      updateHitboxes(e);
      for (const hb of e.hitboxes) {
        const t = DL.phys.rayBox(ex, ey, ez, dir.x, dir.y, dir.z, hb.cx, hb.cy, hb.cz, hb.hx, hb.hy, hb.hz, best);
        if (t >= 0 && t < best) { best = t; victim = e; part = hb.part; }
      }
    }
    hitOut.x = ex + dir.x * best; hitOut.y = ey + dir.y * best; hitOut.z = ez + dir.z * best;
    if (victim) {
      const mult = part === 'head' ? 4 : part === 'legs' ? 0.75 : 1;
      const dmg = d.dmg * Math.pow(d.range, best / 12.7) * mult;
      DL.fx.bloodHit(hitOut.x, hitOut.y, hitOut.z, dir.x, dir.y, dir.z, part === 'head');
      G.damage(victim, s, dmg, part, d, dir.x, dir.z);
    } else if (whit) {
      DL.fx.impact(hitOut.x, hitOut.y, hitOut.z, wnx, wny, wnz, wbox ? wbox.kind : 'ground');
      if (Math.random() < 0.5) DL.audio.impact(hitOut);
    }
    return hitOut;
  }

  function knifeAttack(s, inst, heavy) {
    const d = inst.def, now = DL.time;
    inst.nextFire = now + (heavy ? d.heavyRate : d.rate);
    s.lastShot = now;
    if (s === G.me) G.vm.swing(heavy);
    DL.audio.knife(s.body, s === G.me);
    const dir = DL.dirFromAngles(s.yaw, s.pitch);
    const ex = s.body.x, ey = G.eyeY(s), ez = s.body.z;
    const tW = DL.phys.raycast(ex, ey, ez, dir.x, dir.y, dir.z, d.range);
    let best = tW, victim = null;
    for (const e of G.soldiers) {
      if (!e.alive || e === s || e.team === s.team) continue;
      updateHitboxes(e);
      for (const hb of e.hitboxes) {
        const t = DL.phys.rayBox(ex, ey, ez, dir.x, dir.y, dir.z, hb.cx, hb.cy, hb.cz, hb.hx + 0.12, hb.hy + 0.05, hb.hz + 0.12, best);
        if (t >= 0 && t < best) { best = t; victim = e; }
      }
    }
    if (victim) {
      const vf = DL.dirFromAngles(victim.yaw, 0);
      const back = vf.x * dir.x + vf.z * dir.z > 0.5;
      const dmg = heavy ? (back ? 180 : 65) : (back ? 90 : 40);
      DL.fx.bloodHit(ex + dir.x * best, ey + dir.y * best, ez + dir.z * best, dir.x, dir.y, dir.z, false);
      DL.audio.knifeHit(victim.body);
      G.damage(victim, s, dmg, 'chest', Object.assign({}, d, { armorPen: 0.85 }), dir.x, dir.z);
    } else if (best < d.range) {
      DL.fx.impact(ex + dir.x * best, ey + dir.y * best, ez + dir.z * best, DL.phys.hit.nx, DL.phys.hit.ny, DL.phys.hit.nz, DL.phys.hit.box ? DL.phys.hit.box.kind : 'ground');
      DL.audio.knifeWall({ x: ex + dir.x * best, y: ey, z: ez + dir.z * best });
    }
  }

  // ---------- Damage ----------
  G.damage = function (victim, attacker, raw, part, def, dx, dz) {
    if (!victim.alive) return;
    const now = DL.time;
    let dmg = raw;
    let armorHit = false;
    const armored = victim.armor > 0 && (part === 'chest' || part === 'body' || (part === 'head' && victim.helmet));
    if (armored) {
      const pen = def.armorPen != null ? def.armorPen : 0.5;
      const toHealth = dmg * pen;
      victim.armor = Math.max(0, victim.armor - (dmg - toHealth) * 0.5);
      dmg = toHealth;
      armorHit = true;
    }
    dmg = Math.max(1, Math.round(dmg));
    victim.hp -= dmg;
    victim.tagUntil = now + 0.4;
    victim.hurtUntil = now + 0.5;
    if (attacker) victim.damagedBy[attacker.id] = (victim.damagedBy[attacker.id] || 0) + dmg;
    const head = part === 'head';
    if (head) DL.audio.hitHead(victim.body, armorHit);
    else DL.audio.hitBody(victim.body);
    if (victim === G.me) {
      if (attacker) DL.hud.damageFrom(attacker.body.x, attacker.body.z, dmg);
      else DL.hud.damageFrom(victim.body.x + (dx || 0), victim.body.z + (dz || 0), dmg);
      DL.audio.hurt();
      victim.flinch = (victim.flinch || 0) + Math.min(0.06, dmg * 0.0012);
    }
    if (victim.isBot) DL.ai.onDamaged(victim, attacker);
    const killed = victim.hp <= 0;
    if (attacker === G.me && victim !== G.me) {
      DL.hud.hit(killed, head);
      DL.audio.hitmarker(killed);
    }
    if (killed) kill(victim, attacker, def, head, dx, dz);
  };

  function kill(victim, attacker, def, head, dx, dz) {
    const now = DL.time;
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.deathTime = now;
    victim.killer = attacker;
    victim.action = null;
    victim.reloadEnd = 0;
    const inst = victim.weapons[victim.cur];
    if (inst) inst.zoom = 0;
    if (attacker && attacker !== victim && attacker.team !== victim.team) {
      attacker.kills++;
      attacker.roundKills++;
      const reward = def && def.kill != null ? def.kill : 300;
      attacker.money = Math.min(MAX_MONEY, attacker.money + reward);
      if (attacker === G.me) DL.hud.moneyDelta(reward);
    }
    for (const id in victim.damagedBy) {
      const a = G.soldiers[id];
      if (a && a !== attacker && a.team !== victim.team && victim.damagedBy[id] >= 40) a.assists++;
    }
    DL.hud.killfeed(attacker, victim, def ? (def.short || def.name) : 'Bomb', head);
    // Fall away from the shot.
    let axis = 'x', sign = 1;
    if (dx != null && (dx || dz)) {
      const vf = DL.dirFromAngles(victim.yaw, 0);
      const front = vf.x * dx + vf.z * dz; // >0: shot from behind
      const right = Math.cos(victim.yaw) * dx - Math.sin(victim.yaw) * dz;
      if (Math.abs(front) > Math.abs(right)) { axis = 'x'; sign = front > 0 ? -1 : 1; }
      else { axis = 'z'; sign = right > 0 ? -1 : 1; }
    } else { axis = Math.random() < 0.5 ? 'x' : 'z'; sign = Math.random() < 0.5 ? 1 : -1; }
    victim.model.die(sign, axis);
    victim.model.root.visible = true;
    // Drop the best gun and the bomb.
    const slot = victim.weapons[0] ? 0 : (victim.weapons[1] && victim.weapons[1].id === 'deagle' ? 1 : -1);
    if (slot >= 0) dropWeapon(victim, slot, true);
    if (victim.hasBomb) dropBomb(victim, false);
    victim.model.setWeapon(null);
    if (victim === G.me) {
      G.closeBuy(false);
      DL.player.camState.init = false;
      DL.hud.center(attacker && attacker !== victim ? 'Killed by ' + attacker.name : 'You died', 2);
    }
    if (G.bomb.defusing === victim) G.bomb.defusing = null;
  }

  // ---------- Sounds for bots ----------
  function emitSound(src, pos, radius) {
    // Attackers' gunfire at a bombsite tells the defenders where the push is.
    if (src.team === 'T' && radius >= 45) {
      for (const site of ['A', 'B']) {
        const c = DL.map.cellPos(DL.map.siteCenter[site]);
        if (Math.hypot(pos.x - c.x, pos.z - c.z) < 22) G.intel = { site, time: DL.time, count: Math.max(2, G.intel.site === site ? G.intel.count : 0) };
      }
    }
    for (const b of G.soldiers) {
      if (!b.isBot || !b.alive || b.team === src.team) continue;
      const d = Math.hypot(b.body.x - pos.x, b.body.z - pos.z);
      if (d < radius) DL.ai.hear(b, pos, false);
    }
  }
  G.emitSound = emitSound;

  G.spot = function (team, enemy) {
    const now = DL.time;
    if (G.me && team === G.me.team) enemy.spottedUntil = now + 0.8;
    if (team === 'CT') {
      for (const site of ['A', 'B']) {
        const c = DL.map.cellPos(DL.map.siteCenter[site]);
        if (Math.hypot(enemy.body.x - c.x, enemy.body.z - c.z) < 24) {
          G.intelSeen[site][enemy.id] = now;
          let count = 0;
          for (const k in G.intelSeen[site]) if (now - G.intelSeen[site][k] < 4) count++;
          G.intel = { site, time: now, count };
        }
      }
    }
  };

  // ---------- Grenades ----------
  function throwGrenade(s, inst) {
    const now = DL.time;
    inst.nextFire = now + 0.6;
    if (s === G.me) { G.vm.throwAnim(); DL.audio.pin(); }
    const dir = DL.dirFromAngles(s.yaw, s.pitch + 0.08);
    const ex = s.body.x, ey = G.eyeY(s), ez = s.body.z;
    const sp = 15;
    const mesh = DL.models.worldGun('he');
    R.scene.add(mesh);
    G.grenades.push({
      p: { x: ex + dir.x * 0.4, y: ey + dir.y * 0.4 - 0.1, z: ez + dir.z * 0.4, vx: dir.x * sp + s.body.vx * 0.5, vy: dir.y * sp + 1.5, vz: dir.z * sp + s.body.vz * 0.5, r: 0.06 },
      mesh, fuse: now + 1.6, owner: s,
    });
    s.weapons[3] = null;
    setTimeout(() => { if (s.alive && s.cur === 3) forceSwitch(s, s.prevCur != null && s.weapons[s.prevCur] ? s.prevCur : bestSlot(s)); }, 350);
  }

  function updateGrenades(dt) {
    const now = DL.time;
    for (let i = G.grenades.length - 1; i >= 0; i--) {
      const g = G.grenades[i];
      const impact = DL.phys.moveProjectile(g.p, dt, 0.45, 0.8);
      if (impact > 2) DL.audio.bounce(g.p);
      g.mesh.position.set(g.p.x, g.p.y, g.p.z);
      g.mesh.rotation.x += dt * 8; g.mesh.rotation.z += dt * 5;
      if (now >= g.fuse) {
        explodeGrenade(g);
        R.scene.remove(g.mesh);
        G.grenades.splice(i, 1);
      }
    }
  }

  function explodeGrenade(g) {
    const p = g.p;
    DL.fx.explosion(p.x, p.y, p.z, false);
    DL.audio.explosion(p);
    emitSound(g.owner, p, 60);
    if (G.me) {
      const d = Math.hypot(G.me.body.x - p.x, G.me.body.z - p.z);
      DL.fx.shake = Math.max(DL.fx.shake, DL.clamp(1.6 - d / 14, 0, 1.2));
    }
    const def = W().DEFS.he;
    for (const e of G.soldiers) {
      if (!e.alive || (e.team === g.owner.team && e !== g.owner)) continue;
      const cy = G.chestY(e);
      const d = Math.hypot(e.body.x - p.x, cy - p.y, e.body.z - p.z);
      if (d > 7.5) continue;
      if (!DL.phys.los(p.x, p.y + 0.2, p.z, e.body.x, cy, e.body.z) && !DL.phys.los(p.x, p.y + 0.2, p.z, e.body.x, G.headY(e), e.body.z)) continue;
      const dmg = 98 * Math.pow(1 - d / 7.5, 1.4);
      if (dmg < 1) continue;
      G.damage(e, g.owner, dmg, 'body', Object.assign({}, def, { armorPen: 0.57 }), e.body.x - p.x, e.body.z - p.z);
    }
  }

  function clearGrenades() {
    for (const g of G.grenades) R.scene.remove(g.mesh);
    G.grenades.length = 0;
  }

  // ---------- Dropped items ----------
  function spawnDrop(id, inst, x, y, z, vx, vy, vz) {
    const mesh = DL.models.droppedItem(id);
    mesh.position.set(x, y, z);
    R.scene.add(mesh);
    const d = { id, inst, mesh, p: { x, y, z, vx, vy, vz, r: 0.06 }, t: DL.time, spin: (Math.random() - 0.5) * 8 };
    G.drops.push(d);
    while (G.drops.length > 24) {
      const k = G.drops.findIndex((o) => o.id !== 'c4');
      if (k < 0) break;
      R.scene.remove(G.drops[k].mesh);
      G.drops.splice(k, 1);
    }
    return d;
  }

  function dropWeapon(s, slot, silent) {
    const w = s.weapons[slot];
    if (!w) return;
    s.weapons[slot] = null;
    w.zoom = 0;
    const dir = DL.dirFromAngles(s.yaw, 0.25);
    const sp = s.alive ? 3.5 : 1.2;
    spawnDrop(w.id, w, s.body.x + dir.x * 0.4, s.body.y + 1.2, s.body.z + dir.z * 0.4, dir.x * sp + s.body.vx * 0.5, 2 + dir.y * sp, dir.z * sp + s.body.vz * 0.5);
    if (s.alive && s.cur === slot) forceSwitch(s, bestSlot(s));
    if (!silent && s === G.me) DL.audio.ui();
  }

  function dropBomb(s, thrown) {
    if (!s.hasBomb) return;
    s.hasBomb = false;
    s.weapons[4] = null;
    s.model.pack.visible = false;
    const dir = DL.dirFromAngles(s.yaw, 0.2);
    const sp = thrown ? 3.5 : 0.8;
    const d = spawnDrop('c4', null, s.body.x + dir.x * 0.3, s.body.y + 1.1, s.body.z + dir.z * 0.3, dir.x * sp, 1.5, dir.z * sp);
    G.bomb = { state: 'dropped', drop: d, x: d.p.x, y: 0, z: d.p.z, fetcher: null };
    if (s.alive && s.cur === 4) forceSwitch(s, bestSlot(s));
    if (G.me.team === 'T') DL.hud.center('The bomb has been dropped', 2);
  }

  function pickBomb(s, drop) {
    R.scene.remove(drop.mesh);
    G.drops.splice(G.drops.indexOf(drop), 1);
    giveBomb(s);
    G.bomb = { state: 'carried', carrier: s, x: s.body.x, y: 0, z: s.body.z };
    if (s === G.me) { DL.audio.pickup(); DL.hud.center('You picked up the bomb', 2); }
  }

  function pickWeapon(s, drop) {
    const D = W().DEFS[drop.id];
    R.scene.remove(drop.mesh);
    G.drops.splice(G.drops.indexOf(drop), 1);
    s.weapons[D.slot] = drop.inst || W().make(drop.id);
    if (s === G.me) { DL.audio.pickup(); }
    if (D.slot < s.cur || s.cur >= 2 || s === G.me) forceSwitch(s, D.slot);
  }

  function updateDrops(dt) {
    const now = DL.time;
    for (let i = G.drops.length - 1; i >= 0; i--) {
      const d = G.drops[i];
      if (!d.p.resting) {
        DL.phys.moveProjectile(d.p, dt, 0.2, 1.0);
        d.mesh.rotation.y += d.spin * dt;
      }
      d.mesh.position.set(d.p.x, d.p.y - d.p.r, d.p.z);
      if (now - d.t < 0.7) continue;
      for (const s of G.soldiers) {
        if (!s.alive) continue;
        const dist = Math.hypot(s.body.x - d.p.x, s.body.z - d.p.z);
        if (dist > 0.95 || Math.abs(s.body.y - d.p.y) > 1.6) continue;
        if (d.id === 'c4') { if (s.team === 'T') { pickBomb(s, d); break; } continue; }
        const D = W().DEFS[d.id];
        if (D.team && D.team !== s.team && s.isBot) continue;
        if (!s.weapons[D.slot]) { pickWeapon(s, d); break; }
      }
    }
    if (G.bomb.state === 'dropped' && G.bomb.drop) {
      G.bomb.x = G.bomb.drop.p.x; G.bomb.z = G.bomb.drop.p.z; G.bomb.y = G.bomb.drop.p.y - 0.06;
    }
  }

  function nearestDrop(s, range) {
    let best = null, bd = range;
    for (const d of G.drops) {
      if (d.id === 'c4') continue;
      const dist = Math.hypot(s.body.x - d.p.x, s.body.z - d.p.z);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  function clearDrops() {
    for (const d of G.drops) R.scene.remove(d.mesh);
    G.drops.length = 0;
  }

  // ---------- Bomb ----------
  let bombMesh = null, bombLed = null;
  function placeBombMesh(x, y, z) {
    removeBombMesh();
    bombMesh = new THREE.Group();
    const m = DL.models.worldGun('c4');
    m.position.y = 0.025;
    bombMesh.add(m);
    bombLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    bombLed.position.set(0.03, 0.06, -0.06);
    bombMesh.add(bombLed);
    bombMesh.position.set(x, y, z);
    bombMesh.rotation.y = Math.random() * Math.PI * 2;
    R.scene.add(bombMesh);
  }
  function removeBombMesh() {
    if (bombMesh) R.scene.remove(bombMesh);
    bombMesh = null;
  }

  function plantBomb(s) {
    const site = DL.map.siteAt(s.body.x, s.body.z);
    s.hasBomb = false;
    s.weapons[4] = null;
    s.model.pack.visible = false;
    s.action = null;
    forceSwitch(s, bestSlot(s));
    G.bomb = { state: 'planted', x: s.body.x, y: s.body.y, z: s.body.z, site, plantTime: DL.time, nextBeep: DL.time, defuser: null, defusing: null, planter: s };
    placeBombMesh(s.body.x, s.body.y, s.body.z);
    s.money = Math.min(MAX_MONEY, s.money + 300);
    if (s === G.me) DL.hud.moneyDelta(300);
    G.planted = true;
    G.state = 'planted';
    DL.audio.announce();
    DL.hud.center('The bomb has been planted at ' + site, 3);
    for (const b of G.soldiers) if (b.isBot && b.team === 'CT') DL.ai.hear(b, s.body, false);
  }

  function defuseBomb(s) {
    const B = G.bomb;
    B.state = 'defused';
    B.defuserDone = s;
    s.action = null;
    s.money = Math.min(MAX_MONEY, s.money + 300);
    if (bombLed) bombLed.visible = false;
    DL.audio.announce();
    endRound('CT', 'defused');
  }

  function explodeBomb() {
    const B = G.bomb;
    B.state = 'exploded';
    removeBombMesh();
    DL.fx.explosion(B.x, B.y + 0.2, B.z, true);
    DL.audio.bigExplosion(B);
    if (G.me) {
      const d = Math.hypot(G.me.body.x - B.x, G.me.body.z - B.z);
      DL.fx.shake = Math.max(DL.fx.shake, DL.clamp(3 - d / 25, 0.3, 2.5));
    }
    for (const e of G.soldiers) {
      if (!e.alive) continue;
      const d = Math.hypot(e.body.x - B.x, e.body.y - B.y, e.body.z - B.z);
      const dmg = 500 * Math.exp(-(d * d) / (2 * 9 * 9));
      if (dmg >= 1) G.damage(e, null, dmg, 'body', { armorPen: 0.75, short: 'Bomb', name: 'Bomb', kill: 0 }, e.body.x - B.x, e.body.z - B.z);
    }
    endRound('T', 'bombed');
  }

  function updateBomb() {
    const B = G.bomb, now = DL.time;
    if (B.state === 'carried' && B.carrier) { B.x = B.carrier.body.x; B.z = B.carrier.body.z; B.y = B.carrier.body.y; }
    if (B.state === 'dropped') {
      if (!B.fetcher || !B.fetcher.alive) {
        let best = null, bd = Infinity;
        for (const s of G.soldiers) {
          if (!s.alive || s.team !== 'T' || !s.isBot) continue;
          const d = Math.hypot(s.body.x - B.x, s.body.z - B.z);
          if (d < bd) { bd = d; best = s; }
        }
        B.fetcher = best;
      }
    }
    if (B.state === 'planted') {
      const left = G.bombTimeLeft();
      if (now >= B.nextBeep) {
        DL.audio.beep(B, left < 5);
        B.nextBeep = now + (left > 20 ? 1.0 : left > 10 ? 0.7 : left > 5 ? 0.4 : left > 2 ? 0.2 : 0.1);
        B.ledOn = now + 0.08;
      }
      if (bombLed) bombLed.visible = now < B.ledOn;
      if (!B.defuser || !B.defuser.alive) {
        let best = null, bd = Infinity;
        for (const s of G.soldiers) {
          if (!s.alive || s.team !== 'CT' || !s.isBot) continue;
          const d = Math.hypot(s.body.x - B.x, s.body.z - B.z);
          if (d < bd) { bd = d; best = s; }
        }
        B.defuser = best;
      }
      if (left <= 0) explodeBomb();
    }
  }

  function handleAction(s) {
    const inp = s.input, B = G.bomb, now = DL.time;
    const site = DL.map.siteAt(s.body.x, s.body.z);
    const canPlant = s.alive && s.team === 'T' && s.hasBomb && G.state === 'live' && s.body.onGround && !!site;
    const nearBomb = B.state === 'planted' && Math.hypot(B.x - s.body.x, B.z - s.body.z) < 1.5 && Math.abs(B.y - s.body.y) < 1.5;
    const canDefuse = s.alive && s.team === 'CT' && nearBomb && s.body.onGround && (G.state === 'planted' || G.state === 'roundEnd' && B.state === 'planted') && (!B.defusing || B.defusing === s);
    const wantPlant = inp.use || (s.cur === 4 && inp.fire);
    if (s.action === 'plant') {
      if (!wantPlant || !canPlant) { s.action = null; return; }
      s.actionProgress = (now - s.actionStart) / PLANT_TIME;
      if (s === G.me && Math.floor(s.actionProgress * 7) !== s.lastKey) { s.lastKey = Math.floor(s.actionProgress * 7); DL.audio.keypad(); }
      if (s.actionProgress >= 1) plantBomb(s);
    } else if (s.action === 'defuse') {
      if (!inp.use || !canDefuse) { s.action = null; if (B.defusing === s) B.defusing = null; return; }
      s.actionProgress = (now - s.actionStart) / (s.kit ? KIT_TIME : DEFUSE_TIME);
      if (s.actionProgress >= 1) defuseBomb(s);
    } else if (wantPlant && canPlant) {
      if (s.cur !== 4) forceSwitch(s, 4);
      s.action = 'plant'; s.actionStart = now; s.actionProgress = 0; s.lastKey = -1;
      s.body.vx = 0; s.body.vz = 0;
    } else if (inp.use && canDefuse) {
      s.action = 'defuse'; s.actionStart = now; s.actionProgress = 0;
      B.defusing = s;
      if (s === G.me) DL.audio.pickup();
    }
  }

  // ---------- Per-frame soldier update ----------
  function accelerate(b, wx, wz, wishSpeed, accel, dt, cap) {
    if (wishSpeed <= 0) return;
    const cur = b.vx * wx + b.vz * wz;
    const add = (cap != null ? cap : wishSpeed) - cur;
    if (add <= 0) return;
    const acc = Math.min(accel * wishSpeed * dt, add);
    b.vx += acc * wx; b.vz += acc * wz;
  }

  function updateSoldier(s, dt) {
    const b = s.body, inp = s.input, now = DL.time;
    if (!s.alive) return;
    // Crouch
    if (inp.crouch) s.crouching = true;
    else if (s.crouching && !DL.phys.overlapAny(b.x, b.y + 0.05, b.z, b.r, 1.75)) s.crouching = false;
    s.crouch = DL.damp(s.crouch, s.crouching ? 1 : 0, 14, dt);
    b.h = s.crouching ? 1.35 : 1.8;

    const inst = s.weapons[s.cur];
    let maxSp = inst ? inst.def.speed : 6.1;
    if (inst && inst.zoom) maxSp *= 0.68;
    if (inp.walk) maxSp *= 0.52;
    if (s.crouching) maxSp *= 0.34;
    if (now < s.tagUntil) maxSp *= 0.55;
    if (s.action || G.state === 'freeze') maxSp = 0;
    let wx = inp.wishX, wz = inp.wishZ;
    const wl = Math.hypot(wx, wz);
    if (wl > 0.001) { wx /= wl; wz /= wl; }
    const wishSp = maxSp * Math.min(1, wl);
    if (b.onGround) {
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) {
        const drop = Math.max(sp, 1.9) * 5.5 * dt;
        const ns = Math.max(0, sp - drop);
        b.vx *= ns / sp; b.vz *= ns / sp;
      }
      accelerate(b, wx, wz, wishSp, 5.8, dt);
      if (inp.jump && maxSp > 0) {
        b.vy = 6.4;
        b.onGround = false;
        if (s === G.me) DL.audio.step(null, true, 0.8);
      }
    } else {
      accelerate(b, wx, wz, wishSp, 12, dt, 0.8);
    }
    DL.phys.moveBody(b, dt);
    if (b.landed > 3) {
      if (s === G.me) { G.vm.landed(b.landed); s.landDip = Math.min(0.12, b.landed * 0.012); DL.audio.land(); }
      else DL.audio.step(b, false, 1.2);
      emitSound(s, b, 16);
    }
    // Footsteps
    const hs = Math.hypot(b.vx, b.vz);
    if (b.onGround && hs > 3.3 && !inp.walk && !s.crouching) {
      s.stepT -= dt * hs / 5.2;
      if (s.stepT <= 0) {
        s.stepT = 0.37;
        DL.audio.step(b, s === G.me);
        emitSound(s, b, 22);
      }
    }
    handleAction(s);
    handleWeapon(s, dt);
  }

  function separate() {
    const list = G.soldiers;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const c = list[j];
        if (!c.alive) continue;
        const dx = c.body.x - a.body.x, dz = c.body.z - a.body.z;
        const d = Math.hypot(dx, dz);
        if (d >= 0.62 || Math.abs(c.body.y - a.body.y) > 1.6) continue;
        const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0;
        const push = (0.62 - d) / 2;
        const tryMove = (s, mx, mz) => {
          if (!DL.phys.overlapAny(s.body.x + mx, s.body.y + 0.05, s.body.z + mz, s.body.r, s.body.h - 0.1)) { s.body.x += mx; s.body.z += mz; }
        };
        tryMove(a, -nx * push, -nz * push);
        tryMove(c, nx * push, nz * push);
      }
    }
  }

  function updateModels(dt) {
    for (const s of G.soldiers) {
      const m = s.model;
      m.root.position.set(s.body.x, s.body.y, s.body.z);
      if (s.alive) {
        m.root.rotation.y = s.yaw;
        m.root.visible = s !== G.me;
        const inst = s.weapons[s.cur];
        m.setWeapon(inst ? inst.id : null);
      }
      const rec = s.alive && DL.time - s.lastShot < 0.08 ? -0.08 : 0;
      m.animate(dt, { speed: Math.hypot(s.body.vx, s.body.vz), pitch: s.pitch, crouch: s.crouch, recoil: rec });
    }
  }

  let spotT = 0;
  function playerSpotting(dt) {
    spotT -= dt;
    if (spotT > 0) return;
    spotT = 0.15;
    const me = G.me;
    if (!me.alive) return;
    const ey = G.eyeY(me);
    for (const e of G.soldiers) {
      if (!e.alive || e.team === me.team) continue;
      const dx = e.body.x - me.body.x, dz = e.body.z - me.body.z;
      if (Math.abs(DL.wrapAngle(DL.yawTo(dx, dz) - me.yaw)) > 1.0) continue;
      if (DL.phys.los(me.body.x, ey, me.body.z, e.body.x, G.headY(e), e.body.z) || DL.phys.los(me.body.x, ey, me.body.z, e.body.x, G.chestY(e), e.body.z)) {
        e.spottedUntil = DL.time + 0.8;
      }
    }
  }

  // The view model gets darker in shade and in tunnels.
  let shadeT = 0, shadeTarget = 1;
  function updateViewmodelLight(dt) {
    shadeT -= dt;
    const me = G.me;
    if (shadeT <= 0) {
      shadeT = 0.1;
      const c = R.camera.position, sd = R.sunDir;
      const t = DL.phys.raycast(c.x, c.y, c.z, sd.x, sd.y, sd.z, 120);
      shadeTarget = t < 120 ? 0.25 : 1;
    }
    R.vmSun.intensity = DL.damp(R.vmSun.intensity, 1.5 * shadeTarget, 6, dt);
    const inTunnel = me && DL.map.inTunnel(me.body.x, me.body.z);
    R.vmHemi.intensity = DL.damp(R.vmHemi.intensity, inTunnel ? 0.45 : 0.95, 6, dt);
  }

  function update(dt) {
    const me = G.me;
    DL.player.update(dt);
    // E: pick up / swap the weapon on the floor.
    if (me.alive && I.pressed.KeyE && !G.buyOpen) {
      const d = nearestDrop(me, 1.7);
      if (d && !(G.bomb.state === 'planted' && me.team === 'CT' && Math.hypot(G.bomb.x - me.body.x, G.bomb.z - me.body.z) < 1.5)) {
        const D = W().DEFS[d.id];
        if (me.weapons[D.slot]) dropWeapon(me, D.slot, true);
        pickWeapon(me, d);
      }
    }
    for (const s of G.soldiers) if (s.isBot) DL.ai.update(s, dt);
    for (const s of G.soldiers) updateSoldier(s, dt);
    separate();
    updateGrenades(dt);
    updateDrops(dt);
    updateBomb();
    roundLogic();
    playerSpotting(dt);
    updateModels(dt);
    DL.player.updateCamera(dt);
    // Viewmodel
    const inst = me.weapons[me.cur];
    G.vm.update(dt, {
      speed: Math.hypot(me.body.vx, me.body.vz), onGround: me.body.onGround,
      mdx: I.mouseDX, mdy: I.mouseDY,
      reloadP: me.reloadEnd > 0 && inst && inst.def.reload ? DL.clamp((DL.time - me.reloadStart) / inst.def.reload, 0, 1) : -1,
      scoped: inst && inst.zoom, planting: me.action != null, visible: me.alive, aspect: R.vmCamera.aspect,
    });
    updateViewmodelLight(dt);
    const L = DL.audio.listener, c = R.camera;
    L.x = c.position.x; L.y = c.position.y; L.z = c.position.z; L.yaw = c.rotation.y;
    // Keep the scoreboard fresh while it is open
    if (I.keys.Tab) { G.sbT = (G.sbT || 0) - dt; if (G.sbT <= 0) { G.sbT = 0.5; DL.hud.showScoreboard(true); } }
    if (G.buyOpen && !G.canBuyNow(me)) G.closeBuy(true);
  }

  G.useHint = function (me) {
    const B = G.bomb;
    if (me.action) return '';
    if (me.team === 'T' && me.hasBomb && G.state === 'live' && DL.map.siteAt(me.body.x, me.body.z)) return 'Hold E to plant the bomb';
    if (me.team === 'CT' && B.state === 'planted' && Math.hypot(B.x - me.body.x, B.z - me.body.z) < 1.5) return 'Hold E to defuse' + (me.kit ? '' : ' (10 s, a kit makes it 5 s)');
    const d = nearestDrop(me, 1.7);
    if (d) {
      const D = W().DEFS[d.id], held = me.weapons[D.slot];
      if (!held || held.id !== d.id) return (held ? 'Press E to swap for the ' : 'Press E to pick up the ') + D.name;
    }
    if (G.state === 'freeze' && !G.buyOpen && G.inBuyZone(me)) {
      if (G.round === 1 && !I.touch) return 'B buy · WASD move · R reload · E plant or defuse · Tab scores · Esc pause';
      return I.touch ? 'Tap BUY to buy' : 'Press B to buy';
    }
    return '';
  };

  // ---------- Spectating ----------
  G.spectateTarget = function () {
    const me = G.me;
    if (!me || me.alive) return null;
    if (G.spec && G.spec.alive && G.spec.team === me.team) return G.spec;
    G.spec = G.soldiers.find((s) => s.alive && s.team === me.team) || null;
    return G.spec;
  };
  G.nextSpectate = function (dir) {
    const me = G.me;
    const list = G.soldiers.filter((s) => s.alive && s.team === me.team);
    if (!list.length) return;
    let i = list.indexOf(G.spec);
    i = ((i + dir) % list.length + list.length) % list.length;
    G.spec = list[i];
    DL.player.camState.init = false;
  };

  // ---------- Pause, pointer lock, keys ----------
  G.pause = function () {
    if (!G.inMatch || G.paused || G.state === 'matchEnd') return;
    G.paused = true;
    G.pausedAt = performance.now();
    G.closeBuy(false);
    DL.hud.showScoreboard(false);
    I.lmb = false; I.rmb = false; I.keys = Object.create(null);
    document.getElementById('pause').hidden = false;
    document.getElementById('clickToPlay').hidden = true;
    DL.player.releaseLock();
  };
  G.resume = function () {
    if (!G.paused) return;
    G.paused = false;
    for (const id of ['pause', 'settings', 'controls']) document.getElementById(id).hidden = true;
    G.ensureLock();
  };
  G.ensureLock = function () {
    if (I.touch || I.noLock || I.locked) return;
    DL.player.requestLock();
    setTimeout(() => {
      if (!I.locked && !I.noLock && G.inMatch && !G.paused && !G.buyOpen && G.state !== 'matchEnd') document.getElementById('clickToPlay').hidden = false;
    }, 500);
  };
  G.onLockChange = function (locked, error) {
    const ctp = document.getElementById('clickToPlay');
    if (locked) { ctp.hidden = true; return; }
    if (error) {
      // The browser refused the mouse lock (too soon after Esc, or not allowed here).
      const show = !I.noLock && G.inMatch && !G.paused && !G.buyOpen && G.state !== 'matchEnd';
      ctp.hidden = !show;
      document.getElementById('ctpNote').textContent = I.noLock ? '' : 'The browser needs one more click to capture the mouse.';
      return;
    }
    if (G.inMatch && !G.paused && !G.buyOpen && G.state !== 'matchEnd') G.pause();
  };

  G.onKey = function (code) {
    if (!G.inMatch) return;
    if (G.state === 'matchEnd') return;
    if (code === 'Escape') {
      if (G.buyOpen) { G.closeBuy(true); return; }
      if (G.paused) {
        if (!document.getElementById('settings').hidden || !document.getElementById('controls').hidden) { showScreen('pause'); return; }
        // The Esc that released the mouse can arrive just after the pause; ignore it.
        if (performance.now() - G.pausedAt > 400) G.resume();
      }
      return;
    }
    if (G.paused) return;
    if (code === 'KeyB') {
      if (G.buyOpen) G.closeBuy(true);
      else if (G.me.alive) G.openBuy();
      return;
    }
    if (G.buyOpen && code.startsWith('Digit')) {
      const id = DL.hud.buyKeyItem(parseInt(code.slice(5), 10));
      if (id) G.buy(G.me, id);
      return;
    }
    if (code === 'Tab') DL.hud.showScoreboard(true);
  };
  G.onKeyUp = function (code) {
    if (code === 'Tab') DL.hud.showScoreboard(false);
  };

  // ---------- Menus ----------
  function showScreen(id) {
    for (const s of ['pause', 'settings', 'controls']) document.getElementById(s).hidden = s !== id;
  }
  let settingsReturn = 'menu';

  function bindMenus() {
    const $ = (id) => document.getElementById(id);
    const start = (team) => {
      DL.audio.init();
      DL.audio.ui();
      G.startMatch(team);
      if (!I.touch) DL.player.requestLock();
      else {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      }
    };
    $('playT').addEventListener('click', () => start('T'));
    $('playCT').addEventListener('click', () => start('CT'));
    const seg = (id, key, parse) => {
      const root = $(id);
      const sync = () => {
        for (const b of root.querySelectorAll('button')) b.setAttribute('aria-checked', String(String(DL.settings[key]) === b.dataset.v));
      };
      root.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        DL.settings[key] = parse ? parse(b.dataset.v) : b.dataset.v;
        DL.saveSettings();
        sync();
        DL.audio.ui();
        if (key === 'quality') applyQuality();
      });
      sync();
    };
    seg('diffSeg', 'difficulty');
    seg('lenSeg', 'matchLen', (v) => parseInt(v, 10));
    seg('qualSeg', 'quality');

    const openSettings = (from) => {
      settingsReturn = from;
      $('menu').hidden = true;
      showScreen('settings');
    };
    const openControls = (from) => {
      settingsReturn = from;
      $('menu').hidden = true;
      showScreen('controls');
    };
    const back = () => {
      showScreen(settingsReturn === 'pause' ? 'pause' : null);
      if (settingsReturn === 'menu') $('menu').hidden = false;
    };
    $('menuSettings').addEventListener('click', () => openSettings('menu'));
    $('menuControls').addEventListener('click', () => openControls('menu'));
    $('pauseSettings').addEventListener('click', () => openSettings('pause'));
    $('pauseControls').addEventListener('click', () => openControls('pause'));
    $('settingsBack').addEventListener('click', back);
    $('controlsBack').addEventListener('click', back);
    $('resumeBtn').addEventListener('click', () => G.resume());
    $('leaveBtn').addEventListener('click', () => G.toMenu());
    $('meAgain').addEventListener('click', () => {
      const team = G.me ? G.me.team : 'CT';
      DL.audio.init();
      G.startMatch(team);
      if (!I.touch) DL.player.requestLock();
    });
    $('meMenu').addEventListener('click', () => G.toMenu());
    $('ctpBtn').addEventListener('click', () => { $('clickToPlay').hidden = true; DL.player.requestLock(); });

    const range = (id, key, outId, fmt, apply) => {
      const input = $(id), out = $(outId);
      input.value = DL.settings[key];
      out.textContent = fmt(DL.settings[key]);
      input.addEventListener('input', () => {
        DL.settings[key] = parseFloat(input.value);
        out.textContent = fmt(DL.settings[key]);
        if (apply) apply(DL.settings[key]);
        DL.saveSettings();
      });
    };
    range('sens', 'sens', 'sensOut', (v) => v.toFixed(2));
    range('fov', 'fov', 'fovOut', (v) => Math.round(v) + '°');
    range('vol', 'volume', 'volOut', (v) => Math.round(v * 100) + '%', (v) => DL.audio.setVolume(v));
    const check = (id, key, apply) => {
      const c = $(id);
      c.checked = !!DL.settings[key];
      c.addEventListener('change', () => { DL.settings[key] = c.checked; DL.saveSettings(); if (apply) apply(c.checked); });
    };
    check('invertY', 'invertY');
    check('showFps', 'showFps', (v) => DL.hud.setFps(v));

    // Desktop app extras (window.dustlineDesktop comes from the Electron preload script).
    const desk = window.dustlineDesktop;
    const fsBox = $('fullscreen');
    if (desk) {
      for (const id of ['menuQuit', 'quitBtn']) {
        $(id).hidden = false;
        $(id).addEventListener('click', () => desk.quit());
      }
      document.querySelector('.menu-foot').textContent = 'Desktop edition. MIT License. Built with three.js and Electron.';
      $('fsHint').textContent = 'F11';
      desk.isFullscreen().then((on) => { fsBox.checked = on; });
      desk.onFullscreenChange((on) => { fsBox.checked = on; });
      fsBox.addEventListener('change', () => desk.setFullscreen(fsBox.checked));
    } else if (document.fullscreenEnabled) {
      document.addEventListener('fullscreenchange', () => { fsBox.checked = !!document.fullscreenElement; });
      fsBox.addEventListener('change', () => {
        if (fsBox.checked) document.documentElement.requestFullscreen().catch(() => { fsBox.checked = false; });
        else if (document.fullscreenElement) document.exitFullscreen();
      });
    } else {
      fsBox.closest('.set').hidden = true;
    }
    // First interaction anywhere unlocks audio (menu clicks).
    window.addEventListener('pointerdown', () => DL.audio.init(), { once: true });
  }

  window.addEventListener('DOMContentLoaded', () => {
    G.boot().catch((e) => {
      console.error(e);
      const ld = document.getElementById('ldSub');
      if (ld) ld.textContent = 'Something went wrong while loading: ' + e.message;
    });
  });
})(window.DL);
