// app.js — UI for Ten. All math lives in time.js.
import * as T from './time.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LS_KEY = 'ten.location.v1';

const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const polar = (r, turns) => [r * Math.sin(turns * 2 * Math.PI), -r * Math.cos(turns * 2 * Math.PI)];
const pad = (n) => String(n).padStart(2, '0');

/* ---------- location ---------- */
function loadLoc() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY));
    if (v && Number.isFinite(v.lon) && Math.abs(v.lon) <= 180) return v;
  } catch { /* ignore */ }
  return null;
}
let loc = loadLoc();
function saveLoc(v) {
  loc = v;
  try { v ? localStorage.setItem(LS_KEY, JSON.stringify(v)) : localStorage.removeItem(LS_KEY); } catch { /* private mode */ }
  sunKey = ''; // force sun recompute
  renderLocUI();
}

/* ---------- dial builders ---------- */
const R_BAND = 172;
const rot = (node, deg) => node.setAttribute('transform', `rotate(${deg.toFixed(3)})`);

/** Ten 10-hour dial. Returns handles for hands and sun shading. */
function buildTenDial(svg, { labels = true, track = true } = {}) {
  el('circle', { class: 'd-face', r: 196 }, svg);
  el('circle', { class: 'd-night', r: R_BAND }, svg);
  const dayArc = el('path', { class: 'd-day', d: '' }, svg);
  for (let i = 0; i < 100; i++) {
    const hour = i % 10 === 0, mid = i % 10 === 5;
    const [x1, y1] = polar(hour ? 150 : mid ? 154 : 157, i / 100);
    const [x2, y2] = polar(162, i / 100);
    el('line', { class: `d-tick${hour ? ' hour' : mid ? ' mid' : ''}`, x1, y1, x2, y2 }, svg);
  }
  for (let h = 0; h < 10; h++) {
    const [x, y] = polar(128, h / 10);
    el('text', { class: `d-num${h === 0 ? ' zero' : ''}`, x, y }, svg).textContent = h;
  }
  if (labels) el('text', { class: 'd-zero-label', x: 0, y: -94 }, svg).textContent = 'Sunset · new day';
  for (const [pos, label] of [[2.5, '12 AM'], [5, '6 AM'], [7.5, 'Noon']]) {
    const [dx, dy] = polar(140, pos / 10); el('circle', { class: 'd-markdot', cx: dx, cy: dy, r: 2.2 }, svg);
    if (labels) { const [x, y] = polar(102, pos / 10); el('text', { class: 'd-mark', x, y }, svg).textContent = label; }
  }
  const rise = el('circle', { class: 'd-sun', r: labels ? 7 : 9, cx: 0, cy: -R_BAND }, svg);
  const setS = el('circle', { class: 'd-sun set', r: labels ? 7 : 9, cx: 0, cy: -R_BAND }, svg);
  const hand = (cls, len, tail) => el('line', { class: `hand ${cls}`, x1: 0, y1: tail, x2: 0, y2: -len }, svg);
  const sd = track ? secTrack(svg, 189, 'shared', 7) : null;
  const h = hand('h', 78, 14), m = hand('m', 118, 18), s = hand('s', 150, 26);
  el('circle', { class: 'hub', r: 6 }, svg);
  return { dayArc, rise, set: setS, R: R_BAND,
    setHands(total) { rot(h, (total / 100000) * 360); rot(m, ((total % 10000) / 10000) * 360); rot(s, ((total % 100) / 100) * 360); if (sd) sd((total % 100) / 100); } };
}

