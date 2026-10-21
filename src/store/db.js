// 数据访问层：所有页面/组件只能通过这里读写数据。
// 内部实现目前用 localStorage，key 为 'popmart_db_v1'；
// 所有函数返回 Promise，以后换成云数据库时调用方不用改。

const DB_KEY = 'popmart_db_v1'
const IMG_PREFIX = 'popmart_img_'
const AUTO_KEY = 'popmart_box_autobackup_v1'
// 自动备份节流：至少间隔 1 分钟，避免频繁写大对象
const AUTO_INTERVAL = 60 * 1000

export const DEFAULT_SOURCES = ['门店', '天猫', '得物', '闲鱼', '其他']

let cache = null
let lastAutoAt = 0

function readDB() {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(DB_KEY)
    cache = raw ? JSON.parse(raw) : null
  } catch (e) {
    cache = null
  }
  if (!cache || typeof cache !== 'object') cache = {}
  if (!Array.isArray(cache.products)) cache.products = []
  if (!Array.isArray(cache.records)) cache.records = []
  return cache
}

function writeDB(db) {
  cache = db
  localStorage.setItem(DB_KEY, JSON.stringify(db))
  maybeAutoBackup(db)
}

// 自动备份：每次写入后（节流 1 分钟）保存一份完整快照。
// 用于防止误操作/数据异常时没有手动导出过备份。
// 图片体积过大（> 2MB）时快照只保留文本数据，避免撑爆存储。
function maybeAutoBackup(db) {
  const now = Date.now()
  if (now - lastAutoAt < AUTO_INTERVAL) return
  const products = Array.isArray(db.products) ? db.products : []
  const records = Array.isArray(db.records) ? db.records : []
  if (products.length === 0 && records.length === 0) return
  const images = {}
  for (const p of products) {
    if (!p.imageKey) continue
    const data = localStorage.getItem(IMG_PREFIX + p.imageKey)
    if (data) images[p.imageKey] = data
  }
  const snap = {
    app: 'popmart-box',
    version: 1,
    exportedAt: now,
    products,
    records,
    sources: readSources(db),
    nickname: typeof db.nickname === 'string' ? db.nickname : '',
    images,
    auto: true
  }
  try {
    let text = JSON.stringify(snap)
    if (text.length > 2000000) {
      snap.images = {}
      text = JSON.stringify(snap)
    }
    localStorage.setItem(AUTO_KEY, text)
    lastAutoAt = now
  } catch (e) {
    /* 空间不足时放弃本次自动备份，不影响主流程 */
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// ---------- 初始化 ----------

export function initDB() {
  return new Promise((resolve) => {
    const db = readDB()
    if (!Array.isArray(db.sources)) {
      db.sources = DEFAULT_SOURCES.slice()
      writeDB(db)
    }
    resolve()
  })
}

// ---------- 商品 ----------

export function getAllProducts() {
  return new Promise((resolve) => {
    resolve(readDB().products.slice())
  })
}

export function getProductById(id) {
  return new Promise((resolve) => {
    const found = readDB().products.find((p) => p.id === id)
    resolve(found || null)
  })
}

export function addProduct(data) {
  return new Promise((resolve) => {
    const db = readDB()
    const product = { ...data, id: genId() }
    db.products.push(product)
    writeDB(db)
    resolve(product)
  })
}

export function updateProduct(id, patch) {
  return new Promise((resolve) => {
    const db = readDB()
    const idx = db.products.findIndex((p) => p.id === id)
    if (idx < 0) {
      resolve(null)
      return
    }
    db.products[idx] = { ...db.products[idx], ...patch }
    writeDB(db)
    resolve(db.products[idx])
  })
}

export function deleteProduct(id) {
  return new Promise((resolve) => {
    const db = readDB()
    db.products = db.products.filter((p) => p.id !== id)
    writeDB(db)
    resolve()
  })
}

// 恢复整条产品数据（删除撤销用，保留原 id）
export function restoreProduct(product) {
  return new Promise((resolve) => {
    const db = readDB()
    if (!db.products.some((p) => p.id === product.id)) {
      db.products.push(product)
      writeDB(db)
    }
    resolve(product)
  })
}

// ---------- 记录 ----------

export function getAllRecords() {
  return new Promise((resolve) => {
    resolve(readDB().records.slice())
  })
}

export function addRecord(data) {
  return new Promise((resolve) => {
    const db = readDB()
    const record = { ...data, id: genId() }
    db.records.push(record)
    writeDB(db)
    resolve(record)
  })
}

export function deleteRecord(id) {
  return new Promise((resolve) => {
    const db = readDB()
    db.records = db.records.filter((r) => r.id !== id)
    writeDB(db)
    resolve()
  })
}

// ---------- 图片（dataURL 存独立 key，避免撑大主库） ----------

export function getImage(key) {
  return new Promise((resolve) => {
    resolve(localStorage.getItem(IMG_PREFIX + key))
  })
}

export function saveImage(key, dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      localStorage.setItem(IMG_PREFIX + key, dataUrl)
      resolve()
    } catch (e) {
      reject(new Error('图片保存失败（存储空间不足）'))
    }
  })
}

export function deleteImage(key) {
  return new Promise((resolve) => {
    localStorage.removeItem(IMG_PREFIX + key)
    resolve()
  })
}

// ---------- 来源平台（标签池，可手动管理） ----------

function readSources(db) {
  if (!Array.isArray(db.sources)) db.sources = DEFAULT_SOURCES.slice()
  return db.sources
}

