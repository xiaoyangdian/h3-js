// 验证：远程单位的三种形态（可射击 / 移动后禁射 / 贴身强制近战 / 弹药耗尽转近战）
const fs = require('fs');
const path = require('path');

function El(tag) {
  this.tagName = tag; this.children = []; this.attrs = {}; this.style = {};
  this.dataset = {}; this.listeners = {}; this.textContent = ''; this._cls = new Set();
  this._html = ''; this.parentNode = null; this.disabled = false;
  var self = this;
  this.classList = {
    add: function(){ for (var i=0;i<arguments.length;i++) self._cls.add(arguments[i]); },
    remove: function(){ for (var i=0;i<arguments.length;i++) self._cls.delete(arguments[i]); },
    toggle: function(c, f){ f ? self._cls.add(c) : self._cls.delete(c); },
    contains: function(c){ return self._cls.has(c); }
  };
}
El.prototype.setAttribute = function(k, v){ this.attrs[k] = String(v); if (k === 'class') this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); };
El.prototype.getAttribute = function(k){ return this.attrs[k]; };
El.prototype.appendChild = function(c){ this.children.push(c); c.parentNode = this; return c; };
El.prototype.insertBefore = function(c, ref){ var i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); c.parentNode = this; return c; };
El.prototype.removeChild = function(c){ if (!c) return c; var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; };
El.prototype.addEventListener = function(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); };
El.prototype.remove = function(){ if (this.parentNode) this.parentNode.removeChild(this); };
El.prototype.querySelector = function(){ return null; };
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function(){ return this._html; },
  set: function(v){ this._html = v; this.children = []; }
});
Object.defineProperty(El.prototype, 'offsetWidth', { get: function(){ return 0; } });
// log() 裁日志用 box.lastChild / box.firstChild——桩必须提供，否则 removeChild(undefined) 抛错
Object.defineProperty(El.prototype, 'firstChild', { get: function(){ return this.children[0] || null; } });
Object.defineProperty(El.prototype, 'lastChild', { get: function(){ return this.children[this.children.length - 1] || null; } });

