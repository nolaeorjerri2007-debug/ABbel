// Lemon.js 官方 SDK 封装（全局对象 window.LemonSqueezy，由 index.html 的 CDN script 注入）。
// 全局 Setup 只注册一次；收银遮罩由 Lemon 官方渲染，100% 留在本站，无跳转。
import { STORE_SLUG } from './plans'

let initialized = false
let handler = null

export function initLemon({ onEvent } = {}) {
  if (typeof window === 'undefined') return
  const LS = window.LemonSqueezy
  if (!LS) {
    console.error('[lemon] Lemon.js 未加载，请确认 index.html 已注入 CDN script')
    return
  }
  if (initialized) return
  initialized = true
  handler = onEvent
  LS.Setup({
    eventHandler: (event) => {
      if (typeof handler === 'function') handler(event)
    },
  })
}

// 打开官方收银遮罩，并通过 checkout[custom][user_id] 透传用户身份，实现订单↔用户绑定。
export function openCheckout(variantId, userId) {
  const LS = window.LemonSqueezy
  if (!LS) throw new Error('Lemon.js 未加载')
  if (!variantId) throw new Error('缺少 variant ID，请检查 .env 的 VITE_LS_VARIANT_*')
  const base = `https://${STORE_SLUG}/checkout/buy/${variantId}`
  const url = userId
    ? `${base}?checkout[custom][user_id]=${encodeURIComponent(userId)}`
    : base
  LS.Url.Open(url)
}
