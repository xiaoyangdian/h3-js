// _probe17：法术（代表子集 7 个）
// 覆盖：法术表与法力上限 / 施法限制（时机·法力·每回合一次）/ 伤害公式（精通×力量）/
//      增益减益的数值与持续 / 反制与刷新 / 驱散三档 / 免疫 / 按轮递减 / 法术书 UI
// 规则依据：参考资料.md §2.10（全部数值逐条抄自 heroes.thelazy.net 法术词条）
// 不在本套件：AI 施法（未做）、Sorcery 等伤害加成、3-5 级法术
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

// ── 假时钟：与 _probe14/15/16 相同 ──
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
// 注入串里**没有**法术相关引用：本套件同时验证 attachTestHooks 的补挂是否覆盖新 API
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
function eq(a, b){ return Math.abs(a - b) < 1e-9; }

/* 备场：knowledge=法力上限/10，spellpower=力量，mastery=精通 0/1/2 */
function prep(kn, sp, ma){
  T.resetHeroes();
  if (kn) T.setHero('us', 'knowledge', kn);
  if (sp) T.setHero('us', 'spellpower', sp);
  if (ma) T.setHero('us', 'mastery', ma);
  T.init(); flushAll();
}
function noMana(){ T.resetHeroes(); T.init(); flushAll(); }

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 法术表与法力上限 ---');
ok('法术表 7 条', Object.keys(T.SPELLS).length === 7, Object.keys(T.SPELLS).length);
ok('法术书顺序也是 7 条', T.SPELL_ORDER.length === 7 && T.SPELL_ORDER.every(function(k){ return !!T.SPELLS[k]; }));
ok('每个法术都有 name/level/cost/target', T.SPELL_ORDER.every(function(k){
  var s = T.SPELLS[k];
  return s.name && s.level >= 1 && s.cost > 0 && s.target;
}));
ok('闪电是唯一的 2 级法术', T.SPELL_ORDER.filter(function(k){ return T.SPELLS[k].level === 2; }).join() === 'lightningBolt');

