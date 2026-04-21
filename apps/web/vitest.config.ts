import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig(async () => {
  // Dynamic import required — @vitejs/plugin-react v5+ is ESM-only
  const { default: react } = await import('@vitejs/plugin-react');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
      exclude: [
        'node_modules',
        'dist',
        '.next',
        'e2e/**',
        'functions/**',
        '**/.claude/**',
      ],
    },
  };
});
