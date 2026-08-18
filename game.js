const app = new PIXI.Application({
    width: 600,
    height: 400,
    backgroundColor: 0x071824,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});

document.getElementById('game-canvas-container').appendChild(app.view);

const REEL_WIDTH = 120;
const SYMBOL_SIZE = 100;
const NUM_REELS = 5;
const NUM_ROWS = 3;

const SYMBOLS = [
    { name: 'Diamond', color: 0x00ffff, val: 50 },
    { name: 'Ruby', color: 0xff0055, val: 25 },
    { name: 'Emerald', color: 0x00ff66, val: 15 },
    { name: 'Gold', color: 0xffd700, val: 10 },
    { name: 'Coin', color: 0xaaaaaa, val: 5 }
];

const reels = [];
const reelContainer = new PIXI.Container();
reelContainer.x = 20;
reelContainer.y = 50;
app.stage.addChild(reelContainer);

for (let i = 0; i < NUM_REELS; i++) {
    const rc = new PIXI.Container();
    rc.x = i * (REEL_WIDTH - 5);
    reelContainer.addChild(rc);

    const reel = {
        container: rc,
        symbols: [],
        position: 0,
        previousPosition: 0,
        blur: new PIXI.BlurFilter()
    };
    reel.blur.blurX = 0;
    reel.blur.blurY = 0;
    rc.filters = [reel.blur];

    for (let j = 0; j < NUM_ROWS + 1; j++) {
        const sym = createSymbolGraphic(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        sym.y = j * SYMBOL_SIZE;
        reel.symbols.push(sym);
        rc.addChild(sym);
    }
    reels.push(reel);
}

function createSymbolGraphic(data) {
    const container = new PIXI.Container();
    const graphics = new PIXI.Graphics();
    graphics.beginFill(data.color);
    graphics.drawRoundedRect(10, 10, 80, 80, 16);
    graphics.endFill();

    const text = new PIXI.Text(data.name[0], {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffffff
    });
    text.anchor.set(0.5);
    text.x = 50;
    text.y = 50;

    container.addChild(graphics);
    container.addChild(text);
    container.symbolData = data;
    return container;
}

let balance = 1000.00;
const bet = 10.00;
let running = false;

document.getElementById('spin-btn').addEventListener('click', startSpin);

function startSpin() {
    if (running || balance < bet) return;
    running = true;
    balance -= bet;
    document.getElementById('balance-val').innerText = balance.toFixed(2);
    document.getElementById('win-val').innerText = '0.00';

    for (let i = 0; i < reels.length; i++) {
        const r = reels[i];
        const extra = Math.floor(Math.random() * 3);
        const target = r.position + 10 + i * 5 + extra;
        const time = 2500 + i * 600;
        
        tweenTo(r, 'position', target, time, backout(0.5), null, i === reels.length - 1 ? spinComplete : null);
    }
}

function spinComplete() {
    running = false;
    const win = Math.random() > 0.6 ? (bet * (Math.floor(Math.random() * 5) + 1.5)) : 0;
    if (win > 0) {
        balance += win;
        document.getElementById('balance-val').innerText = balance.toFixed(2);
        document.getElementById('win-val').innerText = win.toFixed(2);
    }
}

app.ticker.add(() => {
    for (let i = 0; i < reels.length; i++) {
        const r = reels[i];
        r.blur.blurY = (r.position - r.previousPosition) * 8;
        r.previousPosition = r.position;

        for (let j = 0; j < r.symbols.length; j++) {
            const s = r.symbols[j];
            const prevY = s.y;
            s.y = ((r.position + j) % r.symbols.length) * SYMBOL_SIZE - SYMBOL_SIZE;
            if (s.y < 0 && prevY > SYMBOL_SIZE) {
                const randomSym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
                r.container.removeChild(s);
                const newSym = createSymbolGraphic(randomSym);
                newSym.y = s.y;
                r.symbols[j] = newSym;
                r.container.addChild(newSym);
            }
        }
    }
});

const tweening = [];
function tweenTo(object, property, target, time, easing, onchange, oncomplete) {
    const tween = {
        object, property,
        propertyBeginValue: object[property],
        target, easing, time,
        change: onchange,
        complete: oncomplete,
        start: Date.now()
    };
    tweening.push(tween);
    return tween;
}

app.ticker.add(() => {
    const now = Date.now();
    const remove = [];
    for (let i = 0; i < tweening.length; i++) {
        const t = tweening[i];
        const phase = Math.min(1, (now - t.start) / t.time);
        t.object[t.property] = lerp(t.propertyBeginValue, t.target, t.easing(phase));
        if (t.change) t.change(t);
        if (phase === 1) {
            t.object[t.property] = t.target;
            if (t.complete) t.complete(t);
            remove.push(t);
        }
    }
    for (let i = 0; i < remove.length; i++) {
        tweening.splice(tweening.indexOf(remove[i]), 1);
    }
});

function lerp(a1, a2, t) { return a1 * (1 - t) + a2 * t; }
function backout(amount) {
    return (t) => (--t * t * ((amount + 1) * t + amount) + 1);
}