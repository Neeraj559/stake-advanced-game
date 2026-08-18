const COLS = 6;
const ROWS = 5;
const CELL_SIZE = 75;

const app = new PIXI.Application({
    width: COLS * CELL_SIZE,
    height: ROWS * CELL_SIZE,
    backgroundColor: 0x090614,
    antialias: true
});
document.getElementById('canvas-container').appendChild(app.view);

const SYMBOL_TYPES = [
    { id: 'web',     icon: '🕸️', name: 'Web',     color: 0xffffff, border: 0xaaaaaa, payout: 1.5 },
    { id: 'spider',  icon: '🕷️', name: 'Spider',  color: 0xff2a2a, border: 0xff6666, payout: 2.0 },
    { id: 'reactor', icon: '🔋', name: 'Reactor', color: 0x00d2ff, border: 0x55eeff, payout: 3.5 },
    { id: 'drone',   icon: '🛸', name: 'Drone',   color: 0xa855f7, border: 0xca8aff, payout: 5.0 },
    { id: 'badge',   icon: '🛡️', name: 'Badge',   color: 0xffd700, border: 0xffea70, payout: 10.0 },
    { id: 'mask',    icon: '👺', name: 'Mask',    color: 0xff0044, border: 0xff88a3, payout: 25.0, isScatter: true }
];

let grid = [];
let balance = 1000;
let bet = 10;
let isSpinning = false;
let currentMultiplier = 1;
let currentTurnWin = 0;

const spinBtn = document.getElementById('spin-btn');
const balanceDisplay = document.getElementById('balance-display');
const winDisplay = document.getElementById('win-display');
const totalMultiplierVal = document.getElementById('total-multiplier-val');
const winOverlay = document.getElementById('win-overlay');
const winTitle = document.getElementById('win-title');
const winOverlayAmount = document.getElementById('win-overlay-amount');
const spideyBubble = document.getElementById('spidey-bubble');

// Initialize visual grid container
const gridContainer = new PIXI.Container();
app.stage.addChild(gridContainer);

function createSymbol(typeData, c, r) {
    const cont = new PIXI.Container();
    cont.c = c;
    cont.r = r;
    cont.typeData = typeData;
    cont.x = c * CELL_SIZE;
    cont.y = r * CELL_SIZE;

    const bg = new PIXI.Graphics();
    bg.lineStyle(2, typeData.border, 0.8);
    bg.beginFill(typeData.color, 0.15);
    bg.drawRoundedRect(4, 4, CELL_SIZE - 8, CELL_SIZE - 8, 10);
    bg.endFill();
    cont.addChild(bg);

    const txt = new PIXI.Text(typeData.icon, { fontSize: 32 });
    txt.anchor.set(0.5);
    txt.x = CELL_SIZE / 2;
    txt.y = CELL_SIZE / 2;
    cont.addChild(txt);

    return cont;
}

// Initial Spawn
function initBoard() {
    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            const randType = getRandomSymbol();
            const sym = createSymbol(randType, c, r);
            grid[c][r] = sym;
            gridContainer.addChild(sym);
        }
    }
}
initBoard();

function getRandomSymbol() {
    // 95% regular, 5% mask scatter
    if (Math.random() < 0.06) {
        return SYMBOL_TYPES.find(s => s.isScatter);
    }
    const regular = SYMBOL_TYPES.filter(s => !s.isScatter);
    return regular[Math.floor(Math.random() * regular.length)];
}

spinBtn.addEventListener('click', startTumbleSpin);

async function startTumbleSpin() {
    if (isSpinning || balance < bet) return;
    isSpinning = true;
    spinBtn.disabled = true;
    balance -= bet;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    currentTurnWin = 0;
    currentMultiplier = 1;
    totalMultiplierVal.textContent = '1x';
    winDisplay.textContent = '$0.00';
    spideyBubble.textContent = "THWIP! LET'S GO!";

    // Clear board and drop in new set
    await dropNewBoard();

    // Cascading Loop
    let matchesFound = true;
    while (matchesFound) {
        matchesFound = await evaluateAndCascade();
    }

    // Finalize Win
    if (currentTurnWin > 0) {
        const finalPayout = currentTurnWin * currentMultiplier;
        balance += finalPayout;
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
        winDisplay.textContent = `+$${finalPayout.toFixed(2)}`;

        triggerWinModal(finalPayout);
    }

    isSpinning = false;
    spinBtn.disabled = false;
}

