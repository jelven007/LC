/**
 * 纯逻辑回归测试（不依赖微信运行时）
 * 运行：在项目根目录执行  node tests/logic.test.js
 *
 * 注意：涉及「今天」的断言必须用 time.todayStr() 动态取值，
 *      不能硬编码日期，否则跨天会误报。
 */

global.wx = { getStorageSync: () => null, setStorageSync: () => {} }

const path = require('path')
const time = require(path.join(__dirname, '../miniprogram/utils/time'))
const model = require(path.join(__dirname, '../miniprogram/utils/model'))
const store = require(path.join(__dirname, '../miniprogram/utils/store'))

let pass = 0
let fail = 0

function ok(name, cond, extra) {
  if (cond) {
    pass++
    console.log('  PASS ' + name)
  } else {
    fail++
    console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : ''))
  }
}

/** 固定基准日，用于不依赖真实今天的计算断言 */
const BASE = '2026-10-17'
/** 真实今天，用于 store 内部取 todayStr 的行为断言 */
const TODAY = time.todayStr()

console.log('--- time 基础 ---')
ok('diffDays', time.diffDays('2026-01-01', '2026-01-31') === 30)
ok('addDays 跨月', time.addDays('2026-01-31', 1) === '2026-02-01')
ok('addMonths 月末夹取', time.addMonths('2026-01-31', 1) === '2026-02-28')
ok('闰年 addYears', time.addYears('2024-02-29', 1) === '2025-02-28')
ok('weekday 周日=7', time.weekday('2026-10-18') === 7)
ok('startOfWeek 为周一', time.weekday(time.startOfWeek(BASE)) === 1)
ok('daysInYear 闰年', time.daysInYear(2024) === 366)
ok('daysInYear 世纪平年', time.daysInYear(2100) === 365)
ok('dayOfYear', time.dayOfYear('2026-02-01') === 32)
ok('endOfQuarter', time.endOfQuarter(BASE) === '2026-12-31')
ok('fmtCN', time.fmtCN(BASE) === '2026年10月17日')

console.log('--- nextFire（五种周期）---')
ok('daily 未完成=今天', model.nextFire({ type: 'daily', time: '09:00', startDate: '2026-01-01', lastDone: '' }, BASE) === BASE)
ok('daily 已完成=明天', model.nextFire({ type: 'daily', time: '09:00', startDate: '2026-01-01', lastDone: BASE }, BASE) === '2026-10-18')
ok('weekly 命中当天', model.nextFire({ type: 'weekly', time: '20:00', startDate: '2026-01-01', weekdays: [6], lastDone: '' }, BASE) === BASE)
ok('weekly 跳过已完成', model.nextFire({ type: 'weekly', time: '20:00', startDate: '2026-01-01', weekdays: [6], lastDone: BASE }, BASE) === '2026-10-24')
ok('monthly 1 号', model.nextFire({ type: 'monthly', time: '10:00', startDate: '2026-01-01', monthDay: 1, lastDone: '' }, BASE) === '2026-11-01')
ok('monthly 31 号夹取到 2 月', model.nextFire({ type: 'monthly', time: '10:00', startDate: '2026-01-01', monthDay: 31, lastDone: '' }, '2027-02-01') === '2027-02-28')
ok('monthly 当天已办顺延次月', model.nextFire({ type: 'monthly', time: '10:00', startDate: '2026-01-01', monthDay: 17, lastDone: BASE }, BASE) === '2026-11-17')
ok('once 未完成', model.nextFire({ type: 'once', date: '2026-10-20', done: false }, BASE) === '2026-10-20')
ok('once 已完成=null', model.nextFire({ type: 'once', date: '2026-10-20', done: true }, BASE) === null)
ok('interval 从 lastDone 起算', model.nextFire({ type: 'interval', time: '19:30', startDate: '2026-01-01', intervalDays: 3, lastDone: BASE }, BASE) === '2026-10-20')
ok('interval 从未办按起点推算', model.nextFire({ type: 'interval', time: '19:30', startDate: '2026-10-10', intervalDays: 3, lastDone: '' }, BASE) === '2026-10-19')
ok('interval 间隔 0 兜底为 1', model.nextFire({ type: 'interval', time: '19:30', startDate: '2026-01-01', intervalDays: 0, lastDone: BASE }, BASE) === '2026-10-18')

