// _probe18：法力经济（战役层）
// 覆盖：上限与翻倍收口 / 开战不补蓝 / 跨战斗保留 / 野外过夜 +1 / 城镇过夜回满 /
//      魔泉（每天一次）/ 魔法泉·魔法旋涡（翻倍、每周一次）/ 知识变更不白送蓝 / 面板补给行
// 规则依据：参考资料.md §2.10「法力经济」
//   出处：heroes.thelazy.net Spell Point / Magic Well / Magic Spring 词条原文
// 不在本套件：Mysticism 与 Intelligence 技能、加蓝神器（技能树/道具切片才做）
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

// ── 假时钟：与 _probe14…17 相同 ──
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
// 注入串与 _probe17 同形：法力经济的接口全部经 attachTestHooks 补挂进来
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

/* 重置英雄 + 开一局（知识 kn）。法力**不自动补**，要满蓝必须显式 setMana 或走补给 */
function fresh(kn){
  T.resetHeroes();
  if (kn) T.setHero('us', 'knowledge', kn);
  T.init(); flushAll();
}
/* 想测"开战不补蓝"，就得先造一个不满蓝的状态 */
function freshPartial(kn, m){
  T.resetHeroes();
  T.setHero('us', 'knowledge', kn);
  T.setMana('us', m);
  T.init(); flushAll();
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 上限与翻倍收口 ---');
fresh(4);
ok('上限 = 10 × 知识（4 → 40）', T.manaMax('us') === 40, T.manaMax('us'));
ok('翻倍收口 = 2 × 上限（40 → 80）', T.manaCeil('us') === 80, T.manaCeil('us'));
ok('setMana 可以超过上限、顶在翻倍收口', (function(){ T.setMana('us', 999); return T.manaOf('us') === 80; })(), T.manaOf('us'));
ok('周序号：第 1 天是第 1 周', T.weekOf(1) === 1);
ok('周序号：第 7 天仍是第 1 周', T.weekOf(7) === 1);
ok('周序号：第 8 天进第 2 周', T.weekOf(8) === 2);

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 战斗不回蓝（原版没有这条规则） ---');
freshPartial(3, 12);
ok('开战不补蓝：仍是 12/30', T.manaOf('us') === 12 && T.manaMax('us') === 30, T.manaOf('us') + '/' + T.manaMax('us'));

// 打一场（快速战斗，AI 不施法）→ 法力原封不动
T.startQuick(); flushAll();
ok('打完一场法力不变（12）', T.manaOf('us') === 12, T.manaOf('us'));
T.startManual(); T.setStepDelay(0); flushAll();     // startQuick 会把 wantQuick 留成 true，必须显式切回手动
ok('再开一局也不会回满（12）', T.manaOf('us') === 12, T.manaOf('us'));

// 战斗中扣的法力跨局保留
freshPartial(3, 30);
T.forceTurn(byId('A5')); flushAll();
var r = T.castSpell('us', 'magicArrow', byId('E1'));
ok('施法扣 5 点（30 → 25）', r.ok === true && T.manaOf('us') === 25, (r.why || '') + ' mana=' + T.manaOf('us'));
T.init(); flushAll();
ok('重开一局仍是 25（不补）', T.manaOf('us') === 25, T.manaOf('us'));

// 翻倍状态下开战：保留超上限的法力
T.setHero('us', 'knowledge', 4);
T.setMana('us', 80);
T.init(); flushAll();
ok('翻倍法力跨战斗保留（80/40）', T.manaOf('us') === 80 && T.manaMax('us') === 40, T.manaOf('us') + '/' + T.manaMax('us'));
T.setMana('us', 999);
T.setHero('us', 'knowledge', 2);                 // 上限降到 20 → 收口 40
ok('降知识时超上限的法力压回 2×上限（80 → 40）', T.manaOf('us') === 40, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 野外过夜：每天 +1 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.setHero('them', 'knowledge', 3);
T.setMana('us', 12); T.setMana('them', 12);
var d0 = T.campaign().day, rr = T.restDay('field');
ok('野外过夜返回 ok', rr.ok === true);
ok('我方 12 → 13（每天 1 点）', T.manaOf('us') === 13, T.manaOf('us'));
ok('敌方同样 +1（双方都过夜）', T.manaOf('them') === 13, T.manaOf('them'));
ok('天数 +1', T.campaign().day === d0 + 1, T.campaign().day);

T.setMana('us', 30);
T.restDay('field');
ok('到上限后不再增加（30 → 30）', T.manaOf('us') === 30, T.manaOf('us'));

T.resetHeroes(); T.setMana('us', 0);
T.restDay('field');
ok('知识 0（上限 0）时野外过夜仍是 0', T.manaOf('us') === 0, T.manaOf('us'));

T.setHero('us', 'knowledge', 4); T.setMana('us', 80);
T.restDay('field');
ok('翻倍（80）时野外过夜不增不减', T.manaOf('us') === 80, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 城镇过夜：回满 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.setHero('them', 'knowledge', 3);
T.setMana('us', 5); T.setMana('them', 5);
d0 = T.campaign().day;
T.restDay('town');
ok('城镇过夜回满（5 → 30）', T.manaOf('us') === 30, T.manaOf('us'));
ok('敌方同样回满', T.manaOf('them') === 30, T.manaOf('them'));
ok('城镇过夜也推进一天', T.campaign().day === d0 + 1, T.campaign().day);
T.setMana('us', 30);
T.restDay('town');
ok('已满时城镇过夜不动', T.manaOf('us') === 30, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 魔泉：回满，每个英雄每天一次 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.setMana('us', 3);
d0 = T.campaign().day;
var w1 = T.visitWell();
ok('魔泉回满（3 → 30）', w1.ok === true && T.manaOf('us') === 30, T.manaOf('us'));
ok('魔泉不推进天数', T.campaign().day === d0, T.campaign().day);
var w2 = T.visitWell();
ok('同一天第二次喝无效（词条：a second drink will not help）', w2.ok === false && /每天一次/.test(w2.why), w2.why);
ok('被拒的第二次不改天数', T.campaign().day === d0);
T.setMana('us', 3);
ok('被拒的那次也没有补蓝', T.manaOf('us') === 3, T.manaOf('us'));
T.restDay('field');
ok('过一天后可以再喝', T.visitWell().ok === true);

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 魔法泉 / 魔法旋涡：回满并翻倍，每周一次 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 4); T.setMana('us', 14);
T.setDay(3);
var s1 = T.visitSpring();
ok('词条原例：上限 40、剩 14 → 访问魔法泉后 80', s1.ok === true && T.manaOf('us') === 80, T.manaOf('us'));
ok('魔法泉不推进天数', T.campaign().day === 3, T.campaign().day);
var s2 = T.visitSpring();
ok('同一周第二次无效', s2.ok === false && /每周一次/.test(s2.why), s2.why);
T.setMana('us', 14);
var s2b = T.visitSpring('vortex');
ok('同一周里魔法旋涡也被拦（共用周额度）', s2b.ok === false && T.manaOf('us') === 14, s2b.why);
T.setDay(8);
var s3 = T.visitSpring('vortex');
ok('下一周旋涡可用（14 → 80）', s3.ok === true && T.manaOf('us') === 80, s3.why || T.manaOf('us'));
T.setDay(15);
T.resetHeroes();
ok('知识 0 时魔法泉不能凭空变蓝', T.visitSpring().ok === true && T.manaOf('us') === 0, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 改知识不白送蓝 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.setMana('us', 12);
T.setHero('us', 'knowledge', 5);
ok('非满蓝时提高知识：法力不变（12）', T.manaOf('us') === 12, T.manaOf('us'));
ok('但上限已抬到 50', T.manaMax('us') === 50, T.manaMax('us'));
T.setMana('us', 50);
T.setHero('us', 'knowledge', 6);
ok('满蓝时提高知识：跟着新上限满（60）', T.manaOf('us') === 60, T.manaOf('us'));
T.setMana('us', 20);
T.setHero('us', 'knowledge', 2);
ok('降低知识：法力仍在新上限内（20），不被动', T.manaOf('us') === 20 && T.manaMax('us') === 20, T.manaOf('us'));
T.setMana('us', 80);                              // 2 × 上限 20，收口在 40
T.setHero('us', 'knowledge', 1);
ok('翻倍态降低知识：跟着变成 2×新上限（40 → 20）', T.manaOf('us') === 20, T.manaOf('us'));
T.resetHeroes(); T.setMana('us', 0);
T.setHero('us', 'knowledge', 3);
ok('从知识 0 起步按新上限给满（面板重设英雄）', T.manaOf('us') === 30, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 面板补给行 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 4); T.setMana('us', 80);
T.setDay(9);
var hb = T.heroBarHtml();
ok('面板显示天数', hb.indexOf('第 <b>9</b> 天') >= 0, hb.slice(0, 80));
ok('面板有 4 个补给按钮', (hb.match(/data-rest=/g) || []).length === 4, (hb.match(/data-rest=/g) || []).length);
ok('四个按钮分别是 野外/城镇/魔泉/魔法泉',
   hb.indexOf('野外过夜') >= 0 && hb.indexOf('城镇过夜') >= 0 &&
   hb.indexOf('魔泉') >= 0 && hb.indexOf('魔法泉') >= 0);
ok('超上限时法力行标「翻倍」', hb.indexOf('（翻倍）') >= 0, hb.slice(hb.indexOf('法力'), hb.indexOf('法力') + 40));

// ════════════════════════════════════════════════════════════════
console.log('--- 9. 不变量 ---');
ok('全程无定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));
T.resetHeroes(); T.init(); flushAll();
ok('默认（知识 0、法力 0）仍能开一局', T.units().length === 9);
ok('补给函数不改战斗力（9 支部队不变）', T.units().length === 9);

console.log('---');
console.log((fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' 项通过 / ' + fail + ' 项失败');
process.exit(fail ? 1 : 0);
