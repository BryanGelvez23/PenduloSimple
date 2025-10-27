/* Pendulo Master - Script Final Optimizado */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ✅ Ajuste real de pixeles para evitar blur
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.clientWidth * ratio;
  const h = canvas.clientHeight * ratio;
  canvas.width = w;
  canvas.height = h;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 🎚 Controles
const L_slider = document.getElementById('L');
const theta0_slider = document.getElementById('theta0');
const b_slider = document.getElementById('b');
const g_slider = document.getElementById('g');

const Lval = document.getElementById('Lval');
const theta0val = document.getElementById('theta0val');
const bval = document.getElementById('bval');
const gval = document.getElementById('gval');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const impulseBtn = document.getElementById('impulseBtn');

const timeEl = document.getElementById('time');
const thetaEl = document.getElementById('thetaDeg');
const omegaEl = document.getElementById('omegaVal');
const countEl = document.getElementById('osc-count');
const msgEl = document.getElementById('message');
const finalCodeInput = document.getElementById('finalCode');
const copyBtn = document.getElementById('copyBtn');

// 🔧 Utilidades
const degToRad = d => d * Math.PI / 180;
const radToDeg = r => r * 180 / Math.PI;

// 📌 Parámetros iniciales
let L = parseFloat(L_slider.value);
let theta0_deg = parseFloat(theta0_slider.value);
let b = parseFloat(b_slider.value);
let g = parseFloat(g_slider.value);
let dt_fixed = 0.016;
let m = 1.0;

// 📌 Estado
let theta = degToRad(theta0_deg);
let omega = 0;
let t_sim = 0;
let paused = true;
let finished = false;

// 🎯 Conteo de oscilaciones
let lastSign = Math.sign(theta);
let oscCount = 0;
const minCrossInterval = 0.1;
let lastCrossTime = -999;
const N_OSC = 5;

// ⚠ Nuevo criterio: velocidad mínima permitida antes de “apagarse”
const MIN_SPEED = 0.10; // rad/s

function updateLabels() {
  Lval.textContent = L.toFixed(2);
  theta0val.textContent = theta0_deg.toFixed(0);
  bval.textContent = b.toFixed(3);
  gval.textContent = g.toFixed(2);
}
updateLabels();

// ✅ Reset total
function resetSim() {
  L = parseFloat(L_slider.value);
  theta0_deg = parseFloat(theta0_slider.value);
  b = parseFloat(b_slider.value);
  g = parseFloat(g_slider.value);

  theta = degToRad(theta0_deg);
  omega = 0;
  t_sim = 0;
  paused = true;
  finished = false;

  lastSign = Math.sign(theta);
  oscCount = 0;
  lastCrossTime = -999;

  countEl.textContent = "0";
  timeEl.textContent = "0.00";
  finalCodeInput.value = "";
  msgEl.textContent = "Presiona Start";
}
resetSim();

// 🚀 Botones
startBtn.addEventListener('click', () => {
  if (finished) resetSim();
  paused = false;
  msgEl.textContent = "Corriendo...";
});

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  msgEl.textContent = paused ? "Pausado" : "Corriendo...";
});

resetBtn.addEventListener('click', resetSim);

impulseBtn.addEventListener('click', () => {
  omega += 0.8; // ✅ impulso realista y funcional
  msgEl.textContent = "Impulso aplicado";
});

// 📋 Copiar código final
copyBtn.addEventListener('click', () => {
  finalCodeInput.select();
  document.execCommand("copy");
});

/* ---------- PARTE 2/3: Física RK4, energía, detección y dibujo ---------- */

// física: aceleración angular
function theta_dd(theta_local, omega_local) {
  return - (g / L) * Math.sin(theta_local) - b * omega_local;
}

// paso RK4
function rk4_step(theta_local, omega_local, h) {
  const k1_th = omega_local;
  const k1_w  = theta_dd(theta_local, omega_local);

  const k2_th = omega_local + 0.5 * h * k1_w;
  const k2_w  = theta_dd(theta_local + 0.5 * h * k1_th, omega_local + 0.5 * h * k1_w);

  const k3_th = omega_local + 0.5 * h * k2_w;
  const k3_w  = theta_dd(theta_local + 0.5 * h * k2_th, omega_local + 0.5 * h * k2_w);

  const k4_th = omega_local + h * k3_w;
  const k4_w  = theta_dd(theta_local + h * k3_th, omega_local + h * k3_w);

  const theta_next = theta_local + (h / 6) * (k1_th + 2*k2_th + 2*k3_th + k4_th);
  const omega_next = omega_local + (h / 6) * (k1_w + 2*k2_w + 2*k3_w + k4_w);

  return [theta_next, omega_next];
}

