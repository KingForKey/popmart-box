// 拍照识别：感知指纹 = 结构指纹（dHash）+ 颜色签名（4x4 平均色）。
// 只用结构指纹时，纯色背景的官图/棚拍图容易互相误判，
// 所以再叠一层颜色签名：同一系列的娃颜色也可能接近，但两项都接近才算同一只。
// 纯前端实现，不联网。识别不保证 100% 准确，没把握时宁可不认，让用户手动填。

const W = 17
const H = 16
const GRID = 4

// 从 dataURL 算出照片指纹：'结构指纹.颜色签名'
export function hashImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        resolve(structuralHash(img) + '.' + colorSignature(img))
      } catch (e) {
        reject(new Error('照片处理失败'))
      }
    }
    img.onerror = () => reject(new Error('照片读取失败'))
    img.src = dataUrl
  })
}

// ---------- 结构指纹（dHash） ----------

function structuralHash(img) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data
  const bits = []
  for (let y = 0; y < H; y++) {
    let prev = -1
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      if (prev >= 0) bits.push(g > prev ? 1 : 0)
      prev = g
    }
  }
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    let v = 0
    for (let j = 0; j < 4; j++) v = (v << 1) | (bits[i + j] || 0)
    hex += v.toString(16)
  }
  return hex
}

// ---------- 颜色签名：4x4 网格平均色 ----------

function colorSignature(img) {
  const canvas = document.createElement('canvas')
  canvas.width = GRID
  canvas.height = GRID
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, GRID, GRID)
  const data = ctx.getImageData(0, 0, GRID, GRID).data
  let hex = ''
  for (let i = 0; i < GRID * GRID; i++) {
    for (let c = 0; c < 3; c++) {
      hex += data[i * 4 + c].toString(16).padStart(2, '0')
    }
  }
  return hex
}

// ---------- 比较 ----------

const BIT_COUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]

function structuralDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity
  let d = 0
  for (let i = 0; i < a.length; i++) {
    d += BIT_COUNT[parseInt(a[i], 16) ^ parseInt(b[i], 16)]
  }
  return d
}

// 平均到每一格的色差（0 = 完全相同，越大越不像，>80 基本不是同一只）
function colorDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i += 2) {
    sum += Math.abs(parseInt(a.substr(i, 2), 16) - parseInt(b.substr(i, 2), 16))
  }
  return sum / (GRID * GRID)
}

function splitSig(sig) {
  const parts = String(sig || '').split('.')
  return { h: parts[0] || '', c: parts[1] || '' }
}

// 综合分：结构差异 + 颜色差异加权。越小越像。
function scoreOf(target, cand) {
  const t = splitSig(target)
  const c = splitSig(cand)
  const dD = structuralDistance(t.h, c.h)
  const cD = colorDistance(t.c, c.c)
  if (!isFinite(dD)) return null
  if (!isFinite(cD)) {
    // 老数据没有颜色签名：只能用结构指纹，标准收紧
    return dD <= 25 ? dD * 2 : null
  }
  if (dD > 45 || cD > 70) return null
  return dD + cD
}

// 在候选 [{ hash, product }] 里找最像的。
// 命中条件：综合分领先第二名足够多。没把握返回 null。
export function findBestMatch(targetHash, candidates) {
  let best = null
  let bestS = Infinity
  let secondS = Infinity
  for (const c of candidates) {
    if (!c || !c.hash) continue
    const s = scoreOf(targetHash, c.hash)
    if (s === null) continue
    if (s < bestS) {
      secondS = bestS
      bestS = s
      best = c
    } else if (s < secondS) {
      secondS = s
    }
  }
  if (!best) return null
  if (secondS !== Infinity && secondS - bestS < 12) return null
  return best
}
