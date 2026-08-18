// Game Configuration & Math
const CONFIGS = {
    easy: { panels: 3, safeCount: 2, multipliers: [1.15, 1.30, 1.50, 1.80, 2.20, 2.80, 3.60, 4.80, 6.50, 9.00, 13.00, 18.00, 25.00] },
    medium: { panels: 2, safeCount: 1, multipliers: [1.18, 1.40, 1.75, 2.25, 3.00, 4.20, 6.00, 9.00, 14.00, 22.00, 38.00, 62.00, 100.00] },
    hard: { panels: 3, safeCount: 1, multipliers: [1.25, 1.65, 2.30, 3.30, 5.00, 8.00, 13.50, 24.00, 45.00, 90.00, 180.00, 320.00, 500.00] },
    extreme: { panels: 4, safeCount: 1, multipliers: [1.35, 1.95, 3.10, 5.20, 8.90, 15.50, 28.00, 52.00, 105.00, 240.00, 580.00, 1550.00, 5000.00] }
};

// Game State Variables
let currentDifficulty = 'medium';
let currentStep = 0;
let bridgePattern = [];
let balance = 1000.00;
let betAmount = 10.00;
let gameState = 'IDLE'; // IDLE, PLAYING, JUMPING, ENDED
let playMode = 'manual'; // manual, auto
let autoRemainingRounds = 0;
let autoMaxSteps = 3;

// Provably Fair Data
let clientSeed = 'stake-user-seed-777';
let serverSeed = '';
let serverSeedHash = '';
let nonce = 0;

// DOM Elements
const canvasContainer = document.getElementById('bridge-canvas');
const balanceDisplay = document.getElementById('user-balance');
const betInput = document.getElementById('bet-amount');
const mainBtn = document.getElementById('main-action-btn');
const diffButtons = document.querySelectorAll('.diff-btn');
const choiceButtons = document.querySelectorAll('.choice-btn');
const tabManual = document.getElementById('tab-manual');
const tabAuto = document.getElementById('tab-auto');
const autoConfigBox = document.getElementById('auto-config');
const autoRoundsInput = document.getElementById('auto-rounds');
const autoStepsInput = document.getElementById('auto-steps');
const multDisplay = document.getElementById('multiplier-display');
const historyList = document.getElementById('history-list');

// Three.js Core Variables
let scene, camera, renderer;
let glassPanels = [];
let avatar;

// ---------------- INITIALIZATION ----------------
function init() {
    initThreeJS();
    buildBridge();
    setupEventListeners();
    generateProvablyFairSeed();
    updateUI();
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040810);
    scene.fog = new THREE.FogExp2(0x040810, 0.035);

    const width = canvasContainer.clientWidth || 360;
    const height = canvasContainer.clientHeight || 380;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 0, -4);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    canvasContainer.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00e7ff, 1.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const floorGeo = new THREE.PlaneGeometry(100, 200);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x020408 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -10;
    scene.add(floor);

    createAvatar();
    animate();

    window.addEventListener('resize', onWindowResize);
}

function createAvatar() {
    const group = new THREE.Group();
    
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x00e7ff, 
        emissive: 0x005577, 
        roughness: 0.2, 
        metalness: 0.8 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    group.add(body);

    const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.4;
    group.add(head);

    avatar = group;
    avatar.position.set(0, 0.2, 3);
    scene.add(avatar);
}

function buildBridge() {
    glassPanels.forEach(step => step.forEach(mesh => scene.remove(mesh)));
    glassPanels = [];

    const config = CONFIGS[currentDifficulty];
    const totalSteps = 13;
    const panelWidth = 1.5;
    const panelDepth = 2.0;
    const gapX = 0.5;
    const gapZ = 1.0;

    for (let s = 0; s < totalSteps; s++) {
        const stepRow = [];
        const zPos = - (s * (panelDepth + gapZ));
        const totalWidth = (config.panels * panelWidth) + ((config.panels - 1) * gapX);
        const startX = - (totalWidth / 2) + (panelWidth / 2);

        for (let p = 0; p < config.panels; p++) {
            const xPos = startX + (p * (panelWidth + gapX));
            
            const geo = new THREE.BoxGeometry(panelWidth, 0.12, panelDepth);
            const mat = new THREE.MeshPhysicalMaterial({
                color: 0x00e7ff,
                transparent: true,
                opacity: 0.45,
                roughness: 0.1,
                transmission: 0.9,
                thickness: 1.2,
                reflectivity: 0.9
            });

            const panel = new THREE.Mesh(geo, mat);
            panel.position.set(xPos, 0, zPos);
            panel.userData = { step: s, panelIndex: p };
            scene.add(panel);
            stepRow.push(panel);
        }
        glassPanels.push(stepRow);
    }
}

