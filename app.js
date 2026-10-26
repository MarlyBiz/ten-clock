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
function buildTenDial(svg, { labels = true } = {}) {
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
  const h = hand('h', 78, 14), m = hand('m', 118, 18), s = hand('s', 150, 26);
  el('circle', { class: 'hub', r: 6 }, svg);
  return { dayArc, rise, set: setS, R: R_BAND,
    setHands(total) { rot(h, (total / 100000) * 360); rot(m, ((total % 10000) / 10000) * 360); rot(s, ((total % 100) / 100) * 360); } };
}

/** 24-hour analogue dial: noon at top, midnight at bottom (like a sun dial). */
const R24 = 86;
const turns24 = (sec) => T.mod(sec / 86400 - 0.5, 1); // 12:00 -> 0 turns (top)
function build24Dial(svg) {
  el('circle', { class: 'a-face', r: 99 }, svg);
  el('circle', { class: 'a-night', r: R24 }, svg);
  const dayArc = el('path', { class: 'a-day', d: '' }, svg);
  for (let i = 0; i < 96; i++) { // quarter hours
    const hr = i % 4 === 0;
    const [x1, y1] = polar(hr ? 75 : 78, i / 96), [x2, y2] = polar(81, i / 96);
    el('line', { class: `a-tick${hr ? ' hour' : ''}`, x1, y1, x2, y2 }, svg);
  }
  for (let h = 0; h < 24; h++) {
    const [x, y] = polar(64, turns24(h * 3600));
    el('text', { class: `a-num${h % 6 === 0 ? ' major' : h % 2 ? ' odd' : ''}`, x, y }, svg).textContent = h;
  }
  const rise = el('circle', { class: 'd-sun', r: 4.5, cx: 0, cy: -R24 }, svg);
  const setS = el('circle', { class: 'd-sun set', r: 4.5, cx: 0, cy: -R24 }, svg);
  const hand = (cls, len) => el('line', { class: `hand ${cls}`, x1: 0, y1: 8, x2: 0, y2: -len }, svg);
  const h = hand('ah', 44), m = hand('am', 70), s = hand('as', 80);
  el('circle', { class: 'hub', r: 3.5 }, svg);
  return { dayArc, rise, set: setS, R: R24,
    setHands(sec) { rot(h, turns24(sec) * 360); rot(m, ((sec % 3600) / 3600) * 360); rot(s, ((sec % 60) / 60) * 360); } };
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
const exactDial = buildTenDial($('exact-dial'), { labels: false });

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
  if (!s.sunrise || !s.sunset) {
    [mainDial, tradDial].forEach((d) => shade(d, null));
    $('sunrise').textContent = '—'; $('sunset').textContent = '—';
    $('sun-note').textContent = s.polar === 'day' ? 'Polar day: the sun does not set today.' : 'Polar night: the sun does not rise today.';
  } else {
    shade(mainDial, T.sharedTen(s.sunrise) / 100000, T.sharedTen(s.sunset) / 100000);
    shade(tradDial, turns24(T.localSecondsOfDay(s.sunrise)), turns24(T.localSecondsOfDay(s.sunset)));
    $('sunrise').textContent = `${tenHM(T.sharedTen(s.sunrise))} · ${t12.format(s.sunrise)}`;
    $('sunset').textContent = `${tenHM(T.sharedTen(s.sunset))} · ${t12.format(s.sunset)}`;
    $('sun-note').textContent = note;
    $('trad-sun').textContent = `Sunrise ${tradHM(s.sunrise)} · Sunset ${tradHM(s.sunset)}${p.approx ? ' (approx.)' : ''}`;
  }
  if (!se.sunrise || !se.sunset) {
    shade(exactDial, null);
    $('ex-sunrise').textContent = '—'; $('ex-sunset').textContent = '—';
    $('ex-sun-note').textContent = se.polar === 'day' ? 'Polar day.' : 'Polar night.';
  } else {
    const er = T.exactTen(se.sunrise, p.lon), es = T.exactTen(se.sunset, p.lon);
    shade(exactDial, er / 100000, es / 100000);
    $('ex-sunrise').textContent = `${tenHM(er)} · ${t12.format(se.sunrise)}`;
    $('ex-sunset').textContent = `${tenHM(es)} · ${t12.format(se.sunset)}`;
    $('ex-sun-note').textContent = p.approx ? 'Approximate (time-zone centre, lat 40°). Set your location for your real sun.' : 'Your real sunrise and sunset, in your meridian\'s Ten time.';
  }
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

  const sec = Math.floor(sh);
  if (sec !== lastSecond) { lastSecond = sec; slowUpdate(now, sh); }
  requestAnimationFrame(frame);
}

function slowUpdate(now, sh) {
  const shStr = T.formatTen(sh);
  set('shared-time', shStr);
  set('shared-label', `Shared · ${zone}${zoneShort(now) ? ` (${zoneShort(now)})` : ''}`);
  const td = T.sharedTenDate(now);
  set('shared-date', `Ten date: ${fmtYMD(td)}`);
  set('shared-rollnote', td.rolled
    ? 'New day began at sunset hour 0 (6 PM).'
    : 'The new day begins at 0:00:00, which is 6 PM.');
  updateSun(now, td);
  sky(T.tenHourPosition(sh));

  // traditional
  const h24 = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const h12 = t12en.format(now).replace(/\u202f|\s/g, ' ');
  set('trad-time', hourFmt === '24' ? h24 : h12);
  set('trad-ampm', hourFmt === '24' ? h12 : `${h24} · 24-hour`);
  set('trad-date', civilDateFmt.format(now));
  set('trad-12', 'The calendar date changes at midnight (bottom of the dial).');

  // exact
  if (loc) {
    const ex = T.exactTen(now, loc.lon);
    set('exact-time', T.formatTen(ex));
    set('exact-date', `Ten date: ${fmtYMD(T.exactTenDate(now, loc.lon))} · lon ${loc.lon.toFixed(3)}°`);
    const d = T.exactMinusSharedSeconds(now, loc.lon);
    set('exact-offset', Math.abs(d) < 0.5 ? 'Same as Shared.'
      : `${dur(d)} ${d < 0 ? 'behind' : 'ahead of'} Shared (${(Math.abs(d) / T.TEN_MINUTE_S).toFixed(1)} Ten-minutes)`);
    const app = T.apparentSolarSeconds(now, loc.lon);
    set('exact-true', `True sun (apparent solar): ${T.formatTen(T.tenFromSeconds(app))} · equation of time ${T.equationOfTime(now).toFixed(1)} min`);
  } else {
    const lon = T.zoneCentreLongitude(now), ex = T.exactTen(now, lon);
    set('exact-time', `≈${T.formatTen(ex)}`);
    set('exact-date', `Approximate, for your time-zone centre (lon ${lon.toFixed(1)}°). Set your location below.`);
    set('exact-offset', 'Same longitude = same Exact time, north or south.');
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
}
document.querySelectorAll('.seg [data-fmt]').forEach((b) => b.addEventListener('click', () => {
  hourFmt = b.dataset.fmt;
  try { localStorage.setItem(FMT_KEY, hourFmt); } catch { /* private mode */ }
  applyFmt();
}));
applyFmt();

renderLocUI();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
