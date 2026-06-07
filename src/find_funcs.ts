import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/server.ts', 'utf-8');
const localContent = fs.readFileSync('server.ts', 'utf-8');

// We can just use the typescript compiler API to find function declarations, but since we just want to compare, let's extract them manually or use regex carefully.
// A simpler way: Find blocks of `async function ...` or `function ...` or `const ... = async`
const funcRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g;
let match;
const repoFuncs = new Set();
while ((match = funcRegex.exec(repoContent)) !== null) {
  repoFuncs.add(match[1]);
}

const arrowFuncRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
while ((match = arrowFuncRegex.exec(repoContent)) !== null) {
  repoFuncs.add(match[1]);
}

console.log("Functions in repo:", Array.from(repoFuncs).join(', '));
