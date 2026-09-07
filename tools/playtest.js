#!/usr/bin/env node
/**
 * Headless playtests for ship_it_rpg.html.
 *
 *   node tools/playtest.js              run every suite
 *   node tools/playtest.js chain side   run named suites
 *   node tools/playtest.js --shots out/ also save screenshots
 *
 * Suites: smoke, chain, side, desk
 * Exits non-zero if any check fails or the page logs an error.
 *
 * Needs playwright. In this project's container it is installed globally:
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js
 * Override the browser binary with CHROME=/path/to/chrome if discovery fails.
 */
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.error('playwright not found. Try:\n  NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.js\n  (or: npm i -D playwright)');
  process.exit(2);
}

const GAME = 'file://' + path.join(__dirname, '..', 'ship_it_rpg.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const shotsAt = (() => { const i = process.argv.indexOf('--shots'); return i > -1 ? process.argv[i + 1] : null; })();
const named = process.argv.slice(2).filter(a => !a.startsWith('--') && a !== shotsAt);

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
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

let passed = 0, failed = 0, lastLabel = '(start)', lastMark = '(none)', lastBeat = 0;
const DEBUG = !!process.env.PT_DEBUG;   /* PT_DEBUG=1: heartbeat + markers + watchdog, to locate a hang */
const ok  = (label, cond, detail) => {
  lastLabel = label;
  if (cond) { passed++; console.log('    ok   ' + label + (detail ? '  — ' + detail : '')); }
  else { failed++; console.log('    FAIL ' + label + (detail ? '  — ' + detail : '')); }
};
const section = t => console.log('\n  ' + t);

/* ---------- a tiny driver over the game's own globals ---------- */
async function boot(browser, { stage = 'field' } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (t === 'HB') { lastBeat = Date.now(); return; }
    if (t.startsWith('@')) { lastMark = t; if (DEBUG) console.log('      ' + t); return; }
    if (m.type() === 'error' && !/ERR_CONNECTION|Failed to load resource/.test(t)) errors.push(t);
  });
  await page.goto(GAME);
  await sleep(1200);
  if (DEBUG) await page.evaluate(() => {
    setInterval(() => console.log('HB'), 500);
    if (typeof WORK === 'undefined') return;
    const wrap = (o, k, label) => { const f = o[k]; let n = 0; o[k] = function (...a) { if (n++ < 1) console.log('@' + label); return f.apply(this, a); }; };
    for (const t of Object.keys(WORK)) for (const fn of Object.keys(WORK[t])) if (typeof WORK[t][fn] === 'function') wrap(WORK[t], fn, t + '.' + fn);
    for (const fn of ['startDesk', 'endDesk', 'spawnInterrupt', 'escalate', 'enterMeeting', 'handleCard'])
      if (typeof window[fn] === 'function') { /* top-level function declarations are not window props; skip */ }
  });

  const d = {
    page, errors,
    mode:  () => page.evaluate(() => mode),
    state: (fn, arg) => page.evaluate(fn, arg),
    set:   o  => page.evaluate(o => { Object.assign(S, o); syncHUD(); }, o),
    line:  () => page.evaluate(() => document.getElementById('dlgTxt').textContent),
    hud:   () => page.evaluate(() => document.getElementById('hLoc').textContent),
    async shot(name) { if (shotsAt) { fs.mkdirSync(shotsAt, { recursive: true }); await page.screenshot({ path: path.join(shotsAt, name + '.png') }); } },
    async standAt(x, y, dir) { await page.evaluate(([x, y, dir]) => { S.x = x; S.y = y; S.dir = dir; }, [x, y, dir]); await sleep(160); },
    async act() { await page.click('#btnA'); await sleep(320); },
    async advance(max = 24) { for (let i = 0; i < max; i++) { if (await d.mode() !== 'dialogue') return; await page.click('#btnA'); await sleep(170); } },
    async interact(x, y, dir) { await d.standAt(x, y, dir); await d.act(); },
    async pickChoice(i) {
      const btns = await page.$$('#chList button');
      if (!btns[i]) return false;
      await btns[i].click(); await sleep(420); return true;
    },
    async fight(cap = 120) {
      let rounds = 0;
      while (await d.mode() === 'battle' && rounds++ < cap) {
        if (!await page.$('#bmenu button:has-text("Commit")')) { await sleep(300); continue; }
        const p = await page.evaluate(() => ({ f: S.focus / S.maxFocus, c: S.caf }));
        let acted = false;
        if (p.f < 0.45 && p.c >= 6) {
          if (await page.$('#bmenu button:has-text("Abilities")')) {
            await page.click('#bmenu button:has-text("Abilities")'); await sleep(220);
            const heal = await page.$('#bmenu button:has-text("Refactor")');
            if (heal) { await heal.click(); acted = true; }
            else await page.click('#bmenu button:has-text("Back")');
          }
        }
        if (!acted) await page.click('#bmenu button:has-text("Commit")');
        await sleep(540);
      }
      return rounds;
    }
  };

  await page.click('#btnNew'); await sleep(400);
  if (stage === 'letter') return d;          // paused on the offer letter
  await page.click('#btnAccept'); await sleep(400);
  if (stage === 'coldopen') return d;        // paused in the cold open
  await page.click('#skipIntro'); await sleep(800);
  return d;
}

/* =====================  SUITES  ===================== */
const SUITES = {};

