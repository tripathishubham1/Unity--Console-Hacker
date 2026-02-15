// ============================================================
// SUPER MARIO HTML5 - Complete Platformer Game
// 8 Worlds x 4 Levels = 32 Levels
// ============================================================

'use strict';

// === CONFIGURATION ===
const TILE = 32;
const CANVAS_W = 960;
const CANVAS_H = 544;
const COLS_VISIBLE = Math.ceil(CANVAS_W / TILE);
const ROWS = 17;
const GRAVITY = 0.55;
const MAX_FALL = 12;
const PLAYER_SPEED = 3.5;
const PLAYER_RUN_SPEED = 5.5;
const JUMP_FORCE = -11;
const BIG_JUMP_FORCE = -12.5;
const BOUNCE_FORCE = -8;
const FPS = 60;

// === CANVAS SETUP ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
document.getElementById('loading').style.display = 'none';

// Resize canvas to fit window
function resizeCanvas() {
    const ratio = CANVAS_W / CANVAS_H;
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// === GAME STATE ===
const GameState = {
    TITLE: 0, WORLD_MAP: 1, LEVEL_INTRO: 2, PLAYING: 3,
    PAUSED: 4, LEVEL_COMPLETE: 5, GAME_OVER: 6, WIN: 7
};

const game = {
    state: GameState.TITLE,
    world: 1,
    level: 1,
    lives: 3,
    score: 0,
    coins: 0,
    time: 400,
    timeTimer: 0,
    maxWorld: 1,
    maxLevel: 1,
    transitTimer: 0,
    introTimer: 0,
    frameCount: 0
};

// === INPUT SYSTEM ===
const keys = {};
const keyPressed = {};
window.addEventListener('keydown', e => {
    if (!keys[e.code]) keyPressed[e.code] = true;
    keys[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; e.preventDefault(); });
function isPressed(code) { const v = keyPressed[code]; keyPressed[code] = false; return v; }
function clearPressed() { for (const k in keyPressed) keyPressed[k] = false; }

// === AUDIO SYSTEM (Web Audio API) ===
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'square', volume = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const SFX = {
    jump() { playTone(400, 0.15); setTimeout(() => playTone(600, 0.1), 50); },
    coin() { playTone(988, 0.08); setTimeout(() => playTone(1319, 0.3), 80); },
    powerup() {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.15), i * 80));
    },
    stomp() { playTone(200, 0.15, 'sawtooth'); },
    bump() { playTone(150, 0.1, 'triangle'); },
    brick() { playTone(300, 0.05); playTone(200, 0.05); },
    fireball() { playTone(800, 0.08, 'sawtooth', 0.05); setTimeout(() => playTone(400, 0.08, 'sawtooth', 0.05), 40); },
    die() {
        playTone(600, 0.15);
        setTimeout(() => playTone(500, 0.15), 150);
        setTimeout(() => playTone(400, 0.15), 300);
        setTimeout(() => playTone(300, 0.4), 450);
    },
    flagpole() {
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => playTone(f, 0.2), i * 100));
    },
    oneup() {
        [330, 392, 523, 392, 523, 659].forEach((f, i) => setTimeout(() => playTone(f, 0.1, 'triangle'), i * 60));
    },
    pipe() { playTone(150, 0.3, 'triangle', 0.15); },
    gameover() {
        [392, 330, 262, 220, 175, 147].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'triangle', 0.12), i * 200));
    }
};

// === BACKGROUND MUSIC ===
let bgmOsc = null, bgmGain = null, bgmInterval = null;

function startBGM() {
    if (!audioCtx) return;
    stopBGM();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    bgmGain.connect(audioCtx.destination);

    // Simple melody patterns per world
    const melodies = {
        1: [523,587,659,698,784,698,659,587, 523,494,440,392,349,392,440,494],
        2: [440,494,523,587,659,587,523,494, 440,392,349,330,294,330,349,392],
        3: [523,659,784,1047,784,659,523,392, 330,392,494,587,494,392,330,294],
        4: [330,392,440,494,523,494,440,392, 349,330,294,262,294,330,349,392],
        5: [659,784,880,784,659,523,440,523, 659,587,494,440,392,440,494,587],
        6: [784,880,988,1047,988,880,784,659, 587,659,784,880,784,659,587,523],
        7: [262,294,330,349,392,349,330,294, 262,247,220,196,220,247,262,294],
        8: [196,220,262,294,330,294,262,220, 196,175,165,147,165,175,196,220]
    };
    const melody = melodies[game.world] || melodies[1];
    let noteIdx = 0;

    bgmInterval = setInterval(() => {
        if (game.state !== GameState.PLAYING || !bgmGain) return;
        const osc = audioCtx.createOscillator();
        osc.type = game.world >= 7 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(melody[noteIdx % melody.length], audioCtx.currentTime);
        const noteGain = audioCtx.createGain();
        noteGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(noteGain);
        noteGain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
        noteIdx++;
    }, 200);
}

function stopBGM() {
    if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
    if (bgmOsc) { try { bgmOsc.stop(); } catch(e) {} bgmOsc = null; }
    bgmGain = null;
}

// === WORLD THEMES ===
const WORLD_THEMES = {
    1: { name: 'Grass Land', bg: '#5c94fc', ground: '#c84c0c', brick: '#a0522d',
         groundTop: '#00a800', accent: '#fcfcfc', pipe: '#00a800', pipeDark: '#008000',
         hillColor: '#00a800', hillDark: '#008000', cloudColor: '#fcfcfc' },
    2: { name: 'Desert Land', bg: '#f8d878', ground: '#d8a038', brick: '#c88040',
         groundTop: '#e8c060', accent: '#f8f8a0', pipe: '#c88040', pipeDark: '#986830',
         hillColor: '#d8a038', hillDark: '#b88020', cloudColor: '#fcfcfc' },
    3: { name: 'Ocean Land', bg: '#5c94fc', ground: '#e8b868', brick: '#70b8e8',
         groundTop: '#f0d890', accent: '#a0d8f0', pipe: '#489868', pipeDark: '#307048',
         hillColor: '#e8b868', hillDark: '#c89848', cloudColor: '#fcfcfc' },
    4: { name: 'Forest Land', bg: '#386838', ground: '#604020', brick: '#805830',
         groundTop: '#388038', accent: '#58a058', pipe: '#286028', pipeDark: '#184818',
         hillColor: '#388038', hillDark: '#286028', cloudColor: '#a0c8a0' },
    5: { name: 'Ice Land', bg: '#a8d8f8', ground: '#e8e8f8', brick: '#b0c8e0',
         groundTop: '#f0f0ff', accent: '#c8e0f8', pipe: '#7090b0', pipeDark: '#506878',
         hillColor: '#d0e0f0', hillDark: '#b0c8e0', cloudColor: '#fcfcfc' },
    6: { name: 'Sky Land', bg: '#88b8f8', ground: '#f8d878', brick: '#d09040',
         groundTop: '#90d868', accent: '#f8f8a0', pipe: '#489868', pipeDark: '#307048',
         hillColor: '#f8d878', hillDark: '#d8b858', cloudColor: '#fcfcfc' },
    7: { name: 'Pipe Land', bg: '#181818', ground: '#686868', brick: '#585858',
         groundTop: '#888888', accent: '#a0a0a0', pipe: '#00a800', pipeDark: '#008000',
         hillColor: '#484848', hillDark: '#383838', cloudColor: '#585858' },
    8: { name: 'Dark Land', bg: '#200000', ground: '#484848', brick: '#604040',
         groundTop: '#686060', accent: '#a04040', pipe: '#604040', pipeDark: '#402828',
         hillColor: '#382020', hillDark: '#281010', cloudColor: '#483838' }
};

// === TILE TYPES ===
const T = {
    AIR: 0, GROUND: 1, BRICK: 2, QUESTION: 3, USED: 4,
    PIPE_TL: 5, PIPE_TR: 6, PIPE_BL: 7, PIPE_BR: 8,
    COIN_BLOCK: 9, MUSHROOM_BLOCK: 10, FIRE_BLOCK: 11,
    STAR_BLOCK: 12, ONEUP_BLOCK: 13, HARD: 14,
    BRIDGE: 15, PLATFORM: 16, CASTLE_BLOCK: 17, LAVA: 18,
    WATER: 19, VINE: 20, INVIS_BLOCK: 21, FLAG_POLE: 22,
    FLAG_TOP: 23
};

// === SPRITE DRAWING ===
const spriteCache = {};

function drawMario(ctx, x, y, big, fire, frame, dir, ducking) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) { ctx.scale(-1, 1); ctx.translate(-TILE, 0); }

    const h = big ? TILE * 2 : TILE;
    const skinColor = '#ffb090';
    const hatColor = fire ? '#fcfcfc' : '#e02020';
    const shirtColor = fire ? '#e02020' : hatColor;
    const overallColor = fire ? '#804000' : '#0058f8';

    if (big && ducking) {
        // Ducking big Mario
        ctx.fillStyle = hatColor;
        ctx.fillRect(4, 20, 24, 8);
        ctx.fillStyle = skinColor;
        ctx.fillRect(6, 28, 10, 8);
        ctx.fillStyle = overallColor;
        ctx.fillRect(4, 36, 24, 20);
        ctx.fillStyle = '#804020';
        ctx.fillRect(6, 56, 8, 8);
        ctx.fillRect(18, 56, 8, 8);
    } else if (big) {
        // Big Mario
        const wy = frame === 3 ? -4 : 0; // jump offset
        ctx.fillStyle = hatColor;
        ctx.fillRect(6, 0 + wy, 20, 8);
        ctx.fillRect(4, 4 + wy, 24, 4);
        ctx.fillStyle = skinColor;
        ctx.fillRect(6, 8 + wy, 8, 8);
        ctx.fillRect(16, 10 + wy, 4, 6);
        ctx.fillStyle = '#402010';
        ctx.fillRect(8, 8 + wy, 2, 2);
        ctx.fillStyle = shirtColor;
        ctx.fillRect(4, 16, 24, 8);
        ctx.fillRect(6, 24, 20, 4);
        ctx.fillStyle = overallColor;
        ctx.fillRect(6, 28, 20, 16);
        ctx.fillRect(10, 26, 12, 4);
        // Buttons
        ctx.fillStyle = '#f8d800';
        ctx.fillRect(12, 30, 3, 3);
        ctx.fillRect(18, 30, 3, 3);
        // Legs
        if (frame === 1 || frame === 2) {
            ctx.fillStyle = overallColor;
            ctx.fillRect(4, 44, 10, 10);
            ctx.fillRect(18, 44, 10, 10);
            ctx.fillStyle = '#804020';
            ctx.fillRect(2, 54, 12, 8);
            ctx.fillRect(18, 50, 12, 8);
        } else {
            ctx.fillStyle = overallColor;
            ctx.fillRect(6, 44, 8, 10);
            ctx.fillRect(18, 44, 8, 10);
            ctx.fillStyle = '#804020';
            ctx.fillRect(4, 54, 10, 8);
            ctx.fillRect(18, 54, 10, 8);
        }
    } else {
        // Small Mario
        const wy = frame === 3 ? -2 : 0;
        ctx.fillStyle = hatColor;
        ctx.fillRect(6, 2 + wy, 18, 6);
        ctx.fillStyle = skinColor;
        ctx.fillRect(6, 8 + wy, 8, 6);
        ctx.fillRect(16, 10 + wy, 4, 4);
        ctx.fillStyle = '#402010';
        ctx.fillRect(8, 9 + wy, 2, 2);
        ctx.fillStyle = shirtColor;
        ctx.fillRect(4, 14, 24, 6);
        ctx.fillStyle = overallColor;
        ctx.fillRect(6, 18, 20, 8);
        if (frame === 1 || frame === 2) {
            ctx.fillStyle = '#804020';
            ctx.fillRect(2, 26, 12, 6);
            ctx.fillRect(18, 24, 12, 6);
        } else {
            ctx.fillStyle = '#804020';
            ctx.fillRect(4, 26, 10, 6);
            ctx.fillRect(18, 26, 10, 6);
        }
    }
    ctx.restore();
}

