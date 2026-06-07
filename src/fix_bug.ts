import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(
  'await takeScreenshot(',
  'await handleYahooPopups(page, addLog);\n    await takeScreenshot('
);

fs.writeFileSync('server.ts', content);
console.log('Added more popup checks');
