// 验证：攻击特效（出手位移 / 刀光 / 爆发 / 箭矢 / 龙息火焰 / 阵亡碎片 / 命中帧时序）
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
El.prototype.removeChild = function(c){ var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; };
El.prototype.addEventListener = function(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); };
El.prototype.remove = function(){ if (this.parentNode) this.parentNode.removeChild(this); };
El.prototype.querySelector = function(){ return null; };
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function(){ return this._html; },
  set: function(v){ this._html = v; this.children = []; }
});
Object.defineProperty(El.prototype, 'offsetWidth', { get: function(){ return 0; } });

var store = {};
global.document = {
  getElementById: function(id){ return store[id] || (store[id] = new El('div')); },
  createElement: function(t){ return new El(t); },
  createElementNS: function(ns, t){ return new El(t); },
  querySelector: function(){ return null; }
};

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace('  init();\n})();',
  '  globalThis.__T = {\n' +
  '    units: function(){ return units },\n' +
  '    current: current, init: init, doAttack: doAttack, center: center,\n' +
  '    fxCount: function(){ return gFx.children.length },\n' +
  '    walk: function(fn){ (function go(a){ a.forEach(function(c){ fn(c); if (c.children) go(c.children) }) })(gFx.children); },\n' +
  '    hasFill: function(f){ var r = false; this.walk(function(c){ if (c.attrs.fill === f) r = true }); return r },\n' +
  '    hasClass: function(cl){ var r = false; this.walk(function(c){ if (c._cls && c._cls.has(cl)) r = true }); return r },\n' +
  '    countClass: function(cl){ var n = 0; this.walk(function(c){ if (c._cls && c._cls.has(cl)) n++ }); return n },\n' +
  '    floaters: function(){ var n = 0; this.walk(function(c){ if (c._cls && c._cls.has("floater")) n++ }); return n },\n' +
  '    shakeCount: function(){ return document.getElementById("field")._cls.has("shake") ? 1 : 0 },\n' +
  '    innerTf: function(u){ return u.inner ? u.inner.attrs.transform : null },\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function free(x, y){
  if (x < 0 || y < 0 || x > 14 || y > 10) return false;
  return !T.units().some(function(u){ return !u.dead && u.x === x && u.y === y; });
}
function place(u, x, y){ u.x = x; u.y = y; }

(async function(){
  console.log('--- 1. 初始状态 ---');
  ok('特效层初始为空', T.fxCount() === 0, T.fxCount());

  console.log('--- 2. 近战：命中帧前不出数字，命中帧后出刀光 ---');
  var pk = byId('A1'), imp = byId('E1');          // 枪兵 vs 魔童（打不死）
  place(pk, 5, 5); place(imp, 6, 5);
  var hp0 = imp.hp;
  T.doAttack(pk, imp, 0);
  ok('伤害立即结算（状态同步）', imp.hp < hp0, hp0 + ' -> ' + imp.hp);
  ok('出手瞬间还没有伤害数字', T.floaters() === 0, T.floaters());
  ok('出手瞬间没有刀光', T.countClass('fx-arc') === 0, T.countClass('fx-arc'));

  await sleep(60);
  var t1 = T.innerTf(pk);
  ok('攻击者正在向前顶', typeof t1 === 'string' && t1 !== 'translate(0,0)', t1);
  ok('位移朝向目标（x 为正）', /translate\(([0-9.]+),/.test(t1) && parseFloat(t1.split('(')[1].split(',')[0]) > 0, t1);

  await sleep(260);
  ok('命中后出现刀光', T.countClass('fx-arc') >= 2, T.countClass('fx-arc'));
  ok('命中后出现火花', T.countClass('fx-spark') >= 4, T.countClass('fx-spark'));
  ok('命中后出现伤害数字', T.floaters() >= 1, T.floaters());
  ok('攻击者已归位', T.innerTf(pk) === 'translate(0,0)', T.innerTf(pk));

  await sleep(1300);
  ok('特效自动清理干净', T.fxCount() === 0, T.fxCount());

  console.log('--- 3. 远程：先飞箭，命中后才结算画面 ---');
  var ar = byId('A2'), dog = byId('E2');
  place(ar, 1, 5); place(dog, 8, 5);
  T.doAttack(ar, dog, 0);
  ok('出手即有箭矢', T.hasFill('#e8e2cd'), 'no arrow');
  ok('箭矢带尾迹', T.hasClass('fx-trail'), T.countClass('fx-trail'));
  ok('远程出手不出刀光', T.countClass('fx-arc') === 0, T.countClass('fx-arc'));
  await sleep(120);
  var arrow = null;
  T.walk(function(c){ if (c.attrs && /rotate/.test(c.attrs.transform || '') && c.children.length === 3) arrow = c; });
  ok('箭矢在飞行中（有平移）', !!arrow && /translate\(([0-9.]+),/.test(arrow.attrs.transform), arrow && arrow.attrs.transform);
  await sleep(300);
  ok('远程命中出数字', T.floaters() >= 1, T.floaters());
  await sleep(1300);
  ok('远程特效清理', T.fxCount() === 0, T.fxCount());

  console.log('--- 4. 龙息：火焰锥 + 两处命中 ---');
  var dr = byId('A5'), imp2 = byId('E1'), horn = byId('E4');
  place(dr, 9, 5); place(imp2, 10, 5); place(horn, 11, 5);
  horn.hp = horn.maxHp; horn.dead = false; horn.count = Math.ceil(horn.hp / horn.perHp);
  var hpHorn = horn.hp, hpImp2 = imp2.hp;
  T.doAttack(dr, imp2, 0);
  ok('出现火焰锥（渐变填充）', T.hasFill('url(#fxFire)'), 'no breath');
  ok('龙息伤害立即结算', horn.hp < hpHorn, hpHorn + ' -> ' + horn.hp);
  ok('主目标同时受伤', imp2.hp < hpImp2, hpImp2 + ' -> ' + imp2.hp);
  await sleep(280);
  ok('龙息命中帧也有数字', T.floaters() >= 1, T.floaters());

  await sleep(1400);
  ok('龙息特效清理', T.fxCount() === 0, T.fxCount());

  console.log('--- 5. 阵亡：碎片与环 ---');
  var kn = byId('A4'), weak = byId('E3');
  place(kn, 5, 2); place(weak, 6, 2);
  weak.hp = 30;
  var deadBefore = weak.dead;
  T.doAttack(kn, weak, 0);
  ok('目标已判定阵亡', weak.dead === true && !deadBefore, weak.hp);
  await sleep(400);
  ok('出现阵亡特效', T.fxCount() > 0, T.fxCount());

  await sleep(1200);
  ok('最终清空', T.fxCount() === 0, T.fxCount());

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