SUITES.smoke = async browser => {
  const d = await boot(browser, { stage: 'letter' });
  section('smoke — the intro, the field, a fight, and a save');
  ok('offer letter shows', await d.state(() => !document.getElementById('intro').classList.contains('off')));
  ok('serif loaded for the letter', await d.state(() => document.fonts.check('400 16px "IBM Plex Serif"')));
  await d.shot('letter');
  await d.page.click('#btnAccept'); await sleep(500);
  ok('accepting reaches the cold open', await d.state(() => !document.getElementById('cold').classList.contains('off')));
  await d.page.click('#skipIntro'); await sleep(800);
  ok('lands in the field', await d.mode() === 'field');
  ok('game chrome is back', await d.state(() => getComputedStyle(document.getElementById('pad')).display) !== 'none');

  await d.standAt(15, 6, 'down');
  await d.page.keyboard.down('ArrowDown'); await sleep(380); await d.page.keyboard.up('ArrowDown'); await sleep(300);
  ok('player moves', await d.state(() => S.y) > 6, 'y=' + await d.state(() => S.y));

  await d.standAt(15, 6, 'up');
  await d.page.keyboard.down('ArrowUp'); await sleep(300); await d.page.keyboard.up('ArrowUp'); await sleep(300);
  ok('walls block movement', await d.state(() => S.y) === 6, 'elevator at (15,5)');

  await d.page.evaluate(() => { startBattle(['replyall']); }); await sleep(800);
  const rounds = await d.fight();
  await d.advance();
  ok('battle resolves', await d.mode() === 'field', rounds + ' rounds');
  ok('battle grants xp', await d.state(() => S.xp) > 0);

  await d.interact(2, 23, 'up'); await d.advance(3);
  const prompted = await d.state(() => document.getElementById('choices').classList.contains('on'));
  ok('phone booth offers a save', prompted);
  if (prompted) { await d.pickChoice(0); await d.advance(); }
  ok('save written', await d.state(() => !!localStorage.getItem('shipit_lodestar_v2')));

  await d.page.reload(); await sleep(1100);
  await d.page.click('#btnCont'); await sleep(700);
  ok('resume skips the intro', await d.mode() === 'field' && await d.state(() => document.getElementById('intro').classList.contains('off')));
  await d.shot('smoke');
  return d;
};

SUITES.chain = async browser => {
  const d = await boot(browser);
  section('chain — desk and office must alternate');
  ok('opens pointing at the desk', (await d.hud()).includes('Desk'), await d.hud());

  for (const [who, x, y, dir] of [['Priya', 9, 12, 'down'], ['Marcus', 25, 26, 'right'], ['Kai', 4, 4, 'up']]) {
    await d.interact(x, y, dir); const said = await d.line(); await d.advance();
    ok(who + ' refuses work that does not exist', /Of what|What does it do|half-built/.test(said), JSON.stringify(said.slice(0, 40)));
  }
  ok('no approvals handed out early', await d.state(() => JSON.stringify(S.approvals)) === '{"code":0,"sec":0,"design":0}');

  await d.page.evaluate(() => { startDesk(); }); await sleep(400); await d.page.evaluate(() => { hideTut(); });
  ok('build ceiling is 35%', await d.state(() => D.target) === 35);
  ok('ceiling is shown on the bar', (await d.state(() => document.getElementById('buildnote').textContent)).includes('35%'));
  /* progress only comes from the tool now, so cross the ceiling the way a line clear would */
  await d.page.evaluate(() => { D.progress = 34.7; workProgress(0.4); }); await sleep(1100); await d.advance();
  ok('session stops at the ceiling', await d.state(() => S.build) === 35);
  ok('hud now points at Priya', (await d.hud()).includes('Priya'), await d.hud());

  await d.interact(4, 9, 'down'); const deskSaid = await d.line(); await d.advance();
  ok('desk refuses while blocked', /nothing here you can move|look at it for a while/.test(deskSaid));

  await d.page.evaluate(() => { S.approvals.code = 1; syncHUD(); }); await sleep(150);
  ok('ceiling lifts to 70 once reviewed', await d.state(() => buildCap()) === 70);
  await d.page.evaluate(() => { S.build = 70; S.approvals.sec = 1; syncHUD(); }); await sleep(150);
  ok('ceiling lifts to 100 after security', await d.state(() => buildCap()) === 100);

  await d.page.evaluate(() => { S.build = 100; S.approvals = { code: 1, sec: 1, design: 0 }; S.x = 27; S.y = 8; S.dir = 'up'; syncHUD(); });
  await d.page.keyboard.down('ArrowUp'); await sleep(250); await d.page.keyboard.up('ArrowUp'); await sleep(500);
  ok('door stays shut without design review', await d.state(() => S.y) === 8);
  await d.advance();

  await d.page.evaluate(() => { S.approvals.design = 1; S.x = 27; S.y = 8; S.dir = 'up'; syncHUD(); }); await sleep(150);
  await d.page.keyboard.down('ArrowUp'); await sleep(280); await d.page.keyboard.up('ArrowUp'); await sleep(550);
  ok('door opens when everything is done', await d.state(() => S.y) < 8, 'y=' + await d.state(() => S.y));
  ok('hud points at VELOCITY', (await d.hud()).includes('VELOCITY'), await d.hud());
  await d.shot('chain');
  return d;
};

