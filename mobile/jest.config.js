module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', '^@tms/shared$': '<rootDir>/../shared/src' },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
