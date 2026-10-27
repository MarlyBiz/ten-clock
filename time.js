// time.js — all of Ten's math. Pure ES module: no DOM, importable by Node tests.
//
// Units: 1 Ten-day = 10 Ten-hours = 1,000 Ten-minutes = 100,000 Ten-seconds.
// 1 Ten-second = 86400 / 100000 = 0.864 SI seconds. Hour 0 (sunset, new day) = 18:00.

export const DAY_S = 86400;
export const TEN_SECOND_S = 0.864;          // SI seconds per Ten-second
export const TEN_MINUTE_S = 86.4;           // SI seconds per Ten-minute
export const TEN_HOUR_S = 8640;             // SI seconds per Ten-hour (2h 24m)
export const ZERO_OFFSET_S = 18 * 3600;     // Ten 0:00:00 = 18:00 (traditional 6 PM)
export const SIDEREAL_DAY_S = 86164.0905;   // Earth's spin relative to the stars

const DEG = Math.PI / 180;
export const mod = (a, n) => ((a % n) + n) % n;

/* ---------- Ten conversions ---------- */

/** Traditional seconds-of-day (0..86400) -> total Ten-seconds since sunset/zero (0..100000). */
export function tenFromSeconds(secOfDay) {
  return mod(secOfDay - ZERO_OFFSET_S, DAY_S) / TEN_SECOND_S;
}

/** Split total Ten-seconds into {h, m, s, frac}. Rounds away float noise below 1 µs. */
export function splitTen(total) {
  let t = Math.round(total * 1e6) / 1e6;
  t = mod(t, 100000);
  const whole = Math.floor(t);
  return { h: Math.floor(whole / 10000), m: Math.floor(whole / 100) % 100, s: whole % 100, frac: t - whole, total: t };
}

export function formatTen(total) {
  const { h, m, s } = splitTen(total);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Ten-time as a position on the dial in hours (0..10), e.g. 7.5 = noon. */
export const tenHourPosition = (total) => mod(total, 100000) / 10000;

/** Local (browser time-zone) seconds of day for a Date, DST included. */
export function localSecondsOfDay(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
}

export function utcSecondsOfDay(date) {
  return mod(date.getTime() / 1000, DAY_S);
}

/** Shared Ten: based on the civil clock of the current time zone. */
export const sharedTen = (date) => tenFromSeconds(localSecondsOfDay(date));

/** Local mean solar time (seconds of day) at a longitude (east positive): UTC + lon/15 h. */
export function lmstSeconds(date, lonDeg) {
  return mod(utcSecondsOfDay(date) + lonDeg * 240, DAY_S);
}

/** Exact Ten: local mean solar time at your meridian. Depends on longitude only. */
export const exactTen = (date, lonDeg) => tenFromSeconds(lmstSeconds(date, lonDeg));

/** Signed difference Exact − Shared in SI seconds, wrapped to ±12 h. */
export function exactMinusSharedSeconds(date, lonDeg) {
  const d = lmstSeconds(date, lonDeg) - localSecondsOfDay(date);
  return mod(d + DAY_S / 2, DAY_S) - DAY_S / 2;
}

/* ---------- Ten date (the new day begins at 0 = sunset/18:00) ---------- */

/** Ten date from a civil date + seconds of day: at/after 18:00 it's already the next date. */
export function tenDateFromCivil(y, m, d, secOfDay) {
  const add = secOfDay >= ZERO_OFFSET_S ? 1 : 0;
  const t = new Date(Date.UTC(y, m - 1, d + add));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), rolled: add === 1 };
}

/** Shared Ten date (time-zone civil calendar). */
export function sharedTenDate(date) {
  return tenDateFromCivil(date.getFullYear(), date.getMonth() + 1, date.getDate(), localSecondsOfDay(date));
}

/** Exact Ten date (mean-solar calendar at your longitude). */
export function exactTenDate(date, lonDeg) {
  const t = new Date(date.getTime() + lonDeg * 240000);
  return tenDateFromCivil(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), utcSecondsOfDay(t));
}

/* ---------- Star clock ---------- */

export const julianDate = (date) => date.getTime() / 86400000 + 2440587.5;

/** Greenwich mean sidereal time in hours (IAU formula, Meeus 12.4). */
export function gmstHours(date) {
  const D = julianDate(date) - 2451545.0;
  const T = D / 36525;
  const deg = 280.46061837 + 360.98564736629 * D + 0.000387933 * T * T - (T * T * T) / 38710000;
  return mod(deg, 360) / 15;
}

