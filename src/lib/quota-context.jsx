import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { initPaddle, openCheckout } from './paddle'
import { PACKAGES, resolvePriceId } from './plans'
import { getMyPlan, slotLimitFor } from './data'

const QuotaContext = createContext(null)

// 从 /api/quota 拉取真实余额；webhook 异步到账，故带有限重试。
async function fetchBalance(getToken, attempts = 5) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const token = await getToken()
      const res = await fetch('/api/quota', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.remaining_balance
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
    }
  }
  throw lastErr
}

// 从 users.plan 拉取记忆槽上限；webhook 异步写 plan，故同样带有限重试。
async function fetchSlotLimit(attempts = 5) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const plan = await getMyPlan()
      return slotLimitFor(plan)
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
    }
  }
  throw lastErr
}

export function QuotaProvider({ children }) {
  const { getToken } = useAuth()
  const { user } = useUser()

  const [balance, setBalance] = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const [successCredits, setSuccessCredits] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [slotLimit, setSlotLimit] = useState(4)

  const purchasingRef = useRef(null) // 当前正在 Paddle 收银台支付的套餐

  const refreshBalance = useCallback(async () => {
    try {
      const b = await fetchBalance(getToken)
      setBalance(b)
      return b
    } catch (e) {
      console.error('[quota] 拉取余额失败', e)
      return null
    }
  }, [getToken])

  const refreshSlotLimit = useCallback(async () => {
    try {
      const limit = await fetchSlotLimit()
      setSlotLimit(limit)
      return limit
    } catch (e) {
      console.error('[quota] 拉取槽位上限失败', e)
      return null
    }
  }, [])

  const openUpgrade = useCallback((pkgId = null) => {
    setHighlightId(pkgId)
    setCheckoutError(null)
    setUpgradeOpen(true)
  }, [])

  const closeUpgrade = useCallback(() => {
    setUpgradeOpen(false)
    setHighlightId(null)
  }, [])

  const purchase = useCallback(async (pkgId) => {
    const pkg = PACKAGES.find((p) => p.id === pkgId)
    if (!pkg) return false
    const priceId = resolvePriceId(pkg)
    if (!priceId) {
      setCheckoutError(`套餐「${pkg.name}」的支付 ID 尚未配置，请回填 ${pkg.priceEnv}`)
      return false
    }
    purchasingRef.current = pkg
    setCheckoutError(null)
    try {
      await openCheckout(priceId, user?.id || null)
      return true
    } catch (e) {
      console.error('[paddle] 唤起收银台失败', e)
      purchasingRef.current = null
      setCheckoutError(e?.message || '唤起收银台失败')
      return false
    }
  }, [user?.id])

  const dismissSuccess = useCallback(() => setSuccessCredits(null), [])

  // 登录后首次拉取余额与槽位上限
  useEffect(() => {
    if (user?.id) {
      refreshBalance()
      refreshSlotLimit()
    }
  }, [user?.id, refreshBalance, refreshSlotLimit])

  // 注册 Paddle.js 事件（仅一次）；checkout.completed → 乐观成功动效 + 异步重载余额与槽位上限
  useEffect(() => {
    initPaddle({
      onEvent: (event) => {
        if (event?.name !== 'checkout.completed') return
        const pkg = purchasingRef.current
        setSuccessCredits(pkg ? pkg.credits : null)
        purchasingRef.current = null
        setUpgradeOpen(false)
        refreshBalance()
        refreshSlotLimit()
      },
    })
  }, [refreshBalance, refreshSlotLimit])

  return (
    <QuotaContext.Provider value={{
      balance,
      slotLimit,
      refreshBalance,
      refreshSlotLimit,
      upgradeOpen,
      highlightId,
      successCredits,
      checkoutError,
      openUpgrade,
      closeUpgrade,
      purchase,
      dismissSuccess,
    }}>
      {children}
    </QuotaContext.Provider>
  )
}

export function useQuota() {
  const ctx = useContext(QuotaContext)
  if (!ctx) throw new Error('useQuota 必须在 QuotaProvider 内使用')
  return ctx
}