/** Seconds track: a thin ring line, a progress arc from the top to the dot, and a big dot on the line. */
function secTrack(parent, r, kind, dotR) {
  const g = el('g', { class: `sec-track ${kind}` }, parent);
  el('circle', { class: 'st-line', r }, g);
  const arc = el('path', { class: 'st-fill', d: '' }, g);
  const dot = el('circle', { class: 'st-dot', r: dotR, cx: 0, cy: -r }, g);
  let lastD = '';
  return (frac) => {
    const f = T.mod(frac, 1), [x, y] = polar(r, f);
    const d = f < 0.002 ? '' : `M0 ${-r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    if (d !== lastD) { arc.setAttribute('d', d); lastD = d; }
    dot.setAttribute('cx', x.toFixed(2)); dot.setAttribute('cy', y.toFixed(2));
  };
}

/** AM/PM half-ring tints for a noon-at-top traditional dial (PM = right half, AM = left half). */
function ampmHalves(svg, r, sw) {
  el('path', { class: 'half-pm', d: `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}`, 'stroke-width': sw }, svg);
  el('path', { class: 'half-am', d: `M0 ${r}A${r} ${r} 0 0 1 0 ${-r}`, 'stroke-width': sw }, svg);
}
const h12 = (h) => h % 12 || 12;

/** 24-hour analogue dial: noon at top, midnight at bottom (like a sun dial). */
const R24 = 86;
const turns24 = T.regularDialTurns; // 12:00 -> 0 turns (top), midnight at bottom
function build24Dial(svg) {
  el('circle', { class: 'a-face', r: 99 }, svg);
  el('circle', { class: 'a-night', r: R24 }, svg);
  const dayArc = el('path', { class: 'a-day', d: '' }, svg);
  for (let i = 0; i < 96; i++) { // quarter hours
    const hr = i % 4 === 0;
    const [x1, y1] = polar(hr ? 75 : 78, i / 96), [x2, y2] = polar(81, i / 96);
    el('line', { class: `a-tick${hr ? ' hour' : ''}`, x1, y1, x2, y2 }, svg);
  }
  ampmHalves(svg, 64, 24);
  for (let h = 0; h < 24; h++) {
    const [x, y] = polar(64, turns24(h * 3600));
    el('text', { class: `a-num${h % 12 === 0 ? ' major' : h % 2 ? ' odd' : ''}`, x, y }, svg).textContent = h12(h);
  }
  for (const [lab, hr] of [['PM', 15], ['AM', 9]]) {
    const [x, y] = polar(42, turns24(hr * 3600));
    el('text', { class: `a-ampm ${lab.toLowerCase()}`, x, y }, svg).textContent = lab;
  }
  const rise = el('circle', { class: 'd-sun', r: 4.5, cx: 0, cy: -R24 }, svg);
  const setS = el('circle', { class: 'd-sun set', r: 4.5, cx: 0, cy: -R24 }, svg);
  const hand = (cls, len) => el('line', { class: `hand ${cls}`, x1: 0, y1: 8, x2: 0, y2: -len }, svg);
  const h = hand('ah', 44), m = hand('am', 70), s = hand('as', 80);
  const sd = secTrack(svg, 95, 'regular', 4);
  el('circle', { class: 'hub', r: 3.5 }, svg);
  return { dayArc, rise, set: setS, R: R24,
    setHands(sec) { rot(h, turns24(sec) * 360); rot(m, ((sec % 3600) / 3600) * 360); rot(s, ((sec % 60) / 60) * 360); sd((sec % 60) / 60); } };
}

/** Shade a dial's day arc and place sun markers; a, b in turns (0 = top, clockwise). */
function shade(d, a, b) {
  if (a == null) { d.dayArc.setAttribute('d', ''); d.rise.setAttribute('visibility', 'hidden'); d.set.setAttribute('visibility', 'hidden'); return; }
  const span = T.mod(b - a, 1);
  const [x1, y1] = polar(d.R, a), [x2, y2] = polar(d.R, b);
  d.dayArc.setAttribute('d', `M${x1.toFixed(2)} ${y1.toFixed(2)} A${d.R} ${d.R} 0 ${span > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`);
  d.rise.setAttribute('cx', x1.toFixed(2)); d.rise.setAttribute('cy', y1.toFixed(2)); d.rise.removeAttribute('visibility');
  d.set.setAttribute('cx', x2.toFixed(2)); d.set.setAttribute('cy', y2.toFixed(2)); d.set.removeAttribute('visibility');
}

const mainDial = buildTenDial($('dial'));
const tradDial = build24Dial($('analog'));
const exactDial = buildTenDial($('exact-dial'), { track: false }); // no seconds dot for Meridian

/* ---------- formatting ---------- */
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
const zoneShort = (d) => new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || '';
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtYMD = ({ y, m, d }) => dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
const civilDateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
const t12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
const t24 = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const t12en = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

/* ---------- 12h / 24h preference (default 12h, remembered) ---------- */
const FMT_KEY = 'ten.hourFormat.v1';
let hourFmt = (() => { try { return localStorage.getItem(FMT_KEY) === '24' ? '24' : '12'; } catch { return '12'; } })();
const tradHM = (d) => (hourFmt === '24' ? t24 : t12).format(d);
const tenHM = (total) => { const { h, m } = T.splitTen(total); return `${h}:${pad(m)}`; };
function dur(sec) {
  const s = Math.round(Math.abs(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}h ` : '') + `${m}m ${r}s`;
}

