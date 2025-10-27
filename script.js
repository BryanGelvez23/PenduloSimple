/* script.js - Versión final y robusta para PenduloMaster
   Reemplaza TODO el archivo actual por este.
*/

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// resize con devicePixelRatio conservando CSS size
function resizeCanvas(){
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssW * ratio);
  canvas.height = Math.floor(cssH * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// UI elems
const L_slider = document.getElementById('L');
const Lval = document.getElementById('Lval');
const theta0_slider = document.getElementById('theta0');
const theta0val = document.getElementById('theta0val');
const b_slider = document.getElementById('b');
const bval = document.getElementById('bval');
const g_slider = document.getElementById('g');
const gval = document.getElementById('gval');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const impulseBtn = document.getElementById('impulseBtn');

const timeEl = document.getElementById('time');
const thetaEl = document.getElementById('thetaDeg');
const omegaEl = document.getElementById('omegaVal');
const countEl = document.getElementById('osc-count'); // coincide con HTML
const msgEl = document.getElementById('message');
const finalCodeInput = document.getElementById('finalCode');
const copyBtn = document.getElementById('copyBtn');

// utils
const degToRad = d => d * Math.PI/180;
const radToDeg = r => r * 180/Math.PI;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

// Simulation parameters (initial)
let L = parseFloat(L_slider.value);        // m
let theta0_deg = parseFloat(theta0_slider.value);
let b = parseFloat(b_slider.value);
let g = parseFloat(g_slider.value);
let dt_fixed = 0.016; // integrator fixed step (s)
let m = 1.0; // mass for impulse calc

// State
let theta = degToRad(theta0_deg);
let omega = 0.0;
let t_sim = 0.0;
let paused = true;
let finished = false;

// Oscillation counting (robust)
let lastSign = Math.sign(theta);
let zeroCrossings = 0;   // half-cycles
let oscCount = 0;        // full cycles (ida+vuelta)
let lastCrossTime = -999;
const minCrossInterval = 0.08; // s debounce to avoid jitter
const N_OSC = 5;
const AMP_THRESHOLD_RATIO = 0.20;

// Visual scale (px per meter)
function getPxPerMeter(){
  // canvas.clientWidth is CSS width
  return Math.min(canvas.clientWidth, 720) / 3.5;
}

// update UI labels
function updateLabels(){
  Lval.textContent = L.toFixed(2);
  theta0val.textContent = Math.round(theta0_deg);
  bval.textContent = b.toFixed(3);
  gval.textContent = g.toFixed(2);
}
updateLabels();

// --- Listeners: controls ---
// Start / Pause / Reset / Impulse
startBtn.addEventListener('click', () => {
  if(finished) resetSim();
  paused = false;
  msgEl.textContent = 'Corriendo...';
});
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  msgEl.textContent = paused ? 'Pausado' : 'Corriendo...';
});
resetBtn.addEventListener('click', () => resetSim());
impulseBtn.addEventListener('click', () => {
  // Impulso físico: apply torque via Δω = F * Δt / (m * L)
  const F = 5.0;      // Newtons (tweakable)
  const dt_imp = 0.05; // s
  omega += (F * dt_imp) / (m * Math.max(0.01, L));
  msgEl.textContent = 'Impulso aplicado';
});

// copy final code (if present)
if(copyBtn && finalCodeInput){
  copyBtn.addEventListener('click', () => {
    finalCodeInput.select();
    document.execCommand('copy');
  });
}

// Sliders: update parameters BUT do NOT reset simulation automatically
L_slider.addEventListener('input', (e) => {
  L = parseFloat(e.target.value);
  updateLabels();
});
theta0_slider.addEventListener('input', (e) => {
  theta0_deg = parseFloat(e.target.value);
  updateLabels();
});
b_slider.addEventListener('input', (e) => {
  b = parseFloat(e.target.value);
  updateLabels();
});
g_slider.addEventListener('input', (e) => {
  g = parseFloat(e.target.value);
  updateLabels();
});

// Reset function: sets theta to theta0 and clears counts
function resetSim(){
  L = parseFloat(L_slider.value);
  theta0_deg = parseFloat(theta0_slider.value);
  b = parseFloat(b_slider.value);
  g = parseFloat(g_slider.value);

  theta = degToRad(theta0_deg);
  omega = 0.0;
  t_sim = 0.0;
  paused = true;
  finished = false;

  lastSign = Math.sign(theta);
  zeroCrossings = 0;
  oscCount = 0;
  lastCrossTime = -999;

  countEl.textContent = oscCount;
  timeEl.textContent = '0.00';
  thetaEl.textContent = radToDeg(theta).toFixed(1);
  omegaEl.textContent = omega.toFixed(3);
  finalCodeInput && (finalCodeInput.value = '');
  msgEl.textContent = 'Presiona Start';
}
resetSim();

