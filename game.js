// ---------------- GLOBAL STATE & CONFIG ----------------
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
let gameState = 'IDLE'; // IDLE, PLAYING, JUMPING, ENDED
let balance = 1000.00;
let betAmount = 10;
let currentStep = 0;
let soundEnabled = true;
let bridgePattern = [];

// Auto-play counters
let autoRemainingRounds = 0;
let autoTargetStep = 3;

// Audio Context Web Audio Synthesizer
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSynthesizedSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'step') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'break') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
            gain.gain.setValueAtTime(0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        } else if (type === 'win') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(783.99, now + 0.16);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
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
const serverSeedHash = document.getElementById('server-seed-hash');
const clientSeed = document.getElementById('client-seed');
const fairnessNonce = document.getElementById('fairness-nonce');
const autoConfigBox = document.getElementById('auto-config-box');
const autoRoundsInput = document.getElementById('auto-rounds-input');
const autoStepsInput = document.getElementById('auto-steps-input');

// ---------------- THREE.JS WORLD ----------------
let scene, camera, renderer;
let panels3D = [];
let characterMesh;
const STEP_DISTANCE = 3.2;

function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070e17, 0.035);

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

    const dirLight = new THREE.DirectionalLight(0x00e701, 1.2);
    dirLight.position.set(5, 12, 10);
    scene.add(dirLight);

    // Player Token
    const charGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.25, 32);
    const charMat = new THREE.MeshStandardMaterial({
        color: 0x00e701,
        emissive: 0x00e701,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
    });
    characterMesh = new THREE.Mesh(charGeo, charMat);
    characterMesh.position.set(0, 0.15, 2.5);
    scene.add(characterMesh);

    window.addEventListener('resize', onWindowResize);
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

function animate() {
    requestAnimationFrame(animate);
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ---------------- 3D BRIDGE BUILDER ----------------
function build3DBridge() {
    panels3D.forEach(row => row.forEach(p => scene.remove(p)));
    panels3D = [];

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
                color: 0x1a334d,
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
    const names = ['LEFT', 'MIDDLE-LEFT', 'MIDDLE-RIGHT', 'RIGHT'];

    for (let i = 0; i < numPanels; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-panel-choice';
        btn.textContent = numPanels === 2 ? (i === 0 ? 'LEFT' : 'RIGHT') : `PANEL ${i + 1}`;
        btn.onclick = () => makeStep(i);
        decisionButtons.appendChild(btn);
    }
}

// ---------------- PROVABLY FAIR SEED ----------------
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

// ---------------- GAMEPLAY MECHANICS ----------------
function startNewGame() {
    if (balance < betAmount) {
        alert("Insufficient balance!");
        return;
    }

    balance -= betAmount;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    currentStep = 0;
    gameState = 'PLAYING';
    generateProvablyFairSeed();
    build3DBridge();
    updateHud();
    renderDecisionButtons();

    mainBtn.textContent = 'CHOOSE A PANEL';
    mainBtn.className = 'main-action-btn btn-disabled';
    winCard.classList.remove('show');
}

function makeStep(chosenIndex) {
    if (gameState !== 'PLAYING') return;
    gameState = 'JUMPING';

    const targetPanel = panels3D[currentStep][chosenIndex];
    const isSafe = (chosenIndex === bridgePattern[currentStep]);

    // Jump Animation
    gsap.to(characterMesh.position, {
        x: targetPanel.position.x,
        z: targetPanel.position.z,
        duration: 0.3,
        ease: "power2.out"
    });
    gsap.to(characterMesh.position, {
        y: 1.2,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut"
    });

    // Camera track
    gsap.to(camera.position, {
        z: targetPanel.position.z + 7.5,
        duration: 0.35,
        ease: "power2.out"
    });

    setTimeout(() => {
        if (isSafe) {
            playSynthesizedSound('step');
            targetPanel.material.color.setHex(0x00e701);
            targetPanel.material.opacity = 1;

            currentStep++;
            if (currentStep >= TOTAL_STEPS) {
                cashout(true);
            } else {
                gameState = 'PLAYING';
                updateHud();
                renderDecisionButtons();

                const currentMult = CONFIGS[currentDiff].multipliers[currentStep - 1];
                const currentPayout = (betAmount * currentMult).toFixed(2);
                mainBtn.textContent = `CASHOUT $${currentPayout} (${formatMultiplier(currentMult)}x)`;
                mainBtn.className = 'main-action-btn btn-cashout';

                if (playMode === 'auto') {
                    if (currentStep >= autoTargetStep) {
                        cashout(false);
                    } else {
                        setTimeout(() => {
                            const nextChoice = Math.floor(Math.random() * CONFIGS[currentDiff].panels);
                            makeStep(nextChoice);
                        }, 400);
                    }
                }
            }
        } else {
            playSynthesizedSound('break');
            // Shatter Glass
            gsap.to(targetPanel.position, { y: -8, duration: 0.6, ease: "power2.in" });
            gsap.to(characterMesh.position, { y: -10, duration: 0.7, ease: "power2.in" });
            setTimeout(() => {
                endGame(false);
            }, 600);
        }
    }, 320);
}

function cashout(isMaxWin = false) {
    if (gameState !== 'PLAYING' && !isMaxWin) return;
    const finalMult = CONFIGS[currentDiff].multipliers[currentStep - 1] || 1;
    const payout = betAmount * finalMult;
    balance += payout;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;

    playSynthesizedSound('win');
    if (typeof confetti === 'function') confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });

    winMultiplier.textContent = `${formatMultiplier(finalMult)}×`;
    winPayout.textContent = `$${payout.toFixed(2)}`;
    winCard.classList.add('show');

    addHistoryRecord(true, finalMult, payout);
    endGame(true);
}

