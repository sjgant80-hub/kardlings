// the case against what a team pays now: every figure from the sourced basis, floors not top ends, like for like, never a throw
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULTS, BASIS_KEYS, sourcesOf, over, teamCase } from '../src/teamcase.mjs';

const BASIS = JSON.parse(readFileSync(new URL('../vendor/sovereign-enterprise/data/basis.json', import.meta.url), 'utf8'));
const base = (patch) => ({ ...BASIS, ...patch });
const pence = (x) => Math.round(x * 100) / 100;

test('teamCase · the default case, every line from the sourced basis', () => {
  const r = teamCase(BASIS, {});
  assert.equal(r.ok, true);
  assert.deepEqual(r.inputs, DEFAULTS);
  assert.deepEqual(r.lines, { staff: 7868, takenOff: 3934, seats: 1386, api: 5.79, aws: 0.66, power: 0.000002 });
  assert.deepEqual(r.perYear, { today: 7868, rentSeats: 9254, cloudApi: 3939.79, cloudAws: 3934.66, own: 3934 });
  assert.deepEqual(r.over, { today: 24343.29, rentSeats: 28631.52, cloudApi: 12189.56, cloudAws: 12173.68, own: 12171.64 });
  assert.deepEqual([r.savingPerYear, r.savingOver], [3934, 12171.65]);
  assert.deepEqual(r.versus, { seats: 16459.88, cloud: 17.92, aws: 2.04 });
  assert.equal(r.recordsOut, 72000);
  assert.deepEqual(teamCase(BASIS), r);
});

test('teamCase · a larger team: the reader’s own inputs carried through', () => {
  const r = teamCase(BASIS, { cases: 30000, minutes: 1, share: 0.5, seats: 5, tokensIn: 120, tokensOut: 2, ms: 0.02, years: 3 });
  assert.deepEqual(r.lines, { staff: 118020, takenOff: 59010, seats: 1386, api: 70.57, aws: 8, power: 0.000007 });
  assert.deepEqual(r.over, { today: 365149.28, rentSeats: 369437.51, cloudApi: 182792.98, cloudAws: 182599.39, own: 182574.64 });
  assert.equal(r.recordsOut, 1080000);
});

test('teamCase · like for like: rented seats take nothing off; both cloud routes and the cards take the same share off', () => {
  const r = teamCase(BASIS, { share: 0.8, seats: 2, cases: 1000, minutes: 3, tokensIn: 2000, tokensOut: 500, ms: 5 });
  assert.equal(r.perYear.rentSeats, pence(r.lines.staff + r.lines.seats));
  assert.equal(r.perYear.cloudApi, pence(r.lines.staff - r.lines.takenOff + r.lines.api));
  assert.equal(r.perYear.cloudAws, pence(r.lines.staff - r.lines.takenOff + r.lines.aws));
  assert.equal(r.perYear.own, pence(r.lines.staff - r.lines.takenOff + r.lines.power));
  assert.equal(r.lines.takenOff, pence(r.lines.staff * 0.8));
  assert.equal(r.lines.seats, pence(2 * 12 * BASIS['seat.copilot'].value));
  assert.equal(r.lines.staff, pence(1000 * 12 * 3 / 60 * BASIS.wageMedianHourly.value));
  assert.equal(r.versus.seats, pence(r.over.rentSeats - r.over.own));
  assert.equal(r.versus.cloud, pence(r.over.cloudApi - r.over.own));
  assert.equal(r.versus.aws, pence(r.over.cloudAws - r.over.own));
  assert.equal(r.savingPerYear, pence(r.perYear.today - r.perYear.own));
  assert.equal(r.savingOver, pence(r.over.today - r.over.own));
  assert.equal(r.recordsOut, 1000 * 12 * 3);
});

test('teamCase · the figures move with the basis, not with anything typed', () => {
  assert.equal(teamCase(base({ wageMedianHourly: { ...BASIS.wageMedianHourly, value: 30 } }), {}).lines.staff, 2000 * 12 / 60 * 30);
  assert.equal(teamCase(base({ 'seat.copilot': { ...BASIS['seat.copilot'], value: 10 } }), {}).lines.seats, 5 * 12 * 10);
  const fx = teamCase(base({ fxGbpPerUsd: { ...BASIS.fxGbpPerUsd, value: 1 } }), {});
  assert.equal(fx.lines.api, pence(24000 * (150 * 2 + 2 * 10) / 1e6));
  assert.equal(fx.lines.aws, pence(24000 * (150 * 0.23 + 2 * 0.93) / 1e6));
  const dear = teamCase(base({ frontier: { ...BASIS.frontier, inPerM: 20, outPerM: 100 }, bedrockGptOss120b: { ...BASIS.bedrockGptOss120b, inPerM: 3, outPerM: 9 } }), {});
  assert.equal(dear.lines.api, pence(24000 * (150 * 20 + 2 * 100) / 1e6 * BASIS.fxGbpPerUsd.value));
  assert.equal(dear.lines.aws, pence(24000 * (150 * 3 + 2 * 9) / 1e6 * BASIS.fxGbpPerUsd.value));
  const power = teamCase(base({ electricityPencePerKwh: { ...BASIS.electricityPencePerKwh, value: 100 }, laptopExtraWatts: { ...BASIS.laptopExtraWatts, value: 36 } }), { ms: 1000, cases: 100 });
  assert.equal(power.lines.power, 1200 * 1 * 36 / 3.6e6 * 1);
  const flat = teamCase(base({ cpi: { ...BASIS.cpi, value: 0 } }), {});
  assert.equal(flat.over.today, 7868 * 3);
});

