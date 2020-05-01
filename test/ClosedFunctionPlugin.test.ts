import ClosedFunctionPlugin from '../src/ClosedFunctionPlugin'
import path from 'path'
import pack from 'packteer'
import ts from 'typescript'

test('moduleIsTSAndHasClosedBlock', () => {
	const moduleWithClosedResource = path.resolve(__dirname, 'modules', 'module-with-closed.ts')
	const moduleWithNoClosedResource = path.resolve(__dirname, 'modules', 'module-to-import.ts')
	const noTsResource = path.resolve(__dirname, 'webpack.config.js')

	const moduleWithClosedReturn = ClosedFunctionPlugin.moduleIsTSAndHasClosedBlock({ resource: moduleWithClosedResource } as any)
	const moduleWithNoClosedReturn = ClosedFunctionPlugin.moduleIsTSAndHasClosedBlock({ resource: moduleWithNoClosedResource } as any)
	const noTsModuleReturn = ClosedFunctionPlugin.moduleIsTSAndHasClosedBlock({ resource: noTsResource } as any)

	expect(moduleWithClosedReturn).toBeTruthy()
	expect(moduleWithNoClosedReturn).toBeFalsy()
	expect(noTsModuleReturn).toBeFalsy()
})

test('getOriginalCompilerOptions', () => {
	const entryConfigResource = path.resolve(__dirname, 'compiler-options', 'sub', 'tsconfig.json')
	const mergedCompilerOptions = ClosedFunctionPlugin.getOriginalCompilerOptions(entryConfigResource)

	const expectedCompilerOptions: ts.CompilerOptions = {
		outDir: '/tmp',
		target: ts.ScriptTarget.ES2015,
		allowJs: true,
		composite: true,
		baseUrl: "/home"
	}

	for (const [key, value] of expectedCompilerOptions) {
		expect(mergedCompilerOptions).toHaveProperty(key, value)
	}
})

test('apply', async () => {
	expect.assertions(1)

	const entryFile = path.resolve(__dirname, 'modules', 'entry-module.ts')
	const defaultConfiguration = {
		module: {
			rules: [
				{
					test: /\.ts$/,
					loader: 'ts-loader',
					options: {
						compiler: "@filipe.beck/typescript-x"
					}
				}
			]
		},
		libraryExport: 'default'
	}

	await Promise.all([
		pack(page, { NONE_MODE_MESSAGE: entryFile }, {
			...defaultConfiguration,
			mode: 'none',
			plugins: [new ClosedFunctionPlugin()],
		}),
		pack(page, { DEVELOPMENT_MODE_MESSAGE: entryFile }, {
			...defaultConfiguration,
			mode: 'development',
			plugins: [new ClosedFunctionPlugin()],
		}),
		pack(page, { PRODUCTION_MODE_MESSAGE: entryFile }, {
			...defaultConfiguration,
			mode: 'production',
			plugins: [new ClosedFunctionPlugin()],
		})
	])

	const returnMessages = await page.evaluate(() => [
		(window as any).NONE_MODE_MESSAGE,
		(window as any).DEVELOPMENT_MODE_MESSAGE,
		(window as any).PRODUCTION_MODE_MESSAGE
	]) as string[]

	expect(returnMessages).toEqual(['YES', 'YES', 'YES'])
})