import ClosedFunctionPlugin from '../src/ClosedFunctionPlugin'
import webpack from 'webpack'
import fs from 'fs'
import path from 'path'

test('plugin test', async () => {
	expect.assertions(1)

	const entryFile = path.resolve(__dirname, 'entry-module.ts')
	const outDir = path.resolve(__dirname)
	const outFile = 'bundle.js'

	await new Promise((resolve, reject) => {
		const compiler = webpack({
			entry: entryFile,
			mode: 'none',
			module: {
				rules: [
					{
						test: /\.ts$/,
						loader: 'ts-loader'
					}
				]
			},
			resolve: {
				extensions: ['.js', '.ts']
			},
			plugins: [new ClosedFunctionPlugin()],
			output: {
				path: outDir,
				filename: outFile
			}
		})

		compiler.run((error, stats) => {
			if (error || stats.hasErrors()) {
				reject(error || stats.compilation.errors)
			}
			else {
				resolve()
			}
		})
	})

	const outPath = path.resolve(outDir, outFile)
	const outSource = fs.readFileSync(outPath, 'utf8')
	const returnMessage = await page.evaluate(outSource) as string

	expect(returnMessage).toBe('YES')
})