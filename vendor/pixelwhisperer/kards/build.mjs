// build.mjs - PixelWhisperer Builds: a build is a recipe of cards for a job, and a combo is a build that does more than any of its
// parts alone. Drawn from the build's own record and nothing else, so the same build gives the same picture.
//
// Built by Kar for the PixelWhisperer repo. Powered by the Konomi architecture, created by Thomas Frumkin.
//
// A job is a business's task with a bar to clear (a raid boss is the first kind of job). A build names its kind (a kit, a party,
// a fusion, or a training run that makes a student card), its parts in their roles, and, once measured on cases none of its parts
// learned from, its own GATE. The published rule buildLift says what it adds: its GATE minus the best GATE among its parts. A
// build may be drawn as a combo only when that lift is above zero; one below zero is drawn as an ANTI-COMBO, because parts that
// make each other worse are a lesson too. Which builds are combos is the game's sealed rule (a margin, re-runs from distinct keys);
// the painter only refuses a combo the numbers cannot carry. Every build has a sigil, a rune grown from its recipe (its kind, and
// each part's role and id in order), and a combo has a name grown the same way from two fixed word tables (comboName), never
// typed: the same recipe always makes the same sigil and the same name. The first key to prove a combo is credited on its card by
// that key's face. A card the device does not hold is drawn as "?", never invented. paintJobs draws the job board: each job a note
// pinned up with its business's icon, its bar and how many builds cleared it. paintSheet draws a build sheet, a decklist wide
// enough to share, read from the game's own records as they are (a measured build's receipt and its proof): each part's
// Kardling, its own GATE and what it adds, the fielding parts first in the order of the build's name, the benched ones dimmed;
// the sigil grown from the build's id; and the numbers, refused when they do not add up. paintBook draws a page of the build
// book, read from the game's own book as it is: a job's proven combos ranked by lift, its anti-combos by drop, each with its
// small sigil, its finder's face and how many keys proved it. Integer arithmetic only, deterministic, total: bad input is
// { ok: false, why }, never a throw.
import { RARITIES, RAR, PIXEL, THEMES, DATASETS, ICON_ROWS, creatureFront } from './kardart.mjs';
import { GLYPHS, identicon } from './ui.mjs';

const { newCanvas, rect, dot, at, mul, mix, span, div, PAD } = PIXEL;
const no = (why) => ({ ok: false, why });
const HEX = '0123456789abcdef', TITLE = " &'.-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const isObj = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const isId = (s) => typeof s === 'string' && s.length === 16 && Array.from(s).every((c) => HEX.includes(c));
const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
/** The kinds of build, and the roles each takes its parts in. */
export const KINDS = Object.freeze(['kit', 'party', 'fusion', 'training']);
export const ROLES = Object.freeze({ kit: Object.freeze(['lead', 'node', 'tool', 'voice']), party: Object.freeze(['member']), fusion: Object.freeze(['parent']), training: Object.freeze(['data', 'teacher']) });
/** A training run's methods, and the sizes of the student card it makes. */
export const METHODS = Object.freeze(['distil', 'merge', 'tune']);
export const SIZES = Object.freeze(['tiny', 'small', 'base']);
/** The word tables a combo's name is grown from: an adjective and a noun, each picked by the recipe. */
export const COMBO_WORDS = Object.freeze({
  first: Object.freeze(['IRON', 'SILVER', 'GOLDEN', 'SWIFT', 'QUIET', 'BRIGHT', 'HOLLOW', 'ASHEN', 'AMBER', 'COBALT', 'CRIMSON', 'VELVET', 'STORM', 'FROST', 'EMBER', 'NEON', 'LUNAR', 'SOLAR', 'ARCANE', 'PRISM', 'RUNIC', 'SHADOW', 'STEEL', 'JADE', 'ONYX', 'COPPER', 'AZURE', 'SCARLET', 'TWIN', 'WILD', 'NOBLE', 'CLEVER']),
  second: Object.freeze(['WARDEN', 'ORACLE', 'ENGINE', 'CIRCUIT', 'LANTERN', 'COMPASS', 'ANCHOR', 'BEACON', 'CIPHER', 'FORGE', 'HARBOR', 'KESTREL', 'LOOM', 'MERIDIAN', 'NEXUS', 'ORBIT', 'PILOT', 'QUILL', 'RAVEN', 'SENTRY', 'TALON', 'VECTOR', 'WEAVER', 'ZENITH', 'ARROW', 'BRIDGE', 'CROWN', 'DRAKE', 'FALCON', 'GLYPH', 'HELM', 'SIGNAL']),
});
const TAG = { lead: 'LEAD', node: 'NODE', tool: 'TOOL', voice: 'VOX', member: 'ALLY', parent: 'PRNT', data: 'DATA', teacher: 'TCHR' };

function jobOf(job) {   // a job: { set, title?, bar }
  if (!isObj(job)) return no('the job must be an object');
  if (!DATASETS.includes(job.set)) return no('the job set must be one of ' + DATASETS.join(', '));
  const title = job.title === undefined ? '' : job.title;
  if (typeof title !== 'string' || title.length > 24 || !Array.from(title).every((ch) => TITLE.includes(ch))) return no('the job title must be at most 24 characters from A-Z a-z 0-9 space & . - and the apostrophe');
  if (!whole(job.bar, 1010000)) return no('the job bar must be a whole number of millionths from 0 to 1010000');
  return { ok: true, j: { set: job.set, title, bar: job.bar } };
}
function card(p, what) {   // a part or a student: { id, rarity? (none: not held here), gate? }
  if (!isObj(p)) return no(what + ' must be an object');
  if (!isId(p.id)) return no(what + ' id must be 16 lowercase hex characters');
  const held = p.rarity !== undefined, ri = RARITIES.indexOf(p.rarity);
  if (held && ri < 0) return no(what + ' rarity must be one of ' + RARITIES.join(', ') + ' (or none, for a card this device does not hold)');
  if (p.gate !== undefined && !whole(p.gate, 1000000)) return no(what + ' gate must be a whole number of millionths from 0 to 1000000');
  return { ok: true, c: { id: p.id, ri: held ? ri : null, gate: p.gate === undefined ? null : p.gate } };
}

/**
 * Check a build. build: { job: { set (DATASETS), title? (at most 24 of A-Z a-z 0-9 space & ' . -), bar (GATE in millionths, up to
 * 1010000) }, kind (KINDS), parts: [{ id, rarity?, role (ROLES[kind]), gate? }] (1 to 6, each card once), gate?: the build's GATE on
 * the job, held out, cases?: how many held-out cases it was measured on (1 to 999999, with gate), reruns?: distinct keys that
 * re-ran it (0 to 99999), combo?: true when the game's sealed rule makes it a combo (its lift must be above zero), finder?: the
 * Ed25519 public key (64 lowercase hex) of the first key to prove the combo, method? and student?: { id, rarity?, size (SIZES) }
 * (a training run's, and only a training run's), reveal?: true to draw COMBO FOUND (a combo's first showing) }. A kit has one lead; a fusion two parents; a party 2 to 6
 * members; a training run its method and its student, whose GATE is the build's. -> { ok: true, b } | { ok: false, why }
 */
