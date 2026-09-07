#!/usr/bin/env node
/**
 * Render the app icons and write them into ship_it_rpg.html as data URIs.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/make-icons.js
 *
 * The game ships as one file with no network, so the icons cannot be separate
 * assets — they have to be base64 PNG inside the document. There is no image
 * library here, so the icons are drawn as HTML and screenshotted with the
 * Chromium that the playtests already use.
 *
 * What it writes, between the `icons:start` / `icons:end` markers in <head>:
 *   - <link rel="apple-touch-icon">        180×180, no transparency (iOS
 *     ignores SVG here, which is why this tool exists)
 *   - <link rel="icon">                    32×32, for browser tabs
 *   - the manifest's icons[]                192 and 512 `any`, plus a 512
 *     `maskable` drawn smaller so Android's circle crop does not clip it
 *
 * The art is the toggle from LDS-4417: the whole game is one switch that
 * somebody argued about for eleven months.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'ship_it_rpg.html');
const START = '<!-- icons:start -->';
const END = '<!-- icons:end -->';

/* scale: how much of the canvas the toggle takes. Maskable needs slack because
   Android crops to a circle inscribed in the middle 80%. */
const art = (size, scale) => `<!doctype html><html><head><meta charset=utf8><style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
  /* flat ground on purpose: a full-canvas gradient triples the PNG and this
     file has to carry every byte it ships */
  .bg{position:relative;width:${size}px;height:${size}px;background:#0d1119}
  .glow{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:${size * scale * 1.28}px;height:${size * scale * 0.86}px;border-radius:999px;
        background:rgba(79,140,255,.16)}
  .sw{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:${size * scale}px;height:${size * scale * 0.56}px;border-radius:999px;
      background:linear-gradient(180deg,#5d98ff,#3f7cf0);
      box-shadow:inset 0 ${size * 0.012}px ${size * 0.02}px rgba(255,255,255,.30)}
  .kn{position:absolute;right:${size * scale * 0.045}px;top:50%;transform:translateY(-50%);
      width:${size * scale * 0.47}px;height:${size * scale * 0.47}px;border-radius:50%;
      background:#ffffff}
</style></head><body><div class="bg"><div class="glow"></div>
  <div class="sw"><div class="kn"></div></div>
</div></body></html>`;

(async () => {
  const exe = process.env.CHROME || findChrome();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const shot = async (size, scale) => {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(art(size, scale));
    const buf = await page.screenshot({ type: 'png' });
    await page.close();
    return 'data:image/png;base64,' + buf.toString('base64');
  };

  const [tab, apple, i192, i512, mask] = await Promise.all([
    shot(32, 0.72), shot(180, 0.62), shot(192, 0.62), shot(512, 0.62), shot(512, 0.44)
  ]);
  await browser.close();

  const manifest = {
    name: 'SHIP IT', short_name: 'SHIP IT',
    description: 'A corporate RPG. One feature. Everyone has thoughts.',
    start_url: '.', display: 'fullscreen', orientation: 'portrait',
    background_color: '#0d1119', theme_color: '#0d1119',
    icons: [
      { src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: mask, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };

  const block = [
    START,
    '<link rel="apple-touch-icon" sizes="180x180" href="' + apple + '">',
    '<link rel="icon" type="image/png" sizes="32x32" href="' + tab + '">',
    "<link rel=\"manifest\" href='data:application/manifest+json," +
      encodeURIComponent(JSON.stringify(manifest)).replace(/'/g, '%27') + "'>",
    END
  ].join('\n');

  let html = fs.readFileSync(SRC, 'utf8');
  if (html.includes(START) && html.includes(END)) {
    html = html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length);
  } else {
    const link = html.match(/<link rel="manifest"[^>]*>/);
    if (!link) { console.error('no manifest link and no markers — nothing to replace'); process.exit(1); }
    html = html.replace(link[0], block);
  }
  fs.writeFileSync(SRC, html);
  const kb = n => (n.length * 0.75 / 1024).toFixed(0) + ' KB';
  console.log('icons written into ship_it_rpg.html');
  console.log('  apple-touch 180  ' + kb(apple) + '\n  tab 32           ' + kb(tab) +
              '\n  manifest 192     ' + kb(i192) + '\n  manifest 512     ' + kb(i512) +
              '\n  maskable 512     ' + kb(mask));

  function findChrome() {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    try {
      const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort();
      if (dirs.length) {
        const p = path.join(base, dirs[dirs.length - 1], 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
      }
    } catch (e) { /* let playwright resolve it */ }
    return undefined;
  }
})();
