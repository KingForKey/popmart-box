import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import { startCameraScan } from '../platform/scan.js'

// 扫码弹窗：相机连续识别二维码/一维条码，识别到即回调并关闭。
// 相机不可用（权限拒绝、非 HTTPS、无摄像头）时给出中文原因，并支持手动输入码。

export default function ScanSheet({ open, onClose, onResult }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const firedRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState(false)
  const [manualCode, setManualCode] = useState('')

  function stopCamera() {
    const c = controlsRef.current
    controlsRef.current = null
    if (c) {
      try {
        c.stop()
      } catch (e) {
        // 已经停止过就忽略
      }
    }
  }

  // 打开/关闭时重置一次状态（不能和相机启动放在同一个 effect 里，
  // 否则切换手动输入时会把 manual 重置回 false）
  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    firedRef.current = false
    setError('')
    setManual(false)
    setManualCode('')
  }, [open])

  useEffect(() => {
    if (!open || manual) {
      stopCamera()
      return
    }

    let cancelled = false
    setStarting(true)
    // 等 Sheet 渲染出 video 元素后再启动相机
    const timer = setTimeout(() => {
      if (cancelled || !videoRef.current) return
      startCameraScan(videoRef.current, (res) => {
        if (firedRef.current) return
        firedRef.current = true
        stopCamera()
        onResult(res)
      })
        .then((controls) => {
          if (cancelled) {
            try {
              controls.stop()
            } catch (e) {
              // ignore
            }
            return
          }
          controlsRef.current = controls
          setStarting(false)
        })
        .catch((e) => {
          if (cancelled) return
          setStarting(false)
          setError((e && e.message) || '相机启动失败')
        })
    }, 80)

    return () => {
      cancelled = true
      clearTimeout(timer)
      stopCamera()
    }
  }, [open, manual])

  function submitManual() {
    const code = manualCode.trim()
    if (!code) return
    onResult({ code, format: 'MANUAL' })
  }

  return (
    <Sheet open={open} onClose={onClose} title="扫码识别">
      <div className="scan-body">
        {!manual ? (
          <>
            <div className="scan-stage">
              <video ref={videoRef} className="scan-video" playsInline muted autoPlay />
              <div className="scan-frame" aria-hidden="true" />
              {starting && <div className="scan-hint">正在启动相机…</div>}
              {error && <div className="scan-hint scan-error">{error}</div>}
            </div>
            <p className="scan-tip">
              把包装背面的条形码或二维码放进框内。识别到会自动填入表单。
            </p>
            <button
              type="button"
              className="scan-manual-btn"
              onClick={() => {
                stopCamera()
                setManual(true)
              }}
            >
              扫不出来？手动输入码
            </button>
          </>
        ) : (
          <>
            <p className="scan-tip">手动输入包装上的数字码</p>
            <input
              type="text"
              className="form-input"
              inputMode="text"
              autoComplete="off"
              placeholder="例如：6941442088888"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button
              type="button"
              className="scan-submit-btn"
              disabled={!manualCode.trim()}
              onClick={submitManual}
            >
              确定
            </button>
            <button
              type="button"
              className="scan-manual-btn"
              onClick={() => {
                setError('')
                setManual(false)
              }}
            >
              返回扫码
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
