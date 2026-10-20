// _probe16：士气 + 恐惧（第 1 切片的概率部分）
// 覆盖：rand 可注入 / 士气 N/24 与负值翻倍 / 亡灵与战争机器不掷 / 恐惧 10% 与免疫 /
//      坏士气冻结丢轮 / 好士气追加完整一次行动且只掷一次 / 与快速战斗共存
// 规则依据：参考资料.md §2.8（士气时机与概率、恐惧词条）
// 不在本套件：战术布阵（tactics 字段已就绪，布阵阶段未做）、魔法
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
// 注入串照旧不含 moraleRoll / setRand：新导出面由 init() 里的 attachTestHooks() 补挂
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
'    bestiary: function(){ return BESTIARY }, roster: function(){ return ROSTER },',
'    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },',
'    logText: function(){ return document.getElementById("log").children.map(function(p){ return p._html||""; }).join("\\n") },',
'    hint: function(){ return document.getElementById("hint").textContent }',
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
function fresh(){ T.resetHeroes(); T.setRand(null); T.init(); flush(); }
function cnt(re){ return (T.logText().match(re) || []).length; }
function constRand(v){ T.setRand(function(){ return v; }); }
function seqRand(list){
  var i = 0;
  T.setRand(function(){ var v = list[Math.min(i, list.length - 1)]; i++; return v; });
}
function reskin(id, kind){ var u = byId(id); T.applyTraits(u, kind); return u; }   // 换皮：只换特性不动数值

// ════════════════════════════════════════════════════════════════
console.log('--- 1. rand 入口可注入（规则随机不再直连 Math.random） ---');
fresh();
ok('__T.setRand 由补挂提供', typeof T.setRand === 'function');
ok('__T.moraleRoll 由补挂提供', typeof T.moraleRoll === 'function');
ok('__T.freezeCheck 由补挂提供', typeof T.freezeCheck === 'function');
constRand(0);
ok('setRand(0) → rand() 恒 0', T.rand() === 0, T.rand());
constRand(0.9999);
ok('setRand(0.9999) → 接近 1', T.rand() > 0.999, T.rand());
constRand(0);
ok('掷骰取下限：枪兵 60 只 ×1 = 60', T.rollBase(byId('A1')) === 60, T.rollBase(byId('A1')));
constRand(0.9999);
ok('掷骰取上限：枪兵 60 只 ×3 = 180', T.rollBase(byId('A1')) === 180, T.rollBase(byId('A1')));
ok('幸运：luck=3、rand=0.124 → 触发（floor(2.98)=2 < 3）',
   (constRand(0.124), T.rollLuck({ luck: 3 })) === true);
ok('幸运：luck=3、rand=0.125 → 不触发（floor(3)=3 不小于 3）',
   (constRand(0.125), T.rollLuck({ luck: 3 })) === false);
ok('幸运：luck=0 恒不触发', (constRand(0), T.rollLuck({ luck: 0 })) === false);
T.seedRand(42); var s1 = [T.rand(), T.rand(), T.rand()];
T.seedRand(42); var s2 = [T.rand(), T.rand(), T.rand()];
ok('同种子复现同一序列', s1.join(',') === s2.join(','), s1.join(',') + ' vs ' + s2.join(','));
T.seedRand(43); var s3 = [T.rand(), T.rand(), T.rand()];
ok('不同种子产生不同序列', s1.join(',') !== s3.join(','));
ok('种子可显式传入并返回归一值', typeof T.seedRand(7) === 'number' && T.seedRand(7) === 7, T.seedRand(7));
T.setRand(null);
var rv = T.rand();
ok('setRand(null) 恢复默认随机（落在 [0,1)）', rv >= 0 && rv < 1, rv);

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 士气概率：正 N/24，负值翻倍 ---');
fresh();
ok('士气 0 → 不掷', T.moraleRoll({ morale: 0 }) === null);
ok('+1 且 rand=0.04 → 好士气（0.96 < 1）',
   (constRand(0.04), T.moraleRoll({ morale: 1 })) === 'good');
ok('+1 且 rand=0.05 → 无事（1.2 ≥ 1）',
   (constRand(0.05), T.moraleRoll({ morale: 1 })) === null);
ok('+2 且 rand=0.08 → 好士气（1.92 < 2）',
   (constRand(0.08), T.moraleRoll({ morale: 2 })) === 'good');
ok('+3 且 rand=0.124 → 好士气（2.98 < 3）',
   (constRand(0.124), T.moraleRoll({ morale: 3 })) === 'good');
ok('+3 且 rand=0.125 → 无事（3 ≥ 3）',
   (constRand(0.125), T.moraleRoll({ morale: 3 })) === null);
