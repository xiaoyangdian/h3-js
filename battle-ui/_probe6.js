// 验证：双格生物（size 2）的占位 / 尾巴方向 / 寻路 / 贴身判定 / 龙息打穿
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
  '    current: current, init: init, key: key, dist: dist, neighbors: neighbors,\n' +
  '    unitAt: unitAt, isRock: isRock, computeOptions: computeOptions,\n' +
  '    approachOptions: approachOptions, breathInfo: breathInfo, breathHex: breathHex,\n' +
  '    damagePreview: damagePreview, canStrikeNow: canStrikeNow,\n' +
  '    isWide: isWide, tailHex: tailHex, coversHex: coversHex, cellsOf: cellsOf,\n' +
  '    unitDist: unitDist, canStand: canStand, bfsPath: bfsPath, fitDir: fitDir, dirOf: dirOf,\n' +
  '    setStep: function(v){ stepDelay = v },\n' +
  '    get moveMap(){ return moveMap }, get atkSet(){ return atkSet },\n' +
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
function park(id, x, y){ var u = byId(id); u.x = x; u.y = y; return u; }

(function(){
  console.log('--- 1. 哪些是双格：按阵营固定尾巴方向 ---');
  var dr = byId('A5'), dog = byId('E2'), pk = byId('A1');
  ok('绿龙是双格', T.isWide(dr) === true);
  ok('恶魔犬是双格', T.isWide(dog) === true);
  ok('枪兵是单格', T.isWide(pk) === false);
  place(dr, 3, 6);
  ok('我方尾巴在左：绿龙 (3,6) 尾 = (2,6)', String(T.tailHex(dr, 3, 6)) === '2,6', T.tailHex(dr, 3, 6));
  place(dog, 12, 2);
  ok('敌方尾巴在右：恶魔犬 (12,2) 尾 = (13,2)', String(T.tailHex(dog, 12, 2)) === '13,2', T.tailHex(dog, 12, 2));
  ok('单格没有尾巴', T.tailHex(pk, 3, 6) === null);

  console.log('--- 2. 占位：两格都算这个单位 ---');
  ok('头格能查到', T.unitAt(3, 6) === dr);
  ok('尾巴格也能查到', T.unitAt(2, 6) === dr);
  ok('邻居格查不到', T.unitAt(3, 7) !== dr);
  ok('coversHex 认尾巴', T.coversHex(dr, 2, 6) === true);
  ok('cellsOf 返回两格', T.cellsOf(dr).length === 2, JSON.stringify(T.cellsOf(dr)));

  console.log('--- 3. 距离：贴身 = 到任意一格距离 1 ---');
  var t1 = { x: 2, y: 5, side: 'them', size: 1 };
  ok('贴尾巴也算相邻', T.unitDist(dr, t1) === 1, T.unitDist(dr, t1));
  var t2 = { x: 1, y: 5, side: 'them', size: 1 };
  ok('离尾巴一格 = 距离 1', T.unitDist(dr, t2) === 1, T.unitDist(dr, t2));
  var t3 = { x: 1, y: 4, side: 'them', size: 1 };
  ok('更远就是 2', T.unitDist(dr, t3) === 2, T.unitDist(dr, t3));

  console.log('--- 4. 站位：双格单位能原地扭头，只要有一侧放得下 ---');
  T.init(); T.setStep(0);
  dr = byId('A5');
  place(dr, 3, 6);
  ok('贴着左边界也能站（尾巴甩到右边）', T.canStand(dr, 0, 6, dr) === true);
  var ally = byId('A1');
  place(ally, 2, 6);                       // 占住默认那一侧的尾巴格
  ok('一侧被占还能转身站（尾巴甩到另一侧）', T.canStand(dr, 3, 6, dr) === true);
  ok('转身后的朝向是 +1（尾巴在右）', T.fitDir(dr, 3, 6, dr) === 1, T.fitDir(dr, 3, 6, dr));
  var ally2 = byId('A3');
  place(ally2, 4, 6);                      // 另一侧也堵死
  ok('两侧都被堵才是真的站不下', T.canStand(dr, 3, 6, null) === false);
  place(ally, 2, 5); place(ally2, 1, 8);   // 挪开
  ok('自己占的两格不会挡自己', T.canStand(dr, 3, 6, dr) === true);

  console.log('--- 5. 移动范围：双格要整个身子过得去 ---');
  T.init(); T.setStep(0);
  dr = byId('A5'); pk = byId('A1');
  place(dr, 5, 6); place(pk, 3, 6);         // 枪兵堵住 (3,6)
  T.computeOptions(dr);
  ok('(4,6) 左边被堵，但能扭头站 → 可达', T.moveMap.has('4,6'), T.moveMap.get('4,6'));
  ok('(5,7) 这种尾巴空着的正常可达', T.moveMap.has('5,7'), T.moveMap.get('5,7'));
  ok('最左列能站（尾巴甩到右边）', T.moveMap.has('0,6') || T.moveMap.has('0,7'), '0,6=' + T.moveMap.get('0,6'));

  console.log('--- 6. 双格目标的进攻位置 = 两格外圈的并集 ---');
  T.init(); T.setStep(0);
  dr = byId('A5'); dog = byId('E2');
  place(dr, 6, 6); place(dog, 9, 5);
  T.computeOptions(dr);
  var opts = T.approachOptions(dr, dog);
  ok('候选不止贴身那几个', opts.length >= 4, opts.length);
  ok('每个候选都贴住目标两格之一', opts.every(function(o){
    return T.dist(o.x, o.y, dog.x, dog.y) === 1 || T.dist(o.x, o.y, dog.x + 1, dog.y) === 1;
  }), JSON.stringify(opts.map(function(o){ return o.x + ',' + o.y; })));
  ok('候选不会落在目标自己身上', opts.every(function(o){
    return !T.coversHex(dog, o.x, o.y);
  }));

  console.log('--- 7. 龙息打穿：越过整个身子再烧一格 ---');
  T.init(); T.setStep(0);
  dr = byId('A5'); dog = byId('E2'); pk = byId('A1');
  place(dr, 8, 5); place(dog, 9, 5); place(pk, 11, 5);   // 犬头 9 尾 10，枪兵在 11
  T.computeOptions(dr);
  var bi = T.breathInfo(dr, { x: 8, y: 5 }, dog, 0);
  ok('龙息格 = 越过犬身之后的 (11,5)', bi && String(bi.hex) === '11,5', bi && bi.hex);
  ok('烧到的是枪兵', bi && bi.unit === pk, bi && bi.unit && bi.unit.name);
  ok('单格目标仍是老规则', (function(){
    dog.dead = true;                               // 临时摘掉，用单格魔童
    var imp = byId('E1'); imp.dead = false;
    place(imp, 9, 5);
    var b2 = T.breathInfo(dr, { x: 8, y: 5 }, imp, 0);
    dog.dead = false;
    return b2 && String(b2.hex) === '10,5';
  })());

  console.log('--- 7b. 龙息方向跟着攻击线走，不能被目标身子带偏 ---');
  T.init(); T.setStep(0);
  dr = byId('A5'); dog = byId('E2'); imp = byId('E1');
  // 斜着打双格犬的尾巴：(13,4) → 犬尾(12,5) → 顺斜线穿到 (12,6)
  place(dr, 13, 4); place(dog, 11, 5); place(imp, 12, 6);
  var b3 = T.breathInfo(dr, { x: 13, y: 4 }, dog, 0);
  ok('斜向穿双格：龙息格 = (12,6)', b3 && String(b3.hex) === '12,6', b3 && b3.hex);
  ok('穿到身后的魔童', b3 && b3.unit === imp, b3 && b3.unit && b3.unit.name);
  ok('没有横着穿成 (10,5)', !b3 || String(b3.hex) !== '10,5', b3 && b3.hex);

  T.init(); T.setStep(0);
  dr = byId('A5'); imp = byId('E1');
  place(dr, 10, 7); place(imp, 11, 6);
  var b4 = T.breathInfo(dr, { x: 10, y: 7 }, imp, 0);
  ok('斜向单格：龙息格 = (11,5)', b4 && String(b4.hex) === '11,5', b4 && b4.hex);

  console.log('--- 8. 渲染：双格画成横跨两格的胶囊 ---');
  T.init(); T.setStep(0);
  dr = byId('A5');
  var bodyEl = dr.el.children[0].children[0];
  ok('绿龙身体是 rect', bodyEl.tagName === 'rect', bodyEl.tagName);
  ok('胶囊宽度 > 单格 30', parseFloat(bodyEl.attrs.width) > 30, bodyEl.attrs.width);
  var pkBody = byId('A1').el.children[0].children[0];
  ok('枪兵仍是 circle', pkBody.tagName === 'circle', pkBody.tagName);

  console.log('--- 9. 初始阵容不能有重叠 ---');
  T.init(); T.setStep(0);
  var bad = [];
  T.units().forEach(function(a, i){
    T.units().forEach(function(b, j){
      if (i >= j || a.dead || b.dead) return;
      var hit = T.cellsOf(a).some(function(c){ return T.coversHex(b, c[0], c[1]); });
      if (hit) bad.push(a.id + '/' + b.id);
    });
  });
  ok('没有互相压住', bad.length === 0, bad.join(' '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
})();
