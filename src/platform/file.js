// 平台能力封装：文件下载与本地文件选择。
// 页面里禁止直接操作 a[download] / input[type=file]，统一走这里。

// 下载 Blob（通用底层）
export function downloadBlob(filename, blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve()
    }, 300)
  })
}

// 下载 JSON 文件（用于数据备份导出）
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  return downloadBlob(filename, blob)
}

// 选择一个 .json 文本文件，返回解析后的对象。
// 用户取消 → resolve(null)。JSON 解析失败 → reject。
export function pickJsonText() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    document.body.appendChild(input)

    let settled = false
    const cleanup = () => {
      input.remove()
    }

    input.addEventListener('change', () => {
      const file = input.files && input.files[0]
      if (!file) {
        settled = true
        cleanup()
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        settled = true
        cleanup()
        try {
          resolve(JSON.parse(String(reader.result)))
        } catch (e) {
          reject(new Error('文件内容不是合法 JSON'))
        }
      }
      reader.onerror = () => {
        settled = true
        cleanup()
        reject(new Error('文件读取失败'))
      }
      reader.readAsText(file)
    })

    // 用户在文件选择框点了取消（部分浏览器不触发 change）
    input.addEventListener('cancel', () => {
      if (!settled) {
        settled = true
        cleanup()
        resolve(null)
      }
    })
  })
}
