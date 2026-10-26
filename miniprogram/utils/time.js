const DAY = 86400000
const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日']

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function toStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function parse(s) {
  if (!s) return null
  const p = String(s).split('-')
  if (p.length < 3) return null
  const y = Number(p[0])
  const m = Number(p[1])
  const d = Number(p[2])
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function todayStr() {
  return toStr(new Date())
}

function nowTime() {
  const d = new Date()
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/** 日期 -> 天序号（UTC 计算，避免夏令时/时区误差） */
function dayNum(s) {
  const d = parse(s)
  if (!d) return NaN
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY)
}

/** b - a，相差天数 */
function diffDays(a, b) {
  return dayNum(b) - dayNum(a)
}

function addDays(s, n) {
  const d = parse(s)
  if (!d) return ''
  d.setDate(d.getDate() + Number(n))
  return toStr(d)
}

function addMonths(s, n) {
  const d = parse(s)
  if (!d) return ''
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + Number(n), 1)
  const dim = daysInMonth(target.getFullYear(), target.getMonth() + 1)
  target.setDate(Math.min(day, dim))
  return toStr(target)
}

function addYears(s, n) {
  return addMonths(s, Number(n) * 12)
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}

/** 1 = 周一 ... 7 = 周日 */
function weekday(s) {
  const d = parse(s)
  if (!d) return 0
  const w = d.getDay()
  return w === 0 ? 7 : w
}

function weekdayCN(n) {
  return WEEK_CN[n - 1] || ''
}

/** 所在周的周一 */
function startOfWeek(s) {
  return addDays(s, -(weekday(s) - 1))
}

function endOfWeek(s) {
  return addDays(startOfWeek(s), 6)
}

function startOfMonth(s) {
  const d = parse(s)
  if (!d) return ''
  return toStr(new Date(d.getFullYear(), d.getMonth(), 1))
}

function endOfMonth(s) {
  const d = parse(s)
  if (!d) return ''
  return toStr(new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth() + 1)))
}

function startOfQuarter(s) {
  const d = parse(s)
  if (!d) return ''
  const m = Math.floor(d.getMonth() / 3) * 3
  return toStr(new Date(d.getFullYear(), m, 1))
}

function endOfQuarter(s) {
  const d = parse(s)
  if (!d) return ''
  const m = Math.floor(d.getMonth() / 3) * 3 + 2
  return toStr(new Date(d.getFullYear(), m, daysInMonth(d.getFullYear(), m + 1)))
}

function startOfYear(s) {
  const d = parse(s)
  if (!d) return ''
  return toStr(new Date(d.getFullYear(), 0, 1))
}

function endOfYear(s) {
  const d = parse(s)
  if (!d) return ''
  return toStr(new Date(d.getFullYear(), 11, 31))
}

function fmtCN(s) {
  const d = parse(s)
  if (!d) return ''
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

function fmtShort(s) {
  const d = parse(s)
  if (!d) return ''
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

function fmtDot(s) {
  const d = parse(s)
  if (!d) return ''
  return (d.getMonth() + 1) + '.' + d.getDate()
}

function maxDate(a, b) {
  return dayNum(a) >= dayNum(b) ? a : b
}

function timeToMinutes(t) {
  const p = String(t || '00:00').split(':')
  return Number(p[0]) * 60 + Number(p[1] || 0)
}

function dayOfYear(s) {
  const d = parse(s)
  if (!d) return 0
  return Math.floor(diffDays(toStr(new Date(d.getFullYear(), 0, 1)), s)) + 1
}

function daysInYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365
}

module.exports = {
  DAY,
  WEEK_CN,
  pad,
  toStr,
  parse,
  todayStr,
  nowTime,
  dayNum,
  diffDays,
  addDays,
  addMonths,
  addYears,
  daysInMonth,
  weekday,
  weekdayCN,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  fmtCN,
  fmtShort,
  fmtDot,
  maxDate,
  timeToMinutes,
  dayOfYear,
  daysInYear
}
