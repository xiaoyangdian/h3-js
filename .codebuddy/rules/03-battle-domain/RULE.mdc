---
description: 战斗原型（battle-ui/）与探针（_probe*.js）的仓库约定
alwaysApply: false
enabled: true
updatedAt: 2026-10-20T00:00:00.000Z
provider:
---

# 战斗原型与探针约定

## 重要度标记（怎么读这份规则）

- P0=违反即整轮作废 / 必须停下返工；P1=影响质量与耗时，默认遵守；P2=细节取舍，有余力才做。精力按 P0 > P1 > P2 分。
- P0 条目：单文件结构锚点（`init(); })();` 注入面）、`ROSTER` 只加字段不增删、数值改动必须有出处、棋盘常量与探针几何断言联动、CRLF。

## battle-ui/index.html（单文件静态页）

- `[P2]` **结构**：一个 HTML 文件，样式在 `<style>`，逻辑在一个 `<script>` 的 IIFE 里（`(function(){ … init(); })();`），收尾就是 `<body>` 里的 SVG 容器与按钮。无模块、无 import、无构建。
- `[P0]` **注入锚点不能改形状**：16 套探针都靠 `src.replace('  init();\n})();', …)` 把内部符号挂到 `globalThis.__T`。**不得改变 `init();` 与 `})();` 之间的字面形状**（缩进、换行、顺序）；确需改结构时，必须同步改 16 个探针文件的注入串，并在复述中单列。
  - **加导出面不必动锚点**：新的内部引用优先在 `init()` 里由 `attachTestHooks()` 补挂到探针自建的 `globalThis.__T` 上（浏览器无 `__T` 时自动跳过）。只在锚点字面形状真的被改动时，才需要同步 16 套探针。
- `[P1]` **暴露面即测试契约**：`__T` 暴露的函数与 getter（`units` / `order` / `current` / `computeOptions` / `doAttack` / `damagePreview` / `breathInfo` / `walkTo` / `endActor` / `busy` / `moveMap` / `atkSet` 等）是探针唯一的观察口。重命名 / 移除会打断探针；确实要改时先 `grep -l "__T" battle-ui/_probe*.js` 看影响面。
- `[P2]` **棋盘常量**：`W=15, H=11, SIZE=24, PAD=12`，`ROCKS=[[7,3],[8,7],[6,8],[9,2]]`。改尺寸 / 改障碍会同时影响寻路、坐标换算、几何断言、初始站位合法性——属于大改动，先出影响面。
- `[P2]` **行动流**：`startRound()` → `nextActor()` → `playerTurn` / `aiAct` → `endActor()`（防御 `btnDefend`、等待 `btnWait`、50 回合 HP 判定兜底在 `checkEnd` / `finish`）。
- `[P0]` **流程定时器必须登记**：所有战斗流程延时走 `later()`（自动压 `quickMode` 的 0 延迟并登记进 `flowTimers`），`init()` 里 `clearFlowTimers()` 清干净。新加的延时若直接 `setTimeout`，旧战斗的 `aiAct` 会抢走 `turnClaimed` 把新一手卡死（`_probe13` 实测过 stall）。
- `[P1]` **演出与结算分离**：结算先于动画（状态同步落地），画面只按命中帧补表现（`fxLunge` / `fxSlash` / `fxProjectile` / `fxBreath` / `fxDeath`，命中帧前不出数字）。新增演出必须遵守"数字不早于命中帧"的时序。
- `[P1]` **禁局部滚动**见 `02-redlines`；棋盘是 SVG 定尺寸绘制（`VW`/`VH` 由常量算出），不得改成容器内滚动裁切。

## battle-ui/_probe*.js（零依赖探针）

- `[P2]` **结构**：`require('fs')` 读 `index.html` → 取 `<script>` 内容 → 字面量注入 `__T` → 自定义最小 DOM 桩 `El` + `store` → 逐节 `assert` 输出 PASS/FAIL。只用 Node 内置模块。
- `[P0]` **测试桩的四个坑（都踩过，别重犯）**：
  1. `El` 必须有 `firstChild` / `lastChild` 访问器，否则 `log()` 裁日志（>60 条）走 `removeChild(undefined)` 抛错，会掐死战斗流程（曾表现为第 12 回合卡死）；
  2. 假时钟必须连 `Date.now` 一起接，否则 tween 动画帧无限续期，计时队列被吃穿；
  3. `init()` 不重置 `stepDelay` / `FX_ON`（否则冲掉测试的同步走位设置）——新增初始化不要顺手把它们归零；
  4. 旧战斗流程定时器要登记进 `flowTimers` 并在 `init` 清干净。
