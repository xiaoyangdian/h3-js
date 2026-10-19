// _probe12：快速战斗（混合路线的"自动"那一半）
// 覆盖：① 双方全 AI 自动打完出战报 ② 战报编制数字与场上一致 ③ 打完占位不变量仍成立
//      ④ 手动入口不受影响（默认手动、我方仍交玩家）⑤ 50 回合兜底判胜负
// 规则依据：原版 Quick Combat（RoE 官方手册 p.21："the game resolves combat for you
// without displaying the Combat Screen"）——见 参考资料.md §2.7
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
// log() 裁日志用 box.lastChild / box.firstChild——桩必须提供，否则 removeChild(undefined) 抛错
Object.defineProperty(El.prototype,'firstChild',{get:function(){return this.children[0]||null;}});
Object.defineProperty(El.prototype,'lastChild',{get:function(){return this.children[this.children.length-1]||null;}});
var store={};
global.document={getElementById:function(id){return store[id]||(store[id]=new El('div'));},
  createElement:function(t){return new El(t);},createElementNS:function(n,t){return new El(t);},
  querySelector:function(){return null;}};

// ── 假时钟：与 _probe10 相同，把流程计时全部即时排空 ──
var clock = 0, timers = [], tid = 1;
global.setTimeout = function(fn, ms){ timers.push({ id:tid++, at:clock + (ms||0), fn:fn }); return tid; };
global.clearTimeout = function(id){ timers = timers.filter(function(t){ return t.id !== id; }); };
function flush(){
  var n = 0;
  while (timers.length && n < 20000) {
    timers.sort(function(a,b){ return a.at - b.at || a.id - b.id; });
    var t = timers.shift();
    clock = Math.max(clock, t.at);
    try { t.fn(); } catch(e) { console.log('  [timer error] ' + e.message); }
    n++;
  }
  return n;
}

var html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace(/\r\n/g, '\n');   // 容忍 CRLF checkout：先归一成 LF 再做字面量注入
src = src.replace('  init();\n})();', [
'  globalThis.__T = {',
'    units: function(){ return units }, byId: function(id){ return units.filter(function(u){return u.id===id})[0] },',
'    key: key, cellsOf: cellsOf, isRock: isRock, canStand: canStand, fitDir: fitDir,',
'    init: init, startQuick: startQuick, startManual: startManual,',
'    get quickMode(){ return quickMode }, get wantQuick(){ return wantQuick },',
'    get over(){ return over }, get order(){ return order }, get roundNo(){ return roundNo },',
'    current: current, endActor: endActor, onHexClick: onHexClick,',
'    setStepDelay: function(n){ stepDelay = n },',
'    W: function(){return W}, H: function(){return H}, alive: alive, unitAt: unitAt,',
'    logText: function(){ return document.getElementById("log").children.map(function(p){ return p._html||""; }).join("\\n") },',
'    overEl: function(){ var f=document.getElementById("field"); var l=f.children.filter(function(c){ return c.className === "over"; }); return l.length ? l[l.length-1] : null; },',
'    overHTML: function(){ var o=this.overEl(); return o ? o.innerHTML : ""; },',
'    overBtnIds: function(){ var h=this.overHTML(); return ["againManual","againQuick"].filter(function(id){ return h.indexOf(id) >= 0; }); },',
'    hint: function(){ return document.getElementById("hint").textContent }',
'  };\n  init();\n})();'
].join('\n'));

new Function(src)();
var T = globalThis.__T;

var pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
// 占位不变量（同 _probe10）：无叠格 / 无站岩石 / 无出界
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

console.log('--- 1. 默认手动：init 不进快速模式，我方仍交玩家 ---');
ok('默认 wantQuick=false', T.wantQuick === false);
ok('默认 quickMode=false', T.quickMode === false);
ok('我方回合等人操作', T.current().side === 'us' && T.hint().indexOf('行动') >= 0, T.hint());

console.log('--- 2. 快速战斗：双方 AI 自动打完 ---');
T.startQuick();
ok('进入快速模式', T.quickMode === true);
ok('防御按钮禁用', document.getElementById('btnDefend').disabled === true);
var steps = flush();
ok('时钟排空后战斗已结束', !!T.over, 'roundNo=' + T.roundNo);
ok('有胜方（us/them）', T.over === 'us' || T.over === 'them', T.over);
ok('回合数有限（≤51）', T.roundNo <= 51, T.roundNo);
console.log('  胜方 ' + T.over + ' · ' + T.roundNo + ' 回合 · 计时器排空 ' + steps + ' 个');

console.log('--- 3. 战报：编制数字与场上一致 ---');
var oh = T.overHTML();
ok('战报带「快速结算」标记', oh.indexOf('快速结算') >= 0, oh.slice(0, 120));
ok('战报有我方/敌方两行', oh.indexOf('我方：') >= 0 && oh.indexOf('敌方：') >= 0);
ok('战报有手动重打/快速再来两按钮', (function(){
  var b = T.overBtnIds(); return b.indexOf('againManual') >= 0 && b.indexOf('againQuick') >= 0;
})(), T.overBtnIds().join(','));
// 每个单位的 startCount→count 必须出现在战报里
var missing = [];
T.units().forEach(function(u){
  var seg = u.name + ' ' + u.startCount + '→' + u.count;
  if (oh.indexOf(seg) < 0) missing.push(seg);
});
ok('逐队编制行齐全（startCount→count）', missing.length === 0, missing.join(' | '));
var bad = T.units().filter(function(u){ return u.count > u.startCount || u.hp < 0 || (!u.dead && u.count <= 0); });
ok('编制/血量自洽', bad.length === 0, bad.map(function(u){return u.id;}).join(','));

console.log('--- 4. 打完占位不变量仍成立 ---');
var sc = scan();
ok('无叠格', sc.clashes.length === 0, sc.clashes.join(','));
ok('无站岩石', sc.rocks.length === 0, sc.rocks.join(','));
ok('无出界', sc.oob.length === 0, sc.oob.join(','));

console.log('--- 5. 快速战斗日志走得通全程 ---');
var lt = T.logText();
ok('日志有开局标记', lt.indexOf('快速战斗') >= 0);
ok('日志有伤害记录', /造成 \d+ 伤害/.test(lt));
ok('日志有胜负或判定收尾', /被消灭/.test(lt) || lt.indexOf('按剩余兵力判定') >= 0);

console.log('--- 6. 战报按钮回切手动仍正常 ---');
// 模拟点「手动重打」：按钮监听挂在 getElementById 拿到的那个桩节点上
var manBtn = document.getElementById('againManual');
ok('「手动重打」按钮有监听器', !!(manBtn.listeners.click && manBtn.listeners.click.length));
manBtn.listeners.click[0]();
ok('手动重打后 quickMode=false', T.quickMode === false);
ok('手动重打后我方回合等人操作', T.current().side === 'us' && T.hint().indexOf('行动') >= 0, T.hint());
var sc2 = scan();
ok('重开后占位不变量成立', sc2.clashes.length === 0 && sc2.rocks.length === 0 && sc2.oob.length === 0);

console.log('--- 7. 快速再来：同一入口可重复 ---');
T.startQuick();
flush();
ok('快速再来也能打完', !!T.over, 'roundNo=' + T.roundNo);
var oh2 = T.overHTML();
ok('第二次战报仍带编制行', oh2.indexOf('→') >= 0);

console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
