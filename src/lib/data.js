import { supabase } from './supabase.js'

// ============ 专属模板（记忆槽） ============

export async function listTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTemplate({ name, scores }) {
  const { data, error } = await supabase
    .from('templates')
    .insert({ name, scores })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw error
}

// ============ 生成历史 ============

export async function listGenerationsPage({ from = 0, to = 19 } = {}) {
  const { data, count, error } = await supabase
    .from('generations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { rows: data ?? [], count: count ?? 0 }
}

export async function countGenerations() {
  const { count, error } = await supabase
    .from('generations')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function deleteGeneration(id) {
  const { error } = await supabase.from('generations').delete().eq('id', id)
  if (error) throw error
}

// ============ 账户档案 ============

// 把 Clerk 档案（email/display_name）同步进 users 表（security definer 只改这两个字段）
export async function syncMyProfile({ email, display_name }) {
  const { error } = await supabase.rpc('sync_my_profile', {
    p_email: email,
    p_display_name: display_name,
  })
  if (error) throw error
}