function drawGoomba(ctx, x, y, frame, squished) {
    ctx.save();
    ctx.translate(x, y);
    if (squished) {
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(2, 24, 28, 8);
        ctx.fillStyle = '#402010';
        ctx.fillRect(6, 26, 4, 2);
        ctx.fillRect(20, 26, 4, 2);
        ctx.restore(); return;
    }
    // Body
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(4, 4, 24, 12);
    ctx.fillRect(2, 8, 28, 12);
    ctx.fillRect(4, 16, 24, 8);
    // Eyes
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(8, 8, 6, 6);
    ctx.fillRect(18, 8, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(12, 10, 3, 4);
    ctx.fillRect(18, 10, 3, 4);
    // Mouth
    ctx.fillStyle = '#000';
    ctx.fillRect(12, 16, 8, 2);
    // Feet
    ctx.fillStyle = '#402010';
    if (frame === 0) {
        ctx.fillRect(2, 24, 12, 8);
        ctx.fillRect(18, 24, 12, 8);
    } else {
        ctx.fillRect(0, 24, 14, 8);
        ctx.fillRect(18, 24, 14, 8);
    }
    ctx.restore();
}

function drawKoopa(ctx, x, y, frame, dir, inShell) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0 && !inShell) { ctx.scale(-1, 1); ctx.translate(-TILE, 0); }

    if (inShell) {
        ctx.fillStyle = '#00a800';
        ctx.fillRect(4, 8, 24, 20);
        ctx.fillRect(6, 6, 20, 24);
        ctx.fillStyle = '#f8d800';
        ctx.fillRect(8, 12, 16, 12);
        ctx.fillStyle = '#805000';
        ctx.fillRect(10, 14, 12, 8);
        ctx.restore(); return;
    }
    // Head
    ctx.fillStyle = '#00a800';
    ctx.fillRect(18, -8, 12, 12);
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(24, -6, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(26, -4, 2, 2);
    // Shell
    ctx.fillStyle = '#00a800';
    ctx.fillRect(4, 2, 22, 18);
    ctx.fillRect(2, 6, 26, 12);
    ctx.fillStyle = '#f8d800';
    ctx.fillRect(8, 6, 14, 10);
    // Legs
    ctx.fillStyle = '#f8a040';
    if (frame === 0) {
        ctx.fillRect(6, 20, 8, 12);
        ctx.fillRect(16, 20, 8, 10);
    } else {
        ctx.fillRect(6, 20, 8, 10);
        ctx.fillRect(16, 20, 8, 12);
    }
    ctx.fillStyle = '#f8a040';
    ctx.fillRect(4, 28, 10, 4);
    ctx.fillRect(16, 28, 10, 4);
    ctx.restore();
}

function drawPiranha(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x, y);
    // Stem
    ctx.fillStyle = '#00a800';
    ctx.fillRect(10, 16, 12, 20);
    // Head
    ctx.fillStyle = '#e02020';
    ctx.fillRect(2, 0, 28, 16);
    // Spots
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(4, 4, 4, 4);
    ctx.fillRect(12, 2, 4, 4);
    ctx.fillRect(22, 4, 4, 4);
    // Mouth
    if (frame === 0) {
        ctx.fillStyle = '#800000';
        ctx.fillRect(4, 12, 24, 4);
    } else {
        ctx.fillStyle = '#800000';
        ctx.fillRect(4, 10, 24, 6);
    }
    ctx.restore();
}

function drawBulletBill(ctx, x, y, dir) {
    ctx.save();
    ctx.translate(x, y);
    if (dir > 0) { ctx.scale(-1, 1); ctx.translate(-TILE, 0); }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 4, 32, 24);
    ctx.fillRect(4, 2, 24, 28);
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(22, 10, 6, 6);
    ctx.fillStyle = '#800000';
    ctx.fillRect(0, 8, 4, 16);
    ctx.restore();
}

function drawHammerBro(ctx, x, y, frame, dir) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) { ctx.scale(-1, 1); ctx.translate(-TILE, 0); }
    // Body (green like koopa but with helmet)
    ctx.fillStyle = '#00a800';
    ctx.fillRect(6, -10, 20, 12);
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(8, -6, 10, 6);
    ctx.fillRect(18, -8, 8, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(20, -4, 3, 3);
    // Helmet
    ctx.fillStyle = '#e0e000';
    ctx.fillRect(4, -14, 24, 6);
    // Shell body
    ctx.fillStyle = '#00a800';
    ctx.fillRect(4, 2, 24, 16);
    ctx.fillStyle = '#f8d800';
    ctx.fillRect(8, 4, 16, 12);
    // Legs
    ctx.fillStyle = '#f8a040';
    ctx.fillRect(6, 18, 8, 12);
    ctx.fillRect(18, 18, 8, 12);
    // Arm throwing hammer
    if (frame === 0) {
        ctx.fillStyle = '#804020';
        ctx.fillRect(22, -18, 4, 14);
        ctx.fillRect(18, -22, 12, 4);
    }
    ctx.restore();
}

function drawHammer(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x + 12, y + 12);
    ctx.rotate(frame * Math.PI / 4);
    ctx.fillStyle = '#804020';
    ctx.fillRect(-2, -14, 4, 18);
    ctx.fillStyle = '#808080';
    ctx.fillRect(-5, -20, 10, 8);
    ctx.restore();
}

function drawCoin(ctx, x, y, frame) {
    const widths = [12, 8, 4, 8];
    const w = widths[frame % 4];
    ctx.fillStyle = '#f8d800';
    ctx.fillRect(x + 16 - w/2, y + 4, w, 24);
    ctx.fillStyle = '#e0a000';
    ctx.fillRect(x + 16 - w/2 + 2, y + 8, Math.max(w - 4, 1), 16);
}

function drawMushroom(ctx, x, y, isOneUp) {
    ctx.save();
    ctx.translate(x, y);
    // Cap
    ctx.fillStyle = isOneUp ? '#00a800' : '#e02020';
    ctx.fillRect(4, 2, 24, 14);
    ctx.fillRect(2, 6, 28, 8);
    // Spots
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(8, 4, 6, 6);
    ctx.fillRect(18, 4, 6, 6);
    ctx.fillRect(12, 10, 8, 4);
    // Stem
    ctx.fillStyle = '#f8d878';
    ctx.fillRect(8, 16, 16, 12);
    ctx.fillStyle = '#e0c060';
    ctx.fillRect(10, 18, 12, 8);
    ctx.restore();
}

function drawFireFlower(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x, y);
    // Stem
    ctx.fillStyle = '#00a800';
    ctx.fillRect(12, 16, 8, 14);
    // Petals
    const colors = ['#e02020', '#f8a020', '#f8d800', '#fcfcfc'];
    ctx.fillStyle = colors[frame % 4];
    ctx.fillRect(8, 2, 16, 14);
    ctx.fillRect(4, 4, 24, 10);
    // Center
    ctx.fillStyle = '#f8d800';
    ctx.fillRect(12, 6, 8, 6);
    ctx.restore();
}

function drawStar(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x + 16, y + 16);
    const colors = ['#f8d800', '#fcfcfc', '#f8a020', '#e02020'];
    ctx.fillStyle = colors[frame % 4];
    // Simple star shape
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const r = 14;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawFireball(ctx, x, y, frame) {
    const colors = ['#f84000', '#f8a020', '#f8d800', '#f8a020'];
    ctx.fillStyle = colors[frame % 4];
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2);
    ctx.fill();
}

function drawFlag(ctx, x, y) {
    ctx.fillStyle = '#00a800';
    ctx.fillRect(x, y, 20, 16);
    ctx.fillStyle = '#008000';
    ctx.fillRect(x, y + 4, 18, 8);
}

// === TILE RENDERING ===
function drawTile(tileType, x, y, theme, animFrame) {
    const th = WORLD_THEMES[theme] || WORLD_THEMES[1];

    switch (tileType) {
        case T.GROUND:
            ctx.fillStyle = th.ground;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = th.groundTop;
            ctx.fillRect(x, y, TILE, 4);
            // Texture
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x + 4, y + 8, 8, 2);
            ctx.fillRect(x + 18, y + 16, 10, 2);
            ctx.fillRect(x + 2, y + 24, 12, 2);
            break;

        case T.HARD:
            ctx.fillStyle = th.ground;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(x + 4, y + 8, 8, 2);
            ctx.fillRect(x + 18, y + 16, 10, 2);
            break;

        case T.BRICK:
            ctx.fillStyle = th.brick;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x, y + 15, TILE, 2);
            ctx.fillRect(x + 15, y, 2, TILE);
            ctx.fillRect(x + 7, y, 2, 15);
            ctx.fillRect(x + 23, y + 17, 2, 15);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(x + 1, y + 1, 6, 14);
            break;

        case T.QUESTION:
        case T.COIN_BLOCK:
        case T.MUSHROOM_BLOCK:
        case T.FIRE_BLOCK:
        case T.STAR_BLOCK:
        case T.ONEUP_BLOCK:
            const qBounce = (animFrame % 40 < 20) ? 0 : -1;
            ctx.fillStyle = '#f8a020';
            ctx.fillRect(x, y + qBounce, TILE, TILE);
            ctx.fillStyle = '#e08000';
            ctx.fillRect(x + 2, y + 2 + qBounce, TILE - 4, TILE - 4);
            ctx.fillStyle = '#f8d800';
            ctx.fillRect(x + 4, y + 4 + qBounce, TILE - 8, TILE - 8);
            // ? mark
            ctx.fillStyle = '#805000';
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('?', x + 16, y + 23 + qBounce);
            break;

        case T.USED:
            ctx.fillStyle = '#886848';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#6a5030';
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
            break;

        case T.PIPE_TL:
            ctx.fillStyle = th.pipeDark;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = th.pipe;
            ctx.fillRect(x, y, TILE - 4, TILE);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + 2, y, 6, TILE);
            break;
        case T.PIPE_TR:
            ctx.fillStyle = th.pipeDark;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = th.pipe;
            ctx.fillRect(x + 4, y, TILE - 4, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + TILE - 8, y, 6, TILE);
            break;
        case T.PIPE_BL:
            ctx.fillStyle = th.pipe;
            ctx.fillRect(x + 4, y, TILE - 4, TILE);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + 6, y, 4, TILE);
            break;
        case T.PIPE_BR:
            ctx.fillStyle = th.pipe;
            ctx.fillRect(x, y, TILE - 4, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + TILE - 10, y, 4, TILE);
            break;

        case T.PLATFORM:
            ctx.fillStyle = th.ground;
            ctx.fillRect(x, y, TILE, 8);
            ctx.fillStyle = th.groundTop;
            ctx.fillRect(x, y, TILE, 4);
            break;

        case T.BRIDGE:
            ctx.fillStyle = '#c86820';
            ctx.fillRect(x, y, TILE, 6);
            ctx.fillStyle = '#a85010';
            ctx.fillRect(x + 4, y + 6, 4, 10);
            ctx.fillRect(x + 20, y + 6, 4, 10);
            break;

        case T.CASTLE_BLOCK:
            ctx.fillStyle = '#888';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#666';
            ctx.fillRect(x, y + 15, TILE, 2);
            ctx.fillRect(x + 15, y, 2, TILE);
            ctx.fillStyle = '#aaa';
            ctx.fillRect(x + 1, y + 1, 14, 14);
            break;

        case T.LAVA:
            ctx.fillStyle = '#f84000';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#f8a020';
            const lavaOff = Math.sin((x + animFrame * 2) * 0.1) * 4;
            ctx.fillRect(x, y + lavaOff, TILE, 8);
            ctx.fillStyle = '#f8d800';
            ctx.fillRect(x + 8, y + 2 + lavaOff, 16, 4);
            break;

        case T.WATER:
            ctx.fillStyle = 'rgba(32, 96, 200, 0.6)';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(100, 180, 255, 0.4)';
            const waterOff = Math.sin((x + animFrame * 1.5) * 0.12) * 3;
            ctx.fillRect(x, y + waterOff, TILE, 6);
            break;

        case T.FLAG_POLE:
            ctx.fillStyle = '#00a800';
            ctx.fillRect(x + 14, y, 4, TILE);
            break;

        case T.FLAG_TOP:
            ctx.fillStyle = '#00a800';
            ctx.fillRect(x + 14, y, 4, TILE);
            ctx.fillStyle = '#c8c800';
            ctx.fillRect(x + 12, y, 8, 8);
            break;

        case T.INVIS_BLOCK:
            // Invisible - don't draw
            break;
    }
}

