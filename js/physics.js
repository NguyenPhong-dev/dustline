/* Dustline - physics.js: character movement against axis-aligned boxes, ray casts,
 * line-of-sight checks, grenade bounces and A* pathfinding on the map grid. */
'use strict';
(function (DL) {
  const P = (DL.phys = {});
  P.GRAVITY = 20;
  P.STEP = 0.45;
  const EPS = 0.002;

  P.overlapAny = function (x, y, z, r, h) {
    const bs = DL.map.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ && y + h > b.minY + EPS && y < b.maxY - EPS) return b;
    }
    return null;
  };

  function moveHoriz(b, axis, d) {
    if (d === 0) return;
    const bs = DL.map.boxes;
    let nx = b.x, nz = b.z;
    if (axis === 0) nx += d; else nz += d;
    for (let i = 0; i < bs.length; i++) {
      const box = bs[i];
      if (!(nx + b.r > box.minX && nx - b.r < box.maxX && nz + b.r > box.minZ && nz - b.r < box.maxZ && b.y + b.h > box.minY + EPS && b.y < box.maxY - EPS)) continue;
      const rise = box.maxY - b.y;
      if (b.onGround && rise > 0 && rise <= P.STEP && !P.overlapAny(nx, box.maxY + EPS, nz, b.r, b.h)) {
        b.y = box.maxY + EPS;
        continue;
      }
      if (axis === 0) {
        if (d > 0 && b.x + b.r <= box.minX + 0.05) nx = box.minX - b.r - EPS;
        else if (d < 0 && b.x - b.r >= box.maxX - 0.05) nx = box.maxX + b.r + EPS;
        else continue;
        b.vx = 0;
      } else {
        if (d > 0 && b.z + b.r <= box.minZ + 0.05) nz = box.minZ - b.r - EPS;
        else if (d < 0 && b.z - b.r >= box.maxZ - 0.05) nz = box.maxZ + b.r + EPS;
        else continue;
        b.vz = 0;
      }
      b.blocked = true;
    }
    b.x = nx; b.z = nz;
  }

  function moveVert(b, d) {
    const bs = DL.map.boxes;
    let ny = b.y + d;
    b.onGround = false;
    if (d <= 0) {
      let floor = 0;
      for (let i = 0; i < bs.length; i++) {
        const box = bs[i];
        if (b.x + b.r > box.minX && b.x - b.r < box.maxX && b.z + b.r > box.minZ && b.z - b.r < box.maxZ) {
          if (box.maxY <= b.y + 0.01 && box.maxY > floor) floor = box.maxY;
        }
      }
      if (ny <= floor) {
        ny = floor;
        if (b.vy < 0) b.vy = 0;
        b.onGround = true;
      }
    } else {
      for (let i = 0; i < bs.length; i++) {
        const box = bs[i];
        if (b.x + b.r > box.minX && b.x - b.r < box.maxX && b.z + b.r > box.minZ && b.z - b.r < box.maxZ) {
          if (box.minY >= b.y + b.h - 0.01 && ny + b.h > box.minY) {
            ny = box.minY - b.h;
            b.vy = 0;
          }
        }
      }
    }
    b.y = ny;
  }

  // Body: {x,y,z (feet), vx,vy,vz, r (half width), h (height), onGround}
  P.moveBody = function (b, dt) {
    b.vy -= P.GRAVITY * dt;
    if (b.vy < -40) b.vy = -40;
    const maxD = Math.max(Math.abs(b.vx), Math.abs(b.vz), Math.abs(b.vy)) * dt;
    const n = Math.min(8, Math.max(1, Math.ceil(maxD / 0.2)));
    const sdt = dt / n;
    const wasGround = b.onGround;
    const fallSpeed = b.vy;
    b.blocked = false;
    for (let i = 0; i < n; i++) {
      moveHoriz(b, 0, b.vx * sdt);
      moveHoriz(b, 1, b.vz * sdt);
      moveVert(b, b.vy * sdt);
    }
    b.landed = !wasGround && b.onGround ? -fallSpeed : 0;
    return b;
  };

  // ---------- Ray casting ----------
  P.hit = { t: 0, nx: 0, ny: 0, nz: 0, box: null, hit: false };
  P.raycast = function (ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT, nx = 0, ny = 0, nz = 0, bbox = null;
    if (dy < -1e-9) {
      const t = -oy / dy;
      if (t >= 0 && t < best) { best = t; nx = 0; ny = 1; nz = 0; }
    }
    const ex = ox + dx * maxT, ez = oz + dz * maxT;
    const rminX = Math.min(ox, ex), rmaxX = Math.max(ox, ex), rminZ = Math.min(oz, ez), rmaxZ = Math.max(oz, ez);
    const bs = DL.map.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.maxX < rminX || b.minX > rmaxX || b.maxZ < rminZ || b.minZ > rmaxZ) continue;
      let tmin = -Infinity, tmax = best, axis = -1, sgn = 0, miss = false;
      // X
      if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) continue; }
      else {
        let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx, s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = 0; sgn = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) miss = true;
      }
      if (miss) continue;
      if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) continue; }
      else {
        let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy, s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = 1; sgn = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) miss = true;
      }
      if (miss) continue;
      if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) continue; }
      else {
        let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz, s = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = 2; sgn = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) miss = true;
      }
      if (miss || tmin < 0 || tmin >= best) continue;
      best = tmin;
      nx = axis === 0 ? sgn : 0; ny = axis === 1 ? sgn : 0; nz = axis === 2 ? sgn : 0;
      bbox = b;
    }
    const H = P.hit;
    H.t = best; H.nx = nx; H.ny = ny; H.nz = nz; H.box = bbox; H.hit = best < maxT;
    return best;
  };

  // Ray against an axis aligned box given by center and half extents. Returns t or -1.
  P.rayBox = function (ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz, maxT) {
    let tmin = 0, tmax = maxT;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [cx - hx, cy - hy, cz - hz], mx = [cx + hx, cy + hy, cz + hz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return -1; continue; }
      let t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a];
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    return tmin;
  };

  P.los = function (ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    const t = P.raycast(ax, ay, az, dx / d, dy / d, dz / d, d);
    return t >= d - 0.02;
  };

  // ---------- Grenades and dropped items ----------
  // p: {x,y,z,vx,vy,vz,r}; returns impact speed if it bounced this frame.
  P.moveProjectile = function (p, dt, bounce, gravityScale) {
    bounce = bounce == null ? 0.45 : bounce;
    p.vy -= P.GRAVITY * (gravityScale == null ? 0.8 : gravityScale) * dt;
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    const n = Math.min(10, Math.max(1, Math.ceil((speed * dt) / 0.15)));
    const sdt = dt / n;
    let impact = 0;
    p.resting = false;
    for (let i = 0; i < n; i++) {
      // x
      let nx = p.x + p.vx * sdt;
      if (P.overlapAny(nx, p.y - p.r, p.z, p.r, p.r * 2)) { impact = Math.max(impact, Math.abs(p.vx)); p.vx *= -bounce; p.vy *= 0.85; p.vz *= 0.85; nx = p.x; }
      p.x = nx;
      let nz = p.z + p.vz * sdt;
      if (P.overlapAny(p.x, p.y - p.r, nz, p.r, p.r * 2)) { impact = Math.max(impact, Math.abs(p.vz)); p.vz *= -bounce; p.vx *= 0.85; p.vy *= 0.85; nz = p.z; }
      p.z = nz;
      let ny = p.y + p.vy * sdt;
      const hitBox = P.overlapAny(p.x, ny - p.r, p.z, p.r, p.r * 2);
      if (hitBox || ny - p.r < 0) {
        const down = p.vy < 0;
        impact = Math.max(impact, Math.abs(p.vy));
        if (down) {
          ny = hitBox ? Math.max(p.y, hitBox.maxY + p.r) : p.r;
          if (!hitBox) ny = p.r;
        } else ny = p.y;
        p.vy *= -bounce;
        if (down) { p.vx *= 0.7; p.vz *= 0.7; }
        if (down && Math.abs(p.vy) < 1.2) { p.vy = 0; p.resting = true; }
      }
      p.y = ny;
    }
    return impact;
  };

  // ---------- Navigation ----------
  let W = 0, H = 0, walk = null;
  P.buildNav = function () {
    W = DL.map.W; H = DL.map.H;
    walk = new Uint8Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) walk[r * W + c] = DL.map.walkable(c, r) ? 1 : 0;
  };
  const isWalk = (c, r) => c >= 0 && r >= 0 && c < W && r < H && walk[r * W + c] === 1;
  P.isWalkCell = isWalk;
  P.walkableAt = (x, z) => isWalk(DL.map.toCol(x), DL.map.toRow(z));

  function nearestWalk(c, r) {
    if (isWalk(c, r)) return [c, r];
    for (let rad = 1; rad < 5; rad++) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        if (isWalk(c + dc, r + dr)) return [c + dc, r + dr];
      }
    }
    return null;
  }

  // True if a body of radius `rad` can walk the straight segment.
  P.clearLine = function (ax, az, bx, bz, rad) {
    rad = rad == null ? 0.5 : rad;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const ux = dx / len, uz = dz / len, px = -uz * rad, pz = ux * rad;
    const steps = Math.ceil(len / 0.3);
    const M = DL.map;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * len, x = ax + ux * t, z = az + uz * t;
      if (!isWalk(M.toCol(x), M.toRow(z))) return false;
      if (!isWalk(M.toCol(x + px), M.toRow(z + pz))) return false;
      if (!isWalk(M.toCol(x - px), M.toRow(z - pz))) return false;
    }
    return true;
  };

  // Minimal binary heap keyed by f.
  function Heap() { this.a = []; }
  Heap.prototype.push = function (node, f) {
    const a = this.a;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  };
  Heap.prototype.pop = function () {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top[1];
  };

  const SQ2 = Math.SQRT2;
  P.findPath = function (sx, sz, tx, tz) {
    const M = DL.map;
    const s = nearestWalk(M.toCol(sx), M.toRow(sz));
    const t = nearestWalk(M.toCol(tx), M.toRow(tz));
    if (!s || !t) return null;
    const start = s[1] * W + s[0], goal = t[1] * W + t[0];
    const g = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const heap = new Heap();
    g[start] = 0;
    heap.push(start, 0);
    const tc = t[0], tr = t[1];
    let found = false;
    while (heap.a.length) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      if (cur === goal) { found = true; break; }
      closed[cur] = 1;
      const cc = cur % W, cr = (cur / W) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (!isWalk(nc, nr)) continue;
          if (dc && dr && (!isWalk(cc + dc, cr) || !isWalk(cc, cr + dr))) continue;
          const ni = nr * W + nc;
          if (closed[ni]) continue;
          const ng = g[cur] + (dc && dr ? SQ2 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            came[ni] = cur;
            const ddx = Math.abs(nc - tc), ddz = Math.abs(nr - tr);
            const h = Math.max(ddx, ddz) + (SQ2 - 1) * Math.min(ddx, ddz);
            heap.push(ni, ng + h);
          }
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => ({ x: M.cellX(i % W), z: M.cellZ((i / W) | 0) }));
    // Use the exact target if it is reachable from its cell center.
    if (isWalk(M.toCol(tx), M.toRow(tz))) pts[pts.length - 1] = { x: tx, z: tz };
    // String pulling: skip waypoints that can be seen directly.
    const out = [];
    let ax = sx, az = sz, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !P.clearLine(ax, az, pts[j].x, pts[j].z, 0.45)) j--;
      out.push(pts[j]);
      ax = pts[j].x; az = pts[j].z;
      i = j + 1;
    }
    return out;
  };
})(window.DL);
