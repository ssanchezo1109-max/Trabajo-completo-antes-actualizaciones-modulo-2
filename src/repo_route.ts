app.post("/api/automation/run", checkAuth, async (req: any, res) => {
  req.setTimeout(600000);
  res.setTimeout(600000);
  const {
    tickers,
    origin,
    tvSessionId,
    mode,
    tvEmail,
    tvPassword,
    yahooSessionId,
    yahooEmail,
    yahooPassword,
  } = req.body || {};
  stopRequested = false;
  if (!tickers || !Array.isArray(tickers)) {
    return res.status(400).json({ error: "Tickers must be an array" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const logs: string[] = [];

  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(msg);
    sendEvent({ type: "log", msg });
  };

  const sendProgress = (value: number) => {
    sendEvent({ type: "progress", value: Math.min(Math.round(value), 100) });
  };

  const auth = req.auth;

  try {
    addLog("Starting automation...");
    sendProgress(5);

    // Skip general market/starting news per requested instructions ("en vez de colocar las noticias de inicio")
    addLog(
      'Skipping general startup market news per instruction ("en vez de colocar las noticias de inicio")...',
    );
    const mainDocId = null;
    sendProgress(20);

    // 2. Loop through tickers
    const tickerDocs: { ticker: string; docId: string }[] = [];
    const totalTickers = tickers.length;
    const progressPerTicker = 80 / (totalTickers || 1);
    const runMode = mode || "both";

    for (let i = 0; i < totalTickers; i++) {
      if (stopRequested) {
        addLog("[SYSTEM] Ejecución cancelada por el usuario.");
        break;
      }
      const ticker = tickers[i];
      const current_ticker = String(ticker).trim();
      const ticker_name = current_ticker;
      const baseProgress = 20 + i * progressPerTicker;
      addLog(
        `Processing ticker: ${current_ticker} (${i + 1}/${totalTickers}) [MODE: ${runMode}]`,
      );

      let yahooResult = {
        newsText: "",
        screenshotPath: null,
        movingScreenshotPath: null,
      };
      let tickerAnalysis = `Captura de pantalla y análisis para ${current_ticker}`;

      if (runMode === "both" || runMode === "yahoo") {
        // Yahoo News Interactive Workflow and Screenshot
        yahooResult = await scrapeYahooTickerNews(
          current_ticker,
          addLog,
          auth,
          (filePath, stepName) => {
            sendEvent({
              type: "screenshot",
              ticker: current_ticker,
              url: `/api/images/${filePath}?t=${Date.now()}`,
              step: stepName,
            });
          },
          yahooEmail,
          yahooPassword,
          yahooSessionId,
        );
        addLog(
          `Skipping written Gemini news analysis per user request ("solo las capturas, el análisis escrito se puede omitir").`,
        );
        tickerAnalysis = `Reporte de Capturas de Pantalla para ${current_ticker}\nFecha: ${new Date().toLocaleString("es-ES")} \n\nEste documento contiene el registro visual de capturas para la acción ${current_ticker}.`;
        sendProgress(baseProgress + progressPerTicker * 0.4);
      } else {
        addLog(`Skipping Yahoo News verification for ${current_ticker}.`);
        tickerAnalysis = `Reporte de Capturas de Pantalla para ${current_ticker}\nFecha: ${new Date().toLocaleString("es-ES")} \n\nEste documento contiene el registro visual de capturas para la acción ${current_ticker}.`;
        sendProgress(baseProgress + progressPerTicker * 0.4);
      }

      if (stopRequested) {
        addLog("[SYSTEM] Ejecución cancelada por el usuario.");
        break;
      }

      // Update Doc for Ticker
      const tickerDocId = await updateGoogleDocText(
        auth,
        current_ticker,
        tickerAnalysis,
        addLog,
      );
      tickerDocs.push({ ticker: current_ticker, docId: tickerDocId });
      sendProgress(baseProgress + progressPerTicker * 0.5);

      let tvScreenshots: string[] = [];
      if (runMode === "both" || runMode === "tv") {
        // TradingView screenshots
        tvScreenshots = await captureTradingViewScreenshots(
          current_ticker,
          addLog,
          tvSessionId,
          tvEmail,
          tvPassword,
          (filePath, stepName) => {
            sendEvent({
              type: "screenshot",
              ticker: current_ticker,
              url: `/api/images/${filePath}?t=${Date.now()}`,
              step: stepName,
            });
          },
        );
        sendProgress(baseProgress + progressPerTicker * 0.8);
      } else {
        addLog(`Skipping TradingView screenshots for ${current_ticker}.`);
        sendProgress(baseProgress + progressPerTicker * 0.8);
      }

      // Gather all screenshots for Doc upload (Yahoo first, then TradingView)
      const allScreenshots: string[] = [];
      if (
        yahooResult.screenshotPath &&
        fs.existsSync(yahooResult.screenshotPath)
      ) {
        allScreenshots.push(yahooResult.screenshotPath);
      }
      if (
        yahooResult.movingScreenshotPath &&
        fs.existsSync(yahooResult.movingScreenshotPath)
      ) {
        allScreenshots.push(yahooResult.movingScreenshotPath);
      }
      allScreenshots.push(...tvScreenshots);

      if (allScreenshots.length > 0) {
        await updateGoogleDocImages(
          auth,
          tickerDocId,
          allScreenshots,
          origin,
          addLog,
        );
      } else {
        addLog(`No screenshots to upload to Google Doc for ${current_ticker}.`);
      }
      sendProgress(baseProgress + progressPerTicker);
    }

    addLog("Automation completed successfully");
    sendProgress(100);
    sendEvent({ type: "done", success: true, docId: mainDocId, tickerDocs });
    res.end();
  } catch (error: any) {
    console.error("Automation failed", error);
    addLog(`[ERROR] ${error.message || "Error desconocido"}`);
    sendEvent({ type: "error", error: error.message });
    res.end();
  }
})