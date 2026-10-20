---
name: openspec-mini
description: OpenSpec 式变更生命周期（技术栈无关）：specs/ 记当前系统事实，changes/ 管提案、增量规格、设计、任务的 propose / update / status / sync / archive。从零新能力、需长期追踪规格或用户点名 OpenSpec 时使用；只管规格事实，不实现业务代码。
---

# 管理需求变更规格

## 目的

使用 OpenSpec 的核心模型管理需求：`specs/` 表示当前已实现的系统事实，`changes/` 表示尚在推进的变化；每个变更通过 proposal、delta specs、design 和 tasks 形成可评审、可执行、可归档的闭环。

本 Skill 不实现业务代码、不安装 OpenSpec CLI、不初始化脚手架、不提交代码，也不自动调用 `dev-spec`（`run` 模式）。

## 输入模式

支持以下动作：

- `propose`：创建新的变更包。
- `update`：根据新确认结论更新活动变更。
- `status`：只读检查变更状态、缺失产物和阻塞项。
- `sync`：把已有实现和验证支持的增量规格合并为当前规格。
- `archive`：把已完成并已处理同步状态的变更移入归档。

用户没有明确动作时，根据请求和现有产物判断；存在两种合理动作且会导致不同写入时先询问。

## 确定仓库与规范来源

按以下顺序确定 `<project-root>`：

1. 用户明确指定的目标目录或仓库。
2. 需求、变更包或相关文件所属的仓库。
3. 工作区中唯一能够证明的仓库。

多个候选或跨仓库时先确认，不默认使用工作区根目录。
变更同时影响多个仓库 / 端时，默认按仓库拆成多个变更包分别追踪；用户明确要求合并时，在 proposal 中标明各仓库各自的行为与验收，不得静默共用一套。

如果项目已有官方 OpenSpec 初始化结果、配置、schema 或生成的指令，先完整读取并以项目内协议为准；不得用本模板覆盖已有协议。项目未初始化时使用本 Skill 的 `change-spec/v1` 便携协议，不声称已经安装或运行官方 OpenSpec CLI。

用户明确要求安装或运行官方 CLI 时，把安装和初始化视为独立授权；未经确认不得执行。

## 便携目录协议

```text
<project-root>/openspec/
├─ specs/
│  └─ <capability>/spec.md
└─ changes/
   ├─ <change-id>/
   │  ├─ proposal.md
   │  ├─ design.md
   │  ├─ tasks.md
   │  └─ specs/<capability>/spec.md
   └─ archive/YYYY-MM-DD-<change-id>/
```

- `<change-id>` 使用稳定、简短的 kebab-case，并表达一个聚焦变化。
- `<capability>` 表达长期存在的业务能力，不按页面 / 文件名随意切分。
- `specs/` 只记录已经实现并有证据支持的当前行为。
- `changes/` 中的 delta spec 只记录本次新增、修改和删除的行为。
- 从零开始且尚无实现时，不把愿景提前写进当前 `specs/`；先写为活动变更中的 `ADDED` 需求，完成并验证后再 `sync`。

创建或更新便携变更包前，完整读取 `assets/change-package-template.md` 并按其中的文件结构生成内容。不适用章节写“无”，不编造事实。

## `propose`：创建变更包

1. 读取需求来源、常驻规则 `01-clarify.md`（意图分析与影响面分析）的分析结论、原型、地基文档和相关当前规格。
2. 区分产品事实、仓库事实、已确认决定、用户委托、候选技术方案和阻塞项。
3. 确认一个聚焦的 change-id，以及它影响的 capability。
4. 创建：
   - `proposal.md`：为什么改、目标、包含与排除范围、成功条件和生命周期状态。
   - delta specs：使用 `ADDED`、`MODIFIED`、`REMOVED` 表达需求变化，并包含可观察场景。
   - `design.md`：满足规格的技术方案、数据流、UIUE 边界（如适用）、决定与阻塞；不把候选写成已确认。
   - `tasks.md`：按依赖顺序拆分可验证任务，并追踪对应 Requirement 和 Scenario。
