// ui/gear.js — THE GEAR SCREEN: the estate's builds that stand in for rented tools, one Hands card each.
//
// The rules are src/gear.mjs (mutation-gated): a card is made from one row of fall-kit's socket record, vendored byte for
// byte (vendor/fall-kit/socket-kards.json): the build's kard.json as its site serves it, the commit its site serves, the
// tests GitHub ran on that commit, and what its live page answered. A card is gear when its kard checks and those tests
// passed; every other card is a card to collect and says why. Each card opens its app in a new tab; this device keeps
// which ones you have opened, and nothing else. The pictures are PixelWhisperer's item cards, with the line the app
// retires.
import { game, screen } from './game.js';
import { handsOf, tallyOf, factsOf } from '../src/gear.mjs';
import { appsOf } from '../src/item.mjs';
import { offered } from '../src/copy.mjs';
import { paintArt } from '../vendor/pixelwhisperer/kards/kardart.mjs';

const $ = (s) => document.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : String(v)); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const fill = (node, ...kids) => { if (node) node.replaceChildren(...kids.flat().filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : document.createTextNode(String(k))))); return node; };
const THEME = 'blockcraft-v1', W = 192, H = 280;
const STUDS = [['brain', 'Brain'], ['manifest', 'Kard'], ['mesh', 'Mesh'], ['memory', 'Memory'], ['proof', 'Proof']];
const R = { cards: null, at: '', why: '', show: 'all', category: '', q: '' };

/** the cards, made once: the socket record and the Kit's own records, both vendored */
async function load() {
  if (R.cards || R.why) return;
  const get = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [rec, c, m] = await Promise.all([get('vendor/fall-kit/socket-kards.json'), get('vendor/mint-an-app/catalogue-data.json'), get('vendor/mint-an-app/mint-data.json')]);
  if (!rec) { R.why = 'The socket record did not load. Reload the page.'; return; }
  const apps = c && m ? [...appsOf(c, m).values()].filter((a) => offered(a.app)) : [];
  const h = handsOf(rec, { proven: apps.filter((a) => a.tier === 'proven').map((a) => a.app), tools: apps.map((a) => a.app) });
  if (!h.ok) { R.why = 'The socket record did not check: ' + h.why; return; }
  R.cards = h.cards; R.at = h.at;
}
const opened = () => { const s = game.state(); if (!s.gearOpened || typeof s.gearOpened !== 'object') s.gearOpened = {}; return s.gearOpened; };

function paintCard(card) {
  const cv = el('canvas', { width: W, height: H, class: 'g-gr-face', role: 'img', 'aria-label': card.title + ': an app card that retires ' + card.said });
  const f = factsOf(card), art = f.ok ? paintArt(f.facts, THEME, W, H) : f;
  if (art.ok) { const x = cv.getContext('2d'), img = x.createImageData(W, H); for (let i = 0, j = 0; i < art.px.length; i += 3, j += 4) { img.data[j] = art.px[i]; img.data[j + 1] = art.px[i + 1]; img.data[j + 2] = art.px[i + 2]; img.data[j + 3] = 255; } x.putImageData(img, 0, 0); }
  return cv;
}

function studsRow(card) {
  if (!card.studs) return el('p', { class: 'g-small g-dim' }, 'No kard.json yet, so its studs are not read.');
  const has = new Set(['manifest', ...STUDS.map(([k]) => k).filter((k) => card.missing.indexOf(k) < 0)]);
  return el('p', { class: 'g-gr-studs', 'aria-label': 'Its studs: ' + STUDS.map(([k, w]) => w + (has.has(k) ? ' yes' : ' no')).join(', ') },
    STUDS.map(([k, w]) => el('span', { class: 'g-tag ' + (has.has(k) ? 'ok' : ''), title: has.has(k) ? w + ': it has this' : w + ': it lacks this' }, w)));
}

