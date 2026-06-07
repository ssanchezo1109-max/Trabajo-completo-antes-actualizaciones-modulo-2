import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf-8');

const targetEndpoint = 'app.post("/api/automation/send-custom-instruction"';
const nextEndpoint = 'app.post("/api/automation/run-order-generation"';

let startIdx = content.indexOf(targetEndpoint);
let endIdx = content.indexOf(nextEndpoint, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let oldInstructionLogic = content.substring(
      content.indexOf(`    // Escribir la instrucción personalizada en el chat`, startIdx),
      content.indexOf(`res.json({ success: true, updatedReport: finalReportText });`, startIdx)
    );

    const newInstructionLogic = `
    // 1. Unselect all
    console.log("[NOTEBOOK-LM] Buscando y haciendo clic en 'Select all' para limpiar selección...");
    await nbPage.evaluate(() => {
      const isCheckboxChecked = (el: HTMLElement) => {
        if (el.getAttribute('aria-checked') === 'true') return true;
        if ((el as any).checked === true) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('checked') || cls.includes('selected')) return true;
        const parent = el.parentElement;
        if (parent && parent.getAttribute('aria-checked') === 'true') return true;
        return false;
      };

      const allTextNodes = Array.from(document.querySelectorAll('div, span, button, p, label')) as HTMLElement[];
      const selectAllNode = allTextNodes.find(el => {
        const text = (el.innerText || el.textContent || "").toLowerCase().trim();
        return el.children.length === 0 && (
          text.includes("select all") || 
          text.includes("seleccionar todo") || 
          text.includes("seleccionar todos") || 
          text.includes("seleccionar todas") || 
          text === "select all" || 
          text === "seleccionar todo"
        );
      });
      
      let selectAllCheckbox: HTMLElement | null = null;
      if (selectAllNode) {
        const container = selectAllNode.closest('div, label, li, [role="listitem"]');
        if (container) {
           const checkbox = container.querySelector('input[type="checkbox"], [role="checkbox"]');
           selectAllCheckbox = (checkbox || container) as HTMLElement;
        } else {
           selectAllCheckbox = selectAllNode;
        }
      }

      if (selectAllCheckbox) {
        // En NotebookLM a veces el botón "seleccionar todo" marca todo y al desmarcarlo desmarca todo.
        // Si está prendido, lo hacemos clic para apagar todo. 
        // Si está apagado, le hacemos clic (prende todo) y luego otro clic (apaga todo).
        if (isCheckboxChecked(selectAllCheckbox)) {
          selectAllCheckbox.click();
        } else {
          selectAllCheckbox.click();
          setTimeout(() => selectAllCheckbox!.click(), 300);
        }
      }
    });

    await new Promise(r => setTimeout(r, 2000));

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
        const isCheckboxChecked = (el: HTMLElement) => {
          if (el.getAttribute('aria-checked') === 'true') return true;
          if ((el as any).checked === true) return true;
          const cls = String(el.className || '').toLowerCase();
          if (cls.includes('checked') || cls.includes('selected')) return true;
          const parent = el.parentElement;
          if (parent && parent.getAttribute('aria-checked') === 'true') return true;
          return false;
        };

        const textNodes = Array.from(document.querySelectorAll('div, span, button, p, label')) as HTMLElement[];
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
           const text = (node.innerText || node.textContent || "").toLowerCase().trim();
           if (node.children.length === 0) {
               const match = targets.find(t => text.includes(t) || text === t);
               if (match && !text.includes("select all") && !text.includes("seleccionar todo")) {
                   // find closest checkbox structure
                   const container = node.closest('div, label, li, [role="listitem"]');
                   if (container) {
                       const checkbox = container.querySelector('input[type="checkbox"], [role="checkbox"]');
                       const clickable = (checkbox || container) as HTMLElement;
                       const rect = clickable.getBoundingClientRect();
                       if (rect.width > 0 && rect.height > 0) {
                           if (!isCheckboxChecked(clickable)) {
                               clickable.click();
                               matched++;
                           }
                       }
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
      const txtField = document.querySelector('textarea, div[contenteditable="true"], div[role="textbox"]') as any;
      if (txtField) {
        if (txtField.tagName === 'TEXTAREA') {
          txtField.value = text;
          txtField.dispatchEvent(new Event('input', { bubbles: true }));
          txtField.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          txtField.innerText = text;
          txtField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, instruction);

    await new Promise(r => setTimeout(r, 1500));

    // Clic en enviar
    const clickResult = await nbPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]')) as HTMLElement[];
      for (const btn of buttons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        const text = (btn.innerText || btn.textContent || '').toLowerCase();
        if (label.includes('send') || label.includes('enviar') || text.includes('enviar') || text.includes('send')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!clickResult) {
      await nbPage.keyboard.press("Enter");
    }

    // Esperar respuesta de NotebookLM
    await new Promise(r => setTimeout(r, 30000));

    // Scrapear última respuesta de NotebookLM
    const extractedText = await nbPage.evaluate(() => {
      const bubbles = Array.from(document.querySelectorAll('.chat-message, [class*="message"], [class*="bubble"], [class*="Message"], [role="article"], .model-message-text, [data-author="model"]')) as HTMLElement[];
      const fuentes = bubbles.length > 0 ? bubbles : Array.from(document.querySelectorAll('div[class*="message-content"], div[class*="message"], div[class*="response"]')) as HTMLElement[];
      if (fuentes.length > 0) {
        const lastBubble = fuentes[fuentes.length - 1];
        return lastBubble.innerText || lastBubble.textContent || "";
      }
      return "";
    });

    let finalReportText = extractedText.trim();
    if (!finalReportText) {
      console.log("[WARNING] No se pudo extraer la respuesta textual. Emitiendo fallback.");
      finalReportText = \`### REVISION COMPLETADA - \${ticker}\\nInstrucción enviada exitosamente.\\nRespuesta no pudo ser leída del DOM.\`;
    }

`;

    content = content.replace(oldInstructionLogic, newInstructionLogic);
    fs.writeFileSync(serverFile, content);
    console.log("Replaced perfectly");
} else {
    console.log("Endpoints not found");
}
