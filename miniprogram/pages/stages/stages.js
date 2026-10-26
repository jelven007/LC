const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const C = require('../../utils/constants')
const share = require('../../utils/share')

const LEVEL_ORDER = { important: 0, normal: 1, minor: 2 }
const STATUS_ORDER = { active: 0, upcoming: 1, done: 2, invalid: 3 }

Page({
  data: {
    dims: [{ key: 'all', label: '全部' }].concat(C.DIMENSIONS),
    filter: 'all',
    levels: C.LEVELS,
    list: [],
    summary: { stageCount: 0, goalTotal: 0, goalDone: 0, percent: 0 },
    goalModal: false,
    goalTitle: '',
    goalLevel: 'normal',
    goalStageId: ''
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

  refresh() {
    const data = store.load()
    const today = time.todayStr()

    let list = data.stages.map(function (s) {
      const view = model.stageView(s, today)
      const goals = s.goals
        .map(model.goalView)
        .sort(function (a, b) {
          return (a.done ? 1 : 0) - (b.done ? 1 : 0) || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
        })
      return Object.assign({}, view, { goalList: goals })
    })

    if (this.data.filter !== 'all') {
      list = list.filter(function (s) {
        return s.dimension === this.data.filter
      }, this)
    }

    list.sort(function (a, b) {
      return (
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        time.dayNum(a.startDate) - time.dayNum(b.startDate)
      )
    })

    // 保持展开状态
    const openMap = {}
    this.data.list.forEach(function (s) {
      if (s.open) openMap[s.id] = true
    })
    list = list.map(function (s) {
      return Object.assign({}, s, { open: !!openMap[s.id] })
    })

    let goalTotal = 0
    let goalDone = 0
    data.stages.forEach(function (s) {
      s.goals.forEach(function (g) {
        goalTotal += 1
        if (g.done) goalDone += 1
      })
    })

    this.setData({
      list: list,
      summary: {
        stageCount: data.stages.length,
        goalTotal: goalTotal,
        goalDone: goalDone,
        percent: goalTotal ? Math.round((goalDone / goalTotal) * 100) : 0
      }
    })
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key })
    this.refresh()
  },

  toggleOpen(e) {
    const id = e.currentTarget.dataset.id
    const key = 'list[' + this.data.list.findIndex(function (s) {
      return s.id === id
    }) + '].open'
    if (key.indexOf('-1') > -1) return
    const patch = {}
    patch[key] = !this.data.list.find(function (s) {
      return s.id === id
    }).open
    this.setData(patch)
  },

  toggleGoal(e) {
    store.toggleGoal(e.currentTarget.dataset.stage, e.currentTarget.dataset.goal)
    wx.vibrateShort({ type: 'light', fail: function () {} })
    this.refresh()
  },

  addStage() {
    wx.navigateTo({ url: '/pages/stage-edit/stage-edit' })
  },

  editStage(e) {
    wx.navigateTo({ url: '/pages/stage-edit/stage-edit?id=' + e.currentTarget.dataset.id })
  },

  deleteStage(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const self = this
    wx.showModal({
      title: '删除阶段',
      content: '确定删除「' + name + '」及其所有目标吗？',
      confirmColor: '#FF5A5F',
      success(res) {
        if (!res.confirm) return
        store.update(function (d) {
          d.stages = d.stages.filter(function (s) {
            return s.id !== id
          })
        })
        wx.showToast({ title: '已删除', icon: 'success' })
        self.refresh()
      }
    })
  },

  openGoalModal(e) {
    this.setData({
      goalModal: true,
      goalStageId: e.currentTarget.dataset.id,
      goalTitle: '',
      goalLevel: 'normal'
    })
  },

  hideGoalModal() {
    this.setData({ goalModal: false })
  },

  noop() {},

  onGoalTitle(e) {
    this.setData({ goalTitle: e.detail.value })
  },

  pickLevel(e) {
    this.setData({ goalLevel: e.currentTarget.dataset.key })
  },

  confirmGoal() {
    const title = (this.data.goalTitle || '').trim()
    if (!title) {
      wx.showToast({ title: '请输入目标内容', icon: 'none' })
      return
    }
    const stageId = this.data.goalStageId
    const level = this.data.goalLevel
    store.update(function (d) {
      const stage = d.stages.filter(function (s) {
        return s.id === stageId
      })[0]
      if (!stage) return
      stage.goals.push({
        id: store.uid('g'),
        title: title,
        level: level,
        done: false,
        doneAt: ''
      })
    })
    this.setData({ goalModal: false, goalTitle: '' })
    wx.showToast({ title: '已添加', icon: 'success' })
    this.refresh()
  },

  deleteGoal(e) {
    const stageId = e.currentTarget.dataset.stage
    const goalId = e.currentTarget.dataset.goal
    store.update(function (d) {
      const stage = d.stages.filter(function (s) {
        return s.id === stageId
      })[0]
      if (!stage) return
      stage.goals = stage.goals.filter(function (g) {
        return g.id !== goalId
      })
    })
    this.refresh()
  }
})
