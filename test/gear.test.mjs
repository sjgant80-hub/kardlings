// test/gear.test.mjs — the Hands cards: made from the socket record, gear exactly when the kard checks and the tests passed
// on GitHub (worked out again from the runs), every other card saying why in plain words; junk refused, never thrown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECORD, SAID_MAX, WORD_MAX, MAX_BUILDS, saidOf, handsOf, tallyOf, factsOf } from '../src/gear.mjs';
import { verdictOf, checkKard } from '../vendor/fall-kit/socket.mjs';
import { copyHits } from '../src/copy.mjs';

const REAL = JSON.parse(readFileSync(new URL('../vendor/fall-kit/socket-kards.json', import.meta.url), 'utf8'));
const KARD = REAL.builds.find((b) => b.kard && b.verdict === 'green').kard;
const run = (conclusion, id = 7, status = 'completed') => ({ workflow: 'gate', id, status, conclusion });
const row = (over = {}) => {
  const name = over.name || KARD.name;
  return { name, category: 'AI you own', retires: 'a rented AI search engine (Perplexity-style)', live: 'https://sjgant80-hub.github.io/' + name + '/', status: 200,
    repo: 'https://github.com/sjgant80-hub/' + name, branch: 'main', sha: 'a'.repeat(40), runs: [run('success')], verdict: 'green', kard: KARD, kardWhy: null, ...over };
};
const rec = (builds, over = {}) => ({ kind: RECORD, at: '2026-10-25T13:39:20Z', builds, ...over });
const one = (r, opts) => handsOf(rec([r]), opts);
const why = (r) => one(r).why;

test('the limits: one record kind, a line a card can carry, and how many builds a record holds', () => {
  assert.equal(RECORD, 'socket-kards.v1'); assert.equal(SAID_MAX, 60); assert.equal(WORD_MAX, 27); assert.equal(MAX_BUILDS, 200);
});

test('what a build retires, in the game’s words: brands in brackets left out, commas with them, nothing a card cannot draw', () => {
  assert.equal(saidOf('a rented AI search engine (Perplexity-style)'), 'a rented AI search engine');
  assert.equal(saidOf('an office suite subscription (Microsoft 365-style)'), 'an office suite subscription');
  assert.equal(saidOf('a compliance-posture platform (ISO 27001, SOC 2)'), 'a compliance-posture platform');
  assert.equal(saidOf('an accounts app for trades, with HMRC returns'), 'an accounts app for trades with HMRC returns');
  assert.equal(saidOf('  a   rented  CRM  '), 'a rented CRM');
  assert.equal(saidOf('a (b) c (d)'), 'a c');
  assert.equal(saidOf("O'Hara & Sons-2.0 tools"), "O'Hara & Sons-2.0 tools");
  assert.equal(saidOf('x'.repeat(27)), 'x'.repeat(27)); assert.equal(saidOf('x'.repeat(28)), '', 'a word too long for a painted line');
  assert.equal(saidOf(('ab '.repeat(20)).trim()), ('ab '.repeat(20)).trim()); assert.equal(saidOf(('ab '.repeat(20)) + 'c'), '', 'longer than 60');
  const sixty = 'ab '.repeat(19) + 'abc'; assert.equal(sixty.length, 60); assert.equal(saidOf(sixty), sixty, 'exactly 60 is a line');
  for (const bad of ['', '   ', '(only a brand)', 'a / b', 'a: b', 'café', 'a [b]', null, 5, {}]) assert.equal(saidOf(bad), '', String(bad));
});

test('the real record: 100 Hands cards, each opening its live app, gear exactly when its kard checks and its runs are green', () => {
  const h = handsOf(REAL, { proven: ['honestly'], tools: ['botler'] });
  assert.equal(h.ok, true, h.why); assert.equal(h.at, REAL.at); assert.equal(h.cards.length, REAL.builds.length);
  h.cards.forEach((c, i) => {
    const b = REAL.builds[i];
    assert.equal(c.name, b.name); assert.equal(c.live, b.live); assert.equal(c.repo, b.repo); assert.equal(c.status, b.status);
    assert.equal(c.said, saidOf(b.retires)); assert.ok(c.said.length > 0, b.name);
    assert.deepEqual(copyHits(c.said), [], b.name + ': a word the game never says');
    assert.equal(c.tested, verdictOf(b.runs)); assert.equal(c.tested, b.verdict, b.name + ': the record’s own verdict agrees');
    assert.equal(c.gear, !!b.kard && checkKard(b.kard).ok && verdictOf(b.runs) === 'green', b.name);
    assert.equal(c.title, b.kard ? b.kard.title : b.name);
    assert.equal(c.id, b.sha.slice(0, 16));
    if (c.gear) { assert.equal(c.why, null); assert.ok(b.runs.some((r) => r.id === c.proof.id && r.conclusion === 'success')); } else { assert.equal(typeof c.why, 'string'); assert.equal(c.proof, null); }
  });
  assert.equal(h.cards.find((c) => c.name === 'botler').inKit, true); assert.equal(h.cards.filter((c) => c.inKit).length, 1);
  const hon = h.cards.find((c) => c.name === 'honestly'); assert.equal(hon.tier, hon.gear ? 'proven' : 'prototype');
});

