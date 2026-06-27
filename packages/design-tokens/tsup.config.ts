import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [],
  onSuccess: async () => {
    // Copier les fichiers CSS dans dist après build
    const distDir = join(process.cwd(), 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    const files = [
      { src: 'src/styles/tokens.css', dest: 'dist/tokens.css' },
    ];
    
    files.forEach(({ src, dest }) => {
      const srcPath = join(process.cwd(), src);
      const destPath = join(process.cwd(), dest);
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath);
        console.log(`📋 Copied: ${src} → ${dest}`);
      }
    });
  },
});
