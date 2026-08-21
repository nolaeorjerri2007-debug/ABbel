// 原子扣费：把「首次发放 / 余额判断 / 自减」合并为一条 Lua 脚本，
// 在 Redis 内原子执行，杜绝并发下「读-判-减」三段分离导致的余额击穿（超额扣费）。
// 数据模型：
//   {userId}         → balance（剩余算力，字符串数值）
//   {userId}:total   → total（累计可用总量，字符串数值）
// 首次访问时同时初始化 balance 与 total 为免费额度 FREE_QUOTA。
export const DEDUCT_QUOTA_LUA = `
local balanceKey = KEYS[1]
local totalKey = KEYS[2]
local quota = tonumber(ARGV[1])

if redis.call('EXISTS', balanceKey) == 0 then
  redis.call('SET', balanceKey, quota)
  redis.call('SET', totalKey, quota)
end

local balance = tonumber(redis.call('GET', balanceKey))
local total = tonumber(redis.call('GET', totalKey)) or quota

if balance <= 0 then
  return { 0, balance, total }
end

local newBalance = redis.call('DECR', balanceKey)
return { 1, newBalance, total }
`;

// 扣 1 次额度，返回 { ok: 1|0, balance: number, total: number }
// ok === 0 表示余额不足，balance 为当前余额（未扣费）。
export async function deductQuota(redis, userId, freeQuota) {
  const [ok, balance, total] = await redis.eval(DEDUCT_QUOTA_LUA, {
    keys: [userId, `${userId}:total`],
    arguments: [String(freeQuota)]
  });
  return { ok, balance, total };
}
