import { useEffect, useMemo, useRef, useState } from 'react'

// 联想输入框：输入时下拉展示匹配项，列表可上下滑动查看全部，点选项填入；
// 选不到也能直接输入任意文字。
// suggestions 按传入顺序展示（调用方把历史数据放前面、字典放后面）。

const MAX_SUGGEST = 100

export default function SuggestInput({ id, value, onChange, placeholder, suggestions = [], inputRef }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase()
    const out = []
    for (const s of suggestions) {
      if (!s) continue
      if (q && s.toLowerCase().indexOf(q) < 0) continue
      if (out.indexOf(s) >= 0) continue
      out.push(s)
      if (out.length >= MAX_SUGGEST) break
    }
    return out
  }, [value, suggestions])

  // 点击组件外部收起下拉
  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [open])

  return (
    <div className="suggest-wrap" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
      />
      {open && filtered.length > 0 && (
        <div className="suggest-list" role="listbox">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="suggest-item"
              // 用 pointerdown + preventDefault：先于 input blur 触发，保证点击能选中
              onPointerDown={(e) => {
                e.preventDefault()
                onChange(s)
                setOpen(false)
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