/* ---------- sun shading (recomputed when the date or location changes) ---------- */
let sunKey = '';
const SUN = { shared: { rise: '—', set: '—' }, exact: { rise: '—', set: '—' }, regular: { rise: '—', set: '—' }, note: '' };
const sunPlace = (now) => {
  const approx = !(loc && Number.isFinite(loc.lat));
  return { lat: approx ? 40 : loc.lat, lon: loc ? loc.lon : T.zoneCentreLongitude(now), approx };
};
function updateSun(now, tenDate) {
  const p = sunPlace(now);
  const ed = T.exactTenDate(now, p.lon);
  const key = `${tenDate.y}-${tenDate.m}-${tenDate.d}|${ed.y}-${ed.m}-${ed.d}|${p.lat}|${p.lon}`;
  if (key === sunKey) return;
  sunKey = key;
  const s = T.sunTimes(tenDate.y, tenDate.m, tenDate.d, p.lat, p.lon);
  const se = T.sunTimes(ed.y, ed.m, ed.d, p.lat, p.lon);
  const note = p.approx
    ? `Approximate: estimated for your time zone (lat 40°, lon ${p.lon.toFixed(1)}°). Set your location for real sunrise and sunset.`
    : `Real sunrise and sunset at ${p.lat.toFixed(3)}°, ${p.lon.toFixed(3)}° (NOAA algorithm).`;
  SUN.note = note;
  if (!s.sunrise || !s.sunset) {
    [mainDial, tradDial].forEach((d) => shade(d, null));
    const pn = s.polar === 'day' ? 'Polar day: the sun does not set today.' : 'Polar night: the sun does not rise today.';
    SUN.shared = SUN.regular = { rise: '—', set: '—' }; SUN.note = pn;
  } else {
    shade(mainDial, T.sharedTen(s.sunrise) / 100000, T.sharedTen(s.sunset) / 100000);
    shade(tradDial, turns24(T.localSecondsOfDay(s.sunrise)), turns24(T.localSecondsOfDay(s.sunset)));
    SUN.shared = { rise: `${tenHM(T.sharedTen(s.sunrise))} · ${t12.format(s.sunrise)}`, set: `${tenHM(T.sharedTen(s.sunset))} · ${t12.format(s.sunset)}` };
    SUN.regular = { rise: tradHM(s.sunrise), set: tradHM(s.sunset) };
  }
  if (!se.sunrise || !se.sunset) {
    shade(exactDial, null);
    SUN.exact = { rise: '—', set: '—' };
  } else {
    const er = T.exactTen(se.sunrise, p.lon), es = T.exactTen(se.sunset, p.lon);
    shade(exactDial, er / 100000, es / 100000);
    SUN.exact = { rise: `${tenHM(er)} · ${t12.format(se.sunrise)}`, set: `${tenHM(es)} · ${t12.format(se.sunset)}` };
  }
  sliderSun(s, se, p);
}

/* ---------- sky gradient that follows Ten-time (dusk at 0) ---------- */
const SKY = [ // [Ten position, top colour, bottom colour]
  [0, [86, 40, 92], [30, 18, 52]],     // dusk
  [2.5, [14, 20, 52], [5, 8, 22]],     // midnight
  [5, [62, 46, 96], [18, 22, 58]],     // dawn
  [7.5, [28, 68, 128], [12, 26, 64]],  // noon
  [10, [86, 40, 92], [30, 18, 52]],
];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function sky(pos) {
  let i = 0; while (pos > SKY[i + 1][0]) i++;
  const [p0, t0, b0] = SKY[i], [p1, t1, b1] = SKY[i + 1];
  const k = (pos - p0) / (p1 - p0);
  const root = document.documentElement.style;
  root.setProperty('--bg1', `rgb(${mix(t0, t1, k)})`);
  root.setProperty('--bg2', `rgb(${mix(b0, b1, k)})`);
}

/* ---------- main loop ---------- */
const last = {};
const set = (id, text) => { if (last[id] !== text) { last[id] = text; $(id).textContent = text; } };
let lastLive = '', lastSecond = -1;

function frame() {
  const now = new Date();
  const smooth = !reduceMotion.matches;

  // 1. Shared (authority)
  const sh = T.sharedTen(now);
  mainDial.setHands(smooth ? sh : Math.floor(sh));

  // 2. Traditional 24-hour dial
  const ls = T.localSecondsOfDay(now);
  tradDial.setHands(smooth ? ls : Math.floor(ls));

  // 3. Exact (saved meridian, or time-zone centre as an approximation)
  const exLon = loc ? loc.lon : T.zoneCentreLongitude(now);
  const ex = T.exactTen(now, exLon);
  exactDial.setHands(smooth ? ex : Math.floor(ex));
  if (view === 'combined') comboHands({ shared: smooth ? sh : Math.floor(sh), regular: smooth ? ls : Math.floor(ls), exact: smooth ? ex : Math.floor(ex) });

  const sec = Math.floor(sh);
  if (sec !== lastSecond) { lastSecond = sec; slowUpdate(now, sh); }
  requestAnimationFrame(frame);
}

