// AI 图像识别：把照片发给兼容 OpenAI 格式的视觉模型（默认智谱 GLM-4V-Flash），
// 让 AI 认出款式名 / 系列 / IP，返回结构化结果。
// 配置（接口地址、Key、模型）只存在本机浏览器 localStorage，不上传任何地方，
// 也不会随备份导出，避免密钥泄露。

const CONFIG_KEY = 'pm_ai_vision_config'

const DEFAULTS = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-4v-flash'
}

export function loadAiConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { enabled: false, apiKey: '', baseUrl: DEFAULTS.baseUrl, model: DEFAULTS.model }
    const cfg = JSON.parse(raw)
    return {
      enabled: !!cfg.enabled && !!cfg.apiKey,
      apiKey: cfg.apiKey || '',
      baseUrl: cfg.baseUrl || DEFAULTS.baseUrl,
      model: cfg.model || DEFAULTS.model
    }
  } catch (e) {
    return { enabled: false, apiKey: '', baseUrl: DEFAULTS.baseUrl, model: DEFAULTS.model }
  }
}

export function saveAiConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    enabled: !!cfg.enabled,
    apiKey: cfg.apiKey || '',
    baseUrl: cfg.baseUrl || DEFAULTS.baseUrl,
    model: cfg.model || DEFAULTS.model
  }))
}

// 把图片压小一点再发给 AI：省流量、识别更快，也够用
function shrinkImage(dataUrl, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => reject(new Error('图片读取失败'))
    img.src = dataUrl
  })
}

const PROMPT = [
  '你是潮玩手办识别助手。请识别图片里的手办/盲盒，',
  '只返回 JSON（不要 markdown 代码块、不要多余文字）：',
  '{"name":"款式名","series":"系列名","ip":"IP名"}。',
  '看不清的字段留空字符串。如果图里不是手办玩具，name 返回空字符串。'
].join('')

function parseAnswer(text) {
  if (!text) return null
  const s = String(text).trim()
  const m = s.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const obj = JSON.parse(m[0])
    if (!obj || typeof obj !== 'object') return null
    return {
      name: typeof obj.name === 'string' ? obj.name.trim() : '',
      series: typeof obj.series === 'string' ? obj.series.trim() : '',
      ip: typeof obj.ip === 'string' ? obj.ip.trim() : ''
    }
  } catch (e) {
    return null
  }
}

// 测试密钥是否可用：发一条最便宜的纯文本请求
export async function testAiKey(cfg) {
  const resp = await fetch(cfg.baseUrl || DEFAULTS.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey
    },
    body: JSON.stringify({
      model: cfg.model || DEFAULTS.model,
      messages: [{ role: 'user', content: 'ok' }],
      max_tokens: 5
    })
  })
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) throw new Error('密钥无效（401），请检查是否复制完整')
    if (resp.status === 429) throw new Error('调用受限，稍后再试')
    throw new Error('服务出错（' + resp.status + '）')
  }
}

// 主入口：传入照片 dataURL，返回 { name, series, ip }；没认出来返回 null
export async function recognizeFigure(dataUrl) {
  const cfg = loadAiConfig()
  if (!cfg.enabled) throw new Error('未配置 AI 识别')
  const small = await shrinkImage(dataUrl, 768)
  const resp = await fetch(cfg.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: small } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 300
    })
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    if (resp.status === 401 || resp.status === 403) throw new Error('AI 密钥无效，请检查设置里的 API Key')
    if (resp.status === 429) throw new Error('AI 调用太频繁，稍后再试')
    throw new Error('AI 服务出错（' + resp.status + '）' + (text ? text.slice(0, 80) : ''))
  }
  const data = await resp.json()
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : ''
  const parsed = parseAnswer(content)
  if (!parsed || (!parsed.name && !parsed.series && !parsed.ip)) return null
  return parsed
}
