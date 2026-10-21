import { useRef } from 'react'
import { formatPresale } from '../store/models.js'

// 款式卡片：纯展示组件，数据全部来自 props。
// channelStock: { 渠道: 数量 }；transferPresale: 盒机转赠按预售时间 { 'YYYY-MM-DD': n }；
// condStock: 现货可发按成色 { 成色: n }。
// 展示层级：渠道是一级，盒机转赠下挂预售时间、现货可发下挂成色。
// 长按 500ms 触发 onLongPress，期间移动超过 10px 视为滚动、取消长按。

export default function ProductCard({ product, stock, channelStock, transferPresale, condStock, image, onClick, onMinus, onLongPress }) {
  const timerRef = useRef(null)
  const firedRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handlePointerDown(e) {
    firedRef.current = false
    startPosRef.current = { x: e.clientX, y: e.clientY }
    clearTimer()
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      timerRef.current = null
      if (onLongPress) onLongPress()
    }, 500)
  }

  function handlePointerMove(e) {
    if (!timerRef.current) return
    const dx = Math.abs(e.clientX - startPosRef.current.x)
    const dy = Math.abs(e.clientY - startPosRef.current.y)
    if (dx > 10 || dy > 10) clearTimer()
  }

  function endPress() {
    clearTimer()
  }

  function handleClick() {
    if (firedRef.current) {
      firedRef.current = false
      return
    }
    if (onClick) onClick()
  }

  const firstChar = (product.name || '').trim().charAt(0) || '娃'
  const transferCount = channelStock ? channelStock['盒机转赠'] || 0 : 0
  const stockCount = channelStock ? channelStock['现货可发'] || 0 : 0
  const presaleEntries = transferPresale
    ? Object.keys(transferPresale).sort()
    : []
  const condEntries = condStock ? Object.keys(condStock) : []

  return (
    <div
      className={'product-card' + (stock <= 0 ? ' empty' : '')}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="product-card-img">
        {image ? (
          <img src={image} alt={product.name} />
        ) : (
          <span className="product-card-char">{firstChar}</span>
        )}
        {product.isSecret && <span className="product-card-secret">隐藏</span>}
      </div>

      <div className="product-card-name">{product.name}</div>
      <div className="product-card-series">{product.series}</div>

      {(transferCount > 0 || stockCount > 0) && (
        <div className="product-card-cond">
          {transferCount > 0 && (
            <div className="cond-row">
              <span className="cond-tag channel">盒机转赠 {transferCount}</span>
            </div>
          )}
          {transferCount > 0 && presaleEntries.length > 0 && (
            <div className="cond-row cond-sub">
              {presaleEntries.map((d) => (
                <span key={d} className="cond-tag presale">
                  {formatPresale(d)} {transferPresale[d]}
                </span>
              ))}
            </div>
          )}
          {stockCount > 0 && (
            <div className="cond-row">
              <span className="cond-tag channel">现货可发 {stockCount}</span>
            </div>
          )}
          {stockCount > 0 && condEntries.length > 0 && (
            <div className="cond-row cond-sub">
              {condEntries.map((c) => (
                <span key={c} className="cond-tag">{c} {condStock[c]}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="product-card-bottom">
        <span className="product-card-stock">{stock}</span>
        <button
          type="button"
          className="product-card-minus"
          aria-label="卖出"
          onClick={(e) => {
            e.stopPropagation()
            if (onMinus) onMinus()
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          −
        </button>
      </div>
    </div>
  )
}
