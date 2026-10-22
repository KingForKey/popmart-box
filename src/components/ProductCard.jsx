import { useRef } from 'react'
import { formatPresale } from '../store/models.js'
import { pinchingRef } from '../utils/pinchState.js'

// 款式卡片：纯展示组件，数据全部来自 props。
// density: comfortable 完整信息；cozy 隐藏渠道二级明细；snug 仅图+名+库存。
// 长按 500ms 触发 onLongPress，pinch 缩放期间自动屏蔽长按避免冲突。

export default function ProductCard({
  product,
  stock,
  channelStock,
  transferPresale,
  condStock,
  image,
  density = 'comfortable',
  onClick,
  onMinus,
  onLongPress
}) {
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
    if (pinchingRef.current) return
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
  const presaleEntries = transferPresale ? Object.keys(transferPresale).sort() : []
  const condEntries = condStock ? Object.keys(condStock) : []
  const isSnug = density === 'snug'
  const isCozy = density === 'cozy'
  const compact = isSnug || isCozy

  return (
    <div
      className={'product-card density-' + density + (stock <= 0 ? ' empty' : '')}
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
        {product.rarity === 'ultra' ? (
          <span className="product-card-secret ultra">大隐藏</span>
        ) : product.rarity === 'secret' || product.isSecret ? (
          <span className="product-card-secret">隐藏</span>
        ) : null}
        {stock > 1 && !isSnug && (
          <span className="product-card-badge">×{stock}</span>
        )}
      </div>

      <div className="product-card-name">{product.name}</div>
      {!isSnug && <div className="product-card-series">{product.series}</div>}

      {!compact && (transferCount > 0 || stockCount > 0) && (
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

      {!isSnug && (
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
      )}
    </div>
  )
}
