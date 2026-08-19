import { chromium } from 'playwright';
const base = 'http://localhost:4198/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
desk.on('pageerror', (e) => errors.push('desk: ' + e));
desk.on('console', (m) => { if (m.type() === 'error') errors.push('desk console: ' + m.text()); });
await desk.goto(base + '?seed=2026', { waitUntil: 'networkidle' });
await desk.waitForTimeout(1500);
await desk.screenshot({ path: '/tmp/v-title.png' });
await desk.keyboard.press('Enter');
await desk.waitForTimeout(900);
for (let i = 0; i < 60; i++) { await desk.keyboard.press(['ArrowRight','ArrowRight','ArrowDown','ArrowLeft','ArrowUp','ArrowDown'][i%6]); await desk.waitForTimeout(30); }
await desk.waitForTimeout(600);
await desk.screenshot({ path: '/tmp/v-play.png' });
await desk.keyboard.press('?');
await desk.waitForTimeout(500);
await desk.screenshot({ path: '/tmp/v-help.png' });
await desk.keyboard.press('Escape');

const audio = await desk.evaluate(async () => {
  const files = ['audio/sfx-hit.mp3','audio/music-shallow.mp3','sw.js','icon-192.png'];
  const out = {};
  for (const f of files) {
    const r = await fetch(f);
    out[f] = r.status + ':' + (r.headers.get('content-length') || '?');
  }
  return out;
});
console.log('ASSETS', JSON.stringify(audio));

const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
mob.on('pageerror', (e) => errors.push('mob: ' + e));
await mob.goto(base + '?seed=7', { waitUntil: 'networkidle' });
await mob.waitForTimeout(1200);
await mob.getByRole('button', { name: /Scendi nel Dedalo/i }).click();
await mob.waitForTimeout(900);
for (let i = 0; i < 22; i++) { await mob.getByRole('button', { name: ['Destra','Giù','Sinistra','Su'][i%4] }).tap(); await mob.waitForTimeout(40); }
await mob.waitForTimeout(500);
await mob.screenshot({ path: '/tmp/v-mobile.png' });
await mob.getByRole('button', { name: /^Mappa$/i }).tap();
await mob.waitForTimeout(500);
await mob.screenshot({ path: '/tmp/v-mobile-panel.png' });

const overflow = await mob.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  scrollHeight: document.documentElement.scrollHeight,
  innerHeight: window.innerHeight,
}));
console.log('MOBILE_OVERFLOW', JSON.stringify(overflow));
console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
