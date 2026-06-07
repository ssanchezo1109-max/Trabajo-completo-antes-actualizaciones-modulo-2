import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf-8');

const targetStartText = '    // Estrategia 1: Acceso Directo a Yahoo Finance Stock Market News';
const targetEndText = '    addLog("[DRIVE] Buscando o creando archivo \\\'a a material de studio mercado\\\'...");';

const startIdx = content.indexOf(targetStartText);
const endIdx = content.indexOf(targetEndText);
// if not found, use something else:
const altTargetEndText = 'addLog("[DRIVE] Buscando o creando archivo';
const altEndIdx = content.indexOf(altTargetEndText);


if (startIdx !== -1 && altEndIdx !== -1) {
  const replacement = `    // Única estrategia requerida: Búsqueda en Google de "stock market today yahoo finance"
    try {
      addLog("[YAHOO] Buscando en Google 'stock market today yahoo finance'...");
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

      const targetUrl = await searchPage.evaluate(() => {
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

      if (targetUrl) {
        addLog(\`[YAHOO] Artículo seleccionado en Google: \${targetUrl}. Cargando contenido...\`);
        await searchPage.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        
        // Wait specifically to let dynamic coverages load
        await new Promise(r => setTimeout(r, 5000));

        const extracted = await searchPage.evaluate(() => {
          const heading = document.querySelector('h1')?.innerText || document.title || "Yahoo Finance News";
          const paragraphs: string[] = [];
          
          // Capturar todos los elementos relevantes
          const allElements = Array.from(document.querySelectorAll('p, li, h2, h3, div[class*="content"], div[class*="body"]')); 
          for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) continue; // skip hidden elements
              
              const text = ((el as HTMLElement).innerText || "").trim();
              if (!text || text.length < 25) continue;
              
              paragraphs.push(text);
              if (text.toLowerCase().includes("live coverage is over")) {
                   break;
              }
          }
          
          // Eliminar duplicados para que sea más limpio
          const uniqueParagraphs = Array.from(new Set(paragraphs));
          return { title: heading, paragraphs: uniqueParagraphs };
        });

        if (extracted && extracted.paragraphs.length > 0) {
          scrapeData = extracted;
          scrapedSuccessfully = true;
          addLog(\`[YAHOO] Éxito vía Google. Artículo: "\${scrapeData.title}" (\${scrapeData.paragraphs.length} elementos extraídos).\`);
        } else {
          addLog(\`[YAHOO] Se cargó página \${targetUrl} pero no se encontraron párrafos textuales útiles.\`);
        }
      } else {
        addLog("[YAHOO] No se encontró ningún resultado en la búsqueda de Google.");
      }
    } catch (e: any) {
      addLog(\`[YAHOO] Fallo general en la estrategia de búsqueda (\${e.message}).\`);
    }

    `;

  let finalEndIdx = altEndIdx;
  // find the start of the line for altEndIdx
  while (finalEndIdx > 0 && content[finalEndIdx-1] !== '\\n') {
      finalEndIdx--;
  }
  finalEndIdx--; // Include the previous newline wait maybe it's fine.

  const newContent = content.substring(0, startIdx) + replacement + content.substring(finalEndIdx);
  fs.writeFileSync(serverFile, newContent);
  console.log('Proceso simple SCRAPING STRATEGY successfully updated!');
} else {
  console.log('ERROR: Target strings not found in server.ts');
  console.log('startIdx:', startIdx);
  console.log('altEndIdx:', altEndIdx);
}
