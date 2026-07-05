/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
};
