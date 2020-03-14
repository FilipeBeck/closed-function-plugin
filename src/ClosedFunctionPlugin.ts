import 'vanilla-x/Object'
import ts from 'typescript'
import webpack from 'webpack'
import os from 'os'
import path from 'path'
import Bundler from './Bundler'

export default class ClosedFunctionPlugin implements webpack.Plugin {
	/** Caminho do arquivo "tsconfig.json" do projeto. */
	private readonly tsConfigPath = ts.findConfigFile('.', ts.sys.fileExists)!

	/** Opções de compilação do projeto. */
	private readonly tsCompilerOptions: ts.CompilerOptions = ts.parseConfigFileTextToJson(this.tsConfigPath, ts.sys.readFile(this.tsConfigPath)!).config.compilerOptions

	/** Cache dos módulos compilados. */
	// private compiledModules: Dictionary<{ hash: string, source: string }>

	/**
	 * Aplica o plugin.
	 * @param compiler Instância do compilador webpack.
	 */
	public apply(compiler: webpack.Compiler): void {
		compiler.hooks.compilation.tap(ClosedFunctionPlugin.name, compilation => {
			compilation.hooks.finishModules.tapPromise(ClosedFunctionPlugin.name, async modules => {
				const modulesWithClosedBlocks = modules.filter(module => Bundler.moduleIsTSAndHasClosedBlock(module))
				const logger = compilation.getLogger(ClosedFunctionPlugin.name)

				await Promise.all(modulesWithClosedBlocks.map(async module => {
					const profileID = `${ClosedFunctionPlugin.name}-${(module as any)._buildHash}`
					logger.profile(profileID)

					const outDir = path.resolve(os.tmpdir(), `${ClosedFunctionPlugin.name}-${(module as Bundler['module'])._buildHash}`)
					const errors = await new Bundler(module, this.createCompilerOptions(outDir)).mount()

					if (errors) {
						compilation.errors.push(...errors)
					}

					logger.profileEnd(profileID)
				}))
			})

			compilation.hooks.optimizeDependencies.tap(ClosedFunctionPlugin.name, modules => {
				const modulesWithClosedBlocks = modules.filter(module => Bundler.moduleIsTSAndHasClosedBlock(module))
				const removedDependencies = Array<any>()

				for (const module of modulesWithClosedBlocks) {
					const codeLines = module._source._value.split('\n') as string[]
					const dependencies = (module as any).dependencies.slice().filter((dep: any) => dep.module) as any[]
					
					for (const dependency of dependencies) {
						const rangedLines = codeLines.slice(dependency.loc.start.line - 1, dependency.loc.end.line)
						let rangedCode: string

						if (rangedLines.length === 1) {
							rangedCode = rangedLines.xFirst.substring(dependency.loc.start.column, dependency.loc.end.column)
						}
						else {
							const rangedFirst = rangedLines.shift()!.substr(dependency.start.column)
							const rangedLast = rangedLines.pop()!.substring(0, dependency.loc.end.column)
							rangedCode = rangedLast && `${rangedFirst}\n${rangedLines.join('\n')}\n${rangedLast}`
						}

						if (!rangedCode.includes(dependency.module.rawRequest)) {
							(module as any).removeDependency(dependency)
							removedDependencies.push(dependency)
						}
					}

					for (const dependency of (module as any).dependencies.slice()) {
						if (removedDependencies.find(dep => dep.loc.start.line === dependency.loc.start.line && dep.loc.start.column === dependency.loc.start.column)) {
							(module as any).removeDependency(dependency)
						}
					}
				} 
			})
		})
	}

	private createCompilerOptions(outputDirectory: string): ts.CompilerOptions {
		const overriddenOptions: ts.CompilerOptions = {
			...this.tsCompilerOptions.xClone(),
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
			// removeComments: true,
			outDir: outputDirectory,
			target: ts.ScriptTarget.ESNext
		}

		return overriddenOptions
	}
}