/* script.js - Péndulo Simulación Física Realista */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

/********* CANVAS *********/
function resizeCanvas(){
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/********* UI *********/
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

/********* Estado físico *********/
let L = parseFloat(L_slider.value);
let theta0_deg = parseFloat(theta0_slider.value);
let b = parseFloat(b_slider.value);
let g = parseFloat(g_slider.value);
let dt = 0.016;
let paused = true;

let theta = degToRad(theta0_deg), omega = 0.0;
let t = 0.0;

/********* Visual *********/
const scale_px_per_m = Math.min(canvas.clientWidth, 720) / 3.5;

/********* Oscilaciones *********/
let lastSign = Math.sign(theta);
let zeroCrosses = 0;
let oscCount = 0;

/********* UTILS *********/
function degToRad(d){ return d * Math.PI / 180; }
function radToDeg(r){ return r * 180 / Math.PI; }

function updateLabels(){
  Lval.textContent = L.toFixed(2);
  theta0val.textContent = Math.round(theta0_deg);
  bval.textContent = b.toFixed(3);
  gval.textContent = g.toFixed(2);
}

/********* Física: RK4 *********/
function theta_dd(theta, omega, g_local, L_local, b_local){
  return - (g_local / L_local) * Math.sin(theta) - b_local * omega;
}
function rk4_step(theta, omega, dt){
  let k1_th = omega;
  let k1_w = theta_dd(theta, omega, g, L, b);

  let k2_th = omega + 0.5*dt*k1_w;
  let k2_w = theta_dd(theta + 0.5*dt*k1_th, omega + 0.5*dt*k1_w, g, L, b);

  let k3_th = omega + 0.5*dt*k2_w;
  let k3_w = theta_dd(theta + 0.5*dt*k2_th, omega + 0.5*dt*k2_w, g, L, b);

  let k4_th = omega + dt*k3_w;
  let k4_w = theta_dd(theta + dt*k3_th, omega + dt*k3_w, g, L, b);

  let theta_next = theta + (dt/6)*(k1_th + 2*k2_th + 2*k3_th + k4_th);
  let omega_next = omega + (dt/6)*(k1_w + 2*k2_w + 2*k3_w + k4_w);

  return [theta_next, omega_next];
}

/********* Reset *********/
function resetSim(){
  L = parseFloat(L_slider.value);
  theta0_deg = parseFloat(theta0_slider.value);
  b = parseFloat(b_slider.value);
  g = parseFloat(g_slider.value);

  theta = degToRad(theta0_deg);
  omega = 0.0;
  t = 0.0;
  lastSign = Math.sign(theta);
  zeroCrosses = 0;
  oscCount = 0;

  msgEl.textContent = 'Presiona Start';
  updateLabels();
}
resetSim();

/********* Eventos *********/
L_slider.addEventListener('input', () => { L = parseFloat(L_slider.value); updateLabels(); });
theta0_slider.addEventListener('input', () => { theta0_deg = parseFloat(theta0_slider.value); updateLabels(); });
b_slider.addEventListener('input', () => { b = parseFloat(b_slider.value); updateLabels(); });
g_slider.addEventListener('input', () => { g = parseFloat(g_slider.value); updateLabels(); });

startBtn.addEventListener('click', () => { paused = false; msgEl.textContent = 'Corriendo...'; });
pauseBtn.addEventListener('click', () => { paused = !paused; msgEl.textContent = paused ? 'Pausado' : 'Corriendo...'; });
resetBtn.addEventListener('click', resetSim);

impulseBtn.addEventListener('click', () => {
  omega += (5.0 * 0.05) / (1.0 * L); // impulso físico
});

/********* Draw *********/
function clear(){
  ctx.fillStyle = '#071018';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawPendulum(theta_local){
  const ox = canvas.clientWidth/2;
  const oy = 100;
  const pxLength = L * scale_px_per_m;
  const x = ox + pxLength * Math.sin(theta_local);
  const y = oy + pxLength * Math.cos(theta_local);

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#bfcbd8';
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(x, y);
  ctx.stroke();

  ctx.fillStyle = '#c84b4b';
  ctx.beginPath();
  ctx.arc(x,y,14,0,Math.PI*2);
  ctx.fill();
}

/********* Loop *********/
let lastTS = null;
function loop(ts){
  if(!lastTS) lastTS = ts;
  const elapsed = (ts - lastTS)/1000;
  lastTS = ts;

  if(!paused){
    let acc = elapsed;
    while(acc > 0){
      const step = Math.min(dt, acc);
      const r = rk4_step(theta, omega, step);
      theta = r[0];
      omega = r[1];
      t += step;
      acc -= step;

      const s = Math.sign(theta);
      if(s !== 0 && s !== lastSign){
        zeroCrosses++;
        lastSign = s;
        if(zeroCrosses % 2 === 0){
          oscCount++;
          countEl.textContent = oscCount;
        }
      }
    }
  }

  clear();
  drawPendulum(theta);

  timeEl.textContent = t.toFixed(2);
  thetaDegEl.textContent = radToDeg(theta).toFixed(1);
  omegaEl.textContent = omega.toFixed(3);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
