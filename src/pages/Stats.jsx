import { useEffect, useMemo, useState } from 'react'
import { getAllProducts, getAllRecords } from '../store/db.js'
import {
  getStock,
  getMonthlyStats,
  getStockByIp,
  formatDate
} from '../store/models.js'
import MonthBars from '../components/MonthBars.jsx'
import IpBars from '../components/IpBars.jsx'

// 统计页：页面统一读数据并计算，图表组件只负责展示。
// 总览卡（款式/在库/隐藏款/已卖出）+ 近 6 月收支柱状图 + IP 在库分布。

const MONTH_COUNT = 6

export default function Stats() {
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

  const totalStock = useMemo(() => {
    let sum = 0
    for (const p of products) sum += getStock(p.id, records)
    return sum
  }, [products, records])

  const soldCount = useMemo(() => {
    let sum = 0
    for (const r of records) {
      if (r.type === 'out') sum += Number(r.quantity) || 0
    }
    return sum
  }, [records])

  const secretCount = useMemo(
    () => products.filter((p) => p.isSecret).length,
    [products]
  )

  const monthly = useMemo(
    () => getMonthlyStats(records, MONTH_COUNT, formatDate(Date.now()).slice(0, 7)),
    [records]
  )

  const ipData = useMemo(() => {
    const by = getStockByIp(products, records)
    return Object.keys(by)
      .map((name) => ({ name, qty: by[name] }))
      .sort((a, b) => b.qty - a.qty)
  }, [products, records])

  if (products.length === 0 && records.length === 0) {
    return (
      <div className="stats-page">
        <h1 className="page-title">统计</h1>
        <div className="records-empty">
          <div className="records-empty-emoji">📊</div>
          <p>还没有数据，先去「我的娃」添加吧</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stats-page">
      <h1 className="page-title">统计</h1>

      <div className="stat-card overview-card">
        <div className="stat-cell">
          <span className="stat-label">款式</span>
          <span className="stat-value text">{products.length}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">在库</span>
          <span className="stat-value text">{totalStock}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">隐藏款</span>
          <span className="stat-value gold">{secretCount}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">已卖出</span>
          <span className="stat-value text">{soldCount}</span>
        </div>
      </div>

      <section className="stats-section">
        <h2 className="section-title">近 6 个月收支</h2>
        <div className="chart-card">
          <MonthBars data={monthly} />
        </div>
      </section>

      <section className="stats-section">
        <h2 className="section-title">IP 在库分布</h2>
        <div className="chart-card">
          {ipData.length > 0 ? (
            <IpBars data={ipData} />
          ) : (
            <div className="chart-empty">目前没有在库的娃</div>
          )}
        </div>
      </section>
    </div>
  )
}
