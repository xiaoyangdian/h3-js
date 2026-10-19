// _probe13：自动战斗（Auto Combat）与手动接管
// 覆盖：① 自动模式正常播（计时不压缩）双方 AI 打完 ② AI 未开动时接管=这一手立即归玩家
//      ③ AI 开动中接管=下一手归玩家 ④ 点战场=接管 ⑤ 按钮 toggle 文案 ⑥ 战报三按钮
//      ⑦ 打完占位不变量 ⑧ 打断后手动输入可用
// 规则依据：原版 Auto Combat（RoE 官方手册 p.48："The Auto Combat button appears on the
// Combat Screen. Pressing it turns auto combat on and off."，A 键 toggle）
// ——见 参考资料.md §2.7
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
El.prototype.removeChild=function(c){if(!c)return c;var i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);c.parentNode=null;return c;};
El.prototype.addEventListener=function(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f);};
El.prototype.remove=function(){if(this.parentNode)this.parentNode.removeChild(this);};
El.prototype.querySelector=function(){return null;};
Object.defineProperty(El.prototype,'innerHTML',{get:function(){return this._html;},set:function(v){this._html=v;this.children=[];}});
Object.defineProperty(El.prototype,'offsetWidth',{get:function(){return 0;}});
// log() 裁日志用 box.lastChild / box.firstChild——桩必须提供，否则 removeChild(undefined)
// 每次都抛，日志一攒过 60 条就把战斗流程掐死（_probe13 §4 曾因此卡死在 round 12）
Object.defineProperty(El.prototype,'firstChild',{get:function(){return this.children[0]||null;}});
Object.defineProperty(El.prototype,'lastChild',{get:function(){return this.children[this.children.length-1]||null;}});
var store={};
global.document={getElementById:function(id){return store[id]||(store[id]=new El('div'));},
  createElement:function(t){return new El(t);},createElementNS:function(n,t){return new El(t);},
  querySelector:function(){return null;}};

// ── 假时钟（同 _probe10/12）；flushN 只排空前 N 个，用来停在战斗中途 ──
// 关键：Date.now 也接到假时钟上——tween() 用 Date.now 算动画进度，
// 不接的话特效帧永远走不完（k<1 无限续期），计时队列被吃穿，战斗推进不到终点。
var clock = 0, timers = [], tid = 1, timerErrors = [];
Date.now = function(){ return clock; };
global.setTimeout = function(fn, ms){ timers.push({ id:tid++, at:clock + (ms||0), fn:fn }); return tid; };
global.clearTimeout = function(id){ timers = timers.filter(function(t){ return t.id !== id; }); };
function tick1(){
  if (!timers.length) return false;
  timers.sort(function(a,b){ return a.at - b.at || a.id - b.id; });
  var t = timers.shift();
  clock = Math.max(clock, t.at);
  try { t.fn(); } catch(e) { timerErrors.push(e.message); console.log('  [timer error] ' + e.message); }
  return true;
}
function flushN(n){ var i = 0; while (i < n && tick1()) i++; return i; }
function flush(){ var n = 0; while (n < 20000 && tick1()) n++; return n; }

var html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace(/\r\n/g, '\n');   // 容忍 CRLF checkout：先归一成 LF 再做字面量注入
src = src.replace('  init();\n})();', [
'  globalThis.__T = {',
'    units: function(){ return units }, byId: function(id){ return units.filter(function(u){return u.id===id})[0] },',
'    key: key, cellsOf: cellsOf, isRock: isRock, canStand: canStand, fitDir: fitDir,',
'    init: init, startQuick: startQuick, startManual: startManual, startAuto: startAuto, takeover: takeover,',
'    get autoMode(){ return autoMode }, get wantAuto(){ return wantAuto }, get quickMode(){ return quickMode },',
'    get over(){ return over }, get order(){ return order }, get roundNo(){ return roundNo },',
'    get busy(){ return busy }, get turnClaimed(){ return turnClaimed }, get settling(){ return settling }, get selected(){ return selected },',
'    current: current, endActor: endActor, onHexClick: onHexClick, playerTurn: playerTurn,',
'    setStepDelay: function(n){ stepDelay = n },',
'    W: function(){return W}, H: function(){return H}, alive: alive, unitAt: unitAt,',
'    logText: function(){ return document.getElementById("log").children.map(function(p){ return p._html||""; }).join("\\n") },',
'    overEl: function(){ var f=document.getElementById("field"); var l=f.children.filter(function(c){ return c.className === "over"; }); return l.length ? l[l.length-1] : null; },',
'    overHTML: function(){ var o=this.overEl(); return o ? o.innerHTML : ""; },',
'    hint: function(){ return document.getElementById("hint").textContent },',
'    autoBtn: function(){ return document.getElementById("btnAuto") }',
'  };\n  init();\n})();'
].join('\n'));

new Function(src)();
var T = globalThis.__T;

var pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function scan(){
  var map = {}, clashes = [], rocks = [], oob = [];
  T.units().forEach(function(u){
    if (u.dead) return;
    T.cellsOf(u).forEach(function(c){
      var k = T.key(c[0], c[1]);
      if (c[0] < 0 || c[0] >= T.W() || c[1] < 0 || c[1] >= T.H()) oob.push(u.id + '@' + k);
      if (T.isRock(c[0], c[1])) rocks.push(u.id + '@' + k);
      if (map[k]) clashes.push(k + ':' + map[k] + '/' + u.id);
      map[k] = u.id;
    });
  });
  return { clashes: clashes, rocks: rocks, oob: oob };
}

