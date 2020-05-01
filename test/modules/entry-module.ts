import { closedFunction, noClosedFunction, anotherNoClosedFunction } from './module-with-closed'
import moment from 'moment'

function hello(msg1: string, msg2: string) {
	console.log(msg1, msg2)
}

hello(noClosedFunction(), anotherNoClosedFunction())
const now = moment(Date.now()).milliseconds()
const month = moment(now).month()

const MESSAGE = closedFunction(now) === month && 'YES' || 'NO'

export default MESSAGE
