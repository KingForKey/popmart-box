import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import {
  exportAll,
  importAll,
  getAutoBackupInfo,
  restoreAutoBackup,
  getAllProducts,
  getAllRecords
} from '../store/db.js'
import { downloadJson, downloadBlob, pickJsonText } from '../platform/file.js'
import { buildXlsx } from '../platform/xlsx.js'
import { shareToWechat } from '../platform/share.js'
import {
  canPromptInstall,
  isIOS,
  isStandalone,
  onInstallStateChange,
  promptInstall
} from '../platform/install.js'
import { showToast } from '../platform/toast.js'
import { formatDate, formatDateTime, formatPresale } from '../store/models.js'

// 设置弹窗：使用说明 + 自动备份恢复 + 数据备份（导出 / 导入覆盖）。
// 导入或恢复都需二次确认，确认后才整体覆盖。

export default function SettingsSheet({ open, onClose, onImported }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null) // 待确认导入的备份对象
  const [autoInfo, setAutoInfo] = useState(null)
  const [confirmAuto, setConfirmAuto] = useState(false)
  const [installable, setInstallable] = useState(canPromptInstall())
  const [standalone] = useState(isStandalone())
  const [ios] = useState(isIOS())

  useEffect(() => onInstallStateChange(() => setInstallable(canPromptInstall())), [])

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setPending(null)
    setConfirmAuto(false)
    getAutoBackupInfo().then(setAutoInfo)
  }, [open])

  async function handleExportXlsx() {
    if (busy) return
    setBusy(true)
    try {
      const [products, records] = await Promise.all([getAllProducts(), getAllRecords()])
      const pMap = {}
      products.forEach((p) => { pMap[p.id] = p })

      const recordRows = [
        ['类型', '款式', '系列', 'IP', '数量', '单价', '金额', '渠道', '成色', '预售时间', '日期', '备注']
      ]
      records
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt)
        .forEach((r) => {
          const p = pMap[r.productId] || {}
          const typeText = r.type === 'in' ? '入库' : r.type === 'trade' ? '交换' : '卖出'
          const amount = (Number(r.price) || 0) * (Number(r.quantity) || 0)
          recordRows.push([
            typeText,
            p.name || '已删除的款式',
            p.series || '',
            p.ip || '',
            Number(r.quantity) || 0,
            r.type === 'trade' ? '' : Number(r.price) || 0,
            r.type === 'trade' ? '' : amount,
            r.channel || '',
            r.condition || '',
            r.presaleDate ? formatPresale(r.presaleDate) : '',
            r.date || '',
            r.note || ''
          ])
        })

      const productRows = [['款式', '系列', 'IP', '隐藏款', '来源', '备注']]
      products.forEach((p) => {
        productRows.push([
          p.name || '',
          p.series || '',
          p.ip || '',
          p.isSecret ? '是' : '',
          p.source || '',
          p.note || ''
        ])
      })

      const buffer = buildXlsx([
        { name: '流水', rows: recordRows },
        { name: '款式', rows: productRows }
      ])
      const name = 'popmart-box-流水-' + formatDate(Date.now()).replace(/-/g, '') + '.xlsx'
      await downloadBlob(name, new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }))
      showToast('已导出 Excel 文件')
    } catch (e) {
      showToast(e && e.message ? e.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleInstall() {
    const r = await promptInstall()
    if (r === 'accepted') showToast('已安装到桌面')
  }

  async function handleShare() {
    if (busy) return
    setBusy(true)
    try {
      const result = await shareToWechat({
        title: '娃柜 - 我的盲盒收藏',
        text: '用「娃柜」记录盲盒入库、卖出和交换，看看我的收藏'
      })
      if (result === 'weixin') {
        showToast('点右上角「…」→ 发送给朋友', { duration: 3500 })
      } else if (result === 'copied') {
        showToast('链接已复制，粘贴给好友即可')
      } else if (result === 'shared') {
        showToast('分享成功')
      }
      // cancelled 不提示
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    if (busy) return
    setBusy(true)
    try {
      const data = await exportAll()
      const name = 'popmart-box-backup-' + formatDate(Date.now()).replace(/-/g, '') + '.json'
      await downloadJson(name, data)
      showToast('已导出备份文件')
    } finally {
      setBusy(false)
    }
  }

  async function handlePick() {
    if (busy) return
    setBusy(true)
    try {
      const data = await pickJsonText()
      if (!data) return
      if (!data || data.app !== 'popmart-box' || data.version !== 1) {
        showToast('不是有效的娃柜备份文件')
        return
      }
      setPending(data)
    } catch (e) {
      showToast(e && e.message ? e.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmImport() {
    if (busy || !pending) return
    setBusy(true)
    try {
      const stats = await importAll(pending)
      setPending(null)
      showToast('已导入 ' + stats.products + ' 个款式')
      onImported()
    } catch (e) {
      showToast(e && e.message ? e.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestoreAuto() {
    if (busy) return
    setBusy(true)
    try {
      const stats = await restoreAutoBackup()
      setConfirmAuto(false)
      showToast('已恢复 ' + stats.products + ' 个款式')
      onImported()
    } catch (e) {
      showToast(e && e.message ? e.message : '恢复失败')
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    return (
      <Sheet open={open} onClose={onClose} title="设置">
        <div className="add-form">
          <p className="import-warning">
            导入将<b>覆盖</b>当前全部数据（款式 / 记录 / 标签 / 昵称 / 图片），
            覆盖后无法恢复，确定继续吗？
          </p>
          <div className="import-summary">
            备份包含：{pending.products ? pending.products.length : 0} 个款式 ·
            {' '}{pending.records ? pending.records.length : 0} 条记录
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={handleConfirmImport}
          >
            {busy ? '导入中…' : '确认导入（覆盖现有数据）'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
            取消
          </button>
        </div>
      </Sheet>
    )
  }

  if (confirmAuto) {
    return (
      <Sheet open={open} onClose={onClose} title="设置">
        <div className="add-form">
          <p className="import-warning">
            将用自动备份<b>覆盖</b>当前数据
            {autoInfo ? '（' + formatDateTime(autoInfo.savedAt) + ' 的快照）' : ''}，
            当前未导出的改动会丢失。
          </p>
          <div className="import-summary">
            自动备份包含：{autoInfo ? autoInfo.products : 0} 个款式 ·
            {' '}{autoInfo ? autoInfo.records : 0} 条记录
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={handleRestoreAuto}
          >
            {busy ? '恢复中…' : '确认恢复'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirmAuto(false)}>
            取消
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="设置">
      <div className="add-form">
        <details className="help-block">
          <summary className="help-summary">使用说明</summary>
          <ol className="help-list">
            <li>「我的娃」右下角 <b>+</b> 入库：填款式名（必填）、系列、IP，可拍照或用网图。</li>
            <li>同一款式名 + 系列再次入库会自动合并，库存累加。</li>
            <li>入库时选渠道：现货可发再选成色；盒机转赠再选预售时间。</li>
            <li>卡片上的 <b>−</b> 或长按卡片选「卖出」：选渠道和成色/预售，从对应库存扣减；也可选「交换」出库，不计金额。</li>
            <li>删除款式后 8 秒内可在提示条点「撤销」恢复。</li>
            <li>「记账」看每笔流水，「统计」看月度收支和 IP 分布。</li>
            <li>「导出备份（JSON）」是完整数据（含图片），换手机或重装后用它恢复，建议定期导出存网盘。</li>
            <li>「导出 Excel」生成流水 + 款式两张表的 xlsx，用电脑 Excel/WPS 打开查看或打印；它只是快照，不能导回。</li>
            <li>「分享到微信」：在微信里打开时按提示点右上角「…」发送给朋友；其他浏览器会自动复制链接，粘贴给好友即可。分享的是应用链接，不包含你的收藏数据。</li>
            <li>「安装到主屏幕」：安卓在浏览器菜单选「安装应用」，苹果用 Safari 分享 →「添加到主屏幕」，之后像独立 App 一样全屏离线使用。</li>
          </ol>
        </details>

        <div className="auto-backup-row">
          <div className="auto-backup-info">
            <span className="auto-backup-title">自动备份</span>
            <span className="auto-backup-meta">
              {autoInfo
                ? formatDateTime(autoInfo.savedAt) + ' · ' + autoInfo.products + ' 个款式'
                : '暂无（添加数据后自动生成）'}
            </span>
          </div>
          <button
            type="button"
            className="btn-mini"
            disabled={!autoInfo || busy}
            onClick={() => setConfirmAuto(true)}
          >
            恢复
          </button>
        </div>

        <p className="settings-hint">
          导出文件为 JSON 格式，包含全部款式、记录、标签、昵称与图片；
          自动备份保存在本机，仅防误操作，建议定期导出到网盘或电脑。
        </p>

        <button type="button" className="btn-primary" disabled={busy} onClick={handleExport}>
          {busy ? '导出中…' : '导出备份（JSON）'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={handleExportXlsx}>
          导出 Excel（流水 + 款式）
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={handlePick}>
          从备份文件导入
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={handleShare}>
          分享到微信
        </button>

        {!standalone && (
          <div className="install-block">
            {installable ? (
              <button type="button" className="btn-ghost" onClick={handleInstall}>
                安装到主屏幕（像 App 一样打开）
              </button>
            ) : (
              <p className="install-hint">
                {ios
                  ? '安装 App：用 Safari 打开本页 → 分享按钮 →「添加到主屏幕」'
                  : '安装 App：浏览器菜单 →「安装应用」或「添加到主屏幕」，即可像独立 App 一样全屏离线使用'}
              </p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
