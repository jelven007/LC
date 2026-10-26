const time = require('./time')
const C = require('./constants')
const cloud = require('./cloud')

const KEY = 'lc_data_v1'
const VERSION = 2
const MIN_EXPECT = 1
const MAX_EXPECT = 150

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/* ---------- 默认值 ---------- */

function defaultSettings() {
  return { birthDate: '', lifeExpectancy: 80, initialized: false }
}

function emptySpace() {
  return { stages: [], reminders: [], settings: defaultSettings() }
}

function defaultUser(nickname) {
  const name = String(nickname || '').trim()
  return {
    id: uid('u'),
    nickname: name || '本机用户',
    avatarText: name ? name.slice(0, 1) : '本',
    createdAt: Date.now()
  }
}

/* ---------- 归一化 ---------- */

function normGoal(g) {
  const raw = g || {}
  return {
    id: raw.id || uid('g'),
    title: String(raw.title || ''),
    level: C.LEVEL_LABEL[raw.level] ? raw.level : 'normal',
    done: !!raw.done,
    doneAt: raw.doneAt || ''
  }
}

function normStage(s) {
  const raw = s || {}
  return {
    id: raw.id || uid('s'),
    name: String(raw.name || '未命名阶段'),
    desc: String(raw.desc || ''),
    dimension: C.DIMENSION_LABEL[raw.dimension] ? raw.dimension : 'year',
    startDate: raw.startDate || '',
    endDate: raw.endDate || '',
    color: raw.color || C.COLORS[0],
    createdAt: raw.createdAt || Date.now(),
    goals: (Array.isArray(raw.goals) ? raw.goals : []).map(normGoal)
  }
}

function normReminder(r) {
  const raw = r || {}
  return {
    id: raw.id || uid('r'),
    title: String(raw.title || '未命名提醒'),
    type: C.REMINDER_TYPE_LABEL[raw.type] ? raw.type : 'daily',
    time: raw.time || '09:00',
    date: raw.date || '',
    startDate: raw.startDate || '',
    weekdays: Array.isArray(raw.weekdays) && raw.weekdays.length ? raw.weekdays : [time.weekday(time.todayStr())],
    monthDay: Number(raw.monthDay) || 1,
    intervalDays: Number(raw.intervalDays) || 1,
    linkType: ['none', 'stage', 'goal'].indexOf(raw.linkType) > -1 ? raw.linkType : 'none',
    linkStageId: raw.linkStageId || '',
    linkGoalId: raw.linkGoalId || '',
    note: String(raw.note || ''),
    enabled: raw.enabled === undefined ? true : !!raw.enabled,
    done: !!raw.done,
    doneAt: raw.doneAt || '',
    lastDone: raw.lastDone || '',
    prevLastDone: raw.prevLastDone || '',
    createdAt: raw.createdAt || Date.now()
  }
}

/** 预期年限收敛：导入的外部备份可能带越界值，不收敛会渲染过多格子导致卡顿 */
function normExpectancy(v) {
  const n = Number(v)
  const base = n >= MIN_EXPECT ? Math.floor(n) : 80
  return Math.min(Math.max(base, MIN_EXPECT), MAX_EXPECT)
}

function normSpace(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const settings = Object.assign(defaultSettings(), d.settings || {})
  settings.lifeExpectancy = normExpectancy(settings.lifeExpectancy)
  return {
    stages: (Array.isArray(d.stages) ? d.stages : []).map(normStage),
    reminders: (Array.isArray(d.reminders) ? d.reminders : []).map(normReminder),
    settings: settings,
    // 是否为「首装示例数据」。用于首次绑定微信时判断本机数据是否值得上传，
    // 避免把示例数据推到云端覆盖用户的真实数据。
    _demo: !!d._demo,
    _updatedAt: Number(d._updatedAt) || 0
  }
}

function normUser(u) {
  const raw = u || {}
  const nickname = String(raw.nickname || '').trim()
  return {
    id: raw.id || uid('u'),
    nickname: nickname || '本机用户',
    avatarText: String(raw.avatarText || '') || (nickname ? nickname.slice(0, 1) : '本'),
    openid: String(raw.openid || ''),
    createdAt: Number(raw.createdAt) || Date.now()
  }
}

/**
 * 根数据归一化，同时承担 v1 → v2 迁移。
 * v1 是「一个用户一份数据」的扁平结构（直接含 stages/reminders），
 * 迁移时把原数据整体搬进一个默认用户的空间，保证老用户升级不丢数据。
 */
