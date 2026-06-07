import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf-8');

const targetEndpoint = 'app.post("/api/automation/send-custom-instruction"';
const nextEndpoint = 'app.post("/api/automation/run-order-generation"';

let startIdx = content.indexOf(targetEndpoint);
let endIdx = content.indexOf(nextEndpoint, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let endpointLogic = content.substring(startIdx, endIdx);

    const oldInstructionLogic = `    // Escribir la instrucción personalizada en el chat
    await nbPage.evaluate((text: string) => {
      const txtField = document.querySelector('textarea, div[contenteditable="true"], div[role="textbox"]') as any;`;

    const newInstructionLogic = `
    const sendEvent = (data: any) => res.write(\`data: \${JSON.stringify(data)}\\n\\n\`);
    const addLog = (msg: string) => {
      console.log(msg);
      sendEvent({ type: "log", msg });
    };

    // 1. Unselect all
    addLog("[NOTEBOOK-LM] Buscando y haciendo clic en 'Select all' para limpiar selección...");
    await nbPage.evaluate(() => {
        const textNodes = Array.from(document.querySelectorAll('div, span, p, label'));
        for(let node of textNodes) {
           const text = (node.textContent || "").toLowerCase();
           if(text === "select all" || text === "seleccionar todo") {
               const rect = node.getBoundingClientRect();
               if(rect.width > 0 && rect.height > 0) {
                   (node as HTMLElement).click();
                   break;
               }
           }
        }
    });

    await new Promise(r => setTimeout(r, 2000));

    // 2. Scroll down side panels
    addLog("[NOTEBOOK-LM] Desplazándose por el panel lateral...");
    await nbPage.evaluate(() => {
        const panels = Array.from(document.querySelectorAll('div, aside, section')).filter(e => e.scrollHeight > e.clientHeight);
        for(let p of panels) {
            p.scrollTop = p.scrollHeight;
        }
    });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Selection of required docs
    addLog(\`[NOTEBOOK-LM] Buscando casillas (Ticker, Material Estudio, Nuevo Prompt, Auditoria, Price Action)...\`);
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

        for (let node of textNodes) {
           const text = (node.textContent || "").toLowerCase();
           const match = targets.find(t => text.includes(t));
           if (match) {
               // find closest checkbox structure
               const clickable = node.closest('div[role="button"], div[role="checkbox"], label') || node;
               const rect = clickable.getBoundingClientRect();
               if (rect.width > 0 && rect.height > 0) {
                   // only click if not selected
                   const isChecked = clickable.getAttribute('aria-checked') === 'true' || 
                                     (clickable.querySelector('input') && clickable.querySelector('input').checked);
                   if (!isChecked) {
                       (clickable as HTMLElement).click();
                   }
               }
           }
        }
    }, ticker);
    await new Promise(r => setTimeout(r, 2000));

    // Escribir la instrucción personalizada en el chat
    addLog("[NOTEBOOK-LM] Escribiendo instrucción en el cuadro de texto...");
    await nbPage.evaluate((text: string) => {
      const txtField = document.querySelector('textarea, div[contenteditable="true"], div[role="textbox"]') as any;`;

    // Wait we need to properly replace.
    // Let's replace oldInstructionLogic with newInstructionLogic, and also we need to update the response mechanism
    // currently the endpoint responds with JSON. Oh, wait, the endpoint responds with JSON, BUT it doesn't set SSE?
    // Let's check how the endpoint responds right now.
}
