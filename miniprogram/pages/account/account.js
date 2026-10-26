const store = require('../../utils/store')
const cloud = require('../../utils/cloud')

function fmtDate(ts) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

Page({
  data: {
    current: null,
    users: [],
    showCreate: false,
    newName: '',
    showRename: false,
    renameId: '',
    renameName: '',
    cloudReady: false,
    isLogin: false,
    openidTail: '',
    syncHint: ''
  },

  onShow() {
    this.refresh()
  },

  onHide() {
    store.flushSync()
  },

  doLogin() {
    if (!cloud.available()) {
      wx.showModal({
        title: '云同步未启用',
        content: '需要在 miniprogram/config.js 中填入云开发环境 ID，并在开发者工具里上传部署 login 云函数。在此之前，全部功能可离线正常使用。',
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
        const map = { down: '已恢复云端数据', up: '本机数据已上传', none: '登录成功' }
        wx.showToast({ title: (result && map[result.direction]) || '登录成功', icon: 'success' })
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
        wx.showToast({ title: '已退出', icon: 'success' })
        self.refresh()
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
      self.refresh()
    })
  },

  refresh() {
    const id = cloud.getOpenid() || ''
    const ok = cloud.isLogin()
    const list = store.listUsers()
    const current = store.activeUser()
    const users = list.map(function (u) {
      const s = store.spaceStats(u.id)
      return {
        id: u.id,
        nickname: u.nickname,
        avatarText: u.avatarText,
        createdText: fmtDate(u.createdAt),
        stageCount: s.stageCount,
        reminderCount: s.reminderCount,
        goalCount: s.goalCount,
        isCurrent: !!current && u.id === current.id
      }
    })
    this.setData({
      users: users,
      current: current,
      showCreate: false,
      newName: '',
      cloudReady: cloud.available(),
      isLogin: ok,
      openidTail: id ? id.slice(-6) : '',
      syncHint: ok
        ? '修改内容会在 2 秒后自动上传，也可点上方按钮手动同步'
        : cloud.available()
          ? '登录后数据自动跨设备同步，且仅你本人可见'
          : '云环境未配置，当前为本地模式'
    })
  },

  openCreate() {
    this.setData({ showCreate: true, newName: '' })
  },

  hideCreate() {
    this.setData({ showCreate: false, newName: '' })
  },

  noop() {},

  onNewName(e) {
    this.setData({ newName: e.detail.value })
  },

  confirmCreate() {
    const name = (this.data.newName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入用户名称', icon: 'none' })
      return
    }
    store.createUser(name)
    wx.showToast({ title: '已创建并切换', icon: 'success' })
    this.refresh()
  },

  switchTo(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.current && id === this.data.current.id) return
    const self = this
    wx.showModal({
      title: '切换用户',
      content: '切换后所有页面会显示该用户的数据，确定吗？',
      success(res) {
        if (!res.confirm) return
        store.switchUser(id)
        wx.showToast({ title: '已切换', icon: 'success' })
        self.refresh()
      }
    })
  },

  openRename(e) {
    const id = e.currentTarget.dataset.id
    const u = this.data.users.filter(function (x) {
      return x.id === id
    })[0]
    this.setData({ showRename: true, renameId: id, renameName: u ? u.nickname : '' })
  },

  hideRename() {
    this.setData({ showRename: false, renameId: '', renameName: '' })
  },

  onRenameInput(e) {
    this.setData({ renameName: e.detail.value })
  },

  confirmRename() {
    const name = (this.data.renameName || '').trim()
    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    store.renameUser(this.data.renameId, name)
    wx.showToast({ title: '已重命名', icon: 'success' })
    this.setData({ showRename: false })
    this.refresh()
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const self = this
    wx.showModal({
      title: '删除用户',
      content: '将永久删除「' + name + '」的全部阶段、目标与提醒，无法恢复，确定吗？',
      confirmColor: '#FF5A5F',
      success(res) {
        if (!res.confirm) return
        const ok = store.removeUser(id)
        if (!ok) {
          wx.showToast({ title: '至少需要保留一个用户', icon: 'none' })
          return
        }
        wx.showToast({ title: '已删除', icon: 'success' })
        self.refresh()
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '生命倒计时 · 多账户管理，各自的时间账本互不打扰',
      path: '/pages/today/today'
    }
  },

  onShareTimeline() {
    return { title: '生命倒计时 · 看见时间，管理人生节奏' }
  }
})
