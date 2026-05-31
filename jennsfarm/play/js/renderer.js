import * as THREE from 'three';

// Shared curvature uniforms - all patched materials reference these
export const curveUniforms = {
    curvature: { value: 0.022 }, // stronger "rolling world" horizon (was 0.014)
    curveOrigin: { value: new THREE.Vector3() }
};

// "Log rolling" curvature - only bends along Z (depth) axis
const CURVE_VERTEX_PREAMBLE = `
uniform float curvature;
uniform vec3 curveOrigin;
`;

const CURVE_PROJECT_VERTEX = `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
    mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
#endif
vec4 curveWorldPos = modelMatrix * mvPosition;
float cdz = curveWorldPos.z - curveOrigin.z;
curveWorldPos.y -= cdz * cdz * curvature;
mvPosition = viewMatrix * curveWorldPos;
gl_Position = projectionMatrix * mvPosition;
`;

export function applyCurvature(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.curvature = curveUniforms.curvature;
        shader.uniforms.curveOrigin = curveUniforms.curveOrigin;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\n' + CURVE_VERTEX_PREAMBLE
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            CURVE_PROJECT_VERTEX
        );
    };
    material.needsUpdate = true;
    return material;
}

export function curvedMaterial(opts) {
    const mat = new THREE.MeshLambertMaterial(opts);
    return applyCurvature(mat);
}

// --- Scene setup ---

export let scene, camera, renderer, raycaster;
const mouse = new THREE.Vector2();

// Camera config - pitch and offset are matched so player appears at screen center.
// Math: atan(HEIGHT / DISTANCE) must equal |PITCH| for center-screen alignment.
const CAMERA_PITCH = -0.70;     // ~40 degrees down
const CAMERA_HEIGHT = 7;
const CAMERA_DISTANCE = 7.5;    // 7 / tan(0.70) ≈ 7.5 → player at screen center

// Lights (module-level for day/night control)
let sunLight, ambientLight, hemiLight, moonLight;

export function initRenderer(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    // Linear fog - fades objects to sky color. Hides world edges cleanly.
    scene.fog = new THREE.Fog(0x87ceeb, 12, 32);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(CAMERA_PITCH, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();

    // Lighting - sun starts angled from the side for depth, not behind camera
    ambientLight = new THREE.AmbientLight(0xfff5e6, 0.55);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.3);
    sunLight.position.set(-10, 15, -5); // from front-left, creates visible highlights
    scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.4);
    scene.add(hemiLight);

    // Moonlight - a cool directional fill that fades IN as the sun fades OUT.
    // Keeps objects shaded/3D at night instead of going flat. Comes from the
    // opposite side of the sun so night has its own distinct key direction.
    moonLight = new THREE.DirectionalLight(0x8fa6e0, 0);
    moonLight.position.set(9, 16, 7);
    scene.add(moonLight);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, raycaster };
}

// --- Day/Night cycle ---
// Stylized approach: night = dreamy blue/purple (not dark), sun arcs across sky for depth

