const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const share = require('../../utils/share')

const LEVEL_ORDER = { important: 0, normal: 1, minor: 2 }

Page({
  data: {
    dateDay: '',
    dateYearMonth: '',
    dateWeek: '',
    yearPercent: 0,
    yearText: '',
    life: { has: false, cells: [] },
    reminders: [],
    stages: [],
    nextStage: null,
    undoneGoalCount: 0,
    soonCount: 0
  },

  onShow() {
    this.refresh()
  },

  onShareAppMessage() {
    const data = store.load()
    return share.appMessage(model.lifeView(data.settings || {}, time.todayStr()))
  },

  onShareTimeline() {
    return share.timeline()
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  },

  refresh() {
    const data = store.load()
    const today = time.todayStr()
    const now = new Date()
    const todayNum = time.dayNum(today)

    // 顶部日期
    const yearDays = time.daysInYear(now.getFullYear())
    const passed = time.dayOfYear(today)
    const yearPercent = Math.round((passed / yearDays) * 100)

    // 人生进度
    const life = model.lifeView(data.settings || {}, today)

    // 阶段视图：一次算好，后续全部复用
    const all = model.stageViews(data.stages, today)
    const stageMap = {}
    data.stages.forEach(function (s) {
      stageMap[s.id] = s
    })

    // 提醒视图：一次算好，供今日列表与近 7 天计数复用
    const reminderVals = model.reminderViews(data.reminders, today, data.stages)

    const reminders = reminderVals
      .filter(function (v) {
        return v.enabled && !v.finished && v.nextDate && time.dayNum(v.nextDate) <= todayNum
      })
      .sort(function (a, b) {
        return time.timeToMinutes(a.time) - time.timeToMinutes(b.time)
      })

    const soonCount = reminderVals.filter(function (v) {
      if (!v.enabled || !v.nextDate) return false
      const gap = time.diffDays(today, v.nextDate)
      return gap > 0 && gap <= 7
    }).length

    // 进行中的阶段
    const activeStages = all
      .filter(function (s) {
        return s.status === 'active'
      })
      .sort(function (a, b) {
        return time.dayNum(a.startDate) - time.dayNum(b.startDate)
      })
      .map(function (s) {
        const stage = stageMap[s.id]
        const goals = (stage ? stage.goals : [])
          .map(model.goalView)
          .sort(function (a, b) {
            return (a.done ? 1 : 0) - (b.done ? 1 : 0) || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
          })
        return Object.assign({}, s, { goalList: goals.slice(0, 4), goalRest: Math.max(goals.length - 4, 0) })
      })

    const upcoming = all
      .filter(function (s) {
        return s.status === 'upcoming'
      })
      .sort(function (a, b) {
        return time.dayNum(a.startDate) - time.dayNum(b.startDate)
      })
    const nextStage = upcoming.length ? upcoming[0] : null

    let undoneGoalCount = 0
    all.forEach(function (v) {
      if (v.status !== 'active') return
      const stage = stageMap[v.id]
      if (!stage) return
      stage.goals.forEach(function (g) {
        if (!g.done) undoneGoalCount += 1
      })
    })

    this.setData({
      dateDay: String(now.getDate()),
      dateYearMonth: now.getFullYear() + '年' + (now.getMonth() + 1) + '月',
      dateWeek: '星期' + time.weekdayCN(time.weekday(today)),
      yearPercent: yearPercent,
      yearText: '今年已过 ' + passed + ' 天，还剩 ' + (yearDays - passed) + ' 天',
      life: life,
      reminders: reminders,
      stages: activeStages,
      nextStage: nextStage,
      undoneGoalCount: undoneGoalCount,
      soonCount: soonCount
    })
  },

  toggleGoal(e) {
    const stageId = e.currentTarget.dataset.stage
    const goalId = e.currentTarget.dataset.goal
    store.toggleGoal(stageId, goalId)
    wx.vibrateShort({ type: 'light', fail: function () {} })
    this.refresh()
  },

  toggleReminder(e) {
    store.toggleReminderDone(e.currentTarget.dataset.id)
    wx.vibrateShort({ type: 'light', fail: function () {} })
    this.refresh()
  },

  editReminder(e) {
    wx.navigateTo({ url: '/pages/reminder-edit/reminder-edit?id=' + e.currentTarget.dataset.id })
  },

  goStages() {
    wx.switchTab({ url: '/pages/stages/stages' })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  addStage() {
    wx.navigateTo({ url: '/pages/stage-edit/stage-edit' })
  },

  addReminder() {
    wx.navigateTo({ url: '/pages/reminder-edit/reminder-edit' })
  }
})
