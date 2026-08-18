// ---------------- GLOBAL CONFIG ----------------
const TOTAL_STEPS = 13;
const MAX_BET_LIMIT = 10000;

const CONFIGS = {
    easy: {
        panels: 2,
        safe: 1,
        multipliers: [1.18, 1.40, 1.75, 2.15, 2.70, 3.40, 4.30, 5.50, 7.00, 9.00, 11.50, 15.00, 20.00]
    },
    medium: {
        panels: 2,
        safe: 1,
        multipliers: [1.18, 1.40, 1.75, 2.15, 2.70, 3.40, 4.30, 5.50, 7.00, 9.00, 11.50, 15.00, 20.00]
    },
    hard: {
        panels: 3,
        safe: 1,
        multipliers: [1.45, 2.15, 3.25, 4.90, 7.40, 11.20, 17.00, 26.00, 40.00, 62.00, 95.00, 145.00, 230.00]
    },
    extreme: {
        panels: 4,
        safe: 1,
        multipliers: [1.95, 3.85, 7.70, 15.40, 31.00, 62.00, 125.00, 250.00, 500.00, 1000.00, 2000.00, 4000.00, 8000.00]
    }
};

let currentDiff = 'medium';
let playMode = 'manual';
let currentTheme = localStorage.getItem('stake_theme') || 'neon';
let gameState = 'IDLE'; // IDLE, PLAYING, JUMPING, ENDED

let savedBalance = localStorage.getItem('stake_glass_balance');
let balance = savedBalance !== null ? parseFloat(savedBalance) : 1000.00;

let initialBaseBet = 10;
let currentBet = 10;
let currentStep = 0;
let soundEnabled = true;
let bridgePattern = [];

let isAutoRunning = false;
let autoRemainingBets = 0;
let autoTargetStep = 3;
let autoStartingBalance = balance;
let autoWinAction = 'reset';
let autoLossAction = 'increase';

let activeParticles = [];

// Session Analytics
let stats = {
    totalBets: 0,
    wins: 0,
    losses: 0,
    netProfit: 0.0,
    wagered: 0.0,
    bestMultiplier: 0.0,
    highestPayout: 0.0
};

function triggerHaptic(type) {
    if ('vibrate' in navigator) {
        if (type === 'step') navigator.vibrate(35);
        else if (type === 'break') navigator.vibrate([70, 50, 120]);
        else if (type === 'win') navigator.vibrate([40, 40, 40, 40, 80]);
    }
}

function loadSavedStats() {
    const saved = localStorage.getItem('stake_glass_stats');
    if (saved) {
        try { stats = Object.assign(stats, JSON.parse(saved)); } catch (e) {}
    }
    updateStatsUI();
}

function saveStats() {
    localStorage.setItem('stake_glass_stats', JSON.stringify(stats));
    updateStatsUI();
}

function updateStatsUI() {
    const netEl = document.getElementById('stat-net-profit');
    const winRateEl = document.getElementById('stat-win-rate');
    const totalBetsEl = document.getElementById('stat-total-bets');
    const wlRatioEl = document.getElementById('stat-wl-ratio');
    const bestMultEl = document.getElementById('stat-best-mult');
    const highestPayoutEl = document.getElementById('stat-highest-payout');
    const wageredEl = document.getElementById('stat-wagered');

    if (!netEl) return;

    netEl.textContent = `${stats.netProfit >= 0 ? '+' : '-'}$${Math.abs(stats.netProfit).toFixed(2)}`;
    netEl.className = `stat-val ${stats.netProfit >= 0 ? 'positive' : 'negative'}`;

    const winRate = stats.totalBets > 0 ? ((stats.wins / stats.totalBets) * 100).toFixed(1) : '0.0';
    winRateEl.textContent = `${winRate}%`;
    totalBetsEl.textContent = stats.totalBets;
    wlRatioEl.textContent = `${stats.wins} / ${stats.losses}`;
    bestMultEl.textContent = `${stats.bestMultiplier.toFixed(2)}x`;
    highestPayoutEl.textContent = `$${stats.highestPayout.toFixed(2)}`;
    wageredEl.textContent = `$${stats.wagered.toFixed(2)}`;
}

