/* Dustline - textures.js: all surface textures are painted at load time on canvases. */
'use strict';
(function (DL) {
  const T = (DL.tex = {});
  const rng = DL.makeRng(1337);
  const r = () => rng();

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }

  // Tileable value noise in [0,1].
  function valueNoise(size, period, seedRng) {
    const lat = new Float32Array(period * period);
    for (let i = 0; i < lat.length; i++) lat[i] = seedRng();
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * period, iy = Math.floor(fy);
      let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
      const y0 = (iy % period) * period, y1 = ((iy + 1) % period) * period;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * period, ix = Math.floor(fx);
        let tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
        const x0 = ix % period, x1 = (ix + 1) % period;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
    }
    return out;
  }
  function fbm(size, period, octaves) {
    const out = new Float32Array(size * size);
    let amp = 1, total = 0, p = period;
    for (let o = 0; o < octaves; o++) {
      const n = valueNoise(size, p, r);
      for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
      total += amp; amp *= 0.5; p *= 2;
      if (p > size) break;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
  }

  function finish(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    if (repeat !== false) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = T.maxAniso || 4;
    t.needsUpdate = true;
    return t;
  }

  // Multiplies a canvas by noise and adds grain. strength 0..1
  function grime(c, period, strength, grain) {
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data, n = fbm(c.width, period, 5);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const m = 1 - strength + strength * (0.55 + n[p] * 0.9);
      const gr = (r() - 0.5) * grain;
      d[i] = DL.clamp(d[i] * m + gr, 0, 255);
      d[i + 1] = DL.clamp(d[i + 1] * m + gr, 0, 255);
      d[i + 2] = DL.clamp(d[i + 2] * m + gr, 0, 255);
    }
    g.putImageData(img, 0, 0);
  }

  function rgb(c, k) {
    k = k == null ? 1 : k;
    return 'rgb(' + Math.round(DL.clamp(c[0] * k, 0, 255)) + ',' + Math.round(DL.clamp(c[1] * k, 0, 255)) + ',' + Math.round(DL.clamp(c[2] * k, 0, 255)) + ')';
  }

  function crack(g, x, y, len, w, color) {
    g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
    let a = r() * Math.PI * 2;
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 1.1;
      x += Math.cos(a) * 6; y += Math.sin(a) * 6;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  T.sand = function () {
    const S = 512, c = canvas(S), g = c.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    const n = fbm(S, 4, 6), n2 = fbm(S, 16, 3);
    const lo = [190, 152, 100], hi = [228, 196, 146];
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = DL.clamp(n[p] * 0.75 + n2[p] * 0.4 - 0.08, 0, 1);
      const gr = (r() - 0.5) * 18;
      d[i] = lo[0] + (hi[0] - lo[0]) * v + gr;
      d[i + 1] = lo[1] + (hi[1] - lo[1]) * v + gr;
      d[i + 2] = lo[2] + (hi[2] - lo[2]) * v + gr * 0.8;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 700; i++) {
      const x = r() * S, y = r() * S, s = 0.6 + r() * 2.2;
      g.fillStyle = r() < 0.6 ? 'rgba(110,82,50,0.45)' : 'rgba(245,225,190,0.5)';
      g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
    }
    return finish(c);
  };

  // Square paving stones. cells per side, base color.
  T.tiles = function (cells, base, grout, wear) {
    const S = 512, c = canvas(S), g = c.getContext('2d');
    g.fillStyle = rgb(grout); g.fillRect(0, 0, S, S);
    const step = S / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const k = 0.86 + r() * 0.22;
        const inset = 2 + r() * 1.5;
        g.fillStyle = rgb(base, k);
        g.fillRect(x * step + inset, y * step + inset, step - inset * 2, step - inset * 2);
        // soft bevel
        g.fillStyle = 'rgba(255,240,210,0.10)';
        g.fillRect(x * step + inset, y * step + inset, step - inset * 2, 3);
        g.fillStyle = 'rgba(40,25,10,0.12)';
        g.fillRect(x * step + inset, (y + 1) * step - inset - 3, step - inset * 2, 3);
        for (let k2 = 0; k2 < wear; k2++) {
          g.fillStyle = 'rgba(60,40,20,' + (0.05 + r() * 0.1) + ')';
          g.beginPath(); g.arc(x * step + r() * step, y * step + r() * step, 2 + r() * step * 0.12, 0, Math.PI * 2); g.fill();
        }
      }
    }
    for (let i = 0; i < cells; i++) crack(g, r() * S, r() * S, 4 + r() * 8, 1, 'rgba(50,35,20,0.35)');
    grime(c, 4, 0.35, 16);
    return finish(c);
  };

  T.sandstone = function (base) {
    const S = 512, c = canvas(S), g = c.getContext('2d');
    base = base || [206, 170, 118];
    g.fillStyle = rgb(base, 0.68); g.fillRect(0, 0, S, S);
    const rows = 8, rh = S / rows, mortar = 4;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 120;
      while (x < S) {
        const w = 80 + r() * 90;
        const k = 0.86 + r() * 0.2;
        const y0 = row * rh;
        const draw = (ox) => {
          const gx = x + ox + mortar / 2, gy = y0 + mortar / 2, gw = w - mortar, gh = rh - mortar;
          const grad = g.createLinearGradient(0, gy, 0, gy + gh);
          grad.addColorStop(0, rgb(base, k * 1.08));
          grad.addColorStop(0.5, rgb(base, k));
          grad.addColorStop(1, rgb(base, k * 0.88));
          g.fillStyle = grad;
          g.fillRect(gx, gy, gw, gh);
          // chipped corners
          g.fillStyle = rgb(base, 0.7);
          if (r() < 0.4) g.fillRect(gx, gy, 3 + r() * 6, 2 + r() * 5);
          if (r() < 0.4) g.fillRect(gx + gw - 6, gy + gh - 5, 6, 5);
        };
        draw(0);
        if (x + w > S) draw(-S); // wrap so the texture tiles
        x += w;
      }
    }
    grime(c, 4, 0.45, 20);
    // rain streaks
    for (let i = 0; i < 40; i++) {
      const x = r() * S, w = 2 + r() * 10, y = r() * S, h = 60 + r() * 200;
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, 'rgba(70,50,30,0.12)'); grad.addColorStop(1, 'rgba(70,50,30,0)');
      g.fillStyle = grad; g.fillRect(x, y, w, h);
    }
    return finish(c);
  };

  T.plaster = function (base) {
    const S = 512, c = canvas(S), g = c.getContext('2d');
    base = base || [226, 204, 164];
    g.fillStyle = rgb(base); g.fillRect(0, 0, S, S);
    // exposed brick patches
    for (let p = 0; p < 3; p++) {
      const cx = r() * S, cy = r() * S, rad = 30 + r() * 50;
      g.save();
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.4) {
        const rr = rad * (0.6 + r() * 0.5);
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7);
      }
      g.closePath(); g.clip();
      g.fillStyle = 'rgb(140,100,70)'; g.fillRect(cx - rad * 1.5, cy - rad * 1.5, rad * 3, rad * 3);
      for (let by = cy - rad * 1.5; by < cy + rad * 1.5; by += 16) {
        const off = ((by / 16) | 0) % 2 ? 16 : 0;
        for (let bx = cx - rad * 1.5 + off; bx < cx + rad * 1.5; bx += 32) {
          g.fillStyle = rgb([175, 120, 82], 0.85 + r() * 0.25);
          g.fillRect(bx + 1.5, by + 1.5, 29, 13);
        }
      }
      g.restore();
      g.strokeStyle = 'rgba(90,70,50,0.5)'; g.lineWidth = 2; g.stroke();
    }
    grime(c, 4, 0.5, 10);
    for (let i = 0; i < 6; i++) crack(g, r() * S, r() * S, 6 + r() * 14, 1.2, 'rgba(80,60,40,0.45)');
    for (let i = 0; i < 30; i++) {
      const x = r() * S, w = 3 + r() * 14, y = r() * S, h = 80 + r() * 220;
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, 'rgba(90,70,40,0.10)'); grad.addColorStop(1, 'rgba(90,70,40,0)');
      g.fillStyle = grad; g.fillRect(x, y, w, h);
    }
    return finish(c);
  };

  T.capStone = function () {
    const S = 256, c = canvas(S), g = c.getContext('2d');
    g.fillStyle = 'rgb(214,186,140)'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) { g.fillStyle = 'rgba(90,70,45,0.5)'; g.fillRect(x, 0, 2, S); }
    grime(c, 4, 0.4, 14);
    return finish(c);
  };

  T.crate = function () {
    const S = 256, c = canvas(S), g = c.getContext('2d');
    const plank = [158, 112, 66];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = rgb(plank, 0.85 + r() * 0.2);
      g.fillRect(0, i * (S / 6), S, S / 6);
      g.fillStyle = 'rgba(60,35,15,0.6)'; g.fillRect(0, i * (S / 6), S, 2);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = 'rgba(80,50,25,' + (0.1 + r() * 0.2) + ')';
        g.lineWidth = 1;
        const y = i * (S / 6) + 4 + r() * (S / 6 - 8);
        g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 6, S * 0.7, y + (r() - 0.5) * 6, S, y);
        g.stroke();
      }
    }
    const fw = 26, frame = [118, 80, 44];
    g.fillStyle = rgb(frame);
    g.fillRect(0, 0, S, fw); g.fillRect(0, S - fw, S, fw); g.fillRect(0, 0, fw, S); g.fillRect(S - fw, 0, fw, S);
    g.save(); g.translate(S / 2, S / 2); g.rotate(Math.PI / 4);
    g.fillRect(-S * 0.7, -fw / 2, S * 1.4, fw);
    g.restore();
    g.strokeStyle = 'rgba(40,22,8,0.7)'; g.lineWidth = 2;
    g.strokeRect(fw, fw, S - fw * 2, S - fw * 2);
    g.strokeRect(1, 1, S - 2, S - 2);
    g.fillStyle = 'rgba(30,30,30,0.85)';
    for (const [x, y] of [[13, 13], [S - 13, 13], [13, S - 13], [S - 13, S - 13], [S / 2, 13], [S / 2, S - 13], [13, S / 2], [S - 13, S / 2]]) {
      g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
    }
    g.font = 'bold 22px "Saira Stencil One", Impact, sans-serif';
    g.fillStyle = 'rgba(40,25,12,0.55)'; g.textAlign = 'center';
    g.fillText('DL-' + (100 + Math.floor(r() * 899)), S * 0.5, S * 0.78);
    grime(c, 4, 0.3, 14);
    return finish(c);
  };

  T.beams = function () {
    const S = 256, c = canvas(S), g = c.getContext('2d');
    g.fillStyle = 'rgb(70,52,36)'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = rgb([105, 78, 52], 0.85 + r() * 0.2);
      g.fillRect(i * 64 + 4, 0, 56, S);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(i * 64 + 58, 0, 4, S);
    }
    grime(c, 4, 0.35, 14);
    return finish(c);
  };

  T.metal = function (base) {
    const S = 256, c = canvas(S), g = c.getContext('2d');
    g.fillStyle = rgb(base); g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 32) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, 0, 2, S); }
    grime(c, 4, 0.45, 12);
    for (let i = 0; i < 20; i++) {
      g.fillStyle = 'rgba(120,60,20,' + (0.15 + r() * 0.3) + ')';
      g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 10, 0, Math.PI * 2); g.fill();
    }
    return finish(c);
  };

  T.bark = function () {
    const c = canvas(64, 256), g = c.getContext('2d');
    g.fillStyle = 'rgb(112,86,58)'; g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 10 + r() * 6) {
      g.fillStyle = 'rgba(60,42,26,0.6)'; g.fillRect(0, y, 64, 3);
      g.fillStyle = 'rgba(160,130,90,0.3)'; g.fillRect(0, y + 3, 64, 2);
    }
    return finish(c);
  };

  T.frond = function () {
    const S = 256, c = canvas(S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    g.strokeStyle = 'rgb(86,98,44)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(S / 2, S); g.lineTo(S / 2, 0); g.stroke();
    for (let y = 8; y < S - 6; y += 7) {
      const t = y / S, len = Math.sin(t * Math.PI) * 110 + 10;
      for (const side of [-1, 1]) {
        g.strokeStyle = rgb([92 + r() * 30, 118 + r() * 30, 48], 1);
        g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(S / 2, y);
        g.quadraticCurveTo(S / 2 + side * len * 0.5, y - 8, S / 2 + side * len, y + 14 + r() * 8);
        g.stroke();
      }
    }
    const t = finish(c, false);
    return t;
  };

  T.bulletHole = function () {
    const S = 64, c = canvas(S), g = c.getContext('2d');
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(10,8,6,1)');
    grad.addColorStop(0.22, 'rgba(25,18,12,0.95)');
    grad.addColorStop(0.32, 'rgba(70,55,40,0.6)');
    grad.addColorStop(0.7, 'rgba(90,70,50,0.12)');
    grad.addColorStop(1, 'rgba(90,70,50,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(30,20,12,0.6)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * 6, S / 2 + Math.sin(a) * 6);
      g.lineTo(S / 2 + Math.cos(a) * (12 + r() * 12), S / 2 + Math.sin(a) * (12 + r() * 12)); g.stroke();
    }
    return finish(c, false);
  };

  T.splat = function (rgbStr, blobs) {
    const S = 128, c = canvas(S), g = c.getContext('2d');
    for (let i = 0; i < blobs; i++) {
      const rad = i === 0 ? 30 : 4 + r() * 12;
      const dist = i === 0 ? 0 : 20 + r() * 38;
      const a = r() * Math.PI * 2;
      const x = S / 2 + Math.cos(a) * dist, y = S / 2 + Math.sin(a) * dist;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(' + rgbStr + ',0.95)');
      grad.addColorStop(0.7, 'rgba(' + rgbStr + ',0.8)');
      grad.addColorStop(1, 'rgba(' + rgbStr + ',0)');
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    return finish(c, false);
  };

  T.soft = function () {
    const S = 64, c = canvas(S), g = c.getContext('2d');
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    return finish(c, false);
  };

  T.smoke = function () {
    const S = 128, c = canvas(S), g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r() * 30;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, rad = 16 + r() * 26;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
    }
    return finish(c, false);
  };

  T.flash = function () {
    const S = 128, c = canvas(S), g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    for (let i = 0; i < 7; i++) {
      g.rotate((Math.PI * 2) / 7 + r() * 0.3);
      const len = 30 + r() * 30;
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, 'rgba(255,240,200,0.95)');
      grad.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(0, -5); g.lineTo(len, 0); g.lineTo(0, 5); g.fill();
    }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 26);
    core.addColorStop(0, 'rgba(255,255,240,1)');
    core.addColorStop(0.5, 'rgba(255,210,120,0.8)');
    core.addColorStop(1, 'rgba(255,140,30,0)');
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
    return finish(c, false);
  };

  // Spray-painted bombsite letter used on floors and walls.
  T.sprayText = function (text, color, w, h, fontPx, opts) {
    opts = opts || {};
    const c = canvas(w, h), g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.font = (opts.weight || '') + ' ' + fontPx + 'px "Saira Stencil One", Impact, "Arial Black", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = opts.blur == null ? 6 : opts.blur;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + (opts.dy || 0));
    g.shadowBlur = 0;
    if (opts.drips) {
      for (let i = 0; i < opts.drips; i++) {
        const x = w * 0.25 + r() * w * 0.5, y = h * 0.55 + r() * h * 0.15;
        g.fillRect(x, y, 2 + r() * 2, 10 + r() * 30);
      }
    }
    // overspray speckle
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) d[i] = d[i] * (0.75 + r() * 0.25);
    g.putImageData(img, 0, 0);
    return finish(c, false);
  };

  T.sky = function () {
    const c = canvas(4, 512), g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#2f63a8');
    grad.addColorStop(0.32, '#6b9ad0');
    grad.addColorStop(0.47, '#c9d6d6');
    grad.addColorStop(0.5, '#ecd9b2');
    grad.addColorStop(0.56, '#d9b98a');
    grad.addColorStop(1, '#b8915e');
    g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
    const t = finish(c, false);
    return t;
  };

  T.build = function (renderer) {
    T.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    T.all = {
      sand: T.sand(),
      pave: T.tiles(4, [196, 178, 148], [118, 102, 82], 3),
      site: T.tiles(2, [192, 158, 118], [110, 88, 62], 9),
      tunnel: T.tiles(3, [150, 135, 112], [80, 70, 58], 6),
      sandstone: T.sandstone([206, 170, 118]),
      sandstoneDark: T.sandstone([182, 146, 100]),
      plaster: T.plaster([228, 206, 166]),
      plasterWarm: T.plaster([222, 186, 140]),
      cap: T.capStone(),
      crate: T.crate(),
      beams: T.beams(),
      metal: T.metal([62, 86, 104]),
      bark: T.bark(),
      frond: T.frond(),
      bulletHole: T.bulletHole(),
      blood: T.splat('120,10,8', 12),
      scorch: T.splat('20,16,12', 8),
      soft: T.soft(),
      smoke: T.smoke(),
      flash: T.flash(),
      sky: T.sky(),
      letterA: T.sprayText('A', 'rgba(205,40,30,0.9)', 256, 256, 210, { drips: 3 }),
      letterB: T.sprayText('B', 'rgba(205,40,30,0.9)', 256, 256, 210, { drips: 3 }),
    };
    return T.all;
  };
})(window.DL);