SUITES.loop = async browser => {
  const d = await boot(browser);
  section('loop — day two, same toggle, new ticket');

  /* a senior engineer at the end of day one walks into VELOCITY */
  await d.set({ build: 100, approvals: { code: 1, sec: 1, design: 1 }, lv: 5, xp: 400, atk: 24, def: 9, focus: 200, maxFocus: 200, caf: 60, maxCaf: 60, bag: { snack: 4, brew: 3 } });
  await d.page.evaluate(() => { S.flags.satDown = 1; });
  await d.interact(30, 4, 'up'); await d.advance();
  ok('Brayden opens the roadmap review', await d.mode() === 'battle');
  const r1 = await d.fight(400);
  ok('  and loses it', await d.mode() !== 'battle', r1 + ' turns');
  await d.advance(40);
  ok('chapter one ends at the title', await d.mode() === 'title' && await d.state(() => S.flags.finished === 1));

  /* resuming rolls into the next day */
  await d.page.click('#btnCont'); await sleep(700);
  ok('day two opens with a briefing', await d.mode() === 'dialogue');
  const brief = await d.line(); await d.advance();
  const day2 = await d.state(() => ({ day: S.day, ticket: ticket().key, sum: ticket().sum, build: S.build, appr: JSON.stringify(S.approvals), fin: S.flags.finished, mode }));
  ok('a new ticket about the same toggle', day2.day === 2 && day2.ticket === 'LDS-4418' && /Remove/.test(day2.sum), JSON.stringify(day2));
  ok('  reviews carry over and the build resets', day2.appr === '{"code":1,"sec":1,"design":1}' && day2.build === 0 && !day2.fin && day2.mode === 'field');
  ok('  every tool is open', await d.state(() => unlockedTools().length) === 5);
  ok('  hud points at the desk with no ceiling', (await d.hud()).includes('100%'), await d.hud());

  /* the desk shows the new ticket */
  await d.page.evaluate(() => { startDesk(); }); await sleep(500); await d.pickChoice(0); await sleep(400); await d.page.evaluate(() => { hideTut(); });
  ok('desk header carries the new ticket', await d.state(() => document.querySelector('#deskhead .tick .key').textContent) === 'LDS-4418');
  await d.shot('day-two-desk');
  await d.page.evaluate(() => { endDesk('quit'); }); await d.advance();

  /* portal shows the short list */
  await d.page.click('#btnB'); await sleep(350);
  const card = await d.state(() => [...document.querySelectorAll('#menuBody .card')].find(c => /LDS-4418/.test(c.textContent)).textContent.replace(/\s+/g, ' '));
  ok('portal lists the day-two steps', /Build to 100%/.test(card) && /carried over/.test(card), card.slice(0, 90));
  await d.page.click('#scMenu .x'); await sleep(200);

  /* ship it again, and choose to come back */
  await d.set({ build: 100, focus: 200, caf: 60 });
  await d.interact(30, 4, 'up'); const pitch = await d.line(); await d.advance();
  ok('Brayden pitches the new ticket', /Legal/.test(pitch) && await d.mode() === 'battle', JSON.stringify(pitch.slice(0, 40)));
  await d.fight(400); await d.advance(30);
  ok('the day ends with a choice', await d.mode() === 'choice' || await d.state(() => document.getElementById('choices').classList.contains('on')));
  await d.pickChoice(0); await d.advance();
  const day3 = await d.state(() => ({ day: S.day, ticket: ticket().key, mode }));
  ok('coming back rolls straight into day three', day3.day === 3 && day3.ticket === 'LDS-4419' && day3.mode === 'field', JSON.stringify(day3));
  ok('save survives the loop', await d.state(() => { saveGame(); const g = loadGame(); return g.day === 3 && g.ticket === 2; }));
  return d;
};

SUITES.side = async browser => {
  const d = await boot(browser);
  section('side quests — five optional chains');

  await d.interact(24, 10, 'up'); await d.advance();
  ok('Devon starts Ownership', await d.state(() => S.side.own) === 1);
  for (const [who, x, y, dir] of [['priya', 9, 12, 'down'], ['sandeep', 25, 24, 'up'], ['mara', 8, 17, 'down']]) {
    await d.interact(x, y, dir); await d.advance();
    ok('  asked ' + who, await d.state(w => !!S.asked[w], who));
  }
  const focusBefore = await d.state(() => S.maxFocus);
  await d.interact(24, 10, 'up'); await d.advance();
  ok('Ownership resolves', await d.state(() => S.side.own) === 2);
  ok('  and raises max Focus', await d.state(() => S.maxFocus) > focusBefore);

  const cafBefore = await d.state(() => S.maxCaf);
  for (const [x, y, dir] of [[5, 2, 'up'], [8, 5, 'right'], [2, 12, 'up'], [13, 25, 'down']]) {
    await d.interact(x, y, dir); await d.advance();
  }
  ok('all four Doctrine pages found', await d.state(() => Object.keys(S.pages).length) === 4);
  ok('  and raise max Caffeine', await d.state(() => S.maxCaf) > cafBefore);
  await d.interact(5, 2, 'up');
  ok('  pages stay re-readable', (await d.line()).length > 20); await d.advance();

  await d.interact(13, 12, 'down'); await d.advance(4);
  const offered = await d.state(() => document.getElementById('choices').classList.contains('on'));
  ok('laptop offers a choice', offered);
  if (offered) { await d.pickChoice(0); await d.advance(); }
  ok('  locking it is recorded', await d.state(() => S.side.laptop) === 1);

  await d.interact(25, 24, 'up'); await d.advance();
  ok('Sandeep offers the requisition quest', await d.state(() => S.side.mon) === 1);
  await d.interact(17, 14, 'down'); await d.advance();
  ok('  Jordan supplies the wording', await d.state(() => !!S.flags.justif));
  await d.interact(25, 24, 'up'); await d.advance();
  ok('  monitor granted', await d.state(() => !!S.owned.monitor));

  ok('Mara pointed at the corner', await d.state(() => S.side.thing) === 1);
  await d.set({ lv: 4, maxFocus: 190, focus: 190, maxCaf: 40, caf: 40, atk: 19, def: 11, weapon: 'keeb', armor: 'cans' });
  await d.page.evaluate(() => { S.owned.keeb = 1; S.owned.cans = 1; });
  await d.interact(31, 15, 'down'); await d.advance(6);
  if (await d.mode() === 'battle') { const r = await d.fight(); await d.advance(20); ok('  the 3am thing is beatable', await d.state(() => S.side.thing) === 2, r + ' rounds'); }
  ok('  and drops the Runbook', await d.state(() => !!S.owned.runbook));

  await d.page.click('#btnB'); await sleep(400);
  const log = await d.state(() => [...document.querySelectorAll('#menuBody .card h3')].map(h => h.textContent).join('|'));
  ok('portal shows a Side Work card', /Side Work/i.test(log), log);
  await d.shot('sidequests');
  await d.page.click('#scMenu .x'); await sleep(250);

  ok('main chain untouched by side work', await d.state(() => S.build) === 0 && await d.state(() => JSON.stringify(S.approvals)) === '{"code":0,"sec":0,"design":0}');
  await d.page.evaluate(() => saveGame());
  await d.page.reload(); await sleep(1100); await d.page.click('#btnCont'); await sleep(600);
  ok('quest state survives save/reload', await d.state(() => Object.keys(S.side).length) === 5 && await d.state(() => Object.keys(S.pages).length) === 4);
  return d;
};

