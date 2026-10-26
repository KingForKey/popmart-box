import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import SourceManager from './SourceManager.jsx'
import SuggestInput from './SuggestInput.jsx'
import ScanSheet from './ScanSheet.jsx'
import { IP_DICT, SERIES_BY_IP, STYLES_BY_SERIES, ALL_SERIES, ALL_STYLES, matchIp } from '../data/popDict.js'
import {
  getAllProducts,
  addProduct,
  updateProduct,
  addRecord,
  saveImage,
  deleteImage,
  getImage,
  getSources,
  newImageKey,
  getProductGalleryKeys
} from '../store/db.js'
import { CHANNELS, CONDITIONS, formatDate } from '../store/models.js'
import { lookupCode, rememberCode } from '../store/codeBook.js'
import { resolveWebTitle } from '../platform/scan.js'
import { hashImage, findBestMatch } from '../platform/photoMatch.js'
import { pickImage } from '../platform/image.js'
import { searchProductImages, fetchProductImage } from '../platform/imageSearch.js'
import { showToast } from '../platform/toast.js'

const IP_TAGS = ['Molly', 'Dimoo', 'Skullpanda', 'Labubu']
const RARITY_OPTIONS = [
  { value: '', label: '普通' },
  { value: 'secret', label: '隐藏款' },
  { value: 'ultra', label: '大隐藏款' }
]

function toNumber(text) {
  const n = parseFloat(text)
  return isNaN(n) ? 0 : n
}

// 入库 / 编辑款式 弹窗。
// initialData 有值时为编辑模式：只更新 product，不碰 record，隐藏成本价/日期。
// 支持多张图片（主图 + galleryKeys 额外图），rarity 字段替换旧 isSecret。
// 向后兼容：老产品 isSecret=true 会映射为 rarity='secret' 写入。