function cardItem(card) {
  const seen = !!opened()[card.name];
  const open = el('a', { class: 'g-btn cy', href: card.live, target: '_blank', rel: 'noopener', 'data-gr-open': card.name, onclick: () => { opened()[card.name] = 1; game.saveState(); renderTally(); mark.textContent = 'Opened'; mark.hidden = false; } }, 'Open the app');
  const mark = el('span', { class: 'g-tag cy', hidden: !seen }, 'Opened');
  const verdict = card.gear
    ? el('p', { class: 'g-small' }, el('span', { class: 'g-tag ok' }, 'Gear'), ' Its own tests passed on GitHub. ', el('a', { href: card.repo + '/actions/runs/' + card.proof.id, target: '_blank', rel: 'noopener' }, 'See the run'))
    : el('p', { class: 'g-small' }, el('span', { class: 'g-tag' }, 'To collect'), ' Not gear yet: ' + card.why + '.');
  return el('li', { class: 'g-gr-card' + (card.gear ? ' gear' : ''), 'data-gr': card.name },
    paintCard(card),
    el('div', { class: 'g-gr-body' },
      el('h3', {}, card.title),
      el('p', { class: 'g-gr-retires' }, el('b', {}, 'Retires: '), card.said),
      el('p', { class: 'g-small g-dim' }, card.category),
      studsRow(card),
      verdict,
      el('div', { class: 'g-row' }, open, mark, card.inKit ? el('a', { class: 'g-btn', href: '#kit' }, 'In the Kit’s tools') : null)));
}

function renderTally() {
  if (!R.cards) return;
  const t = tallyOf(R.cards), seen = R.cards.filter((c) => opened()[c.name]).length;
  fill($('#g-gr-tally'),
    el('div', { class: 'g-tile' }, el('span', { class: 'l' }, 'Cards'), el('span', { class: 'v' }, t.cards)),
    el('div', { class: 'g-tile' }, el('span', { class: 'l' }, 'Gear: tested on GitHub'), el('span', { class: 'v' }, t.gear)),
    el('div', { class: 'g-tile' }, el('span', { class: 'l' }, 'You have opened'), el('span', { class: 'v' }, seen + ' of ' + t.cards)));
}

function shown() {
  const q = R.q.trim().toLowerCase();
  return R.cards.filter((c) => (R.show === 'all' || (R.show === 'gear') === c.gear) && (!R.category || c.category === R.category)
    && (!q || (c.title + ' ' + c.name + ' ' + c.said + ' ' + c.category).toLowerCase().includes(q)));
}

function renderList() {
  const list = shown();
  fill($('#g-gr-list'), list.map(cardItem));
  fill($('#g-gr-count'), list.length + ' of ' + R.cards.length + ' cards shown');
}

async function render() {
  await load();
  if (!R.cards) { fill($('#g-gr-list'), el('li', {}, R.why)); return; }
  fill($('#g-gr-at'), 'Read from the socket record of ' + R.at.slice(0, 10) + ' at ' + R.at.slice(11, 16) + ' UTC: each build’s own kard.json and the tests GitHub ran on the commit its site serves.');
  const sel = $('#g-gr-cat');
  if (sel && sel.options.length <= 1) for (const c of tallyOf(R.cards).byCategory) sel.append(el('option', { value: c.category }, c.category + ' (' + c.gear + ' of ' + c.cards + ' gear)'));
  renderTally(); renderList();
}

function wire() {
  for (const [id, show] of [['g-gr-t-all', 'all'], ['g-gr-t-gear', 'gear'], ['g-gr-t-collect', 'collect']]) {
    const b = $('#' + id);
    if (b) b.addEventListener('click', () => { R.show = show; for (const x of ['g-gr-t-all', 'g-gr-t-gear', 'g-gr-t-collect']) $('#' + x).setAttribute('aria-selected', String(x === id)); renderList(); });
  }
  const sel = $('#g-gr-cat'); if (sel) sel.addEventListener('change', () => { R.category = sel.value; renderList(); });
  const q = $('#g-gr-q'); if (q) q.addEventListener('input', () => { R.q = q.value; renderList(); });
}

wire();
screen('gear', render);
