Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    noop() {},

    onAgree() {
      this.triggerEvent('agree')
    },

    onDisagree() {
      this.triggerEvent('disagree')
    },

    /** 打开后台配置的《小程序用户隐私保护指引》 */
    openContract() {
      if (typeof wx.openPrivacyContract !== 'function') {
        wx.showToast({ title: '当前版本不支持查看', icon: 'none' })
        return
      }
      wx.openPrivacyContract({
        fail() {
          wx.showToast({ title: '暂无法打开隐私指引', icon: 'none' })
        }
      })
    }
  }
})
