const COLS = 6;
const ROWS = 5;
const CELL_SIZE = 58;

// Pure Web Audio Studio FX
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

    if (type === 'drop') {
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
    } else if (type === 'match') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.14);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
    } else if (type === 'lightning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.4);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
    }
}

const app = new PIXI.Application({
    width: COLS * CELL_SIZE,
    height: ROWS * CELL_SIZE,
    backgroundAlpha: 0,
    antialias: true
});
document.getElementById('canvas-holder').appendChild(app.view);

const THEMES = [
    { id: 'gem_green',  shape: 'diamond',  color: 0x00ff88, glow: 0x44ffaa, highlight: 0xb3ffd6, pay: 0.35 },
    { id: 'gem_blue',   shape: 'hexagon',  color: 0x00bfff, glow: 0x55d4ff, highlight: 0xb3ddff, pay: 0.50 },
    { id: 'gem_purple', shape: 'triangle', color: 0xbd00ff, glow: 0xdf55ff, highlight: 0xeebbff, pay: 0.70 },
    { id: 'gem_red',    shape: 'square',   color: 0xff0044, glow: 0xff5588, highlight: 0xffa3be, pay: 0.90 },
    { id: 'goblet',     shape: 'circle',   color: 0xffbb00, glow: 0xffdd33, highlight: 0xfff2b3, pay: 1.50 },
    { id: 'ring',       shape: 'reactor',  color: 0xff00bb, glow: 0xff66dd, highlight: 0xffcceeff, pay: 2.50 },
    { id: 'crown',      shape: 'mask',     color: 0xffd700, glow: 0xffee66, highlight: 0xffffff, pay: 4.50 },
    { id: 'zeus',       shape: 'zeus',     color: 0xffffff, glow: 0x00ffff, highlight: 0xffffff, pay: 8.00, isScatter: true },
    { id: 'mult_orb',   shape: 'orb',      color: 0xff3300, glow: 0xffff00, highlight: 0xffffff, isMult: true }
];

let grid = [];
let balance = 1000;
let bet = 1.00;
let isSpinning = false;
let totalMultiplier = 1;
let currentTumbleWin = 0;
let freeSpinsLeft = 0;
let isBonusMode = false;

const spinBtn = document.getElementById('spin-btn');
const creditVal = document.getElementById('credit-val');
const betVal = document.getElementById('bet-val');
const winVal = document.getElementById('win-val');
const multVal = document.getElementById('mult-val');
const tumbleBar = document.getElementById('tumble-bar');
const tumbleAmount = document.getElementById('tumble-amount');
const zeusSprite = document.getElementById('zeus-sprite');
const stageCard = document.getElementById('stage-card');
const spinsPill = document.getElementById('spins-pill');
const spinsLeftText = document.getElementById('spins-left');
const buyFeatureBtn = document.getElementById('buy-feature-btn');

const mainContainer = new PIXI.Container();
app.stage.addChild(mainContainer);

function getWeightedMultiplier() {
    const roll = Math.random() * 100;
    if (roll < 55) return 2;
    if (roll < 80) return 3;
    if (roll < 92) return 5;
    if (roll < 97) return 10;
    if (roll < 99.4) return 25;
    return 50;
}

