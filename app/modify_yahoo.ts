import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const popupHandler = `
async function handleYahooPopups(page: any, addLog: Function) {
  try {
    const closeSelectors = [
      'button.close', 
      '[aria-label="Close"]', 
      '[aria-label="close"]', 
      'svg[data-icon="close"]', 
      '.btn-close', 
      '.modal-close', 
      '#my-yfin-modal-close', 
      'button[title="Close"]',
      'button[data-yaFT="lightbox-close"]',
      '.theme-fin button.closeIcon',
      'div[data-yaft-module="fin-ad-lightbox"] button',
      'div[data-testid="ad-lightbox"] button',
      'button.icon-close'
    ];
    
    let popupClosed = false;
    for (const selector of closeSelectors) {
      const btns = await page.$$(selector);
      for (const btn of btns) {
        try {
          const visible = await btn.isIntersectingViewport();
          if (visible) {
            addLog("[YAHOO] Cerrando ventana emergente X en pantalla...");
            await btn.click();
            await new Promise(r => setTimeout(r, 1500));
            popupClosed = true;
          }
        } catch(err) {}
      }
    }
  } catch (e) {}
}
`;

// Insert the popupHandler before scrapeYahooTickerNews
content = content.replace(
  'async function scrapeYahooTickerNews(', 
  popupHandler + '\nasync function scrapeYahooTickerNews('
);

// Call it in scrapeYahooTickerNews right after going to homepage and clicking consents
const target1 = `    // Handle cookie consent if it appears on homepage
    try {
      const consentBtn = await page.$(
        'button[name="agree"], button[value="agree"], .accept-all, button.btn.secondary',
      );
      if (consentBtn) {
        addLog("[YAHOO] Handling cookie consent popup on Yahoo homepage...");
        await consentBtn.click();
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {}`;

const target1Replacement = target1 + `\n\n    // Handle random ad/newsletter popups
    await handleYahooPopups(page, addLog);`;

content = content.replace(target1, target1Replacement);

// Call it in scrapeYahooTickerNews right after quote page loaded and consents
const target2 = `    // Handle cookie consent if it appears on quote page (just in case)
    try {
      const consentBtn2 = await page.$(
        'button[name="agree"], button[value="agree"], .accept-all, button.btn.secondary',
      );
      if (consentBtn2) {
        addLog("[YAHOO] Handling secondary cookie consent popup...");
        await consentBtn2.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e) {}`;

const target2Replacement = target2 + `\n\n    // Handle random ad/newsletter popups
    await handleYahooPopups(page, addLog);`;

content = content.replace(target2, target2Replacement);


fs.writeFileSync('server.ts', content);
console.log('Modified server.ts with popup handler');
