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
El.prototype.setAttribute = function(k, v){ this.attrs[k] = String(v); if (k === 'class') { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); } };
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
  '    hexEls: function(){ return hexEls }, units: function(){ return units },\n' +
  '    get order(){ return order }, get selected(){ return selected },\n' +
  '    dist: dist, neighbors: neighbors, center: center, key: key,\n' +
  '    current: current, calcDamage: calcDamage, effDef: effDef, dmgMult: dmgMult, rollBase: rollBase, rollLuck: rollLuck, rollDamage: rollDamage,\n' +
  '    computeOptions: computeOptions, onHexClick: onHexClick,\n' +
  '    get moveMap(){ return moveMap }, get atkSet(){ return atkSet },\n' +
  '    doAttack: doAttack, applyDamage: applyDamage, init: init,\n' +
  '    hoverPreview: hoverPreview, approachOptions: approachOptions,\n' +
  '    damagePreview: damagePreview,\n' +
  '    setPointer: function(p){ lastPT = p },\n' +
  '    resetMoved: function(){ hasMoved = false },\n' +
  '    setStepDelay: function(n){ stepDelay = n },\n' +
  '    breathInfo: breathInfo, breathHex: breathHex, walkTo: walkTo,\n' +
  '    endActor: endActor, endActorSoon: endActorSoon,\n' +
  '    get busy(){ return busy },\n' +
  '    get pending(){ return pendingAttack },\n' +
  '    get approachMode(){ return approachMode },\n' +
  '    previewCount: function(){ return gPrev.children.length },\n' +
  '    previewNodes: function(){ return gPrev.children },\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;
T.setStepDelay(0);            // 本套用例只验规则，走位动画关掉（同步走完）

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

var ROCKS = [[7,3],[8,7],[6,8],[9,2]];
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function click(x, y){ T.onHexClick({ currentTarget: { dataset: { x: x, y: y } } }); }

console.log('--- 1. 六边形几何 ---');
ok('地块总数 165', Object.keys(T.hexEls()).length === 165, Object.keys(T.hexEls()).length);
ok('相邻距离=1', T.dist(0,0,1,0) === 1);
ok('同行最远 14', T.dist(0,0,14,0) === 14);
ok('自身距离 0', T.dist(3,4,3,4) === 0);
ok('距离对称', T.dist(2,3,9,7) === T.dist(9,7,2,3));
ok('角落 2 邻居', T.neighbors(0,0).length === 2, T.neighbors(0,0).length);
ok('中部 6 邻居', T.neighbors(7,5).length === 6, T.neighbors(7,5).length);
var c0 = T.center(0,0), c1 = T.center(1,1);
ok('奇偶行错位半格', Math.abs((c1.cx - c0.cx) - Math.sqrt(3)*24*1.5) < 0.001,
   (c1.cx - c0.cx).toFixed(2));

console.log('--- 2. 初始状态 ---');
ok('9 支部队', T.units().length === 9, T.units().length);
ok('无重叠', (function(){
  var s = new Set();
  return T.units().every(function(u){
    var k = T.key(u.x, u.y); if (s.has(k)) return false; s.add(k); return true;
  });
})());
ok('无落在石头上', T.units().every(function(u){
  return !ROCKS.some(function(r){ return r[0] === u.x && r[1] === u.y; });
}));

console.log('--- 3. 行动顺序 ---');
console.log('  ' + T.order.map(function(id){
  var u = byId(id); return u.name + ':' + u.speed;
}).join(' > '));
ok('最快者先动(绿龙 9)', T.order[0] === 'A5', T.order[0]);
ok('队列 = 存活数', T.order.length === T.units().length, T.order.length);

console.log('--- 4. 伤害公式 ---');
var kn = byId('A4'), imp = byId('E1');
var r = T.calcDamage(kn, imp, 0);
console.log('  骑士10 × [7,12] vs 魔童(防3): ' + r.min + '–' + r.max);
ok('区间 min<max', r.min < r.max);
ok('攻高防加成', r.max > 95, r.max);
// 攻低防减成：魔童(攻2) 打骑士(防9) 要比打同防(2) 的伤害低
ok('攻低防减成', T.calcDamage(imp, kn, 0).max < T.calcDamage(imp, { def: imp.att }, 0).max,
   T.calcDamage(imp, kn, 0).max + ' vs ' + T.calcDamage(imp, { def: imp.att }, 0).max);
