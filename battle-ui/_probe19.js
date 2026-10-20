// _probe19：行动顺序实时重排 + 施法窗口 + 增益覆盖（不叠加）
// 覆盖：
//   1) 开局队列 = 速度降序、同速按 ROSTER 次序
//   2) 加速**立刻**前移 / 减速**立刻**后移（不必等下一轮）
//   3) 正在行动的部队（order[0]）不被加速/减速顶掉
//   4) 驱散后速度与队列位置立刻还原
//   5) 加速↔减速、祝福↔诅咒 = **清零旧状态再从裸值重算**，不叠乘
//   6) 重放 = 刷新持续时间，不叠层
//   7) 施法窗口：只有我方部队行动时才可施法；敌方行动时整本禁用
// 规则依据：参考资料.md §2.10「法术」+ §2.6；用户 2026-10-20 口述三条修正
// 不在本套件：AI 施法（仍是缺口）、3-5 级法术
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
Object.defineProperty(El.prototype,'firstChild',{get:function(){return this.children[0]||null;}});
Object.defineProperty(El.prototype,'lastChild',{get:function(){return this.children[this.children.length-1]||null;}});
var store={};
global.document={getElementById:function(id){return store[id]||(store[id]=new El('div'));},
  createElement:function(t){return new El(t);},createElementNS:function(n,t){return new El(t);},
  querySelector:function(){return null;}};

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
src = src.replace(/\r\n/g, '\n');
// 注入串与 _probe17/18 同形；法力经济与法术接口经 attachTestHooks 补挂
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
T.setStepDelay(0);

var pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function byId(id){ return T.byId(id); }
function flushAll(){ flush(); }
function pos(id){ return T.order.indexOf(id); }
function seq(){
  // 把 order 映射成"名字(速度)"，失败时便于人读
  return T.order.map(function(id){
    var u = byId(id);
    return id + (u ? '(' + u.speed + ')' : '(×)');
  }).join(' ');
}

/* 开一局：知识 10（法力 100 够连着施）、力量 3（持续 3 回合，否则一律 1 回合）、
   精通初级（+3 / ×0.75 / 无 +1），手动模式 */
