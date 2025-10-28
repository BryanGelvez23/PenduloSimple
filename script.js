// Variables globales del sistema
let canvas, ctx;
let energyCanvas, energyCtx;
let animationId;
let isRunning = false;
let isPaused = false;
let gameStarted = false;
let gameCompleted = false;

// Variables físicas del péndulo
let theta = 0;          // Ángulo actual (radianes)
let omega = 0;          // Velocidad angular (rad/s)
let L = 1.0;           // Longitud del péndulo (m)
let g = 9.8;           // Gravedad (m/s²)
let b = 0.1;           // Coeficiente de amortiguación
let m = 1;             // Masa (kg)

// Parámetros de simulación
const dt = 0.016;      // Paso de tiempo fijo (60 FPS)
let time = 0;          // Tiempo transcurrido
let oscCount = 0;      // Contador de oscilaciones
let lastCrossTime = 0; // Último tiempo de cruce por cero
const minCrossInterval = 0.15; // Intervalo mínimo entre cruces (debounce natural)

// Parámetros del juego
const TARGET_OSCILLATIONS = 5;
const TIME_LIMIT = 20;
let gameStartTime = 0;

// Parámetros de impulso (deshabilitado en el juego)
const impulseForce = 5;    // Fuerza del impulso (N)
const impulseDuration = 0.05; // Duración del impulso (s)

// Elementos del DOM
let lengthSlider, angleSlider, dampingSlider, gravitySlider;
let startBtn, pauseBtn, resetBtn, impulseBtn;
let timeValue, angleDisplay, velocityValue, oscCountValue, statusMessage;
let gameStatusText, gameStatusIndicator;
let toggleGraphBtn;

// Datos para gráfica de energía
let energyData = [];
const MAX_ENERGY_POINTS = 200;

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeCanvas();
    setupEventListeners();
    updateDisplay();
    drawPendulum();
    updateGameStatus('Preparado para jugar', '🎮');
});

function initializeElements() {
    // Canvas principal
    canvas = document.getElementById('pendulumCanvas');
    ctx = canvas.getContext('2d');
    
    // Canvas de energía
    energyCanvas = document.getElementById('energyCanvas');
    if (energyCanvas) {
        energyCtx = energyCanvas.getContext('2d');
    }
    
    // Sliders
    lengthSlider = document.getElementById('lengthSlider');
    angleSlider = document.getElementById('angleSlider');
    dampingSlider = document.getElementById('dampingSlider');
    gravitySlider = document.getElementById('gravitySlider');
    
    // Botones
    startBtn = document.getElementById('startBtn');
    pauseBtn = document.getElementById('pauseBtn');
    resetBtn = document.getElementById('resetBtn');
    impulseBtn = document.getElementById('impulseBtn');
    toggleGraphBtn = document.getElementById('toggleGraphBtn');
    
    // Elementos de display
    timeValue = document.getElementById('timeValue');
    angleDisplay = document.getElementById('angleDisplay');
    velocityValue = document.getElementById('velocityValue');
    oscCountValue = document.getElementById('oscCountValue');
    statusMessage = document.getElementById('statusMessage');
    gameStatusText = document.getElementById('gameStatusText');
    gameStatusIndicator = document.getElementById('gameStatusIndicator');
}

function initializeCanvas() {
    // Configurar canvas principal para alta resolución
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Configurar canvas de energía si existe
    if (energyCanvas) {
        const energyRect = energyCanvas.getBoundingClientRect();
        energyCanvas.width = energyRect.width * dpr;
        energyCanvas.height = energyRect.height * dpr;
        energyCtx.scale(dpr, dpr);
        
        energyCanvas.style.width = energyRect.width + 'px';
        energyCanvas.style.height = energyRect.height + 'px';
    }
}

