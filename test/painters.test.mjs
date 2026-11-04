// the shared records contract, read by the painters: PixelWhisperer's vendored build sheet and build book must draw the game's
// real records exactly as the kernel emits them (data/contract/builds.json, made again byte for byte by tools/contract.mjs
// in CI). A painter that stops reading the kernel's records, or a kernel whose records drift from what the painter reads,
// turns this test red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkSheet, paintSheet, checkBook, paintBook } from '../vendor/pixelwhisperer/kards/build.mjs';
import { THEMES } from '../vendor/pixelwhisperer/kards/kardart.mjs';
import { RECEIPT, nameOf } from '../src/build.mjs';

const C = JSON.parse(readFileSync(new URL('../data/contract/builds.json', import.meta.url), 'utf8'));
const hash = (px) => createHash('sha256').update(px).digest('hex');
const sheetOf = (r) => ({ job: r.job, receipt: r.receipt, proof: r.proof, held: r.held });

test('the contract holds the kernel’s own records: receipts with exactly the kernel’s fields, proven by the two keys named', () => {
  assert.equal(C.kind, 'kardlings.contract.builds');
  assert.ok(C.records.length >= 2);
  for (const r of C.records) {
    assert.deepEqual(Object.keys(r.receipt).sort(), [...RECEIPT].sort());
    assert.equal(r.receipt.lift, r.receipt.gate - r.receipt.best);
    const fielding = r.receipt.parts.filter((p) => p.joined).map((p) => p.title);
    assert.deepEqual(r.receipt.name.split(' × ').sort(), [...fielding].sort());
    assert.equal(r.receipt.name, nameOf(r.receipt.name.split(' × ')));
    assert.equal(r.proof.proven, true);
    assert.deepEqual(r.proof.keys, C.keys.map((k) => k.pub));
    assert.equal(r.proof.finder, C.keys[0].pub);
    assert.equal(r.proof.verdict, r.receipt.verdict);
    assert.equal(r.receipt.data.split(':')[0], r.job.set);
  }
  assert.ok(C.records.some((r) => r.receipt.parts.some((p) => !p.joined)), 'one record benches a card, so the sheet draws the bench');
});

test('the build sheet reads every real record as it is, and draws it the same way every time, in every theme', () => {
  for (const r of C.records) {
    const c = checkSheet(sheetOf(r));
    assert.equal(c.ok, true, r.job.set + ': ' + c.why);
    assert.equal(c.s.lift, r.receipt.lift);
    assert.equal(c.s.fielded, r.receipt.fielded);
    assert.equal(c.s.rows.length, r.receipt.parts.length);
    assert.deepEqual(c.s.proof, { proven: true, keys: 2, finder: r.proof.finder });
    for (const theme of Object.keys(THEMES)) {
      const a = paintSheet(sheetOf(r), theme, 800, 420), b = paintSheet(sheetOf(r), theme, 800, 420);
      assert.equal(a.ok, true, r.job.set + ' in ' + theme + ': ' + a.why);
      assert.equal(a.px.length, 800 * 420 * 3);
      assert.equal(hash(a.px), hash(b.px));
    }
  }
});

test('a build-book page reads the kernel’s own book as it is', () => {
  for (const r of C.records) {
    const c = checkBook({ job: r.job, page: r.page });
    assert.equal(c.ok, true, r.job.set + ': ' + c.why);
    assert.equal(c.b.combos.length + c.b.anti.length + c.b.plain, 1);
    assert.equal(c.b.best, r.receipt.gate);
    const p = paintBook({ job: r.job, page: r.page }, 'synthwave-v1', 800, 420);
    assert.equal(p.ok, true, p.why);
    assert.equal(p.px.length, 800 * 420 * 3);
  }
});

test('the painters refuse a record whose numbers do not add up, so they read the numbers rather than trust them', () => {
  const r = C.records[0];
  assert.equal(checkSheet({ ...sheetOf(r), receipt: { ...r.receipt, lift: r.receipt.lift + 1 } }).why, 'lift is the gate less the best');
  assert.equal(checkSheet({ ...sheetOf(r), receipt: { ...r.receipt, best: r.receipt.best - 1, lift: r.receipt.lift + 1 } }).why, 'best is the highest alone GATE among the parts that field');
  assert.equal(checkSheet({ ...sheetOf(r), job: { ...r.job, set: r.job.set === 'adult' ? 'telco' : 'adult' } }).ok, false);
  assert.equal(checkSheet({ ...sheetOf(r), proof: { ...r.proof, finder: r.proof.keys[1] } }).ok, false);
  assert.equal(paintSheet(sheetOf(r), 'no-such-theme', 800, 420).ok, false);
});
