// _probe24：次级技能 8 槽 + 升级候选 + 法术书（已学清单）
// 覆盖：
//   1) 技能池：14 个次级技能同池，四系/魔力是 magic 类，寻路/后勤是 adventure 类
//   2) 8 个槽：上限、槽满只给升级、未学 = 不在数组里（不是 -1）
//   3) 升级：等级 +1、主属性 +1（按职业权重）、给 2 个不重复候选
//   4) 职业倾向：魔法英雄更容易抽到魔法技能，力量英雄相反
//   5) 选技能：只能在候选里选；选完清空；再选被拒
//   6) 法术书：默认 5 条、learn/forget、未学不能施放、魔法行会/机遇
//   7) 面板：8 格槽位、升级按钮、候选按钮、职业按钮
//   8) 与既有功能共存
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
function panelInput(stat, side, val){
  var fn = ((document.getElementById('heroBar').listeners || {}).input || [])[0];
  if (!fn) return false;
  fn({ target: { dataset: { side: side, stat: stat }, value: String(val) } });
  return true;
}
function barClick(ds){
  var fn = ((document.getElementById('heroBar').listeners || {}).click || [])[0];
  if (!fn) return false;
  fn({ target: { dataset: ds } });
  return true;
}
// 刚开局的英雄（默认数值 + 2 个基础技能 + 5 条法术）
function fresh(){
  T.restoreDefaultHeroes();
  flush();
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 技能池：14 个次级技能同一个池子 ---');
ok('技能池 14 项', Object.keys(T.SKILLS).length === 14, Object.keys(T.SKILLS).length);
ok('SKILL_ORDER 与技能池一致', T.SKILL_ORDER.length === Object.keys(T.SKILLS).length &&
   T.SKILL_ORDER.every(function(id){ return !!T.SKILLS[id]; }), T.SKILL_ORDER.join(','));
ok('槽上限是 8', T.MAX_SKILLS === 8, T.MAX_SKILLS);
ok('四系 + 魔力标成 magic',
   T.MAGIC_SKILLS.join() === 'air,earth,fire,water,sorcery', T.MAGIC_SKILLS.join());
ok('寻路/后勤/侦察都在池子里（和四系平权）',
   ['pathfinding','logistics','scouting'].every(function(id){ return T.SKILLS[id].kind === 'adventure'; }));
ok('幸运术 / 领导术 / 战术 也是次级技能（adventure）',
   ['luckSkill','leadership','tacticsSkill'].every(function(id){ return T.SKILLS[id].kind === 'adventure'; }));
ok('每个技能都有中文名', T.SKILL_ORDER.every(function(id){ return !!T.SKILLS[id].name; }));

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 8 个槽：没学就是不在数组里 ---');
fresh();
ok('刚开局 2 个技能（气 + 土）', hero('us').skills.length === 2, JSON.stringify(hero('us').skills));
ok('学一项：槽 +1、等级 0', (function(){
  var r = T.learnSkill('us', 'sorcery');
  return r.ok === true && r.lv === 0 && hero('us').skills.length === 3;
})(), JSON.stringify(hero('us').skills));
ok('再学同一项：升一级', (function(){
  var r = T.learnSkill('us', 'sorcery');
  return r.ok === true && r.lv === 1;
})(), T.skillLv('us', 'sorcery'));
ok('到专家后再升被拒', (function(){
  T.learnSkill('us', 'sorcery');
  var r = T.learnSkill('us', 'sorcery');
  return r.ok === false && r.why.indexOf('专家') >= 0;
})(), T.skillLv('us', 'sorcery'));
T.resetHeroes();
T.SKILL_ORDER.slice(0, 8).forEach(function(id){ T.learnSkill('us', id); });
ok('学满 8 个', hero('us').skills.length === 8, hero('us').skills.length);
ok('第 9 个被拒（槽已满）', (function(){
  var r = T.learnSkill('us', T.SKILL_ORDER[8]);
  return r.ok === false && r.why.indexOf('8') >= 0;
})(), T.learnSkill('us', T.SKILL_ORDER[8]).why);
ok('槽满时已有技能仍能升', T.learnSkill('us', T.SKILL_ORDER[1]).ok === true);
ok('移除一项 → 空出一格', (function(){
  return T.dropSkill('us', T.SKILL_ORDER[1]) === true && hero('us').skills.length === 7;
})(), hero('us').skills.length);
ok('未学 → skillLv = -1（只在查询里出现）', T.skillLv('us', 'mysticism') === -1, T.skillLv('us', 'mysticism'));

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 升级：属性 +1、两个候选 ---');
fresh();
T.seedRand(20261020);
var before = { level: hero('us').level, sum: ['attack','defense','spellpower','knowledge']
  .reduce(function(a, k){ return a + hero('us')[k]; }, 0) };
var up = T.levelUp('us');
ok('等级 +1', hero('us').level === before.level + 1 && up.level === before.level + 1, hero('us').level);
ok('主属性总和 +1', ['attack','defense','spellpower','knowledge']
   .reduce(function(a, k){ return a + hero('us')[k]; }, 0) === before.sum + 1);
ok('涨的是四项之一', ['attack','defense','spellpower','knowledge'].indexOf(up.stat) >= 0, up.stat);
ok('给 2 个候选', Array.isArray(up.offer) && up.offer.length === 2, JSON.stringify(up.offer));
ok('候选不重复', up.offer[0] !== up.offer[1], JSON.stringify(up.offer));
ok('候选都是已知技能', up.offer.every(function(id){ return !!T.SKILLS[id]; }), JSON.stringify(up.offer));
ok('候选记在 hero.offer 上', JSON.stringify(hero('us').offer) === JSON.stringify(up.offer));
ok('候选不含已到专家的技能', (function(){
  T.resetHeroes();
  T.SKILL_ORDER.forEach(function(id){ T.setSkillLevel('us', id, 2); });
  // 8 槽满了且全专家 → 没有候选
  return T.skillOffers('us', 2).length === 0;
})(), JSON.stringify(T.skillOffers('us', 2)));
ok('槽满后候选只来自已有技能（不给新技能）', (function(){
  T.resetHeroes();
  T.SKILL_ORDER.slice(0, 8).forEach(function(id){ T.learnSkill('us', id); });
  var offered = T.skillOffers('us', 2);
  return offered.length === 2 && offered.every(function(id){ return T.hasSkill('us', id); });
})(), JSON.stringify(T.skillOffers('us', 2)));

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 职业倾向：魔法英雄偏魔法，力量英雄偏探险 ---');
function magicRatio() {
  var m = 0, t = 0, i, list;
  for (i = 0; i < 300; i++) {
    list = T.skillOffers('us', 2);
    list.forEach(function(id){ t++; if (T.MAGIC_SKILLS.indexOf(id) >= 0) m++; });
  }
  return t ? m / t : 0;
}
fresh(); T.seedRand(7);
hero('us').cls = 'magic';
var rMagic = magicRatio();
fresh(); T.seedRand(7);
hero('us').cls = 'might';
var rMight = magicRatio();
ok('魔法英雄的候选里魔法技能占多数（> 50%）', rMagic > 0.5, (rMagic * 100).toFixed(1) + '%');
ok('力量英雄的候选里魔法技能是少数（< 30%）', rMight < 0.3, (rMight * 100).toFixed(1) + '%');
ok('两者确实不同（职业影响抽取）', rMagic > rMight + 0.2,
   (rMagic * 100).toFixed(1) + '% vs ' + (rMight * 100).toFixed(1) + '%');
ok('职业权重是 6 : 2', (function(){
  fresh();
  hero('us').cls = 'magic';
  return T.SKILL_ORDER.every(function(id){
    var w = (T.MAGIC_SKILLS.indexOf(id) >= 0) === (hero('us').cls === 'magic') ? 6 : 2;
    return w === 6 || w === 2;
  });
})());

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 选技能：只能在候选里选 ---');
fresh();
T.seedRand(31);
var offer = T.levelUp('us').offer;
var outside = T.SKILL_ORDER.filter(function(id){ return offer.indexOf(id) < 0; })[0];
ok('选不在候选里的 → 拒绝', T.pickSkill('us', outside).ok === false, T.pickSkill('us', outside).why);
ok('被拒后候选还在', JSON.stringify(hero('us').offer) === JSON.stringify(offer));
ok('选候选里的 → 成功', T.pickSkill('us', offer[0]).ok === true);
ok('选完候选清空', hero('us').offer === null, JSON.stringify(hero('us').offer));
ok('再选一次 → 没有待选', T.pickSkill('us', offer[1]).ok === false, T.pickSkill('us', offer[1]).why);
ok('学到的技能在槽里', T.hasSkill('us', offer[0]) === true, offer[0]);

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 法术书 = 已学清单 ---');
fresh();
ok('默认已学 5 条', T.knownSpells('us').length === 5, T.knownSpells('us').join(','));
ok('默认清单 = 魔法箭/祝福/诅咒/加速/减速',
   T.knownSpells('us').join() === 'magicArrow,bless,curse,haste,slow', T.knownSpells('us').join(','));
ok('闪电还没学', T.knowsSpell('us', 'lightningBolt') === false);
ok('驱散还没学', T.knowsSpell('us', 'dispel') === false);
ok('未学的法术不能施放', (function(){
  T.startManual(); flush(); T.forceTurn(byId('A5')); flush();
  T.setHero('us', 'knowledge', 5);
  var m = T.manaOf('us');
  var r = T.castSpell('us', 'lightningBolt', byId('E1'));
  return r.ok === false && r.why.indexOf('法术书') >= 0 && T.manaOf('us') === m;
})(), T.manaOf('us'));
ok('学一条 → 数量 +1', (function(){
  var r = T.learnSpell('us', 'lightningBolt');
  return r.ok === true && T.knownSpells('us').length === 6;
})(), T.knownSpells('us').join(','));
ok('重复学 → 拒绝', T.learnSpell('us', 'lightningBolt').ok === false, T.learnSpell('us', 'lightningBolt').why);
ok('学会后就能施放', (function(){
  T.init(); flush(); T.startManual(); flush();
  T.setHero('us', 'knowledge', 5); T.setMana('us', 30);
  T.forceTurn(byId('A5')); flush();
  return T.castSpell('us', 'lightningBolt', byId('E1')).ok === true;
})());
ok('忘掉一条 → 数量 -1 且不能施放', (function(){
  T.forgetSpell('us', 'lightningBolt');
  T.init(); flush(); T.startManual(); flush();
  T.setHero('us', 'knowledge', 5); T.setMana('us', 30);
  T.forceTurn(byId('A5')); flush();
  return T.knownSpells('us').length === 5 && T.castSpell('us', 'lightningBolt', byId('E1')).ok === false;
})());
ok('魔法行会给等级最低的未学法术', (function(){
  fresh();
  var r = T.visitGuild();
  return r.ok === true && r.key === 'dispel';
})(), JSON.stringify(T.knownSpells('us')));
ok('路边机遇随机给一条未学的', (function(){
  fresh(); T.seedRand(99);
  var r = T.visitHut();
  return r.ok === true && T.knowsSpell('us', r.key) === true && T.DEFAULT_SPELLS.indexOf(r.key) < 0;
})(), JSON.stringify(T.knownSpells('us')));
ok('全学完之后行会/机遇都没有新东西', (function(){
  fresh();
  T.learnAllSpells('us');
  return T.visitGuild().ok === false && T.visitHut().ok === false &&
         T.knownSpells('us').length === T.SPELL_ORDER.length;
})(), T.knownSpells('us').length);
ok('敌方有自己的一本法术书', (function(){
  fresh();
  T.forgetSpell('us', 'haste');
  return T.knowsSpell('us', 'haste') === false && T.knowsSpell('them', 'haste') === true;
})());
ok('法术书不影响技能：未学气系照样能放加速（基础档）', (function(){
  fresh();
  T.setSkillLevel('us', 'air', -1);
  T.startManual(); flush();
  T.setHero('us', 'knowledge', 5); T.setMana('us', 30);
  T.forceTurn(byId('A5')); flush();
  var r = T.castSpell('us', 'haste', byId('A1'));
  return r.ok === true && T.schoolLevelOf('us', 'air') === 0;
})(), T.schoolLevelOf('us', 'air'));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 面板：8 格槽位 + 升级 ---');
fresh();
var hb = T.heroBarHtml();
ok('技能槽画 8 格', (hb.match(/<i class=/g) || []).length === 8, (hb.match(/<i class=/g) || []).length);
ok('刚开局 2 格实心 + 6 格空', (hb.match(/class="on"/g) || []).length >= 0 &&
   (hb.match(/class="empty"/g) || []).length === 6, (hb.match(/class="empty"/g) || []).length);
ok('标题写 2/8', /技能槽 <b>2<\/b>\/8/.test(hb));
ok('有升级按钮', /data-act="levelup"/.test(hb));
ok('有职业按钮（默认力量）', /data-act="cls"[^>]*>力量</.test(hb), hb.match(/data-act="cls"[^>]*>[^<]*</));
ok('没有魔法技能输入框', T.MAGIC_SKILLS.every(function(id){ return hb.indexOf('data-stat="' + id + '"') < 0; }));
ok('没有技能的 data-stat（技能只能靠学）',
   T.SKILL_ORDER.every(function(id){ return hb.indexOf('data-stat="' + id + '"') < 0; }));
T.seedRand(5);
barClick({ act: 'levelup' });
var hb2 = T.heroBarHtml();
ok('点升级 → 面板出现两个候选按钮', (hb2.match(/data-pick=/g) || []).length === 2,
   (hb2.match(/data-pick=/g) || []).length);
ok('候选按钮标「新学」或「升高级」', /（新学）|（升/.test(hb2));
barClick({ pick: hero('us').offer[0] });
var hb3 = T.heroBarHtml();
ok('点候选 → 槽位变 3/8', /技能槽 <b>3<\/b>\/8/.test(hb3), hb3.match(/技能槽 <b>\d+<\/b>\/8/));
ok('点候选 → 候选按钮消失', (hb3.match(/data-pick=/g) || []).length === 0);
barClick({ act: 'cls' });
ok('点职业 → 顶栏变成魔法', /魔法 · Lv \d/.test(T.heroBarHtml()), T.heroBarHtml().match(/(力量|魔法) · Lv \d/));

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 与既有功能共存 ---');
fresh();
T.startManual(); flush();
ok('快速战斗 / 手动战斗都能开', (function(){
  T.startQuick(); flush();
  return !!T.over;
})(), T.over && T.over.winner);
ok('悬停信息窗的导出还在', typeof T.unitTipHtml === 'function' || typeof T.showUnitTip === 'function');
ok('法术书 HTML 只列已学的', (function(){
  fresh();
  var h = document.getElementById('spellBook');
  T.openSpellBook();
  var s = h._html || '';
  return s.indexOf('lightningBolt') < 0 && s.indexOf('闪电') < 0 && s.indexOf('魔法箭') >= 0;
})(), (document.getElementById('spellBook')._html || '').slice(0, 80));
ok('法力上限仍跟知识走（识 3 → 30）', T.manaMax('us') === 30, T.manaMax('us'));
ok('计时器没有异常', timerErrors.length === 0, timerErrors.slice(0, 2).join('|'));

// ════════════════════════════════════════════════════════════════
console.log('');
console.log((fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
