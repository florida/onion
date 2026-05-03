// ================================================================
//  ONION CONSTELLATION — final piece (II)
// ================================================================
//
//  All people (you + your friends) share one root point at the
//  center and fan out around it. Each person is rendered from
//  their own self-data:
//
//    rings      = age
//    size       = self-love
//    stroke     = self-care effort
//    saturation = self-knowledge
//    palette    = personal palette
//
//  Click a node up top to toggle them in or out of the
//  constellation. Click inside the canvas to reroll the
//  random aspect / rotation direction.
// ================================================================


// ================================================================
//  DATA
// ================================================================

const _K = { n: 'name', s: 'self', a: 'age', k: 'knowledge', l: 'love', c: 'careEffort', p: 'palette', d: 'knownMonths', m: 'mine', t: 'theirs', u: 'mutualKnowledge', r: 'likeRelationship', e: 'effort', x: 'perceivedMyEffort', y: 'perceivedTheirEffort' };

function _dec(o) {
  if (Array.isArray(o)) return o.map(_dec);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[_K[k] || k] = _dec(v);
    return out;
  }
  return o;
}

const SEED_ME      = _dec(window.SEED_ME)      ?? { name: 'me', self: { age: 30, knowledge: 0.7, love: 0.7, careEffort: 0.7, palette: ['#888'] } };
const SEED_FRIENDS = _dec(window.SEED_FRIENDS) ?? [];

