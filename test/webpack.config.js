const wp = require('webpack')
const path = require('path')
const ClosedFunctionPlugin = require('../app/ClosedFunctionPlugin')

/** @type {wp.Configuration} */
const config = {
	entry: path.resolve(__dirname, 'entry-module.ts'),
	mode: 'production',
	module: {
		rules: [{ test: /\.ts$/, loader: 'ts-loader' }]
	},
	resolve: {
		extensions: ['.js', '.ts']
	},
	plugins: [new ClosedFunctionPlugin()],
	output: {
		path: path.resolve(__dirname),
		filename: 'generated-bundle.js'
	}
}

module.exports = config