console.log('--- stageView ---')
const st = { id: 's1', name: 'T', dimension: 'month', startDate: '2026-10-01', endDate: '2026-10-31', color: '#000', goals: [] }
const sv = model.stageView(st, BASE)
ok('total=31', sv.total === 31, sv.total)
ok('passed=17', sv.passed === 17, sv.passed)
ok('percent=55', sv.percent === 55, sv.percent)
ok('status=active', sv.status === 'active', sv.status)
ok('remainDays=14', sv.remainDays === 14, sv.remainDays)
ok('future=upcoming', model.stageView(Object.assign({}, st, { startDate: '2026-11-01', endDate: '2026-11-30' }), BASE).status === 'upcoming')
ok('past=done', model.stageView(Object.assign({}, st, { startDate: '2026-08-01', endDate: '2026-08-31' }), BASE).status === 'done')
ok('percent 不贴边 100', model.stageView({ id: 'x', name: 'x', startDate: '2026-10-01', endDate: '2026-10-31', goals: [], dimension: 'month' }, '2026-10-02').percent !== 100)
ok('结束日当天 percent=100', model.stageView(st, '2026-10-31').percent === 100)
ok('日期缺失=invalid', model.stageView({ id: 'y', name: 'y', startDate: '', endDate: '', goals: [], dimension: 'month' }, BASE).status === 'invalid')

console.log('--- goalStats ---')
const gs = model.goalStats([
  { level: 'important', done: true },
  { level: 'important', done: false },
  { level: 'minor', done: true }
])
ok('total=3', gs.total === 3)
ok('done=2', gs.done === 2)
ok('percent=67', gs.percent === 67, gs.percent)
ok('levelList 完整', gs.levelList.length === 3)
ok('空目标 percent=0 不除零', model.goalStats([]).percent === 0)

console.log('--- lifeView ---')
const lv = model.lifeView({ birthDate: '2000-10-17', lifeExpectancy: 80 }, BASE)
ok('has=true', lv.has === true)
ok('years=26', lv.years === 26, lv.years)
ok('cells 长度=80', lv.cells.length === 80)
ok('cells 含 i 字段（wx:key 依赖）', typeof lv.cells[0].i === 'number')
ok('当前年 state=1', lv.cells[26].state === 1, lv.cells[26].state)
ok('未来年 state=2', lv.cells[40].state === 2)
ok('未来生日 has=false', model.lifeView({ birthDate: '2030-01-01' }, BASE).has === false)
ok('未填生日 has=false', model.lifeView({ birthDate: '' }, BASE).has === false)
// 0 视为「未设置」，回落默认 80（与 mine.js 的 onExpect 行为一致）
ok('寿命 0 回落默认 80', model.lifeView({ birthDate: '2000-01-01', lifeExpectancy: 0 }, BASE).expectYears === 80)
ok('normalize 收敛上限 150', store.normalize({ settings: { lifeExpectancy: 500 } }).settings.lifeExpectancy === 150)
ok('normalize 收敛下限 1', store.normalize({ settings: { lifeExpectancy: -5 } }).settings.lifeExpectancy === 80)
ok('normalize 保留合法值', store.normalize({ settings: { lifeExpectancy: 90 } }).settings.lifeExpectancy === 90)
ok('normalize 小数取整', store.normalize({ settings: { lifeExpectancy: 80.7 } }).settings.lifeExpectancy === 80)
ok('越界寿命不渲染过多格子', model.lifeView(store.normalize({ settings: { birthDate: '2000-01-01', lifeExpectancy: 999 } }).settings, BASE).cells.length === 150)

console.log('--- demoSpace / demoData ---')
const demo = store.demoData()
ok('示例阶段=4', demo.stages.length === 4, demo.stages.length)
ok('示例提醒=5', demo.reminders.length === 5, demo.reminders.length)
ok('示例阶段含目标', demo.stages[0].goals.length > 0)
ok('store.load 复用 state', store.load() === store.load())

