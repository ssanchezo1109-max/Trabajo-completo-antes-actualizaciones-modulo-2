import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
    </head>
    <body style="margin:0;padding:0;overflow:hidden;background-color:#1E222D;">
    <div id="tv_chart_container"></div>
    <script type="text/javascript">
      new TradingView.widget({
        "width": 1920,
        "height": 1080,
        "symbol": "NASDAQ:AAPL",
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tv_chart_container",
        "saved_chart": "k3GWg7dt"
      });
    </script>
    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: 'test_saved_chart.png' });
    await browser.close();
    console.log('Saved chart screenshot generated');
})();
