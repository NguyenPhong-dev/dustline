/* Dustline - map.js: the "Dustline" map layout, its colliders, navigation data and meshes.
 *
 * The map is a 48x48 grid of 2 m cells. North (row 0) is the Counter-Terrorist side,
 * south is the Terrorist spawn. Legend:
 *   #  wall            .  sand floor        ,  paving         a/b  bombsite A / B floor
 *   =  roofed tunnel   ^  archway           c  crate          h    half crate (jumpable)
 *   C  stacked crates  P  palm tree         T  T spawn        K    CT spawn
 */
'use strict';
(function (DL) {
  const M = (DL.map = {});
  M.CS = 2;
  M.W = 48;
  M.H = 48;
  M.rows = [
    "################################################",
    "#bbbbbbbbbbbbbb###,,,,,,,,,,,,###aaaaaaaaaaaaaa#",
    "#bbbbbbbbbbbbbb###,,K,,K,K,,P,###aaaaaaaaaaaaaa#",
    "#bbCcbbbbbbbhbb,,,,,,######,,,,,,aaaaaaaaaaccaa#",
    "#bbhbbbbbbbbbbb,,,K,,######,,K,,,aaaaCcaaaaaaaa#",
    "#bbbbbbbbbbbbbb,,,,,,######,,,,,,aaaahaaaaaaaaa#",
    "#bbbbbbbCcbbbbb,,,,P,######,,,,,,aaaaaaaaaaaaaa#",
    "#bbbbbbbcbbbbbb###,,K,,K,,,K,,###aaaaaaaaaaaaaa#",
    "#bbbbbbbbbbbbbb#######,,,,#######aaaaaaaaaaaaaa#",
    "#bbbbbbbbbbcbbb#######,,,,#######aaaaaaacCaaaaa#",
    "#bbbbcbbbbbhbbb#######,,,,...h...aahaaaaaaaaaca#",
    "#bbbbbbbbbbbbbb#######,,,,.......aaaaaaaaaaaaaa#",
    "#bbbbbbbbbbbbbb#######,,,,.......aaaaaaaaaaaaaa#",
    "##...#######^^^#######....###############....###",
    "##...#######...#######....###############......#",
    "##...#######...########^#################......#",
    "##===#######...#######....###############......#",
    "##===#######..............###############......#",
    "##===#######.....h........###############......#",
    "##===#######..............###############......#",
    "##===#################....###############......#",
    "##===#################....###############....###",
    "##===#################.ch.###############...h###",
    "##===#################....###############....###",
    "##===#################....###############....###",
    "##====================....###############....###",
    "##====================....###############....###",
    "##===#################....###############....###",
    "##===#################....###############....###",
    "##===#################....###############....###",
    "##===#################....###############c...###",
    "##===#################h...###############....###",
    "##..............######....###############....###",
    "##...........P..######....###############....###",
    "##....c.........######....###############....###",
    "##..............######....###############....###",
    "##.........h....######....###############...c###",
    "##..............######....###############....###",
    "########........######....###############....###",
    "########........................#########....###",
    "########............P...............#........###",
    "########.................c..........^........###",
    "################....................^........###",
    "################...T...T...T........#........###",
    "################.....T...T...T..################",
    "################......T...T.P...################",
    "################................################",
    "################################################",
  ];

  const WALK = '.,ab=^TK';
  const PROP = 'chCP';
  M.at = (c, r) => (c < 0 || r < 0 || c >= M.W || r >= M.H ? '#' : M.rows[r][c]);
  M.walkable = (c, r) => WALK.indexOf(M.at(c, r)) >= 0;
  M.cellX = (c) => (c - M.W / 2) * M.CS + M.CS / 2;
  M.cellZ = (r) => (r - M.H / 2) * M.CS + M.CS / 2;
  M.toCol = (x) => Math.floor(x / M.CS + M.W / 2);
  M.toRow = (z) => Math.floor(z / M.CS + M.H / 2);
  M.cellPos = (cr) => ({ x: M.cellX(cr[0]), z: M.cellZ(cr[1]) });
  M.siteAt = (x, z) => {
    const ch = M.at(M.toCol(x), M.toRow(z));
    return ch === 'a' ? 'A' : ch === 'b' ? 'B' : null;
  };
  M.inTunnel = (x, z) => M.at(M.toCol(x), M.toRow(z)) === '=';

  // Named places used by bot routes, in [col, row].
  M.P = {
    tSpawn: [23, 42], ctSpawn: [23, 2],
    longDoors: [37, 41], longCorner: [42, 41], longMid: [42, 28], longTop: [42, 15], aSite: [39, 6],
    midLower: [24, 34], midMid: [24, 24], midDoorsT: [24, 17], midDoorsCT: [24, 13], catwalk: [30, 11],
    midB: [16, 18], bDoors: [13, 15], bSite: [8, 6],
    tunOuter: [8, 35], tunMid: [3, 27], tunUpper: [3, 17], bTunExit: [3, 13],
    lowerTunMid: [19, 25], lowerTunWest: [6, 25],
    ctToA: [31, 4], ctToB: [16, 4],
  };
  // Attack routes for each site (lists of named places).
  M.routes = {
    A: [
      ['longDoors', 'longCorner', 'longMid', 'longTop', 'aSite'],
      ['longDoors', 'longCorner', 'longMid', 'longTop', 'aSite'],
      ['midLower', 'midMid', 'midDoorsT', 'midDoorsCT', 'catwalk', 'aSite'],
    ],
    B: [
      ['tunOuter', 'tunMid', 'tunUpper', 'bTunExit', 'bSite'],
      ['tunOuter', 'tunMid', 'tunUpper', 'bTunExit', 'bSite'],
      ['midLower', 'midMid', 'midB', 'bDoors', 'bSite'],
      ['midLower', 'midMid', 'lowerTunMid', 'lowerTunWest', 'tunUpper', 'bTunExit', 'bSite'],
    ],
  };
  // Defensive spots: where a defender stands and the doorway they watch.
  M.holds = {
    A: [
      { at: [39, 10], look: [42, 18] },
      { at: [35, 12], look: [27, 11] },
      { at: [45, 7], look: [42, 14] },
      { at: [42, 2], look: [42, 13] },
    ],
    B: [
      { at: [9, 9], look: [13, 15] },
      { at: [6, 4], look: [3, 14] },
      { at: [2, 8], look: [13, 13] },
      { at: [13, 4], look: [3, 13] },
    ],
    mid: [
      { at: [25, 12], look: [23, 16] },
      { at: [31, 11], look: [24, 15] },
      { at: [16, 5], look: [13, 14] },
    ],
  };
  M.plantSpots = {
    A: [[36, 7], [39, 7], [42, 6], [44, 9], [38, 11], [35, 3]],
    B: [[5, 7], [9, 4], [11, 6], [6, 10], [4, 5], [12, 11]],
  };
  M.siteCenter = { A: [39, 7], B: [8, 8] };
  // Where defenders regroup before retaking a planted site.
  M.stage = { A: [27, 1], B: [20, 1] };

  M.boxes = [];
  M.spawns = { T: [], CT: [] };
  M.siteCells = { A: [], B: [] };
  M.wallHeight = [];

  // ---------- Geometry helpers ----------
  function Bucket() { this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.idx = []; }
  Bucket.prototype.quad = function (p, n, uv, col) {
    const b = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.uv.push(uv[i][0], uv[i][1]);
      const c = col ? col[i] : 1;
      this.col.push(c, c, c);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  Bucket.prototype.geometry = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  };

  // Adds an axis-aligned box. o: {ts: texture size in m, face: true for 0..1 UVs per face,
  // ao: darken toward the ground, noBottom, noTop}
  function addBox(B, b, o) {
    o = o || {};
    const ts = o.ts || 4;
    const x0 = b.minX, x1 = b.maxX, y0 = b.minY, y1 = b.maxY, z0 = b.minZ, z1 = b.maxZ;
    const ao = o.ao && y0 < 0.05;
    const splitH = Math.min(1.3, (y1 - y0) * 0.45);
    const ys = ao ? [[y0, y0 + splitH, 0.56, 0.93], [y0 + splitH, y1, 0.93, 1]] : [[y0, y1, o.bot || 1, 1]];
    const side = (n, pts, uFn) => {
      for (const [ya, yb, ca, cb] of ys) {
        const P = pts(ya, yb);
        let uv;
        if (o.face) {
          const va = (ya - y0) / (y1 - y0), vb = (yb - y0) / (y1 - y0);
          uv = [[0, va], [1, va], [1, vb], [0, vb]];
        } else {
          uv = P.map((p) => [uFn(p) / ts, p[1] / ts]);
        }
        B.quad(P, n, uv, [ca, ca, cb, cb]);
      }
    };
    side([1, 0, 0], (ya, yb) => [[x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1]], (p) => -p[2]);
    side([-1, 0, 0], (ya, yb) => [[x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0]], (p) => p[2]);
    side([0, 0, 1], (ya, yb) => [[x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1]], (p) => p[0]);
    side([0, 0, -1], (ya, yb) => [[x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0]], (p) => -p[0]);
    if (!o.noTop) {
      const P = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]];
      const uv = o.face ? [[0, 0], [1, 0], [1, 1], [0, 1]] : P.map((p) => [p[0] / ts, -p[2] / ts]);
      B.quad(P, [0, 1, 0], uv, null);
    }
    if (!o.noBottom) {
      const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
      const uv = o.face ? [[0, 0], [1, 0], [1, 1], [0, 1]] : P.map((p) => [p[0] / ts, p[2] / ts]);
      B.quad(P, [0, -1, 0], uv, [0.7, 0.7, 0.7, 0.7]);
    }
  }
  M.addBox = addBox;
  M.Bucket = Bucket;

  // Greedy merge of cells matching `test` into rectangles {c0, r0, c1, r1} (inclusive).
  function mergeRects(test) {
    const used = [];
    for (let r = 0; r < M.H; r++) used.push(new Array(M.W).fill(false));
    const rects = [];
    for (let r = 0; r < M.H; r++) {
      for (let c = 0; c < M.W; c++) {
        if (used[r][c] || !test(c, r)) continue;
        let w = 1;
        while (c + w < M.W && !used[r][c + w] && test(c + w, r)) w++;
        let h = 1;
        outer: while (r + h < M.H) {
          for (let k = 0; k < w; k++) if (used[r + h][c + k] || !test(c + k, r + h)) break outer;
          h++;
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) used[r + y][c + x] = true;
        rects.push({ c0: c, r0: r, c1: c + w - 1, r1: r + h - 1 });
      }
    }
    return rects;
  }

  function rectBox(rc, y0, y1, inset) {
    inset = inset || 0;
    return {
      minX: (rc.c0 - M.W / 2) * M.CS + inset, maxX: (rc.c1 + 1 - M.W / 2) * M.CS - inset,
      minZ: (rc.r0 - M.H / 2) * M.CS + inset, maxZ: (rc.r1 + 1 - M.H / 2) * M.CS - inset,
      minY: y0, maxY: y1,
    };
  }

  // Floor type for a cell; props sit on whatever floor surrounds them.
  function floorType(c, r) {
    let ch = M.at(c, r);
    if (PROP.indexOf(ch) >= 0) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        const n = M.at(c + dc, r + dr);
        if (WALK.indexOf(n) >= 0) { ch = n; break; }
      }
    }
    if (ch === ',' || ch === 'K') return 'pave';
    if (ch === 'a' || ch === 'b') return 'site';
    if (ch === '=') return 'tunnel';
    if (ch === '#') return null;
    return 'sand';
  }

  // ---------- Build ----------
  M.build = function (scene, tex) {
    const rng = DL.makeRng(2024);
    M.boxes.length = 0;
    const meshes = [];
    for (let r = 0; r < M.H; r++) M.wallHeight.push(new Array(M.W).fill(0));

    // Parse spawns and sites.
    for (let r = 0; r < M.H; r++) {
      for (let c = 0; c < M.W; c++) {
        const ch = M.at(c, r);
        if (ch === 'T') M.spawns.T.push({ x: M.cellX(c), z: M.cellZ(r), yaw: 0 });
        if (ch === 'K') M.spawns.CT.push({ x: M.cellX(c), z: M.cellZ(r), yaw: Math.PI });
        if (ch === 'a') M.siteCells.A.push([c, r]);
        if (ch === 'b') M.siteCells.B.push([c, r]);
      }
    }

    // ----- Walls -----
    const wallRects = mergeRects((c, r) => M.at(c, r) === '#');
    const B = {
      sandstone: new Bucket(), sandstoneDark: new Bucket(), plaster: new Bucket(), plasterWarm: new Bucket(),
      cap: new Bucket(), crate: new Bucket(), beams: new Bucket(), metal: new Bucket(), decor: new Bucket(),
    };
    const wallKinds = ['sandstone', 'sandstone', 'plaster', 'plasterWarm', 'sandstoneDark'];
    for (const rc of wallRects) {
      const edge = rc.c0 === 0 || rc.r0 === 0 || rc.c1 === M.W - 1 || rc.r1 === M.H - 1;
      const cells = (rc.c1 - rc.c0 + 1) * (rc.r1 - rc.r0 + 1);
      let h;
      if (edge) h = 7.5 + Math.floor(rng() * 3) * 0.8;
      else if (cells <= 2) h = 4.2;
      else h = [4.4, 5.0, 5.6, 6.4][Math.floor(rng() * 4)];
      const box = rectBox(rc, 0, h);
      box.kind = 'wall';
      M.boxes.push(box);
      for (let r = rc.r0; r <= rc.r1; r++) for (let c = rc.c0; c <= rc.c1; c++) M.wallHeight[r][c] = h;
      const kind = edge ? (rng() < 0.5 ? 'sandstone' : 'sandstoneDark') : wallKinds[Math.floor(rng() * wallKinds.length)];
      addBox(B[kind], box, { ts: 4, ao: true, noBottom: true });
      if (!edge || h < 8) {
        const o = 0.12;
        addBox(B.cap, { minX: box.minX - o, maxX: box.maxX + o, minZ: box.minZ - o, maxZ: box.maxZ + o, minY: h, maxY: h + 0.28 }, { ts: 2, bot: 0.6 });
      }
    }

    // ----- Arches and tunnel roofs -----
    for (const rc of mergeRects((c, r) => M.at(c, r) === '^')) {
      // Lintel reaches up to the lower of the two walls it bridges.
      let top = 4.2;
      const hs = [];
      for (let r = rc.r0 - 1; r <= rc.r1 + 1; r++) for (let c = rc.c0 - 1; c <= rc.c1 + 1; c++) if (M.at(c, r) === '#') hs.push(M.wallHeight[r] ? M.wallHeight[r][c] : 4.2);
      if (hs.length) top = Math.max(3.6, Math.min.apply(null, hs));
      const box = rectBox(rc, 3.0, top);
      box.kind = 'arch';
      M.boxes.push(box);
      addBox(B.sandstoneDark, box, { ts: 4 });
    }
    for (const rc of mergeRects((c, r) => M.at(c, r) === '=')) {
      const box = rectBox(rc, 3.0, 3.45);
      box.kind = 'roof';
      M.boxes.push(box);
      addBox(B.beams, box, { ts: 3, noTop: false });
    }

    // ----- Crates and palms -----
    const palms = [];
    for (let r = 0; r < M.H; r++) {
      for (let c = 0; c < M.W; c++) {
        const ch = M.at(c, r);
        const cx = M.cellX(c) + (rng() - 0.5) * 0.3, cz = M.cellZ(r) + (rng() - 0.5) * 0.3;
        if (ch === 'c' || ch === 'h' || ch === 'C') {
          const s = ch === 'h' ? 1.6 : 1.6;
          const hgt = ch === 'h' ? 0.8 : 1.6;
          const box = { minX: cx - s / 2, maxX: cx + s / 2, minZ: cz - s / 2, maxZ: cz + s / 2, minY: 0, maxY: hgt, kind: 'crate' };
          M.boxes.push(box);
          addBox(B.crate, box, { face: true, noBottom: true, bot: 0.75 });
          if (ch === 'C') {
            const s2 = 1.2, ox = (rng() - 0.5) * 0.3, oz = (rng() - 0.5) * 0.3;
            const top = { minX: cx + ox - s2 / 2, maxX: cx + ox + s2 / 2, minZ: cz + oz - s2 / 2, maxZ: cz + oz + s2 / 2, minY: hgt, maxY: hgt + s2, kind: 'crate' };
            M.boxes.push(top);
            addBox(B.crate, top, { face: true, noBottom: true, bot: 0.85 });
          }
        } else if (ch === 'P') {
          palms.push({ x: cx, z: cz });
          M.boxes.push({ minX: cx - 0.25, maxX: cx + 0.25, minZ: cz - 0.25, maxZ: cz + 0.25, minY: 0, maxY: 5.5, kind: 'palm' });
        }
      }
    }

    // ----- Windows and doors painted on wall faces -----
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 1; r < M.H - 1; r++) {
      for (let c = 1; c < M.W - 1; c++) {
        if (!M.walkable(c, r) && PROP.indexOf(M.at(c, r)) < 0) continue;
        for (const [dc, dr] of dirs) {
          if (M.at(c + dc, r + dr) !== '#') continue;
          const wh = M.wallHeight[r + dr][c + dc];
          const roll = rng();
          let kind = null;
          if (roll < 0.05 && wh >= 5) kind = 'window';
          else if (roll > 0.975 && M.at(c, r) !== '=') kind = 'door';
          if (!kind) continue;
          addWallDecal(B.decor, c, r, dc, dr, kind);
        }
      }
    }

    // ----- Floors -----
    const ground = { sand: new Bucket(), pave: new Bucket(), site: new Bucket(), tunnel: new Bucket() };
    const blockers = M.boxes.filter((b) => b.minY < 0.5);
    const aoAt = (x, z) => {
      let d = 9;
      for (const b of blockers) {
        if (x < b.minX - 2 || x > b.maxX + 2 || z < b.minZ - 2 || z > b.maxZ + 2) continue;
        const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
        const dd = Math.hypot(dx, dz);
        if (dd < d) d = dd;
      }
      let a = 0.52 + 0.48 * DL.smoothstep(0, 1.4, d);
      const col = M.toCol(x + (x === Math.round(x) ? -0.01 : 0)), row = M.toRow(z);
      if (M.at(col, row) === '=' || M.at(M.toCol(x + 0.01), M.toRow(z + 0.01)) === '=') a *= 0.55;
      return a;
    };
    for (const type of ['sand', 'pave', 'site', 'tunnel']) {
      const rects = mergeRects((c, r) => floorType(c, r) === type);
      const ts = type === 'sand' ? 5 : 4;
      for (const rc of rects) {
        const bx = rectBox(rc, 0, 0);
        const nx = Math.round(bx.maxX - bx.minX), nz = Math.round(bx.maxZ - bx.minZ);
        for (let iz = 0; iz < nz; iz++) {
          for (let ix = 0; ix < nx; ix++) {
            const xa = bx.minX + ix, xb = xa + 1, za = bx.minZ + iz, zb = za + 1;
            const P = [[xa, 0, zb], [xb, 0, zb], [xb, 0, za], [xa, 0, za]];
            ground[type].quad(P, [0, 1, 0], P.map((p) => [p[0] / ts, -p[2] / ts]), P.map((p) => aoAt(p[0], p[2])));
          }
        }
      }
    }

    // ----- Materials and meshes -----
    const lam = (map, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: map, vertexColors: true }, extra || {}));
    const mats = {
      sandstone: lam(tex.sandstone), sandstoneDark: lam(tex.sandstoneDark), plaster: lam(tex.plaster), plasterWarm: lam(tex.plasterWarm),
      cap: lam(tex.cap), crate: lam(tex.crate), beams: lam(tex.beams), metal: lam(tex.metal),
      decor: lam(M.decorTexture()),
      sand: lam(tex.sand), pave: lam(tex.pave), site: lam(tex.site), tunnel: lam(tex.tunnel),
    };
    M.materials = mats;
    const addMesh = (bucket, mat, cast, receive) => {
      if (!bucket.pos.length) return;
      const m = new THREE.Mesh(bucket.geometry(), mat);
      m.castShadow = cast; m.receiveShadow = receive;
      m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); meshes.push(m);
    };
    for (const k of ['sandstone', 'sandstoneDark', 'plaster', 'plasterWarm', 'cap', 'crate', 'beams', 'metal']) addMesh(B[k], mats[k], true, true);
    addMesh(B.decor, mats.decor, false, true);
    for (const k of ['sand', 'pave', 'site', 'tunnel']) addMesh(ground[k], mats[k], false, true);

    // Bombsite letters on the floor and walls.
    const letter = (t, c, r, size, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = rot || 0;
      m.position.set(M.cellX(c), 0.02, M.cellZ(r));
      m.receiveShadow = true;
      scene.add(m);
    };
    letter(tex.letterA, 39, 7, 5, 0.1);
    letter(tex.letterB, 7, 9, 5, -0.15);
    const wallLetter = (t, x, y, z, ry, size) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(x, y, z); m.rotation.y = ry;
      m.receiveShadow = true;
      scene.add(m);
    };
    wallLetter(tex.letterA, M.cellX(40), 3.0, (1 - M.H / 2) * M.CS + 0.03, 0, 3.4);          // north wall of A
    wallLetter(tex.letterB, (1 - M.W / 2) * M.CS + 0.03, 3.0, M.cellZ(6), Math.PI / 2, 3.4); // west wall of B
    wallLetter(tex.letterA, (41 - M.W / 2) * M.CS + 0.03, 2.4, M.cellZ(26), Math.PI / 2, 2.2);  // long A, west wall
    wallLetter(tex.letterB, M.cellX(9), 2.2, (32 - M.H / 2) * M.CS + 0.03, 0, 2.0);             // outside tunnels, north wall
    wallLetter(tex.letterA, (26 - M.W / 2) * M.CS - 0.03, 2.3, M.cellZ(14), -Math.PI / 2, 1.6); // upper mid, toward catwalk

    // Palms
    const barkMat = new THREE.MeshLambertMaterial({ map: tex.bark });
    const frondMat = new THREE.MeshLambertMaterial({ map: tex.frond, side: THREE.DoubleSide, alphaTest: 0.5 });
    for (const p of palms) buildPalm(scene, p.x, p.z, barkMat, frondMat, rng);

    buildSkyline(scene, mats, rng, tex);
    M.meshes = meshes;
    // Face each spawn point toward its most open direction, so nobody starts staring at a wall.
    for (const team of ['T', 'CT']) {
      for (const sp of M.spawns[team]) {
        let best = sp.yaw, bestD = -1;
        for (let i = 0; i < 16; i++) {
          const yaw = sp.yaw + (i / 16) * Math.PI * 2;
          const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
          // Prefer the team's natural heading a little.
          const d = DL.phys.raycast(sp.x, 1.6, sp.z, dx, 0, dz, 60) * (1 - 0.25 * (1 - Math.cos(yaw - sp.yaw)) / 2);
          if (d > bestD) { bestD = d; best = yaw; }
        }
        sp.yaw = DL.wrapAngle(best);
      }
    }
  };

  // Paints a window or door on the wall face between floor cell (c,r) and wall cell (c+dc, r+dr).
  function addWallDecal(B, c, r, dc, dr, kind) {
    const cx = M.cellX(c), cz = M.cellZ(r);
    const fx = cx + dc * (M.CS / 2 - 0.025), fz = cz + dr * (M.CS / 2 - 0.025);
    const w = kind === 'window' ? 0.9 : 1.15, h = kind === 'window' ? 1.25 : 2.1;
    const y0 = kind === 'window' ? 3.0 : 0, y1 = y0 + h;
    // Tangent pointing to the right when facing the wall from the floor cell.
    const tx = -dr, tz = dc;
    const u0 = kind === 'window' ? 0 : 0.5, u1 = u0 + 0.5;
    const P = [
      [fx - tx * w / 2, y0, fz - tz * w / 2], [fx + tx * w / 2, y0, fz + tz * w / 2],
      [fx + tx * w / 2, y1, fz + tz * w / 2], [fx - tx * w / 2, y1, fz - tz * w / 2],
    ];
    // Face normal points back toward the floor cell; reverse order if needed so it faces out.
    const n = [-dc, 0, -dr];
    const e1 = [P[1][0] - P[0][0], 0, P[1][2] - P[0][2]];
    const cross = [-(e1[2]) * 1, 0, e1[0] * 1]; // (e1 x up) sign check
    const facing = cross[0] * n[0] + cross[2] * n[2];
    const uv = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
    if (facing < 0) B.quad([P[1], P[0], P[3], P[2]], n, [uv[1], uv[0], uv[3], uv[2]], [0.85, 0.85, 1, 1]);
    else B.quad(P, n, uv, [0.85, 0.85, 1, 1]);
  }

  M.decorTexture = function () {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    // window (left half)
    g.fillStyle = '#5b4026'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#1a1714'; g.fillRect(22, 22, 212, 212);
    g.fillStyle = '#2b2620';
    for (let i = 0; i < 4; i++) g.fillRect(22 + i * 56, 22, 8, 212);
    g.fillStyle = '#6e4e2e'; g.fillRect(0, 230, 256, 26);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(22, 22, 212, 30);
    // door (right half)
    g.fillStyle = '#4a3420'; g.fillRect(256, 0, 256, 256);
    g.fillStyle = '#3d6f8a'; g.fillRect(272, 10, 224, 246);
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(272 + i * 32, 10, 3, 246); }
    g.fillStyle = 'rgba(160,90,40,0.5)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(272 + Math.random() * 224, 10 + Math.random() * 246, 2 + Math.random() * 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c9a24c'; g.fillRect(470, 130, 10, 18);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = DL.tex.maxAniso || 4;
    return t;
  };

  function buildPalm(scene, x, z, barkMat, frondMat, rng) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const segs = 7, lean = (rng() - 0.5) * 0.5, leanDir = rng() * Math.PI * 2;
    let px = 0, py = 0, pz = 0;
    const height = 6 + rng() * 1.5;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const rad0 = 0.24 - t * 0.08, rad1 = 0.24 - (t + 1 / segs) * 0.08;
      const segH = height / segs;
      const geo = new THREE.CylinderGeometry(rad1, rad0, segH, 8, 1);
      const m = new THREE.Mesh(geo, barkMat);
      const off = Math.pow(t, 2) * lean * 3;
      m.position.set(px + Math.cos(leanDir) * off, py + segH / 2, pz + Math.sin(leanDir) * off);
      m.castShadow = true;
      g.add(m);
      py += segH;
    }
    const topOff = lean * 3;
    const top = new THREE.Vector3(Math.cos(leanDir) * topOff, py, Math.sin(leanDir) * topOff);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.3;
      const len = 3 + rng() * 1;
      const geo = new THREE.PlaneGeometry(1.4, len, 1, 4);
      // Bend the frond downwards along its length.
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const yy = pos.getY(k) + len / 2;
        pos.setY(k, yy);
        pos.setZ(k, -Math.pow(yy / len, 2) * 1.6);
      }
      geo.computeVertexNormals();
      const f = new THREE.Mesh(geo, frondMat);
      f.position.copy(top);
      f.rotation.order = 'YXZ';
      f.rotation.y = a;
      f.rotation.x = -1.2 + rng() * 0.4;
      f.castShadow = true;
      g.add(f);
    }
    scene.add(g);
  }

  function buildSkyline(scene, mats, rng, tex) {
    const B = { a: new Bucket(), b: new Bucket(), c: new Bucket() };
    const half = (M.W / 2) * M.CS;
    for (let gx = -130; gx <= 130; gx += 9) {
      for (let gz = -130; gz <= 130; gz += 9) {
        const m = Math.max(Math.abs(gx), Math.abs(gz));
        if (m < half + 6 || m > 125 || rng() < 0.35) continue;
        const w = 5 + rng() * 5, d = 5 + rng() * 5, h = 6 + rng() * 10 + (m < half + 20 ? 0 : 4);
        const box = { minX: gx - w / 2, maxX: gx + w / 2, minZ: gz - d / 2, maxZ: gz + d / 2, minY: 0, maxY: h };
        addBox(B[['a', 'b', 'c'][Math.floor(rng() * 3)]], box, { ts: 4, noBottom: true, ao: true });
      }
    }
    const list = [[B.a, mats.sandstone], [B.b, mats.plaster], [B.c, mats.sandstoneDark]];
    for (const [b, mat] of list) {
      const mesh = new THREE.Mesh(b.geometry(), mat);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    // Domes and minarets for the silhouette.
    const domeMat = new THREE.MeshLambertMaterial({ color: 0xe9e2d0 });
    const blueDome = new THREE.MeshLambertMaterial({ color: 0x3f6f8f });
    const towerMat = new THREE.MeshLambertMaterial({ map: tex.plaster }); // primitives carry no vertex colors
    const towers = [[-70, -60, 26, blueDome], [78, 40, 22, domeMat], [20, -88, 18, domeMat], [-84, 52, 20, blueDome]];
    for (const [x, z, h, mat] of towers) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, h * 0.5, 16), towerMat);
      base.position.set(x, h * 0.25, z); scene.add(base);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      dome.position.set(x, h * 0.5, z); scene.add(dome);
      const min = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, h * 1.3, 10), towerMat);
      min.position.set(x + 7, h * 0.65, z + 3); scene.add(min);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.5, 10), mat);
      cap.position.set(x + 7, h * 1.3 + 1.25, z + 3); scene.add(cap);
    }
    // Distant ground.
    const gg = new THREE.PlaneGeometry(700, 700);
    const uv = gg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 140, uv.getY(i) * 140);
    const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ map: tex.sand }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    scene.add(ground);
  }
})(window.DL);
