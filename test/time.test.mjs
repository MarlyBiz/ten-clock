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

test('Slider conversions: Detroit EDT, lon −83.481', () => {
  const lon = -83.481;
  const base = new Date('2026-10-26T12:00:00Z'); // Mon Oct 26 2026, 8 AM EDT
  // 9:00 AM -> Ten 6:25:00; Meridian = LMST 07:26:04.56 -> 5:59:77
  const nine = T.regularToInstant(base, 9 * 3600);
  assert.equal(nine.toISOString(), '2026-10-26T13:00:00.000Z');
  let e = T.equivalents(nine, lon);
  assert.equal(T.formatTen(e.shared), '6:25:00');
  assert.equal(T.formatTen(e.exact), '5:59:77');
  close(e.exact - e.shared, T.exactMinusSharedSeconds(nine, lon) / T.TEN_SECOND_S, 1e-6, 'meridian = shared + offset');
  // 5:00 PM -> Ten 9:58:33 (17:00 is 23 h after 18:00: 82800/0.864 = 95833.3); Meridian LMST 15:26:04.56 -> 8:93:10
  const five = T.regularToInstant(base, 17 * 3600);
  e = T.equivalents(five, lon);
  assert.equal(T.formatTen(e.shared), '9:58:33');
  assert.equal(T.formatTen(e.exact), '8:93:10');
  assert.deepEqual(e.sharedDate, { y: 2026, m: 10, d: 26, rolled: false });
  // 9 PM: regular date is the 26th, Ten date already the 27th
  e = T.equivalents(T.regularToInstant(base, 21 * 3600), lon);
  assert.equal(e.regularDate.d, 26); assert.equal(e.sharedDate.d, 27);
  // Ten 6:25:00 in base's Ten day -> 9:00 AM EDT
  assert.equal(T.sharedTenToInstant(base, 62500).toISOString(), '2026-10-26T13:00:00.000Z');
  // Meridian 0 (sunset/new day) at Walled Lake = 18:00 LMST = 23:33:55.44 UTC (on Oct 25 for base's Exact day)
  assert.equal(T.exactTenToInstant(base, 0, lon).toISOString(), '2026-10-25T23:33:55.440Z');
});

test('Slider conversions round-trip on all three scales (incl. wrap and DST dates)', () => {
  const lons = [-83.481, 0, 151.2, -179.9, 179.9];
  const start = Date.parse('2026-01-01T00:00:00Z');
  for (let i = 0; i < 400; i++) {
    const d = new Date(start + i * 7.3 * 3600 * 1000 + i * 1234);
    // skip the repeated 1-2 AM hour on the November fall-back night (ambiguous wall-clock)
    const ambiguous = d.getMonth() === 10 && d.getDate() === 1 && d.getHours() === 1;
    if (!ambiguous) {
      close(T.regularToInstant(d, T.localSecondsOfDay(d)).getTime(), d.getTime(), 1, 'regular round-trip');
      close(T.sharedTenToInstant(d, T.sharedTen(d)).getTime(), d.getTime(), 1, 'shared round-trip');
    }
    for (const lon of lons) close(T.exactTenToInstant(d, T.exactTen(d, lon), lon).getTime(), d.getTime(), 1, `exact round-trip ${lon}`);
    // value -> instant -> value
    const v = (i * 997) % 100000;
    close(T.sharedTen(T.sharedTenToInstant(d, v)), v, 0.01, 'shared value');
    close(T.exactTen(T.exactTenToInstant(d, v, -83.481), -83.481), v, 0.01, 'exact value');
  }
});

