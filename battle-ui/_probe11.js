// _probe11：贴身时也必须能选方向/站位，并且龙息要看得见
// 用户反馈：「龙贴身的时候无法选择方向和站位,只能在原地打,也没有龙炎」
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
  '    units: function(){ return units }, current: current, init: init, render: render, key: key,\n' +
  '    computeOptions: computeOptions, onHexClick: onHexClick, onHexHover: onHexHover,\n' +
  '    approachOptions: approachOptions, damagePreview: damagePreview, breathInfo: breathInfo,\n' +
  '    calcDamage: calcDamage, selfSpot: selfSpot, unitDist: unitDist, cellsOf: cellsOf, dirOf: dirOf,\n' +
  '    forceTurn: function(u){ order.length = 0; order.push(u.id); nextActor(); },\n' +
  '    setStepDelay: function(n){ stepDelay = n }, setPointer: function(p){ lastPT = p },\n' +
  '    hoverPreview: hoverPreview, renderPreview: renderPreview,\n' +
  '    chooseSpot: function(k){ chosenApproach = k; },\n' +
  '    get approachMode(){ return approachMode },\n' +
  '    get hasMoved(){ return hasMoved },\n' +
  '    hint: function(){ return document.getElementById("hint").textContent },\n' +
  '    log: function(){ return document.getElementById("log") ? document.getElementById("log").innerHTML : "" },\n' +
  '    previewNodes: function(){ return gPrev.children },\n' +
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
function breathHexes(){ return nodes().filter(function(n){ return n._cls && n._cls.has('breath'); }); }
function twoTags(){
  return nodes().filter(function(n){
    return n.tagName === 'g' && n.children.some(function(c){
      return c.tagName === 'text' && c.textContent === '2';
    });
  });
}
function park(id, x, y){ var u = byId(id); if (u) { u.x = x; u.y = y; u.dead = false; } }
function clearBoard(keep){
  [['A1',0,10],['A2',0,0],['A3',14,0],['A4',14,10],['A5',14,8],['E1',2,10],['E3',14,1],['E4',13,9]]
    .forEach(function(p){ if (keep.indexOf(p[0]) < 0) park(p[0], p[1], p[2]); });
}

