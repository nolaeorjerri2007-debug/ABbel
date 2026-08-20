import { createClient } from 'redis';
import { verifyToken } from '@clerk/backend';

// GET /api/quota —— 返回当前用户真实剩余算力（Redis key = Clerk userId）。
// 前端「配额状态重载」的数据源；支付成功后 webhook 异步加额，前端轮询本接口刷新。
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权，缺失访问令牌！' });
    }
    const token = authHeader.split(' ')[1];

    let verifiedToken;
    try {
      verifiedToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        authorizedParties: ['https://www.abbel.cc', 'https://abbel.cc', 'http://localhost:5173'],
      });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token', details: e.message });
    }
    const userId = verifiedToken.sub;

    const redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    const raw = await redis.get(userId);
    await redis.disconnect();

    // 从未消费过（key 不存在）时，余额 = 免费初始额度 FREE_QUOTA
    const remaining = raw === null
      ? parseInt(process.env.FREE_QUOTA || '10', 10)
      : parseInt(raw, 10);

    res.status(200).json({ remaining_balance: remaining });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '服务器鉴权或请求失败', details: error.message });
  }
}
