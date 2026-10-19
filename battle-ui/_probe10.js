// _probe10：占位不变量（不许叠格、不许站岩石）
// 起因：用户截图里「魔童」和双格「骑士」站到了同一格。
// 根因：fitDir 对单格单位直接 return 1，canStand 恒真 —— 单格兵能穿过/踩上任何东西。
const fs = require('fs'), path = require('path');

function El(t){
  this.tagName=t; this.children=[]; this.attrs={}; this.style={}; this.dataset={};
  this.listeners={}; this.textContent=''; this._cls=new Set(); this._html='';
  this.parentNode=null; this.disabled=false;
  var s=this;
  this.classList={add:function(){for(var i=0;i<arguments.length;i++)s._cls.add(arguments[i]);},
    remove:function(){for(var i=0;i<arguments.length;i++)s._cls.delete(arguments[i]);},
    toggle:function(c,f){f?s._cls.add(c):s._cls.delete(c);},
    contains:function(c){return s._cls.has(c);}};
}
El.prototype.setAttribute=function(k,v){this.attrs[k]=String(v);if(k==='class')this._cls=new Set(String(v).split(/\s+/).filter(Boolean));};
El.prototype.getAttribute=function(k){return this.attrs[k];};
El.prototype.appendChild=function(c){this.children.push(c);c.parentNode=this;return c;};
El.prototype.insertBefore=function(c,r){var i=this.children.indexOf(r);if(i<0)this.children.push(c);else this.children.splice(i,0,c);c.parentNode=this;return c;};
El.prototype.removeChild=function(c){var i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);c.parentNode=null;return c;};
El.prototype.addEventListener=function(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f);};
El.prototype.remove=function(){if(this.parentNode)this.parentNode.removeChild(this);};
El.prototype.querySelector=function(){return null;};
Object.defineProperty(El.prototype,'innerHTML',{get:function(){return this._html;},set:function(v){this._html=v;this.children=[];}});
Object.defineProperty(El.prototype,'offsetWidth',{get:function(){return 0;}});
var store={};
global.document={getElementById:function(id){return store[id]||(store[id]=new El('div'));},
  createElement:function(t){return new El(t);},createElementNS:function(n,t){return new El(t);},
  querySelector:function(){return null;}};

// ── 假时钟：把 480/620/700ms 的推进全部即时排空，整场战斗可以秒跑 ──
var clock = 0, timers = [], tid = 1;
global.setTimeout = function(fn, ms){ timers.push({ id:tid++, at:clock + (ms||0), fn:fn }); return tid; };
global.clearTimeout = function(id){ timers = timers.filter(function(t){ return t.id !== id; }); };
function flush(){
  var n = 0;
  while (timers.length && n < 5000) {
    timers.sort(function(a,b){ return a.at - b.at || a.id - b.id; });
    var t = timers.shift();
    clock = Math.max(clock, t.at);
    try { t.fn(); } catch(e) { console.log('  [timer error] ' + e.message); }
    n++;
  }
}

var html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace('  init();\n})();', [
'  globalThis.__T = {',
'    units: function(){ return units }, byId: function(id){ return units.filter(function(u){return u.id===id})[0] },',
'    key: key, cellsOf: cellsOf, isRock: isRock, canStand: canStand, fitDir: fitDir,',
'    bfsPath: bfsPath, computeOptions: computeOptions, moveMap: function(){return moveMap},',
'    onHexClick: onHexClick, onHexHover: onHexHover, damagePreview: damagePreview, approachOptions: approachOptions,',
'    current: current, forceTurn: function(u){ order.length=0; order.push(u.id); nextActor(); },',
'    endActor: endActor, init: init, hint: function(){ return document.getElementById("hint").textContent },',
'    over: function(){ return over }, order: function(){ return order }, atkSet: function(){ return atkSet },',
'    setStepDelay: function(n){ stepDelay = n }, W: function(){return W}, H: function(){return H},',
'    alive: alive, unitAt: unitAt',
'  };\n  init();\n})();'
].join('\n'));

var T;
try { new Function(src)(); T = globalThis.__T; }
catch(e){ console.log('BOOT FAIL: ' + e.message); process.exit(1); }
if (!T) { console.log('注入失败：找不到 init(); 结尾'); process.exit(1); }
T.setStepDelay(0); flush();

var pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function cellsSorted(u){
  return T.cellsOf(u).map(function(c){ return T.key(c[0], c[1]); }).sort().join('|');
}
// 全场扫一遍：有没有两单位共用一格 / 有没有人站在岩石上
function scan(){
  var map = {}, clashes = [], rocks = [], oob = [];
  T.units().forEach(function(u){
    if (u.dead) return;
    T.cellsOf(u).forEach(function(c){
      var k = T.key(c[0], c[1]);
      if (c[0] < 0 || c[0] >= T.W() || c[1] < 0 || c[1] >= T.H()) { oob.push(u.name + '@' + k); return; }
      if (T.isRock(c[0], c[1])) rocks.push(u.name + '@' + k);
      (map[k] = map[k] || []).push(u.name);
    });
  });
  Object.keys(map).forEach(function(k){ if (map[k].length > 1) clashes.push(k + ' ← ' + map[k].join('+')); });
  return { clashes: clashes, rocks: rocks, oob: oob };
}
function clean(){ var s = scan(); return !s.clashes.length && !s.rocks.length && !s.oob.length; }
function why(){ var s = scan(); return JSON.stringify(s); }

function park(id, x, y){ var u = T.byId(id); if (u) { u.x = x; u.y = y; u.dead = false; } }

