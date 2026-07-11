/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/ai-core/tests/**/*.test.ts', '<rootDir>/ai-core/tests/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
