/**
 * UI 还原度验收脚本骨架（复制后按检查项填充）
 *
 * 使用方式：打开目标页面 / 弹窗 → DevTools Console 粘贴执行 → 回贴 console.table 结果
 * 约定：自包含 IIFE、零依赖；输出统一走 ok()；数值 toFixed(1)；容差 near(a, b, 2)
 * 说明：示例中的类名（.dialog-root / .dialog-panel 等）为占位，按目标项目实际类名替换
 */
(() => {
  const results = []
  const ok = (name, pass, detail) =>
    results.push({ 检查项: name, 结果: pass ? '✅ PASS' : '❌ FAIL', 详情: detail })
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol

  // ── 前置：定位目标（弹窗叠层时取栈顶，querySelector 会量到底层弹窗） ──
  const roots = document.querySelectorAll('.dialog-root') // 按实际弹窗根类名替换；页面级验收直接 document.querySelector(页面根)
  const panel = roots[roots.length - 1]?.querySelector('.dialog-panel')
  const body = panel && panel.querySelector('.dialog-body')
  if (!panel || !body) return console.error('❌ 未找到目标容器，请先打开待验收的页面/弹窗再执行')
  console.log(`共 ${roots.length} 层弹窗，验收栈顶弹窗：${panel.querySelector('.dialog-title')?.textContent || '(无标题)'}`)
  const bb = body.getBoundingClientRect()

  // ── 按文本找元素必须 trim() ──
  const btns = [...body.querySelectorAll('button')]
  const btnCancel = btns.find(b => b.textContent.trim() === '取消')
  const btnOk = btns.find(b => b.textContent.trim() === '确认选择')
  if (!btnCancel || !btnOk) {
    ok('找到目标按钮', false, `取消:${!!btnCancel}, 确认选择:${!!btnOk}`)
  } else {
    const rc = btnCancel.getBoundingClientRect()
    const ro = btnOk.getBoundingClientRect()

    // ── 尺寸类 ──
    ok('按钮宽 = 80px', near(rc.width, 80), `实际 ${rc.width.toFixed(1)}px`)
    ok('按钮高 = 40px', near(ro.height, 40), `实际 ${ro.height.toFixed(1)}px`)

    // ── 对齐类：锚右 / 贴底（预期值 = 父容器 rect − 已知 padding） ──
    ok('锚右（右缘距父右 padding 40px）', near(ro.right, bb.right - 40),
       `按钮 right=${ro.right.toFixed(1)}, 期望=${(bb.right - 40).toFixed(1)}`)
    ok('贴底（距父底 padding 32px）', near(bb.bottom - ro.bottom, 32),
       `实际 ${(bb.bottom - ro.bottom).toFixed(1)}px`)

    // ── 顺序类 ──
    ok('顺序 取消(左)→确认选择(右)，间距≈12px', rc.right < ro.left && near(ro.left - rc.right, 12),
       `取消 right=${rc.right.toFixed(1)}, 确认 left=${ro.left.toFixed(1)}`)
  }

  // ── 容器约束类 ──
  const cs = getComputedStyle(body)
  ok('容器 overflow 为 hidden', cs.overflowY === 'hidden', `实际 overflowY=${cs.overflowY}`)
  ok('容器无内容溢出', body.scrollHeight <= body.clientHeight + 1,
     `scrollHeight=${body.scrollHeight}, clientHeight=${body.clientHeight}`)

  // ── 条件类（数据超出才成立，详情注明触发条件；选择器按实际表格实现替换） ──
  const wrap = body.querySelector('.table-body-wrapper')
  if (wrap) {
    ok('内部滚动生效（数据超出可视高度时）', wrap.scrollHeight > wrap.clientHeight + 2,
       `scrollHeight=${wrap.scrollHeight}, clientHeight=${wrap.clientHeight}（当前数据未超一页时 FAIL 属正常）`)
  }

  // ── 表头/吸顶类（测完复位 scrollTop） ──
  const head = body.querySelector('.table-header-wrapper')
  if (head && wrap) {
    const before = head.getBoundingClientRect().top
    wrap.scrollTop = 60
    const after = head.getBoundingClientRect().top
    ok('表头固定（内容滚动时表头不动）', near(before, after),
       `滚动前 top=${before.toFixed(1)}, 滚动后 top=${after.toFixed(1)}`)
    wrap.scrollTop = 0 // 复位
  }

  console.table(results)
  const fails = results.filter(r => r.结果.includes('FAIL')).length
  console.log(fails === 0 ? '🎉 全部通过' : `⚠️ ${fails} 项未通过`)
})()