// ---------------- TAB & UI HANDLERS ----------------
function switchMode(mode) {
    if (gameState === 'JUMPING') return;

    playMode = mode;
    if (mode === 'manual') {
        tabManual.classList.add('active');
        tabAuto.classList.remove('active');
        autoConfigBox.style.display = 'none';
        if (gameState !== 'PLAYING') {
            mainBtn.textContent = 'START CROSSING';
            mainBtn.className = 'main-action-btn btn-start';
            mainBtn.disabled = false;
        }
    } else {
        tabAuto.classList.add('active');
        tabManual.classList.remove('active');
        autoConfigBox.style.display = 'block';
        if (gameState !== 'PLAYING') {
            mainBtn.textContent = 'START AUTO-PLAY';
            mainBtn.className = 'main-action-btn btn-start';
            mainBtn.disabled = false;
        }
    }
}

function setupEventListeners() {
    tabManual.onclick = (e) => { e.stopPropagation(); switchMode('manual'); };
    tabAuto.onclick = (e) => { e.stopPropagation(); switchMode('auto'); };

    diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameState === 'PLAYING' || gameState === 'JUMPING') return;
            diffButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.diff;
            buildBridge();
            updateUI();
        });
    });

    choiceButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            if (gameState === 'PLAYING') {
                handlePlayerStep(index);
            }
        });
    });

    mainBtn.addEventListener('click', handleMainAction);

    betInput.addEventListener('change', () => {
        betAmount = Math.max(1, parseFloat(betInput.value) || 10);
        betInput.value = betAmount.toFixed(2);
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameState === 'PLAYING' || gameState === 'JUMPING') return;
            const action = btn.dataset.action;
            if (action === 'half') betAmount = Math.max(1, betAmount / 2);
            if (action === 'double') betAmount = betAmount * 2;
            if (action === 'max') betAmount = balance;
            betInput.value = betAmount.toFixed(2);
        });
    });
}

// ---------------- GAMEPLAY & LOGIC ----------------
function generateProvablyFairSeed() {
    serverSeed = Math.random().toString(36).substring(2) + Date.now().toString(36);
    serverSeedHash = CryptoJS.SHA256(serverSeed).toString();
    nonce++;

    const config = CONFIGS[currentDifficulty];
    bridgePattern = [];
    
    for (let s = 0; s < 13; s++) {
        const hash = CryptoJS.HmacSHA256(`${clientSeed}:${nonce}:${s}`, serverSeed).toString();
        const indices = Array.from({ length: config.panels }, (_, i) => i);
        let num = parseInt(hash.substring(0, 8), 16);
        
        for (let i = indices.length - 1; i > 0; i--) {
            const j = num % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
            num = Math.floor(num / (i + 1));
        }
        bridgePattern.push(indices.slice(0, config.safeCount));
    }
}

function handleMainAction() {
    if (gameState === 'IDLE' || gameState === 'ENDED') {
        if (balance < betAmount) {
            alert('Insufficient balance!');
            return;
        }
        balance -= betAmount;
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;

        if (playMode === 'auto') {
            autoRemainingRounds = parseInt(autoRoundsInput.value) || 5;
            autoMaxSteps = parseInt(autoStepsInput.value) || 3;
        }

        generateProvablyFairSeed();
        startNewGame();
    } else if (gameState === 'PLAYING' && currentStep > 0) {
        cashOut();
    }
}

function startNewGame() {
    gameState = 'PLAYING';
    currentStep = 0;
    buildBridge();
    avatar.position.set(0, 0.2, 3);
    camera.position.set(0, 14, 22);

    betInput.disabled = true;
    diffButtons.forEach(b => b.disabled = true);
    
    updateUI();

    if (playMode === 'manual') {
        enableChoiceButtons(true);
        mainBtn.textContent = 'CASHOUT (0.00x)';
        mainBtn.className = 'main-action-btn btn-cashout';
    } else {
        enableChoiceButtons(false);
        mainBtn.textContent = 'AUTO PLAYING...';
        mainBtn.disabled = true;
        runAutoRoundStep();
    }
}

