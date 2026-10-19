// 验证：选位模式的遮罩 / 每个候选格的方向箭头 / 龙息"打2只"的角标
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
  '    current: current, init: init, render: render, key: key, dist: dist,\n' +
  '    computeOptions: computeOptions, onHexClick: onHexClick, onHexHover: onHexHover,\n' +
  '    hoverPreview: hoverPreview, approachOptions: approachOptions,\n' +
  '    damagePreview: damagePreview, breathInfo: breathInfo, calcDamage: calcDamage,\n' +
  '    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },\n' +
  '    setStepDelay: function(n){ stepDelay = n },\n' +
  '    get approachMode(){ return approachMode },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '    previewNodes: function(){ return gPrev.children },\n' +
  '    viewSize: function(){ return { w: VW, h: VH } },\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;
T.setStepDelay(0);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function click(x, y){ T.onHexClick({ currentTarget: { dataset: { x: x, y: y } } }); }
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function nodes(){ return T.previewNodes(); }
function shields(){ return nodes().filter(function(n){ return n.tagName === 'rect' && +n.attrs.width > 600; }); }
function dirTicks(){ return nodes().filter(function(n){ return n.tagName === 'line' && n.attrs['marker-end'] === 'url(#dirArrow)'; }); }
function twoTags(){ return nodes().filter(function(n){
  return n.tagName === 'g' && n.children.some(function(c){ return c.textContent === '2'; });
}); }

(function(){
  console.log('--- 1. 点敌人进入选位：全场压暗 + 每个候选格一条方向箭头 ---');
  T.init();
  var pk = byId('A1'), imp = byId('E1');
  pk.x = 1; pk.y = 5; imp.x = 5; imp.y = 5;
  T.forceTurn(pk);
  T.render();
  ok('还没点敌人：没有遮罩', shields().length === 0);
  var opts = T.approachOptions(pk, imp);
  ok('目标有多个候选落脚格', opts.length >= 1, opts.length);
  click(imp.x, imp.y);
  ok('进入选位模式', !!T.approachMode, T.approachMode ? 'picking' : 'null');
  var sh = shields();
  ok('出现全场遮罩', sh.length === 1, sh.length);
  ok('遮罩铺满整个战场', sh[0] && +sh[0].attrs.width === T.viewSize().w && +sh[0].attrs.height === T.viewSize().h,
    sh[0] && (sh[0].attrs.width + 'x' + sh[0].attrs.height));
  ok('遮罩不吃点击', sh[0] && sh[0].attrs['pointer-events'] === 'none');
  ok('遮罩是压暗不是盖死', sh[0] && +sh[0].attrs.opacity < 0.6, sh[0] && sh[0].attrs.opacity);
  ok('候选格数量 = 方向箭头数量', dirTicks().length === opts.length,
    dirTicks().length + ' vs ' + opts.length);
  ok('方向箭头用的是专用小箭头', nodes().some(function(n){
    return n.tagName === 'line' && n.attrs['marker-end'] === 'url(#dirArrow)';
  }));

  console.log('--- 2. 龙息：能烧到第二个单位的候选格，盖「2」角标 ---');
  T.init();
  var dr = byId('A5'), dog = byId('E2'), archer = byId('A1');
  dr.x = 6; dr.y = 5;                    // 龙头 6，尾 5；站这里够不到犬
  dog.x = 9; dog.y = 5;                  // 犬头 9，尾 10
  archer.x = 11; archer.y = 5;           // 站犬身后，会被龙息烧到
  T.forceTurn(dr);
  T.hoverPreview(dog);
  ok('只有一个目标的预览不画遮罩', shields().length === 0);
  ok('出现「2」角标（能打两只）', twoTags().length >= 1, twoTags().length);
  ok('角标标在能烧到第二个的格子上', (function(){
    var bi = T.breathInfo(dr, { x: 8, y: 5 }, dog, 0);
    return !!bi && !!bi.unit && bi.unit === archer;
  })(), 'breathInfo 应指到枪兵');

  console.log('--- 3. 烧不到第二个时不该有角标 ---');
  T.init();
  dr = byId('A5'); dog = byId('E2'); archer = byId('A1');
  dr.x = 6; dr.y = 5; dog.x = 9; dog.y = 5;
  archer.x = 0; archer.y = 10;           // 挪走，龙息后面没人
  T.forceTurn(dr);
  T.hoverPreview(dog);
  ok('身后无人：没有「2」角标', twoTags().length === 0, twoTags().length);

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
})();