(async function(){
  console.log('--- 1. 贴身点敌人：先展开候选，不再直接出手 ---');
  T.init(); T.setStepDelay(0);
  var dr = byId('A5'), dog = byId('E2'), imp = byId('E1');
  clearBoard(['A5', 'E2']);
  dog.x = 7; dog.y = 5; dog.dir = 1;             // 犬：头 7,5 尾 8,5
  dr.x = 9; dr.y = 5; dr.dir = 1;   // 龙占 (9,5)+(10,5)，头贴着犬的尾巴               // 龙：头 9,5 尾 8,5 → 已经贴身
  ok('龙确实贴着犬', T.unitDist(dr, dog) === 1, T.unitDist(dr, dog));
  T.forceTurn(dr);
  var hp0 = dog.hp;
  click(dog.x, dog.y);
  ok('第一次点敌人不会立刻掉血', dog.hp === hp0, hp0 + ' -> ' + dog.hp);
  ok('进入了选位模式', !!T.approachMode, String(T.approachMode));
  ok('提示写清了可选位置', T.hint().indexOf('位置可选') >= 0 || T.hint().indexOf('个位置') >= 0, T.hint());

  console.log('--- 2. 贴身的候选里，原地只是其中一个 ---');
  var opts = T.approachOptions(dr, dog);
  ok('候选不止一个', opts.length > 1, opts.length);
  var self = opts.filter(function(o){ return o.cost === 0 && T.cellsOf(dr).some(function(c){ return c[0] === o.x && c[1] === o.y; }); });
  ok('其中包含"原地打"（cost 0）', self.length >= 1, JSON.stringify(opts.map(function(o){ return o.x + ',' + o.y + ':' + o.cost; })));
  var away = opts.filter(function(o){ return o.cost > 0; });
  ok('也包含走一步换个方向的站位', away.length >= 1, away.length);

  console.log('--- 3. 预览层：遮罩 / 方向箭头 / 龙息格 都要有 ---');
  T.render();
  ok('有全场遮罩', shields().length === 1, shields().length);
  ok('每个候选格都有方向箭头', dirTicks().length >= opts.length, dirTicks().length + ' vs ' + opts.length);

  console.log('--- 4. 把"童"放到龙息落点：贴身也要能烧到第二只 ---');
  // 找一对（站位 → 龙息格），把童摆到那个龙息格上
  var pick = null;
  opts.forEach(function(o){
    if (pick) return;
    var bi = T.breathInfo(dr, { x: o.x, y: o.y, dir: o.dir }, dog, o.cost);
    if (bi && bi.hex && !T.cellsOf(dog).some(function(c){ return c[0] === bi.hex[0] && c[1] === bi.hex[1]; })) {
      pick = { o: o, bi: bi };
    }
  });
  ok('至少有一个站位能算出"身后那格"', !!pick, pick && (pick.o.x + ',' + pick.o.y));
  var kid = byId('E1');
  kid.x = pick.bi.hex[0]; kid.y = pick.bi.hex[1];
  T.forceTurn(dr);
  click(dog.x, dog.y);                      // 重新进选位，让预览看见童
  var pv = T.damagePreview(dr, dog, pick.o);
  ok('预览里龙息指向童', !!pv.breath && pv.breath.unit === kid,
     pv.breath && (pv.breath.hex.join(',') + ' → ' + (pv.breath.unit ? pv.breath.unit.name : '空')));
  T.chooseSpot(T.key(pick.o.x, pick.o.y));
  T.renderPreview();
  ok('预览画出龙息格', breathHexes().length >= 1, breathHexes().length);
  ok('能烧到第二只时盖「2」角标', twoTags().length >= 1, twoTags().length);

  var dogHp = dog.hp, kidHp = kid.hp;
  click(pick.o.x, pick.o.y);                // 从那个站位出手
  ok('犬掉血', dog.hp < dogHp, dogHp + ' -> ' + dog.hp);
  ok('童也被龙息烧到', kid.hp < kidHp, kidHp + ' -> ' + kid.hp);

  console.log('--- 5. 换个站位 = 龙息落在另一格（方向真的可选）');
  T.init(); T.setStepDelay(0);
  dr = byId('A5'); dog = byId('E2'); imp = byId('E1');
  clearBoard(['A5', 'E2', 'E1']);
  dog.x = 7; dog.y = 5; dog.dir = 1;
  dr.x = 9; dr.y = 5; dr.dir = 1;   // 龙占 (9,5)+(10,5)，头贴着犬的尾巴
  park('E1', 0, 0);
  T.forceTurn(dr);
  var o2 = T.approachOptions(dr, dog);
  var spots = {};
  o2.forEach(function(o){
    var bi = T.breathInfo(dr, { x: o.x, y: o.y, dir: o.dir }, dog, o.cost);
    if (bi && bi.hex) spots[T.key(bi.hex[0], bi.hex[1])] = 1;
  });
  ok('不同站位烧到不同的格子', Object.keys(spots).length > 1, Object.keys(spots).join(' '));

  console.log('--- 6. 点自己 = 原地打（贴身也要能"就这么打"）');
  T.init(); T.setStepDelay(0);
  dr = byId('A5'); dog = byId('E2');
  clearBoard(['A5', 'E2']);
  dog.x = 7; dog.y = 5; dog.dir = 1;
  dr.x = 9; dr.y = 5; dr.dir = 1;   // 龙占 (9,5)+(10,5)，头贴着犬的尾巴
  T.forceTurn(dr);
  click(dog.x, dog.y);                      // 进入选位
  var hpA = dog.hp;
  click(dr.x, dr.y);                        // 点自己 = 原地
  ok('点自己直接按原地出手', dog.hp < hpA || T.hasMoved === true, dog.hp + ' / hasMoved=' + T.hasMoved);

  console.log('--- 7. 远程站桩射击仍然是一点就打 ---');
  T.init(); T.setStepDelay(0);
  var ar = byId('A2');
  clearBoard(['A2', 'E2']);
  dr = byId('A5'); dr.x = 14; dr.y = 10;
  ar.x = 2; ar.y = 5;
  var dog2 = byId('E2'); dog2.x = 8; dog2.y = 5; dog2.dir = 1;
  T.forceTurn(ar);
  ok('弓手可以射', T.approachOptions(ar, dog2).length === 1);
  var hpB = dog2.hp;
  click(dog2.x, dog2.y);
  ok('点一下立刻射击', dog2.hp < hpB, hpB + ' -> ' + dog2.hp);

  console.log('--- 8. 非龙息近战也一样：贴身点敌人 = 先选站位 ---');
  T.init(); T.setStepDelay(0);
  var kn = byId('A4'), dog3 = byId('E2');
  clearBoard(['A4', 'E2']);
  dog3.x = 7; dog3.y = 5; dog3.dir = 1;
  kn.x = 6; kn.y = 5; kn.dir = -1;          // 占 (6,5)+(5,5)，头 6,5 贴着犬
  T.forceTurn(kn);
  ok('骑士确实贴身', T.unitDist(kn, dog3) === 1, T.unitDist(kn, dog3));
  var hpC = dog3.hp;
  click(7, 5);
  ok('第一下不掉血（先让玩家挑站位）', dog3.hp === hpC, hpC + ' -> ' + dog3.hp);
  ok('进入选位模式', !!T.approachMode, String(T.approachMode));
  var opts3 = T.approachOptions(kn, dog3);
  ok('候选里包含"原地"', opts3.some(function(o){ return o.cost === 0; }), opts3.length);
  ok('候选里包含"走一步换边"', opts3.some(function(o){ return o.cost > 0; }), opts3.length);
  var mv = opts3.filter(function(o){ return o.cost > 0; })[0];
  var hpD = dog3.hp;
  click(mv.x, mv.y);
  ok('点候选格 = 从那一格出手', dog3.hp < hpD, hpD + ' -> ' + dog3.hp);
  ok('确实站到了选的那格', T.cellsOf(kn).some(function(c){ return c[0] === mv.x && c[1] === mv.y; }),
     T.cellsOf(kn).join('|'));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
