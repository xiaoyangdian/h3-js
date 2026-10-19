// 验证：龙息（目标 + 身后一格）与「走过去再攻击」的走位动画
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
  '    get order(){ return order }, get selected(){ return selected },\n' +
  '    current: current, key: key, dist: dist, neighbors: neighbors,\n' +
  '    computeOptions: computeOptions, onHexClick: onHexClick,\n' +
  '    damagePreview: damagePreview, calcDamage: calcDamage, init: init,\n' +
  '    breathInfo: breathInfo, breathHex: breathHex, doAttack: doAttack,\n' +
  '    setStepDelay: function(n){ stepDelay = n },\n' +
  '    get busy(){ return busy }, get atkSet(){ return atkSet },\n' +
  '    get approachMode(){ return approachMode },\n' +
  '    setHover: function(u){ hoverUnit = u; renderPreview(); },\n' +
  '    hover: hoverPreview,\n' +
  '    previewNodes: function(){ return gPrev.children },\n' +
  '    logs: function(){ return document.getElementById("log").children.map(function(p){ return p.innerHTML }) },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function click(x, y){ T.onHexClick({ currentTarget: { dataset: { x: x, y: y } } }); }
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function logs(){ return T.logs().join(' | '); }
function clearLog(){ document.getElementById('log').children.length = 0; }

// 把无关部队挪到角落，避免干扰
function park(id, x, y){ var u = byId(id); if (u) { u.x = x; u.y = y; } }
function place(u, x, y){ u.x = x; u.y = y; }

