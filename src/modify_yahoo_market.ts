import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const target3 = `    const url = "https://finance.yahoo.com/topic/stock-market-news/";
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });`;

const target3Replacement = target3 + `\n\n    // Handle random ad/newsletter popups
    await handleYahooPopups(page, addLog);`;

content = content.replace(target3, target3Replacement);

fs.writeFileSync('server.ts', content);
console.log('Modified server.ts with popup handler on market news');
