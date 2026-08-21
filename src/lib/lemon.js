// Lemon.js 官方 SDK 封装（全局对象 window.LemonSqueezy，由 index.html 的 CDN script 注入）。
// 收银遮罩由 Lemon 官方渲染，100% 留在本站，无跳转。
// 由于 CDN 脚本用 defer 加载，可能晚于 React 挂载，这里统一「等待就绪 + 确保 Setup」，
// 避免「Setup 未注册 → Checkout.Success 丢失」和「Url.Open 时脚本未就绪」两类问题。
let setupDone = false
let handler = null
let waitPromise = null

// 等待 window.LemonSqueezy 就绪（轮询，默认 15s 超时）。
function waitForLemon(timeoutMs = 15000) {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR 环境无 window'))
  if (window.LemonSqueezy) return Promise.resolve(window.LemonSqueezy)
  if (waitPromise) return waitPromise
  waitPromise = new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (window.LemonSqueezy) {
        clearInterval(timer)
        waitPromise = null
        resolve(window.LemonSqueezy)
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        waitPromise = null
        reject(new Error('Lemon.js 加载超时，请检查 index.html 是否注入 CDN script'))
      }
    }, 100)
  })
  return waitPromise
}

// 确保 Setup 已执行（幂等），这样 Checkout.Success 等事件才不会被漏掉。
function ensureSetup(LS) {
  if (setupDone) return
  setupDone = true
  LS.Setup({
    eventHandler: (event) => {
      if (typeof handler === 'function') handler(event)
    },
  })
}

// 注册事件回调并初始化（幂等）；脚本未就绪时先记住回调，等待后补 Setup。
export function initLemon({ onEvent } = {}) {
  if (typeof onEvent === 'function') handler = onEvent
  if (typeof window === 'undefined') return
  waitForLemon()
    .then((LS) => ensureSetup(LS))
    .catch((e) => console.error('[lemon]', e.message))
}

// 打开官方收银遮罩；等待脚本就绪并确保 Setup 后，再通过 checkout[custom][user_id] 透传用户身份。
export async function openCheckout(variantId, userId) {
  if (!variantId) throw new Error('缺少 variant ID，请检查 .env 的 VITE_LS_VARIANT_*')
  const LS = await waitForLemon()
  ensureSetup(LS)
  // 手动拼接完整绝对 URL（官方域名 + 用户身份透传），确保 Lemon.js Overlay 能正确识别、不跳转。
  const checkoutUrl = `https://abbel.lemonsqueezy.com/checkout/buy/${variantId}${
    userId ? `?checkout[custom][user_id]=${encodeURIComponent(userId)}` : ''
  }`
  LS.Url.Open(checkoutUrl)
}
