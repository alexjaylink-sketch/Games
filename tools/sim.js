#!/usr/bin/env node
/**
 * Combat balance simulator for ship_it_rpg.html
 *
 * Reads the live numbers out of the game file — enemy stats, item bonuses,
 * the XP curve, level growth, the damage formula and the real skill
 * functions — then plays out thousands of fights. Nothing here restates a
 * constant, so it cannot drift out of sync with the game.
 *
 *   node tools/sim.js
 *   node tools/sim.js --runs 2000
 */
const fs = require('fs');
const path = require('path');

const GAME = path.join(__dirname, '..', 'ship_it_rpg.html');
const RUNS = (() => {
  const i = process.argv.indexOf('--runs');
  return i > -1 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 600) : 600;
})();

const html = fs.readFileSync(GAME, 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

/* ---------- pull the real values out of the source ---------- */
function objectLiteral(name) {
  const at = js.indexOf('const ' + name + ' = ');
  if (at < 0) throw new Error('cannot find ' + name + ' — did the game file change?');
  const start = js.indexOf('{', at);
  let depth = 0, i = start;
  for (; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}' && --depth === 0) { i++; break; }
  }
  return js.slice(start, i);
}
function need(re, label) {
  const m = js.match(re);
  if (!m) throw new Error('cannot read ' + label + ' — did the game file change?');
  return m;
}

const ENEMIES = eval('(function(){const E=o=>o; return ' + objectLiteral('ENEMIES') + '})()');
const ITEMS   = eval('(' + objectLiteral('ITEMS') + ')');
const SKILLS  = eval('(' + objectLiteral('SKILLS') + ')');   // real formulas, not copies
const XPCURVE = eval(need(/const XPCURVE = (\[[^\]]*\]);/, 'XPCURVE')[1]);

const DEFMUL = parseFloat(need(/Math\.round\(atk\*\(1\+Math\.random\(\)\*[\d.]+\)\*mult - def\*([\d.]+)\)/, 'defence multiplier')[1]);
const VAR    = parseFloat(need(/Math\.round\(atk\*\(1\+Math\.random\(\)\*([\d.]+)\)/, 'damage variance')[1]);
const WEAK   = parseFloat(need(/if\(f\.weak === k\)\{ mult = ([\d.]+); \}/, 'weakness multiplier')[1]);

const g = need(/S\.maxFocus \+= (\d+); S\.maxCaf \+= (\d+); S\.atk \+= (\d+); S\.def \+= (\d+);/, 'level growth');
const GROWTH = { focus: +g[1], caf: +g[2], atk: +g[3], def: +g[4] };

const b = need(/focus:(\d+), maxFocus:(\d+), caf:(\d+), maxCaf:(\d+),\s*\n\s*atk:(\d+), def:(\d+)/, 'starting stats');
const BASE = { focus: +b[2], caf: +b[4], atk: +b[5], def: +b[6] };

const HEAL = parseFloat(need(/f\.maxHp\*\(f\.healPct\|\|([\d.]+)\)/, 'enemy heal share')[1]);

/* ---------- the model ---------- */
const calcDmg = (atk, def, mult) =>
  Math.max(1, Math.round(atk * (1 + Math.random() * VAR) * mult - def * DEFMUL));

function makePlayer(lv, weapon, armor) {
  const p = { lv, maxFocus: BASE.focus, maxCaf: BASE.caf, atk: BASE.atk, def: BASE.def };
  for (let i = 1; i < lv; i++) {
    p.maxFocus += GROWTH.focus; p.maxCaf += GROWTH.caf;
    p.atk += GROWTH.atk; p.def += GROWTH.def;
  }
  p.focus = p.maxFocus; p.caf = p.maxCaf;
  p.atkTotal = p.atk + (ITEMS[weapon].atk || 0);
  p.defTotal = p.def + (ITEMS[armor].def || 0);
  return p;
}

/** skilled = heals, exploits weaknesses, manages caffeine. masher = Commit only. */
function playerTurn(p, foe, policy) {
  if (policy === 'mash') { foe.hp -= calcDmg(p.atkTotal, foe.def, 1); return; }

  const can = k => SKILLS[k] && p.lv >= SKILLS[k].lv && p.caf >= SKILLS[k].cost;
  const use = k => {
    const sk = SKILLS[k];
    p.caf -= sk.cost;
    if (sk.self) {
      const r = sk.self({ maxFocus: p.maxFocus, atk: p.atkTotal });
      if (r.heal) p.focus = Math.min(p.maxFocus, p.focus + r.heal);
      if (r.caf)  p.caf = Math.min(p.maxCaf, p.caf + r.caf);
      return;
    }
    const r = sk.hit({ atk: p.atkTotal, maxFocus: p.maxFocus }, foe);
    foe.hp -= calcDmg(r.dmg, foe.def, foe.weak === k ? WEAK : 1);
  };

  if (p.focus < p.maxFocus * 0.42 && can('refactor')) return use('refactor');
  if (foe.weak && can(foe.weak))                      return use(foe.weak);
  if (can('escalate') && foe.hp > p.atkTotal * 2)     return use('escalate');
  if (p.caf <= 3 && can('duck'))                      return use('duck');
  foe.hp -= calcDmg(p.atkTotal, foe.def, 1);
}

function fight(lv, ids, weapon, armor, policy) {
  const p = makePlayer(lv, weapon, armor);
  const foes = ids.map(id => Object.assign({}, ENEMIES[id], { hp: ENEMIES[id].hp, maxHp: ENEMIES[id].hp, alive: 1, atkMod: 0 }));
  let rounds = 0, skipped = 0;

  while (rounds++ < 80) {
    const target = foes.find(f => f.alive);
    if (!target) break;
    if (skipped) skipped = 0;
    else {
      playerTurn(p, target, policy);
      if (target.hp <= 0) { target.hp = 0; target.alive = 0; }
    }
    if (!foes.some(f => f.alive)) break;

    for (const f of foes) {
      if (!f.alive) continue;
      if (f.grow) f.atkMod += f.grow;
      const mv = f.moves[Math.floor(Math.random() * f.moves.length)];
      if (mv.t === 'skip') continue;
      if (mv.t === 'heal') { f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * (f.healPct || HEAL))); continue; }
      if (mv.t === 'status') { if (Math.random() < 0.7) skipped = 1; continue; }
      p.focus -= calcDmg(f.atk + f.atkMod, p.defTotal, mv.p);
    }
    if (p.focus <= 0) break;
  }
  const won = !foes.some(f => f.alive) && p.focus > 0;
  return { won, left: won ? p.focus / p.maxFocus : 0, rounds };
}