test('a card: its kard, its studs and what it lacks; not gear says why, in plain words', () => {
  const c = one(row()).cards[0];
  assert.deepEqual(Object.keys(c), ['name', 'title', 'said', 'category', 'live', 'repo', 'status', 'sha', 'id', 'studs', 'fits', 'missing', 'tested', 'gear', 'why', 'proof', 'tier', 'inKit']);
  assert.equal(c.title, KARD.title); assert.deepEqual(c.studs, KARD.studs); assert.equal(c.fits, KARD.fits); assert.deepEqual(c.missing, checkKard(KARD).missing);
  assert.equal(c.gear, true); assert.equal(c.tier, 'works'); assert.equal(c.inKit, false); assert.deepEqual(c.proof, { workflow: 'gate', id: 7 }); assert.equal(c.id, 'a'.repeat(16));
  assert.equal(one(row(), { proven: [KARD.name], tools: [KARD.name] }).cards[0].tier, 'proven');
  assert.equal(one(row(), { tools: [KARD.name] }).cards[0].inKit, true);
  const bare = one(row({ kard: null })).cards[0];
  assert.deepEqual([bare.gear, bare.why, bare.title, bare.studs, bare.fits, bare.missing, bare.tier, bare.proof], [false, 'it carries no kard.json the socket can check', KARD.name, null, false, [], 'prototype', null]);
  assert.equal(one(row({ kard: null }), { proven: [KARD.name] }).cards[0].tier, 'prototype', 'proven is only ever said of gear');
  assert.equal(one(row({ runs: [run('failure')] })).cards[0].why, 'its last tests on GitHub did not pass');
  assert.equal(one(row({ runs: [run(null, 7, 'in_progress')] })).cards[0].why, 'its tests on GitHub are still running');
  assert.equal(one(row({ runs: [] })).cards[0].why, 'no tests of its own have run on GitHub');
  assert.equal(one(row({ runs: [run('skipped')] })).cards[0].gear, false, 'nothing succeeded');
  assert.equal(one(row({ runs: [run('failure'), run('success')], verdict: 'green' })).cards[0].gear, false, 'the record’s own verdict is not taken: the runs are read again');
  assert.deepEqual(one(row({ runs: [run('skipped', 3), run('success', 9)] })).cards[0].proof, { workflow: 'gate', id: 9 }, 'the proof is a run that succeeded');
  assert.equal(one(row({ runs: [{ workflow: 'gate', id: 'x', status: 'completed', conclusion: 'success' }] })).cards[0].proof, null, 'a run without an id is no receipt');
  assert.equal(one(row({ sha: null })).cards[0].id.length, 16, 'no commit: an id from its name');
  assert.notEqual(one(row({ sha: null })).cards[0].id, one(row({ sha: null, name: 'other', kard: null })).cards[0].id);
  for (const s of ['', ' x', 'x ', 'c'.repeat(61)]) assert.equal(one(row({ category: s })).why, KARD.name + ': it says what it retires and its category');
  assert.equal(one(row({ category: 'c'.repeat(60) })).ok, true, 'a category of 60 characters');
});

