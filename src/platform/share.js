// 平台能力封装：分享到微信 / 系统分享 / 复制链接。
// 页面里禁止直接调用 navigator.share / 读写剪贴板，统一走这里。

// 是否在微信内置浏览器中（含企业微信/小程序 webview）
export function isWeixinEnv() {
  return /micromessenger|miniprogram/i.test(navigator.userAgent || '')
}

// 分享到微信。
// 优先顺序：微信内 → 提示「点右上角分享给朋友」（toast 由调用方控制时长）；
// 支持 navigator.share → 唤起系统分享面板（含微信）；
// 其他情况 → 复制当前链接到剪贴板。
// 返回：'weixin' | 'shared' | 'copied' | 'cancelled'
export function shareToWechat({ title, text }) {
  if (isWeixinEnv()) {
    return Promise.resolve('weixin')
  }
  const url = location.href
  const shareData = {
    title: title || document.title,
    text: text || '',
    url
  }
  if (navigator.share) {
    return navigator
      .share(shareData)
      .then(() => 'shared')
      .catch((e) => {
        // 用户取消不算错误
        if (e && e.name === 'AbortError') return 'cancelled'
        return copyText(url).then(() => 'copied')
      })
  }
  return copyText(url).then(() => 'copied')
}

// 复制文本：优先 clipboard API；权限被拒（如页面失焦）时降级 execCommand。
function copyText(text) {
  const fallback = () => copyByExecCommand(text)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(fallback)
  }
  return fallback()
}

function copyByExecCommand(text) {
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '0'
    ta.style.top = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    try {
      const ok = document.execCommand('copy')
      ta.remove()
      if (ok) resolve()
      else reject(new Error('复制失败'))
    } catch (e) {
      ta.remove()
      reject(e)
    }
  })
}