console.log('--- 多租户：v1 -> v2 迁移 ---')
const v1Data = {
  version: 1,
  stages: [{ id: 's1', name: '我的年度计划', dimension: 'year', startDate: '2026-01-01', endDate: '2026-12-31', goals: [{ id: 'g1', title: '考研上岸', level: 'important', done: true, doneAt: '' }] }],
  reminders: [{ id: 'r1', title: '背单词', type: 'daily', time: '07:00' }],
  settings: { birthDate: '2000-05-20', lifeExpectancy: 80, initialized: true }
}
const migrated = store.normalizeRoot(v1Data)
const migSpace = migrated.spaces[migrated.activeUserId]
ok('版本升到 2', migrated.version === 2, migrated.version)
ok('创建默认用户', migrated.users.length === 1)
ok('activeUserId 指向存在的用户', migrated.activeUserId === migrated.users[0].id)
ok('阶段未丢失', migSpace.stages.length === 1)
ok('阶段名未丢失', migSpace.stages[0].name === '我的年度计划')
ok('目标未丢失', migSpace.stages[0].goals[0].title === '考研上岸')
ok('目标完成态保留', migSpace.stages[0].goals[0].done === true)
ok('提醒未丢失', migSpace.reminders[0].title === '背单词')
ok('设置未丢失', migSpace.settings.birthDate === '2000-05-20')
ok('迁移后结构已归一化', migSpace.stages[0].color !== undefined)

console.log('--- 多租户：隔离与脏数据 ---')
const two = {
  version: 2,
  activeUserId: 'u_a',
  users: [{ id: 'u_a', nickname: '阿强', avatarText: '强', createdAt: 1 }, { id: 'u_b', nickname: '小美', avatarText: '美', createdAt: 2 }],
  spaces: {
    u_a: { stages: [{ id: 's1', name: '阿强的目标', goals: [] }], reminders: [], settings: {} },
    u_b: { stages: [{ id: 's2', name: '小美的目标', goals: [] }], reminders: [], settings: {} }
  }
}
const nr = store.normalizeRoot(two)
ok('两个用户都在', nr.users.length === 2)
ok('空间互不串数据', nr.spaces.u_a.stages[0].name === '阿强的目标' && nr.spaces.u_b.stages[0].name === '小美的目标')
ok('activeUserId 正确', nr.activeUserId === 'u_a')
ok('无效 activeUserId 回落首个', store.normalizeRoot({ activeUserId: 'ghost', users: [{ id: 'u1', nickname: 'A' }], spaces: { u1: { stages: [], reminders: [], settings: {} } } }).activeUserId === 'u1')
ok('重复用户 id 去重', store.normalizeRoot({ activeUserId: 'u1', users: [{ id: 'u1', nickname: 'A' }, { id: 'u1', nickname: 'B' }], spaces: {} }).users.length === 1)
ok('缺失空间自动补齐', store.normalizeRoot({ activeUserId: 'u1', users: [{ id: 'u1', nickname: 'A' }], spaces: {} }).spaces.u1.stages.length === 0)
ok('normalizeRoot(null) 安全', store.normalizeRoot(null).users.length === 1)
ok('normalizeRoot(字符串) 安全', store.normalizeRoot('bad').users.length === 1)
ok('spaceStats 统计目标数', store.spaceStats ? store.spaceStats('__none__').stageCount === 0 : true)

console.log('--- 多租户：导入导出 ---')
const exported = store.exportAll()
ok('导出是合法 JSON', (function () { try { JSON.parse(exported); return true } catch (e) { return false } })())
ok('导出含 users', JSON.parse(exported).users.length >= 1)
ok('probeImport 识别多账户备份', store.probeImport(exported).scope === 'all')
const spaceOnly = JSON.stringify({ stages: [{ id: 'x', name: 'n', goals: [] }], reminders: [] })
ok('probeImport 识别单账户备份', store.probeImport(spaceOnly).scope === 'current')
ok('probeImport 拒绝乱字符串', store.probeImport('not json').ok === false)
ok('probeImport 拒绝无关 JSON', store.probeImport('{"a":1}').ok === false)
// probeImport 绝不能改动数据
const before = store.exportAll()
store.probeImport(exported)
ok('probeImport 不改动数据', store.exportAll() === before)
ok('导入多账户备份生效', store.importData(exported).ok === true)
ok('导入单账户备份生效', store.importData(spaceOnly).ok === true)

