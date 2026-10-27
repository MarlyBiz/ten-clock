# Ten

A perfectly even **10-hour clock** where the **new day begins at sunset**. It's Mark Athanson's idea, and "Ten" is a working title.

- **0:00:00 = sunset / traditional 6 PM.** This is when the Ten date changes, as in the biblical day.
- 1 day = **10 hours**, 1 hour = **100 minutes**, 1 minute = **100 seconds**. That's 100,000 Ten-seconds a day, each 0.864 SI seconds.
- Landmarks: midnight is **2:50**, 6 AM is **5:00**, noon is **7:50**.

## What it shows (in order of prominence)

1. **Ten · Shared** (the authority): Ten time from your time zone's civil clock, DST included. Everyone in the same zone shares it, so you can say "call you at 2". Under it you get a large 10-hour dial with today's real sunrise and sunset shaded and marked, a digital readout, and the Ten date.
2. **Traditional**: a classic 12-hour analogue face, 24-hour digital time and the calendar date.
3. **Ten · Exact**: local mean solar time on your meridian (`UTC + longitude/15 h`, zero at 18:00). It depends **only on longitude**, so people due north and due south (either hemisphere) get the exact same time. It also shows the offset from Shared and a "true sun" (apparent solar time) readout. Your location comes from browser geolocation, and only when you tap the button, or you can type it in. It is stored only in `localStorage`.
4. **Star clock**: Greenwich and local mean sidereal time (IAU/Meeus formula), shown as 24h and as Star-Ten (sidereal day ÷ 10). This is for reference only, because the star day (23h 56m 4.09s) slips about 4 minutes a day against the sun.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page markup (Shared hero, Traditional, Exact, Star clock, explainer) |
| `styles.css` | Night-sky theme, responsive from 360px up |
| `app.js` | Builds the SVG dials and runs the `requestAnimationFrame` loop, location UI and sky gradient |
| `time.js` | Pure ES module with all the math: Ten conversions, Ten date, LMST, GMST/LST, NOAA sun, equation of time |
| `assets/sky/moon.png` | NASA public-domain moon texture (see `CREDITS.md`) |
| `sw.js` | Optional, versioned offline cache (`ten-v19`). Bump it on changes |
| `favicon.svg` | Icon (also used by the PWA manifest) |
| `manifest.webmanifest` | Installable PWA manifest |
| `_headers` | Cloudflare Pages security and cache headers (strict CSP, no third parties) |
| `test/time.test.mjs` | Node tests, no dependencies |

## Run and test

```sh
python3 -m http.server 8000     # then open http://localhost:8000
node --test                     # Node 18+
```

There's no build step, no framework and no external requests.

## Deploy (Cloudflare Pages)

- Dashboard: **Workers & Pages → Create → Pages → Connect to Git**. Pick the repo, set **no build command**, and set the output directory to `/`.
- Or from the CLI (Worker with static assets, see `wrangler.jsonc`): `sh scripts/build.sh && npx wrangler deploy` (custom domain `ten.marlylabs.app`).
- Optional custom domain: open the Pages project → Custom domains → `ten.marlylabs.app`.

## Animated sky

The background sky draws the sun and moon on one inset semi-ellipse arch (rise→set simulation, morning-right). Moon phases use a NASA texture with a physical terminator (or your time-zone centre). The converter slider drives the **sky and its digital readout only** — the circular dials always show now. Tap **Now** to snap the sky back. Stars and decorative daytime clouds are drawn on a canvas (throttled to about 1 fps when idle; respects reduced motion).

## Accuracy notes

- The sun uses the NOAA solar calculator equations with refraction (zenith 90.833°). Tests check it against USNO values for Walled Lake, MI to within 2 minutes.
- GMST is checked against Meeus example 12.b and J2000.0 to within 0.01 s.
- Without a saved location, sunrise and sunset are approximated at your time zone's centre longitude and latitude 40°, and the app says so.

MIT licensed.
