module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    // Kök klasörde ikinci bir React kopyası var; testler tek kopya kullansın (aksi halde "Invalid hook call").
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^@/(.*)$': '<rootDir>/src/$1', '^@tms/shared$': '<rootDir>/../shared/src' },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};
