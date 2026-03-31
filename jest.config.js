module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/*.test.js'],
    collectCoverageFrom: [
        'kml-parser.js',
        '!node_modules/**',
        '!coverage/**'
    ],
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