- `[P1]` **逐套跑、报总数**：交付前 `for f in battle-ui/_probe*.js; do node "$f"; done`，基线 **586 项 / 16 套全过**；只跑一套不算验证（`02-redlines`「探针不许减断言」）。
- `[P1]` **新切片开新套件**：按功能命名递增（当前到 `_probe13.js`），不要把新断言硬塞进无关文件；概率类行为（士气 / 恐惧 / 幸运）必须注入受控随机数，不许依赖真实随机。
- `[P2]` **断言写法**：一条断言一个事实，报错带"期望 / 实际 / 触发前置条件"；条件未触发（状态没走到）要在输出里标出，不能沉默跳过。

## 数值与规则数据

- `[P0]` **每个数值改动都要有出处或明确标注**：乘子、封顶封底、概率分母、掷骰粒度、兵种属性——要么在 `参考资料.md` §2 找到 `来源 + 文件:行`，要么明说"原型自定"并记进 §4 偏差清单。伤害公式现状：`DMGf = DMGb × (1+I1+I4+I5) × (1-R1) × (1-R5)`（§2.6）。
- `[P1]` **已知缺口**：I2 箭术 / I3 进攻术、R6–R8（城墙 / 失明 / 石化）未实现；士气、恐惧未实现。要补时先看 `交接文档.md` §3.1 语义表（含两处不对称：好士气在**行动后**追加、坏士气在**回合开始**冻结；负值概率翻倍）。
- `[P0]` **`ROSTER` 不增删单位，特性写进图鉴**：`_probe.js` 断言恰好 9 支部队，`byId('A1'…'E4')` 遍布 16 套件。加特性 = 往 `BESTIARY` 图鉴加一条物种条目（`applyTraits` 负责摊平到单位），保持 id 与数量不变；确需增删单位时先出影响面并获确认。
- `[P0]` **英雄数值是"加进攻防"，且必须留裸值**：`u.att = u.baseAtt + HEROES[side].attack`（`def` 同理），进 I1/R1；不是乘在伤害上。直接改 `u.att` 会让加成在反复调参时累加。`HEROES` 是局外配置，`init()`（重开一局）不重置它，归零用 `resetHeroes()`；默认全 0 = 没有英雄，此时部队数值与引入前逐位相同。
- `[P0]` **规则随机只能走 `rand()`**：掷骰 / 幸运 / 士气 / 恐惧一律走 `rand()`，**特效**随机（粒子、飞行弧线）才用 `Math.random`。概率断言不许靠真随机：探针用 `setRand(fn)` 注入定值或序列，用 `seedRand(seed)` 复现一局。时间毫秒只能当**种子**，不能直接拿来判定概率。
- `[P0]` **士气/恐惧的时机不能挪**：好士气在行动**后**掷、且仅 `actsThisTurn === 1`（追加的行动不再掷）；坏士气与恐惧在回合**开始**掷，触发即冻结丢整轮。"开始一手"只能走 `beginHand(act, actsThisTurn)`——正常回合传 1、好士气追加传 2。追加行动是完整一次行动，但**不回满反击额度**（反击按回合计）。
- `[P1]` **数值来源**：真实兵种数值应从 S1 `databank` 导出（`交接文档.md` 支线"数值导出"），当前 `ROSTER` 是手写近似值——新增兵种属性时优先沿用已有字段风格，不要自造命名体系。

## 文档联动

- `[P1]` 改动涉及"原版语义"→ 同步 `参考资料.md`（§2 出处表 / §4 偏差 / §6 勘误）。
- `[P1]` 改动涉及进度与路线 → 同步 `交接文档.md` §3（已做 / §3.1 语义表 / 待做表）。
- `[P2]` 改动涉及交互或玩法取舍 → `简化玩法设计.md` 对应小节（§3.12 的三条硬规则：自动与手动同规则、自动结果可手动覆盖、分流点在行程表）。

## 第三方参考源码（`Core/` `Workbench/` `h3m2json/`）

- `[P0]` 只读，不改不提交（见 `02-redlines`「第三方源码只读」）。
- `[P2]` 常用查阅点：`Core/client/H3.Combat.js`（战场、寻路、伤害、tactics）、`Core/client/H3.Rules.RPC.js`（特性语义、士气、环攻）、`Core/databank-creatures.php:720-843`（特性结构表）、`Core/databank-spells.php`（法术数据）、`Core/databank-artifacts.php`（道具）、`Core/databank-skills.php`（技能）。
- `[P1]` 引用前先 `grep -n "<符号名>"` 复核行号；S4（VCMI）行号必定漂，只认符号名。

## 本地环境

- `[P2]` 打开：直接双击 `battle-ui/index.html`（无需服务器）。
- `[P2]` 测试：Node 22.x 实测可用；`node battle-ui/_probe.js`。
- `[P1]` 换行：`.gitattributes` 钉 `eol=lf`；探针已用 `src.replace(/\r\n/g,'\n')` 兜底，新增读取 HTML 的脚本必须同样处理。
