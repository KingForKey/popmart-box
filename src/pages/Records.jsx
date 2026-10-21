import { useEffect, useMemo, useState } from 'react'
import { getAllProducts, getAllRecords } from '../store/db.js'
import { getTotalSpend, getTotalIncome, getNetCash, formatMoney } from '../store/models.js'
import RecordItem from '../components/RecordItem.jsx'

// 记账页：页面统一读数据，传给纯展示组件。
// 顶部统计卡（总花费/总收入/净现金），下方按时间倒序的流水列表。

export default function Records() {
  const [products, setProducts] = useState([])
  const [records, setRecords] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([getAllProducts(), getAllRecords()]).then(([ps, rs]) => {
      if (!alive) return
      setProducts(ps)
      setRecords(rs)
    })
    return () => {
      alive = false
    }
  }, [])

  const productMap = useMemo(() => {
    const map = {}
    for (const p of products) map[p.id] = p
    return map
  }, [products])

  const sorted = useMemo(
    () => records.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [records]
  )

  const spend = getTotalSpend(records)
  const income = getTotalIncome(records)
  const net = getNetCash(records)

  if (records.length === 0) {
    return (
      <div className="records-page">
        <h1 className="page-title">记账</h1>
        <div className="records-empty">
          <div className="records-empty-emoji">🧾</div>
          <p>还没有收支记录，去「我的娃」入库或卖出吧</p>
        </div>
      </div>
    )
  }

  return (
    <div className="records-page">
      <h1 className="page-title">记账</h1>

      <div className="stat-card">
        <div className="stat-cell">
          <span className="stat-label">总花费</span>
          <span className="stat-value spend">{formatMoney(spend)}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">总收入</span>
          <span className="stat-value income">{formatMoney(income)}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">净现金</span>
          <span className={'stat-value ' + (net >= 0 ? 'income' : 'spend')}>
            {net >= 0 ? '+' : '-'}{formatMoney(Math.abs(net))}
          </span>
        </div>
      </div>

      <div className="record-list">
        {sorted.map((r) => (
          <RecordItem key={r.id} record={r} product={productMap[r.productId]} />
        ))}
      </div>
    </div>
  )
}
