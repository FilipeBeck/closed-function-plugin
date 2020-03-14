import webpack from 'webpack'

export default interface CompilationModule extends webpack.Module, webpack.compilation.Module {
	resource: string
	_buildHash: string
	rawRequest: string
	dependencies: Dependency[]
	removeDependency(dependency: Dependency): void
}

export interface Dependency {
	module: CompilationModule | null
	loc: SourceLocation
}

export interface SourceLocation {
	start: Position
	end: Position
}

export interface Position {
	line: number
	column: number
}