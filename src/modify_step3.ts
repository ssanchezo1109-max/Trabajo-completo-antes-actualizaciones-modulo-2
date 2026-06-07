import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `    // Take storyboard screenshot step 3`;
const replacement = `    // Cierre específico para la ventana emergente de AlphaSpace / Promo en paso 3
    try {
      addLog(\`[YAHOO] Intentando cerrar ventana emergente promocional (AlphaSpace/etc)...\`);
      
      // Primera estrategia: tratar de presionar la X o botones de cierre
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        let closed = false;
        for (const btn of Array.from(btns)) {
            const label = btn.getAttribute('aria-label') || '';
            const title = btn.getAttribute('title') || '';
            const hasCloseClass = Array.from(btn.classList).some(c => c.toLowerCase().includes('close'));
            const hasSvgClose = btn.querySelector('svg[data-icon="close"]') || btn.querySelector('svg path[d*="M19 6.41"]');
            
            if (label.toLowerCase() === 'close' || title.toLowerCase() === 'close' || hasCloseClass || hasSvgClose) {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    btn.click();
                    closed = true;
                }
            }
        }
        return closed;
      });
      await new Promise(r => setTimeout(r, 1000));
      
      // Segunda estrategia: intentar con tecla de escape para lightboxes
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 500));
    } catch(e) {
      addLog(\`[YAHOO] Error al intentar cerrar ventana emergente: \${(e as any).message}\`);
    }

    // Take storyboard screenshot step 3`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('server.ts', content);
console.log('Added step 3 specific ad closer');
