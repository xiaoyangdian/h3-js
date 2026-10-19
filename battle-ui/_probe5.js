// 验证：移动后的下一步指引（无目标 / 有目标 / 超范围 / 悬停成本预警）
const fs = require('fs');
const path = require('path');

function El(tag) {
  this.tagName = tag; this.children = []; this.attrs = {}; this.style = {};
  this.dataset = {}; this.listeners = {}; this.textContent = ''; this._cls = new Set();
  this._html = ''; this.parentNode = null; this.disabled = false;
  var self = this;
  this.classList = {
    add: function(){ for (var i=0;i<arguments.length;i++) self._cls.add(arguments[i]); },
    remove: function(){ for (var i=0;i<arguments.length;i++) self._cls.delete(arguments[i]); },
    toggle: function(c, f){ f ? self._cls.add(c) : self._cls.delete(c); },
    contains: function(c){ return self._cls.has(c); }
  };
}
El.prototype.setAttribute = function(k, v){ this.attrs[k] = String(v); if (k === 'class') this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); };
El.prototype.getAttribute = function(k){ return this.attrs[k]; };
El.prototype.appendChild = function(c){ this.children.push(c); c.parentNode = this; return c; };
El.prototype.insertBefore = function(c, ref){ var i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); c.parentNode = this; return c; };
El.prototype.removeChild = function(c){ if (!c) return c; var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; };
El.prototype.addEventListener = function(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); };
El.prototype.remove = function(){ if (this.parentNode) this.parentNode.removeChild(this); };
El.prototype.querySelector = function(){ return null; };
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function(){ return this._html; },
  set: function(v){ this._html = v; this.children = []; }
});
Object.defineProperty(El.prototype, 'offsetWidth', { get: function(){ return 0; } });
// log() 裁日志用 box.lastChild / box.firstChild——桩必须提供，否则 removeChild(undefined) 抛错
Object.defineProperty(El.prototype, 'firstChild', { get: function(){ return this.children[0] || null; } });
Object.defineProperty(El.prototype, 'lastChild', { get: function(){ return this.children[this.children.length - 1] || null; } });

