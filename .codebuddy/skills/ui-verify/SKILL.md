---
name: ui-verify
description: 生成浏览器 Console 可执行的 JS 断言脚本验收 UI 还原度（DOM 几何事实，任何 Web 前端技术栈适用），并解读回贴结果定位根因。DOM 样式类修改完成时自动调用提示用户验证；用户要求"脚本验收 UI / 测还原度"时使用；不修改业务代码。
---

# UI 还原度 JS 验收

## 0. 总原则

- 脚本**自包含**：IIFE、零外部依赖、可直接粘贴 Console 执行；输出 `console.table` + 汇总行。
- 断言基于**几何事实**（`getBoundingClientRect` / `getComputedStyle`），预期值必须可溯源（Figma 实读 > 布局 JSON > 图片实测）；无从确定时先问，不编数值。
- 本 Skill 只生成脚本与解读结果，不修改业务代码；根因修复由用户确认后另行执行。

## 1. 执行流程（严格按序）

1. **列检查项清单**：先输出表格（检查项 / 预期值 / 依据来源），让用户可核对预期值本身是否正确。
2. **生成脚本**：从 `assets/console-template.js` 复制骨架，按检查项逐条填断言；附使用步骤（先打开目标页面/弹窗，再粘贴执行）。
3. **解读回贴结果**：逐项标注 PASS / FAIL / **条件未触发**（数据不足、状态未激活等场景 FAIL 属正常，需在脚本详情列预先注明触发条件）。
4. **FAIL 定根因**：用详情数值反推（见 §4），输出一行根因结论 + 修复方向，等用户确认再改代码。

## 2. 断言类型清单

| 类型 | 典型断言 | 关键 API / 写法 |
|---|---|---|
| 容器约束 | `overflow` 为 hidden/auto；`scrollHeight <= clientHeight`（不溢出） | `getComputedStyle(el).overflowY` |
| 尺寸 | 宽 / 高 = N px（容差 ±1~2px） | `getBoundingClientRect()` |
| 对齐 | 锚右：`el.right ≈ 父.right − 父.padding`；贴底；元素间距 = gap | rect 四则运算 |
| 顺序 | 兄弟元素左→右：`a.right < b.left` | rect 比较 |
| 条件 | 数据超出才滚 / 选中态才显示文案 | 注明触发条件与预期 FAIL 场景 |
| 表头/吸顶 | 滚动前后元素 rect.top 不变（表头固定） | `scrollTop` 赋值前后对比，测完复位 |

## 3. 硬规则（踩坑提炼，违反必返工）

1. **弹窗叠层取栈顶**：函数式弹窗可多层同挂 body，必须 `querySelectorAll` 取弹窗根类名的**最后一个**；`querySelector` 会量到底层弹窗（症状：宽度对不上、目标按钮/表格找不到）。
2. **按文本找元素必须 `trim()`**：`[...el.querySelectorAll('button')].find(b => b.textContent.trim() === '取消')`。
3. **脚本开头打印目标确认**：如「共 N 层弹窗，验收栈顶弹窗：XXX」，回贴结果前先核验收的是不是目标。
4. **数值格式**：详情保留 1 位小数（`toFixed(1)`），容差 `near(a, b, tol = 2)` 统一函数。
5. **测滚动要复位**：给 `scrollTop` 赋值验证后必须归零，不留副作用。
6. **条件断言必须注解**：详情列写明「当前数据未超一页时 FAIL 属正常」，避免被当缺陷。
7. **rect 属性必须取自 `getBoundingClientRect()` 返回值**：元素本身没有 `.left/.right/.width/.height`，直接 `el.right` 得到 `undefined`（`undefined <= undefined` 恒 false），会让该项**永远 FAIL 且详情无异常数值**。写完逐个检查断言里的属性来源。
8. **「flex 该缩不缩」先 dump 收缩链，别先怀疑缓存**：控件全部纹丝不动（宽度逐位等于基准值）时，第一动作是打印链路上每层 `getComputedStyle` 的 `minWidth` / `flexShrink`（行→组容器→控件），而不是假设 HMR/缓存/类未生成。嵌套 flex 中中间容器的 `min-width:auto`（= min-content 宽）会整层阻断收缩——叶子控件加 `min-width` 无效，解法是**中间容器加最小宽度约束（如 `min-w-0` / `min-width: 0`）**。
9. **多轮 FAIL 且数值逐位相同 → 先发单点 DOM 探针**：验证新代码是否在页面（如检查 inline style / 新类名是否存在），探针确认后再谈假设，避免整轮缓存误判。

## 4. FAIL 数值反推法（解读阶段）

- `scrollHeight − clientHeight` = 溢出量；若同时有"元素 bottom > 父 bottom"，差值即未收缩元素的溢出距离。
- 元素实际宽 − 预期宽 = 多余 padding / min-width 未生效量。
- `getComputedStyle().overflowY` 与预期不符 = 限高/滚动容器选错了层（往上找真正的滚动容器）。
- 兄弟元素位置重叠（`表格.bottom > 分页.top`）= 中间元素未参与 flex 收缩（min-height:0 / height 100% 链路断裂）。
- 横向溢出但所有 flex 子项宽度纹丝不动 = 收缩链在某一层被 `min-width:auto` 阻断；逐层查 computed `minWidth`，值为 `auto` 且 ≈ 该项基准宽的容器就是阻断层，修复方向 = 该容器加 `min-width: 0`（注意：给叶子控件加 `min-width` 只设地板，不降低 min-content 传递）。

## 5. 脚本骨架

见 `assets/console-template.js`：`ok()` 收集结果、`near()` 容差比较、`console.table` 输出、FAIL 计数汇总。生成脚本时复制骨架按检查项填充，勿凭空重写结构。

## 6. 本项目落地（HeroWO）

- 目标是 `battle-ui/index.html` 的 SVG 棋盘与确认条：几何量取 `hexEls` 里各 `<polygon>` 的 `getBoundingClientRect()`，以及 `#log` / `#hint` / 按钮的可视区。
- 预期值来源优先级（本仓库）：`W=15, H=11, SIZE=24, PAD=12` 与 `center()` 公式算出的理论坐标 > `简化玩法设计.md` §3.2 渲染规格 > 截图实测；不得凭观感编数值。
- **能进探针的断言优先写成探针**：可离线复现、可回归的几何/时序断言放 `_probe*.js`（零依赖、跑全套）；`ui-verify` 只用于必须在真实浏览器里量的那部分（字体度量、实际像素、触屏命中区）。
- 脚本必须在页面已 `init()` 且有一手行动时才有效；贴脚本前先确认棋盘已渲染（否则全部 FAIL 属条件未触发，须在详情列注明）。