export function checkBuild(x) {
  try {
    if (!isObj(x)) return no('the build must be an object');
    const { job, kind, parts, gate = null, cases = null, combo = false, finder = null, reruns = 0, method = null, student = null, reveal = false } = x;
    const J = jobOf(job);
    if (!J.ok) return J;
    if (!KINDS.includes(kind)) return no('kind must be kit, party, fusion or training');
    if (!Array.isArray(parts) || parts.length < 1 || parts.length > 6) return no('parts must be an array of 1 to 6');
    const ps = [];
    for (const p of parts) {
      const c = card(p, 'a part');
      if (!c.ok) return c;
      if (!ROLES[kind].includes(p.role)) return no('a ' + kind + ' takes parts in the roles ' + ROLES[kind].join(', '));
      if (ps.some((q) => q.id === c.c.id)) return no('a card is in a build once: ' + c.c.id);
      ps.push({ ...c.c, role: p.role });
    }
    const count = (role) => ps.filter((p) => p.role === role).length;
    if (kind === 'kit' && count('lead') !== 1) return no('a kit has one lead');
    if (kind === 'fusion' && ps.length !== 2) return no('a fusion has two parents');
    if (kind === 'party' && ps.length < 2) return no('a party has 2 to 6 members');
    if (gate !== null && !whole(gate, 1000000)) return no('the build gate must be a whole number of millionths from 0 to 1000000');
    if (!whole(reruns, 99999)) return no('reruns must be a whole number from 0 to 99999');
    let S = null;
    if (kind === 'training') {
      if (!METHODS.includes(method)) return no('a training run names its method: distil, merge or tune');
      const c = card(student, 'the student');
      if (!c.ok) return c;
      if (!SIZES.includes(student.size)) return no('the student size must be tiny, small or base');
      if (ps.some((p) => p.id === c.c.id)) return no('the student is a new card, not one of its sources');
      if (c.c.gate !== null) return no('the student gate is the build gate');
      S = { id: c.c.id, ri: c.c.ri, size: student.size };
    } else if (method !== null || student !== null) return no('method and student describe a training run');
    if (cases !== null && (!Number.isInteger(cases) || cases < 1 || cases > 999999)) return no('cases is how many held-out cases it was measured on: a whole number from 1 to 999999');
    if (cases !== null && gate === null) return no('cases count the cases a measured build was scored on');
    if (typeof combo !== 'boolean' || typeof reveal !== 'boolean') return no('combo and reveal must be true or false');
    const L = liftOf(gate, ps);
    if (combo && !(L.lift > 0)) return no('only a build that beats its best part is a combo');
    if (finder !== null && (!combo || typeof finder !== 'string' || finder.length !== 64 || !Array.from(finder).every((ch) => HEX.includes(ch)))) return no('the finder of a combo is its first prover\'s public key: 64 lowercase hex characters');
    if (reveal && !combo) return no('a reveal shows a combo');
    return { ok: true, b: { job: J.j, kind, parts: ps, gate, cases, combo, finder, reruns, method, student: S, reveal, ...L, name: combo ? nameOf(kind, ps) : null } };
  } catch (e) { return no('the build could not be read'); }
}

function liftOf(gate, ps) {   // the best GATE among the parts that carry one, and what the build adds to it
  const gates = ps.map((p) => p.gate).filter((g) => g !== null), best = gates.length ? Math.max(...gates) : null;
  return { best, lift: gate === null || best === null ? null : gate - best };
}

const recipeOf = (kind, ps) => kind + ':' + ps.map((p) => p.role + '=' + p.id).join(',');
function nameOf(kind, ps) {   // two words, each picked by the recipe from its table
  const [, , h] = mixer(recipeOf(kind, ps));
  return COMBO_WORDS.first[h & 31] + ' ' + COMBO_WORDS.second[(h >>> 5) & 31];
}
/** A combo's name, grown from its recipe as its sigil is (never typed): -> { ok: true, name } | { ok: false, why }. Any build has
 *  the name it would carry if it were a combo, so the game can show it once the sealed rule says so. */
export function comboName(x) {
  const c = checkBuild(x);
  return c.ok ? { ok: true, name: nameOf(c.b.kind, c.b.parts) } : c;
}

/** The published rule: what a build adds, its GATE minus the best GATE among its parts (null until both are known), and whether
 *  it clears its job's bar (null until measured). -> { ok: true, lift, best, gate, cleared } | { ok: false, why } */
export function buildLift(x) {
  const c = checkBuild(x);
  if (!c.ok) return c;
  const B = c.b;
  return { ok: true, lift: B.lift, best: B.best, gate: B.gate, cleared: B.gate === null ? null : B.gate >= B.job.bar };
}

function mixer(s) {   // three 32-bit words from a text, every character folded in
  let a = 0x9e3779b9, b = 0x7f4a7c15, c = 0x1b873593;
  for (const ch of Array.from(s)) { const v = ch.charCodeAt(0); a = Math.imul(a ^ v, 0x85ebca6b) >>> 0; b = Math.imul(b ^ a, 0xc2b2ae35) >>> 0; c = Math.imul(c ^ b ^ v, 0x27d4eb2f) >>> 0; }
  return [a, b, c];
}
const HUES = [0xff2bd6, 0x2be8ff, 0xffd23c, 0x7dff8a, 0xff7a3c, 0xa05ae6, 0x3c8cff, 0xff4a6a];
function sigilFrom(seed) {   // the 16 x 16 rune a text grows: the same 8-fold pattern in each eighth
  const [a, b, h] = mixer(seed);
  const ink = HUES[a & 7], accent = HUES[((a & 7) + 1 + ((a >>> 3) % 7)) & 7], G = new Uint8Array(18 * 18), cells = new Uint8Array(256);
  for (const q of span(0, 64)) {   // one eighth of the rune, read from the words, then mirrored into all eight (on a grid with a blank border)
    const i = q % 8, j = div(q, 8), lo = Math.min(i, j), hi = Math.max(i, j), bit = lo * 8 + hi - div(lo * (lo + 1), 2);   // 0..35 over the triangle
    const on = bit < 32 ? (b >>> bit) & 1 : (h >>> (bit - 32)) & 1, v = on ? 1 + ((h >>> (bit % 28)) & 1) : 0;
    for (const [x, y] of [[i, j], [15 - i, j], [i, 15 - j], [15 - i, 15 - j]]) G[(y + 1) * 18 + x + 1] = v;
  }
  for (const q of span(0, 256)) {   // each cell as grown, and an edge round the rune wherever an empty cell touches it
    const g = (q % 16 + 1) + (div(q, 16) + 1) * 18;
    cells[q] = G[g] || ([G[g - 1], G[g + 1], G[g - 18], G[g + 18]].some(Boolean) ? 3 : 0);
  }
  return { cells, colors: [ink, accent, mul(ink, 90)] };
}
/** A build's sigil: a 16 x 16 rune, the same 8-fold pattern in each eighth, grown from its recipe (kind, and each part's role and
 *  id in order). -> { ok: true, cells: Uint8Array(256) (0 none, 1 ink, 2 accent, 3 edge), colors: [ink, accent, edge] } | { ok: false, why } */