test('teamCase · boundaries hold at both ends of every input', () => {
  for (const ok of [{ cases: 0 }, { cases: 1e9 }, { minutes: 0 }, { minutes: 600 }, { share: 0 }, { share: 1 }, { seats: 0 }, { tokensIn: 0, tokensOut: 0 }, { ms: 0 }, { ms: 6e4 }, { years: 1 }, { years: 10 }])
    assert.equal(teamCase(BASIS, ok).ok, true, JSON.stringify(ok));
  assert.equal(teamCase(BASIS, { share: 1 }).perYear.own, pence(teamCase(BASIS, { share: 1 }).lines.power));
  assert.equal(teamCase(BASIS, { share: 0 }).savingPerYear, 0);
  assert.equal(teamCase(BASIS, { share: 0 }).perYear.cloudApi, pence(7868 + 5.79));
  assert.equal(teamCase(BASIS, { years: 1 }).over.today, 7868);
  assert.equal(teamCase(BASIS, { seats: 0 }).perYear.rentSeats, 7868);
  assert.equal(teamCase(BASIS, { cases: 0 }).recordsOut, 0);
});

test('teamCase · each bad input refused with its reason', () => {
  const why = (i) => teamCase(BASIS, i).why;
  assert.equal(why({ cases: 1e9 + 1 }), 'cases a month: 0 to a billion');
  assert.equal(why({ cases: -1 }), 'cases a month: 0 to a billion');
  assert.equal(why({ cases: '20' }), 'cases a month: 0 to a billion');
  assert.equal(why({ minutes: 600.5 }), 'minutes a case: 0 to 600');
  assert.equal(why({ minutes: -1 }), 'minutes a case: 0 to 600');
  assert.equal(why({ share: 1.01 }), 'the share of the work taken off: 0 to 1');
  assert.equal(why({ share: -0.1 }), 'the share of the work taken off: 0 to 1');
  assert.equal(why({ seats: 2.5 }), 'seats: a whole number');
  assert.equal(why({ seats: -1 }), 'seats: a whole number');
  assert.equal(why({ tokensIn: NaN }), 'tokens: numbers');
  assert.equal(why({ tokensOut: 'x' }), 'tokens: numbers');
  assert.equal(why({ tokensIn: -1 }), 'tokens: numbers');
  assert.equal(why({ ms: 6e4 + 1 }), 'milliseconds a case: 0 to 60,000');
  assert.equal(why({ ms: -0.1 }), 'milliseconds a case: 0 to 60,000');
  assert.equal(why({ years: 0 }), 'years: 1 to 10');
  assert.equal(why({ years: 11 }), 'years: 1 to 10');
  assert.equal(why({ years: 2.5 }), 'years: 1 to 10');
});

test('teamCase · refuses a basis missing any figure it reads', () => {
  const refused = { ok: false, why: 'a sourced basis with every figure the case reads' };
  assert.deepEqual(teamCase(null, {}), refused);
  assert.deepEqual(teamCase(undefined, {}), refused);
  for (const k of BASIS_KEYS) { const b = { ...BASIS }; delete b[k]; assert.deepEqual(teamCase(b, {}), refused, k); }
  assert.deepEqual(teamCase(base({ cpi: { value: -0.1 } }), {}), refused);
  assert.deepEqual(teamCase(base({ frontier: { inPerM: 2 } }), {}), refused);
  assert.deepEqual(teamCase(base({ bedrockGptOss120b: { outPerM: 0.93 } }), {}), refused);
  assert.equal(teamCase(base({ cpi: { value: 0 } }), {}).ok, true);
});

test('over · CPI on every year after the first, compounding', () => {
  assert.equal(over(100, 0.1, 1), 100);
  assert.equal(over(100, 0.1, 2), 210);
  assert.equal(over(100, 0.1, 3), 331);
  assert.equal(over(100, 0, 4), 400);
  assert.equal(over(100, 0.1, 0), 0);
});

test('sourcesOf · every figure the case reads, with what it is and where it came from', () => {
  const s = sourcesOf(BASIS);
  assert.deepEqual(s.map((x) => x.key), [...BASIS_KEYS]);
  assert.match(s.find((x) => x.key === 'wageMedianHourly').source, /^https:\/\/www\.ons\.gov\.uk\//);
  assert.equal(s.find((x) => x.key === 'wageMedianHourly').what, BASIS.wageMedianHourly.what);
  assert.equal(s.find((x) => x.key === 'wageMedianHourly').via, 'estate basis 2026-09-29');
  assert.equal(s.find((x) => x.key === 'seat.copilot').what, 'Microsoft 365 Copilot (enterprise)');
  assert.equal(s.find((x) => x.key === 'frontier').what, 'Claude Sonnet 5 (API)');
  assert.match(s.find((x) => x.key === 'bedrockGptOss120b').what, /^Amazon Bedrock/);
  assert.ok(s.every((x) => /^https:\/\//.test(x.source)));
  assert.equal(sourcesOf(base({ cpi: { value: 0.031, source: 'https://x.test/' } })).find((x) => x.key === 'cpi').via, null);
  assert.deepEqual(sourcesOf(null), []);
});

test('teamCase · totality: garbage never throws', () => {
  const G = [undefined, null, 0, 'x', [], {}, { cases: {} }, { years: Infinity }, true, () => 1, NaN];
  for (const a of G) for (const b of G) assert.doesNotThrow(() => teamCase(a, b));
  for (const g of G) { assert.doesNotThrow(() => sourcesOf(g)); assert.doesNotThrow(() => over(g, g, 3)); }
  assert.equal(teamCase(BASIS, { cases: {} }).ok, false);
  const toxic = { get cases() { throw new Error('toxic'); } };
  assert.deepEqual(teamCase(BASIS, toxic), { ok: false, why: 'the inputs could not be read' });
});
