import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['lib/*.js'],
      reportsDirectory: '.coverage',
    },
  },
});
