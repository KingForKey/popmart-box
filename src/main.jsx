import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import App from './App.jsx'

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
