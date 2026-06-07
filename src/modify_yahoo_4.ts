import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const additionalFallback = `
      // Check button text for common close/skip phrases
      document.querySelectorAll('button').forEach((btn: any) => {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (['close', 'cerrar', 'no thanks', 'skip', 'cancel', 'dismiss'].includes(text) || text === 'x') {
            const rect = btn.getBoundingClientRect();
           if (rect.width > 0 && rect.height > 0) {
             btn.click();
             closed = true;
           }
        }
      });
`;

content = content.replace('// Look for SVGs inside buttons', additionalFallback + '\n      // Look for SVGs inside buttons');

fs.writeFileSync('server.ts', content);
console.log('Added text match clicker for popups');
