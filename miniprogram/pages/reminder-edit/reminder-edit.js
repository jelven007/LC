const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const C = require('../../utils/constants')

const MONTH_DAYS = []
for (let i = 1; i <= 31; i++) MONTH_DAYS.push(String(i))

Page({
  data: {
    isEdit: false,
    id: '',
    title: '',
    typeLabels: C.REMINDER_TYPES.map(function (t) {
      return t.label
    }),
    typeIndex: 1,
    type: 'daily',
    time: '09:00',
    date: '',
    startDate: '',
    weekOptions: C.WEEKDAY_OPTIONS,
    weekdays: [],
    monthDays: MONTH_DAYS,
    monthDayIndex: 0,
    intervalDays: '3',
    linkLabels: ['不关联'],
    linkValues: [''],
    linkIndex: 0,
    note: '',
    enabled: true,
    preview: ''
  },

  onLoad(options) {
    const today = time.todayStr()
    const base = {
      date: time.addDays(today, 1),
      startDate: today,
      weekdays: [time.weekday(today)],
      monthDayIndex: Math.max(time.parse(today).getDate() - 1, 0),
      time: '09:00'
    }
    const id = options && options.id
    if (id) {
      const r = store.findReminder(id)
      if (!r) {
        wx.showToast({ title: '提醒不存在', icon: 'none' })
        setTimeout(function () {
          wx.navigateBack()
        }, 800)
        return
      }
      this.setData({
        isEdit: true,
        id: r.id,
        title: r.title,
        type: r.type,
        typeIndex: Math.max(
          C.REMINDER_TYPES.findIndex(function (t) {
            return t.key === r.type
          }),
          0
        ),
        time: r.time,
        date: r.date || base.date,
        startDate: r.startDate || today,
        weekdays: r.weekdays && r.weekdays.length ? r.weekdays : base.weekdays,
        monthDayIndex: Math.min(Math.max(r.monthDay - 1, 0), 30),
        intervalDays: String(r.intervalDays || 3),
        note: r.note,
        enabled: r.enabled
      })
      wx.setNavigationBarTitle({ title: '编辑提醒' })
    } else {
      this.setData(base)
      wx.setNavigationBarTitle({ title: '新建提醒' })
    }

    this.buildLinks()
    if (id) {
      const r = store.findReminder(id)
      const value = r.linkType === 'stage' ? 'stage:' + r.linkStageId : r.linkType === 'goal' ? 'goal:' + r.linkGoalId : ''
      const idx = this.data.linkValues.indexOf(value)
      this.setData({ linkIndex: idx > -1 ? idx : 0 })
    } else if (options && options.stageId) {
      const idx = this.data.linkValues.indexOf('stage:' + options.stageId)
      this.setData({ linkIndex: idx > -1 ? idx : 0 })
    }
    this.updatePreview()
  },

  buildLinks() {
    const stages = store.load().stages
    const labels = ['不关联']
    const values = ['']
    stages.forEach(function (s) {
      labels.push('阶段 · ' + s.name)
      values.push('stage:' + s.id)
      s.goals.forEach(function (g) {
        labels.push('目标 · ' + g.title)
        values.push('goal:' + s.id + ':' + g.id)
      })
    })
    this.setData({ linkLabels: labels, linkValues: values })
  },

  onTitle(e) {
    this.setData({ title: e.detail.value })
  },

  onType(e) {
    const idx = Number(e.detail.value)
    this.setData({
      typeIndex: idx,
      type: C.REMINDER_TYPES[idx].key
    })
    this.updatePreview()
  },

  onTime(e) {
    this.setData({ time: e.detail.value })
    this.updatePreview()
  },

  onDate(e) {
    this.setData({ date: e.detail.value })
    this.updatePreview()
  },

  onStart(e) {
    this.setData({ startDate: e.detail.value })
    this.updatePreview()
  },

  toggleWeek(e) {
    const day = Number(e.currentTarget.dataset.day)
    const list = this.data.weekdays.slice()
    const i = list.indexOf(day)
    if (i > -1) list.splice(i, 1)
    else list.push(day)
    this.setData({ weekdays: list.sort() })
    this.updatePreview()
  },

  onMonthDay(e) {
    this.setData({ monthDayIndex: Number(e.detail.value) })
    this.updatePreview()
  },

  onInterval(e) {
    this.setData({ intervalDays: e.detail.value })
    this.updatePreview()
  },

  onLink(e) {
    this.setData({ linkIndex: Number(e.detail.value) })
  },

  onNote(e) {
    this.setData({ note: e.detail.value })
  },

  onEnabled(e) {
    this.setData({ enabled: e.detail.value })
    this.updatePreview()
  },

  updatePreview() {
    const r = {
      id: this.data.id || 'preview',
      title: this.data.title,
      type: this.data.type,
      time: this.data.time,
      date: this.data.date,
      startDate: this.data.startDate,
      weekdays: this.data.weekdays,
      monthDay: Number(this.data.monthDayIndex) + 1,
      intervalDays: Number(this.data.intervalDays) || 1,
      enabled: true,
      done: false,
      lastDone: '',
      linkType: 'none'
    }
    const v = model.reminderView(r, time.todayStr(), store.load().stages)
    this.setData({
      preview: v.nextDate ? v.nextText + '（' + v.countdown + '）' : '暂不触发'
    })
  },

  save() {
    const title = (this.data.title || '').trim()
    if (!title) {
      wx.showToast({ title: '请输入提醒标题', icon: 'none' })
      return
    }
    if (this.data.type === 'weekly' && !this.data.weekdays.length) {
      wx.showToast({ title: '请选择至少一个星期', icon: 'none' })
      return
    }
    if (this.data.type === 'interval' && !(Number(this.data.intervalDays) > 0)) {
      wx.showToast({ title: '请输入正确的间隔天数', icon: 'none' })
      return
    }

    const linkValue = this.data.linkValues[this.data.linkIndex] || ''
    let linkType = 'none'
    let linkStageId = ''
    let linkGoalId = ''
    if (linkValue.indexOf('goal:') === 0) {
      const parts = linkValue.split(':')
      linkType = 'goal'
      linkStageId = parts[1]
      linkGoalId = parts[2]
    } else if (linkValue.indexOf('stage:') === 0) {
      linkType = 'stage'
      linkStageId = linkValue.slice(6)
    }

    const payload = {
      title: title,
      type: this.data.type,
      time: this.data.time,
      date: this.data.date,
      startDate: this.data.startDate,
      weekdays: this.data.weekdays,
      monthDay: Number(this.data.monthDayIndex) + 1,
      intervalDays: Number(this.data.intervalDays) || 1,
      linkType: linkType,
      linkStageId: linkStageId,
      linkGoalId: linkGoalId,
      note: (this.data.note || '').trim(),
      enabled: this.data.enabled
    }

    const id = this.data.id
    store.update(function (d) {
      if (id) {
        d.reminders = d.reminders.map(function (r) {
          return r.id === id ? Object.assign({}, r, payload) : r
        })
      } else {
        payload.id = store.uid('r')
        payload.createdAt = Date.now()
        payload.done = false
        payload.doneAt = ''
        payload.lastDone = ''
        payload.prevLastDone = ''
        d.reminders.push(payload)
      }
    })

    wx.showToast({ title: id ? '已保存' : '已创建', icon: 'success' })
    setTimeout(function () {
      wx.navigateBack()
    }, 500)
  },

  remove() {
    const id = this.data.id
    if (!id) return
    wx.showModal({
      title: '删除提醒',
      content: '删除后不可恢复，确定删除吗？',
      confirmColor: '#FF5A5F',
      success(res) {
        if (!res.confirm) return
        store.update(function (d) {
          d.reminders = d.reminders.filter(function (r) {
            return r.id !== id
          })
        })
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(function () {
          wx.navigateBack()
        }, 500)
      }
    })
  }
})
