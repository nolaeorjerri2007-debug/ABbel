// Paddle.js v2（Paddle Billing）官方 SDK 封装（全局对象 window.Paddle，由 index.html 的 CDN script 注入）。
// 收银遮罩由 Paddle 官方渲染，100% 留在本站，无跳转。
// CDN 脚本可能晚于 React 挂载，这里统一「等待就绪 + 确保 Initialize」，
// 避免「Initialize 未执行 → checkout.completed 事件丢失」和「Checkout.open 时脚本未就绪」两类问题。

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN
const PADDLE_ENVIRONMENT = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'production'

let initialized = false
let handler = null
let waitPromise = null

// 等待 window.Paddle 就绪（轮询，默认 15s 超时）。
function waitForPaddle(timeoutMs = 15000) {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR 环境无 window'))
  if (window.Paddle) return Promise.resolve(window.Paddle)
  if (waitPromise) return waitPromise
  waitPromise = new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (window.Paddle) {
        clearInterval(timer)
        waitPromise = null
        resolve(window.Paddle)
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        waitPromise = null
        reject(new Error('Paddle.js 加载超时，请检查 index.html 是否注入 CDN script'))
      }
    }, 100)
  })
  return waitPromise
}

// 确保 Paddle 已 Initialize（幂等），这样 checkout.completed 等事件才不会被漏掉。
function ensureInit(Paddle) {
  if (initialized) return
  initialized = true
  if (PADDLE_ENVIRONMENT === 'sandbox') Paddle.Environment.set('sandbox')
  Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
    eventCallback: (event) => {
      if (typeof handler === 'function') handler(event)
    },
  })
}

// 注册事件回调并初始化（幂等）；脚本未就绪时先记住回调，等待后补 Initialize。
export function initPaddle({ onEvent } = {}) {
  if (typeof onEvent === 'function') handler = onEvent
  if (typeof window === 'undefined') return
  waitForPaddle()
    .then((Paddle) => ensureInit(Paddle))
    .catch((e) => console.error('[paddle]', e.message))
}

// 打开收银遮罩；等待脚本就绪并确保 Initialize 后，传入 priceId + customData（用户身份透传）。
export async function openCheckout(priceId, userId) {
  if (!priceId) throw new Error('缺少 price ID，请检查 .env 的 VITE_PADDLE_PRICE_*')
  const Paddle = await waitForPaddle()
  ensureInit(Paddle)
  Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customData: userId ? { user_id: userId } : undefined,
    settings: { displayMode: 'overlay', theme: 'light' },
  })
}
