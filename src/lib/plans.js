// 点数包 SKU 配置（单一事实源，供套餐选择 UI 读取）。
// Price ID 一律从环境变量读取，禁止明文硬编码；Paddle 沙盒建价后回填真实值即可。
// 注意：api/webhooks/paddle.js 里有一份 credits 映射，改动点数时需两边同步。

// 免费档 Tier 0（新手体验包 / 10 次 / 免费）由后端 FREE_QUOTA 控制，不在收银台展示。

export const PACKAGES = [
  {
    id: 'starter',
    name: '尝鲜能量包',
    credits: 100,
    price: '¥9.99',
    period: null,
    priceEnv: 'VITE_PADDLE_PRICE_100',
    isPopular: false,
  },
  {
    id: 'advanced',
    name: '主力进阶包',
    credits: 400,
    price: '¥29.99',
    period: null,
    priceEnv: 'VITE_PADDLE_PRICE_400',
    isPopular: true,
  },
  {
    id: 'creator',
    name: '创作者月卡',
    credits: 300,
    templateBonus: 10,
    price: '¥19.99',
    period: 'monthly',
    priceEnv: 'VITE_PADDLE_PRICE_PRO',
    isPopular: false,
  },
]

// 解析某档位的真实 price ID；未配置时返回 null，由调用方给出明确报错。
export function resolvePriceId(pkg) {
  return import.meta.env[pkg.priceEnv] || null
}
