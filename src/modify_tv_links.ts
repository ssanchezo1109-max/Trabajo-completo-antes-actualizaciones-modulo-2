import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace specific references to WXcPlCNy in the screenshot function
content = content.replace(
  'Capturing second TradingView screenshot for ${ticker} (layout: WXcPlCNy)...',
  'Capturing second TradingView screenshot for ${ticker} (layout: cL1iVbes)...'
);

content = content.replace(
  'https://www.tradingview.com/chart/WXcPlCNy/?symbol=${encodeURIComponent(formattedSymbol)}',
  'https://www.tradingview.com/chart/cL1iVbes/?symbol=${encodeURIComponent(formattedSymbol)}'
);

content = content.replace(
  'await takeScreenshot(s2, "TradingView: Gráfico WXcPlCNy (Indicadores 2)");',
  'await takeScreenshot(s2, "TradingView: Gráfico cL1iVbes (Indicadores 2)");'
);

fs.writeFileSync('server.ts', content);
console.log('TradingView layout IDs updated for info extraction.');
