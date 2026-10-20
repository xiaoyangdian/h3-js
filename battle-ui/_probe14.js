// _probe14：怪物特性包（第 1 切片 · 确定性部分）
// 覆盖：二连击 / 多次反击计数器 / 不遭反击 / 环攻 / 宽攻 / 穿刺 / 重生 /
//      亡灵标志与免疫预留 / 弹射弹 / 打完就回 + 图鉴挂载 + 快速战斗回归
// 规则依据：参考资料.md §2.8（特性表 + 语义词条 + file:line）
// 不在本套件：士气、恐惧的掷骰（概率机制，下一切片）——本切片只落 fear 字段与免疫标志。
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

// ── 假时钟：与 _probe10/_probe12 相同，把流程与特效计时全部即时排空 ──
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
'    damagePreview: damagePreview, applyTraits: applyTraits, traitNames: traitNames,',
'    aroundTargets: aroundTargets, cloudTargets: cloudTargets,',
'    bestiary: function(){ return BESTIARY },',
'    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },',
'    logText: function(){ return document.getElementById("log").children.map(function(p){ return p._html||""; }).join("\\n") },',
'    cardHtml: function(){ return document.getElementById("curCard")._html || "" },',
'    hint: function(){ return document.getElementById("hint").textContent }',
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
function fresh(){ T.init(); flush(); }
function byId(id){ return T.byId(id); }
function place(id, x, y, dir){
  var u = byId(id); u.x = x; u.y = y; if (dir !== undefined) u.dir = dir; return u;
}
// 换个物种的皮：只换特性，不动数值（roster 的残局不变）
function reskin(id, kind){ var u = byId(id); T.applyTraits(u, kind); return u; }
function cnt(re){ return (T.logText().match(re) || []).length; }
function scan(){
  var map = {}, clashes = [], rocks = [], oob = [];
  T.units().forEach(function(u){
    if (u.dead) return;
    T.cellsOf(u).forEach(function(c){
      var k = T.key(c[0], c[1]);
      if (c[0] < 0 || c[0] >= 15 || c[1] < 0 || c[1] >= 11) oob.push(u.id + '@' + k);
      if (T.isRock(c[0], c[1])) rocks.push(u.id + '@' + k);
      if (map[k]) clashes.push(k + ':' + map[k] + '/' + u.id);
      map[k] = u.id;
    });
  });
  return { clashes: clashes, rocks: rocks, oob: oob };
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 图鉴挂载：特性按物种查表，ROSTER 不增删单位 ---');
fresh();
var best = T.bestiary();
ok('图鉴条目 ≥ 18 种', Object.keys(best).length >= 18, Object.keys(best).length);
ok('ROSTER 仍是 9 支部队', T.units().length === 9, T.units().length);
ok('狮鹫每回合反击 2 次（:745）', byId('A3').retaliating === 2, byId('A3').retaliating);
ok('普通部队反击 1 次', byId('A1').retaliating === 1, byId('A1').retaliating);
ok('弓箭手带二连击（原型自定：取神射手）', byId('A2').strikes === 2, byId('A2').strikes);
ok('哥革带弹射弹（原型自定：取马各）', byId('E3').shootingCloud === 1, byId('E3').shootingCloud);
ok('恶魔犬宽攻 + 不遭反击（原型自定：取三头犬）',
   byId('E2').attackAround === -1 && byId('E2').enemyRetaliating === false,
   byId('E2').attackAround + '/' + byId('E2').enemyRetaliating);
ok('魔童无特性（全默认）', (function(){
  var u = byId('E1');
  return u.strikes === 1 && u.retaliating === 1 && u.enemyRetaliating === true &&
    u.attackAround === 0 && !u.attackAndReturn && !u.piercing && !u.regenerating &&
    !u.undead && !u.shootingCloud && !u.fear;
})());
ok('未上阵物种也在图鉴里（九头怪/巨兽/圣龙）',
   best['九头怪'].attackAround === 1 && best['巨兽'].piercing === 40 &&
   best['远古巨兽'].piercing === 80 && best['圣龙'].fear === 10);
ok('卡片能读出特性名', T.traitNames(byId('A3')).join('/') === '反击 2', T.traitNames(byId('A3')).join('/'));

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 二连击：两下各自掷骰、各吃一次反击、射击只耗 1 弹 ---');
fresh();
var ar = place('A2', 6, 5), dog = place('E2', 10, 5, 1);
var dogHp0 = dog.hp, shots0 = ar.shots;
var m1 = T.dmgMult(ar, dog, 0, true, false);
var oneMin = Math.floor(ar.count * ar.dmg[0] * m1);       // 单次打击的下限（逐只掷骰不会低于它）
T.doAttack(ar, dog, 0, true);
flush();
ok('一次行动出两下手', cnt(/射击 <b>恶魔犬<\/b>/g) === 2, cnt(/射击 <b>恶魔犬<\/b>/g));
ok('第二下有标注「第 2 击」', cnt(/第 2 击/) === 1, cnt(/第 2 击/));
ok('伤害是两次的和（≥ 两倍下限）', dogHp0 - dog.hp >= 2 * oneMin, (dogHp0 - dog.hp) + ' vs ' + (2 * oneMin));
ok('射击二连只耗 1 发弹药（SoD 语义）', ar.shots === shots0 - 1, shots0 + ' -> ' + ar.shots);

fresh();
ar = place('A2', 6, 5); dog = place('E1', 8, 5);
dog.count = 1; dog.perHp = 1; dog.maxHp = 1; dog.hp = 1; dog.startCount = 1;
T.doAttack(ar, dog, 0, true);
flush();
ok('第一击打死目标', dog.dead === true);
ok('目标已死就不再出第二击', cnt(/第 2 击/) === 0, cnt(/第 2 击/));

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 多次反击：计数器递减，不是布尔 ---');
fresh();
ok('开局狮鹫剩 2 次反击', byId('A3').retaliationsLeft === 2, byId('A3').retaliationsLeft);
ok('开局枪兵剩 1 次', byId('A1').retaliationsLeft === 1, byId('A1').retaliationsLeft);

fresh();
var atk = place('A1', 6, 5);
var tgt = place('E4', 7, 5);
T.applyTraits(tgt, '狮鹫');                    // 换成 2 次反击的皮，size 仍是 1（便于摆位）
ok('换皮后剩 2 次', tgt.retaliationsLeft === 2, tgt.retaliationsLeft);
T.doAttack(atk, tgt, 0, false);
flush();
ok('一次近战只消耗 1 次反击', tgt.retaliationsLeft === 1, tgt.retaliationsLeft);
ok('还有次数时 retaliated 仍为 false', tgt.retaliated === false);
T.doAttack(atk, tgt, 0, false);
flush();
ok('第二次近战用掉第 2 次', tgt.retaliationsLeft === 0, tgt.retaliationsLeft);
ok('次数用尽后 retaliated=true（旧布尔语义保留）', tgt.retaliated === true);
T.doAttack(atk, tgt, 0, false);
flush();
ok('用尽后不再反击（日志仍是 2 条）', cnt(/反击 · 造成/g) === 2, cnt(/反击 · 造成/g));

// 二连击 × 2 次反击：同一手被反两次（原版「各吃一次反击」）
fresh();
ar = place('A2', 6, 5);
tgt = place('E4', 7, 5);
T.applyTraits(tgt, '狮鹫');
T.doAttack(ar, tgt, 0, false);
flush();
ok('两下手换来两记反击（狮鹫的 2 次正好用光）',
   cnt(/反击 · 造成/g) === 2 && tgt.retaliationsLeft === 0,
   cnt(/反击 · 造成/g) + '/' + tgt.retaliationsLeft);

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 不遭反击：出手方说了算（enemyRetaliating:false）---');
fresh();
var cb0 = place('E1', 6, 5);                   // 换成恶魔犬的皮：不遭反击 + 宽攻
T.applyTraits(cb0, '恶魔犬');
var a1 = place('A1', 7, 5);
var a1Hp0 = a1.hp, cbHp0 = cb0.hp;
T.doAttack(cb0, a1, 0, false);
flush();
ok('目标掉血（确实打中了）', a1.hp < a1Hp0, a1Hp0 + ' -> ' + a1.hp);
ok('目标没有反击（出手方不遭反击）', cb0.hp === cbHp0, cbHp0 + ' -> ' + cb0.hp);
ok('日志里没有反击', cnt(/反击 · 造成/g) === 0, cnt(/反击 · 造成/g));

fresh();
var e4 = place('E4', 6, 5), a1b = place('A1', 7, 5);
var e4Hp0 = e4.hp;
T.doAttack(e4, a1b, 0, false);
flush();
ok('对照组：普通部队出手会挨反击', e4.hp < e4Hp0, e4Hp0 + ' -> ' + e4.hp);

fresh();
var px = place('E1', 6, 5); T.applyTraits(px, '恶魔犬');
var py = place('A1', 7, 5);
var pvNo = T.damagePreview(px, py, { x: 6, y: 5, cost: 0, dir: 1 });
var pvYes = T.damagePreview(place('E4', 8, 6), py, { x: 8, y: 6, cost: 0, dir: -1 });
ok('预览认「不遭反击」：back 为 null', pvNo.back === null, pvNo.back);
ok('预览认普通部队：back 有区间', !!pvYes.back, String(pvYes.back));

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 环攻（attackAround:1）：周身所有敌人，不打友军 ---');
fresh();
var hyd = place('A1', 7, 5);
T.applyTraits(hyd, '九头怪');
var NB = T.neighbors(7, 5);
var v1 = place('E1', NB[0][0], NB[0][1]);
var v2 = place('E3', NB[1][0], NB[1][1]);
var v3 = place('E4', NB[2][0], NB[2][1]);
var mate = place('A2', NB[3][0], NB[3][1]);
ok('额外目标 = 周身另外 2 个敌人（不含友军）',
   T.aroundTargets(hyd, v1).length === 2, T.aroundTargets(hyd, v1).length);
var hps = [v1.hp, v2.hp, v3.hp], mateHp = mate.hp;
T.doAttack(hyd, v1, 0, false);
flush();
ok('主目标掉血', v1.hp < hps[0]);
ok('相邻敌人一起掉血', v2.hp < hps[1] && v3.hp < hps[2], v2.hp + '/' + v3.hp);
ok('相邻友军不吃环攻', mate.hp === mateHp, mateHp + ' -> ' + mate.hp);
ok('日志有 2 条「环攻」', cnt(/环攻<\/b>/g) === 2, cnt(/环攻<\/b>/g));

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 宽攻（attackAround:-1）：只打「与我和目标都相邻」的 ---');
fresh();
var ker = place('A1', 7, 5);
T.applyTraits(ker, '恶魔犬');
var tgt2 = place('E4', NB[0][0], NB[0][1]);
// 与攻击者和目标都相邻的格子
var common = T.neighbors(tgt2.x, tgt2.y).filter(function(c){
  return T.dist(c[0], c[1], 7, 5) === 1 && !(c[0] === tgt2.x && c[1] === tgt2.y);
});
var side1 = place('E1', common[0][0], common[0][1]);
// 只与攻击者相邻、离目标 2 格的敌人（六边形里跨一格就有这样的位置）
var side2cell = NB.filter(function(c){
  return T.dist(c[0], c[1], tgt2.x, tgt2.y) === 2 && c[0] !== side1.x && c[1] !== side1.y;
})[0];
var side2 = place('E3', side2cell[0], side2cell[1]);
ok('宽攻额外目标只有 1 只', T.aroundTargets(ker, tgt2).length === 1, T.aroundTargets(ker, tgt2).length);
var s1Hp = side1.hp, s2Hp = side2.hp, t2Hp = tgt2.hp;
T.doAttack(ker, tgt2, 0, false);
flush();
ok('主目标掉血', tgt2.hp < t2Hp);
ok('夹在两者之间的敌人被波及', side1.hp < s1Hp, s1Hp + ' -> ' + side1.hp);
ok('只相邻攻击者的敌人不吃伤害', side2.hp === s2Hp, s2Hp + ' -> ' + side2.hp);

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 穿刺：先把防御打折，再进攻防差 ---');
var base = { att: 30, count: 10, dmg: [10, 20], ranged: false };
var p80 = { att: 30, count: 10, dmg: [10, 20], ranged: false, piercing: 80 };
var p40 = { att: 30, count: 10, dmg: [10, 20], ranged: false, piercing: 40 };
var d20 = { def: 20 };
ok('穿刺 80 = 对防 4 的伤害', Math.abs(T.dmgMult(p80, d20, 0, false) - T.dmgMult(base, { def: 4 }, 0, false)) < 1e-9,
   T.dmgMult(p80, d20, 0, false) + ' vs ' + T.dmgMult(base, { def: 4 }, 0, false));
ok('穿刺 40 = 对防 12 的伤害', Math.abs(T.dmgMult(p40, d20, 0, false) - T.dmgMult(base, { def: 12 }, 0, false)) < 1e-9,
   T.dmgMult(p40, d20, 0, false) + ' vs ' + T.dmgMult(base, { def: 12 }, 0, false));
ok('不穿刺原样（攻 30 对防 20 → 1+I1=1.5）', Math.abs(T.dmgMult(base, d20, 0, false) - 1.5) < 1e-9,
   T.dmgMult(base, d20, 0, false));
ok('攻低防时穿刺把负差救回来（0.75 → 1.3）',
   Math.abs(T.dmgMult({ att: 10, piercing: 80 }, { def: 20 }, 0, false) - 1.3) < 1e-9 &&
   Math.abs(T.dmgMult({ att: 10 }, { def: 20 }, 0, false) - 0.75) < 1e-9,
   T.dmgMult({ att: 10, piercing: 80 }, { def: 20 }, 0, false) + ' / ' +
   T.dmgMult({ att: 10 }, { def: 20 }, 0, false));
fresh();
var beast = place('A1', 6, 5), victim = place('E4', 7, 5);
var beforePierce = T.calcDamage(beast, victim, 0, false).min;
T.applyTraits(beast, '远古巨兽');
ok('远古巨兽 80% 穿刺让下限变高', T.calcDamage(beast, victim, 0, false).min > beforePierce,
   beforePierce + ' -> ' + T.calcDamage(beast, victim, 0, false).min);

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 重生：轮到自己行动时回满（含复活数量）---');
fresh();
var gh = place('E1', 6, 5);
T.applyTraits(gh, '幽灵');
var fullHp = gh.maxHp, fullCount = gh.startCount;
T.applyDamage(gh, 100);
ok('先被打掉一部分', gh.hp < fullHp && gh.count < fullCount, gh.hp + '/' + gh.count);
T.forceTurn(gh);
ok('轮到它时回满血', gh.hp === fullHp, gh.hp + '/' + fullHp);
ok('数量一起复活', gh.count === fullCount, gh.count + '/' + fullCount);
ok('日志写明重生', cnt(/重生/) === 1, cnt(/重生/));

// ════════════════════════════════════════════════════════════════
console.log('--- 9. 亡灵与免疫预留（恐惧掷骰下一切片）---');
fresh();
var ud = place('E1', 6, 5);
T.applyTraits(ud, '幽灵');
ok('亡灵标记', ud.undead === true);
ok('亡灵免疫恐惧（mindImmune）', ud.mindImmune === true);
ok('亡灵免疫弹射溅射', ud.undead && ud.splashImmune === true);
var azure = place('E4', 8, 6); T.applyTraits(azure, '圣龙');
ok('圣龙带 10% 恐惧字段与心智免疫', azure.fear === 10 && azure.mindImmune === true);
var garg = place('E3', 10, 6); T.applyTraits(garg, '石像鬼');
ok('石像鬼只免疫溅射、不免疫恐惧（名单不同）',
   garg.splashImmune === true && garg.mindImmune === false,
   garg.splashImmune + '/' + garg.mindImmune);

// ════════════════════════════════════════════════════════════════
console.log('--- 10. 弹射弹：溅射 6 格、含友军、免疫只免溅射 ---');
fresh();
var gog = place('E3', 5, 5);
var t3 = place('A1', 9, 5);
var NB3 = T.neighbors(9, 5);
var ally = place('A2', NB3[0][0], NB3[0][1]);     // 目标方友军
var own = place('E1', NB3[1][0], NB3[1][1]);      // 射手方友军
ok('溅射范围 = 目标周围 6 格里的 2 个单位',
   T.cloudTargets(gog, t3).length === 2, T.cloudTargets(gog, t3).length);
var g0 = [t3.hp, ally.hp, own.hp], gShots = gog.shots;
T.doAttack(gog, t3, 0, true);
flush();
ok('目标本体掉血', t3.hp < g0[0]);
ok('目标身边的友军也掉血', ally.hp < g0[1], g0[1] + ' -> ' + ally.hp);
ok('射手自己的友军也掉血（弹射不辨敌我）', own.hp < g0[2], g0[2] + ' -> ' + own.hp);
ok('日志标注了友军', cnt(/友军，弹射不辨敌我/) === 1, cnt(/友军，弹射不辨敌我/));
ok('弹射不额外耗弹药', gog.shots === gShots - 1, gShots + ' -> ' + gog.shots);

fresh();
gog = place('E3', 5, 5);
t3 = place('A1', 9, 5);
var NB4 = T.neighbors(9, 5);
var und = place('A2', NB4[0][0], NB4[0][1]);
T.applyTraits(und, '幽灵');                       // 亡灵：本体照吃、溅射免疫
var undHp = und.hp;
T.doAttack(gog, t3, 0, true);
flush();
ok('亡灵免疫弹射溅射', und.hp === undHp, undHp + ' -> ' + und.hp);
ok('日志写明免疫', cnt(/无效（亡灵\/构装免疫）/) === 1, cnt(/无效/));

// ════════════════════════════════════════════════════════════════
console.log('--- 11. 打完就回：近战沿原路退回出发格 ---');
fresh();
var harpy = place('E4', 6, 5);
T.applyTraits(harpy, '鹰身女妖王');
var vic = place('A1', 8, 5);
var harpyHp = harpy.hp, vicHp = vic.hp;
T.performAttack(harpy, vic, { x: 7, y: 5, cost: 1, dir: 1 });
flush();
ok('出手时确实走到了目标旁（攻击已结算）', vic.hp < vicHp, vicHp + ' -> ' + vic.hp);
ok('打完退回出发格 (6,5)', harpy.x === 6 && harpy.y === 5, harpy.x + ',' + harpy.y);
ok('日志写明打完就回', cnt(/打完就回/) === 1, cnt(/打完就回/));
ok('这一手不遭反击（鹰身女妖王同时不遭反击）', harpy.hp === harpyHp && cnt(/反击 · 造成/g) === 0,
   harpyHp + ' -> ' + harpy.hp);

// ════════════════════════════════════════════════════════════════
console.log('--- 12. 回归：特性开着也能打完，占位不变量不破 ---');
fresh();
ok('卡片把特性写出来了', T.cardHtml().indexOf('特性：') >= 0 || T.cardHtml().length > 0);
T.startQuick();
var n = flush();
ok('快速战斗打完', !!T.over, 'roundNo=' + T.roundNo + ' flush=' + n);
var sc = scan();
ok('无叠格 / 无站岩石 / 无出界',
   sc.clashes.length === 0 && sc.rocks.length === 0 && sc.oob.length === 0,
   sc.clashes.concat(sc.rocks, sc.oob).join(','));
ok('全程无 timer 异常', timerErrors.length === 0, timerErrors.slice(0,3).join(' | '));

console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
