#!/usr/bin/env node
// tools/contract.mjs — the shared records contract, Kardlings' half: real records from the game's own kernel, published for
// the painters. Two builds of the drop's own cards are measured by src/build.mjs exactly as the Builds screen measures them,
// re-run and signed by two demo keys (from public phrases, so every signature reproduces), proven, and put in the build
// book; each is written with its job (from the admission record) into data/contract/builds.json, as the kernel emits it —
// receipt, proof and book page, nothing reshaped. CI runs it with --check: the file must come back byte for byte, so a
// change to the kernel's records cannot reach the painters unseen. test/painters.test.mjs then has PixelWhisperer's
// vendored painters read every record as it is (a build sheet and a build-book page each), so a painter that no longer
// reads the game's real records turns this repository red.
//   node tools/contract.mjs            → writes data/contract/builds.json
//   node tools/contract.mjs --check    → CONTRACT OK | CONTRACT DRIFT (exit 1)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { recipeOf, measure, signRerun, proofOf, bookOf, jobsOf } from '../src/build.mjs';
import { verify } from '../src/dossier.mjs';
import { dossierOf } from '../src/registry.mjs';
import { drop, ground, owner, json, setOfDomain } from './lib.mjs';

const OUT = new URL('../data/contract/builds.json', import.meta.url);
/** the builds, chosen by rule so anyone can make them again: the page's traced census build, and a telecom build of each
 *  department's best card (ties to the lower serial) with the second-best card of its first department beside it, which a
 *  better-proven part benches */
const TRACED = { set: 'adult', serials: [266, 762, 13] };
const PHRASES = ['contract-finder', 'contract-second'];

async function make() {
  const { m, reg } = await drop(), admission = json('drop/admission.json'), jobs = jobsOf(admission);
  const keys = await Promise.all(PHRASES.map(owner));
  const card = (serial) => m.cards.find((c) => c.serial === serial);
  const best = (dom, skip = 0) => m.cards.filter((c) => c.domain === dom).sort((a, b) => b.gate - a.gate || a.serial - b.serial)[skip];
  const telco = [...new Set(m.cards.filter((c) => setOfDomain(c.domain) === 'telco').map((c) => c.domain))].sort();
  const builds = [{ set: TRACED.set, cards: TRACED.serials.map(card) }, { set: 'telco', cards: [...telco.map((d) => best(d)), best(telco[0], 1)] }];
  const records = [];
  for (const { set, cards } of builds) {
    const g = await ground(set), vs = [];
    for (const c of cards) { const v = await verify(dossierOf(reg, c.card)); if (!v.ok) throw new Error('#' + c.serial + ' does not check: ' + v.why); vs.push(v); }
    const r0 = recipeOf(vs, g);
    if (!r0.ok) throw new Error(r0.why);
    const b = r0.build, r = measure(b, vs, g);
    if (!r.ok) throw new Error(r.why);
    const reruns = [];
    for (const k of keys) { const s = await signRerun(k, r.receipt, b, vs, g); if (!s.ok) throw new Error(s.why); reruns.push(s.rerun); }
    const proof = await proofOf(r.receipt, b, vs, g, reruns);
    if (!proof.ok || !proof.proven) throw new Error('the contract build ' + set + ' is not proven: ' + (proof.why || proof.refused.join(', ')));
    const book = bookOf([{ receipt: r.receipt, proof }]);
    if (!book.ok) throw new Error(book.why);
    const job = jobs.find((j) => j.set === set);
    records.push({ job: { set: job.set, bar: job.bar }, serials: cards.map((c) => c.serial), held: cards.map((c) => c.card), build: b, receipt: r.receipt, reruns, proof, page: book.jobs[r.receipt.data] });
    process.stdout.write(set + ' · ' + r.receipt.verdict + ' ' + r.receipt.name + ' · lift ' + r.receipt.lift + '\n');
  }
  return { kind: 'kardlings.contract.builds', v: 1, note: 'real records from the game’s own kernel, as it emits them, for the painters: made by tools/contract.mjs from the drop’s cards, re-run and signed by two demo keys from public phrases; CI makes them again byte for byte', keys: PHRASES.map((p, k) => ({ phrase: 'digi-card/organs/owner/' + p, pub: keys[k].pub })), records };
}

const text = JSON.stringify(await make(), null, 1) + '\n';
if (process.argv.includes('--check')) {
  const had = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  console.log(had === text ? 'CONTRACT OK · data/contract/builds.json is the kernel’s own records, made again byte for byte' : 'CONTRACT DRIFT · data/contract/builds.json is not what the kernel makes now (run node tools/contract.mjs and commit it)');
  process.exit(had === text ? 0 : 1);
}
mkdirSync(new URL('../data/contract/', import.meta.url), { recursive: true });
writeFileSync(OUT, text);
console.log('wrote data/contract/builds.json · ' + JSON.parse(text).records.length + ' records');
