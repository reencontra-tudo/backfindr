import { defineConfig } from 'vitest/config';
import path from 'path';

// Rodar da raiz do repo: npx vitest@2 run --config tests/vitest.config.ts
export default defineConfig({
  root: path.resolve(__dirname, '..'),
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  // fileParallelism desligado: as suítes de integração recriam tabelas no mesmo banco de teste.
  test: { include: ['tests/**/*.test.ts'], environment: 'node', fileParallelism: false },
});
