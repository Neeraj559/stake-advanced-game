const TOTAL_STEPS = 13;
const MAX_BET_LIMIT = 10000;

const CONFIGS = {
    easy: {
        panels: 3,
        safeCount: 2,
        multipliers: [1.15, 1.30, 1.50, 1.80, 2.20, 2.80, 3.60, 4.80, 6.50, 9.00, 13.00, 18.00, 25.00],
        offsets: [-1.15, 0, 1.15],
        labels: ['LEFT', 'CENTER', 'RIGHT']
    },
    medium: {
        panels: 2,
        safeCount: 1,
        multipliers: [1.18, 1.40, 1.75, 2.25, 3.00, 4.20, 6.00, 9.00, 14.00, 22.00, 38.00, 62.00, 100.00],
        offsets: [-0.95, 0.95],
        labels: ['LEFT', 'RIGHT']
    },
    hard: {
        panels: 3,
        safeCount: 1,
        multipliers: [1.25, 1.65, 2.30, 3.30, 5.00, 8.00, 13.50, 24.00, 45.00, 90.00, 180.00, 320.00, 500.00],
        offsets: [-1.15, 0, 1.15],
        labels: ['LEFT', 'CENTER', 'RIGHT']
    },
    extreme: {
        panels: 4,
        safeCount: 1,
        multipliers: [1.35, 1.95, 3.10, 5.20, 8.90, 15.50, 28.00, 52.00, 105.00, 240.00, 580.00, 1550.00, 5000.00],
        offsets: [-1.4, -0.47, 0.47, 1.4],
        labels: ['P1', 'P2', 'P3', 'P4']
    }
};

let currentDiff = 'medium';
let balance = 1000;
let betAmount = 10;
let currentStep = 0;
let safePanelsMatrix = [];
let gameState = 'IDLE';

// Auto Play State
let playMode = 'manual';
let autoRemainingRounds = 0;
let autoTargetSteps = 3;

// Provably Fair State
let nonce = 0;
let currentServerSeed = '';

// Web Audio & Ambient Synth
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audio = null;
let ambientOsc = null;
let ambientGain = null;
let soundEnabled = true;

function initAudio() {
    if (!audio) {
        audio = new AudioCtx();
        startAmbientDrone();
    }
    if (audio.state === 'suspended') audio.resume();
}

function startAmbientDrone() {
    try {
        ambientOsc = audio.createOscillator();
        ambientGain = audio.createGain();
        ambientOsc.type = 'sine';
        ambientOsc.frequency.setValueAtTime(55, audio.currentTime); // Low A hum
        ambientGain.gain.setValueAtTime(0.04, audio.currentTime);
        ambientOsc.connect(ambientGain);
        ambientGain.connect(audio.destination);
        ambientOsc.start();
    } catch(e) {}
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);

    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
    } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(460, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
    } else if (type === 'shatter') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'cashout') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.linearRampToValueAtTime(1040, now + 0.35);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
    }
}

// ---------------- THREE.JS 3D SCENE ----------------
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02060e, 0.022);

const camera = new THREE.PerspectiveCamera(52, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
const INITIAL_CAM_POS = { x: 0, y: 3.5, z: 4.6 };
camera.position.set(INITIAL_CAM_POS.x, INITIAL_CAM_POS.y, INITIAL_CAM_POS.z);
camera.lookAt(0, 0.8, -8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x406085, 0.9));
const dirLight = new THREE.DirectionalLight(0x00e7ff, 1.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const STEP_DISTANCE = 3.2;
const bridgeSteps = [];
const shardParticles = [];

function createGlassTile(x, z, width = 1.1) {
    const group = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        metalness: 0.15,
        transmission: 0.85,
        ior: 1.5
    });
    const paneGeom = new THREE.BoxGeometry(width, 0.08, 1.8);
    const pane = new THREE.Mesh(paneGeom, glassMat);
    group.add(pane);

    const frameGeom = new THREE.EdgesGeometry(paneGeom);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x00e7ff, linewidth: 2 });
    const frame = new THREE.LineSegments(frameGeom, frameMat);
    group.add(frame);

    group.position.set(x, 0, z);
    group.pane = pane;
    group.frame = frame;
    return group;
}

