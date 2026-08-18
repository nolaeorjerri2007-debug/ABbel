// 本地并发压测：验证 Redis Lua 原子扣费在高并发下不会超额击穿。
// 用法：node scripts/concurrency-test.js [REDIS_URL] [初始额度] [并发数]
// 示例：node scripts/concurrency-test.js                    # 默认 10 额度 / 50 并发，REDIS_URL 从 .env 读取
//       node scripts/concurrency-test.js "redis://..." 10 200
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deductQuota } from '../lib/quota.js';

// 加载项目根 .env（不覆盖已有环境变量）
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const [, , argUrl, argQuota, argConcurrency] = process.argv;
const REDIS_URL = argUrl || process.env.REDIS_URL;
const INITIAL_QUOTA = parseInt(argQuota || '10', 10);
const CONCURRENCY = parseInt(argConcurrency || '50', 10);

if (!REDIS_URL) {
  console.error('✗ 缺少 REDIS_URL：请作为第 1 个参数传入，或在项目根 .env 中配置 REDIS_URL');
  process.exit(1);
}

async function main() {
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();

  // 独立测试 key，测完即删，不触碰任何真实用户余额数据
  const testKey = `concurrency-test:${randomUUID()}`;

  // 1. 预置测试余额
  await redis.set(testKey, INITIAL_QUOTA);

  // 2. 每个并发请求使用独立连接，模拟 Vercel Serverless 多进程并发
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      const client = createClient({ url: REDIS_URL });
      await client.connect();
      try {
        return await deductQuota(client, testKey, INITIAL_QUOTA);
      } finally {
        await client.disconnect();
      }
    })
  );

  const success = results.filter((r) => r.ok === 1).length;
  const rejected = results.filter((r) => r.ok === 0).length;
  const finalBalance = parseInt(await redis.get(testKey), 10);

  // 3. 清理测试数据
  await redis.del(testKey);
  await redis.disconnect();

  // 4. 报告与断言
  console.log('======== 原子扣费并发压测 ========');
  console.log(`初始额度   : ${INITIAL_QUOTA}`);
  console.log(`并发请求数 : ${CONCURRENCY}`);
  console.log(`成功扣费数 : ${success}`);
  console.log(`拒绝数(403): ${rejected}`);
  console.log(`最终余额   : ${finalBalance}`);
  console.log('---------------------------------');

  const checks = [
    ['成功数不超过初始额度', success <= INITIAL_QUOTA],
    ['最终余额不为负', finalBalance >= 0],
    ['最终余额 = 初始额度 - 成功数', finalBalance === INITIAL_QUOTA - success],
    ['成功数 + 拒绝数 = 并发数', success + rejected === CONCURRENCY],
    ['额度恰好用完（成功数 == 初始额度）', success === INITIAL_QUOTA],
  ];

  let allPass = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? '✓' : '✗'} ${name}`);
    if (!pass) allPass = false;
  }

  console.log('=================================');
  console.log(
    allPass
      ? '✓ 原子性验证通过：并发下无超额扣费，余额未击穿为负'
      : '✗ 原子性验证失败，请检查 deductQuota 实现'
  );
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('压测脚本异常：', err);
  process.exit(1);
});