var store = {};
global.document = {
  getElementById: function(id){ return store[id] || (store[id] = new El('div')); },
  createElement: function(t){ return new El(t); },
  createElementNS: function(ns, t){ return new El(t); },
  querySelector: function(){ return null; }
};

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace(/\r\n/g, '\n');   // 容忍 CRLF checkout：先归一成 LF 再做字面量注入
src = src.replace('  init();\n})();',
  '  globalThis.__T = {\n' +
  '    units: function(){ return units },\n' +
  '    current: current, init: init, render: render, dist: dist, unitAt: unitAt, isRock: isRock,\n' +
  '    setStep: function(v){ stepDelay = v },\n' +
  '    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },\n' +
  '    click: function(x,y){ onHexClick({ currentTarget: { dataset: { x: x, y: y } } }) },\n' +
  '    hover: function(x,y){ onHexHover(x, y) },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '    moveCount: function(){ return moveMap.size },\n' +
  '    get moveMap(){ return moveMap }, get atkSet(){ return atkSet },\n' +
  '    hasMovedNow: function(){ return hasMoved },\n' +
  '    defendDisabled: function(){ return document.getElementById("btnDefend").disabled },\n' +
  '    waitDisabled: function(){ return document.getElementById("btnWait").disabled },\n' +
  '    canStrikeNow: canStrikeNow, unitDist: unitDist,\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;
T.setStep(0);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function place(u, x, y){ u.x = x; u.y = y; }
function hintHas(){ var h = T.hint(); return Array.prototype.every.call(arguments, function(s){ return h.indexOf(s) >= 0; }); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

(async function(){
  console.log('--- 1. 点空地 = 纯移动，走完立刻交棒 ---');
  var pk = byId('A1');
  place(pk, 1, 5);
  T.forceTurn(pk);
  ok('回合开始：枪兵可选中', T.current() === pk);
  T.click(5, 5);
  ok('走到了点的那一格', pk.x === 5 && pk.y === 5, pk.x + ',' + pk.y);
  ok('提示只有「已移动 + 行动结束」，不再提"能打到谁"', hintHas('行动结束') && !hintHas('现在能打到'), T.hint());
  var before1 = T.current();
  await sleep(900);
  ok('不用点任何按钮，行动自动过去', T.current() !== before1,
    before1 && T.current() && (before1.name + ' -> ' + T.current().name));

  console.log('--- 2. 点空地走到敌人旁边：仍然只是移动，不附带攻击 ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 9, 5);
  T.forceTurn(pk);
  var imp0 = byId('E1'), impHp0 = imp0.hp;
  T.click(11, 5);
  ok('走到 (11,5)', pk.x === 11 && pk.y === 5, pk.x + ',' + pk.y);
  ok('贴着敌人也照样结束，不提示"现在能打到"', !hintHas('现在能打到'), T.hint());
  ok('敌人一点血没掉（移动不是攻击）', imp0.hp === impHp0, impHp0 + ' -> ' + imp0.hp);
  await sleep(900);
  ok('立刻交棒给下一个单位，不会停在原地等第二次操作',
    T.current() !== pk, T.current() && T.current().name);

  console.log('--- 2b. 想"走过去打"必须点敌人（另一条入口） ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 9, 5);
  T.forceTurn(pk);
  var imp0b = byId('E1'), hp0b = imp0b.hp;
  T.click(imp0b.x, imp0b.y);          // 点敌人 = 走过去打
  ok('点敌人后先选落脚格，还没造成伤害', imp0b.hp === hp0b, hp0b + ' -> ' + imp0b.hp);
  ok('提示在问站哪一侧打', hintHas('位置可选'), T.hint());

  console.log('--- 3. 点超出移动力的格子 ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 1, 5);
  T.forceTurn(pk);
  T.click(14, 5);
  ok('原地不动', pk.x === 1 && pk.y === 5, pk.x + ',' + pk.y);
  ok('提示「走不到」并给出速度', hintHas('走不到', '4 格'), T.hint());
  ok('没有白耗回合（还能移动）', T.current() === pk && T.hasMovedNow() === false, T.current() && T.current().name);

  console.log('--- 4. 悬停空地：走几步 / 并强调只移动不打人 ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 1, 5);
  T.forceTurn(pk);
  T.hover(4, 5);
  ok('显示步数与速度', hintHas('3 步', '本轮可走 4 步'), T.hint());
  ok('说明走完就结束', hintHas('移动后行动结束'), T.hint());

  // 找一个与魔童相邻、且枪兵走得到的空格
  var imp2 = byId('E1');
  place(pk, 9, 5);
  T.forceTurn(pk);
  var target = null, dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
  for (var i = 0; i < dirs.length; i++) {
    var nx = imp2.x + dirs[i][0], ny = imp2.y + dirs[i][1];
    if (nx < 0 || ny < 0 || nx > 14 || ny > 10) continue;
    if (T.isRock(nx, ny) || T.unitAt(nx, ny)) continue;
    if (T.dist(nx, ny, imp2.x, imp2.y) !== 1) continue;
    if (!T.dist) continue;
    target = [nx, ny]; break;
  }
  ok('找到魔童旁边的空格', !!target, target && target.join(','));
  if (target) {
    T.hover(target[0], target[1]);
    ok('悬停贴敌格：点下去只是移动，明确劝你改点敌人',
      hintHas('只移动，不攻击'), T.hint());
  }

  console.log('--- 5. 动作一旦用掉：再点任何格子都不产生第二个动作 ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 1, 5);
  T.forceTurn(pk);
  T.click(5, 5);
  var hx = pk.x, hy = pk.y;
  ok('移动后 hasMoved 为真', T.hasMovedNow() === true);
  T.click(6, 5);
  ok('已移动：再点空地不会再走', pk.x === hx && pk.y === hy, pk.x + ',' + pk.y);
  ok('已移动：提示「本回合已行动完毕」', hintHas('已行动完毕'), T.hint());

  console.log('--- 6. 走满移动力后，远处敌人不能算「现在能打到」 ---');
  T.init(); T.setStep(0);
  var kn = byId('A4');
  place(kn, 2, 3);
  T.forceTurn(kn);
  var spot = null;
  T.moveMap.forEach(function(c, k){
    if (c !== kn.speed || spot) return;
    var p = k.split(','), px = +p[0], py = +p[1];
    var near = T.units().some(function(u){
      if (u.dead || u.side === kn.side) return false;
      return T.unitDist({ x: px, y: py, side: kn.side, size: 1 }, u) <= 1;
    });
    if (!near) spot = [px, py];
  });
  ok('找到一个离敌人够远的满步落点', !!spot, spot && spot.join(','));
  T.click(spot[0], spot[1]);
  ok('确实走到了那个落点', kn.x === spot[0] && kn.y === spot[1], kn.x + ',' + kn.y);
  ok('不再谎称「现在能打到」', T.hint().indexOf('现在能打到') < 0, T.hint());
  ok('统一收口为「行动结束」', T.hint().indexOf('行动结束') >= 0, T.hint());
  ok('atkSet 已清空（动作已用掉，不该还留着能打的目标）', T.atkSet.size === 0, T.atkSet.size);
  var before6 = T.current();
  await sleep(900);
  ok('走完没目标 → 自动结束，不用点按钮', T.current() !== before6,
    before6 && T.current() && (before6.name + ' -> ' + T.current().name));

  console.log('--- 7. 移动后立刻收手：防御/等待作废，也不许补刀 ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 9, 5);
  T.forceTurn(pk);
  ok('移动前「防御」可用', T.defendDisabled() === false);
  T.click(11, 5);
  ok('移动后「防御」自动禁用', T.defendDisabled() === true);
  ok('移动后「等待」自动禁用', T.waitDisabled() === true);
  ok('移动后提示「行动结束」', hintHas('行动结束'), T.hint());
  var imp7 = byId('E1'), hp7 = imp7.hp;
  T.click(imp7.x, imp7.y);
  ok('贴身后点敌人也不会补刀（移动已把动作花掉）', imp7.hp === hp7, hp7 + ' -> ' + imp7.hp);
  var before7 = T.current();
  await sleep(900);
  ok('行动自动过去，无需按钮', T.current() !== before7,
    before7 && T.current() && (before7.name + ' -> ' + T.current().name));

  console.log('--- 8. 移动后点自己：说明这一手已经完了 ---');
  T.init(); T.setStep(0);
  pk = byId('A1');
  place(pk, 9, 5);
  T.forceTurn(pk);
  T.click(11, 5);
  var mapSize = T.moveMap.size;
  T.click(pk.x, pk.y);
  ok('点自己不会重算移动范围（不会冒出假蓝格）', T.moveMap.size === mapSize, T.moveMap.size + ' vs ' + mapSize);
  ok('点自己说明已行动完毕', hintHas('已行动完毕'), T.hint());

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
})();
