const store = require('../../utils/store')
const model = require('../../utils/model')
const time = require('../../utils/time')
const share = require('../../utils/share')
const cloud = require('../../utils/cloud')
const config = require('../../config')

const app = getApp()

Page({
  data: {
    version: '1.0.0',
    showPrivacy: false,
    stats: { stageCount: 0, activeCount: 0, goalTotal: 0, goalDone: 0, goalPercent: 0, reminderCount: 0 },
    birthDate: '',
    lifeExpectancy: '80',
    maxDate: time.todayStr(),
    life: { has: false, cells: [] },
    showExport: false,
    exportText: '',
    exportPath: '',
    showImport: false,
    importText: '',
    currentUser: null,
    userCount: 1,
    cloudReady: false,
    isLogin: false,
    openidTail: '',
    syncText: '',
    diagRunning: false,
    diag: { env: '未运行', fn: '未运行', db: '未运行' },
    icpNumber: (config && config.icpNumber) || ''
  },

  onLoad() {
    const self = this
    if (app && typeof app.onPrivacyNeeded === 'function') {
      this.offPrivacy = app.onPrivacyNeeded(function () {
        self.setData({ showPrivacy: true })
      })
    }
  },

  onShareAppMessage() {
    return share.appMessage(this.data.life)
  },

  onShareTimeline() {
    return share.timeline()
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  },

  goAccount() {
    wx.navigateTo({ url: '/pages/account/account' })
  },

  /* ---------- 微信登录 ---------- */

  updateCloudState() {
    const id = cloud.getOpenid() || ''
    const r = this.data
    const ok = cloud.isLogin()
    this.setData({
      cloudReady: cloud.available(),
      isLogin: ok,
      openidTail: id ? id.slice(-6) : '',
      syncText: ok ? '数据仅你可见 · 修改后自动同步' : ''
    })
  },

  doLogin() {
    if (!cloud.available()) {
      wx.showModal({
        title: '云同步未启用',
        content: '需要在 miniprogram/config.js 中填入云开发环境 ID，并在开发者工具里上传部署 login 云函数。在此之前，全部功能可离线正常使用，数据保存在本机。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    const self = this
    wx.showLoading({ title: '登录中', mask: true })
    cloud
      .login()
      .then(function (openid) {
        store.ensureWechatUser(openid)
        return store.syncWithCloud()
      })
      .then(function (result) {
        wx.hideLoading()
        if (result && result.ok === false) {
          wx.showToast({ title: cloud.messageOf({ code: result.reason }), icon: 'none' })
          return
        }
        let tip = '登录成功'
        if (result && result.direction === 'down') tip = '已恢复云端数据'
        else if (result && result.direction === 'up') tip = '本机数据已上传'
        wx.showToast({ title: tip, icon: 'success' })
        self.updateCloudState()
        self.refresh()
      })
      .catch(function (e) {
        wx.hideLoading()
        wx.showToast({ title: cloud.messageOf(e) || '登录失败', icon: 'none' })
      })
  },

  doLogout() {
    const self = this
    wx.showModal({
      title: '退出登录',
      content: '本机数据会保留，下次登录可重新与云端同步。确定退出吗？',
      success(res) {
        if (!res.confirm) return
        cloud.logout()
        self.updateCloudState()
        wx.showToast({ title: '已退出', icon: 'success' })
      }
    })
  },

  syncNow() {
    if (!cloud.isLogin()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const self = this
    wx.showLoading({ title: '同步中', mask: true })
    store.syncWithCloud().then(function (result) {
      wx.hideLoading()
      if (result && result.ok === false) {
        wx.showToast({ title: cloud.messageOf({ code: result.reason }), icon: 'none' })
        return
      }
      const map = { down: '已拉取云端最新数据', up: '本机数据已上传', none: '已是最新', up_failed: '上传失败，数据已存本机' }
      wx.showToast({ title: (result && map[result.direction]) || '同步完成', icon: 'none' })
      self.updateCloudState()
      self.refresh()
    })
  },

  /**
   * 云同步诊断：把三处手动配置逐项跑一遍，失败时给出对应修复动作。
   * ① 环境 ID（config.js）→ ② login 云函数（是否上传部署）→ ③ 数据库集合与权限
   */
  runDiag() {
    const self = this
    const set = function (k, v) {
      self.setData({ ['diag.' + k]: v })
    }
    this.setData({ diagRunning: true, diag: { env: '检查中…', fn: '等待', db: '等待' } })

    // ① 环境 ID
    if (!cloud.available()) {
      set('env', '✗ 未配置：请在 miniprogram/config.js 填入 cloudEnv')
      set('fn', '— 跳过')
      set('db', '— 跳过')
      this.setData({ diagRunning: false })
      return
    }
    set('env', '✓ ' + config.cloudEnv)

    // ② login 云函数（这一步会真实登录）
    cloud
      .login()
      .then(function (openid) {
        set('fn', '✓ 云函数正常')
        // ③ 数据库集合与权限（只读探测，无副作用）
        return cloud.pull().then(function (res) {
          set('db', res && res.found ? '✓ 可读写，云端已有数据' : '✓ 可读写（云端暂无数据，首次登录属正常）')
          // 登录态落到 store：迁移本地数据并双向同步
          store.ensureWechatUser(openid)
          return store.syncWithCloud()
        })
      })
      .then(function (result) {
        if (result && result.ok === false) throw { code: result.reason }
        const map = { down: '已从云端恢复数据', up: '本机数据已上传', none: '已是最新' }
        if (result && result.direction) set('db', self.data.diag.db + ' · ' + map[result.direction])
        self.setData({ diagRunning: false })
        self.updateCloudState()
        self.refresh()
      })
      .catch(function (e) {
        const raw = (e && e.raw) || {}
        const msg = raw.errMsg || raw.message || ''
        if (e && (e.code === 'LOGIN_FAILED' || e.code === 'CALL_FAILED')) {
          set('fn', '✗ 调用失败：请在开发者工具中右键 cloudfunctions/login → 上传并部署')
          set('db', '— 跳过')
        } else if (msg.indexOf('not exists') > -1) {
          set('db', '✗ 集合不存在：请在云开发控制台创建集合 lc_userdata')
        } else {
          set('db', '✗ 读写失败：' + (msg || cloud.messageOf(e)) + '（集合权限应为「仅创建者可读写」）')
        }
        self.setData({ diagRunning: false })
        self.updateCloudState()
      })
  },

  onUnload() {
    if (this.offPrivacy) this.offPrivacy()
  },

  onShow() {
    this.refresh()
    this.updateCloudState()
  },

  onHide() {
    store.flushSync()
  },

  onAgreePrivacy() {
    if (app && typeof app.acceptPrivacy === 'function') app.acceptPrivacy('agree-btn')
    this.setData({ showPrivacy: false })
  },

  onDisagreePrivacy() {
    if (app && typeof app.rejectPrivacy === 'function') app.rejectPrivacy()
    this.setData({ showPrivacy: false })
    wx.showToast({ title: '未授权，备份功能不可用', icon: 'none' })
  },

  openContract() {
    if (typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({
        fail() {
          wx.showToast({ title: '暂无法打开隐私指引', icon: 'none' })
        }
      })
    } else {
      wx.showToast({ title: '当前版本不支持，请在小程序后台查看', icon: 'none' })
    }
  },

  refresh() {
    const data = store.load()
    const today = time.todayStr()

    const views = model.stageViews(data.stages, today)
    let goalTotal = 0
    let goalDone = 0
    let activeCount = 0
    views.forEach(function (v) {
      if (v.status === 'active') activeCount += 1
    })
    data.stages.forEach(function (s) {
      s.goals.forEach(function (g) {
        goalTotal += 1
        if (g.done) goalDone += 1
      })
    })

    this.setData({
      stats: {
        stageCount: data.stages.length,
        activeCount: activeCount,
        goalTotal: goalTotal,
        goalDone: goalDone,
        goalPercent: goalTotal ? Math.round((goalDone / goalTotal) * 100) : 0,
        reminderCount: data.reminders.length
      },
      birthDate: data.settings.birthDate || '',
      lifeExpectancy: String(data.settings.lifeExpectancy || 80),
      life: model.lifeView(data.settings || {}, today),
      currentUser: store.activeUser(),
      userCount: store.listUsers().length
    })
  },

  onBirth(e) {
    const value = e.detail.value
    store.update(function (d) {
      d.settings.birthDate = value
    })
    this.refresh()
  },

  onExpect(e) {
    const value = e.detail.value
    this.setData({ lifeExpectancy: value })
    const n = Math.min(Math.max(Number(value) || 80, 1), 150)
    store.update(function (d) {
      d.settings.lifeExpectancy = n
    })
    this.refresh()
  },

  clearBirth() {
    store.update(function (d) {
      d.settings.birthDate = ''
    })
    this.refresh()
  },

  /* ---------- 数据导出 ---------- */
  openExport() {
    // 导出全部账户及其数据，可完整还原多账户结构
    const text = store.exportAll()
    this.setData({ exportText: text, showExport: true, exportPath: '' })
  },

  closeExport() {
    this.setData({ showExport: false })
  },

  noop() {},

  copyExport() {
    const self = this
    wx.setClipboardData({
      data: this.data.exportText,
      success() {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
        self.setData({ showExport: false })
      }
    })
  },

  saveExportFile() {
    const self = this
    const fs = wx.getFileSystemManager()
    const path = wx.env.USER_DATA_PATH + '/life-countdown-' + time.todayStr() + '.json'
    fs.writeFile({
      filePath: path,
      data: this.data.exportText,
      encoding: 'utf8',
      success() {
        self.setData({ exportPath: path })
        wx.showToast({ title: '已保存为文件', icon: 'success' })
      },
      fail() {
        wx.showToast({ title: '保存失败，请改用复制', icon: 'none' })
      }
    })
  },

  shareExportFile() {
    const path = this.data.exportPath
    if (!path) {
      wx.showToast({ title: '请先保存为文件', icon: 'none' })
      return
    }
    if (!wx.shareFileMessage) {
      wx.showToast({ title: '当前环境不支持转发', icon: 'none' })
      return
    }
    wx.shareFileMessage({
      filePath: path,
      fileName: 'life-countdown-backup.json',
      fail() {
        wx.showToast({ title: '转发失败', icon: 'none' })
      }
    })
  },

  /* ---------- 数据导入 ---------- */
  openImport() {
    const self = this
    wx.getClipboardData({
      success(res) {
        self.setData({ importText: res.data || '', showImport: true })
      },
      fail() {
        self.setData({ importText: '', showImport: true })
      }
    })
  },

  closeImport() {
    this.setData({ showImport: false })
  },

  onImportText(e) {
    this.setData({ importText: e.detail.value })
  },

  doImport() {
    const text = (this.data.importText || '').trim()
    if (!text) {
      wx.showToast({ title: '请先粘贴备份内容', icon: 'none' })
      return
    }
    const self = this
    // 先只识别格式，确认后才真正写入
    const result = store.probeImport(text)
    if (!result.ok) {
      const msg = result.reason === 'parse' ? '格式不正确，无法解析' : '不是有效的备份数据'
      wx.showToast({ title: msg, icon: 'none' })
      return
    }
    const content =
      result.scope === 'all'
        ? '识别为多账户完整备份，导入将覆盖全部账户数据，确定继续吗？'
        : '识别为单账户备份，将导入到当前账户并覆盖其数据，确定继续吗？'
    wx.showModal({
      title: '导入数据',
      content: content,
      success(res) {
        if (!res.confirm) return
        store.importData(text)
        self.setData({ showImport: false, importText: '' })
        wx.showToast({ title: '导入成功', icon: 'success' })
        self.refresh()
      }
    })
  },

  /* ---------- 示例数据 / 清空 ---------- */
  loadDemo() {
    const self = this
    wx.showModal({
      title: '载入示例数据',
      content: '将覆盖「' + (store.activeUser() || {}).nickname + '」的当前数据，其他账户不受影响，确定吗？',
      success(res) {
        if (!res.confirm) return
        store.replace(store.demoData())
        wx.showToast({ title: '已载入', icon: 'success' })
        self.refresh()
      }
    })
  },

  clearAll() {
    const self = this
    wx.showModal({
      title: '清空数据',
      content:
        '将删除「' + (store.activeUser() || {}).nickname + '」的全部阶段、目标与提醒，其他账户不受影响，且无法恢复，确定吗？',
      confirmColor: '#FF5A5F',
      success(res) {
        if (!res.confirm) return
        store.reset()
        wx.showToast({ title: '已清空', icon: 'success' })
        self.refresh()
      }
    })
  }
})
