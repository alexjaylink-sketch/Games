const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('ship_it_rpg.html')); await sleep(1200);
  await page.click('#btnNew'); await sleep(300); await page.click('#btnAccept'); await sleep(300); await page.click('#skipIntro'); await sleep(800);
  for (let i = 0; i < 12; i++) { if (await page.evaluate(() => mode) === 'field') break; await page.click('#btnA'); await sleep(220); }

  const make = (label, setup) => page.evaluate(([label, setup]) => {
    // eslint-disable-next-line no-eval
    eval(setup);
    return { label, code: exportSave() };
  }, [label, setup]);

  const codes = [];
  codes.push(await make('Chapter 1, ready for the boss', `
    Object.assign(S, { build:100, approvals:{code:1,sec:1,design:1}, lv:5, xp:300, atk:24, def:9,
      focus:200, maxFocus:200, caf:50, maxCaf:50, credits:400,
      bag:{snack:3,brew:2}, owned:{laptop:1,lanyard:1,keeb:1,cans:1}, weapon:'keeb', armor:'cans',
      x:27, y:9, dir:'up' });
    S.flags.satDown=1; S.flags.briefed=1;`));

  codes.push(await make('Chapter 2, first morning on Floor 6', `
    Object.assign(S, { ch:2, day:2, ticket:0, build:0, floor:'f6',
      sign:{legal:0,comms:0,finance:0}, approvals:{code:1,sec:1,design:1},
      lv:5, xp:320, atk:25, def:10, focus:210, maxFocus:210, caf:55, maxCaf:55, credits:520,
      bag:{snack:4,brew:3}, owned:{laptop:1,lanyard:1,keeb:1,cans:1}, weapon:'keeb', armor:'cans',
      x:16, y:4, dir:'down' });
    S.flags.satDown=1; S.flags.briefed=1; S.flags.ch2=1; S.flags.finished=0;`));

  codes.push(await make('Chapter 2, all signed, at the founder door', `
    Object.assign(S, { ch:2, day:2, ticket:0, build:100, floor:'f6',
      sign:{legal:1,comms:1,finance:1}, approvals:{code:1,sec:1,design:1},
      lv:6, xp:420, atk:30, def:12, focus:250, maxFocus:250, caf:70, maxCaf:70, credits:800,
      bag:{snack:5,brew:4}, owned:{laptop:1,lanyard:1,keeb:1,cans:1,monitor:1,block:1}, weapon:'monitor', armor:'block',
      x:27, y:18, dir:'down' });
    S.flags.satDown=1; S.flags.briefed=1; S.flags.ch2=1; S.flags.saw_plate=1;`));

  codes.push(await make('The day loop, day 3 (launch week)', `
    Object.assign(S, { ch:1, day:3, ticket:1, build:0, floor:'f3',
      approvals:{code:1,sec:1,design:1},
      lv:6, xp:430, atk:30, def:12, focus:250, maxFocus:250, caf:70, maxCaf:70, credits:900,
      bag:{snack:5,brew:4}, owned:{laptop:1,lanyard:1,keeb:1,cans:1,monitor:1,block:1}, weapon:'monitor', armor:'block',
      x:15, y:6, dir:'down' });
    S.flags.satDown=1; S.flags.briefed=1; S.flags.ch2=1; S.flags.ch2done=1; S.flags.finished=0;`));

  // prove every one of them actually loads back into a playable state
  for (const c of codes) {
    const ok = await page.evaluate(code => {
      const g = importSave(code);
      if (!g) return 'REJECTED';
      return 'ch' + (g.ch || 1) + ' day' + (g.day || 1) + ' ' + (g.floor || 'f3') + ' build' + g.build + ' lv' + g.lv;
    }, c.code);
    console.log('--- ' + c.label + '\n    verified: ' + ok + '\n    chars: ' + c.code.length);
  }
  require('fs').writeFileSync(path.join(__dirname,'..','build','savecodes.json'), JSON.stringify(codes, null, 1));
  await browser.close();
})();
