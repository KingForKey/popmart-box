import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet.jsx'
import { addRecord } from '../store/db.js'
import { CONDITIONS, formatDate, formatPresale } from '../store/models.js'
import { showToast } from '../platform/toast.js'

// 卖出/交换弹窗。层级与入库一致：渠道是一级，二级维度按渠道二选一
// （现货可发 → 成色；盒机转赠 → 预售时间）。
// 可卖量由父页面按 records 算好传进来，这里只做校验和提交，
// 卖出/交换即新增一条 type:'out'|'trade' 的 record，从对应桶扣减。

export default function SellSheet({ open, onClose, onSuccess, product, transferPresale, condStock }) {
  const presaleKeys = useMemo(
    () => Object.keys(transferPresale || {}).sort(),
    [transferPresale]
  )
  const condKeys = useMemo(
    () => CONDITIONS.filter((c) => condStock && condStock[c] > 0),
    [condStock]
  )

  const [kind, setKind] = useState('out')
  const [channel, setChannel] = useState('现货可发')
  const [cond, setCond] = useState('')
  const [presale, setPresale] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const hasTransfer = presaleKeys.length > 0
  const hasStock = condKeys.length > 0
  const isTrade = kind === 'trade'

  // 每次打开时初始化
  useEffect(() => {
    if (!open) return
    const ch = hasStock ? '现货可发' : hasTransfer ? '盒机转赠' : '现货可发'
    setKind('out')
    setChannel(ch)
    setCond(condKeys[0] || '')
    setPresale(presaleKeys[0] || '')
    setQty('1')
    setPrice('')
    setNote('')
    setDate(formatDate(Date.now()))
    setSubmitting(false)
  }, [open, product, hasStock, hasTransfer, condKeys, presaleKeys])

  // 切换渠道时把二级维度重置到第一个有货的桶
  useEffect(() => {
    if (!open) return
    if (channel === '现货可发') setCond(condKeys[0] || '')
    else setPresale(presaleKeys[0] || '')
  }, [channel, open, condKeys, presaleKeys])

  const availQty = useMemo(() => {
    if (channel === '现货可发') return (condStock && condStock[cond]) || 0
    return (transferPresale && transferPresale[presale]) || 0
  }, [channel, cond, presale, condStock, transferPresale])

  const numQty = parseInt(qty, 10) || 0
  const canSubmit =
    availQty > 0 && numQty >= 1 && numQty <= availQty && !submitting

  function handleChannel(ch) {
    setChannel(ch)
  }

  async function handleSubmit() {
    if (!canSubmit || !product) return
    setSubmitting(true)
    try {
      await addRecord({
        productId: product.id,
        type: isTrade ? 'trade' : 'out',
        quantity: numQty,
        price: isTrade ? 0 : parseFloat(price) || 0,
        channel,
        condition: channel === '现货可发' ? cond : null,
        presaleDate: channel === '盒机转赠' ? presale || null : null,
        note: isTrade ? String(note || '').trim() : '',
        date,
        createdAt: Date.now()
      })
      onSuccess(kind)
    } catch (e) {
      showToast((e && e.message) || (isTrade ? '交换失败' : '卖出失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const noStock = !hasStock && !hasTransfer
  const actionText = isTrade ? '交换' : '卖出'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product ? actionText + ' · ' + product.name : actionText}
    >
      {noStock ? (
        <div className="sell-empty">这个款式目前没有可操作库存</div>
      ) : (
        <div className="add-form">
          <div className="form-item">
            <label className="form-label">类型</label>
            <div className="chip-row">
              <button
                type="button"
                className={'chip' + (kind === 'out' ? ' active' : '')}
                onClick={() => setKind('out')}
              >
                卖出（有收入）
              </button>
              <button
                type="button"
                className={'chip' + (isTrade ? ' active' : '')}
                onClick={() => setKind('trade')}
              >
                交换（无收入）
              </button>
            </div>
          </div>

          <div className="form-item">
            <label className="form-label">渠道</label>
            <div className="chip-row">
              {['现货可发', '盒机转赠'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={'chip' + (channel === ch ? ' active' : '')}
                  onClick={() => handleChannel(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {channel === '现货可发' ? (
            <div className="form-item">
              <label className="form-label" htmlFor="sell-cond">具体情况</label>
              {condKeys.length > 0 ? (
                <select
                  id="sell-cond"
                  className="form-input form-select"
                  value={cond}
                  onChange={(e) => setCond(e.target.value)}
                >
                  {condKeys.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <div className="sell-hint">现货可发暂无库存</div>
              )}
            </div>
          ) : (
            <div className="form-item">
              <label className="form-label" htmlFor="sell-presale">预售时间</label>
              {presaleKeys.length > 0 ? (
                <select
                  id="sell-presale"
                  className="form-input form-select"
                  value={presale}
                  onChange={(e) => setPresale(e.target.value)}
                >
                  {presaleKeys.map((d) => (
                    <option key={d} value={d}>{formatPresale(d)}</option>
                  ))}
                </select>
              ) : (
                <div className="sell-hint">盒机转赠暂无库存</div>
              )}
            </div>
          )}

          {availQty > 0 && (
            <div className="sell-avail">可{actionText} {availQty} 件</div>
          )}

          <div className="form-item">
            <label className="form-label" htmlFor="sell-qty">数量</label>
            <input
              id="sell-qty"
              type="number"
              inputMode="numeric"
              min="1"
              max={availQty}
              className="form-input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            {availQty > 0 && numQty > availQty && (
              <div className="sell-warn">最多只能{actionText} {availQty} 件</div>
            )}
          </div>

          {isTrade ? (
            <div className="form-item">
              <label className="form-label" htmlFor="sell-note">交换说明（选填）</label>
              <input
                id="sell-note"
                type="text"
                className="form-input"
                placeholder="例如：和朋友换了另一款"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : (
            <div className="form-item">
              <label className="form-label" htmlFor="sell-price">售价（元）</label>
              <input
                id="sell-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="form-input"
                placeholder="留空记为 0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          )}

          <div className="form-item">
            <label className="form-label" htmlFor="sell-date">{actionText}日期</label>
            <input
              id="sell-date"
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? '保存中…' : '确认' + actionText}
          </button>
        </div>
      )}
    </Sheet>
  )
}
