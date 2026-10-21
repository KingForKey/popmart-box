// 平台能力封装：联网搜索泡泡玛特产品图。
// 首选：360 图片 image.so.com 的 /j 接口（JSONP，国内直连、无跨域限制，
// 返回 img 原图 + thumb 自家 CDN 缩略图）；
// 备用：经公共 CORS 代理抓取 Bing 图片搜索页并提取原图地址。
// 选中的图经 images.weserv.nl 代理下载并压缩为 400px webp dataURL，
// 之后走本地图片存储。网络不通时会失败，失败信息会展示给用户。

const SEARCH_SUFFIX = ' 泡泡玛特'
const RESULT_LIMIT = 24
const FETCH_TIMEOUT = 8000

const HTML_PROXIES = [
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
]

export function searchProductImages(keyword) {
  const q = String(keyword || '').trim()
  if (!q) return Promise.reject(new Error('请先输入搜索关键词'))
  const query = q + SEARCH_SUFFIX

  return searchSo360(query)
    .catch(() => searchBingViaProxies(query))
    .then((items) => {
      if (!items.length) throw new Error('没有搜到图片，换个关键词试试')
      return items
    })
    .catch(friendlyError)
}

// 选中一张网图，下载并压缩为 dataURL
export function fetchProductImage(url) {
  return new Promise((resolve, reject) => {
    const proxied =
      'https://images.weserv.nl/?url=' + encodeURIComponent(url) + '&w=800'
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        resolve(compressToDataUrl(img))
      } catch (e) {
        reject(new Error('图片处理失败'))
      }
    }
    img.onerror = () => reject(new Error('图片下载失败，请换一张试试'))
    img.src = proxied
  }).catch(friendlyError)
}

// 缩略图展示地址（仅 <img> 展示用，无需 CORS）
export function netThumbUrl(url) {
  return (
    'https://images.weserv.nl/?url=' +
    encodeURIComponent(url) +
    '&w=200&h=200&fit=cover'
  )
}

function friendlyError(e) {
  const msg = e && e.message ? e.message : ''
  if (msg.indexOf('abort') >= 0 || msg.indexOf('TIMEOUT') >= 0) {
    throw new Error('搜索超时，请检查网络后重试')
  }
  if (msg === 'LOAD') throw new Error('搜索服务连接失败')
  if (msg === 'PARSE') throw new Error('搜索结果解析失败')
  throw new Error(msg || '搜索失败，请稍后再试')
}

// ---------- 360 图片（JSONP，国内直连） ----------
// 注意：实测 pn 必须给 30 这类较大值，小 pn 会返回空结果。

function searchSo360(query) {
  return new Promise((resolve, reject) => {
    const cbName =
      'popmartImgSearch_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('TIMEOUT'))
    }, FETCH_TIMEOUT)

    window[cbName] = (data) => {
      clearTimeout(timer)
      cleanup()
      try {
        const list = (data && data.list) || []
        const out = []
        const seen = {}
        for (const it of list) {
          if (!it) continue
          const full = it.img || it.thumb || ''
          if (!/^https?:\/\//i.test(full)) continue
          if (seen[full]) continue
          seen[full] = true
          out.push({ full, thumb: it.thumb || full })
          if (out.length >= RESULT_LIMIT) break
        }
        resolve(out)
      } catch (e) {
        reject(new Error('PARSE'))
      }
    }

    function cleanup() {
      try {
        delete window[cbName]
      } catch (e) {
        window[cbName] = undefined
      }
      if (script.parentNode) script.parentNode.removeChild(script)
    }

    script.onerror = () => {
      clearTimeout(timer)
      cleanup()
      reject(new Error('LOAD'))
    }

    const q = encodeURIComponent(query)
    script.src =
      'https://image.so.com/j?q=' + q + '&sn=0&pn=30&callback=' + cbName
    document.head.appendChild(script)
  })
}

// ---------- Bing 图片（经公共 CORS 代理，作为备用） ----------

function searchBingViaProxies(query) {
  const target =
    'https://cn.bing.com/images/search?q=' +
    encodeURIComponent(query) +
    '&form=HDRSC2&first=1'
  let chain = Promise.reject(new Error('start'))
  for (const wrap of HTML_PROXIES) {
    chain = chain.catch(() => fetchTextWithTimeout(wrap(target)))
  }
  return chain
    .then(extractImageUrls)
    .then((urls) =>
      urls.map((u) => ({ full: u, thumb: 'https://images.weserv.nl/?url=' + encodeURIComponent(u) + '&w=200&h=200&fit=cover' }))
    )
}

function fetchTextWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { signal: controller.signal })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.text()
    })
    .finally(() => clearTimeout(timer))
}

// Bing 图片搜索页里每张图的 meta JSON 都带 "murl":"原图地址"
function extractImageUrls(html) {
  const out = []
  const re = /"murl":"(.*?)"/g
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const url = JSON.parse('"' + m[1] + '"')
      if (/^https?:\/\//i.test(url) && out.indexOf(url) < 0) out.push(url)
    } catch (e) {
      // 转义解析失败的单条直接跳过
    }
    if (out.length >= RESULT_LIMIT) break
  }
  return out
}

function compressToDataUrl(img) {
  const MAX_EDGE = 400
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  if (w > MAX_EDGE || h > MAX_EDGE) {
    if (w >= h) {
      h = Math.round((h * MAX_EDGE) / w)
      w = MAX_EDGE
    } else {
      w = Math.round((w * MAX_EDGE) / h)
      h = MAX_EDGE
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/webp', 0.8)
}
