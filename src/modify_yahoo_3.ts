import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const tSearch = `addLog(
      \`[YAHOO] Looking for "view more" headlines button in the sidebar...\`,
    );`;

const tReplace = `await handleYahooPopups(page, addLog);
    addLog(
      \`[YAHOO] Looking for "view more" headlines button in the sidebar...\`,
    );`;

if(content.includes(tSearch)) {
    content = content.replace(tSearch, tReplace);
}

fs.writeFileSync('server.ts', content);
console.log('Added an immediate check before step 4');
