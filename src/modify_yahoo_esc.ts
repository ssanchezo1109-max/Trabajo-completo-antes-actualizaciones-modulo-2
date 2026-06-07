import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const escKeyLogic = `
    // Send ESC key as a general modal killer
    try {
      addLog("[YAHOO] Enviando tecla Escape (ESC) para intentar cerrar modales...");
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 1000));
    } catch(e) {}
`;

content = content.replace('let popupClosed = false;', escKeyLogic + '\n    let popupClosed = false;');

fs.writeFileSync('server.ts', content);
console.log('Added Escape key press as fallback for popups');
