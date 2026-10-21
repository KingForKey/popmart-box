import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import { getSources, addSource, renameSource, deleteSource } from '../store/db.js'
import { showToast } from '../platform/toast.js'

// 来源平台管理弹窗：新增 / 重命名 / 删除。
// 数据操作直接走 store；变更后回调 onChanged 让调用方刷新标签。

export default function SourceManager({ open, onClose, onChanged }) {
  const [sources, setSources] = useState([])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null) // { name, value }
  const [busy, setBusy] = useState(false)

  function reload() {
    getSources().then(setSources)
  }

  useEffect(() => {
    if (!open) return
    reload()
    setNewName('')
    setEditing(null)
  }, [open])

  function handleError(e) {
    showToast((e && e.message) || '操作失败')
  }

  async function handleAdd() {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      await addSource(name)
      setNewName('')
      reload()
      if (onChanged) onChanged()
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  async function handleRename() {
    if (!editing || busy) return
    const to = editing.value.trim()
    if (!to) return
    setBusy(true)
    try {
      await renameSource(editing.name, to)
      setEditing(null)
      reload()
      if (onChanged) onChanged()
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(name) {
    if (busy) return
    setBusy(true)
    try {
      await deleteSource(name)
      if (editing && editing.name === name) setEditing(null)
      reload()
      if (onChanged) onChanged()
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="管理来源平台">
      <div className="manager-list">
        {sources.length === 0 && (
          <div className="manager-empty">暂无来源，在下方添加一个吧</div>
        )}
        {sources.map((s) => (
          <div className="manager-row" key={s}>
            {editing && editing.name === s ? (
              <div className="manager-edit-row">
                <input
                  type="text"
                  className="form-input"
                  value={editing.value}
                  autoFocus
                  onChange={(e) => setEditing({ name: s, value: e.target.value })}
                />
                <button type="button" className="mini-btn primary" onClick={handleRename}>
                  确定
                </button>
                <button type="button" className="mini-btn" onClick={() => setEditing(null)}>
                  取消
                </button>
              </div>
            ) : (
              <>
                <span className="manager-name">{s}</span>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => setEditing({ name: s, value: s })}
                >
                  改名
                </button>
                <button type="button" className="mini-btn danger" onClick={() => handleDelete(s)}>
                  删除
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="manager-add-row">
        <input
          type="text"
          className="form-input"
          placeholder="新来源名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          className="mini-btn primary"
          disabled={!newName.trim() || busy}
          onClick={handleAdd}
        >
          添加
        </button>
      </div>

      <button type="button" className="btn-primary" onClick={onClose}>
        完成
      </button>
    </Sheet>
  )
}