function setupEventListeners() {
    // Sliders
    lengthSlider.addEventListener('input', function() {
        L = parseFloat(this.value);
        document.getElementById('lengthValue').textContent = L.toFixed(1);
        if (!isRunning) {
            resetSimulation();
        }
    });
    
    angleSlider.addEventListener('input', function() {
        const angleDeg = parseFloat(this.value);
        theta = angleDeg * Math.PI / 180;
        document.getElementById('angleValue').textContent = angleDeg;
        if (!isRunning) {
            resetSimulation();
        }
    });
    
    dampingSlider.addEventListener('input', function() {
        b = parseFloat(this.value);
        document.getElementById('dampingValue').textContent = b.toFixed(2);
    });
    
    gravitySlider.addEventListener('input', function() {
        g = parseFloat(this.value);
        document.getElementById('gravityValue').textContent = g.toFixed(1);
    });
    
    // Botones
    startBtn.addEventListener('click', startSimulation);
    pauseBtn.addEventListener('click', pauseSimulation);
    resetBtn.addEventListener('click', resetSimulation);
    impulseBtn.addEventListener('click', applyImpulse);
    
    if (toggleGraphBtn) {
        toggleGraphBtn.addEventListener('click', toggleEnergyGraph);
    }
    
    // Actualizar valores iniciales
    document.getElementById('lengthValue').textContent = L.toFixed(1);
    document.getElementById('angleValue').textContent = (theta * 180 / Math.PI).toFixed(0);
    document.getElementById('dampingValue').textContent = b.toFixed(2);
    document.getElementById('gravityValue').textContent = g.toFixed(1);
}

// Función principal de integración RK4 - Movimiento natural sin detenciones artificiales
function rk4Step() {
    // Ecuación del péndulo: θ'' = -(g/L)sin(θ) - bω
    // La fricción (b) causa desaceleración gradual, NO detención abrupta
    const k1_theta = omega;
    const k1_omega = -(g/L) * Math.sin(theta) - b * omega;
    
    const k2_theta = omega + (dt/2) * k1_omega;
    const k2_omega = -(g/L) * Math.sin(theta + (dt/2) * k1_theta) - b * (omega + (dt/2) * k1_omega);
    
    const k3_theta = omega + (dt/2) * k2_omega;
    const k3_omega = -(g/L) * Math.sin(theta + (dt/2) * k2_theta) - b * (omega + (dt/2) * k2_omega);
    
    const k4_theta = omega + dt * k3_omega;
    const k4_omega = -(g/L) * Math.sin(theta + dt * k3_theta) - b * (omega + dt * k3_omega);
    
    // Actualizar posición y velocidad - el péndulo continúa su movimiento naturalmente
    theta += (dt/6) * (k1_theta + 2*k2_theta + 2*k3_theta + k4_theta);
    omega += (dt/6) * (k1_omega + 2*k2_omega + 2*k3_omega + k4_omega);
}

// Detección mejorada de cruces por cero - SIN detención artificial
function checkZeroCrossing() {
    const currentTime = time;
    
    // Solo contar cruces si ha pasado suficiente tiempo desde el último
    if (currentTime - lastCrossTime >= minCrossInterval) {
        // Detectar cruce por cero de manera más natural
        const prevTheta = theta - omega * dt;
        const currentTheta = theta;
        
        // Verificar cambio de signo del ángulo (cruzar por cero)
        // SIN restricciones de velocidad que causen detención artificial
        if (Math.sign(prevTheta) !== Math.sign(currentTheta) && 
            Math.abs(currentTheta) < 0.3) { // Rango más amplio para detección natural
            
            oscCount++;
            lastCrossTime = currentTime;
            
            // Actualizar estado del juego
            if (gameStarted) {
                updateGameStatus(`Oscilación ${oscCount}/${TARGET_OSCILLATIONS}`, '🎯');
                updateStatus(`Oscilación ${oscCount} detectada!`);
            }
        }
    }
}

// Aplicar impulso físico (deshabilitado en el juego)
function applyImpulse() {
    if (!isRunning || gameStarted) return;
    
    const impulse = (impulseForce * impulseDuration) / (m * L);
    omega += impulse;
    
    updateStatus(`Impulso aplicado! Velocidad: ${omega.toFixed(2)} rad/s`);
}

// Verificar condiciones de finalización del juego - Movimiento natural
function checkGameConditions() {
    if (!gameStarted) return false;
    
    const gameTime = time - gameStartTime;
    
    // Éxito: 5 oscilaciones completadas en menos de 20 segundos
    if (oscCount >= TARGET_OSCILLATIONS && gameTime <= TIME_LIMIT) {
        finishGame(true, `¡RETO COMPLETADO! ${oscCount} oscilaciones en ${gameTime.toFixed(2)}s`);
        return true;
    }
    
    // Fallo: Tiempo excedido
    if (gameTime > TIME_LIMIT) {
        finishGame(false, `Fallaste: Tiempo excedido (${TIME_LIMIT}s)`);
        return true;
    }
    
    // Fallo: Energía muy baja antes de completar las oscilaciones
    // Solo verificar después de un tiempo mínimo para permitir movimiento natural
    const energy = calculateTotalEnergy();
    if (energy < 0.001 && oscCount < TARGET_OSCILLATIONS && gameTime > 10) {
        finishGame(false, "Fallaste: Energía insuficiente");
        return true;
    }
    
    return false;
}

