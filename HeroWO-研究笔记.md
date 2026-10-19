# HeroWO.js 研究笔记

> 拉取时间：2026-10-19 · 位置：`D:\d\file\HeroWO\`
> 一句话：**HeroWO.js 是《英雄无敌 III》(HoMM3) 的浏览器端 JS 重实现**（不是英雄无敌 2），JS + PHP 约 10 万行，Unlicense（公有领域）。公开代码在 2023 年 5 月后基本停更，服务端协调层（约 4%）闭源。

---

## 1. 已拉取内容

| 仓库 | 本地路径 | 体积 | 角色 | 最新提交 | 许可 |
|---|---|---|---|---|---|
| `HeroWO-js/Core` | `HeroWO\Core` | 40 MB | 游戏引擎 + 数据生成工具（主体） | 2023-05-22 `3c21300` | Unlicense |
| `HeroWO-js/Workbench` | `HeroWO\Workbench` | 7.3 MB | 跑游戏的本地工作区、`update.php` 数据转换 | 2023-07-23 `257f6c6` | Unlicense |
| `HeroWO-js/h3m2json` | `HeroWO\h3m2json` | 740 KB | `.h3m` 地图解析/编译（PHP）+ 完整格式文档 | 2023-05-13 `1199a8e` | Unlicense |

子模块已全部递归初始化（GitHub 下载的 zip 缺这些，会导致读代码时大量 `undefined`）：

`client/sqimitive`（Sqimitive 事件框架，全项目的地基）、`client/nodash`（NoDash 工具库）、`client/r.js`、`client/PathAnimator`、`source-map`、`Phiws`（PHp WebSockets）、`noXXXep`（代码内 `XXX` 待办汇总器）、`databank/h3m2json`；`Workbench/core` 也已指向同一个 Core 提交。

合计约 142 MB（含各仓库 `.git` 对象）。

---

## 2. 目录地图

```
Core/
  client/        ← 引擎全部 JS，71,383 行（不含子模块）
  databank/      ← "数据银行" 生成器，24,529 行 PHP
    core.php     ← Effect/对象模型的地基（3677 行）
    databank.php ← HoMM3 规则数据（4503 行），选择器定义也在这
    databank-*.php ← 生物/法术/英雄/建筑/神器/物件…
    h3m2herowo.php ← 地图转换
  api.php (1898) / maps.php (1360) / index.php (1038)  ← 服务端胶水 + 页面引导
  herowo*.css, custom-graphics/
Workbench/
  update.php     ← 数据转换总入口（交互式）
  build.js, tools/（MMArchive、oggenc2、adpcm2pcm、AutoHotkey…）
h3m2json/
  h3m2json.php   ← .h3m ⇄ JSON
  h3m-The-Corpus.txt ← 地图二进制格式文档
```

**代码重心（按行数）**：`H3.Rules.js` 8805 · `H3.DOM.UI.js` 7527 · `H3.DOM.Combat.js` 5317 · `H3.Rules.RPC.js` 3251 · `H3.DOM.Bits.js` 3151 · `H3.DOM.MainMenu.js` 2875 · `Calculator.js` 2711 · `Map.js` 2470 · `H3.AI.Trivial.js` 2216 · `H3.Combat.js` 1476 · `RPC.js` 1456 · `Effects.js` 1104。

---

## 3. 架构分层

```
表现层   DOM.Map / DOM.MiniMap / H3.DOM.UI / H3.DOM.Combat / H3.DOM.Audio
            ↕ 只读世界 + 发意图
网络层   RPC → RPC.WebSocket（客户端）/ RPC 直调（单人）→ 广播 serverEvent diff
            ↕
规则层   H3.Rules + Calculator + Effects（所有数值都经 Calculator 求值）
            ↕
世界层   Map（对象、玩家、Effect 存储、ObjectStore 多维索引）
            ↕
框架层   Context（模块容器：addModule / fuse）→ Sqimitive（事件即方法）
            ↕
