// 验证「点敌人 → 选位置 → 直接出手」的两步流程
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
  '    get order(){ return order }, get selected(){ return selected },\n' +
  '    current: current, key: key, dist: dist, neighbors: neighbors,\n' +
  '    computeOptions: computeOptions, onHexClick: onHexClick, onHexHover: onHexHover,\n' +
  '    hoverPreview: hoverPreview, approachOptions: approachOptions,\n' +
  '    damagePreview: damagePreview, calcDamage: calcDamage, init: init,\n' +
  '    get moveMap(){ return moveMap }, get atkSet(){ return atkSet },\n' +
  '    get approachMode(){ return approachMode },\n' +
  '    get chosenApproach(){ return chosenApproach },\n' +
  '    get hasMoved(){ return hasMoved },\n' +
  '    get pending(){ return pendingAttack },\n' +
  '    setPointer: function(p){ lastPT = p },\n' +
  '    setStepDelay: function(n){ stepDelay = n },\n' +
  '    breathInfo: breathInfo, breathHex: breathHex,\n' +
  '    get busy(){ return busy },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '    previewNodes: function(){ return gPrev.children },\n' +
  '  };\n  init();\n})();');

new Function(src)();
var T = globalThis.__T;
T.setStepDelay(0);   // 只验流程，走位动画同步走完

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function click(x, y){ T.onHexClick({ currentTarget: { dataset: { x: x, y: y } } }); }
function byId(id){ return T.units().filter(function(u){ return u.id === id; })[0]; }
function aliveSide(s){ return T.units().filter(function(u){ return !u.dead && u.side === s; }); }

var ROCKS = [[7,3],[8,7],[6,8],[9,2]];
function occ(x, y){
  return T.units().some(function(u){
    if (u.dead) return false;
    if (u.x === x && u.y === y) return true;
    if (u.size === 2) {
      var tx = u.side === 'us' ? u.x - 1 : u.x + 1;
      if (tx === x && u.y === y) return true;
    }
    return false;
  });
}
function free(x, y){
  if (ROCKS.some(function(r){ return r[0] === x && r[1] === y; })) return false;
  return !occ(x, y);
}

// 把某个敌人挪到"走得到但没贴身、且候选格成本不齐"的位置
function placeFoe(act, foe) {
  for (var y = 0; y < 11; y++) {
    for (var x = 0; x < 15; x++) {
      if (!free(x, y)) continue;
      if (x === act.x && y === act.y) continue;
      var save = [foe.x, foe.y];
      foe.x = x; foe.y = y;
      T.computeOptions(act);            // 先按新占位重算，否则拿到的是旧盘面的候选
      var o = T.approachOptions(act, foe);
      if (o.length > 1) {
        var cs = o.map(function(v){ return v.cost; });
        if (Math.min.apply(null, cs) !== Math.max.apply(null, cs)) {
          T.computeOptions(act);
          return o;
        }
      }
      foe.x = save[0]; foe.y = save[1];
    }
  }
  return null;
}

setTimeout(function(){
  console.log('--- 准备 ---');
  var a = T.current();
  ok('轮到我方', a && a.side === 'us', a ? a.name : 'null');
  T.setPointer('mouse');
  T.computeOptions(a);

  var foe = byId('E1');
  var opts = placeFoe(a, foe);
  ok('找到可测位置', !!opts, opts ? opts.length : 'null');
  console.log('  ' + a.name + ' (' + a.x + ',' + a.y + ') vs ' + foe.name +
    ' (' + foe.x + ',' + foe.y + ')，候选 ' + opts.length + ' 格');

  console.log('--- 1. 点敌人：只锁定目标并展开位置，不移动 ---');
  var p0 = { x: a.x, y: a.y }, hp0 = foe.hp;
  click(foe.x, foe.y);
  ok('没有移动', a.x === p0.x && a.y === p0.y, a.x + ',' + a.y);
  ok('没有造成伤害', foe.hp === hp0, foe.hp);
  ok('进入选位置模式', !!T.approachMode && T.approachMode.target === foe);
  ok('提示引导点格子出手', /出手/.test(T.hint()), T.hint());

  console.log('--- 2. 候选格：全部可达、各自成算 ---');
  ok('候选不止一个', opts.length > 1, opts.length);
  ok('每个候选都紧贴目标', opts.every(function(o){ return T.dist(o.x, o.y, foe.x, foe.y) === 1; }));
  ok('每个候选都不超速度', opts.every(function(o){ return o.cost > 0 && o.cost <= a.speed; }));
  ok('候选成本不全相同', (function(){
    var cs = opts.map(function(o){ return o.cost; });
    return Math.min.apply(null, cs) !== Math.max.apply(null, cs);
  })());
  var marks = T.previewNodes().filter(function(n){
    return n.tagName === 'polygon' && n._cls.has('approach-opt');
  });
  ok('预览画出全部候选格', marks.length === opts.length - 1, marks.length + '/' + opts.length);

  console.log('--- 3. 扫格子切换选定位置 ---');
  var far = opts[opts.length - 1];
  T.onHexHover(far.x, far.y);
  ok('选定格跟到扫到的格', T.chosenApproach === T.key(far.x, far.y), T.chosenApproach);
  var pvFar = T.damagePreview(a, foe);
  ok('预览按该格计算', pvFar.ap.x === far.x && pvFar.ap.y === far.y,
     pvFar.ap.x + ',' + pvFar.ap.y);
  var pvNear = T.damagePreview(a, foe, opts[0]);
  if (a.joust) {
    ok('冲锋单位：远格伤害更高', pvFar.r.max > pvNear.r.max,
       pvNear.r.max + ' vs ' + pvFar.r.max);
  } else {
    ok('非冲锋单位：伤害一致', pvFar.r.max === pvNear.r.max, pvFar.r.max);
  }

  console.log('--- 4. 点候选格：走位并立即出手（两步完成）---');
  click(far.x, far.y);
  ok('移动到所选格', a.x === far.x && a.y === far.y, a.x + ',' + a.y);
  ok('点格子后立刻造成伤害', foe.hp < hp0, hp0 + ' -> ' + foe.hp);
  ok('退出选位置模式', !T.approachMode);
  ok('落脚与选定一致', pvFar.ap.x === far.x && pvFar.ap.y === far.y);

  setTimeout(function(){
    console.log('--- 5. 重开测：再点同一敌人 = 用最省格出手 ---');
    T.init();
    var tries = 0;
    var timer = setInterval(function(){
      var b = T.current();
      if (b && b.side === 'us') { clearInterval(timer); second(b); return; }
      if (++tries > 80) { clearInterval(timer); console.log('  超时'); done(); }
    }, 80);
  }, 900);
}, 1400);

