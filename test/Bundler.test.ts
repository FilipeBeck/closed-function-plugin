import Bundler from '../src/Bundler'
import path from 'path'
import ts from '@filipe.beck/typescript-x'

test('extractCodeForBundle', () => {
	const fileNameWith1Closed = path.resolve(__dirname, 'modules', 'module-with-closed.ts')
	const fileNameWith2Closed = path.resolve(__dirname, 'modules', 'module-with-2-closed.ts')
	const fileNameWithNoSingleClosedFRunction = path.resolve(__dirname, 'modules', 'module-with-no-single-closed-statement.ts')

	const moduleWith1Closed = ts.sys.readFile(fileNameWith1Closed)!
	const moduleWith2Closed = ts.sys.readFile(fileNameWith2Closed)!
	const moduleWithNoSingleClosedStatement = ts.sys.readFile(fileNameWithNoSingleClosedFRunction)!

	const sourceWith1Closed = ts.createSourceFile(fileNameWith1Closed, moduleWith1Closed, ts.ScriptTarget.ES2015, true)
	const sourceWith2Closed = ts.createSourceFile(fileNameWith2Closed, moduleWith2Closed, ts.ScriptTarget.ES2015, true)
	const sourceWithNoSingleClosedStatement = ts.createSourceFile(fileNameWithNoSingleClosedFRunction, moduleWithNoSingleClosedStatement, ts.ScriptTarget.ES2015, true)

	const returnWithClosed = Bundler.extractCodeForBundle(sourceWith1Closed)
	const handlerWith2Closed = () => Bundler.extractCodeForBundle(sourceWith2Closed)
	const handlerWithNoSingleClosedStatement = () => Bundler.extractCodeForBundle(sourceWithNoSingleClosedStatement)

	expect(returnWithClosed[0].length).toBe(2)
	expect(returnWithClosed[1]).toBeDefined()
	expect(handlerWith2Closed).toThrow()
	expect(handlerWithNoSingleClosedStatement).toThrow()
})