var impDef = Object.assign({}, imp); impDef.defending = true;
ok('防御 +20% 减伤', T.calcDamage(kn, impDef, 0).max < r.max);
ok('冲锋每格 +5%', T.calcDamage(kn, imp, 4).max > r.max);
// 公式硬数值（对齐原版：I1=0.05×差 封顶3.0；R1=0.025×差 封底0.7）
ok('攻防差 7 → 乘数 1.35', Math.abs(T.calcDamage(kn, imp, 0).avg / (10 * 9.5) - 1.35) < 0.01,
   T.calcDamage(kn, imp, 0).avg / 95);
ok('正差封顶 +300%（括号最大 4.0）', T.calcDamage({ count:1, dmg:[10,10], att:100 }, { def:1 }, 0).max === 40,
   T.calcDamage({ count:1, dmg:[10,10], att:100 }, { def:1 }, 0).max);
ok('负差封底 30%', T.calcDamage({ count:1, dmg:[10,10], att:1 }, { def:100 }, 0).max === 3,
   T.calcDamage({ count:1, dmg:[10,10], att:1 }, { def:100 }, 0).max);
ok('冲锋对枪兵无效', T.calcDamage(kn, { def:3, pikeman:true }, 4).max === T.calcDamage(kn, { def:3, pikeman:true }, 0).max);
// 幸运一击：+N → N/24 概率，触发后括号 +1.00（SoD I4 加法）
var luck0 = T.calcDamage(kn, imp, 0, false, false), luck1 = T.calcDamage(kn, imp, 0, false, true);
ok('幸运一击 = 括号 +1.00', Math.abs(luck1.avg / luck0.avg - (2 + 0.35) / 1.35) < 0.01,
   luck1.avg / luck0.avg);
ok('无 luck 字段不触发', T.rollLuck(kn) === false);
var lucky = { luck: 3 }, n24 = 0;
for (var li = 0; li < 2400; li++) if (T.rollLuck(lucky)) n24++;
ok('luck +3 ≈ 1/8 触发', n24 > 200 && n24 < 400, n24 + '/2400');
ok('掷骰落在 [N×dmg0, N×dmg1]', (function(){
  for (var i = 0; i < 200; i++) {
    var s = T.rollBase(kn);
    if (s < 10 * 7 || s > 10 * 12) return false;
  }
  return true;
})());