SUITES.desk = async browser => {
  const d = await boot(browser);
  section('desk — three build tools, and interruptions that cost you');

  /* in-page bots: a greedy stacker, a paddle that tracks the ball, a snake that walks to food */
  await d.page.evaluate(() => {
    window.__stackStep = () => {
      const p = D.g.peek(); if (!p.piece) return;
      const { W, H, grid, piece } = p;
      const fits = (c, x, y) => c.length > 0 && c.every(([cx, cy]) => { const gx = x + cx, gy = y + cy; return gx >= 0 && gx < W && gy < H && (gy < 0 || !grid[gy][gx]); });
      const rot = c => { const my = Math.max(...c.map(q => q[1])); const r = c.map(([x, y]) => [my - y, x]);
        const mx = Math.min(...r.map(q => q[0])), mn = Math.min(...r.map(q => q[1])); return r.map(([x, y]) => [x - mx, y - mn]); };
      let best = null, shape = piece.c;
      for (let r = 0; r < 4; r++) {
        for (let x = -2; x < W; x++) {
          if (!fits(shape, x, 0)) continue;
          let y = 0; while (fits(shape, x, y + 1)) y++;
          const g2 = grid.map(row => row.slice());
          shape.forEach(([cx, cy]) => { if (y + cy >= 0) g2[y + cy][x + cx] = 1; });
          let lines = 0, holes = 0, height = 0, maxH = 0, bump = 0; const hs = [];
          for (let yy = 0; yy < H; yy++) if (g2[yy].every(v => v) && !g2[yy].includes('L')) lines++;
          for (let xx = 0; xx < W; xx++) { let seen = false, hh = 0; for (let yy = 0; yy < H; yy++) { if (g2[yy][xx]) { if (!seen) { hh = H - yy; height += hh; } seen = true; } else if (seen) holes++; } hs.push(hh); maxH = Math.max(maxH, hh); }
          for (let xx = 1; xx < W; xx++) bump += Math.abs(hs[xx] - hs[xx - 1]);
          const score = lines * 12 - holes * 6 - height * 0.3 - bump * 0.7 - maxH * 1.0;
          if (!best || score > best.score) best = { score, r, x };
        }
        shape = rot(shape);
      }
      if (!best) return;
      for (let i = 0; i < best.r; i++) D.g.input('a');
      const now = D.g.peek().piece; if (!now) return;
      const dx = best.x - now.x;
      for (let i = 0; i < Math.abs(dx); i++) D.g.input(dx < 0 ? 'left' : 'right');
      D.g.input('b');
    };
  });

  const sit = async () => { await d.page.evaluate(() => { startDesk(); }); await sleep(500);
    if (await d.state(() => document.getElementById('choices').classList.contains('on'))) return true;
    await d.page.evaluate(() => { if (D && D.tut) hideTut(); }); return false; };

  /* ---- the first time a tool opens, a card explains it and the clock waits ---- */
  await d.page.evaluate(() => { startDesk(); }); await sleep(700);
  const tut = await d.state(() => ({ on: document.getElementById('tut').classList.contains('on'), clock: D.clock, ttl: document.getElementById('tutTtl').textContent, flag: S.flags.tut_stack }));
  ok('first open shows a how-to card', tut.on && /Merge Queue/.test(tut.ttl) && tut.flag === 1, JSON.stringify(tut));
  ok('  and the clock waits for it', tut.clock === 0);
  await d.shot('tool-tutorial');
  await d.page.evaluate(() => pressA()); await sleep(300);
  ok('  A dismisses it and the desk runs', await d.state(() => !document.getElementById('tut').classList.contains('on') && D.clock > 0));
  await d.page.evaluate(() => { endDesk('quit'); }); await d.advance();
  await d.page.evaluate(() => { startDesk(); }); await sleep(500);
  ok('  it does not come back', await d.state(() => !document.getElementById('tut').classList.contains('on')));
  await d.page.evaluate(() => { endDesk('quit'); }); await d.advance();

  /* ---- Merge Queue: available from day one, no chooser ---- */
  ok('day one offers exactly one tool', await d.state(() => unlockedTools().join(',')) === 'stack');
  const prompted1 = await sit();
  ok('no chooser with one tool', !prompted1);
  ok('desk opens in Merge Queue', await d.mode() === 'desk' && await d.state(() => D.tool) === 'stack');
  ok('d-pad stays on screen for the tool', await d.state(() => getComputedStyle(document.getElementById('pad')).display) !== 'none');
  ok('A/B relabelled', await d.state(() => document.querySelector('#btnA span').textContent) === 'ROTATE');
  await d.shot('tool-merge-queue');

  /* passive: touch nothing for 20s */
  const WINDOW = 28;
  for (let t = 0; t < WINDOW && await d.mode() === 'desk'; t++) await sleep(1000);
  const passive = await d.state(() => ({ build: S.build, focus: S.focus, max: S.maxFocus, mode }));
  ok('ignoring everything barely builds', passive.build < 8, passive.build + '%');
  ok('ignoring everything drains Focus', passive.focus < passive.max, passive.focus + '/' + passive.max);
  /* always start the active phase on a fresh well, not the junk the passive phase left behind */
  if (await d.mode() === 'desk') await d.page.evaluate(() => { endDesk('quit'); });
  await d.advance();

  /* active: the greedy bot plays, the cards get handled */
  await d.set({ focus: 200, maxFocus: 200, caf: 40, maxCaf: 40, build: 0 });
  await sit();
  let clears = 0, lastBuild = 0;
  for (let t = 0; t < 80 && await d.mode() === 'desk'; t++) {
    for (const b of await d.page.$$('#cards .deal')) { try { await b.click({ timeout: 300 }); } catch (e) {} }
    if (!await d.state(() => D && D.meeting)) await d.page.evaluate(() => window.__stackStep());
    const bnow = await d.state(() => S.build); if (bnow > lastBuild) clears++; lastBuild = bnow;
    await sleep(350);
  }
  const active = await d.state(() => ({ build: S.build, focus: S.focus, mode }));
  ok('playing the queue clears rows and builds', active.build >= 10, active.build + '% after ' + clears + ' scoring drops');
  ok('  without losing Focus', active.focus >= 190, active.focus + '/200');
  await d.shot('tool-merge-queue-late');
  if (await d.mode() === 'desk') await d.page.evaluate(() => { endDesk('quit'); });
  await d.advance();
  ok('A/B restored on leaving', await d.state(() => document.querySelector('#btnA span').textContent) === 'TALK / OK');

  /* garbage and locked rows */
  await d.set({ build: 0 }); await sit(); await sleep(200);
  await d.page.evaluate(() => { D.g.punish(); D.g.meeting(true); });
  const rows = await d.state(() => { const p = D.g.peek(); return { debt: p.grid[p.H - 3].filter(v => v && v !== 'L').length, locked: p.grid[p.H - 1].every(v => v === 'L') && p.grid[p.H - 2].every(v => v === 'L') }; });
  ok('an ignored interruption leaves a row of debt with one hole', rows.debt === 9, JSON.stringify(rows));
  ok('an all-hands leaves two rows you can never clear', rows.locked);
  await d.page.evaluate(() => { endDesk('quit'); }); await d.advance();

  /* ---- dealing with an interruption takes you off the keyboard ---- */
  await d.set({ build: 0, focus: 200, maxFocus: 200, caf: 40, maxCaf: 40 }); await sit(); await sleep(200);
  await d.page.evaluate(() => { D.cards.push(Object.assign({}, INTERRUPTS[0], { life: 9, maxLife: 9 })); renderCards(); });
  ok('a card overlays the board with Deal and Snooze', await d.state(() => document.querySelectorAll('#cards .deal').length === 1 && document.querySelectorAll('#cards .snz').length === 1));
  await d.page.click('#cards .deal'); await sleep(80);
  const away = await d.state(() => ({ away: D.away, on: document.getElementById('away').classList.contains('on'), cards: D.cards.length, handled: D.handled }));
  ok('Deal puts you away from the keyboard', away.away > 1 && away.on && away.cards === 0 && away.handled === 1, JSON.stringify(away));
  const moved = await d.state(() => { const x0 = D.g.peek().piece.x; press('left'); press('left'); pressA(); return D.g.peek().piece.x !== x0; });
  ok('  and your inputs are ignored while away', !moved);
  const y0 = await d.state(() => D.g.peek().piece.y); await sleep(700);
  ok('  while the queue keeps falling', await d.state(() => D.g.peek().piece.y) > y0 || await d.state(() => D.g.peek().grid.flat().filter(v => v).length) > 0);
  await d.shot('desk-away');
  for (let t = 0; t < 40 && await d.state(() => D.away > 0); t++) await sleep(100);
  ok('  then you come back', await d.state(() => D.away === 0 && !document.getElementById('away').classList.contains('on')));

  /* snooze: costs caffeine, comes back angrier, cannot be snoozed twice */
  await d.page.evaluate(() => { D.cards.push(Object.assign({}, INTERRUPTS[1], { life: 10, maxLife: 10 })); renderCards(); });
  await d.page.click('#cards .snz'); await sleep(80);
  const snz = await d.state(() => ({ caf: S.caf, later: D.later.length, cards: D.cards.length, snoozed: D.snoozed }));
  ok('Snooze costs 3 caffeine and defers the card', snz.caf === 37 && snz.later === 1 && snz.cards === 0 && snz.snoozed === 1, JSON.stringify(snz));
  for (let t = 0; t < 110 && await d.state(() => D.later.length > 0 || D.away > 0); t++) await sleep(100);
  const back = await d.state(() => { const c = D.cards.find(c => c.back); return c ? { thr: c.thr, who: c.el && c.el.querySelector('.who').textContent, snz: !!c.el.querySelector('.snz') } : null; });
  ok('  the card comes back angrier and cannot be snoozed again', back && back.thr === (await d.state(() => INTERRUPTS[1].thr)) + 4 && /Following up/.test(back.who) && !back.snz, JSON.stringify(back));
  await d.shot('desk-snooze-back');
  await d.page.evaluate(() => { D.cards.length = 0; renderCards(); });

  /* meetings do not pause the work */
  await d.page.evaluate(() => enterMeeting(MEETINGS[0]));
  const before = await d.state(() => { const p = D.g.peek(); return { y: p.piece.y, filled: p.grid.flat().filter(v => v).length }; });
  const mMoved = await d.state(() => { const x0 = D.g.peek().piece.x; press('right'); pressB(); return D.g.peek().piece.x !== x0; });
  await sleep(900);
  const after = await d.state(() => { const p = D.g.peek(); return { y: p.piece.y, filled: p.grid.flat().filter(v => v).length, mtg: !!D.meeting }; });
  ok('a meeting keeps the queue falling while you cannot touch it', after.mtg && !mMoved && (after.y > before.y || after.filled > before.filled), JSON.stringify({ before, after }));
  await d.shot('desk-meeting-running');
  await d.page.evaluate(() => { endDesk('quit'); }); await d.advance();

  /* ---- Bug Bash unlocks with code review; the chooser appears ---- */
  await d.set({ approvals: { code: 1, sec: 0, design: 0 }, build: 35, focus: 200, maxFocus: 200 });
  ok('code review unlocks a second tool', await d.state(() => unlockedTools().join(',')) === 'stack,breaker');
  const prompted2 = await sit();
  ok('chooser appears with two tools', prompted2 && await d.state(() => document.querySelectorAll('#chList button').length) === 2);
  await d.pickChoice(1); await sleep(400); await d.page.evaluate(() => { hideTut(); });
  ok('Bug Bash opens', await d.state(() => D && D.tool) === 'breaker');
  await d.page.evaluate(() => D.g.input('a'));
  let broke0 = await d.state(() => D.g.peek().left), b0 = await d.state(() => S.build);
  for (let t = 0; t < 90 && await d.mode() === 'desk'; t++) {
    for (const b of await d.page.$$('#cards .deal')) { try { await b.click({ timeout: 300 }); } catch (e) {} }
    await d.page.evaluate(() => { if (!D || D.meeting) return; const p = D.g.peek(); heldDir = p.ball.x < p.pad.x - 6 ? 'left' : p.ball.x > p.pad.x + 6 ? 'right' : null; D.g.input('a'); });
    if (t === 20) await d.shot('tool-bug-bash');
    await sleep(120);
  }
  await d.page.evaluate(() => { heldDir = null; });
  const bb = await d.state(() => ({ left: D ? D.g.peek().left : -1, build: S.build, wave: D ? D.g.peek().wave : -1, mode }));
  ok('the paddle breaks bricks and builds', bb.build > b0, 'build ' + b0 + '% → ' + bb.build + '%, ' + (broke0 - bb.left) + ' bricks, wave ' + (bb.wave + 1));
  if (await d.mode() === 'desk') await d.page.evaluate(() => { endDesk('quit'); });
  await d.advance();

  /* ---- Dependency Chain unlocks with security review ---- */
  await d.set({ approvals: { code: 1, sec: 1, design: 0 }, build: 70, focus: 200, maxFocus: 200 });
  ok('security review unlocks a third tool', await d.state(() => unlockedTools().length) === 3);
  await sit(); await d.pickChoice(2); await sleep(400); await d.page.evaluate(() => { hideTut(); });
  ok('Dependency Chain opens', await d.state(() => D && D.tool) === 'snake');
  let ate = 0, len0 = 3;
  for (let t = 0; t < 120 && await d.mode() === 'desk'; t++) {
    for (const b of await d.page.$$('#cards .deal')) { try { await b.click({ timeout: 300 }); } catch (e) {} }
    const len = await d.page.evaluate(() => {
      if (!D || D.meeting) return 0;
      const p = D.g.peek(); const [hx, hy] = p.body[0]; const [fx, fy] = p.food;
      const blocked = (x, y) => x < 0 || x >= p.W || y < 0 || y >= p.H || p.walls.includes(x + ',' + y) || p.body.some(([bx, by]) => bx === x && by === y);
      const opts = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]].filter(([, dx, dy]) => !blocked(hx + dx, hy + dy));
      opts.sort((a, b) => (Math.abs(hx + a[1] - fx) + Math.abs(hy + a[2] - fy)) - (Math.abs(hx + b[1] - fx) + Math.abs(hy + b[2] - fy)));
      if (opts[0]) D.g.input(opts[0][0]);
      return p.body.length;
    });
    if (len > len0) { ate++; len0 = len; }
    if (t === 40) await d.shot('tool-dependency-chain');
    await sleep(110);
  }
  const sn = await d.state(() => ({ build: S.build, mode }));
  ok('the chain eats and builds', sn.build > 70 && ate > 0, 'ate ' + ate + ', build ' + sn.build + '%');
  if (await d.mode() === 'desk') await d.page.evaluate(() => { endDesk('quit'); });
  await d.advance();

  /* ---- the portal shows the progression ---- */
  await d.page.click('#btnB'); await sleep(350);
  const tools = await d.state(() => [...document.querySelectorAll('#menuBody .card')].find(c => /Build Tools/.test(c.textContent)).textContent.replace(/\s+/g, ' '));
  ok('portal lists tools with the locked ones and their gates', /Merge Queue.?READY/.test(tools) && /Open Floor.?locked/.test(tools) && /Pipeline.?locked/.test(tools), tools.slice(0, 110));
  await d.shot('portal-tools');
  await d.page.click('#scMenu .x'); await sleep(200);

  /* ---- Open Floor unlocks with design review ---- */
  await d.set({ approvals: { code: 1, sec: 1, design: 1 }, build: 70, focus: 200, maxFocus: 200 });
  ok('design review unlocks a fourth tool', await d.state(() => unlockedTools().join(',')) === 'stack,breaker,snake,cross');
  await sit(); await d.pickChoice(3); await sleep(400); await d.page.evaluate(() => { hideTut(); });
  ok('Open Floor opens', await d.state(() => D && D.tool) === 'cross');
  let trips = 0, caughtN = 0;
  for (let t = 0; t < 400 && await d.mode() === 'desk'; t++) {
    /* a sensible player deals with people from the desk row, not mid-crossing */
    if (await d.state(() => D && D.g.peek().py === D.g.peek().H - 1))
      for (const b of await d.page.$$('#cards .deal')) { try { await b.click({ timeout: 300 }); } catch (e) {} }
    const r = await d.page.evaluate(() => {
      if (!D || D.meeting || D.away > 0) return null;
      const p = D.g.peek(); if (p.hit) return { hit: 1 };
      const safe = (x, y, ahead) => { const L = p.lanes.find(l => l.y === y); if (!L) return true;
        return !L.objs.some(o => { const x2 = o.x + L.dir * L.spd * ahead; const lo = Math.min(o.x, x2) - 0.15, hi = Math.max(o.x, x2) + o.w + 0.15; return x + 0.8 > lo && x + 0.2 < hi; }); };
      if (safe(p.px, p.py - 1, 0.55)) D.g.input('up');
      else if (!safe(p.px, p.py, 0.35)) { if (p.px > 0 && safe(p.px - 1, p.py, 0.35)) D.g.input('left'); else if (p.px < p.W - 1 && safe(p.px + 1, p.py, 0.35)) D.g.input('right'); else if (safe(p.px, p.py + 1, 0.35)) D.g.input('down'); }
      return { trips: p.crossings };
    });
    if (r && r.hit) caughtN++;
    if (r && r.trips > trips) trips = r.trips;
    if (t === 60) await d.shot('tool-open-floor');
    await sleep(100);
  }
  const of = await d.state(() => ({ build: S.build, mode }));
  ok('crossing the floor builds', trips >= 1 && of.build > 70, trips + ' trips, build ' + of.build + '%, caught ' + caughtN + ' ticks');
  if (await d.mode() === 'desk') await d.page.evaluate(() => { endDesk('quit'); });
  await d.advance();

  /* ---- Pipeline unlocks when the thing in the corner is dealt with ---- */
  await d.page.evaluate(() => { setSq('thing', 2); });
  await d.set({ build: 70, focus: 200, maxFocus: 200 });
  ok('the Thing quest unlocks a fifth tool', await d.state(() => unlockedTools().length) === 5);
  await sit(); await d.pickChoice(4); await sleep(400); await d.page.evaluate(() => { hideTut(); });
  ok('Pipeline opens', await d.state(() => D && D.tool) === 'pipes');
  const start = await d.state(() => { const p = D.g.peek(); return { cursor: p.cx + ',' + p.cy, arrive: p.arrive, path: p.grid.flat().filter(c => c.path).length }; });
  ok('  with a countdown and a scrambled path', start.arrive > 5 && start.path >= 15, JSON.stringify(start));
  let boards = 0, leaks = 0;
  for (let t = 0; t < 400 && await d.mode() === 'desk'; t++) {
    for (const b of await d.page.$$('#cards .deal')) { try { await b.click({ timeout: 300 }); } catch (e) {} }
    const r = await d.page.evaluate(() => {
      if (!D || D.meeting || D.away > 0) return null;
      const p = D.g.peek();
      let target = null;
      for (let y = 0; y < p.H && !target; y++) for (let x = 0; x < p.W; x++) { const c = p.grid[y][x]; if (c.path && !c.filled && c.m !== p.sol[y][x]) { target = [x, y]; break; } }
      if (!target) { if (!p.flowing) D.g.input('b'); return { boards: p.boards, leaks: p.leaks }; }
      const [tx, ty] = target;
      if (p.cx !== tx) D.g.input(p.cx < tx ? 'right' : 'left');
      else if (p.cy !== ty) D.g.input(p.cy < ty ? 'down' : 'up');
      else D.g.input('a');
      return { boards: p.boards, leaks: p.leaks };
    });
    if (r) { boards = r.boards; leaks = r.leaks; }
    if (t === 30) await d.shot('tool-pipeline');
    await sleep(60);
  }
  const pl = await d.state(() => ({ build: S.build, mode }));
  ok('plumbing a board before the data arrives builds', boards >= 1 && pl.build > 70, boards + ' boards, ' + leaks + ' leaks, build ' + pl.build + '%');
  if (await d.mode() === 'desk') await d.page.evaluate(() => { endDesk('quit'); });
  await d.advance();
  return d;
};

