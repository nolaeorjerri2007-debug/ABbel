export const maxDuration = 60; // 强制将 Vercel 的超时限制拉长到 Hobby 计划的最大值 60 秒
export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 这里是在 Vercel 服务器上向 Dify 发请求，前端看不到这段代码
    const response = await fetch('https://api.dify.ai/v1/workflows/run', {
      method: 'POST',
      headers: {
        // 注意这里的 process.env.DIFY_TOKEN_GENERATE，它会去读取 Vercel 的保险箱
        'Authorization': `Bearer ${process.env.DIFY_TOKEN_GENERATE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body) // 把前端传过来的要求直接转发给 Dify
    });

    const data = await response.json();
    res.status(200).json(data); // 把 Dify 的回答原样返回给前端
  } catch (error) {
    res.status(500).json({ error: '后端代理请求失败' });
  }
}