/* script.js - Péndulo Master (móvil friendly) */
/* Física: RK4, oscilaciones = cruces de signo del ángulo (contados por máximos o cruces hacia el mismo sentido) */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas(){
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// CONTROLES y elementos UI
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
const thetaDegEl = document.getElementById('thetaDeg');
const omegaEl = document.getElementById('omegaVal');
const countEl = document.getElementById('count');
const msgEl = document.getElementById('message');
const finalCodeInput = document.getElementById('finalCode');
const copyBtn = document.getElementById('copyBtn');

// defaults (SI UNIDADES físicas)
let L = parseFloat(L_slider.value);        // metros
let theta0_deg = parseFloat(theta0_slider.value);
let b = parseFloat(b_slider.value);
let g = parseFloat(g_slider.value);
let dt = 0.016; // 60 Hz sim
let paused = true;

// estado dinámico
let theta = degToRad(theta0_deg), omega = 0.0;
let t = 0.0;

// visual params
const origin = { x: canvas.clientWidth/2, y: 100 };
const scale_px_per_m = Math.min(canvas.clientWidth, 720) / 3.5; // adaptativo

// oscilaciones detection
let lastSign = Math.sign(theta);
let zeroCrosses = 0;
let amplitude0 = Math.abs(theta);
let oscCount = 0;
let finished = false;

// game rule: complete N oscillations before amplitude drops below threshold
const N_OSC = 5;
const AMP_THRESHOLD_RATIO = 0.20; // 20% of initial amplitude

// utility
function degToRad(d){ return d * Math.PI / 180; }
function radToDeg(r){ return r * 180 / Math.PI; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// update UI labels
function updateLabels(){
  Lval.textContent = L.toFixed(2);
  theta0val.textContent = Math.round(theta0_deg);
  bval.textContent = b.toFixed(3);
  gval.textContent = g.toFixed(2);
}

// RK4 step
function theta_dd(thet, omeg, g_local, L_local, b_local){
  return - (g_local / L_local) * Math.sin(thet) - b_local * omeg;
}
function rk4_step(theta, omega, dt, g_local, L_local, b_local){
  let k1_th = omega;
  let k1_w = theta_dd(theta, omega, g_local, L_local, b_local);

  let k2_th = omega + 0.5*dt*k1_w;
  let k2_w = theta_dd(theta + 0.5*dt*k1_th, omega + 0.5*dt*k1_w, g_local, L_local, b_local);

  let k3_th = omega + 0.5*dt*k2_w;
  let k3_w = theta_dd(theta + 0.5*dt*k2_th, omega + 0.5*dt*k2_w, g_local, L_local, b_local);

  let k4_th = omega + dt*k3_w;
  let k4_w = theta_dd(theta + dt*k3_th, omega + dt*k3_w, g_local, L_local, b_local);

  let theta_next = theta + (dt/6)*(k1_th + 2*k2_th + 2*k3_th + k4_th);
  let omega_next = omega + (dt/6)*(k1_w + 2*k2_w + 2*k3_w + k4_w);
  return [theta_next, omega_next];
}

// energy
function energies(theta, omega, g_local, L_local, m_local=1.0){
  let v = L_local * omega;
  let Ekin = 0.5 * m_local * v * v;
  let Epot = m_local * g_local * L_local * (1 - Math.cos(theta));
  return [Ekin, Epot, Ekin + Epot];
}

// reset
function resetSim(){
  L = parseFloat(L_slider.value);
  theta0_deg = parseFloat(theta0_slider.value);
  b = parseFloat(b_slider.value);
  g = parseFloat(g_slider.value);

  theta = degToRad(theta0_deg);
  omega = 0.0;
  t = 0.0;
  amplitude0 = Math.abs(theta);
  lastSign = Math.sign(theta);
  zeroCrosses = 0;
  oscCount = 0;
  finished = false;
  finalCodeInput.value = '';
  msgEl.textContent = 'Presiona Start';
  updateLabels();
}

resetSim();

// events
L_slider.addEventListener('input', e => {
  L = parseFloat(e.target.value);
  Lval.textContent = L.toFixed(2);
});
theta0_slider.addEventListener('input', e => {
  theta0_deg = parseFloat(e.target.value);
  theta0val.textContent = Math.round(theta0_deg);
});
b_slider.addEventListener('input', e => {
  b = parseFloat(e.target.value);
  bval.textContent = b.toFixed(3);
});
g_slider.addEventListener('input', e => {
  g = parseFloat(e.target.value);
  gval.textContent = g.toFixed(2);
});

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
  // impulses: physically meaningful impulse: F * dt_imp / (m*L)
  const F = 5.0;       // N
  const dt_imp = 0.05; // s
  const m = 1.0;
  omega += (F * dt_imp) / (m * L);
});

