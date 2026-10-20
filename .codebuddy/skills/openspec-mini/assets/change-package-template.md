# OpenSpec 式变更包模板

> 适用于 `change-spec/v1` 便携协议。生成时按下列文件边界拆分，不把整份模板原样复制成一个文件。项目已有 OpenSpec schema 时以项目协议为准。

## `proposal.md`

```markdown
# [变更名称]

- 协议：`change-spec/v1`
- Change ID：`<change-id>`
- 状态：Proposed / Confirmed / Implementing / Implemented / Synced / Blocked
- 目标仓库：`<project-root>`
- 需求来源：
- 关联决定：`DEC-XX` / 无

## 为什么改变

## 目标结果

## 包含范围

## 排除范围

## 影响的 Capability

- `<capability>`：新增 / 修改 / 删除

## 成功条件

- `AC-01`：Given ...，When ...，Then ...

## 依赖与阻塞

## 生命周期记录

| 时间 | 动作 | 结果 | 证据或说明 |
|---|---|---|---|
```

## `specs/<capability>/spec.md`

```markdown
# [Capability] 增量规格

## ADDED Requirements

### Requirement: [稳定名称]

系统 SHALL ...

#### Scenario: [可观察场景]

- **GIVEN** ...
- **WHEN** ...
- **THEN** ...

## MODIFIED Requirements

### Requirement: [当前规格中的稳定名称]

[写出修改后的完整需求和全部仍有效场景。]

## REMOVED Requirements

### Requirement: [当前规格中的稳定名称]

- 删除原因：
- 保留或迁移行为：无 / ...
```

仅保留实际使用的 ADDED、MODIFIED、REMOVED 章节。

## `design.md`

```markdown
# [变更名称] 技术设计

## 事实与约束

## 已确认决定

| 决定 | 状态 | 结论 | 依据 | 重新评估条件 |
|---|---|---|---|---|
| `DEC-01` | Confirmed / Candidate / Blocked | ... | ... | ... |

## 方案与数据流

## 页面、状态与交互（无 UI 改动写"不适用"）

## API 与外部依赖

## UIUE 还原边界（无 UI 改动写"不适用"）

## 预计影响区域

## 风险、兼容与回退

## 与规格的追踪

| Requirement / Scenario | 技术处理 | 验证方式 |
|---|---|---|
```

## `tasks.md`

```markdown
# [变更名称] 实施任务

## 进度

- 状态：Pending / In Progress / Done / Blocked
- 最后更新：

## 任务

### TASK-01：[可独立验证的结果]

- 状态：Pending / In Progress / Done / Blocked
- 覆盖：Requirement / Scenario / `AC-XX`
- 依赖：无 / `TASK-XX` / `DEC-XX`
- 预计文件：
- 工作内容：
- 完成条件：
- 验证方式：
- 执行记录：
  - 实际文件：未执行
  - 验证证据：未执行
  - 偏差：无
  - 未验证项：无
```

## 当前 `specs/<capability>/spec.md`

```markdown
# [Capability] 当前规格

> 只记录已经实现并有证据支持的系统行为。

## Requirements

### Requirement: [稳定名称]

系统 SHALL ...

#### Scenario: [当前可观察行为]

- **GIVEN** ...
- **WHEN** ...
- **THEN** ...
```
