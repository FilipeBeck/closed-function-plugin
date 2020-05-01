import moment from 'moment'

export function getMonth(timestamp: number) {
	return moment(timestamp).month()
}