// ================================================================
//  ONION ALL — every friend pair, side by side
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

const VIEWS = ['insight', 'perception', 'mutuality'];


// ================================================================
//  STATE
// ================================================================

let selectedView = 'mutuality';
let seedOffset   = 0;
let s            = 200;
let gridCols     = 1;
let gridRows     = 1;
let cellWidth    = 0;
let cellHeight   = 0;


// ================================================================
//  TILE BUILDERS
// ================================================================

const ROTATION_SPEED   = 0.00025;
const COLOR_FLOW_SPEED = 0.0006;
const BREATHE_SPEED    = 0.0009;
const BREATHE_AMP      = 0.08;
const BREATHE_CASCADE  = 0.55;
const FALLBACK_BG      = '#f5f5f5';

function buildPair(friend, view, aspect) {
  const make = params => buildOnion({ ...params, aspect });

  if (view === 'insight') {
    return {
      top:    make({ rings: ringsFromAge(me.self.age),     size: me.self.love,     stroke: me.self.careEffort,     saturate: me.self.knowledge,     colors: me.self.palette }),
      bottom: make({ rings: ringsFromAge(friend.self.age), size: friend.self.love, stroke: friend.self.careEffort, saturate: friend.self.knowledge, colors: friend.self.palette }),
    };
  }
  if (view === 'perception') {
    return {
      top:    make({ rings: ringsFromLike(friend.mine.likeRelationship),   size: friend.mine.effort,   stroke: friend.theirs.perceivedMyEffort,    saturate: friend.mine.mutualKnowledge,   colors: friend.mine.palette }),
      bottom: make({ rings: ringsFromLike(friend.theirs.likeRelationship), size: friend.theirs.effort, stroke: friend.mine.perceivedTheirEffort,   saturate: friend.theirs.mutualKnowledge, colors: friend.theirs.palette }),
    };
  }
  const rings = ringsFromMonths(friend.knownMonths);
  return {
    top:    make({ rings, size: friend.mine.effort,   stroke: friend.mine.mutualKnowledge,   saturate: friend.mine.likeRelationship,   colors: friend.mine.palette }),
    bottom: make({ rings, size: friend.theirs.effort, stroke: friend.theirs.mutualKnowledge, saturate: friend.theirs.likeRelationship, colors: friend.theirs.palette }),
  };
}

function buildOnion({ rings, size, stroke, saturate, colors, aspect }) {
  const base       = lerp(0.36, 0.55, size);
  const palette    = expandPalette(colors, rings);
  const ringScale  = min(1, 14 / rings);
  return {
    widthMul:  constrain(base * aspect, 0.26, 0.70),
    heightMul: constrain(base / aspect, 0.26, 0.50),
    thickness: lerp(0.4, 3.5, stroke) * ringScale,
    rings,
    curve:     1.45,
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

function ringsFromMonths(months) {
  const count = months < 12 ? Math.round(months * 4.33) : months;
  return constrain(count, 2, 120);
}

function ringsFromAge(age) {
  return constrain(age, 2, 120);
}

const LIKE_RING_FACTOR = 30;
function ringsFromLike(like) {
  return constrain(Math.round((like ?? 0) * LIKE_RING_FACTOR), 2, 120);
}


// ================================================================
//  DRAW PAIR
// ================================================================

function drawPairTile(friend, cx, cy) {
  randomSeed(hash(friend.name + selectedView) + seedOffset);
  const seedPhase    = random(0, TWO_PI);
  const sharedAspect = random(0.92, 1.08);
  const rotationDir  = random() < 0.5 ? -1 : 1;
  const baseAngle    = seedPhase + millis() * ROTATION_SPEED * rotationDir;

  const pair = buildPair(friend, selectedView, sharedAspect);

  drawOnionAtRoot(pair.top,    cx, cy, baseAngle);
  drawOnionAtRoot(pair.bottom, cx, cy, baseAngle + PI);

  push();
  noStroke();
  fill(0, 0, 0, 180);
  textAlign(CENTER, TOP);
  textFont('monospace');
  textStyle(BOLD);
  textSize(max(s * 0.05, 11));
  text(friend.name, cx, cy + s * 0.55);
  pop();
}

function drawOnionAtRoot(o, rootX, rootY, angle) {
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
  const sources = [...(me.self.palette ?? [])];
  for (const friend of friends) {
    if (selectedView === 'insight') {
      if (friend.self?.palette) sources.push(...friend.self.palette);
    } else {
      if (friend.mine?.palette)   sources.push(...friend.mine.palette);
      if (friend.theirs?.palette) sources.push(...friend.theirs.palette);
    }
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

function setup() {
  createCanvas(windowWidth, windowHeight);
  computeLayout();
  buildViewPicker();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
}

function computeLayout() {
  const n = max(1, friends.length);
  const aspect = windowWidth / max(windowHeight, 1);
  gridCols = max(1, Math.ceil(Math.sqrt(n * aspect)));
  gridRows = Math.ceil(n / gridCols);
  cellWidth  = windowWidth  / gridCols;
  cellHeight = (windowHeight - 80) / gridRows;
  s = min(cellWidth, cellHeight) * 0.66;
}

function draw() {
  background(currentBackground());

  for (let i = 0; i < friends.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const cx = (col + 0.5) * cellWidth;
    const cy = (row + 0.5) * cellHeight + 20;
    drawPairTile(friends[i], cx, cy);
  }
}

function mousePressed() { seedOffset++; }

function keyPressed() {
  if (keyCode === UP_ARROW)   { cycleView(-1); return false; }
  if (keyCode === DOWN_ARROW) { cycleView(1);  return false; }
}

function cycleView(delta) {
  const idx = VIEWS.indexOf(selectedView);
  selectedView = VIEWS[(idx + delta + VIEWS.length) % VIEWS.length];
  buildViewPicker();
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return abs(h);
}


// ================================================================
//  OVERLAY UI
// ================================================================

function buildViewPicker() {
  const container = document.getElementById('view-picker');
  container.replaceChildren();
  for (const v of VIEWS) {
    const tab = document.createElement('div');
    tab.className = 'view-tab' + (v === selectedView ? ' active' : '');
    tab.textContent = v;
    tab.onclick = () => {
      selectedView = v;
      buildViewPicker();
    };
    container.appendChild(tab);
  }
}
