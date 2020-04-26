module.exports = {
  globals: {
    "ts-jest": {
      compiler: "@filipe.beck/typescript-x",
      tsConfig: "./test/tsconfig.json"
    }
  },
  preset: 'jest-puppeteer',
  transform: {
    '\.ts$': "ts-jest"
  },
  testMatch: ['**/*.test.ts'],
  testTimeout: 60000
}