function recordGameStats(won, mult, bet, payout) {
    stats.totalBets++;
    stats.wagered += bet;
    if (won) {
        stats.wins++;
        const profit = payout - bet;
        stats.netProfit += profit;
        if (mult > stats.bestMultiplier) stats.bestMultiplier = mult;
        if (payout > stats.highestPayout) stats.highestPayout = payout;
    } else {
        stats.losses++;
        stats.netProfit -= bet;
    }
    saveStats();
}

function saveState() {
    localStorage.setItem('stake_glass_balance', balance.toFixed(2));
    if (gameState === 'PLAYING' || gameState === 'JUMPING') {
        const activeGame = {
            currentDiff,
            currentBet,
            currentStep,
            bridgePattern,
            gameState: 'PLAYING'
        };
        localStorage.setItem('stake_glass_active_round', JSON.stringify(activeGame));
    } else {
        localStorage.removeItem('stake_glass_active_round');
    }
}

// ---------------- AUDIO SYNTHESIS ----------------
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playSynthesizedSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        if (type === 'step') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'break') {
            const bufferSize = ctx.sampleRate * 0.45;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1800, now);
            filter.frequency.exponentialRampToValueAtTime(6000, now + 0.25);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.85, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);

            [1900, 2800, 3600, 4800].forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq + Math.random() * 150, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.35 + idx * 0.05);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + idx * 0.05);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.45);
            });
        } else if (type === 'win') {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.07);
                gain.gain.setValueAtTime(0.25, now + i * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.07);
                osc.stop(now + i * 0.07 + 0.35);
            });
        }
    } catch (e) {}
}

// ---------------- DOM REFS ----------------
const viewport = document.getElementById('viewport');
const balanceDisplay = document.getElementById('balance-display');
const betInput = document.getElementById('bet-input');
const mainBtn = document.getElementById('main-btn');
const stepHud = document.getElementById('step-hud');
const multBar = document.getElementById('mult-bar');
const decisionButtons = document.getElementById('decision-buttons');
const winCard = document.getElementById('stake-win-card');
const winMultiplier = document.getElementById('win-multiplier');
const winPayout = document.getElementById('win-payout');
const historyList = document.getElementById('history-list');
const soundBtn = document.getElementById('sound-toggle-btn');
const fairnessBtn = document.getElementById('fairness-btn');
const fairnessModal = document.getElementById('fairness-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const statsBtn = document.getElementById('stats-btn');
const statsModal = document.getElementById('stats-modal');
const closeStatsBtn = document.getElementById('close-stats-btn');
const resetStatsBtn = document.getElementById('reset-stats-btn');
const themeBtn = document.getElementById('theme-toggle-btn');
const brandTitle = document.getElementById('brand-title');
const serverSeedHash = document.getElementById('server-seed-hash');
const clientSeed = document.getElementById('client-seed');
const fairnessNonce = document.getElementById('fairness-nonce');

const autoConfigBox = document.getElementById('auto-config-box');
const autoRoundsInput = document.getElementById('auto-rounds-input');
const autoStepsInput = document.getElementById('auto-steps-input');
const winResetBtn = document.getElementById('win-reset-btn');
const winIncInput = document.getElementById('win-inc-input');
const lossResetBtn = document.getElementById('loss-reset-btn');
const lossDoubleBtn = document.getElementById('loss-double-btn');
const lossIncInput = document.getElementById('loss-inc-input');
const stopProfitInput = document.getElementById('stop-profit-input');
const stopLossInput = document.getElementById('stop-loss-input');

// ---------------- THREE.JS WORLD ----------------
let scene, camera, renderer, dirLight;
let panels3D = [];
let characterMesh;
const STEP_DISTANCE = 3.2;

function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(currentTheme === 'neon' ? 0x070e17 : 0x11080e, 0.035);

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 7.5);
    camera.lookAt(0, 0.5, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    viewport.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(currentTheme === 'neon' ? 0x00e701 : 0xff007a, 1.2);
    dirLight.position.set(5, 12, 10);
    scene.add(dirLight);

    const charGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.25, 32);
    const primaryHex = currentTheme === 'neon' ? 0x00e701 : 0xff007a;
    const charMat = new THREE.MeshStandardMaterial({
        color: primaryHex,
        emissive: primaryHex,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
    });
    characterMesh = new THREE.Mesh(charGeo, charMat);
    characterMesh.position.set(0, 0.15, 2.5);
    scene.add(characterMesh);

    window.addEventListener('resize', onWindowResize);
    initTouchSwipe();
    animate();
}

