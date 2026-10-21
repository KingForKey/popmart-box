// 纯计算函数：只依赖入参，不碰 React、不碰浏览器 API。
// 约定：record = { id, productId, type: 'in'|'out'|'trade', quantity, price,
//          channel, condition, presaleDate, note, date: 'YYYY-MM-DD', createdAt: number }
// in = 入库（买入），out = 卖出（有收入），trade = 交换出库（无收入，不计入收支）。
// 层级：渠道是一级维度（盒机转赠 / 现货可发），二级维度按渠道二选一：
//   - 现货可发 → condition（全新未拆盒 / 拆盒未拆袋 / 拆盒拆袋）
//   - 盒机转赠 → presaleDate（'YYYY-MM-DD'，展示为 X年X月X日）
// 另一个二级字段在 record 里为 null。卖出时按渠道+对应二级维度扣。
// 库存是所有记录的总和，可按渠道、成色、预售时间分开统计。

export const CHANNELS = ['盒机转赠', '现货可发']
export const CONDITIONS = ['全新未拆盒', '拆盒未拆袋', '拆盒拆袋']

export function getStock(productId, records) {
  let stock = 0
  for (const r of records) {
    if (r.productId !== productId) continue
    const qty = Number(r.quantity) || 0
    if (r.type === 'in') stock += qty
    else if (r.type === 'out' || r.type === 'trade') stock -= qty
  }
  return stock
}

// 按渠道统计库存：返回 { 渠道: 数量 }，只包含有货的渠道
export function getStockByChannel(productId, records) {
  const by = {}
  for (const r of records) {
    if (r.productId !== productId) continue
    if (!r.channel || CHANNELS.indexOf(r.channel) < 0) continue
    const qty = Number(r.quantity) || 0
    if (r.type === 'in') by[r.channel] = (by[r.channel] || 0) + qty
    else if (r.type === 'out' || r.type === 'trade') by[r.channel] = (by[r.channel] || 0) - qty
  }
  const out = {}
  for (const c of CHANNELS) {
    if (by[c] > 0) out[c] = by[c]
  }
  return out
}

// 按成色统计库存（可指定渠道，通常传「现货可发」）：
// 返回 { 成色: 数量 }，只包含有货的成色
export function getStockByCondition(productId, records, channel) {
  const by = {}
  for (const r of records) {
    if (r.productId !== productId) continue
    if (channel && r.channel !== channel) continue
    if (!r.condition || CONDITIONS.indexOf(r.condition) < 0) continue
    const qty = Number(r.quantity) || 0
    if (r.type === 'in') by[r.condition] = (by[r.condition] || 0) + qty
    else if (r.type === 'out' || r.type === 'trade') by[r.condition] = (by[r.condition] || 0) - qty
  }
  const out = {}
  for (const c of CONDITIONS) {
    if (by[c] > 0) out[c] = by[c]
  }
  return out
}

// 按预售时间统计盒机转赠库存：返回 { 'YYYY-MM-DD': 数量 }，只含有货的
export function getStockByPresale(productId, records) {
  const by = {}
  for (const r of records) {
    if (r.productId !== productId) continue
    if (r.channel !== '盒机转赠') continue
    if (!r.presaleDate) continue
    const qty = Number(r.quantity) || 0
    if (r.type === 'in') by[r.presaleDate] = (by[r.presaleDate] || 0) + qty
    else if (r.type === 'out' || r.type === 'trade') by[r.presaleDate] = (by[r.presaleDate] || 0) - qty
  }
  const out = {}
  for (const key of Object.keys(by)) {
    if (by[key] > 0) out[key] = by[key]
  }
  return out
}

// '2026-11-15' → '2026年11月15日'
export function formatPresale(dateStr) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(dateStr || ''))
  if (!m) return String(dateStr || '')
  return m[1] + '年' + parseInt(m[2], 10) + '月' + parseInt(m[3], 10) + '日'
}

// 近 monthCount 个月（含 currentMonth）的收支汇总。
// currentMonth 由调用方传 'YYYY-MM'，保持本函数纯净（不读系统时间）。
// 按 record.date 的业务月份归组，超出范围的记录不计入。
export function getMonthlyStats(records, monthCount, currentMonth) {
  const out = []
  const idx = {}
  const y = parseInt(String(currentMonth).slice(0, 4), 10) || 0
  const m = parseInt(String(currentMonth).slice(5, 7), 10) || 0
  for (let i = monthCount - 1; i >= 0; i--) {
    let yy = y
    let mm = m - i
    while (mm <= 0) {
      mm += 12
      yy -= 1
    }
    const key = yy + '-' + (mm < 10 ? '0' + mm : '' + mm)
    const item = { month: key, spend: 0, income: 0 }
    out.push(item)
    idx[key] = item
  }
  for (const r of records) {
    const item = idx[String(r.date || '').slice(0, 7)]
    if (!item) continue
    const subtotal = (Number(r.price) || 0) * (Number(r.quantity) || 0)
    if (r.type === 'in') item.spend += subtotal
    else if (r.type === 'out' || r.type === 'trade') item.income += subtotal
  }
  return out
}

// 按 IP 统计在库件数（只含有货的款式），无 IP 归「未分类」
export function getStockByIp(products, records) {
  const by = {}
  for (const p of products) {
    const qty = getStock(p.id, records)
    if (qty <= 0) continue
    const ip = (p.ip || '').trim() || '未分类'
    by[ip] = (by[ip] || 0) + qty
  }
  return by
}

// 未来 days 天内到期的盒机转赠预售提醒。
// todayStr / 截止日均由调用方传 'YYYY-MM-DD'，保持本函数纯净。
// 只含有货的预售桶，按到期日升序；daysLeft = 剩余天数。
function dayNum(dateStr) {
  const p = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(dateStr || ''))
  if (!p) return 0
  return Math.floor(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3])) / 86400000)
}

export function getUpcomingPresales(products, records, todayStr, days) {
  const limitNum = dayNum(todayStr) + days
  const out = []
  for (const p of products) {
    const by = getStockByPresale(p.id, records)
    for (const d of Object.keys(by)) {
      const n = dayNum(d)
      if (n < dayNum(todayStr) || n > limitNum) continue
      out.push({
        productId: p.id,
        name: p.name || '',
        presaleDate: d,
        qty: by[d],
        daysLeft: n - dayNum(todayStr)
      })
    }
  }
  return out.sort((a, b) => a.presaleDate < b.presaleDate ? -1 : 1)
}

export function getTotalSpend(records) {
  let sum = 0
  for (const r of records) {
    if (r.type !== 'in') continue
    sum += (Number(r.price) || 0) * (Number(r.quantity) || 0)
  }
  return sum
}

export function getTotalIncome(records) {
  let sum = 0
  for (const r of records) {
    if (r.type !== 'out') continue
    sum += (Number(r.price) || 0) * (Number(r.quantity) || 0)
  }
  return sum
}

export function getTotalStock(products, records) {
  let sum = 0
  for (const p of products) {
    sum += getStock(p.id, records)
  }
  return sum
}

export function getNetCash(records) {
  return getTotalIncome(records) - getTotalSpend(records)
}

export function formatMoney(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  return sign + '¥' + Math.abs(num).toFixed(2)
}

export function formatDate(ts) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

// 毫秒时间戳 → 'YYYY-MM-DD HH:mm'
export function formatDateTime(ts) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return formatDate(ts) + ' ' + hh + ':' + mm
}
