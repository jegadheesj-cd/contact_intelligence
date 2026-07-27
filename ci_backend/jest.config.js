/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  rootDir: '.',
  testRegex: '.*\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    'src/jobs/**/*.ts',
    'src/utils/**/*.ts',
  ],
  coverageDirectory: './coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