ok('-1 且 rand=0.08 → 坏士气（翻倍到 2/24）',
   (constRand(0.08), T.moraleRoll({ morale: -1 })) === 'bad');
ok('-1 且 rand=0.09 → 无事（2.16 ≥ 2，说明确实翻倍了）',
   (constRand(0.09), T.moraleRoll({ morale: -1 })) === null);
ok('-2 且 rand=0.16 → 坏士气（3.84 < 4）',
   (constRand(0.16), T.moraleRoll({ morale: -2 })) === 'bad');
ok('-3 且 rand=0.24 → 坏士气（5.76 < 6）',
   (constRand(0.24), T.moraleRoll({ morale: -3 })) === 'bad');
ok('-3 且 rand=0.25 → 无事（6 ≥ 6）',
   (constRand(0.25), T.moraleRoll({ morale: -3 })) === null);
ok('亡灵不掷士气（morale=-3 也不）',
   (constRand(0), T.moraleRoll(reskin('E3', '幽灵'))) === null);
ok('战争机器不掷士气（投石车）',
   (constRand(0), T.moraleRoll(reskin('E2', '投石车'))) === null);
ok('死亡单位不掷', T.moraleRoll({ dead: true, morale: 3 }) === null);

console.log('--- 3. 概率量级：2400 次抽样贴近 N/24 ---');
fresh();
T.seedRand(2026);
var hitGood = 0;
for (var i = 0; i < 2400; i++) if (T.moraleRoll({ morale: 1 }) === 'good') hitGood++;
// 期望 100（1/24），4σ ≈ 39 → 宽松区间 55–150
ok('+1 命中率 ≈ 1/24（2400 次得 55–150）', hitGood >= 55 && hitGood <= 150, hitGood + '/2400');
T.seedRand(2027);
var hitBad = 0;
for (var j = 0; j < 2400; j++) if (T.moraleRoll({ morale: -1 }) === 'bad') hitBad++;
// 期望 200（2/24），4σ ≈ 54 → 宽松区间 120–280
ok('-1 命中率 ≈ 1/12（2400 次得 120–280，是 +1 的两倍档）', hitBad >= 120 && hitBad <= 280, hitBad + '/2400');

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 恐惧：圣龙在场，敌方回合开始 10% ---');
fresh();
var dragon = reskin('A5', '圣龙');
ok('圣龙带 fear=10', dragon.fear === 10, dragon.fear);
ok('圣龙自己免疫恐惧（mindImmune）', dragon.mindImmune === true);
ok('无圣龙时敌方不恐惧（rand=0 也不）', (function(){
  T.applyTraits(dragon, '绿龙');
  return (constRand(0), T.freezeCheck(byId('E1'))) === null;
})());
reskin('A5', '圣龙');
ok('有圣龙、rand=0.05 → 恐惧', (constRand(0.05), T.freezeCheck(byId('E1'))) === 'fear');
ok('有圣龙、rand=0.15 → 不恐惧（10% 上限）', (constRand(0.15), T.freezeCheck(byId('E1'))) === null);
ok('与圣龙数量无关：1 只时 rand=0.05 仍恐惧', (function(){
  dragon.count = 1; return (constRand(0.05), T.freezeCheck(byId('E1'))) === 'fear';
})());
ok('与圣龙数量无关：100 只时阈值不变（rand=0.15 不恐惧）', (function(){
  dragon.count = 100; return (constRand(0.15), T.freezeCheck(byId('E1'))) === null;
})());
dragon.count = 3;
ok('石魔像免疫恐惧', (constRand(0), T.freezeCheck(reskin('E2', '石魔像'))) === null);
ok('魔法元素免疫恐惧', (constRand(0), T.freezeCheck(reskin('E2', '魔法元素'))) === null);
ok('石像鬼只免疫溅射、**不**免疫恐惧', (constRand(0.05), T.freezeCheck(reskin('E2', '石像鬼'))) === 'fear');
ok('亡灵免疫恐惧', (constRand(0), T.freezeCheck(reskin('E4', '幽灵'))) === null);
ok('恐惧优先于坏士气（两者都满足时报 fear）', (function(){
  fresh(); reskin('A5', '圣龙');
  var e = byId('E1'); e.morale = -3;
  return (constRand(0), T.freezeCheck(e)) === 'fear';
})());
ok('我方不会被自己的圣龙吓到（只吓敌方）',
   (constRand(0.05), T.freezeCheck(byId('A1'))) === null);

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 坏士气：回合开始冻结，丢整轮 ---');
fresh();
var e1 = byId('E1');
e1.morale = -3;
constRand(0);                       // 必中：0 < 6/24
T.forceTurn(e1);
ok('冻结时没有开始行动（actsThisTurn 仍 0）', e1.actsThisTurn === 0, e1.actsThisTurn);
ok('日志出「恐慌」', cnt(/恐慌/) === 1, cnt(/恐慌/));
ok('冻结的话已进日志（含"失去本轮行动"）', cnt(/失去本轮行动/) === 1);
ok('队列还没推进（仍停在该单位）', T.current() === e1);

