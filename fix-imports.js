import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

async function fixImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await fixImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = await readFile(fullPath, 'utf-8');
      
      // Adiciona .js aos imports relativos
      content = content.replace(
        /from ['"](\.[^'"]*)['"]/g,
        (match, path) => {
          if (!path.endsWith('.js')) {
            return `from '${path}.js'`;
          }
          return match;
        }
      );
      
      // Adiciona .js aos imports dinâmicos
      content = content.replace(
        /import\(['"](\.[^'"]*)['"]\)/g,
        (match, path) => {
          if (!path.endsWith('.js')) {
            return `import('${path}.js')`;
          }
          return match;
        }
      );
      
      await writeFile(fullPath, content, 'utf-8');
    }
  }
}

fixImports(distDir).then(() => {
  console.log('✅ Fixed all imports with .js extension');
}).catch(err => {
  console.error('❌ Error fixing imports:', err);
  process.exit(1);
});
