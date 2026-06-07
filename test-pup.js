import puppeteer from 'puppeteer';

async function test() {
  try {
    console.log('Launching puppeteer...');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    console.log('Launched!', await browser.version());
    await browser.close();
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
