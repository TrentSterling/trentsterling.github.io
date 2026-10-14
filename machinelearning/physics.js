// Physics-only extraction from the private climbing research prototype. No training or model code.
const GRAVITY = 0.25, DAMPING = 0.98, CONSTRAINT_ITERATIONS = 4, ARM_REACH = 90;

function makeParticle(x, y, pinned) {
  return { x: x, y: y, ox: x, oy: y, pinned: pinned || false, mass: 1 };
}

// --- Helper: create a distance constraint ---
function makeConstraint(a, b, length) {
  if (length === undefined) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    length = Math.sqrt(dx * dx + dy * dy);
  }
  return { a: a, b: b, length: length };
}

// --- Create ragdoll climber ---
function createClimber(x, y) {
  // Body proportions for ~120px tall figure
  // y is the foot position, build upward
  const headY = y - 120;

  // Spine
  const head        = makeParticle(x, headY);
  const neck        = makeParticle(x, headY + 12);
  const torso_top   = makeParticle(x, headY + 24);
  const torso_bottom = makeParticle(x, headY + 64);

  // Arms (shoulders connect to torso_top)
  const l_shoulder  = makeParticle(x - 16, headY + 26);
  const r_shoulder  = makeParticle(x + 16, headY + 26);
  const l_elbow     = makeParticle(x - 34, headY + 36);
  const r_elbow     = makeParticle(x + 34, headY + 36);
  const l_hand      = makeParticle(x - 50, headY + 46);
  const r_hand      = makeParticle(x + 50, headY + 46);

  // Legs (hips connect to torso_bottom)
  const l_hip       = makeParticle(x - 10, headY + 68);
  const r_hip       = makeParticle(x + 10, headY + 68);
  const l_knee      = makeParticle(x - 12, headY + 93);
  const r_knee      = makeParticle(x + 12, headY + 93);
  const l_foot      = makeParticle(x - 12, headY + 115);
  const r_foot      = makeParticle(x + 12, headY + 115);

  const particles = [
    head, neck, torso_top, torso_bottom,
    l_shoulder, r_shoulder,
    l_elbow, r_elbow,
    l_hand, r_hand,
    l_hip, r_hip,
    l_knee, r_knee,
    l_foot, r_foot
  ];

  // Distance constraints -- anatomically adjacent connections
  const constraints = [
    // Spine
    makeConstraint(head, neck),            // ~12
    makeConstraint(neck, torso_top),       // ~12
    makeConstraint(torso_top, torso_bottom), // ~40

    // Shoulders to torso
    makeConstraint(torso_top, l_shoulder), // ~16
    makeConstraint(torso_top, r_shoulder), // ~16

    // Left arm
    makeConstraint(l_shoulder, l_elbow),   // ~22
    makeConstraint(l_elbow, l_hand),       // ~20

    // Right arm
    makeConstraint(r_shoulder, r_elbow),   // ~22
    makeConstraint(r_elbow, r_hand),       // ~20

    // Hips to torso bottom
    makeConstraint(torso_bottom, l_hip),   // ~10
    makeConstraint(torso_bottom, r_hip),   // ~10

    // Left leg
    makeConstraint(l_hip, l_knee),         // ~25
    makeConstraint(l_knee, l_foot),        // ~22

    // Right leg
    makeConstraint(r_hip, r_knee),         // ~25
    makeConstraint(r_knee, r_foot),        // ~22

    // Structural stability: cross-braces to prevent collapse
    makeConstraint(l_shoulder, r_shoulder), // shoulder width
    makeConstraint(l_hip, r_hip),           // hip width
    makeConstraint(neck, torso_bottom),     // spine rigidity
  ];

  const nodes = {
    head, neck, torso_top, torso_bottom,
    l_shoulder, r_shoulder,
    l_elbow, r_elbow,
    l_hand, r_hand,
    l_hip, r_hip,
    l_knee, r_knee,
    l_foot, r_foot
  };

  return { particles, constraints, nodes };
}


function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function canReach(climber, hold, hand) {
  const handNode = hand === 'left' ? climber.nodes.l_hand : climber.nodes.r_hand;
  return dist(handNode, hold) <= ARM_REACH;
}

function grabHold(climber, hold, hand) {
  const handNode = hand === 'left' ? climber.nodes.l_hand : climber.nodes.r_hand;
  const side = hand === 'left' ? 'left' : 'right';

  // Release any existing grip on this hand
  if (climber.grips[side]) {
    releaseGrip(climber, hand);
  }

  // Pin hand to hold position
  handNode.x = hold.x;
  handNode.y = hold.y;
  handNode.ox = hold.x;
  handNode.oy = hold.y;
  handNode.pinned = true;

  climber.grips[side] = { hold: hold, hand: hand, startTime: performance.now() };
}

function releaseGrip(climber, hand) {
  const handNode = hand === 'left' ? climber.nodes.l_hand : climber.nodes.r_hand;
  const side = hand === 'left' ? 'left' : 'right';

  if (climber.grips[side]) {
    // Unpin -- hand keeps current velocity (momentum from swing)
    handNode.pinned = false;
    climber.grips[side] = null;
  }
}


function physicsStepWorld(particles, constraints, worldWidth, worldHeight) {
  // 1. Verlet integration
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.pinned) continue;
    const vx = (p.x - p.ox) * DAMPING;
    const vy = (p.y - p.oy) * DAMPING;
    p.ox = p.x;
    p.oy = p.y;
    p.x += vx;
    p.y += vy + GRAVITY;
  }

  // 2. Solve distance constraints
  for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      const a = c.a;
      const b = c.b;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) continue;
      const diff = (d - c.length) / d;
      const ox = dx * diff * 0.5;
      const oy = dy * diff * 0.5;
      if (!a.pinned) { a.x += ox; a.y += oy; }
      if (!b.pinned) { b.x -= ox; b.y -= oy; }
    }
  }

  // 3. World-space boundary collision
  const margin = 3;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.pinned) continue;
    if (p.y > worldHeight - margin) { p.y = worldHeight - margin; p.oy = p.y; }
    if (p.y < margin) { p.y = margin; p.oy = p.y; }
    if (p.x < margin) { p.x = margin; p.ox = p.x; }
    if (p.x > worldWidth - margin) { p.x = worldWidth - margin; p.ox = p.x; }
  }
}


export { createClimber, canReach, grabHold, releaseGrip, physicsStepWorld, ARM_REACH };