(async function(){
  console.log('--- 1. 龙息格几何（cube 坐标延伸）---');
  console.log('  (10,5) 打 (11,5) -> 身后 ' + JSON.stringify(T.breathHex(10, 5, 11, 5)));
  ok('向右打，身后是 (12,5)', T.breathHex(10,5,11,5).join(',') === '12,5', T.breathHex(10,5,11,5));
  ok('向左打，身后是 (9,5)', T.breathHex(11,5,10,5).join(',') === '9,5', T.breathHex(11,5,10,5));
  ok('向下打，身后离起点正好 2 格', (function(){ var h = T.breathHex(5,5,5,6);
    return h && T.dist(5,5,h[0],h[1]) === 2 && T.dist(5,6,h[0],h[1]) === 1; })(), T.breathHex(5,5,5,6));
  ok('斜向也成立', T.breathHex(5,5,6,5).join(',') === '7,5', T.breathHex(5,5,6,5));
  ok('出界返回 null', T.breathHex(13,5,14,5) === null, T.breathHex(13,5,14,5));
  ok('六个方向都不返回自身', [[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]].every(function(d){
    var h = T.breathHex(7, 5, 7 + d[0], 5 + d[1]);
    return h && !(h[0] === 7 && h[1] === 5);
  }));

  console.log('--- 2. 预览：把身后那格画出来 ---');
  T.init();
  var dragon = byId('A5'), imp = byId('E1'), horn = byId('E4');
  ok('绿龙带龙息', !!dragon.breath);
  place(dragon, 10, 5); place(imp, 11, 5); place(horn, 12, 5);
  park('E2', 0, 0); park('E3', 0, 10);
  T.computeOptions(dragon);
  var pv = T.damagePreview(dragon, imp, { x: 10, y: 5 });
  console.log('  身后格 ' + JSON.stringify(pv.breath && pv.breath.hex) +
    '，单位 ' + (pv.breath && pv.breath.unit ? pv.breath.unit.name : '空') +
    '，伤害 ' + (pv.breath && pv.breath.r ? pv.breath.r.min + '–' + pv.breath.r.max : '-'));
  ok('身后格 = (12,5)', pv.breath && pv.breath.hex.join(',') === '12,5');
  ok('身后单位是长角魔', pv.breath.unit === horn);
  ok('龙息有独立伤害区间', pv.breath.r.min > 0 && pv.breath.r.max > pv.breath.r.min);
  ok('主目标仍有反击', !!pv.back);

  T.hover(imp);
  var nodes = T.previewNodes();
  var breathPolys = nodes.filter(function(n){ return n.tagName === 'polygon' && n._cls.has('breath'); });
  var rects = nodes.filter(function(n){ return n.tagName === 'rect'; });
  var texts = nodes.filter(function(n){ return n.tagName === 'text'; }).map(function(n){ return n.textContent; });
  ok('预览画出龙息格', breathPolys.length === 1, breathPolys.length);
  // 伤害气泡已撤：数字交给底部提示条，画面上只留站位与龙息方向
  ok('画面上不再有伤害气泡', !rects.some(function(n){
    return n.getAttribute('fill') === '#23261d';
  }), rects.map(function(n){ return n.getAttribute('fill'); }).join('/'));
  ok('提示条也带龙息', /龙息→长角魔/.test(T.hint()), T.hint());

  console.log('--- 3. 结算：两格一起掉血，第二格不反击 ---');
  var hpImp = imp.hp, hpHorn = horn.hp, hpDragon = dragon.hp;
  clearLog();
  click(11, 5);                          // 龙息单位贴身：第一下只是展开选位
  ok('贴身点龙息单位：先展开候选，不立刻出手', imp.hp === hpImp, imp.hp);
  click(11, 5);                          // 第二下 = 用当前选中的位置（原地）出手
  console.log('  魔童 ' + hpImp + ' -> ' + imp.hp + '，长角魔 ' + hpHorn + ' -> ' + horn.hp);
  ok('主目标掉血', imp.hp < hpImp, imp.hp);
  ok('身后单位也掉血', horn.hp < hpHorn, horn.hp);
  ok('日志出现龙息', /龙息/.test(logs()), logs());
  ok('身后单位没有反击', horn.retaliated === false);
  await sleep(380);                       // 反击是 260ms 后结算
  ok('绿龙挨了一次反击', dragon.hp < hpDragon, hpDragon + ' -> ' + dragon.hp);
  var backCount = T.logs().filter(function(s){ return /反击/.test(s); }).length;
  ok('日志只有一次反击', backCount === 1, backCount);

  console.log('--- 4. 友军站在身后：龙息照打 ---');
  T.init();
  dragon = byId('A5'); imp = byId('E1');
  var knight = byId('A4');
  place(dragon, 10, 5); place(imp, 11, 5); place(knight, 13, 5);   // 骑士双格：头 13 尾 12
  park('E2', 0, 0); park('E3', 0, 10); park('E4', 14, 0);
  T.computeOptions(dragon);
  var pv2 = T.damagePreview(dragon, imp, { x: 10, y: 5 });
  ok('预览认出身后是友军', pv2.breath && pv2.breath.unit === knight);
  clearLog();
  var kHp = knight.hp;
  click(11, 5);                          // 展开选位
  click(11, 5);                          // 原地出手
  ok('友军也掉血', knight.hp < kHp, kHp + ' -> ' + knight.hp);
  ok('日志标注友军', /友军/.test(logs()), logs());

  console.log('--- 5. 走过去再攻击（真实动画）---');
  T.init();
  T.setStepDelay(35);                     // 加快但仍是一格一格
  dragon = byId('A5'); imp = byId('E1');
  place(dragon, 10, 5); place(imp, 13, 5);
  park('E4', 14, 9); park('E2', 0, 0); park('E3', 0, 10);
  T.computeOptions(dragon);
  ok('目标可达', T.atkSet.has(T.key(13, 5)), Array.from(T.atkSet).join(' '));

  click(13, 5);                            // 第一下：只锁定，不动
  ok('第一下不移动', dragon.x === 10 && dragon.y === 5, dragon.x + ',' + dragon.y);
  ok('第一下进入选位', !!T.approachMode);

  var hpBefore = imp.hp;
  var seen = [];
  var sampler = setInterval(function(){ seen.push(dragon.x + ',' + dragon.y); }, 15);

  click(12, 5);                            // 点位置 = 走过去再打
  ok('点位置后立刻进入移动状态', T.busy === true, T.busy);
  ok('还没到终点', !(dragon.x === 12 && dragon.y === 5), dragon.x + ',' + dragon.y);
  ok('移动途中尚未造成伤害', imp.hp === hpBefore, hpBefore + ' -> ' + imp.hp);

  var xDuring = dragon.x;
  click(0, 10);                            // 移动中乱点应被忽略
  ok('移动中屏蔽输入', dragon.x === xDuring, xDuring + ' -> ' + dragon.x);

  await sleep(420);
  clearInterval(sampler);
  console.log('  经过的位置: ' + seen.filter(function(v, i){ return seen.indexOf(v) === i; }).join(' > '));
  ok('走到了目的地', dragon.x === 12 && dragon.y === 5, dragon.x + ',' + dragon.y);
  ok('走完才结算伤害', imp.hp < hpBefore, hpBefore + ' -> ' + imp.hp);
  ok('移动结束解除锁定', T.busy === false, T.busy);
  ok('确实经过中间格', seen.indexOf('11,5') >= 0, seen.join(' '));
  ok('路径是两格（10,5 → 11,5 → 12,5）',
     seen.filter(function(v, i){ return seen.indexOf(v) === i; }).join('>') === '11,5>12,5',
     seen.join(' '));

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
