import { closedFunction } from './module-with-closed'

const now = Date.now()
const month = new Date(now).getMonth()

module.exports = closedFunction(now) === month && 'YES' || 'NO'
