import { createClient } from 'redis';

export const maxDuration = 60; // 保持 60 秒续命补丁

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. 从前端请求中提取激活码和要处理的文案
  const { code, inputs, response_mode, user } = req.body;

  // 如果前端没传激活码，直接拦截
  if (!code) {
    return res.status(401).json({ error: '请输入有效的激活码！' });
  }

  // 2. 连接 Redis 数据库
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();

  try {
    // 3. 查验余额
    const balance = await redis.get(code);

    if (!balance || parseInt(balance) <= 0) {
      await redis.disconnect();
      return res.status(403).json({ error: '激活码无效或额度已耗尽，请续费！' });
    }

    // 4. 额度充足，扣除 1 次
    await redis.decr(code);
    const newBalance = await redis.get(code); // 获取扣除后的最新余额
    await redis.disconnect();

    // 5. 余额扣除成功，放行调用 Dify
    const difyResponse = await fetch('https://api.dify.ai/v1/workflows/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DIFY_TOKEN_GENERATE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs, response_mode, user })
    });
    
    const data = await difyResponse.json();
    
    // 6. 将 Dify 的结果和剩余额度一起返回给前端
    res.status(200).json({ ...data, remaining_balance: newBalance });

  } catch (error) {
    await redis.disconnect();
    res.status(500).json({ error: '服务器鉴权失败', details: error.message });
  }
}