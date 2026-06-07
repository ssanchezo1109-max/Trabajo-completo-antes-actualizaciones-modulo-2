import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/server.ts', 'utf-8');
const localContent = fs.readFileSync('server.ts', 'utf-8');

function extractFuncBody(content, funcName) {
  // Try async function
  let search = `async function ${funcName}(`;
  let startIdx = content.indexOf(search);
  if (startIdx === -1) {
    search = `function ${funcName}(`;
    startIdx = content.indexOf(search);
  }
  if (startIdx === -1) {
    search = `const ${funcName} =`;
    startIdx = content.indexOf(search);
  }
  if (startIdx === -1) return null;
  
  let braceCount = 0;
  let started = false;
  let endIdx = -1;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      started = true;
    } else if (content[i] === '}') {
      braceCount--;
    }
    
    if (started && braceCount === 0) {
      endIdx = i + 1;
      break;
    }
  }
  return content.substring(startIdx, endIdx);
}

const funcs = ["analyzeMarketData", "getYahooVerificationCode", "loginToYahooFinance", "scrapeYahooMarketNews", "scrapeYahooTickerNews", "humanMoveAndClick", "humanType", "getTradingViewSessionId", "addTradingViewIndicator", "captureTradingViewScreenshots", "getOrCreateFolder", "updateGoogleDocText", "updateGoogleDocImages", "startServer", "checkAuth", "addLog", "sendEvent", "sendProgress", "takeScreenshot", "clickElementFully", "checkLogin", "hideObstructiveUI", "cleanupRuntimeErrors"];

for (const f of funcs) {
  const rf = extractFuncBody(repoContent, f);
  const lf = extractFuncBody(localContent, f);
  if (!rf) console.log(f, "missing in repo");
  else if (!lf) console.log(f, "missing in local");
  else if (rf === lf) console.log(f, "is identical");
  else console.log(f, "differs! lengths -> repo:", rf.length, "local:", lf.length);
}
