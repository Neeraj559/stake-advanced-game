const COLS = 6;
const ROWS = 5;
const CELL_SIZE = 58;

// Web Audio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audio = null;
function playFx(freq, type, duration, gainVal = 0.25) {
    if (!audio) audio = new AudioCtx();
    if (audio.state === 'suspended') audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.setValueAtTime(freq, now);
    if (type === 'sawtooth') osc.frequency.linearRampToValueAtTime(freq * 2, now + duration);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);
    osc.start(now);
    osc.stop(now + duration);
}

const app = new PIXI.Application({
    width: COLS * CELL_SIZE,
    height: ROWS * CELL_SIZE,
    backgroundAlpha: 0,
    antialias: true
});
document.getElementById('game-canvas').appendChild(app.view);

// HD Procedural Gem Shapes & Themes
const THEMES = [
    { id: 'ruby',      shape: 'diamond',  color: 0xff0044, glow: 0xff3366, highlight: 0xffa3be, pay: 0.35 },
    { id: 'sapphire',  shape: 'hexagon',  color: 0x0088ff, glow: 0x33aaff, highlight: 0xb3ddff, pay: 0.50 },
    { id: 'emerald',   shape: 'square',   color: 0x00e676, glow: 0x33ff99, highlight: 0xb3ffd6, pay: 0.70 },
    { id: 'amethyst',  shape: 'triangle', color: 0xaa00ff, glow: 0xcc33ff, highlight: 0xeebbff, pay: 1.00 },
    { id: 'topaz',     shape: 'circle',   color: 0xffbb00, glow: 0xffdd33, highlight: 0xfff2b3, pay: 1.50 },
    { id: 'reactor',   shape: 'reactor',  color: 0x00f2fe, glow: 0x4facfe, highlight: 0xffffff, pay: 3.00 },
    { id: 'mask',      shape: 'mask',     color: 0xff1e40, glow: 0xffd700, highlight: 0xffffff, pay: 6.00, isScatter: true },
    { id: 'mult_orb',  shape: 'orb',      color: 0xff5500, glow: 0xffff00, highlight: 0xffffff, isMult: true }
];

let grid = [];
let balance = 1000;
let bet = 10;
let isSpinning = false;
let globalMult = 1;
let tumbleWin = 0;

const spinBtn = document.getElementById('spin-btn');
const balanceDisplay = document.getElementById('balance-display');
const winDisplay = document.getElementById('win-display');
const multDisplay = document.getElementById('mult-display');
const winToast = document.getElementById('win-toast');
const toastAmount = document.getElementById('toast-amount');

const mainContainer = new PIXI.Container();
app.stage.addChild(mainContainer);

