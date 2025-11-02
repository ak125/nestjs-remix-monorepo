import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'components/alert': 'src/components/alert.tsx',
    'components/badge': 'src/components/badge.tsx',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@fafa/design-tokens', '@radix-ui/react-dialog', '@radix-ui/react-slot'],
});