function onWindowResize() {
    if (!renderer || !viewport) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ---------------- PARTICLES ----------------
function triggerGlassShatter(position, width, length) {
    const shardCount = 28;
    const shardGeo = new THREE.TetrahedronGeometry(0.18, 0);
    const shardMat = new THREE.MeshStandardMaterial({
        color: currentTheme === 'neon' ? 0x88ccee : 0xff88bb,
        emissive: currentTheme === 'neon' ? 0x225577 : 0x551133,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.85
    });

    for (let i = 0; i < shardCount; i++) {
        const mesh = new THREE.Mesh(shardGeo, shardMat);
        mesh.position.set(
            position.x + (Math.random() - 0.5) * width,
            position.y + (Math.random() * 0.1),
            position.z + (Math.random() - 0.5) * length
        );
        mesh.scale.set(Math.random() * 1.4 + 0.6, Math.random() * 1.4 + 0.6, Math.random() * 1.4 + 0.6);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 5.5,
            Math.random() * 4 + 2,
            (Math.random() - 0.5) * 5.5
        );
        const rotSpeed = new THREE.Vector3(
            Math.random() * 10 - 5,
            Math.random() * 10 - 5,
            Math.random() * 10 - 5
        );

        scene.add(mesh);
        activeParticles.push({ mesh, velocity, rotSpeed, lifetime: 1.5, age: 0 });
    }
}

function updateParticles(delta) {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.age += delta;
        p.velocity.y -= 14.5 * delta;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.rotation.x += p.rotSpeed.x * delta;
        p.mesh.rotation.y += p.rotSpeed.y * delta;
        p.mesh.rotation.z += p.rotSpeed.z * delta;

        if (p.mesh.material.opacity > 0) {
            p.mesh.material.opacity = Math.max(0, 1 - (p.age / p.lifetime));
        }

        if (p.age >= p.lifetime) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            activeParticles.splice(i, 1);
        }
    }
}

