// 近 N 月收支柱状图：纯展示组件，data 由页面算好传入。
// data: [{ month: 'YYYY-MM', spend: number, income: number }]
// 纯 CSS 实现：每月两根柱（花费红 / 收入绿），高度按全局最大值归一化，
// 柱顶显示整数金额，下方显示月份标签。

export default function MonthBars({ data }) {
  let max = 1
  for (const d of data) {
    if (d.spend > max) max = d.spend
    if (d.income > max) max = d.income
  }

  return (
    <div className="month-bars">
      <div className="chart-legend">
        <span className="legend-item">
          <i className="legend-dot spend" />花费
        </span>
        <span className="legend-item">
          <i className="legend-dot income" />收入
        </span>
      </div>
      <div className="month-row">
        {data.map((d) => (
          <div className="month-col" key={d.month}>
            <div className="month-pair">
              <div className="bar-wrap">
                <span className="bar-num">
                  {d.spend > 0 ? Math.round(d.spend) : ''}
                </span>
                <div
                  className="bar spend"
                  style={{ height: 'calc((100% - 18px) * ' + d.spend / max + ')' }}
                />
              </div>
              <div className="bar-wrap">
                <span className="bar-num">
                  {d.income > 0 ? Math.round(d.income) : ''}
                </span>
                <div
                  className="bar income"
                  style={{ height: 'calc((100% - 18px) * ' + d.income / max + ')' }}
                />
              </div>
            </div>
            <span className="month-label">
              {parseInt(d.month.slice(5, 7), 10)}月
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