function drawGemGraphic(data, multVal = null) {
    const cont = new PIXI.Container();
    const half = CELL_SIZE / 2;
    const r = CELL_SIZE / 2 - 7;

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.65);
    shadow.drawRoundedRect(3, 5, CELL_SIZE - 6, CELL_SIZE - 6, 12);
    shadow.endFill();
    cont.addChild(shadow);

    const gem = new PIXI.Graphics();
    gem.lineStyle(2.5, data.glow, 0.95);
    gem.beginFill(data.color, 0.9);

    if (data.shape === 'diamond') {
        gem.drawPolygon([half, 5, CELL_SIZE - 7, half, half, CELL_SIZE - 7, 7, half]);
    } else if (data.shape === 'hexagon') {
        gem.drawPolygon([half - 14, 7, half + 14, 7, CELL_SIZE - 7, half, half + 14, CELL_SIZE - 7, half - 14, CELL_SIZE - 7, 7, half]);
    } else if (data.shape === 'triangle') {
        gem.drawPolygon([half, 6, CELL_SIZE - 6, CELL_SIZE - 7, 6, CELL_SIZE - 7]);
    } else if (data.shape === 'square') {
        gem.drawRoundedRect(7, 7, CELL_SIZE - 14, CELL_SIZE - 14, 8);
    } else if (data.shape === 'circle') {
        gem.drawCircle(half, half, r);
    } else if (data.shape === 'reactor') {
        gem.lineStyle(3, 0xff00bb, 1);
        gem.drawCircle(half, half, r);
        gem.beginFill(0x440033, 0.9);
        gem.drawCircle(half, half, r - 5);
    } else if (data.shape === 'mask') {
        gem.lineStyle(2.5, 0xffd700, 1);
        gem.drawRoundedRect(6, 6, CELL_SIZE - 12, CELL_SIZE - 12, 10);
    } else if (data.shape === 'zeus') {
        gem.lineStyle(2.5, 0x00ffff, 1);
        gem.drawRoundedRect(6, 6, CELL_SIZE - 12, CELL_SIZE - 12, 10);
    } else if (data.shape === 'orb') {
        gem.lineStyle(3.5, 0xffff00, 1);
        gem.drawCircle(half, half, r);
    }
    gem.endFill();
    cont.addChild(gem);
    cont.gemShape = gem;

    const facet = new PIXI.Graphics();
    facet.beginFill(data.highlight, 0.45);
    facet.drawPolygon([half - 8, 9, half + 8, 9, half + 4, half - 2, half - 4, half - 2]);
    facet.endFill();
    cont.addChild(facet);

    if (data.isScatter) {
        const scatterTxt = new PIXI.Text('⚡', { fontSize: 24 });
        scatterTxt.anchor.set(0.5);
        scatterTxt.x = half;
        scatterTxt.y = half;
        cont.addChild(scatterTxt);
    } else if (data.isMult) {
        const multTxt = new PIXI.Text(`${multVal}x`, {
            fontFamily: 'Impact',
            fontSize: 15,
            fill: 0xffff00,
            stroke: 0x000000,
            strokeThickness: 3
        });
        multTxt.anchor.set(0.5);
        multTxt.x = half;
        multTxt.y = half;
        cont.addChild(multTxt);
    }

    return cont;
}

function createTile(type, c, r) {
    let multVal = null;
    if (type.isMult) multVal = getWeightedMultiplier();

    const graphic = drawGemGraphic(type, multVal);
    graphic.c = c;
    graphic.r = r;
    graphic.typeData = type;
    graphic.multValue = multVal;
    graphic.x = c * CELL_SIZE;
    graphic.y = r * CELL_SIZE;
    return graphic;
}

function getRandomType(forceScatter = false) {
    if (forceScatter) return THEMES.find(t => t.id === 'zeus');
    const r = Math.random();
    if (r < 0.035) return THEMES.find(t => t.id === 'mult_orb');
    if (r < 0.065) return THEMES.find(t => t.id === 'zeus');
    const standard = THEMES.filter(t => !t.isScatter && !t.isMult);
    return standard[Math.floor(Math.random() * standard.length)];
}

// Initial Grid Board
for (let c = 0; c < COLS; c++) {
    grid[c] = [];
    for (let r = 0; r < ROWS; r++) {
        const tile = createTile(getRandomType(), c, r);
        grid[c][r] = tile;
        mainContainer.addChild(tile);
    }
}

spinBtn.addEventListener('click', () => runSpin(false));
buyFeatureBtn.addEventListener('click', () => {
    if (isSpinning || balance < bet * 100) return;
    balance -= (bet * 100);
    creditVal.textContent = `$${balance.toFixed(2)}`;
    runSpin(true);
});

async function runSpin(guaranteedBonus = false) {
    if (isSpinning || (balance < bet && freeSpinsLeft === 0)) return;
    isSpinning = true;
    spinBtn.disabled = true;
    buyFeatureBtn.disabled = true;

    if (freeSpinsLeft > 0) {
        freeSpinsLeft--;
        spinsLeftText.textContent = freeSpinsLeft;
    } else {
        if (!guaranteedBonus) {
            balance -= bet;
            creditVal.textContent = `$${balance.toFixed(2)}`;
        }
        totalMultiplier = 1;
        multVal.textContent = '1x';
    }

    currentTumbleWin = 0;
    winVal.textContent = '$0.00';
    tumbleBar.classList.remove('active');

    // Column Stagger Drop
    mainContainer.removeChildren();
    let scatterCount = 0;

    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            let force = false;
            if (guaranteedBonus && scatterCount < 4 && Math.random() < 0.25) {
                force = true;
                scatterCount++;
            }
            const tile = createTile(getRandomType(force), c, r);
            tile.y = (r - ROWS) * CELL_SIZE - 40;
            grid[c][r] = tile;
            mainContainer.addChild(tile);

            tween(tile, { y: r * CELL_SIZE }, 240 + c * 60, () => {
                if (r === ROWS - 1) playSound('drop');
            });
        }
    }
    await delay(300 + COLS * 60);

    // Cascading Loop
    let hasHits = true;
    while (hasHits) {
        hasHits = await evaluateTumble();
    }

    // Apply Total Multiplier to Tumble Win
    if (currentTumbleWin > 0) {
        const total = currentTumbleWin * totalMultiplier;
        balance += total;
        creditVal.textContent = `$${balance.toFixed(2)}`;
        winVal.textContent = `+$${total.toFixed(2)}`;

        if (totalMultiplier > 1 || total >= bet * 5) {
            confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
        }
    }

    // Check Free Spins Transition
    if (freeSpinsLeft > 0) {
        await delay(600);
        isSpinning = false;
        runSpin(false); // Auto next free spin
        return;
    } else if (isBonusMode && freeSpinsLeft === 0) {
        isBonusMode = false;
        stageCard.classList.remove('bonus-mode');
        spinsPill.style.display = 'none';
    }

    isSpinning = false;
    spinBtn.disabled = false;
    buyFeatureBtn.disabled = false;
}