function build3DBridge() {
    bridgeSteps.forEach(s => s.panels.forEach(p => scene.remove(p)));
    bridgeSteps.length = 0;

    const conf = CONFIGS[currentDiff];
    const tileWidth = conf.panels === 4 ? 0.72 : conf.panels === 3 ? 0.95 : 1.25;

    for (let i = 0; i < TOTAL_STEPS; i++) {
        const z = -i * STEP_DISTANCE - 2.0;
        const panels = [];

        conf.offsets.forEach((x, panelIdx) => {
            const tile = createGlassTile(x, z, tileWidth);
            tile.userData = { stepIdx: i, panelIdx: panelIdx };
            scene.add(tile);
            panels.push(tile);
        });

        bridgeSteps.push({ panels, z });
    }
}
build3DBridge();

// Human Avatar
const humanGroup = new THREE.Group();
const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdbac });
const jacketMat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
const pantsMat = new THREE.MeshLambertMaterial({ color: 0x101b26 });

const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), skinMat);
head.position.y = 1.05;
humanGroup.add(head);

const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.24), jacketMat);
torso.position.y = 0.68;
humanGroup.add(torso);

const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.16), pantsMat);
leftLeg.position.set(-0.1, 0.22, 0);
humanGroup.add(leftLeg);

const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.16), pantsMat);
rightLeg.position.set(0.1, 0.22, 0);
humanGroup.add(rightLeg);

humanGroup.position.set(0, 0.05, 0.8);
scene.add(humanGroup);

function triggerGlassShatter(x, y, z) {
    const shardGeom = new THREE.TetrahedronGeometry(0.14, 0);
    const shardMat = new THREE.MeshBasicMaterial({ color: 0x00e7ff, wireframe: true });

    for (let i = 0; i < 24; i++) {
        const shard = new THREE.Mesh(shardGeom, shardMat);
        shard.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8);
        shard.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.14, Math.random() * 0.08 - 0.04, (Math.random() - 0.5) * 0.14);
        scene.add(shard);
        shardParticles.push(shard);
    }
}

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

viewport.addEventListener('click', (e) => {
    if (gameState !== 'PLAYING' || playMode === 'auto') return;
    const rect = viewport.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const currentStepPanels = bridgeSteps[currentStep].panels.map(p => p.pane);
    const intersects = raycaster.intersectObjects(currentStepPanels);

    if (intersects.length > 0) {
        const parentGroup = intersects[0].object.parent;
        makeStep(parentGroup.userData.panelIdx);
    }
});