let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    updateParticles(delta);

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ---------------- 3D BRIDGE BUILDER ----------------
function build3DBridge() {
    panels3D.forEach(row => row.forEach(p => scene.remove(p)));
    panels3D = [];

    activeParticles.forEach(p => scene.remove(p.mesh));
    activeParticles = [];

    const numPanels = CONFIGS[currentDiff].panels;
    const panelWidth = numPanels === 2 ? 1.4 : numPanels === 3 ? 1.0 : 0.8;
    const spacing = panelWidth + 0.25;

    for (let r = 0; r < TOTAL_STEPS; r++) {
        const rowPanels = [];
        const zPos = -r * STEP_DISTANCE;

        for (let c = 0; c < numPanels; c++) {
            const xPos = (c - (numPanels - 1) / 2) * spacing;
            const geo = new THREE.BoxGeometry(panelWidth, 0.1, 1.8);
            const mat = new THREE.MeshStandardMaterial({
                color: currentTheme === 'neon' ? 0x1a334d : 0x3d172e,
                roughness: 0.1,
                metalness: 0.8,
                transparent: true,
                opacity: 0.8
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(xPos, 0, zPos);
            scene.add(mesh);
            rowPanels.push(mesh);
        }
        panels3D.push(rowPanels);
    }

    resetPlayerPosition();
}

function resetPlayerPosition() {
    gsap.killTweensOf(characterMesh.position);
    gsap.killTweensOf(camera.position);
    characterMesh.visible = true;
    characterMesh.position.set(0, 0.15, 2.5);
    camera.position.set(0, 4.5, 7.5);
    camera.lookAt(0, 0.5, 0);
}

// ---------------- HUD & CONTROLS ----------------
function formatMultiplier(val) {
    return Number(val).toFixed(2);
}

function renderMultiplierBar() {
    if (!multBar) return;
    multBar.innerHTML = '';
    const mults = CONFIGS[currentDiff].multipliers;
    mults.forEach((m, idx) => {
        const pill = document.createElement('div');
        pill.className = `multiplier-pill ${idx === currentStep ? 'active' : idx < currentStep ? 'passed' : ''}`;
        pill.textContent = `${formatMultiplier(m)}x`;
        multBar.appendChild(pill);
    });
}

function updateHud() {
    const mult = CONFIGS[currentDiff].multipliers[currentStep] || 1;
    if (stepHud) {
        stepHud.textContent = `${currentDiff.toUpperCase()} • STEP ${currentStep + 1} / ${TOTAL_STEPS} • ${formatMultiplier(mult)}x`;
    }
    renderMultiplierBar();
}

function renderDecisionButtons() {
    decisionButtons.innerHTML = '';
    if (gameState !== 'PLAYING' || playMode !== 'manual') return;

    const numPanels = CONFIGS[currentDiff].panels;
    for (let i = 0; i < numPanels; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-panel-choice';
        btn.textContent = numPanels === 2 ? (i === 0 ? 'LEFT' : 'RIGHT') : `PANEL ${i + 1}`;
        btn.onclick = () => makeStep(i);
        decisionButtons.appendChild(btn);
    }
}

// ---------------- TOUCH / SWIPE GESTURES ----------------
function initTouchSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;

    viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
        if (gameState !== 'PLAYING' || playMode !== 'manual') return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        const diffY = e.changedTouches[0].screenY - touchStartY;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
            const conf = CONFIGS[currentDiff];
            if (conf.panels === 2) {
                if (diffX < 0) makeStep(0);
                else makeStep(1);
            }
        }
    }, { passive: true });
}

// ---------------- PROVABLY FAIR ----------------
function generateProvablyFairSeed() {
    const randomHex = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    serverSeedHash.value = randomHex;
    fairnessNonce.value = Math.floor(Math.random() * 900000 + 100000);

    const conf = CONFIGS[currentDiff];
    bridgePattern = [];
    for (let i = 0; i < TOTAL_STEPS; i++) {
        const safeIndex = Math.floor(Math.random() * conf.panels);
        bridgePattern.push(safeIndex);
    }
}

// ---------------- RESTORATION & FLOW ----------------
function restoreActiveGameIfAny() {
    const savedRound = localStorage.getItem('stake_glass_active_round');
    if (!savedRound) return false;

    try {
        const data = JSON.parse(savedRound);
        if (data && data.gameState === 'PLAYING') {
            currentDiff = data.currentDiff || 'medium';
            currentBet = data.currentBet || 10;
            currentStep = data.currentStep || 0;
            bridgePattern = data.bridgePattern || [];
            gameState = 'PLAYING';

            document.querySelectorAll('.diff-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.diff === currentDiff);
            });
            betInput.value = currentBet;

            build3DBridge();

            const primaryColor = currentTheme === 'neon' ? 0x00e701 : 0xff007a;
            for (let step = 0; step < currentStep; step++) {
                const safePanelIndex = bridgePattern[step];
                if (panels3D[step] && panels3D[step][safePanelIndex]) {
                    panels3D[step][safePanelIndex].material.color.setHex(primaryColor);
                    panels3D[step][safePanelIndex].material.opacity = 1;
                }
            }

            if (currentStep > 0) {
                const lastSafeIdx = bridgePattern[currentStep - 1];
                const lastPanel = panels3D[currentStep - 1][lastSafeIdx];
                characterMesh.position.set(lastPanel.position.x, 0.15, lastPanel.position.z);
                camera.position.set(lastPanel.position.x * 0.4, 4.2, lastPanel.position.z + 6.8);

                const currentMult = CONFIGS[currentDiff].multipliers[currentStep - 1];
                const currentPayout = (currentBet * currentMult).toFixed(2);
                mainBtn.textContent = `CASHOUT $${currentPayout} (${formatMultiplier(currentMult)}x)`;
                mainBtn.className = 'main-action-btn btn-cashout';
            } else {
                mainBtn.textContent = 'CHOOSE A PANEL';
                mainBtn.className = 'main-action-btn btn-disabled';
            }

            updateHud();
            renderDecisionButtons();
            return true;
        }
    } catch (e) {}
    return false;
}

