const TOTAL_STEPS = 13;

const CONFIGS = {
    easy: {
        panels: 3,
        safeCount: 2,
        multipliers: [1.18, 1.42, 1.75, 2.20, 2.85, 3.80, 5.20, 7.40, 9.80, 12.50, 15.00, 18.50, 25.00],
        offsets: [-1.15, 0, 1.15],
        labels: ['LEFT', 'CENTER', 'RIGHT']
    },
    medium: {
        panels: 2,
        safeCount: 1,
        multipliers: [1.96, 3.84, 7.52, 14.75, 28.90, 56.65, 111.00, 217.50, 426.00, 835.00, 1636.00, 3580.00, 7850.00],
        offsets: [-0.95, 0.95],
        labels: ['LEFT', 'RIGHT']
    },
    hard: {
        panels: 3,
        safeCount: 1,
        multipliers: [2.94, 8.64, 25.40, 74.70, 219.60, 645.70, 1898.00, 5580.00, 16400.00, 48200.00, 141700.00, 442000.00, 1510000.00],
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

// Web Audio Synth FX
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audio = null;

function playSound(type) {
    if (!audio) audio = new AudioCtx();
    if (audio.state === 'suspended') audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);

    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(460, now);
        gain.gain.setValueAtTime(0.35, now);
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

// ---------------- THREE.JS 3D MOUNTAIN ABYSS SCENE ----------------
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040810, 0.022);

const camera = new THREE.PerspectiveCamera(52, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
const INITIAL_CAM_POS = { x: 0, y: 3.4, z: 4.8 };
camera.position.set(INITIAL_CAM_POS.x, INITIAL_CAM_POS.y, INITIAL_CAM_POS.z);
camera.lookAt(0, 1.0, -4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

// Mountain Cliffs & Abyss Walls
function buildMountainValley() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x08101a, roughness: 0.9, metalness: 0.1, flatShading: true });
    
    // Left Mountain Wall
    const leftMtnGeom = new THREE.ConeGeometry(9, 45, 6);
    const leftMtn = new THREE.Mesh(leftMtnGeom, rockMat);
    leftMtn.position.set(-11, 2, -22);
    leftMtn.rotation.y = 0.4;
    scene.add(leftMtn);

    // Right Mountain Wall
    const rightMtnGeom = new THREE.ConeGeometry(10, 50, 7);
    const rightMtn = new THREE.Mesh(rightMtnGeom, rockMat);
    rightMtn.position.set(12, 4, -25);
    rightMtn.rotation.y = -0.6;
    scene.add(rightMtn);

    // Deep Fog Layer Plane in Abyss
    const fogGeom = new THREE.PlaneGeometry(60, 100);
    const fogMat = new THREE.MeshBasicMaterial({ color: 0x03070d, transparent: true, opacity: 0.85 });
    const fogPlane = new THREE.Mesh(fogGeom, fogMat);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.set(0, -6, -20);
    scene.add(fogPlane);
}
buildMountainValley();

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const moonLight = new THREE.DirectionalLight(0x00d2ff, 1.2);
moonLight.position.set(5, 15, 10);
scene.add(moonLight);

// Suspension Rails
function createBridgeStructure() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x162436, metalness: 0.85, roughness: 0.3 });
    const beamGeom = new THREE.CylinderGeometry(0.05, 0.05, 52, 16);

    const leftRail = new THREE.Mesh(beamGeom, railMat);
    leftRail.rotation.x = Math.PI / 2;
    leftRail.position.set(-1.8, -0.1, -22);
    scene.add(leftRail);

    const rightRail = new THREE.Mesh(beamGeom, railMat);
    rightRail.rotation.x = Math.PI / 2;
    rightRail.position.set(1.8, -0.1, -22);
    scene.add(rightRail);
}
createBridgeStructure();

const STEP_DISTANCE = 3.2;
const bridgeSteps = [];
const shardParticles = [];

function createGlassTile(x, z, width = 1.1) {
    const group = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.15,
        transmission: 0.82,
        ior: 1.52
    });
    const paneGeom = new THREE.BoxGeometry(width, 0.08, 1.7);
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
        const z = -i * STEP_DISTANCE - 1.8;
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

// 3D Human Avatar (Low-Poly Stylized Humanoid)
const humanGroup = new THREE.Group();

const skinMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
const suitMat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x111c26 });

// Head
const headGeom = new THREE.BoxGeometry(0.22, 0.24, 0.22);
const head = new THREE.Mesh(headGeom, skinMat);
head.position.y = 0.95;
humanGroup.add(head);

// Torso (Tracksuit Jacket)
const torsoGeom = new THREE.BoxGeometry(0.34, 0.44, 0.22);
const torso = new THREE.Mesh(torsoGeom, suitMat);
torso.position.y = 0.62;
humanGroup.add(torso);

// Legs
const legGeom = new THREE.BoxGeometry(0.12, 0.4, 0.14);
const leftLeg = new THREE.Mesh(legGeom, darkMat);
leftLeg.position.set(-0.09, 0.2, 0);
humanGroup.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeom, darkMat);
rightLeg.position.set(0.09, 0.2, 0);
humanGroup.add(rightLeg);

humanGroup.position.set(0, 0.05, 0.8);
scene.add(humanGroup);