function loadStoredData() {
  try {
    const raw = localStorage.getItem('friendsData');
    if (!raw) return null;
    const parsed = _dec(JSON.parse(raw));
    if (!parsed?.me || !Array.isArray(parsed.friends) || parsed.friends.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

const stored  = loadStoredData();
const me      = stored?.me ?? SEED_ME;
const friends = stored?.friends ?? SEED_FRIENDS;
const people  = [me, ...friends];


// ================================================================
//  STATE
// ================================================================

const active     = new Set(people.map((_, i) => i));
let seedOffset   = 0;
const nodes      = [];


// ================================================================
//  TILE
// ================================================================

const ROTATION_SPEED   = 0.00018;
const COLOR_FLOW_SPEED = 0.0006;
const BREATHE_SPEED    = 0.0009;
const BREATHE_AMP      = 0.05;
const BREATHE_CASCADE  = 0.55;
const NOISE_FORCE      = 0.06;
const DAMPING          = 0.96;
const LINK_THRESHOLD   = 0.32;
const MAGNETIC_SPEED   = 0.00010;
const MAGNETIC_FORCE   = 0.008;
const SEPARATION_RANGE = 0.06;
const SEPARATION_FORCE = 0.0010;
const FALLBACK_BG      = '#f5f5f5';

function initNodes() {
  nodes.length = 0;
  for (let i = 0; i < people.length; i++) {
    nodes.push({
      idx: i,
      x: random(windowWidth),
      y: random(windowHeight),
      vx: random(-0.6, 0.6),
      vy: random(-0.6, 0.6),
      noiseOffset: random(10000),
      phase: random(TWO_PI),
      rotationDir: random() < 0.5 ? -1 : 1,
    });
  }
}

function wrapDelta(d, range) {
  const half = range / 2;
  if (d > half)  return d - range;
  if (d < -half) return d + range;
  return d;
}

function updateNodes() {
  const t = millis() * 0.0001;
  const magnetT = millis() * MAGNETIC_SPEED;
  const sepRange = s * SEPARATION_RANGE;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = wrapDelta(b.x - a.x, windowWidth);
      const dy = wrapDelta(b.y - a.y, windowHeight);
      const d = max(sqrt(dx * dx + dy * dy), 0.01);

      const attraction = sin(magnetT + (i * 7 + j * 11) * 0.31);
      const force = attraction * MAGNETIC_FORCE;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;

      if (d < sepRange) {
        const sep = (sepRange - d) * SEPARATION_FORCE;
        a.vx -= (dx / d) * sep;
        a.vy -= (dy / d) * sep;
        b.vx += (dx / d) * sep;
        b.vy += (dy / d) * sep;
      }
    }
  }

  for (const node of nodes) {
    const nx = noise(node.noiseOffset + t) - 0.5;
    const ny = noise(node.noiseOffset + 5000 + t) - 0.5;
    node.vx += nx * NOISE_FORCE;
    node.vy += ny * NOISE_FORCE;

    node.vx *= DAMPING;
    node.vy *= DAMPING;

    node.x += node.vx;
    node.y += node.vy;

    if (node.x < 0)             node.x += windowWidth;
    if (node.x >= windowWidth)  node.x -= windowWidth;
    if (node.y < 0)             node.y += windowHeight;
    if (node.y >= windowHeight) node.y -= windowHeight;
  }
}

function drawTile() {
  if (nodes.length === 0) return;

  updateNodes();

  const included = nodes.filter(n => active.has(n.idx));
  if (included.length === 0) return;

  drawConnections(included);

  for (const node of included) {
    const person = people[node.idx];
    const onion  = buildOnionForSelf(person);
    const angle  = node.phase + millis() * ROTATION_SPEED * node.rotationDir;
    const label  = (person.name || '?').slice(0, 1).toUpperCase();
    drawOnionAtRoot(onion, node.x, node.y, angle, label);
  }
}

function drawConnections(included) {
  const threshold = s * LINK_THRESHOLD;
  const halfW = windowWidth / 2;
  const halfH = windowHeight / 2;
  push();
  noFill();
  strokeWeight(0.8);
  for (let i = 0; i < included.length; i++) {
    for (let j = i + 1; j < included.length; j++) {
      const a = included[i];
      const b = included[j];
      const rawDx = b.x - a.x;
      const rawDy = b.y - a.y;
      const dx = wrapDelta(rawDx, windowWidth);
      const dy = wrapDelta(rawDy, windowHeight);
      const d = sqrt(dx * dx + dy * dy);
      if (d >= threshold) continue;
      if (Math.abs(rawDx) > halfW || Math.abs(rawDy) > halfH) continue;
      const alpha = map(d, threshold, 0, 0, 130);
      stroke(0, 0, 0, alpha);
      line(a.x, a.y, b.x, b.y);
    }
  }
  pop();
}

function buildOnionForSelf(person) {
  const self = person.self;
  return buildOnion({
    rings:    ringsFromAge(self.age),
    size:     self.love,
    stroke:   self.careEffort,
    saturate: self.knowledge,
    colors:   self.palette,
    aspect:   1,
  });
}

function buildOnion({ rings, size, stroke, saturate, colors, aspect }) {
  const base    = lerp(0.06, 0.12, size);
  const palette = expandPalette(colors, rings);
  return {
    widthMul:  constrain(base * aspect, 0.05, 0.14),
    heightMul: constrain(base / aspect, 0.05, 0.13),
    thickness: lerp(0.4, 2, stroke),
    rings,
    curve:     1.2,
    palette:   saturate === undefined ? palette : modulateSaturation(palette, saturate),
  };
}

function modulateSaturation(hexes, factor) {
  push();
  colorMode(HSL, 360, 100, 100);
  const out = hexes.map(hex => {
    const c = color(hex);
    const h = hue(c);
    const sat = saturation(c) * lerp(0.15, 1.0, factor);
    const l = constrain(lightness(c) + (1 - factor) * 6, 10, 95);
    return colorToHex(color(h, constrain(sat, 0, 100), l));
  });
  pop();
  return out;
}

function ringsFromAge(age) {
  return constrain(age, 2, 120);
}

function drawOnionAtRoot(o, rootX, rootY, angle, label) {
  push();
  translate(rootX, rootY);
  rotate(angle);

  strokeWeight(o.thickness);

  const flow         = millis() * COLOR_FLOW_SPEED;
  const breatheBase  = millis() * BREATHE_SPEED;
  const palLen       = o.palette.length;

  for (let i = o.rings; i >= 1; i--) {
    const tBase   = pow(i / o.rings, o.curve);
    const breathe = 1 + BREATHE_AMP * sin(breatheBase + (o.rings - i) * BREATHE_CASCADE);
    const t       = tBase * breathe;
    const w       = s * t * o.widthMul;
    const h       = s * t * o.heightMul;
    const c       = flowingColor(o.palette, palLen, o.rings - i, flow);
    fill(c);
    stroke(strokeFromFill(c));
    ellipse(0, -h / 2, w, h);
  }

  if (label) {
    push();
    translate(0, -s * o.heightMul * 0.5);
    rotate(-angle);
    textAlign(CENTER, CENTER);
    textFont('monospace');
    textStyle(BOLD);
    textSize(max(s * 0.020, 12));
    strokeWeight(3);
    stroke(255, 255, 255, 210);
    fill(0, 0, 0, 235);
    text(label, 0, 0);
    pop();
  }

  pop();
}

function strokeFromFill(c) {
  push();
  colorMode(HSL, 360, 100, 100);
  const h    = hue(c);
  const sat  = saturation(c);
  const l    = lightness(c);
  const newL = l > 55 ? max(l - 12, 14) : min(l + 12, 90);
  const out  = color(h, sat, newL);
  pop();
  return out;
}

function flowingColor(palette, palLen, baseIdx, flow) {
  if (palLen <= 1) return color(palette[0] ?? '#888888');
  const raw = (baseIdx + flow) % palLen;
  const idx = raw < 0 ? raw + palLen : raw;
  const lo  = Math.floor(idx);
  const hi  = (lo + 1) % palLen;
  return lerpColor(color(palette[lo]), color(palette[hi]), idx - lo);
}


// ================================================================
//  PALETTE
// ================================================================

function expandPalette(hexes, n) {
  const safe = (hexes && hexes.length > 0) ? hexes : ['#888888'];
  if (safe.length === 1) return gradientFromOne(safe[0], n);
  if (safe.length >= n)  return safe.slice(0, n);
  return interpolatePalette(safe, n);
}

function gradientFromOne(hex, n) {
  push();
  colorMode(HSL, 360, 100, 100);
  const base    = color(hex);
  const baseH   = hue(base);
  const baseS   = max(saturation(base), 30);
  const baseL   = lightness(base);
  const hueDir  = random() < 0.5 ? -1 : 1;
  const out     = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const h = (baseH + hueDir * lerp(-18, 18, t) + 360) % 360;
    const sFactor = 1 - 0.35 * abs(t - 0.5) * 2;
    const sat   = constrain(baseS * sFactor, 20, 95);
    const light = constrain(lerp(baseL - 28, baseL + 28, t), 28, 88);
    out.push(colorToHex(color(h, sat, light)));
  }
  pop();
  return out;
}