export function getSources() {
  return new Promise((resolve) => {
    resolve(readSources(readDB()).slice())
  })
}

export function addSource(name) {
  return new Promise((resolve, reject) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) {
      reject(new Error('名称不能为空'))
      return
    }
    const db = readDB()
    const list = readSources(db)
    if (list.indexOf(trimmed) >= 0) {
      reject(new Error('该来源已存在'))
      return
    }
    list.push(trimmed)
    writeDB(db)
    resolve(list.slice())
  })
}

// 重命名会同步更新已保存商品的 source 字段
export function renameSource(oldName, newName) {
  return new Promise((resolve, reject) => {
    const from = String(oldName || '').trim()
    const to = String(newName || '').trim()
    if (!to) {
      reject(new Error('名称不能为空'))
      return
    }
    const db = readDB()
    const list = readSources(db)
    const idx = list.indexOf(from)
    if (idx < 0) {
      reject(new Error('来源不存在'))
      return
    }
    if (to !== from && list.indexOf(to) >= 0) {
      reject(new Error('该来源已存在'))
      return
    }
    list[idx] = to
    for (const p of db.products) {
      if (p.source === from) p.source = to
    }
    writeDB(db)
    resolve(list.slice())
  })
}

// 删除只移除标签池，历史商品上已保存的 source 字段保持不变
export function deleteSource(name) {
  return new Promise((resolve) => {
    const db = readDB()
    const list = readSources(db)
    const idx = list.indexOf(String(name || '').trim())
    if (idx >= 0) {
      list.splice(idx, 1)
      writeDB(db)
    }
    resolve(list.slice())
  })
}

// ---------- 用户配置（昵称） ----------

export function getNickname() {
  return new Promise((resolve) => {
    const db = readDB()
    resolve(typeof db.nickname === 'string' ? db.nickname : '')
  })
}

// 空字符串表示清除昵称；最长 12 个字
export function setNickname(name) {
  return new Promise((resolve) => {
    const db = readDB()
    db.nickname = String(name || '').trim().slice(0, 12)
    writeDB(db)
    resolve(db.nickname)
  })
}

// ---------- 备份：整库导出 / 导入 ----------

// 导出全部数据（含被引用的图片 dataURL），纯 JSON 可序列化
export function exportAll() {
  return new Promise((resolve) => {
    const db = readDB()
    const images = {}
    for (const p of db.products) {
      if (p.imageKey) {
        const dataUrl = localStorage.getItem(IMG_PREFIX + p.imageKey)
        if (dataUrl) images[p.imageKey] = dataUrl
      }
    }
    resolve({
      app: 'popmart-box',
      version: 1,
      exportedAt: Date.now(),
      products: db.products,
      records: db.records,
      sources: readSources(db),
      nickname: typeof db.nickname === 'string' ? db.nickname : '',
      images
    })
  })
}

// 导入备份：整体覆盖当前数据。
// 只接受 app === 'popmart-box' 且结构完整的备份；成功返回统计数。
export function importAll(backup) {
  return new Promise((resolve, reject) => {
    try {
      resolve(applyBackup(backup))
    } catch (e) {
      reject(e)
    }
  })
}

// 读取自动备份摘要（不存在返回 null）
export function getAutoBackupInfo() {
  return new Promise((resolve) => {
    try {
      const raw = localStorage.getItem(AUTO_KEY)
      if (!raw) {
        resolve(null)
        return
      }
      const b = JSON.parse(raw)
      resolve({
        savedAt: Number(b.exportedAt) || 0,
        products: Array.isArray(b.products) ? b.products.length : 0,
        records: Array.isArray(b.records) ? b.records.length : 0,
        hasImages: !!(b.images && Object.keys(b.images).length > 0)
      })
    } catch (e) {
      resolve(null)
    }
  })
}

// 用自动备份覆盖当前数据
export function restoreAutoBackup() {
  return new Promise((resolve, reject) => {
    try {
      const raw = localStorage.getItem(AUTO_KEY)
      if (!raw) {
        reject(new Error('没有可用的自动备份'))
        return
      }
      resolve(applyBackup(JSON.parse(raw)))
    } catch (e) {
      reject(new Error('自动备份已损坏，无法恢复'))
    }
  })
}

// 内部：校验并整体应用一份备份数据
function applyBackup(backup) {
  if (!backup || backup.app !== 'popmart-box' || backup.version !== 1) {
    throw new Error('不是有效的娃柜备份文件')
  }
  const products = Array.isArray(backup.products) ? backup.products : []
  const records = Array.isArray(backup.records) ? backup.records : []
  const sources = Array.isArray(backup.sources) ? backup.sources : []
  const images =
    backup.images && typeof backup.images === 'object' ? backup.images : {}

  try {
    // 先清旧图片再写新图，避免空间占用
    const stale = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.indexOf(IMG_PREFIX) === 0) stale.push(k)
    }
    for (const k of stale) localStorage.removeItem(k)
    for (const key of Object.keys(images)) {
      localStorage.setItem(IMG_PREFIX + key, images[key])
    }
  } catch (e) {
    throw new Error('备份图片写入失败（存储空间不足）')
  }

  const db = readDB()
  db.products = products
  db.records = records
  db.sources = sources
  db.nickname = typeof backup.nickname === 'string' ? backup.nickname.slice(0, 12) : ''
  writeDB(db)
  return { products: products.length, records: records.length }
}
