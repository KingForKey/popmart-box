import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import { setNickname } from '../store/db.js'
import { showToast } from '../platform/toast.js'

// 昵称编辑弹窗。保存走 db.setNickname，留空 = 清除昵称。
// onSaved 在保存成功后触发，由页面负责刷新问候语。

export default function NicknameSheet({ open, onClose, value, onSaved }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(value || '')
      setSaving(false)
    }
  }, [open, value])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      await setNickname(name)
      showToast('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="昵称设置">
      <div className="add-form">
        <div className="form-item">
          <label className="form-label" htmlFor="field-nickname">怎么称呼你</label>
          <input
            id="field-nickname"
            type="text"
            maxLength={12}
            className="form-input"
            placeholder="最多 12 个字，留空则不显示"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={handleSave}
        >
          保存
        </button>
      </div>
    </Sheet>
  )
}
