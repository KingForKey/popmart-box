import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAllProducts,
  getAllRecords,
  deleteProduct,
  deleteImage,
  getImage,
  saveImage,
  restoreProduct
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

export default function Collection() {
  const [products, setProducts] = useState([])
  const [records, setRecords] = useState([])
  const [images, setImages] = useState({})
  const [keyword, setKeyword] = useState('')
  const [detailProduct, setDetailProduct] = useState(null)
  const [menuProduct, setMenuProduct] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [sellProduct, setSellProduct] = useState(null)

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

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      [p.name, p.series, p.ip].some((v) => (v || '').toLowerCase().includes(q))
    )
  }, [products, keyword])

  const seriesOptions = useMemo(() => {
    const arr = []
    for (const p of products) {
      const s = (p.series || '').trim()
      if (s && arr.indexOf(s) < 0) arr.push(s)
    }
    return arr
  }, [products])

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
    const imageDataUrl = p.imageKey ? await getImage(p.imageKey) : null
    await deleteProduct(p.id)
    if (p.imageKey) await deleteImage(p.imageKey)
    await load()
    showToast('已删除「' + (p.name || '未命名') + '」', {
      actionLabel: '撤销',
      duration: 8000,
      onAction: async () => {
        await restoreProduct(p)
        if (p.imageKey && imageDataUrl) await saveImage(p.imageKey, imageDataUrl)
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
        <input
          type="search"
          className="collection-search"
          placeholder="搜索款式 / 系列 / IP"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
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
      ) : (
        <div className="collection-grid">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              stock={getStock(p.id, records)}
              channelStock={getStockByChannel(p.id, records)}
              transferPresale={getStockByPresale(p.id, records)}
              condStock={getStockByCondition(p.id, records, '现货可发')}
              image={images[p.id] || null}
              onClick={() => setDetailProduct(p)}
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
          <div>
            <div className="detail-name">{detailProduct.name}</div>
            <div className="detail-row">
              <span>总库存</span>
              <b>{getStock(detailProduct.id, records)}</b>
            </div>
            {(() => {
              const byChannel = getStockByChannel(detailProduct.id, records)
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
                            const by = getStockByCondition(detailProduct.id, records, ch)
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
                            const by = getStockByPresale(detailProduct.id, records)
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
