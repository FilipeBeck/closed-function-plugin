import { getMonth } from './module-to-import'

export function noClosedFunction() {
	return 'Hello, i am not a closed function'
}

export function closedFunction(timestamp: number) {
	$closed: {
		return getMonth(timestamp)
	}
}