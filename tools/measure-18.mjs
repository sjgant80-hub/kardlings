#!/usr/bin/env node
// tools/measure-18.mjs — organ 18, THE GEAR, measured as sealed in data/organ-18/prereg.json (run tools/seal-18.mjs first;
// git proves the order). Writes data/organ-18/record.json.
//
// Every build of fall-kit's socket record (vendored byte for byte) is made into a Hands card by src/gear.mjs. For each
// card: what its live page answered; its line in the game's words and any word the copy gate refuses in it; its face
// painted by PixelWhisperer (vendored) in every theme; whether it is gear, worked out three ways (the kernel; this tool's
// own reading of the runs, written apart from the kernel and from the socket's verdictOf; the record's own verdict); and
// whether its proof is a run of its own that succeeded. Six tampered copies of its row are tried: a failed run added, its
// runs emptied, another build's kard, its kard with fits flipped, its live page moved off the estate, its line only a
// brand. Then the counts the predictions read: gear by kind of tool, gear among the builds mint-an-app's records of 10
// October list as tested apps, and gear among the cards that fit every stud.
//
// Nothing here is timed and nothing is drawn at random: the record comes back byte for byte. DRY=1 measures the first
// 10 builds into dry-record.json (a check of the tooling, never the sealed measurement).
import { writeFileSync, mkdirSync } from 'node:fs';
import { handsOf, tallyOf, factsOf, saidOf } from '../src/gear.mjs';
import { appsOf } from '../src/item.mjs';
import { copyHits, offered } from '../src/copy.mjs';
import { checkKard } from '../vendor/fall-kit/socket.mjs';
import { paintArt, THEMES } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { json } from './lib.mjs';

const DRY = process.env.DRY === '1', OUT = DRY ? 'dry-record.json' : 'record.json';
const AT = (f) => new URL('../data/organ-18/' + f, import.meta.url);
const full = json('vendor/fall-kit/socket-kards.json'), cat = json('vendor/mint-an-app/catalogue-data.json'), mint = json('vendor/mint-an-app/mint-data.json');
const record = DRY ? { ...full, builds: full.builds.slice(0, 10) } : full;
const apps = [...appsOf(cat, mint).values()].filter((a) => offered(a.app));
const known = { proven: apps.filter((a) => a.tier === 'proven').map((a) => a.app), tools: apps.map((a) => a.app) };
const h = handsOf(record, known);
if (!h.ok) { console.error('the socket record did not make cards: ' + h.why); process.exit(1); }

/** this tool's own reading of a build's runs: every run finished and passed, and at least one succeeded */
function greenHere(runs) {
  if (!Array.isArray(runs)) return false;
  let succeeded = false;
  for (const x of runs) {
    if (x === null || typeof x !== 'object' || Array.isArray(x)) continue;
    if (x.status !== 'completed') return false;
    if (x.conclusion !== 'success' && x.conclusion !== 'skipped' && x.conclusion !== 'neutral') return false;
    if (x.conclusion === 'success') succeeded = true;
  }
  return succeeded;
}
const one = (row) => handsOf({ ...record, builds: [row] }, known);
const otherKard = (name) => record.builds.find((b) => b.kard && b.name !== name).kard;
const testedOct = new Set((cat.rows || []).filter((r) => r && r.mintEligible === true && (r.tier === 'works' || r.tier === 'proven')).map((r) => r.name));
const themes = Object.keys(THEMES);

const cards = h.cards.map((c, i) => {
  const row = record.builds[i], k = row.kard ? checkKard(row.kard) : null;
  const kardOk = !!(k && k.ok && k.kard.name === row.name), here = kardOk && greenHere(row.runs);
  const f = factsOf(c), painted = themes.filter((t) => f.ok && paintArt(f.facts, t, 192, 280).ok).length;
  const proofOk = c.gear ? row.runs.some((r) => r && r.id === c.proof.id && r.conclusion === 'success' && r.status === 'completed') : c.proof === null;
  // the six tampered rows
  const failed = one({ ...row, runs: [...row.runs, { workflow: 'tamper', id: 1, status: 'completed', conclusion: 'failure' }] });
  const empty = one({ ...row, runs: [] });
  const wrongKard = one({ ...row, kard: otherKard(row.name) });
  const flipped = one({ ...row, kard: { ...(row.kard || otherKard(row.name)), fits: !(row.kard || otherKard(row.name)).fits } });
  const moved = one({ ...row, live: 'https://example.com/' + row.name + '/' });
  const brand = one({ ...row, retires: '(Brand-style)' });
  const tampers = {
    failedRun: failed.ok && failed.cards[0].gear === false && failed.cards[0].why === (kardOk ? 'its last tests on GitHub did not pass' : 'it carries no kard.json the socket can check'),
    noRuns: empty.ok && empty.cards[0].gear === false && empty.cards[0].why === (kardOk ? 'no tests of its own have run on GitHub' : 'it carries no kard.json the socket can check'),
    otherKard: !wrongKard.ok, flippedFits: !flipped.ok, movedPage: !moved.ok, brandOnly: !brand.ok,
  };
  return {
    name: c.name, category: c.category, live: c.live, status: c.status, said: c.said, saidAgain: saidOf(row.retires) === c.said,
    wordsRefused: copyHits(c.said).map((x) => x.word), bracket: /[()]/.test(c.said),
    painted, themes: themes.length, kardOk, fits: c.fits, tested: c.tested, gear: c.gear, gearHere: here, recordVerdict: row.verdict,
    proofOk, inKit: c.inKit, testedOct: testedOct.has(c.name), tampers, tampersHeld: Object.values(tampers).filter(Boolean).length,
  };
});

const t = tallyOf(h.cards);
const out = {
  kind: 'digi-card.organ-18.record', v: 1, dry: DRY, at: h.at, builds: record.builds.length, cards,
  tally: t, testedOct: { listed: cards.filter((c) => c.testedOct).length, gear: cards.filter((c) => c.testedOct && c.gear).length },
  fitsAll: { cards: cards.filter((c) => c.fits).length, gear: cards.filter((c) => c.fits && c.gear).length },
};
mkdirSync(AT(''), { recursive: true });
writeFileSync(AT(OUT), JSON.stringify(out, null, 1) + '\n');
console.log('organ 18 measured into data/organ-18/' + OUT + ' · ' + cards.length + ' cards · ' + cards.reduce((s, c) => s + c.tampersHeld, 0) + ' of ' + cards.length * 6 + ' tampers held');