(async function(){
  console.log('--- 1. 单格单位的 canStand 必须查占位与岩石 ---');
  T.init();
  var cav = T.byId('A4'), imp = T.byId('E1'), pk = T.byId('A1');
  park('A1', 0, 10); park('A2', 0, 0); park('A3', 14, 0); park('A5', 14, 10);
  park('E2', 2, 10); park('E3', 14, 1); park('E4', 13, 9);
  cav.x = 8; cav.y = 6; cav.dir = 1;              // 骑士占 (8,6)+(9,6)
  imp.x = 11; imp.y = 6;
  ok('骑士确实占了两格', cellsSorted(cav) === '8,6|9,6', cellsSorted(cav));
  ok('单格不能站到双格身上', T.canStand(imp, 9, 6, imp) === false);
  ok('单格不能站到单格身上（枪兵在 0,10）',
     T.canStand(imp, 0, 10, imp) === false);
  ok('单格不能站到岩石上', T.canStand(imp, 7, 3, imp) === false, T.isRock(7, 3));

  console.log('--- 2. 寻路不能穿过别人 ---');
  ok('走不到骑士占的格', T.bfsPath(imp, 9, 6) === null, JSON.stringify(T.bfsPath(imp, 9, 6)));
  ok('也穿不过去绕到骑士另一侧', T.bfsPath(imp, 8, 6) === null, JSON.stringify(T.bfsPath(imp, 8, 6)));
  T.forceTurn(imp); T.computeOptions(imp); flush();
  var mm = T.moveMap();
  ok('可达范围里没有被占的格', !mm.has('9,6') && !mm.has('8,6') && !mm.has('0,10'),
     Array.from(mm.keys()).filter(function(k){ return k === '9,6' || k === '8,6' || k === '0,10'; }).join(' '));
  ok('可达范围里没有岩石', !mm.has('7,3') && !mm.has('8,7') && !mm.has('6,8') && !mm.has('9,2'));

  console.log('--- 3. 每个单位的可达格都必须真站得下 ---');
  T.init(); flush();
  var bad = [];
  T.units().forEach(function(u){
    if (u.dead) return;
    T.forceTurn(u); T.computeOptions(u);
    Array.from(T.moveMap().keys()).forEach(function(k){
      var p = k.split(','), x = +p[0], y = +p[1];
      if (x === u.x && y === u.y) return;                 // 起点不校验
      if (T.fitDir(u, x, y, u) === 0) bad.push(u.name + '@' + k);
    });
  });
  ok('8 个单位的全部可达格都合法', bad.length === 0, bad.join(' '));

  console.log('--- 4. 复现用户局面：单格魔童贴着双格骑士 ---');
  T.init(); flush();
  cav = T.byId('A4'); imp = T.byId('E1');
  park('A1', 0, 10); park('A2', 0, 0); park('A3', 14, 0); park('A5', 14, 10);
  park('E2', 2, 10); park('E3', 14, 1); park('E4', 13, 9);
  cav.x = 8; cav.y = 6; cav.dir = 1; cav.count = 7; cav.hp = 7 * cav.perHp;
  imp.x = 10; imp.y = 6;
  ok('初始盘面无重叠', clean(), why());
  T.forceTurn(imp);                                   // 让魔童自己决策（AI）
  flush();
  ok('AI 走完仍然无重叠', clean(), why());
  ok('AI 没有占到骑士任何一格',
     !T.cellsOf(cav).some(function(c){ return T.unitAt(c[0], c[1], cav) !== null; }), why());

  console.log('--- 5. 整场战斗：每一步都不许叠格 ---');
  T.init(); flush();
  // 线性同余随机数，保证可复现
  var seed = 20261019;
  function rnd(){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

  var steps = 0, worst = null, trace = [];
  while (!T.over() && steps < 160) {
    var act = T.current();
    if (!act) break;
    if (act.side !== 'us') { flush(); steps++; continue; }   // AI 自己走
    T.computeOptions(act);
    var foes = T.units().filter(function(u){ return !u.dead && u.side !== act.side; });
    var target = null;
    for (var i = 0; i < foes.length; i++) {
      var pv = T.damagePreview(act, foes[i]);
      if (pv && pv.ap) { target = foes[i]; break; }
    }
    if (target) {
      trace.push('打 ' + target.name);
      T.onHexClick({ currentTarget: { dataset: { x: target.x, y: target.y } } });
      flush();
      if (T.current() === act) { T.onHexClick({ currentTarget: { dataset: { x: target.x, y: target.y } } }); flush(); }
      if (T.current() === act) { T.endActor(); flush(); }
    } else {
      var cells = Array.from(T.moveMap().keys()).filter(function(k){ return T.moveMap().get(k) > 0; });
      if (cells.length) {
        var pick = cells[Math.floor(rnd() * cells.length)].split(',');
        trace.push('走 ' + pick.join(','));
        T.onHexClick({ currentTarget: { dataset: { x: +pick[0], y: +pick[1] } } });
      } else { T.endActor(); }
      flush();
    }
    if (!clean() && !worst) { worst = { step: steps, why: why(), last: trace[trace.length-1] }; }
    steps++;
  }
  ok('跑完 ' + steps + ' 手，全程没有重叠/站岩石', worst === null,
     worst ? ('第 ' + worst.step + ' 手（' + worst.last + '）：' + worst.why) : '');
  ok('战斗确实推进过（不是一开始就结束）', steps >= 6, steps + ' 手');
  ok('终局盘面依然干净', clean(), why());

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