function normalizeRoot(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}

  const isLegacy = !Array.isArray(d.users) && (Array.isArray(d.stages) || Array.isArray(d.reminders))
  if (isLegacy) {
    const u = defaultUser()
    const spaces = {}
    spaces[u.id] = normSpace({ stages: d.stages, reminders: d.reminders, settings: d.settings })
    return { version: VERSION, activeUserId: u.id, users: [u], spaces: spaces }
  }

  let users = (Array.isArray(d.users) ? d.users : []).map(normUser)
  if (!users.length) users = [defaultUser()]
  // 去重，防止脏数据里重复 id 导致空间错配
  const seen = {}
  users = users.filter(function (u) {
    if (seen[u.id]) return false
    seen[u.id] = true
    return true
  })

  const spaces = {}
  users.forEach(function (u) {
    spaces[u.id] = normSpace(d.spaces && d.spaces[u.id])
  })

  const hasActive = users.filter(function (u) {
    return u.id === d.activeUserId
  }).length
  return {
    version: VERSION,
    activeUserId: hasActive ? d.activeUserId : users[0].id,
    users: users,
    spaces: spaces
  }
}

/** 供外部导入单个空间时使用，保持原有导出名 */
function normalize(raw) {
  return normSpace(raw)
}

function defaultData() {
  return { version: VERSION, stages: [], reminders: [], settings: defaultSettings() }
}

/* ---------- 根状态 ---------- */

let root = null
const listeners = []

function loadRoot() {
  if (root) return root
  let obj = null
  try {
    const raw = wx.getStorageSync(KEY)
    if (raw) obj = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    obj = null
  }
  root = normalizeRoot(obj)
  // 首次安装：给默认用户灌入示例数据（标记 _demo，避免日后被误推到云端）
  if (!obj) {
    root.spaces[root.users[0].id] = demoSpace()
    root.spaces[root.users[0].id]._demo = true
    root.spaces[root.users[0].id].settings.initialized = true
    save()
  }
  return root
}

function save() {
  try {
    wx.setStorageSync(KEY, root)
  } catch (e) {
    /* ignore */
  }
}

/* ---------- 云端同步（本地优先：页面始终同步读本地） ---------- */

const SYNC_DELAY = 2000
let syncing = false
let syncTimer = null

function canSync() {
  const r = loadRoot()
  const u = r.users.filter(function (x) {
    return x.id === r.activeUserId
  })[0]
  return cloud.available() && cloud.isLogin() && !!(u && u.openid)
}

function pushToCloud() {
  if (!canSync()) return Promise.resolve(false)
  const s = space()
  const payload = {
    stages: s.stages,
    reminders: s.reminders,
    settings: s.settings,
    _updatedAt: s._updatedAt
  }
  return cloud
    .push(payload)
    .then(function () {
      return true
    })
    .catch(function () {
      return false
    })
}

function scheduleSync() {
  if (!canSync()) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(function () {
    syncTimer = null
    pushToCloud()
  }, SYNC_DELAY)
}

/** 页面退出时立即落云，不等防抖 */
function flushSync() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
    return pushToCloud()
  }
  return Promise.resolve(false)
}

/** 把云端数据写入当前空间。绕开 commit，避免写入动作反过来触发推送 */
function applyCloud(payload) {
  const r = loadRoot()
  syncing = true
  r.spaces[r.activeUserId] = normSpace(payload)
  save()
  syncing = false
  listeners.slice().forEach(function (fn) {
    try {
      fn(space())
    } catch (e) {
      /* ignore */
    }
  })
}

/**
 * 登录后按 _updatedAt 双向择优：谁新用谁，相等不动。
 *
 * 例外（首次绑定微信）：本机空间刚被迁到微信用户名下，此时**只靠时间戳不安全**。
 * 若这台设备是新装的，用户随手填了个出生日期就让本机时间戳变「新」，
 * 按时间戳会把示例/半成品数据推上去，覆盖云端真实数据。
 * 因此首次绑定时改用**内容量比较**（阶段数 + 提醒数，加出生日期权重）：
 * 本机内容明显更多才保留本机，否则以云端为准。两侧都不会被误删。
 */
function spaceWeight(s) {
  if (!s) return 0
  // 示例数据权重记为 0：它只是给用户看的样板，绝不能压过云端真实数据
  if (s._demo) return 0
  const stages = (s.stages || []).length
  const reminders = (s.reminders || []).length
  const birth = s.settings && s.settings.birthDate ? 1 : 0
  return stages + reminders + birth
}

