const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const share = require('../../utils/share')

Page({
  data: {
    groups: [],
    summary: { total: 0, todayCount: 0, doneCount: 0 }
  },

  onShow() {
    this.refresh()
  },

  onShareAppMessage() {
    return share.appMessage(model.lifeView(store.load().settings || {}, time.todayStr()))
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

    const views = model.reminderViews(data.reminders, today, data.stages)

    const byTime = function (a, b) {
      return time.dayNum(a.nextDate || '9999-12-31') - time.dayNum(b.nextDate || '9999-12-31') ||
        time.timeToMinutes(a.time) - time.timeToMinutes(b.time)
    }

    const overdue = views
      .filter(function (v) {
        return v.enabled && !v.finished && v.overdue
      })
      .sort(byTime)

    const todayList = views
      .filter(function (v) {
        return v.enabled && !v.finished && !v.overdue && v.isToday
      })
      .sort(byTime)

    const soon = views
      .filter(function (v) {
        return v.enabled && !v.finished && !v.overdue && !v.isToday && !!v.nextDate && time.diffDays(today, v.nextDate) <= 7
      })
      .sort(byTime)

    const later = views
      .filter(function (v) {
        return v.enabled && !v.finished && !v.overdue && !v.isToday && !!v.nextDate && time.diffDays(today, v.nextDate) > 7
      })
      .sort(byTime)

    const closed = views
      .filter(function (v) {
        return !v.enabled || v.finished || (!v.nextDate && !v.finished)
      })
      .sort(byTime)

    const groups = []
    if (overdue.length) groups.push({ key: 'overdue', title: '逾期未完成', tone: 'past', items: overdue })
    if (todayList.length) groups.push({ key: 'today', title: '今天', tone: 'now', items: todayList })
    if (soon.length) groups.push({ key: 'soon', title: '未来 7 天', tone: 'future', items: soon })
    if (later.length) groups.push({ key: 'later', title: '更远', tone: 'future', items: later })
    if (closed.length) groups.push({ key: 'closed', title: '已停用 / 已完成', tone: 'muted', items: closed })

    this.setData({
      groups: groups,
      summary: {
        total: data.reminders.length,
        todayCount: overdue.length + todayList.length,
        doneCount: views.filter(function (v) {
          return v.doneToday || v.finished
        }).length
      }
    })
  },

  toggleDone(e) {
    store.toggleReminderDone(e.currentTarget.dataset.id)
    wx.vibrateShort({ type: 'light', fail: function () {} })
    this.refresh()
  },

  toggleEnabled(e) {
    const id = e.currentTarget.dataset.id
    store.update(function (d) {
      d.reminders = d.reminders.map(function (r) {
        return r.id === id ? Object.assign({}, r, { enabled: !r.enabled }) : r
      })
    })
    this.refresh()
  },

  edit(e) {
    wx.navigateTo({ url: '/pages/reminder-edit/reminder-edit?id=' + e.currentTarget.dataset.id })
  },

  add() {
    wx.navigateTo({ url: '/pages/reminder-edit/reminder-edit' })
  }
})
