import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/server.ts', 'utf-8');
const localContent = fs.readFileSync('server.ts', 'utf-8');

const getImports = (content) => content.split('\n').filter(l => l.startsWith('import '));
const repoImports = getImports(repoContent);
const localImports = getImports(localContent);

for (const imp of repoImports) {
  if (!localImports.includes(imp)) {
    console.log("Missing import in local:", imp);
  }
}
