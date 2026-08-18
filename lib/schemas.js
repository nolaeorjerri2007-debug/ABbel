import { z } from 'zod'

// 超长文本炸弹（防线二 · 隐患 1）：几十万字的《三国演义》直接拦截。
// input_text 同时承载「首次原始粘贴」与「长文底稿二次追加」，统一上限：
// 底稿 ≤2000 + 追加指令 ≤500 + 包装词 ≈19 ≈2519，取 2600 留余量。
const MAX_TEXT = 2600

// 底稿是引擎的生成产物（可为深度长文），单独放宽到 2000，避免二次微调被误伤
const MAX_DRAFT_TEXT = 2000

// 所有调音参数必须是 0~1 之间的数值（防线二 · 隐患 2）：防止 9999 / 负数击穿引擎
const scoreRecord = z.record(z.string(), z.number().min(0).max(1))

// target_params / baseline_scores 是 JSON 字符串，先解析再逐个校验数值
const jsonScoreRecord = z.string().refine(
  (s) => {
    try {
      scoreRecord.parse(JSON.parse(s))
      return true
    } catch {
      return false
    }
  },
  '调音参数越界或格式错误'
)

export const generateSchema = z.object({
  inputs: z.object({
    input_text: z.string().min(1, '文案不能为空').max(MAX_TEXT, `文案长度不能超过 ${MAX_TEXT} 字符`)
  }),
  response_mode: z.literal('blocking'),
  user: z.string().max(100)
})

export const tuneSchema = z.object({
  inputs: z.object({
    original_text: z.string().min(1, '底稿不能为空').max(MAX_DRAFT_TEXT, `底稿长度不能超过 ${MAX_DRAFT_TEXT} 字符`),
    target_params: jsonScoreRecord,
    baseline_scores: jsonScoreRecord,
    changed_count: z.number().int().min(0).max(20),
    is_valid_input: z.enum(['true', 'false']),
    priority_order: z.string()
  }),
  response_mode: z.literal('blocking'),
  user: z.string().max(100)
})