function startNewGame() {
    if (balance < currentBet) {
        alert("Insufficient balance! Click Balance to Top-Up.");
        stopAutoPlay();
        return;
    }

    balance -= currentBet;
    currentStep = 0;
    gameState = 'PLAYING';
    generateProvablyFairSeed();
    saveState();

    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    build3DBridge();
    updateHud();
    renderDecisionButtons();

    if (playMode === 'manual') {
        mainBtn.textContent = 'CHOOSE A PANEL';
        mainBtn.className = 'main-action-btn btn-disabled';
    }
    winCard.classList.remove('show');
}

function makeStep(chosenIndex) {
    if (gameState !== 'PLAYING') return;
    gameState = 'JUMPING';

    const targetPanel = panels3D[currentStep][chosenIndex];
    const isSafe = (chosenIndex === bridgePattern[currentStep]);

    gsap.to(characterMesh.position, {
        x: targetPanel.position.x,
        z: targetPanel.position.z,
        duration: 0.28,
        ease: "power2.out"
    });
    gsap.to(characterMesh.position, {
        y: 1.25,
        duration: 0.14,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut"
    });

    gsap.to(camera.position, {
        x: targetPanel.position.x * 0.45,
        y: 4.2,
        z: targetPanel.position.z + 6.8,
        duration: 0.35,
        ease: "power2.out"
    });

    setTimeout(() => {
        if (isSafe) {
            triggerHaptic('step');
            playSynthesizedSound('step');
            const primaryColor = currentTheme === 'neon' ? 0x00e701 : 0xff007a;
            targetPanel.material.color.setHex(primaryColor);
            targetPanel.material.opacity = 1;

            currentStep++;
            saveState();

            if (currentStep >= TOTAL_STEPS) {
                cashout(true);
            } else {
                gameState = 'PLAYING';
                updateHud();
                renderDecisionButtons();

                const currentMult = CONFIGS[currentDiff].multipliers[currentStep - 1];
                const currentPayout = (currentBet * currentMult).toFixed(2);
                
                if (playMode === 'manual') {
                    mainBtn.textContent = `CASHOUT $${currentPayout} (${formatMultiplier(currentMult)}x)`;
                    mainBtn.className = 'main-action-btn btn-cashout';
                }

                if (playMode === 'auto' && isAutoRunning) {
                    if (currentStep >= autoTargetStep) {
                        cashout(false);
                    } else {
                        setTimeout(() => {
                            if (!isAutoRunning) return;
                            const nextChoice = Math.floor(Math.random() * CONFIGS[currentDiff].panels);
                            makeStep(nextChoice);
                        }, 320);
                    }
                }
            }
        } else {
            triggerHaptic('break');
            playSynthesizedSound('break');
            triggerGlassShatter(targetPanel.position, 1.4, 1.8);
            targetPanel.visible = false;

            gsap.to(camera.position, { y: 2.2, duration: 0.6, ease: "power1.in" });
            gsap.to(characterMesh.position, { y: -10, duration: 0.7, ease: "power2.in" });
            setTimeout(() => {
                endGame(false);
            }, 600);
        }
    }, 300);
}

function cashout(isMaxWin = false) {
    if (gameState !== 'PLAYING' && !isMaxWin) return;
    const finalMult = CONFIGS[currentDiff].multipliers[currentStep - 1] || 1;
    const payout = currentBet * finalMult;
    balance += payout;
    
    gameState = 'ENDED';
    saveState();
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;

    triggerHaptic('win');
    playSynthesizedSound('win');
    if (typeof confetti === 'function') confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

    winMultiplier.textContent = `${formatMultiplier(finalMult)}×`;
    winPayout.textContent = `$${payout.toFixed(2)}`;
    winCard.classList.add('show');

    addHistoryRecord(true, finalMult, payout);
    recordGameStats(true, finalMult, currentBet, payout);
    endGame(true);
}

