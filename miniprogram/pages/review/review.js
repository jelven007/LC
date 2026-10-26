const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const share = require('../../utils/share')

Page({
  data: {
    range: 30,
    rangeOptions: [
      { key: 30, label: '近 30 天' },
      { key: 90, label: '近 90 天' }
    ],
    overview: {
      stageTotal: 0,
      activeCount: 0,
      finishedCount: 0,
      goalTotal: 0,
      goalDone: 0,
      goalPercent: 0,
      reminderTotal: 0,
      reminderActive: 0
    },
    trend: [],
    trendSum: 0,
    rank: [],
    timeline: [],
    hasData: false,
    todayText: ''
  },

  onShow() {
    this.refresh()
  },

  onShareAppMessage() {
    const o = this.data.overview
    return {
      title: '我已累计完成 ' + o.goalDone + ' 个目标，完成率 ' + o.goalPercent + '%',
      path: '/pages/today/today'
    }
  },

  onShareTimeline() {
    return share.timeline()
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  },

  onRange(e) {
    this.setData({ range: Number(e.currentTarget.dataset.key) })
    this.refresh()
  },

  refresh() {
    const data = store.load()
    const today = time.todayStr()
    const range = this.data.range
    const result = model.reviewData(data, today, range)

    // 按实际最大值归一化柱高，保证不同区间下图形都可读
    const trend = result.trend.slice()
    let sum = 0
    let max = 0
    trend.forEach(function (t) {
      sum += t.value
      if (t.value > max) max = t.value
    })
    const bars = trend.map(function (t) {
      const percent = max ? Math.round((t.value / max) * 100) : 0
      return Object.assign({}, t, { percent: t.value > 0 && percent < 12 ? 12 : percent })
    })

    this.setData({
      overview: result.overview,
      trend: bars,
      trendSum: sum,
      rank: result.rank,
      timeline: result.timeline,
      hasData: result.hasData,
      todayText: time.fmtCN(today)
    })
  },

  goStages() {
    wx.switchTab({ url: '/pages/stages/stages' })
  },

  editStage(e) {
    wx.navigateTo({ url: '/pages/stage-edit/stage-edit?id=' + e.currentTarget.dataset.id })
  }
})
