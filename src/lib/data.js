import { supabase } from './supabase.js'

// 云端请求统一超时：数据库抖动时快速失败并抛错，避免页面无限等待。
// 用 AbortController 真取消底层请求（而非仅 Promise.race 假超时）。
const DEFAULT_TIMEOUT = 10000

async function withTimeout(promiseFactory, ms = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await promiseFactory(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

// ============ 专属模板（记忆槽） ============

export function listTemplates() {
  return withTimeout(async (signal) => {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })
      .abortSignal(signal)
    if (error) throw error
    return data
  })
}

export function createTemplate({ name, scores }) {
  return withTimeout(async (signal) => {
    const { data, error } = await supabase
      .from('templates')
      .insert({ name, scores })
      .select()
      .single()
      .abortSignal(signal)
    if (error) throw error
    return data
  })
}

export function deleteTemplate(id) {
  return withTimeout(async (signal) => {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .abortSignal(signal)
    if (error) throw error
  })
}

// ============ 生成历史 ============

export function listGenerationsPage({ from = 0, to = 19 } = {}) {
  return withTimeout(async (signal) => {
    const { data, count, error } = await supabase
      .from('generations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
      .abortSignal(signal)
    if (error) throw error
    return { rows: data ?? [], count: count ?? 0 }
  })
}

export function countGenerations() {
  return withTimeout(async (signal) => {
    const { count, error } = await supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .abortSignal(signal)
    if (error) throw error
    return count ?? 0
  })
}

export function deleteGeneration(id) {
  return withTimeout(async (signal) => {
    const { error } = await supabase
      .from('generations')
      .delete()
      .eq('id', id)
      .abortSignal(signal)
    if (error) throw error
  })
}

// ============ 账户档案 ============

// 把 Clerk 档案（email/display_name）同步进 users 表（security definer 只改这两个字段）
export function syncMyProfile({ email, display_name }) {
  return withTimeout(async (signal) => {
    const { error } = await supabase
      .rpc('sync_my_profile', {
        p_email: email,
        p_display_name: display_name,
      })
      .abortSignal(signal)
    if (error) throw error
  })
}

// ============ 套餐 / 记忆槽上限 ============

const PLAN_SLOT_LIMITS = { creator: 10, free: 4 }

// 读取当前用户 plan（RLS 只允许读自己那一行）；无记录时按 free 处理。
export function getMyPlan() {
  return withTimeout(async (signal) => {
    const { data, error } = await supabase
      .from('users')
      .select('plan')
      .single()
      .abortSignal(signal)
    if (error) {
      // PGRST116 = 0 行（用户尚未建档案），按 free 处理
      if (error.code === 'PGRST116') return 'free'
      throw error
    }
    return data?.plan || 'free'
  })
}

// plan → 记忆槽上限（默认 4）
export function slotLimitFor(plan) {
  return PLAN_SLOT_LIMITS[plan] ?? 4
}
