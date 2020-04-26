export function noSingleClosed() {
	let x = 10

	$closed: {
		x *= 2
	}

	console.log(x)
}