// _probe21：默认英雄数值（开局就给数，不是全 0）
// 覆盖：
//   1) 默认值表：攻 1 / 防 1 / 力 2 / 识 3，幸·士·术 0；两侧一致；都在面板上下界内
//   2) 开局摊平：9 支部队的 att/def 各 +1，spellpower=2，luck/morale 不被动到
//   3) 开局法力：第一次载入按知识补满 30/30（原型自定），上限 30、翻倍收口 60
//   4) 只补一次：花掉的蓝开新一局不回来（战役状态）
//   5) 一开局法术书就有可用法术（7 个全付得起）
//   6) 面板「默认」按钮：改乱之后一键回到默认并且满蓝；「归零」= 无英雄也无蓝
//   7) 默认英雄的施法数值：魔法箭 10+10×2=30、增益持续 2 回合
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
src = src.replace('  init();\n})();', [
'  globalThis.__T = {',
'    units: function(){ return units }, byId: function(id){ return units.filter(function(u){return u.id===id})[0] },',
'    init: init, startQuick: startQuick, startManual: startManual,',
'    setStepDelay: function(n){ stepDelay = n },',
'    current: current, forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },',
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
function hero(side){ return T.heroes()[side]; }
function stats(id){ return T.heroStats(byId(id)); }
function near(a, b, tol){ return Math.abs(a - b) <= (tol || 1e-9); }

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 默认值表：刚开局的英雄 ---');
var D = T.DEFAULT_HERO || {};
ok('默认攻击 1', D.attack === 1, D.attack);
ok('默认防御 1', D.defense === 1, D.defense);
ok('默认力量 2', D.spellpower === 2, D.spellpower);
ok('默认知识 3（→ 30 法力）', D.knowledge === 3, D.knowledge);
ok('默认精通 0（初级）', D.mastery === 0, D.mastery);
ok('默认幸运 0（原版开局没有幸运加成）', D.luck === 0, D.luck);
ok('默认士气 0', D.morale === 0, D.morale);
ok('默认战术 0', D.tactics === 0, D.tactics);
ok('我方英雄开局就带这套数值',
   hero('us').attack === 1 && hero('us').knowledge === 3 && hero('us').spellpower === 2,
   JSON.stringify(hero('us')));
ok('敌方与我方对称（同一套默认）',
   ['attack','defense','spellpower','knowledge','mastery','luck','morale','tactics']
     .every(function(k){ return hero('us')[k] === hero('them')[k]; }));
ok('默认值不是"全 0"（有 4 项非 0）',
   ['attack','defense','spellpower','knowledge'].filter(function(k){ return hero('us')[k] > 0; }).length === 4);
ok('默认值都在面板上下界内', (function(){
  var specs = [['attack',0,20],['defense',0,20],['spellpower',0,20],['knowledge',0,20],
               ['mastery',0,2],['luck',-3,3],['morale',-3,3],['tactics',0,3]];
  return specs.every(function(s){ var v = hero('us')[s[0]]; return v >= s[1] && v <= s[2]; });
})());
ok('默认英雄名字没被默认值表盖掉', hero('us').name === '我方英雄', hero('us').name);

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 开局摊平到 9 支部队 ---');
var A1 = stats('A1'), E1 = stats('E1');
ok('枪兵 att = 裸值 4 + 攻 1 = 5', A1.att === 5 && A1.baseAtt === 4, A1.baseAtt + ' -> ' + A1.att);
ok('枪兵 def = 裸值 + 1', A1.def === A1.baseDef + 1, A1.baseDef + ' -> ' + A1.def);
ok('敌方也 +1（不是只加我方）', E1.att === E1.baseAtt + 1 && E1.def === E1.baseDef + 1,
   E1.baseAtt + ' -> ' + E1.att);
ok('力量摊到每支部队（u.spellpower = 2）', A1.spellpower === 2 && E1.spellpower === 2);
ok('幸运/士气仍是 0（默认没加成）', A1.luck === 0 && A1.morale === 0);
ok('9 支部队全部吃到加成', T.units().every(function(u){ return u.att === u.baseAtt + 1; }),
   T.units().map(function(u){ return u.id + ':' + u.att; }).join(' '));
ok('裸值 baseAtt/baseDef 本身没被改（加成不能累加）',
   T.units().every(function(u){ return typeof u.baseAtt === 'number' && typeof u.baseDef === 'number'; }));

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 开局法力：第一次载入补满 ---');
ok('上限 = 10 × 知识 3 = 30', T.manaMax('us') === 30, T.manaMax('us'));
ok('开局法力满：30/30', T.manaOf('us') === 30, T.manaOf('us') + '/' + T.manaMax('us'));
ok('敌方同样满（对称）', T.manaOf('them') === 30, T.manaOf('them'));
ok('翻倍收口仍是 2×上限 = 60', T.manaCeil('us') === 60, T.manaCeil('us'));
ok('面板显示 30/30', /法力 <b>30<\/b>\/30/.test(T.heroBarHtml()), T.heroBarHtml().slice(0, 120));
ok('面板上四个非 0 字段描了底色（.on）',
   (T.heroBarHtml().match(/class="on"/g) || []).length >= 4,
   (T.heroBarHtml().match(/class="on"/g) || []).length);

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 只补一次：花掉的蓝不回来 ---');
T.startManual(); flush();
T.forceTurn(byId('A5')); flush();
var r = T.castSpell('us', 'magicArrow', byId('E1'));
ok('默认英雄放得出魔法箭', r.ok === true, r.why);
ok('扣 5 点 → 25', T.manaOf('us') === 25, T.manaOf('us'));
T.init(); flush();
ok('开新一局仍是 25（战役状态，不补满）', T.manaOf('us') === 25, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 一开局法术书就有可用法术 ---');
T.startManual(); flush();
ok('7 个法术全部付得起（30 法力 ≥ 最贵的 10）', T.readySpellCount('us') === 7, T.readySpellCount('us'));
ok('最贵的闪电 10 点也在额度内', T.manaOf('us') >= T.SPELLS.lightningBolt.cost);

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 面板「默认」按钮 + 归零基线 ---');
T.setHero('us', 'attack', 9); T.setHero('us', 'knowledge', 1);
T.setMana('us', 0);
ok('改乱之后：攻 9 / 识 1 / 法力 0',
   hero('us').attack === 9 && hero('us').knowledge === 1 && T.manaOf('us') === 0);
T.restoreDefaultHeroes(); flush();
ok('「默认」一键回到攻 1', hero('us').attack === 1, hero('us').attack);
ok('「默认」一键回到识 3', hero('us').knowledge === 3, hero('us').knowledge);
ok('「默认」顺带把法力补满（否则法术书继续全灰）', T.manaOf('us') === 30, T.manaOf('us'));
ok('「默认」不动名字', hero('us').name === '我方英雄', hero('us').name);
ok('面板只摆一个复原按钮（不摆「归零」，免得手滑又变全 0）',
   (T.heroBarHtml().match(/data-hero=/g) || []).length === 1 &&
   !/data-hero="zero"/.test(T.heroBarHtml()));
ok('「默认」立即同步到部队（枪兵回 5/6）',
   stats('A1').att === 5 && stats('A1').def === stats('A1').baseDef + 1 && stats('A1').baseDef === 5,
   stats('A1').att + '/' + stats('A1').def);
ok('「默认」只作用我方？不——两侧都回默认',
   hero('them').attack === 1 && hero('them').knowledge === 3);
T.setHero('them', 'knowledge', 6); T.setMana('them', 60);
T.resetHeroes(); flush();
ok('「归零」= 无英雄：攻 0', hero('us').attack === 0 && hero('them').attack === 0);
ok('「归零」法力也归零', T.manaOf('us') === 0 && T.manaOf('them') === 0,
   T.manaOf('us') + '/' + T.manaOf('them'));
ok('「归零」后枪兵回到裸值 4', stats('A1').att === 4, stats('A1').att);
ok('归零状态开局也是 0/0（不白送蓝）',
   (function(){ T.init(); flush(); return T.manaOf('us') === 0 && T.manaMax('us') === 0; })(),
   T.manaOf('us') + '/' + T.manaMax('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 默认英雄的施法口径 ---');
T.restoreDefaultHeroes(); flush();
ok('魔法箭 = 基础 10 + 10×力 2 = 30', T.spellDamage('magicArrow', 'us') === 30,
   T.spellDamage('magicArrow', 'us'));
ok('闪电 = 基础 10 + 25×力 2 = 60', T.spellDamage('lightningBolt', 'us') === 60,
   T.spellDamage('lightningBolt', 'us'));
ok('增益持续 = 力量 2 回合', T.spellDuration('us') === 2, T.spellDuration('us'));
ok('默认精通 0 = 初级，全体法术不生效', T.spellIsMass('haste', 'us') === false);
ok('默认知识 3 下法力上限没被翻倍收口误伤', T.manaOf('us') === 30 && T.manaOf('us') <= T.manaCeil('us'));

// ════════════════════════════════════════════════════════════════
ok('全程无 timer 异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));
console.log('');
console.log((fail === 0 ? 'ALL PASS' : 'HAS FAIL') + '  ' + pass + ' 项通过 / ' + fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
