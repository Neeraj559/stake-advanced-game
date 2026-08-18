* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', Roboto, -apple-system, sans-serif;
    user-select: none;
}

body {
    background: radial-gradient(circle at 50% 20%, #172a38 0%, #070e14 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fff;
    overflow: hidden;
}

.game-container {
    background: #0f212e;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 231, 1, 0.1);
    border: 1px solid #213743;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    position: relative;
}

.header-title {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 3px;
    background: linear-gradient(135deg, #00e701, #a3ff00);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 25px rgba(0, 231, 1, 0.4);
}

#canvas-container {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
    background: #071824;
    border: 3px solid #213743;
    box-shadow: inset 0 0 35px rgba(0, 0, 0, 0.9);
}

/* Win Overlay Modal */
.win-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.win-overlay.active {
    opacity: 1;
    pointer-events: all;
}

.win-title {
    font-size: 48px;
    font-weight: 900;
    color: #ffd700;
    text-shadow: 0 0 25px #ff9900, 0 0 50px #ffea00;
    transform: scale(0.5);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.win-overlay.active .win-title {
    transform: scale(1.1);
}

.win-payout {
    font-size: 36px;
    font-weight: 800;
    color: #00e701;
    text-shadow: 0 0 20px rgba(0, 231, 1, 0.8);
}

.controls-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: #1a2c38;
    padding: 14px 22px;
    border-radius: 14px;
    gap: 15px;
    border: 1px solid #2f4553;
}

.stat-box {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.stat-label {
    font-size: 11px;
    font-weight: 700;
    color: #8c9bad;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.stat-value {
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
}

.stat-value.win {
    color: #00e701;
    transition: transform 0.2s ease;
}

.btn-spin {
    background: linear-gradient(180deg, #00e701 0%, #00b300 100%);
    color: #022900;
    font-size: 18px;
    font-weight: 900;
    border: none;
    padding: 14px 42px;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 5px 0 #008000, 0 0 25px rgba(0, 231, 1, 0.4);
    transition: all 0.12s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.btn-spin:hover:not(:disabled) {
    background: linear-gradient(180deg, #1aff1b 0%, #00cc00 100%);
    transform: translateY(-2px);
    box-shadow: 0 7px 0 #008000, 0 0 35px rgba(0, 231, 1, 0.6);
}

.btn-spin:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow: 0 1px 0 #008000;
}

.btn-spin:disabled {
    background: #243542;
    color: #557086;
    box-shadow: none;
    cursor: not-allowed;
}