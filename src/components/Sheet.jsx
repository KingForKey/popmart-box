import { useEffect, useState } from 'react'

// 通用底部弹窗：open 控制开关，点击遮罩关闭。
// 关闭时延迟 200ms 卸载，让滑出动画播完。

export default function Sheet({ open, onClose, title, children }) {
  const [render, setRender] = useState(open)

  useEffect(() => {
    if (open) {
      setRender(true)
      return
    }
    const t = setTimeout(() => setRender(false), 200)
    return () => clearTimeout(t)
  }, [open])

  if (!render) return null

  return (
    <div className={'sheet-root' + (open ? ' open' : '')}>
      <div className="sheet-mask" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-header">
          <div className="sheet-title">{title}</div>
          <button
            type="button"
            className="sheet-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
