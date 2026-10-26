const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const C = require('../../utils/constants')

Page({
  data: {
    isEdit: false,
    id: '',
    name: '',
    desc: '',
    templates: C.TEMPLATES,
    templateKey: '',
    showTemplates: false,
    dimLabels: C.DIMENSIONS.map(function (d) {
      return d.label
    }),
    dimIndex: 0,
    dimension: 'year',
    startDate: '',
    endDate: '',
    colors: C.COLORS,
    color: C.COLORS[0],
    levelLabels: C.LEVELS.map(function (l) {
      return l.label
    }),
    levelColors: C.LEVELS.map(function (l) {
      return l.color
    }),
    goals: []
  },

  onLoad(options) {
    const today = time.todayStr()
    const id = options && options.id
    if (id) {
      const stage = store.findStage(id)
      if (!stage) {
        wx.showToast({ title: '阶段不存在', icon: 'none' })
        setTimeout(function () {
          wx.navigateBack()
        }, 800)
        return
      }
      this.setData({
        isEdit: true,
        id: stage.id,
        name: stage.name,
        desc: stage.desc,
        dimension: stage.dimension,
        dimIndex: Math.max(
          C.DIMENSIONS.findIndex(function (d) {
            return d.key === stage.dimension
          }),
          0
        ),
        startDate: stage.startDate,
        endDate: stage.endDate,
        color: stage.color,
        goals: stage.goals.map(function (g) {
          return {
            id: g.id,
            title: g.title,
            level: g.level,
            levelIndex: Math.max(
              C.LEVELS.findIndex(function (l) {
                return l.key === g.level
              }),
              0
            )
          }
        })
      })
      wx.setNavigationBarTitle({ title: '编辑阶段' })
    } else {
      this.setData({
        startDate: today,
        endDate: model.defaultEndDate('year', today),
        showTemplates: true
      })
      wx.setNavigationBarTitle({ title: '新建阶段' })
    }
  },

  /** 应用模板：填入名称、维度、颜色、说明与示例目标 */
  applyTemplate(e) {
    const key = e.currentTarget.dataset.key
    const tpl = C.TEMPLATES.filter(function (t) {
      return t.key === key
    })[0]
    if (!tpl) return

    const today = time.todayStr()
    const goals = tpl.goals.map(function (g) {
      return {
        id: store.uid('g'),
        title: g.title,
        level: g.level,
        levelIndex: Math.max(
          C.LEVELS.findIndex(function (l) {
            return l.key === g.level
          }),
          0
        )
      }
    })

    this.setData({
      templateKey: key,
      name: tpl.name,
      desc: tpl.desc,
      dimension: tpl.dimension,
      dimIndex: Math.max(
        C.DIMENSIONS.findIndex(function (d) {
          return d.key === tpl.dimension
        }),
        0
      ),
      color: tpl.color,
      startDate: today,
      endDate: model.defaultEndDate(tpl.dimension, today),
      goals: goals
    })
  },

  clearTemplate() {
    this.setData({ templateKey: '' })
  },

  toggleTemplates() {
    this.setData({ showTemplates: !this.data.showTemplates })
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  onDesc(e) {
    this.setData({ desc: e.detail.value })
  },

  onDimension(e) {
    const key = C.DIMENSIONS[Number(e.detail.value)].key
    const patch = { dimIndex: Number(e.detail.value), dimension: key, templateKey: '' }
    if (this.data.startDate) patch.endDate = model.defaultEndDate(key, this.data.startDate)
    this.setData(patch)
  },

  onStart(e) {
    const start = e.detail.value
    const patch = { startDate: start }
    if (start && (!this.data.endDate || time.diffDays(start, this.data.endDate) < 0)) {
      patch.endDate = model.defaultEndDate(this.data.dimension, start)
    }
    this.setData(patch)
  },

  onEnd(e) {
    this.setData({ endDate: e.detail.value })
  },

  pickColor(e) {
    this.setData({ color: e.currentTarget.dataset.color })
  },

  addGoal() {
    const goals = this.data.goals.concat([
      { id: store.uid('g'), title: '', level: 'normal', levelIndex: 1 }
    ])
    this.setData({ goals: goals })
  },

  onGoalTitle(e) {
    const i = Number(e.currentTarget.dataset.index)
    const key = 'goals[' + i + '].title'
    const patch = {}
    patch[key] = e.detail.value
    this.setData(patch)
  },

  onGoalLevel(e) {
    const i = Number(e.currentTarget.dataset.index)
    const idx = Number(e.detail.value)
    const patch = {}
    patch['goals[' + i + '].levelIndex'] = idx
    patch['goals[' + i + '].level'] = C.LEVELS[idx].key
    this.setData(patch)
  },

  deleteGoal(e) {
    const i = Number(e.currentTarget.dataset.index)
    const goals = this.data.goals.slice()
    goals.splice(i, 1)
    this.setData({ goals: goals })
  },

  save() {
    const name = (this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入阶段名称', icon: 'none' })
      return
    }
    if (!this.data.startDate || !this.data.endDate) {
      wx.showToast({ title: '请选择起止日期', icon: 'none' })
      return
    }
    if (time.diffDays(this.data.startDate, this.data.endDate) < 0) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }

    const payload = {
      name: name,
      desc: (this.data.desc || '').trim(),
      dimension: this.data.dimension,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      color: this.data.color,
      goals: this.data.goals
        .filter(function (g) {
          return (g.title || '').trim()
        })
        .map(function (g) {
          return {
            id: g.id,
            title: g.title.trim(),
            level: g.level,
            done: false,
            doneAt: ''
          }
        })
    }

    const id = this.data.id
    store.update(function (d) {
      if (id) {
        d.stages = d.stages.map(function (s) {
          if (s.id !== id) return s
          // 保留已有目标的完成状态
          const oldMap = {}
          s.goals.forEach(function (g) {
            oldMap[g.id] = g
          })
          const goals = payload.goals.map(function (g) {
            const old = oldMap[g.id]
            return old
              ? Object.assign({}, old, { title: g.title, level: g.level })
              : { id: g.id || store.uid('g'), title: g.title, level: g.level, done: false, doneAt: '' }
          })
          return Object.assign({}, s, payload, { goals: goals })
        })
      } else {
        payload.id = store.uid('s')
        payload.createdAt = Date.now()
        d.stages.push(payload)
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
    const self = this
    wx.showModal({
      title: '删除阶段',
      content: '删除后不可恢复，确定删除吗？',
      confirmColor: '#FF5A5F',
      success(res) {
        if (!res.confirm) return
        store.update(function (d) {
          d.stages = d.stages.filter(function (s) {
            return s.id !== id
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
