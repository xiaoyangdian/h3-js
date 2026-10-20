// _probe15：英雄数值容器（第 1 切片前置 · 供数层）
// 覆盖：默认无英雄不变 / 攻防加成的公式效应 / 钳制与非法参数 / 即时同步不重开 /
//      归零与重开语义 / 容器字段落地 / 与既有特性共存 / 面板与测试契约补挂
// 规则依据：参考资料.md §2.6（英雄四维进伤害公式）+ §2.9（本切片新增的容器约定）
// 不在本套件：士气·战术·魔法的**消费**逻辑（本切片只落字段与来源，掷骰/布阵在后续切片）
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

// ── 假时钟：与 _probe14 相同，把流程与特效计时全部即时排空 ──
var clock = 0, timers = [], tid = 1, timerErrors = [];
global.setTimeout = function(fn, ms){ timers.push({ id:tid++, at:clock + (ms||0), fn:fn }); return tid; };
global.clearTimeout = function(id){ timers = timers.filter(function(t){ return t.id !== id; }); };
function flush(){
  var n = 0;
  while (timers.length && n < 20000) {
    timers.sort(function(a,b){ return a.at - b.at || a.id - b.id; });
    var t = timers.shift();
    clock = Math.max(clock, t.at);
    try { t.fn(); } catch(e) { timerErrors.push(e.message); }
    n++;
  }
  return n;
}

var html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace(/\r\n/g, '\n');   // 容忍 CRLF checkout：先归一成 LF 再做字面量注入
// 注入串里**没有** heroes / setHero：本套件就是用来验证 attachTestHooks 的补挂生效
src = src.replace('  init();\n})();', [
'  globalThis.__T = {',
'    units: function(){ return units }, byId: function(id){ return units.filter(function(u){return u.id===id})[0] },',
'    init: init, startQuick: startQuick, startManual: startManual,',
'    setStepDelay: function(n){ stepDelay = n },',
'    key: key, cellsOf: cellsOf, neighbors: neighbors, dist: dist,',
'    unitAt: unitAt, alive: alive, isRock: isRock, current: current,',
'    get over(){ return over }, get roundNo(){ return roundNo }, get order(){ return order },',
'    doAttack: doAttack, performAttack: performAttack, applyDamage: applyDamage,',
'    calcDamage: calcDamage, dmgMult: dmgMult, rollDamage: rollDamage, effDef: effDef,',
'    rollLuck: rollLuck, rollBase: rollBase,',
'    damagePreview: damagePreview, applyTraits: applyTraits, traitNames: traitNames,',
'    aroundTargets: aroundTargets, cloudTargets: cloudTargets,',
'    bestiary: function(){ return BESTIARY },',
'    roster: function(){ return ROSTER },',
'    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },',
'    logText: function(){ return document.getElementById("log").children.map(function(p){ return p._html||""; }).join("\\n") },',
'    cardHtml: function(){ return document.getElementById("curCard")._html || "" },',
'    hint: function(){ return document.getElementById("hint").textContent },',
'    heroBarHtml: function(){ return document.getElementById("heroBar")._html || "" }',
'  };\n  init();\n})();'
].join('\n'));

new Function(src)();
var T = globalThis.__T;
T.setStepDelay(0);            // 只验规则，走位同步走完

var pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function byId(id){ return T.byId(id); }
function fresh(){ T.init(); flush(); }
function noHero(){ T.resetHeroes(); fresh(); }   // 干净基线：没有英雄
function eq(a, b){ return Math.abs(a - b) < 1e-9; }
function near(a, b, eps){ return Math.abs(a - b) <= (eps || 1e-9); }

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 默认无英雄：既有数值一位不变 ---');
noHero();
var ROSTER = T.roster();
ok('ROSTER 仍是 9 支部队', ROSTER.length === 9, ROSTER.length);
var mismatch = [];
T.units().forEach(function(u){
  var r = ROSTER.filter(function(x){ return x.id === u.id; })[0];
  if (u.att !== r.att || u.def !== r.def) mismatch.push(u.id + ':' + u.att + '/' + u.def);
});
ok('9 支部队 att/def 等于 ROSTER 裸值', mismatch.length === 0, mismatch.join(','));
ok('英雄默认为 0（我方）',
   ['attack','defense','spellpower','luck','morale','tactics'].every(function(k){ return T.heroes().us[k] === 0; }),
   JSON.stringify(T.heroes().us));
ok('英雄默认为 0（敌方）',
   ['attack','defense','spellpower','luck','morale','tactics'].every(function(k){ return T.heroes().them[k] === 0; }),
   JSON.stringify(T.heroes().them));