// === BACKGROUND DRAWING ===
function drawBackground(cameraX, theme) {
    const th = WORLD_THEMES[theme] || WORLD_THEMES[1];

    // Sky
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Clouds (parallax)
    const cloudPositions = [
        {x: 100, y: 40, w: 80}, {x: 350, y: 60, w: 64}, {x: 600, y: 30, w: 96},
        {x: 900, y: 70, w: 72}, {x: 1200, y: 50, w: 88}, {x: 1550, y: 35, w: 80},
        {x: 1800, y: 65, w: 70}, {x: 2100, y: 45, w: 90}, {x: 2500, y: 55, w: 76},
        {x: 2900, y: 38, w: 84}, {x: 3300, y: 62, w: 68}, {x: 3700, y: 42, w: 92}
    ];
    ctx.fillStyle = th.cloudColor;
    for (const c of cloudPositions) {
        const cx = ((c.x - cameraX * 0.3) % 2400 + 2400) % 2400 - 200;
        ctx.beginPath();
        ctx.arc(cx + c.w * 0.3, c.y + 15, c.w * 0.25, 0, Math.PI * 2);
        ctx.arc(cx + c.w * 0.5, c.y + 8, c.w * 0.3, 0, Math.PI * 2);
        ctx.arc(cx + c.w * 0.7, c.y + 15, c.w * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Hills (parallax)
    if (theme !== 7) { // Not underground
        ctx.fillStyle = th.hillColor;
        const hillPositions = [{x: 0, h: 100, w: 200}, {x: 400, h: 60, w: 150},
                               {x: 800, h: 80, w: 180}, {x: 1300, h: 70, w: 160},
                               {x: 1800, h: 90, w: 200}, {x: 2300, h: 65, w: 170}];
        for (const h of hillPositions) {
            const hx = ((h.x - cameraX * 0.5) % 1600 + 1600) % 1600 - 200;
            ctx.beginPath();
            ctx.moveTo(hx, CANVAS_H - 2 * TILE);
            ctx.quadraticCurveTo(hx + h.w / 2, CANVAS_H - 2 * TILE - h.h, hx + h.w, CANVAS_H - 2 * TILE);
            ctx.fill();
            ctx.fillStyle = th.hillDark;
            ctx.beginPath();
            ctx.moveTo(hx + h.w * 0.3, CANVAS_H - 2 * TILE);
            ctx.quadraticCurveTo(hx + h.w * 0.5, CANVAS_H - 2 * TILE - h.h * 0.5, hx + h.w * 0.7, CANVAS_H - 2 * TILE);
            ctx.fill();
            ctx.fillStyle = th.hillColor;
        }
    }

    // World-specific decorations
    if (theme === 2) {
        // Desert - cacti and pyramids
        const pyramidPositions = [{x: 200, s: 120}, {x: 700, s: 80}, {x: 1300, s: 100}, {x: 2000, s: 90}];
        for (const p of pyramidPositions) {
            const px = ((p.x - cameraX * 0.4) % 1800 + 1800) % 1800 - 200;
            ctx.fillStyle = '#d8a838';
            ctx.beginPath();
            ctx.moveTo(px, CANVAS_H - 2 * TILE);
            ctx.lineTo(px + p.s / 2, CANVAS_H - 2 * TILE - p.s);
            ctx.lineTo(px + p.s, CANVAS_H - 2 * TILE);
            ctx.fill();
            ctx.fillStyle = '#c89828';
            ctx.beginPath();
            ctx.moveTo(px + p.s / 2, CANVAS_H - 2 * TILE - p.s);
            ctx.lineTo(px + p.s, CANVAS_H - 2 * TILE);
            ctx.lineTo(px + p.s / 2, CANVAS_H - 2 * TILE);
            ctx.fill();
        }
    } else if (theme === 4) {
        // Forest - trees in background
        const treePositions = [{x: 50}, {x: 180}, {x: 350}, {x: 520}, {x: 700}, {x: 880},
                               {x: 1100}, {x: 1300}, {x: 1500}, {x: 1700}];
        for (const t of treePositions) {
            const tx = ((t.x - cameraX * 0.35) % 1200 + 1200) % 1200 - 100;
            ctx.fillStyle = '#503820';
            ctx.fillRect(tx + 12, CANVAS_H - 2 * TILE - 60, 16, 60);
            ctx.fillStyle = '#286028';
            ctx.beginPath();
            ctx.arc(tx + 20, CANVAS_H - 2 * TILE - 70, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#184818';
            ctx.beginPath();
            ctx.arc(tx + 25, CANVAS_H - 2 * TILE - 60, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (theme === 5) {
        // Ice - snowflakes
        ctx.fillStyle = '#fcfcfc';
        for (let i = 0; i < 30; i++) {
            const sx = ((i * 97 + Math.sin(game.frameCount * 0.02 + i) * 30 - cameraX * 0.1) % CANVAS_W + CANVAS_W) % CANVAS_W;
            const sy = ((i * 73 + game.frameCount * 0.5) % (CANVAS_H - 64));
            ctx.fillRect(sx, sy, 3, 3);
        }
    } else if (theme === 8) {
        // Dark Land - glowing lava in background
        ctx.fillStyle = '#400000';
        ctx.fillRect(0, CANVAS_H - 100, CANVAS_W, 40);
        for (let x = 0; x < CANVAS_W; x += 40) {
            const glow = Math.sin((x + cameraX * 0.2 + game.frameCount * 0.05)) * 0.3 + 0.5;
            ctx.fillStyle = `rgba(255, 80, 0, ${glow * 0.3})`;
            ctx.fillRect(x, CANVAS_H - 110, 40, 60);
        }
    }
}

// === LEVEL GENERATION ===
function generateLevel(world, level) {
    // Each world+level gets unique dimensions
    const baseLengths = [180, 195, 200, 220, 210, 230, 215, 250];
    const levelWidth = baseLengths[world - 1] + level * 20;
    const groundY = ROWS - 2;
    const tiles = [];

    // Init empty
    for (let r = 0; r < ROWS; r++) {
        tiles[r] = [];
        for (let c = 0; c < levelWidth; c++) {
            tiles[r][c] = T.AIR;
        }
    }

    // Ground
    for (let c = 0; c < levelWidth; c++) {
        tiles[ROWS - 1][c] = T.GROUND;
        tiles[ROWS - 2][c] = T.GROUND;
    }

    // Enemies and items arrays
    const enemies = [];
    const coins = [];

    // Difficulty scaling
    const difficulty = (world - 1) * 4 + level;
    const gapChance = 0.02 + difficulty * 0.005;
    const enemyChance = 0.025 + difficulty * 0.004;

    // Seed for pseudo-random based on world+level
    let seed = world * 1000 + level * 100 + 42;
    function rand() { seed = (seed * 16807 + 12345) % 2147483647; return (seed & 0xffffff) / 0xffffff; }

    // Platform heights for variety
    function addPlatform(startC, width, row, type = T.BRICK) {
        for (let c = startC; c < startC + width && c < levelWidth; c++) {
            if (c >= 0) tiles[row][c] = type;
        }
    }

    function addPipe(c, height) {
        if (c < 2 || c >= levelWidth - 10) return;
        const top = groundY - height;
        tiles[top][c] = T.PIPE_TL;
        tiles[top][c + 1] = T.PIPE_TR;
        for (let r = top + 1; r < groundY; r++) {
            tiles[r][c] = T.PIPE_BL;
            tiles[r][c + 1] = T.PIPE_BR;
        }
    }

    function addGap(startC, width) {
        for (let c = startC; c < startC + width && c < levelWidth; c++) {
            tiles[ROWS - 1][c] = T.AIR;
            tiles[ROWS - 2][c] = T.AIR;
        }
    }

    function addStairs(startC, height, dir = 1) {
        for (let i = 0; i < height; i++) {
            const col = dir > 0 ? startC + i : startC - i;
            for (let r = groundY - i - 1; r < groundY; r++) {
                if (col >= 0 && col < levelWidth) tiles[r][col] = T.HARD;
            }
        }
    }

    // World-specific generation
    let col = 10; // Start after safe zone

    // Clear starting area
    for (let c = 0; c < 8; c++) {
        for (let r = 0; r < groundY; r++) {
            tiles[r][c] = T.AIR;
        }
    }

    // Generate level content
    while (col < levelWidth - 20) {
        const r = rand();
        const section = Math.floor(r * 12);

        switch (section) {
            case 0: // Question blocks row
            case 1: {
                const count = 2 + Math.floor(rand() * 4);
                const row = groundY - 4 - Math.floor(rand() * 2);
                for (let i = 0; i < count; i++) {
                    if (col + i < levelWidth) {
                        if (rand() < 0.3) {
                            tiles[row][col + i] = rand() < 0.5 ? T.MUSHROOM_BLOCK : T.COIN_BLOCK;
                        } else {
                            tiles[row][col + i] = T.BRICK;
                        }
                    }
                }
                // Maybe add coins above
                if (rand() < 0.4) {
                    for (let i = 0; i < count; i++) {
                        coins.push({x: (col + i) * TILE + 8, y: (row - 2) * TILE + 8, collected: false});
                    }
                }
                col += count + 2 + Math.floor(rand() * 3);
                break;
            }

            case 2: // Pipe
            case 3: {
                const pipeH = 2 + Math.floor(rand() * 3);
                addPipe(col, pipeH);
                // Maybe piranha
                if (difficulty > 4 && rand() < 0.5) {
                    const piranhaY = (groundY - pipeH) * TILE;
                    enemies.push({type: 'piranha', x: col * TILE + 4, y: piranhaY,
                                  baseY: piranhaY, alive: true, timer: rand() * 120});
                }
                col += 4 + Math.floor(rand() * 2);
                break;
            }

            case 4: // Gap
            {
                const gapW = 2 + Math.floor(rand() * (1 + Math.min(difficulty / 8, 3)));
                addGap(col, gapW);
                if (world === 8) {
                    // Lava in gaps
                    for (let c = col; c < col + gapW && c < levelWidth; c++) {
                        tiles[ROWS - 1][c] = T.LAVA;
                    }
                }
                col += gapW + 2;
                break;
            }

            case 5: // Stairs up and down
            case 6: {
                const stH = 3 + Math.floor(rand() * 3);
                addStairs(col, stH, 1);
                addStairs(col + stH * 2 - 1, stH, -1);
                col += stH * 2 + 2;
                break;
            }

            case 7: // Enemy group
            {
                const numEnemies = 1 + Math.floor(rand() * (1 + difficulty / 6));
                for (let i = 0; i < numEnemies; i++) {
                    const ex = (col + i * 3) * TILE;
                    const ey = (groundY - 1) * TILE;
                    if (rand() < 0.6 || world < 3) {
                        enemies.push({type: 'goomba', x: ex, y: ey, vx: -1, alive: true, frame: 0});
                    } else {
                        enemies.push({type: 'koopa', x: ex, y: ey - 8, vx: -1, alive: true, frame: 0, inShell: false, shellVx: 0});
                    }
                }
                col += numEnemies * 3 + 2;
                break;
            }

            case 8: // Floating platform section
            {
                const platCount = 2 + Math.floor(rand() * 3);
                for (let i = 0; i < platCount; i++) {
                    const pw = 3 + Math.floor(rand() * 4);
                    const pr = groundY - 3 - Math.floor(rand() * 4);
                    const qBlock = rand() < 0.3;
                    addPlatform(col, pw, pr, qBlock ? T.QUESTION : T.BRICK);
                    if (qBlock) {
                        const midC = col + Math.floor(pw / 2);
                        if (midC < levelWidth) {
                            tiles[pr][midC] = rand() < 0.4 ? T.MUSHROOM_BLOCK : T.COIN_BLOCK;
                        }
                    }
                    col += pw + 2 + Math.floor(rand() * 2);
                }
                break;
            }

            case 9: // Coin run
            {
                const coinCount = 5 + Math.floor(rand() * 8);
                const coinRow = groundY - 3 - Math.floor(rand() * 3);
                for (let i = 0; i < coinCount; i++) {
                    coins.push({x: (col + i) * TILE + 8, y: coinRow * TILE + 8, collected: false});
                }
                col += coinCount + 2;
                break;
            }

            case 10: // Power-up blocks
            {
                const blockRow = groundY - 4;
                if (col < levelWidth) {
                    if (rand() < 0.3) tiles[blockRow][col] = T.FIRE_BLOCK;
                    else if (rand() < 0.3) tiles[blockRow][col] = T.STAR_BLOCK;
                    else tiles[blockRow][col] = T.MUSHROOM_BLOCK;
                }
                // Hidden 1-up
                if (rand() < 0.15) {
                    tiles[blockRow - 3][col + 2] = T.ONEUP_BLOCK;
                }
                col += 4;
                break;
            }

            case 11: // World specific sections
            {
                if (world === 1) {
                    // Grass land - classic pipe section with goombas
                    const pH = 2 + Math.floor(rand() * 2);
                    addPipe(col, pH);
                    addPipe(col + 5, pH + 1);
                    enemies.push({type: 'goomba', x: (col + 3) * TILE, y: (groundY - 1) * TILE, vx: -1, alive: true, frame: 0});
                    col += 8;
                } else if (world === 2) {
                    // Desert - quicksand gaps with floating platforms over them
                    const gapW = 4 + Math.floor(rand() * 3);
                    addGap(col, gapW);
                    // Platforms over the gap
                    addPlatform(col + 1, 2, groundY - 3, T.PLATFORM);
                    addPlatform(col + gapW - 2, 2, groundY - 5, T.PLATFORM);
                    coins.push({x: (col + 1) * TILE + 16, y: (groundY - 5) * TILE, collected: false});
                    coins.push({x: (col + gapW - 2) * TILE + 16, y: (groundY - 7) * TILE, collected: false});
                    col += gapW + 2;
                } else if (world === 3) {
                    // Ocean - water pools with platforms
                    const wLen = 8 + Math.floor(rand() * 6);
                    for (let c = col; c < col + wLen && c < levelWidth; c++) {
                        tiles[ROWS - 1][c] = T.WATER;
                        tiles[ROWS - 2][c] = T.WATER;
                    }
                    // Platforms over water
                    addPlatform(col + 2, 3, groundY - 2, T.PLATFORM);
                    addPlatform(col + wLen - 4, 3, groundY - 3, T.PLATFORM);
                    coins.push({x: (col + 3) * TILE + 8, y: (groundY - 4) * TILE + 8, collected: false});
                    col += wLen + 2;
                } else if (world === 4) {
                    // Forest - tall pipe trees and hidden blocks
                    for (let i = 0; i < 3; i++) {
                        const pH = 3 + Math.floor(rand() * 3);
                        addPipe(col + i * 4, pH);
                        if (rand() < 0.4) {
                            tiles[groundY - pH - 2][col + i * 4] = T.ONEUP_BLOCK;
                        }
                    }
                    // Dense enemy placement
                    enemies.push({type: 'koopa', x: (col + 2) * TILE, y: (groundY - 1) * TILE - 8, vx: -1, alive: true, frame: 0, inShell: false, shellVx: 0});
                    enemies.push({type: 'goomba', x: (col + 6) * TILE, y: (groundY - 1) * TILE, vx: 1, alive: true, frame: 0});
                    col += 14;
                } else if (world === 5) {
                    // Ice - slippery staircase sections
                    const stH = 4 + Math.floor(rand() * 2);
                    addStairs(col, stH, 1);
                    // Coins along the stairs
                    for (let i = 0; i < stH; i++) {
                        coins.push({x: (col + i) * TILE + 16, y: (groundY - i - 3) * TILE + 8, collected: false});
                    }
                    addGap(col + stH, 3);
                    addStairs(col + stH + 5, stH, -1);
                    col += stH * 2 + 7;
                } else if (world === 6) {
                    // Sky - floating cloud platform chains
                    for (let i = 0; i < 5; i++) {
                        const pw = 2 + Math.floor(rand() * 3);
                        const pr = 3 + Math.floor(rand() * 8);
                        addPlatform(col, pw, pr, T.PLATFORM);
                        coins.push({x: (col + 1) * TILE + 8, y: (pr - 2) * TILE + 8, collected: false});
                        col += pw + 2 + Math.floor(rand() * 2);
                    }
                    // Remove ground in sky world for added danger
                    if (rand() < 0.5) {
                        const gapStart = col - 8;
                        addGap(gapStart, 6);
                    }
                } else if (world === 7) {
                    // Pipe Land - pipe mazes
                    const pipeCount = 3 + Math.floor(rand() * 3);
                    for (let i = 0; i < pipeCount; i++) {
                        const pH = 2 + Math.floor(rand() * 4);
                        addPipe(col + i * 3, pH);
                        if (rand() < 0.6 && difficulty > 12) {
                            const piranhaY = (groundY - pH) * TILE;
                            enemies.push({type: 'piranha', x: (col + i * 3) * TILE + 4, y: piranhaY,
                                          baseY: piranhaY, alive: true, timer: rand() * 120});
                        }
                    }
                    col += pipeCount * 3 + 2;
                } else if (world === 8) {
                    // Dark Land - castle platform gauntlets with lava
                    addPlatform(col, 8, groundY - 3, T.CASTLE_BLOCK);
                    addPlatform(col + 2, 4, groundY - 6, T.CASTLE_BLOCK);
                    // Lava pit
                    addGap(col + 9, 4);
                    for (let c = col + 9; c < col + 13 && c < levelWidth; c++) {
                        tiles[ROWS - 1][c] = T.LAVA;
                    }
                    addPlatform(col + 10, 2, groundY - 4, T.BRIDGE);
                    // Add hammer bro
                    if (rand() < 0.5) {
                        enemies.push({type: 'hammerbro', x: (col + 3) * TILE, y: (groundY - 4) * TILE - 16,
                                      vx: 1, alive: true, frame: 0, timer: 0, jumpTimer: 0});
                    }
                    col += 15;
                } else {
                    col += 3 + Math.floor(rand() * 3);
                }
                break;
            }
        }

        // Add random enemies in gaps
        if (rand() < enemyChance && col > 15 && col < levelWidth - 25) {
            const ex = col * TILE;
            const ey = (groundY - 1) * TILE;
            if (rand() < 0.5) {
                enemies.push({type: 'goomba', x: ex, y: ey, vx: -1, alive: true, frame: 0});
            } else if (difficulty > 8 && rand() < 0.3) {
                enemies.push({type: 'bulletbill', x: ex, y: (groundY - 4) * TILE,
                              vx: -3, alive: true, frame: 0});
            }
        }
    }

    // Level 4 of each world = castle level with special ending
    if (level === 4) {
        // Make last section castle themed
        const castleStart = levelWidth - 30;
        for (let c = castleStart; c < levelWidth; c++) {
            tiles[ROWS - 1][c] = T.CASTLE_BLOCK;
            tiles[ROWS - 2][c] = T.CASTLE_BLOCK;
            if (c > castleStart + 5 && c < levelWidth - 8) {
                // Bridge over lava
                tiles[ROWS - 2][c] = T.BRIDGE;
                tiles[ROWS - 1][c] = T.LAVA;
            }
        }
        // Castle walls
        for (let r = 0; r < groundY; r++) {
            tiles[r][castleStart] = T.CASTLE_BLOCK;
            tiles[r][levelWidth - 5] = T.CASTLE_BLOCK;
        }
        // Boss area - add harder enemies
        enemies.push({type: 'hammerbro', x: (levelWidth - 15) * TILE, y: (groundY - 3) * TILE,
                      vx: 1, alive: true, frame: 0, timer: 0, jumpTimer: 0});
        if (world >= 4) {
            enemies.push({type: 'hammerbro', x: (levelWidth - 20) * TILE, y: (groundY - 3) * TILE,
                          vx: -1, alive: true, frame: 0, timer: 0, jumpTimer: 0});
        }
    }

    // Flag pole at end (not for level 4/castle)
    if (level !== 4) {
        const flagC = levelWidth - 6;
        tiles[3][flagC] = T.FLAG_TOP;
        for (let r = 4; r < groundY; r++) {
            tiles[r][flagC] = T.FLAG_POLE;
        }
        // Small castle after flag
        for (let r = groundY - 3; r < groundY; r++) {
            for (let c = flagC + 3; c < flagC + 8; c++) {
                if (c < levelWidth) tiles[r][c] = T.CASTLE_BLOCK;
            }
        }
        // Castle tower
        for (let r = groundY - 5; r < groundY - 3; r++) {
            for (let c = flagC + 4; c < flagC + 7; c++) {
                if (c < levelWidth) tiles[r][c] = T.CASTLE_BLOCK;
            }
        }
        // Castle door
        tiles[groundY - 1][flagC + 5] = T.AIR;
        tiles[groundY - 2][flagC + 5] = T.AIR;
    } else {
        // Castle level - axe at the end
        const axeC = levelWidth - 8;
        coins.push({x: axeC * TILE + 8, y: (groundY - 3) * TILE, collected: false, isAxe: true});
    }

    return { tiles, enemies, coins, width: levelWidth, groundY };
}

// === PARTICLES ===
const particles = [];

function addParticle(x, y, type, color) {
    const p = { x, y, type, color, life: 1, vx: 0, vy: 0, timer: 0 };
    switch (type) {
        case 'brick':
            for (let i = 0; i < 4; i++) {
                particles.push({...p,
                    vx: (i % 2 === 0 ? -2 : 2) + Math.random() * 2,
                    vy: -6 - Math.random() * 4,
                    size: 8 + Math.random() * 6
                });
            }
            return;
        case 'coin':
            p.vy = -8; p.timer = 30; break;
        case 'score':
            p.vy = -2; p.timer = 40; p.text = color; p.color = '#fff'; break;
        case 'firework':
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                particles.push({...p,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3,
                    color: ['#f84000', '#f8d800', '#00a800', '#fcfcfc'][Math.floor(Math.random() * 4)],
                    size: 4, timer: 40
                });
            }
            return;
    }
    particles.push(p);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.timer--;
        if (p.type === 'brick' || p.type === 'firework') {
            p.vy += 0.3;
            if (p.timer <= 0 && p.y > CANVAS_H) { particles.splice(i, 1); continue; }
        }
        if (p.type === 'coin') {
            p.vy += 0.4;
        }
        if (p.timer <= 0) { particles.splice(i, 1); }
    }
}

function drawParticles(cameraX) {
    for (const p of particles) {
        const sx = p.x - cameraX;
        const sy = p.y;
        if (p.type === 'score') {
            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(p.text, sx, sy);
        } else if (p.type === 'coin') {
            drawCoin(ctx, sx - 8, sy - 8, Math.floor(p.timer / 3) % 4);
        } else {
            ctx.fillStyle = p.color || '#c84c0c';
            ctx.fillRect(sx - (p.size || 6) / 2, sy - (p.size || 6) / 2, p.size || 6, p.size || 6);
        }
    }
}

// === FIREBALLS ===
const fireballs = [];

function addFireball(x, y, dir) {
    if (fireballs.length < 2) {
        fireballs.push({x, y, vx: dir * 6, vy: 0, alive: true, frame: 0});
        SFX.fireball();
    }
}

function updateFireballs(levelData) {
    for (let i = fireballs.length - 1; i >= 0; i--) {
        const fb = fireballs[i];
        fb.x += fb.vx;
        fb.vy += 0.3;
        fb.y += fb.vy;
        fb.frame++;

        // Bounce off ground
        const tileBelow = getTile(levelData, Math.floor(fb.x / TILE), Math.floor((fb.y + 6) / TILE));
        if (isSolid(tileBelow) && fb.vy > 0) {
            fb.vy = -5;
            fb.y = Math.floor((fb.y + 6) / TILE) * TILE - 6;
        }

        // Check if offscreen or hit wall
        const tileAt = getTile(levelData, Math.floor(fb.x / TILE), Math.floor(fb.y / TILE));
        if (isSolid(tileAt) || fb.x < camera.x - 32 || fb.x > camera.x + CANVAS_W + 32 || fb.y > CANVAS_H + 32) {
            fireballs.splice(i, 1);
        }
    }
}

function drawFireballs(cameraX) {
    for (const fb of fireballs) {
        drawFireball(ctx, fb.x - cameraX - 6, fb.y - 6, Math.floor(fb.frame / 3) % 4);
    }
}

// === CAMERA ===
const camera = { x: 0, y: 0 };

function updateCamera(playerX) {
    const targetX = playerX - CANVAS_W / 3;
    camera.x += (targetX - camera.x) * 0.1;
    if (camera.x < 0) camera.x = 0;
    if (currentLevel) {
        const maxX = currentLevel.width * TILE - CANVAS_W;
        if (camera.x > maxX) camera.x = maxX;
    }
}

// === PLAYER ===
const player = {
    x: 64, y: 0, vx: 0, vy: 0,
    width: 24, height: 30,
    big: false, fire: false, star: false, starTimer: 0,
    onGround: false, facing: 1, frame: 0, animTimer: 0,
    dead: false, deathTimer: 0, ducking: false,
    invincible: false, invincibleTimer: 0,
    sliding: false, flagSlide: false, flagSlideY: 0,
    winWalk: false, winWalkTarget: 0
};

function resetPlayer() {
    player.x = 64;
    player.y = (ROWS - 4) * TILE;
    player.vx = 0; player.vy = 0;
    player.onGround = false;
    player.facing = 1; player.frame = 0;
    player.dead = false; player.deathTimer = 0;
    player.ducking = false;
    player.flagSlide = false; player.winWalk = false;
    player.invincible = false; player.invincibleTimer = 0;
    player.star = false; player.starTimer = 0;
}

// === COLLISION HELPERS ===
function getTile(levelData, col, row) {
    if (!levelData || row < 0 || row >= ROWS || col < 0 || col >= levelData.width) return T.AIR;
    return levelData.tiles[row][col];
}

function isSolid(tile) {
    return tile === T.GROUND || tile === T.BRICK || tile === T.QUESTION || tile === T.USED ||
           tile === T.HARD || tile === T.PIPE_TL || tile === T.PIPE_TR || tile === T.PIPE_BL ||
           tile === T.PIPE_BR || tile === T.COIN_BLOCK || tile === T.MUSHROOM_BLOCK ||
           tile === T.FIRE_BLOCK || tile === T.STAR_BLOCK || tile === T.ONEUP_BLOCK ||
           tile === T.CASTLE_BLOCK || tile === T.INVIS_BLOCK;
}

function isPlatform(tile) {
    return tile === T.PLATFORM || tile === T.BRIDGE;
}

function isHazard(tile) {
    return tile === T.LAVA;
}

// === ITEM ENTITIES ===
const items = [];

function spawnItem(x, y, type) {
    items.push({type, x: x * TILE, y: y * TILE - TILE, targetY: y * TILE - TILE,
                vx: type === 'star' ? 2 : (type === 'mushroom' || type === 'oneup' ? 1.5 : 0),
                vy: 0, alive: true, emerging: true, emergeY: y * TILE, frame: 0});
}

function updateItems(levelData) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item.alive) { items.splice(i, 1); continue; }

        item.frame++;

        if (item.emerging) {
            item.y -= 1;
            if (item.y <= item.emergeY - TILE) {
                item.emerging = false;
                item.y = item.emergeY - TILE;
            }
            continue;
        }

        // Physics for moving items
        if (item.type === 'mushroom' || item.type === 'oneup' || item.type === 'star') {
            item.vy += GRAVITY * 0.8;
            if (item.vy > MAX_FALL) item.vy = MAX_FALL;
            item.y += item.vy;
            item.x += item.vx;

            // Ground collision
            const footCol = Math.floor((item.x + 16) / TILE);
            const footRow = Math.floor((item.y + TILE) / TILE);
            if (isSolid(getTile(levelData, footCol, footRow))) {
                item.y = (footRow - 1) * TILE;
                item.vy = item.type === 'star' ? -8 : 0;
            }

            // Wall collision
            const sideCol = item.vx > 0 ? Math.floor((item.x + 28) / TILE) : Math.floor(item.x / TILE);
            const sideRow = Math.floor((item.y + 16) / TILE);
            if (isSolid(getTile(levelData, sideCol, sideRow))) {
                item.vx *= -1;
            }

            // Remove if fallen
            if (item.y > ROWS * TILE + 64) { items.splice(i, 1); continue; }
        }

        // Player collision
        const px = player.x, py = player.y;
        const pw = player.width, ph = player.big ? 56 : 28;
        if (item.x < px + pw && item.x + 28 > px && item.y < py + ph && item.y + 28 > py) {
            item.alive = false;
            if (item.type === 'mushroom') {
                if (!player.big) {
                    player.big = true;
                    player.height = 56;
                    player.y -= 32;
                }
                SFX.powerup();
                game.score += 1000;
                addParticle(item.x, item.y, 'score', '1000');
            } else if (item.type === 'fire') {
                if (!player.big) {
                    player.big = true;
                    player.height = 56;
                    player.y -= 32;
                }
                player.fire = true;
                SFX.powerup();
                game.score += 1000;
                addParticle(item.x, item.y, 'score', '1000');
            } else if (item.type === 'star') {
                player.star = true;
                player.starTimer = 600;
                player.invincible = true;
                player.invincibleTimer = 600;
                SFX.powerup();
                game.score += 1000;
                addParticle(item.x, item.y, 'score', '1000');
            } else if (item.type === 'oneup') {
                game.lives++;
                SFX.oneup();
                addParticle(item.x, item.y, 'score', '1UP');
            }
        }
    }
}

function drawItems(cameraX) {
    for (const item of items) {
        if (!item.alive) continue;
        const sx = item.x - cameraX;
        const sy = item.y;
        if (sx < -TILE || sx > CANVAS_W + TILE) continue;

        if (item.type === 'mushroom') drawMushroom(ctx, sx, sy, false);
        else if (item.type === 'oneup') drawMushroom(ctx, sx, sy, true);
        else if (item.type === 'fire') drawFireFlower(ctx, sx, sy, Math.floor(item.frame / 8) % 4);
        else if (item.type === 'star') drawStar(ctx, sx, sy, Math.floor(item.frame / 6) % 4);
    }
}

// === BLOCK HIT HANDLING ===
function hitBlock(col, row, levelData) {
    const tile = getTile(levelData, col, row);

    switch (tile) {
        case T.COIN_BLOCK:
        case T.QUESTION:
            levelData.tiles[row][col] = T.USED;
            game.coins++;
            game.score += 200;
            SFX.coin();
            addParticle(col * TILE, row * TILE - TILE, 'coin', '#f8d800');
            addParticle(col * TILE + 16, row * TILE, 'score', '200');
            break;

        case T.MUSHROOM_BLOCK:
            levelData.tiles[row][col] = T.USED;
            if (player.big) spawnItem(col, row, 'fire');
            else spawnItem(col, row, 'mushroom');
            SFX.powerup();
            break;

        case T.FIRE_BLOCK:
            levelData.tiles[row][col] = T.USED;
            spawnItem(col, row, 'fire');
            SFX.powerup();
            break;

        case T.STAR_BLOCK:
            levelData.tiles[row][col] = T.USED;
            spawnItem(col, row, 'star');
            SFX.powerup();
            break;

        case T.ONEUP_BLOCK:
            levelData.tiles[row][col] = T.USED;
            spawnItem(col, row, 'oneup');
            SFX.powerup();
            break;

        case T.INVIS_BLOCK:
            levelData.tiles[row][col] = T.USED;
            spawnItem(col, row, 'oneup');
            SFX.powerup();
            break;

        case T.BRICK:
            if (player.big) {
                levelData.tiles[row][col] = T.AIR;
                SFX.brick();
                addParticle(col * TILE + 16, row * TILE + 16, 'brick', WORLD_THEMES[game.world].brick);
                game.score += 50;
            } else {
                SFX.bump();
            }
            break;
    }

    // Check for enemies above the block
    if (levelData && levelData.enemies) {
        for (const enemy of levelData.enemies) {
            if (!enemy.alive) continue;
            const ec = Math.floor((enemy.x + 16) / TILE);
            const er = Math.floor(enemy.y / TILE);
            if (ec === col && er === row - 1) {
                enemy.alive = false;
                enemy.vy = -5;
                game.score += 100;
                SFX.stomp();
                addParticle(enemy.x, enemy.y, 'score', '100');
            }
        }
    }
}

// === ENEMY UPDATE ===
function updateEnemies(levelData) {
    if (!levelData) return;

    for (const enemy of levelData.enemies) {
        if (!enemy.alive) continue;

        // Only update enemies near the player
        if (Math.abs(enemy.x - player.x) > CANVAS_W + 100) continue;

        enemy.frame = (enemy.frame || 0) + 1;

        switch (enemy.type) {
            case 'goomba': {
                enemy.x += enemy.vx;
                // Gravity
                if (enemy.vy === undefined) enemy.vy = 0;
                enemy.vy += GRAVITY * 0.5;
                if (enemy.vy > MAX_FALL) enemy.vy = MAX_FALL;
                enemy.y += enemy.vy;

                // Ground collision
                const footCol = Math.floor((enemy.x + 16) / TILE);
                const footRow = Math.floor((enemy.y + TILE) / TILE);
                if (isSolid(getTile(levelData, footCol, footRow))) {
                    enemy.y = (footRow - 1) * TILE;
                    enemy.vy = 0;
                }

                // Wall collision
                const sCol = enemy.vx > 0 ? Math.floor((enemy.x + 28) / TILE) : Math.floor((enemy.x + 4) / TILE);
                const sRow = Math.floor((enemy.y + 16) / TILE);
                if (isSolid(getTile(levelData, sCol, sRow))) {
                    enemy.vx *= -1;
                }

                // Fall off level
                if (enemy.y > ROWS * TILE + 32) enemy.alive = false;
                break;
            }

            case 'koopa': {
                if (enemy.inShell && enemy.shellVx !== 0) {
                    enemy.x += enemy.shellVx;
                    // Wall collision for shell
                    const sCol = enemy.shellVx > 0 ? Math.floor((enemy.x + 28) / TILE) : Math.floor((enemy.x + 4) / TILE);
                    const sRow = Math.floor((enemy.y + 16) / TILE);
                    if (isSolid(getTile(levelData, sCol, sRow))) {
                        enemy.shellVx *= -1;
                    }
                    // Shell kills other enemies
                    for (const other of levelData.enemies) {
                        if (other === enemy || !other.alive) continue;
                        if (Math.abs(other.x - enemy.x) < 24 && Math.abs(other.y - enemy.y) < 24) {
                            other.alive = false;
                            game.score += 100;
                            SFX.stomp();
                        }
                    }
                } else if (!enemy.inShell) {
                    enemy.x += enemy.vx;
                }

                // Gravity
                if (enemy.vy === undefined) enemy.vy = 0;
                enemy.vy += GRAVITY * 0.5;
                if (enemy.vy > MAX_FALL) enemy.vy = MAX_FALL;
                enemy.y += enemy.vy;

                const footCol = Math.floor((enemy.x + 16) / TILE);
                const footRow = Math.floor((enemy.y + TILE) / TILE);
                if (isSolid(getTile(levelData, footCol, footRow))) {
                    enemy.y = (footRow - 1) * TILE;
                    enemy.vy = 0;
                }

                const wCol = enemy.vx > 0 ? Math.floor((enemy.x + 28) / TILE) : Math.floor((enemy.x + 4) / TILE);
                const wRow = Math.floor((enemy.y + 16) / TILE);
                if (isSolid(getTile(levelData, wCol, wRow)) && !enemy.inShell) {
                    enemy.vx *= -1;
                }

                if (enemy.y > ROWS * TILE + 32) enemy.alive = false;
                break;
            }

            case 'piranha': {
                // Bob up and down from pipe
                enemy.timer = (enemy.timer || 0) + 1;
                const cycle = enemy.timer % 180;
                if (cycle < 60) {
                    enemy.y = enemy.baseY + (60 - cycle) * 0.7;
                } else if (cycle < 90) {
                    enemy.y = enemy.baseY;
                } else if (cycle < 150) {
                    enemy.y = enemy.baseY + (cycle - 90) * 0.7;
                } else {
                    enemy.y = enemy.baseY + 42;
                }
                break;
            }

            case 'bulletbill': {
                enemy.x += enemy.vx;
                if (enemy.x < camera.x - 64 || enemy.x > camera.x + CANVAS_W + 64) {
                    enemy.alive = false;
                }
                break;
            }

            case 'hammerbro': {
                enemy.timer = (enemy.timer || 0) + 1;
                // Pace back and forth
                if (enemy.timer % 120 < 60) enemy.x += 0.5;
                else enemy.x -= 0.5;

                // Jump occasionally
                enemy.jumpTimer = (enemy.jumpTimer || 0) + 1;
                if (enemy.jumpTimer > 80) {
                    if (enemy.vy === undefined) enemy.vy = 0;
                    if (enemy.onGround) {
                        enemy.vy = -8;
                        enemy.onGround = false;
                        enemy.jumpTimer = 0;
                    }
                }

                // Gravity
                if (enemy.vy === undefined) enemy.vy = 0;
                enemy.vy += GRAVITY * 0.5;
                enemy.y += enemy.vy;

                const footCol = Math.floor((enemy.x + 16) / TILE);
                const footRow = Math.floor((enemy.y + TILE) / TILE);
                if (isSolid(getTile(levelData, footCol, footRow))) {
                    enemy.y = (footRow - 1) * TILE;
                    enemy.vy = 0;
                    enemy.onGround = true;
                }

                // Throw hammers
                if (enemy.timer % 60 === 0) {
                    const hDir = player.x > enemy.x ? 1 : -1;
                    levelData.enemies.push({
                        type: 'hammer', x: enemy.x, y: enemy.y - 20,
                        vx: hDir * 3, vy: -6, alive: true, frame: 0
                    });
                }
                break;
            }

            case 'hammer': {
                enemy.x += enemy.vx;
                if (enemy.vy === undefined) enemy.vy = -6;
                enemy.vy += 0.25;
                enemy.y += enemy.vy;
                if (enemy.y > ROWS * TILE + 32) enemy.alive = false;
                break;
            }
        }
    }
}

// === PLAYER-ENEMY COLLISION ===
function checkEnemyCollisions(levelData) {
    if (!levelData || player.dead || player.flagSlide) return;

    for (const enemy of levelData.enemies) {
        if (!enemy.alive) continue;
        if (enemy.type === 'piranha' && enemy.y > enemy.baseY + 30) continue; // Hidden in pipe

        const ex = enemy.x, ey = enemy.y;
        const ew = 28, eh = enemy.type === 'koopa' ? 36 : 28;
        const px = player.x, py = player.y;
        const pw = player.width, ph = player.big ? 56 : 28;

        if (px + pw > ex + 4 && px < ex + ew - 4 && py + ph > ey + 4 && py < ey + eh) {
            // Collision!
            if (player.star || player.invincible && player.star) {
                // Star kill
                enemy.alive = false;
                game.score += 200;
                SFX.stomp();
                addParticle(enemy.x, enemy.y, 'score', '200');
                continue;
            }

            if (player.vy > 0 && py + ph - ey < 20 && enemy.type !== 'piranha' &&
                enemy.type !== 'bulletbill' && enemy.type !== 'hammer') {
                // Stomp!
                player.vy = BOUNCE_FORCE;

                if (enemy.type === 'goomba') {
                    enemy.alive = false;
                    enemy.squished = true;
                    game.score += 100;
                    SFX.stomp();
                    addParticle(enemy.x, enemy.y, 'score', '100');
                    // Show squished goomba briefly
                    setTimeout(() => { enemy.squished = false; }, 500);
                } else if (enemy.type === 'koopa') {
                    if (!enemy.inShell) {
                        enemy.inShell = true;
                        enemy.shellVx = 0;
                        game.score += 100;
                        SFX.stomp();
                    } else if (enemy.shellVx === 0) {
                        enemy.shellVx = player.x < enemy.x ? 6 : -6;
                        game.score += 100;
                        SFX.stomp();
                    } else {
                        enemy.shellVx = 0;
                        game.score += 100;
                        SFX.stomp();
                    }
                    addParticle(enemy.x, enemy.y, 'score', '100');
                } else if (enemy.type === 'hammerbro') {
                    enemy.alive = false;
                    game.score += 1000;
                    SFX.stomp();
                    addParticle(enemy.x, enemy.y, 'score', '1000');
                }
            } else {
                // Player gets hit
                hurtPlayer();
            }
        }
    }

    // Fireball - enemy collision
    for (let fi = fireballs.length - 1; fi >= 0; fi--) {
        const fb = fireballs[fi];
        for (const enemy of levelData.enemies) {
            if (!enemy.alive) continue;
            if (enemy.type === 'hammer') continue;
            if (Math.abs(fb.x - enemy.x - 14) < 20 && Math.abs(fb.y - enemy.y - 14) < 20) {
                enemy.alive = false;
                fireballs.splice(fi, 1);
                game.score += 200;
                SFX.stomp();
                addParticle(enemy.x, enemy.y, 'score', '200');
                break;
            }
        }
    }
}

function hurtPlayer() {
    if (player.invincible) return;

    if (player.fire) {
        player.fire = false;
        player.invincible = true;
        player.invincibleTimer = 120;
        SFX.pipe();
    } else if (player.big) {
        player.big = false;
        player.fire = false;
        player.height = 28;
        player.invincible = true;
        player.invincibleTimer = 120;
        SFX.pipe();
    } else {
        killPlayer();
    }
}

function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    player.deathTimer = 90;
    player.vy = -10;
    player.vx = 0;
    SFX.die();
}

