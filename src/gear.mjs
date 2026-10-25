// src/gear.mjs — THE GEAR: the estate's 100 builds that stand in for rented tools, each a Hands card.
//
// A Hands card is made from one row of fall-kit's socket record (vendor/fall-kit/socket-kards.json, byte for byte): the
// build's own kard.json as its site serves it, checked again here by the socket's own checker; the commit its site
// serves; every test run GitHub holds for that commit; and what its live page answered. A card opens its live app and
// says, in the game's words, the rented tool it stands in for (brand names in brackets left out: they describe the kind
// of tool and stay off the game's pages). A card is GEAR exactly when its kard checks and its tests passed on GitHub —
// worked out again here from the runs (the socket's verdictOf), never taken from the record's own verdict. Every other
// card is a card to collect, and says why it is not gear in plain words.
//
// A card's tier, as PixelWhisperer paints it: works when it is gear, proven when it is gear and mint-an-app's records
// (vendored) rate the app proven, prototype otherwise. It is in the Kit's tools when the Kit already offers the app.
// Pure and total: junk is refused in plain words, never thrown.
import { checkKard, verdictOf, HOST, REPOS } from '../vendor/fall-kit/socket.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';

export const RECORD = 'socket-kards.v1';
export const SAID_MAX = 60;           // the longest line a card's face takes (PixelWhisperer's RETIRES_MAX)
export const WORD_MAX = 27;           // the longest word one painted line holds
export const MAX_BUILDS = 200;
const NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/, SHA = /^[0-9a-f]{40}$/, AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PAINT = /^[A-Za-z0-9 &'.-]*$/;  // the letters a card's face can draw
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';

/**
 * The rented tool a build stands in for, in the game's words: what is in brackets is left out (it names a brand), and
 * commas with it; spaces single. '' when what is left is not a line a card can carry.
 */
export function saidOf(retires) {
  if (typeof retires !== 'string') return '';
  const s = retires.replace(/\s*\([^()]*\)/g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
  return s && s.length <= SAID_MAX && PAINT.test(s) && s.split(' ').every((w) => w.length <= WORD_MAX) ? s : '';
}

/** why a card is not gear, in plain words; null when it is */
function whyNot(kardOk, tested) {
  if (!kardOk) return 'it carries no kard.json the socket can check';
  if (tested === 'red') return 'its last tests on GitHub did not pass';
  if (tested === 'running') return 'its tests on GitHub are still running';
  if (tested === 'none') return 'no tests of its own have run on GitHub';
  return null;
}

/** one record row → a Hands card, or a refusal naming the row */
function cardOf(row, proven, tools) {
  if (!isObj(row) || typeof row.name !== 'string' || !NAME.test(row.name)) return no('every build has a repository name');
  const name = row.name;
  if (row.live !== HOST + name + '/' || row.repo !== REPOS + name) return no(name + ': its live page and repository are the estate’s, at its name');
  if (row.sha !== null && !(typeof row.sha === 'string' && SHA.test(row.sha))) return no(name + ': its commit is 40 hex characters, or null');
  if (!Number.isInteger(row.status) || row.status < 0 || row.status > 999) return no(name + ': its live page’s answer is a status code');
  if (!Array.isArray(row.runs) || row.runs.length > 100) return no(name + ': its runs are a list');
  const said = saidOf(row.retires);
  if (!said || typeof row.category !== 'string' || !row.category || row.category.trim() !== row.category || row.category.length > 60) return no(name + ': it says what it retires and its category');
  let kard = null, missing = [];
  if (row.kard !== null) {
    const c = checkKard(row.kard);
    if (!c.ok || c.kard.name !== name) return no(name + ': its kard does not check: ' + (c.ok ? 'it names another build' : c.why));
    kard = c.kard; missing = c.missing;
  }
  const tested = verdictOf(row.runs), gear = !!kard && tested === 'green';
  const proof = gear ? row.runs.find((r) => isObj(r) && r.conclusion === 'success' && Number.isInteger(r.id)) : null;
  return {
    ok: true,
    card: {
      name, title: kard ? kard.title : name, said, category: row.category, live: row.live, repo: row.repo, status: row.status,
      sha: row.sha, id: (row.sha || sha256Hex(name)).slice(0, 16),
      studs: kard ? kard.studs : null, fits: kard ? kard.fits : false, missing,
      tested, gear, why: whyNot(!!kard, tested), proof: proof ? { workflow: String(proof.workflow), id: proof.id } : null,
      tier: gear ? (proven.has(name) ? 'proven' : 'works') : 'prototype', inKit: tools.has(name),
    },
  };
}

/**
 * The Hands cards, from the socket record (as parsed) and what the Kit already knows: proven, the names mint-an-app rates
 * proven; tools, the names the Kit offers as app tools. → { ok, at, cards } | { ok: false, why }
 */
export function handsOf(record, known) {
  const { proven, tools } = isObj(known) ? known : {};
  if (!isObj(record) || record.kind !== RECORD) return no('a socket record is a ' + RECORD);
  if (typeof record.at !== 'string' || !AT.test(record.at)) return no('a socket record says when it was taken');
  if (!Array.isArray(record.builds) || record.builds.length < 1 || record.builds.length > MAX_BUILDS) return no('a socket record holds 1 to ' + MAX_BUILDS + ' builds');
  const p = new Set(Array.isArray(proven) ? proven : []), t = new Set(Array.isArray(tools) ? tools : []), seen = new Set(), cards = [];
  for (const row of record.builds) {
    const c = cardOf(row, p, t);
    if (!c.ok) return c;
    if (seen.has(c.card.name)) return no(c.card.name + ': a build is on the record once');
    seen.add(c.card.name); cards.push(c.card);
  }
  return { ok: true, at: record.at, cards };
}

/** how many cards and how many are gear, overall and by category (in the order the categories first appear) */
export function tallyOf(cards) {
  const list = Array.isArray(cards) ? cards.filter(isObj) : [], by = new Map();
  for (const c of list) {
    const k = typeof c.category === 'string' ? c.category : '';
    if (!by.has(k)) by.set(k, { category: k, cards: 0, gear: 0 });
    const row = by.get(k); row.cards++; if (c.gear === true) row.gear++;
  }
  return { cards: list.length, gear: list.filter((c) => c.gear === true).length, byCategory: [...by.values()] };
}

/** a card's facts as PixelWhisperer paints an item: an app that fits a tool slot, its tier, and the line it retires */
export function factsOf(card) {
  if (!isObj(card) || typeof card.name !== 'string' || typeof card.id !== 'string') return no('a Hands card');
  return { ok: true, facts: { form: 'app', id: card.id, name: card.title, source: card.name, tier: card.tier, kit: true, retires: card.said } };
}
