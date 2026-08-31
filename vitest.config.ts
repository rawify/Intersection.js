import { defineConfig } from 'vitest/config';

/**
 * Pure computational geometry: no DOM, no dependencies, nothing to stub. The
 * only configuration that matters is the coverage floor, which is a ratchet --
 * raise it when coverage rises, never lower it.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is a re-export barrel and types.ts is declarations only.
      exclude: ['src/index.ts', 'src/types.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
});
