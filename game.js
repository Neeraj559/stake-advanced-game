const REEL_WIDTH = 110;
const SYMBOL_SIZE = 100;
const NUM_REELS = 5;
const NUM_ROWS = 3;

const app = new PIXI.Application({
    width: REEL_WIDTH * NUM_REELS,
    height: SYMBOL_SIZE * NUM_ROWS,
    backgroundColor: 0x071824,
    antialias: true
});
document.getElementById('canvas-container').appendChild(app.view);

const SYMBOL_DATA = [
    { name: '💎 Diamond', color: 0x00d2ff, weight: 10, payout: 100, border: 0x55eeff },
    { name: '👑 Crown',   color: 0xffd700, weight: 20, payout: 50,  border: 0xffea70 },
    { name: '⚡ 777',     color: 0xff2a55, weight: 30, payout: 30,  border: 0xff708f },
    { name: '⭐ Star',    color: 0xa855f7, weight: 40, payout: 20,  border: 0xca8aff },
    { name: '🍀 Clover',  color: 0x22c55e, weight: 50, payout: 10,  border: 0x86efac },
    { name: '🍒 Cherry',  color: 0xef4444, weight: 60, payout: 5,   border: 0xfca5a5 }
];

function createSymbolGraphic(data) {
    const cont = new PIXI.Container();

    // Box Background
    const bg = new PIXI.Graphics();
    bg.lineStyle(2, data.border, 0.8);
    bg.beginFill(data.color, 0.15);
    bg.drawRoundedRect(6, 6, REEL_WIDTH - 12, SYMBOL_SIZE - 12, 12);
    bg.endFill();
    cont.addChild(bg);

    // Inner Glow Accent
    const glow = new PIXI.Graphics();
    glow.beginFill(data.color, 0.3);
    glow.drawCircle(REEL_WIDTH / 2, SYMBOL_SIZE / 2, 28);
    glow.endFill();
    cont.addChild(glow);

    // Text Symbol
    const text = new PIXI.Text(data.name.split(' ')[0], {
        fontSize: 32,
        align: 'center'
    });
    text.anchor.set(0.5);
    text.x = REEL_WIDTH / 2;
    text.y = SYMBOL_SIZE / 2 - 6;
    cont.addChild(text);

    // Text Label
    const label = new PIXI.Text(data.name.split(' ')[1] || '', {
        fontFamily: 'Segoe UI',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0xffffff,
        letterSpacing: 1
    });
    label.anchor.set(0.5);
    label.x = REEL_WIDTH / 2;
    label.y = SYMBOL_SIZE / 2 + 24;
    cont.addChild(label);

    cont.symbolData = data;
    return cont;
}

const reels = [];
const reelContainer = new PIXI.Container();
app.stage.addChild(reelContainer);

for (let i = 0; i < NUM_REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * REEL_WIDTH;
    reelContainer.addChild(rc);

    const reel = {
        container: rc,
        symbols: [],
        position: 0,
        previousPosition: 0,
        blur: new PIXI.BlurFilter(),
        speed: 0
    };
    reel.blur.blurX = 0;
    reel.blur.blurY = 0;
    rc.filters = [reel.blur];

    for (let j = 0; j < NUM_ROWS + 2; j++) {
        const rand = SYMBOL_DATA[Math.floor(Math.random() * SYMBOL_DATA.length)];
        const sym = createSymbolGraphic(rand);
        sym.y = (j - 1) * SYMBOL_SIZE;
        reel.symbols.push(sym);
        rc.addChild(sym);
    }
    reels.push(reel);
}

// Reel Grid Lines
const grid = new PIXI.Graphics();
grid.lineStyle(1, 0x213743, 0.6);
for (let i = 1; i < NUM_REELS; i++) {
    grid.moveTo(i * REEL_WIDTH, 0);
    grid.lineTo(i * REEL_WIDTH, NUM_ROWS * SYMBOL_SIZE);
}
app.stage.addChild(grid);

let balance = 1000;
let bet = 10;
let running = false;

const spinBtn = document.getElementById('spin-btn');
const balanceDisplay = document.getElementById('balance-display');
const winDisplay = document.getElementById('win-display');

spinBtn.addEventListener('click', startSpin);

function startSpin() {
    if (running || balance < bet) return;
    running = true;
    balance -= bet;
    balanceDisplay.textContent = `$${balance.toFixed(2)}`;
    winDisplay.textContent = '$0.00';
    spinBtn.disabled = true;

    for (let i = 0; i < reels.length; i++) {
        const r = reels[i];
        const extra = Math.floor(Math.random() * 3);
        const target = r.position + 15 + i * 6 + extra;
        const time = 2200 + i * 400;

        tweenTo(r, 'position', target, time, backout(0.4), () => {
            if (i === reels.length - 1) {
                running = false;
                spinBtn.disabled = false;
                checkWin();
            }
        });
    }
}

app.ticker.add(() => {
    for (let i = 0; i < reels.length; i++) {
        const r = reels[i];
        r.blur.blurY = (r.position - r.previousPosition) * 6;
        r.previousPosition = r.position;

        for (let j = 0; j < r.symbols.length; j++) {
            const s = r.symbols[j];
            const prevY = s.y;
            s.y = ((r.position + j) % r.symbols.length) * SYMBOL_SIZE - SYMBOL_SIZE;

            if (s.y < 0 && prevY > SYMBOL_SIZE) {
                r.container.removeChild(s);
                const rand = SYMBOL_DATA[Math.floor(Math.random() * SYMBOL_DATA.length)];
                const newSym = createSymbolGraphic(rand);
                r.symbols[j] = newSym;
                r.container.addChild(newSym);
            }
        }
    }
});

function checkWin() {
    const centerSymbols = reels.map(r => {
        const sorted = [...r.symbols].sort((a, b) => Math.abs(a.y - SYMBOL_SIZE) - Math.abs(b.y - SYMBOL_SIZE));
        return sorted[0].symbolData;
    });

    let matchCount = 1;
    let matchSym = centerSymbols[0];

    for (let i = 1; i < centerSymbols.length; i++) {
        if (centerSymbols[i].name === matchSym.name) {
            matchCount++;
        } else {
            break;
        }
    }

    if (matchCount >= 3) {
        const winAmount = (matchSym.payout * (matchCount - 2)) * (bet / 10);
        balance += winAmount;
        balanceDisplay.textContent = `$${balance.toFixed(2)}`;
        winDisplay.textContent = `+$${winAmount.toFixed(2)}`;
    }
}

function tweenTo(object, property, target, time, easing, oncomplete) {
    const tween = {
        object,
        property,
        propertyBeginValue: object[property],
        target,
        easing,
        time,
        change: target - object[property],
        start: Date.now(),
        oncomplete
    };
    tweening.push(tween);
    return tween;
}

const tweening = [];
app.ticker.add(() => {
    const now = Date.now();
    const remove = [];
    for (let i = 0; i < tweening.length; i++) {
        const t = tweening[i];
        const phase = Math.min(1, (now - t.start) / t.time);
        t.object[t.property] = t.propertyBeginValue + t.change * t.easing(phase);
        if (phase === 1) {
            t.object[t.property] = t.target;
            if (t.oncomplete) t.oncomplete();
            remove.push(t);
        }
    }
    for (let i = 0; i < remove.length; i++) {
        tweening.splice(tweening.indexOf(remove[i]), 1);
    }
});

function backout(amount) {
    return (t) => --t * t * ((amount + 1) * t + amount) + 1;
}