export default function AddSheet({ open, onClose, onSuccess, initialData, initialImage, seriesOptions }) {
  const isEdit = !!initialData
  const [name, setName] = useState('')
  const [series, setSeries] = useState('')
  const [ip, setIp] = useState('')
  const [rarity, setRarity] = useState('')
  const [price, setPrice] = useState('59')
  const [date, setDate] = useState('')
  const [channel, setChannel] = useState('现货可发')
  const [cond, setCond] = useState(CONDITIONS[0])
  const [presale, setPresale] = useState('')
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  // 主图 dataURL（编辑时可能和 initialImage 相同）
  const [image, setImage] = useState(null)
  // 额外图 dataURL 数组（主图不算在里面）
  const [extraImages, setExtraImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef(null)
  // 历史款式列表：用于输入联想（打开时加载一次）
  const [allProducts, setAllProducts] = useState([])

  const [sources, setSources] = useState([])
  const [managerOpen, setManagerOpen] = useState(false)

  const [useNetImage, setUseNetImage] = useState(false)
  const [netKeyword, setNetKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [netError, setNetError] = useState('')
  const [netResults, setNetResults] = useState([])
  const [pickingUrl, setPickingUrl] = useState(null)

  // 扫码：scanInfo 保存本次扫到的码，随款式一起存档，用于下次自动识别
  const [scanOpen, setScanOpen] = useState(false)
  const [scanInfo, setScanInfo] = useState(null)
  const [scanning, setScanning] = useState(false)
  // 拍照识别中状态
  const [photoScanning, setPhotoScanning] = useState(false)

  function reloadSources() {
    getSources().then(setSources)
  }

  // ---------- 输入联想：历史数据优先，字典兜底 ----------

  const nameSuggestions = useMemo(() => {
    const out = []
    // 已选系列时，该系列的字典款式名排最前
    const seriesKey = series.trim()
    if (seriesKey && STYLES_BY_SERIES[seriesKey]) {
      for (const n of STYLES_BY_SERIES[seriesKey]) out.push(n)
    }
    for (const p of allProducts) {
      const n = (p.name || '').trim()
      if (n && out.indexOf(n) < 0) out.push(n)
    }
    for (const n of ALL_STYLES) {
      if (out.indexOf(n) < 0) out.push(n)
    }
    return out
  }, [allProducts, series])

  const seriesSuggestions = useMemo(() => {
    const out = []
    // 已选 IP 时，该 IP 的字典系列排最前
    const matched = matchIp(ip)
    if (matched && SERIES_BY_IP[matched]) {
      for (const s of SERIES_BY_IP[matched]) out.push(s)
    }
    for (const p of allProducts) {
      const s = (p.series || '').trim()
      if (s && out.indexOf(s) < 0) out.push(s)
    }
    for (const s of ALL_SERIES) {
      if (out.indexOf(s) < 0) out.push(s)
    }
    return out
  }, [allProducts, ip])

  const ipSuggestions = useMemo(() => {
    const out = []
    for (const p of allProducts) {
      const v = (p.ip || '').trim()
      if (v && out.indexOf(v) < 0) out.push(v)
    }
    for (const v of IP_DICT) {
      if (out.indexOf(v) < 0) out.push(v)
    }
    return out
  }, [allProducts])

  // 每次打开时初始化表单
  useEffect(() => {
    if (!open) return
    // 重置额外图列表
    setExtraImages([])
    if (initialData) {
      setName(initialData.name || '')
      setSeries(initialData.series || '')
      setIp(initialData.ip || '')
      // 向后兼容：老产品只有 isSecret 没有 rarity
      const r = initialData.rarity || (initialData.isSecret ? 'secret' : '')
      setRarity(r)
      setSource(initialData.source || '')
      setNote(initialData.note || '')
      setImage(initialImage || null)
      // 加载额外图：galleryKeys[1...] 对应 initialImage 已经是 galleryKeys[0]
      const keys = getProductGalleryKeys(initialData)
      if (keys.length > 1) {
        Promise.all(keys.slice(1).map((k) => getImage(k))).then((urls) => {
          setExtraImages(urls.filter(Boolean))
        })
      }
    } else {
      setName('')
      setSeries('')
      setIp('')
      setRarity('')
      setPrice('59')
      setDate(formatDate(Date.now()))
      setChannel('现货可发')
      setCond(CONDITIONS[0])
      setPresale(formatDate(Date.now()))
      setSource('')
      setNote('')
      setImage(null)
    }
    setSubmitting(false)
    setUseNetImage(false)
    setNetKeyword('')
    setSearching(false)
    setNetError('')
    setNetResults([])
    setPickingUrl(null)
    setManagerOpen(false)
    setScanOpen(false)
    setScanning(false)
    setPhotoScanning(false)
    // 编辑时沿用款式上已存的码；新增时清空
    setScanInfo(
      initialData && initialData.scanCode
        ? { code: initialData.scanCode, format: initialData.scanFormat || '' }
        : null
    )
    reloadSources()
    getAllProducts().then(setAllProducts)
  }, [open, initialData, initialImage])

  // 打开后自动聚焦款式名
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (nameRef.current) nameRef.current.focus()
    }, 300)
    return () => clearTimeout(t)
  }, [open])

  function handlePickImage() {
    pickImage()
      .then((dataUrl) => setImage(dataUrl))
      .catch((err) => {
        const msg = err && err.message ? err.message : ''
        if (msg.indexOf('取消') >= 0 || msg.indexOf('未选择') >= 0) return
        showToast(msg || '图片读取失败')
      })
  }

  function handlePickExtraImage() {
    pickImage()
      .then((dataUrl) => setExtraImages((arr) => [...arr, dataUrl]))
      .catch((err) => {
        const msg = err && err.message ? err.message : ''
        if (msg.indexOf('取消') >= 0 || msg.indexOf('未选择') >= 0) return
        showToast(msg || '图片读取失败')
      })
  }

  function removeExtraImage(i) {
    setExtraImages((arr) => arr.filter((_, idx) => idx !== i))
  }

  // 把额外图提升为主图：和 image 交换
  function promoteExtraToMain(i) {
    setExtraImages((arr) => {
      const picked = arr[i]
      const rest = arr.slice(0, i).concat(arr.slice(i + 1))
      setImage(picked)
      return rest
    })
  }

  function toggleNetImage(on) {
    setUseNetImage(on)
    setNetError('')
    setNetResults([])
    if (on) {
      setNetKeyword(name.trim() || series.trim() || ip.trim() || '')
    }
  }

  async function doNetSearch() {
    const kw = netKeyword.trim()
    if (!kw || searching) return
    setSearching(true)
    setNetError('')
    setNetResults([])
    try {
      setNetResults(await searchProductImages(kw))
    } catch (e) {
      setNetError((e && e.message) || '搜索失败，请稍后再试')
    } finally {
      setSearching(false)
    }
  }

  async function pickNetImage(url) {
    if (pickingUrl) return
    setPickingUrl(url)
    try {
      const dataUrl = await fetchProductImage(url)
      setImage(dataUrl)
      setUseNetImage(false)
      setNetResults([])
      setNetError('')
    } catch (e) {
      showToast((e && e.message) || '图片下载失败')
    } finally {
      setPickingUrl(null)
    }
  }

  // 扫码结果：先查本地码库，命中就直接填表；未命中则存档待下次学习。
  async function handleScanResult(res) {
    setScanOpen(false)
    const code = res.code
    const format = res.format || ''
    setScanInfo({ code, format })
    setScanning(true)
    try {
      const hit = lookupCode(code)
      if (hit) {
        if (hit.series) setSeries(hit.series)
        if (hit.ip) setIp(hit.ip)
        if (hit.name) setName(hit.name)
        if (hit.rarity) setRarity(hit.rarity)
        showToast('已识别：' + (hit.name || hit.series || '该码已收录'))
        return
      }

      // 二维码内容若是网址，尝试联网读取产品标题（失败不影响使用）
      const title = await resolveWebTitle(code)
      if (title) {
        if (!name.trim()) setName(title)
        if (!netKeyword.trim()) setNetKeyword(title)
        showToast('已按网页信息填入，可修改')
      } else {
        showToast('新码已记录，填好款式名后下次自动识别')
      }
    } finally {
      setScanning(false)
    }
  }

  // 拍照识别：拍一张照片当主图，同时算出照片指纹，
  // 和已入库款式逐一比对。命中就自动填表；没命中这张照片也留下来当主图。
  // 老款式没有指纹的，会在第一次识别时现场补齐并保存，之后就越用越快。
  async function handlePhotoRecognize() {
    if (photoScanning) return
    let dataUrl
    try {
      dataUrl = await pickImage()
    } catch (err) {
      const msg = err && err.message ? err.message : ''
      if (msg.indexOf('取消') < 0 && msg.indexOf('未选择') < 0) {
        showToast(msg || '图片读取失败')
      }
      return
    }
    setImage(dataUrl)
    setPhotoScanning(true)
    try {
      const target = await hashImage(dataUrl)
      const products = await getAllProducts()
      const candidates = []
      for (const p of products) {
        let h = p.photoHash || ''
        if (!h && p.imageKey) {
          try {
            const url = await getImage(p.imageKey)
            if (url) {
              h = await hashImage(url)
              // 顺手把指纹存回去，下次不用再算
              await updateProduct(p.id, { photoHash: h })
            }
          } catch (e) {
            // 单条失败跳过，不影响其他款式
          }
        }
        if (h) candidates.push({ hash: h, product: p })
      }
      const hit = findBestMatch(target, candidates)
      if (hit && hit.product && (!isEdit || hit.product.id !== initialData.id)) {
        const p = hit.product
        if (p.name) setName(p.name)
        if (p.series) setSeries(p.series)
        if (p.ip) setIp(p.ip)
        if (p.rarity) setRarity(p.rarity)
        else if (p.isSecret) setRarity('secret')
        if (p.source) setSource(p.source)
        showToast('认出是「' + p.name + '」，不对可以手动改')
      } else {
        showToast('没认出来，填好款式名保存后就记住了')
      }
    } catch (e) {
      showToast('识别失败，照片已保留，手动填写即可')
    } finally {
      setPhotoScanning(false)
    }
  }

  async function handleSubmit() {
    const trimmedName = name.trim()
    if (!trimmedName || submitting) return
    setSubmitting(true)
    try {
      // 统一把主图 + 额外图映射成最终 galleryKeys（key 数组）
      // 不变的主图/额外图复用原 key，新图生成新 key
      const initialGalleryKeys = isEdit ? getProductGalleryKeys(initialData) : []
      const savedKeys = [] // 最终确定要写回的 key

      // 主图：image（dataURL）可能和 initialImage 一样或不一样
      if (image) {
        const newMainKey = initialGalleryKeys[0] || newImageKey()
        if (!initialGalleryKeys[0] || image !== initialImage) {
          await saveImage(newMainKey, image)
        }
        savedKeys.push(newMainKey)
      }

      // 额外图：按"保持顺序 + 只保留还有 dataURL 的"来对齐
      // 先尝试把 extraImages[i] 对应到 initialGalleryKeys[i+1]，相同就复用 key，不同就新 key
      for (let i = 0; i < extraImages.length; i++) {
        const dataUrl = extraImages[i]
        if (!dataUrl) continue
        const initialExtraKey = initialGalleryKeys[i + 1]
        let key = initialExtraKey
        if (!key) {
          key = newImageKey()
          await saveImage(key, dataUrl)
        } else {
          // 如果和原来一样（同一个 dataURL）就不再写 localStorage，否则重存
          // 但我们不知道原来存的是什么 dataURL，简单起见也重存一次（幂等）
          await saveImage(key, dataUrl)
        }
        savedKeys.push(key)
      }

      // 清理 initialGalleryKeys 里不再出现的 key（用户删掉了）
      if (isEdit) {
        for (const oldK of initialGalleryKeys) {
          if (savedKeys.indexOf(oldK) < 0) {
            await deleteImage(oldK)
          }
        }
      }

      // 照片指纹：主图变了才重新算；编辑时没动主图就沿用旧的；没有主图就清空
      let photoHashVal = isEdit ? initialData.photoHash || '' : ''
      if (!image) {
        photoHashVal = ''
      } else if (!isEdit || image !== initialImage) {
        try {
          photoHashVal = await hashImage(image)
        } catch (e) {
          // 算不出来不阻塞保存
        }
      }

      if (isEdit) {
        const patch = {
          name: trimmedName,
          series: series.trim(),
          ip: ip.trim(),
          rarity,
          // 向后兼容：仍写 isSecret，让老版本备份恢复时能识别
          isSecret: rarity === 'secret' || rarity === 'ultra',
          source,
          note: note.trim(),
          imageKey: savedKeys[0] || null,
          galleryKeys: savedKeys,
          // 扫到的码随款式存档（可选字段，老版本读取时忽略）
          scanCode: scanInfo ? scanInfo.code : '',
          scanFormat: scanInfo ? scanInfo.format : '',
          photoHash: photoHashVal
        }
        await updateProduct(initialData.id, patch)
      } else {
        const products = await getAllProducts()
        const trimmedSeries = series.trim()
        const existing = products.find(
          (p) =>
            (p.name || '').toLowerCase() === trimmedName.toLowerCase() &&
            (p.series || '').trim() === trimmedSeries
        )
        if (existing) {
          // 同名同系列已存在：复用 product，只新增一条入库记录。
          // 顺手补齐老款式缺失的码与照片指纹，让它也进入识别记忆库
          if ((scanInfo && scanInfo.code && !existing.scanCode) || (photoHashVal && !existing.photoHash)) {
            await updateProduct(existing.id, {
              scanCode: existing.scanCode || (scanInfo ? scanInfo.code : ''),
              scanFormat: existing.scanFormat || (scanInfo ? scanInfo.format : ''),
              photoHash: existing.photoHash || photoHashVal
            })
          }
          await addRecord({
            productId: existing.id,
            type: 'in',
            quantity: 1,
            price: toNumber(price),
            channel,
            condition: channel === '现货可发' ? cond : null,
            presaleDate: channel === '盒机转赠' ? presale || null : null,
            date,
            createdAt: Date.now()
          })
        } else {
          const created = await addProduct({
            name: trimmedName,
            series: trimmedSeries,
            ip: ip.trim(),
            rarity,
            isSecret: rarity === 'secret' || rarity === 'ultra',
            source,
            note: note.trim(),
            imageKey: savedKeys[0] || null,
            galleryKeys: savedKeys,
            scanCode: scanInfo ? scanInfo.code : '',
            scanFormat: scanInfo ? scanInfo.format : '',
            photoHash: photoHashVal,
            createdAt: Date.now()
          })
          await addRecord({
            productId: created.id,
            type: 'in',
            quantity: 1,
            price: toNumber(price),
            channel,
            condition: channel === '现货可发' ? cond : null,
            presaleDate: channel === '盒机转赠' ? presale || null : null,
            date,
            createdAt: Date.now()
          })
        }
      }
      // 学习码库：下次扫到同一个码就能直接填表
      if (scanInfo && scanInfo.code) {
        rememberCode({
          code: scanInfo.code,
          format: scanInfo.format,
          name: trimmedName,
          series: series.trim(),
          ip: ip.trim(),
          rarity
        })
      }
      onSuccess()
    } catch (e) {
      showToast((e && e.message) || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEdit ? '编辑款式' : '入库'}>
      <div className="add-form">
        <div className="scan-entry">
          <button
            type="button"
            className="scan-entry-btn"
            onClick={() => setScanOpen(true)}
            disabled={scanning || photoScanning}
          >
            <span className="scan-entry-icon" aria-hidden="true">▣</span>
            {scanning ? '识别中…' : '扫码识别'}
          </button>
          <button
            type="button"
            className="scan-entry-btn photo"
            onClick={handlePhotoRecognize}
            disabled={photoScanning || scanning}
          >
            <span className="scan-entry-icon" aria-hidden="true">◉</span>
            {photoScanning ? '识别中…' : '拍照识别'}
          </button>
        </div>
        {scanInfo && (
          <div className="scan-chip-row">
            <span className="scan-chip" title={scanInfo.code}>
              码 {scanInfo.code.length > 16
                ? scanInfo.code.slice(0, 8) + '…' + scanInfo.code.slice(-4)
                : scanInfo.code}
            </span>
          </div>
        )}

        <div className="form-item">
          <div className="add-image-box" onClick={handlePickImage}>
            {image ? (
              <div className="add-image-preview">
                <img src={image} alt="主图预览" />
                <span className="add-image-label">主图</span>
              </div>
            ) : (
              <span className="add-image-hint">＋ 添加主图</span>
            )}
            {image && (
              <button
                type="button"
                className="add-image-remove"
                aria-label="删除主图"
                onClick={(e) => {
                  e.stopPropagation()
                  setImage(null)
                }}
              >
                ×
              </button>
            )}
          </div>
          {extraImages.length > 0 && (
            <div className="add-extra-row">
              {extraImages.map((src, i) => (
                <div key={i} className="add-extra-thumb">
                  <img src={src} alt={'额外图 ' + (i + 1)} />
                  <div className="add-extra-actions">
                    <button
                      type="button"
                      className="add-extra-btn"
                      onClick={() => promoteExtraToMain(i)}
                      title="设为主图"
                    >
                      主
                    </button>
                    <button
                      type="button"
                      className="add-extra-btn danger"
                      onClick={() => removeExtraImage(i)}
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="add-extra-add"
            onClick={handlePickExtraImage}
            disabled={!image}
            title={image ? '添加额外图' : '请先添加主图'}
          >
            ＋ 额外图 ({extraImages.length})
          </button>
        </div>

        {!image && (
          <div className="form-item net-section">
            <div className="form-row">
              <label className="form-label">没有实拍图？自动搜产品网图</label>
              <button
                type="button"
                role="switch"
                aria-checked={useNetImage}
                aria-label="自动搜产品网图"
                className={'switch' + (useNetImage ? ' on' : '')}
                onClick={() => toggleNetImage(!useNetImage)}
              >
                <span className="switch-thumb" />
              </button>
            </div>
            {useNetImage && (
              <div className="net-search">
                <div className="net-search-row">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="关键词，如：Molly 魔法师"
                    value={netKeyword}
                    onChange={(e) => setNetKeyword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="net-search-btn"
                    disabled={searching || !netKeyword.trim()}
                    onClick={doNetSearch}
                  >
                    {searching ? '搜索中…' : '搜索'}
                  </button>
                </div>
                {netError && <div className="net-status net-error">{netError}</div>}
                {searching && <div className="net-status">正在搜索，请稍候…</div>}
                {netResults.length > 0 && (
                  <div className="net-grid">
                    {netResults.map((r) => (
                      <button
                        key={r.full}
                        type="button"
                        className={'net-thumb' + (pickingUrl === r.full ? ' picking' : '')}
                        onClick={() => pickNetImage(r.full)}
                      >
                        <img src={r.thumb} alt="搜索结果" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="form-item">
          <label className="form-label" htmlFor="field-name">
            款式名<span className="req">*</span>
          </label>
          <SuggestInput
            id="field-name"
            inputRef={nameRef}
            placeholder="必填，例如：Molly 魔法师"
            value={name}
            onChange={setName}
            suggestions={nameSuggestions}
          />
        </div>

        <div className="form-item">
          <label className="form-label" htmlFor="field-series">系列名</label>
          <SuggestInput
            id="field-series"
            placeholder="例如：坐坐派对系列"
            value={series}
            onChange={setSeries}
            suggestions={seriesSuggestions}
          />
          {seriesOptions.length > 0 && (
            <div className="chip-row">
              {seriesOptions.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => setSeries(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-item">
          <label className="form-label" htmlFor="field-ip">IP</label>
          <SuggestInput
            id="field-ip"
            placeholder="例如：Labubu"
            value={ip}
            onChange={setIp}
            suggestions={ipSuggestions}
          />
          <div className="chip-row">
            {IP_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={'chip' + (ip === t ? ' active' : '')}
                onClick={() => setIp(ip === t ? '' : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="form-item">
          <label className="form-label" htmlFor="field-rarity">稀有度</label>
          <select
            id="field-rarity"
            className="form-input form-select"
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
          >
            {RARITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {!isEdit && (
          <>
            <div className="form-item">
              <label className="form-label" htmlFor="field-price">成本价（元）</label>
              <input
                id="field-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="form-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="form-item">
              <label className="form-label" htmlFor="field-date">入手日期</label>
              <input
                id="field-date"
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="form-item">
              <label className="form-label" htmlFor="field-channel">渠道</label>
              <select
                id="field-channel"
                className="form-input form-select"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {channel === '现货可发' ? (
              <div className="form-item">
                <label className="form-label" htmlFor="field-cond">具体情况</label>
                <select
                  id="field-cond"
                  className="form-input form-select"
                  value={cond}
                  onChange={(e) => setCond(e.target.value)}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-item">
                <label className="form-label" htmlFor="field-presale">预售时间</label>
                <input
                  id="field-presale"
                  type="date"
                  className="form-input"
                  value={presale}
                  onChange={(e) => setPresale(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        <div className="form-item">
          <div className="form-label-row">
            <label className="form-label">来源平台</label>
            <button
              type="button"
              className="link-btn"
              onClick={() => setManagerOpen(true)}
            >
              管理
            </button>
          </div>
          {sources.length > 0 && (
            <div className="chip-row">
              {sources.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={'chip' + (source === t ? ' active' : '')}
                  onClick={() => setSource(source === t ? '' : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-item">
          <label className="form-label" htmlFor="field-note">备注</label>
          <textarea
            id="field-note"
            rows={2}
            className="form-input"
            placeholder="盒况、瑕疵、心情…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? '保存中…' : isEdit ? '保存修改' : '确认入库'}
        </button>
      </div>

      <SourceManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onChanged={reloadSources}
      />

      <ScanSheet
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleScanResult}
      />
    </Sheet>
  )
}