// === MAIN UPDATE FUNCTIONS ===
let currentLevel = null;

function updatePlayer(levelData) {
    if (player.dead) {
        player.deathTimer--;
        player.vy += GRAVITY;
        player.y += player.vy;
        if (player.deathTimer <= 0) {
            game.lives--;
            if (game.lives <= 0) {
                game.state = GameState.GAME_OVER;
                game.transitTimer = 180;
                stopBGM();
                SFX.gameover();
            } else {
                game.state = GameState.LEVEL_INTRO;
                game.introTimer = 120;
            }
        }
        return;
    }

    if (player.flagSlide) {
        player.y += 3;
        if (player.y >= (levelData.groundY - 1) * TILE) {
            player.y = (levelData.groundY - 1) * TILE;
            player.flagSlide = false;
            player.winWalk = true;
            player.winWalkTarget = player.x + 120;
        }
        return;
    }

    if (player.winWalk) {
        player.x += 2;
        player.facing = 1;
        player.frame = Math.floor(game.frameCount / 8) % 3;
        if (player.x >= player.winWalkTarget) {
            completeLevel();
        }
        return;
    }

    // Star timer
    if (player.star) {
        player.starTimer--;
        if (player.starTimer <= 0) {
            player.star = false;
            player.invincible = false;
        }
    }

    // Invincibility timer
    if (player.invincible && !player.star) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) {
            player.invincible = false;
        }
    }

    // Horizontal movement
    const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    const isIceWorld = game.world === 5;
    const accel = isIceWorld ? 0.25 : 0.5;
    const friction = isIceWorld ? 0.95 : 0.8;

    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx = Math.max(player.vx - accel, -speed);
        player.facing = -1;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx = Math.min(player.vx + accel, speed);
        player.facing = 1;
    } else {
        player.vx *= friction;
        if (Math.abs(player.vx) < 0.2) player.vx = 0;
    }

    // Ducking
    player.ducking = player.big && player.onGround && (keys['ArrowDown'] || keys['KeyS']);

    // Jumping
    if ((isPressed('ArrowUp') || isPressed('KeyW') || isPressed('Space')) && player.onGround) {
        player.vy = player.big ? BIG_JUMP_FORCE : JUMP_FORCE;
        player.onGround = false;
        SFX.jump();
    }

    // Variable jump height
    if (!(keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.vy < -4) {
        player.vy *= 0.85;
    }

    // Fire
    if (player.fire && (isPressed('KeyX') || isPressed('KeyZ'))) {
        addFireball(player.x + (player.facing > 0 ? player.width : -8), player.y + (player.big ? 20 : 10), player.facing);
    }

    // Gravity
    player.vy += GRAVITY;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    // Apply velocity
    const ph = player.big && !player.ducking ? 56 : (player.big ? 40 : 28);
    player.height = ph;

    // Horizontal collision
    player.x += player.vx;

    // Left/right tile collision
    const pLeft = Math.floor(player.x / TILE);
    const pRight = Math.floor((player.x + player.width) / TILE);
    const pTop = Math.floor(player.y / TILE);
    const pBottom = Math.floor((player.y + ph - 1) / TILE);

    for (let r = pTop; r <= pBottom; r++) {
        // Right collision
        if (isSolid(getTile(levelData, pRight, r))) {
            player.x = pRight * TILE - player.width - 0.1;
            player.vx = 0;
            break;
        }
        // Left collision
        if (isSolid(getTile(levelData, pLeft, r))) {
            player.x = (pLeft + 1) * TILE + 0.1;
            player.vx = 0;
            break;
        }
    }

    // Vertical collision
    player.y += player.vy;
    player.onGround = false;

    const npTop = Math.floor(player.y / TILE);
    const npBottom = Math.floor((player.y + ph) / TILE);
    const npLeft = Math.floor((player.x + 2) / TILE);
    const npRight = Math.floor((player.x + player.width - 2) / TILE);

    if (player.vy >= 0) {
        // Falling - check below
        for (let c = npLeft; c <= npRight; c++) {
            const belowTile = getTile(levelData, c, npBottom);
            if (isSolid(belowTile) || (isPlatform(belowTile) && player.vy >= 0)) {
                player.y = npBottom * TILE - ph;
                player.vy = 0;
                player.onGround = true;
                break;
            }
        }
    } else {
        // Rising - check above (head bonk)
        for (let c = npLeft; c <= npRight; c++) {
            const aboveTile = getTile(levelData, c, npTop);
            if (isSolid(aboveTile)) {
                player.y = (npTop + 1) * TILE;
                player.vy = 1;
                hitBlock(c, npTop, levelData);
                break;
            }
        }
    }

    // Check hazards
    for (let c = npLeft; c <= npRight; c++) {
        for (let r = npTop; r <= npBottom; r++) {
            if (isHazard(getTile(levelData, c, r))) {
                killPlayer();
                return;
            }
        }
    }

    // Fall off screen
    if (player.y > ROWS * TILE + 64) {
        killPlayer();
        player.deathTimer = 30;
        return;
    }

    // Collect coins
    if (levelData.coins) {
        for (const coin of levelData.coins) {
            if (coin.collected) continue;
            if (coin.isAxe) {
                // Axe - end of castle level
                if (Math.abs(player.x - coin.x) < 24 && Math.abs(player.y - coin.y) < 32) {
                    coin.collected = true;
                    completeLevel();
                }
                continue;
            }
            if (Math.abs(player.x + player.width / 2 - coin.x) < 20 &&
                Math.abs(player.y + ph / 2 - coin.y) < 20) {
                coin.collected = true;
                game.coins++;
                game.score += 200;
                SFX.coin();
            }
        }
    }

    // Check flag pole
    if (!player.flagSlide) {
        const playerCol = Math.floor((player.x + player.width / 2) / TILE);
        const playerRow = Math.floor((player.y + ph / 2) / TILE);
        for (let r = 0; r < ROWS; r++) {
            const t = getTile(levelData, playerCol, r);
            if (t === T.FLAG_POLE || t === T.FLAG_TOP) {
                if (Math.abs(player.x + player.width / 2 - playerCol * TILE - 16) < 12) {
                    player.flagSlide = true;
                    player.x = playerCol * TILE - 4;
                    player.vx = 0;
                    player.vy = 0;
                    SFX.flagpole();
                    // Score based on height
                    const heightScore = Math.max(0, (levelData.groundY - playerRow - 2)) * 200;
                    game.score += heightScore;
                    addParticle(player.x, player.y, 'score', String(heightScore));
                    break;
                }
            }
        }
    }

    // Camera bounds
    if (player.x < 0) { player.x = 0; player.vx = 0; }

    // Animation
    player.animTimer++;
    if (Math.abs(player.vx) > 0.5 && player.onGround) {
        player.frame = Math.floor(player.animTimer / 6) % 3;
    } else if (!player.onGround) {
        player.frame = 3; // Jump frame
    } else {
        player.frame = 0;
    }

    // Extra life for 100 coins
    if (game.coins >= 100) {
        game.coins -= 100;
        game.lives++;
        SFX.oneup();
    }
}

