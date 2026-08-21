import crypto from 'crypto';
import { createClient } from 'redis';
import { setUserPlan } from '../../lib/billing.js';

// 点数包 credits / plan 映射（price 真实 ID 来自 env；与前端 src/lib/plans.js 保持一致）。
const PACKAGES = [
  { env: 'VITE_PADDLE_PRICE_100', credits: 100, plan: null },
  { env: 'VITE_PADDLE_PRICE_400', credits: 400, plan: null },
  { env: 'VITE_PADDLE_PRICE_PRO', credits: 300, plan: 'creator' }, // 唯一订阅档
];

function resolvePackage(priceId) {
  for (const pkg of PACKAGES) {
    const id = process.env[pkg.env];
    if (id && String(id) === String(priceId)) return pkg;
  }
  return null;
}

// 订阅档（创作者月卡）。订阅续费事件（transaction.completed, origin=subscription_recurring）不含 price，直接取唯一订阅档。
function subscriptionPackage() {
  return PACKAGES.find((p) => p.plan) || null;
}

// 关闭 Vercel 内置 body 解析，才能拿到原始字节做 HMAC 验签。
export const config = { api: { bodyParser: false } };

// 加额 + 可选的 plan 变更；按 key 幂等去重（SET NX，30 天）。
async function applyCredit({ key, userId, credits, plan, res }) {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  const first = await redis.set(`paddle:processed:${key}`, '1', { NX: true, EX: 60 * 60 * 24 * 30 });
  if (first !== 'OK') {
    await redis.disconnect();
    return res.status(200).json({ received: true, duplicate: true });
  }

  // 首次购买可能先于首次生成：确保免费额度已发放（balance 与 total 同时初始化）
  const freeQuota = parseInt(process.env.FREE_QUOTA || '10', 10);
  const balanceKey = userId;
  const totalKey = `${userId}:total`;
  const balanceExists = await redis.exists(balanceKey);
  if (!balanceExists) {
    await redis.set(balanceKey, freeQuota);
    await redis.set(totalKey, freeQuota);
  } else {
    const totalExists = await redis.exists(totalKey);
    if (!totalExists) {
      // 旧数据：有 balance 无 total，用 max(当前余额, 免费额度) 兜底
      const cur = parseInt(await redis.get(balanceKey) || '0', 10);
      await redis.set(totalKey, Math.max(cur, freeQuota));
    }
  }

  // 购买加额：balance 与 total 同时增加
  await redis.incrBy(balanceKey, credits);
  await redis.incrBy(totalKey, credits);
  await redis.disconnect();

  if (plan) await setUserPlan(userId, plan);
  return res.status(200).json({ received: true, credited: credits, plan: plan || null });
}

// 解析 Paddle 事件的 price ID（Paddle Billing：data.items[0].price.id，兼容 price_id）
function priceIdOf(data) {
  const item = data?.items?.[0];
  return item?.price?.id ?? item?.price_id ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. 读取原始 body（必须用原始字节验签，不能依赖已解析的 JSON）
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    if (!rawBody) {
      console.error('[paddle-webhook] 原始 body 为空：bodyParser:false 可能未生效');
    }

    // 2. 验签：Paddle-Signature 头格式 ts=<unix>;h1=<hex>，h1 = HMAC-SHA256(secret, `${ts}:${rawBody}`)
    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[paddle-webhook] 缺少 PADDLE_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'webhook 未配置签名密钥' });
    }
    const signatureHeader = req.headers['paddle-signature'];
    if (!signatureHeader) return res.status(401).json({ error: '缺少签名' });

    let ts = '';
    let h1 = '';
    for (const part of String(signatureHeader).split(';')) {
      const [k, v] = part.split('=');
      if (k === 'ts') ts = v;
      if (k === 'h1') h1 = v;
    }
    if (!ts || !h1) return res.status(401).json({ error: '签名格式错误' });

    const expected = crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`, 'utf8').digest('hex');
    const a = Buffer.from(String(h1));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('[paddle-webhook] 签名校验失败', { 收到签名长度: a.length, 期望长度: b.length, body长度: rawBody.length });
      return res.status(401).json({ error: '签名校验失败' });
    }

    // 3. 解析事件
    const body = JSON.parse(rawBody);
    const eventType = body?.event_type;
    const data = body?.data || {};
    const userId = data?.custom_data?.user_id;
    const dataId = data?.id;

    if (!userId) return res.status(200).json({ received: true, ignored: true });

    // 4. 订阅取消：降级 free
    if (eventType === 'subscription.canceled') {
      await setUserPlan(userId, 'free');
      return res.status(200).json({ received: true, plan: 'free' });
    }

    // 5. 订阅激活：首月 +300 + plan=creator（幂等 key 用 sub id）
    if (eventType === 'subscription.activated') {
      const pkg = subscriptionPackage();
      if (!pkg || !dataId) return res.status(200).json({ received: true, ignored: true });
      return applyCredit({ key: `sub:${dataId}`, userId, credits: pkg.credits, plan: pkg.plan, res });
    }

    // 6. 交易完成：一次性订单或订阅续费
    if (eventType === 'transaction.completed') {
      const origin = String(data?.origin || '');
      const subscriptionId = data?.subscription_id;

      // 订阅续费：origin=subscription_recurring 且带 subscription_id → +300，保持 creator
      if (subscriptionId && origin === 'subscription_recurring') {
        const pkg = subscriptionPackage();
        if (!pkg || !dataId) return res.status(200).json({ received: true, ignored: true });
        return applyCredit({ key: `txn:${dataId}`, userId, credits: pkg.credits, plan: pkg.plan, res });
      }

      // 订阅首月（origin=web 且带 subscription_id）：由 subscription.activated 覆盖，跳过避免重复加额
      if (subscriptionId) {
        return res.status(200).json({ received: true, ignored: true });
      }

      // 一次性订单：100 / 400 点数包
      const priceId = priceIdOf(data);
      const pkg = priceId ? resolvePackage(priceId) : null;
      if (!pkg || pkg.credits <= 0 || !dataId) {
        console.error('[paddle-webhook] 无法匹配点数包', { priceId, eventType });
        return res.status(200).json({ received: true, ignored: true });
      }
      return applyCredit({ key: `txn:${dataId}`, userId, credits: pkg.credits, plan: pkg.plan, res });
    }

    // 7. 其余事件忽略
    return res.status(200).json({ received: true, ignored: true });
  } catch (error) {
    console.error('[paddle-webhook] 处理失败:', error);
    res.status(500).json({ error: 'webhook 处理失败', details: error.message });
  }
}
