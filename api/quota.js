import { createClient } from 'redis';
import { verifyToken } from '@clerk/backend';

// GET /api/quota —— 返回用户真实算力 { balance, total, used }（Redis key = Clerk userId）。
// balance = 剩余；total = 累计总量；used = total - balance。
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

    const freeQuota = parseInt(process.env.FREE_QUOTA || '10', 10);
    const balanceKey = userId;
    const totalKey = `${userId}:total`;

    let balance = await redis.get(balanceKey);
    let total = await redis.get(totalKey);
    await redis.disconnect();

    if (balance === null) {
      // 从未消费过（key 不存在）：余额 = 免费初始额度
      balance = freeQuota;
      total = freeQuota;
    } else {
      balance = parseInt(balance, 10);
      total = total === null ? Math.max(balance, freeQuota) : parseInt(total, 10);
    }

    // 安全兜底：total 至少不小于 balance（旧数据 balance > total 时强制抬高 total）
    total = Math.max(total, balance);
    const used = Math.max(0, total - balance);

    res.status(200).json({ balance, total, used });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '服务器鉴权或请求失败', details: error.message });
  }
}
