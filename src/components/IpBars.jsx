// IP 在库分布条形图：纯展示组件。
// data: [{ name: string, qty: number }]，条宽按最大值归一化。

export default function IpBars({ data }) {
  let max = 1
  for (const d of data) {
    if (d.qty > max) max = d.qty
  }

  return (
    <div className="ip-bars">
      {data.map((d) => (
        <div className="ip-row" key={d.name}>
          <span className="ip-name">{d.name}</span>
          <div className="ip-track">
            <div
              className="ip-bar"
              style={{ width: Math.max(4, (d.qty / max) * 100) + '%' }}
            />
          </div>
          <span className="ip-num">{d.qty}</span>
        </div>
      ))}
    </div>
  )
}
