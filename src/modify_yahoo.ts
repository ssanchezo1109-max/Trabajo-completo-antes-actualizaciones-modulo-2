import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const newPopupHandler = `
async function handleYahooPopups(page: any, addLog: Function) {
  try {
    const closeSelectors = [
      'button.close', 
      '[aria-label="Close"]', 
      '[aria-label="close"]', 
      '[aria-label*="lose"]',
      'svg[data-icon="close"]', 
      '.btn-close', 
      '.modal-close', 
      '#my-yfin-modal-close', 
      'button[title="Close"]',
      'button[title="close"]',
      'button[data-yaFT="lightbox-close"]',
      '.theme-fin button.closeIcon',
      'div[data-yaft-module="fin-ad-lightbox"] button',
      'div[data-testid="ad-lightbox"] button',
      'button.icon-close',
      'div.bx-close-xsvg',
      'div.bx-close-link',
      'button[class*="close"]'
    ];
    
    let popupClosed = false;
    // Just blindly try to evaluate and click anything that matches
    await page.evaluate((selectors) => {
      // @ts-ignore
      const __name = (fn: any) => fn;
      let closed = false;
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el: any) => {
          // Check if it's visible by dimensions
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
             el.click();
             closed = true;
          }
        });
      }
      
      // Look for SVGs inside buttons
      document.querySelectorAll('button svg').forEach((svg: any) => {
        const btn = svg.closest('button');
        if (btn) {
           const rect = btn.getBoundingClientRect();
           if (rect.width > 0 && rect.height > 0) {
             // Maybe it's a close button? If the exact HTML includes line coordinates or paths that look like an X
             // it's risky, but we can look for "close" in HTML
             if (btn.outerHTML.toLowerCase().includes('close')) {
                btn.click();
                closed = true;
             }
           }
        }
      });
      return closed;
    }, closeSelectors);
    
    // Fallback: puppeteer based clicks
    for (const selector of closeSelectors) {
      const btns = await page.$$(selector);
      for (const btn of btns) {
        try {
          const visible = await btn.isIntersectingViewport();
          if (visible) {
            addLog("[YAHOO] Cerrando ventana emergente modal en pantalla...");
            await btn.evaluate((b: any) => b.click());
            await new Promise(r => setTimeout(r, 1000));
            popupClosed = true;
          }
        } catch(err) {}
      }
    }
  } catch (e) {}
}
`;

const oldPopupHandlerStart = 'async function handleYahooPopups(page: any, addLog: Function) {';
const oldPopupHandlerEnd = '}\n}\n';

const startIdx = content.indexOf(oldPopupHandlerStart);
if (startIdx !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    let started = false;
    for(let i=startIdx; i<content.length; i++) {
        if(content[i] === '{') {
            braceCount++;
            started = true;
        } else if(content[i] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }
    
    if (endIdx !== -1) {
        content = content.substring(0, startIdx) + newPopupHandler + content.substring(endIdx);
        fs.writeFileSync('server.ts', content);
        console.log('Replaced handleYahooPopups');
    }
}