function second(b) {
  T.setPointer('mouse');
  T.computeOptions(b);
  var foe2 = aliveSide('them')[0];
  var opts2 = placeFoe(b, foe2);
  if (!opts2) { console.log('  跳过（找不到位置）'); done(); return; }
  console.log('  ' + b.name + ' (' + b.x + ',' + b.y + ') vs ' + foe2.name +
    ' (' + foe2.x + ',' + foe2.y + ')，候选 ' + opts2.length + ' 格');

  var bb = { x: b.x, y: b.y }, hp2 = foe2.hp;
  click(foe2.x, foe2.y);
  ok('第一下不移动', b.x === bb.x && b.y === bb.y, b.x + ',' + b.y);
  ok('第一下不掉血', foe2.hp === hp2, foe2.hp);

  click(foe2.x, foe2.y);
  ok('第二下真的走了', b.x !== bb.x || b.y !== bb.y, b.x + ',' + b.y);
  ok('落到最省的那格', T.key(b.x, b.y) === T.key(opts2[0].x, opts2[0].y),
     T.key(b.x, b.y) + ' vs ' + T.key(opts2[0].x, opts2[0].y));
  ok('第二下就出手', foe2.hp < hp2, hp2 + ' -> ' + foe2.hp);

  setTimeout(function(){
    console.log('--- 6. 触屏：点格子后仍要确认 ---');
    T.init();
    var n = 0;
    var t2 = setInterval(function(){
      var c = T.current();
      if (c && c.side === 'us') { clearInterval(t2); touch(c); return; }
      if (++n > 80) { clearInterval(t2); console.log('  超时'); done(); }
    }, 80);
  }, 900);
}

function touch(c) {
  T.setPointer('touch');
  T.computeOptions(c);
  var foe = aliveSide('them')[0];
  var opts = placeFoe(c, foe);
  if (!opts) { console.log('  跳过'); done(); return; }

  var hp = foe.hp, before = { x: c.x, y: c.y };
  click(foe.x, foe.y);
  ok('触屏第一次点敌人：进选位', !!T.approachMode && !T.pending);
  click(opts[0].x, opts[0].y);
  ok('触屏点格子：先不移动，等确认', c.x === before.x && c.y === before.y, c.x + ',' + c.y);
  ok('触屏点格子：不直接掉血', foe.hp === hp, foe.hp);
  ok('触屏弹出确认条', !!T.pending && document.getElementById('confirmBar').classList.contains('show'));
  ok('确认条写明出发点', /从 \(/.test(document.getElementById('confirmText').innerHTML),
     document.getElementById('confirmText').innerHTML);

  document.getElementById('cfNo').listeners.click[0]();
  ok('取消后回到选位模式', !!T.approachMode && !T.pending,
     T.approachMode ? 'selection' : 'null');
  ok('取消后原地未动', c.x === before.x && c.y === before.y, c.x + ',' + c.y);

  click(opts[0].x, opts[0].y);
  click(foe.x, foe.y);
  ok('确认后才出手', foe.hp < hp, hp + ' -> ' + foe.hp);
  ok('确认后站到选定格', c.x === opts[0].x && c.y === opts[0].y, c.x + ',' + c.y);
  ok('清理待确认', !T.pending);
  done();
}

function done() {
  setTimeout(function(){
    console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  }, 400);
}