var dogStart = null;
setTimeout(function(){
  console.log('--- 5. AI 回合（先交掉绿龙这一手）---');
  // 速度 9 的绿龙先动，得先把它的行动结束掉，恶魔犬（8）才会轮到
  if (T.current() && T.current().side === 'us') {
    T.endActor();          // 原版没有「结束」按钮：什么都不做 = 行动直接过去
  }
  var dog = byId('E2');
  dogStart = dog;
  var x0 = dog.x, waited = 0;
  var iv = setInterval(function(){
    waited += 100;
    var cur = T.current();
    if ((cur && cur.side === 'us' && dog.x !== x0) || waited > 12000) {
      clearInterval(iv);
      console.log('  恶魔犬 (' + x0 + ',' + dog.y + ') -> (' + dog.x + ',' + dog.y + ')，我方总 HP ' +
        T.units().filter(function(u){return u.side==='us'}).reduce(function(s,u){return s+u.hp},0));
      ok('AI 未崩溃', true);
      ok('AI 向我方推进(x 减小)', dog.x < 12, dog.x + ',' + dog.y);
      afterAI();
    }
  }, 100);

  function afterAI() {
    console.log('--- 6. 我方回合 ---');
    var act = T.current();
    console.log('  当前行动: ' + (act ? act.name + ' × ' + act.count : 'null'));
    ok('当前是我方单位', act && act.side === 'us', act ? act.side : 'null');
    ok('已自动选中', T.selected === act);

    var pk = act;
    T.computeOptions(pk);
    var cells = 0, maxCost = 0;
    T.moveMap.forEach(function(v){ if (v > 0) cells++; if (v > maxCost) maxCost = v; });
    console.log('  ' + act.name + '(速' + act.speed + ') 可达 ' + cells + ' 格，最远 ' + maxCost + ' 步');
    ok('可达格 > 10', cells > 10, cells);
    ok('不超速度', maxCost <= pk.speed, maxCost);
    ok('石头不可达', !T.moveMap.has(T.key(7,3)));

    var a = T.current();
    var b0 = { x: a.x, y: a.y };
    click(13, 5);
    ok('点射程外敌人安全返回', a.x === b0.x && a.y === b0.y, a.x + ',' + a.y);

    T.computeOptions(a);
    var destK = null;
    T.moveMap.forEach(function(c, k){ if (c === 2 && !destK) destK = k; });
    ok('存在 2 步可达格', !!destK, destK);
    var p2 = destK.split(',');
    click(+p2[0], +p2[1]);
    console.log('  ' + a.name + ' (' + b0.x + ',' + b0.y + ') -> (' + a.x + ',' + a.y + ')');
    ok('点击蓝格真的移动', a.x === +p2[0] && a.y === +p2[1], a.x + ',' + a.y);

    var nbFree = T.neighbors(a.x, a.y).filter(function(p){
      return !ROCKS.some(function(r){ return r[0] === p[0] && r[1] === p[1]; });
    });
    var foe = T.units().filter(function(u){ return u.side !== a.side && !u.dead; })[0];
    var spot = nbFree.filter(function(p){
      return !T.units().some(function(u){
        return !u.dead && u !== foe && u.x === p[0] && u.y === p[1];
      });
    })[0];
    foe.x = spot[0]; foe.y = spot[1];
    T.computeOptions(a);

    console.log('--- 7. 悬停伤害预览 ---');
    T.setPointer('mouse');
    T.hoverPreview(foe);
    console.log('  预览层元素 ' + T.previewCount() + ' 个');
    ok('悬停生成预览图形（落脚格/箭头/气泡）', T.previewCount() >= 4, T.previewCount());
    var dp = T.damagePreview(a, foe);
    console.log('  预计 ' + dp.r.min + '–' + dp.r.max + '，反击 ' +
      (dp.back ? dp.back.min + '–' + dp.back.max : '无'));
    ok('预览给出伤害区间', dp.r.min > 0 && dp.r.max > dp.r.min, dp.r.min + '-' + dp.r.max);
    ok('已相邻时落脚=原地', dp.ap.x === a.x && dp.ap.y === a.y, dp.ap.x + ',' + dp.ap.y);
    ok('预览含反击预估', !!dp.back);

    var nodes = T.previewNodes();
    var rects = nodes.filter(function(n){ return n.tagName === 'rect'; });
    var lines = nodes.filter(function(n){ return n.tagName === 'line'; });
    var polys = nodes.filter(function(n){ return n.tagName === 'polygon'; });
    var bubble = rects.filter(function(n){ return n.getAttribute('fill') === '#23261d'; })[0];
    var arrow = lines[0];
    ok('已贴身时不画落脚格', polys.filter(function(n){ return n._cls.has('approach'); }).length === 0, polys.length);
    ok('箭头两端不重合', !!arrow &&
      (arrow.getAttribute('x1') !== arrow.getAttribute('x2') ||
       arrow.getAttribute('y1') !== arrow.getAttribute('y2')),
      arrow ? arrow.getAttribute('x1') + ',' + arrow.getAttribute('x2') : 'none');
    ok('伤害气泡已撤下（改由提示条/日志说数）', !bubble,
      bubble ? bubble.getAttribute('x') + '/' + bubble.getAttribute('y') : 'none');
    ok('气泡绑定箭头标记', !!arrow && arrow.getAttribute('marker-end') === 'url(#atkArrow)');

    console.log('--- 8. 触屏三拍：点敌人 → 再点展开 → 确认出手 ---');
    // 第 6 节已经把 a 的动作花在移动上了。H3 里动过就交棒，
    // 所以这里重置成"另一个还没行动的单位"，再测确认条与反击。
    T.resetMoved();
    T.computeOptions(a);
    T.setPointer('touch');
    var foeHp0 = foe.hp, myHp0 = a.hp;
    click(foe.x, foe.y);
    ok('第一次点：未造成伤害', foe.hp === foeHp0, foe.hp);
    ok('第一次点：展开站位选择', !!T.approachMode && T.approachMode.target === foe,
      T.approachMode ? 'approach' : 'null');
    click(foe.x, foe.y);
    ok('第二次点：进入待确认', !!T.pending, T.pending ? 'pending' : 'null');
    ok('第二次点：确认条显示',
      document.getElementById('confirmBar').classList.contains('show'));
    click(foe.x, foe.y);
    ok('第三次点：真的打出去', foe.hp < foeHp0, foeHp0 + ' -> ' + foe.hp);
    ok('执行后清空待确认', !T.pending);

    setTimeout(function(){
      console.log('  我方 ' + a.name + ' HP: ' + myHp0 + ' -> ' + a.hp);
      ok('近战遭反击', a.hp < myHp0, a.hp);
      console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
      process.exit(fail ? 1 : 0);
    }, 500);
  }
}, 1200);
