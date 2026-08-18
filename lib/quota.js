// 原子扣费：把「首次发放 / 余额判断 / 自减」合并为一条 Lua 脚本，
// 在 Redis 内原子执行，杜绝并发下「读-判-减」三段分离导致的余额击穿（超额扣费）。
export const DEDUCT_QUOTA_LUA = `
local key = KEYS[1]
local quota = tonumber(ARGV[1])

-- 新用户首次访问，发放初始额度
if redis.call('EXISTS', key) == 0 then
  redis.call('SET', key, quota)
end

local balance = tonumber(redis.call('GET', key))
if balance <= 0 then
  return { 0, balance }          -- 余额不足，未扣费
end

local newBalance = redis.call('DECR', key)
return { 1, newBalance }         -- 扣费成功
`;

// 扣 1 次额度，返回 { ok: 1 | 0, balance: number }
// ok === 0 表示余额不足，balance 为当前余额（未扣费）。
export async function deductQuota(redis, userId, freeQuota) {
  const [ok, balance] = await redis.eval(DEDUCT_QUOTA_LUA, {
    keys: [userId],
    arguments: [String(freeQuota)]
  });
  return { ok, balance };
}
