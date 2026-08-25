#!/usr/bin/env node
/**
 * Build the embeddable copy of the game.
 *
 * The repo file is a standalone HTML document. The hosted copy (Claude
 * artifact, or any host that supplies its own page shell) must not carry a
 * second <html>/<head>/<body>, so this strips the document wrapper and keeps
 * everything that matters: <title>, <style> (including the Google Fonts
 * @import) and the script.
 *
 *   node tools/build-artifact.js [outfile]
 *
 * Default outfile: build/ship-it.html
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'ship_it_rpg.html');
const OUT = process.argv[2] || path.join(__dirname, '..', 'build', 'ship-it.html');

const WRAPPER = [
  /^<!DOCTYPE html>$/i, /^<html[^>]*>$/i, /^<\/html>$/i,
  /^<head>$/i, /^<\/head>$/i, /^<body[^>]*>$/i, /^<\/body>$/i,
  /^<meta\b[^>]*>$/i
];

const src = fs.readFileSync(SRC, 'utf8');
const kept = src.split('\n').filter(l => !WRAPPER.some(re => re.test(l.trim())));
const out = kept.join('\n');

/* the wrapper must be gone, and the parts that carry the game must not be */
for (const tag of ['<!DOCTYPE', '<html', '</html>', '<head>', '</head>', '<body', '</body>', '<meta']) {
  if (out.includes(tag)) throw new Error('document wrapper survived: ' + tag);
}
for (const [needle, what] of [
  ['<title>SHIP IT</title>', 'title tag'],
  ['</script>', 'game script'],
  ['const FLOOR3', 'map data'],
  ['rel="manifest"', 'web app manifest']
]) {
  if (!out.includes(needle)) throw new Error('lost the ' + what);
}
/* fonts may be embedded (@font-face, the store build) or linked (@import) */
if (!/@font-face\{font-family:'IBM Plex/.test(out) && !out.includes('@import url('))
  throw new Error('lost the fonts — neither embedded nor imported');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log('built ' + path.relative(process.cwd(), OUT));
console.log('  ' + src.length + ' → ' + out.length + ' bytes, ' + kept.length + ' lines');