test('One dial geometry: 24h ring orientation and ring bands', () => {
  assert.equal(T.regularDialTurns(12 * 3600), 0);      // noon at top
  assert.equal(T.regularDialTurns(18 * 3600), 0.25);   // 6 PM at right (Ten 0 / day start)
  assert.equal(T.regularDialTurns(0), 0.5);            // midnight at bottom
  assert.equal(T.regularDialTurns(6 * 3600), 0.75);    // 6 AM at left
  const one = T.ringBands(1), three = T.ringBands(3);
  assert.equal(one.length, 1); assert.equal(one[0].rOuter, 196); assert.equal(one[0].rInner, 53); // one ring fills the dial
  assert.equal(three.length, 3); assert.ok(three[0].rOuter > three[1].rOuter && three[1].rOuter > three[2].rOuter);
  for (let i = 1; i < 3; i++) assert.ok(three[i].rOuter <= three[i - 1].rInner); // no overlap
  // Hands stay inside their own ring (outer Shared, middle Meridian, inner 24h from the hub)
  three.forEach((b, i) => {
    const h = T.ringHand(b, i === 2);
    assert.ok(h.r2 <= b.rOuter && h.r2 > b.rInner, `hand ${i} tip inside its band`);
    if (i < 2) assert.ok(h.r1 >= b.rInner && h.r1 < h.r2, `hand ${i} starts inside its band`);
    if (i < 2) assert.ok(h.r1 > three[i + 1].rOuter, `hand ${i} never reaches the ring inside it`);
  });
  assert.equal(T.ringHand(three[2], true).r1, 0);
  // 12h: 12 at top/bottom; 24h: 0 at bottom, 12 at top, 18 at right (current clockwise orientation)
  assert.deepEqual(T.regularDialLabels('12').slice(0, 4), [12, 1, 2, 3]);
  assert.equal(T.regularDialLabels('12')[12], 12);
  assert.deepEqual(T.regularDialLabels('24').slice(0, 4), [0, 1, 2, 3]);
  assert.equal(T.regularDialLabels('24')[12], 12);
  assert.equal(T.regularDialLabels('24')[18], 18);
  assert.equal(T.regularDialTurns(18 * 3600), 0.25); // 18:00 at right
});

test('Sky: sun altitude and moon phase sanity', () => {
  // Walled Lake solar noon ~17:36 UTC on 2026-06-21 → sun high in south
  const noon = new Date('2026-06-21T17:36:00Z');
  const s = T.sunPosition(noon, 42.538, -83.481);
  assert.ok(s.alt > 60 && s.alt < 75, `June noon alt ${s.alt}`);
  assert.ok(s.az > 150 && s.az < 210, `June noon az ${s.az}`);
  // Midnight → sun below horizon
  const mid = T.sunPosition(new Date('2026-06-21T05:00:00Z'), 42.538, -83.481);
  assert.ok(mid.alt < -10, `night alt ${mid.alt}`);
  // Scene: morning sun to the right of center (positive x), afternoon to the left
  const morn = T.skyScene(new Date('2026-06-21T14:00:00Z'), 42.538, -83.481); // 10 AM EDT
  const aft = T.skyScene(new Date('2026-06-21T21:00:00Z'), 42.538, -83.481); // 5 PM EDT
  assert.ok(morn.x > 0.1, `morning x ${morn.x}`);
  assert.ok(aft.x < -0.1, `afternoon x ${aft.x}`);
  assert.ok(morn.y > 0.2 && morn.sun.alt > 0, 'morning sun above horizon');
  // Sydney winter noon (sun in north) still maps morning to +x
  const syd = T.skyScene(new Date('2026-06-21T02:00:00Z'), -33.87, 151.21);
  assert.equal(syd.southHem, true);
  // Full moon ≈ age 14–15 → frac near 1; new moon age ~0 → frac near 0
  const full = T.moonPosition(new Date(2451550.1 * 86400000 - 2440587.5 * 86400000 + 14.77 * 86400000), 0, 0);
  // Use a known-ish date: 2026-01-03 was a full moon (approx)
  const fm = T.moonPosition(new Date('2026-01-03T12:00:00Z'), 0, 0);
  const nm = T.moonPosition(new Date('2026-01-18T12:00:00Z'), 0, 0); // new ~ Jan 18 2026
  assert.ok(fm.frac > 0.85, `full frac ${fm.frac}`);
  assert.ok(nm.frac < 0.15, `new frac ${nm.frac}`);
});

test('Solar noon lies between sunrise and sunset (Walled Lake)', () => {
  const s = T.sunTimes(2026, 6, 21, 42.538, -83.481);
  assert.ok(s.noon && s.sunrise && s.sunset);
  assert.ok(s.noon > s.sunrise && s.noon < s.sunset, 'noon between rise and set');
  // ~17:36 UTC on June 21 for Walled Lake
  close(s.noon.getTime(), Date.parse('2026-06-21T17:36:00Z'), 3 * 60000, 'June solar noon');
  const sc = T.skyScene(s.noon, 42.538, -83.481);
  assert.ok(sc.y > 0.85, `sun near top of sky at noon (y=${sc.y})`);
  assert.ok(Math.abs(sc.x) < 0.35, `sun near centre at noon (x=${sc.x})`);
});
