import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

async function _isDirectory(path) {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fixImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await fixImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = await readFile(fullPath, 'utf-8');
      const fileDir = dirname(fullPath);

      // Adiciona .js aos imports relativos
      const importRegex = /from ['"](\.[^'"]*)['"]/g;
      let match;
      const replacements = [];

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (!importPath.endsWith('.js')) {
          const resolvedPath = resolve(fileDir, importPath);
          const jsPath = `${resolvedPath}.js`;
          const indexPath = join(resolvedPath, 'index.js');

          let newPath = importPath;
          if (existsSync(indexPath)) {
            newPath = `${importPath}/index.js`;
          } else if (existsSync(jsPath)) {
            newPath = `${importPath}.js`;
          }

          replacements.push({
            old: match[0],
            new: `from '${newPath}'`,
          });
        }
      }

      // Aplica as substituições
      for (const replacement of replacements) {
        content = content.replace(replacement.old, replacement.new);
      }

      // Adiciona .js aos imports dinâmicos
      content = content.replace(/import\(['"](\.[^'"]*)['"]\)/g, (match, path) => {
        if (!path.endsWith('.js')) {
          return `import('${path}.js')`;
        }
        return match;
      });

      await writeFile(fullPath, content, 'utf-8');
    }
  }
}

fixImports(distDir)
  .then(() => {
    console.log('✅ Fixed all imports with .js extension');
  })
  .catch((err) => {
    console.error('❌ Error fixing imports:', err);
    process.exit(1);
  });