const DAY_PHASES = [
    //                                                                                     ambient                                                          sun position
    //  t     sky        sun   amb   ambClr      sunClr      hemiSky     hemiGnd            sunX  sunY
    { t: 0.00, sky: 0x263366, sun: 0.0, amb: 0.50, ambClr: 0x7788cc, sunClr: 0x263366, hemiSky: 0x4466aa, hemiGnd: 0x2a3355, sunX:   0, sunY: 2  },
    { t: 0.10, sky: 0x3a2a66, sun: 0.0, amb: 0.48, ambClr: 0x8877bb, sunClr: 0x3a2a66, hemiSky: 0x5544aa, hemiGnd: 0x332255, sunX: -18, sunY: 2  },
    { t: 0.15, sky: 0xff9977, sun: 0.7, amb: 0.42, ambClr: 0xffccaa, sunClr: 0xff8844, hemiSky: 0xff9977, hemiGnd: 0x445533, sunX: -16, sunY: 8  },
    { t: 0.22, sky: 0xaaddff, sun: 1.1, amb: 0.50, ambClr: 0xfff5e6, sunClr: 0xffeedd, hemiSky: 0xaaddff, hemiGnd: 0x556633, sunX: -12, sunY: 15 },
    { t: 0.30, sky: 0x87ceeb, sun: 1.3, amb: 0.55, ambClr: 0xfff5e6, sunClr: 0xffffff, hemiSky: 0x87ceeb, hemiGnd: 0x556633, sunX:  -6, sunY: 22 },
    { t: 0.70, sky: 0x87ceeb, sun: 1.3, amb: 0.55, ambClr: 0xfff5e6, sunClr: 0xffffff, hemiSky: 0x87ceeb, hemiGnd: 0x556633, sunX:   6, sunY: 22 },
    { t: 0.78, sky: 0xeebb88, sun: 0.9, amb: 0.45, ambClr: 0xffddaa, sunClr: 0xffaa55, hemiSky: 0xeebb88, hemiGnd: 0x554433, sunX:  14, sunY: 12 },
    { t: 0.85, sky: 0xdd6644, sun: 0.5, amb: 0.38, ambClr: 0xddaa88, sunClr: 0xff5522, hemiSky: 0xbb5533, hemiGnd: 0x443322, sunX:  18, sunY: 5  },
    { t: 0.92, sky: 0x3a2a66, sun: 0.0, amb: 0.48, ambClr: 0x8877bb, sunClr: 0x3a2a66, hemiSky: 0x5544aa, hemiGnd: 0x332255, sunX:  18, sunY: 2  },
    { t: 1.00, sky: 0x263366, sun: 0.0, amb: 0.50, ambClr: 0x7788cc, sunClr: 0x263366, hemiSky: 0x4466aa, hemiGnd: 0x2a3355, sunX:   0, sunY: 2  },
];

const _ca = new THREE.Color();
const _cb = new THREE.Color();

function lerpHex(target, hexA, hexB, f) {
    _ca.setHex(hexA);
    _cb.setHex(hexB);
    _ca.lerp(_cb, f);
    target.copy(_ca);
}

function lerpScalar(a, b, f) {
    return a + (b - a) * f;
}

export function updateDayNight(progress) {
    // Find keyframe pair
    let a = DAY_PHASES[0], b = DAY_PHASES[1];
    for (let i = 0; i < DAY_PHASES.length - 1; i++) {
        if (progress >= DAY_PHASES[i].t && progress <= DAY_PHASES[i + 1].t) {
            a = DAY_PHASES[i];
            b = DAY_PHASES[i + 1];
            break;
        }
    }
    const range = b.t - a.t;
    const f = range > 0 ? (progress - a.t) / range : 0;

    // Sky + fog
    lerpHex(scene.background, a.sky, b.sky, f);
    scene.fog.color.copy(scene.background);

    // Sun light - intensity, color, and animated position
    sunLight.intensity = lerpScalar(a.sun, b.sun, f);
    lerpHex(sunLight.color, a.sunClr, b.sunClr, f);

    const sx = lerpScalar(a.sunX, b.sunX, f);
    const sy = lerpScalar(a.sunY, b.sunY, f);
    sunLight.position.set(sx, sy, -5); // Z=-5 keeps light from the front for depth

    // Ambient light - intensity + color tinting
    ambientLight.intensity = lerpScalar(a.amb, b.amb, f);
    lerpHex(ambientLight.color, a.ambClr, b.ambClr, f);

    // Hemisphere light
    lerpHex(hemiLight.color, a.hemiSky, b.hemiSky, f);
    lerpHex(hemiLight.groundColor, a.hemiGnd, b.hemiGnd, f);

    // Moonlight fill: fades in as the sun fades out so night keeps 3D form.
    const sunStrength = sunLight.intensity / 1.3;            // 0..1
    moonLight.intensity = Math.max(0, 1 - sunStrength) * 0.7;
}

/** Returns true if it's nighttime (progress in dark range) */
export function isNightTime(progress) {
    return progress < 0.12 || progress > 0.88;
}

// Camera follow - only translates, never rotates
let cameraSnapped = false;

// Debug/free camera override (for automated screenshots). When set, the camera
// frames a fixed world point instead of following the player, with tunable
// height/distance/pitch. Driven by URL params - see main.js.
let camHeight = CAMERA_HEIGHT;
let camDistance = CAMERA_DISTANCE;
let debugTarget = null;

// Screen shake - punchy positional jitter that decays fast. Added by juice events.
let shake = 0;
export function addShake(mag) { shake = Math.min(shake + mag, 0.6); }

