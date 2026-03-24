const js = require("@eslint/js");

const nodeGlobals = {
  require: "readonly",
  module: "writable",
  exports: "writable",
  __dirname: "readonly",
  __filename: "readonly",
  process: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  Promise: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
  AbortSignal: "readonly",
  console: "readonly",
  global: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  Headers: "readonly",
  Response: "readonly"
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  location: "readonly",
  Audio: "readonly",
  Image: "readonly",
  fetch: "readonly",
  AbortSignal: "readonly",
  AbortController: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  Promise: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  FormData: "readonly",
  console: "readonly",
  alert: "readonly",
  confirm: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  EventSource: "readonly",
  MutationObserver: "readonly",
  IntersectionObserver: "readonly",
  ResizeObserver: "readonly",
  performance: "readonly",
  btoa: "readonly",
  atob: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly"
};

module.exports = [
  // Ignore vendored code and build output
  {
    ignores: ["vendor/**", "dist/**", "node_modules/**", "scripts/**"]
  },

  // Node.js source files
  {
    files: ["src/main.js", "src/server.js", "src/preload.js", "src/lib/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      ...js.configs.recommended.rules,
      // Relax rules that are intentional patterns in this codebase
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }], // empty catch {} is used intentionally
      "no-constant-condition": "error",
      "no-unreachable": "error",
      "no-control-regex": "off", // intentional: used to strip control chars from filenames
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "warn"
    }
  },

  // Browser renderer files
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...browserGlobals, ...nodeGlobals }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": "error",
      "no-unreachable": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "warn"
    }
  },

  // Test files
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...nodeGlobals,
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": "off"
    }
  }
];
