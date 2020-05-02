import 'vanilla-x/Object'
import ts from '@filipe.beck/typescript-x'
import webpack from 'webpack'
import os from 'os'
import path from 'path'
import Bundler from './Bundler'
import CompilationModule from './Module'
import { v4 as uuid } from 'uuid'

/**
 * Plugin que empacota as funções fechadas nos módulos, compilando-as de forma a tornarem elas independentes do resto do módulo. Útil quando há necessidade de serialização e execução em um escopo externo.
 */
export = class ClosedFunctionPlugin implements webpack.Plugin {
	/**
	 * Verifica se o módulo é Typescript e possui função fechada.
	 * @param module Módulo a ser testado.
	 */
	private static moduleIsTSAndHasClosedBlock(module: CompilationModule): boolean {
		const tsMatcher = /\.tsx?$/

		if (!tsMatcher.test(module.resource)) {
			return false
		}

		const closedBlockMatcher = /^\s*\$closed:\s*{/gm
		const moduleSource = ts.sys.readFile(module.resource)!

		return closedBlockMatcher.test(moduleSource)
	}

	/**
	 * Retorna as opções de compilação do arquivo original.
	 * @param searchPath Caminho base.
	 */
	private static getOriginalCompilerOptions(searchPath: string): ts.CompilerOptions {
		const compilerOptions = Array<ts.CompilerOptions>()
		let configOptions: any

		do {
			const configPath = configOptions && `${searchPath}.json` || ts.findConfigFile(searchPath, ts.sys.fileExists)!
			configOptions = ts.parseConfigFileTextToJson(configPath, ts.sys.readFile(configPath)!).config
			const { options, errors } = ts.convertCompilerOptionsFromJson(configOptions.compilerOptions, configPath)!

			if (errors.length) {
				throw errors
			}

			compilerOptions.push(options)

			if (configOptions.extends) {
				searchPath = path.resolve(configPath, '..', configOptions.extends)
			}
		}
		while (configOptions.extends)

		return compilerOptions.reverse().reduce((result, options) => result = { ...result, ...options }, {})
	}

	/** Empacotadores das funções fechadas. */
	private readonly bundlers = Array<Bundler>()

	/**
	 * Aplica o plugin.
	 * @param compiler Instância do compilador Webpack.
	 */
	public apply(compiler: webpack.Compiler): void {
		compiler.hooks.compilation.tap(ClosedFunctionPlugin.name, compilation => {
			const logger = compilation.getLogger(ClosedFunctionPlugin.name)

			compilation.hooks.buildModule.tap(ClosedFunctionPlugin.name, module => {
				const currentModule = module as unknown as CompilationModule

				if (ClosedFunctionPlugin.moduleIsTSAndHasClosedBlock(currentModule)) {
					const profileID = currentModule.resource
					logger.profile(profileID)

					const entryPath = currentModule.resource
					const outDir = path.resolve(os.tmpdir(), `${ClosedFunctionPlugin.name}-${uuid()}`)
					const compilerOptions = this.createCompilerOptions(entryPath, outDir)
					const webpackOptions = this.createWebpackConfiguration((compilation as any).options) as webpack.Configuration

					this.bundlers.push(new Bundler(currentModule, compilerOptions, webpackOptions))

					logger.profileEnd(profileID)
				}
			})

			compilation.hooks.finishModules.tapPromise(ClosedFunctionPlugin.name, async () => {
				await Promise.all(this.bundlers.splice(0).map(async bundler => {
					logger.profile(bundler.originalResource)
					const errors = await bundler.mount()

					if (errors) {
						compilation.errors.push(...errors)
					}

					logger.profileEnd(bundler.originalResource)
				}))
			})
		})
	}

	/**
	 * Cria as opções de compilação para as funções fechadas.
	 * @param entryPath Caminho de entrada da compilação.
	 * @param outputDirectory Diretório de saída da compilação.
	 */
	private createCompilerOptions(entryPath: string, outputDirectory: string): ts.CompilerOptions {
		const projectCompilerOptions = ClosedFunctionPlugin.getOriginalCompilerOptions(entryPath)
		const overriddenOptions: ts.CompilerOptions = {
			...projectCompilerOptions,
			baseUrl: path.resolve('.'),
			declaration: false,
			declarationMap: false,
			sourceMap: false,
			allowJs: true,
			checkJs: false,
			allowUnusedLabels: true,
			noUnusedLocals: false,
			noImplicitAny: false,
			noImplicitReturns: false,
			skipLibCheck: true,
			disableSolutionSearching: true,
			noEmitOnError: false,
			outDir: outputDirectory
		}

		return overriddenOptions
	}

	/**
	 * Cria as configurações para o Webpack.
	 * @param configuration Configuração base.
	 */
	private createWebpackConfiguration(configuration: webpack.Configuration): webpack.Configuration {
		return {
			...configuration,
			plugins: configuration.plugins?.filter(plugin => !plugin.xIs(ClosedFunctionPlugin))
		}
	}
}