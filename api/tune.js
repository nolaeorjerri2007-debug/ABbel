export const maxDuration = 60;
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://api.dify.ai/v1/workflows/run', {
      method: 'POST',
      headers: {
        // 这里读取的是另一把钥匙：DIFY_TOKEN_TUNE
        'Authorization': `Bearer ${process.env.DIFY_TOKEN_TUNE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: '后端代理请求失败' });
  }
}