function slowUpdate(now, sh) {
  const shStr = T.formatTen(sh);
  const zl = `${zone}${zoneShort(now) ? ` (${zoneShort(now)})` : ''}`;
  const td = T.sharedTenDate(now);
  updateSun(now, td);
  sliderTick(now);
  sky(T.tenHourPosition(sh));

  // the three readings
  const exLon = loc ? loc.lon : T.zoneCentreLongitude(now), approx = !loc;
  const ex = T.exactTen(now, exLon), ed = T.exactTenDate(now, exLon);
  const h24 = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const h12s = t12en.format(now).replace(/\u202f|\s/g, ' ');
  const regMain = hourFmt === '24' ? h24 : h12s, regSub = hourFmt === '24' ? h12s : `${h24} · 24-hour`;
  const off = T.exactMinusSharedSeconds(now, exLon);
  const offTxt = Math.abs(off) < 0.5 ? 'Same as Shared.'
    : `${dur(off)} ${off < 0 ? 'behind' : 'ahead of'} Shared (${(Math.abs(off) / T.TEN_MINUTE_S).toFixed(1)} Ten-minutes)`;
  const R = {
    shared: { label: `Ten · Shared · ${zl}`, time: shStr, sub: '', date: `Ten date: ${fmtYMD(td)}`,
      note: td.rolled ? 'New day began at sunset hour 0 (6 PM).' : 'The new day begins at 0:00:00, which is 6 PM.' },
    exact: { label: `Meridian · lon ${exLon.toFixed(approx ? 1 : 3)}°${approx ? ' (approx.)' : ''}`, time: `${approx ? '≈' : ''}${T.formatTen(ex)}`,
      sub: approx ? 'Approximate: your time-zone centre. Set your location below.' : offTxt, date: `Ten date: ${fmtYMD(ed)}`,
      note: ed.rolled ? 'New day began at 0 (18:00 mean solar time here).' : 'Same longitude = same Meridian time, north or south.' },
    regular: { label: `Regular · ${zl}`, time: regMain, sub: regSub, date: civilDateFmt.format(now), note: 'The calendar date changes at midnight.' },
  };
  // Combined
  for (const k of ['shared', 'exact', 'regular']) { set(`c-${k}`, R[k].time); set(`c-${k}-date`, R[k].date); }
  set('c-note', td.rolled ? 'Ten date changed at 6 PM (sunset hour 0); the regular date changes at midnight.' : 'Ten days start at 0 = 6 PM; regular days at midnight.');
  // Separate (the picked clock)
  const P = R[pick];
  set('shared-label', view === 'combined' ? `Shared · ${zl}` : P.label);
  set('s-time', P.time); set('s-sub', P.sub); set('s-date', P.date); set('s-note', P.note);
  set('s-rise', SUN[pick].rise); set('s-set', SUN[pick].set);
  set('sun-note', SUN.note);

  // location card
  if (loc) {
    set('exact-offset', `Meridian ${T.formatTen(ex)} at lon ${loc.lon.toFixed(3)}°: ${offTxt}`);
    const app = T.apparentSolarSeconds(now, loc.lon);
    set('exact-true', `True sun (apparent solar): ${T.formatTen(T.tenFromSeconds(app))} · equation of time ${T.equationOfTime(now).toFixed(1)} min`);
  } else {
    set('exact-offset', 'Set your location for your own Meridian time and real sunrise and sunset. Same longitude = same Meridian time, north or south.');
    set('exact-true', '');
  }

  // star clock
  const lon = loc ? loc.lon : T.zoneCentreLongitude(now);
  const g = T.gmstHours(now), l = T.lstHours(now, lon);
  set('gmst', T.formatHMS(g));
  set('lst', `${T.formatHMS(l)}${loc ? '' : ' (approx.)'}`);
  set('lst-ten', T.formatTen(T.starTen(l)));

  // announce once per Ten-minute
  const live = shStr.slice(0, -3);
  if (live !== lastLive) { lastLive = live; $('live').textContent = `Ten time ${live}, ${fmtYMD(td)}`; }
}



