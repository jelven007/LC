const time = require('./time')
const C = require('./constants')

/** 按维度给出默认结束日期 */
function defaultEndDate(dimension, start) {
  if (!start) return ''
  switch (dimension) {
    case 'year':
      return time.addDays(time.addYears(start, 1), -1)
    case 'quarter':
      return time.addDays(time.addMonths(start, 3), -1)
    case 'month':
      return time.addDays(time.addMonths(start, 1), -1)
    case 'week':
      return time.addDays(start, 6)
    case 'day':
      return start
    default:
      return start
  }
}

/** 阶段视图：进度按「已过天数」实时计算 */
function stageView(stage, today) {
  const start = stage.startDate
  const end = stage.endDate
  const valid = !!(start && end) && time.dayNum(end) >= time.dayNum(start)
  const total = valid ? time.diffDays(start, end) + 1 : 0
  const passed = valid ? Math.min(Math.max(time.diffDays(start, today) + 1, 0), total) : 0
  let percent = 0
  if (total > 0) {
    percent = Math.round((passed / total) * 100)
    if (passed > 0 && percent === 0) percent = 1
    if (passed < total && percent === 100) percent = 99
  }

  let status = 'active'
  let statusText = '进行中'
  if (!valid) {
    status = 'invalid'
    statusText = '日期待设置'
  } else if (time.diffDays(today, start) > 0) {
    status = 'upcoming'
    statusText = time.diffDays(today, start) + ' 天后开始'
  } else if (time.diffDays(today, end) < 0) {
    status = 'done'
    statusText = '已结束'
  }

  const remainDays = valid ? Math.max(time.diffDays(today, end), 0) : 0
  const remainText = !valid ? '' : remainDays === 0 ? '今天结束' : '还剩 ' + remainDays + ' 天'

  return {
    id: stage.id,
    name: stage.name,
    desc: stage.desc,
    dimension: stage.dimension,
    dimensionLabel: C.DIMENSION_LABEL[stage.dimension] || '年',
    color: stage.color,
    startDate: start,
    endDate: end,
    dateText: valid ? time.fmtDot(start) + ' - ' + time.fmtDot(end) : '日期待设置',
    total: total,
    passed: passed,
    percent: percent,
    remainDays: remainDays,
    remainText: remainText,
    status: status,
    statusText: statusText,
    goals: goalStats(stage.goals)
  }
}

function goalStats(goals) {
  const list = goals || []
  const map = {}
  C.LEVELS.forEach(function (l) {
    map[l.key] = { total: 0, done: 0 }
  })
  list.forEach(function (g) {
    const k = map[g.level] ? g.level : 'normal'
    map[k].total += 1
    if (g.done) map[k].done += 1
  })
  const total = list.length
  const done = list.filter(function (g) {
    return g.done
  }).length
  return {
    total: total,
    done: done,
    percent: total ? Math.round((done / total) * 100) : 0,
    levelList: C.LEVELS.map(function (l) {
      return {
        key: l.key,
        label: l.label,
        color: l.color,
        total: map[l.key].total,
        done: map[l.key].done
      }
    })
  }
}

function goalView(goal) {
  return {
    id: goal.id,
    title: goal.title,
    level: goal.level,
    levelLabel: C.LEVEL_LABEL[goal.level] || '常规',
    color: C.LEVEL_COLOR[goal.level] || C.LEVEL_COLOR.normal,
    done: !!goal.done
  }
}

/** 下一次提醒日期（YYYY-MM-DD），返回 null 表示不再触发 */
function nextFire(r, from) {
  const today = from || time.todayStr()
  if (r.type === 'once') return r.done ? null : r.date || null

  const start = r.startDate || today
  let c = time.maxDate(start, today)

  if (r.type === 'daily') {
    if (r.lastDone && time.dayNum(r.lastDone) >= time.dayNum(c)) c = time.addDays(r.lastDone, 1)
    return c
  }

  if (r.type === 'weekly') {
    const days = r.weekdays && r.weekdays.length ? r.weekdays : [time.weekday(start)]
    for (let i = 0; i < 8; i++) {
      if (days.indexOf(time.weekday(c)) > -1 && r.lastDone !== c) return c
      c = time.addDays(c, 1)
    }
    return null
  }

  if (r.type === 'monthly') {
    const day = Number(r.monthDay) || 1
    let cursor = c
    for (let i = 0; i < 14; i++) {
      const d = time.parse(cursor)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const dd = Math.min(day, time.daysInMonth(y, m))
      const cand = time.toStr(new Date(y, m - 1, dd))
      if (time.dayNum(cand) >= time.dayNum(c) && r.lastDone !== cand) return cand
      cursor = time.toStr(new Date(y, m, 1))
    }
    return null
  }

  if (r.type === 'interval') {
    const n = Math.max(1, Number(r.intervalDays) || 1)
    if (r.lastDone) return time.addDays(r.lastDone, n)
    if (time.dayNum(start) >= time.dayNum(today)) return start
    const k = Math.ceil(time.diffDays(start, today) / n)
    return time.addDays(start, k * n)
  }

  return null
}