test('a record or a row that is not one is refused, by name', () => {
  for (const junk of [null, 5, [], {}, rec([row()], { kind: 'other' })]) assert.equal(handsOf(junk).why, 'a socket record is a socket-kards.v1');
  for (const at of ['2026-10-25', '2026-10-25T13:39:20.000Z', 5, null]) assert.equal(handsOf(rec([row()], { at })).why, 'a socket record says when it was taken');
  for (const builds of [[], 'x', null, Array.from({ length: 201 }, (_, i) => row({ name: 'b' + i, kard: null }))]) assert.equal(handsOf(rec(builds)).why, 'a socket record holds 1 to 200 builds');
  assert.equal(handsOf(rec(Array.from({ length: 200 }, (_, i) => row({ name: 'b' + i, kard: null })))).ok, true, '200 is enough');
  for (const r of [5, null, row({ name: 'Bad Name' }), row({ name: 5 })]) assert.equal(why(r), 'every build has a repository name');
  assert.equal(why(row({ live: 'https://example.com/' })), KARD.name + ': its live page and repository are the estate’s, at its name');
  assert.equal(why(row({ repo: 'https://github.com/other/' + KARD.name })), KARD.name + ': its live page and repository are the estate’s, at its name');
  for (const sha of ['a'.repeat(39), 'A'.repeat(40), 5, undefined]) assert.equal(why(row({ sha })), KARD.name + ': its commit is 40 hex characters, or null');
  for (const status of [-1, 1000, 2.5, '200']) assert.equal(why(row({ status })), KARD.name + ': its live page’s answer is a status code');
  assert.equal(one(row({ status: 999 })).ok, true); assert.equal(one(row({ status: 0 })).ok, true);
  for (const runs of [null, 'x', Array.from({ length: 101 }, () => run('success'))]) assert.equal(why(row({ runs })), KARD.name + ': its runs are a list');
  assert.equal(one(row({ runs: Array.from({ length: 100 }, () => run('success')) })).ok, true);
  for (const retires of ['', '(only a brand)', 5]) assert.equal(why(row({ retires })), KARD.name + ': it says what it retires and its category');
  assert.equal(why(row({ category: 5 })), KARD.name + ': it says what it retires and its category');
  assert.match(why(row({ kard: { ...KARD, fits: !KARD.fits } })), new RegExp('^' + KARD.name + ': its kard does not check: fits is true exactly when every stud is there$'));
  const other = REAL.builds.find((b) => b.kard && b.name !== KARD.name).kard;
  assert.equal(why(row({ kard: other })), KARD.name + ': its kard does not check: it names another build');
  assert.equal(handsOf(rec([row(), row()])).why, KARD.name + ': a build is on the record once');
  assert.equal(handsOf(rec([row(), row({ name: 'other', kard: null })])).ok, true);
  for (const known of [null, 5, 'x', []]) assert.equal(handsOf(rec([row()]), known).ok, true, 'no names known: no card is proven or in the Kit');
  assert.equal(handsOf(rec([row()]), null).cards[0].tier, 'works');
  assert.equal(handsOf(rec([row()]), { proven: 'x', tools: 5 }).ok, true, 'lists that are not lists are no names');
});

test('the tally: how many cards and how many are gear, overall and by category in the order they first appear', () => {
  const cards = [{ category: 'B', gear: true }, { category: 'A', gear: false }, { category: 'B', gear: false }, { category: 'A', gear: true }, { category: 'B', gear: true }];
  assert.deepEqual(tallyOf(cards), { cards: 5, gear: 3, byCategory: [{ category: 'B', cards: 3, gear: 2 }, { category: 'A', cards: 2, gear: 1 }] });
  assert.deepEqual(tallyOf([{ category: 5, gear: 'yes' }, 7, null]), { cards: 1, gear: 0, byCategory: [{ category: '', cards: 1, gear: 0 }] });
  for (const junk of [null, 5, 'x', {}]) assert.deepEqual(tallyOf(junk), { cards: 0, gear: 0, byCategory: [] });
  const h = handsOf(REAL), t = tallyOf(h.cards);
  assert.equal(t.cards, 100); assert.equal(t.gear, h.cards.filter((c) => c.gear).length);
  assert.equal(t.byCategory.reduce((s, x) => s + x.cards, 0), 100); assert.equal(t.byCategory.reduce((s, x) => s + x.gear, 0), t.gear);
});

test('a card’s face: an app that fits a tool slot, its tier, and the line it retires', () => {
  const c = one(row()).cards[0];
  assert.deepEqual(factsOf(c), { ok: true, facts: { form: 'app', id: c.id, name: c.title, source: c.name, tier: 'works', kit: true, retires: 'a rented AI search engine' } });
  for (const junk of [null, 5, {}, { name: 'x' }, { id: 'x' }]) assert.equal(factsOf(junk).why, 'a Hands card');
});

test('fuzz: junk into every function is refused or answered, never thrown', () => {
  const junk = [undefined, null, 0, -1, 1.5, NaN, '', 'x', [], [1], {}, () => 1, true, row(), rec([row()]), REAL];
  for (const a of junk) { saidOf(a); tallyOf(a); factsOf(a); for (const b of junk) { handsOf(a, b); handsOf(rec([a]), b); } }
  for (let i = 0; i < 300; i++) {   // the real record with one field of one row knocked out
    const b = REAL.builds[i % REAL.builds.length], keys = Object.keys(b), k = keys[(i * 7) % keys.length];
    const r = handsOf(rec([{ ...b, [k]: junk[i % junk.length] }]));
    assert.equal(typeof r.ok, 'boolean');
  }
});