// Glass Shatter Shards
function triggerGlassShatter(x, y, z) {
    const shardGeom = new THREE.TetrahedronGeometry(0.12, 0);
    const shardMat = new THREE.MeshBasicMaterial({ color: 0x00e7ff, wireframe: true });

    for (let i = 0; i < 24; i++) {
        const shard = new THREE.Mesh(shardGeom, shardMat);
        shard.position.set(x + (Math.random() - 0.5) * 0.7, y, z + (Math.random() - 0.5) * 0.7);
        shard.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.14, Math.random() * 0.08 - 0.04, (Math.random() - 0.5) * 0.14);
        scene.add(shard);
        shardParticles.push(shard);
    }
}

// Raycasting (Direct Click on 3D Glass)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

viewport.addEventListener('click', (e) => {
    if (gameState !== 'PLAYING') return;
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

// Render Loop
function animate() {
    requestAnimationFrame(animate);

    // Human Breathing Sway
    if (gameState === 'PLAYING' || gameState === 'IDLE') {
        humanGroup.position.y = 0.05 + Math.sin(Date.now() * 0.005) * 0.02;
    }

    // Shard Physics in Abyss
    for (let i = shardParticles.length - 1; i >= 0; i--) {
        const s = shardParticles[i];
        s.position.add(s.velocity);
        s.velocity.y -= 0.008;
        s.rotation.x += 0.06;

        if (s.position.y < -20) {
            scene.remove(s);
            shardParticles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}
animate();

// ---------------- GAME CONTROLS & LOGIC ----------------
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
        betInput.value = chip.dataset.amt;
    });
});

btnHalf.addEventListener('click', () => betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2)));
btnDouble.addEventListener('click', () => betInput.value = Math.min(balance, Math.floor(parseFloat(betInput.value) * 2)));
btnMax.addEventListener('click', () => betInput.value = balance);

mainBtn.addEventListener('click', handleMainAction);

function formatMultiplier(mult) {
    if (mult >= 1000000) return `${(mult / 1000000).toFixed(2)}M`;
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
        if (isNaN(betAmount) || betAmount <= 0 || betAmount > balance) return;

        balance -= betAmount;
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
        startNewGame();
    } else if (gameState === 'PLAYING' && currentStep > 0) {
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

    // Reset Human & Camera
    gsap.to(humanGroup.position, { x: 0, y: 0.05, z: 0.8, duration: 0.4 });
    gsap.to(humanGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.4 });
    gsap.to(camera.position, { x: INITIAL_CAM_POS.x, y: INITIAL_CAM_POS.y, z: INITIAL_CAM_POS.z, duration: 0.4 });

    highlightCurrentStep();
    enableChoiceButtons(true);
    mainBtn.textContent = 'CHOOSE A PANEL';
    mainBtn.className = 'main-action-btn btn-disabled';
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
    if (gameState !== 'PLAYING') return;
    gameState = 'JUMPING';
    enableChoiceButtons(false);

    const conf = CONFIGS[currentDiff];
    const targetX = conf.offsets[chosenIndex];
    const targetZ = bridgeSteps[currentStep].z;
    const isSafe = safePanelsMatrix[currentStep].includes(chosenIndex);

    playSound('jump');

    // Human Realistic Jump Arc
    gsap.timeline()
        .to(humanGroup.position, {
            x: targetX,
            z: targetZ,
            duration: 0.45,
            ease: "power1.inOut"
        })
        .to(humanGroup.position, {
            y: 1.8,
            duration: 0.225,
            yoyo: true,
            repeat: 1,
            ease: "power2.out"
        }, 0)
        .call(() => {
            gsap.to(camera.position, { z: targetZ + 5.2, y: 3.0, duration: 0.45 });

            if (isSafe) {
                playSound('land');
                const chosenGroup = bridgeSteps[currentStep].panels[chosenIndex];
                chosenGroup.pane.material.color.setHex(0x00ff88);
                chosenGroup.frame.material.color.setHex(0x00ff88);

                // Auto-Shatter Fake Panels on this step after safe landing
                setTimeout(() => {
                    bridgeSteps[currentStep].panels.forEach((p, idx) => {
                        if (!safePanelsMatrix[currentStep].includes(idx)) {
                            triggerGlassShatter(conf.offsets[idx], 0, targetZ);
                            scene.remove(p);
                        }
                    });
                }, 200);

                currentStep++;
                const mult = conf.multipliers[currentStep - 1];
                const winAmount = betAmount * mult;

                if (currentStep === TOTAL_STEPS) {
                    stepHud.textContent = `COMPLETED! • ${formatMultiplier(mult)}x`;
                    cashOut();
                } else {
                    updateHud();
                    highlightCurrentStep();
                    gameState = 'PLAYING';
                    enableChoiceButtons(true);
                    mainBtn.textContent = `CASHOUT $${winAmount.toFixed(2)} (${formatMultiplier(mult)}x)`;
                    mainBtn.className = 'main-action-btn btn-cashout';
                }
            } else {
                // Trap Fall: Human falls into Abyss
                playSound('shatter');
                const brokenGroup = bridgeSteps[currentStep].panels[chosenIndex];
                triggerGlassShatter(targetX, 0, targetZ);
                scene.remove(brokenGroup);

                gsap.to(humanGroup.position, { y: -22, duration: 1.3, ease: "power2.in" });
                gsap.to(humanGroup.rotation, { x: 3, z: 2, duration: 1.3 });
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
    endGame(true);
}

function endGame(won) {
    gameState = 'ENDED';
    betInput.disabled = false;
    diffButtons.forEach(b => b.disabled = false);
    enableChoiceButtons(false);

    mainBtn.textContent = won ? 'SURVIVED 13 STEPS! PLAY AGAIN' : 'FELL INTO ABYSS! TRY AGAIN';
    mainBtn.className = 'main-action-btn btn-start';
}