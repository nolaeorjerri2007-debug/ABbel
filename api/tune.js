import { createClient } from 'redis';
import { verifyToken } from '@clerk/backend';
import { tuneSchema } from '../lib/schemas.js';

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
    // 4. 连接 Redis 查阅用户资产
    // ==========================================
    // 优先读取环境变量中的 FREE_QUOTA，如果没有配置，则默认给 10 次
    const MAX_FREE_QUOTA = parseInt(process.env.FREE_QUOTA || '10', 10);

    const redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();

    let balance = await redis.get(userId);

    // 新用户首次使用自动赠送初始额度
    if (balance === null) {
      balance = MAX_FREE_QUOTA; 
      await redis.set(userId, balance);
    } else {
      balance = parseInt(balance);
    }

    if (balance <= 0) {
      await redis.disconnect();
      return res.status(403).json({ error: '您的算力额度已耗尽，请升级 Pro 会员解锁无限算力！' });
    }

    // ==========================================
    // 4. 额度充足，扣除 1 次并获取最新余额
    // ==========================================
    await redis.decr(userId);
    const newBalance = await redis.get(userId); 
    await redis.disconnect();

    // ==========================================
    // 5. 余额扣除成功，放行调用 Dify 调音引擎
    // ==========================================
    const response = await fetch('https://api.dify.ai/v1/workflows/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DIFY_TOKEN_TUNE}`, // 使用专门的调音台钥匙
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    // 6. 将 Dify 的结果和最新余额一起返回
    res.status(200).json({ ...data, remaining_balance: newBalance });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '服务器鉴权或请求失败', details: error.message });
  }
}
