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

export async function listGenerations() {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createGeneration({ input_text, output_draft, scores, template_id = null }) {
  const { data, error } = await supabase
    .from('generations')
    .insert({ input_text, output_draft, scores, template_id })
    .select()
    .single()
  if (error) throw error
  return data
}