function endGame(won) {
    gameState = 'ENDED';
    saveState();
    decisionButtons.innerHTML = '';

    if (!won) {
        addHistoryRecord(false, 0, currentBet);
        recordGameStats(false, 0, currentBet, 0);
    }

    if (playMode === 'auto' && isAutoRunning) {
        const profit = balance - autoStartingBalance;
        const stopProfit = parseFloat(stopProfitInput.value);
        const stopLoss = parseFloat(stopLossInput.value);

        if (!isNaN(stopProfit) && stopProfit > 0 && profit >= stopProfit) {
            stopAutoPlay("Target Profit Reached!");
            return;
        }
        if (!isNaN(stopLoss) && stopLoss > 0 && profit <= -stopLoss) {
            stopAutoPlay("Stop Loss Triggered!");
            return;
        }

        if (won) {
            if (autoWinAction === 'reset') {
                currentBet = initialBaseBet;
            } else {
                const incPct = parseFloat(winIncInput.value) || 0;
                currentBet = Math.min(currentBet * (1 + incPct / 100), MAX_BET_LIMIT, balance);
            }
        } else {
            if (autoLossAction === 'reset') {
                currentBet = initialBaseBet;
            } else {
                const incPct = parseFloat(lossIncInput.value) || 100;
                currentBet = Math.min(currentBet * (1 + incPct / 100), MAX_BET_LIMIT, balance);
            }
        }

        currentBet = parseFloat(currentBet.toFixed(2));
        betInput.value = currentBet;

        if (autoRemainingBets > 1 || autoRemainingBets === 0) {
            if (autoRemainingBets > 1) autoRemainingBets--;
            setTimeout(() => {
                if (!isAutoRunning) return;
                startNewGame();
                setTimeout(() => {
                    if (!isAutoRunning) return;
                    const nextChoice = Math.floor(Math.random() * CONFIGS[currentDiff].panels);
                    makeStep(nextChoice);
                }, 280);
            }, 900);
        } else {
            stopAutoPlay("Auto-Bet Completed!");
        }
    } else {
        mainBtn.textContent = 'START CROSSING';
        mainBtn.className = 'main-action-btn btn-start';
    }
}

function startAutoPlay() {
    isAutoRunning = true;
    initialBaseBet = parseFloat(betInput.value) || 10;
    currentBet = initialBaseBet;
    autoStartingBalance = balance;
    autoRemainingBets = parseInt(autoRoundsInput.value) || 0;
    autoTargetStep = Math.min(Math.max(parseInt(autoStepsInput.value) || 3, 1), 13);

    mainBtn.textContent = 'STOP AUTO-BET';
    mainBtn.className = 'main-action-btn btn-stop';

    startNewGame();
    setTimeout(() => {
        if (!isAutoRunning) return;
        const nextChoice = Math.floor(Math.random() * CONFIGS[currentDiff].panels);
        makeStep(nextChoice);
    }, 280);
}

function stopAutoPlay(msg) {
    isAutoRunning = false;
    currentBet = initialBaseBet;
    betInput.value = initialBaseBet;
    mainBtn.textContent = 'START AUTO-BET';
    mainBtn.className = 'main-action-btn btn-start';
    if (msg) alert(msg);
}

function addHistoryRecord(won, mult, amount) {
    const item = document.createElement('div');
    item.className = `history-item ${won ? 'win' : 'loss'}`;
    item.innerHTML = `<span>${formatMultiplier(mult)}x</span><span>${won ? '+' : '-'}$${amount.toFixed(2)}</span>`;
    historyList.prepend(item);

    const historyData = [];
    document.querySelectorAll('.history-item').forEach((el, i) => {
        if (i < 10) historyData.push(el.outerHTML);
    });
    localStorage.setItem('stake_glass_history', JSON.stringify(historyData));
}

