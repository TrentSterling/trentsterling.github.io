// live3d -- lazy three.js viewers embedded in the landing page.
//
// Each `<div class="live3d" data-model="NAME">` holds a poster <img> (shown
// by default, doubles as the no-JS / no-WebGL fallback) plus a <canvas> that
// only gets a real three.js scene once the element scrolls near the
// viewport. IntersectionObserver gates BOTH the network fetch of three.js +
// the embedded model data AND the actual render loop, so a page with a hero
// model and two gallery models never runs more than what's on screen -- the
// pitch is "runs on a potato," this file has to hold up its end.
//
// Model bytes are base64-embedded (js/models-data.js, built by
// tools/build-models.mjs) rather than fetched as .glb -- same reasoning as
// boxeltoy: GLTFLoader.load() calls fetch() unconditionally, and fetch() to
// file:// is blocked/flaky, but this page has to preview correctly from
// file:// too. GLTFLoader.parse() on an in-memory ArrayBuffer sidesteps it.
'use strict';

(() => {
  if (!('IntersectionObserver' in window)) return; // poster stays put, no crash

  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // === lazy-load the three.js bundle + embedded model data, once ===
  let vendorPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`live3d: failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  function loadVendor() {
    if (!vendorPromise) {
      vendorPromise = (async () => {
        if (!window.THREE) await loadScript('vendor/three.bundle.js');
        if (!window.BOXEL_LIVE_MODELS) await loadScript('js/models-data.js');
      })();
    }
    return vendorPromise;
  }

  function gltfFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  class LiveViewer {
    constructor(el) {
      this.el = el;
      this.name = el.dataset.model;
      this.canvas = el.querySelector('.live3d-canvas');
      this.ready = false;
      this.initializing = false;
      this.running = false;
      this.raf = null;
      this.dragging = false;
      this.lastPointer = null;
      // A deliberate first view makes the model readable before interaction.
      this.yaw = -0.45;
      this.pitch = -0.15;
      this.autoSpin = !prefersReducedMotion;
    }

    async init() {
      if (this.ready || this.initializing) return;
      this.initializing = true;
      this.el.classList.add('is-loading');
      try {
        await loadVendor();
        const entry = (window.BOXEL_LIVE_MODELS || []).find((m) => m.name === this.name);
        if (!entry) {
          console.error(`live3d: no embedded model named "${this.name}" (check js/models-data.js)`);
          return;
        }

        const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        this.renderer = renderer;

        const scene = new THREE.Scene();
        this.scene = scene;
        // soft studio lighting -- cheap even though the boxel exports are
        // KHR_materials_unlit (GLTFLoader maps that to MeshBasicMaterial,
        // which ignores lights entirely); harmless, and correct if a future
        // export ever ships a lit material.
        scene.add(new THREE.HemisphereLight(0x8f9fff, 0x0a0a2e, 0.95));
        const key = new THREE.DirectionalLight(0xfff3d6, 1.1);
        key.position.set(4, 6, 5);
        scene.add(key);
        const fillLight = new THREE.DirectionalLight(0x4a90ff, 0.35);
        fillLight.position.set(-5, 2, -3);
        scene.add(fillLight);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
        this.camera = camera;
        this.rig = new THREE.Group();
        scene.add(this.rig);

        const buf = gltfFromBase64(entry.base64);
        await new Promise((resolve, reject) => {
          new THREE.GLTFLoader().parse(
            buf, '',
            (gltf) => {
              const model = gltf.scene;
              const box = new THREE.Box3().setFromObject(model);
              const size = new THREE.Vector3();
              box.getSize(size);
              const center = new THREE.Vector3();
              box.getCenter(center);
              const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
              const scale = 1.6 / maxDim;

              model.traverse((o) => {
                if (o.isMesh && o.material) {
                  // surface-atlas GLB export has inverted triangle winding --
                  // same DoubleSide fix boxeltoy needed, or the model goes
                  // hollow/see-through as it rotates.
                  o.material.side = THREE.DoubleSide;
                  if (o.material.map) {
                    o.material.map.magFilter = THREE.NearestFilter;
                    o.material.map.minFilter = THREE.NearestFilter;
                    o.material.map.generateMipmaps = false;
                  }
                }
              });

              model.position.copy(center).multiplyScalar(-1);
              const inner = new THREE.Group();
              inner.scale.setScalar(scale);
              inner.add(model);
              this.rig.add(inner);
              resolve();
            },
            reject
          );
        });

        this.fitCamera();
        this.bindInteraction();
        this.ready = true;
        this.el.classList.remove('is-loading');
        this.el.classList.add('is-live');
      } catch (err) {
        console.error(`live3d: failed to init "${this.name}"`, err);
        this.el.classList.remove('is-loading'); // fall back to the poster image
      } finally {
        this.initializing = false;
      }
    }

    fitCamera() {
      const rect = this.el.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.position.set(0, 0.15, 2.5);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateProjectionMatrix();
    }

    bindInteraction() {
      const el = this.el;
      const onDown = (e) => {
        this.dragging = true;
        this.autoSpin = false;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        el.setPointerCapture?.(e.pointerId);
      };
      const onMove = (e) => {
        if (!this.dragging || !this.lastPointer) return;
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.yaw += dx * 0.008;
        this.pitch = Math.max(-0.9, Math.min(0.9, this.pitch + dy * 0.006));
      };
      const onUp = () => { this.dragging = false; };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onUp);
    }

    start() {
      if (!this.ready || this.running) return;
      this.running = true;
      const animate = () => {
        if (!this.running) return;
        this.raf = requestAnimationFrame(animate);
        if (this.autoSpin && !this.dragging) this.yaw += 0.0035;
        this.rig.rotation.y = this.yaw;
        this.rig.rotation.x = this.pitch;
        this.renderer.render(this.scene, this.camera);
      };
      animate();
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    handleResize() {
      if (!this.ready) return;
      this.fitCamera();
    }
  }

  function boot() {
    const els = document.querySelectorAll('.live3d');
    if (els.length === 0) return;

    const viewers = Array.from(els).map((el) => new LiveViewer(el));

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const viewer = viewers.find((v) => v.el === entry.target);
          if (!viewer) continue;
          if (entry.isIntersecting) {
            if (viewer.ready) viewer.start();
            else viewer.init().then(() => { if (viewer.ready) viewer.start(); });
          } else {
            viewer.stop();
          }
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    );

    viewers.forEach((v) => io.observe(v.el));

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => viewers.forEach((v) => v.handleResize()), 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
