const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const USERS = 'lc_users'
const USERDATA = 'lc_userdata'

/**
 * 自动建库 + 设权限（云端管理员权限可做到，免去人工去控制台创建集合）。
 * - lc_userdata：仅创建者可读写（小程序客户端按自己的 openid 读写自己的文档）
 * - lc_users：仅管理端可读写（只被本云函数以管理员身份访问）
 * 全部幂等：集合已存在 / 权限已设好时直接跳过，失败也不阻塞登录。
 */
async function ensureCollections() {
  const RW = { read: 'doc._openid == auth.uid', write: 'doc._openid == auth.uid' }
  const PRIVATE = { read: 'false', write: 'false' }

  for (const name of [USERDATA, USERS]) {
    try {
      await db.createCollection(name)
    } catch (e) {
      // 已存在等错误忽略（createCollection 幂等）
    }
  }

  try {
    await db.setCollectionPermission({ collection: USERDATA, permission: RW })
  } catch (e) {}
  try {
    await db.setCollectionPermission({ collection: USERS, permission: PRIVATE })
  } catch (e) {}
}

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

  // 首次登录自动把数据库集合建好并设对权限（非阻塞）
  try {
    await ensureCollections()
  } catch (e) {}

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
