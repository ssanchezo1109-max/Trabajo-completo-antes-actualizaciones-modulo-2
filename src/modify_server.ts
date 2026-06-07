import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Global replaces
content = content.replace(/yahooSessionId/g, 'yahooCookies');

// Rewrite loginToYahooFinance logic
content = content.replace(
  /customSessionId\?: string/g,
  'customCookies?: string'
);

content = content.replace(
  /if \(customSessionId\) \{/g,
  'if (customCookies) {'
);

const oldLogic = `    addLog("[YAHOO] Applying provided Yahoo Session ID (A3 cookie)...");
    try {
      await page.setCookie(
        {
          name: "A3",
          value: customCookies,
          domain: ".yahoo.com",
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "None",
        },
        {
          name: "A3",
          value: customCookies,
          domain: ".finance.yahoo.com",
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "None",
        },
      );`;

const newLogic = `    addLog("[YAHOO] Applying provided Yahoo cookies block...");
    try {
      await applyCookiesToPage(page, customCookies, addLog);`;

content = content.replace(oldLogic, newLogic);

// Wait, the message on failed authentication:
content = content.replace(
  /\[YAHOO\] Warning: Proveyó un Session ID de Yahoo pero la sesión no fue detectada/g,
  '[YAHOO] Warning: Proveyó un bloque de cookies de Yahoo pero la sesión no fue detectada'
);

content = content.replace(
  /\[YAHOO\] Session successfully authenticated using custom A3 Session ID./g,
  '[YAHOO] Session successfully authenticated using custom cookies block.'
);


// Also let's check for the old endpoint handler:
// app.post("/api/yahoo/login-manual" ...
// We need to remove it.
const manualLoginStart = content.indexOf('app.post("/api/yahoo/login-manual"');
if (manualLoginStart !== -1) {
  let depth = 0;
  let endIdx = -1;
  let started = false;
  for (let i = manualLoginStart; i < content.length; i++) {
    if (content[i] === '{') {
      depth++;
      started = true;
    } else if (content[i] === '}') {
      depth--;
      if (started && depth === 0) {
        endIdx = i + 2; // } + \n or something
        break;
      }
    }
  }
  if (endIdx !== -1) {
    content = content.substring(0, manualLoginStart) + content.substring(endIdx);
  }
}

fs.writeFileSync('server.ts', content);
console.log('Modified server.ts');