export function buildSigil(x) {
  const c = checkBuild(x);
  return c.ok ? { ok: true, ...sigilFrom(recipeOf(c.b.kind, c.b.parts)) } : c;
}

// how each theme dresses a build card: the field, the frame, the panel, the lettering (the pocket screen's shades come last)
const LOOKS = {
  'synthwave-v1': { field: [0x0a0420, 0x3a0d5e], frame: 0xb04ae0, panel: 0x120626, text: 0xffffff, shadow: 0x4a1480, dim: 0xbba9e8, wire: 0x2be8ff, good: 0x7dff8a, bad: 0xff5a5a },
  'blockcraft-v1': { field: [0x56a0fa, 0xc6e6ff], frame: 0x8a5a33, panel: 0x32323a, text: 0xffffff, shadow: 0x14141a, dim: 0xd8dce4, wire: 0x2be8ff, good: 0x7dff8a, bad: 0xff5a3c },
  'lcd-v1': { field: [0xd8dccf, 0x9aa095], frame: 0x0f1210, panel: 0x0f1210, text: 0xd8dccf, shadow: 0x0f1210, dim: 0x9aa095, wire: 0x0f1210, good: 0xd8dccf, bad: 0x9aa095, lcd: [0x0f1210, 0x4a5048, 0x9aa095, 0xd8dccf] },
  'memphis-v1': { field: [0xffe14a, 0xffe14a], frame: 0x111111, panel: 0x1b1740, text: 0xffffff, shadow: 0x111111, dim: 0xffe14a, wire: 0x111111, good: 0x7dff8a, bad: 0xff4fa3 },
  'blueprint-v1': { field: [0x0e3b78, 0x0e3b78], frame: 0x3468b0, panel: 0x061a38, text: 0xeef5ff, shadow: 0x061a38, dim: 0x9cc3f0, wire: 0x9cc3f0, good: 0x9cc3f0, bad: 0xeef5ff, ramp: [0x0e3b78, 0x3468b0, 0x9cc3f0, 0xeef5ff] },
};
const inked = (L, c) => (L.ramp ? L.ramp[(((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150 + (c & 255) * 29) >> 14] : c);
const GOLD = [0xffd23c, 0x8a6214];
const fmt = (n) => div(n, 1000000) + '.' + String(10000 + div(n % 1000000, 100)).slice(1);   // millionths as 0.0000
const LW = 192, LH = 280;

function letters(cv, s, x, y, c, sh, k = 1) {
  for (const [col, off] of [[sh, k], [c, 0]]) Array.from(s).forEach((ch, n) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => Array.from(row).forEach((cell, q) => { if (cell === '#') rect(cv, x + (n * 6 + q) * k + off, y + r * k + off, k, k, col); })));
}
const width = (s, k = 1) => (s.length * 6 - 1) * k;
const centred = (cv, s, cx, y, c, sh, k = 1) => letters(cv, s, cx - div(width(s, k), 2), y, c, sh, k);
const voxel = (fr, q) => (fr.px[q * 4] << 16) | (fr.px[q * 4 + 1] << 8) | fr.px[q * 4 + 2];

function kardling(cv, L, p, cx, foot, k) {   // a part on the platform: its Kardling at k px a voxel, or a dashed "?" for a card not held here
  const x0 = cx - div(9 * k, 2), y0 = foot - 14 * k;
  if (p.ri === null) {
    for (const q of span(0, 9 * k, 2)) { dot(cv, x0 + q, y0, L.dim); dot(cv, x0 + q, foot - 1, L.dim); }
    for (const q of span(0, 14 * k, 2)) { dot(cv, x0, y0 + q, L.dim); dot(cv, x0 + 9 * k - 1, y0 + q, L.dim); }
    centred(cv, '?', cx, y0 + div(14 * k, 2) - 4, L.text, L.shadow);
    return;
  }
  const fr = creatureFront(p.id);
  rect(cv, x0 - 1, foot, 9 * k + 2, 2, RAR[p.ri].hi);   // its rarity, as the ground it stands on
  for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) rect(cv, x0 + (q % 9) * k, y0 + div(q, 9) * k, k, k, inked(L, voxel(fr, q)));
}

/**
 * Draw a build card. build as checkBuild takes it; themeId one of THEMES; w, h whole numbers from 64 to 1024 (a Kardlings card:
 * 384 x 560). The card is 192 x 280 logical pixels, scaled to the nearest pixel. -> { ok: true, px } | { ok: false, why }. Never throws.
 */