/* ---------- One dial: concentric rings (outer Shared Ten, middle 24h, inner Meridian) ---------- */
const VIEW_KEY = 'ten.view.v1', RINGS_KEY = 'ten.rings.v1';
const RING_ORDER = ['shared', 'exact', 'regular']; // outer -> inner
let view = 'combined';
const PICK_KEY = 'ten.pick.v1';
let pick = 'shared';
let rings = { shared: true, regular: true, exact: true };
try {
  // Every launch opens in Combined with all three rings on; only the Separate picker choice is remembered.
  localStorage.removeItem(VIEW_KEY); localStorage.removeItem(RINGS_KEY); // clear older saved state
  const pk = localStorage.getItem(PICK_KEY); if (['shared', 'exact', 'regular'].includes(pk)) pick = pk;
} catch { /* ignore */ }
const combo = $('combo');
let comboParts = { hands: {}, sun: {}, sec: null };
const toTurns = { shared: (v) => v / 100000, regular: (v) => turns24(v), exact: (v) => v / 100000 };

function buildCombo() {
  combo.replaceChildren();
  el('circle', { class: 'd-face', r: 198 }, combo);
  const on = RING_ORDER.filter((k) => rings[k]);
  const bands = T.ringBands(on.length);
  comboParts = { hands: {}, sun: {}, sec: null, secReg: null };
  on.forEach((k, i) => {
    const { rOuter: rO, width: w } = bands[i];
    const g = el('g', { class: `ring ${k}` }, combo);
    if (k === 'regular') ampmHalves(g, rO - w / 2, w); else el('circle', { class: 'r-band', r: rO - w / 2, 'stroke-width': w }, g);
    const rS = rO - w * 0.17, sw = Math.min(w * 0.26, 22);
    el('circle', { class: 'r-night', r: rS, 'stroke-width': sw }, g);
    const dayArc = el('path', { class: 'r-day', d: '', 'stroke-width': sw }, g);
    const ten = k !== 'regular';
    const nT = ten ? 100 : 96;
    for (let t = 0; t < nT; t++) {
      const major = ten ? t % 10 === 0 : t % 4 === 0;
      if (!major && w < 40 && t % (ten ? 5 : 2)) continue;
      const [x1, y1] = polar(rO - w * (major ? 0.36 : 0.28), t / nT), [x2, y2] = polar(rO - w * 0.05, t / nT);
      el('line', { class: `r-tick${major ? ' major' : ''}`, x1, y1, x2, y2 }, g);
    }
    const rN = rO - w * 0.64;
    if (ten) {
      const fs = Math.min(28, w * 0.34);
      for (let h = 0; h < 10; h++) {
        const [x, y] = polar(rN, h / 10);
        el('text', { class: `r-num${h === 0 ? ' zero' : ''}`, x, y, 'font-size': fs }, g).textContent = h;
      }
    } else {
      const fs = Math.min(15, w * 0.23);
      for (let h = 0; h < 24; h++) { // 12-hour numbers, one revolution per day
        const [x, y] = polar(rN, turns24(h * 3600));
        el('text', { class: `r-num${h % 12 === 0 ? ' major' : ''}`, x, y, 'font-size': fs }, g).textContent = h12(h);
      }
      const fa = Math.max(7, Math.min(11, w * 0.15));
      for (const [lab, hr] of [['PM', 15], ['AM', 9]]) {
        const [x, y] = polar(rO - w * 0.9, turns24(hr * 3600));
        el('text', { class: `r-ampm ${lab.toLowerCase()}`, x, y, 'font-size': fa }, g).textContent = lab;
      }
    }
    // fixed day-start mark (Ten 0 = 6 PM): a white diamond on the band edge — distinct from the sun dots
    const zt = ten ? 0 : turns24(18 * 3600), [zx, zy] = polar(rO - w * 0.17, zt), d = Math.min(9, w * 0.16);
    el('path', { class: 'zero-mark', d: `M${zx} ${zy - d}L${zx + d * 0.7} ${zy}L${zx} ${zy + d}L${zx - d * 0.7} ${zy}Z`, transform: `rotate(${zt * 360} ${zx} ${zy})` }, g);
    const sr = Math.max(4, Math.min(7.5, w * 0.12));
    const rise = el('circle', { class: 'd-sun', r: sr, cx: 0, cy: -rS, visibility: 'hidden' }, g);
    const set = el('circle', { class: 'd-sun set', r: sr, cx: 0, cy: -rS, visibility: 'hidden' }, g);
    comboParts.sun[k] = { dayArc, rise, set, R: rS };
    comboParts.hands[k] = T.ringHand(bands[i], i === on.length - 1);
    comboParts.rIn = comboParts.rIn || {}; comboParts.rIn[k] = bands[i].rInner;
  });
  // hands on top, outer ring's (Shared) drawn last so it is most prominent
  [...on].reverse().forEach((k) => {
    const { r1, r2 } = comboParts.hands[k];
    const gh = el('g', { class: `c-hand ${k}` }, combo);
    el('line', { x1: 0, y1: r1 ? -r1 : 10, x2: 0, y2: -r2 }, gh);
    el('circle', { cx: 0, cy: -r2, r: k === 'shared' ? 5 : 4 }, gh);
    comboParts.hands[k].g = gh;
  });
  // seconds tracks on the inner edge of their ring (clear of the sun dots and the 6 PM diamond)
  const dotR = () => 7;
  if (rings.shared) comboParts.sec = secTrack(combo, comboParts.rIn.shared + 5, 'shared', dotR('shared'));
  if (rings.regular) comboParts.secReg = secTrack(combo, comboParts.rIn.regular + 5, 'regular', 5.5);
  el('circle', { class: 'hub', r: 6 }, combo);
  document.querySelectorAll('.ring-sw').forEach((b) => b.setAttribute('aria-pressed', String(rings[b.dataset.ring])));
  paintComboSun();
}

