// Playwright mobile: sky must not move with scroll or height-only (URL bar) resizes.
// Run: node test/sky-scroll.spec.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const path = join(root, (req.url || '/').split('?')[0].replace(/^\//, '') || 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function sunSample(page) {
  return page.evaluate(() => {
    const c = document.getElementById('sky');
    const r = c.getBoundingClientRect();
    const g = c.getContext('2d');
    const h = Math.min(c.height, Math.max(1, Math.round(c.height * 0.35)));
    const d = g.getImageData(0, 0, c.width, h);
    let best = 0, bx = 0, by = 0;
    for (let i = 0; i < d.data.length; i += 4) {
      const s = d.data[i] + d.data[i + 1] * 0.55 + d.data[i + 2] * 0.15;
      if (s > best) { best = s; bx = (i / 4) % c.width; by = ((i / 4) / c.width) | 0; }
    }
    const scaleX = c.clientWidth / c.width, scaleY = c.clientHeight / c.height;
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      sun: { x: bx * scaleX, y: by * scaleY, best },
    };
  });
}

const { server, url } = await serve();
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL || 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
let failed = 0;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('ten.location.v1', JSON.stringify({ lat: 42.538, lon: -83.481 }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    window.__tenPreviewAt?.('2026-06-21T14:00:00Z');
    await new Promise((r) => setTimeout(r, 500));
  });

  const base = await sunSample(page);
  assert.ok(base.sun.best > 400, `sun visible best=${base.sun.best}`);

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(60);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(60);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(250); // under old 1s idle redraw
  const afterScroll = await sunSample(page);
  assert.ok(Math.abs(afterScroll.rect.y - base.rect.y) < 1, `canvas y moved ${base.rect.y}→${afterScroll.rect.y}`);
  assert.ok(Math.abs(afterScroll.rect.h - base.rect.h) < 2, `canvas h moved ${base.rect.h}→${afterScroll.rect.h}`);
  assert.ok(Math.abs(afterScroll.sun.x - base.sun.x) < 4, `sun x moved ${base.sun.x}→${afterScroll.sun.x}`);
  assert.ok(Math.abs(afterScroll.sun.y - base.sun.y) < 4, `sun y moved ${base.sun.y}→${afterScroll.sun.y}`);

  await page.evaluate(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => 640 });
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(200);
  const afterH = await sunSample(page);
  assert.ok(Math.abs(afterH.sun.x - base.sun.x) < 4, `sun x after height-only ${base.sun.x}→${afterH.sun.x}`);
  assert.ok(Math.abs(afterH.sun.y - base.sun.y) < 4, `sun y after height-only ${base.sun.y}→${afterH.sun.y}`);
  assert.ok(Math.abs(afterH.rect.y - base.rect.y) < 1, 'canvas y after height-only');

  console.log('ok sky-scroll: sun stable across scroll + height-only resize', {
    sun: base.sun, rectH: base.rect.h,
  });
} catch (e) {
  failed = 1;
  console.error('FAIL', e);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed);
