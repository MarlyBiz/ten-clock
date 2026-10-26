// Run: node --test   (Node 18+, no dependencies)
// Shared-mode tests pin the civil time zone to America/Detroit (Walled Lake, MI).
process.env.TZ = 'America/Detroit';

import test from 'node:test';
import assert from 'node:assert/strict';
const T = await import('../time.js');

const at = (h, m = 0, s = 0) => h * 3600 + m * 60 + s;
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: got ${a}, want ${b} ±${eps}`);

test('Ten conversions from traditional time', () => {
  assert.equal(T.formatTen(T.tenFromSeconds(at(18))), '0:00:00');        // 6:00 PM
  assert.equal(T.formatTen(T.tenFromSeconds(at(0))), '2:50:00');         // midnight
  assert.equal(T.formatTen(T.tenFromSeconds(at(6))), '5:00:00');         // 6 AM
  assert.equal(T.formatTen(T.tenFromSeconds(at(12))), '7:50:00');        // noon
  assert.equal(T.formatTen(T.tenFromSeconds(at(17, 59, 59.136))), '9:99:99'); // last Ten-second
  assert.equal(T.tenFromSeconds(at(18) + 86400), 0); // wraps daily
  assert.equal(T.TEN_SECOND_S * 100000, 86400);
});

test('Shared mode uses the zone civil clock incl. DST', () => {
  // 2026-07-01 18:00 EDT = 22:00 UTC; 2026-01-15 18:00 EST = 23:00 UTC
  assert.equal(T.formatTen(T.sharedTen(new Date('2026-07-01T22:00:00Z'))), '0:00:00');
  assert.equal(T.formatTen(T.sharedTen(new Date('2026-01-15T23:00:00Z'))), '0:00:00');
  assert.equal(T.formatTen(T.sharedTen(new Date('2026-07-01T16:00:00Z'))), '7:50:00'); // noon EDT
});

test('Exact mode at longitude 0 equals UTC-based Ten', () => {
  const d = new Date('2026-03-20T09:30:15.5Z');
  assert.equal(T.exactTen(d, 0), T.tenFromSeconds(T.utcSecondsOfDay(d)));
  assert.equal(T.formatTen(T.exactTen(new Date('2026-03-20T18:00:00Z'), 0)), '0:00:00');
});

test('Exact mode offset at Walled Lake, MI (lon −83.47)', () => {
  // LMST = UTC − 83.47/15 h = UTC − 5h33m52.8s
  const summer = new Date('2026-07-01T12:00:00Z');   // EDT (UTC−4)
  const winter = new Date('2026-01-15T12:00:00Z');   // EST (UTC−5)
  close(T.exactMinusSharedSeconds(summer, -83.47), -(1 * 3600 + 33 * 60 + 52.8), 1e-6, 'EDT offset');
  close(T.exactMinusSharedSeconds(winter, -83.47), -(33 * 60 + 52.8), 1e-6, 'EST offset');
  // Exact zero (sunset/new day) at Walled Lake = 23:33:52.8 UTC
  assert.equal(T.formatTen(T.exactTen(new Date('2026-07-01T23:33:52.800Z'), -83.47)), '0:00:00');
});

test('Same longitude, different hemisphere/latitude => identical Exact time', () => {
  const d = new Date('2026-10-26T05:24:00Z');
  // Exact depends on longitude only; e.g. Walled Lake MI and a point at 42.5°S on the same meridian.
  const north = T.exactTen(d, -83.481), south = T.exactTen(d, -83.481);
  assert.equal(north, south);
  assert.deepEqual(T.exactTenDate(d, -83.481), T.exactTenDate(d, -83.481));
  assert.equal(T.exactTen.length, 2); // signature takes (date, longitude) — no latitude input exists
  assert.notEqual(T.exactTen(d, -83.481), T.exactTen(d, -83.0)); // but longitude matters
});

test('Ten date rolls over at 0:00:00 (sunset / 6 PM)', () => {
  // Shared, Detroit: 5:59 PM still today, 6:00 PM is the next date.
  assert.deepEqual(T.sharedTenDate(new Date('2026-10-25T21:59:00Z')), { y: 2026, m: 10, d: 25, rolled: false }); // 5:59 PM EDT
  assert.deepEqual(T.sharedTenDate(new Date('2026-10-25T21:59:59.999Z')).d, 25);
  assert.deepEqual(T.sharedTenDate(new Date('2026-10-25T22:00:00Z')), { y: 2026, m: 10, d: 26, rolled: true });  // 6:00 PM EDT
  assert.deepEqual(T.sharedTenDate(new Date('2026-10-26T03:00:00Z')).d, 26); // 11 PM EDT the 25th => Ten date 26th
  // Month/year boundaries
  assert.deepEqual(T.tenDateFromCivil(2026, 12, 31, at(18)), { y: 2027, m: 1, d: 1, rolled: true });
  assert.deepEqual(T.tenDateFromCivil(2028, 2, 28, at(19)), { y: 2028, m: 2, d: 29, rolled: true });
  assert.deepEqual(T.tenDateFromCivil(2026, 3, 1, at(17, 59, 59)), { y: 2026, m: 3, d: 1, rolled: false });
  // Exact, longitude 0: 17:59 UTC today, 18:00 UTC next date
  assert.equal(T.exactTenDate(new Date('2026-06-30T17:59:00Z'), 0).d, 30);
  assert.deepEqual(T.exactTenDate(new Date('2026-06-30T18:00:00Z'), 0), { y: 2026, m: 7, d: 1, rolled: true });
});

test('GMST: Meeus example 12.b and J2000.0', () => {
  // Meeus, Astronomical Algorithms, ex. 12.b: 1987-04-10 19:21:00 UT -> 8h34m57.0896s
  close(T.gmstHours(new Date('1987-04-10T19:21:00Z')) * 3600, 8 * 3600 + 34 * 60 + 57.0896, 0.01, 'Meeus 12.b');
  // J2000.0 (2000-01-01 12:00 UT) -> 18.697374558 h
  close(T.gmstHours(new Date('2000-01-01T12:00:00Z')) * 3600, 18.697374558 * 3600, 0.01, 'J2000');
  assert.equal(T.formatHMS(T.gmstHours(new Date('1987-04-10T19:21:00Z'))), '08:34:57');
});

test('NOAA sunrise/sunset for Walled Lake, MI (42.538 N, −83.481)', () => {
  // Reference: US Naval Observatory API, fetched 2026-10-26:
  //   https://aa.usno.navy.mil/api/rstt/oneday?date=2026-06-21&coords=42.538,-83.481&tz=-5&dst=true
  //   2026-06-21: Rise 05:57 EDT (09:57 UTC), Set 21:15 EDT (01:15 UTC on 06-22)
  //   https://aa.usno.navy.mil/api/rstt/oneday?date=2026-12-21&coords=42.538,-83.481&tz=-5&dst=false
  //   2026-12-21: Rise 08:00 EST (13:00 UTC), Set 17:04 EST (22:04 UTC)
  // (sunrise-sunset.org agrees for June: rise 09:56:34Z, set 01:15:01Z.)
  const min = 60000, tol = 2 * min;
  const jun = T.sunTimes(2026, 6, 21, 42.538, -83.481);
  close(jun.sunset.getTime(), Date.parse('2026-06-22T01:15:00Z'), tol, 'June sunset');
  close(jun.sunrise.getTime(), Date.parse('2026-06-21T09:57:00Z'), tol, 'June sunrise');
  const dec = T.sunTimes(2026, 12, 21, 42.538, -83.481);
  close(dec.sunset.getTime(), Date.parse('2026-12-21T22:04:00Z'), tol, 'Dec sunset');
  close(dec.sunrise.getTime(), Date.parse('2026-12-21T13:00:00Z'), tol, 'Dec sunrise');
  // Polar night handled
  assert.equal(T.sunTimes(2026, 12, 21, 80, 0).polar, 'night');
});

test('Equation of time is sane (Nov ~ +16 min, Feb ~ −14 min)', () => {
  close(T.equationOfTime(new Date('2026-11-03T12:00:00Z')), 16.4, 0.5, 'Nov EoT');
  close(T.equationOfTime(new Date('2026-02-11T12:00:00Z')), -14.2, 0.5, 'Feb EoT');
});
