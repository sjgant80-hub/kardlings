#!/usr/bin/env node
// tools/judge-18.mjs — organ 18's verdict, by its sealed rules alone (data/organ-18/prereg.json) over its record.
//   node tools/judge-18.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const all = (r) => (Array.isArray(r.cards) ? r.cards : []);
export const RULES = {
  P1: (r) => {
    const c = all(r), live = c.filter((x) => x.status === 200 && x.live === 'https://sjgant80-hub.github.io/' + x.name + '/').length;
    const said = c.filter((x) => x.saidAgain && !x.bracket && x.wordsRefused.length === 0 && x.said.length > 0).length, painted = c.filter((x) => x.painted === x.themes && x.themes > 0).length;
    return { pass: !r.dry && r.builds === 100 && c.length === 100 && live === 100 && said === 100 && painted === 100, saw: c.length + ' of ' + r.builds + ' builds made cards; ' + live + ' live pages at their own address answered 200; ' + said + ' lines in the game’s words; ' + painted + ' faces painted in all ' + (c[0] ? c[0].themes : 0) + ' themes' };
  },
  P2: (r) => {
    const c = all(r), same = c.filter((x) => x.gear === x.gearHere && x.gear === (x.kardOk && x.tested === 'green')).length, agree = c.filter((x) => x.tested === x.recordVerdict).length, proof = c.filter((x) => x.proofOk).length;
    return { pass: c.length === 100 && same === 100 && agree === 100 && proof === 100, saw: same + ' of ' + c.length + ' cards gear exactly as this tool reads the runs; ' + agree + ' verdicts as the record’s own; ' + proof + ' proofs right (a run of its own that succeeded on every gear card, none on the rest)' };
  },
  P3: (r) => {
    const c = all(r), held = c.reduce((s, x) => s + x.tampersHeld, 0), by = (k) => c.filter((x) => x.tampers[k]).length;
    return { pass: c.length === 100 && held === 600, saw: held + ' of ' + c.length * 6 + ' tampered rows held: a failed run added ' + by('failedRun') + ', runs emptied ' + by('noRuns') + ', another build’s kard ' + by('otherKard') + ', fits flipped ' + by('flippedFits') + ', page moved ' + by('movedPage') + ', a line only a brand ' + by('brandOnly') };
  },
  Q1: (r) => ({ pass: r.tally.gear >= 70, saw: r.tally.gear + ' of ' + r.tally.cards + ' cards are gear' }),
  Q2: (r) => {
    const k = r.tally.byCategory, none = k.filter((x) => x.gear < 1).map((x) => x.category);
    return { pass: k.length === 11 && none.length === 0, saw: k.length + ' kinds of tool; ' + k.map((x) => x.category + ' ' + x.gear + '/' + x.cards).join('; ') + (none.length ? '; no gear in ' + none.join(', ') : '') };
  },
  Q3: (r) => ({ pass: r.testedOct.listed > 0 && r.testedOct.gear * 10 >= r.testedOct.listed * 9, saw: r.testedOct.gear + ' of the ' + r.testedOct.listed + ' builds mint-an-app’s records of 10 October list as tested apps are gear on 25 October (' + Math.round((100 * r.testedOct.gear) / Math.max(1, r.testedOct.listed)) + '%)' }),
  Q4: (r) => ({ pass: r.fitsAll.cards > 0 && r.fitsAll.gear === r.fitsAll.cards, saw: r.fitsAll.gear + ' of the ' + r.fitsAll.cards + ' cards that fit every stud are gear' }),
};
if (isMain(import.meta.url, 'judge-18.mjs')) judgeMain(18, RULES);