function countdownText(date, today) {
  if (!date) return ''
  const d = time.diffDays(today, date)
  if (d < 0) return '逾期 ' + -d + ' 天'
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  if (d === 2) return '后天'
  if (d <= 30) return d + ' 天后'
  return time.fmtShort(date)
}

function ruleText(r) {
  switch (r.type) {
    case 'once':
      return '仅一次 · ' + (r.date ? time.fmtShort(r.date) : '未设置') + ' ' + r.time
    case 'daily':
      return '每天 ' + r.time
    case 'weekly': {
      const w = (r.weekdays || []).slice().sort()
      return '每周' + w.map(time.weekdayCN).join('、') + ' ' + r.time
    }
    case 'monthly':
      return '每月 ' + r.monthDay + ' 日 ' + r.time
    case 'interval':
      return '每 ' + (r.intervalDays || 1) + ' 天 · ' + r.time
    default:
      return r.time
  }
}

function linkText(r, stages) {
  if (!r.linkType || r.linkType === 'none') return ''
  const stage = (stages || []).filter(function (s) {
    return s.id === r.linkStageId
  })[0]
  if (r.linkType === 'stage') return stage ? '阶段 · ' + stage.name : '阶段已删除'
  if (!stage) return '目标已删除'
  const goal = stage.goals.filter(function (g) {
    return g.id === r.linkGoalId
  })[0]
  return goal ? '目标 · ' + goal.title : '目标已删除'
}

function linkColor(r, stages) {
  const stage = (stages || []).filter(function (s) {
    return s.id === r.linkStageId
  })[0]
  return stage ? stage.color : '#8A94A6'
}

function reminderView(r, today, stages) {
  const nextDate = nextFire(r, today)
  const doneToday = r.type === 'once' ? !!r.done : r.lastDone === today
  const overdue = !!nextDate && !doneToday && time.dayNum(nextDate) < time.dayNum(today)
  const isToday = !!nextDate && nextDate === today
  const timePassed = isToday && !doneToday && time.timeToMinutes(r.time) < time.timeToMinutes(time.nowTime())
  const finished = r.type === 'once' && r.done

  return {
    id: r.id,
    title: r.title,
    type: r.type,
    typeLabel: C.REMINDER_TYPE_LABEL[r.type] || '每天',
    time: r.time,
    enabled: !!r.enabled,
    note: r.note,
    nextDate: nextDate,
    nextText: nextDate ? time.fmtShort(nextDate) + ' ' + r.time : finished ? '已完成' : '不再提醒',
    countdown: countdownText(nextDate, today),
    overdue: overdue,
    isToday: isToday,
    timePassed: timePassed,
    doneToday: doneToday,
    finished: finished,
    ruleText: ruleText(r),
    linkText: linkText(r, stages),
    linkColor: linkColor(r, stages)
  }
}

