// ================================================================
//  ONION FLOWER — final piece (III)
// ================================================================
//
//  One person sits at the center as concentric rings. The selected
//  friends become petals fanning around them. Both center and
//  petals use only that person's self-data.
//
//    rings      = age
//    size       = self-love
//    stroke     = self-care effort
//    saturation = self-knowledge
//    palette    = personal palette
//
//  Pick the center person from the top "center" row. Toggle which
//  friends become petals from the "petals" row. The center person
//  is automatically excluded from the petals list.
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

let centerIdx     = 0;
const petalActive = new Set(people.map((_, i) => i).filter(i => i !== centerIdx));
let seedOffset    = 0;


// ================================================================
//  TILE
// ================================================================

const ROTATION_SPEED   = 0.00018;
const COLOR_FLOW_SPEED = 0.0006;
const BREATHE_SPEED    = 0.0009;
const BREATHE_AMP      = 0.05;
const BREATHE_CASCADE  = 0.55;
const FALLBACK_BG      = '#f5f5f5';

function drawTile() {
  randomSeed(hash(centerIdx + ':' + [...petalActive].sort().join(',')) + seedOffset);

  const sharedAspect = random(0.92, 1.08);
  const rotationDir  = random() < 0.5 ? -1 : 1;
  const seedPhase    = random(0, TWO_PI);
  const angleNudges  = people.map(() => random(-0.10, 0.10));

  const baseAngle = seedPhase + millis() * ROTATION_SPEED * rotationDir;

  const petalIdxs = [...petalActive].filter(i => i !== centerIdx);

  const centerPerson = people[centerIdx];
  const centerOnion  = centerPerson ? buildCenter(centerPerson) : null;

  const breatheBase   = millis() * BREATHE_SPEED;
  const outerBreathe  = 1 + BREATHE_AMP * sin(breatheBase);
  const bulbRadius    = centerOnion ? s * centerOnion.heightMul * outerBreathe / 2 : 0;
  const attachRadius  = bulbRadius * 0.85;

  const cx = s / 2;
  const cy = s / 2;

  for (let j = 0; j < petalIdxs.length; j++) {
    const idx     = petalIdxs[j];
    const person  = people[idx];
    const theta   = baseAngle + (j * TWO_PI) / petalIdxs.length + angleNudges[idx];
    const rootX   = cx + attachRadius * cos(theta);
    const rootY   = cy + attachRadius * sin(theta);
    const angle   = theta + HALF_PI;
    const onion   = buildPetal(person, sharedAspect);
    drawOnionAtRoot(onion, rootX, rootY, angle);
  }

  if (centerOnion) {
    drawOnionConcentric(centerOnion, cx, cy);
  }
}

function buildPetal(person, aspect) {
  const self = person.self;
  return buildOnion({
    rings:    ringsFromAge(self.age),
    size:     self.love,
    stroke:   self.careEffort,
    saturate: self.knowledge,
    colors:   self.palette,
    aspect,
    sizeRange: [0.30, 0.45],
    capW:      0.50,
    capH:      0.45,
  });
}

function buildCenter(person) {
  const self = person.self;
  return buildOnion({
    rings:    ringsFromAge(self.age),
    size:     self.love,
    stroke:   self.careEffort,
    saturate: self.knowledge,
    colors:   self.palette,
    aspect:   1,
    sizeRange: [0.18, 0.34],
    capW:      0.36,
    capH:      0.36,
  });
}

function buildOnion({ rings, size, stroke, saturate, colors, aspect, sizeRange, capW, capH }) {
  const base    = lerp(sizeRange[0], sizeRange[1], size);
  const palette = expandPalette(colors, rings);
  return {
    widthMul:  constrain(base * aspect, 0.16, capW),
    heightMul: constrain(base / aspect, 0.16, capH),
    thickness: lerp(0.5, 4.5, stroke),
    rings,
    curve:     1,
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

function drawOnionAtRoot(o, rootX, rootY, angle) {
  push();
  translate(rootX, rootY);
  rotate(angle);
  drawRings(o, (w, h) => ellipse(0, -h / 2, w, h));
  pop();
}

function drawOnionConcentric(o, cx, cy) {
  push();
  translate(cx, cy);
  drawRings(o, (w, h) => ellipse(0, 0, w, h));
  pop();
}

function drawRings(o, drawShape) {
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
    drawShape(w, h);
  }
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
  const centerPalette = people[centerIdx]?.self?.palette;
  if (centerPalette) sources.push(...centerPalette);
  for (const idx of petalActive) {
    if (idx === centerIdx) continue;
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
  buildPickers();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
}

function computeLayout() {
  const margin = 110;
  s  = max(min(windowWidth, windowHeight) - margin * 2, 200);
  ox = (windowWidth  - s) / 2;
  oy = (windowHeight - s) / 2;
}

function draw() {
  background(currentBackground());
  push();
  translate(ox, oy);
  drawTile();
  pop();
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

function buildPickers() {
  buildCenterPicker();
  buildPetalsPicker();
}

function buildCenterPicker() {
  const container = document.getElementById('center-picker');
  container.replaceChildren();
  people.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'person ' + (i === centerIdx ? 'active' : 'inactive');
    item.title = `set ${p.name} as center`;
    item.onclick = () => {
      centerIdx = i;
      petalActive.delete(i);
      buildPickers();
    };
    item.appendChild(makeDot(p));
    item.appendChild(makeName(p));
    container.appendChild(item);
  });
}

function buildPetalsPicker() {
  const container = document.getElementById('petals-picker');
  container.replaceChildren();
  people.forEach((p, i) => {
    const isCenter = (i === centerIdx);
    const isActive = !isCenter && petalActive.has(i);
    const item = document.createElement('div');
    item.className = 'person ' + (isCenter ? 'disabled' : (isActive ? 'active' : 'inactive'));
    item.title = isCenter ? `${p.name} is the center` : `toggle ${p.name} as petal`;
    if (!isCenter) {
      item.onclick = () => {
        if (petalActive.has(i)) petalActive.delete(i);
        else                    petalActive.add(i);
        buildPetalsPicker();
      };
    }
    item.appendChild(makeDot(p));
    item.appendChild(makeName(p));
    container.appendChild(item);
  });
}

function makeDot(p) {
  const dot = document.createElement('div');
  dot.className = 'dot';
  dot.style.background = paletteToConic(p.self?.palette ?? ['#888']);
  return dot;
}

function makeName(p) {
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = p.name;
  return name;
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