function paintComboSun() {
  if (!SL.sun || !combo.firstChild) return;
  const { s, se, lon } = SL.sun;
  for (const [k, part] of Object.entries(comboParts.sun)) {
    const src = k === 'exact' ? se : s;
    if (!src.sunrise || !src.sunset) { shade(part, null); continue; }
    const f = k === 'shared' ? (d) => T.sharedTen(d) / 1e5 : k === 'regular' ? (d) => turns24(T.localSecondsOfDay(d)) : (d) => T.exactTen(d, lon) / 1e5;
    shade(part, f(src.sunrise), f(src.sunset));
  }
}

function comboHands(v) {
  for (const [k, h] of Object.entries(comboParts.hands)) if (h.g) rot(h.g, toTurns[k](v[k]) * 360);
  if (comboParts.sec) comboParts.sec((v.shared % 100) / 100);
  if (comboParts.secReg) comboParts.secReg((v.regular % 60) / 60);
}

function applyView() {
  document.body.classList.toggle('view-one', view === 'combined');
  document.body.classList.toggle('view-sep', view !== 'combined');
  ['shared', 'exact', 'regular'].forEach((k) => document.body.classList.toggle(`pick-${k}`, pick === k));
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  document.querySelectorAll('[data-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pick === pick)));
  lastSecond = -1; // refresh readouts now
}
document.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
  pick = b.dataset.pick; try { localStorage.setItem(PICK_KEY, pick); } catch { /* ignore */ }
  applyView();
}));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  view = b.dataset.view; // session only
  applyView();
}));
document.querySelectorAll('.ring-sw').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.ring;
  if (rings[k] && RING_ORDER.filter((x) => rings[x]).length === 1) return; // keep at least one ring
  rings[k] = !rings[k];
  buildCombo();
}));
applyView();

/* ---------- Install (PWA) ---------- */
const installBtn = $('install-btn'), iosHint = $('ios-hint');
const standaloneMQ = matchMedia('(display-mode: standalone)');
const isStandalone = () => standaloneMQ.matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvt = null;
function refreshInstall() {
  const show = !isStandalone() && (installEvt || isIOS);
  installBtn.hidden = !show;
  if (!show) iosHint.hidden = true;
}
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; refreshInstall(); });
addEventListener('appinstalled', () => { installEvt = null; refreshInstall(); });
standaloneMQ.addEventListener?.('change', refreshInstall);
installBtn.addEventListener('click', async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch { /* ignore */ } installEvt = null; refreshInstall(); }
  else if (isIOS) iosHint.hidden = !iosHint.hidden;
});
refreshInstall();

/* ---------- Slide time: three linked bars, one slider ---------- */
const SL = { drive: 'shared', live: true, instant: new Date(), sun: null };
const DRIVE_KEY = 'ten.slideBy.v1';
try { const v = localStorage.getItem(DRIVE_KEY); if (['shared', 'regular', 'exact'].includes(v)) SL.drive = v; } catch { /* ignore */ }
const bars = { shared: $('bar-shared'), regular: $('bar-regular'), exact: $('bar-exact') };
const range = $('sl-range');
const slLon = () => (loc ? loc.lon : T.zoneCentreLongitude(SL.instant));
const div = (cls, parent, left) => { const d = document.createElement('div'); d.className = cls; if (left != null) d.style.left = `${left * 100}%`; parent.appendChild(d); return d; };
const fracs = (d) => ({ shared: T.sharedTen(d) / 100000, regular: T.localSecondsOfDay(d) / 86400, exact: T.exactTen(d, slLon()) / 100000 });

