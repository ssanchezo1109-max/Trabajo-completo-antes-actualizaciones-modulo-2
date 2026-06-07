import fs from 'fs';

const appTsx = 'src/App.tsx';
let content = fs.readFileSync(appTsx, 'utf-8');

// 1. Add state variable
const stateIdx = content.indexOf('const [notebookLMUrl, setNotebookLMUrl] = useState');
const insertionOfState = `  const [yahooMarketNewsUrl, setYahooMarketNewsUrl] = useState(() => {
    return localStorage.getItem('yahoo_market_news_url') || '';
  });
`;

if (stateIdx !== -1) {
  content = content.substring(0, stateIdx) + insertionOfState + content.substring(stateIdx);
}

// 2. Persist in handleRunAnalysisProcess
const persistIdx = content.indexOf("localStorage.setItem('notebook_lm_url', notebookLMUrl);");
if (persistIdx !== -1) {
  content = content.substring(0, persistIdx) + "localStorage.setItem('yahoo_market_news_url', yahooMarketNewsUrl);\n      " + content.substring(persistIdx);
}

// Ensure we get the body in fetch:
const bodyMatch = content.match(/body: JSON\.stringify\(\{([\s\S]*?)notebookLMUrl,([\s\S]*?)\}\),/);
if (bodyMatch) {
    content = content.replace(bodyMatch[0], bodyMatch[0].replace('notebookLMUrl,', 'notebookLMUrl,\n          yahooMarketNewsUrl,'));
}

// 4. Add the input field next to NotebookLM Url
const inputDivIdx = content.indexOf('<span>URL DEL BLOC DE NOTEBOOKLM</span>');
if (inputDivIdx !== -1) {
   let startDivIdx = content.lastIndexOf('<div', inputDivIdx);
   if (startDivIdx !== -1) {
        // find end of this div
        const endSearchStr = '/>\\n                </div>';
        
        let endDivIdx = content.indexOf('</div>', inputDivIdx + 100);
        if (endDivIdx !== -1) {
            endDivIdx += 6; // length of '</div>'
            
            const newInputField = `
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                    <span>URL YAHOO FINANCE MARKET NEWS</span>
                    <span className="text-[8px] text-slate-500 font-bold">OPCIONAL</span>
                  </label>
                  <input
                    type="text"
                    value={yahooMarketNewsUrl}
                    onChange={(e) => setYahooMarketNewsUrl(e.target.value)}
                    placeholder="https://finance.yahoo.com/news/stock-market-today..."
                    className="w-full bg-slate-900/80 border border-slate-800 shadow-inner rounded-md px-2.5 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#f97316] transition-all"
                  />
                </div>
`;
            content = content.substring(0, endDivIdx) + newInputField + content.substring(endDivIdx);
        }
   }
}

fs.writeFileSync(appTsx, content);
console.log('App.tsx updated');
