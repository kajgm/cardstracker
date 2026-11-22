import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'games/**/*.test.ts', 'server/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