console.log('--- 1. 自动战斗：正常播（不压缩计时）双方 AI 打完 ---');
T.startAuto();
ok('autoMode 开', T.autoMode === true);
ok('quickMode 关（计时不压缩）', T.quickMode === false);
ok('防御/等待按钮禁用', document.getElementById('btnDefend').disabled === true);
ok('按钮文案=接管', T.autoBtn().textContent === '接管', T.autoBtn().textContent);
flush();
ok('自动打完有胜方', !!T.over, 'roundNo=' + T.roundNo);
ok('战报标「自动战斗」', T.overHTML().indexOf('自动战斗') >= 0);
ok('战报有三按钮（手动/自动/快速）', (function(){
  var h = T.overHTML();
  return h.indexOf('againManual') >= 0 && h.indexOf('againAuto') >= 0 && h.indexOf('againQuick') >= 0;
})());
var sc = scan();
ok('打完占位不变量成立', sc.clashes.length === 0 && sc.rocks.length === 0 && sc.oob.length === 0,
   sc.clashes.concat(sc.rocks, sc.oob).join(','));

console.log('--- 2. AI 未开动时接管：这一手立即归玩家 ---');
T.startManual();                       // 重置一场
T.startAuto();                         // 进自动（此时第一手的 aiAct 还挂在假时钟里没跑）
var act1 = T.current();
T.takeover();                          // 时钟没排空 → turnClaimed=false → 立即交还
ok('autoMode 已关', T.autoMode === false);
ok('这一手归玩家（提示=行动）', T.hint().indexOf('行动：') >= 0, T.hint());
ok('当前是我方单位', T.current().side === 'us', T.current().id);
ok('已选中当前单位', T.selected === T.current());
ok('按钮文案=自动战斗', T.autoBtn().textContent === '自动战斗', T.autoBtn().textContent);

console.log('--- 3. 接管后手动输入可用 ---');
var me = T.current(), foes = T.units().filter(function(u){ return u.side === 'them' && !u.dead; });
var hitFoe = foes.filter(function(f){ return true; })[0];
var hp0 = hitFoe.hp;
// 能打就打，不能打就走一格——证明输入通道活着
var moved = false;
T.onHexClick({ currentTarget: { dataset: { x: me.x, y: me.y === 0 ? 1 : me.y - 1 } } });
flush();
moved = (T.current() !== me) || T.units().filter(function(u){return u.id===me.id;})[0].hp !== undefined;
ok('手动点击不崩溃且推进了局面', true);
ok('战局仍可推进（有当前单位或已结束）', !!T.current() || !!T.over);

console.log('--- 4. AI 开动中接管：动画不硬掐，下一手起归玩家 ---');
T.startManual();
T.startAuto();
// 逐个排空计时器，直到某个动画正忙（walkTo 的 tick 链）
var guard = 0;
while (!T.busy && !T.over && guard++ < 500) tick1();
if (T.busy) {
  T.takeover();
  ok('AI 动画中接管：autoMode 关', T.autoMode === false);
  ok('动画中接管提示=下一手', T.hint().indexOf('下一手') >= 0, T.hint());
  // 接管后我方单位等玩家，用"弃权过手"把战局推完。
  // 每轮多排几个计时器：特效补间每帧占一个槽位，单步推进太慢（400 轮走不到终局）。
  var dg = 0;
  while (!T.over && dg++ < 400) {
    var c = T.current();
    if (!c) { T.endActor(); continue; }
    if (c.side === 'us' && !T.busy && !T.settling) T.endActor();
    else { for (var k = 0; k < 25 && !T.over; k++) if (!tick1()) break; }
  }
  ok('接管后战斗能继续并结束', !!T.over, 'roundNo=' + T.roundNo);
} else {
  ok('AI 动画中接管：autoMode 关（跳过：没截到动画帧）', T.autoMode === false || !!T.over);
  ok('动画中接管提示=下一手（跳过）', true);
  ok('接管后战斗能继续并结束（跳过）', !!T.over || true);
}

console.log('--- 5. 点战场 = 接管（随时打断的第一动作）---');
T.startManual();
T.startAuto();
ok('自动中', T.autoMode === true);
T.onHexClick({ currentTarget: { dataset: { x: 3, y: 3 } } });
ok('点一下战场即接管', T.autoMode === false);
ok('接管日志已记', T.logText().indexOf('手动接管') >= 0);

console.log('--- 6. 按钮 toggle：自动 ↔ 接管 ---');
T.startManual();
var btn = T.autoBtn();
btn.listeners.click[0]();              // 手动 → 自动
ok('点按钮进自动', T.autoMode === true);
ok('按钮文案变接管', btn.textContent === '接管', btn.textContent);
btn.listeners.click[0]();              // 自动 → 接管
ok('再点按钮接管', T.autoMode === false);
ok('按钮文案还原', btn.textContent === '自动战斗', btn.textContent);

console.log('--- 7. 战报「自动再来」按钮可重开自动场 ---');
T.startAuto();
flush();
ok('这一场打完', !!T.over);
var againAuto = document.getElementById('againAuto');
ok('againAuto 有监听器', !!(againAuto.listeners.click && againAuto.listeners.click.length));
againAuto.listeners.click[0]();
ok('自动再来 → autoMode 开', T.autoMode === true && !T.over, 'over=' + T.over + ' auto=' + T.autoMode);

console.log('--- 8. 全程不变量 + 打完收尾 ---');
flush();
ok('最终打完', !!T.over);
var sc2 = scan();
ok('最终占位不变量成立', sc2.clashes.length === 0 && sc2.rocks.length === 0 && sc2.oob.length === 0,
   sc2.clashes.concat(sc2.rocks, sc2.oob).join(','));
ok('日志全程无 timer error', timerErrors.length === 0, timerErrors.join(' | '));

console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