// Calcular energía total del sistema
function calculateTotalEnergy() {
    const kinetic = 0.5 * m * L * L * omega * omega;
    const potential = m * g * L * (1 - Math.cos(theta));
    return kinetic + potential;
}

// Finalizar juego
function finishGame(success, message) {
    isRunning = false;
    isPaused = false;
    gameCompleted = true;
    
    updateButtonStates();
    
    if (success) {
        updateGameStatus('¡ÉXITO!', '🏆');
        updateStatus(message, 'success');
    } else {
        updateGameStatus('Fallaste', '❌');
        updateStatus(message, 'error');
    }
}

// Bucle principal de animación
function animate() {
    if (!isRunning || isPaused) return;
    
    // Integración física
    rk4Step();
    
    // Actualizar tiempo
    time += dt;
    
    // Verificar cruces por cero
    checkZeroCrossing();
    
    // Verificar condiciones del juego
    if (checkGameConditions()) {
        return;
    }
    
    // Actualizar datos de energía
    updateEnergyData();
    
    // Actualizar display
    updateDisplay();
    
    // Dibujar péndulo
    drawPendulum();
    
    // Dibujar gráfica de energía
    drawEnergyGraph();
    
    // Continuar animación
    animationId = requestAnimationFrame(animate);
}

// Actualizar datos de energía para la gráfica
function updateEnergyData() {
    const totalEnergy = calculateTotalEnergy();
    const kinetic = 0.5 * m * L * L * omega * omega;
    const potential = m * g * L * (1 - Math.cos(theta));
    
    energyData.push({
        time: time,
        total: totalEnergy,
        kinetic: kinetic,
        potential: potential
    });
    
    // Mantener solo los últimos puntos
    if (energyData.length > MAX_ENERGY_POINTS) {
        energyData.shift();
    }
}

// Dibujar el péndulo
function drawPendulum() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Limpiar canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calcular posición del péndulo
    const pendulumLength = Math.min(L * 100, centerY - 50); // Escalar longitud
    const bobX = centerX + pendulumLength * Math.sin(theta);
    const bobY = centerY + pendulumLength * Math.cos(theta);
    
    // Dibujar línea del péndulo
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    
    // Dibujar punto de pivote
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Dibujar masa del péndulo
    ctx.fillStyle = '#f44336';
    ctx.beginPath();
    ctx.arc(bobX, bobY, 15, 0, 2 * Math.PI);
    ctx.fill();
    
    // Dibujar sombra de la masa
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(bobX + 3, bobY + 3, 15, 0, 2 * Math.PI);
    ctx.fill();
    
    // Dibujar trayectoria circular (opcional)
    if (isRunning) {
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pendulumLength, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

// Dibujar gráfica de energía
function drawEnergyGraph() {
    if (!energyCanvas || !energyCtx || energyData.length < 2) return;
    
    const width = energyCanvas.width;
    const height = energyCanvas.height;
    
    // Limpiar canvas
    energyCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    energyCtx.fillRect(0, 0, width, height);
    
    // Encontrar valores máximos para escalar
    const maxEnergy = Math.max(...energyData.map(d => d.total));
    const minTime = energyData[0].time;
    const maxTime = energyData[energyData.length - 1].time;
    
    if (maxEnergy === 0) return;
    
    // Dibujar líneas de energía
    energyCtx.lineWidth = 2;
    
    // Energía total
    energyCtx.strokeStyle = '#4CAF50';
    energyCtx.beginPath();
    energyData.forEach((point, index) => {
        const x = (point.time - minTime) / (maxTime - minTime) * width;
        const y = height - (point.total / maxEnergy) * height;
        
        if (index === 0) {
            energyCtx.moveTo(x, y);
        } else {
            energyCtx.lineTo(x, y);
        }
    });
    energyCtx.stroke();
    
    // Energía cinética
    energyCtx.strokeStyle = '#2196F3';
    energyCtx.beginPath();
    energyData.forEach((point, index) => {
        const x = (point.time - minTime) / (maxTime - minTime) * width;
        const y = height - (point.kinetic / maxEnergy) * height;
        
        if (index === 0) {
            energyCtx.moveTo(x, y);
        } else {
            energyCtx.lineTo(x, y);
        }
    });
    energyCtx.stroke();
    
    // Energía potencial
    energyCtx.strokeStyle = '#FF9800';
    energyCtx.beginPath();
    energyData.forEach((point, index) => {
        const x = (point.time - minTime) / (maxTime - minTime) * width;
        const y = height - (point.potential / maxEnergy) * height;
        
        if (index === 0) {
            energyCtx.moveTo(x, y);
        } else {
            energyCtx.lineTo(x, y);
        }
    });
    energyCtx.stroke();
}

// Actualizar display
function updateDisplay() {
    const gameTime = gameStarted ? time - gameStartTime : time;
    timeValue.textContent = gameTime.toFixed(2);
    angleDisplay.textContent = (theta * 180 / Math.PI).toFixed(2);
    velocityValue.textContent = omega.toFixed(2);
    oscCountValue.textContent = oscCount;
}

// Actualizar mensaje de estado
function updateStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = `status-text ${type}`;
}