function completeLevel() {
    game.state = GameState.LEVEL_COMPLETE;
    game.transitTimer = 150;
    stopBGM();

    // Time bonus
    const timeBonus = game.time * 50;
    game.score += timeBonus;

    // Fireworks
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            addParticle(
                player.x - 100 + Math.random() * 200,
                100 + Math.random() * 200,
                'firework', null
            );
        }, i * 400);
    }

    // Advance level
    if (game.level < 4) {
        game.level++;
    } else {
        game.level = 1;
        if (game.world < 8) {
            game.world++;
        } else {
            game.state = GameState.WIN;
            game.transitTimer = 300;
        }
    }
    if (game.world > game.maxWorld || (game.world === game.maxWorld && game.level > game.maxLevel)) {
        game.maxWorld = game.world;
        game.maxLevel = game.level;
    }
}

// === WORLD MAP ===
const worldMapPositions = [
    [{x: 100, y: 380}, {x: 220, y: 340}, {x: 360, y: 300}, {x: 480, y: 340}],
    [{x: 100, y: 380}, {x: 240, y: 320}, {x: 380, y: 280}, {x: 520, y: 350}],
    [{x: 100, y: 400}, {x: 200, y: 340}, {x: 340, y: 300}, {x: 500, y: 360}],
    [{x: 100, y: 380}, {x: 260, y: 300}, {x: 400, y: 260}, {x: 540, y: 320}],
    [{x: 100, y: 380}, {x: 220, y: 320}, {x: 380, y: 280}, {x: 520, y: 340}],
    [{x: 100, y: 360}, {x: 240, y: 280}, {x: 400, y: 240}, {x: 560, y: 300}],
    [{x: 100, y: 380}, {x: 200, y: 320}, {x: 360, y: 280}, {x: 500, y: 340}],
    [{x: 100, y: 380}, {x: 260, y: 300}, {x: 420, y: 260}, {x: 580, y: 320}]
];