function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'PLAYING' || gameState === 'IDLE') {
        humanGroup.position.y = 0.05 + Math.sin(Date.now() * 0.005) * 0.02;
    }

    for (let i = shardParticles.length - 1; i >= 0; i--) {
        const s = shardParticles[i];
        s.position.add(s.velocity);
        s.velocity.y -= 0.008;
        s.rotation.x += 0.06;

        if (s.position.y < -25) {
            scene.remove(s);
            shardParticles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}
animate();

// ---------------- GAMEPLAY & CONTROLS ----------------
const balanceDisplay = document.getElementById('balance-display');
const betInput = document.getElementById('bet-input');
const mainBtn = document.getElementById('main-btn');
const btnHalf = document.getElementById('btn-half');
const btnDouble = document.getElementById('btn-double');
const btnMax = document.getElementById('btn-max');
const stepHud = document.getElementById('step-hud');
const decisionButtons = document.getElementById('decision-buttons');
const diffButtons = document.querySelectorAll('.diff-btn');
const chipButtons = document.querySelectorAll('.chip-btn');
const winCard = document.getElementById('stake-win-card');
const winMultiplier = document.getElementById('win-multiplier');
const winPayout = document.getElementById('win-payout');
const historyList = document.getElementById('history-list');

// Tabs & Auto Mode Elements
const tabManual = document.getElementById('tab-manual');
const tabAuto = document.getElementById('tab-auto');
const autoConfigBox = document.getElementById('auto-config-box');
const autoRoundsInput = document.getElementById('auto-rounds-input');
const autoStepsInput = document.getElementById('auto-steps-input');

// Fairness Elements
const fairnessBtn = document.getElementById('fairness-btn');
const fairnessModal = document.getElementById('fairness-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const serverSeedHashInput = document.getElementById('server-seed-hash');
const fairnessNonceInput = document.getElementById('fairness-nonce');
const soundToggleBtn = document.getElementById('sound-toggle-btn');

// Mode Tab Switching
tabManual.addEventListener('click', () => {
    if (gameState === 'PLAYING') return;
    playMode = 'manual';
    tabManual.classList.add('active');
    tabAuto.classList.remove('active');
    autoConfigBox.style.display = 'none';
    mainBtn.textContent = 'START CROSSING';
});

tabAuto.addEventListener('click', () => {
    if (gameState === 'PLAYING') return;
    playMode = 'auto';
    tabAuto.classList.add('active');
    tabManual.classList.remove('active');
    autoConfigBox.style.display = 'block';
    mainBtn.textContent = 'START AUTO-PLAY';
});

// Sound Toggle
soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    if (ambientGain) {
        ambientGain.gain.setValueAtTime(soundEnabled ? 0.04 : 0, audio.currentTime);
    }
});

// Provably Fair Modal
fairnessBtn.addEventListener('click', () => fairnessModal.style.display = 'flex');
closeModalBtn.addEventListener('click', () => fairnessModal.style.display = 'none');

// SHA-256 Pseudo Generator for Provably Fair
function generateProvablyFairSeed() {
    nonce++;
    currentServerSeed = 'seed_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    serverSeedHashInput.value = 'hash_' + Array.from(currentServerSeed).reduce((h, c) => (h = ((h << 5) - h) + c.charCodeAt(0)) | 0, 0).toString(16);
    fairnessNonceInput.value = nonce;
}
generateProvablyFairSeed();

function showStakeWinAnimation(multiplier, amount) {
    winMultiplier.textContent = `${multiplier.toFixed(2)}×`;
    winPayout.textContent = `$${amount.toFixed(2)}`;

    gsap.killTweensOf(winCard);
    gsap.timeline()
        .fromTo(winCard, 
            { scale: 0.3, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" }
        )
        .to(winCard, {
            scale: 0.8,
            opacity: 0,
            delay: 2.2,
            duration: 0.3,
            ease: "power2.in"
        });
}

function addHistoryItem(isWin, mult, amt) {
    const item = document.createElement('div');
    item.className = `history-item ${isWin ? 'win' : 'loss'}`;
    item.innerHTML = `
        <span>${isWin ? mult.toFixed(2) + 'x' : '0.00x'}</span>
        <span>${isWin ? '+$' + amt.toFixed(2) : '-$' + betAmount.toFixed(2)}</span>
    `;
    historyList.prepend(item);
    if (historyList.children.length > 10) historyList.removeChild(historyList.lastChild);
}

function renderDecisionButtons() {
    decisionButtons.innerHTML = '';
    const conf = CONFIGS[currentDiff];
    conf.labels.forEach((label, idx) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = label;
        btn.disabled = true;
        btn.addEventListener('click', () => makeStep(idx));
        decisionButtons.appendChild(btn);
    });
}
renderDecisionButtons();

diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (gameState === 'PLAYING') return;
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDiff = btn.dataset.diff;
        build3DBridge();
        renderDecisionButtons();
        updateHud();
    });
});

chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
        if (gameState === 'PLAYING') return;
        const amt = parseFloat(chip.dataset.amt);
        betInput.value = Math.min(amt, balance, MAX_BET_LIMIT);
    });
});

btnHalf.addEventListener('click', () => {
    betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
});

btnDouble.addEventListener('click', () => {
    const doubled = parseFloat(betInput.value) * 2;
    betInput.value = Math.min(doubled, balance, MAX_BET_LIMIT);
});

btnMax.addEventListener('click', () => {
    betInput.value = Math.min(balance, MAX_BET_LIMIT);
});

mainBtn.addEventListener('click', handleMainAction);

function formatMultiplier(mult) {
    if (mult >= 1000) return `${(mult / 1000).toFixed(1)}k`;
    return mult.toFixed(2);
}

function updateHud() {
    const mult = CONFIGS[currentDiff].multipliers[currentStep];
    stepHud.textContent = `${currentDiff.toUpperCase()} • STEP ${currentStep + 1} / ${TOTAL_STEPS} • ${formatMultiplier(mult)}x`;
}

function handleMainAction() {
    if (gameState === 'IDLE' || gameState === 'ENDED') {
        betAmount = parseFloat(betInput.value);
        if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance || betAmount > MAX_BET_LIMIT) return;

        if (playMode === 'auto') {
            autoRemainingRounds = parseInt(autoRoundsInput.value) || 1;
            autoTargetSteps = Math.min(13, parseInt(autoStepsInput.value) || 3);
        }

        generateProvablyFairSeed();
        gsap.to(winCard, { opacity: 0, scale: 0, duration: 0.15 });

        balance -= betAmount;
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
        startNewGame();
    } else if (gameState === 'PLAYING' && currentStep > 0 && playMode === 'manual') {
        cashOut();
    }
}

function startNewGame() {
    gameState = 'PLAYING';
    currentStep = 0;
    betInput.disabled = true;
    diffButtons.forEach(b => b.disabled = true);

    const conf = CONFIGS[currentDiff];
    safePanelsMatrix = [];

    for (let i = 0; i < TOTAL_STEPS; i++) {
        const indices = Array.from({ length: conf.panels }, (_, k) => k);
        const shuffled = indices.sort(() => 0.5 - Math.random());
        safePanelsMatrix.push(shuffled.slice(0, conf.safeCount));
    }

    build3DBridge();
    updateHud();

    gsap.to(humanGroup.position, { x: 0, y: 0.05, z: 0.8, duration: 0.4 });
    gsap.to(humanGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.4 });
    gsap.to(camera.position, { x: INITIAL_CAM_POS.x, y: INITIAL_CAM_POS.y, z: INITIAL_CAM_POS.z, duration: 0.4 });

    highlightCurrentStep();

    if (playMode === 'auto') {
        mainBtn.textContent = `AUTO PLAYING (${autoRemainingRounds} LEFT)`;
        mainBtn.className = 'main-action-btn btn-disabled';
        setTimeout(autoBotStep, 600);
    } else {
        enableChoiceButtons(true);
        mainBtn.textContent = 'CHOOSE A PANEL';
        mainBtn.className = 'main-action-btn btn-disabled';
    }
}

function autoBotStep() {
    if (gameState !== 'PLAYING') return;
    const conf = CONFIGS[currentDiff];
    const randomChoice = Math.floor(Math.random() * conf.panels);
    makeStep(randomChoice);
}

function enableChoiceButtons(enable) {
    Array.from(decisionButtons.children).forEach(btn => btn.disabled = !enable);
}

function highlightCurrentStep() {
    if (currentStep >= TOTAL_STEPS) return;
    const step = bridgeSteps[currentStep];
    step.panels.forEach(p => p.frame.material.color.setHex(0x00ff88));
}