// Drag-to-pan: the camera can be dragged off the player, then lerps back to
// following once the player moves again. Clamped so you can't lose the farm.
let panX = 0, panZ = 0;
const PAN_LIMIT = 16;
export function panCamera(dx, dz) {
    panX = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panX + dx));
    panZ = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panZ + dz));
}
export function recenterCamera() { panX = 0; panZ = 0; }

export function setDebugCamera({ x, z, height, distance, pitch } = {}) {
    if (x != null && z != null) debugTarget = { x, z };
    if (height != null) camHeight = height;
    if (distance != null) camDistance = distance;
    if (pitch != null && camera) camera.rotation.set(pitch, 0, 0);
    cameraSnapped = false; // re-snap to the new framing on the next frame
}

export function updateCamera(targetPos, dt, playerMoving) {
    const t = debugTarget || targetPos;

    // When the player runs around, lerp the drag-pan back to zero (re-follow)
    if (!debugTarget && playerMoving && (panX !== 0 || panZ !== 0)) {
        const k = 1 - Math.exp(-5 * dt);
        panX += (0 - panX) * k;
        panZ += (0 - panZ) * k;
        if (Math.abs(panX) < 0.02) panX = 0;
        if (Math.abs(panZ) < 0.02) panZ = 0;
    }

    const ox = debugTarget ? 0 : panX;
    const oz = debugTarget ? 0 : panZ;
    const desiredX = t.x + ox;
    const desiredY = (debugTarget ? 0 : targetPos.y) + camHeight;
    const desiredZ = t.z + oz + camDistance;

    // First frame: snap directly to the player (no fly-in from world origin)
    const smooth = cameraSnapped ? 1 - Math.exp(-4 * dt) : 1;
    cameraSnapped = true;
    camera.position.x += (desiredX - camera.position.x) * smooth;
    camera.position.y += (desiredY - camera.position.y) * smooth;
    camera.position.z += (desiredZ - camera.position.z) * smooth;

    // Screen shake on top of the followed position, decaying each frame
    if (shake > 0.001) {
        camera.position.x += (Math.random() * 2 - 1) * shake;
        camera.position.y += (Math.random() * 2 - 1) * shake;
        shake *= Math.max(0, 1 - 12 * dt);
    } else shake = 0;

    // Curvature origin = framed point (ground near it is flat), incl. pan
    curveUniforms.curveOrigin.value.set(t.x + ox, 0, t.z + oz);
}

/**
 * Raycast against the CURVED ground surface: y = -(z - pz)^2 * curvature
 *
 * Solves the ray-surface intersection analytically (quadratic).
 * This gives pixel-perfect tile picking that matches the visual curvature.
 */
export function raycastGround(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    const c = curveUniforms.curvature.value;
    const pz = curveUniforms.curveOrigin.value.z;

    // Solve: origin.y + t*dir.y = -c * (origin.z + t*dir.z - pz)^2
    // Rearranges to: a*t^2 + b*t + d = 0
    const u = origin.z - pz;
    const a = c * dir.z * dir.z;
    const b = 2 * c * u * dir.z + dir.y;
    const d = c * u * u + origin.y;

    let t = -1;

    if (Math.abs(a) < 1e-8) {
        // Nearly linear (ray parallel to Z or curvature ~0) - fallback to flat plane
        if (Math.abs(b) > 1e-8) {
            t = -d / b;
        }
    } else {
        const disc = b * b - 4 * a * d;
        if (disc < 0) return null;

        const sqrtD = Math.sqrt(disc);
        const t1 = (-b - sqrtD) / (2 * a);
        const t2 = (-b + sqrtD) / (2 * a);

        // Pick smallest positive t (closest hit in front of camera)
        if (t1 > 0.01 && t2 > 0.01) t = Math.min(t1, t2);
        else if (t1 > 0.01) t = t1;
        else if (t2 > 0.01) t = t2;
    }

    if (t < 0) return null;

    const hitX = origin.x + t * dir.x;
    const hitZ = origin.z + t * dir.z;

    return {
        x: Math.round(hitX),
        z: Math.round(hitZ),
        worldX: hitX,
        worldZ: hitZ
    };
}

export function render() {
    renderer.render(scene, camera);
}
