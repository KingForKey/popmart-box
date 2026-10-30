import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import App from './App.jsx'
import { saveAiConfig } from './platform/aiVision.js'
import { showToast } from './platform/toast.js'

// 自动配置 AI 识别：链接带 #aikey=xxx 时，保存配置并立即清除地址栏里的 key。
// 用途：把完整配置链接生成二维码，手机扫码即完成 AI 配置，避免手敲长密钥。
// 链接片段（# 后面部分）不会发送到任何服务器，只在本机浏览器处理。
;(function autoConfigAi() {
  try {
    const hash = window.location.hash || ''
    if (hash.indexOf('aikey=') < 0) return
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const apiKey = params.get('aikey') || ''
    if (!apiKey) return
    saveAiConfig({
      enabled: true,
      apiKey,
      model: params.get('aimodel') || undefined,
      baseUrl: params.get('aibase') || undefined
    })
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setTimeout(() => showToast('AI 识别已自动配置完成'), 800)
  } catch (e) {
    /* 配置失败不影响正常使用 */
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// 注册离线缓存：断网后仍可打开已访问过的页面（数据本身在 localStorage）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 注册失败不影响正常使用 */
    })
  })
}