function buildBars() {
  for (const [name, bar] of Object.entries(bars)) {
    bar.replaceChildren();
    if (name === 'regular') {
      if (hourFmt === '12') {
        div('half am', bar).appendChild(Object.assign(document.createElement('span'), { textContent: 'AM' }));
        div('half pm', bar).appendChild(Object.assign(document.createElement('span'), { textContent: 'PM' }));
      }
      bar.dataset.day = '1';
      for (let hr = 0; hr <= 24; hr++) div(`tk${hr % 3 === 0 ? ' major' : ''}`, bar, hr / 24);
      const lab12 = ['12 AM', '3', '6', '9', '12 PM', '3', '6', '9', '12 AM'];
      for (let j = 0; j <= 8; j++) {
        const l = div(`lb${j === 0 ? ' edge-l' : j === 8 ? ' edge-r' : ''}`, bar, j / 8);
        if (hourFmt === '12' && j % 4 === 0) { // 12 AM / 12 PM / 12 AM as two lines so they never collide
          l.textContent = '12'; l.classList.add('two');
          l.appendChild(Object.assign(document.createElement('small'), { textContent: j === 4 ? 'PM' : 'AM' }));
        } else l.textContent = hourFmt === '12' ? lab12[j] : String(j * 3);
      }
    } else {
      for (let t = 0; t <= 20; t++) div(`tk${t % 2 === 0 ? ' major' : ''}`, bar, t / 20);
      for (let t = 0; t <= 10; t++) div(`lb${t === 0 ? ' edge-l' : t === 10 ? ' edge-r' : ''}`, bar, t / 10).textContent = t;
    }
    bar._mk = div('mk', bar, 0);
    bar._sun = [];
  }
  if (SL.sun) paintSun();
  placeRange();
}

function sliderSun(s, se, p) { SL.sun = { s, se, lon: p.lon }; paintSun(); paintComboSun(); }
function paintSun() {
  const { s, se, lon } = SL.sun;
  const spans = {
    shared: s.sunrise && [T.sharedTen(s.sunrise) / 1e5, T.sharedTen(s.sunset) / 1e5],
    regular: s.sunrise && [T.localSecondsOfDay(s.sunrise) / 86400, T.localSecondsOfDay(s.sunset) / 86400],
    exact: se.sunrise && [T.exactTen(se.sunrise, lon) / 1e5, T.exactTen(se.sunset, lon) / 1e5],
  };
  for (const [name, bar] of Object.entries(bars)) {
    bar.querySelectorAll('.seg-day, .sun').forEach((n) => n.remove());
    const sp = spans[name]; if (!sp) continue;
    const [a, b] = sp;
    const seg = (l, r) => { const d = div('seg-day', bar, l); d.style.width = `${(r - l) * 100}%`; bar.insertBefore(d, bar.firstChild); };
    if (a <= b) seg(a, b); else { seg(a, 1); seg(0, b); } // wraps across 0
    div('sun', bar, a); div('sun set', bar, b);
    bar.appendChild(bar._mk); // keep marker on top
  }
}