5. 向用户交付产物路径、阻塞决定和是否已具备执行条件，不开始实现。

需求尚未澄清到可写规格时，停止并建议先完成常驻规则 `01-clarify` 的意图分析与影响面分析；技术选型或目录边界未定且影响设计时，标记阻塞并按 `tech-gate` 走确认（本仓库地基已定，见 `00-project-routing`「技术栈边界」）。

## 增量规格规则

- `ADDED`：系统当前没有、此次准备新增的完整需求。
- `MODIFIED`：完整写出变更后的需求和场景，不只记录一句差异说明。
- `REMOVED`：写明被删除的需求、原因以及需要保留或迁移的行为。
- 每项 Requirement 使用规范性措辞描述系统行为，不写实现步骤。
- 每项 Requirement 至少包含一个能够观察的 Scenario；必要时覆盖主流程、边界和失败结果。
- 不在 delta spec 中写组件名、函数名、库名或预计文件；这些属于 design 或 tasks。
- 没有当前规格时不得虚构 `MODIFIED`；从零能力使用 `ADDED`。

## `update`：维护活动变更

根据用户新确认、仓库证据或实施偏差更新受影响的 proposal、delta specs、design 和 tasks。

- 用户决定改变行为时，先更新规格，再调整设计和任务。
- 仅实施路径改变但需求不变时，只更新 design/tasks。
- 保留稳定 Requirement、Scenario、DEC 和 TASK 标识；语义已改变时记录原因。
- 不把代码已经这样写当作需求自动成立，也不因实现困难降低已确认验收。

## `status`：检查状态

只读报告：

- 活动 change-id 和生命周期状态。
- 产物是否齐全、相互是否矛盾。
- 未确认决定、Blocked 任务和未覆盖 Requirement。
- 当前是否适合交给 `dev-spec`（`run` 模式）。
- 已完成实现是否具备 `sync` 条件。

不得借状态检查修改规格或代码。

## `sync`：更新当前规格

只有实施完成，并且实际差异和验证证据支持对应 Requirement/Scenario 时才同步。

1. 对照活动 delta、实际实现、任务记录和验证证据。
2. 对未实现、验证失败或证据不足的项停止同步并列为阻塞，不能把计划写成当前事实。
3. 将 `ADDED` 合并到对应当前 capability spec。
4. 用 `MODIFIED` 的完整内容替换当前需求。
5. 按 `REMOVED` 删除对应需求并保留必要的迁移说明。
6. 在 proposal 中记录同步结果、证据来源和未同步项。

`sync` 只更新规格事实，不修复代码、不执行验证，也不自动归档。

## `archive`：归档变更

仅在用户明确要求归档时执行。

- 确认实现状态、任务状态、同步结果和未解决项。
- 未同步但用户决定归档时，明确记录未同步原因，不伪装为完整交付。
- 将完整变更目录移动到 `changes/archive/YYYY-MM-DD-<change-id>/`，避免覆盖同名归档。
- 不删除当前规格、源代码或其他变更包。

## 与现有 Skill 的边界

- 常驻规则 `01-clarify.md` 负责意图分析与影响面分析，本 Skill 负责把确认结果持久化为规格。
- `dev-spec`（`write` 模式）继续生成单文件 `dev-spec/v1`，适合不需要长期规格演进的技术交接。
- `dev-spec`（`run` 模式）可以执行活动变更目录中的 `tasks.md` 及其关联产物。
- 实施完成后的代码事实由 `report-change` 汇报，代码质量由 `review-change` 审查。
- 本 Skill 不因变更包存在而获得跨仓库、安装依赖或未确认选型的权限。

## 完成检查

- 当前事实与拟议变化没有混写。
- proposal、delta specs、design 和 tasks 对同一范围保持一致。
- 每项需求都有场景，每项任务能追溯到需求或场景。
- Candidate、Blocked 和已确认决定清晰分离。
- 从零需求没有提前进入当前规格。
- sync 只合并实际实现且有验证证据的行为。
- archive 只在用户明确要求后执行。