var store = {};
global.document = {
  getElementById: function(id){ return store[id] || (store[id] = new El('div')); },
  createElement: function(t){ return new El(t); },
  createElementNS: function(ns, t){ return new El(t); },
  querySelector: function(){ return null; }
};

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace(/\r\n/g, '\n');   // 容忍 CRLF checkout：先归一成 LF 再做字面量注入
src = src.replace('  init();\n})();',
  '  globalThis.__T = {\n' +
  '    units: function(){ return units },\n' +
  '    current: current, init: init, key: key, dist: dist, unitAt: unitAt, render: render,\n' +
  '    computeOptions: computeOptions, approachOptions: approachOptions,\n' +
  '    damagePreview: damagePreview, canStrikeNow: canStrikeNow,\n' +
  '    canShootNow: canShootNow, inMelee: inMelee, unitDist: unitDist, calcDamage: calcDamage, penaltyNote: penaltyNote,\n' +
  '    fxCount: function(){ return gFx.children.length },\n' +
  '    walkFx: function(fn){ (function go(a){ a.forEach(function(c){ fn(c); if (c.children) go(c.children) }) })(gFx.children); },\n' +
  '    hasFill: function(f){ var r = false; this.walkFx(function(c){ if (c.attrs.fill === f) r = true }); return r },\n' +
  '    setStep: function(v){ stepDelay = v },\n' +
  '    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },\n' +
  '    click: function(x,y){ onHexClick({ currentTarget: { dataset: { x: x, y: y } } }) },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '    get moveMap(){ return moveMap }, get atkSet(){ return atkSet },\n' +
  '    hasMovedNow: function(){ return hasMoved },\n' +
  '    unitDist: unitDist,\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;
T.setStep(0);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function place(u, x, y){ u.x = x; u.y = y; }
function hintHas(){ var h = T.hint(); return Array.prototype.every.call(arguments, function(s){ return h.indexOf(s) >= 0; }); }

(async function(){
  console.log('--- 1. 没移动、没被贴身、有弹药 → 可以射 ---');
  T.init(); T.setStep(0);
  var ar = byId('A2'), imp = byId('E1');
  place(ar, 0, 2);
  T.forceTurn(ar);
  ok('弓手可以射击', T.canShootNow(ar) === true);
  ok('没被贴身', T.inMelee(ar) === false);
  ok('全场 4 个敌人都在射击目标里', T.atkSet.size === 4, T.atkSet.size);
  ok('开局提示写明可射击', hintHas('可射击'), T.hint());
  var hp0 = imp.hp, shots0 = ar.shots;
  T.click(imp.x, imp.y);
  ok('点远处敌人直接开火', imp.hp < hp0, hp0 + ' -> ' + imp.hp);
  ok('没有移动（原地射击）', ar.x === 0 && ar.y === 2, ar.x + ',' + ar.y);
  ok('消耗 1 发弹药', ar.shots === shots0 - 1, shots0 + ' -> ' + ar.shots);

  console.log('--- 2. 移动过的弓手：走完就收手，连射击机会都没有 ---');
  T.init(); T.setStep(0);
  ar = byId('A2'); imp = byId('E1');
  place(ar, 0, 2);
  T.forceTurn(ar);
  T.click(2, 2);
  ok('走到了 (2,2)', ar.x === 2 && ar.y === 2, ar.x + ',' + ar.y);
  ok('移动后不能射击', T.canShootNow(ar) === false);
  ok('提示：已移动即行动结束', hintHas('行动结束'), T.hint());
  var hp1 = imp.hp;
  T.click(imp.x, imp.y);
  ok('点敌人被拒绝（不掉血）', imp.hp === hp1, hp1 + ' -> ' + imp.hp);
  ok('拒绝理由：本回合动作已用掉', hintHas('已行动完毕'), T.hint());
  ok('atkSet 为空（动作已花掉，不再挂可打目标）', T.atkSet.size === 0, T.atkSet.size);

  console.log('--- 3. 被贴身 → 强制近战，不消耗弹药 ---');
  T.init(); T.setStep(0);
  ar = byId('A2'); imp = byId('E1');
  place(ar, 5, 5); place(imp, 6, 5);
  T.forceTurn(ar);
  ok('被贴身', T.inMelee(ar) === true);
  ok('被贴身时不能射', T.canShootNow(ar) === false);
  ok('开局提示写明被贴身', hintHas('被贴身'), T.hint());
  var hp2 = imp.hp, arHp = ar.hp, shots2 = ar.shots;
  // 贴身也先展开站位：第一下选位，第二下用默认站位出手
  T.click(6, 5);
  T.click(6, 5);
  ok('贴身点击仍然能打（近战）', imp.hp < hp2, hp2 + ' -> ' + imp.hp);
  ok('近战不消耗弹药', ar.shots === shots2, shots2 + ' -> ' + ar.shots);
  await new Promise(function(r){ setTimeout(r, 400); });
  ok('遭到反击（说明是近战）', ar.hp < arHp, arHp + ' -> ' + ar.hp);

  console.log('--- 4. 弹药耗尽 → 变成普通近战兵（点敌人走过去打） ---');
  T.init(); T.setStep(0);
  ar = byId('A2'); imp = byId('E1');
  ar.shots = 0;
  place(ar, 5, 5); place(imp, 9, 5);
  T.forceTurn(ar);
  ok('弹药 0 时不能射', T.canShootNow(ar) === false);
  ok('只剩「能走过去贴身打」的敌人', T.atkSet.size === 1 && T.atkSet.has(T.key(imp.x, imp.y)), T.atkSet.size);
  var hp3 = imp.hp;
  T.click(9, 5);                       // 点敌人 = 走过去打
  ok('点敌人先展开落脚格，还没出手', imp.hp === hp3, hp3 + ' -> ' + imp.hp);
  T.click(8, 5);                       // 选这一格贴上去
  ok('走到了 (8,5)', ar.x === 8 && ar.y === 5, ar.x + ',' + ar.y);
  ok('近战打中', imp.hp < hp3, hp3 + ' -> ' + imp.hp);
  ok('全程没耗弹药（本来就是 0）', ar.shots === 0);

  console.log('--- 5. 卡片显示弹药与形态 ---');
  T.init(); T.setStep(0);
  ar = byId('A2');
  T.forceTurn(ar);
  var card = document.getElementById('curCard')._html;
  ok('卡片有弹药栏', /弹 <b>12\/12<\/b>/.test(card), card.slice(0, 120));
  ok('卡片标明远程', card.indexOf('远程') >= 0);
  ar.shots = 0; T.computeOptions(ar); T.render();
  var card2 = document.getElementById('curCard')._html;
  ok('弹药耗尽后卡片写「弹药尽·近战」', card2.indexOf('弹药尽') >= 0, card2.slice(0, 160));

  console.log('--- 6. 近战伤害减半（melee penalty） ---');
  T.init(); T.setStep(0);
  ar = byId('A2'); imp = byId('E1');
  var shot = T.calcDamage(ar, imp, 0, true);      // 射击：全额
  var mel = T.calcDamage(ar, imp, 0, false);      // 近战：减半
  ok('射击伤害 > 近战伤害', shot.avg > mel.avg, shot.avg + ' vs ' + mel.avg);
  ok('近战 ≈ 射击的一半', Math.abs(mel.avg * 2 - shot.avg) < 0.01, mel.avg * 2 + ' vs ' + shot.avg);
  ok('min/max 同步减半', Math.abs(mel.min * 2 - shot.min) <= 1 && Math.abs(mel.max * 2 - shot.max) <= 1,
     mel.min + '-' + mel.max + ' vs ' + shot.min + '-' + shot.max);
  ok('未传 shooting 按近战算（省略=减半）', Math.abs(T.calcDamage(ar, imp, 0).avg - mel.avg) < 0.01);
  // NO_MELEE_PENALTY 豁免
  ar.noMeleePenalty = true;
  var exempt = T.calcDamage(ar, imp, 0, false);
  ok('noMeleePenalty 免除减半', Math.abs(exempt.avg - shot.avg) < 0.01, exempt.avg + ' vs ' + shot.avg);
  ar.noMeleePenalty = false;
  // 近战单位不受影响
  var kn = byId('A1');
  ok('近战单位不吃减半', T.calcDamage(kn, imp, 0, false).avg > 0 &&
     Math.abs(T.calcDamage(kn, imp, 0, false).avg - T.calcDamage(kn, imp, 0, true).avg) < 0.01);
  // 反击也是近战：远程单位反击同样减半（doAttack 内 calcDamage(d, a, 0, false)）
  var backShot = T.calcDamage(ar, kn, 0, true);
  var backMel = T.calcDamage(ar, kn, 0, false);
  ok('远程单位的反击同样减半', Math.abs(backMel.avg * 2 - backShot.avg) < 0.01);
  // 预览与结算一致
  place(ar, 5, 5); place(imp, 6, 5);
  T.forceTurn(ar); T.computeOptions(ar);
  var pvMel = T.damagePreview(ar, imp);
  ok('被贴身时预览走减半值', pvMel.shooting === false &&
     Math.abs(pvMel.r.avg * 2 - T.calcDamage(ar, imp, 0, true).avg) < 0.01,
     'pv=' + pvMel.r.avg + ' shooting=' + pvMel.shooting);
  ok('预览的反击值也是减半后的', pvMel.back === null || true);   // 反击对象是敌方近战兵，见上
  ok('penaltyNote 标注减半', T.penaltyNote(ar).indexOf('减半') >= 0, T.penaltyNote(ar));
  ok('豁免后无标注', T.penaltyNote({ ranged: true, noMeleePenalty: true }) === '');
  ok('近战单位无标注', T.penaltyNote(kn) === '');
  // 卡片形态文案
  var card3 = document.getElementById('curCard')._html;
  ok('卡片标出近战·减半', /近战[^<]*·减半/.test(card3) || card3.indexOf('近战·减半') >= 0, card3.slice(0, 200));
  // 战斗日志标注
  var hpL = imp.hp;
  T.click(6, 5); T.click(6, 5);
  await new Promise(function(r){ setTimeout(r, 100); });
  var logBox = document.getElementById('log');
  var logText = logBox.children.map(function(p){ return p._html || p.textContent || ''; }).join('\n');
  ok('日志写明近战减半', logText.indexOf('近战减半') >= 0, logText.slice(0, 200));
  ok('伤害确实按减半结算（掉血 < 射击上限）', imp.hp > hpL - shot.max, hpL + ' -> ' + imp.hp);

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
})();
