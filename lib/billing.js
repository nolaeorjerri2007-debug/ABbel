import { createClient } from '@supabase/supabase-js'

// service_role 客户端：绕过 RLS，供 webhook 在支付成功后更新 users.plan（显式写 id）。
// 懒加载：在函数调用时才读取环境变量，兼容本地测试脚本（.env 在 import 之后才加载）。
let supabase = null

function getSupabase() {
  if (supabase) return supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return supabase
}

// 写入用户套餐：creator（创作者月卡，10 模板槽）或 free（默认，4 槽）。
// 失败仅记录日志，不阻断加额主流程。
export async function setUserPlan(userId, plan) {
  const client = getSupabase()
  if (!client) {
    console.error('[billing] 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，跳过 plan 更新')
    return
  }
  try {
    const { error } = await client.from('users').upsert({ id: userId, plan }, { onConflict: 'id' })
    if (error) console.error('[billing] 更新 plan 失败:', error.message)
  } catch (e) {
    console.error('[billing] 更新 plan 异常:', e)
  }
}
