/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts', 'tsx'],
  testRegex: '.*\.spec\.ts$',
  transform: {
    '^.+\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: true,
      },
    ],
    // The AI SDK ships ESM only (CHAT_SUPPORT.md §2.5): its files are compiled to CommonJS for the specs.
    '^.+\.m?js$': [
      'ts-jest',
      {
        tsconfig: { allowJs: true, module: 'commonjs', target: 'ES2023', esModuleInterop: true },
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm/)?(ai|@ai-sdk\\+[^/]+|@ai-sdk|@workflow\\+[^/]+|@workflow|workers-ai-provider|eventsource-parser)[@/])',
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.(t|j)s'],
};