console.log('--- 多租户：用户操作 ---')
store.importData(JSON.stringify(two))
ok('active 为 u_a', store.activeUser().id === 'u_a', store.activeUser().id)
ok('切换用户生效', store.switchUser('u_b').id === 'u_b')
ok('切换后读到对方数据', store.load().stages[0].name === '小美的目标', store.load().stages[0].name)
ok('切回后读到自己数据', (function () { store.switchUser('u_a'); return store.load().stages[0].name === '阿强的目标' })())
const created = store.createUser('临时用户')
ok('新建用户后自动切换', store.activeUser().id === created.id)
ok('新用户空间为空', store.load().stages.length === 0)
ok('用户列表含新用户', store.listUsers().length === 3)
ok('删除用户成功', store.removeUser(created.id) === true)
ok('删除后列表减少', store.listUsers().length === 2)
ok('重命名生效', store.renameUser('u_a', '改名了').nickname === '改名了')
ok('重命名空名被忽略', store.renameUser('u_a', '   ').nickname === '改名了')
store.renameUser('u_a', '阿强')
// 至少保留一个用户
while (store.listUsers().length > 1) {
  store.removeUser(store.listUsers()[store.listUsers().length - 1].id)
}
ok('最后一个用户无法删除', store.removeUser(store.listUsers()[0].id) === false)
ok('删除后仍有活跃用户', !!store.activeUser())

console.log('--- reviewData ---')
const rv = model.reviewData(demo, BASE, 30)
ok('trend 长度=30', rv.trend.length === 30, rv.trend.length)
ok('trend 末日=基准日', rv.trend[29].date === BASE, rv.trend[29].date)
ok('overview 目标总数>0', rv.overview.goalTotal > 0, rv.overview.goalTotal)
ok('goalPercent 合理', rv.overview.goalPercent >= 0 && rv.overview.goalPercent <= 100)
ok('rank 按完成率降序', rv.rank[0].percent >= rv.rank[rv.rank.length - 1].percent)
ok('timeline 按开始日升序', time.dayNum(rv.timeline[0].startDate) <= time.dayNum(rv.timeline[rv.timeline.length - 1].startDate))
ok('hasData=true', rv.hasData === true)
ok('90 天区间 trend=90', model.reviewData(demo, BASE, 90).trend.length === 90)
ok('7 天区间 trend=7', model.reviewData(demo, BASE, 7).trend.length === 7)
const rvEmpty = model.reviewData({ stages: [], reminders: [] }, BASE, 30)
ok('空数据 hasData=false', rvEmpty.hasData === false)
ok('空数据 percent=0 不除零', rvEmpty.overview.goalPercent === 0)
ok('空数据 trend 仍为 30 天', rvEmpty.trend.length === 30)

console.log('--- toggle 逻辑（用真实今天）---')
store.replace(store.demoData())
const rid = store.load().reminders[1].id
store.toggleReminderDone(rid)
ok('toggle 后 lastDone=今天', store.findReminder(rid).lastDone === TODAY, store.findReminder(rid).lastDone)
store.toggleReminderDone(rid)
ok('再次 toggle 撤销', store.findReminder(rid).lastDone === '', store.findReminder(rid).lastDone)

const sid = store.load().stages[0].id
const gid = store.load().stages[0].goals[0].id
store.toggleGoal(sid, gid)
ok('目标打勾', store.findStage(sid).goals[0].done === true)
ok('打勾写入 doneAt=今天', store.findStage(sid).goals[0].doneAt === TODAY, store.findStage(sid).goals[0].doneAt)
store.toggleGoal(sid, gid)
ok('取消打勾清空 doneAt', store.findStage(sid).goals[0].doneAt === '')
store.toggleGoal('不存在的阶段', gid)
ok('toggle 不存在的阶段不崩', true)

console.log('--- 脏数据归一化 ---')
const dirty = store.normalize({ stages: [{ name: 123, dimension: '不存在的维度', goals: [{}] }], reminders: [{ type: '乱写', weekdays: 'x' }], settings: null })
ok('脏 dimension 回落 year', dirty.stages[0].dimension === 'year')
ok('脏 goals 补全 level', typeof dirty.stages[0].goals[0].level === 'string')
ok('脏 type 回落 daily', dirty.reminders[0].type === 'daily')
ok('脏 weekdays 兜底为数组', Array.isArray(dirty.reminders[0].weekdays) && dirty.reminders[0].weekdays.length > 0)
ok('settings 兜底', dirty.settings && typeof dirty.settings.lifeExpectancy === 'number')
ok('normalize(null) 不崩', store.normalize(null).stages.length === 0)
ok('normalize(字符串) 不崩', store.normalize('bad').stages.length === 0)
ok('cycle 往返不丢数据', (function () {
  const a = store.normalize(store.demoData())
  const b = store.normalize(JSON.parse(JSON.stringify(a)))
  return b.stages.length === a.stages.length && b.reminders.length === a.reminders.length
})())

