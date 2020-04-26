import { closedFunction, noClosedFunction, anotherNoClosedFunction } from './module-with-closed'

function hello(msg1: string, msg2: string) {
	console.log(msg1, msg2)
}

hello(noClosedFunction(), anotherNoClosedFunction())
const now = Date.now()
const month = new Date(now).getMonth()

const MESSAGE = closedFunction(now) === month && 'YES' || 'NO'

export default MESSAGE