SUITES.mobile = async browser => {
  const d = await boot(browser);
  section('mobile — the platform, not the game');

  /* nothing may scroll sideways, at the narrowest phone we support */
  await d.page.setViewportSize({ width: 320, height: 568 }); await sleep(400);
  const overflow = await d.state(() => ({
    doc: document.documentElement.scrollWidth <= window.innerWidth + 1,
    body: document.body.scrollWidth <= window.innerWidth + 1,
    w: document.documentElement.scrollWidth + '/' + window.innerWidth
  }));
  ok('no sideways scroll at 320px', overflow.doc && overflow.body, overflow.w);

  /* every control you have to hit repeatedly is thumb-sized (44px is the
     platform guidance on both stores) */
  const small = await d.state(() => [...document.querySelectorAll('#pad button, .act')]
    .map(b => ({ id: b.id || b.className, r: b.getBoundingClientRect() }))
    .filter(x => x.r.width && (x.r.width < 40 || x.r.height < 40))
    .map(x => x.id + ' ' + Math.round(x.r.width) + 'x' + Math.round(x.r.height)));
  ok('controls stay thumb-sized on a small phone', small.length === 0, small.join(', '));

  /* the tool card has to fit, not spill off the top */
  await d.page.evaluate(() => { S.flags.satDown = 1; startDesk(); }); await sleep(700);
  const card = await d.state(() => {
    const b = document.querySelector('#tut .b'); if (!b) return null;
    const r = b.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, h: window.innerHeight, fits: r.top >= -1 && r.bottom <= window.innerHeight + 1 };
  });
  ok('the tool card fits a small screen', card && card.fits, card && Math.round(card.top) + '..' + Math.round(card.bottom) + ' of ' + card.h);
  await d.page.evaluate(() => { hideTut(); });

  /* sideways: the game asks for portrait and stops the clock */
  await d.page.setViewportSize({ width: 568, height: 320 }); await sleep(500);
  const land = await d.state(() => ({
    shown: getComputedStyle(document.getElementById('rotate')).display !== 'none',
    body: document.body.classList.contains('sideways'), paused: sideways
  }));
  ok('a phone held sideways is asked to turn back', land.shown && land.body && land.paused, JSON.stringify(land));
  const c0 = await d.state(() => D && D.clock);
  await sleep(1200);
  const c1 = await d.state(() => D && D.clock);
  ok('  and the desk clock stops while it waits', c0 !== null && c1 === c0, c0 + ' → ' + c1);

  await d.page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  const back = await d.state(() => ({ shown: getComputedStyle(document.getElementById('rotate')).display !== 'none', paused: sideways }));
  ok('  turning back resumes', !back.shown && !back.paused);
  const c2 = await d.state(() => D && D.clock);
  await sleep(900);
  ok('  the clock runs again', await d.state(() => D && D.clock) > c2);

  /* a laptop is landscape too, and must not be nagged */
  await d.page.setViewportSize({ width: 1280, height: 800 }); await sleep(400);
  ok('a laptop in landscape is left alone', await d.state(() => !sideways));
  await d.page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
  await d.page.evaluate(() => { endDesk('quit'); }); await d.advance();

  /* a save the device mangled must not strand you on a dead Resume button */
  await d.page.evaluate(() => { localStorage.setItem('shipit_lodestar_v2', '{"build":40,"maxFo'); });
  ok('a truncated save is not offered as Resume', await d.state(() => hasSave() === false));
  ok('  and it is cleared, so the title is usable', await d.state(() => !localStorage.getItem('shipit_lodestar_v2')));
  await d.page.evaluate(() => { localStorage.setItem('shipit_lodestar_v2', 'not json at all'); });
  ok('  same for junk', await d.state(() => hasSave() === false && !localStorage.getItem('shipit_lodestar_v2')));

  /* a device that refuses writes says so once, instead of failing silently */
  await d.page.evaluate(() => {
    window.__realSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    warnedNoStore = false; lastAuto = 0; autosave(true);
  });
  await sleep(200);
  ok('a full or blocked storage warns the player', await d.state(() => document.getElementById('toast').classList.contains('on')
    && /will not store/.test(document.getElementById('toast').textContent)));
  await d.page.evaluate(() => { localStorage.setItem = window.__realSet; });

  /* backgrounding the app writes the save, with no save button pressed */
  await d.page.evaluate(() => { localStorage.clear(); Object.assign(S, { build: 61, credits: 777, lv: 3 }); });
  ok('nothing saved yet', await d.state(() => !localStorage.getItem('shipit_lodestar_v2')));
  await d.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(300);
  const saved = await d.state(() => { const raw = localStorage.getItem('shipit_lodestar_v2'); return raw ? JSON.parse(raw) : null; });
  ok('backgrounding the app saves it', saved && saved.build === 61 && saved.credits === 777, saved && ('build ' + saved.build + ', ' + saved.credits + ' credits'));

  /* and a fight is a checkpoint on its own */
  await d.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    localStorage.clear(); S.credits = 1234;
  });
  await d.page.evaluate(() => { startBattle(['replyall']); }); await sleep(700);
  await d.fight(); await d.advance(30);
  ok('a finished fight is a checkpoint', await d.state(() => { const r = localStorage.getItem('shipit_lodestar_v2'); return !!r && JSON.parse(r).credits >= 1234; }));
  return d;
};

