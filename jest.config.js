module.exports = {
  preset: 'jest-puppeteer',
  transform: {
    '\.ts$': "ts-jest"
  },
  testMatch: ['**/*.test.ts'],
  testTimeout: 20000
};