ok('单位记下裸值 baseAtt=4 / baseDef=5', byId('A1').baseAtt === 4 && byId('A1').baseDef === 5,
   byId('A1').baseAtt + '/' + byId('A1').baseDef);
ok('无英雄时 luck/morale/tactics 落 0',
   byId('A2').luck === 0 && byId('A2').morale === 0 && byId('A2').tactics === 0);

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 测试契约补挂：探针注入串没写，也能拿到 ---');
ok('__T.heroes 已补挂为函数', typeof T.heroes === 'function', typeof T.heroes);
ok('__T.setHero 已补挂为函数', typeof T.setHero === 'function', typeof T.setHero);
ok('__T.resetHeroes 已补挂为函数', typeof T.resetHeroes === 'function', typeof T.resetHeroes);
ok('heroes().us 有 9 个键（8 数值 + name）', Object.keys(T.heroes().us).length === 9, Object.keys(T.heroes().us).join(','));

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 英雄攻击：加到生物攻击上，进 I1 ---');
noHero();
var m0 = T.dmgMult(byId('A1'), byId('E1'), 0, false);
ok('无英雄 枪兵4 vs 魔童3 → 倍率 1.05', eq(m0, 1.05), m0);
ok('setHero(us,attack,4) 返回 true', T.setHero('us', 'attack', 4) === true);
ok('枪兵 att 4→8', byId('A1').att === 8, byId('A1').att);
ok('绿龙 att 18→22（全员生效）', byId('A5').att === 22, byId('A5').att);
ok('敌方魔童 att 仍 2（不串阵营）', byId('E1').att === 2, byId('E1').att);
var m1 = T.dmgMult(byId('A1'), byId('E1'), 0, false);
ok('倍率 1.05→1.25（差 5 → I1 0.25）', eq(m1, 1.25), m1);
ok('加成是加法进 I1，不是乘在伤害上', eq(m1 - m0, 0.20), m1 - m0);
ok('ROSTER 裸值没被就地改写（仍 4）', ROSTER[0].att === 4, ROSTER[0].att);
ok('英雄攻击拉满 20 → 枪兵 24，倍率 2.05', (function(){
  T.setHero('us', 'attack', 20);
  return byId('A1').att === 24 && eq(T.dmgMult(byId('A1'), byId('E1'), 0, false), 2.05);
})(), T.dmgMult(byId('A1'), byId('E1'), 0, false));

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 英雄防御：加到生物防御上，进 R1 与防御指令 ---');
noHero();
var mDef0 = T.dmgMult(byId('E1'), byId('A1'), 0, false);
T.setHero('us', 'defense', 3);
ok('枪兵 def 5→8', byId('A1').def === 8, byId('A1').def);
ok('effDef 未防御时就是 8', eq(T.effDef(byId('A1')), 8), T.effDef(byId('A1')));
byId('A1').defending = true;
ok('防御指令 ×1.2 → 9.6', eq(T.effDef(byId('A1')), 9.6), T.effDef(byId('A1')));
byId('A1').defending = false;
var mDef1 = T.dmgMult(byId('E1'), byId('A1'), 0, false);
ok('敌方打我方倍率下降（防御抬高）', mDef1 < mDef0, mDef0 + ' -> ' + mDef1);
ok('敌方为自己设防御只影响敌方（我方 A1.def 仍 8）', (function(){
  T.setHero('them', 'defense', 5);
  return byId('A1').def === 8 && byId('E1').def === 8;
})(), byId('A1').def + '/' + byId('E1').def);

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 钳制与非法参数：不许悄悄写坏 ---');
noHero();
T.setHero('us', 'attack', 999);
ok('attack 999 钳到 20', T.heroes().us.attack === 20, T.heroes().us.attack);
T.setHero('us', 'luck', 9);
ok('luck 9 钳到 +3', T.heroes().us.luck === 3, T.heroes().us.luck);
T.setHero('us', 'luck', -9);
ok('luck -9 钳到 -3', T.heroes().us.luck === -3, T.heroes().us.luck);
T.setHero('us', 'tactics', 3.4);
ok('tactics 3.4 取整为 3', T.heroes().us.tactics === 3, T.heroes().us.tactics);
ok('未知阵营返回 false', T.setHero('nobody', 'attack', 1) === false);
ok('未知字段返回 false', T.setHero('us', 'strength', 1) === false);
ok('name 字段不可写', T.setHero('us', 'name', 'x') === false && T.heroes().us.name === '我方英雄',
   T.heroes().us.name);
