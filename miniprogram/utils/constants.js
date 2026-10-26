const DIMENSIONS = [
  { key: 'year', label: '年' },
  { key: 'quarter', label: '季' },
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '天' }
]

const DIMENSION_LABEL = {
  year: '年',
  quarter: '季',
  month: '月',
  week: '周',
  day: '天'
}

const COLORS = [
  '#4C6FFF',
  '#7B5CFF',
  '#FF6B6B',
  '#FFA726',
  '#22C55E',
  '#06B6D4',
  '#EC4899',
  '#8B5CF6'
]

const LEVELS = [
  { key: 'important', label: '重要', color: '#FF5A5F' },
  { key: 'normal', label: '常规', color: '#4C6FFF' },
  { key: 'minor', label: '次要', color: '#8A94A6' }
]

const LEVEL_LABEL = { important: '重要', normal: '常规', minor: '次要' }
const LEVEL_COLOR = { important: '#FF5A5F', normal: '#4C6FFF', minor: '#8A94A6' }

const REMINDER_TYPES = [
  { key: 'once', label: '仅一次' },
  { key: 'daily', label: '每天' },
  { key: 'weekly', label: '每周' },
  { key: 'monthly', label: '每月' },
  { key: 'interval', label: '每间隔 N 天' }
]

const REMINDER_TYPE_LABEL = {
  once: '仅一次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  interval: '每间隔 N 天'
}

const WEEKDAY_OPTIONS = [
  { key: 1, label: '一' },
  { key: 2, label: '二' },
  { key: 3, label: '三' },
  { key: 4, label: '四' },
  { key: 5, label: '五' },
  { key: 6, label: '六' },
  { key: 7, label: '日' }
]

/** 新建阶段时的快捷模板：一键填入名称、维度、说明与示例目标 */
const TEMPLATES = [
  {
    key: 'year_growth',
    name: '本年 · 专注成长',
    dimension: 'year',
    color: '#4C6FFF',
    desc: '把一年拆成看得见的目标，一步一步走完。',
    goals: [
      { title: '读完 12 本书', level: 'important' },
      { title: '掌握一项新技能', level: 'normal' },
      { title: '整理一次相册', level: 'minor' }
    ]
  },
  {
    key: 'quarter_focus',
    name: '本季 · 夯实基础',
    dimension: 'quarter',
    color: '#7B5CFF',
    desc: '这一季只做三件事，做完就算赢。',
    goals: [
      { title: '完成核心项目上线', level: 'important' },
      { title: '每月一次复盘', level: 'normal' }
    ]
  },
  {
    key: 'month_habit',
    name: '本月 · 培养习惯',
    dimension: 'month',
    color: '#22C55E',
    desc: '用一个月养成一个能长期坚持的习惯。',
    goals: [
      { title: '早睡 20 天', level: 'important' },
      { title: '每周运动 3 次', level: 'normal' },
      { title: '每天记录一件小事', level: 'minor' }
    ]
  },
  {
    key: 'week_sprint',
    name: '本周 · 小步快跑',
    dimension: 'week',
    color: '#FFA726',
    desc: '一周内可完成的小目标，积累成就感。',
    goals: [
      { title: '写完周报', level: 'normal' },
      { title: '整理待办清单', level: 'minor' }
    ]
  },
  {
    key: 'day_focus',
    name: '今日 · 只做一件',
    dimension: 'day',
    color: '#FF6B6B',
    desc: '今天只专注最重要的一件事。',
    goals: [{ title: '完成最重要的一件事', level: 'important' }]
  }
]

module.exports = {
  DIMENSIONS,
  DIMENSION_LABEL,
  COLORS,
  LEVELS,
  LEVEL_LABEL,
  LEVEL_COLOR,
  REMINDER_TYPES,
  REMINDER_TYPE_LABEL,
  WEEKDAY_OPTIONS,
  TEMPLATES
}
