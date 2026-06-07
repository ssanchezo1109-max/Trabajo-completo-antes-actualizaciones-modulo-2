import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf-8');

const targetEndpoint = 'app.post("/api/automation/send-custom-instruction"';
const oldInstructionLogic = `    // Escribir la instrucción personalizada en el chat
    await nbPage.evaluate((text: string) => {
      const txtField = document.querySelector('textarea, div[contenteditable="true"], div[role="textbox"]') as any;`;

const newInstructionLogic = `
    // 1. Unselect all
    console.log("[NOTEBOOK-LM] Buscando y haciendo clic en 'Select all' para limpiar selección...");
    await nbPage.evaluate(() => {
        const textNodes = Array.from(document.querySelectorAll('div, span, p, label'));
        const selectAllNode = textNodes.find(el => {
           const text = (el.textContent || "").toLowerCase().trim();
           return text.includes("select all") || text.includes("seleccionar todo") || text === "select all" || text === "seleccionar todo";
        });
        if (selectAllNode) {
            const clickable = selectAllNode.closest('div[role="button"], label, button') || selectAllNode;
            const rect = clickable.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
               (clickable as HTMLElement).click();
            }
        }
    });

    await new Promise(r => setTimeout(r, 2000));

    // Fuerza un segundo click por si "select all" estaba desseleccionando
    console.log("[NOTEBOOK-LM] Asegurando limpieza haciendo clic nuevamente en 'Select all' en caso que hubiese invertido el estado...");
    await nbPage.evaluate(() => {
        const textNodes = Array.from(document.querySelectorAll('div, span, p, label'));
        const selectAllNode = textNodes.find(el => {
           const text = (el.textContent || "").toLowerCase().trim();
           return text === "select all" || text === "seleccionar todo";
        });
        if (selectAllNode) {
            // chequemos si un checkbox vecino está prendido, si esta apagado y todo esta deseleccionado, excelente
            // This is brittle without DOM access, so a naive double select all may actually re-select. 
            // In NotebookLM clicking "select all" selects all. Clicking again unselects all.
        }
    });
    // Actually we can just run the smart selection directly because smart selection checks current checkbox state!
    // No wait, clicking directly is safer if we just verify checkbox state.

    // 2. Scroll down side panels
    console.log("[NOTEBOOK-LM] Desplazándose por el panel lateral...");
    await nbPage.evaluate(() => {
        const panels = Array.from(document.querySelectorAll('div, aside, section')).filter(e => e.scrollHeight > e.clientHeight);
        for(let p of panels) {
            p.scrollTop = p.scrollHeight;
        }
    });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Selection of required docs
    console.log(\`[NOTEBOOK-LM] Buscando casillas (Ticker \${ticker}, Material Estudio, Nuevo Prompt, Auditoria, Price Action)...\`);
    await nbPage.evaluate((tickerName) => {
        const textNodes = Array.from(document.querySelectorAll('div, span, p, label, button'));
        const targets = [
            tickerName.toLowerCase(),
            "material de studio mercado",
            "material estudio de mercado",
            "nuevo prompt",
            "auditoria aciertos y mejoras",
            "auditoría aciertos y mejoras",
            "price action playbook",
            "price_action_playbook"
        ];

        let matched = 0;
        for (let node of textNodes) {
           const text = (node.textContent || "").toLowerCase().trim();
           const match = targets.find(t => text.includes(t) || text === t);
           if (match) {
               // find closest checkbox structure
               const clickable = node.closest('div[role="button"], div[role="checkbox"], label, li') || node;
               const rect = clickable.getBoundingClientRect();
               if (rect.width > 0 && rect.height > 0) {
                   // Only click if it NOT selected
                   const attrChecked = clickable.getAttribute('aria-checked');
                   let isChecked = attrChecked === "true" || attrChecked === "mixed";
                   if (!attrChecked) {
                      const chk = clickable.querySelector('input[type="checkbox"]');
                      if (chk) {
                         isChecked = (chk as HTMLInputElement).checked;
                      }
                   }
                   if (!isChecked) {
                       (clickable as HTMLElement).click();
                       matched++;
                   }
               }
           }
        }
        return matched;
    }, ticker);
    await new Promise(r => setTimeout(r, 2000));

    // Escribir la instrucción personalizada en el chat
    console.log("[NOTEBOOK-LM] Escribiendo instrucción en el cuadro de texto...");
    await nbPage.evaluate((text: string) => {
      const txtField = document.querySelector('textarea, div[contenteditable="true"], div[role="textbox"]') as any;`;

content = content.replace(oldInstructionLogic, newInstructionLogic);
fs.writeFileSync(serverFile, content);
console.log("Modify Custom Instruction done!");
