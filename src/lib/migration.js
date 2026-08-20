import { listTemplates, createTemplate } from './data.js'

// ============ 遗留数据平滑过渡 ============
// 老版本把模板存在 localStorage.abbel_templates（形如 [{ id, name, scores }]）。
// 登录后静默迁移到云端 templates 表，同名去重 + 填空槽，超限部分备份到「冷宫」。

const LEGACY_KEY = 'abbel_templates'
const OVERFLOW_KEY = 'abbel_templates_overflow'
const LOCK_KEY = 'abbel_migration_running'
const LOCK_TTL = 60000 // 迁移锁有效期：超过 60s 视为陈旧锁，自动接管
const MAX_SLOTS = 4

// 读取遗留本地模板，解析失败安全返回 []
export function readLegacyTemplates() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('[migration] 遗留模板解析失败，跳过', e)
    return []
  }
}

// 只保留数值键，剔除 name/title 等字符串脏数据
function sanitizeScores(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {}
  const out = {}
  for (const [k, v] of Object.entries(candidate)) {
    const n = Number(v)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

function isValidTemplate(t) {
  return t && typeof t === 'object' && typeof t.name === 'string' && t.name.trim().length > 0
}

// 迁移锁：防止多标签页并发重复上传；用时间戳避免页面中途关闭留下死锁
function tryAcquireLock() {
  const now = Date.now()
  const held = Number(localStorage.getItem(LOCK_KEY) || 0)
  if (held && now - held < LOCK_TTL) return false
  localStorage.setItem(LOCK_KEY, String(now))
  return true
}

// 返回 { migrated, overflow }：migrated=成功上传数，overflow=暂存冷宫数
export async function migrateLegacyTemplates() {
  if (!tryAcquireLock()) return { migrated: 0, overflow: 0 }

  try {
    const legacy = readLegacyTemplates()
    if (legacy.length === 0) {
      localStorage.removeItem(LOCK_KEY)
      return { migrated: 0, overflow: 0 }
    }

    const cloud = (await listTemplates()) || []
    const cloudNames = new Set(cloud.map((t) => t.name))
    const remaining = Math.max(0, MAX_SLOTS - cloud.length)

    // 同名去重（含本地内部重名）
    const queue = []
    for (const t of legacy) {
      if (!isValidTemplate(t)) continue
      const name = t.name.trim()
      if (cloudNames.has(name)) continue
      cloudNames.add(name)
      queue.push({ name, scores: sanitizeScores(t.scores) })
    }

    const toUpload = queue.slice(0, remaining)
    const overflow = queue.slice(remaining)

    let migrated = 0
    for (let i = 0; i < toUpload.length; i++) {
      const t = toUpload[i]
      try {
        await createTemplate({ name: t.name, scores: t.scores })
        migrated++
      } catch (e) {
        // 本条 + 后续未迁的，全部归入冷宫，停止上传
        overflow.unshift(...toUpload.slice(i))
        break
      }
    }

    // 冷宫备份：超限 / 失败未迁的模板不丢失
    if (overflow.length > 0) {
      localStorage.setItem(OVERFLOW_KEY, JSON.stringify(overflow))
    }

    // 安全斩断：清除主 key，避免每次登录重复弹窗
    localStorage.removeItem(LEGACY_KEY)
    localStorage.removeItem(LOCK_KEY)

    return { migrated, overflow: overflow.length }
  } catch (e) {
    // 整体失败（如 listTemplates 超时）：保留主 key，下次登录续传
    localStorage.removeItem(LOCK_KEY)
    throw e
  }
}
