import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/yahooSessionId/g, 'yahooCookies');
content = content.replace(/yahoo_session_id/g, 'yahoo_cookies');
content = content.replace(/Yahoo Finance \(A3 Cookie\)/g, 'Yahoo Finance Cookies');
content = content.replace(/Pegar Cookie A3/g, 'Pegar arreglo JSON de cookies');

// Remove handleYahooLogin completely
const funcStart = content.indexOf('const handleYahooLogin = async () => {');
if (funcStart !== -1) {
  // Find the end of this function. It uses `setLogs`, `setIsLoading(false)`, `setGlobalProgress(100)` etc.
  // Then closes with `};`
  
  const nextFuncStart = content.indexOf('const runAutomation = async', funcStart);
  if (nextFuncStart !== -1) {
    // Just find the `};` before `const runAutomation`
    const funcEnd = content.lastIndexOf('};', nextFuncStart) + 2;
    content = content.substring(0, funcStart) + content.substring(funcEnd);
  } else {
      console.log('Could not find next func after handleYahooLogin');
  }
} else {
    console.log('Could not find handleYahooLogin');
}

// Remove the button
const btnStart = content.indexOf('onClick={handleYahooLogin}');
if (btnStart !== -1) {
    const btnTagStart = content.lastIndexOf('<button', btnStart);
    const btnTagEnd = content.indexOf('</button>', btnStart) + 9;
    content = content.substring(0, btnTagStart) + content.substring(btnTagEnd);
} else {
    console.log('Could not find button handleYahooLogin');
}

fs.writeFileSync('src/App.tsx', content);
console.log('Modifications done to src/App.tsx');
