/* Dustline - bots.js: bot brains. Bots see with a view cone and line of sight, react after a
 * human-like delay, aim with error that shrinks while they track you, control bursts, strafe,
 * and play the bomb objective: Terrorists pick a site and plant, Counter-Terrorists hold and retake. */
'use strict';
(function (DL) {
  const AI = (DL.ai = {});

  AI.DIFF = {
    easy: { reaction: 0.75, aimErr: DL.deg(4.2), turn: 4.2, smooth: 6, headPref: 0.12, fov: DL.deg(110), viewDist: 45, recoilControl: 0.25, burst: 5, sprayDist: 6, strafe: 0.3 },
    normal: { reaction: 0.45, aimErr: DL.deg(2.3), turn: 7.5, smooth: 10, headPref: 0.33, fov: DL.deg(125), viewDist: 70, recoilControl: 0.55, burst: 4, sprayDist: 9, strafe: 0.55 },
    hard: { reaction: 0.27, aimErr: DL.deg(1.15), turn: 12, smooth: 16, headPref: 0.6, fov: DL.deg(140), viewDist: 95, recoilControl: 0.82, burst: 4, sprayDist: 12, strafe: 0.8 },
  };

  // Where a lurker waits at the other site, watching the defenders' rotation path.
  const LURK = {
    A: [{ at: [43, 16], look: [42, 12] }, { at: [24, 17], look: [24, 13] }],
    B: [{ at: [3, 16], look: [3, 12] }, { at: [13, 17], look: [13, 13] }],
  };
  // Spots the attackers hold after planting, watching the defenders' entrances.
  const RETAKE = {
    A: [{ at: [44, 11], look: [33, 4] }, { at: [37, 9], look: [33, 5] }, { at: [41, 3], look: [33, 11] }, { at: [45, 2], look: [33, 4] }],
    B: [{ at: [3, 10], look: [14, 4] }, { at: [6, 3], look: [14, 5] }, { at: [11, 11], look: [14, 4] }, { at: [2, 2], look: [14, 6] }],
  };

  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const cell = (cr, jitter) => {
    const p = DL.map.cellPos(cr);
    if (jitter) { p.x += (Math.random() - 0.5) * jitter; p.z += (Math.random() - 0.5) * jitter; }
    return p;
  };

  AI.newBrain = function () {
    return {
      path: null, pathIdx: 0, goalX: 0, goalZ: 0, repathT: 0,
      route: null, routeIdx: 0, routePts: null,
      target: null, visible: false, seenAt: 0, lastSeen: { x: 0, y: 0, z: 0 }, lastSeenTime: -99,
      reactAt: 0, errYaw: 0, errPitch: 0, errT: 0, aimHead: false,
      strafeDir: 1, strafeT: 0, burst: 0, burstPause: 0, crouchFight: false,
      thinkT: Math.random() * 0.1,
      stuckT: 0, lastX: 0, lastZ: 0, stuckCheck: 0,
      hold: null, holdArrived: false, sweep: Math.random() * 6,
      heard: null, heardTime: -99,
      startDelay: 0, plantSpot: null, role: null, rotated: false,
      lookYaw: null, unstickUntil: 0, unstickDir: 1, nextFire: 0,
    };
  };

  AI.eyeY = (s) => s.body.y + 1.62 - s.crouch * 0.44;

  // Line of sight to any of the target's head or chest.
  function canSee(b, e) {
    const ex = b.body.x, ey = AI.eyeY(b), ez = b.body.z;
    const hy = DL.game.headY(e), cy = DL.game.chestY(e);
    if (DL.phys.los(ex, ey, ez, e.body.x, hy, e.body.z)) return 'head';
    if (DL.phys.los(ex, ey, ez, e.body.x, cy, e.body.z)) return 'chest';
    return null;
  }
  AI.canSee = canSee;

  function perceive(b, D) {
    const G = DL.game, br = b.brain, now = DL.time;
    let best = null, bestD = Infinity, bestPart = null;
    for (const e of G.soldiers) {
      if (!e.alive || e.team === b.team) continue;
      const dx = e.body.x - b.body.x, dz = e.body.z - b.body.z;
      const d = Math.hypot(dx, dz);
      if (d > D.viewDist) continue;
      const off = Math.abs(DL.wrapAngle(DL.yawTo(dx, dz) - b.yaw));
      const tracking = br.target === e && now - br.lastSeenTime < 1.5;
      const loud = now - e.lastShot < 0.6 && d < 30 && off < 2.4;
      if (!(off < D.fov / 2 || d < 3.5 || tracking || loud)) continue;
      const part = canSee(b, e);
      if (part && d < bestD) { best = e; bestD = d; bestPart = part; }
    }
    if (best) {
      if (br.target !== best || !br.visible) {
        const fresh = br.target !== best || now - br.lastSeenTime > 1.2;
        if (fresh) {
          // Holding still with the crosshair already on the doorway is a big advantage.
          const off = Math.abs(DL.wrapAngle(DL.yawTo(best.body.x - b.body.x, best.body.z - b.body.z) - b.yaw));
          br.preAimed = Math.hypot(b.body.vx, b.body.vz) < 0.8 && off < DL.deg(22);
          br.reactAt = now + D.reaction * DL.rand(0.8, 1.35) * (br.preAimed ? 0.45 : 1);
          br.seenAt = now;
          br.aimHead = Math.random() < D.headPref;
          br.crouchFight = Math.random() < (DL.game.diffName === 'hard' ? 0.35 : 0.15);
          br.errT = 0;
        }
      }
      br.target = best;
      br.visible = true;
      br.visiblePart = bestPart;
      br.lastSeen.x = best.body.x; br.lastSeen.y = best.body.y; br.lastSeen.z = best.body.z;
      br.lastSeenTime = now;
      G.spot(b.team, best);
    } else {
      br.visible = false;
    }
  }

  function aimAt(b, x, y, z, D, dt, turnBoost) {
    const dx = x - b.body.x, dz = z - b.body.z, dy = y - AI.eyeY(b);
    const yaw = DL.yawTo(dx, dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    turnAngles(b, yaw, pitch, D, dt, turnBoost);
  }
  function turnAngles(b, yaw, pitch, D, dt, boost) {
    const k = 1 - Math.exp(-D.smooth * (boost || 1) * dt);
    const maxT = D.turn * (boost || 1) * dt;
    b.yaw = DL.wrapAngle(b.yaw + DL.clamp(DL.wrapAngle(yaw - b.yaw) * k, -maxT, maxT));
    b.pitch += DL.clamp((pitch - b.pitch) * k, -maxT, maxT);
  }

  // Walks toward (gx, gz) along an A* path. Returns true once there.
  function walkTo(b, gx, gz, dt, opt) {
    const br = b.brain, now = DL.time;
    opt = opt || {};
    const arrive = opt.arrive || 0.7;
    if (Math.hypot(gx - b.body.x, gz - b.body.z) < arrive) { br.path = null; return true; }
    if (!br.path || Math.abs(br.goalX - gx) > 0.5 || Math.abs(br.goalZ - gz) > 0.5 || now > br.repathT) {
      br.path = DL.phys.findPath(b.body.x, b.body.z, gx, gz);
      br.pathIdx = 0; br.goalX = gx; br.goalZ = gz;
      br.repathT = now + 4 + Math.random() * 2;
      if (!br.path) return true;
    }
    let wp = br.path[br.pathIdx];
    while (wp && Math.hypot(wp.x - b.body.x, wp.z - b.body.z) < (br.pathIdx === br.path.length - 1 ? arrive : 0.8)) {
      br.pathIdx++;
      wp = br.path[br.pathIdx];
    }
    if (!wp) { br.path = null; return true; }
    let dx = wp.x - b.body.x, dz = wp.z - b.body.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    if (now < br.unstickUntil) {
      const sx = -dz * br.unstickDir, sz = dx * br.unstickDir;
      dx = dx * 0.4 + sx; dz = dz * 0.4 + sz;
    }
    b.input.wishX = dx; b.input.wishZ = dz;
    b.input.walk = !!opt.walk;
    if (!opt.noLook) {
      const D = AI.D;
      if (br.lookAt) aimAt(b, br.lookAt.x, br.lookAt.y, br.lookAt.z, D, dt, 0.8);
      else turnAngles(b, DL.yawTo(dx, dz), 0, D, dt, 0.6);
    }
    // Stuck detection
    br.stuckCheck += dt;
    if (br.stuckCheck > 0.8) {
      const moved = Math.hypot(b.body.x - br.lastX, b.body.z - br.lastZ);
      if (moved < 0.35) {
        br.stuckT += br.stuckCheck;
        if (br.stuckT > 1.2) {
          br.repathT = 0;
          br.unstickUntil = now + 0.6;
          br.unstickDir = Math.random() < 0.5 ? -1 : 1;
          b.input.jump = true;
          br.stuckT = 0;
        }
      } else br.stuckT = 0;
      br.lastX = b.body.x; br.lastZ = b.body.z; br.stuckCheck = 0;
    }
    return false;
  }

  function holdLook(b, look, dt, D) {
    const br = b.brain;
    if (br.lookAt) { aimAt(b, br.lookAt.x, br.lookAt.y, br.lookAt.z, D, dt, 0.8); return; }
    br.sweep += dt * 0.6;
    const p = cell(look);
    const yaw = DL.yawTo(p.x - b.body.x, p.z - b.body.z) + Math.sin(br.sweep) * 0.22;
    turnAngles(b, yaw, Math.sin(br.sweep * 0.7) * 0.03, D, dt, 0.35);
  }

  function engage(b, dt, D) {
    const G = DL.game, br = b.brain, t = br.target, now = DL.time;
    const inst = b.weapons[b.cur];
    const dx = t.body.x - b.body.x, dz = t.body.z - b.body.z, d = Math.hypot(dx, dz);
    // Out of ammo: pistol, then knife.
    if (inst && inst.def.mag && inst.mag === 0 && b.reloadEnd <= 0) {
      if (inst.reserve > 0 && d > 8) b.input.reload = true;
      else if (b.cur === 0 && b.weapons[1] && (b.weapons[1].mag > 0 || b.weapons[1].reserve > 0)) G.switchTo(b, 1);
      else if (inst.reserve > 0) b.input.reload = true;
      else G.switchTo(b, 2);
    }
    if (b.cur === 3 || b.cur === 4) G.switchTo(b, b.weapons[0] ? 0 : 1);

    // Aim point with error that is large on first sight and shrinks while tracking.
    const head = br.aimHead && br.visiblePart === 'head';
    const ty = head ? G.headY(t) : G.chestY(t) - 0.05;
    const track = now - br.seenAt;
    const tSpeed = Math.hypot(t.body.vx, t.body.vz);
    const errRad = D.aimErr * (1 + (br.preAimed ? 0.4 : 2.2) * Math.exp(-track / 0.7)) * (1 + tSpeed * 0.06) * (b.hurtUntil > now ? 1.5 : 1);
    if (now > br.errT) {
      br.errYaw = randn() * errRad;
      br.errPitch = randn() * errRad * 0.6;
      br.errT = now + DL.rand(0.22, 0.45);
    }
    // Lead a little, aim at where the target will be.
    const lead = 0.06;
    const ax = t.body.x + t.body.vx * lead, az = t.body.z + t.body.vz * lead;
    const yawT = DL.yawTo(ax - b.body.x, az - b.body.z) + br.errYaw;
    const pitchT = Math.atan2(ty - AI.eyeY(b), Math.hypot(ax - b.body.x, az - b.body.z)) + br.errPitch;
    turnAngles(b, yawT, pitchT, D, dt, 1);

    // Fire control
    const trueYaw = DL.yawTo(dx, dz), truePitch = Math.atan2(G.chestY(t) - AI.eyeY(b), d);
    const angErr = Math.hypot(DL.wrapAngle(trueYaw - b.yaw), truePitch - b.pitch);
    const tol = Math.atan2(0.5, d) + 0.015;
    const type = inst ? inst.def.type : 'knife';
    let wantFire = now >= br.reactAt && angErr < tol * 1.8;
    let standStill = false;
    if (type === 'knife') {
      wantFire = d < 1.8;
    } else if (type === 'sniper') {
      standStill = true;
      wantFire = wantFire && angErr < tol && Math.hypot(b.body.vx, b.body.vz) < 1.2;
    } else if (type === 'pistol') {
      standStill = d > 6;
      wantFire = wantFire && now >= br.nextFire;
      if (wantFire) br.nextFire = now + inst.def.rate + DL.rand(0.05, 0.18);
    } else {
      // Rifles and SMGs: taps at range, bursts at mid range, spray up close.
      standStill = d > D.sprayDist * 0.6;
      if (d > 26) {
        wantFire = wantFire && inst.recoil < 0.6 && now >= br.nextFire;
        if (wantFire) br.nextFire = now + DL.rand(0.22, 0.4);
      } else if (d > D.sprayDist) {
        if (now < br.burstPause) wantFire = false;
        else if (wantFire && b.firedThisFrame) {
          br.burst++;
          if (br.burst >= D.burst + Math.floor(Math.random() * 2)) { br.burst = 0; br.burstPause = now + DL.rand(0.2, 0.35); }
        }
      }
    }
    b.input.fire = wantFire;

    // Movement
    if (type === 'knife') {
      b.input.wishX = dx / d; b.input.wishZ = dz / d;
    } else if (standStill && (wantFire || now < br.burstPause + 0.1)) {
      b.input.wishX = 0; b.input.wishZ = 0;
      b.input.crouch = br.crouchFight && d > 12;
    } else {
      if (now > br.strafeT) {
        br.strafeT = now + DL.rand(0.35, 0.9);
        br.strafeDir = Math.random() < D.strafe ? (br.strafeDir >= 0 ? -1 : 1) : 0;
      }
      // Better bots counter-strafe: stop dead for the shot, move between shots.
      const counter = wantFire && D.strafe > 0.5 && type !== 'smg';
      if (br.strafeDir && !counter && d < 20) {
        b.input.wishX = (-dz / d) * br.strafeDir;
        b.input.wishZ = (dx / d) * br.strafeDir;
      }
    }
  }

  // ---------- Objectives ----------
  function objectiveT(b, dt, D) {
    const G = DL.game, br = b.brain, now = DL.time, bomb = G.bomb;
    if (bomb.state === 'planted') {
      if (!br.hold || br.hold.site !== bomb.site) {
        const list = RETAKE[bomb.site];
        br.hold = Object.assign({ site: bomb.site }, DL.choice(list));
        br.holdPos = cell(br.hold.at, 0.8);
        br.holdArrived = false;
      }
      if (walkTo(b, br.holdPos.x, br.holdPos.z, dt, { arrive: 1.0 })) holdLook(b, br.hold.look, dt, D);
      return;
    }
    if (bomb.state === 'dropped' && bomb.fetcher === b) {
      walkTo(b, bomb.x, bomb.z, dt, { arrive: 0.4 });
      return;
    }
    if (now < G.liveStart + br.startDelay) {
      holdLook(b, [23, 30], dt, D);
      return;
    }
    // A lurker sits near the other site to catch defenders rotating through.
    if (br.lurk) {
      if (!br.lurkPos) br.lurkPos = cell(br.lurk.at, 0.6);
      if (walkTo(b, br.lurkPos.x, br.lurkPos.z, dt, { arrive: 1, walk: Math.hypot(br.lurkPos.x - b.body.x, br.lurkPos.z - b.body.z) < 12 })) holdLook(b, br.lurk.look, dt, D);
      return;
    }
    const site = G.plan.site;
    // Anyone who has reached the site is done with the route.
    if (br.routePts && br.routeIdx < br.routePts.length && DL.map.siteAt(b.body.x, b.body.z) === site) br.routeIdx = br.routePts.length;
    // Follow the route toward the chosen site.
    if (br.routePts && br.routeIdx < br.routePts.length) {
      const p = br.routePts[br.routeIdx];
      const last = br.routeIdx === br.routePts.length - 1;
      // Slow down and walk quietly on the final approach.
      if (walkTo(b, p.x, p.z, dt, { arrive: last ? 1.2 : 2.2, walk: false })) br.routeIdx++;
      return;
    }
    if (b.hasBomb) {
      if (!br.plantSpot) { br.plantSpot = cell(DL.choice(DL.map.plantSpots[site]), 0.6); br.plantT = now; }
      // Plant at the chosen spot, or wherever we stand on the site if teammates are in the way.
      const there = walkTo(b, br.plantSpot.x, br.plantSpot.z, dt, { arrive: 0.7 });
      const onSite = DL.map.siteAt(b.body.x, b.body.z) === site;
      if (there && onSite || onSite && (now - br.plantT > 4 || Math.hypot(br.plantSpot.x - b.body.x, br.plantSpot.z - b.body.z) < 1.8)) {
        b.input.wishX = 0; b.input.wishZ = 0;
        b.input.use = true; // plant
        b.input.crouch = true;
      } else if (there && !onSite) br.plantSpot = null;
      return;
    }
    if (!br.hold || br.hold.site !== site) {
      br.hold = Object.assign({ site }, DL.choice(RETAKE[site]));
      br.holdPos = cell(br.hold.at, 0.8);
    }
    if (walkTo(b, br.holdPos.x, br.holdPos.z, dt, { arrive: 1.0 })) holdLook(b, br.hold.look, dt, D);
  }

  function objectiveCT(b, dt, D) {
    const G = DL.game, br = b.brain, now = DL.time, bomb = G.bomb;
    if (bomb.state === 'planted') {
      // Defenders far from the bomb regroup outside the site, then retake together.
      if (br.retakeMode == null) br.retakeMode = Math.hypot(bomb.x - b.body.x, bomb.z - b.body.z) < 14 ? 'direct' : 'stage';
      if (br.retakeMode === 'stage' && !G.retakeGo) {
        const st = cell(DL.map.stage[bomb.site]);
        const mates = G.soldiers.filter((s) => s.alive && s.team === 'CT');
        const staged = mates.filter((s) => Math.hypot(s.body.x - st.x, s.body.z - st.z) < 8).length;
        if (G.bombTimeLeft() < 24 || staged >= Math.min(2, mates.length)) G.retakeGo = true;
        if (walkTo(b, st.x, st.z, dt, { arrive: 2 })) holdLook(b, DL.map.siteCenter[bomb.site], dt, D);
        return;
      }
      if (bomb.defuser === b) {
        if (walkTo(b, bomb.x, bomb.z, dt, { arrive: 0.9 })) {
          b.input.wishX = 0; b.input.wishZ = 0;
          b.input.use = true; // defuse
          b.input.crouch = true;
          aimAt(b, bomb.x, bomb.y, bomb.z, D, dt, 0.5);
        }
        return;
      }
      if (!br.hold || br.hold.site !== bomb.site || !br.hold.retake) {
        const spots = DL.map.holds[bomb.site];
        br.hold = Object.assign({ site: bomb.site, retake: true }, DL.choice(spots));
        br.holdPos = cell(br.hold.at, 1);
      }
      if (walkTo(b, br.holdPos.x, br.holdPos.z, dt, { arrive: 1.2 })) holdLook(b, br.hold.look, dt, D);
      return;
    }
    // Rotate toward a site under attack: one rotator on the first sighting, more once
    // several attackers are seen. Each defender rolls once per round.
    const intel = G.intel;
    const need = br.rotateRoll < 0.35 ? 1 : 2;
    if (!br.rotated && intel.site && now - intel.time < 4 && intel.count >= need && br.role !== intel.site && br.rotateRoll < 0.85) {
      br.rotated = true;
      br.role = intel.site;
      const spots = DL.map.holds[intel.site];
      br.hold = Object.assign({ site: intel.site }, DL.choice(spots));
      br.holdPos = cell(br.hold.at, 0.8);
    }
    if (!br.hold) {
      const spots = DL.map.holds[br.role] || DL.map.holds.mid;
      br.hold = Object.assign({ site: br.role }, spots[br.holdIndex % spots.length]);
      br.holdPos = cell(br.hold.at, 0.5);
    }
    if (walkTo(b, br.holdPos.x, br.holdPos.z, dt, { arrive: 0.8 })) {
      holdLook(b, br.hold.look, dt, D);
      // After a long quiet hold, nudge forward to look for a fight.
      if (G.roundClock() > 75 && !br.pushed) {
        br.pushed = true;
        if (Math.random() < 0.3) br.holdPos = cell(br.hold.look, 1);
      }
    }
  }

  AI.update = function (b, dt) {
    const G = DL.game, br = b.brain, now = DL.time;
    const D = (AI.D = AI.DIFF[G.diffName] || AI.DIFF.normal);
    const inp = b.input;
    inp.wishX = 0; inp.wishZ = 0; inp.walk = false; inp.crouch = false; inp.jump = false;
    inp.fire = false; inp.alt = false; inp.reload = false; inp.use = false;
    if (!b.alive) return;
    if (G.state === 'freeze') {
      holdLook(b, b.team === 'T' ? [23, 30] : [23, 20], dt, D);
      return;
    }

    if (now >= br.thinkT) {
      br.thinkT = now + 0.09 + Math.random() * 0.05;
      perceive(b, D);
    }
    const inst = b.weapons[b.cur];

    // Planting or defusing under fire: commit if time is short.
    const committed = (b.action === 'defuse' && G.bomb.state === 'planted' && G.bombTimeLeft() < (b.kit ? 5 : 10) + 1.5) ||
      (b.action === 'plant' && b.actionProgress > 0.6);

    if (br.target && !br.target.alive) { br.target = null; br.visible = false; }
    // Late in the round attackers stop trading at range and push the bomb, shooting on the move.
    const hurry = b.team === 'T' && G.bomb.state !== 'planted' && G.timeLeft() < 35;
    if (br.target && br.visible && !committed) {
      engage(b, dt, D);
      const far = Math.hypot(br.target.body.x - b.body.x, br.target.body.z - b.body.z) > 16;
      if (hurry && far) {
        const fire = b.input.fire;
        br.lookAt = { x: br.target.body.x, y: G.chestY(br.target), z: br.target.body.z };
        objectiveT(b, dt, D);
        b.input.fire = fire;
      }
      return;
    }
    if (committed) {
      inp.use = true; inp.crouch = true;
      return;
    }

    // Reload when it is quiet.
    if (inst && inst.def.mag && inst.mag < inst.def.mag * 0.4 && inst.reserve > 0 && b.reloadEnd <= 0) inp.reload = true;
    if (b.cur !== 0 && b.weapons[0] && b.cur !== 4) G.switchTo(b, 0);
    else if (b.cur === 2 && b.weapons[1]) G.switchTo(b, 1);

    // Recently lost sight of someone: keep the crosshair where they were. Attackers (and
    // defenders after the plant) push a short way to re-peek; defenders hold their spot.
    br.lookAt = null;
    if (br.target && now - br.lastSeenTime < 3.5 && !hurry) {
      const ls = br.lastSeen;
      br.lookAt = { x: ls.x, y: ls.y + 1.4, z: ls.z };
      const dist = Math.hypot(ls.x - b.body.x, ls.z - b.body.z);
      const holding = (b.team === 'CT') === (G.bomb.state !== 'planted');
      const busy = b.hasBomb || (b.team === 'CT' && G.bomb.defuser === b);
      if (!holding && !busy && dist < 14) {
        const seen = DL.phys.los(b.body.x, AI.eyeY(b), b.body.z, ls.x, ls.y + 1.4, ls.z);
        if (!seen || dist > 5) walkTo(b, ls.x, ls.z, dt, { arrive: 1.5 });
        else aimAt(b, ls.x, ls.y + 1.4, ls.z, D, dt, 0.8);
        return;
      }
    } else {
      br.target = null;
      // Defenders on their spot keep the angle unless the noise is close.
      const anchored = b.team === 'CT' && G.bomb.state !== 'planted' && !br.path && br.hold;
      if (now - br.heardTime < 1.6 && br.heard && (!anchored || Math.hypot(br.heard.x - b.body.x, br.heard.z - b.body.z) < 9)) {
        br.lookAt = { x: br.heard.x, y: br.heard.y + 1.4, z: br.heard.z };
      }
    }

    if (b.team === 'T') objectiveT(b, dt, D);
    else objectiveCT(b, dt, D);
  };

  // Called when a soldier hears a sound or gets shot.
  AI.hear = function (b, pos, urgent) {
    const br = b.brain;
    if (!b.alive || (br.visible && br.target)) return;
    br.heard = { x: pos.x, y: pos.y || 0, z: pos.z };
    br.heardTime = DL.time + (urgent ? 0.6 : 0);
  };

  AI.onDamaged = function (b, attacker) {
    const br = b.brain;
    if (!attacker || attacker.team === b.team) return;
    if (!br.visible) {
      br.target = attacker;
      br.lastSeen.x = attacker.body.x; br.lastSeen.y = attacker.body.y; br.lastSeen.z = attacker.body.z;
      br.lastSeenTime = DL.time;
      br.thinkT = 0;
    }
    AI.hear(b, attacker.body, true);
  };

  // Assigns plans at the start of a round.
  AI.planRound = function (G) {
    const Ts = G.soldiers.filter((s) => s.team === 'T' && s.isBot);
    const CTs = G.soldiers.filter((s) => s.team === 'CT' && s.isBot);
    const site = Math.random() < 0.5 ? 'A' : 'B';
    G.plan.site = site;
    const routes = DL.shuffle(DL.map.routes[site].slice());
    const lurker = Ts.length >= 4 && Math.random() < 0.5 ? DL.choice(Ts.filter((s) => !s.hasBomb)) : null;
    Ts.forEach((b, i) => {
      const br = (b.brain = AI.newBrain());
      br.route = routes[i % routes.length];
      br.routePts = br.route.map((n) => cell(DL.map.P[n], 1.4));
      br.routeIdx = 0;
      br.startDelay = DL.rand(0, 4);
      if (b === lurker) br.lurk = DL.choice(LURK[site === 'A' ? 'B' : 'A']);
    });
    const roles = DL.shuffle(['A', 'B', 'A', 'B', 'mid']);
    const counts = { A: 0, B: 0, mid: 0 };
    CTs.forEach((b, i) => {
      const br = (b.brain = AI.newBrain());
      br.role = roles[i % roles.length];
      br.holdIndex = counts[br.role]++;
      br.rotateRoll = Math.random();
    });
  };
})(window.DL);
