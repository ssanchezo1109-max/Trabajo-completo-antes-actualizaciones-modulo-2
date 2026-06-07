import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const tSearch = `addLog(\`[YAHOO] Taking storyboard step3 screenshot: quote page loaded...\`);`;
const tReplace = `await handleYahooPopups(page, addLog);\n    addLog(\`[YAHOO] Taking storyboard step3 screenshot: quote page loaded...\`);`;

content = content.replace(tSearch, tReplace);

fs.writeFileSync('server.ts', content);
console.log('Added an immediate check before step 3 screen');