// energía (por si la quieres mostrar luego)
function energies(theta_local, omega_local) {
  const v = L * omega_local;
  const Ekin = 0.5 * m * v * v;
  const Epot = m * g * L * (1 - Math.cos(theta_local));
  return [Ekin, Epot, Ekin + Epot];
}

// detection robusta de oscilación
function checkOscillation(now) {
  const s = Math.sign(theta);
  if (s === 0) return;
  if (s !== lastSign) {
    // solo contamos si estamos cerca del centro y pasó suficiente tiempo desde la última cruzada
    if (Math.abs(theta) < 0.12 && (now - lastCrossTime) > minCrossInterval) {
      lastCrossTime = now;
      // cada dos cruces = 1 oscilación completa (ida + vuelta)
      oscCount++;
      countEl.textContent = oscCount;
      // éxito inmediato si llegó a N_OSC
      if (oscCount >= N_OSC && !finished) {
        finish(true);
      }
    }
    lastSign = s;
  }
}

// dibujo del péndulo (limpio y responsivo)
function drawPendulum() {
  // fondo
  ctx.fillStyle = '#071018';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const ox = canvas.clientWidth / 2;
  const oy = 100;
  const pxPerM = getPxPerMeter();
  const pxLen = L * pxPerM;
  const x = ox + pxLen * Math.sin(theta);
  const y = oy + pxLen * Math.cos(theta);

  // varilla
  ctx.strokeStyle = '#bfcbd8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(x, y);
  ctx.stroke();

  // masa
  ctx.fillStyle = '#c84b4b';
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();

  // HUD simple
  ctx.fillStyle = '#98a6b2';
  ctx.font = '14px Arial';
  ctx.fillText(`Oscilaciones: ${oscCount} / ${N_OSC}`, 12, canvas.clientHeight - 12);
}
/* ---------- PARTE 3/3: Loop, finish y token ---------- */

// token generator (no criptográfico, solo identificador)
function generateCode(Lval, thetaDeg, bval, timeTaken, osc) {
  const s = `${Lval.toFixed(2)}|${thetaDeg}|${bval.toFixed(3)}|${timeTaken.toFixed(2)}|${osc}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'PM-' + Math.abs(h).toString(36).toUpperCase().slice(0, 8);
}

// finish handler
function finish(success) {
  finished = true;
  paused = true;
  if (success) {
    msgEl.textContent = '¡Éxito! Objetivo alcanzado.';
    if (finalCodeInput) finalCodeInput.value = generateCode(L, theta0_deg, b, t_sim, oscCount);
    navigator.vibrate && navigator.vibrate(150);
  } else {
    msgEl.textContent = 'No alcanzaste el objetivo.';
    if (finalCodeInput) finalCodeInput.value = 'FAILED';
  }
}

// raf loop con acumulador para pasos fijos (estable)
let lastRAF = null;
let accumulator = 0;

function rafLoop(ts) {
  if (!lastRAF) lastRAF = ts;
  let frameTime = (ts - lastRAF) / 1000; // s
  lastRAF = ts;

  // cap para no explotar si la pestaña estuvo en segundo plano
  frameTime = Math.min(frameTime, 0.05);

  if (!paused && !finished) {
    accumulator += frameTime;
    while (accumulator >= dt_fixed) {
      // integrar un paso fijo
      const out = rk4_step(theta, omega, dt_fixed);
      theta = out[0];
      omega = out[1];
      t_sim += dt_fixed;
      accumulator -= dt_fixed;

      // comprobación de oscilaciones
      checkOscillation(t_sim);

      // criterio de fallo mejorado:
      // solo declarar fail si la velocidad es muy baja Y estamos cerca del centro Y pasó algo de tiempo
      if (Math.abs(omega) < MIN_SPEED && Math.abs(theta) < 0.10 && t_sim > 1.0 && !finished) {
        // si ya alcanzó N_OSC → éxito, si no → fallo
        if (oscCount >= N_OSC) finish(true);
        else finish(false);
      }

      // safety timeout
      if (t_sim > 120 && !finished) finish(false);
    }
  }

  // dibujar y actualizar HUD
  drawPendulum();
  timeEl.textContent = t_sim.toFixed(2);
  thetaEl.textContent = radToDeg(theta).toFixed(1);
  omegaEl.textContent = omega.toFixed(3);

  requestAnimationFrame(rafLoop);
}
requestAnimationFrame(rafLoop);
