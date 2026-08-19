// Rasterizza il logo SVG nelle icone PNG richieste da PWA e iOS.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable', 512, 0.18]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:#04060d}
     .box{width:${size}px;height:${size}px;display:grid;place-items:center;background:#04060d}
     svg{width:${Math.round(size * (1 - pad * 2))}px;height:${Math.round(size * (1 - pad * 2))}px}</style>
     <div class="box">${svg}</div>`,
  );
  const buffer = await page.screenshot({ omitBackground: false });
  writeFileSync(new URL(`../public/${name}.png`, import.meta.url), buffer);
  await page.close();
  console.log(name, size);
}
await browser.close();
