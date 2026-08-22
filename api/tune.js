import { createClient } from 'redis';
import { verifyToken } from '@clerk/backend';
import { tuneSchema } from '../lib/schemas.js';
import { deductQuota, refundQuota } from '../lib/quota.js';
import { persistGeneration, hasValidOutput } from '../lib/generations.js';

export const maxDuration = 60; // 保持 60 秒续命补丁

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ==========================================
    // 2. 验证用户真实身份 (Clerk 防伪验钞机)
    // ==========================================
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权，缺失访问令牌！' });
    }
    
    const token = authHeader.split(' ')[1];
    let userId;
    
    let verifiedToken;
    try {
      // 1. 直接接收返回值（不需要解构 data）
      verifiedToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        authorizedParties: ['https://www.abbel.cc', 'https://abbel.cc', 'http://localhost:5173']
      });
    } catch (error) {
      // 2. 如果验证失败，会跳到这里
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }

    // 3. 验证成功，安全获取 userId
    userId = verifiedToken.sub;

    // ==========================================
    // 3. Zod 数据契约体检（必须在扣费之前拦截，垃圾数据不扣额度）
    // ==========================================
    const parsed = tuneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: '输入参数校验失败',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      });
    }
    const payload = parsed.data;

    // ==========================================
    // 4. 连接 Redis，原子扣费（首次发放 / 余额判断 / 自减 合并为单条 Lua）
    // ==========================================
    // 优先读取环境变量中的 FREE_QUOTA，如果没有配置，则默认给 10 次
    const MAX_FREE_QUOTA = parseInt(process.env.FREE_QUOTA || '10', 10);

    const redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();

    try {
      // 用用户真实 ID 作为 Key，一条 Lua 原子完成「首次发放 / 余额判断 / 自减」
      const { ok, balance: newBalance } = await deductQuota(redis, userId, MAX_FREE_QUOTA);

      // 余额枯竭，未扣费，直接拦截
      if (ok === 0) {
        return res.status(429).json({
          error: '您的算力额度已耗尽，请购买点数包继续使用！',
          code: 'QUOTA_EXHAUSTED',
          remaining_balance: newBalance,
        });
      }

      // ==========================================
      // 5. 余额扣除成功，放行调用 Dify 调音引擎（带 50s 超时，留出退款时间）
      // ==========================================
      let response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000);
      try {
        response = await fetch('https://api.dify.ai/v1/workflows/run', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.DIFY_TOKEN_TUNE}`, // 使用专门的调音台钥匙
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (e) {
        // 网络错误 / 超时：上游没有真正产出，退还本次已扣额度
        await refundQuota(redis, userId);
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }

      // 上游 API 报错（非 2xx）：同样退还已扣额度
      if (!response.ok) {
        await refundQuota(redis, userId);
        const errData = await response.json().catch(() => ({}));
        return res.status(502).json({
          error: '上游调音服务暂时不可用，本次未扣费，请稍后重试',
          details: errData?.message || `HTTP ${response.status}`,
        });
      }

      const data = await response.json();

      // 空输出（上游返回 200 但无有效文案）：同样退还已扣额度，不落库
      if (!hasValidOutput('tune', data, payload)) {
        await refundQuota(redis, userId);
        return res.status(502).json({
          error: '上游调音服务返回空结果，本次未扣费，请稍后重试',
          details: 'Dify 返回空输出',
        });
      }
      
      // 6. 扣费已成功、Dify 已返回 → 落库沉淀（失败不阻断返回）
      await persistGeneration({
        userId,
        mode: 'tune',
        inputText: payload.inputs.original_text,
        difyData: data,
        tunePayload: payload,
      });

      // 7. 将 Dify 的结果和最新余额一起返回
      res.status(200).json({ ...data, remaining_balance: newBalance });
    } finally {
      await redis.disconnect();
    }

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '服务器鉴权或请求失败', details: error.message });
  }
}
