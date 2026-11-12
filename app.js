'use strict';

/* ---------- Konfiguration ---------- */
const STORE = 'stimmung.v1';
const BOOLS = [
  ['periode', 'Periode'],
  ['sport', 'Sport'],
  ['schlaf', 'Gut geschlafen'],
  ['wein', 'Wein'],
  ['start', 'Leichter Start in den Tag'],
];
// key, Label links (-1), Label rechts (+1), Kurzname
const TRI = [
  ['zuversicht', 'ängstlich', 'zuversichtlich', 'Zuversicht'],
  ['selbstbewusst', 'nicht selbstbewusst', 'selbstbewusst', 'Selbstbewusst'],
  ['froehlich', 'traurig', 'fröhlich', 'Fröhlich'],
  ['unbekuemmert', 'sorgenvoll', 'unbekümmert', 'Unbekümmert'],
  ['kraftvoll', 'kraftlos', 'kraftvoll', 'Kraftvoll'],
];

// Gute Gefühle: Familie -> [Hintergrund, Schrift, Name]; warme Töne von Gelb bis Rot
const FAM = {
  sonne: ['#FFE45C', '#4A3300', 'Sonne'],
  ruhe: ['#FFC93C', '#4A2C00', 'Ruhe'],
  weite: ['#FFA94D', '#4A2100', 'Weite'],
  energie: ['#FF7A2F', '#3D1200', 'Energie'],
  staerke: ['#FF5E4D', '#3D0A05', 'Stärke'],
  herz: ['#F2385A', '#FFF3F0', 'Herz'],
};
// [Begriff, Familie, Größe 1–3]
const WORDS = [
  ['Freude', 'sonne', 3], ['Heiterkeit', 'sonne', 1], ['Spaß', 'sonne', 2], ['Leichtigkeit', 'sonne', 2],
  ['Begeisterung', 'energie', 3], ['Aufregung', 'energie', 1], ['Lebendigkeit', 'energie', 2], ['Mut', 'energie', 1],
  ['Liebe', 'herz', 3], ['Verbundenheit', 'herz', 2], ['Mitgefühl', 'herz', 1], ['Geborgenheit', 'herz', 2], ['Zärtlichkeit', 'herz', 1],
  ['Stolz', 'staerke', 2], ['Selbstvertrauen', 'staerke', 2], ['Zufriedenheit', 'staerke', 3], ['Erfüllung', 'staerke', 1],
  ['Vorfreude', 'weite', 3], ['Hoffnung', 'weite', 2], ['Neugier', 'weite', 1], ['Inspiration', 'weite', 2], ['Staunen', 'weite', 1],
  ['Dankbarkeit', 'ruhe', 3], ['Gelassenheit', 'ruhe', 2], ['Erleichterung', 'ruhe', 1],
];
const CLOUD_ORDER = [0, 17, 8, 22, 4, 13, 1, 9, 18, 15, 5, 23, 2, 10, 19, 6, 14, 24, 3, 11, 20, 7, 16, 12, 21];
const famOf = w => { const x = WORDS.find(v => v[0] === w); return FAM[x ? x[1] : 'weite']; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Datum ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const fmtShort = s => { const d = parse(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const fmtLong = s => parse(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const f1 = v => v.toFixed(1).replace('.', ',');
const f2 = v => v.toFixed(2).replace('.', ',');

/* ---------- Speicher ---------- */
let data = {};
function load() {
  try { data = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { data = {}; }
}
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch { toast('Speichern nicht möglich (Speicher voll oder gesperrt)'); }
}
const dates = () => Object.keys(data).sort();

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Tabs ---------- */
const $ = id => document.getElementById(id);
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'auswertung') renderAuswertung();
  if (b.dataset.tab === 'daten') $('count').textContent = dates().length;
  window.scrollTo(0, 0);
}));

/* ---------- Eingabe ---------- */
const form = $('form');
let current = today();

