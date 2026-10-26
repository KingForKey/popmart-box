// 相机扫码：支持二维码与一维条码（EAN-13 / UPC-A / CODE-128 等）。
// zxing 体积较大，这里用动态 import 按需加载：只有点开扫码才会下载这段代码，
// 不影响首屏体积与离线缓存的主包。
// 相机能力需要 HTTPS（GitHub Pages 满足）与用户授权，失败时抛出可直接展示的中文错误。

let libPromise = null

function loadLib() {
  if (!libPromise) {
    libPromise = Promise.all([import('@zxing/browser'), import('@zxing/library')]).then(
      ([browser, library]) => ({ browser, library })
    )
  }
  return libPromise
}

// 当前环境是否可能调用相机（无 mediaDevices 通常是 http 或旧浏览器）
export function cameraSupported() {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

function friendlyCameraError(e) {
  const name = (e && e.name) || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return new Error('相机权限被拒绝，请在浏览器设置里允许相机后重试')
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new Error('没有找到可用的相机，可以改用手动输入码')
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return new Error('相机被其他应用占用，请关闭后重试')
  }
  if (name === 'OverconstrainedError') {
    return new Error('相机不支持当前分辨率，请换个浏览器试试')
  }
  return new Error((e && e.message) || '相机启动失败，可以改用手动输入码')
}

// 启动连续扫码。onResult 只在首次识别成功时回调一次（由调用方决定是否停止）。
// 返回 controls，调用 controls.stop() 可关闭相机。
export async function startCameraScan(videoEl, onResult) {
  if (!cameraSupported()) {
    throw new Error('当前环境无法调用相机（需要 HTTPS），可以改用手动输入码')
  }
  const { browser, library } = await loadLib()
  const { BrowserMultiFormatReader } = browser
  const { DecodeHintType, BarcodeFormat } = library

  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)

  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })

  let fired = false
  try {
    return await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      videoEl,
      (result) => {
        if (!result || fired) return
        const text = String(result.getText() || '').trim()
        if (!text) return
        fired = true
        onResult({
          code: text,
          format: BarcodeFormat[result.getBarcodeFormat()] || 'UNKNOWN'
        })
      }
    )
  } catch (e) {
    throw friendlyCameraError(e)
  }
}

// 一维条码 = 整个系列共用一个 SKU 码；二维码通常是单盒唯一码。
export function isOneDimFormat(format) {
  return /EAN|UPC|CODE_128|CODE_39|CODE_93|ITF|CODABAR|MSI/i.test(String(format || ''))
}

// 如果扫到的二维码内容是一个网址，尝试经公共 CORS 代理读取页面标题，
// 用来粗略识别是哪款产品。失败一律返回空字符串，不打断用户操作。
const TITLE_PROXIES = [
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
]

export function resolveWebTitle(code, timeout = 6000) {
  const text = String(code || '').trim()
  if (!/^https?:\/\//i.test(text)) return Promise.resolve('')
  let chain = Promise.reject(new Error('start'))
  for (const wrap of TITLE_PROXIES) {
    chain = chain.catch(() => fetchText(wrap(text), timeout))
  }
  return chain
    .then(extractTitle)
    .catch(() => '')
}

function fetchText(url, timeout) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { signal: controller.signal })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.text()
    })
    .finally(() => clearTimeout(timer))
}

function extractTitle(html) {
  if (!html) return ''
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
  const raw = (og && og[1]) || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || ''
  const title = decodeEntities(String(raw)).replace(/\s+/g, ' ').trim()
  return cleanTitle(title)
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// 去掉常见的站点后缀，留下产品名部分
function cleanTitle(title) {
  const cut = title.split(/\s*[|｜\-—_]\s*(POP\s*MART|泡泡玛特|官方|旗舰店|千岛|得物).*$/i)[0]
  return (cut || title).trim().slice(0, 40)
}
