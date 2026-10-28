/* Dustline - models.js: low-poly soldiers and weapons built from primitives.
 * Weapons are described once as part lists; the first-person view builds them from
 * separate shiny parts, and the third-person world model merges them into one mesh. */
'use strict';
(function (DL) {
  const MD = (DL.models = {});

  const COLORS = {
    steel: 0x2e3135, steel2: 0x4a4e54, black: 0x1c1d1f, wood: 0x7a4a26, woodDark: 0x56341b,
    olive: 0x56633f, chrome: 0xb9bec4, orange: 0x8c4a1f, green: 0x4d5e34, tan: 0xa38f62,
    screen: 0x7fd06a, red: 0xa52a22, blue: 0x2a4ea5, rubber: 0x151515, brass: 0xc9a23e,
  };

  // Part: [shape, dims, pos, rot, material, group]
  //   box: dims [w, h, d]; cyl: [radius, length] along Z; sph: [radius, scaleY]
  const GUNS = {
    ak: {
      muzzle: [0, 0.045, -0.8], lh: [0, -0.005, -0.37], rh: [0, -0.05, 0.06],
      parts: [
        ['box', [0.055, 0.075, 0.38], [0, 0.035, -0.08], 0, 'steel'],
        ['box', [0.05, 0.03, 0.3], [0, 0.085, -0.06], 0, 'steel2'],
        ['box', [0.04, 0.025, 0.04], [0, 0.093, -0.24], 0, 'steel'],
        ['box', [0.065, 0.055, 0.21], [0, 0.03, -0.37], 0, 'wood'],
        ['box', [0.05, 0.03, 0.16], [0, 0.085, -0.36], 0, 'wood'],
        ['cyl', [0.011, 0.1], [0, 0.085, -0.49], 0, 'steel'],
        ['cyl', [0.011, 0.32], [0, 0.045, -0.6], 0, 'steel'],
        ['box', [0.012, 0.055, 0.025], [0, 0.085, -0.69], 0, 'steel'],
        ['cyl', [0.016, 0.05], [0, 0.045, -0.76], 0, 'steel2'],
        ['box', [0.045, 0.13, 0.075], [0, -0.075, -0.14], [0.15, 0, 0], 'orange', 'mag'],
        ['box', [0.045, 0.12, 0.07], [0, -0.18, -0.105], [0.45, 0, 0], 'orange', 'mag'],
        ['box', [0.04, 0.11, 0.05], [0, -0.055, 0.06], [-0.3, 0, 0], 'woodDark'],
        ['box', [0.012, 0.012, 0.07], [0, -0.02, 0], 0, 'steel'],
        ['box', [0.05, 0.08, 0.28], [0, 0, 0.25], [0.12, 0, 0], 'wood'],
        ['box', [0.055, 0.11, 0.015], [0, -0.025, 0.39], [0.12, 0, 0], 'steel'],
      ],
    },
    m4: {
      muzzle: [0, 0.07, -0.75], lh: [0, 0.03, -0.36], rh: [0, -0.05, 0.07],
      parts: [
        ['box', [0.05, 0.06, 0.24], [0, 0.02, -0.04], 0, 'black'],
        ['box', [0.055, 0.05, 0.3], [0, 0.075, -0.07], 0, 'steel'],
        ['box', [0.025, 0.012, 0.3], [0, 0.106, -0.07], 0, 'steel2'],
        ['box', [0.03, 0.04, 0.03], [0, 0.13, 0.05], 0, 'black'],
        ['box', [0.012, 0.06, 0.02], [0, 0.12, -0.53], 0, 'black'],
        ['box', [0.065, 0.065, 0.26], [0, 0.07, -0.36], 0, 'black'],
        ['box', [0.07, 0.012, 0.24], [0, 0.105, -0.36], 0, 'steel2'],
        ['cyl', [0.01, 0.2], [0, 0.07, -0.58], 0, 'steel'],
        ['cyl', [0.014, 0.06], [0, 0.07, -0.71], 0, 'steel2'],
        ['box', [0.04, 0.17, 0.07], [0, -0.085, -0.12], [0.12, 0, 0], 'steel', 'mag'],
        ['box', [0.035, 0.1, 0.045], [0, -0.05, 0.07], [-0.35, 0, 0], 'black'],
        ['cyl', [0.017, 0.16], [0, 0.07, 0.17], 0, 'steel'],
        ['box', [0.045, 0.1, 0.16], [0, 0.04, 0.28], 0, 'black'],
      ],
    },
    mp5: {
      muzzle: [0, 0.045, -0.47], lh: [0, -0.005, -0.28], rh: [0, -0.05, 0.04],
      parts: [
        ['box', [0.05, 0.07, 0.3], [0, 0.04, -0.08], 0, 'black'],
        ['box', [0.058, 0.06, 0.14], [0, 0.03, -0.29], 0, 'rubber'],
        ['cyl', [0.011, 0.1], [0, 0.045, -0.41], 0, 'steel'],
        ['box', [0.03, 0.05, 0.02], [0, 0.09, -0.36], 0, 'black'],
        ['box', [0.035, 0.03, 0.04], [0, 0.09, 0.02], 0, 'black'],
        ['box', [0.03, 0.15, 0.05], [0, -0.09, -0.15], [0.3, 0, 0], 'steel', 'mag'],
        ['box', [0.035, 0.1, 0.045], [0, -0.05, 0.04], [-0.3, 0, 0], 'black'],
        ['box', [0.01, 0.01, 0.2], [0.02, 0.05, 0.16], 0, 'steel'],
        ['box', [0.01, 0.01, 0.2], [-0.02, 0.05, 0.16], 0, 'steel'],
        ['box', [0.05, 0.09, 0.02], [0, 0.03, 0.26], 0, 'black'],
      ],
    },
    awp: {
      muzzle: [0, 0.05, -0.95], lh: [0, -0.01, -0.3], rh: [0, -0.05, 0.08],
      parts: [
        ['box', [0.065, 0.085, 0.6], [0, 0.02, -0.02], 0, 'olive'],
        ['box', [0.045, 0.045, 0.22], [0, 0.075, -0.05], 0, 'steel'],
        ['cyl', [0.013, 0.56], [0, 0.05, -0.6], 0, 'steel'],
        ['cyl', [0.02, 0.07], [0, 0.05, -0.9], 0, 'steel2'],
        ['cyl', [0.022, 0.3], [0, 0.14, -0.08], 0, 'black'],
        ['cyl', [0.032, 0.08], [0, 0.14, -0.26], 0, 'black'],
        ['cyl', [0.028, 0.06], [0, 0.14, 0.09], 0, 'black'],
        ['box', [0.02, 0.04, 0.02], [0, 0.11, -0.15], 0, 'steel'],
        ['box', [0.02, 0.04, 0.02], [0, 0.11, 0.0], 0, 'steel'],
        ['box', [0.06, 0.012, 0.012], [0.04, 0.07, 0.03], 0, 'steel2'],
        ['sph', [0.014, 1], [0.075, 0.07, 0.03], 0, 'steel2'],
        ['box', [0.04, 0.06, 0.08], [0, -0.04, -0.1], 0, 'steel', 'mag'],
        ['box', [0.045, 0.1, 0.05], [0, -0.05, 0.08], [-0.3, 0, 0], 'olive'],
        ['box', [0.05, 0.12, 0.3], [0, 0, 0.33], 0, 'olive'],
        ['box', [0.045, 0.03, 0.18], [0, 0.075, 0.33], 0, 'olive'],
        ['box', [0.055, 0.13, 0.025], [0, -0.01, 0.49], 0, 'rubber'],
      ],
    },
    glock: {
      muzzle: [0, 0.05, -0.155], lh: [-0.012, -0.05, 0.0], rh: [0, -0.04, 0.02],
      parts: [
        ['box', [0.03, 0.035, 0.19], [0, 0.05, -0.05], 0, 'steel2'],
        ['box', [0.028, 0.025, 0.16], [0, 0.02, -0.04], 0, 'black'],
        ['box', [0.03, 0.1, 0.045], [0, -0.04, 0.02], [-0.22, 0, 0], 'black'],
        ['box', [0.008, 0.01, 0.04], [0, -0.005, -0.04], 0, 'black'],
        ['box', [0.032, 0.012, 0.05], [0, -0.095, 0.035], [-0.22, 0, 0], 'black', 'mag'],
      ],
    },
    p2k: {
      muzzle: [0, 0.05, -0.165], lh: [-0.012, -0.05, 0.0], rh: [0, -0.04, 0.02],
      parts: [
        ['box', [0.031, 0.038, 0.2], [0, 0.05, -0.055], 0, 'black'],
        ['box', [0.029, 0.026, 0.17], [0, 0.02, -0.045], 0, 'steel'],
        ['box', [0.031, 0.1, 0.046], [0, -0.04, 0.02], [-0.24, 0, 0], 'rubber'],
        ['box', [0.008, 0.01, 0.04], [0, -0.005, -0.045], 0, 'black'],
        ['box', [0.033, 0.012, 0.05], [0, -0.095, 0.035], [-0.24, 0, 0], 'steel', 'mag'],
      ],
    },
    deagle: {
      muzzle: [0, 0.065, -0.21], lh: [-0.012, -0.05, 0.0], rh: [0, -0.045, 0.03],
      parts: [
        ['box', [0.036, 0.05, 0.26], [0, 0.06, -0.07], 0, 'chrome'],
        ['box', [0.014, 0.012, 0.24], [0, 0.091, -0.07], 0, 'steel2'],
        ['box', [0.033, 0.03, 0.2], [0, 0.022, -0.06], 0, 'steel2'],
        ['box', [0.035, 0.11, 0.05], [0, -0.045, 0.03], [-0.2, 0, 0], 'rubber'],
        ['box', [0.008, 0.012, 0.045], [0, 0.0, -0.05], 0, 'steel'],
        ['box', [0.036, 0.012, 0.052], [0, -0.1, 0.042], [-0.2, 0, 0], 'steel', 'mag'],
      ],
    },
    knife: {
      muzzle: [0, 0, -0.2], lh: [-0.1, -0.2, 0.1], rh: [0, -0.005, 0.02],
      parts: [
        ['box', [0.026, 0.032, 0.11], [0, 0, 0.03], 0, 'rubber'],
        ['box', [0.04, 0.014, 0.012], [0, 0.004, -0.03], 0, 'steel2'],
        ['blade', [], [0, -0.01, -0.035], 0, 'chrome'],
      ],
    },
    he: {
      muzzle: [0, 0, 0], lh: [-0.1, -0.2, 0.1], rh: [0, -0.03, 0.01],
      parts: [
        ['sph', [0.034, 1.2], [0, 0, 0], 0, 'green'],
        ['cyl', [0.012, 0.025], [0, 0.045, 0], [Math.PI / 2, 0, 0], 'steel2'],
        ['box', [0.008, 0.06, 0.012], [0.022, 0.02, 0], [0, 0, -0.2], 'steel2'],
        ['box', [0.03, 0.004, 0.004], [-0.018, 0.06, 0], 0, 'steel'],
      ],
    },
    c4: {
      muzzle: [0, 0, 0], lh: [-0.06, -0.01, 0.02], rh: [0.06, -0.01, 0.04],
      parts: [
        ['box', [0.11, 0.05, 0.17], [0, 0, 0], 0, 'tan'],
        ['box', [0.065, 0.006, 0.04], [0, 0.028, -0.045], 0, 'screen'],
        ['box', [0.065, 0.006, 0.05], [0, 0.028, 0.03], 0, 'black'],
        ['cyl', [0.004, 0.17], [0.05, 0.02, 0], 0, 'red'],
        ['cyl', [0.004, 0.17], [0.043, 0.02, 0], 0, 'blue'],
        ['box', [0.115, 0.03, 0.012], [0, 0, -0.06], 0, 'black'],
        ['box', [0.115, 0.03, 0.012], [0, 0, 0.06], 0, 'black'],
      ],
    },
  };
  MD.GUNS = GUNS;

  const geoCache = {};
  function partGeometry(p) {
    const key = p[0] + ':' + p[1].join(',');
    if (geoCache[key]) return geoCache[key];
    let g;
    if (p[0] === 'box') g = new THREE.BoxGeometry(p[1][0], p[1][1], p[1][2]);
    else if (p[0] === 'cyl') { g = new THREE.CylinderGeometry(p[1][0], p[1][0], p[1][1], 10); g.rotateX(Math.PI / 2); }
    else if (p[0] === 'sph') { g = new THREE.SphereGeometry(p[1][0], 12, 8); g.scale(1, p[1][1], 1); }
    else if (p[0] === 'blade') {
      const s = new THREE.Shape();
      s.moveTo(0, -0.012); s.lineTo(0.15, -0.008); s.quadraticCurveTo(0.19, 0.0, 0.2, 0.014);
      s.lineTo(0.12, 0.02); s.lineTo(0, 0.02); s.lineTo(0, -0.012);
      g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
      g.translate(0, 0, -0.002);
      g.rotateY(Math.PI / 2);
    }
    geoCache[key] = g;
    return g;
  }

  function partMatrix(p) {
    const m = new THREE.Matrix4();
    const rot = p[3] || [0, 0, 0];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    m.compose(new THREE.Vector3(p[2][0], p[2][1], p[2][2]), q, new THREE.Vector3(1, 1, 1));
    return m;
  }

  // Merges geometries into one non-indexed geometry with vertex colors.
  function Merger() { this.pos = []; this.nrm = []; this.col = []; }
  Merger.prototype.add = function (geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const c = new THREE.Color(color); // ColorManagement converts the sRGB hex to linear
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(matrix);
      nn.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.nrm.push(nn.x, nn.y, nn.z);
      this.col.push(c.r, c.g, c.b);
    }
  };
  Merger.prototype.box = function (w, h, d, x, y, z, rx, ry, rz, color) {
    const key = 'box:' + w + ',' + h + ',' + d;
    if (!geoCache[key]) geoCache[key] = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(1, 1, 1));
    this.add(geoCache[key], m, color);
  };
  // A box stretched between two points, used for arms.
  Merger.prototype.segment = function (a, b, thick, color) {
    const va = new THREE.Vector3().fromArray(a), vb = new THREE.Vector3().fromArray(b);
    const len = va.distanceTo(vb);
    const key = 'seg:' + thick + ',' + len.toFixed(3);
    if (!geoCache[key]) geoCache[key] = new THREE.BoxGeometry(thick, thick, len);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vb.clone().sub(va).normalize());
    this.add(geoCache[key], new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), color);
  };
  Merger.prototype.geometry = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  MD.Merger = Merger;

  const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  MD.worldMat = worldMat;
  const worldGunGeo = {};
  // Merged third-person weapon mesh (shared geometry per weapon type).
  MD.worldGun = function (id) {
    const def = GUNS[id];
    if (!def) return new THREE.Group();
    if (!worldGunGeo[id]) {
      const mg = new Merger();
      for (const p of def.parts) mg.add(partGeometry(p), partMatrix(p), COLORS[p[4]]);
      worldGunGeo[id] = mg.geometry();
    }
    const m = new THREE.Mesh(worldGunGeo[id], worldMat);
    m.castShadow = true;
    return m;
  };

  // First-person weapon with separate shiny parts. Returns {group, mag, muzzle, lh, rh}.
  let vmMats = null;
  function vmMaterials() {
    if (vmMats) return vmMats;
    vmMats = {};
    for (const k in COLORS) {
      const shiny = k === 'chrome' ? 90 : k === 'wood' || k === 'woodDark' || k === 'rubber' ? 8 : 35;
      const spec = k === 'chrome' ? 0x9a9a9a : k === 'wood' || k === 'woodDark' ? 0x1a1208 : 0x3a3a3a;
      vmMats[k] = new THREE.MeshPhongMaterial({ color: COLORS[k], shininess: shiny, specular: spec, emissive: k === 'screen' ? 0x2f6a24 : 0x000000 });
    }
    return vmMats;
  }
  MD.vmGun = function (id) {
    const def = GUNS[id];
    const mats = vmMaterials();
    const group = new THREE.Group();
    const mag = new THREE.Group();
    group.add(mag);
    for (const p of def.parts) {
      const mesh = new THREE.Mesh(partGeometry(p), mats[p[4]]);
      const rot = p[3] || [0, 0, 0];
      mesh.position.set(p[2][0], p[2][1], p[2][2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      (p[5] === 'mag' ? mag : group).add(mesh);
    }
    return { group, mag, muzzle: new THREE.Vector3().fromArray(def.muzzle), lh: new THREE.Vector3().fromArray(def.lh), rh: new THREE.Vector3().fromArray(def.rh) };
  };

  // ---------- Soldiers ----------
  const PALETTE = {
    T: { jacket: 0x6b5238, pants: 0x4a4f5a, boots: 0x2a2420, vest: 0x5d5440, head: 0x22201e, skin: 0xc69a76, gloves: 0x2a2622, accent: 0x8a2a1e },
    CT: { jacket: 0x3a4b63, pants: 0x3d4a5e, boots: 0x1f2226, vest: 0x2c3540, head: 0xd2a283, skin: 0xd2a283, gloves: 0x1e1f22, accent: 0x2b3440 },
  };
  const bodyGeo = {};

  function buildBodyGeometry(team) {
    if (bodyGeo[team]) return bodyGeo[team];
    const C = PALETTE[team];
    // Leg (pivot at hip)
    const leg = new Merger();
    leg.box(0.17, 0.5, 0.21, 0, -0.25, 0, 0, 0, 0, C.pants);
    leg.box(0.15, 0.42, 0.18, 0, -0.68, 0.0, 0, 0, 0, C.pants);
    leg.box(0.17, 0.12, 0.27, 0, -0.88, -0.035, 0, 0, 0, C.boots);
    if (team === 'CT') leg.box(0.18, 0.12, 0.06, 0, -0.5, -0.11, 0, 0, 0, C.vest); // knee pad
    // Upper body (pivot at waist), facing -Z, holding a weapon at the right side.
    const up = new Merger();
    up.box(0.44, 0.58, 0.25, 0, 0.29, 0, 0, 0, 0, C.jacket);
    up.box(0.47, 0.06, 0.28, 0, 0.02, 0, 0, 0, 0, 0x2b2522);
    if (team === 'CT') {
      up.box(0.47, 0.4, 0.3, 0, 0.32, 0, 0, 0, 0, C.vest);
      up.box(0.12, 0.1, 0.05, -0.1, 0.24, -0.16, 0, 0, 0, C.accent);
      up.box(0.12, 0.1, 0.05, 0.1, 0.24, -0.16, 0, 0, 0, C.accent);
    } else {
      up.box(0.45, 0.22, 0.29, 0, 0.2, 0, 0, 0, 0, C.vest);
      up.box(0.08, 0.12, 0.06, -0.12, 0.2, -0.16, 0, 0, 0, 0x4a4232);
      up.box(0.08, 0.12, 0.06, 0.0, 0.2, -0.16, 0, 0, 0, 0x4a4232);
      up.box(0.08, 0.12, 0.06, 0.12, 0.2, -0.16, 0, 0, 0, 0x4a4232);
      up.box(0.08, 0.6, 0.03, 0.12, 0.33, -0.13, 0, 0, -0.55, C.accent); // strap
    }
    // Neck and head
    up.box(0.12, 0.08, 0.12, 0, 0.6, 0, 0, 0, 0, C.skin);
    up.box(0.22, 0.25, 0.24, 0, 0.72, 0, 0, 0, 0, C.head);
    if (team === 'T') {
      up.box(0.2, 0.05, 0.02, 0, 0.74, -0.121, 0, 0, 0, C.skin);
      up.box(0.05, 0.02, 0.01, -0.05, 0.74, -0.132, 0, 0, 0, 0x111111);
      up.box(0.05, 0.02, 0.01, 0.05, 0.74, -0.132, 0, 0, 0, 0x111111);
    } else {
      up.box(0.27, 0.13, 0.29, 0, 0.84, 0.0, 0, 0, 0, C.accent);
      up.box(0.27, 0.03, 0.06, 0, 0.78, -0.155, 0, 0, 0, C.accent);
      up.box(0.2, 0.05, 0.03, 0, 0.74, -0.128, 0, 0, 0, 0x101214);
      up.box(0.18, 0.06, 0.01, 0, 0.66, -0.122, 0, 0, 0, 0xb68b6c);
    }
    // Arms holding the weapon (weapon grip at ~[0.1, 0.33, -0.3]).
    const shR = [0.26, 0.5, 0], elR = [0.3, 0.3, -0.12], hR = [0.1, 0.32, -0.3];
    const shL = [-0.26, 0.5, 0], elL = [-0.22, 0.32, -0.32], hL = [0.06, 0.37, -0.62];
    up.segment(shR, elR, 0.12, C.jacket);
    up.segment(elR, hR, 0.1, C.jacket);
    up.segment(shL, elL, 0.12, C.jacket);
    up.segment(elL, hL, 0.1, C.jacket);
    up.box(0.08, 0.09, 0.1, hR[0], hR[1], hR[2], 0, 0, 0, C.gloves);
    up.box(0.08, 0.09, 0.1, hL[0], hL[1], hL[2], 0, 0, 0, C.gloves);
    up.box(0.14, 0.14, 0.18, 0.27, 0.48, 0, 0, 0, 0, C.jacket);
    up.box(0.14, 0.14, 0.18, -0.27, 0.48, 0, 0, 0, 0, C.jacket);
    bodyGeo[team] = { leg: leg.geometry(), up: up.geometry() };
    return bodyGeo[team];
  }

  // Bomb on a T's back.
  let backpackGeo = null;
  function backpack() {
    if (!backpackGeo) {
      const m = new Merger();
      m.box(0.3, 0.32, 0.12, 0, 0.32, 0.17, 0, 0, 0, 0x3d3a2c);
      m.box(0.2, 0.14, 0.05, 0, 0.36, 0.25, 0, 0, 0, COLORS.tan);
      m.box(0.08, 0.03, 0.01, 0, 0.4, 0.276, 0, 0, 0, COLORS.screen);
      backpackGeo = m.geometry();
    }
    return new THREE.Mesh(backpackGeo, worldMat);
  }

  MD.soldier = function (team) {
    const G = buildBodyGeometry(team);
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    root.add(hips);
    const legL = new THREE.Mesh(G.leg, worldMat), legR = new THREE.Mesh(G.leg, worldMat);
    legL.position.x = -0.11; legR.position.x = 0.11;
    hips.add(legL, legR);
    const upper = new THREE.Group();
    hips.add(upper);
    const torso = new THREE.Mesh(G.up, worldMat);
    upper.add(torso);
    const gunHolder = new THREE.Group();
    gunHolder.position.set(0.1, 0.37, -0.27);
    upper.add(gunHolder);
    const pack = backpack();
    pack.visible = false;
    upper.add(pack);
    for (const m of [legL, legR, torso, pack]) { m.castShadow = true; m.receiveShadow = false; }

    const model = {
      root, hips, upper, legL, legR, gunHolder, pack, gunId: null, gun: null,
      phase: Math.random() * 6, deathT: -1, deathDir: 1, deathAxis: 'x',
      setWeapon(id) {
        if (id === this.gunId) return;
        if (this.gun) this.gunHolder.remove(this.gun);
        this.gunId = id;
        this.gun = id ? MD.worldGun(id) : null;
        if (this.gun) {
          this.gunHolder.add(this.gun);
          // Knife and grenade are held lower and pointed forward.
          const small = id === 'knife' || id === 'he' || id === 'c4';
          this.gun.position.set(0, small ? -0.05 : 0, small ? 0.05 : 0);
        }
      },
      setShadows(on) {
        root.traverse((o) => { if (o.isMesh) o.castShadow = on; });
      },
      animate(dt, s) {
        if (this.deathT >= 0) {
          this.deathT = Math.min(1, this.deathT + dt * 2.4);
          const e = 1 - Math.pow(1 - this.deathT, 3);
          const ang = (Math.PI / 2) * e * this.deathDir;
          if (this.deathAxis === 'x') this.root.rotation.x = ang; else this.root.rotation.z = ang;
          this.hips.position.y = 0.95 - 0.1 * e;
          this.legL.rotation.x = DL.damp(this.legL.rotation.x, 0.3, 8, dt);
          this.legR.rotation.x = DL.damp(this.legR.rotation.x, -0.2, 8, dt);
          this.upper.rotation.x = DL.damp(this.upper.rotation.x, 0, 8, dt);
          return;
        }
        const sp = Math.min(1, s.speed / 5);
        this.phase += dt * (3 + s.speed * 1.9) * (s.speed > 0.3 ? 1 : 0);
        const sw = Math.sin(this.phase) * 0.6 * sp;
        const crouch = s.crouch || 0;
        this.hips.position.y = 0.95 - 0.36 * crouch + Math.abs(Math.cos(this.phase)) * 0.03 * sp;
        this.legL.rotation.x = sw * (1 - crouch * 0.5) + crouch * -0.95;
        this.legR.rotation.x = -sw * (1 - crouch * 0.5) + crouch * -0.6;
        this.legL.position.z = crouch * 0.1;
        this.upper.rotation.x = DL.clamp(s.pitch, -1.1, 1.1) * 0.75 + crouch * 0.12;
        this.upper.rotation.y = Math.sin(this.phase) * 0.06 * sp;
        this.upper.position.y = Math.sin(performance.now() * 0.002) * 0.006;
        this.gunHolder.rotation.x = s.recoil || 0;
      },
      die(dirSign, axis) {
        this.deathT = 0;
        this.deathDir = dirSign;
        this.deathAxis = axis;
      },
      reset() {
        this.deathT = -1;
        this.root.rotation.set(0, 0, 0);
        this.hips.position.y = 0.95;
        this.root.visible = true;
      },
    };
    return model;
  };

  // Dropped weapon or bomb lying in the world.
  MD.droppedItem = function (id) {
    const g = new THREE.Group();
    const m = MD.worldGun(id);
    g.add(m);
    m.rotation.z = Math.PI / 2;
    m.position.y = 0.03;
    if (id === 'c4') { m.rotation.z = 0; m.position.y = 0.025; }
    return g;
  };
})(window.DL);
