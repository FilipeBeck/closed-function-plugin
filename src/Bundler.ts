import ts from 'typescript'
import webpack from 'webpack'
import path from 'path'
import CompilationModule from './Module'

/**
 * @internal
 * Extrator e empacotador de funções fechadas.
 */
export default class Bundler implements ts.CompilerHost {
	public static moduleIsTSAndHasClosedBlock(module: CompilationModule): boolean {
		const tsMatcher = /\.tsx?$/
		const resource = module.resource

		if (!tsMatcher.test(resource)) {
			return false
		}

		const closedBlockMatcher = /^\s*\$closed:\s*{/gm
		const moduleSource = ts.sys.readFile(resource)!

		return closedBlockMatcher.test(moduleSource)
	}

	private module: CompilationModule
	private program: ts.Program
	private entrySourceFile: ts.SourceFile | null = null
	private closedSourceFile: ts.SourceFile | null = null
	private entryFunction: ts.FunctionLike | null = null

	constructor(module: CompilationModule, compilerOptions: ts.CompilerOptions) {
		this.module = module
		this.program = ts.createProgram([this.module.resource], compilerOptions, this)
	}

	public async mount(): Promise<Error[] | void> {
		const errors = this.assertErrors()

		if (errors.length) {
			return errors
		}

		this.program.emit()

		if (!this.entrySourceFile || !this.closedSourceFile || !this.entryFunction) {
			throw new Error('Erro interno: propriedades de `Bundler` não foram todas inicializadas')
		}

		const webpackConfig: webpack.Configuration = {
			entry: this.getOutputFilePath(),
			mode: 'none',
			resolve: {
				modules: [path.resolve('.', 'node_modules'), 'node_modules']
			},
			output: {
				path: this.program.getCompilerOptions().outDir!,
				filename: `bundle-${this.module._buildHash}.js`
			},
			// optimization: {
			// 	providedExports: true,
			// 	usedExports: true,
			// 	sideEffects: true
			// }
		}

		await new Promise((resolve, reject) => {
			webpack(webpackConfig, (error, stats) => {
				if (error || stats.hasErrors()) {
					reject(error || stats.compilation)
				}
				else {
					resolve()
				}
			})
		})

		const bundlePath = path.resolve(webpackConfig.output?.path!, webpackConfig.output!.filename as string)
		const bundleFileText = this.readFile(bundlePath) as string
		const entryFunctionBody = (this.entryFunction as ts.FunctionExpression).body
		const hash = this.module._buildHash
		const injection = `{
			let module = Object['${hash}']

			if (!module) {
				module = Object['${hash}'] = ${bundleFileText}
			}

			return module.default(...arguments)
		}`
		
		const completeSourceText = this.entrySourceFile.getText().replace(entryFunctionBody.getText(), injection)
		const transpiledSource = ts.transpileModule(completeSourceText, { compilerOptions: this.program.getCompilerOptions() })
		
		this.module._source._value = transpiledSource.outputText
	}

	public getCurrentDirectory: ts.CompilerHost['getCurrentDirectory'] = ts.sys.getCurrentDirectory
	public getDefaultLibFileName: ts.CompilerHost['getDefaultLibFileName'] = ts.getDefaultLibFileName
	public fileExists: ts.CompilerHost['fileExists'] = ts.sys.fileExists
	public readFile: ts.CompilerHost['readFile'] = ts.sys.readFile
	public writeFile: ts.CompilerHost['writeFile'] = ts.sys.writeFile

	public getNewLine(): string {
		return ts.sys.newLine
	}

	public useCaseSensitiveFileNames(): boolean {
		return ts.sys.useCaseSensitiveFileNames
	}

	public getCanonicalFileName(fileName: string): string {
		return ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()
	}

	public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, _onError?: (message: string) => void): ts.SourceFile {
		if (fileName.startsWith('lib.') && fileName.endsWith('.d.ts')) {
			fileName = path.join((ts as any).getDirectoryPath((ts as any).normalizePath(ts.sys.getExecutingFilePath())), fileName)
		}

		let outputSourceFile = ts.createSourceFile(fileName, ts.sys.readFile(fileName)!, languageVersion, true)

		if (fileName === this.module.resource && Bundler.moduleIsTSAndHasClosedBlock(this.module)) {
			this.entrySourceFile = outputSourceFile
			const [importStatements, closedFunction] = this.extractCodeForBundle()

			if (closedFunction) {
				const closedImports = importStatements.map(imp => imp.getText()).join('\n')
				const newSourceText = closedImports + '\export default ' + closedFunction.getText().replace(/^export\s+(default\s+)?/, '')

				this.closedSourceFile = outputSourceFile = ts.createSourceFile(fileName, newSourceText, languageVersion)
				this.entryFunction = closedFunction
			}
		}

		return outputSourceFile
	}

	private extractCodeForBundle(): [ts.ImportDeclaration[], ts.FunctionLike | undefined] {
		if (this.entrySourceFile === null) {
			throw new Error('Sem arquivo fonte para realizar a extração')
		}

		const importStatements = Array<ts.ImportDeclaration>()
		let closedFunction: ts.FunctionLike | undefined

		extract(this.entrySourceFile)

		return [importStatements, closedFunction]

		function extract(container: ts.Node): void {
			ts.forEachChild(container, node => {
				if (ts.isImportDeclaration(node)) {
					importStatements.push(node)
				}
				else if (ts.isLabeledStatement(node) && node.label.text === '$closed') {
					const containerIsBodyOfFunction = ts.isBlock(container) && ts.isFunctionLike(container.parent)
					const containerHasSingleStatement = containerIsBodyOfFunction && (container as ts.Block).statements.length == 1

					if (!containerIsBodyOfFunction || !containerHasSingleStatement) {
						throw new Error('$closed precisa ser a única sentença de uma função')
					}
					else if (closedFunction !== undefined) {
						throw new Error('$closed só pode aparecer uma vez em cada arquivo')
					}

					closedFunction = container.parent as ts.FunctionLike
				}
				else {
					extract(node)
				}
			})
		}
	}

	private assertErrors(): Error[] {
		const notFoundNameDiagnostics = ts.getPreEmitDiagnostics(this.program).filter(d => d.category === ts.DiagnosticCategory.Error && d.code === 2304)
		return notFoundNameDiagnostics.map(d => new Error(`closed block of "${d.file!.fileName}": ${d.messageText}`))
	}

	private getOutputFilePath(): string {
		const outputFiles = (ts as any).getFileEmitOutput(this.program).outputFiles as Array<{ name: string }>
		const resourcePathComponents = this.module.resource.replace(/\.tsx?$/, '.js').split(path.sep).reverse()
		let outputPathComponents = Array<string>()

		for (const outFile of outputFiles) {
			const components = outFile.name.split(path.sep).reverse()
			const firstDiff = resourcePathComponents.findIndex((c, i) => c !== components[i])

			if (firstDiff > outputPathComponents.length) {
				outputPathComponents = components.slice(0, firstDiff)
			}
		}

		const outDir = this.program.getCompilerOptions().outDir!
		const relativeOutput = outputPathComponents.reverse().join(path.sep)

		return path.resolve(outDir, relativeOutput)
	}
}