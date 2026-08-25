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

let passed = 0, failed = 0;
const ok  = (label, cond, detail) => {
  if (cond) { passed++; console.log('    ok   ' + label + (detail ? '  — ' + detail : '')); }
  else { failed++; console.log('    FAIL ' + label + (detail ? '  — ' + detail : '')); }
};
const section = t => console.log('\n  ' + t);

/* ---------- a tiny driver over the game's own globals ---------- */
async function boot(browser, { stage = 'field' } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(GAME);
  await sleep(1200);

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
  ok('save written', await d.state(() => !!localStorage.getItem('shipit_vanta_v1')));

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

  await d.page.evaluate(() => { startDesk(); }); await sleep(400);
  ok('build ceiling is 35%', await d.state(() => D.target) === 35);
  ok('ceiling is shown on the bar', (await d.state(() => document.getElementById('buildnote').textContent)).includes('35%'));
  await d.page.evaluate(() => { D.progress = 34.7; }); await sleep(1100); await d.advance();
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
  section('desk — interruptions must actually cost you');

  await d.page.evaluate(() => { startDesk(); }); await sleep(500);
  ok('desk mode opens', await d.mode() === 'desk');
  ok('  and hides the walking controls', await d.state(() => getComputedStyle(document.getElementById('pad')).display) === 'none');

  const WINDOW = 24;   // seconds per observation; long enough to separate the two playstyles
  for (let t = 0; t < WINDOW && await d.mode() === 'desk'; t++) await sleep(1000);
  const passive = await d.state(() => ({ build: S.build, focus: S.focus, max: S.maxFocus }));
  ok('ignoring everything barely builds', passive.build < 20, passive.build + '%');
  ok('ignoring everything drains Focus', passive.focus < passive.max * 0.85, passive.focus + '/' + passive.max);
  await d.shot('desk-swamped');

  if (await d.mode() !== 'desk') await d.advance();
  await d.set({ focus: 200, maxFocus: 200, caf: 40, maxCaf: 40 });
  if (await d.mode() !== 'desk') { await d.page.evaluate(() => { startDesk(); }); await sleep(500); }
  const from = await d.state(() => S.build);
  for (let t = 0; t < WINDOW && await d.mode() === 'desk'; t++) {
    for (const b of await d.page.$$('#cards .btn')) { try { await b.click({ timeout: 500 }); } catch (e) {} }
    await sleep(1000);
  }
  const active = await d.state(() => ({ build: S.build, focus: S.focus }));
  ok('handling everything makes real progress', active.build - from > passive.build, '+' + (active.build - from) + '% vs +' + passive.build + '%');
  ok('  and costs no Focus', active.focus >= 180, active.focus + '/200');
  return d;
};

/* =====================  RUN  ===================== */
(async () => {
  const exe = findChrome();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const wanted = named.length ? named : Object.keys(SUITES);
  const allErrors = [];

  console.log('playtest — ' + wanted.join(', '));
  for (const name of wanted) {
    if (!SUITES[name]) { console.log('\n  unknown suite: ' + name); failed++; continue; }
    let d;
    try { d = await SUITES[name](browser); }
    catch (e) { failed++; console.log('    FAIL ' + name + ' threw — ' + e.message); }
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
