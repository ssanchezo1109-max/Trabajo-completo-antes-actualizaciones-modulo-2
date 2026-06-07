import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function main() {
  const tmpDir = '/tmp';
  const dirs = fs.readdirSync(tmpDir).filter(f => f.startsWith('google_profile_'));
  
  if (dirs.length === 0) {
    console.log("No Chrome profile directories found in /tmp.");
    return;
  }

  // Sort by mtime (most recent first)
  const sortedDirs = dirs.map(d => {
    const p = path.join(tmpDir, d);
    return { name: d, mtime: fs.statSync(p).mtime.getTime() };
  }).sort((a, b) => b.mtime - a.mtime);

  console.log("Profiles found:", sortedDirs);

  for (const item of sortedDirs) {
    const d = item.name;
    const activePortPath = path.join(tmpDir, d, 'DevToolsActivePort');
    if (!fs.existsSync(activePortPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(activePortPath, 'utf8').trim().split('\n');
      if (content.length < 2) continue;
      
      const port = content[0].trim();
      const wsPath = content[1].trim();
      const wsUrl = `ws://127.0.0.1:${port}${wsPath}`;
      
      console.log(`\nConnecting to: ${wsUrl} (Directory: ${d})`);
      const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
      
      const pages = await browser.pages();
      console.log(`Found ${pages.length} pages in this browser.`);
      
      for (const page of pages) {
        const url = page.url();
        console.log(` - Page URL: ${url}`);
        if (url.includes('notebooklm.google.com')) {
          console.log(`Found NotebookLM page! Extracting chat content...`);
          
          const extractedData = await page.evaluate(() => {
            const selectorQuery = 'div[class*="message"], div[class*="response"], .chat-message, [class*="bubble"], [class*="Message"], [class*="response"]';
            const blocks = Array.from(document.querySelectorAll(selectorQuery)) as HTMLElement[];
            
            return {
              count: blocks.length,
              messages: blocks.map(el => (el.innerText || el.textContent || '').trim()).filter(Boolean)
            };
          });
          
          console.log("\n--- EXTRACTED CHAT DATA (LAST 10 BLOCKS) ---");
          console.log(JSON.stringify(extractedData.messages.slice(-10), null, 2));
          console.log("----------------------------\n");
        }
      }
      
      await browser.disconnect();
    } catch (err: any) {
      console.error(`Error connecting to profile ${d}:`, err.message);
    }
  }
}

main().catch(console.error);
