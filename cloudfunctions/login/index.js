const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const USERS = 'lc_users'

/**
 * 微信登录。
 * 注意：云函数里通过 cloud.getWXContext() 直接拿到调用者的 openid，
 * 微信已在云端完成身份鉴权，因此这里不需要、也绝不应该出现 AppSecret。
 */
exports.main = async () => {
  const ctx = cloud.getWXContext()
  const openid = ctx.OPENID

  if (!openid) {
    return { ok: false, reason: 'no_openid' }
  }

  const now = Date.now()

  try {
    // 以 openid 作为文档 _id，天然保证一个微信用户只有一条记录
    const exists = await db
      .collection(USERS)
      .doc(openid)
      .get()
      .then(() => true)
      .catch(() => false)

    if (exists) {
      await db
        .collection(USERS)
        .doc(openid)
        .update({ data: { lastLoginAt: now } })
    } else {
      await db.collection(USERS).add({
        data: {
          _id: openid,
          createdAt: now,
          lastLoginAt: now
        }
      })
    }
  } catch (e) {
    // 用户表写入失败不阻塞登录本身，openid 仍然返回
    return { ok: true, openid: openid, appid: ctx.APPID, userRecord: false }
  }

  return { ok: true, openid: openid, appid: ctx.APPID, userRecord: true }
}
