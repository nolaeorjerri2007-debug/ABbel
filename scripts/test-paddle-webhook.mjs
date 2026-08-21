// 本地 Webhook 闭环验证：伪造 Paddle Billing 各类事件请求，
// 用 .env 里的 PADDLE_WEBHOOK_SECRET 做 HMAC-SHA256 签名（签名串 = `${ts}:${rawBody}`），
// 直接调用真实 api/webhooks/paddle.js handler，验证：
//   transaction.completed / subscription.activated / subscription.canceled
//   的「验签 + Redis 加额 + 幂等去重 + plan 升降级 + 拒签」。
import { createClient } from 'redis';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/webhooks/paddle.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const REDIS_URL = process.env.REDIS_URL;
const SECRET = process.env.PADDLE_WEBHOOK_SECRET;
const PRICE_100 = process.env.VITE_PADDLE_PRICE_100;
const PRICE_PRO = process.env.VITE_PADDLE_PRICE_PRO;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!REDIS_URL) { console.error('✗ 缺少 REDIS_URL'); process.exit(1); }
if (!SECRET) { console.error('✗ 缺少 PADDLE_WEBHOOK_SECRET'); process.exit(1); }
if (!PRICE_100 || !PRICE_PRO) { console.error('✗ 缺少 VITE_PADDLE_PRICE_100 / VITE_PADDLE_PRICE_PRO'); process.exit(1); }

