import { defineConfig } from 'tsdown';

// Both formats: the backend is CommonJS (require), the frontend bundles ESM.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  platform: 'neutral',
  target: 'es2022',
});
