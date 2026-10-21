// 平台能力封装：选图片并压缩。
// 页面里禁止直接用 input[type=file]，统一调用 pickImage()。

export function pickImage() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.appendChild(input)

    let settled = false

    function settle(fn, value) {
      if (settled) return
      settled = true
      if (input.parentNode) input.parentNode.removeChild(input)
      fn(value)
    }

    input.addEventListener('change', () => {
      const file = input.files && input.files[0]
      if (!file) {
        settle(reject, new Error('未选择图片'))
        return
      }
      compressImage(file)
        .then((dataUrl) => settle(resolve, dataUrl))
        .catch((err) => settle(reject, err))
    })

    input.addEventListener('cancel', () => {
      settle(reject, new Error('取消选择图片'))
    })

    input.click()
  })
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        const MAX_EDGE = 400
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (w > MAX_EDGE || h > MAX_EDGE) {
          if (w >= h) {
            h = Math.round((h * MAX_EDGE) / w)
            w = MAX_EDGE
          } else {
            w = Math.round((w * MAX_EDGE) / h)
            h = MAX_EDGE
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/webp', 0.8)
        resolve(dataUrl)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
