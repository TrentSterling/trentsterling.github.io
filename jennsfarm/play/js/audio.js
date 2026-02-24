// js/audio.js — Procedural audio via Web Audio API (CraftMine-inspired)

let ctx = null;
let masterGain = null;
let noiseBuffer = null;

function getCtx() {
    if (!ctx) {
        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function getNoiseBuffer() {
    if (!noiseBuffer) {
        const c = getCtx();
        const len = c.sampleRate * 2;
        noiseBuffer = c.createBuffer(1, len, c.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(c.currentTime + duration);
}

function playNoise(duration, volume = 0.1, filterFreq = 1000) {
    const c = getCtx();
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(c.currentTime + duration);
}

// ——— Sound effects ———

export function playTill() {
    playNoise(0.15, 0.15, 800);
    playTone(120, 0.1, 'triangle', 0.2);
    setTimeout(() => playNoise(0.1, 0.1, 600), 80);
}

export function playPlant() {
    playTone(440, 0.15, 'sine', 0.15);
    setTimeout(() => playTone(550, 0.12, 'sine', 0.1), 60);
}

export function playHarvest() {
    playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 80);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.15), 160);
}

export function playBuy() {
    playTone(800, 0.08, 'square', 0.1);
    setTimeout(() => playTone(1200, 0.12, 'square', 0.08), 60);
}

export function playSell() {
    playTone(600, 0.1, 'square', 0.1);
    setTimeout(() => playTone(800, 0.1, 'square', 0.1), 70);
    setTimeout(() => playTone(1000, 0.15, 'square', 0.08), 140);
}

export function playDeny() {
    playTone(200, 0.2, 'sawtooth', 0.1);
    setTimeout(() => playTone(160, 0.25, 'sawtooth', 0.08), 120);
}

export function playExpand() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.25, 'sine', 0.15), i * 100);
    });
}

export function playWalk() {
    playNoise(0.06, 0.04, 400);
}

export function playWater() {
    playNoise(0.2, 0.08, 2000);
    playTone(300, 0.15, 'sine', 0.05);
}

export function playStore() {
    playTone(330, 0.1, 'triangle', 0.12);
    setTimeout(() => playTone(440, 0.12, 'triangle', 0.1), 70);
}

export function playWithdraw() {
    playTone(440, 0.1, 'triangle', 0.12);
    setTimeout(() => playTone(330, 0.12, 'triangle', 0.1), 70);
}

export function playNewDay() {
    playTone(392, 0.2, 'sine', 0.12);
    setTimeout(() => playTone(523, 0.2, 'sine', 0.12), 150);
    setTimeout(() => playTone(659, 0.3, 'sine', 0.1), 300);
}

// ——— Ambient system ———

let ambientInterval = null;
let currentAmbientMode = null;

export function updateAmbient(isNight) {
    const mode = isNight ? 'night' : 'day';
    if (mode === currentAmbientMode) return;
    currentAmbientMode = mode;
    stopAmbient();

    ambientInterval = setInterval(() => {
        if (Math.random() > 0.5) {
            if (isNight) {
                // Cricket chirp
                const f = 4000 + Math.random() * 1000;
                playTone(f, 0.08, 'sine', 0.02);
                setTimeout(() => playTone(f + 200, 0.06, 'sine', 0.02), 100);
            } else {
                // Bird chirp
                const base = 1500 + Math.random() * 1500;
                playTone(base, 0.06, 'sine', 0.03);
                setTimeout(() => playTone(base * 1.2, 0.08, 'sine', 0.03), 80);
                if (Math.random() > 0.5) {
                    setTimeout(() => playTone(base * 0.9, 0.05, 'sine', 0.02), 200);
                }
            }
        }
    }, 3000);
}

export function stopAmbient() {
    if (ambientInterval) {
        clearInterval(ambientInterval);
        ambientInterval = null;
    }
}