// Actualizar estado del juego
function updateGameStatus(text, icon) {
    if (gameStatusText) {
        gameStatusText.textContent = text;
    }
    if (gameStatusIndicator) {
        const iconElement = gameStatusIndicator.querySelector('.status-icon');
        if (iconElement) {
            iconElement.textContent = icon;
        }
    }
}

// Actualizar estados de botones
function updateButtonStates() {
    startBtn.disabled = isRunning;
    pauseBtn.disabled = !isRunning;
    impulseBtn.disabled = gameStarted || !isRunning; // Deshabilitado durante el juego
}

// Control de simulación
function startSimulation() {
    if (isRunning) return;
    
    isRunning = true;
    isPaused = false;
    gameStarted = true;
    gameCompleted = false;
    gameStartTime = time;
    oscCount = 0;
    lastCrossTime = 0;
    energyData = [];
    
    updateButtonStates();
    updateGameStatus('Jugando...', '🎮');
    updateStatus("¡Desafío iniciado! Logra 5 oscilaciones en menos de 20 segundos", '');
    
    animate();
}

function pauseSimulation() {
    if (!isRunning) return;
    
    isPaused = !isPaused;
    updateButtonStates();
    
    if (isPaused) {
        updateGameStatus('Pausado', '⏸️');
        updateStatus("Simulación pausada", 'warning');
    } else {
        updateGameStatus('Jugando...', '🎮');
        updateStatus("Simulación reanudada", '');
        animate();
    }
}

function resetSimulation() {
    // Detener animación
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Resetear variables
    isRunning = false;
    isPaused = false;
    gameStarted = false;
    gameCompleted = false;
    time = 0;
    oscCount = 0;
    lastCrossTime = 0;
    energyData = [];
    
    // Resetear ángulo inicial
    const angleDeg = parseFloat(angleSlider.value);
    theta = angleDeg * Math.PI / 180;
    omega = 0;
    
    // Actualizar estados
    updateButtonStates();
    updateDisplay();
    updateGameStatus('Preparado para jugar', '🎮');
    updateStatus("Simulación reiniciada. Configura el péndulo y presiona 'Iniciar Desafío'", '');
    
    // Redibujar
    drawPendulum();
    if (energyCanvas) {
        energyCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        energyCtx.fillRect(0, 0, energyCanvas.width, energyCanvas.height);
    }
}

// Toggle gráfica de energía
function toggleEnergyGraph() {
    const container = document.getElementById('energyGraphContainer');
    if (container) {
        const isVisible = container.style.display !== 'none';
        container.style.display = isVisible ? 'none' : 'block';
        toggleGraphBtn.textContent = isVisible ? 'Mostrar Gráfica' : 'Ocultar Gráfica';
    }
}

// Manejar redimensionamiento de ventana
window.addEventListener('resize', function() {
    initializeCanvas();
    drawPendulum();
    if (energyCanvas) {
        drawEnergyGraph();
    }
});

// Prevenir comportamiento por defecto en algunos eventos
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) {
            pauseSimulation();
        } else if (!gameCompleted) {
            startSimulation();
        }
    }
});
