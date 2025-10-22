import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tokens/index': 'src/tokens/index.ts',
    'themes/index': 'src/themes/index.ts',
    'components/index': 'src/components/index.ts',
    'patterns/index': 'src/patterns/index.ts',
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  target: 'es2019',
  external: [
    'react',
    'react-dom',
    '@radix-ui/*',
    'lucide-react',
    'clsx',
    'class-variance-authority',
    'tailwind-merge',
    'tailwindcss-animate',
  ],
  treeshake: true,
  minify: false, // Laisse l'app consommatrice minifier
  metafile: true, // Pour analyser le bundle si besoin
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs',
    };
  },
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
  // Copie les fichiers CSS/assets
  onSuccess: async () => {
    const { copyFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');
    
    const stylesDir = join(process.cwd(), 'dist/styles');
    if (!existsSync(stylesDir)) {
      mkdirSync(stylesDir, { recursive: true });
    }
    
    // Copie globals.css si présent
    const srcGlobals = join(process.cwd(), 'src/styles/globals.css');
    if (existsSync(srcGlobals)) {
      copyFileSync(srcGlobals, join(stylesDir, 'globals.css'));
    }
    
    // Copie tokens.css généré
    const srcTokens = join(process.cwd(), 'src/styles/tokens.css');
    if (existsSync(srcTokens)) {
      copyFileSync(srcTokens, join(stylesDir, 'tokens.css'));
    }
  },
});
