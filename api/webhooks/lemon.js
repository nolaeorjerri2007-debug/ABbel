import crypto from 'crypto';
import { createClient } from 'redis';
import { setUserPlan } from '../../lib/billing.js';

// 点数包 credits / plan 映射（variant 真实 ID 来自 env；与前端 src/lib/plans.js 保持一致）。
const PACKAGES = [
  { env: 'VITE_LS_VARIANT_100', credits: 100, plan: null },
  { env: 'VITE_LS_VARIANT_400', credits: 400, plan: null },
  { env: 'VITE_LS_VARIANT_PRO', credits: 300, plan: 'creator' }, // 唯一订阅档
];

function resolvePackage(variantId) {
  for (const pkg of PACKAGES) {
    const id = process.env[pkg.env];
    if (id && String(id) === String(variantId)) return pkg;
  }
  return null;
}

// 订阅档（创作者月卡）。订阅续费事件（SubscriptionInvoice）不含 variant_id，故直接取唯一订阅档。
function subscriptionPackage() {
  return PACKAGES.find((p) => p.plan) || null;
}

// 关闭 Vercel 内置 body 解析，才能拿到原始字节做 HMAC 验签。
export const config = { api: { bodyParser: false } };

// 加额 + 可选的 plan 变更；按 key 幂等去重（SET NX，30 天）。
async function applyCredit({ key, userId, credits, plan, res }) {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  const first = await redis.set(`lemon:processed:${key}`, '1', { NX: true, EX: 60 * 60 * 24 * 30 });
  if (first !== 'OK') {
    await redis.disconnect();
    return res.status(200).json({ received: true, duplicate: true });
  }
  await redis.incrBy(userId, credits);
  await redis.disconnect();

  if (plan) await setUserPlan(userId, plan);
  return res.status(200).json({ received: true, credited: credits, plan: plan || null });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. 读取原始 body（必须用原始字节验签，不能依赖已解析的 JSON）
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // 2. 验签：HMAC-SHA256(secret, rawBody) 与 X-Signature 恒定时间比对
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[lemon-webhook] 缺少 LEMON_SQUEEZY_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'webhook 未配置签名密钥' });
    }
    const signature = req.headers['x-signature'];
    if (!signature) return res.status(401).json({ error: '缺少签名' });

    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const a = Buffer.from(String(signature));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: '签名校验失败' });
    }

    // 3. 解析事件
    const body = JSON.parse(rawBody);
    const eventName = body?.meta?.event_name;
    const userId = body?.meta?.custom_data?.user_id;
    const attrs = body?.data?.attributes || {};
    const dataId = body?.data?.id;

    if (!userId) return res.status(200).json({ received: true, ignored: true });

    // 4. 订阅到期：降级为 free（幂等，无需去重）
    if (eventName === 'subscription_expired') {
      await setUserPlan(userId, 'free');
      return res.status(200).json({ received: true, plan: 'free' });
    }

    // 5. 一次性订单：order_created / order_paid
    if (eventName === 'order_created' || eventName === 'order_paid') {
      const variantId = attrs.variant_id ?? attrs.first_order_item?.variant_id ?? null;
      const pkg = variantId ? resolvePackage(variantId) : null;
      if (!pkg || pkg.credits <= 0) {
        console.error('[lemon-webhook] 无法匹配点数包', { variantId, eventName });
        return res.status(200).json({ received: true, ignored: true });
      }
      const key = attrs.identifier ?? dataId;
      if (!key) return res.status(200).json({ received: true, ignored: true });
      return applyCredit({ key: `order:${key}`, userId, credits: pkg.credits, plan: pkg.plan, res });
    }

    // 6. 订阅首月：subscription_created（Subscription 含 variant_id）
    if (eventName === 'subscription_created') {
      const pkg = attrs.variant_id ? resolvePackage(attrs.variant_id) : subscriptionPackage();
      if (!pkg) return res.status(200).json({ received: true, ignored: true });
      return applyCredit({ key: `sub:${dataId}`, userId, credits: pkg.credits, plan: pkg.plan, res });
    }

    // 7. 订阅续费：subscription_payment_success（按 invoice 幂等）
    if (eventName === 'subscription_payment_success') {
      // initial 账单已由 subscription_created 覆盖，仅 renewal 加额，避免重复
      if (attrs.billing_reason !== 'renewal') {
        return res.status(200).json({ received: true, ignored: true });
      }
      const pkg = subscriptionPackage();
      if (!pkg) return res.status(200).json({ received: true, ignored: true });
      return applyCredit({ key: `subinv:${dataId}`, userId, credits: pkg.credits, plan: pkg.plan, res });
    }

    // 8. 其余事件忽略
    return res.status(200).json({ received: true, ignored: true });
  } catch (error) {
    console.error('[lemon-webhook] 处理失败:', error);
    res.status(500).json({ error: 'webhook 处理失败', details: error.message });
  }
}
