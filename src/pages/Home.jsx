import { useEffect, useMemo, useState } from 'react'
import { getAllProducts, getAllRecords, getNickname } from '../store/db.js'
import {
  getStock,
  getTotalSpend,
  getTotalIncome,
  getUpcomingPresales,
  formatDate,
  formatMoney,
  formatPresale
} from '../store/models.js'
import RecordItem from '../components/RecordItem.jsx'
import NicknameSheet from '../components/NicknameSheet.jsx'
import SettingsSheet from '../components/SettingsSheet.jsx'

// 首页：仪表盘。页面统一读数据并计算，展示组件只收 props。
// 问候 + 快捷入口（跨 Tab 跳转由 App 传 onGoTab）+ 资产总览 +
// 预售到期提醒（30 天内）+ 最近动态（最新 5 条）。

const PRESALE_DAYS = 30
const RECENT_COUNT = 5

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function greeting(hour) {
  if (hour < 5) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export default function Home({ onGoTab }) {
  const [products, setProducts] = useState([])
  const [records, setRecords] = useState([])
  const [nick, setNick] = useState('')
  const [nickOpen, setNickOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([getAllProducts(), getAllRecords(), getNickname()]).then(
      ([ps, rs, nk]) => {
        if (!alive) return
        setProducts(ps)
        setRecords(rs)
        setNick(nk)
      }
    )
    return () => {
      alive = false
    }
  }, [])

  const now = new Date()
  const todayStr = formatDate(now.getTime())

  const totalStock = useMemo(() => {
    let sum = 0
    for (const p of products) sum += getStock(p.id, records)
    return sum
  }, [products, records])

  const spend = getTotalSpend(records)
  const income = getTotalIncome(records)

  const presales = useMemo(
    () => getUpcomingPresales(products, records, todayStr, PRESALE_DAYS).slice(0, 3),
    [products, records, todayStr]
  )

  const recent = useMemo(
    () =>
      records
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, RECENT_COUNT),
    [records]
  )

  const productMap = useMemo(() => {
    const map = {}
    for (const p of products) map[p.id] = p
    return map
  }, [products])

  const isEmpty = products.length === 0 && records.length === 0

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-greet-row">
          <h1 className="home-greeting">
            {greeting(now.getHours())}
            {nick ? '，' + nick : ''}
          </h1>
          <button
            type="button"
            className="greet-edit"
            aria-label="设置昵称"
            onClick={() => setNickOpen(true)}
          >
            ✏️
          </button>
          <button
            type="button"
            className="greet-edit"
            aria-label="设置与备份"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙️
          </button>
        </div>
        <p className="home-date">
          {formatDate(now.getTime()).replace(/-/g, '.')} 周{WEEKDAYS[now.getDay()]}
        </p>
      </div>

      <div className="home-actions">
        <button type="button" className="home-action" onClick={() => onGoTab('collection')}>
          <span className="home-action-emoji">📦</span>去入库
        </button>
        <button type="button" className="home-action" onClick={() => onGoTab('records')}>
          <span className="home-action-emoji">🧾</span>去记账
        </button>
        <button type="button" className="home-action" onClick={() => onGoTab('stats')}>
          <span className="home-action-emoji">📊</span>看统计
        </button>
      </div>

      <div className="stat-card overview-card">
        <div className="stat-cell">
          <span className="stat-label">在库</span>
          <span className="stat-value text">{totalStock}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">款式</span>
          <span className="stat-value text">{products.length}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">累计投入</span>
          <span className="stat-value spend">{formatMoney(spend)}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-cell">
          <span className="stat-label">累计回收</span>
          <span className="stat-value income">{formatMoney(income)}</span>
        </div>
      </div>

      {isEmpty && (
        <div className="home-empty home-empty-inline">
          <div className="records-empty-emoji">🧸</div>
          <p>还没有娃，从入库开始吧</p>
          <button
            type="button"
            className="btn-primary home-empty-btn"
            onClick={() => onGoTab('collection')}
          >
            去添加
          </button>
        </div>
      )}

      {presales.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">预售到期提醒（30 天内）</h2>
          <div className="presale-card">
            {presales.map((it) => (
              <div className="presale-row" key={it.productId + it.presaleDate}>
                <span className={'presale-badge' + (it.daysLeft <= 7 ? ' soon' : '')}>
                  {it.daysLeft === 0 ? '今天' : '剩 ' + it.daysLeft + ' 天'}
                </span>
                <span className="presale-name">{it.name}</span>
                <span className="presale-meta">
                  {formatPresale(it.presaleDate)} · {it.qty} 件
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2 className="section-title">最近动态</h2>
            <button
              type="button"
              className="section-link"
              onClick={() => onGoTab('records')}
            >
              查看全部
            </button>
          </div>
          <div className="record-list home-record-list">
            {recent.map((r) => (
              <RecordItem key={r.id} record={r} product={productMap[r.productId]} />
            ))}
          </div>
        </section>
      )}

      <NicknameSheet
        open={nickOpen}
        onClose={() => setNickOpen(false)}
        value={nick}
        onSaved={() => {
          setNickOpen(false)
          getNickname().then(setNick)
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onImported={() => {
          setSettingsOpen(false)
          Promise.all([getAllProducts(), getAllRecords(), getNickname()]).then(
            ([ps, rs, nk]) => {
              setProducts(ps)
              setRecords(rs)
              setNick(nk)
            }
          )
        }}
      />
    </div>
  )
}