SUITES.store = async browser => {
  const d = await boot(browser);
  section('store readiness — self-contained, durable, identifiable');

  const reqs = await d.state(() => performance.getEntriesByType('resource')
    .map(r => r.name).filter(n => !n.startsWith('file:')));
  ok('makes no network requests', reqs.length === 0, reqs.join(', '));
  ok('fonts render from the bundle', await d.state(() => document.fonts.check('600 16px "IBM Plex Sans"')
    && document.fonts.check('400 16px "IBM Plex Serif"') && document.fonts.check('400 16px "IBM Plex Mono"')));
  const icons = await d.state(() => {
    const el = document.querySelector('link[rel="manifest"]');
    if (!el) return null;
    const m = JSON.parse(decodeURIComponent(el.getAttribute('href').replace(/^data:application\/manifest\+json,/, '')));
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    return {
      name: m.name, display: m.display,
      sizes: m.icons.map(i => i.sizes + ' ' + i.purpose).join(', '),
      allPng: m.icons.every(i => /^data:image\/png;base64,/.test(i.src)),
      maskable: m.icons.some(i => i.purpose === 'maskable'),
      applePng: !!apple && /^data:image\/png;base64,/.test(apple.getAttribute('href'))
    };
  });
  ok('declares an installable manifest', !!icons && icons.name === 'SHIP IT' && icons.display === 'fullscreen');
  ok('  ships PNG icons, including a maskable one', icons && icons.allPng && icons.maskable, icons && icons.sizes);
  ok('  and a PNG home-screen icon for iOS', icons && icons.applePng);
  const iconLoads = await d.state(async () => {
    const src = document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href');
    return await new Promise(res => { const i = new Image(); i.onload = () => res(i.width + 'x' + i.height); i.onerror = () => res('broken'); i.src = src; });
  });
  ok('  the icon actually decodes', iconLoads === '180x180', String(iconLoads));
  ok('build number is on the title', await d.state(() => /v\d+\.\d+\.\d+/.test(document.getElementById('titleVer').textContent)));

  // saves: versioned, exportable, restorable
  await d.set({ build: 62, lv: 3, credits: 404 });
  await d.page.evaluate(() => saveGame());
  ok('save carries a version', await d.state(() => JSON.parse(localStorage.getItem('shipit_lodestar_v2')).version) >= 2);
  const code = await d.state(() => exportSave());
  ok('exports a save code', typeof code === 'string' && code.length > 40, code.length + ' chars');
  const restored = await d.state(c => { const g = importSave(c); return g && g.build + '/' + g.credits; }, code);
  ok('restores from that code', restored === '62/404', String(restored));
  ok('rejects a bad code', await d.state(() => importSave('not-a-save')) === null);

  // a pre-rename save must still load
  const migrated = await d.state(() => {
    localStorage.clear();
    localStorage.setItem('shipit_vanta_v1', JSON.stringify({ lv: 2, xp: 60, build: 35, maxFocus: 130 }));
    const g = loadGame();
    return g && (g.version + '|' + g.build + '|' + (g.opts ? 'opts' : 'no-opts') + '|' + (g.side ? 'side' : 'no-side'));
  });
  ok('migrates a pre-rename save', migrated === '2|35|opts|side', String(migrated));

  // settings are reachable and persist
  await d.page.evaluate(() => { localStorage.clear(); });
  await d.page.click('#btnB'); await sleep(350);
  await d.page.click('#menuBody button:has-text("Settings")'); await sleep(350);
  const labels = await d.state(() => [...document.querySelectorAll('#listBody .g')].map(e => e.firstChild.textContent).join(','));
  ok('settings expose sound, extra time and haptics', /Sound/.test(labels) && /Extra time/.test(labels) && /Haptics/.test(labels), labels);
  const before = await d.state(() => S.opts.extraTime);
  await d.page.click('#listBody button:has-text("Extra time")'); await sleep(300);
  ok('extra time toggles', await d.state(() => S.opts.extraTime) !== before);
  await d.shot('settings');
  return d;
};

