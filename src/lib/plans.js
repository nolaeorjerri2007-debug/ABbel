// 点数包 SKU 配置（单一事实源，供套餐选择 UI 读取）。
// Variant ID 一律从环境变量读取，禁止明文硬编码；后台建站后回填真实值即可。
// 注意：api/webhooks/lemon.js 里有一份 credits 映射，改动点数时需两边同步。

// 免费档 Tier 0（新手体验包 / 10 次 / 免费）由后端 FREE_QUOTA 控制，不在收银台展示。

// 收银台域名前缀，来自 VITE_LS_STORE_URL（形如 https://abbel.lemonsqueezy.com）。
export const STORE_SLUG = (import.meta.env.VITE_LS_STORE_URL || 'abbel.lemonsqueezy.com').replace(/^https?:\/\//, '')

export const PACKAGES = [
  {
    id: 'starter',
    name: '尝鲜能量包',
    credits: 100,
    price: '¥9.99',
    period: null,
    variantEnv: 'VITE_LS_VARIANT_100',
    isPopular: false,
  },
  {
    id: 'advanced',
    name: '主力进阶包',
    credits: 400,
    price: '¥29.99',
    period: null,
    variantEnv: 'VITE_LS_VARIANT_400',
    isPopular: true,
  },
  {
    id: 'creator',
    name: '创作者月卡',
    credits: 300,
    templateBonus: 10,
    price: '¥19.99',
    period: 'monthly',
    variantEnv: 'VITE_LS_VARIANT_PRO',
    isPopular: false,
  },
]

// 解析某档位的真实 variant ID；未配置时返回 null，由调用方给出明确报错。
export function resolveVariantId(pkg) {
  return import.meta.env[pkg.variantEnv] || null
}
