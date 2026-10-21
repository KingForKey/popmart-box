// 平台能力封装：轻提示。
// 页面里禁止用 window.alert，统一调用 showToast(msg, options)。
// options: { actionLabel, onAction, duration }，actionLabel 存在时显示可点按钮（如「撤销」）。

let layer = null
let actionBtn = null
let hideTimer = null
let onAction = null

const TOAST_STYLE_ID = 'popmart-toast-style'

function ensureStyle() {
  if (document.getElementById(TOAST_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = TOAST_STYLE_ID
  style.textContent = [
    '.popmart-toast {',
    '  position: fixed;',
    '  left: 50%;',
    '  bottom: calc(96px + env(safe-area-inset-bottom));',
    '  transform: translateX(-50%) translateY(8px);',
    '  max-width: 80vw;',
    '  padding: 10px 18px;',
    '  background: rgba(45, 42, 50, 0.88);',
    '  color: #fff;',
    '  font-size: 14px;',
    '  line-height: 1.5;',
    '  border-radius: 12px;',
    '  opacity: 0;',
    '  pointer-events: none;',
    '  transition: opacity 0.2s ease, transform 0.2s ease;',
    '  z-index: 9999;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 10px;',
    '}',
    '.popmart-toast.show {',
    '  opacity: 1;',
    '  transform: translateX(-50%) translateY(0);',
    '}',
    '.popmart-toast.has-action {',
    '  pointer-events: auto;',
    '}',
    '.popmart-toast-action {',
    '  border: none;',
    '  background: transparent;',
    '  color: #FF9DBF;',
    '  font-size: 14px;',
    '  font-weight: 600;',
    '  font-family: inherit;',
    '  padding: 2px 4px;',
    '  cursor: pointer;',
    '  flex-shrink: 0;',
    '  -webkit-tap-highlight-color: transparent;',
    '}'
  ].join('\n')
  document.head.appendChild(style)
}

export function showToast(msg, options) {
  ensureStyle()
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'popmart-toast'
    layer.setAttribute('role', 'status')
    actionBtn = document.createElement('button')
    actionBtn.type = 'button'
    actionBtn.className = 'popmart-toast-action'
    actionBtn.addEventListener('click', () => {
      hideNow()
      const fn = onAction
      onAction = null
      if (fn) fn()
    })
    layer.appendChild(actionBtn)
    document.body.appendChild(layer)
  }
  const opts = options || {}
  onAction = typeof opts.onAction === 'function' ? opts.onAction : null

  // 文本节点：先清掉旧文本（保留 action 按钮在末尾）
  while (layer.firstChild !== actionBtn) {
    layer.removeChild(layer.firstChild)
  }
  const text = document.createTextNode(String(msg))
  layer.insertBefore(text, actionBtn)

  if (onAction && opts.actionLabel) {
    actionBtn.textContent = String(opts.actionLabel)
    actionBtn.style.display = ''
    layer.classList.add('has-action')
  } else {
    actionBtn.style.display = 'none'
    layer.classList.remove('has-action')
  }

  layer.classList.add('show')
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    layer.classList.remove('show')
  }, opts.duration || 2000)
}

function hideNow() {
  clearTimeout(hideTimer)
  if (layer) layer.classList.remove('show')
}
