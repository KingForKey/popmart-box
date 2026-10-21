import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import SourceManager from './SourceManager.jsx'
import {
  getAllProducts,
  addProduct,
  updateProduct,
  addRecord,
  saveImage,
  deleteImage,
  getSources
} from '../store/db.js'
import { CHANNELS, CONDITIONS, formatDate } from '../store/models.js'
import { pickImage } from '../platform/image.js'
import { searchProductImages, fetchProductImage } from '../platform/imageSearch.js'
import { showToast } from '../platform/toast.js'

const IP_TAGS = ['Molly', 'Dimoo', 'Skullpanda', 'Labubu']

function genImageKey() {
  return 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function toNumber(text) {
  const n = parseFloat(text)
  return isNaN(n) ? 0 : n
}

// 入库 / 编辑款式 弹窗。
// initialData 有值时为编辑模式：只更新 product，不碰 record，隐藏成本价/日期。
// 成功后调用 onSuccess()，由父页面负责关弹窗、toast、刷新列表。
// 没有实拍图时可打开「自动搜产品网图」开关，联网搜索泡泡玛特产品图直接选用。

export default function AddSheet({ open, onClose, onSuccess, initialData, initialImage, seriesOptions }) {
  const isEdit = !!initialData
  const [name, setName] = useState('')
  const [series, setSeries] = useState('')
  const [ip, setIp] = useState('')
  const [isSecret, setIsSecret] = useState(false)
  const [price, setPrice] = useState('59')
  const [date, setDate] = useState('')
  const [channel, setChannel] = useState('现货可发')
  const [cond, setCond] = useState(CONDITIONS[0])
  const [presale, setPresale] = useState('')
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef(null)

  const [sources, setSources] = useState([])
  const [managerOpen, setManagerOpen] = useState(false)

  const [useNetImage, setUseNetImage] = useState(false)
  const [netKeyword, setNetKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [netError, setNetError] = useState('')
  const [netResults, setNetResults] = useState([])
  const [pickingUrl, setPickingUrl] = useState(null)

  function reloadSources() {
    getSources().then(setSources)
  }

  // 每次打开时初始化表单
  useEffect(() => {
    if (!open) return
    if (initialData) {
      setName(initialData.name || '')
      setSeries(initialData.series || '')
      setIp(initialData.ip || '')
      setIsSecret(!!initialData.isSecret)
      setSource(initialData.source || '')
      setNote(initialData.note || '')
      setImage(initialImage || null)
    } else {
      setName('')
      setSeries('')
      setIp('')
      setIsSecret(false)
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
    reloadSources()
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

  async function handleSubmit() {
    const trimmedName = name.trim()
    if (!trimmedName || submitting) return
    setSubmitting(true)
    try {
      if (isEdit) {
        const patch = {
          name: trimmedName,
          series: series.trim(),
          ip: ip.trim(),
          isSecret,
          source,
          note: note.trim()
        }
        if (image && image !== initialImage) {
          const key = initialData.imageKey || genImageKey()
          await saveImage(key, image)
          patch.imageKey = key
        } else if (!image && initialData.imageKey) {
          await deleteImage(initialData.imageKey)
          patch.imageKey = null
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
          // 同名同系列已存在：复用 product，只新增一条入库记录
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
          let imageKey = null
          if (image) {
            imageKey = genImageKey()
            await saveImage(imageKey, image)
          }
          const created = await addProduct({
            name: trimmedName,
            series: trimmedSeries,
            ip: ip.trim(),
            isSecret,
            source,
            note: note.trim(),
            imageKey,
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
        <div className="form-item">
          <div className="add-image-box" onClick={handlePickImage}>
            {image ? (
              <div className="add-image-preview">
                <img src={image} alt="款式图片预览" />
              </div>
            ) : (
              <span className="add-image-hint">＋ 添加图片</span>
            )}
            {image && (
              <button
                type="button"
                className="add-image-remove"
                aria-label="删除图片"
                onClick={(e) => {
                  e.stopPropagation()
                  setImage(null)
                }}
              >
                ×
              </button>
            )}
          </div>
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
          <input
            id="field-name"
            ref={nameRef}
            type="text"
            className="form-input"
            placeholder="必填，例如：Molly 魔法师"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-item">
          <label className="form-label" htmlFor="field-series">系列名</label>
          <input
            id="field-series"
            type="text"
            className="form-input"
            placeholder="例如：魔法世界系列"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
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
          <input
            id="field-ip"
            type="text"
            className="form-input"
            placeholder="例如：Molly"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
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

        <div className="form-item form-row">
          <label className="form-label">是否隐藏款</label>
          <button
            type="button"
            role="switch"
            aria-checked={isSecret}
            aria-label="是否隐藏款"
            className={'switch' + (isSecret ? ' on' : '')}
            onClick={() => setIsSecret(!isSecret)}
          >
            <span className="switch-thumb" />
          </button>
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
    </Sheet>
  )
}