/* =====================  RUN  ===================== */
(async () => {
  const exe = findChrome();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const wanted = named.length ? named : Object.keys(SUITES);
  const allErrors = [];

  console.log('playtest — ' + wanted.join(', ') + (DEBUG ? '  [debug]' : ''));
  if (DEBUG) setTimeout(async () => {
    console.log('\nWATCHDOG: no verdict after 240s.\n  last checkpoint: ' + lastLabel + '\n  last page marker: ' + lastMark +
      '\n  page heartbeat: ' + (lastBeat ? ((Date.now() - lastBeat) / 1000).toFixed(1) + 's ago' : 'never') +
      (lastBeat && Date.now() - lastBeat > 3000 ? '  ← main thread is spinning' : '  ← page is alive; Node side is stuck'));
    try { await browser.close(); } catch (e) {}
    process.exit(3);
  }, 240000).unref();
  for (const name of wanted) {
    if (!SUITES[name]) { console.log('\n  unknown suite: ' + name); failed++; continue; }
    let d;
    try { d = await SUITES[name](browser); }
    catch (e) { failed++; console.log('    FAIL ' + name + ' threw — ' + e.message + (DEBUG ? '\n' + e.stack : '')); }
    if (d) {
      ok(name + ': no page errors', d.errors.length === 0, d.errors.slice(0, 3).join(' / '));
      allErrors.push(...d.errors);
      await d.page.close();
    }
  }
  await browser.close();

  console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ' — ' + passed + ' checks passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
