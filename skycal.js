// Ten · Sky & time calendar — all on-device, no network, no keys.
// Low-precision Meeus series (sun ~0.01°, moon ~0.05°): event times good to a few minutes.
import { julianDate, mod, gmstHours, sunCalendar } from './time.js';

const DEG = Math.PI / 180;
const DAY = 86400000;
const TT_UT_S = 69; // ΔT ≈ 69 s (2020s)
const wrap180 = (x) => mod(x + 180, 360) - 180;
const jdTT = (ms) => (ms + TT_UT_S * 1000) / DAY + 2440587.5;

/** Sun apparent ecliptic longitude (deg) and distance (AU, Earth centre incl. Moon wobble). */
export function sunEcl(ms) {
  const T = (jdTT(ms) - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M * DEG) + (0.019993 - 0.000101 * T) * Math.sin(2 * M * DEG) + 0.000289 * Math.sin(3 * M * DEG);
  const v = M + C;
  const om = 125.04 - 1934.136 * T;
  const lon = mod(L0 + C - 0.00569 - 0.00478 * Math.sin(om * DEG), 360);
  let R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v * DEG));
  return { lon, R, om };
}

/** Moon geocentric ecliptic longitude/latitude (deg) and distance (km). Meeus ch. 47, main terms. */
export function moonEcl(ms) {
  const T = (jdTT(ms) - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = (297.8501921 + 445267.1114034 * T) * DEG;
  const M = (357.5291092 + 35999.0502909 * T) * DEG;
  const Mp = (134.9633964 + 477198.8675055 * T) * DEG;
  const F = (93.2720950 + 483202.0175233 * T) * DEG;
  const E = 1 - 0.002516 * T;
  const s = Math.sin, c = Math.cos;
  const lon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mp)
    - 0.185116 * E * s(M) - 0.114332 * s(2 * F) + 0.058793 * s(2 * D - 2 * Mp) + 0.057066 * E * s(2 * D - M - Mp)
    + 0.053322 * s(2 * D + Mp) + 0.045758 * E * s(2 * D - M) - 0.040923 * E * s(M - Mp) - 0.034720 * s(D)
    - 0.030383 * E * s(M + Mp) + 0.015327 * s(2 * D - 2 * F) - 0.012528 * s(Mp + 2 * F) + 0.010980 * s(Mp - 2 * F)
    + 0.010675 * s(4 * D - Mp) + 0.010034 * s(3 * Mp) + 0.008548 * s(4 * D - 2 * Mp) - 0.007888 * E * s(2 * D + M - Mp)
    - 0.006766 * E * s(2 * D + M) - 0.005163 * s(Mp - D) + 0.004987 * E * s(D + M) + 0.004036 * E * s(2 * D - M + Mp);
  const lat = 5.128122 * s(F) + 0.280602 * s(Mp + F) + 0.277693 * s(Mp - F) + 0.173237 * s(2 * D - F)
    + 0.055413 * s(2 * D - Mp + F) + 0.046271 * s(2 * D - Mp - F) + 0.032573 * s(2 * D + F) + 0.017198 * s(2 * Mp + F);
  const dist = 385000.56 - 20905.355 * c(Mp) - 3699.111 * c(2 * D - Mp) - 2955.968 * c(2 * D) - 569.925 * c(2 * Mp)
    + 48.888 * E * c(M) - 3.149 * c(2 * F) + 246.158 * c(2 * D - 2 * Mp) - 152.138 * E * c(2 * D - M - Mp)
    - 170.733 * c(2 * D + Mp) - 204.586 * E * c(2 * D - M) - 129.620 * E * c(M - Mp) + 108.743 * c(D) + 104.755 * E * c(M + Mp);
  const om = 125.04 - 1934.136 * T;
  return { lon: mod(lon - 0.00478 * Math.sin(om * DEG), 360), lat, dist };
}

const elong = (ms) => mod(moonEcl(ms).lon - sunEcl(ms).lon, 360);
/** Earth–Sun distance with the Earth–Moon barycentre offset (perihelion/aphelion dates). */
export function earthSunAU(ms) {
  return sunEcl(ms).R + (4671 / 149597870.7) * Math.cos(elong(ms) * DEG);
}

