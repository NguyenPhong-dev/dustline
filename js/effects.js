/* Dustline - effects.js: particles, bullet holes, blood, tracers, flashes and explosions. */
'use strict';
(function (DL) {
  const FX = (DL.fx = {});
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
  const tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpN = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);

  const VS = [
    'attribute float size;',
    'attribute vec4 pcolor;',
    'uniform float scale;',
    'varying vec4 vColor;',
    'void main() {',
    '  vColor = pcolor;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = size * scale / max(0.05, -mv.z);',
    '  gl_Position = projectionMatrix * mv;',
    '}',
  ].join('\n');
  const FS = [
    'uniform sampler2D map;',
    'varying vec4 vColor;',
    'void main() {',
    '  vec4 t = texture2D(map, gl_PointCoord);',
    '  gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);',
    '  if (gl_FragColor.a < 0.004) discard;',
    '}',
  ].join('\n');

  function Particles(N, map, additive) {
    this.N = N;
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 4);
    this.size = new Float32Array(N);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.max = new Float32Array(N);
    this.s0 = new Float32Array(N); this.s1 = new Float32Array(N);
    this.a0 = new Float32Array(N);
    this.grav = new Float32Array(N); this.drag = new Float32Array(N);
    this.fadeIn = new Uint8Array(N);
    this.next = 0;
    this.alive = 0;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4); this.aCol.setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1); this.aSize.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('pcolor', this.aCol);
    g.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 500 } },
      vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
  }
  Particles.prototype.spawn = function (x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag, fadeIn) {
    const i = this.next;
    this.next = (i + 1) % this.N;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.size[i] = s0;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = fadeIn ? 0 : a;
    this.a0[i] = a; this.grav[i] = grav || 0; this.drag[i] = drag || 0; this.fadeIn[i] = fadeIn ? 1 : 0;
  };
  Particles.prototype.update = function (dt) {
    const N = this.N;
    let any = false;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      const t = 1 - this.life[i] / this.max[i];
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] = 0; this.vel[i * 3] *= 0.5; this.vel[i * 3 + 2] *= 0.5; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      const fade = this.fadeIn[i] ? Math.min(1, t * 8) * (1 - t) : (1 - t);
      this.col[i * 4 + 3] = this.a0[i] * fade;
    }
    if (any || this.dirty) {
      this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
      this.dirty = any;
    }
  };
  Particles.prototype.clear = function () {
    this.life.fill(0); this.size.fill(0); this.dirty = true;
  };

  function Decals(N, map, size, lit) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = lit
      ? new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      : new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mesh = new THREE.InstancedMesh(geo, mat, N);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = !!lit;
    this.mesh.renderOrder = 1;
    this.N = N; this.next = 0; this.size = size;
  }
  Decals.prototype.add = function (x, y, z, nx, ny, nz, size) {
    tmpN.set(nx, ny, nz);
    tmpQ.setFromUnitVectors(Z, tmpN);
    tmpQ2.setFromAxisAngle(Z, Math.random() * Math.PI * 2);
    tmpQ.multiply(tmpQ2);
    const s = size || this.size;
    tmpS.set(s, s, s);
    tmpV.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012);
    tmpM.compose(tmpV, tmpQ, tmpS);
    this.mesh.setMatrixAt(this.next, tmpM);
    this.next = (this.next + 1) % this.N;
    this.mesh.count = Math.min(this.N, this.mesh.count + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  };
  Decals.prototype.clear = function () { this.mesh.count = 0; this.next = 0; };

  function Tracers(N) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, N);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.color = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.mesh.setColorAt(i, this.color.setRGB(0, 0, 0));
      tmpM.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, tmpM);
    }
    this.items = [];
    for (let i = 0; i < N; i++) this.items.push({ on: false });
    this.N = N; this.next = 0;
  }
  Tracers.prototype.add = function (ax, ay, az, bx, by, bz, speed, width) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.N;
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 1) return;
    Object.assign(it, { on: true, ax, ay, az, dx: dx / d, dy: dy / d, dz: dz / d, dist: d, t: 0, speed: speed || 520, len: Math.min(4, d * 0.5), w: width || 0.018 });
  };
  Tracers.prototype.update = function (dt) {
    let any = false;
    for (let i = 0; i < this.N; i++) {
      const it = this.items[i];
      if (!it.on) continue;
      any = true;
      it.t += dt;
      const head = Math.min(it.dist, it.t * it.speed);
      const tail = Math.max(0, head - it.len);
      if (tail >= it.dist - 0.01 || it.t > 0.5) {
        it.on = false;
        tmpM.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, tmpM);
        continue;
      }
      const mid = (head + tail) / 2, len = Math.max(0.01, head - tail);
      tmpV.set(it.ax + it.dx * mid, it.ay + it.dy * mid, it.az + it.dz * mid);
      tmpN.set(it.dx, it.dy, it.dz);
      tmpQ.setFromUnitVectors(Y, tmpN);
      tmpS.set(it.w, len, it.w);
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
      const f = 0.9 * (1 - it.t * 2);
      this.mesh.setColorAt(i, this.color.setRGB(1.0 * f, 0.85 * f, 0.55 * f));
    }
    if (any || this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.dirty = any;
    }
  };

  FX.init = function (scene, tex) {
    FX.scene = scene;
    FX.dust = new Particles(700, tex.smoke, false);
    FX.glow = new Particles(500, tex.soft, true);
    FX.flashes = new Particles(40, tex.flash, true);
    scene.add(FX.dust.points, FX.glow.points, FX.flashes.points);
    FX.holes = new Decals(220, tex.bulletHole, 0.12, true);
    FX.blood = new Decals(60, tex.blood, 0.9, true);
    FX.scorch = new Decals(12, tex.scorch, 4, true);
    scene.add(FX.holes.mesh, FX.blood.mesh, FX.scorch.mesh);
    FX.tracers = new Tracers(48);
    scene.add(FX.tracers.mesh);
    FX.muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 2);
    FX.boomLight = new THREE.PointLight(0xff9a40, 0, 30, 2);
    scene.add(FX.muzzleLight, FX.boomLight);
    FX.muzzleT = 0; FX.boomT = 0;
    FX.shake = 0;
  };

  FX.clear = function () {
    FX.holes.clear(); FX.blood.clear(); FX.scorch.clear();
    FX.dust.clear(); FX.glow.clear(); FX.flashes.clear();
  };

  FX.update = function (dt, camera, renderer) {
    const size = renderer.getDrawingBufferSize(tmpV);
    const scale = size.y / (2 * Math.tan(DL.deg(camera.fov) / 2));
    FX.dust.mat.uniforms.scale.value = scale;
    FX.glow.mat.uniforms.scale.value = scale;
    FX.flashes.mat.uniforms.scale.value = scale;
    FX.dust.update(dt); FX.glow.update(dt); FX.flashes.update(dt);
    FX.tracers.update(dt);
    if (FX.muzzleT > 0) { FX.muzzleT -= dt; FX.muzzleLight.intensity = Math.max(0, FX.muzzleT / 0.06) * 2.2; }
    else FX.muzzleLight.intensity = 0;
    if (FX.boomT > 0) { FX.boomT -= dt; FX.boomLight.intensity = Math.max(0, FX.boomT / FX.boomMax) * FX.boomPower; }
    else FX.boomLight.intensity = 0;
    FX.shake = Math.max(0, FX.shake - dt * 2.5);
  };

  const SURF = {
    wall: [0.78, 0.68, 0.52], arch: [0.7, 0.6, 0.46], crate: [0.55, 0.4, 0.26], palm: [0.45, 0.35, 0.25],
    ground: [0.8, 0.68, 0.5], roof: [0.4, 0.32, 0.24],
  };

  FX.impact = function (x, y, z, nx, ny, nz, kind) {
    const c = SURF[kind] || SURF.ground;
    FX.holes.add(x, y, z, nx, ny, nz, 0.09 + Math.random() * 0.05);
    const n = kind === 'ground' ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + Math.random() * 1.6;
      FX.dust.spawn(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05,
        nx * sp + (Math.random() - 0.5) * 1.2, ny * sp + Math.random() * 0.9, nz * sp + (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 0.5, 0.12, 0.55 + Math.random() * 0.3, c[0], c[1], c[2], 0.75, 1.5, 2.2, false);
    }
    for (let i = 0; i < 4; i++) {
      FX.dust.spawn(x, y, z, nx * 3 + (Math.random() - 0.5) * 3, ny * 3 + Math.random() * 3, nz * 3 + (Math.random() - 0.5) * 3,
        0.4, 0.035, 0.025, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 1, 14, 0.5, false);
    }
    if (kind !== 'crate' && Math.random() < 0.5) {
      FX.glow.spawn(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03, nx * 2 + (Math.random() - 0.5) * 4, ny * 2 + Math.random() * 3, nz * 2 + (Math.random() - 0.5) * 4,
        0.12, 0.05, 0.02, 1, 0.75, 0.4, 1, 12, 1, false);
    }
  };

  FX.bloodHit = function (x, y, z, dx, dy, dz, head) {
    const n = head ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const sp = 1 + Math.random() * 2.5;
      FX.dust.spawn(x, y, z, dx * sp + (Math.random() - 0.5) * 1.6, dy * sp + Math.random() * 1.2, dz * sp + (Math.random() - 0.5) * 1.6,
        0.35 + Math.random() * 0.3, 0.08, head ? 0.45 : 0.3, 0.5, 0.03, 0.02, 0.9, 9, 1.5, false);
    }
    // Splatter on a wall behind the target.
    const t = DL.phys.raycast(x, y, z, dx, dy, dz, 2.6);
    const H = DL.phys.hit;
    if (H.hit && H.box) FX.blood.add(x + dx * t, y + dy * t, z + dz * t, H.nx, H.ny, H.nz, 0.5 + Math.random() * 0.6);
  };

  FX.tracer = function (ax, ay, az, bx, by, bz) {
    FX.tracers.add(ax, ay, az, bx, by, bz);
  };

  FX.muzzle = function (x, y, z, dx, dy, dz, world) {
    FX.muzzleLight.position.set(x, y, z);
    FX.muzzleT = 0.06;
    if (world) {
      FX.flashes.spawn(x, y, z, 0, 0, 0, 0.05, 0.55, 0.7, 1, 0.85, 0.6, 1, 0, 0, false);
      FX.dust.spawn(x + dx * 0.2, y + dy * 0.2, z + dz * 0.2, dx * 1.5, dy * 1.5 + 0.3, dz * 1.5, 0.6, 0.15, 0.6, 0.75, 0.72, 0.68, 0.25, 0, 2, true);
    }
  };

  FX.explosion = function (x, y, z, big) {
    const k = big ? 2.6 : 1;
    const nFire = big ? 70 : 32, nSmoke = big ? 60 : 26;
    for (let i = 0; i < nFire; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.5, sp = (3 + Math.random() * 7) * k;
      FX.glow.spawn(x, y + 0.3, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp,
        0.35 + Math.random() * 0.4, 1.2 * k, 3.5 * k, 1, 0.55 + Math.random() * 0.2, 0.2, 1, -2, 3.5, false);
    }
    for (let i = 0; i < nSmoke; i++) {
      const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 3.5) * k;
      FX.dust.spawn(x + (Math.random() - 0.5) * k, y + 0.5 + Math.random() * k, z + (Math.random() - 0.5) * k,
        Math.cos(a) * sp, (1 + Math.random() * 2.5) * k * 0.6, Math.sin(a) * sp,
        2.2 + Math.random() * 2.5, 1.8 * k, 5.5 * k, 0.32, 0.29, 0.26, 0.7, -0.4, 1.2, true);
    }
    for (let i = 0; i < (big ? 50 : 22); i++) {
      const a = Math.random() * Math.PI * 2, sp = (6 + Math.random() * 10) * k;
      FX.glow.spawn(x, y + 0.3, z, Math.cos(a) * sp, (2 + Math.random() * 6) * k, Math.sin(a) * sp,
        0.6 + Math.random() * 0.6, 0.12, 0.05, 1, 0.7, 0.3, 1, 16, 0.3, false);
    }
    FX.scorch.add(x, 0.01, z, 0, 1, 0, big ? 9 : 3.5);
    FX.boomLight.position.set(x, y + 1.5, z);
    FX.boomLight.distance = big ? 70 : 28;
    FX.boomPower = big ? 9 : 5;
    FX.boomMax = big ? 0.9 : 0.4;
    FX.boomT = FX.boomMax;
  };
})(window.DL);