function interpolatePalette(hexes, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t  = i / (n - 1) * (hexes.length - 1);
    const lo = floor(t);
    const hi = min(ceil(t), hexes.length - 1);
    if (lo === hi) {
      out.push(hexes[lo]);
    } else {
      const f = t - lo;
      out.push(colorToHex(lerpColor(color(hexes[lo]), color(hexes[hi]), f)));
    }
  }
  return out;
}

function colorToHex(c) {
  const r = Math.round(red(c)).toString(16).padStart(2, '0');
  const g = Math.round(green(c)).toString(16).padStart(2, '0');
  const b = Math.round(blue(c)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}


// ================================================================
//  BACKGROUND
// ================================================================

function currentBackground() {
  const sources = [];
  for (const idx of active) {
    const palette = people[idx]?.self?.palette;
    if (palette) sources.push(...palette);
  }
  return paletteBackground(sources);
}

function paletteBackground(palette) {
  if (!palette || palette.length === 0) return FALLBACK_BG;
  push();
  colorMode(HSL, 360, 100, 100);
  let cosSum = 0, sinSum = 0;
  for (const hex of palette) {
    const c = color(hex);
    const w = max(saturation(c) / 100, 0.15);
    const rad = hue(c) * Math.PI / 180;
    cosSum += Math.cos(rad) * w;
    sinSum += Math.sin(rad) * w;
  }
  let avgHue = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
  if (avgHue < 0) avgHue += 360;
  const bg = colorToHex(color(avgHue, 22, 94));
  pop();
  return bg;
}


// ================================================================
//  ENGINE
// ================================================================

let s, ox, oy;

function setup() {
  createCanvas(windowWidth, windowHeight);
  computeLayout();
  initNodes();
  buildPeoplePicker();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
}

function computeLayout() {
  const margin = 80;
  s  = max(min(windowWidth, windowHeight) - margin * 2, 200);
  ox = (windowWidth  - s) / 2;
  oy = (windowHeight - s) / 2;
}

function draw() {
  background(currentBackground());
  drawTile();
}

function mousePressed() {
  const insideTile = mouseX >= ox && mouseX <= ox + s && mouseY >= oy && mouseY <= oy + s;
  if (insideTile) seedOffset++;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return abs(h);
}


// ================================================================
//  OVERLAY UI
// ================================================================

function buildPeoplePicker() {
  const container = document.getElementById('people-picker');
  container.replaceChildren();
  people.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'person ' + (active.has(i) ? 'active' : 'inactive');
    item.title = p.name;
    item.onclick = () => {
      if (active.has(i)) {
        if (active.size > 1) active.delete(i);
      } else {
        active.add(i);
      }
      buildPeoplePicker();
    };

    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = paletteToConic(p.self?.palette ?? ['#888']);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name;

    item.appendChild(dot);
    item.appendChild(name);
    container.appendChild(item);
  });
}

function paletteToConic(colors) {
  if (!colors || colors.length === 0) return '#888';
  if (colors.length === 1) return colors[0];
  const stops = colors.map((c, i) => {
    const startDeg = (i / colors.length) * 360;
    const endDeg   = ((i + 1) / colors.length) * 360;
    return `${c} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`;
  }).join(', ');
  return `conic-gradient(from 0deg, ${stops})`;
}
