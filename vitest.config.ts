import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // jsdom 27+ loads @asamuzakjp/css-color via its CJS entry point, which
    // synchronously requires the pure-ESM @csstools/css-calc (ERR_REQUIRE_ESM).
    // --experimental-require-module (Node 22.0+, stable in 22.12) allows CJS
    // to synchronously require ES modules, resolving the crash.
    execArgv: ['--experimental-require-module'],
  },
});
