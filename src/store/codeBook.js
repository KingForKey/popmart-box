// 本地码库：记住「包装上的码 → 款式信息」。
// 扫过一次并保存后，下次扫同一个码会自动填表，不用再重复输入。
//
// 为什么需要它：
// - 一维条码（EAN-13 等）是系列 SKU，一个系列的所有盒子共用一个码，
//   所以只能记「系列 / IP」，不能记具体款式（盲盒本身就不告诉你是哪款）。
// - 二维码通常是单盒唯一码或产品页链接，可以记具体款式名。
// - 官方没有开放的公开反查接口，所以码库只能在用户自己的手机上边用边学。

const KEY = 'popmart_codebook_v1'

function readBook() {
  try {
    const raw = localStorage.getItem(KEY)
    const obj = raw ? JSON.parse(raw) : {}
    return obj && typeof obj === 'object' ? obj : {}
  } catch (e) {
    return {}
  }
}

function writeBook(book) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book))
  } catch (e) {
    // 存储满时静默忽略，不影响入库主流程
  }
}

export function normalizeCode(code) {
  return String(code || '').replace(/\s+/g, '').trim()
}

export function lookupCode(code) {
  const c = normalizeCode(code)
  if (!c) return null
  const hit = readBook()[c]
  return hit && typeof hit === 'object' ? hit : null
}

function isOneDim(format) {
  return /EAN|UPC|CODE_128|CODE_39|CODE_93|ITF|CODABAR|MSI/i.test(String(format || ''))
}

// 保存款式时调用：把「码 → 系列/IP/款式」写进码库。
export function rememberCode({ code, format, name, series, ip, rarity }) {
  const c = normalizeCode(code)
  if (!c) return
  const book = readBook()
  const prev = book[c] || {}
  const oneDim = isOneDim(format)
  book[c] = {
    // 一维码只学系列与 IP，避免把某一盒的款式名错记成整个系列
    series: String(series || '').trim() || prev.series || '',
    ip: String(ip || '').trim() || prev.ip || '',
    name: oneDim ? prev.name || '' : String(name || '').trim() || prev.name || '',
    rarity: oneDim ? prev.rarity || '' : rarity || prev.rarity || '',
    format: format || prev.format || '',
    updatedAt: Date.now()
  }
  writeBook(book)
}

export function codeBookSize() {
  return Object.keys(readBook()).length
}