function handlePlayerStep(chosenIndex) {
    if (gameState !== 'PLAYING') return;

    gameState = 'JUMPING';
    enableChoiceButtons(false);

    const isSafe = bridgePattern[currentStep].includes(chosenIndex);
    const targetPanel = glassPanels[currentStep][chosenIndex];

    // Jump Animation
    gsap.to(avatar.position, {
        x: targetPanel.position.x,
        z: targetPanel.position.z,
        duration: 0.35,
        ease: 'power2.out'
    });

    gsap.to(avatar.position, {
        y: 1.8,
        duration: 0.18,
        yoyo: true,
        repeat: 1,
        ease: 'sine.out',
        onComplete: () => {
            if (isSafe) {
                targetPanel.material.color.setHex(0x00ff88);
                targetPanel.material.opacity = 0.8;
                currentStep++;
                
                const mult = CONFIGS[currentDifficulty].multipliers[currentStep - 1];
                const currentProfit = (betAmount * mult).toFixed(2);
                mainBtn.textContent = `CASHOUT $${currentProfit} (${mult}x)`;

                // Camera follow
                gsap.to(camera.position, {
                    z: 22 - (currentStep * 3),
                    duration: 0.5
                });

                if (currentStep === 13) {
                    cashOut();
                } else {
                    gameState = 'PLAYING';
                    if (playMode === 'manual') {
                        enableChoiceButtons(true);
                    }
                }
            } else {
                // Glass shatter fall
                targetPanel.material.opacity = 0;
                gsap.to(avatar.position, {
                    y: -15,
                    duration: 0.8,
                    ease: 'power2.in',
                    onComplete: () => {
                        addHistoryItem(false, 0, 0);
                        endGame(false);
                    }
                });
            }
            updateUI();
        }
    });
}

function runAutoRoundStep() {
    if (gameState !== 'PLAYING') return;

    if (currentStep < autoMaxSteps && currentStep < 13) {
        setTimeout(() => {
            const config = CONFIGS[currentDifficulty];
            const randomPanel = Math.floor(Math.random() * config.panels);
            handlePlayerStep(randomPanel);

            setTimeout(() => {
                if (gameState === 'PLAYING') {
                    runAutoRoundStep();
                }
            }, 600);
        }, 500);
    } else {
        cashOut();
    }
}

function cashOut() {
    if (currentStep === 0) return;

    const finalMult = CONFIGS[currentDifficulty].multipliers[currentStep - 1];
    const winAmount = betAmount * finalMult;
    balance += winAmount;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;

    addHistoryItem(true, finalMult, winAmount);
    endGame(true);
}

function endGame(won) {
    gameState = 'IDLE';
    betInput.disabled = false;
    diffButtons.forEach(b => b.disabled = false);
    enableChoiceButtons(false);

    if (playMode === 'auto' && autoRemainingRounds > 1 && balance >= betAmount) {
        autoRemainingRounds--;
        setTimeout(() => {
            if (playMode === 'auto') {
                balance -= betAmount;
                balanceDisplay.textContent = `$${balance.toFixed(2)}`;
                generateProvablyFairSeed();
                startNewGame();
            }
        }, 1200);
    } else {
        mainBtn.disabled = false;
        mainBtn.textContent = playMode === 'auto' ? 'START AUTO-PLAY' : (won ? 'PLAY AGAIN' : 'TRY AGAIN');
        mainBtn.className = 'main-action-btn btn-start';
    }
}

function enableChoiceButtons(enable) {
    const config = CONFIGS[currentDifficulty];
    choiceButtons.forEach((btn, idx) => {
        if (idx < config.panels) {
            btn.style.display = 'block';
            btn.disabled = !enable;
        } else {
            btn.style.display = 'none';
        }
    });
}

function updateUI() {
    const config = CONFIGS[currentDifficulty];
    const stepMult = currentStep > 0 ? config.multipliers[currentStep - 1] : 1.00;
    const nextMult = currentStep < 13 ? config.multipliers[currentStep] : config.multipliers[12];
    multDisplay.textContent = `${currentDifficulty.toUpperCase()} • STEP ${currentStep}/13 • NEXT: ${nextMult}x`;
}

function addHistoryItem(won, mult, amount) {
    const item = document.createElement('div');
    item.className = `history-item ${won ? 'win' : 'loss'}`;
    item.innerHTML = `<span>${won ? `${mult}x` : '0.00x'}</span><span>${won ? `+$${amount.toFixed(2)}` : `-$${betAmount.toFixed(2)}`}</span>`;
    historyList.prepend(item);
    if (historyList.children.length > 5) historyList.removeChild(historyList.lastChild);
}

function onWindowResize() {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.onload = init;