ok('非数值返回 false', T.setHero('us', 'attack', 'abc') === false);
ok('非法调用后攻击值没被改（仍 20）', T.heroes().us.attack === 20, T.heroes().us.attack);

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 即时同步：改英雄不重开一局 ---');
noHero();
var a1 = byId('A1');
T.applyDamage(a1, 50);
var hpBefore = a1.hp, cntBefore = a1.count;
T.setHero('us', 'attack', 4);
ok('调英雄后当前单位仍是同一对象', byId('A1') === a1);
ok('血量与编制不变（只改攻防）', a1.hp === hpBefore && a1.count === cntBefore,
   a1.hp + '/' + a1.count);
ok('攻防已即时更新（att 8 / def 5）', a1.att === 8 && a1.def === 5, a1.att + '/' + a1.def);
ok('反复调不累加：4→6→4 得 10→8', (function(){
  T.setHero('us', 'attack', 6);
  var mid = byId('A1').att;
  T.setHero('us', 'attack', 4);
  return mid === 10 && byId('A1').att === 8;
})(), byId('A1').att);

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 归零与重开：英雄是局外配置 ---');
T.resetHeroes();
ok('resetHeroes 后枪兵回到 4', byId('A1').att === 4, byId('A1').att);
T.setHero('us', 'attack', 6);
fresh();
ok('重开后英雄值保留（局外配置）', byId('A1').att === 10, byId('A1').att);
ok('重开后新单位也带 add 后的 baseAtt（仍 4）', byId('A1').baseAtt === 4, byId('A1').baseAtt);
T.resetHeroes(); fresh();
ok('归零再重开 → 回到裸值 4', byId('A1').att === 4, byId('A1').att);

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 容器字段：士气/幸运/力量/战术落到单位上（当前只存不读） ---');
noHero();
T.setHero('us', 'morale', 2);
T.setHero('us', 'luck', 1);
T.setHero('us', 'tactics', 3);
T.setHero('us', 'spellpower', 5);
ok('morale 落到 u.morale', byId('A3').morale === 2, byId('A3').morale);
ok('luck 落到 u.luck', byId('A3').luck === 1, byId('A3').luck);
ok('tactics 落到 u.tactics', byId('A3').tactics === 3, byId('A3').tactics);
ok('spellpower 落到 u.spellpower', byId('A3').spellpower === 5, byId('A3').spellpower);
ok('敌方读自己的英雄（仍是 0）', byId('E1').morale === 0 && byId('E1').luck === 0,
   byId('E1').morale + '/' + byId('E1').luck);
ok('luck=0 时幸运恒不触发（200 次）', (function(){
  for (var i = 0; i < 200; i++) if (T.rollLuck({ luck: 0 })) return false;
  return true;
})());
ok('负幸运不触发（rollLuck 只在 L>0 时掷，200 次）', (function(){
  for (var i = 0; i < 200; i++) if (T.rollLuck({ luck: -3 })) return false;
  return true;
})());

// ════════════════════════════════════════════════════════════════
console.log('--- 9. 与既有特性共存 ---');
noHero();
T.setHero('us', 'attack', 4);
ok('弓箭手二连击仍在（strikes 2）', byId('A2').strikes === 2, byId('A2').strikes);
ok('狮鹫反击次数仍 2（英雄不改特性）', byId('A3').retaliating === 2, byId('A3').retaliating);
ok('绿龙穿刺/龙息标志不受英雄影响', byId('A5').breath === true && byId('A5').piercing === 0);
ok('重生/亡灵等图鉴字段不被英雄覆盖', (function(){
  var u = byId('A4'); T.applyTraits(u, '幽灵');
  return u.regenerating === true && u.undead === true && u.att === 14;
})(), byId('A4').att);

// ════════════════════════════════════════════════════════════════
console.log('--- 10. 面板与快速战斗回归 ---');
noHero();
var hb = T.heroBarHtml();
ok('英雄面板有 16 个输入框（8 项 × 2 方）', (hb.match(/data-stat=/g) || []).length === 16,
   (hb.match(/data-stat=/g) || []).length);
ok('全 0 时没有 .on 高亮', hb.indexOf('class="on"') < 0);
T.setHero('us', 'attack', 2);
ok('非 0 项带上 on 高亮', T.heroBarHtml().indexOf('class="on"') >= 0);
ok('面板值跟着变（value="2"）', T.heroBarHtml().indexOf('value="2"') >= 0);
ok('日志未被英雄面板污染（无异常插入）', T.logText().indexOf('undefined') < 0);
T.startQuick(); flush();
ok('设了英雄也能打完快速战斗', !!T.over, T.over && T.over.winner);
ok('快速战斗全程无定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));
T.resetHeroes();

// ════════════════════════════════════════════════════════════════
console.log('');
console.log((fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
