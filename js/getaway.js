(() => {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const intro = document.getElementById("intro");
  const hud = document.getElementById("hud");
  const result = document.getElementById("result");
  const scoreNode = document.getElementById("score");
  const speedNode = document.getElementById("speed");
  const heatBar = document.getElementById("heat-bar");
  const toast = document.getElementById("toast");
  const bestKey = "night-run-best";
  const controls = { left: false, right: false, drift: false };
  const game = {
    running: false, width: 0, height: 0, dpr: 1, elapsed: 0, distance: 0,
    speed: 0, playerX: 0, velocity: 0, heat: 0.18, spawnIn: 0, copSpawnIn: 4,
    traffic: [], cops: [], particles: [], lastTime: 0, curve: 0, curveTarget: 0,
    toastTime: 0, sound: false, audio: null, best: 0
  };

  try {
    game.best = Number(localStorage.getItem(bestKey)) || 0;
  } catch (error) {
    console.warn("Local score storage unavailable", error);
  }
  document.getElementById("best-start").textContent = String(game.best).padStart(6, "0");

  function resize() {
    const box = canvas.getBoundingClientRect();
    game.dpr = Math.min(window.devicePixelRatio || 1, 2);
    game.width = box.width;
    game.height = box.height;
    canvas.width = Math.round(box.width * game.dpr);
    canvas.height = Math.round(box.height * game.dpr);
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  function roadCenter(y) {
    const perspective = y / game.height;
    const bend = Math.sin(game.elapsed * 0.31 + perspective * 2.7) * game.width * 0.035;
    return game.width * 0.5 + bend + game.curve * perspective * game.width * 0.055;
  }
  function roadWidth(y) {
    return game.width * (0.50 + (y / game.height) * 0.16);
  }
  function drawBackground() {
    const { width: w, height: h } = game;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#142123"); sky.addColorStop(0.55, "#243632"); sky.addColorStop(1, "#101819");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    const drift = (game.elapsed * game.speed * 0.13) % 70;
    for (let side = 0; side < 2; side++) {
      for (let i = -1; i < 13; i++) {
        const y = i * 70 + drift;
        const center = roadCenter(y);
        const edge = roadWidth(y) * 0.5;
        const x = center + (side ? 1 : -1) * (edge + 20 + ((i * 37 + side * 19) % 58));
        const bh = 22 + ((i * 29 + side * 17) % 45);
        const bw = 13 + ((i * 13 + side * 11) % 27);
        ctx.fillStyle = i % 3 === 0 ? "#20302d" : "#182623";
        ctx.fillRect(x - bw / 2, y - bh, bw, bh);
        ctx.fillStyle = i % 2 ? "#f8bb5b44" : "#9de8d82c";
        ctx.fillRect(x - bw / 2 + 3, y - bh + 6, 3, 4);
        ctx.fillRect(x - bw / 2 + 9, y - bh + 13, 3, 4);
      }
    }

    ctx.beginPath();
    for (let y = 0; y <= h; y += 12) {
      const x = roadCenter(y) - roadWidth(y) / 2;
      if (!y) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let y = h; y >= 0; y -= 12) ctx.lineTo(roadCenter(y) + roadWidth(y) / 2, y);
    ctx.closePath();
    const asphalt = ctx.createLinearGradient(0, 0, w, h);
    asphalt.addColorStop(0, "#283230"); asphalt.addColorStop(0.5, "#3b403b"); asphalt.addColorStop(1, "#29302e");
    ctx.fillStyle = asphalt; ctx.fill();

    for (const sign of [-1, 1]) {
      for (let y = -50 + drift * 1.6; y < h + 40; y += 50) {
        const x = roadCenter(y) + sign * roadWidth(y) * 0.5;
        ctx.fillStyle = Math.floor(y / 50) % 2 ? "#e5d8a8" : "#cf6855";
        ctx.fillRect(x - 3, y, 6, 25);
      }
    }
    ctx.save();
    ctx.setLineDash([25, 30]);
    ctx.lineDashOffset = -drift * 1.35;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#d7d1b46e";
    for (const lane of [-1 / 6, 1 / 6]) {
      ctx.beginPath();
      for (let y = 0; y <= h; y += 14) {
        const x = roadCenter(y) + lane * roadWidth(y);
        if (!y) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
    }
    ctx.closePath();
  }

  function drawCar(x, y, color, scale = 1, police = false, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#080d0c77";
    ctx.beginPath(); ctx.ellipse(2, 8, 17, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    roundedRect(-12, -24, 24, 48, 7); ctx.fill();
    ctx.fillStyle = police ? "#1b2529" : "#1d292a";
    roundedRect(-9, -12, 18, 19, 4); ctx.fill();
    ctx.fillStyle = "#c5e0dc";
    ctx.fillRect(-8, -9, 16, 5);
    ctx.fillStyle = "#ffe6a1";
    ctx.fillRect(-9, -22, 5, 3); ctx.fillRect(4, -22, 5, 3);
    ctx.fillStyle = "#ff675e";
    ctx.fillRect(-9, 19, 5, 3); ctx.fillRect(4, 19, 5, 3);
    ctx.fillStyle = "#101514";
    ctx.fillRect(-14, -14, 3, 9); ctx.fillRect(11, -14, 3, 9);
    ctx.fillRect(-14, 8, 3, 9); ctx.fillRect(11, 8, 3, 9);
    if (police) {
      ctx.fillStyle = game.elapsed % 0.4 < 0.2 ? "#ff5049" : "#4bc8ff";
      ctx.fillRect(-5, -4, 5, 3);
      ctx.fillStyle = game.elapsed % 0.4 < 0.2 ? "#4bc8ff" : "#ff5049";
      ctx.fillRect(0, -4, 5, 3);
    }
    ctx.restore();
  }

  function drawFrame() {
    ctx.clearRect(0, 0, game.width, game.height);
    drawBackground();
    for (const car of game.traffic) drawCar(roadCenter(car.y) + car.x * roadWidth(car.y), car.y, car.color, 0.76);
    for (const cop of game.cops) {
      const x = roadCenter(cop.y) + cop.x * roadWidth(cop.y);
      drawCar(x, cop.y, "#c8d1d1", 0.76, true, cop.angle);
    }
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.45);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const py = game.height * 0.76;
    const px = roadCenter(py) + game.playerX * roadWidth(py);
    drawCar(px, py, "#d4ff58", 1, false, game.velocity * 0.22);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    game.toastTime = 1;
  }

  function spawnTraffic() {
    const lane = [-0.66, 0, 0.66][Math.floor(Math.random() * 3)];
    game.traffic.push({
      x: lane + (Math.random() - 0.5) * 0.14, y: -70,
      speed: 0.65 + Math.random() * 0.56,
      color: ["#e76a56", "#7bb5c0", "#dbd0b1", "#9d8bd4", "#d19753"][Math.floor(Math.random() * 5)],
      near: false
    });
  }
  function spawnCop() {
    const lane = Math.random() < 0.5 ? -0.62 : 0.62;
    game.cops.push({ x: lane, y: game.height + 35, speed: 0.24 + Math.random() * 0.15, angle: 0 });
  }

  function start() {
    game.running = true; game.elapsed = 0; game.distance = 0; game.speed = 90;
    game.playerX = 0; game.velocity = 0; game.heat = 0.16; game.spawnIn = 0.3;
    game.copSpawnIn = 3.5; game.traffic = []; game.cops = []; game.particles = [];
    game.toastTime = 0; toast.classList.remove("show");
    intro.hidden = true; result.hidden = true; hud.hidden = false;
    game.lastTime = performance.now();
    requestAnimationFrame(frame);
    if (game.sound) playTone(220, 0.07);
  }

  function end() {
    if (!game.running) return;
    game.running = false;
    const score = Math.floor(game.distance);
    const isRecord = score > game.best;
    if (isRecord) {
      game.best = score;
      try {
        localStorage.setItem(bestKey, String(score));
      } catch (error) {
        console.warn("Could not save personal best", error);
      }
      document.getElementById("best-start").textContent = String(score).padStart(6, "0");
    }
    document.getElementById("final-score").textContent = score.toLocaleString();
    document.getElementById("record").hidden = !isRecord;
    hud.hidden = true; result.hidden = false;
    if (game.sound) playTone(90, 0.32);
  }

  function frame(now) {
    if (!game.running) return;
    const dt = Math.min(0.04, (now - game.lastTime) / 1000);
    game.lastTime = now;
    update(dt);
    drawFrame();
    if (game.running) requestAnimationFrame(frame);
  }

  function update(dt) {
    game.elapsed += dt;
    game.distance += game.speed * dt / 3.6;
    game.speed = Math.min(210, game.speed + dt * 1.7);
    game.curveTarget = Math.sin(game.elapsed * 0.22) * 0.8 + Math.sin(game.elapsed * 0.51) * 0.26;
    game.curve += (game.curveTarget - game.curve) * dt * 0.6;
    const steer = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    game.velocity += (steer * (controls.drift ? 2.9 : 2.0) - game.velocity * (controls.drift ? 0.65 : 3.1)) * dt;
    game.playerX += game.velocity * dt;
    game.playerX -= game.curve * dt * (game.speed / 190);
    game.playerX = Math.max(-1.22, Math.min(1.22, game.playerX));

    game.spawnIn -= dt;
    if (game.spawnIn <= 0) {
      spawnTraffic();
      game.spawnIn = Math.max(0.42, 1.28 - game.elapsed * 0.008) * (0.65 + Math.random() * 0.7);
    }
    game.copSpawnIn -= dt;
    if (game.copSpawnIn <= 0) {
      spawnCop();
      game.copSpawnIn = Math.max(2.1, 5.2 - game.elapsed * 0.025);
    }

    const playerY = game.height * 0.76;
    const playerScreenX = roadCenter(playerY) + game.playerX * roadWidth(playerY);
    for (const car of game.traffic) {
      car.y += (0.25 + game.speed / 190 - car.speed * 0.2) * game.height * dt * 0.22;
      const carX = roadCenter(car.y) + car.x * roadWidth(car.y);
      if (Math.abs(car.y - playerY) < 33 && Math.abs(carX - playerScreenX) < 24) {
        game.heat = Math.min(1, game.heat + 0.27);
        game.speed = Math.max(45, game.speed - 48);
        car.y = game.height + 100;
        showToast("TRAFFIC HIT  ·  TAIL CLOSING");
        if (game.heat >= 0.99) end();
        if (game.sound) playTone(120, 0.12);
      } else if (!car.near && car.y > playerY - 38 && car.y < playerY + 36 && Math.abs(carX - playerScreenX) < 53) {
        car.near = true;
        game.distance += 18;
        game.heat = Math.max(0.08, game.heat - 0.035);
        showToast("CLOSE CALL  +18M");
        if (game.sound) playTone(620, 0.05);
      }
    }
    game.traffic = game.traffic.filter(car => car.y < game.height + 100);

    for (const cop of game.cops) {
      const target = game.playerX + (cop.x < game.playerX ? -0.02 : 0.02);
      cop.x += Math.max(-0.35, Math.min(0.35, target - cop.x)) * dt * 1.4;
      cop.y -= (game.speed / 125 + cop.speed) * dt * game.height * 0.14;
      cop.angle = Math.max(-0.24, Math.min(0.24, (target - cop.x) * -0.7));
      if (Math.abs(cop.y - playerY) < 32 && Math.abs(roadCenter(cop.y) + cop.x * roadWidth(cop.y) - playerScreenX) < 26) {
        game.heat = 1;
        end();
      }
    }
    game.cops = game.cops.filter(cop => cop.y > -70);

    const roadLimit = roadWidth(playerY) * 0.43;
    if (Math.abs(game.playerX * roadWidth(playerY) + game.curve * game.width * 0.08) > roadLimit) {
      game.speed = Math.max(45, game.speed - dt * 75);
      game.heat = Math.min(1, game.heat + dt * 0.09);
      if (Math.random() < dt * 18) {
        const x = playerScreenX + (Math.random() - 0.5) * 22;
        game.particles.push({ x, y: playerY + 15, size: 2 + Math.random() * 3, life: 0.45, color: "#eac98a" });
      }
      if (game.heat >= 1) end();
    } else {
      game.heat = Math.max(0.08, game.heat - dt * 0.012);
    }
    game.particles.forEach(p => { p.life -= dt; p.y += dt * 35; });
    game.particles = game.particles.filter(p => p.life > 0);
    if (game.toastTime > 0) {
      game.toastTime -= dt;
      if (game.toastTime <= 0) toast.classList.remove("show");
    }
    scoreNode.textContent = String(Math.floor(game.distance)).padStart(6, "0");
    speedNode.textContent = String(Math.floor(game.speed));
    heatBar.style.width = `${Math.round(game.heat * 100)}%`;
  }

  function playTone(freq, duration) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      game.audio ||= new Audio();
      const oscillator = game.audio.createOscillator();
      const gain = game.audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(0.055, game.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, game.audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(game.audio.destination);
      oscillator.start(); oscillator.stop(game.audio.currentTime + duration);
    } catch (error) {
      console.warn("Audio playback unavailable", error);
    }
  }

  document.getElementById("start").addEventListener("click", start);
  document.getElementById("retry").addEventListener("click", start);
  document.getElementById("sound").addEventListener("click", event => {
    game.sound = !game.sound;
    event.currentTarget.setAttribute("aria-pressed", String(!game.sound));
    event.currentTarget.setAttribute("aria-label", game.sound ? "Mute sound" : "Enable sound");
    if (game.sound) playTone(440, 0.06);
  });
  window.addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") controls.left = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controls.right = true;
    if (event.key === " ") controls.drift = true;
    if (!game.running && (event.key === "Enter" || event.key === " ")) start();
  });
  window.addEventListener("keyup", event => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") controls.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controls.right = false;
    if (event.key === " ") controls.drift = false;
  });
  document.querySelectorAll("[data-steer]").forEach(button => {
    const dir = Number(button.dataset.steer);
    const down = event => { event.preventDefault(); controls[dir < 0 ? "left" : "right"] = true; button.classList.add("pressed"); };
    const up = () => { controls[dir < 0 ? "left" : "right"] = false; button.classList.remove("pressed"); };
    button.addEventListener("pointerdown", down);
    for (const name of ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"]) button.addEventListener(name, up);
  });
  const driftButton = document.querySelector("[data-drift]");
  driftButton.addEventListener("pointerdown", event => { event.preventDefault(); controls.drift = true; driftButton.classList.add("pressed"); });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"]) {
    driftButton.addEventListener(name, () => { controls.drift = false; driftButton.classList.remove("pressed"); });
  }
  window.addEventListener("blur", () => { controls.left = false; controls.right = false; controls.drift = false; });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("getaway-sw.js").catch(error => console.warn("Offline mode unavailable", error)));
  }
  drawFrame();
})();
