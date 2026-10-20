// _probe20：法术书弹窗 + 施法交互（按钮 / 弹窗 / 瞄准 / 目标校验 / 施放收尾）
// 覆盖：
//   1) 弹窗骨架：按钮在顶栏，面板浮在战棋区域上，#spellBook 仍在面板里（旧断言不搬家）
//   2) 开合：open / close / toggle 幂等；开合不动战场状态
//   3) 禁用面：快速战斗 / 自动战斗下按钮与入口都关掉
//   4) 选法术 → 面板自动收起 → 棋盘进瞄准态（按钮变「取消施法」）
//   5) 瞄准高亮：合法目标描圈、免疫目标描灰；双格单位占两格都算
//   6) 目标校验：点空地取消、点错阵营/免疫目标不扣法力也不退出瞄准
//   7) 施放收尾：法/伤害/日志/按钮复位，且**不消耗该单位这一手**
//   8) 预测（spellForecast）与结算同口径
// 不在本套件：AI 施法（仍是缺口）、3-5 级法术、弹窗动画
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
// 注入串与 _probe17/19 同形；法术书弹窗接口经 attachTestHooks 补挂
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
function cells(u){ return T.cellsOf(u).length; }

/* 开一局：知识 10（法力 100）、力量 3（伤害 +30 / 持续 3 回合）、初级精通、手动模式 */
function fresh(){
  T.resetHeroes();
  T.setHero('us', 'knowledge', 10);
  T.setHero('us', 'spellpower', 3);
  T.setHero('us', 'mastery', 0);
  T.setHero('them', 'knowledge', 10);
  T.setHero('them', 'mastery', 0);
  T.startManual(); flush();
  T.setMana('us', 100);
  T.setMana('them', 100);
  T.setCastsThisRound('us', 0);
  T.setCastsThisRound('them', 0);
}

// ════════════════════════════════════════════════════════════════
console.log('--- 1. 弹窗骨架：按钮 / 面板 / 法术书三件套就位 ---');
ok('顶栏有「魔法书」按钮', html.indexOf('id="btnSpell"') > 0);
ok('按钮在队列之后、自动战斗之前（顶栏里）',
   html.indexOf('id="queue"') < html.indexOf('id="btnSpell"') &&
   html.indexOf('id="btnSpell"') < html.indexOf('id="btnAuto"'));
ok('法术书面板 id="spellPanel" 存在', html.indexOf('id="spellPanel"') > 0);
ok('面板在战棋区域里（field 之后、confirmBar 之前）',
   html.indexOf('id="field"') < html.indexOf('id="spellPanel"') &&
   html.indexOf('id="spellPanel"') < html.indexOf('id="confirmBar"'));
ok('#spellBook 搬进了面板里（旧探针断言的元素还在）',
   html.indexOf('id="spellPanel"') < html.indexOf('id="spellBook"') &&
   html.indexOf('id="spellBook"') < html.indexOf('id="confirmBar"'));
ok('面板在棋盘上定位（.fieldwrap 是 position:relative）',
   /\.fieldwrap\{position:relative\}/.test(html));
ok('面板默认收起、.open 才显示',
   /\.spellpanel\{[^}]*display:none/.test(html) && /\.spellpanel\.open\{display:flex\}/.test(html));
