import { defineConfig } from 'vitest/config';
import path from 'path';

// Rodar da raiz do repo: npx vitest@2 run --config tests/vitest.config.ts
export default defineConfig({
  root: path.resolve(__dirname, '..'),
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
