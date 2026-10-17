import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // tsup 8.5.1 force `baseUrl: "."` dans sa compilation des déclarations, que TS 6
  // refuse (TS5101, option dépréciée). Exemption limitée à ce build, pas au tsconfig.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
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
