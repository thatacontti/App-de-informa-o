import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['node_modules', 'dist', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@painel/connectors': path.resolve(__dirname, '../../packages/connectors/src'),
      '@painel/jobs': path.resolve(__dirname, '../../packages/jobs/src'),
      '@painel/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