function syncWithCloud() {
  if (!cloud.available() || !cloud.isLogin()) {
    return Promise.resolve({ ok: false, reason: 'not_login' })
  }
  return cloud
    .pull()
    .then(function (res) {
      const r = loadRoot()
      const s = space()
      const cloudAt = res.found && res.payload ? res.payload._updatedAt || 0 : 0
      const localAt = s._updatedAt || 0
      const isFirstBind = r._firstBind === r.activeUserId
      r._firstBind = ''

      // 首次绑定且云端已有数据：按内容量决定，避免本机示例覆盖云端真实数据
      if (res.found && isFirstBind) {
        if (spaceWeight(s) > spaceWeight(res.payload)) {
          return pushToCloud().then(function (pushed) {
            return { ok: true, direction: pushed ? 'up' : 'up_failed' }
          })
        }
        applyCloud(res.payload)
        return { ok: true, direction: 'down' }
      }

      if (res.found && cloudAt > localAt) {
        applyCloud(res.payload)
        return { ok: true, direction: 'down' }
      }
      // 云端为空 → 无论时间戳都上传（首次上传）；云端更旧 → 上传本机
      if (!res.found || cloudAt < localAt) {
        return pushToCloud().then(function (pushed) {
          return { ok: true, direction: pushed ? 'up' : 'up_failed' }
        })
      }
      return { ok: true, direction: 'none' }
    })
    .catch(function (e) {
      return { ok: false, reason: (e && e.code) || 'error' }
    })
}

/** 空间是否有实际内容（决定首次绑定时是否值得把本地数据迁给微信用户） */
function hasContent(s) {
  return !!s && ((s.stages && s.stages.length) || (s.reminders && s.reminders.length) || !!(s.settings && s.settings.birthDate))
}

/**
 * 绑定微信身份到本地用户（一个 openid 对应一个本地用户）。
 *
 * 首次绑定会把当前本地空间原样迁到微信用户名下，并打上 _firstBind 标记；
 * 随后的 syncWithCloud 会据此以云端为准（详见该函数注释），
 * 避免本机的示例数据反过来覆盖云端真实数据。
 */
function ensureWechatUser(openid, nickname) {
  const r = loadRoot()
  let u = r.users.filter(function (x) {
    return x.openid === openid
  })[0]
  if (!u) {
    u = defaultUser(nickname || '微信用户')
    u.openid = openid
    r.users.push(u)
    // 把当前正在使用的本地数据迁到微信用户名下，否则登录后界面切到空白，
    // 用户会以为数据丢了（数据其实还在旧用户名下）。
    const prev = r.spaces[r.activeUserId]
    r.spaces[u.id] = hasContent(prev) ? normSpace(prev) : emptySpace()
    r._firstBind = u.id
  }
  r.activeUserId = u.id
  save()
  return u
}

function commit() {
  const s = space()
  s._updatedAt = Date.now()
  save()
  if (!syncing) scheduleSync()
  listeners.slice().forEach(function (fn) {
    try {
      fn(space())
    } catch (e) {
      /* ignore */
    }
  })
}

/** 当前活跃用户的空间（对外契约与旧的 load() 完全一致） */
function space() {
  const r = loadRoot()
  return r.spaces[r.activeUserId]
}

function load() {
  return space()
}

function on(fn) {
  listeners.push(fn)
  return function off() {
    const i = listeners.indexOf(fn)
    if (i > -1) listeners.splice(i, 1)
  }
}

/** 用户在空间里做了真实改动：这份数据不再算「示例」 */
function markDirty() {
  const s = space()
  if (s._demo) s._demo = false
}

function update(fn) {
  const s = space()
  fn(s)
  markDirty()
  commit()
  return s
}

/** 清空当前用户空间（不影响其他用户） */
function reset() {
  const r = loadRoot()
  const s = emptySpace()
  s.settings.initialized = true
  r.spaces[r.activeUserId] = s
  commit()
  return space()
}

/** 替换当前用户空间 */
function replace(raw) {
  const r = loadRoot()
  r.spaces[r.activeUserId] = normSpace(raw)
  commit()
  return space()
}

/* ---------- 用户管理（多租户） ---------- */

function listUsers() {
  return loadRoot().users.slice()
}