async function evaluateTumble() {
    const counts = {};
    const multipliersFound = [];

    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const t = grid[c][r];
            if (!t) continue;
            if (t.typeData.isMult) multipliersFound.push(t);
            else counts[t.typeData.id] = (counts[t.typeData.id] || 0) + 1;
        }
    }

    const matchedIds = [];
    for (let id in counts) {
        if (id === 'zeus' && counts[id] >= 4) {
            matchedIds.push(id);
            if (!isBonusMode) triggerBonusMode();
        } else if (counts[id] >= 8) {
            matchedIds.push(id);
        }
    }

    if (matchedIds.length === 0) return false;

    // Zeus Multiplier Strike & Fly-To-Meter
    if (multipliersFound.length > 0) {
        playSound('lightning');
        zeusSprite.style.transform = 'scale(1.3) rotate(-12deg)';
        setTimeout(() => zeusSprite.style.transform = '', 350);

        for (let m of multipliersFound) {
            totalMultiplier += m.multValue;
        }
        multVal.textContent = `${totalMultiplier}x`;
        multVal.parentElement.style.transform = 'scale(1.25)';
        setTimeout(() => multVal.parentElement.style.transform = 'scale(1)', 300);
    }

    playSound('match');

    // Pragmatic Exact Step Payout ($1 bet base)
    let step = 0;
    for (let id of matchedIds) {
        const theme = THEMES.find(t => t.id === id);
        let scale = counts[id] >= 12 ? 2.5 : counts[id] >= 10 ? 1.5 : 1.0;
        step += (theme.pay * scale * bet);
    }
    currentTumbleWin += step;
    tumbleAmount.textContent = `$${(currentTumbleWin * totalMultiplier).toFixed(2)}`;
    tumbleBar.classList.add('active');
    winVal.textContent = `+$${(currentTumbleWin * totalMultiplier).toFixed(2)}`;

    // Gem Burst
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const t = grid[c][r];
            if (t && (matchedIds.includes(t.typeData.id) || t.typeData.isMult)) {
                t.gemShape.lineStyle(3, 0xffffff, 1);
                tween(t.scale, { x: 0, y: 0 }, 150);
            }
        }
    }
    await delay(170);

    // Remove Destroyed
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const t = grid[c][r];
            if (t && (matchedIds.includes(t.typeData.id) || t.typeData.isMult)) {
                mainContainer.removeChild(t);
                grid[c][r] = null;
            }
        }
    }

    // Collapse Downwards
    for (let c = 0; c < COLS; c++) {
        let bottom = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[c][r] !== null) {
                if (bottom !== r) {
                    grid[c][bottom] = grid[c][r];
                    grid[c][r] = null;
                    tween(grid[c][bottom], { y: bottom * CELL_SIZE }, 190);
                }
                bottom--;
            }
        }

        // Spawn New Drop Tiles
        for (let r = bottom; r >= 0; r--) {
            const newTile = createTile(getRandomType(), c, r);
            newTile.y = (r - (bottom + 1)) * CELL_SIZE;
            grid[c][r] = newTile;
            mainContainer.addChild(newTile);
            tween(newTile, { y: r * CELL_SIZE }, 230);
        }
    }

    await delay(260);
    return true;
}

function triggerBonusMode() {
    isBonusMode = true;
    freeSpinsLeft = 15;
    stageCard.classList.add('bonus-mode');
    spinsPill.style.display = 'block';
    spinsLeftText.textContent = freeSpinsLeft;
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
}

function tween(target, props, dur, cb) {
    const start = {};
    for (let k in props) start[k] = target[k];
    const t0 = Date.now();
    const int = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        for (let k in props) target[k] = start[k] + (props[k] - start[k]) * ease;
        if (p >= 1) {
            clearInterval(int);
            if (cb) cb();
        }
    }, 16);
}

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}