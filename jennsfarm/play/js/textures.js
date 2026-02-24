import * as THREE from 'three';

const TEX_SIZE = 64;

function noise(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
}

function createCanvas() {
    const c = document.createElement('canvas');
    c.width = TEX_SIZE;
    c.height = TEX_SIZE;
    return c;
}

function colorVariation(base, range, rng) {
    return [
        Math.max(0, Math.min(255, base[0] + (rng() - 0.5) * range)),
        Math.max(0, Math.min(255, base[1] + (rng() - 0.5) * range)),
        Math.max(0, Math.min(255, base[2] + (rng() - 0.5) * range))
    ];
}

function makeTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function createGrassTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    // Base green
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = noise(x, y, 1);
            const g = 120 + n * 60;
            const r = 50 + n * 30;
            const b = 40 + n * 20;
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    // Grass blades
    ctx.strokeStyle = 'rgba(80, 180, 60, 0.4)';
    for (let i = 0; i < 30; i++) {
        const bx = Math.random() * TEX_SIZE;
        const by = Math.random() * TEX_SIZE;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (Math.random() - 0.5) * 3, by - 2 - Math.random() * 3);
        ctx.stroke();
    }
    // Occasional flowers
    const flowerColors = ['#f9e04b', '#f0f0f0', '#e88bc4'];
    for (let i = 0; i < 3; i++) {
        if (Math.random() > 0.5) {
            ctx.fillStyle = flowerColors[i % flowerColors.length];
            const fx = Math.random() * TEX_SIZE;
            const fy = Math.random() * TEX_SIZE;
            ctx.fillRect(fx, fy, 2, 2);
        }
    }
    return makeTexture(c);
}

export function createSoilTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = noise(x, y, 2);
            const r = 100 + n * 40;
            const g = 65 + n * 25;
            const b = 35 + n * 15;
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    // Furrow lines
    ctx.strokeStyle = 'rgba(60, 35, 15, 0.5)';
    ctx.lineWidth = 1;
    for (let row = 8; row < TEX_SIZE; row += 10) {
        ctx.beginPath();
        ctx.moveTo(0, row);
        ctx.lineTo(TEX_SIZE, row + (Math.random() - 0.5) * 2);
        ctx.stroke();
    }
    return makeTexture(c);
}

export function createWateredSoilTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = noise(x, y, 3);
            const r = 65 + n * 25;
            const g = 42 + n * 18;
            const b = 25 + n * 12;
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    ctx.strokeStyle = 'rgba(40, 20, 8, 0.5)';
    ctx.lineWidth = 1;
    for (let row = 8; row < TEX_SIZE; row += 10) {
        ctx.beginPath();
        ctx.moveTo(0, row);
        ctx.lineTo(TEX_SIZE, row);
        ctx.stroke();
    }
    return makeTexture(c);
}

export function createPathTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = noise(x, y, 4);
            const r = 180 + n * 30;
            const g = 160 + n * 25;
            const b = 120 + n * 20;
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return makeTexture(c);
}

export function createWaterTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = noise(x, y, 5);
            const wave = Math.sin(x * 0.3 + y * 0.2) * 0.5 + 0.5;
            const r = 40 + n * 20 + wave * 15;
            const g = 100 + n * 30 + wave * 20;
            const b = 180 + n * 40 + wave * 30;
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return makeTexture(c);
}

export function createBuildingTexture(type) {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    if (type === 'shop') {
        // Wooden planks - warm
        for (let y = 0; y < TEX_SIZE; y++) {
            for (let x = 0; x < TEX_SIZE; x++) {
                const n = noise(x, y, 10);
                const plank = Math.floor(y / 8) % 2;
                ctx.fillStyle = `rgb(${160 + n * 30 + plank * 15|0},${110 + n * 20 + plank * 10|0},${60 + n * 15|0})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
        // Sign
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(12, 8, 40, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText('SEEDS', 16, 22);
    } else if (type === 'market') {
        // Red stall
        for (let y = 0; y < TEX_SIZE; y++) {
            for (let x = 0; x < TEX_SIZE; x++) {
                const n = noise(x, y, 11);
                const stripe = Math.floor(x / 8) % 2;
                ctx.fillStyle = `rgb(${180 + stripe * 40 + n * 20|0},${50 + n * 15|0},${40 + n * 10|0})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
        ctx.fillStyle = '#ffd700';
        ctx.font = '9px sans-serif';
        ctx.fillText('MARKET', 10, 36);
    }
    return makeTexture(c);
}

export function createBarnTexture() {
    const c = createCanvas();
    const ctx = c.getContext('2d');
    // Barn wall planks - warm reddish-brown
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = noise(x, y, 20);
            const plank = Math.floor(y / 8) % 2;
            const r = 120 + n * 30 + plank * 10;
            const g = 55 + n * 15 + plank * 5;
            const b = 30 + n * 10;
            ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    // Barn door
    ctx.fillStyle = '#3d1e08';
    ctx.fillRect(20, 28, 24, 36);
    // Cross beams on door
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 28);
    ctx.lineTo(44, 64);
    ctx.moveTo(44, 28);
    ctx.lineTo(20, 64);
    ctx.stroke();
    // Sign
    ctx.fillStyle = '#c8a86e';
    ctx.fillRect(10, 6, 44, 16);
    ctx.fillStyle = '#3d1e08';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('BARN', 15, 18);
    return makeTexture(c);
}

// Hotbar icons (32x32 canvases)
export function createToolIcon(toolId) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');

    switch (toolId) {
        case 'move':
            // Boot/shoe icon
            ctx.fillStyle = '#c8a86e';
            ctx.beginPath();
            ctx.ellipse(16, 20, 8, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8b6914';
            ctx.fillRect(10, 8, 12, 10);
            break;
        case 'hoe':
            // Hoe icon
            ctx.strokeStyle = '#8b6914';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(8, 28);
            ctx.lineTo(24, 6);
            ctx.stroke();
            ctx.fillStyle = '#888';
            ctx.fillRect(20, 2, 10, 6);
            break;
        case 'water':
            // Watering can
            ctx.fillStyle = '#6688cc';
            ctx.fillRect(8, 10, 16, 14);
            ctx.fillRect(22, 6, 6, 4);
            ctx.fillStyle = '#5577bb';
            ctx.fillRect(4, 22, 6, 4);
            break;
        case 'hand':
            // Open hand
            ctx.fillStyle = '#f0c8a0';
            ctx.beginPath();
            ctx.ellipse(16, 18, 8, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            // Fingers
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(8 + i * 5, 4, 3, 12);
            }
            ctx.fillRect(4, 14, 3, 8); // thumb
            break;
        default:
            // Seed packet
            const colors = {
                'carrot_seed': '#f4845f',
                'tomato_seed': '#e63946',
                'potato_seed': '#c8a86e',
                'wheat_seed': '#deb841'
            };
            const cropColors = {
                'carrot_seed': '#ff7733',
                'tomato_seed': '#ff2222',
                'potato_seed': '#cc9944',
                'wheat_seed': '#ddbb33'
            };
            ctx.fillStyle = colors[toolId] || '#888';
            ctx.fillRect(6, 4, 20, 24);
            ctx.fillStyle = '#fff';
            ctx.fillRect(6, 4, 20, 6);
            // Seed dot
            ctx.fillStyle = cropColors[toolId] || '#555';
            ctx.beginPath();
            ctx.arc(16, 20, 5, 0, Math.PI * 2);
            ctx.fill();
            break;
    }
    return c;
}
