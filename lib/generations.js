import { createClient } from '@supabase/supabase-js'

// service_role 客户端：绕过 RLS，供后端在扣费成功后直接落库（显式写 user_id）。
// 若环境变量缺失则降级为 no-op，避免影响主生成流程。
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

// 主引擎：清洗 <think> 与 markdown 代码块围栏
function cleanText(raw) {
  return (raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/gi, '')
    .trim()
}

// 调音引擎：把 diff HTML 熔炼成用户实际看到的底稿（丢弃 <del>，剥离 <ins> 外壳）
function meltDiffToDraft(html) {
  return (html || '')
    .replace(/<del>[\s\S]*?<\/del>/gi, '')
    .replace(/<\/?ins>/gi, '')
}

function extractGenerate(difyData) {
  const outputs = difyData?.data?.outputs || {}
  const answerStr =
    (typeof outputs.text === 'string' && outputs.text) ||
    (typeof outputs.draft === 'string' && outputs.draft) ||
    (typeof outputs.content === 'string' && outputs.content) ||
    (typeof outputs.output === 'string' && outputs.output) ||
    (typeof outputs.result === 'string' && outputs.result) ||
    (typeof difyData?.answer === 'string' && difyData.answer) ||
    ''

  const cleaned = cleanText(answerStr)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const stringToParse = jsonMatch ? jsonMatch[0] : cleaned

  let parsed = {}
  try { parsed = JSON.parse(stringToParse) } catch {}

  const output_draft = parsed.draft || parsed.text || parsed.content || stringToParse

  let title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  if (!title && typeof outputs.title === 'string') title = outputs.title.trim()
  if (!title) {
    const m = cleaned.match(/["']title["']\s*:\s*["']([^"']+)["']/)
    if (m) title = m[1].trim()
  }

  let subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : ''
  if (!subtitle && typeof outputs.subtitle === 'string') subtitle = outputs.subtitle.trim()
  if (!subtitle) {
    const m = cleaned.match(/["']subtitle["']\s*:\s*["']([^"']+)["']/)
    if (m) subtitle = m[1].trim()
  }

  const rawScores = parsed.scores || outputs.scores || parsed
  const scores = (rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores))
    ? rawScores
    : null

  return { title, subtitle, output_draft, scores }
}

function extractTune(difyData, tunePayload) {
  const outputs = difyData?.data?.outputs || {}
  const diffText =
    (typeof outputs.diff_text === 'string' && outputs.diff_text) ||
    (typeof outputs.text === 'string' && outputs.text) ||
    (typeof difyData?.answer === 'string' && difyData.answer) ||
    ''

  const output_draft = meltDiffToDraft(diffText)

  let baseline = {}
  let target = {}
  try { baseline = JSON.parse(tunePayload?.inputs?.baseline_scores || '{}') } catch {}
  try { target = JSON.parse(tunePayload?.inputs?.target_params || '{}') } catch {}
  const scores = { ...baseline, ...target }

  return { title: '', subtitle: '', output_draft, scores }
}

// 落库入口：永不抛错，失败仅记录日志，不阻断主生成流程。
export async function persistGeneration({ userId, mode, inputText, difyData, tunePayload }) {
  if (!supabase) {
    console.error('[generations] 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，跳过落库')
    return
  }

  try {
    const extracted = mode === 'tune'
      ? extractTune(difyData, tunePayload)
      : extractGenerate(difyData)

    const { error } = await supabase.from('generations').insert({
      user_id: userId,
      input_text: inputText ?? null,
      title: extracted.title || null,
      subtitle: extracted.subtitle || null,
      output_draft: extracted.output_draft || null,
      scores: extracted.scores || null,
    })

    if (error) console.error('[generations] 落库失败:', error.message)
  } catch (e) {
    console.error('[generations] 落库异常:', e)
  }
}
