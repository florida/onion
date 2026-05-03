// ================================================================
//  ONION — final piece
// ================================================================
//
//  Full-page animated friendship visualization.
//
//    ← →  cycle friends
//    ↑ ↓  cycle views (insight / perception / mutuality)
//
//  Data is read from localStorage (key: "friendsData") if present
//  — fill it in via builder.html. Otherwise the seed below is used.
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

const VIEWS = ['insight', 'perception', 'mutuality', 'all'];
const SUB_VIEWS = ['insight', 'perception', 'mutuality'];


// ================================================================
//  STATE
// ================================================================

let selectedFriendIdx = 0;
let selectedView      = 'mutuality';
let seedOffset        = 0;
let labelOpacity      = 0;


// ================================================================
//  TILE
// ================================================================

const ROTATION_SPEED   = 0.00025;
const COLOR_FLOW_SPEED = 0.0006;
const BREATHE_SPEED    = 0.0009;
const BREATHE_AMP      = 0.1;
const BREATHE_CASCADE  = 0.55;
const STROKE_COLOR     = '#1a1a1a';
const FALLBACK_BG      = '#f5f5f5';

function drawTile(cx, cy, view) {
  const friend = friends[selectedFriendIdx];
  randomSeed(hash(friend.name + view) + seedOffset);

  const seedPhase    = random(0, TWO_PI);
  const sharedAspect = random(0.90, 1.10);
  const rotationDir  = random() < 0.5 ? -1 : 1;
  const baseAngle    = seedPhase + millis() * ROTATION_SPEED * rotationDir;

  const pair = buildPair(friend, view, sharedAspect);

  drawOnionAtRoot(pair.top,    cx, cy, baseAngle);
  drawOnionAtRoot(pair.bottom, cx, cy, baseAngle + PI);

  drawOnionLabel(cx, cy, baseAngle,      me.name || 'me',  pair.top);
  drawOnionLabel(cx, cy, baseAngle + PI, friend.name,      pair.bottom);
}

function drawAllViews() {
  const isMobile        = windowWidth <= 768;
  const reservedTop     = isMobile ? 80  : 60;
  const reservedBottom  = isMobile ? 220 : 90;
  const usableH         = max(windowHeight - reservedTop - reservedBottom, 200);
  const cellW           = isMobile ? windowWidth        : windowWidth / SUB_VIEWS.length;
  const cellH           = isMobile ? usableH / SUB_VIEWS.length : usableH;
  const tileSize        = min(cellW, cellH) * 0.72;

  const oldS = s;
  s = tileSize;

  for (let i = 0; i < SUB_VIEWS.length; i++) {
    const v  = SUB_VIEWS[i];
    const cx = isMobile ? cellW / 2 : (i + 0.5) * cellW;
    const cy = reservedTop + (isMobile ? (i + 0.5) * cellH : cellH / 2);
    drawTile(cx, cy, v);

    push();
    noStroke();
    fill(0, 0, 0, 110);
    textAlign(CENTER, CENTER);
    textFont('monospace');
    textStyle(NORMAL);
    textSize(max(s * 0.022, 11));
    text(v.toUpperCase(), cx, cy + tileSize * 0.46);
    pop();
  }

  s = oldS;
}

function drawOnionLabel(rootX, rootY, angle, label, onion) {
  if (labelOpacity < 1) return;

  push();
  translate(rootX, rootY);
  rotate(angle);

  noStroke();
  fill(0, 0, 0, labelOpacity);
  textAlign(CENTER, CENTER);
  textFont('monospace');
  textStyle(BOLD);
  textSize(max(s * 0.013, 10));
  text(label.toUpperCase(), 0, -s * onion.heightMul * 0.07);

  pop();
}

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
  const myMixed    = blendPalettes(friend.mine.palette,   friend.theirs.palette, PALETTE_BLEND);
  const theirMixed = blendPalettes(friend.theirs.palette, friend.mine.palette,   PALETTE_BLEND);
  return {
    top:    make({ rings, size: friend.mine.effort,   stroke: friend.mine.mutualKnowledge,   saturate: friend.mine.likeRelationship,   colors: myMixed }),
    bottom: make({ rings, size: friend.theirs.effort, stroke: friend.theirs.mutualKnowledge, saturate: friend.theirs.likeRelationship, colors: theirMixed }),
  };
}

