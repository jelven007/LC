/**
 * 分享文案统一生成
 *
 * 口径注意：只陈述「已完成的时间统计」，不做生存期预测、不制造焦虑，
 * 否则易被判定为传播迷信/诱导焦虑而驳回。
 */

const TITLE_BASE = '生命倒计时 · 看见时间，管理人生节奏'

function appMessage(life) {
  let title = TITLE_BASE
  if (life && life.has) {
    // 文案口径：只陈述「已完成的时间统计」，不做生存期预测、不制造焦虑
    title = '人生进度 ' + life.percent + '%，把时间放进清晰的规划里'
  }
  return {
    title: title,
    path: '/pages/today/today'
  }
}

function timeline() {
  return {
    title: TITLE_BASE,
    query: ''
  }
}

/** 阶段分享：带上阶段名与进度 */
function stageMessage(stageView) {
  if (!stageView) return appMessage(null)
  return {
    title: '我在「' + stageView.name + '」进度 ' + stageView.percent + '%，一起来规划吧',
    path: '/pages/today/today'
  }
}

module.exports = {
  TITLE_BASE,
  appMessage,
  timeline,
  stageMessage
}
