import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      enabled: true,
      provider: 'istanbul',
      include: ['lib/*.js'],
      reportsDirectory: '.coverage',
    },
  },
});