function activeUser() {
  const r = loadRoot()
  return (
    r.users.filter(function (u) {
      return u.id === r.activeUserId
    })[0] || r.users[0]
  )
}

function createUser(nickname) {
  const r = loadRoot()
  const u = defaultUser(nickname)
  r.users.push(u)
  r.spaces[u.id] = emptySpace()
  r.activeUserId = u.id
  commit()
  return u
}

function switchUser(id) {
  const r = loadRoot()
  if (!r.spaces[id]) return activeUser()
  r.activeUserId = id
  commit()
  return activeUser()
}

/** 删除用户，至少保留一个 */
function removeUser(id) {
  const r = loadRoot()
  if (r.users.length <= 1) return false
  if (!r.spaces[id]) return false
  r.users = r.users.filter(function (u) {
    return u.id !== id
  })
  delete r.spaces[id]
  if (r.activeUserId === id) r.activeUserId = r.users[0].id
  commit()
  return true
}

function renameUser(id, nickname) {
  const r = loadRoot()
  const name = String(nickname || '').trim()
  if (!name) return activeUser()
  r.users.forEach(function (u) {
    if (u.id === id) {
      u.nickname = name
      u.avatarText = name.slice(0, 1)
    }
  })
  commit()
  return activeUser()
}

/** 某个用户的数据规模，用于账户列表展示 */
function spaceStats(id) {
  const r = loadRoot()
  const s = r.spaces[id]
  if (!s) return { stageCount: 0, reminderCount: 0, goalCount: 0 }
  let goalCount = 0
  s.stages.forEach(function (st) {
    goalCount += st.goals.length
  })
  return { stageCount: s.stages.length, reminderCount: s.reminders.length, goalCount: goalCount }
}

/* ---------- 业务操作 ---------- */

function findStage(id) {
  return space().stages.filter(function (s) {
    return s.id === id
  })[0]
}

function findReminder(id) {
  return space().reminders.filter(function (r) {
    return r.id === id
  })[0]
}

function toggleGoal(stageId, goalId) {
  return update(function (d) {
    const stage = d.stages.filter(function (s) {
      return s.id === stageId
    })[0]
    if (!stage) return
    const goal = stage.goals.filter(function (g) {
      return g.id === goalId
    })[0]
    if (!goal) return
    goal.done = !goal.done
    goal.doneAt = goal.done ? time.todayStr() : ''
  })
}

function toggleReminderDone(id) {
  const t = time.todayStr()
  return update(function (d) {
    const r = d.reminders.filter(function (x) {
      return x.id === id
    })[0]
    if (!r) return
    if (r.type === 'once') {
      r.done = !r.done
      r.doneAt = r.done ? t : ''
    } else if (r.lastDone === t) {
      r.lastDone = r.prevLastDone || ''
      r.prevLastDone = ''
    } else {
      r.prevLastDone = r.lastDone || ''
      r.lastDone = t
    }
  })
}

/* ---------- 导入导出 ---------- */

/** 导出完整数据（含全部用户与其空间） */
function exportAll() {
  return JSON.stringify(loadRoot(), null, 2)
}

/**
 * 只解析并识别备份格式，不改动任何数据。
 * 用于导入前先弹确认框——直接拿 importData 去试探会先把数据覆盖掉。
 */
function probeImport(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    return { ok: false, reason: 'parse' }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'format' }
  if (Array.isArray(obj.users)) return { ok: true, scope: 'all' }
  if (Array.isArray(obj.stages) || Array.isArray(obj.reminders)) return { ok: true, scope: 'current' }
  return { ok: false, reason: 'format' }
}

/**
 * 导入：自动兼容两种格式
 * - v2 多用户备份（含 users）→ 整体替换
 * - v1 单空间备份（含 stages/reminders）→ 导入到当前用户空间
 */
function importData(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    return { ok: false, reason: 'parse' }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'format' }

  const isRootFormat = Array.isArray(obj.users)
  const isSpaceFormat = Array.isArray(obj.stages) || Array.isArray(obj.reminders)
  if (!isRootFormat && !isSpaceFormat) return { ok: false, reason: 'format' }

  if (isRootFormat) {
    root = normalizeRoot(obj)
  } else {
    const r = loadRoot()
    r.spaces[r.activeUserId] = normSpace(obj)
  }
  commit()
  return { ok: true, scope: isRootFormat ? 'all' : 'current' }
}

/* ---------- 示例数据 ---------- */