export function paintBuild(build, themeId, w, h) {
  try {
    const c = checkBuild(build);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 64 || h < 64 || w > 1024 || h > 1024) return no('width and height must be whole numbers from 64 to 1024');
    const B = c.b, L = LOOKS[themeId], cv = newCanvas(LW, LH), frame = B.combo ? GOLD[0] : L.frame;
    for (const y of span(0, LH)) rect(cv, 0, y, LW, 1, mix(L.field[0], L.field[1], div(y * 256, LH)));
    for (const i of span(0, 3)) { rect(cv, i, i, LW - 2 * i, 1, frame); rect(cv, i, LH - 1 - i, LW - 2 * i, 1, frame); rect(cv, i, i, 1, LH - 2 * i, frame); rect(cv, LW - 1 - i, i, 1, LH - 2 * i, frame); }

    // the sigil, in its medallion; a reveal sets it in rays of gold
    const S = buildSigil(build), cx = 96, cy = 66;
    if (B.reveal) for (const t of span(0, 16)) { const dx = [0, 2, 4, 6, 8, 6, 4, 2, 0, -2, -4, -6, -8, -6, -4, -2][t], dy = [-8, -6, -4, -2, 0, 2, 4, 6, 8, 6, 4, 2, 0, -2, -4, -6][t]; for (const s of span(4, 8)) rect(cv, cx + dx * s, cy + dy * s, 2, 2, GOLD[t % 2]); }
    rect(cv, cx - 28, cy - 28, 56, 56, frame); rect(cv, cx - 26, cy - 26, 52, 52, L.panel);

    ICON_ROWS[B.job.set].forEach((row, y) => Array.from(row).forEach((cell, x) => { if (cell === '#') rect(cv, 14 + x * 2, 50 + y * 2, 2, 2, L.dim); }));   // the job's business, beside the sigil

    // the head, on its own band of the field (the rays shine round the medallion, not through the lettering): the kind, the job
    for (const y of span(3, 35)) rect(cv, 3, y, LW - 6, 1, mix(L.field[0], L.field[1], div(y * 256, LH)));
    centred(cv, B.reveal ? 'COMBO FOUND' : B.kind.toUpperCase() + ' BUILD', 96, 7, B.reveal ? GOLD[0] : L.text, L.shadow, 2);
    centred(cv, (B.job.title || B.job.set).toUpperCase(), 96, 25, L.dim, L.shadow);
    for (const q of span(0, 256)) if (S.cells[q]) rect(cv, cx - 24 + (q % 16) * 3, cy - 24 + div(q, 16) * 3, 3, 3, inked(L, S.colors[S.cells[q] - 1]));

    // the parts on one platform, joined by a wire, each with its role; a training run's sources make the student on the right
    const foot = 152, src = B.parts, n = src.length, span1 = B.kind === 'training' ? 112 : 176, gap = div(span1, n), k = n > 4 ? 2 : 3;
    rect(cv, 8, foot + 2, B.kind === 'training' ? span1 : LW - 16, 3, mul(L.frame, 140));
    const xs = src.map((p, j) => 8 + gap * j + div(gap, 2));
    rect(cv, xs[0], foot - 14 * k - 4, xs[n - 1] - xs[0] + 1, 1, L.wire);
    src.forEach((p, j) => {
      rect(cv, xs[j], foot - 14 * k - 4, 1, 4, L.wire);
      kardling(cv, L, p, xs[j], foot, k);
      centred(cv, TAG[p.role], xs[j], foot + 7, L.dim, L.shadow);
    });
    if (B.kind === 'training') {
      centred(cv, '\u2192', 130, foot - 24, GOLD[0], L.shadow, 2);
      centred(cv, B.method.toUpperCase(), 128, foot + 7, L.dim, L.shadow);
      kardling(cv, L, B.student, 166, foot, 3);
      centred(cv, B.student.size.toUpperCase(), 166, foot + 7, L.text, L.shadow);
    }

    // the numbers: what it adds, against what, the bar, and how many keys re-ran it
    const y0 = 172;
    rect(cv, 8, y0, LW - 16, 74, L.panel);
    const lift = B.lift, liftText = lift === null ? (B.gate === null ? 'NOT MEASURED' : 'LIFT -') : 'LIFT ' + (lift < 0 ? '-' : '+') + fmt(Math.abs(lift));
    centred(cv, liftText, 96, y0 + 5, lift === null ? L.dim : lift > 0 ? L.good : lift < 0 ? L.bad : L.text, L.shadow, 2);
    if (B.gate !== null) centred(cv, 'BUILD ' + fmt(B.gate) + (B.best === null ? '' : ' \u00b7 BEST ' + fmt(B.best)), 96, y0 + 24, L.text, L.shadow);
    const cleared = B.gate !== null && B.gate >= B.job.bar;
    centred(cv, 'BAR ' + fmt(B.job.bar) + (B.gate === null ? '' : cleared ? ' \u2713 CLEARED' : ' \u2717 SHORT'), 96, y0 + 35, B.gate === null ? L.dim : cleared ? L.good : L.bad, L.shadow);
    if (B.cases !== null) centred(cv, 'ON ' + B.cases + ' HELD-OUT CASES', 96, y0 + 46, L.dim, L.shadow);
    centred(cv, 'RE-RUN BY ' + B.reruns + (B.reruns === 1 ? ' KEY' : ' KEYS'), 96, y0 + 57, L.dim, L.shadow);

    // its name, as a combo, with its finder's face; or the lesson of an anti-combo
    if (B.combo) {
      rect(cv, 6, 252, LW - 12, 18, GOLD[0]); rect(cv, 6, 252, LW - 12, 1, 0xffffff); rect(cv, 6, 269, LW - 12, 1, GOLD[1]);
      centred(cv, 'COMBO \u00b7 ' + B.name, B.finder ? 102 : 96, 257, 0xffffff, GOLD[1]);
      if (B.finder) { const f = identicon(B.finder, 1); for (const q of span(0, 100)) dot(cv, 11 + (q % 10), 256 + div(q, 10), inked(L, (f.px[q * 3] << 16) | (f.px[q * 3 + 1] << 8) | f.px[q * 3 + 2])); }
    }
    else if (lift !== null && lift < 0) { rect(cv, 6, 252, LW - 12, 18, 0x7a1020); centred(cv, 'ANTI-COMBO', 96, 257, 0xffd0d0, 0x3a0810); }

    if (L.lcd) for (const y of span(0, LH)) for (const x of span(0, LW)) {   // the pocket screen: every pixel one of its four shades
      const q = at(cv, x, y);
      dot(cv, x, y, L.lcd[(((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 14]);
    }
    const px = new Uint8Array(w * h * 3), cols = span(0, w).map((x) => div(x * LW, w));
    span(0, h).forEach((y) => {
      const row = (div(y * LH, h) + PAD) * cv.cw + PAD;
      cols.forEach((cxx, x) => { const q = cv.d[row + cxx], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
    });
    return { ok: true, px };
  } catch (e) { return no('the build could not be painted'); }
}

/**
 * Check a job board. board: { jobs: [{ set (DATASETS), title? (as a job's), bar, cleared: true | false, builds: how many builds
 * cleared it (0 to 99999) }] (1 to 9) }. -> { ok: true, jobs } | { ok: false, why }
 */
export function checkJobs(x) {
  try {
    if (!isObj(x) || !Array.isArray(x.jobs) || x.jobs.length < 1 || x.jobs.length > 9) return no('the board holds 1 to 9 jobs: { jobs: [...] }');
    const out = [];
    for (const j of x.jobs) {
      if (!isObj(j)) return no('every job must be an object');
      const c = jobOf(j);
      if (!c.ok) return c;
      if (typeof j.cleared !== 'boolean') return no('a job cleared is true or false');
      if (!whole(j.builds, 99999)) return no('a job builds is a whole number from 0 to 99999');
      if (j.cleared !== j.builds > 0) return no('a job is cleared exactly when a build has cleared it');
      out.push({ ...c.j, cleared: j.cleared, builds: j.builds });
    }
    return { ok: true, jobs: out };
  } catch (e) { return no('the board could not be read'); }
}

/**
 * Draw the job board: each job a note pinned up, with its business's icon, its name, its bar and how many builds cleared it, a
 * cleared one stamped. board as checkJobs takes it; themeId; w, h whole numbers from 64 to 2048. The board is 240 x 160 logical
 * pixels at the largest whole scale that fits, centred, the space round it the board's own. -> { ok: true, px, scale } | { ok: false, why }
 */
export function paintJobs(board, themeId, w, h) {
  try {
    const c = checkJobs(board);
    if (!c.ok) return c;
    if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return no('unknown theme');
    if (!whole(w, 2048) || !whole(h, 2048) || w < 64 || h < 64) return no('width and height must be whole numbers from 64 to 2048');
    const L = LOOKS[themeId], cv = newCanvas(240, 160), wood = mul(L.frame, 170), cork = mix(L.panel, 0xb07a40, 140);
    rect(cv, 0, 0, 240, 160, mul(wood, 120)); rect(cv, 1, 1, 238, 158, wood); rect(cv, 4, 16, 232, 140, cork);
    centred(cv, 'THE JOB BOARD', 120, 4, L.text, L.shadow);
    c.jobs.forEach((j, m) => {   // three to a row: a note 72 x 42, pinned at its top
      const x0 = 8 + (m % 3) * 76, y0 = 20 + div(m, 3) * 46, paper = j.cleared ? 0xf4e8c0 : 0xfff8e0, ink = 0x2a2018;
      rect(cv, x0 + 2, y0 + 2, 72, 42, mul(cork, 150)); rect(cv, x0, y0, 72, 42, paper);
      rect(cv, x0 + 34, y0 - 1, 4, 4, 0xdc3c32); dot(cv, x0 + 35, y0, 0xff8080);   // the pin
      ICON_ROWS[j.set].forEach((row, y) => Array.from(row).forEach((cell, x) => { if (cell === '#') dot(cv, x0 + 3 + x, y0 + 4 + y, ink); }));   // its business, top left
      const name = (j.title || j.set).toUpperCase(), short = name.length > 8 ? name.slice(0, 7) + '\u2026' : name;
      letters(cv, short, x0 + 22, y0 + 8, ink, paper);
      letters(cv, 'BAR ' + fmt(j.bar), x0 + 3, y0 + 22, ink, paper);
      letters(cv, j.builds + (j.builds === 1 ? ' BUILD' : ' BUILDS'), x0 + 3, y0 + 32, mul(ink, 200), paper);
      if (j.cleared) { rect(cv, x0 + 58, y0 + 30, 12, 10, 0x2a9d4a); centred(cv, '\u2713', x0 + 64, y0 + 31, 0xffffff, 0x1a6f3a); }
    });
    if (L.ramp) for (const y of span(0, 160)) for (const x of span(0, 240)) dot(cv, x, y, inked(L, at(cv, x, y)));
    if (L.lcd) for (const y of span(0, 160)) for (const x of span(0, 240)) { const q = at(cv, x, y); dot(cv, x, y, L.lcd[(((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 14]); }
    const k = Math.max(1, Math.min(div(w, 240), div(h, 160))), ox = div(w - 240 * k, 2), oy = div(h - 160 * k, 2), px = new Uint8Array(w * h * 3), edge = at(cv, 1, 1);
    span(0, h).forEach((y) => span(0, w).forEach((x) => {   // the board in the middle, its outline round it; beyond, the wall in its wood
      const lx = div(x - ox, k), ly = div(y - oy, k), q = lx >= 0 && ly >= 0 && lx < 240 && ly < 160 ? cv.d[(ly + PAD) * cv.cw + lx + PAD] : edge, o = (y * w + x) * 3;
      px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255;
    }));
    return { ok: true, px, scale: k };
  } catch (e) { return no('the board could not be painted'); }
}

// -- the build sheet: a measured build's receipt as a decklist, wide enough to share -----------------------------------------
const SW = 400, SH = 210, VERDICTS = ['combo', 'anti', 'plain'], TIMES = ' \u00d7 ';
const isKey = (s) => typeof s === 'string' && s.length === 64 && Array.from(s).every((ch) => HEX.includes(ch));
const signed = (n) => (n < 0 ? '-' : '+') + fmt(Math.abs(n));
function shareBad(themeId, w, h) {   // why a share picture cannot be drawn in this theme at this size, or null
  if (typeof themeId !== 'string' || !Object.prototype.hasOwnProperty.call(THEMES, themeId)) return 'unknown theme';
  if (!whole(w, 2400) || !whole(h, 2400) || w < 100 || h < 100) return 'width and height must be whole numbers from 100 to 2400';
  return null;
}
function shareFrame(cv, L, hue) {   // a share picture's field, and its frame in the hue of its news
  for (const y of span(0, SH)) rect(cv, 0, y, SW, 1, mix(L.field[0], L.field[1], div(y * 256, SH)));
  for (const i of span(0, 3)) { rect(cv, i, i, SW - 2 * i, 1, hue); rect(cv, i, SH - 1 - i, SW - 2 * i, 1, hue); rect(cv, i, i, 1, SH - 2 * i, hue); rect(cv, SW - 1 - i, i, 1, SH - 2 * i, hue); }
}
function shareOut(cv, L, w, h) {   // a share picture done: the pocket screen's four shades, then scaled to the nearest pixel
  if (L.lcd) for (const y of span(0, SH)) for (const x of span(0, SW)) { const q = at(cv, x, y); dot(cv, x, y, L.lcd[(((q >> 16) & 255) * 77 + ((q >> 8) & 255) * 150 + (q & 255) * 29) >> 14]); }
  const px = new Uint8Array(w * h * 3), cols = span(0, w).map((x) => div(x * SW, w));
  span(0, h).forEach((y) => {
    const row = (div(y * SH, h) + PAD) * cv.cw + PAD;
    cols.forEach((cx, x) => { const q = cv.d[row + cx], o = (y * w + x) * 3; px[o] = q >> 16; px[o + 1] = (q >> 8) & 255; px[o + 2] = q & 255; });
  });
  return px;
}

/**
 * Check a build sheet, read from the game's own records as they are. sheet: { job: { set, title?, bar } (as a build's),
 * receipt: a measured build's receipt { build: its id (64 lowercase hex), data: its ground (named for the job's business, before
 * any colon), parts: [{ card (16 lowercase hex), title (as a card's), joined (true when it fields), alone: its own GATE out of
 * fold, contribution: what the build loses without it (both whole millionths when it fields, both null when it is benched) }]
 * (2 to 6, each card once: a build is at most six cards, benched ones too), fielded: how many field, gate, best: the highest alone among them, lift: gate less best, n: the
 * held-out cases, verdict: 'combo' | 'anti' | 'plain' (the game's sealed rule), name: the fielding titles joined by " \u00d7 " },
 * proof?: { proven, keys: [public keys, 64 lowercase hex, each once] (up to 999), finder: the first key, or null },
 * held?: [the card ids this device holds] (up to 999) }. Fields of the records the sheet does not draw are left unread.
 * -> { ok: true, s } | { ok: false, why }
 */
export function checkSheet(x) {
  try {
    if (!isObj(x)) return no('the sheet must be an object');
    const J = jobOf(x.job);
    if (!J.ok) return J;
    const r = x.receipt;
    if (!isObj(r)) return no('the receipt must be an object');
    if (!isKey(r.build)) return no('the receipt build is the build id: 64 lowercase hex characters');
    if (typeof r.data !== 'string' || r.data.split(':')[0] !== J.j.set) return no('the receipt is for another business than the job: its data must name ' + J.j.set);
    if (!Array.isArray(r.parts) || r.parts.length < 2 || r.parts.length > 6) return no('a receipt has 2 to 6 parts');
    const ps = [], seen = new Set();
    for (const p of r.parts) {
      if (!isObj(p) || !isId(p.card)) return no('every part is a card: 16 lowercase hex characters');
      if (seen.has(p.card)) return no('the same card is in the build twice');
      seen.add(p.card);
      if (typeof p.title !== 'string' || p.title.length < 1 || p.title.length > 24 || !Array.from(p.title).every((ch) => TITLE.includes(ch))) return no('a part title is 1 to 24 characters from A-Z a-z 0-9 space & . - and the apostrophe');
      if (typeof p.joined !== 'boolean') return no('a part joined is true or false');
      if (p.joined ? !whole(p.alone, 1000000) || !Number.isInteger(p.contribution) || !whole(p.contribution + 1000000, 2000000) : p.alone !== null || p.contribution !== null) return no('a part that fields has its alone GATE and its contribution in whole millionths; a benched one has null for both');
      ps.push({ card: p.card, title: p.title, joined: p.joined, alone: p.alone, contribution: p.contribution });
    }
    const fielded = ps.filter((p) => p.joined);
    if (r.fielded !== fielded.length || !fielded.length) return no('fielded counts the parts that field, at least one');
    if (!whole(r.gate, 1000000) || !whole(r.best, 1000000)) return no('the receipt gate and best are whole millionths from 0 to 1000000');
    if (r.best !== Math.max(...fielded.map((p) => p.alone))) return no('best is the highest alone GATE among the parts that field');
    if (r.lift !== r.gate - r.best) return no('lift is the gate less the best');
    if (!whole(r.n, 999999) || r.n < 1) return no('n is how many held-out cases: a whole number from 1 to 999999');
    if (!VERDICTS.includes(r.verdict)) return no('the verdict is combo, anti or plain');
    if (r.verdict === 'combo' && !(fielded.length > 1 && r.lift > 0)) return no('a combo has two or more parts fielding and a lift above zero');
    if (r.verdict === 'anti' && !(fielded.length > 1 && r.lift < 0)) return no('an anti-combo has two or more parts fielding and a lift below zero');
    const words = typeof r.name === 'string' ? r.name.split(TIMES) : [], left = fielded.slice(), order = [];
    for (const word of words) { const k = left.findIndex((p) => p.title === word); if (k < 0) break; order.push(left.splice(k, 1)[0]); }
    if (left.length || order.length !== words.length) return no('the name is the fielding parts\' titles, each once, joined by " \u00d7 "');
    let proof = null;
    if (x.proof !== undefined) {
      const f = x.proof;
      if (!isObj(f) || typeof f.proven !== 'boolean' || !Array.isArray(f.keys) || f.keys.length > 999) return no('the proof is { proven, keys: [up to 999 public keys], finder }');
      if (!f.keys.every(isKey) || new Set(f.keys).size !== f.keys.length) return no('the proof keys are public keys, 64 lowercase hex each, each once');
      if (f.finder !== (f.keys.length ? f.keys[0] : null)) return no('the finder is the first key, or null before any');
      if (f.proven && !f.keys.length) return no('a proof proven by no key is not one');
      if (f.verdict !== undefined && f.verdict !== r.verdict) return no('the proof is of another verdict');
      proof = { proven: f.proven, keys: f.keys.length, finder: f.finder };
    }
    let held = null;
    if (x.held !== undefined) {
      if (!Array.isArray(x.held) || x.held.length > 999 || !x.held.every(isId)) return no('held lists the card ids this device holds, up to 999');
      held = new Set(x.held);
    }
    const rows = order.concat(ps.filter((p) => !p.joined)).map((p) => ({ ...p, held: held === null ? null : held.has(p.card) }));
    return { ok: true, s: { job: J.j, build: r.build, rows, fielded: fielded.length, gate: r.gate, best: r.best, lift: r.lift, n: r.n, verdict: r.verdict, proof } };
  } catch (e) { return no('the sheet could not be read'); }
}

/**
 * Draw a build sheet: the sigil grown from the build's id, its verdict, its job and bar; each part a row (its Kardling, its
 * title, its own GATE and what it adds; the fielding parts first, in the name's order, the benched ones dimmed, and a ? by a
 * card this device does not hold); and its numbers: the lift, the GATE against the best part's, the bar, the held-out cases,
 * the keys that re-ran it and the finder's face. sheet as checkSheet takes it; themeId; w, h whole numbers from 100 to 2400
 * (a share picture: 1200 x 630). The sheet is 400 x 210 logical pixels, scaled to the nearest pixel.
 * -> { ok: true, px } | { ok: false, why }. Never throws.
 */
export function paintSheet(sheet, themeId, w, h) {
  try {
    const c = checkSheet(sheet);
    if (!c.ok) return c;
    const bad = shareBad(themeId, w, h);
    if (bad !== null) return no(bad);
    const S = c.s, L = LOOKS[themeId], cv = newCanvas(SW, SH), hue = S.verdict === 'combo' ? GOLD[0] : S.verdict === 'anti' ? 0xc0283c : L.frame;
    shareFrame(cv, L, hue);

    // the head: the sigil, the verdict, the job and its bar, and the job's business
    const G = sigilFrom(S.build);
    rect(cv, 8, 6, 52, 52, hue); rect(cv, 10, 8, 48, 48, L.panel); rect(cv, 64, 6, 330, 52, L.panel);
    for (const q of span(0, 256)) if (G.cells[q]) rect(cv, 10 + (q % 16) * 3, 8 + div(q, 16) * 3, 3, 3, inked(L, G.colors[G.cells[q] - 1]));
    letters(cv, 'BUILD SHEET', 68, 8, L.dim, L.shadow);
    letters(cv, S.verdict === 'combo' ? 'COMBO' : S.verdict === 'anti' ? 'ANTI-COMBO' : 'PLAIN BUILD', 68, 20, S.verdict === 'combo' ? GOLD[0] : S.verdict === 'anti' ? L.bad : L.text, L.shadow, 2);
    letters(cv, 'FOR ' + (S.job.title || S.job.set).toUpperCase() + ' \u00b7 BAR ' + fmt(S.job.bar), 68, 44, L.text, L.shadow);
    ICON_ROWS[S.job.set].forEach((row, y) => Array.from(row).forEach((cell, x) => { if (cell === '#') rect(cv, 358 + x * 2, 10 + y * 2, 2, 2, L.dim); }));

    // the parts, a row each: the order it fields in, its Kardling, its title, its own GATE, what the build loses without it
    rect(cv, 6, 60, 283, 136, L.panel);
    letters(cv, 'TITLE', 34, 63, L.dim, L.shadow); letters(cv, 'ALONE', 180, 63, L.dim, L.shadow); letters(cv, 'ADDS', 220, 63, L.dim, L.shadow);
    if (S.rows[0].held !== null) letters(cv, 'HELD', 265, 63, L.dim, L.shadow);
    S.rows.forEach((p, m) => {
      const y = 74 + m * 20, ink = p.joined ? L.text : L.dim, fr = creatureFront(p.card);
      letters(cv, p.joined ? String(m + 1) : '-', 10, y + 3, ink, L.shadow);
      for (const q of span(0, 126)) if (fr.px[q * 4 + 3]) dot(cv, 20 + (q % 9), y + div(q, 9), p.joined ? inked(L, voxel(fr, q)) : mix(inked(L, voxel(fr, q)), L.panel, 150));
      letters(cv, p.title, 34, y + 3, ink, L.shadow);
      if (p.joined) {
        letters(cv, fmt(p.alone), 180, y + 3, L.text, L.shadow);
        letters(cv, signed(p.contribution), 220, y + 3, p.contribution > 0 ? L.good : p.contribution < 0 ? L.bad : L.text, L.shadow);
      } else letters(cv, 'BENCHED', 180, y + 3, L.dim, L.shadow);
      if (p.held !== null) centred(cv, p.held ? '\u2713' : '?', 276, y + 3, p.held ? L.good : L.bad, L.shadow);
    });

    // the numbers: what it adds over its best part, the bar, the cases it was measured on, and who re-ran it
    rect(cv, 292, 60, 102, 136, L.panel);
    centred(cv, 'LIFT', 343, 62, L.dim, L.shadow);
    centred(cv, signed(S.lift), 343, 72, S.lift > 0 ? L.good : S.lift < 0 ? L.bad : L.text, L.shadow, 2);
    centred(cv, 'GATE ' + fmt(S.gate), 343, 94, L.text, L.shadow);
    centred(cv, 'BEST ' + fmt(S.best), 343, 105, L.dim, L.shadow);
    const clears = S.gate >= S.job.bar;
    centred(cv, clears ? '\u2713 CLEARS THE BAR' : '\u2717 UNDER THE BAR', 343, 116, clears ? L.good : L.bad, L.shadow);
    centred(cv, 'HELD-OUT CASES', 343, 128, L.dim, L.shadow);
    centred(cv, String(S.n), 343, 138, L.text, L.shadow);
    const P = S.proof;
    if (P === null || !P.keys) centred(cv, 'NOT YET RE-RUN', 343, 150, L.dim, L.shadow);
    else {
      centred(cv, P.proven ? 'PROVEN BY' : 'RE-RUN BY', 343, 150, L.dim, L.shadow);
      centred(cv, P.keys + (P.keys === 1 ? ' KEY' : ' KEYS'), 343, 160, P.proven ? L.good : L.text, L.shadow);
      centred(cv, P.proven ? 'FOUND BY' : 'FIRST KEY', 343, 172, L.dim, L.shadow);
      const f = identicon(P.finder, 1);
      for (const q of span(0, 100)) dot(cv, 310 + (q % 10), 181 + div(q, 10), inked(L, (f.px[q * 3] << 16) | (f.px[q * 3 + 1] << 8) | f.px[q * 3 + 2]));
      letters(cv, P.finder.slice(0, 4) + '\u2026' + P.finder.slice(60), 323, 182, L.text, L.shadow);
    }

    // the foot: the build's id, to look it up and re-run it, and how much of it this device holds
    rect(cv, 6, 197, 388, 10, L.panel);
    letters(cv, 'BUILD ' + S.build.slice(0, 16), 8, 198, L.dim, L.shadow);
    if (S.rows[0].held !== null) { const n = S.rows.filter((p) => p.held).length, s = 'YOU HOLD ' + n + ' OF ' + S.rows.length; letters(cv, s, 392 - width(s), 198, n === S.rows.length ? L.good : L.text, L.shadow); }

    return { ok: true, px: shareOut(cv, L, w, h) };
  } catch (e) { return no('the sheet could not be painted'); }
}

// -- the build book: a job's proven builds, ranked, read from the game's own book --------------------------------------------
const BOOK_ROWS = 6;

function rowOf(r, combo) {   // a row of the book: { id, build, name, gate, best, lift, fielded, finder, keys }
  if (!isObj(r) || !isKey(r.id) || !isKey(r.build)) return no('every row has its receipt id and its build id, 64 lowercase hex each');
  const words = typeof r.name === 'string' ? r.name.split(TIMES) : [];
  if (!Number.isInteger(r.fielded) || r.fielded < 2 || r.fielded > 6 || words.length !== r.fielded || !words.every((t) => t.length > 0 && t.length < 25 && Array.from(t).every((ch) => TITLE.includes(ch)))) return no('a row is named by its 2 to 6 fielding parts, their titles joined by " \u00d7 "');
  if (!whole(r.gate, 1000000) || !whole(r.best, 1000000) || r.lift !== r.gate - r.best) return no('a row has its gate and best in whole millionths, and its lift is the gate less the best');
  if (combo ? !(r.lift > 0) : !(r.lift < 0)) return no(combo ? 'a combo lifts its build above its best part' : 'an anti-combo drops its build below its best part');
  if (!isKey(r.finder) || !whole(r.keys, 99999) || r.keys < 1) return no('a row has its finder (a public key) and how many keys proved it, 1 to 99999');
  return { ok: true, r: { id: r.id, build: r.build, name: r.name, gate: r.gate, lift: r.lift, finder: r.finder, keys: r.keys, combo } };
}
const ranked = (list, sign) => list.every((r, k) => k === 0 || sign * (list[k - 1].lift - r.lift) > 0 || (list[k - 1].lift === r.lift && list[k - 1].build < r.build));

/**
 * Check a page of the build book, read from the game's own book as it is. book: { job: { set, title?, bar } (as a build's), page:
 * the game's book for one ground { combos: [rows], anti: [rows] (up to 9999 each), plain: how many proven builds were plain,
 * best: the best proven GATE, or null when nothing is proven }, each row { id: its receipt, build: its build id (64 lowercase hex
 * each), name: its fielding parts' titles joined by " \u00d7 ", gate, best, lift (gate less best: above zero for a combo, below for an
 * anti-combo), fielded (2 to 6), finder: the first key to prove it, keys: how many proved it } }. The combos go biggest lift first,
 * the anti-combos biggest drop first, a tie to the lower build id; each receipt once. -> { ok: true, b } | { ok: false, why }
 */
export function checkBook(x) {
  try {
    if (!isObj(x)) return no('the book must be an object');
    const J = jobOf(x.job);
    if (!J.ok) return J;
    const p = x.page;
    if (!isObj(p) || !Array.isArray(p.combos) || !Array.isArray(p.anti) || p.combos.length > 9999 || p.anti.length > 9999) return no('a page of the book is { combos, anti, plain, best }, up to 9999 rows of each');
    if (!whole(p.plain, 99999)) return no('plain counts the proven builds that are plain: a whole number from 0 to 99999');
    const combos = [], anti = [];
    for (const r of p.combos) { const c = rowOf(r, true); if (!c.ok) return c; combos.push(c.r); }
    for (const r of p.anti) { const c = rowOf(r, false); if (!c.ok) return c; anti.push(c.r); }
    const rows = combos.concat(anti);
    if (new Set(rows.map((r) => r.id)).size !== rows.length) return no('a receipt is in the book once');
    if (!ranked(combos, 1)) return no('the combos go biggest lift first, a tie to the lower build id');
    if (!ranked(anti, -1)) return no('the anti-combos go biggest drop first, a tie to the lower build id');
    if (rows.length + p.plain > 0 ? !whole(p.best, 1000000) || rows.some((r) => r.gate > p.best) : p.best !== null) return no('best is the best proven GATE on the page, at least every row\'s, or null when nothing is proven');
    return { ok: true, b: { job: J.j, combos, anti, plain: p.plain, best: p.best } };
  } catch (e) { return no('the book could not be read'); }
}

/**
 * Draw a page of the build book: the job's business, the job, its bar and the best proven against it; then the proven builds,
 * a row each (its rank, a small sigil grown from its build id, its name, its GATE, its lift, its finder's face and how many keys
 * proved it), the combos first and the anti-combos after, up to six rows and a count of the rest; and a tally. book as checkBook
 * takes it; themeId; w, h whole numbers from 100 to 2400 (a share picture: 1200 x 630). The page is 400 x 210 logical pixels,
 * scaled to the nearest pixel. -> { ok: true, px } | { ok: false, why }. Never throws.
 */
export function paintBook(book, themeId, w, h) {
  try {
    const c = checkBook(book);
    if (!c.ok) return c;
    const bad = shareBad(themeId, w, h);
    if (bad !== null) return no(bad);
    const B = c.b, L = LOOKS[themeId], cv = newCanvas(SW, SH), done = B.best !== null && B.best >= B.job.bar, hue = done ? GOLD[0] : L.frame;
    shareFrame(cv, L, hue);

    // the head: the job's business in the medallion, the job, its bar, and the best proven against it
    rect(cv, 8, 6, 52, 52, hue); rect(cv, 10, 8, 48, 48, L.panel); rect(cv, 64, 6, 330, 52, L.panel);
    ICON_ROWS[B.job.set].forEach((row, y) => Array.from(row).forEach((cell, x) => { if (cell === '#') rect(cv, 10 + x * 3, 8 + y * 3, 3, 3, L.text); }));
    letters(cv, 'BUILD BOOK', 68, 8, L.dim, L.shadow);
    letters(cv, (B.job.title || B.job.set).toUpperCase(), 68, 20, L.text, L.shadow, 2);
    letters(cv, 'BAR ' + fmt(B.job.bar) + ' \u00b7 ' + (B.best === null ? 'NOTHING PROVEN YET' : 'BEST ' + fmt(B.best) + (done ? ' \u2713 CLEARED' : ' \u00b7 ' + fmt(B.job.bar - B.best) + ' TO GO')), 68, 44, done ? L.good : L.text, L.shadow);

    // the proven builds: the combos by lift, then the anti-combos by drop
    rect(cv, 6, 60, 388, 136, L.panel);
    letters(cv, '#', 10, 63, L.dim, L.shadow); letters(cv, 'BUILD', 44, 63, L.dim, L.shadow); letters(cv, 'GATE', 252, 63, L.dim, L.shadow);
    letters(cv, 'LIFT', 292, 63, L.dim, L.shadow); letters(cv, 'BY', 338, 63, L.dim, L.shadow); letters(cv, 'KEYS', 356, 63, L.dim, L.shadow);
    const all = B.combos.concat(B.anti), shown = all.slice(0, BOOK_ROWS);
    shown.forEach((r, m) => {
      const y = 74 + m * 18, G = sigilFrom(r.build), f = identicon(r.finder, 1);
      letters(cv, r.combo ? String(m + 1) : '\u2717', 10, y + 4, r.combo ? GOLD[0] : L.bad, L.shadow);
      for (const q of span(0, 256)) if (G.cells[q]) dot(cv, 22 + (q % 16), y + div(q, 16), inked(L, G.colors[G.cells[q] - 1]));
      letters(cv, r.name.length > 33 ? r.name.slice(0, 32) + '\u2026' : r.name, 44, y + 4, r.combo ? L.text : L.dim, L.shadow);
      letters(cv, fmt(r.gate), 252, y + 4, L.text, L.shadow);
      letters(cv, signed(r.lift), 292, y + 4, r.combo ? L.good : L.bad, L.shadow);
      for (const q of span(0, 100)) dot(cv, 338 + (q % 10), y + 3 + div(q, 10), inked(L, (f.px[q * 3] << 16) | (f.px[q * 3 + 1] << 8) | f.px[q * 3 + 2]));
      letters(cv, String(r.keys), 356, y + 4, L.text, L.shadow);
    });
    if (all.length > BOOK_ROWS) letters(cv, 'AND ' + (all.length - BOOK_ROWS) + ' MORE', 44, 184, L.dim, L.shadow);
    if (!all.length) centred(cv, B.plain ? 'NO COMBO OR ANTI-COMBO PROVEN HERE YET' : 'NOTHING PROVEN HERE YET', 200, 120, L.dim, L.shadow);

    // the foot: how many of each the game has proven here
    rect(cv, 6, 197, 388, 10, L.panel);
    letters(cv, B.combos.length + (B.combos.length === 1 ? ' COMBO' : ' COMBOS') + ' \u00b7 ' + B.anti.length + (B.anti.length === 1 ? ' ANTI-COMBO' : ' ANTI-COMBOS') + ' \u00b7 ' + B.plain + ' PLAIN', 8, 198, L.dim, L.shadow);
    return { ok: true, px: shareOut(cv, L, w, h) };
  } catch (e) { return no('the book could not be painted'); }
}
