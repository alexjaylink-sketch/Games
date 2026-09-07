#!/usr/bin/env node
/**
 * Package the game for itch.io (or any static host that wants a zip with an
 * index.html at the root).
 *
 *   node tools/package.js [outfile]
 *
 * Default outfile: build/ship-it-itch.zip
 *
 * The full standalone document goes in as index.html — fonts embedded, no
 * network — so it works as an itch "HTML" project with "This file will be
 * played in the browser" ticked. Mobile-friendly viewport is set to 390×844
 * in the itch project settings (or leave "embed in page" with fullscreen).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'ship_it_rpg.html');
const OUT = process.argv[2] || path.join(ROOT, 'build', 'ship-it-itch.zip');

const html = fs.readFileSync(SRC, 'utf8');
if (/@import url\(https?:/.test(html)) { console.error('fonts are not embedded — run tools/embed-fonts.js first'); process.exit(1); }
if (!/<!DOCTYPE html>/i.test(html)) { console.error('source is not a full document'); process.exit(1); }
const m = html.match(/const BUILD\s*=\s*'([^']+)'/);
const version = m ? m[1] : 'dev';

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'shipit-'));
fs.writeFileSync(path.join(stage, 'index.html'), html);
fs.writeFileSync(path.join(stage, 'README.txt'),
  'SHIP IT v' + version + '\nA single-file game. Open index.html in a browser, or upload this zip to itch.io as an HTML project.\n');

try {
  fs.rmSync(OUT, { force: true });
  execFileSync('zip', ['-q', '-X', '-r', OUT, 'index.html', 'README.txt'], { cwd: stage });
} catch (e) {
  /* no zip binary: write a minimal deflate zip ourselves */
  writeZip(OUT, [['index.html', Buffer.from(html)], ['README.txt', fs.readFileSync(path.join(stage, 'README.txt'))]]);
}
fs.rmSync(stage, { recursive: true, force: true });
console.log('packaged ' + path.relative(ROOT, OUT) + '  (v' + version + ', ' + fs.statSync(OUT).size + ' bytes)');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function writeZip(out, files) {
  const parts = [], central = []; let offset = 0;
  for (const [name, data] of files) {
    const nameB = Buffer.from(name), comp = zlib.deflateRawSync(data), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameB.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameB, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8); cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameB.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(cd, nameB);
    offset += local.length + nameB.length + comp.length;
  }
  const cdBuf = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  fs.writeFileSync(out, Buffer.concat([...parts, cdBuf, end]));
}