function drawWorldMap() {
    const theme = WORLD_THEMES[game.world];
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw decorative elements
    ctx.fillStyle = theme.hillColor;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H);
    for (let x = 0; x <= CANVAS_W; x += 50) {
        ctx.lineTo(x, CANVAS_H - 80 - Math.sin(x * 0.01) * 40);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.fill();

    ctx.fillStyle = theme.groundTop;
    ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, CANVAS_H - 60, CANVAS_W, 60);

    // World title
    ctx.fillStyle = '#fcfcfc';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WORLD ${game.world}`, CANVAS_W / 2, 60);
    ctx.font = '24px monospace';
    ctx.fillText(theme.name, CANVAS_W / 2, 95);

    // Draw path and level nodes
    const positions = worldMapPositions[game.world - 1];

    // Draw path
    ctx.strokeStyle = '#f8d878';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    // Path to castle
    ctx.lineTo(750, 260);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw level nodes
    for (let i = 0; i < 4; i++) {
        const p = positions[i];
        const isCurrentLevel = i + 1 === game.level;
        const isCompleted = i + 1 < game.level || game.world < game.maxWorld ||
                           (game.world === game.maxWorld && i + 1 < game.maxLevel);
        const isLocked = i + 1 > game.maxLevel && game.world === game.maxWorld;

        // Node circle
        if (isCompleted) {
            ctx.fillStyle = '#00a800';
        } else if (isCurrentLevel) {
            ctx.fillStyle = '#f8d800';
        } else if (isLocked) {
            ctx.fillStyle = '#808080';
        } else {
            ctx.fillStyle = '#f8a020';
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#402010';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Level number
        ctx.fillStyle = '#fcfcfc';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i === 3 ? '\u2655' : String(i + 1), p.x, p.y);

        // Label
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText(i === 3 ? 'CASTLE' : `LEVEL ${i + 1}`, p.x, p.y + 26);

        if (isLocked) {
            ctx.fillStyle = '#808080';
            ctx.font = '12px monospace';
            ctx.fillText('LOCKED', p.x, p.y + 40);
        }
    }

    // Castle at end
    ctx.fillStyle = '#888';
    ctx.fillRect(720, 220, 60, 60);
    ctx.fillRect(730, 200, 40, 20);
    ctx.fillRect(740, 190, 20, 10);
    // Castle towers
    ctx.fillRect(720, 200, 12, 20);
    ctx.fillRect(768, 200, 12, 20);
    // Door
    ctx.fillStyle = '#402010';
    ctx.fillRect(740, 255, 20, 25);
    // Flag
    ctx.fillStyle = '#e02020';
    ctx.fillRect(748, 175, 2, 20);
    ctx.fillRect(750, 175, 14, 10);

    // Draw Mario at current position
    const marioPos = positions[game.level - 1];
    drawMario(ctx, marioPos.x - 16, marioPos.y - 50, player.big, player.fire,
              Math.floor(game.frameCount / 12) % 3, 1, false);

    // Instructions
    ctx.fillStyle = '#fcfcfc';
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Press ENTER to start level', CANVAS_W / 2, CANVAS_H - 20);
    ctx.fillText('Press LEFT/RIGHT to change world', CANVAS_W / 2, CANVAS_H - 45);

    // HUD
    drawHUD();
}

// === HUD ===
function drawHUD() {
    // Semi-transparent bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CANVAS_W, 30);

    ctx.fillStyle = '#fcfcfc';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillText(`MARIO`, 20, 15);
    ctx.fillText(`${String(game.score).padStart(8, '0')}`, 80, 15);

    // Coins
    ctx.fillStyle = '#f8d800';
    ctx.fillText(`\u00D7${String(game.coins).padStart(2, '0')}`, 280, 15);

    ctx.fillStyle = '#fcfcfc';
    ctx.fillText(`WORLD ${game.world}-${game.level}`, 420, 15);

    ctx.fillText(`TIME`, 620, 15);
    ctx.fillText(`${Math.ceil(game.time)}`, 680, 15);

    ctx.fillText(`LIVES: ${game.lives}`, 800, 15);
}

// === TITLE SCREEN ===
function drawTitleScreen() {
    // Background
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ground
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(0, CANVAS_H - 64, CANVAS_W, 64);
    ctx.fillStyle = '#00a800';
    ctx.fillRect(0, CANVAS_H - 64, CANVAS_W, 8);

    // Clouds
    ctx.fillStyle = '#fcfcfc';
    for (const cx of [100, 300, 500, 700, 850]) {
        ctx.beginPath();
        ctx.arc(cx, 80, 25, 0, Math.PI * 2);
        ctx.arc(cx + 30, 70, 30, 0, Math.PI * 2);
        ctx.arc(cx + 60, 80, 25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Hills
    ctx.fillStyle = '#00a800';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H - 64);
    ctx.quadraticCurveTo(150, CANVAS_H - 200, 300, CANVAS_H - 64);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(500, CANVAS_H - 64);
    ctx.quadraticCurveTo(700, CANVAS_H - 250, 900, CANVAS_H - 64);
    ctx.fill();

    // Title block with shadow
    ctx.fillStyle = '#000';
    ctx.fillRect(168, 88, 624, 108);
    ctx.fillStyle = '#e02020';
    ctx.fillRect(165, 85, 624, 108);
    ctx.fillStyle = '#f84000';
    ctx.fillRect(170, 90, 614, 98);

    // Title text
    ctx.fillStyle = '#fcfcfc';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText('SUPER MARIO', CANVAS_W / 2, 140);
    ctx.fillText('SUPER MARIO', CANVAS_W / 2, 140);

    ctx.font = 'bold 28px monospace';
    ctx.strokeText('HTML5 EDITION', CANVAS_W / 2, 178);
    ctx.fillText('HTML5 EDITION', CANVAS_W / 2, 178);

    // Menu
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fcfcfc';
    ctx.fillText('8 WORLDS \u2022 32 LEVELS', CANVAS_W / 2, 260);

    // Blinking start text
    if (Math.floor(game.frameCount / 30) % 2 === 0) {
        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = '#f8d800';
        ctx.fillText('PRESS ENTER TO START', CANVAS_W / 2, 320);
    }

    // Controls
    ctx.font = '14px monospace';
    ctx.fillStyle = '#c8c8c8';
    ctx.fillText('ARROW KEYS / WASD - Move & Jump', CANVAS_W / 2, 380);
    ctx.fillText('SHIFT - Run  |  Z/X - Fireball', CANVAS_W / 2, 400);
    ctx.fillText('P - Pause  |  ENTER - Select', CANVAS_W / 2, 420);

    // Animated Mario
    const mx = 200 + Math.sin(game.frameCount * 0.03) * 60;
    drawMario(ctx, mx, CANVAS_H - 96, true, false, Math.floor(game.frameCount / 8) % 3, 1, false);

    // Animated enemies
    drawGoomba(ctx, 600, CANVAS_H - 96, Math.floor(game.frameCount / 12) % 2, false);
    drawKoopa(ctx, 700, CANVAS_H - 100, Math.floor(game.frameCount / 12) % 2, -1, false);

    // Copyright
    ctx.font = '12px monospace';
    ctx.fillStyle = '#808080';
    ctx.fillText('\u00A9 2024 HTML5 Fan Game', CANVAS_W / 2, CANVAS_H - 20);
}

// === LEVEL INTRO SCREEN ===
function drawLevelIntro() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#fcfcfc';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`WORLD ${game.world}-${game.level}`, CANVAS_W / 2, CANVAS_H / 2 - 50);

    ctx.font = '24px monospace';
    ctx.fillText(WORLD_THEMES[game.world].name, CANVAS_W / 2, CANVAS_H / 2);

    // Mario icon and lives
    drawMario(ctx, CANVAS_W / 2 - 50, CANVAS_H / 2 + 30, player.big, player.fire, 0, 1, false);
    ctx.fillStyle = '#fcfcfc';
    ctx.font = '24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`\u00D7 ${game.lives}`, CANVAS_W / 2 - 10, CANVAS_H / 2 + 55);
}

// === GAME OVER SCREEN ===
function drawGameOver() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#e02020';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30);

    ctx.fillStyle = '#fcfcfc';
    ctx.font = '20px monospace';
    ctx.fillText(`FINAL SCORE: ${game.score}`, CANVAS_W / 2, CANVAS_H / 2 + 20);

    if (game.transitTimer < 60) {
        ctx.fillStyle = '#f8d800';
        ctx.font = '18px monospace';
        ctx.fillText('PRESS ENTER TO CONTINUE', CANVAS_W / 2, CANVAS_H / 2 + 70);
    }
}

// === WIN SCREEN ===
function drawWinScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Fireworks
    if (game.frameCount % 20 === 0) {
        addParticle(200 + Math.random() * 560, 100 + Math.random() * 200, 'firework', null);
    }

    ctx.fillStyle = '#f8d800';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CONGRATULATIONS!', CANVAS_W / 2, 100);

    ctx.fillStyle = '#fcfcfc';
    ctx.font = '24px monospace';
    ctx.fillText('YOU SAVED THE KINGDOM!', CANVAS_W / 2, 170);
    ctx.fillText(`FINAL SCORE: ${game.score}`, CANVAS_W / 2, 220);

    ctx.font = '20px monospace';
    ctx.fillText('THANK YOU MARIO!', CANVAS_W / 2, 300);
    ctx.fillText('YOUR QUEST IS COMPLETE!', CANVAS_W / 2, 340);

    drawParticles(0);
    updateParticles();

    if (game.transitTimer < 120) {
        ctx.fillStyle = '#f8d800';
        ctx.font = '18px monospace';
        ctx.fillText('PRESS ENTER TO PLAY AGAIN', CANVAS_W / 2, 420);
    }
}

// === PAUSE SCREEN ===
function drawPauseScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#fcfcfc';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 30);

    ctx.font = '18px monospace';
    ctx.fillText('PRESS P TO RESUME', CANVAS_W / 2, CANVAS_H / 2 + 30);
    ctx.fillText('PRESS M FOR WORLD MAP', CANVAS_W / 2, CANVAS_H / 2 + 60);
}

// === LEVEL LOADING ===
function loadLevel() {
    currentLevel = generateLevel(game.world, game.level);
    resetPlayer();
    camera.x = 0;
    game.time = 400;
    game.timeTimer = 0;
    particles.length = 0;
    fireballs.length = 0;
    items.length = 0;
    startBGM();
}

// === MAIN GAME LOOP ===
function update() {
    game.frameCount++;

    switch (game.state) {
        case GameState.TITLE:
            if (isPressed('Enter') || isPressed('Space')) {
                initAudio();
                game.state = GameState.WORLD_MAP;
                game.world = 1;
                game.level = 1;
                game.lives = 3;
                game.score = 0;
                game.coins = 0;
                game.maxWorld = 1;
                game.maxLevel = 1;
                player.big = false;
                player.fire = false;
                player.star = false;
            }
            break;

        case GameState.WORLD_MAP:
            // Navigate world map
            if (isPressed('Enter') || isPressed('Space')) {
                game.state = GameState.LEVEL_INTRO;
                game.introTimer = 120;
            }
            if (isPressed('ArrowRight') || isPressed('KeyD')) {
                if (game.world < game.maxWorld || (game.world === game.maxWorld && game.level < game.maxLevel)) {
                    game.level++;
                    if (game.level > 4) {
                        game.level = 1;
                        if (game.world < 8) game.world++;
                    }
                }
            }
            if (isPressed('ArrowLeft') || isPressed('KeyA')) {
                game.level--;
                if (game.level < 1) {
                    game.level = 4;
                    if (game.world > 1) game.world--;
                    else game.level = 1;
                }
            }
            break;

        case GameState.LEVEL_INTRO:
            game.introTimer--;
            if (game.introTimer <= 0) {
                loadLevel();
                game.state = GameState.PLAYING;
            }
            break;

        case GameState.PLAYING:
            if (isPressed('KeyP') || isPressed('Escape')) {
                game.state = GameState.PAUSED;
                break;
            }

            // Timer
            game.timeTimer++;
            if (game.timeTimer >= 24) {
                game.timeTimer = 0;
                game.time--;
                if (game.time <= 0) {
                    killPlayer();
                }
            }

            updatePlayer(currentLevel);
            updateEnemies(currentLevel);
            updateItems(currentLevel);
            updateFireballs(currentLevel);
            checkEnemyCollisions(currentLevel);
            updateParticles();

            if (!player.dead) {
                updateCamera(player.x);
            }
            break;

        case GameState.PAUSED:
            if (isPressed('KeyP') || isPressed('Escape')) {
                game.state = GameState.PLAYING;
            }
            if (isPressed('KeyM')) {
                game.state = GameState.WORLD_MAP;
            }
            break;

        case GameState.LEVEL_COMPLETE:
            game.transitTimer--;
            updateParticles();
            if (game.transitTimer <= 0) {
                if (game.state === GameState.WIN) break;
                game.state = GameState.WORLD_MAP;
            }
            break;

        case GameState.GAME_OVER:
            game.transitTimer--;
            if (game.transitTimer <= 0 && (isPressed('Enter') || isPressed('Space'))) {
                game.state = GameState.TITLE;
            }
            break;

        case GameState.WIN:
            game.transitTimer--;
            updateParticles();
            if (game.transitTimer <= 0 && (isPressed('Enter') || isPressed('Space'))) {
                game.state = GameState.TITLE;
            }
            break;
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    switch (game.state) {
        case GameState.TITLE:
            drawTitleScreen();
            break;

        case GameState.WORLD_MAP:
            drawWorldMap();
            break;

        case GameState.LEVEL_INTRO:
            drawLevelIntro();
            break;

        case GameState.PLAYING:
        case GameState.LEVEL_COMPLETE:
            // Draw game world
            drawBackground(camera.x, game.world);

            // Draw tiles
            const startCol = Math.floor(camera.x / TILE);
            const endCol = startCol + COLS_VISIBLE + 1;

            for (let r = 0; r < ROWS; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const tile = getTile(currentLevel, c, r);
                    if (tile !== T.AIR) {
                        drawTile(tile, c * TILE - camera.x, r * TILE, game.world, game.frameCount);
                    }
                }
            }

            // Draw coins
            if (currentLevel && currentLevel.coins) {
                for (const coin of currentLevel.coins) {
                    if (coin.collected) continue;
                    const sx = coin.x - camera.x;
                    if (sx < -TILE || sx > CANVAS_W + TILE) continue;
                    if (coin.isAxe) {
                        // Draw axe
                        ctx.fillStyle = '#808080';
                        ctx.fillRect(sx - 4, coin.y, 8, 24);
                        ctx.fillStyle = '#c0c0c0';
                        ctx.fillRect(sx - 10, coin.y - 8, 16, 14);
                    } else {
                        drawCoin(ctx, sx - 8, coin.y - 8, Math.floor(game.frameCount / 8) % 4);
                    }
                }
            }

            // Draw items
            drawItems(camera.x);

            // Draw enemies
            if (currentLevel) {
                for (const enemy of currentLevel.enemies) {
                    if (!enemy.alive && !enemy.squished) continue;
                    const sx = enemy.x - camera.x;
                    if (sx < -TILE * 2 || sx > CANVAS_W + TILE * 2) continue;

                    const ef = Math.floor((enemy.frame || 0) / 12) % 2;
                    switch (enemy.type) {
                        case 'goomba':
                            drawGoomba(ctx, sx, enemy.y, ef, enemy.squished);
                            break;
                        case 'koopa':
                            drawKoopa(ctx, sx, enemy.y, ef, enemy.vx > 0 ? 1 : -1, enemy.inShell);
                            break;
                        case 'piranha':
                            drawPiranha(ctx, sx, enemy.y, ef);
                            break;
                        case 'bulletbill':
                            drawBulletBill(ctx, sx, enemy.y, enemy.vx > 0 ? 1 : -1);
                            break;
                        case 'hammerbro':
                            drawHammerBro(ctx, sx, enemy.y, ef, enemy.vx > 0 ? 1 : -1);
                            break;
                        case 'hammer':
                            drawHammer(ctx, sx, enemy.y, (enemy.frame || 0) * 0.3);
                            break;
                    }
                }
            }

            // Draw fireballs
            drawFireballs(camera.x);

            // Draw player
            if (!player.dead || player.deathTimer > 0) {
                const px = player.x - camera.x;
                const py = player.y;
                // Invincibility blink
                if (player.invincible && !player.star && game.frameCount % 4 < 2) {
                    // Skip drawing (blink)
                } else if (player.star) {
                    // Star flicker colors
                    ctx.globalAlpha = 0.8 + Math.sin(game.frameCount * 0.5) * 0.2;
                    drawMario(ctx, px, py, player.big, player.fire, player.frame, player.facing, player.ducking);
                    ctx.globalAlpha = 1;
                } else {
                    drawMario(ctx, px, py, player.big, player.fire, player.frame, player.facing, player.ducking);
                }
            }

            // Draw particles
            drawParticles(camera.x);

            // Draw flag (after pole)
            if (currentLevel && player.flagSlide) {
                const flagCol = Math.floor((player.x + 20) / TILE);
                drawFlag(ctx, flagCol * TILE - camera.x + 18, player.y - 8);
            }

            // HUD
            drawHUD();

            // Level complete overlay
            if (game.state === GameState.LEVEL_COMPLETE) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
                ctx.fillStyle = '#f8d800';
                ctx.font = 'bold 36px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('LEVEL CLEAR!', CANVAS_W / 2, CANVAS_H / 2 - 30);
                ctx.fillStyle = '#fcfcfc';
                ctx.font = '20px monospace';
                ctx.fillText(`TIME BONUS: ${Math.ceil(game.time) * 50}`, CANVAS_W / 2, CANVAS_H / 2 + 20);
            }
            break;

        case GameState.PAUSED:
            // Redraw game underneath
            drawBackground(camera.x, game.world);
            const sc = Math.floor(camera.x / TILE);
            const ec = sc + COLS_VISIBLE + 1;
            for (let r = 0; r < ROWS; r++) {
                for (let c = sc; c <= ec; c++) {
                    const tile = getTile(currentLevel, c, r);
                    if (tile !== T.AIR) drawTile(tile, c * TILE - camera.x, r * TILE, game.world, game.frameCount);
                }
            }
            drawMario(ctx, player.x - camera.x, player.y, player.big, player.fire, player.frame, player.facing, player.ducking);
            drawHUD();
            drawPauseScreen();
            break;

        case GameState.GAME_OVER:
            drawGameOver();
            break;

        case GameState.WIN:
            drawWinScreen();
            break;
    }
}

// === GAME LOOP ===
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start!
console.log('Super Mario HTML5 - Starting...');
gameLoop();
