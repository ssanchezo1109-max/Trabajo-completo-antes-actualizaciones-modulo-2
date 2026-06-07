import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

// remove all occurrences of `await handleYahooPopups(page, addLog);`
content = content.replace(/await handleYahooPopups\(page, addLog\);/g, '');

// remove the definition of `handleYahooPopups`
// It is between `async function handleYahooPopups(page: any, addLog: Function) {`
// and the final `}\n` before `async function scrapeYahooTickerNews(`
const startIdx = content.indexOf('async function handleYahooPopups');
const endIdx = content.indexOf('async function scrapeYahooTickerNews(');
if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + content.substring(endIdx);
}

// remove the ESC key logic added previously
// "await page.keyboard.press('Escape');"
const escLogic = `    // Send ESC key as a general modal killer
    try {
      addLog("[YAHOO] Enviando tecla Escape (ESC) para intentar cerrar modales...");
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 1000));
    } catch(e) {}`;

content = content.replace(escLogic, '');

fs.writeFileSync('server.ts', content);
console.log('Removed Yahoo popup logic');
