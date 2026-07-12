module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/api/**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tests/tsconfig.test.json' }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/mobile/$1',
    '^@ahh-wfm/types$': '<rootDir>/packages/types/src',
    '^@ahh-wfm/mock-data$': '<rootDir>/packages/mock-data/src'
  },
  rootDir: '../',
  setupFiles: ['<rootDir>/tests/api/setup.ts']
};
