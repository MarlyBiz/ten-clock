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

/** Approximate centre longitude of the browser's standard time zone (no DST). */
export function zoneCentreLongitude(date = new Date()) {
  const y = date.getFullYear();
  const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  return -std / 4;
}
