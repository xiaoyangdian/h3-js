// 双格单位的朝向：
//  - 待机站位：头永远朝敌人（不许把头扭到自己这侧），自动摆，不用玩家点
//  - 出手瞬间才允许临时扭头，一手打完立刻摆回待机朝向
//  - 占的两格自始至终不变
// 注意：地图上的岩石是 (7,3)(8,7)(6,8)(9,2)，摆位一律避开
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
  '    units: function(){ return units }, byId: function(id){ return units.filter(function(u){return u.id===id})[0] },\n' +
  '    current: current, init: init, render: render, key: key, dist: dist,\n' +
  '    computeOptions: computeOptions, onHexClick: onHexClick, onHexHover: onHexHover,\n' +
  '    damagePreview: damagePreview, approachOptions: approachOptions, performAttack: performAttack,\n' +
  '    dirOf: dirOf, coversHex: coversHex, canStand: canStand, cellsOf: cellsOf, fitDir: fitDir,\n' +
  '    restFace: restFace, faceAll: faceAll, nearestFoe: nearestFoe,\n' +
  '    moveMap: function(){ return moveMap }, atkSet: function(){ return atkSet },\n' +
  '    hasMoved: function(){ return hasMoved },\n' +
  '    setStepDelay: function(n){ stepDelay = n },\n' +
  '    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;
T.setStepDelay(0);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name + (extra !== undefined ? '  (' + extra + ')' : '')); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function click(x, y){ T.onHexClick({ currentTarget: { dataset: { x: x, y: y } } }); }
function place(u, x, y){ u.x = x; u.y = y; }
function park(id, x, y){ var u = T.byId(id); if (u) { u.x = x; u.y = y; } }
function cellsSorted(u){ return T.cellsOf(u).map(function(c){ return c.join(','); }).sort().join(' '); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function clearBoard(){
  park('A1', 0, 9); park('A2', 0, 0); park('A3', 14, 0); park('A4', 1, 10);
  park('E2', 14, 1); park('E3', 14, 10); park('E4', 13, 9);
}

(async function(){
  console.log('--- 1. 骑兵绕到敌人右侧：能站、能打，不会站到敌人身上 ---');
  T.init();
  var cav = T.byId('A4'), imp = T.byId('E1');
  place(cav, 7, 5); place(imp, 11, 5);
  park('A1', 0, 9); park('A2', 0, 0); park('A3', 14, 0); park('A5', 1, 10);
  park('E2', 14, 1); park('E3', 14, 10); park('E4', 13, 9);
  T.forceTurn(cav);

  ok('敌人右边 (12,5) 在移动范围里', T.moveMap().has('12,5'), T.moveMap().get('12,5'));
  ok('(12,5) 站上去时尾巴在右 (13,5)',
    T.canStand(cav, 12, 5, cav) && T.fitDir(cav, 12, 5, cav) === 1, T.fitDir(cav, 12, 5, cav));

  var opts = T.approachOptions(cav, imp);
  var spots = opts.map(function(o){ return o.x + ',' + o.y; });
  ok('候选落脚点包含右侧 (12,5)', spots.indexOf('12,5') >= 0, spots.join(' '));
  ok('左侧 (10,5) 也仍然可以', spots.indexOf('10,5') >= 0, spots.join(' '));

  var hp0 = imp.hp;
  click(11, 5);
  click(12, 5);
  ok('骑兵站到了 (12,5)，没被敌人的格子吞掉', cav.x === 12 && cav.y === 5, cav.x + ',' + cav.y);
  ok('尾巴没压到敌人身上', cellsSorted(cav) === '12,5 13,5', cellsSorted(cav));
  ok('从右侧打中了魔童', imp.hp < hp0, hp0 + ' -> ' + imp.hp);

  console.log('--- 2. 待机站位：头自动朝敌人（玩家什么都不用点） ---');
  T.init();
  var dr = T.byId('A5'), foe = T.byId('E1');
  clearBoard();
  place(dr, 8, 5); dr.dir = -1;            // 头 8、尾 7，敌人在左边
  place(foe, 6, 5);
  T.forceTurn(dr);
  ok('轮到它时头自动摆向敌人：头在 (7,5)', dr.x === 7 && dr.y === 5, dr.x + ',' + dr.y);
  ok('尾巴换到 (8,5)', T.dirOf(dr) === 1, T.dirOf(dr));
  ok('占的还是那两格', cellsSorted(dr) === '7,5 8,5', cellsSorted(dr));
  ok('不需要任何手动动作（行动力还在）', T.hasMoved() === false);

  console.log('--- 3. 敌人换边，头跟着换回去 ---');
  place(foe, 10, 5);                        // 敌人跑到右边
  T.forceTurn(dr);
  ok('头自动回到靠近敌人的 (8,5)', dr.x === 8 && dr.y === 5, dr.x + ',' + dr.y);
  ok('尾巴换到 (7,5)', T.dirOf(dr) === -1, T.dirOf(dr));
  ok('占位依旧没变', cellsSorted(dr) === '7,5 8,5', cellsSorted(dr));

  console.log('--- 4. 出手时临时扭头，一手打完摆回待机朝向 ---');
  T.init();
  dr = T.byId('A5');
  var right = T.byId('E1'), left = T.byId('E3');
  clearBoard();
  place(dr, 8, 5); dr.dir = -1;            // 头 8、尾 7
  place(right, 9, 5);                      // 右边贴身：待机头朝它
  place(left, 6, 5);                       // 左边贴身：要打它得临时扭头
  T.forceTurn(dr);
  ok('待机时头在 (8,5)（最近的敌人在右边）', dr.x === 8, dr.x + ',' + dr.y);

  var hpL = left.hp;
  click(6, 5);                             // 龙息单位贴身：第一下展开选位
  click(6, 5);                             // 第二下 = 原地（临时扭头）出手
  ok('出手时临时扭头：头到了 (7,5)', dr.x === 7 && dr.y === 5, dr.x + ',' + dr.y);
  ok('临时扭头也照样打中', left.hp < hpL, hpL + ' -> ' + left.hp);

  await sleep(900);
  ok('这一手结束后摆回待机朝向：头回到 (8,5)', dr.x === 8 && dr.y === 5, dr.x + ',' + dr.y);
  ok('尾巴回到 (7,5)', T.dirOf(dr) === -1, T.dirOf(dr));
  ok('全程占的还是 (7,5)+(8,5)', cellsSorted(dr) === '7,5 8,5', cellsSorted(dr));

  console.log('--- 5. 摆头只换"哪端算头"，占的两格永远不变 ---');
  T.init();
  dr = T.byId('A5');
  clearBoard();
  place(dr, 6, 5); dr.dir = -1;             // 占 (6,5)+(5,5)
  var stays = true, dirs = [];
  [[12, 5], [1, 5], [6, 9], [6, 1]].forEach(function(p){
    var f = T.byId('E1');
    f.x = p[0]; f.y = p[1];
    var before = cellsSorted(dr);
    T.forceTurn(dr);
    if (cellsSorted(dr) !== before) stays = false;
    dirs.push(T.dirOf(dr));
  });
  ok('敌人换到四个方向，占的两格始终是 (5,5)+(6,5)', stays, cellsSorted(dr));
  ok('朝向确实跟着敌人变过（不是死板不动）',
    dirs.indexOf(1) >= 0 && dirs.indexOf(-1) >= 0, dirs.join(','));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
})();