ok('瞄准态两种格子样式都在（可点 / 免疫）',
   /\.hex\.spell-ok\{/.test(html) && /\.hex\.spell-no\{/.test(html));

// ════════════════════════════════════════════════════════════════
console.log('--- 2. 开局状态：面板关着、按钮可用 ---');
fresh();
ok('开局面板是关的', T.spellBookOpen() === false);
ok('开局 DOM 上也没有 open 类', T.panelOpen() === false);
ok('按钮文案 = 魔法书，且可点',
   T.spellBtn().text === '魔法书' && T.spellBtn().disabled === false,
   JSON.stringify(T.spellBtn()));
ok('我方回合、有法力 → 有可施放的法术', T.castableNow('us') === true && T.readySpellCount('us') === 7,
   T.readySpellCount('us'));
ok('按钮亮起 ready（提示"能施法"）', T.spellBtn().ready === true, JSON.stringify(T.spellBtn()));

// ════════════════════════════════════════════════════════════════
console.log('--- 3. 开合：open / toggle / close 幂等，且不动战场 ---');
var manaBefore = T.manaOf('us'), curBefore = T.current().id;
ok('openSpellBook 成功', T.openSpellBook() === true);
ok('状态与 DOM 同步打开', T.spellBookOpen() === true && T.panelOpen() === true);
ok('弹窗里的法术书仍渲染 7 条',
   (T.spellBookHtml().match(/data-spell=/g) || []).length === 7,
   (T.spellBookHtml().match(/data-spell=/g) || []).length);
ok('开窗不扣法力', T.manaOf('us') === manaBefore, T.manaOf('us'));
ok('开窗不动当前行动单位', T.current().id === curBefore, T.current().id);
ok('再 open 一次仍是打开（幂等）', T.openSpellBook() === true && T.spellBookOpen() === true);
ok('toggle 一次 → 关闭', T.toggleSpellBook() === true && T.spellBookOpen() === false);
ok('toggle 再一次 → 打开', T.toggleSpellBook() === true && T.spellBookOpen() === true);
ok('close 成功', T.closeSpellBook() === true && T.spellBookOpen() === false);
ok('重复 close 返回 false（无副作用）', T.closeSpellBook() === false && T.panelOpen() === false);

// ════════════════════════════════════════════════════════════════
console.log('--- 4. 快速战斗 / 自动战斗：入口与按钮都关掉 ---');
T.startQuick(); flush();
ok('快速战斗下不能施法', T.castableNow('us') === false);
ok('快速战斗下开不出法术书', T.openSpellBook() === false && T.spellBookOpen() === false);
ok('快速战斗下按钮禁用', T.spellBtn().disabled === true, JSON.stringify(T.spellBtn()));
T.startAuto(); flush();
ok('自动战斗下不能施法', T.castableNow('us') === false);
ok('自动战斗下开不出法术书', T.openSpellBook() === false);
ok('自动战斗下按钮禁用', T.spellBtn().disabled === true);

// ════════════════════════════════════════════════════════════════
console.log('--- 5. 选法术 → 弹窗收起 → 棋盘进瞄准态 ---');
fresh();
T.openSpellBook();
ok('前置：面板开着', T.panelOpen() === true);
ok('beginCast(魔法箭) 进入瞄准', T.beginCast('magicArrow') === true && T.castModeKey() === 'magicArrow');
ok('弹窗自动收起（要看得见棋盘才能点目标）',
   T.spellBookOpen() === false && T.panelOpen() === false);
ok('按钮变成「取消施法」并进入 casting 态',
   T.spellBtn().text === '取消施法' && T.spellBtn().casting === true, JSON.stringify(T.spellBtn()));
ok('提示点了要点敌方部队、并给出 Esc 取消',
   /点一个敌方部队/.test(T.hint()) && /Esc 取消/.test(T.hint()), T.hint());

// ════════════════════════════════════════════════════════════════
console.log('--- 6. 瞄准高亮：合法目标描圈，免疫目标描灰 ---');
var e1 = byId('E1'), e2 = byId('E2'), e4 = byId('E4'), a5 = byId('A5'), a1 = byId('A1');
var enemyCells = ['E1','E2','E3','E4'].reduce(function(s,id){ return s + cells(byId(id)); }, 0);
var allyCells  = ['A1','A2','A3','A4','A5'].reduce(function(s,id){ return s + cells(byId(id)); }, 0);
var pv = T.spellPreviewHtml();
ok('敌人占 ' + enemyCells + ' 格（含双格恶魔犬）', enemyCells === 5, enemyCells);
ok('魔法箭把 5 个敌方格全点亮', pv.ok === 5, JSON.stringify(pv));
ok('魔法箭没有"打不了"的敌方目标（敌方无魔法免疫）', pv.no === 0, JSON.stringify(pv));
ok('瞄准态不画走位/攻击预览（预览层只有法术标记 + 压暗底）',
   pv.ok + pv.no === 5 && pv.text === 0, JSON.stringify(pv));

T.clearCastMode();
ok('改为加速（友方）：瞄的是友军', T.beginCast('haste') === true && T.castModeKey() === 'haste');
pv = T.spellPreviewHtml();
ok('友军共 ' + allyCells + ' 格', allyCells === 8, allyCells);
ok('可点亮 6 格（8 格减去免疫的绿龙 2 格）', pv.ok === 6, JSON.stringify(pv));
ok('绿龙（魔法免疫）被标成"打不了"的 2 格', pv.no === 2, JSON.stringify(pv));

// ════════════════════════════════════════════════════════════════
console.log('--- 7. 悬停预测：掉多少血 / 剩几只 ---');
T.clearCastMode();
T.beginCast('magicArrow');
T.hoverPreview(e1);
pv = T.spellPreviewHtml();
ok('悬停合法目标时多出一段预测文字', pv.text === 1, JSON.stringify(pv));
ok('提示写明"魔法箭 → 魔童"与伤害 −40（10 + 10×力3）',
   /魔法箭 → 魔童/.test(T.hint()) && /−40/.test(T.hint()), T.hint());
ok('预测里的"剩几只"= ceil((hp−40)/每只生命)',
   T.spellPreviewHtml().text === 1 &&
   T.spellForecast(e1, 'magicArrow', 'us').sub ===
     '剩 ' + Math.ceil(Math.max(0, e1.hp - 40) / e1.perHp) + ' 只',
   T.spellForecast(e1, 'magicArrow', 'us').sub);
T.hoverPreview(a5);   // 绿龙：阵营不对，不算合法目标
pv = T.spellPreviewHtml();
ok('悬停不合法目标不画预测文字', pv.text === 0, JSON.stringify(pv));

// ════════════════════════════════════════════════════════════════
console.log('--- 8. 点空地 = 取消（不扣法力） ---');
var m0 = T.manaOf('us');
ok('点空地返回 null', T.handleSpellClick(0, 0) === null);
ok('瞄准态被清掉', T.castModeKey() === null);
ok('法力一点没扣', T.manaOf('us') === m0, T.manaOf('us'));
ok('提示写明已取消', /取消/.test(T.hint()), T.hint());
ok('再次 cancelCast 无事可做', T.cancelCast() === false);

// ════════════════════════════════════════════════════════════════
console.log('--- 9. 目标校验：错阵营 / 免疫都不扣法力、不退出瞄准 ---');
T.beginCast('magicArrow');
m0 = T.manaOf('us');
var r = T.handleSpellClick(a1.x, a1.y);          // 往自家枪兵扔魔法箭
ok('对自己人施魔法箭被拒', r && r.ok === false, JSON.stringify(r && r.why));
ok('还留在瞄准态（换个目标就行）', T.castModeKey() === 'magicArrow', T.castModeKey());
ok('被拒时不扣法力', T.manaOf('us') === m0, T.manaOf('us'));
ok('提示说明只能对敌方', /只能对敌方/.test(T.hint()), T.hint());

T.clearCastMode();
T.beginCast('haste');
m0 = T.manaOf('us');
r = T.handleSpellClick(a5.x, a5.y);              // 给魔法免疫的绿龙加速
ok('对绿龙（魔法免疫）施法被拒', r && r.ok === false, JSON.stringify(r && r.why));
ok('被拒后仍在瞄准态', T.castModeKey() === 'haste', T.castModeKey());
ok('免疫被拒也不扣法力', T.manaOf('us') === m0, T.manaOf('us'));
ok('提示说明目标免疫', /免疫/.test(T.hint()), T.hint());

// ════════════════════════════════════════════════════════════════
console.log('--- 10. 施放成功：伤害 / 法力 / 日志 / 按钮复位 ---');
T.clearCastMode();
fresh();
// fresh() 会重建 units：这里必须重新取一次引用，用旧的会测到上一局的对象
var tgt = byId('E1');
var cur0 = T.current().id, hp0 = tgt.hp, order0 = T.order.length;
T.beginCast('magicArrow');
r = T.handleSpellClick(tgt.x, tgt.y);
ok('施放成功', r && r.ok === true, JSON.stringify(r && r.why));
ok('魔童掉 40 血（10 + 10×力3）', tgt.hp === hp0 - 40, hp0 + ' -> ' + tgt.hp);
ok('法力 100 → 95', T.manaOf('us') === 95, T.manaOf('us'));
ok('瞄准态收掉', T.castModeKey() === null);
ok('按钮复位成「魔法书」', T.spellBtn().text === '魔法书' && T.spellBtn().casting === false,
   JSON.stringify(T.spellBtn()));
ok('日志记了魔法箭', /魔法箭/.test(T.logText()), T.logText().slice(-60));
ok('施法不消耗这一手：当前单位没变', T.current().id === cur0, T.current().id);
ok('施法后仍可移动（hasMoved 仍是 false）', T.moved() === false);
ok('行动顺序没被打乱（队列仍是 9）', T.order.length === order0, T.order.length);
ok('本回合额度已用 → 再开法术被拒', T.beginCast('haste') === false && T.castModeKey() === null);
ok('额度用掉后按钮不再 ready', T.spellBtn().ready === false, JSON.stringify(T.spellBtn()));

// ════════════════════════════════════════════════════════════════
console.log('--- 11. 预测与结算同口径 ---');
fresh();
ok('魔法箭伤害预测 = 结算伤害',
   T.spellForecast(byId('E1'), 'magicArrow', 'us').main === '−' + T.spellDamage('magicArrow', 'us'),
   T.spellForecast(byId('E1'), 'magicArrow', 'us').main + ' / ' + T.spellDamage('magicArrow', 'us'));
ok('加速预测 = 效果名 + 力量回合数',
   T.spellForecast(byId('A1'), 'haste', 'us').main === '加速' &&
   T.spellForecast(byId('A1'), 'haste', 'us').sub === '3 回合',
   JSON.stringify(T.spellForecast(byId('A1'), 'haste', 'us')));
T.addEffect(byId('A2'), { spell: 'haste', name: '加速', kind: 'buff', remaining: 3, add: 3 });
ok('驱散预测数得出目标身上的效果个数',
   T.spellForecast(byId('A2'), 'dispel', 'us').main === '驱散 1 个',
   T.spellForecast(byId('A2'), 'dispel', 'us').main);
ok('无效果目标预测为"无效果可驱"',
   T.spellForecast(byId('A1'), 'dispel', 'us').main === '无效果可驱',
   T.spellForecast(byId('A1'), 'dispel', 'us').main);

// ════════════════════════════════════════════════════════════════
console.log('--- 12. 收尾：战斗还能继续推进 ---');
ok('全程无定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));
T.endActor(); flush();
ok('交棒后由下一个单位接手（战斗没卡死）', !!T.current(), T.over ? 'over' : (T.current() && T.current().id));
ok('敌方回合我方开不出法术书（只读也不让按）',
   T.current().side === 'them' ? T.castableNow('us') === false : true, T.current().side);
flush();
ok('推进到底也没有定时器异常', timerErrors.length === 0, timerErrors.slice(0, 3).join(' | '));

console.log('---');
console.log('PASS ' + pass + '  FAIL ' + fail);
if (fail) { console.log('FAILED'); process.exit(1); }
else console.log('ALL PASS');