// --- Physics: RK4 with fixed-step accumulator ---
function theta_dd(theta_local, omega_local){
  return - (g / L) * Math.sin(theta_local) - b * omega_local;
}
function rk4_step(theta_local, omega_local, h){
  const k1_th = omega_local;
  const k1_w  = theta_dd(theta_local, omega_local);

  const k2_th = omega_local + 0.5*h*k1_w;
  const k2_w  = theta_dd(theta_local + 0.5*h*k1_th, omega_local + 0.5*h*k1_w);

  const k3_th = omega_local + 0.5*h*k2_w;
  const k3_w  = theta_dd(theta_local + 0.5*h*k2_th, omega_local + 0.5*h*k2_w);

  const k4_th = omega_local + h*k3_w;
  const k4_w  = theta_dd(theta_local + h*k3_th, omega_local + h*k3_w);

  const theta_next = theta_local + (h/6)*(k1_th + 2*k2_th + 2*k3_th + k4_th);
  const omega_next = omega_local + (h/6)*(k1_w  + 2*k2_w  + 2*k3_w  + k4_w);

  return [theta_next, omega_next];
}

// Energy helpers (for potential future use)
function energies(theta_local, omega_local){
  const v = L * omega_local;
  const Ekin = 0.5 * m * v * v;
  const Epot = m * g * L * (1 - Math.cos(theta_local));
  return [Ekin, Epot, Ekin + Epot];
}

// oscillation detection robust
function checkOscillation(now){
  const s = Math.sign(theta);
  if(s === 0) return; // exact 0 rare
  if(s !== lastSign){
    // only count a crossing if near center and enough time since last crossing (debounce)
    if(Math.abs(theta) < 0.12 && (now - lastCrossTime) > minCrossInterval){
      zeroCrossings++;
      lastCrossTime = now;
      if(zeroCrossings % 2 === 0){
        oscCount++;
        countEl.textContent = oscCount;
        // success condition
        if(oscCount >= N_OSC && !finished){
          finish(true);
        }
      }
    }
    lastSign = s;
  }
}

// finish handler
function finish(success){
  finished = true;
  paused = true;
  if(success){
    msgEl.textContent = '¡Éxito! Objetivo alcanzado.';
    // generate token for form
    if(finalCodeInput){
      finalCodeInput.value = generateCode(L, theta0_deg, b, t_sim, oscCount);
    }
    navigator.vibrate && navigator.vibrate(150);
  } else {
    msgEl.textContent = 'No alcanzaste el objetivo.';
    finalCodeInput && (finalCodeInput.value = 'FAILED');
  }
}

// simple token (same style as before)
function generateCode(Lval, thetaDeg, bval, timeTaken, osc){
  const s = `${Lval.toFixed(2)}|${thetaDeg}|${bval.toFixed(3)}|${timeTaken.toFixed(2)}|${osc}`;
  let h = 0;
  for(let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; }
  return 'PM-' + Math.abs(h).toString(36).toUpperCase().slice(0,8);
}

// main loop: accumulator pattern to integrate fixed steps
let lastRAF = null;
let accumulator = 0;
const minCrossInterval = 0.08;

function draw(){
  // background
  ctx.fillStyle = '#071018';
  ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);

  // pendulum visual
  const ox = canvas.clientWidth/2;
  const oy = 100;
  const pxPerM = getPxPerMeter();
  const pxLen = L * pxPerM;
  const x = ox + pxLen * Math.sin(theta);
  const y = oy + pxLen * Math.cos(theta);

  // rod
  ctx.strokeStyle = '#bfcbd8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(x, y);
  ctx.stroke();

  // bob
  ctx.fillStyle = '#c84b4b';
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI*2);
  ctx.fill();

  // HUD small
  ctx.fillStyle = '#98a6b2';
  ctx.font = '14px Arial';
  ctx.fillText(`Oscilaciones: ${oscCount} / ${N_OSC}`, 12, canvas.clientHeight - 12);
}

function rafLoop(ts){
  if(!lastRAF) lastRAF = ts;
  let frameTime = (ts - lastRAF)/1000; // seconds
  lastRAF = ts;

  // cap frameTime to avoid spiral of death
  frameTime = Math.min(frameTime, 0.05);

  if(!paused && !finished){
    accumulator += frameTime;
    // consume fixed steps
    while(accumulator >= dt_fixed){
      // integrate RK4 step
      const out = rk4_step(theta, omega, dt_fixed);
      theta = out[0];
      omega = out[1];
      t_sim += dt_fixed;
      accumulator -= dt_fixed;

      // check crossing with debounce
      checkOscillation(t_sim);
      // if amplitude drops below threshold early and not enough oscillations -> finish(false)
      const amp_now = Math.abs(theta);
      if(amp_now < Math.abs(degToRad(theta0_deg)) * AMP_THRESHOLD_RATIO && t_sim > 0.5 && !finished){
        if(oscCount >= N_OSC){
          finish(true);
        } else {
          finish(false);
        }
      }
      // safety cutoff
      if(t_sim > 120 && !finished) finish(false);
    }
  }

  // draw + update UI
  draw();
  timeEl.textContent = t_sim.toFixed(2);
  thetaEl.textContent = radToDeg(theta).toFixed(1);
  omegaEl.textContent = omega.toFixed(3);

  requestAnimationFrame(rafLoop);
}
requestAnimationFrame(rafLoop);
