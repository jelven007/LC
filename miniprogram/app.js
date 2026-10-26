const store = require('./utils/store')
const cloud = require('./utils/cloud')

App({
  onLaunch() {
    store.load()
    // 恢复上次登录态；同步在后台进行，不阻塞启动
    if (cloud.available() && cloud.restore()) {
      store.ensureWechatUser(cloud.getOpenid())
      store.syncWithCloud()
    }
    this.initPrivacy()
  },

  onShow() {
    store.load()
  },

  onHide() {
    store.flushSync()
  },

  globalData: {
    store: store,
    needPrivacy: false,
    privacyResolve: null,
    privacyHandlers: []
  },

  /** 微信隐私协议：调用剪贴板等隐私接口前需用户同意 */
  initPrivacy() {
    const self = this
    if (typeof wx.onNeedPrivacyAuthorization !== 'function') return
    wx.onNeedPrivacyAuthorization(function (resolve) {
      self.globalData.needPrivacy = true
      self.globalData.privacyResolve = resolve
      self.globalData.privacyHandlers.slice().forEach(function (fn) {
        try {
          fn()
        } catch (e) {
          /* ignore */
        }
      })
    })
  },

  /** 注册「需要隐私授权」回调，返回取消注册函数 */
  onPrivacyNeeded(fn) {
    this.globalData.privacyHandlers.push(fn)
    if (this.globalData.needPrivacy) fn()
    const handlers = this.globalData.privacyHandlers
    return function off() {
      const i = handlers.indexOf(fn)
      if (i > -1) handlers.splice(i, 1)
    }
  },

  /** 用户同意授权，需回传同意按钮的 id 告知平台 */
  acceptPrivacy(buttonId) {
    const resolve = this.globalData.privacyResolve
    this.clearPrivacy()
    if (resolve) {
      try {
        resolve({ buttonId: buttonId || 'agree-btn', event: 'agree' })
      } catch (e) {
        /* ignore */
      }
    }
  },

  /** 用户拒绝授权 */
  rejectPrivacy() {
    const resolve = this.globalData.privacyResolve
    this.clearPrivacy()
    if (resolve) {
      try {
        resolve({ event: 'disagree' })
      } catch (e) {
        /* ignore */
      }
    }
  },

  clearPrivacy() {
    this.globalData.needPrivacy = false
    this.globalData.privacyResolve = null
  }
})