/** 人生进度（时间统计口径，不做生存期预测） */
function lifeView(settings, today) {
  const birth = settings.birthDate
  const expect = Math.max(1, Number(settings.lifeExpectancy) || 80)
  if (!birth || time.diffDays(birth, today) < 0) {
    return { has: false, years: 0, percent: 0, livedDays: 0, remainDays: 0, expectYears: expect, pastYears: 0, futureYears: 0, overExpect: false, cells: [] }
  }
  const livedDays = time.diffDays(birth, today)
  const expectDays = Math.round(expect * 365.25)
  const b = time.parse(birth)
  let years = today.slice(0, 4) - b.getFullYear()
  const md = today.slice(5) < time.toStr(b).slice(5)
  if (md) years -= 1
  if (years < 0) years = 0
  const percent = Math.min(100, Math.max(0, Math.round((livedDays / expectDays) * 100)))
  const cells = []
  for (let i = 0; i < expect; i++) {
    cells.push({ i: i, state: i < years ? 0 : i === years ? 1 : 2 })
  }
  // 已超设定年限时，years 可能大于格子总数，需收敛后再展示，否则会出现负数文案
  const overExpect = years >= expect
  const pastYears = Math.min(years, expect)
  const futureYears = Math.max(expect - years - 1, 0)
  return {
    has: true,
    years: years,
    pastYears: pastYears,
    futureYears: futureYears,
    overExpect: overExpect,
    percent: percent,
    livedDays: livedDays,
    remainDays: Math.max(expectDays - livedDays, 0),
    expectYears: expect,
    cells: cells
  }
}

/* ---------- 批量视图：页面一次算好，多处复用 ---------- */

function stageViews(list, today) {
  return (list || []).map(function (s) {
    return stageView(s, today)
  })
}

function reminderViews(list, today, stages) {
  return (list || []).map(function (r) {
    return reminderView(r, today, stages)
  })
}

/** 数据回顾：完成统计 + 近 N 天趋势 + 阶段排行 + 时间线 */
function reviewData(data, today, days) {
  const t = today || time.todayStr()
  const span = Math.max(Number(days) || 30, 7)
  const stages = (data && data.stages) || []
  const reminders = (data && data.reminders) || []

  let goalTotal = 0
  let goalDone = 0
  const events = {}

  const items = stages.map(function (s) {
    const v = stageView(s, t)
    let total = 0
    let done = 0
    s.goals.forEach(function (g) {
      total += 1
      goalTotal += 1
      if (g.done) {
        done += 1
        goalDone += 1
        if (g.doneAt) events[g.doneAt] = (events[g.doneAt] || 0) + 1
      }
    })
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      dimension: s.dimension,
      dimensionLabel: v.dimensionLabel,
      status: v.status,
      statusText: v.statusText,
      dateText: v.dateText,
      startDate: v.startDate,
      percent: total ? Math.round((done / total) * 100) : 0,
      total: total,
      done: done,
      remainText: v.remainText
    }
  })

  // 提醒的完成动作同样计入趋势
  let reminderActive = 0
  reminders.forEach(function (r) {
    if (r.enabled) reminderActive += 1
    if (r.lastDone) events[r.lastDone] = (events[r.lastDone] || 0) + 1
    if (r.prevLastDone) events[r.prevLastDone] = (events[r.prevLastDone] || 0) + 1
  })

  const trend = []
  let trendMax = 0
  let trendSum = 0
  for (let i = span - 1; i >= 0; i--) {
    const d = time.addDays(t, -i)
    const value = events[d] || 0
    trendSum += value
    if (value > trendMax) trendMax = value
    trend.push({ date: d, label: String(time.parse(d).getDate()), value: value })
  }
  trend.forEach(function (item) {
    item.percent = trendMax ? Math.round((item.value / trendMax) * 100) : 0
    if (item.value > 0 && item.percent < 12) item.percent = 12
  })

  const rank = items.slice().sort(function (a, b) {
    return b.percent - a.percent || b.done - a.done || b.total - a.total
  })

  const timeline = items.slice().sort(function (a, b) {
    return (time.dayNum(a.startDate) || 0) - (time.dayNum(b.startDate) || 0)
  })

  return {
    overview: {
      stageTotal: items.length,
      activeCount: items.filter(function (i) {
        return i.status === 'active'
      }).length,
      finishedCount: items.filter(function (i) {
        return i.status === 'done'
      }).length,
      goalTotal: goalTotal,
      goalDone: goalDone,
      goalPercent: goalTotal ? Math.round((goalDone / goalTotal) * 100) : 0,
      reminderTotal: reminders.length,
      reminderActive: reminderActive
    },
    trend: trend,
    trendSum: trendSum,
    trendMax: trendMax,
    rank: rank,
    timeline: timeline,
    hasData: items.length > 0 || reminders.length > 0
  }
}

module.exports = {
  defaultEndDate,
  stageView,
  goalStats,
  goalView,
  nextFire,
  countdownText,
  ruleText,
  linkText,
  reminderView,
  lifeView,
  stageViews,
  reminderViews,
  reviewData
}