// copy final code
copyBtn && copyBtn.addEventListener('click', () => {
  finalCodeInput.select();
  document.execCommand('copy');
});

// drawing
function clear(){
  ctx.fillStyle = '#071018';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawPendulum(theta_local, L_local){
  const pxLength = L_local * scale_px_per_m;
  const ox = canvas.clientWidth/2;
  const oy = 100;
  const x = ox + pxLength * Math.sin(theta_local);
  const y = oy + pxLength * Math.cos(theta_local);

  // rod
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#bfcbd8';
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(x, y);
  ctx.stroke();

  // bob
  ctx.beginPath();
  ctx.fillStyle = '#c84b4b';
  ctx.arc(x,y,14,0,Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = '#ffcfcf';
  ctx.arc(x,y,8,0,Math.PI*2);
  ctx.fill();

  // anchor
  ctx.fillStyle = '#00ffd5';
  ctx.beginPath();
  ctx.arc(ox,oy,5,0,Math.PI*2);
  ctx.fill();

  return {x,y,ox,oy,pxLength};
}

let lastTimestamp = null;
function loop(timestamp){
  if(!lastTimestamp) lastTimestamp = timestamp;
  const elapsed = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if(!paused && !finished){
    // advance simulation in fixed dt steps to keep stability
    let acc = elapsed;
    while(acc > 0){
      const step = Math.min(dt, acc);
      const out = rk4_step(theta, omega, step, g, L, b);
      theta = out[0]; omega = out[1];
      t += step;
      acc -= step;

      // detect oscillation via signed maxima/zero-cross (count half-cycles -> convert)
      // we'll count crossings of sign with direction to estimate full oscillations
      const s = Math.sign(theta);
      if(s !== 0 && s !== lastSign){
        zeroCrosses++;
        lastSign = s;
        // every 2 zeroCrosses ~ 1 full oscillation (approx)
        if(zeroCrosses % 2 === 0){
          oscCount++;
          countEl.textContent = oscCount;
        }
      }

      // amplitude check (peak approx)
      // if amplitude decays below threshold ratio -> fail/finish
      if(Math.abs(theta) < amplitude0 * AMP_THRESHOLD_RATIO && t > 0.5){
        // if player already reached target, finish success; else fail
        if(oscCount >= N_OSC){
          finish(true);
        } else {
          finish(false);
        }
      }

      // safety: if very long time, finish
      if(t > 120){
        finish(false);
      }
    }
  }

  // render
  clear();
  const visual = drawPendulum(theta, L);
  // HUD
  timeEl.textContent = t.toFixed(2);
  thetaDegEl.textContent = radToDeg(theta).toFixed(1);
  omegaEl.textContent = omega.toFixed(3);

  // draw small trace (optional)
  // message
  ctx.font = "14px Inter, Arial";
  ctx.fillStyle = '#98a6b2';
  ctx.fillText(`Oscilaciones: ${oscCount} / ${N_OSC}`, 12, canvas.height/1.03);

  lastTimestamp = timestamp;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// finish: success true/false
function finish(success){
  finished = true;
  paused = true;
  if(success){
    msgEl.textContent = "¡Éxito! Has completado la tarea.";
    // generate code (hash small)
    const code = generateCode(L, theta0_deg, b, t, oscCount);
    finalCodeInput.value = code;
    navigator.vibrate && navigator.vibrate(200);
  } else {
    msgEl.textContent = "No alcanzaste el objetivo. Intenta otra vez.";
    finalCodeInput.value = "FAILED";
  }
}

// simple code generator (not cryptographic) to give a short token for Forms
function generateCode(Lval, thetaDeg, bval, timeTaken, osc){
  const s = `${Lval.toFixed(2)}|${thetaDeg}|${bval.toFixed(3)}|${timeTaken.toFixed(2)}|${osc}`;
  // simple hash
  let h = 0;
  for(let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; }
  return 'PM-' + Math.abs(h).toString(36).toUpperCase().slice(0,8);
}