import ts from '@filipe.beck/typescript-x'
import webpack from 'webpack'
import path from 'path'
import CompilationModule from './Module'
import { v4 as uuid } from 'uuid'

/**
 * @internal
 * Empacotador de funções fechadas.
 */
export default class Bundler implements ts.CompilerHost {
	/** Marcador a substituir as funções fechadas. A remoçao da função é útil para otimizar o fluxo dos loaders e a inserção do marcador é necessária para saber onde inserir o código "fechado" após o fluxo default. */
	private static closedPlaceHolder = `console.log('${uuid()}')`

	/** Extrai as sentenças relevantes para a compilação da função fechada. */
	private static extractCodeForBundle(sourceFile: ts.SourceFile): [ts.ImportDeclaration[], ts.FunctionLike | undefined] {
		const importStatements = Array<ts.ImportDeclaration>()
		let closedFunction: ts.FunctionLike | undefined

		extract(sourceFile)

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
						throw new Error('$closed must be the only statement of a function')
					}
					else if (closedFunction !== undefined) {
						throw new Error('$closed can only appear once in each file')
					}

					closedFunction = container.parent as ts.FunctionLike
				}
				else {
					extract(node)
				}
			})
		}
	}

	/** Caminho do arquivo original. Um novo caminho é estabelecido antes do fluxo dos loaders cujo conteúdo é o código com a função fechada já removida. */
	public readonly originalResource: string

	/** Módulo com as informações do arquivo. */
	private readonly module: CompilationModule

	/** Opções de compilação para o Typescript.  */
	private readonly compilerOptions: ts.CompilerOptions

	/** Opções de compilação para o Webpack. */
	private readonly webpackOptions: webpack.Configuration

	/** Programa criado no processo de compilação. */
	private readonly program: ts.Program

	/**
	 * Construtor.
	 * @param module Modulo com as informações do arquivo.
	 * @param compilerOptions Opções de compilação para o Typescript.
	 * @param webpackOptions Opções de compilação para o Webpack.
	 */
	constructor(module: CompilationModule, compilerOptions: ts.CompilerOptions, webpackOptions: webpack.Configuration) {
		this.module = module
		this.compilerOptions = compilerOptions
		this.webpackOptions = webpackOptions
		this.originalResource = module.resource
		this.program = ts.createProgram([this.module.resource], compilerOptions, this)
	}

	/**
	 * Compila e injeta a função fechada no módulo.
	 */
	public async mount(): Promise<Error[] | void> {
		const errors = this.assertErrors()

		if (errors.length) {
			return errors
		}

		this.program.emit()

		const webpackConfig: webpack.Configuration = {
			...this.webpackOptions,
			entry: this.getCompilationOutputPath(),
			resolve: {
				modules: [path.resolve('.', 'node_modules'), 'node_modules']
			},
			output: {
				path: this.program.getCompilerOptions().outDir!,
				filename: `bundle-${this.module._buildHash}.js`
			}
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
		const hash = this.originalResource
		const beginOfPlaceHolder = this.module._source._value.indexOf(Bundler.closedPlaceHolder)
		const endOfPlaceHolder = beginOfPlaceHolder + Bundler.closedPlaceHolder.length
		const prefix = this.module._source._value.substr(0, beginOfPlaceHolder)
		const posfix = this.module._source._value.substr(endOfPlaceHolder)
		const injection = `{
			if (!Object['${hash}']) {
				${bundleFileText}
				Object['${hash}'] = Object['${hash}'].bind(this)
			}

			return Object['${hash}'](...arguments)
		}`

		this.module._source._value = prefix + injection + posfix
	}

	// Métodos do host com funcionalidades inalteradas
	public getCurrentDirectory = ts.sys.getCurrentDirectory
	public getDefaultLibFileName = ts.getDefaultLibFileName
	public fileExists = ts.sys.fileExists
	public readFile = ts.sys.readFile
	public writeFile = ts.sys.writeFile
	public getNewLine = () => ts.sys.newLine
	public useCaseSensitiveFileNames = () => ts.sys.useCaseSensitiveFileNames
	public getCanonicalFileName = (fileName: string) => ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()

	/**
	 * Cria um arquivo fonte. Se houver uma função fechada, atualiza o recurso original e cria um arquivo fonte apenas com o código relevante para a função fechada.
	 * @param fileName Nome do arquivo.
	 * @param languageVersion Versão da linguagem.
	 * @param _onError Manipulador de erro.
	 */
	public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, _onError?: (message: string) => void): ts.SourceFile {
		if (fileName.startsWith('lib.') && fileName.endsWith('.d.ts')) {
			fileName = path.join((ts as any).getDirectoryPath((ts as any).normalizePath(ts.sys.getExecutingFilePath())), fileName)
		}

		let outputSourceFile = ts.createSourceFile(fileName, ts.sys.readFile(fileName)!, languageVersion, true)

		if (fileName === this.module.resource) {
			const [importStatements, closedFunction] = Bundler.extractCodeForBundle(outputSourceFile)

			if (closedFunction) {
				const newResourcePath = path.resolve(this.compilerOptions.outDir!, `stripped-resource-${uuid()}.ts`)
				const closedFunctionBody = (closedFunction as ts.FunctionExpression).body
				const importsText = importStatements.map(stm => `// @ts-ignore\n${stm.getText()}`).join('\n')
				const preffixText = `${outputSourceFile.text.substring(importStatements.xLast.end, closedFunction.getStart())}// @ts-ignore\n`
				const preClosedText = outputSourceFile.text.substring(closedFunction.getStart(), closedFunctionBody.getStart() + 1)
				const posClosedText = outputSourceFile.text.substring(closedFunctionBody.getEnd() - 1)
				const newResourceText = importsText + preffixText + preClosedText + Bundler.closedPlaceHolder + posClosedText
				const closedImports = importStatements.map(imp => imp.getText()).join('\n')
				const newSourceText = `${closedImports}Object['${this.originalResource}'] = ${closedFunction.getText().replace(/^export\s+(default\s+)?/, '')}`

				outputSourceFile = ts.createSourceFile(fileName, newSourceText, languageVersion)
				this.module.resource = newResourcePath

				ts.sys.writeFile(newResourcePath, newResourceText)
			}
		}

		return outputSourceFile
	}

	/**
	 * Extrai possíveis erros da variáveis não declaradas.
	 */
	private assertErrors(): Error[] {
		const notFoundNameDiagnostics = ts.getPreEmitDiagnostics(this.program).filter(d => d.category === ts.DiagnosticCategory.Error && d.code === 2304)
		return notFoundNameDiagnostics.map(d => new Error(`closed block of "${d.file!.fileName}": ${d.messageText}. WARNING: A closed block cannot capture anything outside its scope`))
	}

	/**
	 * Retorna o caminho do arquivo compilado
	 */
	private getCompilationOutputPath(): string {
		const outputFiles = (ts as any).getFileEmitOutput(this.program).outputFiles as Array<{ name: string }>
		const resourcePathComponents = this.originalResource.replace(/\.tsx?$/, '.js').split(path.sep).reverse()
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