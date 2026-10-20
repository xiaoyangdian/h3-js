// _probe22：悬停信息窗（鼠标扫过部队时的小卡）
// 覆盖：
//   1) 骨架：DOM 里真有 #unitTip，默认隐藏，.show 才显示，不拦鼠标
//   2) 字段齐全：攻 / 防 / 速 / 伤 / 数量 / 生命 / 最后一只
//   3) 「最后一只」口径：hp − (数量−1) × 单只血量，含整只、残血、刚掉一只三种边界
//   4) 弹药只在远程单位出现；耗尽要说"弹药尽"
//   5) 身上魔法：无 / 加速 N 回合 / 减速 / 到期与驱散后回到"无"
//   6) 显隐：show / hide / 阵亡单位 / 战斗结束 / 换局；refresh 跟着掉血更新
//   7) 纯读：开窗关窗不动战场状态
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
Object.defineProperty(El.prototype,'offsetHeight',{get:function(){return 0;}});
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
'    current: current, get over(){ return over }, get order(){ return order },',
'    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },',
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
function tip(){ return T.tipText(); }
function fresh(){
  T.resetHeroes();                       // 无英雄：数值就是 ROSTER 裸值，断言好算
  T.startManual(); flush();
  T.hideUnitTip();
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 骨架：窗在 DOM 里、默认藏、不拦鼠标 ---');
ok('index.html 有 #unitTip', html.indexOf('id="unitTip"') > 0);
ok('单位的事件挂在 g.unit 上（mouseenter → 开窗）',
   /addEventListener\("mouseenter", function\(ev\)\{ hoverPreview\(u\); showUnitTip\(u, ev\); \}\)/.test(html));
ok('mouseleave 同时关窗', /addEventListener\("mouseleave", function\(\)\{ hoverPreview\(null\); hideUnitTip\(\); \}\)/.test(html));
ok('默认 display:none，.show 才 display:block',
   /\.unitip\{[^}]*display:none/.test(html) && /\.unitip\.show\{display:block\}/.test(html));
ok('pointer-events:none（不挡下面的格子和单位）', /\.unitip\{[^}]*pointer-events:none/.test(html));
ok('固定定位、跟着指针走', /\.unitip\{[^}]*position:fixed/.test(html));
ok('初始不显示', T.tipVisible() === false);

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 字段齐全：攻 / 防 / 速 / 伤 / 数量 / 生命 ---');
fresh();
var a1 = byId('A1');                       // 枪兵 60 只 × 10 血，攻 4 防 5 速 4 伤 1–3
T.showUnitTip(a1);
var t1 = tip();
ok('扫过就显示', T.tipVisible() === true && T.tipUnit() === a1);
ok('有名字', t1.indexOf('枪兵') === 0, t1.slice(0, 20));
ok('标了阵营（我方）', t1.indexOf('我方') > 0);
ok('有数量 × 60', t1.indexOf('× 60') > 0, t1);
ok('攻击力 4', /攻 4\b/.test(t1), t1);
ok('防御力 5', /防 5\b/.test(t1), t1);
ok('速度 4', /速 4\b/.test(t1), t1);
ok('伤害 1–3', t1.indexOf('1–3') > 0, t1);
ok('生命 600/600', t1.indexOf('生命 600/600') > 0, t1);
ok('带"最后一只"', t1.indexOf('最后一只 10/10') > 0, t1);
ok('近战单位不显示弹药', t1.indexOf('弹') < 0, t1);
ok('没中魔法时明说"身上魔法：无"', t1.indexOf('身上魔法：无') > 0, t1);

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 「最后一只」口径 = hp − (数量−1) × 单只血量 ---');
fresh();
var u = byId('A1');
u.hp = 588; u.count = Math.ceil(u.hp / u.perHp);        // 58 只满血 + 第 59 只 8 血
T.showUnitTip(u);
ok('588 → 59 只、最后一只 8/10',
   T.lastCreatureHp(u) === 8 && tip().indexOf('× 59') > 0 && tip().indexOf('最后一只 8/10') > 0, tip());
u.hp = 580; u.count = 58;
ok('整只血量 → 最后一只满血 10/10', T.lastCreatureHp(u) === 10 && /最后一只 10\/10/.test(T.unitTipHtml(u)));
u.hp = 595; u.count = 60;
ok('第一只残血 → 最后一只仍是 5/10', T.lastCreatureHp(u) === 5, T.lastCreatureHp(u));
u.hp = 10; u.count = 1;
ok('只剩 1 只 → 就是它自己的血', T.lastCreatureHp(u) === 10);
u.hp = 1; u.count = 1;
ok('1 血不四舍五入成 0', T.lastCreatureHp(u) === 1);
ok('单只血量缺失时退化成总血（不 NaN）',
   T.lastCreatureHp({ hp: 7, count: 3, perHp: 0 }) === 7);
ok('总血夹在 0（不出现负数）', T.lastCreatureHp({ hp: 0, count: 1, perHp: 10 }) === 0);

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 弹药：只有远程才有 ---');
fresh();
var a2 = byId('A2');                        // 弓箭手 12 发
T.showUnitTip(a2);
ok('弓手有弹 12/12', /弹 12\/12/.test(tip()), tip());
ok('标"远程"', tip().indexOf('远程') > 0);
a2.shots = 5; T.showUnitTip(a2);
ok('剩 5 发给 5/12', /弹 5\/12/.test(tip()), tip());
a2.shots = 0; T.showUnitTip(a2);
ok('弹药尽写着"弹药尽·近战"', /弹 0\/12/.test(tip()) && tip().indexOf('弹药尽') > 0, tip());
var e3 = byId('E3');                        // 敌方哥革也是远程
T.showUnitTip(e3);
ok('敌方远程也有弹', /弹 12\/12/.test(tip()) && tip().indexOf('敌方') > 0, tip());
T.showUnitTip(byId('A5'));                  // 绿龙近战
ok('近战（龙）没有弹药行', tip().indexOf('弹') < 0, tip());

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 身上魔法：名字 + 剩余回合 ---');
fresh();
T.setHero('us', 'knowledge', 3);             // 30 点法力（resetHeroes 把知识清成 0 了）
T.setHero('us', 'spellpower', 3);            // 持续 = 力量 = 3 回合
T.forceTurn(byId('A5')); flush();
var r = T.castSpell('us', 'haste', byId('A1'));
ok('给枪兵放了加速', r.ok === true, r.why);
T.showUnitTip(byId('A1'));
ok('显示"加速 3 回合"', /加速 3 回合/.test(tip()), tip());
ok('加速后速度跟着变（4 → 7）', /速 7\b/.test(tip()), tip());
byId('A1').effects[0].remaining = 1;
T.refreshUnitTip();
ok('剩 1 回合时窗口跟着改', /加速 1 回合/.test(tip()), tip());
// 敌方减速：把窗口切到敌方单位看 debuff
T.setCastsThisRound('us', 0);
T.forceTurn(byId('A5')); flush();
var r2 = T.castSpell('us', 'slow', byId('E1'));
ok('给魔童放了减速', r2.ok === true, r2.why);
T.showUnitTip(byId('E1'));
ok('减速也列在"身上魔法"里', /减速 \d 回合/.test(tip()), tip());
ok('减速后速度写的是实际值（5 → 3）', /速 3\b/.test(tip()), tip());
var r3 = T.castSpell('us', 'dispel', byId('E1'));   // 初级驱散只能点友方 → 应被拒
ok('初级驱散点敌方被拒（不会误用窗口）', r3.ok === false, r3.why);

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 显隐与刷新 ---');
fresh();
T.showUnitTip(byId('A1'));
ok('开窗后可见', T.tipVisible() === true);
T.hideUnitTip();
ok('关窗后不可见', T.tipVisible() === false && T.tipUnit() === null);
ok('关窗不清内容（下次开窗不会被空串糊住）', tip().length > 0);
var dead = byId('E1');
dead.dead = true;
ok('扫到已阵亡单位 → 不开窗', T.showUnitTip(dead) === null && T.tipVisible() === false);
dead.dead = false;
T.showUnitTip(byId('E4'));
ok('开着窗再扫另一支 → 内容换成新单位', tip().indexOf('长角魔') === 0, tip().slice(0, 12));
var e4 = byId('E4');
var before = tip();
e4.hp -= 110; e4.count = Math.ceil(e4.hp / e4.perHp);   // 掉一只
T.refreshUnitTip();
ok('掉一只后总数从 6 变 5', before.indexOf('× 6') > 0 && tip().indexOf('× 5') > 0, tip());
e4.dead = true;
T.refreshUnitTip();
ok('窗里的单位死了 → 自动收起', T.tipVisible() === false && T.tipUnit() === null);

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 纯读：开窗关窗不动战场 ---');
fresh();
var cur0 = T.current().id, hp0 = byId('A1').hp, n0 = T.order.length;
T.showUnitTip(byId('E1'));
T.hideUnitTip();
ok('当前行动没变', T.current().id === cur0);
ok('血量没变', byId('A1').hp === hp0);
ok('行动队列没变', T.order.length === n0);
ok('没写日志/提示（不抢 hint）', T.hint().indexOf('长角魔') < 0, T.hint());
T.showUnitTip(byId('A1'));
T.init(); flush();
ok('重开一局会把窗收起来', T.tipVisible() === false);

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 防御中 / 特性行 ---');
fresh();
byId('A1').defending = true;
T.showUnitTip(byId('A1'));
ok('防御中给标签', tip().indexOf('防御中') > 0, tip());
T.showUnitTip(byId('A5'));                   // 绿龙：龙息 + 魔法免疫
ok('特性行列出龙息/魔法免疫', /特性：/.test(tip()) && tip().indexOf('魔法免疫') > 0, tip());

ok('全程无 timer 异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));
console.log('');
console.log((fail === 0 ? 'ALL PASS' : 'HAS FAIL') + '  ' + pass + ' 项通过 / ' + fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
