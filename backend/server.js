const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Configs matching frontend
const CONFIGS = {
    easy: { panels: 2 },
    medium: { panels: 2 },
    hard: { panels: 3 },
    extreme: { panels: 4 }
};

// In-Memory Active Rounds
const activeRounds = new Map();

// Generate Hashed Seed & Bridge Layout
app.post('/api/game/create', (req, res) => {
    const { clientSeed, difficulty = 'medium', betAmount } = req.body;
    
    if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: 'Invalid bet amount' });
    }

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const nonce = Date.now();
    const roundId = crypto.randomUUID();

    const panelsCount = CONFIGS[difficulty]?.panels || 2;
    const pattern = [];

    for (let i = 0; i < 13; i++) {
        const hmac = crypto.createHmac('sha256', serverSeed);
        hmac.update(`${clientSeed}:${nonce}:${i}`);
        const hex = hmac.digest('hex');
        const safeIndex = parseInt(hex.substring(0, 8), 16) % panelsCount;
        pattern.push(safeIndex);
    }

    activeRounds.set(roundId, {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        pattern,
        currentStep: 0,
        difficulty,
        betAmount,
        settled: false
    });

    res.json({
        roundId,
        serverSeedHash,
        nonce
    });
});

// Step Verification API
app.post('/api/game/step', (req, res) => {
    const { roundId, chosenPanel } = req.body;
    const round = activeRounds.get(roundId);

    if (!round || round.settled) {
        return res.status(400).json({ error: 'Round not active or already settled' });
    }

    const isSafe = (round.pattern[round.currentStep] === chosenPanel);

    if (isSafe) {
        round.currentStep++;
        const isMaxWin = round.currentStep >= 13;
        if (isMaxWin) round.settled = true;

        res.json({
            status: 'SAFE',
            step: round.currentStep,
            isMaxWin,
            serverSeed: isMaxWin ? round.serverSeed : undefined
        });
    } else {
        round.settled = true;
        res.json({
            status: 'BROKEN',
            step: round.currentStep,
            safePanel: round.pattern[round.currentStep],
            serverSeed: round.serverSeed
        });
    }
});

app.listen(PORT, () => {
    console.log(`Stake Game Server running on port ${PORT}`);
});
