import { getMonth } from './module-to-import'
import 'vanilla-x/Object'

export function noClosedFunction() {
	return 'Hello, i am not a closed function'
}

export function closedFunction(timestamp: number) {
	$closed: {
		const foo = async () => {

		}
		console.log(foo)
		return getMonth(timestamp)
	}
}

export function anotherNoClosedFunction() {
	return 'Hello, bla bla bla'
}