async function dropNewBoard() {
    gridContainer.removeChildren();
    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            const symType = getRandomSymbol();
            const sym = createSymbol(symType, c, r);
            sym.y = (r - ROWS) * CELL_SIZE; // Start from above
            grid[c][r] = sym;
            gridContainer.addChild(sym);
            tween(sym, { y: r * CELL_SIZE }, 300 + (c * 50) + (r * 40));
        }
    }
    await delay(600);
}

async function evaluateAndCascade() {
    // Count symbols across entire 6x5 grid (Gates of Olympus Pays Anywhere logic)
    const counts = {};
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const sym = grid[c][r];
            if (!sym) continue;
            counts[sym.typeData.id] = (counts[sym.typeData.id] || 0) + 1;
        }
    }

    let winningIds = [];
    for (let id in counts) {
        if (id === 'mask' && counts[id] >= 4) {
            winningIds.push(id); // Scatter win
        } else if (counts[id] >= 8) {
            winningIds.push(id); // 8+ cluster win
        }
    }

    if (winningIds.length === 0) return false;

    // Spiderman Random Multiplier Trigger
    if (Math.random() < 0.45) {
        triggerSpidermanWeb();
    }

    // Explode winning symbols
    let stepWin = 0;
    for (let id of winningIds) {
        const symInfo = SYMBOL_TYPES.find(s => s.id === id);
        stepWin += (counts[id] * symInfo.payout * (bet / 10));
    }
    currentTurnWin += stepWin;
    winDisplay.textContent = `+$${(currentTurnWin * currentMultiplier).toFixed(2)}`;

    // Blast Animation
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const sym = grid[c][r];
            if (sym && winningIds.includes(sym.typeData.id)) {
                tween(sym.scale, { x: 1.4, y: 1.4 }, 150);
                tween(sym, { alpha: 0 }, 150);
            }
        }
    }
    await delay(200);

    // Remove destroyed from grid
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const sym = grid[c][r];
            if (sym && winningIds.includes(sym.typeData.id)) {
                gridContainer.removeChild(sym);
                grid[c][r] = null;
            }
        }
    }

    // Collapse remaining symbols downward (Gravity)
    for (let c = 0; c < COLS; c++) {
        let writeRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[c][r] !== null) {
                if (writeRow !== r) {
                    grid[c][writeRow] = grid[c][r];
                    grid[c][r] = null;
                    tween(grid[c][writeRow], { y: writeRow * CELL_SIZE }, 250);
                }
                writeRow--;
            }
        }

        // Spawn new symbols from top for empty slots
        for (let r = writeRow; r >= 0; r--) {
            const newType = getRandomSymbol();
            const newSym = createSymbol(newType, c, r);
            newSym.y = (r - (writeRow + 1)) * CELL_SIZE; // Above view
            grid[c][r] = newSym;
            gridContainer.addChild(newSym);
            tween(newSym, { y: r * CELL_SIZE }, 300);
        }
    }

    await delay(400);
    return true;
}

function triggerSpidermanWeb() {
    const multipliers = [2, 5, 10, 25, 50, 100];
    const picked = multipliers[Math.floor(Math.random() * multipliers.length)];
    currentMultiplier += picked;
    totalMultiplierVal.textContent = `${currentMultiplier}x`;
    spideyBubble.textContent = `WEB SHOOT! +${picked}x 🔥`;

    if (typeof confetti === 'function') {
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.5 } });
    }
}

function triggerWinModal(amount) {
    if (amount >= bet * 5) {
        winTitle.textContent = amount >= bet * 15 ? '🔥 SENSATIONAL! 🔥' : '⭐ WEB VICTORY! ⭐';
        winOverlayAmount.textContent = `+$${amount.toFixed(2)}`;
        winOverlay.classList.add('active');

        if (typeof confetti === 'function') {
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        }

        setTimeout(() => {
            winOverlay.classList.remove('active');
        }, 1900);
    }
}

// Simple Helper Tweener
function tween(target, props, duration) {
    const startProps = {};
    for (let k in props) startProps[k] = target[k];
    const startTime = Date.now();

    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        for (let k in props) {
            target[k] = startProps[k] + (props[k] - startProps[k]) * easeOutBounce(progress);
        }
        if (progress >= 1) clearInterval(interval);
    }, 16);
}

function easeOutBounce(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}