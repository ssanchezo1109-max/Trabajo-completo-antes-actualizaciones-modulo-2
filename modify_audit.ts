import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf-8');

const targetStr = `await updateGoogleDocText(googleAuth, targetDocTitle, auditoriaReporte, addLog);
      addLog(\`[BOT-AUDITORIA] ¡REPORTE DE AUDITORÍA GUARDADO SATISFACTORIAMENTE EN DRIVE ('\${targetDocTitle}')!\`);
      sendProgress(100);`;

const targetIdx = content.indexOf(targetStr);

if (targetIdx !== -1) {
  const replacementStr = `await updateGoogleDocText(googleAuth, targetDocTitle, auditoriaReporte, addLog);
      addLog(\`[BOT-AUDITORIA] ¡REPORTE DE AUDITORÍA GUARDADO SATISFACTORIAMENTE EN DRIVE ('\${targetDocTitle}')!\`);
      sendProgress(95);

      // VOLVER A NOTEBOOKLM Y SINCRONIZAR
      addLog(\`[BOT-AUDITORIA] Volviendo a interaccionar con NotebookLM para sincronizar auditoría...\`);
      try {
        await nbPage.goto(notebookLMUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await new Promise(r => setTimeout(r, 6000));

        addLog("[BOT-AUDITORIA] Haciendo scroll hacia abajo en el panel lateral...");
        await nbPage.evaluate(() => {
          const panels = Array.from(document.querySelectorAll('div, aside, section')).filter(e => e.scrollHeight > e.clientHeight);
          for(let p of panels) {
              p.scrollTop = p.scrollHeight;
          }
        });
        await new Promise(r => setTimeout(r, 2000));

        addLog("[BOT-AUDITORIA] Buscando documento de auditoría...");
        const docClicked = await nbPage.evaluate(() => {
            const els = Array.from(document.querySelectorAll('div, span, button, p, a, div[role="button"]'));
            for (let el of els) {
                const txt = (el.textContent || "").toLowerCase();
                if (txt.includes('auditoria aciertos') || txt.includes('auditoría aciertos') || txt.includes('auditoría aciertos y')) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                      (el as HTMLElement).click();
                      return true;
                  }
                }
            }
            return false;
        });

        if (docClicked) {
            addLog("[BOT-AUDITORIA] Se hizo clic en el documento de auditoría. Esperando que cargue...");
            await new Promise(r => setTimeout(r, 3000));
            addLog(\`[NOTEBOOK-LM] Buscando y haciendo clic en 'Sync con Google Drive'...\`);
            
            const syncClicked = await nbPage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span, div, a'));
                for (let btn of buttons) {
                    const t = (btn.textContent || "").toLowerCase();
                    const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
                    const tit = (btn.getAttribute("title") || "").toLowerCase();
                    if (t.includes('sync') || t.includes('sincronizar') || aria.includes('sync') || tit.includes('sync')) {
                        const rect = btn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && !btn.closest('[disabled]')) {
                            (btn as HTMLElement).click();
                            return true;
                        }
                    }
                }
                return false;
            });
            
            if (syncClicked) {
                addLog("[BOT-AUDITORIA] ¡Sincronizado con éxito!");
                await new Promise(r => setTimeout(r, 5000));
            } else {
                addLog("[BOT-AUDITORIA] No se encontró el botón de sincronización.");
            }
        } else {
            addLog(\`[BOT-AUDITORIA] No se pudo encontrar el documento 'auditoría aciertos y mejoras' en la interfaz.\`);
        }
      } catch (syncErr: any) {
         addLog(\`[BOT-AUDITORIA] Error durante fase de sincronización: \${syncErr.message}\`);
      }

      sendProgress(100);`;

  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(serverFile, content);
  console.log("Modification successful");
} else {
  console.log("Could not find target string");
}