数据层   databank/*.json（由 HoMM3 原版 TXT 生成）
```

几个要点：

- **`H3.js` 只有 28 行**，它做的事就一句：把 `H3.Rules` 作为强制 Module 挂上 Context，并注册寻路（`PathFind.AStar`）与路径代价（`H3.PathCost`）工厂。真正的规则全在 `H3.Rules.js` 里，按 `Calculator` 子类切分（该文件开头有完整的类继承树注释，L15-77，非常值得先读）。
- **Sqimitive 把"方法"换成了"事件"**：`events: {'=serialize'}` / `'+xxx'` / `'-xxx'` 分别表示覆盖/前置/后置。没有 `private`，任何 mod 都能订阅或改写任意行为——这是作者选 JS 而非 C++ 的核心理由。
- **Context 模块系统**：`cx.autoAddModule('-', Rules)`、`cx.fuse('+makePathCost', …)`，模块可被环境（mod）替换。`Entry.Browser.js`（1331 行）里 `new Context({...})` 是浏览器端组装的起点。
- **多人是"单一权威世界 + diff 广播"**：`RPC.js` 是服务端视角的"客户端代理"，单人模式下每个玩家各自 `new RPC` 并直接调用，绕过传输层。因此天然获得观战（observer）、回放、以及"一个玩家的回合不锁死其他人"的并行性（`Context.IdleTasks` 用时间配额切片跑 AI 任务，避免卡 UI）。

---

## 4. Effect 系统（全项目最值得偷的东西）

规则不写死在代码里，而是"效果"= **选择器(selector) + 修饰符(modifier)** 的集合，挂在世界上任何位置（物件/玩家/地点/时间）。

实测数量（我在源码里数的）：

- **155 个效果目标**：`Core/databank/core.php:1875` 的 `const target = [...]`，从 `canCombat`、`creature_attack`、`hero_actionCost` 到 `town_spellCount`。
- **53 个选择器**：`Core/databank/databank.php` 中 `public $ifXxx`（`ifPlayer`、`ifZ`、`ifDateMonth`、`ifSpellLevel`、`ifCreatureUndead`、`ifRoad`…）。
- 底层说明文档在 `Core/databank/core.php:1843` 的 `class Effect` 注释块（含"哪些属性故意不做成 target"的取舍理由，写得非常清楚）。

一条可运行的效果长这样（粘到 herowo.io 的 mod 输入框即可生效）：

```json
{"priority": "relative", "target": "hero_actionCost",
 "ifWorldBonus": "plague", "modifier": ["relative", 10.0]}
```

读法：当世界事件为"瘟疫"时，英雄移动的代价 ×10（即移动力降到 1/10）。`modifier` 是 `[操作, 值]`，操作共 **19 种**（`databank/core.php:2092` 的 `const operation`）：

| 操作 | 含义 |
|---|---|
| `relative` | 乘。值 `10.0` 表示 ×10（内部是 `+= 值 - 1` 累积，见 `Calculator.js:1644`） |
| `delta` | 加（`value += 值`） |
| `clamp` | 夹到区间 `[min, max]` |
| `override` / `const` | 覆盖 / 直接取常量 |
| `random` / `randomSign` / `randomArray` | 随机 |
| `custom` / `check` / `databank` / `diff` / `intersect` / `prepend` / `append` / `heroSpec` / `spellSpec` / `heroSpecSkill` / `countAlignments` | 领域专用运算 |

客户端实现：`Effects.js` 负责存储与索引（`byTarget` / `bySpot` / `byTimed` / `byEncounter` / `byObject` 五套 `ObjectStore`，其中 `bySpot` 是 z-y-x 二维/三维索引，便于按坐标快速命中），真正算数值的是 `Calculator.js`——全项目共 26 处 `Calculator.extend`（其中 `H3.Rules.js` 里 17 个，对应建筑价格、投降花费、酒馆英雄概率、移动力等规则）。

---

## 5. 数据管线

```
HoMM3 原版文件 (TXT / BMP / DEF / WAV / MP3 / BIK)
   ├─ databank-*.php  ──→  databanks/<name>/*.json     （规则数据，可直接改 json 做 mod）
   ├─ bmp2png / def2png / wav2ogg ──→  动画、图片、音频
   └─ maps/h3m2herowo.php + h3m2json ──→  maps/*.json   （地图）
```

`Core/index.php` 把文件 mtime 转成 32 进制挂在 URL 上做缓存击穿，并按 `crc32(ip2long(REMOTE_ADDR)) % count` 把 `sseURL / mapsURL / databanksURL` 分流到多台后端（同 IP 稳定命同一台）。`Workbench/update.php` 是交互式总控（`convertH3Data()` 判断 bmp2png/def2png/mp3/wav2ogg/databank/maps/bik 是否全部完成）。

---

## 6. 想真正跑起来的代价

**纯读代码不需要跑。** 要跑得满足：

1. PHP 7+ 与 Apache/Nginx（Windows 上 XAMPP 即可）。
2. **HoMM3 原版游戏数据**（`herowo.io/dl` 的 torrent），约 1 GiB；首次转换峰值需再占 ~7 GiB，官方全地图 ~11 GiB（开 NTFS 压缩可降到 1/10）。
3. `php update.php` 交互式转换；需要大厅/聊天时再 `php core/api.php watchdog`。

也就是说：**引擎可以离线研究，运行则必须有原版游戏资源**——这是它没有一键 demo 的原因，也是它不触版权红线的做法（只发行引擎，不发行素材）。

---

## 7. 推荐阅读顺序（约 1–2 天可摸清主干）

1. `Core/client/H3.js`（28 行）→ `Context.js` 的 `addModule` / `fuse` 语义
2. `client/sqimitive/` 的 README 和 `Sqimitive.js` 顶部注释 —— 不读懂它，后面全是玄学
3. `Map.js` + `ObjectStore.js`：世界与索引模型
4. `Calculator.js` → `Effects.js` → `H3.Rules.js`（先只看 L15-77 的类继承树注释）
5. `databank/core.php:1843` 起 `class Effect` 大注释 + `1875` 的 target 列表
6. `H3.DOM.UI.js` / `H3.DOM.Combat.js`：规则如何落到界面
7. `RPC.js` → `RPC.WebSocket.js` → `H3.Rules.RPC.js`：意图与 diff 同步
8. `h3m2json/h3m2json.php` + `h3m-The-Corpus.txt`：地图二进制格式（独立且干净的 PHP 代码，适合单独看）

---

## 8. 可以直接借鉴的设计

- **事件即方法**（Sqimitive）：不需要预留 hook 点，任何函数都能被前置/后置/替换 —— 做插件化引擎的通用解法。
- **一切数值走 Calculator**：连建筑价格、投降花费、酒馆出现的英雄概率都是"求值"而非常量，所以 modifier 天然可叠加、可条件化。
- **Effect = selector + modifier 的组合**，而不是"给每种 buff 写一种类"：155×53 的组合能力远超枚举 buff 类。
- **多人 = 权威世界 + 事件 diff 广播**：观战/回放/并行回合都是这一模型的副产品，不用单独实现。
- **数据从原版文件自动生成**（databank 思路）：既避开素材版权，又让 mod 只需改中间 JSON。

---

## 9. 风险与限制（诚实结论）

- **项目活跃度**：公开仓库最后一次提交是 2023-05（Core）/ 2023-07（Workbench），距拉取已 3 年多；GitHub 组织下只有 3 个仓库。作者在 2023 年发帖时自评"current version is very bogus and works slowly"，代码里遍布 `XXX`（项目自带 `noXXXep` 工具就是为统计这些待办而生）。
- **服务端闭源**：README 明说"server side that amounts to about 4% of Core is proprietary"，所以想搭完整对战大厅做不到，单机/局域网自建可以。
- **强依赖原版游戏数据**，无素材就无法运行，也无法从截图/视频之外验证行为。
- **许可宽松**：Unlicense，等同公有领域，代码可任意取用（素材另论）。

---

## 10. 后续可选动作

- 想通读 `H3.Rules.js`（8805 行）：建议按 Calculator 子类逐段看，配合 `databank/databank-effects.php` 里"每条规则对应哪个 target"的对照表读。
- 想抄 Effect 系统：最小实现只需 `Effects`(索引) + `Calculator`(求值) + `target`/selector 两张表，可脱离 HoMM 语境复用到别的战棋/策略项目。
- 想跑起来：需要去找 `herowo.io/dl` 的中间数据 torrent（本机未下载），再执行 `Workbench/update.php`。

---

## 11. 功能完备度评估（"能不能跑 H3 基本逻辑"）

结论：**骨架完整、完整回合循环能跑通；但离"复刻原版体验"有明显缺口**，主要集中在冒险地图法术、部分地图物件、AI 强度。

### 11.1 玩家动作 API（代码里真实存在的命令名，这是最硬的证据）

| 层 | 文件 | 命令 |
|---|---|---|
| 世界层 | `RPC.js` | `endTurn` `actHero` `garrison` `dismissHero` `dismissCreature` `townscape` `hireDwelling` `upgradeCreature` `buySpellBook` `openMageGuild` |
| H3 规则层 | `H3.Rules.RPC.js` | `moveHero` `hireHero` `encounterPrompt` `encounterChoice` `heroLevelSkill` `heroArtifactSwap` `heroTrade` `buyBlacksmith` `warMachineFactory` `shipyard` `marketplace` `townBuild` `buildRoute` `combat` `controlCreature` |
| AI 实际调用 | `H3.AI.Trivial.js` | `moveHero` `hireHero` `hireDwelling` `townBuild` `townscape` `heroLevelSkill` `heroTrade` `garrison` `endTurn` `openMageGuild` `buySpellBook` `warMachineFactory` `shipyard` `encounterPrompt/Choice` |

也就是说"移动 → 踩物件/拾取 → 升级学技能 → 城镇建造 → 招募 → 开战 → 战斗内行动 → 过天"这条主循环是闭合的。

### 11.2 分系统判定

| 系统 | 判定 | 证据 |
|---|---|---|
| 地图移动 / 拾取道具资源 | ✅ 完整 | `do_moveHero`+路线动画；`stepOn` 覆盖约 60 类物件、`obstacle` 约 30 类；`heroArtifactSwap` 支持背包（`artifactSlotsID.backpack`）与装备槽交换 |
| 城镇建造 / 成长 | ✅ 主体完整 | `do_townBuild` / `do_buildRoute`（一次规划多级建造）、`_erect`（L3161）、`_growth`（周增长，含周/月事件与瘟疫）；`town_buildings` 是 Calculator，可被 Effect 修饰；箭塔伤害按建筑数增长（源码里有实测数值注释 L242） |
| 招募 | ✅ 完整 | `hireDwelling` / `hireHero` / `upgradeCreature` / `hireAvailable`（Effect target）；AI 有 `select_hireDwelling` |
| 战斗 | ✅ 相当完整 | `H3.Combat.js` 1476 行 + `H3.DOM.Combat.js` 5317 行；六边形格（`makeHexPathFinder`）、障碍生成、`defend`/`wait`/`shoot`/`move`/`retreat`；战争机器 `ballista`/`catapult`/`firstAidTent`；攻城（`sieged`/`besiegers`、护城河 MOAT、箭塔）；反击/士气/幸运全部走 Effect（`creature_retaliating`、`morale`、`luck`） |
| 魔法 | ⚠️ 半截 | **只有战斗内施法**：`H3.Rules.RPC.js:1297` 明确列出「Implemented spell IDs」，共 **45 个**；法术数据层有 `context = map / combat` 两类（`databank.php:1721`），但客户端搜不到 `townPortal`/`dimensionDoor`/`waterWalk`/`viewEarth` 任何实现 → **冒险地图法术（时空门、次元门、飞行、水上行走、观地/观空）数据有、逻辑无**。学魔法（魔法行会、买魔法书）是有的 |
| 地图物件 | ⚠️ 有洞 | `H3.Rules.js` 中约 63 个 `case`，物件表 88 类；L2341-2350 明写未实现/不完整：`altarOfSacrifice`、`blackMarket`、`denOfThieves`、`freelancerGuild`、`obelisk`、`sirens`、`university`，以及不完整的 `hillFort`、`refugeeCamp`、`tradingPost` |
| AI | ⚠️ 弱 | 只有 `H3.AI.Trivial`（2216 行，会建造/招募/打仗）+ `H3.AI.Nop`；没有战略层 AI |
| 多人 / 观战 / 回放 | ✅ 有 | RPC + WebSocket + diff 广播 + observer；但服务端协调层闭源 |

### 11.3 缺口量化

- `XXX` 标记：自有 client 代码（不含子模块）共 **566 处**，其中带标签 412 处，按 `noXXXep-config.php` 的语义分布为：`R` 重构 124 · `RH` 重构硬编码/私有 79 · `I` 未实现/不完整 96 · `IC` 提升兼容性 56 · `C` 兼容性存疑 38 · `O` 性能 7 · `ID` 数据不全 5 · `B` Bug 5。
- `H3.Rules.js` 单文件 122 个 `XXX`——规则层是"能跑通但边角没磨"的状态。
- 战斗法术 45 个 ID 显式实现；未列出的 ID 走通用分支或不支持。

### 11.4 一句话建议

- 想**学架构 / 抄 Effect 与多人模型**：这套代码完全够用，甚至是同类里最干净的。
- 想**当游戏引擎跑一个 H3 复刻**：主循环可用，但要做冒险法术、补那 7-11 个物件、换一个有战略的 AI，且必须自备原版数据。
- 想**做二次开发做新战棋**：不建议直接改（Rule 层业务耦合深、8805 行一个文件、122 处待办），更适合拆 Effect/Calculator 思想重写。
