// 离线缓存 Service Worker
// 策略：网络优先，失败时回退到缓存（保证断网时仍能打开应用外壳）。
// 只缓存同源 GET 请求；不缓存第三方接口与图片搜索。

const CACHE = 'popmart-box-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch (e) {
    return
  }
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit
          // 导航请求断网时回退到首页缓存
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then((page) => page || Response.error())
          }
          return Response.error()
        })
      )
  )
})
