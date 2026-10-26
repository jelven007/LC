const config = require('../config')

const DATA_COLLECTION = 'lc_userdata'
const OPENID_KEY = 'lc_openid'

let inited = false
let openid = ''

function env() {
  return (config && config.cloudEnv) || ''
}

/** 云开发是否已可用（配置了环境 ID 且基础库支持） */
function available() {
  return typeof wx !== 'undefined' && typeof wx.cloud === 'object' && !!env()
}

function init() {
  if (inited) return available()
  if (!available()) return false
  try {
    wx.cloud.init({ env: env(), traceUser: true })
    inited = true
  } catch (e) {
    return false
  }
  return true
}

function makeError(code, raw) {
  const e = new Error(code)
  e.code = code
  e.raw = raw
  return e
}

/** 恢复上次登录态：openid 本身不是敏感信息，可安全存本地 */
function restore() {
  if (openid) return openid
  if (!available()) return ''
  try {
    openid = wx.getStorageSync(OPENID_KEY) || ''
  } catch (e) {
    openid = ''
  }
  return openid
}

function getOpenid() {
  return openid || restore()
}

function isLogin() {
  return !!getOpenid()
}

/**
 * 微信登录：调用 login 云函数取回 openid。
 * 云函数内由微信完成身份鉴权，本端不接触 AppSecret，也不接触 session_key。
 */
function login() {
  return new Promise(function (resolve, reject) {
    if (!init()) {
      reject(makeError('NOT_CONFIGURED'))
      return
    }
    wx.cloud.callFunction({
      name: 'login',
      success(res) {
        const r = res && res.result
        if (r && r.ok && r.openid) {
          openid = r.openid
          try {
            wx.setStorageSync(OPENID_KEY, openid)
          } catch (e) {
            /* ignore */
          }
          resolve(openid)
        } else {
          reject(makeError('LOGIN_FAILED', r))
        }
      },
      fail(raw) {
        reject(makeError('CALL_FAILED', raw))
      }
    })
  })
}

function logout() {
  openid = ''
  try {
    wx.removeStorageSync(OPENID_KEY)
  } catch (e) {
    /* ignore */
  }
}

function isNotFound(raw) {
  const msg = (raw && (raw.errMsg || raw.message)) || ''
  return msg.indexOf('not exists') > -1 || msg.indexOf('ResourceNotFound') > -1
}

/** 拉取云端数据。文档不存在时返回 found:false，不算错误 */
function pull() {
  const id = getOpenid()
  if (!id) return Promise.reject(makeError('NOT_LOGIN'))
  if (!init()) return Promise.reject(makeError('NOT_CONFIGURED'))

  return new Promise(function (resolve, reject) {
    wx.cloud
      .database()
      .collection(DATA_COLLECTION)
      .doc(id)
      .get({
        success(res) {
          const d = res && res.data
          if (d && d.payload) {
            resolve({ found: true, payload: d.payload, updatedAt: d.updatedAt || 0 })
          } else {
            resolve({ found: false, payload: null, updatedAt: 0 })
          }
        },
        fail(raw) {
          if (isNotFound(raw)) resolve({ found: false, payload: null, updatedAt: 0 })
          else reject(makeError('PULL_FAILED', raw))
        }
      })
  })
}

/** 推送本地数据。以 openid 为文档 _id，不存在则自动创建 */
function push(payload) {
  const id = getOpenid()
  if (!id) return Promise.reject(makeError('NOT_LOGIN'))
  if (!init()) return Promise.reject(makeError('NOT_CONFIGURED'))

  return new Promise(function (resolve, reject) {
    wx.cloud
      .database()
      .collection(DATA_COLLECTION)
      .doc(id)
      .set({
        data: { payload: payload, updatedAt: Date.now() },
        success() {
          resolve(true)
        },
        fail(raw) {
          reject(makeError('PUSH_FAILED', raw))
        }
      })
  })
}

/** 云端可用的错误文案 */
function messageOf(err) {
  if (!err) return ''
  switch (err.code) {
    case 'NOT_CONFIGURED':
      return '尚未配置云开发环境，当前为本地模式'
    case 'NOT_LOGIN':
      return '请先登录'
    case 'LOGIN_FAILED':
    case 'CALL_FAILED':
      return '登录失败，请确认 login 云函数已上传部署'
    case 'PULL_FAILED':
    case 'PUSH_FAILED':
      return '网络异常，数据已保存在本机'
    default:
      return '操作失败'
  }
}

module.exports = {
  DATA_COLLECTION,
  available,
  init,
  restore,
  login,
  logout,
  isLogin,
  getOpenid,
  pull,
  push,
  messageOf
}
