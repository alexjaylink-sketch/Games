#!/usr/bin/env node
/**
 * Replace the game's Google Fonts @import with self-hosted @font-face rules.
 *
 * A store build must be self-contained: it has to render correctly offline and
 * must not reach out to a third party at runtime. This fetches exactly the
 * faces the game declares, keeps only the `latin` subset (which covers the
 * curly quotes, em dashes and ellipses the writing uses), and inlines them as
 * base64 woff2.
 *
 *   node tools/embed-fonts.js            rewrite ship_it_rpg.html in place
 *   node tools/embed-fonts.js --dry-run  report sizes and change nothing
 *
 * Re-run this if the @import in the game file ever changes.
 */
const fs = require('fs');
const path = require('path');

const GAME = path.join(__dirname, '..', 'ship_it_rpg.html');
const DRY = process.argv.includes('--dry-run');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BEGIN = '/* --- self-hosted fonts (tools/embed-fonts.js) --- */';
const END   = '/* --- end self-hosted fonts --- */';

(async () => {
  const html = fs.readFileSync(GAME, 'utf8');

  const already = html.includes(BEGIN);
  const importMatch = html.match(/@import url\((['"])(https:\/\/fonts\.googleapis\.com\/[^'"]+)\1\);\n?/);
  if (!importMatch && !already) throw new Error('no Google Fonts @import and no embedded block — nothing to do');
  if (!importMatch && already) { console.log('fonts already embedded; pass the @import back in to refresh'); return; }

  const cssUrl = importMatch[2];
  console.log('fetching ' + cssUrl.slice(0, 78) + '...');
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();

  /* Google emits one @font-face per unicode subset, each preceded by a /* name *​/ comment. */
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)]
    .filter(m => m[1] === 'latin')
    .map(m => m[2]);
  if (!blocks.length) throw new Error('no latin subsets found in the stylesheet');

  let total = 0;
  const out = [];
  for (const block of blocks) {
    const url = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
    if (!url) continue;
    const buf = Buffer.from(await (await fetch(url[1])).arrayBuffer());
    total += buf.length;
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const weight = (block.match(/font-weight:\s*(\d+)/) || [, '400'])[1];
    const style  = (block.match(/font-style:\s*(\w+)/)  || [, 'normal'])[1];
    console.log('  ' + family.padEnd(16) + weight + ' ' + style.padEnd(7) + (buf.length / 1024).toFixed(1) + ' KB');
    out.push(
      '@font-face{font-family:\'' + family + '\';font-style:' + style + ';font-weight:' + weight +
      ';font-display:swap;src:url(data:font/woff2;base64,' + buf.toString('base64') + ') format(\'woff2\')}'
    );
  }

  const embedded = BEGIN + '\n' + out.join('\n') + '\n' + END + '\n';
  console.log(blocks.length + ' faces, ' + (total / 1024).toFixed(0) + ' KB raw → ' +
              (embedded.length / 1024).toFixed(0) + ' KB base64');

  if (DRY) { console.log('(dry run — file untouched)'); return; }

  let next = html.replace(importMatch[0], embedded);
  if (already) next = next.replace(new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' +
                                              END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?'), '');
  fs.writeFileSync(GAME, next);
  if (/fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(GAME, 'utf8')))
    throw new Error('a Google Fonts reference survived — check the output');
  console.log('embedded. ' + GAME + ' is now self-contained.');
})();