function run(lv, ids, weapon, armor, policy) {
  let wins = 0, left = 0, rounds = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = fight(lv, ids, weapon, armor, policy);
    if (r.won) { wins++; left += r.left; rounds += r.rounds; }
  }
  return { rate: wins / RUNS, left: wins ? left / wins * 100 : 0, rounds: wins ? rounds / wins : 0 };
}

function row(label, lv, ids, weapon, armor) {
  const s = run(lv, ids, weapon, armor, 'skilled');
  const m = run(lv, ids, weapon, armor, 'mash');
  const pct = v => String(Math.round(v)).padStart(3);
  console.log(
    '  ' + label.padEnd(22) + ' lv' + lv +
    ' ' + weapon.padEnd(7) + '/' + armor.padEnd(7) +
    ' | skilled ' + pct(s.rate * 100) + '% left ' + pct(s.left) + '% rds ' + s.rounds.toFixed(1).padStart(5) +
    ' | masher ' + pct(m.rate * 100) + '% left ' + pct(m.left) + '% rds ' + m.rounds.toFixed(1).padStart(5)
  );
}

/* ---------- report ---------- */
console.log('ship_it_rpg balance — ' + RUNS + ' fights per line');
console.log('read from source: def x' + DEFMUL + ', variance ' + VAR + ', weakness x' + WEAK +
            ', growth ' + JSON.stringify(GROWTH) + ', base ' + JSON.stringify(BASE));

console.log('\nRANDOM ENCOUNTERS (level 1, as you first meet them)');
['replyall','flaky','merge','creep','quickq','legacy','standup']
  .forEach(id => row(ENEMIES[id].name, 1, [id], 'laptop', 'hoodie'));

console.log('\nRANDOM ENCOUNTERS (level 3, geared)');
['replyall','merge','legacy'].forEach(id => row(ENEMIES[id].name, 3, [id], 'keeb', 'cans'));

console.log('\nSET PIECES — the gates on the critical path');
[1,2,3].forEach(lv => row('Jordan', lv, ['jordan'], lv >= 3 ? 'keeb' : 'laptop', lv >= 3 ? 'cans' : 'hoodie'));
[3,4,5].forEach(lv => row('Data Breach', lv, ['breach'], 'keeb', 'cans'));
[3,4].forEach(lv  => row('Capture The Flag', lv, ['spirit','flag'], 'keeb', 'cans'));

console.log('\nOPTIONAL — the thing in the corner');
[3,4,5].forEach(lv => row('Thing@3AM', lv, ['thing3am'], 'keeb', 'cans'));

console.log('\nFINAL BOSS — with gear you can realistically afford');
[3,4,5,6].forEach(lv => row('Brayden', lv, ['brayden'], 'keeb', 'cans'));
console.log('\nFINAL BOSS — fully kitted');
[4,5,6].forEach(lv => row('Brayden', lv, ['brayden'], 'monitor', 'block'));

console.log('\nROUTE — xp available on the critical path');
let xp = 0;
const step = (n, label) => {
  xp += n;
  let lv = 1;
  for (let i = 1; i < XPCURVE.length; i++) if (xp >= XPCURVE[i]) lv = i + 1;
  console.log('  after ' + label.padEnd(24) + 'xp ' + String(xp).padStart(4) + '  → level ' + lv);
};
step(3 * 28, '3 desk sessions');
step(6 * 15, '6 random encounters');
step(ENEMIES.jordan.sp, 'Jordan');
step(ENEMIES.breach.sp, 'Data Breach');
step(ENEMIES.spirit.sp + ENEMIES.flag.sp, 'Capture The Flag');