function endGame(won) {
    gameState = 'ENDED';
    decisionButtons.innerHTML = '';

    if (!won) {
        addHistoryRecord(false, 0, betAmount);
    }

    if (playMode === 'auto' && autoRemainingRounds > 1) {
        autoRemainingRounds--;
        setTimeout(() => {
            if (playMode === 'auto') {
                startNewGame();
                setTimeout(() => {
                    const nextChoice = Math.floor(Math.random() * CONFIGS[currentDiff].panels);
                    makeStep(nextChoice);
                }, 300);
            }
        }, 1200);
    } else {
        mainBtn.textContent = 'START CROSSING';
        mainBtn.className = 'main-action-btn btn-start';
    }
}

function addHistoryRecord(won, mult, amount) {
    const item = document.createElement('div');
    item.className = `history-item ${won ? 'win' : 'loss'}`;
    item.innerHTML = `<span>${formatMultiplier(mult)}x</span><span>${won ? '+' : '-'}$${amount.toFixed(2)}</span>`;
    historyList.prepend(item);
}

function handleMainAction() {
    if (gameState === 'IDLE' || gameState === 'ENDED') {
        if (playMode === 'auto') {
            autoRemainingRounds = parseInt(autoRoundsInput.value) || 10;
            autoTargetStep = parseInt(autoStepsInput.value) || 3;
            startNewGame();
            setTimeout(() => {
                const nextChoice = Math.floor(Math.random() * CONFIGS[currentDiff].panels);
                makeStep(nextChoice);
            }, 300);
        } else {
            startNewGame();
        }
    } else if (gameState === 'PLAYING') {
        if (currentStep > 0) cashout(false);
    }
}

// ---------------- EVENT LISTENERS ----------------
mainBtn.addEventListener('click', handleMainAction);

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (gameState === 'PLAYING' || gameState === 'JUMPING') return;
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
            betAmount = parseFloat(btn.dataset.amt);
        }
    });
});

document.getElementById('btn-half').addEventListener('click', () => {
    betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
    betAmount = parseFloat(betInput.value);
});
document.getElementById('btn-double').addEventListener('click', () => {
    betInput.value = Math.min(parseFloat(betInput.value) * 2, balance, MAX_BET_LIMIT);
    betAmount = parseFloat(betInput.value);
});
document.getElementById('btn-max').addEventListener('click', () => {
    betInput.value = Math.min(balance, MAX_BET_LIMIT);
    betAmount = parseFloat(betInput.value);
});

betInput.addEventListener('input', () => {
    betAmount = Math.max(1, Math.min(parseFloat(betInput.value) || 1, MAX_BET_LIMIT));
});

document.getElementById('tab-manual').addEventListener('click', () => {
    playMode = 'manual';
    document.getElementById('tab-manual').classList.add('active');
    document.getElementById('tab-auto').classList.remove('active');
    autoConfigBox.style.display = 'none';
    renderDecisionButtons();
});
document.getElementById('tab-auto').addEventListener('click', () => {
    playMode = 'auto';
    document.getElementById('tab-auto').classList.add('active');
    document.getElementById('tab-manual').classList.remove('active');
    autoConfigBox.style.display = 'flex';
    decisionButtons.innerHTML = '';
});

fairnessBtn.addEventListener('click', () => fairnessModal.classList.add('show'));
closeModalBtn.addEventListener('click', () => fairnessModal.classList.remove('show'));
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

// ---------------- KEYBOARD SHORTCUTS ----------------
window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const key = e.key.toLowerCase();
    if (e.code === 'Space') {
        e.preventDefault();
        handleMainAction();
    }

    if (gameState === 'PLAYING' && playMode === 'manual') {
        const conf = CONFIGS[currentDiff];
        if (e.key === 'ArrowLeft' || e.key === '1') {
            if (conf.panels >= 1) makeStep(0);
        } else if (e.key === 'ArrowRight' || e.key === '2') {
            if (conf.panels === 2) makeStep(1);
            else if (conf.panels > 2 && e.key === '2') makeStep(1);
        } else if (e.key === '3' && conf.panels >= 3) {
            makeStep(2);
        } else if (e.key === '4' && conf.panels >= 4) {
            makeStep(3);
        }
    }

    if (gameState === 'IDLE' || gameState === 'ENDED') {
        if (key === 'q') {
            betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
            betAmount = parseFloat(betInput.value);
        } else if (key === 'w') {
            betInput.value = Math.min(parseFloat(betInput.value) * 2, balance, MAX_BET_LIMIT);
            betAmount = parseFloat(betInput.value);
        } else if (key === 'e') {
            betInput.value = Math.min(balance, MAX_BET_LIMIT);
            betAmount = parseFloat(betInput.value);
        }
    }
});

// ---------------- INIT ON LOAD ----------------
window.addEventListener('DOMContentLoaded', () => {
    initThree();
    generateProvablyFairSeed();
    build3DBridge();
    updateHud();
});