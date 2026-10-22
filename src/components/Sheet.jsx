import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// 通用底部弹窗：open 控制开关，点击遮罩关闭。
// 关闭时延迟 200ms 卸载，让滑出动画播完。
// 通过 portal 挂到 body：避免弹窗嵌套时被父级 transform 影响 fixed 定位。

// body 滚动锁：用模块级计数器支持嵌套 Sheet。
// 任一 Sheet 打开时 body 锁 overflow:hidden；全部关闭后恢复原值。
let lockCount = 0
let prevOverflow = null
function lockBody() {
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}
function unlockBody() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0 && prevOverflow !== null) {
    document.body.style.overflow = prevOverflow
    prevOverflow = null
  }
}

export default function Sheet({ open, onClose, title, children }) {
  const [render, setRender] = useState(open)

  useEffect(() => {
    if (open) {
      setRender(true)
      lockBody()
      return () => {
        unlockBody()
      }
    }
    const t = setTimeout(() => setRender(false), 200)
    return () => {
      clearTimeout(t)
    }
  }, [open])

  if (!render) return null

  return createPortal(
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
    </div>,
    document.body
  )
}
