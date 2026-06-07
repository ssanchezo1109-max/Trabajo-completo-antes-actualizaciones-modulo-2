import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf-8');

// 1. Add var to destruction
content = content.replace(
  '    notebookLMCookies,',
  '    yahooMarketNewsUrl,\n    notebookLMCookies,'
);

// 2. Add URL support to yahoo logic
const startTarget = '// Única estrategia requerida: Búsqueda en Google de "stock market today yahoo finance"';
const endTarget = '      if (targetUrl) {';

const startIdx = content.indexOf(startTarget);
const endIdx = content.indexOf(endTarget);

if (startIdx !== -1 && endIdx !== -1) {
    const originalGoogleLogic = content.substring(startIdx + startTarget.length, endIdx);
    
    const newLogic = `// Única estrategia requerida: Url directa o Búsqueda en Google de "stock market today yahoo finance"
    try {
      let targetUrl = yahooMarketNewsUrl;
      
      if (targetUrl) {
          addLog(\`[YAHOO] Ingresando directo a la URL provista: \${targetUrl}\`);
      } else {
        addLog("[YAHOO] No se proveyó link directo. Buscando en Google 'stock market today yahoo finance'...");
        try {
          await searchPage.goto("https://www.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
        } catch (e: any) {
          addLog(\`[YAHOO] Advertencia al cargar Google (\${e.message || 'timeout'}), continuando...\`);
        }

        try {
          const rejectBtn = await searchPage.$('button[id="W0wltc"], button:has-text("Reject all")');
          if (rejectBtn) {
            await rejectBtn.click();
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (e) {}

        await searchPage.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 15000 });
        await searchPage.type('textarea[name="q"], input[name="q"]', "stock market today yahoo finance");
        await searchPage.keyboard.press("Enter");
        
        try {
          await searchPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 });
        } catch (e) {
          addLog("[YAHOO] Advertencia: Carga de resultados de Google superó el tiempo...");
        }

        const firstLinkSelector = 'a[href*="finance.yahoo.com"]';
        await searchPage.waitForSelector(firstLinkSelector, { timeout: 20000 }).catch(e=>addLog("[YAHOO] WARNING: Selector de links no apareció en Google"));

        targetUrl = await searchPage.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
          
          const validAnchors = anchors.filter(a => {
              const href = a.href || "";
              // Buscar que sea de finance.yahoo.com, descarta traducciones e historias chinas simuladas
              return href.includes("finance.yahoo.com") && !href.includes("translate.google") && !href.includes("webcache.google") && href.startsWith("http");
          });

          // Buscar uno que INICIAR en su título con "Stock market today"
          const specificMatch = validAnchors.find(a => {
              const txt = (a.innerText || "").trim().toLowerCase();
              return txt.startsWith("stock market today");
          });
          
          if (specificMatch) {
              return specificMatch.href;
          }

          // Si no hay especifico, retornar el segundo
          if (validAnchors.length > 1) {
              return validAnchors[1].href;
          } else if (validAnchors.length > 0) {
              return validAnchors[0].href;
          }

          return null; // fallaremos en caso de nada
        });
      }

      if (targetUrl) {`;

    content = content.substring(0, startIdx) + newLogic + content.substring(endIdx + endTarget.length);
    fs.writeFileSync(serverFile, content);
    console.log('Server modified');
} else {
    console.log('Targets not found');
    console.log('startIdx', startIdx);
    console.log('endIdx', endIdx);
}
