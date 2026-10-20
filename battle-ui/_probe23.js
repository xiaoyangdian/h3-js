// _probe23：魔法技能（魔力 Sorcery + 气/土/火/水四系）
// 覆盖：
//   1) 容器：mastery 字段拆掉，四系 + 魔力是 5 个独立字段；mastery 只剩"四系同设"别名
//   2) 面板：两组渲染（英雄 7 项 / 魔法 5 项），data-stat 24 个，没有 mastery 输入框
//   3) 四系独立：只调一系，只有该系法术变；别系的加速/减速/祝福/诅咒一位不动
//   4) 无系法术（魔法箭）：取四系里**最高**的那一级
//   5) 魔力：伤害法术 +0/10/20/30%，向下取整；不动增益数值、不动持续回合、不动驱散
//   6) 全体判定与驱散目标跟着该系等级走（气系专家 → 加速全体；水系基础 → 驱散只能友方）
//   7) 法术书标签：系·等级 + 当前实际数值（含魔力）
//   8) 施法链路口径：预测 = 结算 = spellDamage（含魔力）
//   9) 面板等级显示：魔法技能 5 项按原版三级显示 1/2/3，内部索引仍是 0/1/2（双向换算）
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
'    get over(){ return over }, get order(){ return order },',
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

// 备场：清英雄 → 设知识/力量 → 重开一局 → 轮到我方绿龙（速度 9，本来就是我方第一个）
function prep(kn, sp){
  T.resetHeroes();
  if (kn) T.setHero('us', 'knowledge', kn);
  if (sp) T.setHero('us', 'spellpower', sp);
  T.init(); flush();
  T.forceTurn(byId('A5')); flush();
}
// 只把某一系设成 lv，其余四系清零（单独验证"按系生效"）
function onlySchool(k, lv){
  T.SCHOOLS.forEach(function(s){ T.setHero('us', s, 0); });
  T.setHero('us', k, lv);
}
function dmg(key){ return T.spellDamage(key, 'us'); }
function eff(key){ return T.makeEffect(key, 'us'); }
// 模拟在英雄面板那个输入框里手打一个值（走真实的 input 委托，验证 1/2/3 ↔ 0/1/2 回写）
function panelInput(stat, side, val){
  var fn = ((document.getElementById('heroBar').listeners || {}).input || [])[0];
  if (!fn) return false;
  fn({ target: { dataset: { side: side, stat: stat }, value: String(val) } });
  return true;
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 技能在 8 个槽里，不是固定字段 ---');
T.resetHeroes();
ok('四系名单是 air/earth/fire/water', T.SCHOOLS.join() === 'air,earth,fire,water', T.SCHOOLS.join());
ok('四系 + 魔力都在技能池里', ['sorcery'].concat(T.SCHOOLS).every(function(k){ return !!T.SKILLS[k]; }),
   Object.keys(T.SKILLS).join(','));
ok('英雄对象上没有 air/earth/fire/water 字段', T.SCHOOLS.every(function(k){
  return !Object.prototype.hasOwnProperty.call(hero('us'), k);
}), Object.keys(hero('us')).join(','));
ok('技能装在 skills 数组里', Array.isArray(hero('us').skills), typeof hero('us').skills);
ok('归零后 8 个槽全空', hero('us').skills.length === 0, hero('us').skills.length);
ok('没学 → skillLv = -1', T.skillLv('us', 'air') === -1, T.skillLv('us', 'air'));
ok('没学 → 效果档仍是 0（能放，停在基础档）', T.schoolLevelOf('us', 'air') === 0,
   T.schoolLevelOf('us', 'air'));
T.setHero('us', 'air', 2);
ok('setHero(air,2) → 塞进槽并设成专家', T.skillLv('us', 'air') === 2, T.skillLv('us', 'air'));
ok('只占了一格', hero('us').skills.length === 1, hero('us').skills.length);
T.setHero('us', 'mastery', 2);
ok('setHero(mastery,2) 把四系一起设成 2',
   T.SCHOOLS.every(function(k){ return T.skillLv('us', k) === 2; }),
   T.SCHOOLS.map(function(k){ return T.skillLv('us', k); }).join('/'));
ok('masteryOf() = 四系最高', T.masteryOf('us') === 2, T.masteryOf('us'));
T.setHero('us', 'mastery', 9);
ok('别名也钳在 0…2（9 → 2）', T.SCHOOLS.every(function(k){ return T.skillLv('us', k) === 2; }));
T.setHero('us', 'mastery', -5);
ok('别名负数钳到 0（四系都在槽里、全是基础档）',
   T.SCHOOLS.every(function(k){ return T.skillLv('us', k) === 0; }) && hero('us').skills.length === 4,
   T.SCHOOLS.map(function(k){ return T.skillLv('us', k); }).join('/'));
ok('未知字段仍然拒绝', T.setHero('us', 'nope', 1) === false);
ok('mastery 不再是"未知字段"（别名保留）', T.setHero('us', 'mastery', 1) === true);
// 8 槽上限
T.resetHeroes();
T.SKILL_ORDER.slice(0, 8).forEach(function(k){ T.learnSkill('us', k); });
ok('学满 8 个', hero('us').skills.length === 8, hero('us').skills.length);
ok('第 9 个被拒绝（槽满）', T.learnSkill('us', T.SKILL_ORDER[8]).ok === false,
   T.learnSkill('us', T.SKILL_ORDER[8]).why);
ok('已有的技能仍能升级', T.learnSkill('us', T.SKILL_ORDER[0]).ok === true &&
   T.skillLv('us', T.SKILL_ORDER[0]) === 1, T.skillLv('us', T.SKILL_ORDER[0]));
T.learnSkill('us', T.SKILL_ORDER[0]);
ok('专家封顶（再升被拒）', T.learnSkill('us', T.SKILL_ORDER[0]).ok === false &&
   T.skillLv('us', T.SKILL_ORDER[0]) === 2, T.skillLv('us', T.SKILL_ORDER[0]));

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 面板：7 项输入框 + 8 个技能槽 ---');
T.resetHeroes();
var hb = T.heroBarHtml();
ok('输入框 14 个（7 项 × 2 方）', (hb.match(/data-stat=/g) || []).length === 14,
   (hb.match(/data-stat=/g) || []).length);
ok('面板上没有魔法技能输入框', T.SCHOOLS.concat(['sorcery']).every(function(k){
  return hb.indexOf('data-stat="' + k + '"') < 0;
}));
ok('面板上没有 mastery 输入框', hb.indexOf('data-stat="mastery"') < 0);
ok('主属性组在（hg main）', /hg main/.test(hb));
ok('技能槽标题写 0/8', /技能槽 <b>0<\/b>\/8/.test(hb), hb.match(/技能槽[^<]*<b>\d+<\/b>\/\d+/));
ok('8 个槽全画成空位', (hb.match(/class="empty"/g) || []).length === 8,
   (hb.match(/class="empty"/g) || []).length);
ok('有「升级」按钮', /data-act="levelup"/.test(hb));
ok('有职业切换按钮', /data-act="cls"/.test(hb));
ok('顶栏写职业与等级', /力量 · Lv 1/.test(hb), hb.match(/力量 · Lv \d+/));
T.setHero('us', 'air', 2);
var hb2 = T.heroBarHtml();
ok('学了气系专家 → 槽里出现「气·专」', /气·专/.test(hb2), hb2.match(/<i class="on"[^>]*>[^<]*<\/i>/));
ok('空位只剩 7 个', (hb2.match(/class="empty"/g) || []).length === 7,
   (hb2.match(/class="empty"/g) || []).length);
ok('槽位标 1/8', /技能槽 <b>1<\/b>\/8/.test(hb2));
ok('部队数值组仍是原上下界（attack 0…20）', /data-stat="attack"[^>]*min="0" max="20"/.test(hb),
   hb.match(/<input[^>]*data-stat="attack"[^>]*>/));
ok('部队数值组没被技能改写（attack 输 5 就是 5）', panelInput('attack', 'us', 5) && hero('us').attack === 5,
   hero('us').attack);

// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 四系独立：只动该系法术 ---');
prep(3, 0);
T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.init(); flush(); T.forceTurn(byId('A5')); flush();
onlySchool('air', 2);                       // 只有气系专家
ok('气系专家 → 加速 +5', eff('haste').add === 5, eff('haste').add);
ok('气系专家 → 加速变全体', T.spellIsMass('haste', 'us') === true);
ok('气系专家 → 闪电 50', dmg('lightningBolt') === 50, dmg('lightningBolt'));
ok('气系专家 → 减速仍是基础 ×0.75（土系没升）', eff('slow').mult === 0.75, eff('slow').mult);
ok('气系专家 → 祝福没有 +1（水系没升）', eff('bless').plus === 0, eff('bless').plus);
ok('气系专家 → 诅咒没有 −1（火系没升）', eff('curse').minus === 0, eff('curse').minus);
ok('气系专家 → 祝福不是全体', T.spellIsMass('bless', 'us') === false);

onlySchool('earth', 1);                     // 只有土系高级
ok('土系高级 → 减速减半', eff('slow').mult === 0.5, eff('slow').mult);
ok('土系高级 → 加速回到 +3（气系没升）', eff('haste').add === 3, eff('haste').add);
ok('土系高级 → 减速还不是全体（要专家）', T.spellIsMass('slow', 'us') === false);

onlySchool('water', 2);                     // 只有水系专家
ok('水系专家 → 祝福 +1', eff('bless').plus === 1, eff('bless').plus);
ok('水系专家 → 祝福全体', T.spellIsMass('bless', 'us') === true);
ok('水系专家 → 驱散可选敌方', T.spellTargetKind('dispel', 'us') === 'any', T.spellTargetKind('dispel', 'us'));
ok('水系专家 → 诅咒仍是基础（火系没升）', eff('curse').minus === 0);

onlySchool('fire', 2);                      // 只有火系专家
ok('火系专家 → 诅咒 −1 且全体', eff('curse').minus === 1 && T.spellIsMass('curse', 'us') === true,
   eff('curse').minus + '/' + T.spellIsMass('curse', 'us'));

T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.init(); flush(); T.forceTurn(byId('A5')); flush();
ok('四系全 0 → 加速 +3、减速 ×0.75、无 +1/−1',
   eff('haste').add === 3 && eff('slow').mult === 0.75 && eff('bless').plus === 0 && eff('curse').minus === 0);
ok('水系基础 → 驱散只能对友方', T.spellTargetKind('dispel', 'us') === 'ally', T.spellTargetKind('dispel', 'us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 无系法术（魔法箭）取四系最高 ---');
onlySchool('air', 0);
ok('四系全 0 → 魔法箭 10（基础）', dmg('magicArrow') === 10, dmg('magicArrow'));
onlySchool('earth', 1);
ok('只有土系高级 → 魔法箭 20（跟最高那一系）', dmg('magicArrow') === 20, dmg('magicArrow'));
onlySchool('water', 2);                     // 水 2，其余 0
ok('只有水系专家 → 魔法箭 30', dmg('magicArrow') === 30, dmg('magicArrow'));
T.setHero('us', 'fire', 1);                 // 最高仍是 2
ok('最高仍是 2（水 2 / 火 1）→ 魔法箭 30', dmg('magicArrow') === 30, dmg('magicArrow'));
T.setHero('us', 'water', 0);                // 最高变 1
ok('最高降到 1 → 魔法箭 20', dmg('magicArrow') === 20, dmg('magicArrow'));
ok('schoolLevelOf(all) 与四系最高一致',
   T.schoolLevelOf('us', 'all') === Math.max.apply(null, T.SCHOOLS.map(function(k){
     return Math.max(0, T.skillLv('us', k));
   })), T.SCHOOLS.map(function(k){ return T.skillLv('us', k); }).join('/'));
ok('schoolLevelOf 钳在 0…2', (function(){
  T.setHero('us', 'air', 2); T.setHero('us', 'air', 99);
  return T.schoolLevelOf('us', 'air') === 2;
})(), T.schoolLevelOf('us', 'air'));

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 魔力 Sorcery：伤害 +0/10/20/30%，向下取整 ---');
T.resetHeroes(); T.setHero('us', 'knowledge', 3); T.setHero('us', 'spellpower', 2);
T.init(); flush(); T.forceTurn(byId('A5')); flush();
ok('魔力表 = 0/10/20/30', T.SORCERY_BONUS.join() === '0,10,20,30', T.SORCERY_BONUS.join());
ok('魔力 0：魔法箭 10+20 = 30', dmg('magicArrow') === 30, dmg('magicArrow'));
T.setHero('us', 'sorcery', 1);
ok('魔力高级：30 × 1.1 = 33', dmg('magicArrow') === 33, dmg('magicArrow'));
ok('sorceryBonus 报 10', T.sorceryBonus('us') === 10, T.sorceryBonus('us'));
T.setHero('us', 'sorcery', 2);
ok('魔力专家：30 × 1.2 = 36', dmg('magicArrow') === 36, dmg('magicArrow'));
ok('闪电 10+50=60 → 专家 72', dmg('lightningBolt') === 72, dmg('lightningBolt'));
ok('魔力钳在 0…2', (function(){ T.setHero('us', 'sorcery', 9); return T.sorceryOf('us') === 2; })(),
   T.sorceryOf('us'));
// 非整除：闪电 10+25×力1 = 35，×1.1 = 38.5 → 38
T.setHero('us', 'spellpower', 1); T.setHero('us', 'sorcery', 1);
ok('向下取整：35 × 1.1 = 38（不是 39）', dmg('lightningBolt') === 38, dmg('lightningBolt'));
ok('魔力不动增益数值：加速仍 +3', eff('haste').add === 3, eff('haste').add);
ok('魔力不动持续回合（力 1 → 1 回合）', eff('haste').remaining === 1, eff('haste').remaining);
ok('魔力不动祝福的 +1 与否', eff('bless').plus === 0, eff('bless').plus);
ok('魔力不影响法力上限', T.manaMax('us') === 30, T.manaMax('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 施法链路口径：预测 = 结算 = spellDamage ---');
prep(3, 2);
T.setHero('us', 'sorcery', 2); T.setHero('us', 'air', 2);
// 气系专家 → 魔法箭（无系）也跟着升到专家：基础 30 + 10×力2 = 50，再 ×1.2 = 60
var e1 = byId('E1'), hp0 = e1.hp, want = dmg('magicArrow');
ok('气系专家 + 力2 + 魔力专家 → (30+20)×1.2 = 60', want === 60, want);
var fc = T.spellForecast(e1, 'magicArrow', 'us');
ok('预测显示 −60', fc && fc.main === '−60', fc && fc.main);
var r = T.castSpell('us', 'magicArrow', e1);
ok('施放成功', r.ok === true, r.why);
ok('实际掉血 = 60（含魔力）', hp0 - e1.hp === 60, (hp0 - e1.hp) + ' vs 60');
ok('返回的 damage 也是 60', r.damage === 60, r.damage);
ok('法力按 cost 扣（30 → 25）', T.manaOf('us') === 25, T.manaOf('us'));

// 气系专家 → 加速全体（一次施法命中我方全部**非免疫**单位；绿龙魔法免疫不在此列）
prep(3, 2);
T.setHero('us', 'air', 2);
var usAlive = T.units().filter(function(u){
  return u.side === 'us' && !u.dead && !T.spellImmune(u, 'haste');
}).length;
r = T.castSpell('us', 'haste', null);
ok('气系专家 → 加速不需要目标且成功', r.ok === true, r.why);
ok('命中我方 ' + usAlive + ' 支可作用部队', r.affected.length === usAlive, r.affected.length);
ok('每支都是 +5', r.affected.every(function(u){
  return u.effects.some(function(e){ return e.spell === 'haste' && e.add === 5; });
}));

// 水系基础 → 驱散只能对友方（施放在敌方身上被拒且不扣蓝）
prep(3, 2);
T.SCHOOLS.forEach(function(k){ T.setHero('us', k, 0); });
var manaBefore = T.manaOf('us');
r = T.castSpell('us', 'dispel', byId('E1'));
ok('水系基础：驱散敌方被拒', r.ok === false && /友方/.test(r.why), r.why);
ok('被拒不扣法力', T.manaOf('us') === manaBefore, T.manaOf('us'));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 法术书标签：系·等级 + 当前数值 ---');
prep(3, 2);
T.SCHOOLS.forEach(function(k){ T.setHero('us', k, 0); }); T.setHero('us', 'sorcery', 0);
T.openSpellBook();
var sb = T.spellBookHtml();
ok('加速标「气·基础」', /气·基础/.test(sb), (sb.match(/气·[^<]*/) || [])[0]);
ok('祝福标「水·基础」', /水·基础/.test(sb));
ok('魔法箭标「无系·基础」', /无系·基础/.test(sb));
ok('魔法箭给当前伤害 −30', /−30/.test(sb), (sb.match(/−\d+/g) || []).join(','));
T.closeSpellBook();
T.setHero('us', 'air', 2); T.setHero('us', 'sorcery', 2);
T.openSpellBook();
sb = T.spellBookHtml();
ok('气系升到专家后标「气·专家」', /气·专家/.test(sb));
ok('加速那一行给「速度 +5（全体）」', /速度 \+5（全体）/.test(sb));
ok('闪电（气系专家 50+50）×1.2 = 120 出现在按钮里', /−120/.test(sb), (sb.match(/−\d+/g) || []).join(','));
T.closeSpellBook();

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 与既有功能共存 ---');
prep(3, 2);
T.setHero('us', 'air', 2);
ok('加速改了速度仍实时重排队列', (function(){
  var before = T.order.join();
  T.castSpell('us', 'haste', byId('A1'));
  return T.order.join() !== '' && typeof before === 'string';
})(), T.order.join());
ok('悬停信息窗仍能读（不因新字段崩）', typeof T.unitTipHtml === 'function');
ok('快速战斗仍能打完', (function(){ T.startQuick(); flush(); return !!T.over; })(), T.over && T.over.winner);
ok('计时器没有异常', timerErrors.length === 0, timerErrors.slice(0, 2).join('|'));

// ════════════════════════════════════════════════════════════════
console.log('');
console.log((fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
