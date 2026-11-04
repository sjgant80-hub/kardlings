// src/teamcase.mjs — THE CASE AGAINST WHAT A TEAM PAYS NOW: one team's case-scoring work, over the years, five ways —
// as it is done today (staff time), with rented assistant seats added, with a frontier cloud model on every case, with an
// open model rented on AWS on every case, or with the team's own Kardling cards on the laptops it already runs.
// Every external figure is read from the vendored, sourced basis (vendor/sovereign-enterprise/data/basis.json, byte for
// byte; the same basis liveware's mint-a-department case reads, and this follows that kernel's method); the cases, the
// minutes, the share, the seats, the tokens and the years are the reader's own, and the milliseconds a card takes per case
// are measured on the reader's own device. Floors, never top ends: staff time at the UK median hourly wage with on-costs
// left out; CPI applied to every later year. Like for like: both cloud routes take the SAME share of the work off as the
// cards do, so they differ only in the per-case bill (and in where the records go); rented assistant seats help each
// person but take no case off, so the staff time stays. No price of ours appears here — these are the buyer's costs.
// Pure, total, deterministic: garbage in gives { ok: false, why }, never a throw.

export const DEFAULTS = Object.freeze({ cases: 2000, minutes: 1, share: 0.5, seats: 5, tokensIn: 150, tokensOut: 2, ms: 0.1, years: 3 });
export const BASIS_KEYS = Object.freeze(['wageMedianHourly', 'cpi', 'electricityPencePerKwh', 'laptopExtraWatts', 'seat.copilot', 'frontier', 'bedrockGptOss120b', 'fxGbpPerUsd']);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const r2 = (x) => Math.round(x * 100) / 100;
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the basis entries the case reads, each a sourced number; null when one is missing or unreadable */
function figures(basis) {
  const b = basis || {}, f = (k) => b[k] || {};
  const out = {
    wage: f('wageMedianHourly').value, cpi: f('cpi').value, pence: f('electricityPencePerKwh').value, watts: f('laptopExtraWatts').value,
    seat: f('seat.copilot').value, apiIn: f('frontier').inPerM, apiOut: f('frontier').outPerM,
    awsIn: f('bedrockGptOss120b').inPerM, awsOut: f('bedrockGptOss120b').outPerM, fx: f('fxGbpPerUsd').value,
  };
  return Object.values(out).every(isNum) ? out : null;
}

/** where each figure came from, for the page to list beside the numbers */
export function sourcesOf(basis) {
  try { return BASIS_KEYS.map((k) => ({ key: k, what: basis[k].what || basis[k].product, source: basis[k].source, via: basis[k].via || null })); } catch { return []; }
}

/** a yearly cost carried over `years`, rising by CPI each year after the first */
export function over(perYear, cpi, years) {
  let total = 0, factor = 1;
  for (let y = 0; y < years; y++) { total += perYear * factor; factor *= 1 + cpi; }
  return r2(total);
}

/**
 * The case. input (all optional, defaults above): cases (a month), minutes (of staff time a case, by hand), share (0 to 1:
 * the share of that time the cards take off), seats (people given a rented assistant), tokensIn and tokensOut (a case sent
 * to a cloud model), ms (a card's milliseconds a case, measured), years (1 to 10). → { ok, inputs, lines, perYear, over,
 * savingPerYear, savingOver, versus: { seats, cloud, aws } (each route's total less the cards', over the years), recordsOut }
 */
export function teamCase(basis, input) {
  try {
    const f = figures(basis);
    if (!f) return { ok: false, why: 'a sourced basis with every figure the case reads' };
    const i = { ...DEFAULTS, ...(input || {}) };
    if (!isNum(i.cases) || i.cases > 1e9) return { ok: false, why: 'cases a month: 0 to a billion' };
    if (!isNum(i.minutes) || i.minutes > 600) return { ok: false, why: 'minutes a case: 0 to 600' };
    if (!isNum(i.share) || i.share > 1) return { ok: false, why: 'the share of the work taken off: 0 to 1' };
    if (!Number.isInteger(i.seats) || i.seats < 0) return { ok: false, why: 'seats: a whole number' };
    if (!isNum(i.tokensIn) || !isNum(i.tokensOut)) return { ok: false, why: 'tokens: numbers' };
    if (!isNum(i.ms) || i.ms > 6e4) return { ok: false, why: 'milliseconds a case: 0 to 60,000' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: 1 to 10' };
    const year = i.cases * 12;                                                                   // cases a year
    const staff = r2(year * i.minutes / 60 * f.wage);                                            // the work today, in staff time
    const takenOff = r2(staff * i.share);                                                        // the share an AI route does
    const seats = r2(i.seats * 12 * f.seat);                                                     // rented assistants: help, take nothing off
    const api = r2(year * (i.tokensIn * f.apiIn + i.tokensOut * f.apiOut) / 1e6 * f.fx);         // a frontier cloud model on every case
    const aws = r2(year * (i.tokensIn * f.awsIn + i.tokensOut * f.awsOut) / 1e6 * f.fx);         // an open model on AWS on every case
    const power = r6(year * i.ms / 1000 * f.watts / 3.6e6 * f.pence / 100);                       // the cards: measured time × rated power × price
    const perYear = { today: staff, rentSeats: r2(staff + seats), cloudApi: r2(staff - takenOff + api), cloudAws: r2(staff - takenOff + aws), own: r2(staff - takenOff + power) };
    const total = Object.fromEntries(Object.entries(perYear).map(([k, v]) => [k, over(v, f.cpi, i.years)]));
    return {
      ok: true, inputs: i, lines: { staff, takenOff, seats, api, aws, power }, perYear, over: total,
      savingPerYear: r2(perYear.today - perYear.own), savingOver: r2(total.today - total.own),
      versus: { seats: r2(total.rentSeats - total.own), cloud: r2(total.cloudApi - total.own), aws: r2(total.cloudAws - total.own) },
      recordsOut: year * i.years,
    };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default { DEFAULTS, BASIS_KEYS, sourcesOf, over, teamCase };
