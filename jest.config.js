/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
    silent: false,
    verbose: true,
    testEnvironment: "jest-environment-jsdom",
    moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testPathIgnorePatterns: ["/node_modules/"],
    testRegex: ".*.(test|spec).(j|t)s[x]?$",
    transform: {
        "^.+\\.(js|jsx|ts|tsx)$": [
            "esbuild-jest",
            {
                sourcemap: true,
            },
        ],
    },
};

module.exports = config;