/** Local mean sidereal time in hours. */
export const lstHours = (date, lonDeg) => mod(gmstHours(date) + lonDeg / 15, 24);

/** Sidereal hours (0..24) -> "Star Ten" total units (sidereal day / 100000). */
export const starTen = (siderealHours) => (siderealHours / 24) * 100000;

export function formatHMS(hours, withFrac = false) {
  let s = mod(hours, 24) * 3600;
  if (!withFrac) s = Math.floor(s + 1e-6);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const ss = withFrac ? sec.toFixed(4).padStart(7, '0') : String(Math.floor(sec)).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${ss}`;
}

/* ---------- Sun (NOAA solar calculator algorithm) ---------- */

function solarAt(jd) {
  const jc = (jd - 2451545) / 36525;
  const L = mod(280.46646 + jc * (36000.76983 + jc * 0.0003032), 360);
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = Math.sin(M * DEG) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
          + Math.sin(2 * M * DEG) * (0.019993 - 0.000101 * jc)
          + Math.sin(3 * M * DEG) * 0.000289;
  const omega = 125.04 - 1934.136 * jc;
  const appLong = L + C - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  const obliq0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(omega * DEG);
  const decl = Math.asin(Math.sin(obliq * DEG) * Math.sin(appLong * DEG)) / DEG;
  const y = Math.tan((obliq / 2) * DEG) ** 2;
  const eot = 4 / DEG * (y * Math.sin(2 * L * DEG) - 2 * e * Math.sin(M * DEG)
          + 4 * e * y * Math.sin(M * DEG) * Math.cos(2 * L * DEG)
          - 0.5 * y * y * Math.sin(4 * L * DEG) - 1.25 * e * e * Math.sin(2 * M * DEG));
  return { decl, eot }; // degrees, minutes
}

/** Equation of time in minutes (apparent − mean solar time). */
export const equationOfTime = (date) => solarAt(julianDate(date)).eot;

/** Apparent ("true sun") solar time, seconds of day. */
export const apparentSolarSeconds = (date, lonDeg) => mod(lmstSeconds(date, lonDeg) + equationOfTime(date) * 60, DAY_S);

/**
 * Sunrise, solar noon and sunset for a calendar date (y, m, d) at lat/lon (east +).
 * Returns Dates (or null for polar day/night). Refined by iteration at the event time.
 */
export function sunTimes(y, m, d, latDeg, lonDeg) {
  const day0 = Date.UTC(y, m - 1, d);
  const jd0 = day0 / 86400000 + 2440587.5;
  const event = (sign) => {
    let mins = 720 - 4 * lonDeg; // first guess
    for (let i = 0; i < 3; i++) {
      const { decl, eot } = solarAt(jd0 + mins / 1440);
      const noon = 720 - 4 * lonDeg - eot;
      if (sign === 0) { mins = noon; continue; }
      const c = Math.cos(90.833 * DEG) / (Math.cos(latDeg * DEG) * Math.cos(decl * DEG))
              - Math.tan(latDeg * DEG) * Math.tan(decl * DEG);
      if (c < -1 || c > 1) return { date: null, polar: c < -1 ? 'day' : 'night' };
      mins = noon + sign * 4 * (Math.acos(c) / DEG);
    }
    return { date: new Date(day0 + mins * 60000), polar: null };
  };
  const rise = event(-1), set = event(1), noon = event(0);
  return { sunrise: rise.date, sunset: set.date, noon: noon.date, polar: rise.polar || set.polar };
}

/**
 * On-device sun calendar for a civil year at lat/lon (NOAA 90.833° zenith).
 * Equal day/night ≈ 12h daylight; EOT zeros = sun on Meridian noon; solstices by day length.
 * Southern hemisphere: longest/shortest fall out of the scan (Dec/Jun swapped).
 */
export function sunCalendar(year, latDeg, lonDeg, now = new Date()) {
  const days = [];
  let polarDays = 0;
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 31; d++) {
      const probe = new Date(year, m - 1, d);
      if (probe.getMonth() !== m - 1) continue;
      const st = sunTimes(year, m, d, latDeg, lonDeg);
      // EOT at ~17:00 UTC ≈ midday US — stable enough for zero crossings
      const eot = solarAt(julianDate(new Date(Date.UTC(year, m - 1, d, 17)))).eot;
      if (!st.sunrise || !st.sunset) {
        polarDays++;
        days.push({ y: year, m, d, len: null, eot, rise: null, set: null, polar: st.polar });
        continue;
      }
      const len = (st.sunset.getTime() - st.sunrise.getTime()) / 3.6e6;
      days.push({ y: year, m, d, len, eot, rise: st.sunrise, set: st.sunset, polar: null });
    }
  }
  const lit = days.filter((x) => x.len != null);
  const southHem = latDeg < 0;
  const notes = {};
  if (lit.length < 20) notes.polar = 'No sunrise/sunset for much of the year here.';
  if (lit.length >= 2) {
    const lens = lit.map((x) => x.len);
    const span = Math.max(...lens) - Math.min(...lens);
    if (Math.abs(latDeg) < 5 || span < 0.4) notes.equator = 'Day length stays near 12h year-round here.';
  }

  // Equal day/night: two dates closest to 12h, one in each half-year when possible
  let equal = [];
  if (lit.length && !notes.equator) {
    const spring = lit.filter((x) => x.m <= 6).sort((a, b) => Math.abs(a.len - 12) - Math.abs(b.len - 12))[0];
    const autumn = lit.filter((x) => x.m >= 7).sort((a, b) => Math.abs(a.len - 12) - Math.abs(b.len - 12))[0];
    equal = [spring, autumn].filter(Boolean).sort((a, b) => a.m - b.m || a.d - b.d);
    if (equal.length < 2) {
      equal = [...lit].sort((a, b) => Math.abs(a.len - 12) - Math.abs(b.len - 12)).slice(0, 2)
        .sort((a, b) => a.m - b.m || a.d - b.d);
    }
  }

  // EOT zeros: sign changes (or exact 0)
  const eotZero = [];
  for (let i = 1; i < days.length; i++) {
    const a = days[i - 1].eot, b = days[i].eot;
    if (a === 0 || a * b < 0 || (a * b === 0 && b === 0)) {
      const pick = Math.abs(a) <= Math.abs(b) ? days[i - 1] : days[i];
      if (!eotZero.length || pick.m !== eotZero[eotZero.length - 1].m || pick.d !== eotZero[eotZero.length - 1].d)
        eotZero.push(pick);
    }
  }

  let eotMax = null, eotMin = null;
  for (const x of days) {
    if (!eotMax || x.eot > eotMax.eot) eotMax = x;
    if (!eotMin || x.eot < eotMin.eot) eotMin = x;
  }

  let longest = null, shortest = null;
  for (const x of lit) {
    if (!longest || x.len > longest.len) longest = x;
    if (!shortest || x.len < shortest.len) shortest = x;
  }

  const pack = (x, kind) => x && ({
    kind, y: x.y, m: x.m, d: x.d,
    len: x.len, eot: x.eot, rise: x.rise, set: x.set, polar: x.polar || null,
  });

  const events = [];
  for (const x of equal) events.push(pack(x, 'equal'));
  for (const x of eotZero) events.push(pack(x, 'eotZero'));
  if (longest) events.push(pack(longest, 'longest'));
  if (shortest) events.push(pack(shortest, 'shortest'));

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const withDays = events.map((e) => {
    let t = new Date(e.y, e.m - 1, e.d).getTime();
    let inDays = Math.round((t - start) / 86400000);
    let y = e.y;
    if (inDays < 0) {
      // roll to next year same month/day for "next" hint
      t = new Date(now.getFullYear() + 1, e.m - 1, e.d).getTime();
      inDays = Math.round((t - start) / 86400000);
      y = now.getFullYear() + 1;
    }
    return { ...e, y, inDays };
  }).sort((a, b) => a.inDays - b.inDays);
  const next = withDays[0] || null;

  return {
    year, southHem, notes,
    equal: equal.map((x) => pack(x, 'equal')),
    eotZero: eotZero.map((x) => pack(x, 'eotZero')),
    eotMax: pack(eotMax, 'eotMax'),
    eotMin: pack(eotMin, 'eotMin'),
    longest: pack(longest, 'longest'),
    shortest: pack(shortest, 'shortest'),
    next,
  };
}

/** Approximate centre longitude of the browser's standard time zone (no DST). */
export function zoneCentreLongitude(date = new Date()) {
  const y = date.getFullYear();
  const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  return -std / 4;
}

/* ---------- Slider conversions: a value on one scale -> an instant ---------- */
// Each takes a reference instant `base` and keeps you in the same day *of that scale*
// (civil day for Regular, Ten day for Shared/Exact), so dragging never jumps a day.

/** Regular (civil) seconds of day on base's civil date -> Date. Uses wall-clock (DST-aware). */
export function regularToInstant(base, secOfDay) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, Math.round(secOfDay * 1000));
}

/** Shared Ten (total Ten-seconds) in base's Shared Ten day -> Date. Ten day D starts 18:00 on D−1. */
export function sharedTenToInstant(base, tenTotal) {
  const td = sharedTenDate(base);
  const ms = Math.round((ZERO_OFFSET_S + mod(tenTotal, 100000) * TEN_SECOND_S) * 1000);
  return new Date(td.y, td.m - 1, td.d - 1, 0, 0, 0, ms);
}

/** Exact Ten (total Ten-seconds) in base's Exact Ten day at lonDeg -> Date. */
export function exactTenToInstant(base, tenTotal, lonDeg) {
  const td = exactTenDate(base, lonDeg);
  const startLmst = Date.UTC(td.y, td.m - 1, td.d - 1) + ZERO_OFFSET_S * 1000; // 18:00 LMST, expressed as if UTC
  return new Date(startLmst - lonDeg * 240000 + Math.round(mod(tenTotal, 100000) * TEN_SECOND_S * 1000));
}

/* ---------- Typed time entry ---------- */

/** Parse Ten / Meridian time: H:MM[:SS] with H 0–9, MM/SS 00–99. Forgiving ('930'→9:30, '7:5'→7:05). */
export function parseTenTime(raw) {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!s) return { ok: false };
  let h, m, sec = 0;
  if (/^\d{1,6}$/.test(s)) {
    // Compact: H, HMM, HMMSS, or HHMMSS with single-digit hour preferred
    if (s.length <= 1) { h = +s; m = 0; }
    else if (s.length === 2) { h = +s[0]; m = +s.slice(1); } // 30 → invalid hour later if used as 3:0 — treat as H+M: '30' → 3:0
    else if (s.length === 3) { h = +s[0]; m = +s.slice(1); } // 930 → 9:30
    else if (s.length === 4) { h = +s[0]; m = +s.slice(1, 3); sec = +s.slice(3); } // 9300 → 9:30:0
    else if (s.length === 5) { h = +s[0]; m = +s.slice(1, 3); sec = +s.slice(3); } // 93000 → 9:30:00
    else { h = +s[0]; m = +s.slice(1, 3); sec = +s.slice(3, 5); }
  } else {
    const parts = s.split(':');
    if (parts.length < 2 || parts.length > 3) return { ok: false };
    if (!parts.every((p) => /^\d{1,2}$/.test(p))) return { ok: false };
    h = +parts[0]; m = +parts[1]; sec = parts[2] != null ? +parts[2] : 0;
  }
  if (!Number.isInteger(h) || h < 0 || h > 9) return { ok: false };
  if (!Number.isInteger(m) || m < 0 || m > 99) return { ok: false };
  if (!Number.isInteger(sec) || sec < 0 || sec > 99) return { ok: false };
  return { ok: true, total: h * 10000 + m * 100 + sec };
}

/** Parse Standard civil time. hourFmt '12'|'24'. Forgiving; 12h accepts a/p/am/pm. */
export function parseStandardTime(raw, hourFmt = '12') {
  let s = String(raw ?? '').trim().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  if (!s) return { ok: false };
  let ampm = null;
  const ap = s.match(/\s*([ap])\.?m?\.?\s*$/i);
  if (ap) { ampm = ap[1].toLowerCase() === 'a' ? 'am' : 'pm'; s = s.slice(0, ap.index).trim(); }
  s = s.replace(/\s+/g, '');
  let h, m, sec = 0;
  if (/^\d{1,6}$/.test(s)) {
    if (s.length <= 2) { h = +s; m = 0; }
    else if (s.length === 3) { h = +s[0]; m = +s.slice(1); }
    else if (s.length === 4) { h = +s.slice(0, 2); m = +s.slice(2); }
    else if (s.length === 5) { h = +s[0]; m = +s.slice(1, 3); sec = +s.slice(3); }
    else { h = +s.slice(0, 2); m = +s.slice(2, 4); sec = +s.slice(4, 6); }
  } else {
    const parts = s.split(':');
    if (parts.length < 2 || parts.length > 3) return { ok: false };
    if (!parts.every((p) => /^\d{1,2}$/.test(p))) return { ok: false };
    h = +parts[0]; m = +parts[1]; sec = parts[2] != null ? +parts[2] : 0;
  }
  if (!Number.isInteger(m) || m < 0 || m > 59) return { ok: false };
  if (!Number.isInteger(sec) || sec < 0 || sec > 59) return { ok: false };
  if (hourFmt === '24') {
    if (!Number.isInteger(h) || h < 0 || h > 23) return { ok: false };
  } else {
    if (!Number.isInteger(h) || h < 1 || h > 12) return { ok: false };
    if (!ampm) return { ok: false, needAmPm: true, h, m, sec };
    if (h === 12) h = 0;
    if (ampm === 'pm') h += 12;
  }
  return { ok: true, secOfDay: h * 3600 + m * 60 + sec, h, m, sec, ampm };
}

/**
 * Resolve a typed reading to the Date in [localMidnight(ref), +48h) nearest to ref.
 * kind: 'shared' | 'exact' | 'regular'.
 */
export function typedTimeToInstant(kind, value, ref, lonDeg = 0) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  const end = start + 48 * 3600 * 1000;
  const cands = [];
  const push = (d) => { if (d && Number.isFinite(d.getTime())) cands.push(d.getTime()); };
  // Probe ref and ±1 / ±2 civil days so Ten days (start 18:00) are covered
  for (const day of [-1, 0, 1, 2]) {
    const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + day);
    if (kind === 'shared') push(sharedTenToInstant(base, value));
    else if (kind === 'exact') push(exactTenToInstant(base, value, lonDeg));
    else push(regularToInstant(base, value));
  }
  let best = null, bestDist = Infinity;
  const refMs = ref.getTime();
  for (const ms of cands) {
    if (ms < start || ms >= end) continue;
    const dist = Math.abs(ms - refMs);
    if (dist < bestDist) { bestDist = dist; best = ms; }
  }
  return best == null ? null : new Date(best);
}

/** All three readings of one instant. */
export function equivalents(date, lonDeg) {
  return {
    regular: localSecondsOfDay(date),
    shared: sharedTen(date),
    exact: exactTen(date, lonDeg),
    regularDate: { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() },
    sharedDate: sharedTenDate(date),
    exactDate: exactTenDate(date, lonDeg),
  };
}

/* ---------- Dial geometry ---------- */
/** 24-hour dial position in turns (0 = top, clockwise): noon at top, 18:00 right, midnight bottom, 06:00 left. */
export const regularDialTurns = (secOfDay) => mod(secOfDay / DAY_S - 0.5, 1);

/** Concentric ring bands for the One dial: n rings share [inner, outer] radius, outermost first. */
export function ringBands(n, outer = 196, inner = 50, gap = 3) {
  const w = (outer - inner) / n;
  return Array.from({ length: n }, (_, i) => ({ rOuter: outer - i * w, rInner: outer - (i + 1) * w + gap, width: w - gap }));
}

/** Hand extent for a One-dial ring: stays inside its own band; the innermost ring's hand starts at the hub. */
export function ringHand(band, innermost) {
  return { r1: innermost ? 0 : band.rInner + 2, r2: band.rOuter - band.width * 0.12 };
}

/** Labels around a Regular dial for the shared 12h/24h setting. Index = hour-of-day (0..23). */
export const regularDialLabels = (fmt) => Array.from({ length: 24 }, (_, h) => (fmt === '12' ? (h % 12 || 12) : h));

/* ---------- Sky: sun, moon (NOAA / Meeus, on-device; DEG = deg→rad) ---------- */
const TO_DEG = 180 / Math.PI;

/** Sun altitude (deg) and azimuth (deg from N, clockwise) at date/lat/lon. */
export function sunPosition(date, latDeg, lonDeg) {
  const jd = julianDate(date), jc = (jd - 2451545) / 36525;
  const L = mod(280.46646 + jc * (36000.76983 + jc * 0.0003032), 360);
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const C = Math.sin(M * DEG) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
          + Math.sin(2 * M * DEG) * (0.019993 - 0.000101 * jc) + Math.sin(3 * M * DEG) * 0.000289;
  const omega = 125.04 - 1934.136 * jc;
  const appLong = L + C - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  const obliq0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliq = (obliq0 + 0.00256 * Math.cos(omega * DEG)) * DEG;
  const ra = Math.atan2(Math.cos(obliq) * Math.sin(appLong * DEG), Math.cos(appLong * DEG));
  const dec = Math.asin(Math.sin(obliq) * Math.sin(appLong * DEG));
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * jc * jc) * DEG;
  const ha = gmst + lonDeg * DEG - ra, lat = latDeg * DEG;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) * TO_DEG;
  const az = mod(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) * TO_DEG + 180, 360);
  return { alt, az };
}

/** Moon altitude/azimuth, illuminated fraction 0..1, and waxing flag. */
export function moonPosition(date, latDeg, lonDeg) {
  const jd = julianDate(date), T = (jd - 2451545) / 36525;
  const Lp = mod(218.3164477 + 481267.88123421 * T, 360);
  const D = mod(297.8501921 + 445267.1114034 * T, 360) * DEG;
  const M = mod(357.5291092 + 35999.0502909 * T, 360) * DEG;
  const Mp = mod(134.9633964 + 477198.8675055 * T, 360) * DEG;
  const F = mod(93.2720950 + 483202.0175233 * T, 360) * DEG;
  const lon = (Lp + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F)) * DEG;
  const latM = (5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(Mp - F)) * DEG;
  const ob = (23.439291 - 0.0130042 * T) * DEG;
  const x = Math.cos(latM) * Math.cos(lon);
  const y = Math.cos(ob) * Math.cos(latM) * Math.sin(lon) - Math.sin(ob) * Math.sin(latM);
  const z = Math.sin(ob) * Math.cos(latM) * Math.sin(lon) + Math.cos(ob) * Math.sin(latM);
  const ra = Math.atan2(y, x), dec = Math.atan2(z, Math.hypot(x, y));
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545)) * DEG;
  const ha = gmst + lonDeg * DEG - ra, lat = latDeg * DEG;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) * TO_DEG;
  const az = mod(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) * TO_DEG + 180, 360);
  const synodic = 29.530588853, age = mod(jd - 2451550.1, synodic);
  const frac = (1 - Math.cos((age / synodic) * 2 * Math.PI)) / 2;
  const phase = age / synodic; // 0 new … 0.5 full … 1 new
  return { alt, az, frac, waxing: age < synodic / 2, age, phase };
}

/** Synodic phase 0..1 (0=new, 0.5=full) from moon age. */
export const moonPhase01 = (moon) => mod(moon.age / 29.530588853, 1);

/**
 * Approximate moonrise / moonset bracketing `date` (alt crosses 0°).
 * Returns { rise, set } as Dates (null if none in ±18 h — polar).
 */
export function moonTimes(date, latDeg, lonDeg) {
  const tMid = date.getTime();
  const step = 12 * 60e3; // 12 min
  const t0 = tMid - 18 * 3600e3;
  const t1 = tMid + 18 * 3600e3;
  const altAt = (ms) => moonPosition(new Date(ms), latDeg, lonDeg).alt;
  const refine = (a, b, rising) => {
    let lo = a, hi = b;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      const up = altAt(mid) >= 0;
      if (rising ? up : !up) hi = mid; else lo = mid;
    }
    return new Date((lo + hi) / 2);
  };
  let prevT = t0, prevA = altAt(t0);
  let rise = null, set = null;
  // Prefer the pair that brackets `date` when the moon is up; else nearest upcoming/past.
  let riseBefore = null, setAfter = null, riseAfter = null, setBefore = null;
  for (let t = t0 + step; t <= t1; t += step) {
    const a = altAt(t);
    if (prevA < 0 && a >= 0) {
      const r = refine(prevT, t, true);
      if (r.getTime() <= tMid) riseBefore = r; else if (!riseAfter) riseAfter = r;
    }
    if (prevA >= 0 && a < 0) {
      const s = refine(prevT, t, false);
      if (s.getTime() >= tMid) { if (!setAfter) setAfter = s; }
      else setBefore = s;
    }
    prevT = t; prevA = a;
  }
  if (riseBefore && setAfter) { rise = riseBefore; set = setAfter; }
  else if (riseAfter && setAfter && riseAfter < setAfter) { rise = riseAfter; set = setAfter; }
  else if (riseBefore && setBefore) { rise = riseBefore; set = setBefore; }
  else { rise = riseBefore || riseAfter; set = setAfter || setBefore; }
  return { rise, set };
}

/**
 * Unit-arch position for a rise→set fraction u (0 at rise, 1 at set).
 * Northern: morning-right (rise +x, set −x). Southern: mirrored.
 * y = sin(πu) so the path is a perfect semi-ellipse in (x,y).
 */
export function archPoint(u, southHem) {
  const uu = Math.max(0, Math.min(1, u));
  let x = Math.cos(uu * Math.PI); // +1 rise … 0 transit … −1 set
  let y = Math.sin(uu * Math.PI); // 0 … 1 … 0
  if (southHem) x = -x;
  if (u < 0 || u > 1) {
    // Below horizon: park just under the nearer end (still inset when mapped)
    const end = u < 0 ? 1 : -1; // before rise → rise side (+1 N)
    x = southHem ? -end : end;
    y = -Math.min(0.35, 0.15 + 0.2 * Math.min(Math.abs(u < 0 ? u : u - 1), 1));
  }
  return { x, y };
}

/** Fraction of time above the horizon; <0 before rise, >1 after set. */
function archFraction(date, rise, set) {
  if (!rise || !set) return null;
  const r = rise.getTime(), s = set.getTime();
  if (!(s > r)) return null;
  return (date.getTime() - r) / (s - r);
}

/**
 * Sky scene for the animated background.
 * Sun and moon share one perfect semi-ellipse arch (simulation, not az plot):
 * x −1..+1, y 0 at horizon … 1 at peak. Morning-right / afternoon-left (N); S mirrored.
 */
export function skyScene(date, latDeg, lonDeg) {
  const sun = sunPosition(date, latDeg, lonDeg);
  const moon = moonPosition(date, latDeg, lonDeg);
  const southHem = latDeg < 0;
  const ymd = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  // Local calendar day for NOAA sun times (zone of the Date object's local fields —
  // tests set TZ=America/Detroit; in-browser uses the device zone).
  let st = sunTimes(ymd[0], ymd[1], ymd[2], latDeg, lonDeg);
  // If after local midnight but before sunrise, yesterday's set may be the relevant "down" side;
  // for the arch while up we need today's rise/set. If sun is up but outside today's window
  // (DST edge), pull neighbouring day.
  if (st.sunrise && st.sunset) {
    if (date < st.sunrise) {
      const prev = new Date(date.getTime() - 86400000);
      const pst = sunTimes(prev.getFullYear(), prev.getMonth() + 1, prev.getDate(), latDeg, lonDeg);
      if (pst.sunset && date < pst.sunset && date > pst.sunrise) st = pst;
    } else if (date > st.sunset) {
      const next = new Date(date.getTime() + 86400000);
      const nst = sunTimes(next.getFullYear(), next.getMonth() + 1, next.getDate(), latDeg, lonDeg);
      if (nst.sunrise && date > nst.sunrise && date < nst.sunset) st = nst;
    }
  }
  let su = archFraction(date, st.sunrise, st.sunset);
  if (su == null) {
    // Polar / missing: fall back to altitude + crude morning-right from azimuth
    const meridianAz = southHem ? 0 : 180;
    const dAz = mod(sun.az - meridianAz + 180, 360) - 180;
    const morningRight = southHem ? dAz : -dAz;
    su = sun.alt > 0 ? (1 - morningRight / 90) / 2 : (sun.alt > -6 ? -0.05 : 1.05);
  }
  const sp = archPoint(su, southHem);

  const mt = moonTimes(date, latDeg, lonDeg);
  let mu = archFraction(date, mt.rise, mt.set);
  if (mu == null) {
    const meridianAz = southHem ? 0 : 180;
    const dAz = mod(moon.az - meridianAz + 180, 360) - 180;
    const morningRight = southHem ? dAz : -dAz;
    mu = moon.alt > 0 ? (1 - morningRight / 90) / 2 : (moon.alt > -6 ? -0.05 : 1.05);
  }
  const mp = archPoint(mu, southHem);

  return {
    sun, moon,
    x: sp.x, y: sp.y, mx: mp.x, my: mp.y,
    su, mu,
    sunRise: st.sunrise, sunSet: st.sunset,
    moonRise: mt.rise, moonSet: mt.set,
    southHem,
  };
}
