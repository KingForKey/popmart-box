import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getAllProducts,
  getAllRecords,
  deleteProduct,
  deleteImage,
  getImage,
  saveImage,
  restoreProduct,
  getProductGalleryKeys
} from '../store/db.js'
import {
  getStock,
  getStockByChannel,
  getStockByCondition,
  getStockByPresale,
  formatPresale
} from '../store/models.js'
import ProductCard from '../components/ProductCard.jsx'
import Sheet from '../components/Sheet.jsx'
import AddSheet from '../components/AddSheet.jsx'
import SellSheet from '../components/SellSheet.jsx'
import { showToast } from '../platform/toast.js'
import { pinchingRef } from '../utils/pinchState.js'

const DENSITIES = [
  { key: 'comfortable', cols: '1fr 1fr', label: '舒适' },
  { key: 'cozy', cols: 'repeat(3, 1fr)', label: '紧凑' },
  { key: 'snug', cols: 'repeat(4, 1fr)', label: '超紧凑' }
]

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'secret', label: '隐藏款' },
  { key: 'ultra', label: '大隐藏' },
  { key: 'instock', label: '有库存' },
  { key: 'outstock', label: '无库存' }
]

export default function Collection() {
  const [products, setProducts] = useState([])
  const [records, setRecords] = useState([])
  const [images, setImages] = useState({})
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('flat') // flat | grouped
  const [detailProduct, setDetailProduct] = useState(null)
  const [menuProduct, setMenuProduct] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [sellProduct, setSellProduct] = useState(null)
  const [galleryIndex, setGalleryIndex] = useState(0) // 详情画廊当前页

  const [densityIdx, setDensityIdx] = useState(() => {
    try {
      const s = localStorage.getItem('popmart-density')
      const i = DENSITIES.findIndex((d) => d.key === s)
      return i >= 0 ? i : 0
    } catch {
      return 0
    }
  })
  const gridRef = useRef(null)
  const pinchRef = useRef({ initial: 0, lastRatio: 1, tracked: false })

  const load = useCallback(async () => {
    const [ps, rs] = await Promise.all([getAllProducts(), getAllRecords()])
    setProducts(ps)
    setRecords(rs)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 按 imageKey 异步解析 dataURL，productId -> dataUrl
  useEffect(() => {
    let alive = true
    const items = products.filter((p) => p.imageKey)
    Promise.all(
      items.map((p) => getImage(p.imageKey).then((url) => [p.id, url || null]))
    ).then((entries) => {
      if (!alive) return
      const map = {}
      for (const [id, url] of entries) {
        if (url) map[id] = url
      }
      setImages(map)
    })
    return () => {
      alive = false
    }
  }, [products])

  // 先按关键词 + 筛选条件过滤，得到最终要渲染的产品列表
  const filtered = useMemo(() => {
    let arr = products
    const q = keyword.trim().toLowerCase()
    if (q) {
      arr = arr.filter((p) =>
        [p.name, p.series, p.ip].some((v) => (v || '').toLowerCase().includes(q))
      )
    }
    if (filter === 'secret') {
      arr = arr.filter((p) => p.rarity === 'secret' || p.isSecret)
    } else if (filter === 'ultra') {
      arr = arr.filter((p) => p.rarity === 'ultra')
    } else if (filter === 'instock') {
      arr = arr.filter((p) => getStock(p.id, records) > 0)
    } else if (filter === 'outstock') {
      arr = arr.filter((p) => getStock(p.id, records) <= 0)
    }
    return arr
  }, [products, records, keyword, filter])

  // 按系列分组：series 空的归到「未分类」
  const grouped = useMemo(() => {
    const map = new Map()
    for (const p of filtered) {
      const key = (p.series || '').trim() || '未分类'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === '未分类') return 1
      if (b[0] === '未分类') return -1
      return a[0].localeCompare(b[0], 'zh-CN')
    })
  }, [filtered])

  const seriesOptions = useMemo(() => {
    const arr = []
    for (const p of products) {
      const s = (p.series || '').trim()
      if (s && arr.indexOf(s) < 0) arr.push(s)
    }
    return arr
  }, [products])

  useEffect(() => {
    try {
      localStorage.setItem('popmart-density', DENSITIES[densityIdx].key)
    } catch {}
  }, [densityIdx])

  function handleGridTouchStart(e) {
    if (e.touches.length < 2) return
    const t = e.touches
    const dx = t[0].clientX - t[1].clientX
    const dy = t[0].clientY - t[1].clientY
    const d = Math.hypot(dx, dy)
    if (d < 20) return
    pinchingRef.current = true
    pinchRef.current = { initial: d, lastRatio: 1, tracked: true }
  }

  function handleGridTouchMove(e) {
    if (!pinchRef.current.tracked || e.touches.length < 2) return
    const t = e.touches
    const dx = t[0].clientX - t[1].clientX
    const dy = t[0].clientY - t[1].clientY
    const d = Math.hypot(dx, dy)
    const ratio = d / pinchRef.current.initial
    const cur = pinchRef.current.lastRatio

    // 阈值设宽：避免误触发；每次变档后重置 lastRatio 作为新基准
    if (ratio < cur * 0.82 && densityIdx < DENSITIES.length - 1) {
      setDensityIdx((i) => Math.min(i + 1, DENSITIES.length - 1))
      pinchRef.current.lastRatio = ratio
    } else if (ratio > cur * 1.22 && densityIdx > 0) {
      setDensityIdx((i) => Math.max(i - 1, 0))
      pinchRef.current.lastRatio = ratio
    }
  }

  function handleGridTouchEnd() {
    pinchingRef.current = false
    pinchRef.current = { initial: 0, lastRatio: 1, tracked: false }
  }

  function cycleDensity() {
    setDensityIdx((i) => (i + 1) % DENSITIES.length)
  }

  function openMenu(p) {
    setConfirming(false)
    setMenuProduct(p)
  }

  function closeMenu() {
    setMenuProduct(null)
    setConfirming(false)
  }

  function tapSell(p) {
    closeMenu()
    setSellProduct(p)
  }

  function handleSold(kind) {
    setSellProduct(null)
    showToast(kind === 'trade' ? '已交换' : '已卖出')
    load()
  }

  function tapEdit(p) {
    closeMenu()
    setEditingProduct(p)
    setAddOpen(true)
  }

  function closeAdd() {
    setAddOpen(false)
    setEditingProduct(null)
  }

  function handleSaved() {
    const isEdit = !!editingProduct
    closeAdd()
    showToast(isEdit ? '已保存' : '已入库')
    load()
  }

  // 删除后 8 秒内可撤销：图片 dataURL 先取出暂存，撤销时随产品一并恢复
  async function doDelete() {
    const p = menuProduct
    if (!p) return
    closeMenu()
    // 先把全部 gallery 图片 dataURL 取出来（用于撤销恢复）
    const galleryKeys = getProductGalleryKeys(p)
    const imageMap = {}
    for (const k of galleryKeys) {
      const url = await getImage(k)
      if (url) imageMap[k] = url
    }
    await deleteProduct(p.id)
    // 全部图都删掉
    for (const k of galleryKeys) await deleteImage(k)
    await load()
    showToast('已删除「' + (p.name || '未命名') + '」', {
      actionLabel: '撤销',
      duration: 8000,
      onAction: async () => {
        await restoreProduct(p)
        for (const [k, url] of Object.entries(imageMap)) {
          await saveImage(k, url)
        }
        showToast('已恢复')
        await load()
      }
    })
  }

  const hasProducts = products.length > 0

  return (
    <div className="collection-page">
      <header className="collection-header">
        <h1 className="collection-title">我的娃</h1>
        <div className="collection-header-row">
          <input
            type="search"
            className="collection-search"
            placeholder="搜索款式 / 系列 / IP"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button
            type="button"
            className="density-toggle"
            aria-label="切换视图密度"
            onClick={cycleDensity}
            title="双指也可缩放调整"
          >
            ★ {DENSITIES[densityIdx].label}
          </button>
        </div>

        {hasProducts && (
          <>
            <div className="collection-filter-row">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={'filter-chip' + (filter === f.key ? ' active' : '')}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="collection-view-row">
              <button
                type="button"
                className={'view-toggle' + (viewMode === 'flat' ? ' active' : '')}
                onClick={() => setViewMode('flat')}
              >
                ☰ 全部平铺
              </button>
              <button
                type="button"
                className={'view-toggle' + (viewMode === 'grouped' ? ' active' : '')}
                onClick={() => setViewMode('grouped')}
              >
                🗂 按系列分组
              </button>
            </div>
          </>
        )}
      </header>

      {!hasProducts ? (
        <div className="collection-empty">
          <div className="collection-empty-emoji">🧸</div>
          <p>还没有娃，点右下角 + 添加第一个吧</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="collection-empty">
          <div className="collection-empty-emoji">🔍</div>
          <p>没有找到匹配的款式</p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="collection-grouped">
          {grouped.map(([series, items]) => (
            <div key={series} className="collection-group">
              <div className="collection-group-title">
                <span>{series}</span>
                <span className="collection-group-count">{items.length}</span>
              </div>
              <div
                className={'collection-grid density-' + DENSITIES[densityIdx].key}
                style={{ gridTemplateColumns: DENSITIES[densityIdx].cols }}
                onTouchStart={handleGridTouchStart}
                onTouchMove={handleGridTouchMove}
                onTouchEnd={handleGridTouchEnd}
                onTouchCancel={handleGridTouchEnd}
              >
                {items.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    stock={getStock(p.id, records)}
                    channelStock={getStockByChannel(p.id, records)}
                    transferPresale={getStockByPresale(p.id, records)}
                    condStock={getStockByCondition(p.id, records, '现货可发')}
                    image={images[p.id] || null}
                    density={DENSITIES[densityIdx].key}
                    onClick={() => {
                      setGalleryIndex(0)
                      setDetailProduct(p)
                    }}
                    onMinus={() => setSellProduct(p)}
                    onLongPress={() => openMenu(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={gridRef}
          className={'collection-grid density-' + DENSITIES[densityIdx].key}
          style={{ gridTemplateColumns: DENSITIES[densityIdx].cols }}
          onTouchStart={handleGridTouchStart}
          onTouchMove={handleGridTouchMove}
          onTouchEnd={handleGridTouchEnd}
          onTouchCancel={handleGridTouchEnd}
        >
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              stock={getStock(p.id, records)}
              channelStock={getStockByChannel(p.id, records)}
              transferPresale={getStockByPresale(p.id, records)}
              condStock={getStockByCondition(p.id, records, '现货可发')}
              image={images[p.id] || null}
              density={DENSITIES[densityIdx].key}
              onClick={() => {
                setGalleryIndex(0)
                setDetailProduct(p)
              }}
              onMinus={() => setSellProduct(p)}
              onLongPress={() => openMenu(p)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="collection-fab"
        aria-label="添加款式"
        onClick={() => setAddOpen(true)}
      >
        +
      </button>

      <Sheet
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        title="款式详情"
      >
        {detailProduct && (
          <DetailContent
            product={detailProduct}
            records={records}
            images={images}
            galleryIndex={galleryIndex}
            setGalleryIndex={setGalleryIndex}
          />
        )}
      </Sheet>

      <Sheet
        open={!!menuProduct}
        onClose={closeMenu}
        title={menuProduct ? menuProduct.name : ''}
      >
        {menuProduct && !confirming && (
          <div className="menu-list">
            <button
              type="button"
              className="menu-item"
              onClick={() => tapSell(menuProduct)}
            >
              卖出
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => tapEdit(menuProduct)}
            >
              编辑
            </button>
            <button
              type="button"
              className="menu-item danger"
              onClick={() => setConfirming(true)}
            >
              删除
            </button>
          </div>
        )}
        {menuProduct && confirming && (
          <div>
            <p className="confirm-text">
              确定删除「{menuProduct.name}」吗？删除后不可恢复。
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn"
                onClick={() => setConfirming(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="confirm-btn danger"
                onClick={doDelete}
              >
                删除
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <AddSheet
        open={addOpen}
        onClose={closeAdd}
        onSuccess={handleSaved}
        initialData={editingProduct}
        initialImage={editingProduct ? images[editingProduct.id] || null : null}
        seriesOptions={seriesOptions}
      />

      <SellSheet
        open={!!sellProduct}
        onClose={() => setSellProduct(null)}
        onSuccess={handleSold}
        product={sellProduct}
        transferPresale={sellProduct ? getStockByPresale(sellProduct.id, records) : {}}
        condStock={sellProduct ? getStockByCondition(sellProduct.id, records, '现货可发') : {}}
      />
    </div>
  )
}

// 详情内部组件：单独加载全部 galleryKeys 图片（images 字典里只有 imageKey 一张）
function DetailContent({ product, records, images, galleryIndex, setGalleryIndex }) {
  const [galleryUrls, setGalleryUrls] = useState([])

  useEffect(() => {
    const keys = getProductGalleryKeys(product)
    if (keys.length === 0) {
      setGalleryUrls([])
      return
    }
    let alive = true
    Promise.all(keys.map((k) => getImage(k))).then((urls) => {
      if (!alive) return
      setGalleryUrls(urls.map((u) => u || null).filter(Boolean))
    })
    return () => {
      alive = false
    }
  }, [product])

  const total = galleryUrls.length
  const idx = Math.min(galleryIndex, Math.max(total - 1, 0))

  return (
    <div className="detail-content">
      {total > 0 && (
        <div className="detail-gallery">
          <div className="detail-gallery-img">
            <img src={galleryUrls[idx]} alt={product.name + ' ' + (idx + 1)} />
            {total > 1 && (
              <>
                <button
                  type="button"
                  className="detail-gallery-btn left"
                  onClick={() => setGalleryIndex((i) => (i - 1 + total) % total)}
                  aria-label="上一张"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="detail-gallery-btn right"
                  onClick={() => setGalleryIndex((i) => (i + 1) % total)}
                  aria-label="下一张"
                >
                  ›
                </button>
                <div className="detail-gallery-dots">
                  {galleryUrls.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={'detail-dot' + (i === idx ? ' active' : '')}
                      onClick={() => setGalleryIndex(i)}
                      aria-label={'第 ' + (i + 1) + ' 张'}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {total > 1 && (
            <div className="detail-gallery-counter">
              {idx + 1} / {total}
            </div>
          )}
        </div>
      )}

      <div className="detail-name">{product.name}</div>
      {product.rarity === 'ultra' ? (
        <div className="detail-rarity ultra">★ 大隐藏款</div>
      ) : product.rarity === 'secret' || product.isSecret ? (
        <div className="detail-rarity">★ 隐藏款</div>
      ) : null}

      <div className="detail-row">
        <span>总库存</span>
        <b>{getStock(product.id, records)}</b>
      </div>

      {product.series && (
        <div className="detail-row">
          <span>系列</span>
          <span>{product.series}</span>
        </div>
      )}
      {product.ip && (
        <div className="detail-row">
          <span>IP</span>
          <span>{product.ip}</span>
        </div>
      )}
      {product.source && (
        <div className="detail-row">
          <span>来源</span>
          <span>{product.source}</span>
        </div>
      )}
      {product.note && (
        <div className="detail-row detail-note">
          <span>备注</span>
          <span>{product.note}</span>
        </div>
      )}

      {(() => {
        const byChannel = getStockByChannel(product.id, records)
        const channels = Object.keys(byChannel)
        if (channels.length === 0) return null
        return (
          <div className="detail-conds">
            {channels.map((ch) => (
              <div key={ch}>
                <div className="detail-cond-row">
                  <span className="cond-tag channel">{ch}</span>
                  <span className="detail-cond-num">{byChannel[ch]}</span>
                </div>
                {ch === '现货可发' && (
                  <div className="detail-cond-children">
                    {(() => {
                      const by = getStockByCondition(product.id, records, ch)
                      const keys = Object.keys(by)
                      if (keys.length === 0) return null
                      return keys.map((c) => (
                        <div className="detail-cond-row" key={c}>
                          <span className="cond-tag">{c}</span>
                          <span className="detail-cond-num">{by[c]}</span>
                        </div>
                      ))
                    })()}
                  </div>
                )}
                {ch === '盒机转赠' && (
                  <div className="detail-cond-children">
                    {(() => {
                      const by = getStockByPresale(product.id, records)
                      const keys = Object.keys(by).sort()
                      if (keys.length === 0) return null
                      return keys.map((d) => (
                        <div className="detail-cond-row" key={d}>
                          <span className="cond-tag presale">{formatPresale(d)}</span>
                          <span className="detail-cond-num">{by[d]}</span>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
