import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto('http://localhost:4199/', { waitUntil: 'networkidle' });
const result = await page.evaluate(async () => {
  const ctx = new AudioContext();
  const files = ['sfx-hit','sfx-pulse','sfx-record','music-menu','music-shallow','music-deep','music-core','music-boss','music-epilogue'];
  const out = {};
  for (const f of files) {
    const r = await fetch(`audio/${f}.mp3`);
    const b = await r.arrayBuffer();
    const buf = await ctx.decodeAudioData(b);
    // RMS del primo canale: verifica che non sia silenzio.
    const d = buf.getChannelData(0);
    let sum = 0;
    const step = Math.max(1, Math.floor(d.length / 20000));
    let n = 0;
    for (let i = 0; i < d.length; i += step) { sum += d[i] * d[i]; n++; }
    out[f] = { seconds: +buf.duration.toFixed(2), channels: buf.numberOfChannels, rms: +Math.sqrt(sum / n).toFixed(4) };
  }
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