console.log('--- 批量视图函数 ---')
ok('stageViews 长度一致', model.stageViews(demo.stages, BASE).length === demo.stages.length)
ok('reminderViews 长度一致', model.reminderViews(demo.reminders, BASE, demo.stages).length === demo.reminders.length)
ok('stageViews 空数组安全', model.stageViews([], BASE).length === 0)
ok('reminderViews null 安全', model.reminderViews(null, BASE, []).length === 0)

console.log('--- 微信绑定：本地数据迁移 ---')
// 构造：本地用户有内容，首次绑定 openid
store.replace(store.demoData())
const localStageCount = store.load().stages.length
const localUpdatedAt = store.load()._updatedAt
const bound = store.ensureWechatUser('openid_test_1')
ok('绑定后切换到微信用户', store.activeUser().id === bound.id)
ok('微信用户带 openid', bound.openid === 'openid_test_1')
ok('本地数据迁入微信用户', store.load().stages.length === localStageCount, store.load().stages.length)
ok('迁移保留 _updatedAt', store.load()._updatedAt === localUpdatedAt)
ok('旧本地用户数据仍在', store.listUsers().length === 2)

// 重复绑定同一 openid：不新建用户、不重复迁移
const snapshotBefore = store.exportAll()
store.ensureWechatUser('openid_test_1')
ok('重复绑定不新建用户', store.listUsers().length === 2, store.listUsers().length)
ok('重复绑定不重复迁移', store.load().stages.length === localStageCount)

// 空本地数据：微信用户空间为空，不制造假数据
store.switchUser(store.listUsers().filter(function (u) { return u.openid !== 'openid_test_1' })[0].id)
store.reset()
const bound2 = store.ensureWechatUser('openid_test_2')
ok('空数据绑定得空空间', store.load().stages.length === 0 && store.load().reminders.length === 0)

// 已绑定过的 openid 再次登录（换设备场景）：直接切回，不动数据
store.ensureWechatUser('openid_test_1')
ok('再次登录回到微信用户', store.activeUser().id === bound.id)
ok('再次登录数据完好', store.load().stages.length === localStageCount)

console.log('--- 示例数据标记（防云端覆盖）---')
// 首装（无本地存储）应标记为示例数据
;(function () {
  delete require.cache[require.resolve(path.join(__dirname, '../miniprogram/utils/store'))]
  const s2 = require(path.join(__dirname, '../miniprogram/utils/store'))
  s2.load()
  ok('首装空间标记 _demo=true', s2.load()._demo === true, s2.load()._demo)
  s2.update(function (d) { d.settings.birthDate = '1990-01-01' })
  ok('用户改动后 _demo 清除', s2.load()._demo === false, s2.load()._demo)
  s2.replace(s2.demoData())
  ok('载入示例后 _demo=true', s2.load()._demo === true, s2.load()._demo)
})()

// 示例数据不参与云端竞争：归一化后 _demo 应保留
ok('normSpace 保留 _demo', store.normSpace({ stages: [], reminders: [], _demo: true })._demo === true)
ok('normSpace 默认为 false', store.normSpace({ stages: [], reminders: [] })._demo === false)

console.log('--- lifeView 边界：超出预期寿命 ---')
const overLife = model.lifeView({ birthDate: '1900-01-01', lifeExpectancy: 80 }, BASE)
ok('超期 years 合理', overLife.years > 80, overLife.years)
ok('pastYears 收敛到 expectYears', overLife.pastYears === 80, overLife.pastYears)
ok('futureYears 不为负', overLife.futureYears === 0, overLife.futureYears)
ok('overExpect 标记为真', overLife.overExpect === true)
const normalLife = model.lifeView({ birthDate: '2000-01-01', lifeExpectancy: 80 }, BASE)
ok('正常情况 pastYears+1+futureYears=expectYears', normalLife.pastYears + 1 + normalLife.futureYears === 80, [normalLife.pastYears, normalLife.futureYears])
ok('正常情况不标记超期', normalLife.overExpect === false)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
