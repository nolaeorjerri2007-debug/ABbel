import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

// ============ 测试基建 ============
// 内存版 localStorage，隔离真实浏览器存储
function makeLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

// 可配置的 data.js 模拟：每个用例可控制云端模板、写入结果与失败注入
const db = {
  cloud: [],       // listTemplates 返回的云端模板
  created: [],     // createTemplate 实际收到的模板（用于断言）
  failOn: null,    // 命中该 name 时 createTemplate 抛错
  listFails: false,// listTemplates 是否抛错（模拟云端超时）
}

mock.module('../src/lib/data.js', {
  exports: {
    listTemplates: async () => {
      if (db.listFails) throw new Error('模拟云端超时')
      return db.cloud
    },
    createTemplate: async (tpl) => {
      if (db.failOn && tpl.name === db.failOn) throw new Error('模拟网络失败')
      db.created.push(tpl)
      return { id: db.created.length, ...tpl }
    },
  },
})

const { migrateLegacyTemplates, readLegacyTemplates } = await import('../src/lib/migration.js')

function resetDb() {
  db.cloud = []
  db.created = []
  db.failOn = null
  db.listFails = false
}

test('遗留模板迁移 migrateLegacyTemplates', async (t) => {
  t.beforeEach(() => {
    globalThis.localStorage = makeLocalStorage()
    resetDb()
  })

  await t.test('同名去重 + 填空槽', async () => {
    localStorage.setItem('abbel_templates', JSON.stringify([
      { id: '1', name: 'B', scores: { intimacy: 0.5 } },
      { id: '2', name: 'A', scores: { intimacy: 0.9 } }, // 与云端重名 → 跳过
      { id: '3', name: 'C', scores: { intimacy: 0.2 } },
    ]))
    db.cloud = [{ id: 1, name: 'A', scores: {} }]

    const { migrated, overflow } = await migrateLegacyTemplates()

    assert.equal(migrated, 2)
    assert.equal(overflow, 0)
    assert.deepEqual(db.created.map((c) => c.name), ['B', 'C'])
    assert.equal(localStorage.getItem('abbel_templates'), null) // 主 key 已清
    assert.equal(localStorage.getItem('abbel_migration_running'), null) // 锁已释放
  })

  await t.test('超限 → 剩余写入冷宫备份', async () => {
    localStorage.setItem('abbel_templates', JSON.stringify(
      ['B', 'C', 'D', 'E', 'F'].map((name, i) => ({ id: String(i), name, scores: { intimacy: 0.5 } }))
    ))
    db.cloud = ['A1', 'A2', 'A3'].map((name, i) => ({ id: i + 1, name, scores: {} })) // 3 个，只剩 1 槽

    const { migrated, overflow } = await migrateLegacyTemplates()

    assert.equal(migrated, 1)
    assert.equal(overflow, 4)
    assert.deepEqual(db.created.map((c) => c.name), ['B'])

    const backup = JSON.parse(localStorage.getItem('abbel_templates_overflow'))
    assert.equal(backup.length, 4)
    assert.deepEqual(backup.map((x) => x.name), ['C', 'D', 'E', 'F'])
    assert.equal(localStorage.getItem('abbel_templates'), null) // 主 key 已斩断
  })

  await t.test('中途失败 → 失败项与未迁项归冷宫', async () => {
    localStorage.setItem('abbel_templates', JSON.stringify(
      ['B', 'C', 'D'].map((name, i) => ({ id: String(i), name, scores: {} }))
    ))
    db.failOn = 'C'

    const { migrated, overflow } = await migrateLegacyTemplates()

    assert.equal(migrated, 1) // B 成功
    assert.equal(overflow, 2) // C（失败）+ D（未尝试）
    const backup = JSON.parse(localStorage.getItem('abbel_templates_overflow'))
    assert.deepEqual(backup.map((x) => x.name), ['C', 'D'])
  })

  await t.test('listTemplates 超时 → 保留主 key 并抛错（下次续传）', async () => {
    localStorage.setItem('abbel_templates', JSON.stringify([{ id: '1', name: 'B', scores: {} }]))
    db.listFails = true

    await assert.rejects(migrateLegacyTemplates(), /模拟云端超时/)
    assert.notEqual(localStorage.getItem('abbel_templates'), null) // 主 key 保留，不丢数据
    assert.equal(localStorage.getItem('abbel_migration_running'), null) // 锁已释放
  })

  await t.test('本地内部重名去重', async () => {
    localStorage.setItem('abbel_templates', JSON.stringify([
      { id: '1', name: 'X', scores: {} },
      { id: '2', name: 'X', scores: {} }, // 本地重复名 → 跳过
      { id: '3', name: 'Y', scores: {} },
    ]))

    const { migrated, overflow } = await migrateLegacyTemplates()

    assert.equal(migrated, 2)
    assert.equal(overflow, 0)
    assert.deepEqual(db.created.map((c) => c.name), ['X', 'Y'])
  })

  await t.test('scores 清洗：字符串转数值、脏键剔除', async () => {
    localStorage.setItem('abbel_templates', JSON.stringify([
      { id: '1', name: 'B', scores: { intimacy: '0.5', junk: 'abc', title: 'x', real: 0.3 } },
    ]))

    const { migrated } = await migrateLegacyTemplates()

    assert.equal(migrated, 1)
    assert.deepEqual(db.created[0].scores, { intimacy: 0.5, real: 0.3 })
  })

  await t.test('解析失败 → 安全返回，不抛错', async () => {
    localStorage.setItem('abbel_templates', '{invalid json')
    const { migrated, overflow } = await migrateLegacyTemplates()
    assert.equal(migrated, 0)
    assert.equal(overflow, 0)
  })

  await t.test('无遗留数据 → 静默返回，无 Toast 语义', async () => {
    const { migrated, overflow } = await migrateLegacyTemplates()
    assert.equal(migrated, 0)
    assert.equal(overflow, 0)
  })
})

test('readLegacyTemplates 边界', async () => {
  globalThis.localStorage = makeLocalStorage()

  assert.deepEqual(readLegacyTemplates(), []) // 无 key

  localStorage.setItem('abbel_templates', JSON.stringify([{ name: 'A', scores: {} }]))
  assert.equal(readLegacyTemplates().length, 1)

  localStorage.setItem('abbel_templates', 'not-an-array')
  assert.deepEqual(readLegacyTemplates(), [])
})