// HD Procedural Gem Vector Renderer
function drawGemGraphic(data, multVal = null) {
    const cont = new PIXI.Container();
    const half = CELL_SIZE / 2;
    const r = CELL_SIZE / 2 - 7;

    // 1. Outer Dark Glow Drop Shadow
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.6);
    shadow.drawRoundedRect(3, 5, CELL_SIZE - 6, CELL_SIZE - 6, 12);
    shadow.endFill();
    cont.addChild(shadow);

    // 2. Beveled Gem Base
    const gem = new PIXI.Graphics();
    gem.lineStyle(2, data.glow, 0.9);
    gem.beginFill(data.color, 0.85);

    if (data.shape === 'diamond') {
        gem.drawPolygon([half, 6, CELL_SIZE - 8, half, half, CELL_SIZE - 8, 8, half]);
    } else if (data.shape === 'hexagon') {
        gem.drawPolygon([half - 14, 7, half + 14, 7, CELL_SIZE - 8, half, half + 14, CELL_SIZE - 7, half - 14, CELL_SIZE - 7, 8, half]);
    } else if (data.shape === 'triangle') {
        gem.drawPolygon([half, 7, CELL_SIZE - 7, CELL_SIZE - 8, 7, CELL_SIZE - 8]);
    } else if (data.shape === 'square') {
        gem.drawRoundedRect(8, 8, CELL_SIZE - 16, CELL_SIZE - 16, 6);
    } else if (data.shape === 'circle') {
        gem.drawCircle(half, half, r);
    } else if (data.shape === 'reactor') {
        gem.lineStyle(2.5, 0x00ffff, 1);
        gem.drawCircle(half, half, r);
        gem.beginFill(0x004466, 0.9);
        gem.drawCircle(half, half, r - 6);
    } else if (data.shape === 'mask') {
        gem.lineStyle(2, 0xffd700, 1);
        gem.drawRoundedRect(7, 7, CELL_SIZE - 14, CELL_SIZE - 14, 10);
    } else if (data.shape === 'orb') {
        gem.lineStyle(3, 0xffff00, 1);
        gem.drawCircle(half, half, r);
    }
    gem.endFill();
    cont.addChild(gem);
    cont.gemShape = gem;

    // 3. 3D Crystal Specular Facet
    const facet = new PIXI.Graphics();
    facet.beginFill(data.highlight, 0.45);
    facet.drawPolygon([half - 8, 10, half + 8, 10, half + 4, half - 2, half - 4, half - 2]);
    facet.endFill();
    cont.addChild(facet);

    // 4. Center Emblems for Special Types
    if (data.isScatter) {
        const maskTxt = new PIXI.Text('🕷️', { fontSize: 22 });
        maskTxt.anchor.set(0.5);
        maskTxt.x = half;
        maskTxt.y = half;
        cont.addChild(maskTxt);
    } else if (data.isMult) {
        const multTxt = new PIXI.Text(`${multVal}x`, {
            fontFamily: 'Impact',
            fontSize: 14,
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
    if (type.isMult) {
        const roll = Math.random() * 100;
        multVal = roll < 60 ? 2 : roll < 85 ? 3 : roll < 95 ? 5 : roll < 98.5 ? 10 : 25;
    }

    const graphic = drawGemGraphic(type, multVal);
    graphic.c = c;
    graphic.r = r;
    graphic.typeData = type;
    graphic.multValue = multVal;
    graphic.x = c * CELL_SIZE;
    graphic.y = r * CELL_SIZE;
    return graphic;
}

function getRandomType() {
    const r = Math.random();
    if (r < 0.025) return THEMES.find(t => t.id === 'mult_orb');
    if (r < 0.055) return THEMES.find(t => t.id === 'mask');
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

spinBtn.addEventListener('click', runSpin);

async function runSpin() {
    if (isSpinning || balance < bet) return;
    isSpinning = true;
    spinBtn.disabled = true;
    balance -= bet;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    tumbleWin = 0;
    globalMult = 1;
    multDisplay.textContent = '1x';
    winDisplay.textContent = '$0.00';
    winToast.classList.remove('active');

    // Staggered Falling Columns
    mainContainer.removeChildren();
    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            const tile = createTile(getRandomType(), c, r);
            tile.y = (r - ROWS) * CELL_SIZE - 30;
            grid[c][r] = tile;
            mainContainer.addChild(tile);

            tween(tile, { y: r * CELL_SIZE }, 240 + c * 60, () => {
                if (r === ROWS - 1) playFx(120, 'sine', 0.08, 0.15);
            });
        }
    }
    await delay(300 + COLS * 60);

    // Cascading Loop
    let hasHits = true;
    while (hasHits) {
        hasHits = await evaluateTumble();
    }

    // Final Multiplier Apply
    if (tumbleWin > 0) {
        const total = tumbleWin * globalMult;
        balance += total;
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
        winDisplay.textContent = `+$${total.toFixed(2)}`;

        if (globalMult > 1 || total >= bet * 4) {
            confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
        }
    }

    isSpinning = false;
    spinBtn.disabled = false;
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
        if (id === 'mask' && counts[id] >= 4) matchedIds.push(id);
        else if (counts[id] >= 8) matchedIds.push(id);
    }

    if (matchedIds.length === 0) return false;

    // Multiplier Strike
    if (multipliersFound.length > 0) {
        playFx(450, 'sawtooth', 0.3, 0.4);
        for (let m of multipliersFound) globalMult += (m.multValue - 1);
        multDisplay.textContent = `${globalMult}x`;
    }

    playFx(580, 'triangle', 0.15, 0.35);

    // Payout Calculation
    let step = 0;
    for (let id of matchedIds) {
        const theme = THEMES.find(t => t.id === id);
        let scale = counts[id] >= 12 ? 2.5 : counts[id] >= 10 ? 1.5 : 1.0;
        step += (theme.pay * scale * bet);
    }
    tumbleWin += step;
    toastAmount.textContent = `$${(tumbleWin * globalMult).toFixed(2)}`;
    winToast.classList.add('active');
    winDisplay.textContent = `+$${(tumbleWin * globalMult).toFixed(2)}`;

    // Gem Burst & Dissolve
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const t = grid[c][r];
            if (t && (matchedIds.includes(t.typeData.id) || t.typeData.isMult)) {
                tween(t.scale, { x: 0, y: 0 }, 150);
            }
        }
    }
    await delay(170);

    // Remove from stage
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const t = grid[c][r];
            if (t && (matchedIds.includes(t.typeData.id) || t.typeData.isMult)) {
                mainContainer.removeChild(t);
                grid[c][r] = null;
            }
        }
    }

    // Collapse downwards
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

        // Drop new tiles
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