const PALETTE_BLEND = 0.3;
function blendPalettes(myPal, theirPal, amount) {
  if (!myPal || myPal.length === 0)       return theirPal ?? ['#888888'];
  if (!theirPal || theirPal.length === 0) return myPal;
  return myPal.map((myHex, i) => {
    const theirHex = theirPal[i % theirPal.length];
    const c = lerpColor(color(myHex), color(theirHex), amount);
    return colorToHex(c);
  });
}

function buildOnion({ rings, size, stroke, saturate, colors, aspect }) {
  const base       = lerp(0.36, 0.55, size);
  const palette    = expandPalette(colors, rings);
  const ringScale  = min(1, 14 / rings);
  return {
    widthMul:  constrain(base * aspect, 0.26, 0.70),
    heightMul: constrain(base / aspect, 0.26, 0.50),
    thickness: lerp(0.5, 4.5, stroke) * ringScale,
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
  const friend  = friends[selectedFriendIdx];
  const sources = selectedView === 'insight'
    ? [...(me.self.palette ?? []), ...(friend.self.palette ?? [])]
    : [...(friend.mine.palette ?? []), ...(friend.theirs.palette ?? [])];
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
  buildFriendPicker();
  buildViewPicker();
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

  const overCanvas = mouseX >= 0 && mouseX <= windowWidth && mouseY >= 0 && mouseY <= windowHeight;
  const target = overCanvas ? 240 : 90;
  labelOpacity = lerp(labelOpacity, target, 0.12);

  if (selectedView === 'all') {
    drawAllViews();
  } else {
    drawTile(ox + s / 2, oy + s / 2, selectedView);
  }
}

let pressStart = null;
const SWIPE_THRESHOLD = 50;

function mousePressed() {
  pressStart = { x: mouseX, y: mouseY };
}

function mouseReleased() {
  if (!pressStart) return;
  const dx = mouseX - pressStart.x;
  const dy = mouseY - pressStart.y;
  const startedInsideTile = pressStart.x >= ox && pressStart.x <= ox + s && pressStart.y >= oy && pressStart.y <= oy + s;
  pressStart = null;

  if (max(abs(dx), abs(dy)) >= SWIPE_THRESHOLD) {
    if (abs(dx) > abs(dy)) cycleFriend(dx > 0 ? -1 : 1);
    else                   cycleView(dy > 0 ? -1 : 1);
    return;
  }
  if (startedInsideTile) seedOffset++;
}

function cycleFriend(delta) {
  selectedFriendIdx = (selectedFriendIdx + delta + friends.length) % friends.length;
  refreshPickers();
}

function cycleView(delta) {
  const idx = VIEWS.indexOf(selectedView);
  selectedView = VIEWS[(idx + delta + VIEWS.length) % VIEWS.length];
  refreshPickers();
}

function keyPressed() {
  if (keyCode === LEFT_ARROW)  { cycleFriend(-1); return false; }
  if (keyCode === RIGHT_ARROW) { cycleFriend(1);  return false; }
  if (keyCode === UP_ARROW)    { cycleView(-1);   return false; }
  if (keyCode === DOWN_ARROW)  { cycleView(1);    return false; }
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return abs(h);
}


// ================================================================
//  OVERLAY UI
// ================================================================

function buildFriendPicker() {
  const container = document.getElementById('friend-picker');
  container.replaceChildren();
  friends.forEach((f, i) => {
    const dot = document.createElement('div');
    dot.className = 'friend-dot' + (i === selectedFriendIdx ? ' active' : '');
    dot.style.background = paletteToConic(f.theirs?.palette ?? f.mine?.palette ?? f.self?.palette ?? ['#888']);
    dot.title = f.name;
    dot.onclick = () => {
      selectedFriendIdx = i;
      refreshPickers();
    };
    container.appendChild(dot);
  });
}

function buildViewPicker() {
  const container = document.getElementById('view-picker');
  container.replaceChildren();
  for (const v of VIEWS) {
    const tab = document.createElement('div');
    tab.className = 'view-tab' + (v === selectedView ? ' active' : '');
    tab.textContent = v;
    tab.onclick = () => {
      selectedView = v;
      refreshPickers();
    };
    container.appendChild(tab);
  }
}

function refreshPickers() {
  buildFriendPicker();
  buildViewPicker();
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
