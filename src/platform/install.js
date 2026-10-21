// 平台能力封装：PWA 安装引导。
// 安卓 Chrome 触发 beforeinstallprompt 时可程序化弹安装框；
// iOS Safari 无此事件，只能引导用户手动「添加到主屏幕」。

let deferredPrompt = null
const listeners = new Set()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  listeners.forEach((fn) => fn())
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  listeners.forEach((fn) => fn())
})

// 订阅安装状态变化，返回取消函数
export function onInstallStateChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 是否 iOS（iPhone/iPad/iPod，含桌面模式的 iPad）
export function isIOS() {
  const ua = navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// 当前是否已以独立窗口（已安装的 PWA）运行
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true
}

// 是否可以程序化触发安装（安卓 Chrome 等）
export function canPromptInstall() {
  return !!deferredPrompt
}

// 触发系统安装框；返回 'accepted' | 'dismissed' | 'unavailable'
export function promptInstall() {
  if (!deferredPrompt) return Promise.resolve('unavailable')
  const p = deferredPrompt
  deferredPrompt = null
  p.prompt()
  return p.userChoice.then((c) => (c && c.outcome) || 'dismissed')
}
