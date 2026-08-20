// 本地 Webhook 闭环验证：伪造 Lemon Squeezy 各类事件请求，
// 用 .env 里的 LEMON_SQUEEZY_WEBHOOK_SECRET 做 HMAC-SHA256 签名，
// 直接调用真实 api/webhooks/lemon.js handler，验证：
//   order_created / subscription_created / subscription_payment_success / subscription_expired
//   的「验签 + Redis 加额 + 幂等去重 + plan 升降级 + 拒签」。
import { createClient } from 'redis';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/webhooks/lemon.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const REDIS_URL = process.env.REDIS_URL;
const SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
const VARIANT_100 = process.env.VITE_LS_VARIANT_100;
const VARIANT_PRO = process.env.VITE_LS_VARIANT_PRO;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!REDIS_URL) { console.error('✗ 缺少 REDIS_URL'); process.exit(1); }
if (!SECRET) { console.error('✗ 缺少 LEMON_SQUEEZY_WEBHOOK_SECRET'); process.exit(1); }
if (!VARIANT_100 || !VARIANT_PRO) { console.error('✗ 缺少 VITE_LS_VARIANT_100 / VITE_LS_VARIANT_PRO'); process.exit(1); }

function sign(rawBody) {
  return createHmac('sha256', SECRET).update(rawBody, 'utf8').digest('hex');
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
  return res;
}

// 用正确签名调用真实 handler
async function invoke(payload) {
  const rawBody = JSON.stringify(payload);
  const req = Readable.from([Buffer.from(rawBody)]);
  req.method = 'POST';
  req.headers = { 'x-signature': sign(rawBody) };
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

  console.log('======== Lemon Webhook 闭环验证 ========');
  console.log('---------------------------------');

  // ===== 1. order_created：一次性订单 +100 =====
  const orderUserId = `webhook-test:${randomUUID()}`;
  const orderIdentifier = randomUUID();
  await redis.set(orderUserId, '0');
  const ok = await invoke({
    meta: { event_name: 'order_created', custom_data: { user_id: orderUserId } },
    data: { type: 'orders', id: randomUUID(), attributes: { identifier: orderIdentifier, first_order_item: { variant_id: VARIANT_100 } } },
  });
  check('order_created：credited=100', ok.body?.credited === 100);
  check('订单余额 0→100', parseInt(await redis.get(orderUserId), 10) === 100);
  const okDup = await invoke({
    meta: { event_name: 'order_created', custom_data: { user_id: orderUserId } },
    data: { type: 'orders', id: randomUUID(), attributes: { identifier: orderIdentifier, first_order_item: { variant_id: VARIANT_100 } } },
  });
  check('订单重复投递：duplicate', okDup.body?.duplicate === true);

  // ===== 2. subscription_created：首月 +300 + plan=creator =====
  const subUserId = `webhook-test:${randomUUID()}`;
  const subId = randomUUID();
  await redis.set(subUserId, '0');
  const subOk = await invoke({
    meta: { event_name: 'subscription_created', custom_data: { user_id: subUserId } },
    data: { type: 'subscriptions', id: subId, attributes: { variant_id: VARIANT_PRO, status: 'active' } },
  });
  check('subscription_created：credited=300 + plan=creator', subOk.body?.credited === 300 && subOk.body?.plan === 'creator');
  check('订阅余额 0→300', parseInt(await redis.get(subUserId), 10) === 300);
  const subDup = await invoke({
    meta: { event_name: 'subscription_created', custom_data: { user_id: subUserId } },
    data: { type: 'subscriptions', id: subId, attributes: { variant_id: VARIANT_PRO, status: 'active' } },
  });
  check('订阅首月重复投递：duplicate', subDup.body?.duplicate === true);

  if (sb) {
    const { data, error } = await sb.from('users').select('plan').eq('id', subUserId).maybeSingle();
    check('Supabase 落库 plan=creator', !error && data?.plan === 'creator');
  } else {
    console.log('⚠ 未配置 Supabase，跳过 plan 落库校验');
  }

  // ===== 3. subscription_payment_success（renewal）：续费 +300，按 invoice 幂等 =====
  const invId = randomUUID();
  const invOk = await invoke({
    meta: { event_name: 'subscription_payment_success', custom_data: { user_id: subUserId } },
    data: { type: 'subscription-invoices', id: invId, attributes: { subscription_id: subId, billing_reason: 'renewal', status: 'paid' } },
  });
  check('续费：credited=300', invOk.body?.credited === 300);
  check('续费后余额 300→600', parseInt(await redis.get(subUserId), 10) === 600);
  const invDup = await invoke({
    meta: { event_name: 'subscription_payment_success', custom_data: { user_id: subUserId } },
    data: { type: 'subscription-invoices', id: invId, attributes: { subscription_id: subId, billing_reason: 'renewal', status: 'paid' } },
  });
  check('续费重复投递：duplicate（按 invoice）', invDup.body?.duplicate === true);

  // ===== 4. subscription_payment_success（initial）：忽略，不重复加额 =====
  const invInit = await invoke({
    meta: { event_name: 'subscription_payment_success', custom_data: { user_id: subUserId } },
    data: { type: 'subscription-invoices', id: randomUUID(), attributes: { subscription_id: subId, billing_reason: 'initial', status: 'paid' } },
  });
  check('initial 账单：ignored', invInit.body?.ignored === true);
  check('initial 后余额仍为 600', parseInt(await redis.get(subUserId), 10) === 600);

  // ===== 5. subscription_expired：降级 free =====
  const expOk = await invoke({
    meta: { event_name: 'subscription_expired', custom_data: { user_id: subUserId } },
    data: { type: 'subscriptions', id: subId, attributes: { variant_id: VARIANT_PRO, status: 'expired' } },
  });
  check('到期：plan=free', expOk.body?.plan === 'free');
  if (sb) {
    const { data, error } = await sb.from('users').select('plan').eq('id', subUserId).maybeSingle();
    check('Supabase 落库 plan=free（到期后）', !error && data?.plan === 'free');
  }

  // ===== 6. 错误签名：401 =====
  const badPayload = JSON.stringify({
    meta: { event_name: 'order_created', custom_data: { user_id: orderUserId } },
    data: { type: 'orders', id: randomUUID(), attributes: { identifier: randomUUID(), first_order_item: { variant_id: VARIANT_100 } } },
  });
  const reqBad = Readable.from([Buffer.from(badPayload)]);
  reqBad.method = 'POST';
  reqBad.headers = { 'x-signature': '0'.repeat(64) };
  const resBad = makeRes();
  await handler(reqBad, resBad);
  check('错误签名：401', resBad.statusCode === 401);

  // ===== 清理 =====
  await redis.del(orderUserId, subUserId);
  await redis.del(`lemon:processed:order:${orderIdentifier}`);
  await redis.del(`lemon:processed:sub:${subId}`);
  await redis.del(`lemon:processed:subinv:${invId}`);
  await redis.disconnect();
  if (sb) {
    await sb.from('users').delete().eq('id', orderUserId);
    await sb.from('users').delete().eq('id', subUserId);
  }

  const allPass = results.every(([, pass]) => pass);
  console.log('---------------------------------');
  console.log(allPass ? '✓ Webhook 闭环验证通过：加额 / 续费 / 幂等 / 升降级 / 拒签 全部正确' : '✗ 存在失败项，请检查 api/webhooks/lemon.js');
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('Webhook 测试脚本异常：', err);
  process.exit(1);
});