// Paddle 签名：Paddle-Signature: ts=<unix>;h1=<HMAC-SHA256(secret, `${ts}:${rawBody}`) 的 hex>
function sign(rawBody, ts) {
  const signedPayload = `${ts}:${rawBody}`;
  const h1 = createHmac('sha256', SECRET).update(signedPayload, 'utf8').digest('hex');
  return `ts=${ts};h1=${h1}`;
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

async function invoke(payload) {
  const rawBody = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const req = Readable.from([Buffer.from(rawBody)]);
  req.method = 'POST';
  req.headers = { 'paddle-signature': sign(rawBody, ts) };
  const res = makeRes();
  await handler(req, res);
  return res;
}

async function main() {
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();

  const sb = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const results = [];
  const check = (name, pass) => {
    results.push([name, pass]);
    console.log(`${pass ? '✓' : '✗'} ${name}`);
  };

  console.log('======== Paddle Webhook 闭环验证 ========');
  console.log('---------------------------------');

  // ===== 1. transaction.completed：一次性订单 +100 =====
  const orderUserId = `webhook-test:${randomUUID()}`;
  const txnId = randomUUID();
  await redis.set(orderUserId, '0');
  const ok = await invoke({
    event_id: randomUUID(),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: txnId, status: 'completed', origin: 'web', subscription_id: null,
      custom_data: { user_id: orderUserId },
      items: [{ price_id: PRICE_100, quantity: 1, price: { id: PRICE_100 } }],
    },
  });
  check('transaction.completed：credited=100', ok.body?.credited === 100);
  check('订单余额 0→100', parseInt(await redis.get(orderUserId), 10) === 100);
  check('订单 total=110（免费 10 + 100）', parseInt(await redis.get(`${orderUserId}:total`), 10) === 110);
  const okDup = await invoke({
    event_id: randomUUID(),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: txnId, status: 'completed', origin: 'web', subscription_id: null,
      custom_data: { user_id: orderUserId },
      items: [{ price_id: PRICE_100, quantity: 1, price: { id: PRICE_100 } }],
    },
  });
  check('订单重复投递：duplicate', okDup.body?.duplicate === true);

  // ===== 2. subscription.activated：首月 +300 + plan=creator =====
  const subUserId = `webhook-test:${randomUUID()}`;
  const subId = randomUUID();
  await redis.set(subUserId, '0');
  const subOk = await invoke({
    event_id: randomUUID(),
    event_type: 'subscription.activated',
    occurred_at: new Date().toISOString(),
    data: {
      id: subId, status: 'active',
      custom_data: { user_id: subUserId },
      items: [{ price_id: PRICE_PRO, quantity: 1, price: { id: PRICE_PRO } }],
    },
  });
  check('subscription.activated：credited=300 + plan=creator', subOk.body?.credited === 300 && subOk.body?.plan === 'creator');
  check('订阅余额 0→300', parseInt(await redis.get(subUserId), 10) === 300);
  check('订阅 total=310（免费 10 + 300）', parseInt(await redis.get(`${subUserId}:total`), 10) === 310);
  const subDup = await invoke({
    event_id: randomUUID(),
    event_type: 'subscription.activated',
    occurred_at: new Date().toISOString(),
    data: {
      id: subId, status: 'active',
      custom_data: { user_id: subUserId },
      items: [{ price_id: PRICE_PRO, quantity: 1, price: { id: PRICE_PRO } }],
    },
  });
  check('订阅首月重复投递：duplicate', subDup.body?.duplicate === true);

  if (sb) {
    const { data, error } = await sb.from('users').select('plan').eq('id', subUserId).maybeSingle();
    check('Supabase 落库 plan=creator', !error && data?.plan === 'creator');
  } else {
    console.log('⚠ 未配置 Supabase，跳过 plan 落库校验');
  }

  // ===== 3. transaction.completed（renewal）：续费 +300，按 txn 幂等 =====
  const renewTxnId = randomUUID();
  const renewOk = await invoke({
    event_id: randomUUID(),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: renewTxnId, status: 'completed', origin: 'subscription_recurring', subscription_id: subId,
      custom_data: { user_id: subUserId },
      items: [{ price_id: PRICE_PRO, quantity: 1, price: { id: PRICE_PRO } }],
    },
  });
  check('续费：credited=300', renewOk.body?.credited === 300);
  check('续费后余额 300→600', parseInt(await redis.get(subUserId), 10) === 600);
  check('续费后 total 310→610', parseInt(await redis.get(`${subUserId}:total`), 10) === 610);
  const renewDup = await invoke({
    event_id: randomUUID(),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: renewTxnId, status: 'completed', origin: 'subscription_recurring', subscription_id: subId,
      custom_data: { user_id: subUserId },
      items: [{ price_id: PRICE_PRO, quantity: 1, price: { id: PRICE_PRO } }],
    },
  });
  check('续费重复投递：duplicate（按 txn）', renewDup.body?.duplicate === true);

  // ===== 4. transaction.completed（首月 origin=web 带 subscription_id）：忽略，不重复加额 =====
  const initialOk = await invoke({
    event_id: randomUUID(),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: randomUUID(), status: 'completed', origin: 'web', subscription_id: subId,
      custom_data: { user_id: subUserId },
      items: [{ price_id: PRICE_PRO, quantity: 1, price: { id: PRICE_PRO } }],
    },
  });
  check('首月 transaction.completed：ignored', initialOk.body?.ignored === true);
  check('首月后余额仍为 600', parseInt(await redis.get(subUserId), 10) === 600);

  // ===== 5. subscription.canceled：降级 free =====
  const cancelOk = await invoke({
    event_id: randomUUID(),
    event_type: 'subscription.canceled',
    occurred_at: new Date().toISOString(),
    data: {
      id: subId, status: 'canceled',
      custom_data: { user_id: subUserId },
      items: [{ price_id: PRICE_PRO, quantity: 1, price: { id: PRICE_PRO } }],
    },
  });
  check('取消订阅：plan=free', cancelOk.body?.plan === 'free');
  if (sb) {
    const { data, error } = await sb.from('users').select('plan').eq('id', subUserId).maybeSingle();
    check('Supabase 落库 plan=free（取消后）', !error && data?.plan === 'free');
  }

  // ===== 6. 错误签名：401 =====
  const badPayload = JSON.stringify({
    event_id: randomUUID(),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: { id: randomUUID(), status: 'completed', origin: 'web', subscription_id: null, custom_data: { user_id: orderUserId }, items: [{ price_id: PRICE_100, quantity: 1 }] },
  });
  const tsBad = String(Math.floor(Date.now() / 1000));
  const reqBad = Readable.from([Buffer.from(badPayload)]);
  reqBad.method = 'POST';
  reqBad.headers = { 'paddle-signature': `ts=${tsBad};h1=${'0'.repeat(64)}` };
  const resBad = makeRes();
  await handler(reqBad, resBad);
  check('错误签名：401', resBad.statusCode === 401);

  // ===== 清理 =====
  await redis.del(orderUserId, subUserId);
  await redis.del(`${orderUserId}:total`, `${subUserId}:total`);
  await redis.del(`paddle:processed:txn:${txnId}`);
  await redis.del(`paddle:processed:sub:${subId}`);
  await redis.del(`paddle:processed:txn:${renewTxnId}`);
  await redis.disconnect();
  if (sb) {
    await sb.from('users').delete().eq('id', orderUserId);
    await sb.from('users').delete().eq('id', subUserId);
  }

  const allPass = results.every(([, pass]) => pass);
  console.log('---------------------------------');
  console.log(allPass ? '✓ Webhook 闭环验证通过：加额 / 续费 / 幂等 / 升降级 / 拒签 全部正确' : '✗ 存在失败项，请检查 api/webhooks/paddle.js');
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('Webhook 测试脚本异常：', err);
  process.exit(1);
});
