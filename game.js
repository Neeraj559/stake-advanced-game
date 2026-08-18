const TOTAL_STEPS = 8;
const MULTIPLIERS = [1.96, 3.84, 7.52, 14.75, 28.90, 56.65, 111.00, 218.00];

let balance = 1000;
let betAmount = 10;
let currentStep = 0;
let safeSides = []; // 0 = Left, 1 = Right
let gameState = 'IDLE'; // IDLE, PLAYING, JUMPING, ENDED

// Web Audio Synth
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
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'shatter') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// ---------------- THREE.JS 3D SCENE SETUP ----------------
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05090e, 0.04);

const camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
camera.position.set(0, 6, 8);
camera.lookAt(0, 0, -4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
viewport.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x00d2ff, 1.2);
dirLight.position.set(5, 12, 10);
scene.add(dirLight);

// Glass Materials
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.6,
    ior: 1.5
});

const bridgeSteps = [];
const STEP_DISTANCE = 2.8;

// Build Bridge Structure
function build3DBridge() {
    bridgeSteps.forEach(step => {
        scene.remove(step.left);
        scene.remove(step.right);
    });
    bridgeSteps.length = 0;

    for (let i = 0; i < TOTAL_STEPS; i++) {
        const z = -i * STEP_DISTANCE - 2;
        const geom = new THREE.BoxGeometry(1.2, 0.08, 1.6);

        const leftPane = new THREE.Mesh(geom, glassMaterial.clone());
        leftPane.position.set(-1.0, 0, z);
        scene.add(leftPane);

        const rightPane = new THREE.Mesh(geom, glassMaterial.clone());
        rightPane.position.set(1.0, 0, z);
        scene.add(rightPane);

        bridgeSteps.push({ left: leftPane, right: rightPane, z });
    }
}
build3DBridge();

// Player Token (Glowing Neon Sphere)
const playerGeom = new THREE.SphereGeometry(0.32, 32, 32);
const playerMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
const player = new THREE.Mesh(playerGeom, playerMat);
player.position.set(0, 0.35, 0.5);
scene.add(player);

// Render Loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// ---------------- GAME LOGIC ----------------
const balanceDisplay = document.getElementById('balance-display');
const betInput = document.getElementById('bet-input');
const mainBtn = document.getElementById('main-btn');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnHalf = document.getElementById('btn-half');
const btnDouble = document.getElementById('btn-double');

btnHalf.addEventListener('click', () => {
    betInput.value = Math.max(1, Math.floor(parseFloat(betInput.value) / 2));
});
btnDouble.addEventListener('click', () => {
    betInput.value = Math.min(balance, Math.floor(parseFloat(betInput.value) * 2));
});

mainBtn.addEventListener('click', handleMainAction);
btnLeft.addEventListener('click', () => makeStep(0));
btnRight.addEventListener('click', () => makeStep(1));

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

    safeSides = [];
    for (let i = 0; i < TOTAL_STEPS; i++) {
        safeSides.push(Math.random() < 0.5 ? 0 : 1);
    }

    build3DBridge();

    // Reset Player Position & Camera
    gsap.to(player.position, { x: 0, y: 0.35, z: 0.5, duration: 0.4 });
    gsap.to(camera.position, { x: 0, y: 6, z: 8, duration: 0.4 });

    btnLeft.disabled = false;
    btnRight.disabled = false;
    mainBtn.textContent = 'CHOOSE A PANEL';
    mainBtn.className = 'main-action-btn btn-disabled';
}

function makeStep(sideChosen) {
    if (gameState !== 'PLAYING') return;
    gameState = 'JUMPING';
    btnLeft.disabled = true;
    btnRight.disabled = true;

    const targetX = sideChosen === 0 ? -1.0 : 1.0;
    const targetZ = bridgeSteps[currentStep].z;
    const isSafe = safeSides[currentStep] === sideChosen;

    playSound('jump');

    // Smooth Jump Arc using GSAP
    gsap.timeline()
        .to(player.position, {
            x: targetX,
            z: targetZ,
            duration: 0.45,
            ease: "power1.inOut"
        })
        .to(player.position, {
            y: 1.8,
            duration: 0.22,
            yoyo: true,
            repeat: 1,
            ease: "power2.out"
        }, 0)
        .call(() => {
            // Camera follow forward
            gsap.to(camera.position, { z: targetZ + 7.5, duration: 0.5 });
            gsap.to(camera.lookAt, { z: targetZ - 4, duration: 0.5 });

            if (isSafe) {
                playSound('land');
                const pane = sideChosen === 0 ? bridgeSteps[currentStep].left : bridgeSteps[currentStep].right;
                pane.material.color.setHex(0x00ff88);

                currentStep++;
                const mult = MULTIPLIERS[currentStep - 1];
                const winAmount = betAmount * mult;

                if (currentStep === TOTAL_STEPS) {
                    cashOut();
                } else {
                    gameState = 'PLAYING';
                    btnLeft.disabled = false;
                    btnRight.disabled = false;
                    mainBtn.textContent = `CASHOUT $${winAmount.toFixed(2)} (${mult}x)`;
                    mainBtn.className = 'main-action-btn btn-cashout';
                }
            } else {
                // Shatter pane and drop player
                playSound('shatter');
                const brokenPane = sideChosen === 0 ? bridgeSteps[currentStep].left : bridgeSteps[currentStep].right;
                gsap.to(brokenPane.position, { y: -15, duration: 1.2, ease: "power2.in" });
                gsap.to(player.position, { y: -15, duration: 1.2, ease: "power2.in" });
                endGame(false);
            }
        });
}

function cashOut() {
    const finalMult = MULTIPLIERS[currentStep - 1];
    const winAmount = betAmount * finalMult;
    balance += winAmount;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;

    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    endGame(true);
}

function endGame(won) {
    gameState = 'ENDED';
    betInput.disabled = false;
    btnLeft.disabled = true;
    btnRight.disabled = true;

    mainBtn.textContent = won ? 'SURVIVED! PLAY AGAIN' : 'FELL DOWN! TRY AGAIN';
    mainBtn.className = 'main-action-btn btn-start';
}