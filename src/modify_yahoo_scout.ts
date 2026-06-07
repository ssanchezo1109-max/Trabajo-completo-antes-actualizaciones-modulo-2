import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const startIdx = content.indexOf('    // 6. Scroll down on the side column and search for "Why is [TICKER] moving today?"');
const endMarker = `    } else {
      addLog(
        \`[YAHOO] "Why is moving today?" button was not found or click unsuccessful.\`,
      );
      // Take storyboard screenshot step 7 (failed)
      addLog(
        \`[YAHOO] Taking storyboard step7 screenshot: failed/button missing...\`,
      );
      await takeScreenshot(
        \`yahoo_\${current_ticker}_step7_moving_today_failed.png\`,
        "Paso 7: Explicación de movimiento no aplicable o no encontrada",
      );
    }`;

const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    const newScoutLogic = `    // 6. Ask Yahoo Scout for "Why is [TICKER] moving today?"
    addLog(\`[YAHOO] Buscando el input de Ask Yahoo Scout para consultar sobre el movimiento...\`);
    
    // Perform a small scroll to trigger lazy loading if needed
    try {
      await page.evaluate(() => {
        window.scrollBy(0, 300);
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {}

    let scoutInputFound = false;
    try {
      // First attempt: look for common scout inputs
      const scoutSelectors = [
        'textarea[placeholder*="Ask Yahoo Scout"]',
        'input[placeholder*="Ask Yahoo Scout"]', 
        'textarea[placeholder*="Ask"]',
        'input[placeholder*="Ask"]',
        '[data-testid*="ask-yahoo"] textarea',
        '[data-testid*="ask-yahoo"] input',
        '[class*="scout"] textarea',
        '[class*="scout"] input',
      ];

      for (const sel of scoutSelectors) {
         try {
             let isFound = false;
             
             // Check if it exists and is visible
             const elVisible = await page.evaluate((selector: string) => {
                 const el = document.querySelector(selector) as HTMLElement;
                 if (el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0) {
                     el.scrollIntoView({ block: "center", inline: "center" });
                     el.focus();
                     return true;
                 }
                 return false;
             }, sel);

             if (elVisible) {
                 await new Promise(r => setTimeout(r, 500));
                 addLog(\`[YAHOO] Interactuando con input Scout (\${sel})...\`);
                 
                 // Type the query directly with puppeteer focusing
                 await page.click(sel);
                 
                 // Clear any existing text
                 await page.keyboard.down('Control');
                 await page.keyboard.press('A');
                 await page.keyboard.up('Control');
                 await page.keyboard.press('Backspace');
                 
                 const query = \`Why is \${current_ticker} moving today?\`;
                 addLog(\`[YAHOO] Escribiendo consulta: "\${query}"\`);
                 await page.keyboard.type(query, { delay: 50 });
                 await new Promise(r => setTimeout(r, 500));
                 
                 // Hit enter
                 await page.keyboard.press('Enter');
                 
                 // As a fallback, try to find a send button nearby if Enter doesn't work
                 try {
                     await page.evaluate((selector: string) => {
                         const el = document.querySelector(selector) as HTMLElement;
                         if (el && el.parentElement) {
                             const btn = el.parentElement.querySelector('button[type="submit"], button[aria-label="Send"], button svg, button');
                             if (btn) (btn as HTMLElement).click();
                         }
                     }, sel);
                 } catch(e) {}
                 
                 scoutInputFound = true;
                 break;
             }
         } catch(e) {}
      }
    } catch(e) {
      addLog(\`[YAHOO] Error al buscar bloque Scout: \${(e as any).message}\`);
    }

    if (scoutInputFound) {
      addLog(\`[YAHOO] Pregunta enviada a Yahoo Scout. Esperando 10 segundos por la respuesta...\`);
      
      // Wait for 10 seconds for the response to load
      await new Promise(r => setTimeout(r, 10000));
      
      const sMovingName = \`yahoo_\${current_ticker}_moving_today.png\`;
      addLog(\`[YAHOO] Generando screenshot de respuesta de Scout a \${sMovingName}...\`);
      
      // Take storyboard screenshot step 7 (expanded)
      addLog(\`[YAHOO] Taking storyboard step7 screenshot: scout response...\`);
      await takeScreenshot(sMovingName, "Paso 7: Explicación de movimiento por Yahoo Scout");
      movingScreenshotPath = sMovingName;
    } else {
      addLog(\`[YAHOO] No se encontró el input de Yahoo Scout o fallo al interactuar.\`);
      // Take storyboard screenshot step 7 (failed)
      addLog(\`[YAHOO] Taking storyboard step7 screenshot: failed/scout missing...\`);
      await takeScreenshot(\`yahoo_\${current_ticker}_step7_moving_today_failed.png\`, "Paso 7: Input Yahoo Scout no aplicable o no encontrado");
    }`;

    content = content.substring(0, startIdx) + newScoutLogic + content.substring(endIdx + endMarker.length);
    fs.writeFileSync('server.ts', content);
    console.log('Yahoo scout logic updated');
} else {
    console.log('Could not find start or end markers for Yahoo scout replacement');
    console.log('startIdx:', startIdx);
    console.log('endIdx:', endIdx);
}
