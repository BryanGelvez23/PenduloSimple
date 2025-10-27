/* script.js - Versión corregida 🔥 Péndulo Master */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

/* Ajustar tamaño */
function resizeCanvas(){
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* UI */
const L_slider = document.getElementById('L');
const theta0_slider = document.getElementById('theta0');
const b_slider = document.getElementById('b');
const g_slider = document.getElementById('g');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const impulseBtn = document.getElementById('impulseBtn');

const timeEl = document.getElementById('time');
const thetaEl = document.getElementById('thetaDeg');
const omegaEl = document.getElementById('omegaVal');
const countEl = document.getElementById('osc-count'); // ✅ ARREGLADO
const msgEl = document.getElementById('message');

function degToRad(d){ return d * Math.PI/180; }
function radToDeg(r){ return r * 180/Math.PI; }

/* Variables físicas */
let L, b, g, theta, omega;
let dt = 0.016;
let t = 0;
let paused = true;

/* Conteo oscilaciones */
let lastSign;
let crossings;
let oscs;

/* Reset */
function resetSim(){
  L = parseFloat(L_slider.value);
  b = parseFloat(b_slider.value);
  g = parseFloat(g_slider.value);
  theta = degToRad(parseFloat(theta0_slider.value));
  omega = 0;
  t = 0;
  lastSign = Math.sign(theta);
  crossings = 0;
  oscs = 0;
  countEl.textContent = oscs;
  paused = true;
  msgEl.textContent = "Listo";
}
resetSim();

/* ✅ Botones */
startBtn.onclick = () => { paused = false; msgEl.textContent = "En movimiento"; };
pauseBtn.onclick = () => { paused = true; msgEl.textContent = "Pausado"; };
resetBtn.onclick = resetSim;

impulseBtn.onclick = () => {
  omega += 2.0;
  msgEl.textContent = "¡Impulso!";
};

/* ✅ Sliders ya NO reinician oscilaciones */
[L_slider, theta0_slider, b_slider, g_slider].forEach(sl => {
  sl.addEventListener("input", () => {
    L = parseFloat(L_slider.value);
    b = parseFloat(b_slider.value);
    g = parseFloat(g_slider.value);
  });
});

/* 🔥 Física con RK4 mejorada (no se detiene en 0°) */
function alpha(theta, omega){
  return -(g/L)*Math.sin(theta) - b*omega;
}

function physicsStep(){
  let k1_th = omega;
  let k1_w = alpha(theta, omega);

  let k2_th = omega + 0.5*dt*k1_w;
  let k2_w = alpha(theta + 0.5*dt*k1_th, omega + 0.5*dt*k1_w);

  let k3_th = omega + 0.5*dt*k2_w;
  let k3_w = alpha(theta + 0.5*dt*k2_th, omega + 0.5*dt*k2_w);

  let k4_th = omega + dt*k3_w;
  let k4_w = alpha(theta + dt*k3_th, omega + dt*k3_w);

  theta += (dt/6)*(k1_th + 2*k2_th + 2*k3_th + k4_th);
  omega += (dt/6)*(k1_w + 2*k2_w + 2*k3_w + k4_w);

  t += dt;

  /* ✅ Contar oscilaciones correctamente */
  let s = Math.sign(theta);
  if(s !== 0 && s !== lastSign){
    crossings++;
    if(crossings % 2 === 0){
      oscs++;
      countEl.textContent = oscs;
    }
    lastSign = s;
  }
}

/* Dibujo */
function draw(){
  ctx.fillStyle = "#09131C";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const ox = canvas.width/2;
  const oy = 80;
  const px = ox + L*80*Math.sin(theta);
  const py = oy + L*80*Math.cos(theta);

  ctx.strokeStyle = "#d2dae4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(px, py);
  ctx.stroke();

  ctx.fillStyle = "#E84F4F";
  ctx.beginPath();
  ctx.arc(px, py, 16, 0, Math.PI*2);
  ctx.fill();
}

/* Loop */
function loop(){
  if(!paused) physicsStep();
  draw();
  timeEl.textContent = t.toFixed(2);
  thetaEl.textContent = radToDeg(theta).toFixed(1);
  omegaEl.textContent = omega.toFixed(3);
  requestAnimationFrame(loop);
}
loop();
