/** @type {import('ts-jest').JestConfigWithTsJest} */
    module.exports = {
        preset: 'ts-jest',
        testEnvironment: 'node',
        roots: ["./test/"],
        detectOpenHandles: true,
        forceExit: true // afip.test.ts detecta un openHandle
    };