function fresh(){
  T.resetHeroes();
  T.setHero('us', 'knowledge', 10);
  T.setHero('us', 'spellpower', 3);
  T.setHero('us', 'mastery', 0);
  T.setHero('them', 'knowledge', 10);
  T.setHero('them', 'mastery', 0);
  T.startManual(); flushAll();
  T.setMana('us', 100);
  T.setMana('them', 100);
  T.setCastsThisRound('us', 0);
  T.setCastsThisRound('them', 0);
}
/* 施法并自动重置"每回合一次"额度（本套件只验顺序与覆盖） */
function cast(side, key, target){
  T.setCastsThisRound(side, 0);
  return T.castSpell(side, key, target);
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 开局队列：速度降序 + 同速按 ROSTER 次序 ---');
fresh();
ok('队列长度 = 存活单位数（9）', T.order.length === 9, T.order.length);
ok('head 是速度最快的绿龙 A5（9）', T.order[0] === 'A5' && byId('A5').speed === 9, seq());
ok('完整顺序 = 9,8,7,6,5,5,4,4,4',
   T.order.join(',') === 'A5,E2,A4,A3,E1,E4,A1,A2,E3', seq());
ok('同速 5：魔童 E1 在长角魔 E4 之前（ROSTER 次序）', pos('E1') < pos('E4'), seq());
ok('同速 4：A1 → A2 → E3（ROSTER 次序，我方在前）',
   pos('A1') < pos('A2') && pos('A2') < pos('E3'), seq());
ok('current() 就是 order[0]', T.current().id === 'A5', T.current().id);

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 加速立刻前移（不等下一轮） ---');
var a1 = byId('A1'), a1sp = a1.speed;   // 4
var beforeIdx = pos('A1');
var r = cast('us', 'haste', a1);
ok('施法成功', r.ok === true, r.why);
ok('速度 4 → 7（初级 +3）', a1.speed === a1sp + 3, a1.speed);
ok('位置从第 6 位前移到第 2 位（立刻，不等下一轮）', pos('A1') === 2 && beforeIdx === 6,
   'before=' + beforeIdx + ' after=' + pos('A1') + ' | ' + seq());
ok('同速 7 时排在骑士 A4 之前（ROSTER 次序）', pos('A1') < pos('A4'), seq());
ok('正在行动的绿龙 A5 仍是 head', T.order[0] === 'A5' && T.current().id === 'A5', seq());
ok('队列长度不变', T.order.length === 9, T.order.length);

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 减速立刻后移 ---');
var e2 = byId('E2'), e2sp = e2.speed;   // 8
var e2before = pos('E2');
r = cast('us', 'slow', e2);
ok('施法成功', r.ok === true, r.why);
ok('速度 8 → 6（×0.75 向下取整）', e2.speed === Math.floor(e2sp * 0.75), e2.speed);
ok('位置从第 1 位后退到第 4 位（立刻）', pos('E2') === 4 && e2before === 1,
   'before=' + e2before + ' after=' + pos('E2') + ' | ' + seq());
ok('同速 6 时排在狮鹫 A3 之后（ROSTER 次序）', pos('A3') < pos('E2'), seq());
ok('正在行动的 A5 仍是 head', T.order[0] === 'A5', seq());

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 驱散：速度与队列位置立刻还原 ---');
var a1idx = pos('A1');
r = cast('us', 'dispel', a1);
ok('驱散成功', r.ok === true, r.why);
ok('A1 身上没有效果了', T.effectsOf(a1).length === 0, T.effectsOf(a1).length);
ok('速度回到裸值 4', a1.speed === a1sp, a1.speed);
ok('队列位置退回第 6 位（立刻）', pos('A1') === 6 && a1idx === 1, 'before=' + a1idx + ' after=' + pos('A1') + ' | ' + seq());
ok('A1 又排回 A2 / E3 之前（同速 4，ROSTER 次序）', pos('A1') < pos('A2') && pos('A2') < pos('E3'), seq());

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 加速↔减速 = 清零重算，不叠乘 ---');
/* 原版限制：加速只能对友方、减速只能对敌方，一个英雄没法自己施出"先加速再减速"。
   敌方那一半用 addEffect 模拟——它和 castSpell 走同一个入口（addEffect），
   差别只是跳过阵营校验。 */
fresh();
var u = byId('A1'), base = u.speed;     // 4
T.addEffect(u, { spell: 'slow', name: '减速', kind: 'debuff', remaining: 3, mult: 0.75 });
ok('先被减速：4 → 3', u.speed === Math.floor(base * 0.75), u.speed);
cast('us', 'haste', u);
ok('再加速：3 → 4+3=7（**不是** 3+3=6）', u.speed === base + 3,
   '得到 ' + u.speed + '，叠加会是 ' + (Math.floor(base * 0.75) + 3));
ok('减速已被加速驱掉（只剩 1 个效果）',
   T.effectsOf(u).length === 1 && T.effectsOf(u)[0].spell === 'haste',
   T.effectsOf(u).map(function(e){ return e.spell; }).join(','));

T.addEffect(u, { spell: 'slow', name: '减速', kind: 'debuff', remaining: 3, mult: 0.75 });
ok('再减速：7 → floor(4×0.75)=3（**不是** floor(7×0.75)=5）',
   u.speed === Math.floor(base * 0.75) && u.speed !== Math.floor((base + 3) * 0.75),
   '得到 ' + u.speed + '，叠乘会是 ' + Math.floor((base + 3) * 0.75));
ok('加速已被减速驱掉（只剩 1 个效果）',
   T.effectsOf(u).length === 1 && T.effectsOf(u)[0].spell === 'slow',
   T.effectsOf(u).map(function(e){ return e.spell; }).join(','));

// 祝福 ↔ 诅咒 同理（伤害区间，不是速度）
var a3 = byId('A3');
T.addEffect(a3, { spell: 'curse', name: '诅咒', kind: 'debuff', remaining: 3, dmgFix: 'min', minus: 0 });
ok('先被诅咒：伤害取最小值（区间压成固定值）',
   a3.dmg[0] === a3.dmg[1] && a3.dmg[0] === a3.baseDmg[0],
   a3.dmg.join('-') + ' 裸值 ' + a3.baseDmg.join('-'));
cast('us', 'bless', a3);
ok('再祝福：从裸值重算取最大值（不是"在最小值上加"）',
   a3.dmg[0] === a3.baseDmg[1] && a3.dmg[1] === a3.baseDmg[1],
   a3.dmg.join('-') + ' 裸值 ' + a3.baseDmg.join('-'));
ok('诅咒被祝福驱掉了', T.effectsOf(a3).length === 1 && T.effectsOf(a3)[0].spell === 'bless',
   T.effectsOf(a3).map(function(e){ return e.spell; }).join(','));

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 重放 = 刷新持续时间，不叠层 ---');
fresh();
var h = byId('A2'), hb = h.speed;
cast('us', 'haste', h);
var first = T.effectsOf(h)[0].remaining;
T.effectsOf(h)[0].remaining = 1;                 // 模拟快到期
cast('us', 'haste', h);
ok('两次加速速度仍是裸值 +3（不叠成 +6）', h.speed === hb + 3, h.speed);
ok('效果只有 1 个（同名被替换）', T.effectsOf(h).length === 1, T.effectsOf(h).length);
ok('持续时间被刷新回满', T.effectsOf(h)[0].remaining === first && first > 1,
   'remaining=' + T.effectsOf(h)[0].remaining + ' 首次=' + first);

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 正在行动的部队不被自己/别人的加减速顶掉 ---');
fresh();
var head = T.current();
ok('head = A5（速度 9）', head.id === 'A5', head.id);
T.addEffect(head, { spell: 'slow', name: '减速', kind: 'debuff', remaining: 3, mult: 0.5 });
ok('head 速度掉到 4（9 → floor(4.5)=4）', head.speed === 4, head.speed);
ok('order[0] 仍是它（这一手已经开始，不被顶走）',
   T.order[0] === 'A5' && T.current().id === 'A5', seq());
ok('其余队列按新速度重排：E2 变成第一个待行动的', T.order[1] === 'E2', seq());
ok('队列长度仍 9（重排不丢人）', T.order.length === 9, T.order.length);

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 同速稳定性：提速后按 ROSTER 次序插队 ---');
fresh();
cast('us', 'haste', byId('A2'));           // 4 → 7，与 A4 同速
ok('A2 提速后排在 A4 之前（ROSTER：A2 索引 1 < A4 索引 3）',
   pos('A2') < pos('A4'), seq());
cast('us', 'haste', byId('A1'));           // 4 → 7，与 A2/A4 同速
ok('A1 再插到 A2 之前（ROSTER 次序 A1 < A2 < A4）',
   pos('A1') < pos('A2') && pos('A2') < pos('A4'), seq());
ok('三支同速 7 的队伍连在一起',
   pos('A4') - pos('A1') === 2, seq());

// ════════════════════════════════════════════════════════════════
console.log('--- 9. 施法窗口：只在我方部队行动时 ---');
fresh();
ok('我方部队行动：可以施法', T.canCastNow('us') === true);
ok('我方行动时敌方不能施法', T.canCastNow('them') === false);
ok('敌方施法入口也被拒', (function(){
  var rr = T.castSpell('them', 'haste', byId('E1'));
  return rr.ok === false && /只在我方行动时/.test(rr.why);
})(), '');
ok('每回合一次：本回合已施法后拒绝', (function(){
  T.setCastsThisRound('us', 0);
  var a = T.castSpell('us', 'haste', byId('A1'));
  var b = T.castSpell('us', 'haste', byId('A2'));
  return a.ok === true && b.ok === false && /本回合已施法/.test(b.why);
})(), '');

// 把这一手交出去 → 轮到敌方
T.setCastsThisRound('us', 0);
T.endActor();
ok('交出后当前是敌方单位', T.current() && T.current().side === 'them', T.current() && T.current().id);
ok('敌方回合我方不能施法（canCastNow）', T.canCastNow('us') === false);
ok('敌方回合我方不能施法（castSpell 被拒）', (function(){
  var rr = T.castSpell('us', 'haste', byId('A1'));
  return rr.ok === false && /只在我方行动时/.test(rr.why);
})(), '');
ok('敌方回合 UI 入口 beginCast 也被拒', T.beginCast('magicArrow') === false);
ok('敌方回合整本法术书没有可点的法术',
   (T.spellBookHtml().match(/class="ready"/g) || []).length === 0,
   (T.spellBookHtml().match(/class="ready"/g) || []).length);
ok('敌方回合 7 个法术按钮全部 disabled',
   (T.spellBookHtml().match(/disabled/g) || []).length === T.SPELL_ORDER.length,
   (T.spellBookHtml().match(/disabled/g) || []).length + '/' + T.SPELL_ORDER.length);
T.setCastsThisRound('them', 0);
ok('AI 侧（探针代调）仍可施法——接口没被写死成"只能我方"', (function(){
  var rr = T.castSpell('them', 'haste', byId('E1'));
  return rr.ok === true && byId('E1').speed === byId('E1').baseSpeed + 3;
})(), '');

flushAll();
ok('推进后能落到我方单位（战斗没卡死）',
   !T.over ? (T.current() && true) : true, T.over ? 'over' : (T.current() && T.current().id));
ok('全程无定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));

// ════════════════════════════════════════════════════════════════
console.log('--- 10. 新回合按当前速度重建队列 ---');
fresh();
cast('us', 'haste', byId('A2'));           // 我方弓手 4 → 7
ok('A2 提速后位置前移（第 6 → 第 2 位）', pos('A2') === 2, seq());
T.startRoundNow(); flushAll();
ok('新回合仍按提速后的位置（持续 3 回合，未到期）', pos('A2') === 2, seq());
ok('效果到期后速度还原并按裸值排回原位', (function(){
  var a2 = byId('A2');
  T.effectsOf(a2)[0].remaining = 1;        // 压到最后一回合
  T.startRoundNow();
  return a2.speed === a2.baseSpeed && pos('A2') === 7;
})(), seq());

console.log('---');
console.log('PASS ' + pass + '  FAIL ' + fail);
if (fail) { console.log('FAILED'); process.exit(1); }
else console.log('ALL PASS');