fresh();
var e1b = byId('E1');
e1b.morale = -3;
constRand(0.9);                     // 0.9*24=21.6 ≥ 6 → 不中
T.forceTurn(e1b);
ok('没掷中时正常开始这一手（actsThisTurn=1）', e1b.actsThisTurn === 1, e1b.actsThisTurn);
ok('没掷中不写恐慌日志', cnt(/恐慌/) === 0);

fresh();
var ghost = reskin('E3', '幽灵');
ghost.morale = -3;
constRand(0);
T.forceTurn(ghost);
ok('亡灵即便士气 -3 也不冻结', ghost.actsThisTurn === 1, ghost.actsThisTurn);
ok('亡灵不写恐慌日志', cnt(/恐慌/) === 0);

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 好士气：行动后追加一次完整行动，且只掷一次 ---');
fresh();
var a1 = byId('A1');
T.setHero('us', 'morale', 3);
ok('英雄士气 3 已摊到单位上', a1.morale === 3, a1.morale);
constRand(0);                       // freezeCheck 与 endActor 都必中
T.forceTurn(a1);
ok('回合开始不冻结（+3 只掷好士气）', a1.actsThisTurn === 1, a1.actsThisTurn);
T.setMoved(true);                   // 假装这一手已经移动过 —— 否则下一条断言没有区分度
ok('前置：hasMoved 已被置为真', T.moved() === true);
T.endActor();                       // 模拟这一手结束
ok('掷中好士气 → actsThisTurn 变 2', a1.actsThisTurn === 2, a1.actsThisTurn);
ok('队列没前进，还是这个单位', T.current() === a1);
ok('日志出「士气高涨」', cnt(/士气高涨/) === 1, cnt(/士气高涨/));
ok('追加的是完整一手：hasMoved 复位且重新选中该单位', T.moved() === false && T.selectedUnit() === a1,
   'hasMoved=' + T.moved() + ' selected=' + (T.selectedUnit() && T.selectedUnit().id));
ok('追加行动不重置反击额度（被动能力按回合计）', (function(){
  var g = byId('A3'); g.retaliationsLeft = 1;
  g.morale = 3; constRand(0);
  T.forceTurn(g); T.endActor();
  return g.actsThisTurn === 2 && g.retaliationsLeft === 1;
})(), byId('A3').retaliationsLeft);
T.endActor();                       // 追加行动也结束 → 此时不该再追加
ok('追加行动结束后不再掷（全流程只出现一次「士气高涨」）', cnt(/士气高涨/) === 1, cnt(/士气高涨/));

fresh();
var a2 = byId('A1');
T.setHero('us', 'morale', 3);
constRand(0.9);                     // 不中
T.forceTurn(a2);
T.endActor();
ok('没掷中好士气 → 不追加，正常推进', a2.actsThisTurn === 1 && cnt(/士气高涨/) === 0,
   a2.actsThisTurn + '/' + cnt(/士气高涨/));

fresh();
var und = reskin('E3', '幽灵');
und.morale = 3;
constRand(0);
T.forceTurn(und);
T.endActor();
ok('亡灵有好士气也不追加', cnt(/士气高涨/) === 0, cnt(/士气高涨/));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 与快速战斗共存：追加行动不会卡死流程 ---');
fresh();
T.setHero('us', 'morale', 2);
T.setHero('them', 'morale', -2);
T.seedRand(999);                    // 真随机序列，但可复现
T.startQuick();
flush();
ok('士气生效时快速战斗仍能打完', !!T.over, T.over && T.over.winner);
ok('全程无定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));
ok('战斗回合数合理（未因追加行动打转）', T.roundNo < 50, T.roundNo);
var withMoraleRounds = T.roundNo;

fresh();                            // fresh 内部会 resetHeroes：这是"无士气"对照局
T.seedRand(999);
T.startQuick(); flush();
ok('无士气对照局也能打完', !!T.over, T.over && T.over.winner);
ok('同种子下回合数同量级（士气没让战斗异常拖长）',
   Math.abs(T.roundNo - withMoraleRounds) <= 20, T.roundNo + ' vs ' + withMoraleRounds);

// ════════════════════════════════════════════════════════════════
console.log('');
console.log((fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