function loadSavedHistory() {
    const savedHist = localStorage.getItem('stake_glass_history');
    if (savedHist) {
        try {
            const arr = JSON.parse(savedHist);
            historyList.innerHTML = arr.join('');
        } catch (e) {}
    }
}

function handleMainAction() {
    if (playMode === 'auto') {
        if (isAutoRunning) stopAutoPlay();
        else startAutoPlay();
    } else {
        if (gameState === 'IDLE' || gameState === 'ENDED') {
            currentBet = parseFloat(betInput.value) || 10;
            startNewGame();
        } else if (gameState === 'PLAYING') {
            if (currentStep > 0) cashout(false);
        }
    }
}

function applyTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('stake_theme', theme);

    const primaryColor = theme === 'neon' ? 0x00e701 : 0xff007a;
    themeBtn.textContent = theme === 'neon' ? '🎨 Neon' : '🦑 Squid';
    brandTitle.textContent = theme === 'neon' ? 'GLASS BRIDGE 3D' : 'SQUID BRIDGE 3D';

    if (scene) {
        scene.fog.color.setHex(theme === 'neon' ? 0x070e17 : 0x11080e);
        if (dirLight) dirLight.color.setHex(primaryColor);
        if (characterMesh) {
            characterMesh.material.color.setHex(primaryColor);
            characterMesh.material.emissive.setHex(primaryColor);
        }
    }
    build3DBridge();
    updateHud();
}

// ---------------- SMART KEYBOARD SHORTCUTS ----------------
window.addEventListener('keydown', (e) => {
    // Agar user kisi input field mein type kar raha ho toh trigger mat karo
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const key = e.key.toLowerCase();
    
    // Spacebar -> Start Game / Cashout / Stop Auto-Bet
    if (e.code === 'Space') {
        e.preventDefault();
        handleMainAction();
        return;
    }

    // Panels Navigation (Arrow Keys & Number Keys 1-4)
    if (gameState === 'PLAYING' && playMode === 'manual') {
        const conf = CONFIGS[currentDiff];
        if (e.key === 'ArrowLeft' || e.key === '1') {
            if (conf.panels >= 1) makeStep(0);
        } else if (e.key === 'ArrowRight' || e.key === '2') {
            if (conf.panels === 2) makeStep(1);
            else if (conf.panels > 2) makeStep(1);
        } else if (e.key === '3' && conf.panels >= 3) {
            makeStep(2);
        } else if (e.key === '4' && conf.panels >= 4) {
            makeStep(3);
        }
    }

    // Quick Bet Modifiers (Q = 1/2, W = 2x, E = MAX)
    if (gameState === 'IDLE' || gameState === 'ENDED') {
        if (key === 'q') {
            betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
            currentBet = parseFloat(betInput.value);
        } else if (key === 'w') {
            betInput.value = Math.min(parseFloat(betInput.value) * 2, balance, MAX_BET_LIMIT);
            currentBet = parseFloat(betInput.value);
        } else if (key === 'e') {
            betInput.value = Math.min(balance, MAX_BET_LIMIT);
            currentBet = parseFloat(betInput.value);
        }
    }
});

// ---------------- EVENT LISTENERS ----------------
mainBtn.addEventListener('click', handleMainAction);

// Balance Top-up on Click
document.querySelector('.wallet-box').addEventListener('click', () => {
    balance += 500;
    saveState();
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
});

// Theme Switcher
themeBtn.addEventListener('click', () => {
    const next = currentTheme === 'neon' ? 'squid' : 'neon';
    applyTheme(next);
});

// Strategy Settings
winResetBtn.addEventListener('click', () => {
    autoWinAction = 'reset';
    winResetBtn.classList.add('active');
    winIncInput.parentElement.style.opacity = '0.5';
});
winIncInput.addEventListener('input', () => {
    if (parseFloat(winIncInput.value) > 0) {
        autoWinAction = 'increase';
        winResetBtn.classList.remove('active');
        winIncInput.parentElement.style.opacity = '1';
    }
});

