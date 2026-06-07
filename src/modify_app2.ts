import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/setYahooSessionId/g, 'setYahooCookies');
content = content.replace(/saveYahooSessionId/g, 'saveYahooCookies');
content = content.replace(/isYahooSessionSaved/g, 'isYahooCookiesSaved');
content = content.replace(/setIsYahooSessionSaved/g, 'setIsYahooCookiesSaved');

const btnRemoveRegex = /<button[^>]*onClick=\{handleYahooLogin\}[^>]*>[\s\S]*?<\/button>/;
content = content.replace(btnRemoveRegex, '');

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx refined.');