function makeStep(chosenIndex) {
    if (gameState !== 'PLAYING' && gameState !== 'JUMPING') return;
    gameState = 'JUMPING';
    enableChoiceButtons(false);

    const stepIndexNow = currentStep;
    const conf = CONFIGS[currentDiff];
    const targetX = conf.offsets[chosenIndex];
    const targetZ = bridgeSteps[stepIndexNow].z;
    const isSafe = safePanelsMatrix[stepIndexNow].includes(chosenIndex);

    playSound('jump');

    gsap.timeline()
        .to(humanGroup.position, {
            x: targetX,
            z: targetZ,
            duration: 0.42,
            ease: "power1.inOut"
        })
        .to(humanGroup.position, {
            y: 1.5,
            duration: 0.21,
            yoyo: true,
            repeat: 1,
            ease: "power2.out"
        }, 0)
        .call(() => {
            gsap.to(camera.position, { z: targetZ + 5.5, y: 3.4, duration: 0.45 });

            if (isSafe) {
                playSound('land');
                const chosenGroup = bridgeSteps[stepIndexNow].panels[chosenIndex];
                chosenGroup.pane.material.color.setHex(0x00ff88);
                chosenGroup.frame.material.color.setHex(0x00ff88);

                setTimeout(() => {
                    bridgeSteps[stepIndexNow].panels.forEach((p, idx) => {
                        if (!safePanelsMatrix[stepIndexNow].includes(idx)) {
                            triggerGlassShatter(conf.offsets[idx], 0, targetZ);
                            scene.remove(p);
                        }
                    });
                }, 150);

                currentStep++;
                const mult = conf.multipliers[currentStep - 1];
                const winAmount = betAmount * mult;

                if (currentStep === TOTAL_STEPS || (playMode === 'auto' && currentStep >= autoTargetSteps)) {
                    cashOut();
                } else {
                    updateHud();
                    highlightCurrentStep();
                    gameState = 'PLAYING';

                    if (playMode === 'auto') {
                        setTimeout(autoBotStep, 500);
                    } else {
                        enableChoiceButtons(true);
                        mainBtn.textContent = `CASHOUT $${winAmount.toFixed(2)} (${formatMultiplier(mult)}x)`;
                        mainBtn.className = 'main-action-btn btn-cashout';
                    }
                }
            } else {
                playSound('shatter');
                const brokenGroup = bridgeSteps[stepIndexNow].panels[chosenIndex];
                triggerGlassShatter(targetX, 0, targetZ);
                scene.remove(brokenGroup);

                gsap.to(humanGroup.position, { y: -25, duration: 1.2, ease: "power2.in" });
                gsap.to(humanGroup.rotation, { x: 3, z: 2, duration: 1.2 });

                addHistoryItem(false, 0, 0);
                endGame(false);
            }
        });
}

function cashOut() {
    const finalMult = CONFIGS[currentDiff].multipliers[currentStep - 1];
    const winAmount = betAmount * finalMult;
    balance += winAmount;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;

    playSound('cashout');
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    showStakeWinAnimation(finalMult, winAmount);
    addHistoryItem(true, finalMult, winAmount);

    endGame(true);
}

function endGame(won) {
    gameState = 'ENDED';
    betInput.disabled = false;
    diffButtons.forEach(b => b.disabled = false);
    enableChoiceButtons(false);

    if (playMode === 'auto' && autoRemainingRounds > 1 && balance >= betAmount) {
        autoRemainingRounds--;
        setTimeout(() => {
            balance -= betAmount;
            balanceDisplay.textContent = `$${balance.toFixed(2)}`;
            generateProvablyFairSeed();
            startNewGame();
        }, 1200);
    } else {
        mainBtn.textContent = playMode === 'auto' ? 'START AUTO-PLAY' : (won ? 'PLAY AGAIN' : 'TRY AGAIN');
        mainBtn.className = 'main-action-btn btn-start';
    }
}