lossResetBtn.addEventListener('click', () => {
    autoLossAction = 'reset';
    lossResetBtn.classList.add('active');
    lossDoubleBtn.classList.remove('active');
    lossIncInput.parentElement.style.opacity = '0.5';
});
lossDoubleBtn.addEventListener('click', () => {
    autoLossAction = 'increase';
    lossIncInput.value = 100;
    lossDoubleBtn.classList.add('active');
    lossResetBtn.classList.remove('active');
    lossIncInput.parentElement.style.opacity = '1';
});
lossIncInput.addEventListener('input', () => {
    autoLossAction = 'increase';
    lossResetBtn.classList.remove('active');
    lossDoubleBtn.classList.toggle('active', lossIncInput.value === '100');
    lossIncInput.parentElement.style.opacity = '1';
});

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (gameState === 'PLAYING' || gameState === 'JUMPING' || isAutoRunning) return;
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDiff = btn.dataset.diff;
        build3DBridge();
        updateHud();
    });
});

document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (gameState === 'IDLE' || gameState === 'ENDED') {
            betInput.value = btn.dataset.amt;
            currentBet = parseFloat(btn.dataset.amt);
        }
    });
});

document.getElementById('btn-half').addEventListener('click', () => {
    betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
    currentBet = parseFloat(betInput.value);
});
document.getElementById('btn-double').addEventListener('click', () => {
    betInput.value = Math.min(parseFloat(betInput.value) * 2, balance, MAX_BET_LIMIT);
    currentBet = parseFloat(betInput.value);
});
document.getElementById('btn-max').addEventListener('click', () => {
    betInput.value = Math.min(balance, MAX_BET_LIMIT);
    currentBet = parseFloat(betInput.value);
});

betInput.addEventListener('input', () => {
    currentBet = Math.max(1, Math.min(parseFloat(betInput.value) || 1, MAX_BET_LIMIT));
});

document.getElementById('tab-manual').addEventListener('click', () => {
    if (isAutoRunning) stopAutoPlay();
    playMode = 'manual';
    document.getElementById('tab-manual').classList.add('active');
    document.getElementById('tab-auto').classList.remove('active');
    autoConfigBox.style.display = 'none';
    mainBtn.textContent = (gameState === 'PLAYING' && currentStep > 0) ? `CASHOUT $${(currentBet * CONFIGS[currentDiff].multipliers[currentStep-1]).toFixed(2)}` : 'START CROSSING';
    mainBtn.className = (gameState === 'PLAYING' && currentStep > 0) ? 'main-action-btn btn-cashout' : 'main-action-btn btn-start';
    renderDecisionButtons();
});

document.getElementById('tab-auto').addEventListener('click', () => {
    playMode = 'auto';
    document.getElementById('tab-auto').classList.add('active');
    document.getElementById('tab-manual').classList.remove('active');
    autoConfigBox.style.display = 'flex';
    mainBtn.textContent = isAutoRunning ? 'STOP AUTO-BET' : 'START AUTO-BET';
    mainBtn.className = isAutoRunning ? 'main-action-btn btn-stop' : 'main-action-btn btn-start';
    decisionButtons.innerHTML = '';
});

// Modals Trigger
fairnessBtn.addEventListener('click', () => fairnessModal.classList.add('show'));
closeModalBtn.addEventListener('click', () => fairnessModal.classList.remove('show'));

statsBtn.addEventListener('click', () => {
    updateStatsUI();
    statsModal.classList.add('show');
});
closeStatsBtn.addEventListener('click', () => statsModal.classList.remove('show'));

resetStatsBtn.addEventListener('click', () => {
    if (confirm("Reset all session analytics?")) {
        stats = { totalBets: 0, wins: 0, losses: 0, netProfit: 0.0, wagered: 0.0, bestMultiplier: 0.0, highestPayout: 0.0 };
        saveStats();
    }
});

soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

// ---------------- INIT ON LOAD ----------------
window.addEventListener('DOMContentLoaded', () => {
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    loadSavedHistory();
    loadSavedStats();
    initThree();
    applyTheme(currentTheme);
    generateProvablyFairSeed();

    const restored = restoreActiveGameIfAny();
    if (!restored) {
        build3DBridge();
        updateHud();
    }
});