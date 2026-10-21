// 流水条目：纯展示组件。
// record = { type:'in'|'out'|'trade', quantity, price, channel, condition,
//            presaleDate, note, date, createdAt }
// in = 入库花费（-），out = 卖出收入（+），trade = 交换出库（不计金额）。

import { formatMoney, formatPresale } from '../store/models.js'

export default function RecordItem({ record, product }) {
  const isIn = record.type === 'in'
  const isTrade = record.type === 'trade'
  const name = product ? product.name : '已删除的款式'
  const subtotal = (Number(record.price) || 0) * (Number(record.quantity) || 0)
  const tone = isIn ? 'in' : isTrade ? 'trade' : 'out'

  return (
    <div className={'record-item record-' + tone}>
      <span className={'record-dot ' + tone} />
      <div className="record-main">
        <div className="record-title-row">
          <span className="record-name">{name}</span>
          {isTrade ? (
            <span className="record-amount trade">交换</span>
          ) : (
            <span className={'record-amount ' + tone}>
              {isIn ? '-' : '+'}{formatMoney(subtotal)}
            </span>
          )}
        </div>
        <div className="record-meta">
          <span className="record-type">{isIn ? '入库' : isTrade ? '交换' : '卖出'}</span>
          <span className="cond-tag channel">{record.channel || '-'}</span>
          {record.channel === '现货可发' && record.condition && (
            <span className="cond-tag">{record.condition}</span>
          )}
          {record.channel === '盒机转赠' && record.presaleDate && (
            <span className="cond-tag presale">{formatPresale(record.presaleDate)}</span>
          )}
          {isTrade && record.note && (
            <span className="cond-tag note">{record.note}</span>
          )}
        </div>
        <div className="record-sub">
          {!isTrade && <span>单价 {formatMoney(record.price)}</span>}
          <span>× {record.quantity}</span>
          <span className="record-date">{record.date}</span>
        </div>
      </div>
    </div>
  )
}