function placeRange() {
  const row = bars[SL.drive].parentElement;
  document.querySelectorAll('.bar-row').forEach((r) => r.classList.toggle('driving', r === row));
  range.style.top = `${bars[SL.drive].offsetTop + 11 - 18}px`; // bar's offsetParent is .bars
  if (SL.drive === 'regular') { range.max = 1435; range.step = 5; range.setAttribute('aria-label', 'Slide regular time, 5-minute steps'); }
  else { range.max = 999; range.step = 1; range.setAttribute('aria-label', `Slide ${SL.drive === 'shared' ? 'Ten' : 'Meridian'} time, 1 Ten-minute steps`); }
  document.querySelectorAll('[data-drive]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.drive === SL.drive)));
  syncRange();
}

function syncRange() {
  const f = fracs(SL.instant)[SL.drive];
  range.value = SL.drive === 'regular' ? Math.round((f * 1440) / 5) * 5 % 1440 : Math.floor(f * 1000 + 1e-9) % 1000;
}

const regStr = (d) => (hourFmt === '24' ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : t12.format(d));
function sliderRender() {
  const d = SL.instant, lon = slLon();
  const e = T.equivalents(d, lon);
  const f = fracs(d);
  for (const [name, bar] of Object.entries(bars)) bar._mk.style.left = `${f[name] * 100}%`;
  const ten = T.formatTen(e.shared), mer = T.formatTen(e.exact), reg = regStr(d);
  const big = { shared: `Ten ${ten}`, regular: reg, exact: `Meridian ${mer}` }[SL.drive];
  set('sl-big', big);
  range.setAttribute('aria-valuetext', big);
  const parts = { shared: `Ten <b>${ten}</b>`, regular: `<b>${reg}</b>`, exact: `Meridian <b>${mer}</b>${loc ? '' : ' (approx.)'}` };
  const order = [SL.drive, ...['regular', 'shared', 'exact'].filter((x) => x !== SL.drive)];
  const html = order.map((k) => parts[k]).join(' = ');
  if (last['sl-eq'] !== html) { last['sl-eq'] = html; $('sl-eq').innerHTML = html; }
  const same = (x, y) => x.y === y.y && x.m === y.m && x.d === y.d;
  const dates = [];
  if (!same(e.regularDate, e.sharedDate) || !same(e.regularDate, e.exactDate)) {
    dates.push(`Regular date ${fmtYMD(e.regularDate)} (starts at midnight)`);
    dates.push(`Ten date ${fmtYMD(e.sharedDate)}`);
    if (!same(e.sharedDate, e.exactDate)) dates.push(`Meridian date ${fmtYMD(e.exactDate)}`);
    dates.push('Ten days start at 0 = 6 PM');
  }
  set('sl-datenote', dates.join(' · '));
  $('sl-now').setAttribute('aria-pressed', String(SL.live));
  $('sl-now').textContent = SL.live ? 'Live' : 'Now';
}

function sliderTick(now) {
  if (!SL.live) { sliderRender(); return; }
  SL.instant = now;
  syncRange();
  sliderRender();
}

range.addEventListener('input', () => {
  const v = +range.value, base = SL.instant;
  SL.live = false;
  SL.instant = SL.drive === 'regular' ? T.regularToInstant(base, v * 60)
    : SL.drive === 'shared' ? T.sharedTenToInstant(base, v * 100)
    : T.exactTenToInstant(base, v * 100, slLon());
  sliderRender();
});
document.querySelectorAll('[data-drive]').forEach((b) => b.addEventListener('click', () => {
  SL.drive = b.dataset.drive;
  try { localStorage.setItem(DRIVE_KEY, SL.drive); } catch { /* ignore */ }
  placeRange(); sliderRender();
}));
$('sl-now').addEventListener('click', () => { SL.live = true; sliderTick(new Date()); });
addEventListener('resize', placeRange);
buildBars();

/* ---------- location UI ---------- */
function renderLocUI() {
  $('loc-clear').hidden = !loc;
  if (loc) {
    $('lon-in').value = loc.lon;
    $('lat-in').value = Number.isFinite(loc.lat) ? loc.lat : '';
    $('geo-btn').textContent = 'Update my location';
  } else {
    $('geo-btn').textContent = 'Set my location';
  }
  lastSecond = -1;
}
$('geo-btn').addEventListener('click', () => {
  const st = $('loc-status');
  if (!('geolocation' in navigator)) { st.textContent = 'Geolocation is not available. Enter your longitude below.'; return; }
  st.textContent = 'Asking your browser for your location…';
  navigator.geolocation.getCurrentPosition(
    (p) => {
      saveLoc({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), src: 'gps' });
      st.textContent = 'Location saved on this device only.';
    },
    (e) => { st.textContent = `Couldn't get your location (${e.message || 'denied'}). Enter your longitude below.`; },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
});
$('loc-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const lon = parseFloat($('lon-in').value), latRaw = $('lat-in').value.trim(), lat = parseFloat(latRaw);
  const st = $('loc-status');
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) { st.textContent = 'Longitude must be between -180 (west) and 180 (east).'; return; }
  if (latRaw && (!Number.isFinite(lat) || Math.abs(lat) > 90)) { st.textContent = 'Latitude must be between -90 and 90.'; return; }
  saveLoc({ lon, lat: latRaw ? lat : undefined, src: 'manual' });
  st.textContent = 'Location saved on this device only.';
});
$('loc-clear').addEventListener('click', () => { saveLoc(null); $('lon-in').value = ''; $('lat-in').value = ''; $('loc-status').textContent = 'Location cleared.'; });

function applyFmt() {
  document.querySelectorAll('.seg [data-fmt]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fmt === hourFmt)));
  sunKey = ''; lastSecond = -1;
  buildBars(); sliderRender();
}
document.querySelectorAll('.seg [data-fmt]').forEach((b) => b.addEventListener('click', () => {
  hourFmt = b.dataset.fmt;
  try { localStorage.setItem(FMT_KEY, hourFmt); } catch { /* private mode */ }
  applyFmt();
}));
applyFmt();

buildCombo();
renderLocUI();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
