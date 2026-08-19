import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__played = [];
  const patch = (Ctor) => {
    if (!Ctor) return;
    const orig = Ctor.prototype.createBufferSource;
    Ctor.prototype.createBufferSource = function (...args) {
      const node = orig.apply(this, args);
      const start = node.start.bind(node);
      node.start = (...a) => {
        window.__played.push({ seconds: node.buffer ? +node.buffer.duration.toFixed(2) : null, loop: node.loop });
        return start(...a);
      };
      return node;
    };
  };
  patch(window.AudioContext);
});
await page.goto('http://localhost:4201/?seed=2026', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');      // sblocca l'audio + avvia la run
await page.waitForTimeout(2500);         // tempo per scaricare e far partire la musica
for (let i = 0; i < 24; i++) { await page.keyboard.press(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'][i%4]); await page.waitForTimeout(80); }
await page.keyboard.press('e');          // impulso
await page.waitForTimeout(900);
const played = await page.evaluate(() => window.__played);
console.log('suoni avviati:', played.length);
console.log('loop musicali:', played.filter((p) => p.loop).map((p) => p.seconds));
console.log('effetti brevi:', played.filter((p) => !p.loop).length);
await browser.close();