function buildTri() {
  $('tri').innerHTML = '<h2>Gefühle</h2>' + TRI.map(([k, l, r]) => `
    <div class="tri" data-k="${k}">
      <input type="range" name="${k}" min="-1" max="1" step="1" value="0" aria-label="${l} bis ${r}">
      <div class="labels"><span>${l}</span><span>neutral</span><span>${r}</span></div>
    </div>`).join('');
  $('tri').querySelectorAll('input').forEach(i => i.addEventListener('input', markTri));
}
function markTri() {
  $('tri').querySelectorAll('.tri').forEach(row => {
    const v = +row.querySelector('input').value;
    row.querySelectorAll('.labels span').forEach((s, i) => s.classList.toggle('on', i === v + 1));
  });
}

/* ---------- Begriffswolke ---------- */
let picked = []; // [{w, note}]
function renderGood(justAdded) {
  const cloud = $('cloud');
  cloud.innerHTML = '';
  CLOUD_ORDER.forEach(i => {
    const [w, f, s] = WORDS[i];
    if (picked.some(p => p.w === w)) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip s' + s; b.textContent = w;
    b.style.background = FAM[f][0]; b.style.color = FAM[f][1];
    b.style.setProperty('--d', (2.6 + ((i * 37) % 17) / 10).toFixed(2) + 's');
    b.style.setProperty('--dl', (-((i * 53) % 30) / 10).toFixed(2) + 's');
    b.style.setProperty('--x', (((i * 29) % 5) - 2) + 'px');
    b.style.setProperty('--y', (2 + (i * 13) % 3) + 'px');
    b.onclick = () => { picked.push({ w, note: '' }); renderGood(w); };
    cloud.appendChild(b);
  });
  const box = $('picked');
  box.innerHTML = '';
  picked.forEach(p => {
    const [bg, ink] = famOf(p.w);
    const d = document.createElement('div');
    d.className = 'good' + (p.w === justAdded ? ' new' : '');
    d.style.background = bg; d.style.color = ink;
    d.innerHTML = `<div class="hd"><span>${esc(p.w)}</span><button type="button" class="x" aria-label="${esc(p.w)} entfernen">×</button></div>
      <input type="text" maxlength="80" placeholder="Wann, mit wem, wobei?" enterkeyhint="done">`;
    const inp = d.querySelector('input');
    inp.value = p.note;
    inp.oninput = () => { p.note = inp.value; };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
    d.querySelector('.x').onclick = () => { picked = picked.filter(q => q !== p); renderGood(); };
    box.appendChild(d);
  });
  const n = picked.length;
  $('goodhint').textContent = n === 0 ? 'Wähle mindestens 3 Gefühle, die dich ansprechen.'
    : n < 3 ? `${n} gewählt, 3 sind schön – an schweren Tagen reicht auch eins.` : `${n} gewählt. Gern noch mehr.`;
  if (justAdded) {
    const last = box.lastElementChild;
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function fill(day) {
  current = day;
  const e = data[day];
  $('date').value = day;
  $('date').max = today();
  const rel = diffDays(day, today());
  $('datehint').textContent = rel === 0 ? 'Heute · ' + fmtLong(day) : rel === 1 ? 'Gestern · ' + fmtLong(day) : fmtLong(day);
  BOOLS.forEach(([k]) => form.elements[k].checked = !!(e && e[k]));
  form.elements.tag.value = e ? e.tag : 5;
  TRI.forEach(([k]) => form.elements[k].value = e ? e[k] : 0);
  $('tagval').textContent = form.elements.tag.value;
  markTri();
  picked = e && Array.isArray(e.gut) ? e.gut.map(g => ({ w: g.w, note: g.note || '' })) : [];
  renderGood();
  $('next').disabled = day >= today();
  $('next').style.opacity = day >= today() ? .3 : 1;
  $('status').textContent = e ? 'Für diesen Tag gibt es schon einen Eintrag – Speichern überschreibt ihn.' : '';
  $('save').textContent = e ? 'Änderungen speichern' : 'Speichern';
}

form.elements.tag.addEventListener('input', () => $('tagval').textContent = form.elements.tag.value);
$('prev').onclick = () => fill(addDays(current, -1));
$('next').onclick = () => { if (current < today()) fill(addDays(current, 1)); };
$('date').onchange = e => { if (e.target.value) fill(e.target.value > today() ? today() : e.target.value); };

form.addEventListener('submit', ev => {
  ev.preventDefault();
  if (!picked.length) {
    toast('Wähle mindestens ein schönes Gefühl');
    $('goodcard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const e = { tag: +form.elements.tag.value, updated: new Date().toISOString() };
  BOOLS.forEach(([k]) => e[k] = form.elements[k].checked);
  TRI.forEach(([k]) => e[k] = +form.elements[k].value);
  e.gut = picked.map(p => ({ w: p.w, note: p.note.trim() }));
  data[current] = e;
  persist();
  fill(current);
  $('status').textContent = 'Gespeichert ✓';
  toast('Gespeichert ✓');
  checkReminder();
});

function checkReminder() {
  const missing = !data[today()];
  const late = new Date().getHours() >= 17;
  $('reminder').hidden = !(missing && late);
}

/* ---------- Auswertung: Hilfen ---------- */
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const NS = 'http://www.w3.org/2000/svg';
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function cycleInfo() {
  // Periodenbeginn = Periodentag ohne Periodentag in den 4 Tagen davor
  const starts = [];
  dates().forEach(d => {
    if (!data[d].periode) return;
    for (let i = 1; i <= 4; i++) { const p = data[addDays(d, -i)]; if (p && p.periode) return; }
    starts.push(d);
  });
  const info = {};
  dates().forEach(d => {
    let since = null, until = null;
    for (const s of starts) { if (s <= d) since = diffDays(s, d) + 1; else { until = diffDays(d, s); break; } }
    if (since !== null && since > 45) since = null;
    if (until !== null && until > 45) until = null;
    info[d] = { since, until };
  });
  return { starts, info };
}

/* ---------- Auswertung: Verlauf ---------- */
let rangeSel = '30', cycleMode = 'since', impactMode = 'same';

function svgEl(w, h) { return { w, h, parts: [] }; }
function renderAuswertung() {
  const ds = dates();
  const hint = $('aw-hint');
  if (!ds.length) {
    hint.hidden = false; hint.textContent = 'Noch keine Einträge. Sobald Daten da sind, erscheinen hier die Kurven.';
  } else if (ds.length < 14) {
    hint.hidden = false; hint.textContent = `Bisher ${ds.length} Einträge. Aussagekräftig wird es ab etwa 2–3 Zyklen (rund 3 Monate).`;
  } else hint.hidden = true;
  verlauf(); zyklus(); einfluss(); gefuehle(); guteGefuehle();
}

/* ---------- Auswertung: Gute Gefühle ---------- */
const PHASES = [
  ['Menstruation (1–5)', 1, 5], ['Follikel (6–11)', 6, 11],
  ['Eisprung-Zeit (12–16)', 12, 16], ['Lutealphase (17+)', 17, 45],
];
const tagHtml = w => { const [bg, ink] = famOf(w); return `<span class="tag" style="background:${bg};color:${ink}">${esc(w)}</span>`; };
function countWords(ds) {
  const c = {};
  ds.forEach(d => (data[d].gut || []).forEach(g => { c[g.w] = (c[g.w] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function guteGefuehle() {
  const ds = dates().filter(d => (data[d].gut || []).length);
  if (!ds.length) {
    $('good').innerHTML = '<p class="muted">Noch keine guten Gefühle eingetragen.</p>';
    $('goodphase').innerHTML = ''; $('moments').innerHTML = '<p class="muted">Hier sammeln sich Katis schöne Momente.</p>';
    return;
  }
  const counts = countWords(ds);
  const max = counts[0][1];
  $('good').innerHTML = counts.slice(0, 12).map(([w, n]) =>
    `<div class="freq"><span>${esc(w)}</span><div class="track"><div class="fill" style="width:${n / max * 100}%;background:${famOf(w)[0]}"></div></div><b>${n}</b></div>`).join('');

  const { info } = cycleInfo();
  $('goodphase').innerHTML = PHASES.map(([name, a, b]) => {
    const pd = ds.filter(d => { const k = info[d].since; return k !== null && k >= a && k <= b; });
    const top = countWords(pd).slice(0, 4);
    return `<div class="phase"><div class="muted small">${name} · ${pd.length} Tage</div><div class="tags">${top.length ? top.map(([w]) => tagHtml(w)).join('') : '<span class="muted small">noch keine Daten</span>'}</div></div>`;
  }).join('');

  const moments = [];
  [...ds].reverse().forEach(d => (data[d].gut || []).forEach(g => { if (g.note) moments.push([d, g]); }));
  $('moments').innerHTML = moments.length
    ? moments.slice(0, 30).map(([d, g]) => `<div class="moment"><span class="when">${fmtShort(d)}</span>${tagHtml(g.w)}<span>${esc(g.note)}</span></div>`).join('')
    : '<p class="muted">Noch keine Notizen zu den Gefühlen.</p>';
}

function verlauf() {
  const ds = dates();
  const box = $('chart-verlauf');
  if (!ds.length) { box.innerHTML = ''; return; }
  const end = today();
  const start = rangeSel === 'all' ? ds[0] : addDays(end, -(+rangeSel - 1));
  const n = diffDays(start, end) + 1;
  const W = 360, H = 200, L = 26, R = 8, T = 10, B = 22;
  const x = i => L + (W - L - R) * (n === 1 ? .5 : i / (n - 1));
  const y = v => T + (H - T - B) * (1 - v / 10);
  const bw = (W - L - R) / Math.max(n - 1, 1);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf der Tagesstimmung">`;
  [0, 5, 10].forEach(v => s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${v}</text>`);
  const pts = [], avg = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i), e = data[d];
    if (e && e.periode) s += `<rect x="${x(i) - bw / 2}" y="${T}" width="${bw}" height="${H - T - B}" fill="${css('--period')}" opacity=".22"/>`;
    if (e) {
      pts.push([i, e.tag]);
      const win = []; for (let k = 0; k < 7; k++) { const q = data[addDays(d, -k)]; if (q) win.push(q.tag); }
      avg.push([i, mean(win)]);
    }
  }
  const path = (arr, maxGap) => { let p = '', prev = -99; arr.forEach(([i, v]) => { p += (i - prev > maxGap ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); prev = i; }); return p; };
  s += `<path d="${path(avg, 3)}" fill="none" stroke="${css('--good')}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${path(pts, 1)}" fill="none" stroke="${css('--accent')}" stroke-width="1.2" opacity=".6"/>`;
  pts.forEach(([i, v]) => s += `<circle cx="${x(i)}" cy="${y(v)}" r="${n > 120 ? 1.8 : 3}" fill="${css('--accent')}"><title>${fmtShort(addDays(start, i))} · ${v}</title></circle>`);
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i, k) => s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}">${fmtShort(addDays(start, i))}</text>`);
  box.innerHTML = s + '</svg>';
}

/* ---------- Auswertung: Zyklus ---------- */
function zyklus() {
  const { starts, info } = cycleInfo();
  const box = $('chart-zyklus'), tbl = $('phasetable');
  const since = cycleMode === 'since';
  $('cycle-desc').textContent = starts.length < 2
    ? `Erkannte Zyklusstarts: ${starts.length}. Für eine sinnvolle Kurve braucht es mindestens zwei (ideal 3+).`
    : `${starts.length} Zyklusstarts erkannt. ` + (since ? 'Ø Tagesstimmung nach Tagen seit Periodenbeginn.' : 'Ø Tagesstimmung nach Tagen bis zur nächsten Periode (PMS-Blick).');
  const buckets = {};
  dates().forEach(d => {
    const k = since ? info[d].since : info[d].until;
    if (k === null || (!since && k < 1)) return;
    (buckets[k] = buckets[k] || []).push(data[d].tag);
  });
  const MAXD = 35, W = 360, H = 190, L = 26, R = 8, T = 10, B = 22;
  const bw = (W - L - R) / MAXD;
  const y = v => T + (H - T - B) * (1 - v / 10);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stimmung im Zyklus">`;
  [0, 5, 10].forEach(v => s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${v}</text>`);
  for (let k = 1; k <= MAXD; k++) {
    const arr = buckets[k]; if (!arr) continue;
    const m = mean(arr);
    const i = since ? k - 1 : MAXD - k;
    const isP = since && k <= 5;
    s += `<rect x="${L + i * bw + 1}" y="${y(m)}" width="${bw - 2}" height="${y(0) - y(m)}" rx="2" fill="${isP ? css('--period') : css('--accent')}" opacity="${Math.min(1, .3 + .2 * arr.length).toFixed(2)}"><title>${since ? 'Tag ' + k : k + ' Tage vor Periode'} · Ø ${f1(m)} · n=${arr.length}</title></rect>`;
  }
  (since ? [1, 7, 14, 21, 28, 35] : [35, 28, 21, 14, 7, 1]).forEach(k => {
    const i = since ? k - 1 : MAXD - k;
    s += `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${since ? k : '−' + k}</text>`;
  });
  box.innerHTML = s + '</svg>';

  // Phasentabelle
  const phases = PHASES;
  let h = '<tr><th>Phase</th><th>n</th><th>Tag</th>' + TRI.map(t => `<th>${t[3]}</th>`).join('') + '</tr>';
  phases.forEach(([name, a, b]) => {
    const es = dates().filter(d => { const k = info[d].since; return k !== null && k >= a && k <= b; }).map(d => data[d]);
    if (!es.length) { h += `<tr><td>${name}</td><td>0</td>${'<td>–</td>'.repeat(6)}</tr>`; return; }
    h += `<tr><td>${name}</td><td>${es.length}</td><td><b>${f1(mean(es.map(e => e.tag)))}</b></td>` +
      TRI.map(([k]) => `<td>${f2(mean(es.map(e => e[k])))}</td>`).join('') + '</tr>';
  });
  tbl.innerHTML = h;
}

/* ---------- Auswertung: Einflussfaktoren ---------- */
function einfluss() {
  const next = impactMode === 'next';
  $('impact-desc').textContent = next
    ? 'Wie war die Tagesstimmung am Tag NACH dem jeweiligen Merkmal?'
    : 'Ø Tagesstimmung an Tagen mit bzw. ohne das Merkmal.';
  const rows = BOOLS.map(([k, label]) => {
    const withV = [], withoutV = [];
    dates().forEach(d => {
      const e = data[d];
      const tgt = next ? data[addDays(d, 1)] : e;
      if (!tgt) return;
      (e[k] ? withV : withoutV).push(tgt.tag);
    });
    return { k, label, withV, withoutV };
  });
  $('impact').innerHTML = rows.map(r => {
    const a = mean(r.withV), b = mean(r.withoutV);
    if (a === null || b === null) {
      return `<div class="factor"><div class="top"><span>${r.label}</span><span class="muted">noch zu wenig Daten</span></div></div>`;
    }
    const dlt = a - b;
    const cls = Math.abs(dlt) < .3 ? '' : dlt > 0 ? 'pos' : 'neg';
    const bar = (lbl, v, n, c) => `<div class="bar ${c}"><span>${lbl}</span><div class="track"><div class="fill" style="width:${v * 10}%"></div></div><span>Ø ${f1(v)} · n=${n}</span></div>`;
    return `<div class="factor"><div class="top"><span>${r.label}</span><span class="diff ${cls}">${dlt > 0 ? '+' : ''}${f1(dlt)}</span></div>
      <div class="bars">${bar('mit', a, r.withV.length, 'with')}${bar('ohne', b, r.withoutV.length, 'without')}</div></div>`;
  }).join('');
}

/* ---------- Auswertung: Gefühle ---------- */
function gefuehle() {
  const ds = dates();
  $('feelings').innerHTML = !ds.length ? '<p class="muted">Noch keine Daten.</p>' : TRI.map(([k, l, r, name]) => {
    const m = mean(ds.map(d => data[d][k]));
    const w = Math.abs(m) * 50;
    const style = m >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
    return `<div class="feel"><span>${name}</span><div class="track"><div class="mid"></div><div class="fill" style="${style}"></div></div><b>${m > 0 ? '+' : ''}${f2(m)}</b></div>`;
  }).join('') + '<p class="muted small">−1 = links (z. B. ängstlich), +1 = rechts (z. B. zuversichtlich).</p>';
}

function segment(id, setter) {
  $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    setter(b.dataset.r || b.dataset.m); renderAuswertung();
  }));
}
segment('range', v => rangeSel = v);
segment('cyclemode', v => cycleMode = v);
segment('impactmode', v => impactMode = v);

/* ---------- Export / Backup / Erinnerung ---------- */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('csv').onclick = () => {
  const head = ['datum', 'periode', 'sport', 'gut_geschlafen', 'wein', 'leichter_start', 'tag_0_10',
    'zuversicht', 'selbstbewusst', 'froehlich', 'unbekuemmert', 'kraftvoll', 'gute_gefuehle', 'notizen'];
  const q = s => /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  const lines = [head.join(';')];
  dates().forEach(d => {
    const e = data[d];
    const gut = e.gut || [];
    lines.push([d, ...BOOLS.map(([k]) => e[k] ? 1 : 0), e.tag, ...TRI.map(([k]) => e[k]),
      q(gut.map(g => g.w).join(', ')), q(gut.filter(g => g.note).map(g => `${g.w}: ${g.note}`).join(' | '))].join(';'));
  });
  download(`stimmung-${today()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
};
$('json').onclick = () => download(`stimmung-backup-${today()}.json`, JSON.stringify(data, null, 1), 'application/json');
$('restore').onchange = async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    const inc = JSON.parse(await f.text());
    if (typeof inc !== 'object' || Array.isArray(inc)) throw 0;
    let n = 0;
    for (const [d, e] of Object.entries(inc)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof e === 'object' && typeof e.tag === 'number') { data[d] = e; n++; }
    }
    persist(); $('count').textContent = dates().length; fill(current);
    toast(`${n} Einträge eingespielt`);
  } catch { toast('Datei nicht lesbar'); }
  ev.target.value = '';
};

$('ics').onclick = () => {
  const t = new Date(); t.setDate(t.getDate() + (t.getHours() >= 18 ? 1 : 0));
  const day = ymd(t).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const url = location.href.split('#')[0].replace(/index\.html$/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stimmungstagebuch//DE', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:stimmung-taeglich@stimmungstagebuch', `DTSTAMP:${stamp}`,
    `DTSTART:${day}T180000`, `DTEND:${day}T181500`, 'RRULE:FREQ=DAILY',
    'SUMMARY:Stimmung eintragen', `DESCRIPTION:Kurz den Tag festhalten.\\n${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'TRIGGER:PT0S', 'ACTION:DISPLAY', 'DESCRIPTION:Stimmung eintragen', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  download('stimmung-erinnerung.ics', ics, 'text/calendar;charset=utf-8');
};

/* ---------- Installieren (Android/Chrome) ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e; $('install').hidden = false;
});
$('install').onclick = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice;
  deferredInstall = null; $('install').hidden = true;
};
window.addEventListener('appinstalled', () => { $('install').hidden = true; toast('App installiert ✓'); });
if (window.matchMedia('(display-mode: standalone)').matches) {
  $('installtext').textContent = 'Die App ist installiert.';
}
// Browser bitten, die Daten nicht automatisch zu löschen
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Start ---------- */
load();
buildTri();
fill(today());
checkReminder();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