/** Refine an instant where f(ms) (degrees) reaches target, starting near ms0; rate = deg/day. */
function solveAngle(f, target, ms0, rate) {
  let t = ms0;
  for (let i = 0; i < 12; i++) {
    const d = wrap180(target - f(t));
    t += (d / rate) * DAY;
    if (Math.abs(d) < 1e-5) break;
  }
  return t;
}

/** Moon phases (0 new, 180 full) between two instants. */
export function moonPhases(fromMs, toMs) {
  const out = [];
  const syn = 29.530588853;
  // step by quarter-ish spans so we never skip a phase
  for (const target of [0, 180]) {
    let t = fromMs;
    // first estimate: how far until elongation reaches target
    t += (mod(target - elong(t), 360) / 360) * syn * DAY;
    while (t < toMs + 2 * DAY) {
      const ms = solveAngle(elong, target, t, 12.1907);
      if (ms >= fromMs && ms < toMs) {
        const m = moonEcl(ms);
        out.push({ kind: target === 0 ? 'new' : 'full', ms, dist: m.dist });
      }
      t = ms + syn * DAY;
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/** Equinoxes and solstices (sun longitude 0/90/180/270) in a calendar year (UTC). */
export function seasons(year) {
  const out = [];
  for (const [lon, month, name] of [[0, 2, 'march'], [90, 5, 'june'], [180, 8, 'september'], [270, 11, 'december']]) {
    const ms = solveAngle((t) => sunEcl(t).lon, lon, Date.UTC(year, month, 20, 12), 0.9856);
    out.push({ kind: lon % 180 === 0 ? 'equinox' : 'solstice', name, ms });
  }
  return out;
}

/** Perihelion (early Jan) and aphelion (early Jul) of a year, by golden-section search. */
export function apsides(year) {
  const find = (a, b, sign) => {
    const g = (Math.sqrt(5) - 1) / 2;
    let lo = a, hi = b;
    for (let i = 0; i < 60; i++) {
      const x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo);
      if (sign * earthSunAU(x1) < sign * earthSunAU(x2)) hi = x2; else lo = x1;
    }
    return (lo + hi) / 2;
  };
  const p = find(Date.UTC(year, 0, -6), Date.UTC(year, 0, 14), 1);
  const a = find(Date.UTC(year, 6, -6), Date.UTC(year, 6, 16), -1);
  return [{ kind: 'perihelion', ms: p, au: earthSunAU(p) }, { kind: 'aphelion', ms: a, au: earthSunAU(a) }];
}

/**
 * Daylight-saving transitions of the device time zone between two instants.
 * Returns [] for zones without DST. `wall` = local clock time just before the change ("2:00").
 */
export function dstTransitions(fromMs, toMs) {
  const off = (ms) => new Date(ms).getTimezoneOffset();
  const out = [];
  let prev = off(fromMs);
  for (let t = fromMs + DAY; t <= toMs + DAY; t += DAY) {
    const o = off(t);
    if (o !== prev) {
      let lo = t - DAY, hi = t;
      while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (off(mid) === prev) lo = mid; else hi = mid; }
      const at = Math.round(hi / 60000) * 60000;
      if (at >= fromMs && at < toMs) {
        out.push({ kind: o < prev ? 'dstStart' : 'dstEnd', ms: at, shiftMin: prev - o,
          wallBefore: new Date(at - prev * 60000) }); // read with UTC getters
      }
      prev = o;
    }
  }
  return out;
}

/** Major meteor shower peaks (typical night; varies ±1 day year to year). */
export const METEORS = [
  { name: 'Quadrantids', m: 1, d: 3, zhr: 80 },
  { name: 'Lyrids', m: 4, d: 22, zhr: 18 },
  { name: 'Eta Aquariids', m: 5, d: 6, zhr: 50, south: true },
  { name: 'Delta Aquariids', m: 7, d: 30, zhr: 25, south: true },
  { name: 'Perseids', m: 8, d: 12, zhr: 100 },
  { name: 'Draconids', m: 10, d: 8, zhr: 10 },
  { name: 'Orionids', m: 10, d: 21, zhr: 20 },
  { name: 'Leonids', m: 11, d: 17, zhr: 15 },
  { name: 'Geminids', m: 12, d: 14, zhr: 150 },
  { name: 'Ursids', m: 12, d: 22, zhr: 10 },
];

/** Moon illuminated fraction (0..1) at an instant. */
export function moonIllum(ms) {
  return (1 - Math.cos(elong(ms) * DEG)) / 2;
}

// Eclipses 2026–2030 (Fred Espenak, NASA GSFC). t = greatest eclipse (TD ≈ UT + 69 s), dur = partial phase (min).
export const SOLAR_ECLIPSES = [
  ['2026-08-12T17:47:05Z', 'total'], ['2027-02-06T16:00:47Z', 'annular'], ['2027-08-02T10:07:49Z', 'total'],
  ['2028-01-26T15:08:58Z', 'annular'], ['2028-07-22T02:56:39Z', 'total'], ['2029-01-14T17:13:47Z', 'partial'],
  ['2029-06-12T04:06:13Z', 'partial'], ['2029-07-11T15:37:18Z', 'partial'], ['2029-12-05T15:03:57Z', 'partial'],
  ['2030-06-01T06:29:13Z', 'annular'], ['2030-11-25T06:51:37Z', 'total'],
];
export const LUNAR_ECLIPSES = [
  ['2026-08-28T04:14:04Z', 'partial', 198], ['2027-02-20T23:14:06Z', 'penumbral', 0], ['2027-07-18T16:04:09Z', 'penumbral', 0],
  ['2027-08-17T07:14:59Z', 'penumbral', 0], ['2028-01-12T04:14:13Z', 'partial', 56], ['2028-07-06T18:20:57Z', 'partial', 141],
  ['2028-12-31T16:53:15Z', 'total', 209], ['2029-06-26T03:23:22Z', 'total', 220], ['2029-12-20T22:43:12Z', 'total', 213],
  ['2030-06-15T18:34:34Z', 'partial', 144], ['2030-12-09T22:28:51Z', 'penumbral', 0],
];

const eqVec = (lonDeg, latDeg, r, eps) => {
  const l = lonDeg * DEG, b = latDeg * DEG;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(eps) * Math.cos(b) * Math.sin(l) - Math.sin(eps) * Math.sin(b);
  const z = Math.sin(eps) * Math.cos(b) * Math.sin(l) + Math.cos(eps) * Math.sin(b);
  return [x * r, y * r, z * r];
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

/** Topocentric sun & moon geometry at an instant (km, radians). */
function sunMoonTopo(ms, latDeg, lonDeg) {
  const T = (jdTT(ms) - 2451545) / 36525;
  const eps = (23.439291 - 0.0130042 * T) * DEG;
  const s = sunEcl(ms), m = moonEcl(ms);
  const sun = eqVec(s.lon, 0, s.R * 149597870.7, eps);
  const moon = eqVec(m.lon, m.lat, m.dist, eps);
  const th = (gmstHours(new Date(ms)) * 15 + lonDeg) * DEG, ph = latDeg * DEG;
  const up = [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
  const obs = up.map((v) => v * 6371);
  const ts = sub(sun, obs), tm = sub(moon, obs);
  const sep = Math.acos(Math.max(-1, Math.min(1, dot(ts, tm) / (len(ts) * len(tm)))));
  const rs = Math.asin(696000 / len(ts)), rm = Math.asin(1737.4 / len(tm));
  const sunAlt = Math.asin(dot(ts, up) / len(ts)) / DEG;
  const moonAlt = Math.asin(dot(tm, up) / len(tm)) / DEG;
  return { sep, rs, rm, sunAlt, moonAlt };
}

/** How a solar eclipse looks from lat/lon: null if not visible, else { ms, mag, kind }. */
export function solarEclipseLocal(iso, globalKind, latDeg, lonDeg) {
  const t0 = Date.parse(iso) - TT_UT_S * 1000;
  let best = null;
  for (let t = t0 - 4 * 3600e3; t <= t0 + 4 * 3600e3; t += 120e3) {
    const g = sunMoonTopo(t, latDeg, lonDeg);
    if (g.sunAlt < -0.5) continue;
    const mag = (g.rs + g.rm - g.sep) / (2 * g.rs);
    if (mag > 0 && (!best || mag > best.mag)) best = { ms: t, mag, g };
  }
  if (!best || best.mag < 0.01) return null;
  const { g } = best;
  // Low-precision Moon (~0.05°) can't place the narrow central path to the km, so a central
  // eclipse that looks (near-)central here is reported as "near the path".
  const kind = globalKind !== 'partial' && best.mag > 0.97 ? `${globalKind} (near the path)` : 'partial';
  return { ms: best.ms, mag: Math.min(1, best.mag), kind };
}

/** Lunar eclipse from lat/lon: null if the Moon is below the horizon throughout. */
export function lunarEclipseLocal(iso, kind, durMin, latDeg, lonDeg) {
  const t0 = Date.parse(iso) - TT_UT_S * 1000;
  const half = (durMin ? durMin / 2 : 60) * 60e3; // penumbral: ±1 h around greatest
  let up = 0, n = 0, atMax = false;
  for (let t = t0 - half; t <= t0 + half; t += 5 * 60e3) {
    n++;
    const a = sunMoonTopo(t, latDeg, lonDeg).moonAlt;
    if (a > 0) up++;
    if (Math.abs(t - t0) < 2.5 * 60e3 && a > 0) atMax = true;
  }
  if (!up) return null;
  return { ms: t0, kind, whole: up === n, atMax };
}

const FULL_NAMES = ['Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry', 'Buck', 'Sturgeon', 'Corn', "Hunter's", 'Beaver', 'Cold'];

/**
 * Upcoming sky & time events for a place, sorted, with whole days to go (local calendar).
 * Each: { kind, icon, label, ms|date{y,m,d}, inDays, ...extra }.
 */
export function skyEvents(now, latDeg, lonDeg, { horizonDays = 400, eclipseYears = 4 } = {}) {
  const nowMs = now.getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = today + horizonDays * DAY;
  const daysTo = (ms) => { const d = new Date(ms); return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today) / DAY); };
  const ev = [];
  const push = (e) => { if (e.ms >= today && e.ms < (e.far ? today + eclipseYears * 365 * DAY : end)) ev.push({ ...e, inDays: daysTo(e.ms) }); };
  const y0 = now.getFullYear();

  // Seasons (+ fold the longest/shortest-day length into the matching solstice)
  const cals = [y0, y0 + 1].map((y) => sunCalendar(y, latDeg, lonDeg, now));
  for (const y of [y0, y0 + 1]) {
    for (const s of seasons(y)) {
      const nm = s.name[0].toUpperCase() + s.name.slice(1);
      const cal = cals[y - y0];
      let extra = null;
      if (s.kind === 'solstice' && !cal.notes.polar) {
        const d = new Date(s.ms);
        for (const x of [cal.longest, cal.shortest]) {
          if (x && Math.abs(new Date(x.y, x.m - 1, x.d) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) <= 3 * DAY) extra = x;
        }
      }
      push({ kind: s.kind, icon: s.kind === 'solstice' ? '☀️' : '🌓', label: `${nm} ${s.kind}`, ms: s.ms,
        dayLen: extra ? extra.len : null, longest: extra ? extra === cal.longest : null });
    }
    const cal = cals[y - y0];
    if (!cal.notes.equator) for (const e of cal.equal) push({ kind: 'equal', icon: '🌅', label: 'Equal day & night', ms: new Date(e.y, e.m - 1, e.d, 12).getTime(), rise: e.rise, set: e.set, dayLen: e.len, dateOnly: true });
    for (const e of cal.eotZero) push({ kind: 'eotZero', icon: '🕛', label: 'Sun on Meridian noon', ms: new Date(e.y, e.m - 1, e.d, 12).getTime(), dateOnly: true });
    for (const a of apsides(y)) push({ kind: a.kind, icon: '🌍', label: a.kind === 'perihelion' ? 'Perihelion · Earth closest to the sun' : 'Aphelion · Earth farthest from the sun', ms: a.ms, au: a.au, dateOnly: true });
  }

  // Daylight saving (device zone)
  for (const t of dstTransitions(today - DAY, end)) push({ ...t, icon: '🕑', label: t.kind === 'dstStart' ? 'Daylight saving starts' : 'Daylight saving ends' });

  // Moon phases (+ names, blue moon, harvest/hunter's, supermoon)
  const phases = moonPhases(today - 40 * DAY, end + 40 * DAY);
  const sept = (y) => seasons(y)[2].ms;
  const fulls = phases.filter((p) => p.kind === 'full');
  const harvest = new Set();
  for (const y of [y0 - 1, y0, y0 + 1, y0 + 2]) {
    const eq = sept(y);
    let best = null;
    for (const f of fulls) if (!best || Math.abs(f.ms - eq) < Math.abs(best.ms - eq)) best = f;
    if (best && Math.abs(best.ms - eq) < 20 * DAY) harvest.add(best.ms);
  }
  for (const p of phases) {
    const d = new Date(p.ms);
    const superMoon = p.dist < 361000;
    if (p.kind === 'new') { push({ kind: 'new', icon: '🌑', label: 'New moon', ms: p.ms }); continue; }
    let name = `${FULL_NAMES[d.getMonth()]} Moon`;
    const i = fulls.indexOf(p), prev = fulls[i - 1];
    if (harvest.has(p.ms)) name = 'Harvest Moon';
    else if (prev && harvest.has(prev.ms)) name = "Hunter's Moon";
    const pd = prev && new Date(prev.ms);
    const blue = pd && pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
    push({ kind: 'full', icon: '🌕', label: `Full moon · ${name}${blue ? ' (blue moon)' : ''}`, ms: p.ms, superMoon, distKm: p.dist });
  }

  // Meteor showers (peak night, Moon brightness at ~1 AM)
  for (const y of [y0, y0 + 1]) {
    for (const s of METEORS) {
      const night = new Date(y, s.m - 1, s.d, 22).getTime();
      const illum = moonIllum(new Date(y, s.m - 1, s.d + 1, 1).getTime());
      push({ kind: 'meteor', icon: '🌠', label: `${s.name} peak`, ms: night, zhr: s.zhr, moon: illum, dateOnly: true,
        note: latDeg < -10 || !s.south ? '' : 'best from the south' });
    }
  }

  // Eclipses visible here (next few years)
  for (const [iso, k] of SOLAR_ECLIPSES) {
    if (Date.parse(iso) < today) continue;
    const v = solarEclipseLocal(iso, k, latDeg, lonDeg);
    if (v) push({ kind: 'solarEclipse', icon: '🌘', label: `Solar eclipse · ${v.kind}${v.kind === 'partial' ? ` (~${Math.round(v.mag * 100)}%)` : ''}`, ms: v.ms, far: true, globalKind: k, mag: v.mag });
  }
  for (const [iso, k, dur] of LUNAR_ECLIPSES) {
    if (Date.parse(iso) < today) continue;
    const v = lunarEclipseLocal(iso, k, dur, latDeg, lonDeg);
    if (v) push({ kind: 'lunarEclipse', icon: '🔴', label: `Lunar eclipse · ${k}${v.whole ? '' : ' (partly visible)'}`, ms: v.ms, far: true });
  }

  ev.sort((a, b) => a.ms - b.ms);
  // the next upcoming (or ongoing today) gets the highlight
  const next = ev.find((e) => e.dateOnly ? e.inDays >= 0 : e.ms >= nowMs) || null;
  return { events: ev.filter((e) => e.inDays >= 0 && (e.dateOnly || e.ms >= nowMs - 6 * 3600e3)), next };
}