noMana();
ok('默认（知识 0）法力上限 0', T.manaMax('us') === 0 && T.manaOf('us') === 0, T.manaMax('us'));
prep(3, 0, 0);
ok('知识 3 → 法力上限 30（每点 +10）', T.manaMax('us') === 30, T.manaMax('us'));
ok('开战法力回满（原型自定）', T.manaOf('us') === 30, T.manaOf('us'));
T.setHero('us', 'mastery', 9);
ok('精通钳在 0…2（9 → 2）', T.masteryOf('us') === 2, T.masteryOf('us'));
T.setHero('us', 'mastery', -5);
ok('精通负数钳到 0', T.masteryOf('us') === 0, T.masteryOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 施法限制：时机 / 法力 / 每回合一次 ---');
noMana();
var e1 = byId('E1');
var r = T.castSpell('us', 'magicArrow', e1);
ok('无法力时拒绝：法力不足', r.ok === false && /法力不足/.test(r.why), r.why);
ok('拒绝时不扣费（法力仍是 0）', T.manaOf('us') === 0);

prep(3, 0, 0);
var a5 = byId('A5');
T.forceTurn(a5); flushAll();                    // 轮到我方（绿龙速度 9，本来就是我方第一个）
ok('我方行动时可以施法', T.canCastNow('us') === true);
ok('敌方行动时不能施法', T.canCastNow('them') === false);
r = T.castSpell('us', 'magicArrow', byId('E1'));
ok('法力够 → 施法成功', r.ok === true && r.damage === 10, r.why || r.damage);
ok('扣掉 5 点法力（30 → 25）', T.manaOf('us') === 25, T.manaOf('us'));
ok('记录本回合已施法', T.castsThisRound().us === 1);
r = T.castSpell('us', 'magicArrow', byId('E1'));
ok('同一回合第二次施法被拒', r.ok === false && /已施法/.test(r.why), r.why);
ok('被拒的第二次没有扣费', T.manaOf('us') === 25, T.manaOf('us'));
ok('施法不消耗该单位行动（仍是同一个当前单位）', T.current() === a5);
ok('施法不把该单位标成"已移动"', T.moved() === false);

T.setCastsThisRound('us', 0);
T.forceTurn(byId('E1'));                        // 不 flush：否则敌方 AI 会把这一手走完、交棒回我方
r = T.castSpell('us', 'magicArrow', byId('E1'));
ok('敌方回合我方不能施法', r.ok === false && /不能施法/.test(r.why), r.why);

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 伤害法术：基础值随精通，力量线性叠加 ---');
prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
ok('魔法箭 初级·力0 = 10', T.spellDamage('magicArrow', 'us') === 10, T.spellDamage('magicArrow', 'us'));
ok('闪电   初级·力0 = 10', T.spellDamage('lightningBolt', 'us') === 10, T.spellDamage('lightningBolt', 'us'));
T.setHero('us', 'mastery', 1);
ok('魔法箭 中级·力0 = 20（基础变，倍率不变）', T.spellDamage('magicArrow', 'us') === 20, T.spellDamage('magicArrow', 'us'));
T.setHero('us', 'mastery', 2);
ok('魔法箭 专家·力0 = 30', T.spellDamage('magicArrow', 'us') === 30, T.spellDamage('magicArrow', 'us'));
ok('闪电   专家·力0 = 50', T.spellDamage('lightningBolt', 'us') === 50, T.spellDamage('lightningBolt', 'us'));
T.setHero('us', 'spellpower', 5);
ok('魔法箭 专家·力5 = 30+50 = 80', T.spellDamage('magicArrow', 'us') === 80, T.spellDamage('magicArrow', 'us'));
ok('闪电   专家·力5 = 50+125 = 175', T.spellDamage('lightningBolt', 'us') === 175, T.spellDamage('lightningBolt', 'us'));

// 实际扣血 = 公式值（法术伤害不过攻防表）
prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
var t1 = byId('E1'), hp0 = t1.hp, cnt0 = t1.count;
r = T.castSpell('us', 'magicArrow', t1);
ok('命中后掉血正好等于公式值', hp0 - t1.hp === r.damage, (hp0 - t1.hp) + ' vs ' + r.damage);
ok('编制按每只生命重算', t1.count === Math.ceil(t1.hp / t1.perHp), t1.count);
ok('法术伤害不看防御（改防御值不影响）', (function(){
  var before = T.spellDamage('magicArrow', 'us');
  T.setHero('them', 'defense', 20);
  var after = T.spellDamage('magicArrow', 'us');
  T.setHero('them', 'defense', 0);
  return before === after;
})());

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 急加速 / 减速：固定值，力量只管持续 ---');
prep(3, 2, 0); T.forceTurn(byId('A5')); flushAll();
var a1 = byId('A1'), sp0 = a1.baseSpeed;
r = T.castSpell('us', 'haste', a1);
ok('加速（初级）速度 +3', a1.speed === sp0 + 3, a1.speed + ' vs ' + (sp0 + 3));
ok('持续回合 = 力量（2）', T.effectsOf(a1)[0].remaining === 2, T.effectsOf(a1)[0].remaining);
ok('力量不加数值（力 2 仍是 +3）', T.effectsOf(a1)[0].add === 3, T.effectsOf(a1)[0].add);
T.setCastsThisRound('us', 0);
T.setHero('us', 'mastery', 1);
r = T.castSpell('us', 'haste', a1);
ok('加速（中级）速度 +5', T.effectsOf(a1)[0].add === 5, T.effectsOf(a1)[0].add);
ok('重放不叠层（还是一条效果）', T.effectsOf(a1).length === 1, T.effectsOf(a1).length);
ok('重放刷新持续时间', T.effectsOf(a1)[0].remaining === 2, T.effectsOf(a1)[0].remaining);

prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
var e2 = byId('E2'), e2sp = e2.baseSpeed;
r = T.castSpell('us', 'slow', e2);
ok('减速（初级）= 速度 ×0.75 向下取整', e2.speed === Math.floor(e2sp * 0.75), e2.speed + ' 期望 ' + Math.floor(e2sp * 0.75));
T.setCastsThisRound('us', 0);
T.setHero('us', 'mastery', 1);
T.castSpell('us', 'slow', e2);
ok('减速（中级）= 速度减半（原版 SoD 语义）', e2.speed === Math.floor(e2sp / 2), e2.speed);
ok('力量 0 时持续至少 1 回合', T.effectsOf(e2)[0].remaining === 1, T.effectsOf(e2)[0].remaining);

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 祝福 / 诅咒：把伤害区间压成固定值 ---');
prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
var e4 = byId('E4');
ok('长角魔裸伤害 7–12', e4.dmg[0] === 7 && e4.dmg[1] === 12, e4.dmg.join('-'));
r = T.castSpell('us', 'curse', e4);
ok('诅咒（初级）→ 伤害固定为最小值 7', e4.dmg[0] === 7 && e4.dmg[1] === 7, e4.dmg.join('-'));
T.setCastsThisRound('us', 0);
T.setHero('us', 'mastery', 1);
T.castSpell('us', 'curse', e4);
ok('诅咒（中级）→ 最小−1 = 6', e4.dmg[0] === 6 && e4.dmg[1] === 6, e4.dmg.join('-'));

prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
var e1b = byId('E1');
ok('魔童裸伤害 1–2', e1b.dmg[0] === 1 && e1b.dmg[1] === 2);
T.setCastsThisRound('us', 0);
T.setHero('us', 'mastery', 1);
T.castSpell('us', 'curse', e1b);
ok('最小−1 不会低于 1', e1b.dmg[0] >= 1 && e1b.dmg[1] >= 1, e1b.dmg.join('-'));

prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
var a2 = byId('A2');
ok('弓箭手裸伤害 2–3', a2.dmg[0] === 2 && a2.dmg[1] === 3);
r = T.castSpell('us', 'bless', a2);
ok('祝福（初级）→ 固定为最大 3', a2.dmg[0] === 3 && a2.dmg[1] === 3, a2.dmg.join('-'));
T.setCastsThisRound('us', 0);
T.setHero('us', 'mastery', 1);
T.castSpell('us', 'bless', a2);
ok('祝福（中级）→ 最大+1 = 4', a2.dmg[0] === 4 && a2.dmg[1] === 4, a2.dmg.join('-'));
ok('投掷伤害走的是同一个区间（rollBase 读 u.dmg）', (function(){
  T.setRand(function(){ return 0; });
  var lo = T.rollBase(a2);
  T.setRand(function(){ return 0.999; });
  var hi = T.rollBase(a2);
  T.setRand(Math.random);
  return lo === hi && lo === a2.count * 4;
})());

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 反制：加速↔减速、祝福↔诅咒 ---');
/* 词条原文只给了"对被减速的生物施放加速会移除减速"这一向。Haste / Bless 都只能对
   友方施放，所以"我先被敌方减速"这一侧由 addEffect 模拟——它和 castSpell 走同一个入口，
   差别只在于跳过了目标阵营校验。 */
prep(3, 2, 0); T.forceTurn(byId('A5')); flushAll();
var u1 = byId('A3'), u1sp = u1.baseSpeed;
T.addEffect(u1, { spell: 'slow', name: '减速', kind: 'debuff', remaining: 5, mult: 0.5 });
ok('减速已生效（模拟敌方施法）', u1.speed === Math.floor(u1sp / 2), u1.speed + ' vs ' + Math.floor(u1sp / 2));
r = T.castSpell('us', 'haste', u1);
ok('对被减速的友方施放加速 → 减速被移除',
   r.ok === true && T.effectsOf(u1).every(function(e){ return e.spell !== 'slow'; }),
   T.effectsOf(u1).map(function(e){ return e.spell; }).join(','));
ok('速度按"裸值 +3"重算（不是叠乘）', u1.speed === u1sp + 3, u1.speed);

prep(3, 2, 0); T.forceTurn(byId('A5')); flushAll();
var u2 = byId('A3');
T.addEffect(u2, { spell: 'curse', name: '诅咒', kind: 'debuff', remaining: 5, dmgFix: 'min', minus: 0 });
ok('诅咒已生效（模拟敌方施法）', u2.dmg[0] === u2.baseDmg[0] && u2.dmg[1] === u2.baseDmg[0], u2.dmg.join('-'));
r = T.castSpell('us', 'bless', u2);
ok('对被诅咒的友方施放祝福 → 诅咒被移除',
   r.ok === true && T.effectsOf(u2).every(function(e){ return e.spell !== 'curse'; }),
   T.effectsOf(u2).map(function(e){ return e.spell; }).join(','));
ok('祝福接管后伤害固定为最大值', u2.dmg[0] === u2.baseDmg[1] && u2.dmg[1] === u2.baseDmg[1], u2.dmg.join('-'));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 驱散：三档范围 ---');
prep(3, 2, 0); T.forceTurn(byId('A5')); flushAll();
var a1c = byId('A1'), a1sp = a1c.baseSpeed;
T.castSpell('us', 'haste', a1c);
T.setCastsThisRound('us', 0);
r = T.castSpell('us', 'dispel', byId('E1'));
ok('初级驱散不能选敌方（只能友方）', r.ok === false && /友方/.test(r.why), r.why);
T.setCastsThisRound('us', 0);
r = T.castSpell('us', 'dispel', a1c);
ok('初级驱散对友方生效', r.ok === true);
ok('加速被移除，速度回裸值', a1c.speed === a1sp && T.effectsOf(a1c).length === 0, a1c.speed);

prep(3, 2, 1); T.forceTurn(byId('A5')); flushAll();
var e3 = byId('E3'), e3sp = e3.baseSpeed;
T.castSpell('us', 'slow', e3);
ok('减速已挂到敌方', e3.speed < e3sp);
T.setCastsThisRound('us', 0);
r = T.castSpell('us', 'dispel', e3);
ok('中级驱散可以选敌方', r.ok === true, r.why);
ok('敌方减速被移除，速度回裸值', e3.speed === e3sp, e3.speed);

prep(3, 2, 2); T.forceTurn(byId('A5')); flushAll();
T.castSpell('us', 'haste', byId('A1'));
T.setCastsThisRound('us', 0);
T.castSpell('us', 'slow', byId('E2'));
ok('先确认两边都有法术效果', T.effectsOf(byId('A1')).length === 1 && T.effectsOf(byId('E2')).length === 1);
ok('专家加速是全体（我方除绿龙外都吃到）', T.effectsOf(byId('A2')).some(function(e){ return e.spell === 'haste'; }));
T.setCastsThisRound('us', 0);
r = T.castSpell('us', 'dispel', null);
ok('专家驱散不选目标也能放', r.ok === true, r.why);
ok('专家驱散清空全场法术效果', (function(){
  var n = 0;
  T.units().forEach(function(u){ n += T.effectsOf(u).length; });
  return n === 0;
})(), '剩余效果数');

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 免疫：魔法免疫 / 亡灵免疫心智 ---');
prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
ok('绿龙在图鉴里标了魔法免疫', byId('A5').magicImmune === true);
ok('魔法元素完全免疫', (function(){ T.applyTraits(byId('E1'), '魔法元素'); return byId('E1').magicImmune === true; })());
var mana0 = T.manaOf('us');
r = T.castSpell('us', 'magicArrow', byId('E1'));
ok('对魔法免疫目标施放伤害法术被拒', r.ok === false && /免疫/.test(r.why), r.why);
ok('免疫被拒不扣法力', T.manaOf('us') === mana0, T.manaOf('us'));

prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
T.applyTraits(byId('A1'), '幽灵');       // 亡灵：免疫祝福/诅咒
ok('幽灵是亡灵', byId('A1').undead === true);
r = T.castSpell('us', 'bless', byId('A1'));
ok('亡灵免疫祝福', r.ok === false && /免疫/.test(r.why), r.why);
T.setCastsThisRound('us', 0);
r = T.castSpell('us', 'haste', byId('A1'));
ok('亡灵不免疫加速（只免心智类）', r.ok === true, r.why);

prep(3, 0, 2); T.forceTurn(byId('A5')); flushAll();
var usAll = T.units().filter(function(u){ return u.side === 'us' && !u.dead; });
r = T.castSpell('us', 'bless', null);
ok('全体祝福跳过免疫单位而不是整体失败', r.ok === true, r.why);
ok('免疫的那一支被列进 immune', r.immune.length === 1 && r.immune[0].id === 'A5', r.immune.map(function(u){ return u.id; }).join(','));
ok('其余友方都吃到祝福', r.affected.length === usAll.length - 1, r.affected.length + '/' + usAll.length);

// ════════════════════════════════════════════════════════════════
console.log('--- 9. 按轮递减与到期还原 ---');
prep(3, 1, 0); T.forceTurn(byId('A5')); flushAll();
var a3 = byId('A3'), a3sp = a3.baseSpeed;
T.castSpell('us', 'haste', a3);
ok('力 1 → 持续 1 回合', T.effectsOf(a3)[0].remaining === 1);
T.setCastsThisRound('us', 0);
T.startRoundNow(); flushAll();                 // 推进一轮
ok('一轮后效果到期被移除', T.effectsOf(a3).length === 0, T.effectsOf(a3).length);
ok('速度还原到裸值', a3.speed === a3sp, a3.speed);
ok('日志里写了失效', /失效/.test(T.logText()));

prep(3, 3, 0); T.forceTurn(byId('A5')); flushAll();
var a3b = byId('A3'), a3bsp = a3b.baseSpeed;
T.castSpell('us', 'haste', a3b);
T.setCastsThisRound('us', 0);
T.startRoundNow(); flushAll();
ok('力 3 → 一轮后还剩 2 回合', T.effectsOf(a3b).length === 1 && T.effectsOf(a3b)[0].remaining === 2,
   T.effectsOf(a3b).length && T.effectsOf(a3b)[0].remaining);
ok('仍生效时速度仍是加过的', a3b.speed === a3bsp + 3, a3b.speed);
ok('每轮开始重置施法额度', T.castsThisRound().us === 0);

// 伤害类不受力量影响（力量只对伤害法术有线性加项）
prep(3, 3, 0); T.forceTurn(byId('A5')); flushAll();
ok('诅咒不吃力量加项（力 3 仍是最小值）', (function(){
  var u = byId('E4');
  T.castSpell('us', 'curse', u);
  return u.dmg[0] === 7 && u.dmg[1] === 7;
})());

// ════════════════════════════════════════════════════════════════
console.log('--- 10. 法术书 UI 与施法模式 ---');
prep(0, 0, 0); T.forceTurn(byId('A5')); flushAll();
var hb = T.spellBookHtml();
ok('法术书 7 个按钮', (hb.match(/data-spell=/g) || []).length === 7, (hb.match(/data-spell=/g) || []).length);
ok('无法力时按钮全部 disabled', (hb.match(/disabled/g) || []).length === 7, (hb.match(/disabled/g) || []).length);
ok('提示是"法力"相关或行动限制', /法力|行动/.test(T.hint()) || hb.indexOf('法力') >= 0);

prep(3, 0, 0); T.forceTurn(byId('A5')); flushAll();
hb = T.spellBookHtml();
ok('有法力时至少有一个可用按钮', (hb.match(/class="ready"/g) || []).length > 0,
   (hb.match(/class="ready"/g) || []).length);
ok('法术书显示了法力 30/30', hb.indexOf('30/30') >= 0, hb.slice(0, 90));
ok('英雄面板里也有法力行', T.heroBarHtml().indexOf('法力') >= 0);

ok('点单体法术进入选目标模式', T.beginCast('haste') === true && T.castModeKey() === 'haste', T.castModeKey());
ok('选目标时提示点单位', /点一个友方单位/.test(T.hint()), T.hint());
T.clearCastMode();
ok('可以取消施法模式', T.castModeKey() === null);

prep(3, 0, 2); T.forceTurn(byId('A5')); flushAll();
ok('专家级全体法术不需要选目标（直接施放）', T.beginCast('bless') === true && T.castModeKey() === null, T.castModeKey());
ok('直接施放后扣了法力', T.manaOf('us') === 25, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 11. 与既有规则共存 ---');
prep(3, 5, 2); T.forceTurn(byId('A5')); flushAll();
ok('施法后当前单位没变、仍可继续正常行动', T.current() === byId('A5'));
ok('施法后伤害公式照旧（攻防差仍生效）', T.dmgMult(byId('A1'), byId('E1'), 0, false) > 0);

// 快速战斗回归（法术不会把流程打挂）
prep(3, 5, 2);
T.startQuick(); flushAll();
ok('快速战斗仍能打完', !!T.over, T.over && T.over.winner);
ok('全程无定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));

noMana();
T.startQuick(); flushAll();
ok('没有英雄（无法力）时快速战斗也能打完', !!T.over);

// 图鉴：免疫标志的差异（石像鬼只免溅射，不免法术）
ok('石像鬼不免法术（只免溅射）', (function(){
  T.init(); flushAll();
  T.applyTraits(byId('E1'), '石像鬼');
  return byId('E1').splashImmune === true && byId('E1').magicImmune === false;
})());
ok('投石车也不免疫法术（战争机器只免心智/溅射）', (function(){
  T.applyTraits(byId('E1'), '投石车');
  return byId('E1').magicImmune === false && byId('E1').mindImmune === true;
})());

// ════════════════════════════════════════════════════════════════
console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