function demoSpace() {
  const t = time.todayStr()
  const data = defaultData()
  data.stages = [
    {
      id: uid('s'),
      name: '本年 · 专注成长',
      desc: '把一年拆成看得见的四段，一步一步走完。',
      dimension: 'year',
      startDate: time.startOfYear(t),
      endDate: time.endOfYear(t),
      color: C.COLORS[0],
      createdAt: Date.now(),
      goals: [
        { id: uid('g'), title: '读完 12 本书', level: 'important', done: false, doneAt: '' },
        { id: uid('g'), title: '每周运动 3 次', level: 'normal', done: true, doneAt: '' },
        { id: uid('g'), title: '整理一次相册', level: 'minor', done: false, doneAt: '' }
      ]
    },
    {
      id: uid('s'),
      name: '本季 · 夯实基础',
      desc: '这一季只做三件事，做完就算赢。',
      dimension: 'quarter',
      startDate: time.startOfQuarter(t),
      endDate: time.endOfQuarter(t),
      color: C.COLORS[1],
      createdAt: Date.now(),
      goals: [
        { id: uid('g'), title: '完成核心项目上线', level: 'important', done: false, doneAt: '' },
        { id: uid('g'), title: '每月一次复盘', level: 'normal', done: false, doneAt: '' }
      ]
    },
    {
      id: uid('s'),
      name: '本月 · 稳步推进',
      desc: '',
      dimension: 'month',
      startDate: time.startOfMonth(t),
      endDate: time.endOfMonth(t),
      color: C.COLORS[4],
      createdAt: Date.now(),
      goals: [
        { id: uid('g'), title: '存下本月预算的 20%', level: 'important', done: false, doneAt: '' },
        { id: uid('g'), title: '约一次朋友见面', level: 'minor', done: false, doneAt: '' }
      ]
    },
    {
      id: uid('s'),
      name: '本周 · 小步快跑',
      desc: '',
      dimension: 'week',
      startDate: time.startOfWeek(t),
      endDate: time.endOfWeek(t),
      color: C.COLORS[3],
      createdAt: Date.now(),
      goals: [
        { id: uid('g'), title: '写完周报', level: 'normal', done: false, doneAt: '' },
        { id: uid('g'), title: '早睡 5 天', level: 'minor', done: false, doneAt: '' }
      ]
    }
  ]
  const y = data.stages[0].id
  data.reminders = [
    {
      id: uid('r'),
      title: '晨间计划',
      type: 'daily',
      time: '08:00',
      startDate: t,
      linkType: 'stage',
      linkStageId: y,
      linkGoalId: '',
      note: '花 5 分钟写下今天最重要的一件事',
      enabled: true
    },
    {
      id: uid('r'),
      title: '周复盘',
      type: 'weekly',
      time: '20:00',
      startDate: t,
      weekdays: [7],
      linkType: 'none',
      note: '',
      enabled: true
    },
    {
      id: uid('r'),
      title: '月度总结',
      type: 'monthly',
      time: '10:00',
      startDate: t,
      monthDay: 1,
      linkType: 'none',
      note: '',
      enabled: true
    },
    {
      id: uid('r'),
      title: '给家人打个电话',
      type: 'interval',
      time: '19:30',
      startDate: t,
      intervalDays: 3,
      linkType: 'none',
      note: '',
      enabled: true
    },
    {
      id: uid('r'),
      title: '体检预约',
      type: 'once',
      time: '09:00',
      date: time.addDays(t, 5),
      linkType: 'none',
      note: '',
      enabled: true
    }
  ]
  return normSpace(data)
}

/** 对外保持旧契约：把示例数据灌入当前用户空间 */
function demoData() {
  const r = loadRoot()
  r.spaces[r.activeUserId] = demoSpace()
  r.spaces[r.activeUserId]._demo = true
  r.spaces[r.activeUserId].settings.initialized = true
  commit()
  return space()
}

module.exports = {
  KEY,
  VERSION,
  uid,
  defaultData,
  normalize,
  normSpace,
  normalizeRoot,
  load,
  commit,
  on,
  update,
  reset,
  replace,
  findStage,
  findReminder,
  toggleGoal,
  toggleReminderDone,
  demoData,
  demoSpace,
  spaceStats,
  listUsers,
  activeUser,
  createUser,
  switchUser,
  removeUser,
  renameUser,
  exportAll,
  importData,
  probeImport,
  ensureWechatUser,
  syncWithCloud,
  flushSync,
  pushToCloud,
  canSync
}
