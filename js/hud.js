/* Dustline - hud.js: heads-up display, radar, kill feed, scoreboard and buy menu. */
'use strict';
(function (DL) {
  const H = (DL.hud = {});
  const $ = (id) => document.getElementById(id);
  let el = {};
  let radarCtx = null, radarImg = null, radarDpr = 1;
  const RADAR_PX = 200, RADAR_RANGE = 34; // css px, meters from center to edge
  const CELL_PX = 6;
  let last = {};
  const tags = [];

  H.init = function () {
    const ids = ['hud', 'radar', 'moneyVal', 'moneyDelta', 'aliveCT', 'aliveT', 'scoreCT', 'scoreT', 'timer', 'bombTimer', 'roundLabel',
      'killfeed', 'hpVal', 'arVal', 'helmetTag', 'kitTag', 'bombTag', 'ammoMag', 'ammoRes', 'wpnName', 'slots', 'crosshair', 'hitmarker',
      'dmgDirs', 'centerMsg', 'useHint', 'progress', 'progressFill', 'progressLabel', 'banner', 'bannerTitle', 'bannerSub', 'specLabel',
      'scope', 'vignette', 'dmgFlash', 'fps', 'buy', 'buyGrid', 'buyMoney', 'buyTime', 'buyClose', 'scoreboard', 'sbCT', 'sbT',
      'sbScoreCT', 'sbScoreT', 'ammo'];
    for (const id of ids) el[id] = $(id);
    radarCtx = el.radar.getContext('2d');
    radarDpr = Math.min(2, window.devicePixelRatio || 1);
    el.radar.width = RADAR_PX * radarDpr;
    el.radar.height = RADAR_PX * radarDpr;
    radarImg = buildRadarImage();
    el.buyClose.addEventListener('click', () => DL.game.closeBuy(true));
    el.buyGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.buy-item');
      if (b && !b.disabled) DL.game.buy(DL.game.me, b.dataset.id);
    });
    // Teammate name tags
    for (let i = 0; i < 5; i++) {
      const t = document.createElement('div');
      t.className = 'nametag';
      t.style.cssText = 'position:absolute;left:0;top:0;font-size:14px;font-weight:700;letter-spacing:.04em;white-space:nowrap;pointer-events:none;transform:translate(-50%,-100%);opacity:.9;';
      el.hud.appendChild(t);
      tags.push(t);
    }
  };

  function buildRadarImage() {
    const M = DL.map;
    const c = document.createElement('canvas');
    c.width = M.W * CELL_PX; c.height = M.H * CELL_PX;
    const g = c.getContext('2d');
    for (let r = 0; r < M.H; r++) {
      for (let col = 0; col < M.W; col++) {
        const ch = M.at(col, r);
        let fill = null;
        if (ch === '#') fill = null;
        else if (ch === 'a' || ch === 'b') fill = 'rgba(200,120,90,0.55)';
        else if (ch === '=') fill = 'rgba(150,140,120,0.5)';
        else if (ch === 'c' || ch === 'C' || ch === 'h' || ch === 'P') fill = 'rgba(120,95,60,0.75)';
        else fill = 'rgba(214,196,160,0.42)';
        if (fill) { g.fillStyle = fill; g.fillRect(col * CELL_PX, r * CELL_PX, CELL_PX, CELL_PX); }
      }
    }
    g.font = 'bold 22px "Saira Condensed", sans-serif';
    g.fillStyle = 'rgba(255,235,220,0.85)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('A', (M.siteCenter.A[0] + 0.5) * CELL_PX, (M.siteCenter.A[1] + 0.5) * CELL_PX);
    g.fillText('B', (M.siteCenter.B[0] + 0.5) * CELL_PX, (M.siteCenter.B[1] + 0.5) * CELL_PX);
    return c;
  }

  const setText = (k, v) => {
    if (last[k] !== v) { last[k] = v; el[k].textContent = v; }
  };

  H.show = function (on) { el.hud.hidden = !on; };
  H.reset = function () {
    last = {};
    el.killfeed.innerHTML = '';
    el.dmgDirs.innerHTML = '';
    el.banner.hidden = true;
    el.progress.hidden = true;
  };

  H.update = function (dt) {
    const G = DL.game, me = G.me;
    if (!me) return;
    const view = me.alive ? me : (G.spectateTarget() || me);
    // Vitals and money
    setText('hpVal', String(Math.max(0, Math.ceil(view.hp))));
    el.hpVal.classList.toggle('low', view.hp <= 25);
    setText('arVal', String(Math.ceil(view.armor)));
    el.helmetTag.hidden = !view.helmet || view.armor <= 0;
    el.kitTag.hidden = !view.kit;
    el.bombTag.hidden = !view.hasBomb;
    setText('moneyVal', String(me.money));
    // Ammo
    const inst = view.weapons[view.cur];
    if (inst) {
      const d = inst.def;
      if (d.mag) { setText('ammoMag', String(inst.mag)); setText('ammoRes', '/ ' + inst.reserve); }
      else if (d.type === 'grenade') { setText('ammoMag', String(inst.count)); setText('ammoRes', ''); }
      else { setText('ammoMag', '—'); setText('ammoRes', ''); }
      el.ammoMag.classList.toggle('low', !!d.mag && inst.mag <= Math.ceil(d.mag * 0.2));
      setText('wpnName', view.reloadEnd > 0 ? 'Reloading' : d.name);
    }
    // Timer
    let tl, bombLeft = null;
    if (G.state === 'freeze') tl = G.freezeEnd - DL.time;
    else if (G.state === 'planted') { tl = null; bombLeft = G.bombTimeLeft(); }
    else if (G.state === 'roundEnd') tl = Math.max(0, G.endAt - DL.time);
    else tl = G.timeLeft();
    if (tl != null) {
      tl = Math.max(0, tl);
      const m = Math.floor(tl / 60), s = Math.floor(tl % 60);
      setText('timer', m + ':' + (s < 10 ? '0' : '') + s);
      el.bombTimer.hidden = true;
      el.timer.hidden = false;
      el.timer.classList.toggle('low', G.state === 'live' && tl < 10);
    } else {
      el.timer.hidden = true;
      el.bombTimer.hidden = false;
      setText('bombTimer', 'BOMB');
    }
    setText('scoreCT', String(G.score.CT));
    setText('scoreT', String(G.score.T));
    const pips = (team) => G.soldiers.filter((s) => s.team === team).map((s) => (s.alive ? '1' : '0')).join('');
    const pCT = pips('CT'), pT = pips('T');
    if (last.pCT !== pCT) { last.pCT = pCT; el.aliveCT.innerHTML = pCT.split('').map((c) => '<i class="' + (c === '1' ? '' : 'dead') + '"></i>').join(''); }
    if (last.pT !== pT) { last.pT = pT; el.aliveT.innerHTML = pT.split('').map((c) => '<i class="' + (c === '1' ? '' : 'dead') + '"></i>').join(''); }
    setText('roundLabel', 'Round ' + G.round + ' · first to ' + G.winTarget);

    // Crosshair
    const scoped = me.alive && inst && inst.zoom;
    el.scope.hidden = !scoped;
    const noCross = !me.alive || scoped || (inst && inst.def.type === 'sniper');
    el.crosshair.classList.toggle('hidden', !me.alive || !!scoped);
    if (me.alive && inst && !scoped) {
      let gap = 4;
      if (inst.def.spread != null) {
        const sp = DL.weapons.spread(me, inst);
        const px = (Math.tan(sp) / Math.tan(DL.deg(DL.three.camera.fov) / 2)) * (window.innerHeight / 2);
        gap = DL.clamp(3 + px * 0.9, 3, 80);
      }
      const show = noCross ? '0' : '1';
      if (last.gap !== Math.round(gap) || last.cs !== show) {
        last.gap = Math.round(gap); last.cs = show;
        el.crosshair.style.setProperty('--gap', last.gap + 'px');
        for (const i of el.crosshair.querySelectorAll('.l,.r,.t,.b')) i.style.display = noCross ? 'none' : '';
      }
    }
    // Hit marker fade
    if (H.hitT > 0) { H.hitT -= dt; if (H.hitT <= 0) el.hitmarker.classList.remove('show'); }
    // Damage feedback
    H.flash = Math.max(0, (H.flash || 0) - dt * 2.5);
    el.dmgFlash.style.opacity = H.flash.toFixed(2);
    el.vignette.style.opacity = me.alive && me.hp < 40 ? String(0.35 + (40 - me.hp) / 60) : '0';
    for (const d of Array.from(el.dmgDirs.children)) {
      const t = (parseFloat(d.dataset.t) || 0) - dt;
      d.dataset.t = t;
      if (t <= 0) d.remove();
      else {
        const rel = DL.wrapAngle(DL.yawTo(parseFloat(d.dataset.x) - me.body.x, parseFloat(d.dataset.z) - me.body.z) - me.yaw);
        d.style.transform = 'rotate(' + (-rel) + 'rad)';
        d.style.opacity = Math.min(1, t).toFixed(2);
      }
    }
    // Center message
    if (H.centerT > 0) { H.centerT -= dt; if (H.centerT <= 0) el.centerMsg.classList.remove('show'); }
    // Plant / defuse progress
    if (me.alive && me.action) {
      el.progress.hidden = false;
      el.progressFill.style.width = (DL.clamp(me.actionProgress, 0, 1) * 100).toFixed(1) + '%';
      setText('progressLabel', me.action === 'plant' ? 'Planting the bomb' : 'Defusing' + (me.kit ? ' with kit' : ''));
    } else el.progress.hidden = true;
    // Use hint
    const hint = me.alive ? G.useHint(me) : '';
    if (last.hint !== hint) {
      last.hint = hint;
      el.useHint.textContent = hint;
      el.useHint.classList.toggle('show', !!hint);
    }
    // Spectator label
    if (!me.alive) {
      const t = G.spectateTarget();
      el.specLabel.hidden = false;
      const txt = t && DL.time - me.deathTime >= 2.2 ? '<small>Spectating</small>' + escapeHtml(t.name) + ' · ' + Math.ceil(t.hp) + ' HP' : '<small>You died</small>Killed by ' + (me.killer && me.killer !== me ? escapeHtml(me.killer.name) : 'the bomb');
      if (last.spec !== txt) { last.spec = txt; el.specLabel.innerHTML = txt; }
    } else el.specLabel.hidden = true;
    // Slots
    if (H.slotsT > 0) { H.slotsT -= dt; if (H.slotsT <= 0) el.slots.classList.remove('show'); }
    // Buy menu countdown
    if (G.buyOpen) {
      setText('buyMoney', String(me.money));
      const left = G.buyTimeLeft();
      setText('buyTime', left > 0 ? 'Buy time: ' + Math.ceil(left) + 's' : 'Buy time is over');
    }
    if (H.fpsOn) {
      H.fpsAcc = (H.fpsAcc || 0) + dt; H.fpsN = (H.fpsN || 0) + 1;
      if (H.fpsAcc > 0.5) { el.fps.textContent = Math.round(H.fpsN / H.fpsAcc) + ' FPS'; H.fpsAcc = 0; H.fpsN = 0; }
    }
    drawRadar();
    updateTags();
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function drawRadar() {
    const G = DL.game, me = G.me, M = DL.map;
    const ref = me.alive ? me : (G.spectateTarget() || me);
    const g = radarCtx, S = RADAR_PX * radarDpr, k = (S / 2) / RADAR_RANGE;
    const yaw = me.alive ? me.yaw : DL.player.camState.yaw;
    const px = me.alive ? me.body.x : DL.three.camera.position.x;
    const pz = me.alive ? me.body.z : DL.three.camera.position.z;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(yaw);
    const imgK = k * (M.CS / CELL_PX);
    g.scale(imgK, imgK);
    g.translate(-(px / M.CS + M.W / 2) * CELL_PX, -(pz / M.CS + M.H / 2) * CELL_PX);
    g.drawImage(radarImg, 0, 0);
    g.restore();
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const toR = (x, z) => {
      const dx = (x - px) * k, dz = (z - pz) * k;
      return [S / 2 + dx * cy - dz * sy, S / 2 + dx * sy + dz * cy];
    };
    const dot = (x, z, color, r, ring) => {
      let [rx, ry] = toR(x, z);
      const dx = rx - S / 2, dy = ry - S / 2, d = Math.hypot(dx, dy), lim = S / 2 - 6 * radarDpr;
      if (d > lim) { rx = S / 2 + (dx / d) * lim; ry = S / 2 + (dy / d) * lim; }
      g.beginPath(); g.arc(rx, ry, r * radarDpr, 0, Math.PI * 2);
      g.fillStyle = color; g.fill();
      if (ring) { g.lineWidth = 1.5 * radarDpr; g.strokeStyle = ring; g.stroke(); }
    };
    const teamColor = { T: '#e9a93a', CT: '#78b2ea' };
    // Bomb
    const bomb = G.bomb;
    if (bomb.state === 'dropped' && me.team === 'T' || bomb.state === 'planted') {
      const blink = bomb.state === 'planted' ? (Math.sin(DL.time * 10) > 0 ? '#ff4d3d' : '#7a1d16') : '#ff8a3d';
      dot(bomb.x, bomb.z, blink, 4.5, '#000');
    }
    for (const s of G.soldiers) {
      if (s === me || !s.alive) continue;
      if (s.team === me.team) dot(s.body.x, s.body.z, teamColor[s.team], 4, s.hasBomb ? '#ff8a3d' : 'rgba(0,0,0,0.6)');
      else if (s.spottedUntil > DL.time) dot(s.body.x, s.body.z, '#ff3b30', 4, 'rgba(0,0,0,0.6)');
    }
    // Self (or spectated player) arrow, always pointing up.
    if (me.alive || ref !== me) {
      const [rx, ry] = me.alive ? [S / 2, S / 2] : toR(ref.body.x, ref.body.z);
      g.save();
      g.translate(rx, ry);
      if (!me.alive) g.rotate(yaw - ref.yaw);
      g.beginPath();
      const u = radarDpr;
      g.moveTo(0, -7 * u); g.lineTo(5 * u, 6 * u); g.lineTo(0, 3 * u); g.lineTo(-5 * u, 6 * u); g.closePath();
      g.fillStyle = '#fff'; g.fill();
      g.restore();
    }
  }

  const tagV = new THREE.Vector3();
  function updateTags() {
    const G = DL.game, me = G.me, cam = DL.three.camera;
    let i = 0;
    for (const s of G.soldiers) {
      if (i >= tags.length) break;
      if (s === me || !s.alive || s.team !== me.team) continue;
      tagV.set(s.body.x, G.headY(s) + 0.45, s.body.z);
      const d = cam.position.distanceTo(tagV);
      tagV.project(cam);
      const t = tags[i++];
      if (tagV.z > 1 || d > 70 || Math.abs(tagV.x) > 1.1 || Math.abs(tagV.y) > 1.1) { t.style.display = 'none'; continue; }
      t.style.display = '';
      const x = (tagV.x * 0.5 + 0.5) * window.innerWidth, y = (-tagV.y * 0.5 + 0.5) * window.innerHeight;
      t.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px) translate(-50%,-100%)';
      if (t.textContent !== s.name) t.textContent = s.name;
      t.style.color = s.team === 'T' ? '#f0c068' : '#9ccaf3';
      t.style.textShadow = '0 1px 2px #000';
    }
    for (; i < tags.length; i++) tags[i].style.display = 'none';
  }

  H.killfeed = function (killer, victim, weapon, hs) {
    const me = DL.game.me;
    const row = document.createElement('div');
    row.className = 'kf' + (killer === me || victim === me ? ' mine' : '');
    const nm = (s) => '<span class="' + (s.team === 'T' ? 't' : 'ct') + '">' + escapeHtml(s.name) + '</span>';
    row.innerHTML = (killer && killer !== victim ? nm(killer) : '') + '<span class="w">' + escapeHtml(weapon) + '</span>' + (hs ? '<span class="hs">HS</span>' : '') + nm(victim);
    el.killfeed.appendChild(row);
    while (el.killfeed.children.length > 5) el.killfeed.firstChild.remove();
    setTimeout(() => row.remove(), 7000);
  };

  H.hit = function (kill, head) {
    el.hitmarker.classList.add('show');
    el.hitmarker.classList.toggle('kill', !!kill);
    H.hitT = kill ? 0.35 : 0.15;
  };

  H.damageFrom = function (x, z, amount) {
    const d = document.createElement('div');
    d.className = 'dmgdir';
    d.dataset.x = x; d.dataset.z = z; d.dataset.t = 1.4;
    el.dmgDirs.appendChild(d);
    while (el.dmgDirs.children.length > 4) el.dmgDirs.firstChild.remove();
    H.flash = Math.min(0.9, (H.flash || 0) + amount / 60);
  };

  H.center = function (msg, dur) {
    el.centerMsg.textContent = msg;
    el.centerMsg.classList.add('show');
    H.centerT = dur || 2.5;
  };

  H.banner = function (team, title, sub) {
    el.banner.hidden = false;
    el.banner.className = team === 'T' ? 't' : team === 'CT' ? 'ct' : '';
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    // restart animation
    el.banner.style.animation = 'none';
    void el.banner.offsetWidth;
    el.banner.style.animation = '';
  };
  H.hideBanner = function () { el.banner.hidden = true; };

  H.moneyDelta = function (n) {
    const d = el.moneyDelta;
    d.textContent = (n >= 0 ? '+$' : '-$') + Math.abs(n);
    d.classList.toggle('neg', n < 0);
    d.classList.add('show');
    clearTimeout(H.mdT);
    H.mdT = setTimeout(() => d.classList.remove('show'), 1600);
  };

  H.showSlots = function () {
    const me = DL.game.me;
    const names = ['Primary', 'Pistol', 'Knife', 'Grenade', 'Bomb'];
    let html = '';
    me.weapons.forEach((w, i) => {
      if (!w) return;
      html += '<div class="' + (i === me.cur ? 'on' : '') + '"><b>' + (i + 1) + '</b>' + escapeHtml(w.def.name) + '</div>';
    });
    el.slots.innerHTML = html;
    el.slots.classList.add('show');
    H.slotsT = 1.6;
    void names;
  };

  // ---------- Buy menu ----------
  H.buyItems = function (team) {
    const D = DL.weapons.DEFS;
    const pistol = team === 'T' ? 'glock' : 'p2k', rifle = team === 'T' ? 'ak' : 'm4';
    const cols = [
      { title: 'Pistols', items: [pistol, 'deagle'] },
      { title: 'Rifles', items: ['mp5', rifle, 'awp'] },
      { title: 'Gear', items: team === 'CT' ? ['kevlar', 'helmet', 'kit'] : ['kevlar', 'helmet'] },
      { title: 'Grenades', items: ['he'] },
    ];
    const extra = {
      kevlar: { name: 'Kevlar Vest', desc: 'Body armor', price: 650 },
      helmet: { name: 'Kevlar + Helmet', desc: 'Protects against headshots', price: 1000 },
      kit: { name: 'Defuse Kit', desc: 'Defuse in 5 seconds', price: 400 },
    };
    let n = 0;
    for (const c of cols) {
      c.items = c.items.map((id) => {
        const d = D[id] || extra[id];
        return { id, key: ++n, name: d.name, desc: d.desc || '', price: d.price };
      });
    }
    return cols;
  };

  H.refreshBuy = function () {
    const G = DL.game, me = G.me;
    const cols = H.buyItems(me.team);
    let html = '';
    for (const c of cols) {
      html += '<div class="buy-col"><h3>' + c.title + '</h3>';
      for (const it of c.items) {
        const st = G.buyState(me, it.id);
        html += '<button class="buy-item' + (st.owned ? ' owned' : '') + '" data-id="' + it.id + '"' + (st.ok ? '' : ' disabled') + '>' +
          '<span class="k">' + it.key + '</span><span>' + escapeHtml(it.name) + '<small>' + escapeHtml(it.desc) + '</small></span>' +
          '<span class="p">' + (st.owned ? 'Owned' : '$' + st.price) + '</span></button>';
      }
      html += '</div>';
    }
    el.buyGrid.innerHTML = html;
    setText('buyMoney', String(me.money));
  };
  H.buyKeyItem = function (key) {
    const cols = H.buyItems(DL.game.me.team);
    for (const c of cols) for (const it of c.items) if (it.key === key) return it.id;
    return null;
  };
  H.showBuy = function (on) {
    el.buy.hidden = !on;
    if (on) H.refreshBuy();
  };

  // ---------- Scoreboard ----------
  H.showScoreboard = function (on) {
    el.scoreboard.hidden = !on;
    if (!on) return;
    const G = DL.game;
    const fill = (team, tbody) => {
      const list = G.soldiers.filter((s) => s.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      tbody.innerHTML = list.map((s) => '<tr class="' + (s === G.me ? 'me ' : '') + (s.alive ? '' : 'dead') + '"><td>' + escapeHtml(s.name) + (s.hasBomb && G.me.team === 'T' ? ' · C4' : '') + '</td><td>' + (s.team === G.me.team ? '$' + s.money : '') + '</td><td>' + s.kills + '</td><td>' + s.deaths + '</td><td>' + (s.mvps || '') + '</td></tr>').join('');
    };
    fill('CT', el.sbCT);
    fill('T', el.sbT);
    el.sbScoreCT.textContent = G.score.CT;
    el.sbScoreT.textContent = G.score.T;
  };

  H.setFps = function (on) { H.fpsOn = on; el.fps.hidden = !on; };
})(window.DL);
