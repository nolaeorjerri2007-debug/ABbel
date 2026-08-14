import { createClient } from 'redis';

export default async function handler(req, res) {
  try {
    // 1. 连接到 Vercel 自动注入的 Redis 数据库
    const client = createClient({
      url: process.env.REDIS_URL
    });
    
    client.on('error', err => console.log('Redis Client Error', err));
    await client.connect();

    // 2. 写入激活码：ABBEL-TEST-001，额度：50次
    await client.set('ABBEL-TEST-001', '50');
    
    // 3. 读取出来验证一下
    const balance = await client.get('ABBEL-TEST-001');
    await client.disconnect();

    // 4. 返回成功信息
    res.status(200).json({ 
      success: true, 
      message: '太棒了！激活码已成功写入你的云端账本！',
      code: 'ABBEL-TEST-001',
      balance: balance
    });
  } catch (error) {
    res.status(500).json({ error: '写入失败', details: error.message });
  }
}