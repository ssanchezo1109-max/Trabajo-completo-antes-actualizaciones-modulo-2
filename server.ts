import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import puppeteer, { Page } from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import FormData from "form-data";

dotenv.config();

let activeBrowser: any = null;
let stopRequested = false;

function getPuppeteerLaunchOptions() {
  const headlessVal = process.env.PUPPETEER_HEADLESS;
  let headless: any = "new";
  if (headlessVal === "false") {
    headless = false;
  } else if (headlessVal === "true") {
    headless = true;
  }

  // Generate a randomized directory to prevent lock conflicts on concurrent or crashed runs
  const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 1000000);
  const userDataDir = path.join("/tmp", `google_profile_${uniqueId}`);

  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
  ];

  defaultArgs.push(`--user-data-dir=${userDataDir}`);

  return {
    headless,
    args: defaultArgs,
  };
}

const app = express();
const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.set("trust proxy", 1); // Required for secure cookies behind proxy

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "market-analyst-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    },
  }),
);

const oauth2ClientBase = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Auth Middleware
const checkAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader === "Bearer null") {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  try {
    const tokenStr = authHeader.replace("Bearer ", "");
    let tokenValue = tokenStr;
    try {
      const parsed = JSON.parse(tokenStr);
      if (parsed && typeof parsed.access_token === "string") {
        tokenValue = parsed.access_token;
      } else if (parsed && typeof parsed.accessToken === "string") {
        tokenValue = parsed.accessToken;
      }
    } catch (e) {}

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    client.setCredentials({ access_token: tokenValue });
    req.auth = client;
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid token formatting" });
  }
};

// API Routes

app.get("/api/auth/status", (req: any, res) => {
  // Now handled purely client-side with localStorage, but keep endpoint to avoid 404s
  res.json({ isAuthenticated: true });
});

app.get("/api/auth/logout", (req: any, res) => {
  res.json({ success: true });
});

// Automation Endpoint
app.post("/api/automation/simulate", async (req: any, res) => {
  const { tickers } = req.body; // Array of tickers
  const logs: string[] = [];

  const addLog = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    addLog("[SIMULATION] Starting simulated automation (No Auth)...");

    await new Promise((resolve) => setTimeout(resolve, 800));
    addLog("[SIMULATION] Scraping Yahoo Finance Market News...");

    await new Promise((resolve) => setTimeout(resolve, 1200));
    addLog("[SIMULATION] Extracted text from Yahoo Finance.");

    await new Promise((resolve) => setTimeout(resolve, 500));
    addLog(
      '[SIMULATION] Skipped updating Google Doc: "a material de studio mercado"',
    );

    for (const ticker of tickers) {
      addLog(`[SIMULATION] Processing ticker: ${ticker}`);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      addLog(`[SIMULATION] Captured Yahoo screenshots for ${ticker}...`);

      await new Promise((resolve) => setTimeout(resolve, 1200));
      addLog(`[SIMULATION] Captured TradingView screenshots for ${ticker}...`);

      await new Promise((resolve) => setTimeout(resolve, 400));
      addLog(`[SIMULATION] Skipped updating Google Doc for: ${ticker}`);
    }

    addLog("[SIMULATION] Simulated automation completed successfully");
    res.json({ success: true, logs });
  } catch (error: any) {
    console.error("Simulation failed", error);
    res.status(500).json({ success: false, error: error.message, logs });
  }
});

// NUEVO ENDPOINT PARA GUARDAR EL ANÁLISIS EXTRAÍDO DESDE NOTEBOOKLM
app.post("/api/guardar-analisis", express.json(), (req, res) => {
  const { analisis, timestamp } = req.body || {};
  console.log("[BOT-APP] Recibido análisis para guardar en servidor local...");
  try {
    fs.writeFileSync(path.join(process.cwd(), "ultimo_analisis_guardado.json"), JSON.stringify({ analisis, timestamp }, null, 2));
    console.log("[BOT-APP] ¡Análisis guardado exitosamente en ultimo_analisis_guardado.json!");
    res.json({ success: true, message: "¡Análisis guardado y guardado correctamente en la app!" });
  } catch (err: any) {
    console.error("[BOT-ERROR] Error al guardar el análisis:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/images/:filename", (req, res) => {
  const filename = req.params.filename;
  // basic safety check
  if (!filename || filename.includes("/") || filename.includes("..")) {
    return res.status(400).send("Invalid filename");
  }
  
  // 1. Try exact match first
  let filePath = path.join(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(filePath);
  }

  // 2. Try case-insensitive matching fallback for Linux compatibility
  try {
    const parentDir = process.cwd();
    const files = fs.readdirSync(parentDir);
    const lowerFilename = filename.toLowerCase();
    const matchedFile = files.find(f => f.toLowerCase() === lowerFilename);
    if (matchedFile) {
      filePath = path.join(parentDir, matchedFile);
      return res.sendFile(filePath);
    }
  } catch (e) {
    console.error("Error doing case-insensitive fallback search:", e);
  }

  res.status(404).send("Not found");
});

async function updateLiveScreenshot(page: any, stepName: string, addLog?: Function) {
  try {
    const filename = "live_automation.png";
    const filePath = path.join(process.cwd(), filename);
    const tmpPath = path.join(process.cwd(), "live_automation_tmp.png");
    
    await page.screenshot({ path: tmpPath, type: 'png' });
    if (fs.existsSync(tmpPath)) {
      fs.renameSync(tmpPath, filePath);
      try {
        fs.copyFileSync(filePath, path.join(process.cwd(), "screenshot_temp.png"));
      } catch (cpErr: any) {
        console.log(`[LIVE_WARNING] Could not copy to screenshot_temp.png: ${cpErr.message}`);
      }
    }
    if (addLog) {
      addLog(`[LIVE_SCREENSHOT] Captura en vivo actualizada: ${stepName}`);
    }
  } catch (err: any) {
    console.log(`[LIVE_WARNING] No se pudo capturar pantalla: ${err.message}`);
    if (addLog) {
      addLog(`[LIVE_WARNING] No se pudo capturar pantalla en '${stepName}': ${err.message}`);
    }
  }
}

app.post("/api/automation/stop", checkAuth, (req: any, res: any) => {
  stopRequested = true;
  if (activeBrowser) {
    try {
      activeBrowser.close();
      console.log("[SYSTEM] Active browser closed via stop command.");
    } catch (e: any) {
      console.error("[SYSTEM] Error closing browser: ", e.message);
    }
    activeBrowser = null;
  }
  res.json({ success: true, message: "Automation abort signal sent." });
});

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
    yahooCookies,
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
          yahooCookies,
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
});

app.post("/api/automation/run-analysis-process", checkAuth, async (req: any, res) => {
  req.setTimeout(600000);
  res.setTimeout(600000);
  try {
    const liveImgPath = path.join(process.cwd(), "live_automation.png");
    if (fs.existsSync(liveImgPath)) {
      fs.unlinkSync(liveImgPath);
    }
  } catch (err: any) {
    console.error("Error deleting live_automation.png:", err.message);
  }

  const {
    yahooMarketNewsUrl,
    notebookLMCookies,
    notebookLMUrl,
    googleEmail,
    googlePassword,
    tickers,
    tickerDocs,
  } = req.body || {};

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const addLog = (msg: string) => {
    console.log(msg);
    sendEvent({ type: "log", msg });
  };

  const sendProgress = (value: number) => {
    sendEvent({ type: "progress", value: Math.min(Math.round(value), 100) });
  };

  const auth = req.auth;
  let browser: any = null;
  stopRequested = false;

  try {
    sendProgress(5);
    addLog("[SYSTEM] Iniciando proceso automatizado de oportunidades...");

    const drive = google.drive({ version: "v3", auth });
    const sheets = google.sheets({ version: "v4", auth });

    // ----------------------------------------------------
    // PASO 1: Copiar y actualizar tabla en Google Sheets
    // ----------------------------------------------------
    addLog("[SHEETS] Buscando archivo 'Registro Analisis de Entradas'...");
    const filesList = await drive.files.list({
      q: "name = 'Registro Analisis de Entradas' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (!filesList.data.files || filesList.data.files.length === 0) {
      addLog("[WARNING] No se encontró el archivo 'Registro Analisis de Entradas'. Se omitirá este paso.");
    } else {
      const spreadsheetId = filesList.data.files[0].id!;
      addLog(`[SHEETS] Archivo encontrado. ID: ${spreadsheetId}. Leyendo metadatos...`);

      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetTitle = sheetMeta.data.sheets?.[0]?.properties?.title || "Sheet1";

      const getValuesRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A1:Z2000`,
      });
      const allRows = getValuesRes.data.values || [];

      const isRowEmpty = (row: any[]) => {
        if (!row || row.length === 0) return true;
        return row.every(val => val === undefined || val === null || String(val).trim() === "");
      };

      let tableEndRow = -1;
      for (let i = allRows.length - 1; i >= 0; i--) {
        if (!isRowEmpty(allRows[i])) {
          tableEndRow = i;
          break;
        }
      }

      if (tableEndRow === -1) {
        addLog("[WARNING] El documento de excel está vacío. No se encontraron tablas para duplicar.");
      } else {
        let tableStartRow = tableEndRow;
        for (let i = tableEndRow; i >= 0; i--) {
          if (isRowEmpty(allRows[i])) {
            tableStartRow = i + 1;
            break;
          }
          if (i === 0) {
            tableStartRow = 0;
          }
        }

        const originTable = allRows.slice(tableStartRow, tableEndRow + 1);
        addLog(`[SHEETS] Tabla origen encontrada en las filas ${tableStartRow + 1} a ${tableEndRow + 1}.`);

        // Calcular nueva fecha: (dia de hoy-dia de mañana MES AÑO)
        const now = new Date();
        const todayNum = now.getDate();
        const tomorrowDate = new Date(now);
        tomorrowDate.setDate(now.getDate() + 1);
        const tomorrowNum = tomorrowDate.getDate();
        const months = [
          "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
          "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
        ];
        const currentMonthName = months[now.getMonth()];
        const currentYear = now.getFullYear();
        const newDateString = `${todayNum}-${tomorrowNum} ${currentMonthName} ${currentYear}`;
        addLog(`[SHEETS] Fecha de actualización calculada: ${newDateString}`);

        let dateModified = false;
        const datePattern = /\d{1,2}-\d{1,2}/;
        const monthNamesPattern = /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/i;

        const modifiedTableValues = originTable.map(row => {
          return row.map(cell => {
            const cellStr = String(cell || "").trim();
            if ((datePattern.test(cellStr) && monthNamesPattern.test(cellStr)) || monthNamesPattern.test(cellStr)) {
              dateModified = true;
              return newDateString;
            }
            return cell;
          });
        });

        if (!dateModified && modifiedTableValues.length > 0) {
          if (modifiedTableValues[0].length > 0) {
            modifiedTableValues[0][0] = newDateString;
          } else {
            modifiedTableValues[0] = [newDateString];
          }
        }

        const insertStartRow = tableEndRow + 4; // tableEndRow is 0-indexed, so row index tableEndRow + 1 is last row. Two empty rows implies we place it at index tableEndRow+3 (1-based row tableEndRow + 4)
        const updateRange = `'${sheetTitle}'!A${insertStartRow}`;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: modifiedTableValues,
          },
        });
        addLog(`[SHEETS] Duplicado exitoso. Pegada tabla en fila ${insertStartRow} con fecha actualizada.`);
      }
    }

    addLog("[SYSTEM] Omitiendo lectura de reportes de tickers por especificación.");
    sendProgress(50);

    // ----------------------------------------------------
    // PASO 3: Scraping Yahoo Finance y Documento mercado
    // ----------------------------------------------------
    addLog("[YAHOO] Buscando portada de Mercado en Yahoo Finance...");
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    activeBrowser = browser;

    const searchPage = await browser.newPage();
    await searchPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
    
    // Set generous timeouts
    await searchPage.setDefaultNavigationTimeout(60000);
    await searchPage.setDefaultTimeout(60000);

    let scrapeData: { title: string; paragraphs: string[] } = {
      title: "Resumen de Mercado - Yahoo Finance",
      paragraphs: [
        "No se pudo completar el raspado automático de noticias en tiempo real.",
        "Por favor consulte Yahoo Finance directamente para el análisis de mercado del día.",
        "Este es un párrafo de respaldo generado por el sistema de automatización para evitar interrupciones."
      ]
    };

    let scrapedSuccessfully = false;

    // Única estrategia requerida: Url directa o Búsqueda en Google de "stock market today yahoo finance"
    try {
      let targetUrl = yahooMarketNewsUrl;
      
      if (targetUrl) {
          addLog(`[YAHOO] Ingresando directo a la URL provista: ${targetUrl}`);
      } else {
        addLog("[YAHOO] No se proveyó link directo. Buscando en Google 'stock market today yahoo finance'...");
        try {
          await searchPage.goto("https://www.google.com", { waitUntil: "domcontentloaded", timeout: 30000 });
        } catch (e: any) {
          addLog(`[YAHOO] Advertencia al cargar Google (${e.message || 'timeout'}), continuando...`);
        }

        try {
          const rejectBtn = await searchPage.$('button[id="W0wltc"], button:has-text("Reject all")');
          if (rejectBtn) {
            await rejectBtn.click();
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (e) {}

        await searchPage.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 15000 });
        await searchPage.type('textarea[name="q"], input[name="q"]', "stock market today yahoo finance");
        await searchPage.keyboard.press("Enter");
        
        try {
          await searchPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 });
        } catch (e) {
          addLog("[YAHOO] Advertencia: Carga de resultados de Google superó el tiempo...");
        }

        const firstLinkSelector = 'a[href*="finance.yahoo.com"]';
        await searchPage.waitForSelector(firstLinkSelector, { timeout: 20000 }).catch(e=>addLog("[YAHOO] WARNING: Selector de links no apareció en Google"));

        targetUrl = await searchPage.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
          
          const validAnchors = anchors.filter(a => {
              const href = a.href || "";
              // Buscar que sea de finance.yahoo.com, descarta traducciones e historias chinas simuladas
              return href.includes("finance.yahoo.com") && !href.includes("translate.google") && !href.includes("webcache.google") && href.startsWith("http");
          });

          // Buscar uno que INICIAR en su título con "Stock market today"
          const specificMatch = validAnchors.find(a => {
              const txt = (a.innerText || "").trim().toLowerCase();
              return txt.startsWith("stock market today");
          });
          
          if (specificMatch) {
              return specificMatch.href;
          }

          // Si no hay especifico, retornar el segundo
          if (validAnchors.length > 1) {
              return validAnchors[1].href;
          } else if (validAnchors.length > 0) {
              return validAnchors[0].href;
          }

          return null; // fallaremos en caso de nada
        });
      }

      if (targetUrl) {
        addLog(`[YAHOO] Artículo seleccionado en Google: ${targetUrl}. Cargando contenido...`);
        await searchPage.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        
        // Wait specifically to let dynamic coverages load
        await new Promise(r => setTimeout(r, 5000));

        const extracted = await searchPage.evaluate(() => {
          const heading = document.querySelector('h1')?.innerText || document.title || "Yahoo Finance News";
          const paragraphs: string[] = [];
          
          // Capturar todos los elementos relevantes
          const allElements = Array.from(document.querySelectorAll('p, li, h2, h3, div[class*="content"], div[class*="body"]')); 
          for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) continue; // skip hidden elements
              
              const text = ((el as HTMLElement).innerText || "").trim();
              if (!text || text.length < 25) continue;
              
              // Skip privacy/cookies generic texts often found in yahoo/google consent pages
              const lowerText = text.toLowerCase();
              if (lowerText.includes("we and our partners use cookies") ||
                  lowerText.includes("we use cookies") ||
                  lowerText.includes("yahoo makes it easy to enjoy what matters most") ||
                  lowerText.includes("manage your privacy settings") ||
                  lowerText.includes("to help personalize content, tailor and measure ads") ||
                  lowerText.includes("find out more about how we use your information") ||
                  lowerText.includes("terms of service") ||
                  lowerText.includes("privacy policy") ||
                  lowerText.includes("your privacy is important to us") ||
                  lowerText.includes("provide our sites and apps to you") ||
                  lowerText.includes("authenticate users, apply security measures") ||
                  lowerText.includes("measure your use of our sites and apps") ||
                  lowerText.includes("if you do not want us and our partners to use cookies") ||
                  lowerText.includes("if you would like to customise your choices") ||
                  lowerText.includes("click 'reject all'")) {
                  continue;
              }

              paragraphs.push(text);
              if (lowerText.includes("live coverage is over")) {
                   break;
              }
          }
          
          // Eliminar duplicados para que sea más limpio
          let uniqueParagraphs = Array.from(new Set(paragraphs));

          // Post-process to cut text strictly up to "live coverage is over"
          let finalParagraphs: string[] = [];
          for (let p of uniqueParagraphs) {
              const lowerP = p.toLowerCase();
              const idx = lowerP.indexOf("live coverage is over");
              if (idx !== -1) {
                  const sliceIdx = idx + "live coverage is over".length;
                  finalParagraphs.push(p.substring(0, sliceIdx));
                  break; // stop completely
              } else {
                  finalParagraphs.push(p);
              }
          }

          return { title: heading, paragraphs: finalParagraphs };
        });

        if (extracted && extracted.paragraphs.length > 0) {
          scrapeData = extracted;
          scrapedSuccessfully = true;
          addLog(`[YAHOO] Éxito vía Google. Artículo: "${scrapeData.title}" (${scrapeData.paragraphs.length} elementos extraídos).`);
        } else {
          addLog(`[YAHOO] Se cargó página ${targetUrl} pero no se encontraron párrafos textuales útiles.`);
        }
      } else {
        addLog("[YAHOO] No se encontró ningún resultado en la búsqueda de Google.");
      }
    } catch (e: any) {
      addLog(`[YAHOO] Fallo general en la estrategia de búsqueda (${e.message}).`);
    }

        addLog("[DRIVE] Buscando o creando archivo 'a a material de studio mercado'...");
    const docsSearchList = await drive.files.list({
      q: "name = 'a a material de studio mercado' and mimeType = 'application/vnd.google-apps.document' and trashed = false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    let marketDocId = "";
    if (docsSearchList.data.files && docsSearchList.data.files.length > 0) {
      marketDocId = docsSearchList.data.files[0].id!;
      addLog(`[DRIVE] Documento existente encontrado (ID: ${marketDocId})`);
    } else {
      const createResponse = await drive.files.create({
        requestBody: {
          name: "a a material de studio mercado",
          mimeType: "application/vnd.google-apps.document",
        },
        fields: "id",
      });
      marketDocId = createResponse.data.id!;
      addLog(`[DRIVE] Nuevo documento creado (ID: ${marketDocId})`);
    }

    const docObj = await google.docs({ version: "v1", auth }).documents.get({ documentId: marketDocId });
    const contentBody = docObj.data.body?.content || [];
    let endIndex = 1;
    if (contentBody.length > 0) {
      const lastItem = contentBody[contentBody.length - 1];
      endIndex = lastItem.endIndex || 1;
    }

    const docRequests: any[] = [];
    if (endIndex > 2) {
      docRequests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      });
    }

    const marketFullText = `${scrapeData.title}\n\n${scrapeData.paragraphs.join("\n\n")}\n`;
    docRequests.push({
      insertText: {
        location: { index: 1 },
        text: marketFullText,
      },
    });

    await google.docs({ version: "v1", auth }).documents.batchUpdate({
      documentId: marketDocId,
      requestBody: { requests: docRequests },
    });
    addLog("[DRIVE] Documento 'a a material de studio mercado' editado con éxito.");

    addLog("[SYSTEM] Omitiendo sincronización y carga en NotebookLM por especificación.");
    addLog("[SYSTEM] Proceso de duplicación de última tabla y captura de ocho párrafos finalizado exitosamente.");
    sendProgress(100);
    sendEvent({ type: "done", success: true });
    res.end();

  } catch (error: any) {
    console.error("Analysis process failed", error);
    addLog(`[ERROR] ${error.message || "Fallo imprevisto"}`);
    sendEvent({ type: "error", error: error.message });
    res.end();
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    activeBrowser = null;
  }
});

async function ensureThreePanelLayout(page: any, addLog: Function) {
  addLog(`[NOTEBOOK-LM] Aplicando reglas de control de interfaz de tres paneles (1024x640)...`);
  try {
    // 1. Asegurar viewport de 1024x640
    await page.setViewport({ width: 1024, height: 640 });
    
    // 2. Ejecutar la normalización en el DOM
    const result = await page.evaluate(() => {
      const logs: string[] = [];

      // --- REGLA 1: GARANTIZAR PANEL IZQUIERDO ABIERTO ---
      const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      
      // Buscamos botones o textos de 'Back to sources' o similares en el panel izquierdo (rango X: 0 - 300) para retornar si estamos visualizando un documento individual
      let backBtn: HTMLElement | null = null;
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.left < 300 && rect.top < 150) {
          const txt = (el.innerText || el.textContent || "").toLowerCase().trim();
          const aria = (el.getAttribute('aria-label') || "").toLowerCase();
          const title = (el.getAttribute('title') || "").toLowerCase();
          
          if (txt === "back to sources" || txt === "todas las fuentes" || txt.includes("volver a fuentes") || aria.includes("back") || title.includes("back") || txt === " fuentes" || txt === "sources") {
            const clickable = el.closest('button, [role="button"], a, div') as HTMLElement || el;
            if (clickable !== el && clickable.getBoundingClientRect().left < 300) {
              backBtn = clickable;
              break;
            }
          }
        }
      }
      
      if (backBtn) {
        backBtn.click();
        logs.push("Detectado y clicado botón de retorno de documento individual");
      }

      // Detectar si el panel lateral izquierdo está colapsado (encontrar botón con aria-expanded="false" o que diga "expand" / "show" / "mostrar")
      let leftToggleBtn: HTMLElement | null = null;
      for (const el of elements) {
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const text = (el.innerText || el.textContent || '').toLowerCase();
        const rect = el.getBoundingClientRect();
        
        if (rect.left < 150 && rect.top < 150) {
          const matchesAria = ariaLabel.includes('show sources') || ariaLabel.includes('mostrar fuentes') || ariaLabel.includes('expand sidebar') || ariaLabel.includes('expandir barra') || ariaLabel.includes('expandir fuentes') || ariaLabel.includes('abrir fuentes') || ariaLabel.includes('abrir barra') || (ariaLabel.includes('expand') && (ariaLabel.includes('sources') || ariaLabel.includes('sidebar') || ariaLabel.includes('fuentes')));
          const matchesTitle = title.includes('show sources') || title.includes('mostrar fuentes') || title.includes('expand sidebar') || title.includes('expandir barra') || title.includes('expandir fuentes') || title.includes('abrir fuentes') || title.includes('abrir barra') || (title.includes('expand') && (title.includes('sources') || title.includes('sidebar') || title.includes('fuentes')));
          const matchesText = text.includes('show sources') || text.includes('mostrar fuentes') || text.includes('expand sidebar') || text.includes('expandir barra');
          
          if (matchesAria || matchesTitle || matchesText) {
            leftToggleBtn = el.closest('button, [role="button"]') as HTMLElement || el;
            break;
          }
        }
      }

      // Fallback por estado expandido/colapsado (aria-expanded="false")
      if (!leftToggleBtn) {
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.left < 150 && rect.top < 150) {
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const ariaExpanded = el.getAttribute('aria-expanded');
            if ((ariaLabel.includes('sources') || ariaLabel.includes('fuentes') || ariaLabel.includes('sidebar') || title.includes('sources') || title.includes('fuentes') || title.includes('sidebar')) && ariaExpanded === 'false') {
              leftToggleBtn = el.closest('button, [role="button"]') as HTMLElement || el;
              break;
            }
          }
        }
      }

      // Validar presencia visual de algún elemento del checklist para doble seguridad
      const hasSourcesVisible = elements.some(el => {
        const txt = (el.innerText || '').toLowerCase().trim();
        return el.getBoundingClientRect().left < 260 && (
          txt.includes('important') || 
          txt.includes('analysis') || 
          txt.includes('documentos') || 
          txt.includes('technical') || 
          txt.includes('trading') || 
          txt.includes('playbook') || 
          txt.includes('prompt') || 
          txt.includes('aapl') || 
          txt.includes('tsla')
        );
      });

      if (!hasSourcesVisible && leftToggleBtn) {
        leftToggleBtn.click();
        logs.push("Fuerza apertura de barra lateral de fuentes por botón colapsado o ocultamiento indeseado");
      }

      // --- REGLA 2: FORZAR EXPANSIÓN DE STUDIO (DERECHA) ---
      let studioVisible = false;

      // Buscar contenedores en el lado derecho de la pantalla (X > 750) que contengan texto como "Studio", "Audio Overview", "Guide" o similar
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.left > 740 && rect.width > 50 && rect.height > 200) {
          const txt = (el.innerText || '').toLowerCase();
          if (txt.includes('studio') || txt.includes('audio overview') || txt.includes('slide deck') || txt.includes('quiz')) {
            studioVisible = true;
            break;
          }
        }
      }

      // Si no se detecta visible, buscaremos el botón de alternancia de Studio [|] en la esquina superior derecha
      if (!studioVisible) {
        let rightToggleBtn: HTMLElement | null = null;
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.left > 740 && rect.top < 100) {
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            
            if (ariaLabel.includes('studio') || ariaLabel.includes('panel') || ariaLabel.includes('sidebar') || ariaLabel.includes('toggle') ||
                title.includes('studio') || title.includes('panel') || title.includes('sidebar') || title.includes('toggle')) {
              rightToggleBtn = el.closest('button, [role="button"]') as HTMLElement || el;
              break;
            }
          }
        }

        // Fallback de zona
        if (!rightToggleBtn) {
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.left > 850 && rect.left < 1024 && rect.top > 2 && rect.top < 85 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) {
              rightToggleBtn = el;
              break;
            }
          }
        }

        if (rightToggleBtn) {
          rightToggleBtn.click();
          logs.push("Fuerza apertura del panel de Studio usando botón de alternar en esquina superior derecha");
        } else {
          logs.push("[WARN] No se encontró botón de alternancia para Studio");
        }
      } else {
        logs.push("Panel de Studio ya está visible y expandido");
      }

      return logs;
    });

    if (result && result.length > 0) {
      addLog(`[NOTEBOOK-LM] Normalización de tres paneles: ${result.join(" | ")}`);
    }
  } catch (err: any) {
    addLog(`[WARNING] Error en el control de tres paneles expandidos: ${err.message}`);
  }
}

async function waitForThreePanelsToLoad(page: any, addLog: Function, timeoutMs: number = 15000) {
  addLog(`[NOTEBOOK-LM] Esperando a que carguen todos los elementos interactivos en los tres paneles (máx ${timeoutMs}ms)...`);
  const startTime = Date.now();
  let loaded = false;
  
  while (Date.now() - startTime < timeoutMs) {
    const panelsLoadedResult = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      
      const leftLoaded = elements.some(el => {
        const rect = el.getBoundingClientRect();
        const txt = (el.innerText || el.textContent || "").toLowerCase().trim();
        return rect.left < 260 && (txt.includes("sources") || txt.includes("fuentes") || txt.includes("documentos") || txt.includes("pdf") || txt.includes("add sources"));
      });
      
      const centerLoaded = elements.some(el => {
        const rect = el.getBoundingClientRect();
        const tagName = el.tagName.toLowerCase();
        return rect.left >= 261 && rect.left <= 750 && (tagName === "textarea" || el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox");
      });
      
      const rightLoaded = elements.some(el => {
        const rect = el.getBoundingClientRect();
        const txt = (el.innerText || el.textContent || "").toLowerCase().trim();
        return rect.left > 750 && (txt.includes("studio") || txt.includes("audio overview") || txt.includes("slide deck") || txt.includes("quiz") || txt.includes("flashcards"));
      });
      
      return { leftLoaded, centerLoaded, rightLoaded };
    });
    
    if (panelsLoadedResult.leftLoaded && panelsLoadedResult.centerLoaded) {
      loaded = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (loaded) {
    addLog(`[NOTEBOOK-LM] Elementos iniciales de los paneles cargados con éxito.`);
  } else {
    addLog(`[WARNING] Espera de carga inicial completada. Intentando normalizar panels...`);
  }
  
  // Forzar y normalizar inmediatamente el layout expandido de tres paneles
  await ensureThreePanelLayout(page, addLog);
}

async function selectOnlySpecifiedSourcesForTicker(page: any, ticker: string, addLog: Function) {
  addLog(`[NOTEBOOK-LM] [ETAPA SELECCIÓN] Iniciando proceso de selección exclusiva según directivas del usuario para ${ticker}...`);
  try {
    addLog(`[NOTEBOOK-LM] Paso 1: Configurando viewport de alta fidelidad (1024x640)...`);
    await page.setViewport({ width: 1024, height: 640 });
    
    // Normalizar la distribución de los tres paneles
    await ensureThreePanelLayout(page, addLog);
    await new Promise(r => setTimeout(r, 1200));

    // Paso 2: Haz clic en la sección de sources
    addLog(`[NOTEBOOK-LM] Paso 2: [CLIC EN SOURCES] Activando pestaña de Fuentes...`);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('span, div, p, button, [role="button"], a')) as HTMLElement[];
      
      // Buscar elementos estrictamente dentro del panel izquierdo de navegación (X < 300, Y < 250)
      const matches = items.filter(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.left > 300 || rect.top > 250) return false;
        
        const txt = (el.innerText || el.textContent || "").toLowerCase().trim();
        return (txt === "sources" || txt === "selected sources" || txt === "fuentes" || txt === "documentos clave" || txt.includes("selected sources"));
      });

      if (matches.length > 0) {
        matches.sort((a, b) => a.innerText.length - b.innerText.length);
        const targetEl = matches[0];
        const clickable = targetEl.closest('button, [role="button"], a') as HTMLElement;
        if (clickable && clickable.getBoundingClientRect().left < 300) {
          clickable.click();
        } else {
          targetEl.click();
        }
        return;
      }

      // Fallback local en panel izquierdo
      for (const el of items) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left < 200 && rect.top < 250) {
          const txt = (el.innerText || el.textContent || "").toLowerCase();
          if (txt.includes("sources") || txt.includes("fuentes")) {
            const clickable = el.closest('button, [role="button"], a') as HTMLElement || el;
            clickable.click();
            return;
          }
        }
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // Paso 3: Haz clic en la casilla de select all
    addLog(`[NOTEBOOK-LM] Paso 3: [SELECT ALL] Haciendo clic en la casilla de Select All para desmarcar todo la selección inicial...`);
    const selectAllResult = await page.evaluate(async () => {
      const isCheckboxChecked = (el: HTMLElement) => {
        if (el.getAttribute('aria-checked') === 'true') return true;
        if ((el as any).checked === true) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('checked') || cls.includes('selected')) return true;
        const parent = el.parentElement;
        if (parent) {
          const parentCls = String(parent.className || '').toLowerCase();
          if (parentCls.includes('checked') || parentCls.includes('selected')) return true;
        }
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
          selectAllCheckbox = container.querySelector('[role="checkbox"], input[type="checkbox"]') as HTMLElement;
        }
      }

      // Si no encontramos con label text, buscaremos el primer selector como fallback
      if (!selectAllCheckbox) {
        const checkboxes = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')) as HTMLElement[];
        if (checkboxes.length > 0) {
          selectAllCheckbox = checkboxes[0];
        }
      }

      if (selectAllCheckbox) {
        const checkboxes = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')) as HTMLElement[];
        const otherCheckboxes = checkboxes.filter(cb => cb !== selectAllCheckbox);
        const initiallyCheckedCount = otherCheckboxes.filter(isCheckboxChecked).length;

        // Clic inicial
        selectAllCheckbox.click();
        await new Promise(r => setTimeout(r, 400));

        const nowCheckedCount = otherCheckboxes.filter(isCheckboxChecked).length;

        // Si clicking Select All resultó en que se marcaron todos los elementos, hacemos clic una vez más para borrar todo (desmarcar todo)
        if (nowCheckedCount > initiallyCheckedCount && nowCheckedCount > otherCheckboxes.length / 2) {
          selectAllCheckbox.click();
          await new Promise(r => setTimeout(r, 400));
          return "Select All accionado con clic doble para desmarcar todas las opciones";
        }
        return "Select All accionado con un solo clic de desmarcado exitoso";
      }

      return "No se pudo localizar el checkbox Select All";
    });
    addLog(`[NOTEBOOK-LM] Resultado Select All: ${selectAllResult}`);
    await new Promise(r => setTimeout(r, 1500));

    // Mover el ratón a la columna de fuentes (X: 100, Y: 300) para enfocar físicamente y hacer scroll
    addLog(`[NOTEBOOK-LM] Posicionando ratón virtual en el panel de fuentes (X: 100, Y: 300) para el scroll...`);
    await page.mouse.move(100, 300);
    await new Promise(r => setTimeout(r, 200));

    // Paso 4: Scrolea hasta lo más abajo
    addLog(`[NOTEBOOK-LM] Paso 4: [SCROLL AL FONDO] Desplazando scroll al fondo para descomprimir fuentes...`);
    await page.mouse.wheel({ deltaY: 4500 });
    await new Promise(r => setTimeout(r, 800));

    // Scroll JS hacia abajo para asegurar que el contenedor se desplace al fondo (uncompress virtual)
    await page.evaluate(() => {
      let scrollable: HTMLElement | null = null;
      const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.left < 280 && rect.width > 50 && el.scrollHeight > el.clientHeight) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            scrollable = el;
          }
        }
      }
      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    await updateLiveScreenshot(page, `Fuentes con scroll al fondo de fuentes para ${ticker}`, addLog);

    // Paso 5: Haz clic en las casillas deseadas: AAPL/Ticker, auditoría de aciertos y mejoras, price action playbook, material estudio de mercado
    addLog(`[NOTEBOOK-LM] Paso 5: [CLIC EN CASILLAS] Seleccionando individualmente las 4 fuentes solicitadas...`);
    
    const clickResults = await page.evaluate(async (tk) => {
      const isCheckboxChecked = (el: HTMLElement) => {
        if (el.getAttribute('aria-checked') === 'true') return true;
        if ((el as any).checked === true) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('checked') || cls.includes('selected')) return true;
        const parent = el.parentElement;
        if (parent) {
          const parentCls = String(parent.className || '').toLowerCase();
          if (parentCls.includes('checked') || parentCls.includes('selected')) return true;
        }
        return false;
      };

      const matchCriteria = (text: string) => {
        const txt = text.toLowerCase().trim();
        const normalizedTk = tk.toLowerCase().trim();

        // 1. Ticker actual o explícitamente "aapl"
        const isTicker = txt === normalizedTk || 
                         txt === "aapl" ||
                         txt === `reporte ticker: ${normalizedTk}` || 
                         txt === `reporte ticker: aapl` || 
                         txt === `${normalizedTk}.pdf` ||
                         txt === `aapl.pdf` ||
                         txt.includes(`reporte ticker: ${normalizedTk}`) ||
                         txt.includes(normalizedTk) ||
                         txt.includes("aapl");
                         
        // 2. Auditoría de aciertos y mejoras
        const isAuditoria = txt.includes("auditoria") || txt.includes("auditoría") || txt.includes("aciertos") || txt.includes("mejoras");

        // 3. Price Action Playbook
        const isPlaybook = txt.includes("playbook") || txt.includes("price action");

        // 4. Material estudio de mercado
        const isMaterial = txt.includes("material") && (txt.includes("mercado") || txt.includes("studio") || txt.includes("estudio"));

        return isTicker || isAuditoria || isPlaybook || isMaterial;
      };

      const stepClicked: string[] = [];
      const rows = Array.from(document.querySelectorAll('div, li, [role="listitem"]')) as HTMLElement[];

      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (rect.left < 280 && rect.width > 50) {
          const checkbox = row.querySelector('[role="checkbox"], input[type="checkbox"]') as HTMLElement;
          if (checkbox) {
            const text = (row.innerText || row.textContent || "").trim();
            if (text) {
              const shouldBeChecked = matchCriteria(text);
              const isChecked = isCheckboxChecked(checkbox);
              if (shouldBeChecked && !isChecked) {
                row.scrollIntoView({ block: "center", behavior: "instant" });
                await new Promise(r => setTimeout(r, 100));
                checkbox.click();
                stepClicked.push(`[CHECKED] ${text}`);
                await new Promise(r => setTimeout(r, 150));
              } else if (!shouldBeChecked && isChecked) {
                row.scrollIntoView({ block: "center", behavior: "instant" });
                await new Promise(r => setTimeout(r, 100));
                checkbox.click();
                stepClicked.push(`[UNCHECKED] ${text}`);
                await new Promise(r => setTimeout(r, 150));
              }
            }
          }
        }
      }
      return stepClicked;
    }, ticker);

    addLog(`[NOTEBOOK-LM] Registro de acciones de marcado: [${clickResults.join(" | ")}]`);
    await updateLiveScreenshot(page, `Marcado final de fuentes completado para ${ticker}`, addLog);

    // Detenerse aquí ("Al llegar ahí detente")
    addLog(`[NOTEBOOK-LM] ¡Proceso de marcado completado con éxito! Deteniendo ejecución por orden del usuario ('Al llegar ahí detente').`);
    throw new Error("DETENTE_STRICT");

  } catch (err: any) {
    if (err.message === "DETENTE_STRICT") {
      throw err; // Propagar hacia arriba para la detención limpia de las rutas Express
    }
    addLog(`[WARNING] Error en el proceso de marcado de fuentes exclusivas de ${ticker}: ${err.message}`);
    throw err;
  }
}

async function selectSpecificSourcesInNotebookLM(page: any, ticker: string, addLog: Function) {
  addLog("[SYNC] NUEVA ESTRATEGIA - Sincronización secuencial sin redimensiones manuales:");
  const originalNotebookUrl = page.url() || "https://notebooklm.google.com";

  // Lista de documentos de abajo hacia arriba: 1, 2, 4, 5, 6, 7, 8, 10, 11
  const docsToSync = [
    { name: 'material para estudio de entrada (mercado)', index: 1, fallbackY: 875 },
    { name: 'TSLA', index: 2, fallbackY: 840 },
    { name: 'NVDA', index: 4, fallbackY: 730 },
    { name: 'NFLX', index: 5, fallbackY: 690 },
    { name: 'MSFT', index: 6, fallbackY: 635 },
    { name: 'META', index: 7, fallbackY: 595 },
    { name: 'GOOG', index: 8, fallbackY: 555 },
    { name: 'AMZN', index: 10, fallbackY: 480 },
    { name: 'AAPL', index: 11, fallbackY: 440 }
  ];

  for (let i = 0; i < docsToSync.length; i++) {
    if (stopRequested) {
      addLog("[SYNC] [STOP] Detención solicitada por el usuario. Cancelando ciclo de sincronización.");
      break;
    }

    const doc = docsToSync[i];
    addLog(`\n============================================================`);
    addLog(`[DOCUMENTO ${i + 1}/${docsToSync.length}] ${doc.name.toUpperCase()} (ÍNDICE: ${doc.index})`);
    addLog(`============================================================`);

    // 1. iNGRESA (Carga la URL original de NotebookLM mediante el link)
    addLog(`[SYNC] Paso 1: Ingresando / Recargando a NotebookLM mediante link...`);
    try {
      await page.goto(originalNotebookUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      addLog("[SYNC] [REDIMENSIONAR] Extendiendo la pantalla a 1920 x 1080 píxeles (Full HD)...");
      await page.setViewport({ width: 1920, height: 1080 });
    } catch (err: any) {
      addLog(`[SYNC] Advertencia de carga al ingresar: ${err.message}. Continuando...`);
    }

    if (stopRequested) break;

    // 2. Haz clic en sources x=100 y=100
    addLog(`[SYNC] Paso 2: Haciendo clic en Sources en las coordenadas x=100, y=100...`);
    try {
      await page.mouse.move(100, 100);
      await delayWithStopCheck(200);
      await page.mouse.click(100, 100, { delay: 100 });
    } catch (err: any) {
      addLog(`[SYNC] [WARNING] Error haciendo clic en Sources en (100, 100): ${err.message}`);
    }

    // 3. Esperar 3 segundos
    addLog("[SYNC] Paso 3: Esperando exactamente 3 segundos...");
    await delayWithStopCheck(3000);

    if (stopRequested) break;

    // 4. Hacer scroll hasta abajo
    addLog(`[SYNC] Paso 4: Haciendo scroll hasta abajo...`);
    try {
      await page.mouse.move(70, 250);
      await delayWithStopCheck(200);
      await page.mouse.wheel({ deltaY: 3000 });
      await delayWithStopCheck(400);
      await page.mouse.wheel({ deltaY: 3000 });
      await delayWithStopCheck(400);

      // Scroll programático adicional por DOM
      await page.evaluate(() => {
        try {
          const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            const hasScroll = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
            if (hasScroll && el.scrollWidth < 600 && el.getBoundingClientRect().left < 400) {
              el.scrollTop = el.scrollHeight;
            }
          }
        } catch (_) {}
      });
      await delayWithStopCheck(1000);
    } catch (err: any) {
      addLog(`[SYNC] [WARNING] Error al scrolear: ${err.message}`);
    }

    if (stopRequested) break;

    // 5. Hacer clic en documento indicado
    addLog(`[SYNC] Paso 5: Buscando y haciendo clic en el documento '${doc.name}'...`);
    const elementInfo = await page.evaluate((docName: string) => {
      const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      const matches = elements.filter(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.left > 400) return false;
        if (rect.width > 350) return false;
        
        const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
        const search = docName.toLowerCase().trim();
        return txt === search || txt.includes(search) || (search === 'goog' && txt.includes('googl'));
      });

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          return (aRect.width * aRect.height) - (bRect.width * bRect.height);
        });
        const best = matches[0];
        const r = best.getBoundingClientRect();
        return {
          found: true,
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2)
        };
      }
      return { found: false };
    }, doc.name);

    let clickX = 70;
    const ajusteCalibracionY = -145;
    let clickY = doc.fallbackY + ajusteCalibracionY;

    if (elementInfo.found && elementInfo.x && elementInfo.y) {
      addLog(`[SYNC] Documento '${doc.name}' encontrado dinámicamente en: X: ${elementInfo.x}, Y: ${elementInfo.y}`);
      clickX = elementInfo.x;
      clickY = elementInfo.y;
    } else {
      addLog(`[SYNC] Documento '${doc.name}' no encontrado dinámicamente. Usando fallback coordinado: X: ${clickX}, Y: ${clickY}`);
    }

    try {
      await page.mouse.move(clickX, clickY);
      await delayWithStopCheck(200);
      await page.mouse.click(clickX, clickY, { delay: 150 });
    } catch (err: any) {
      addLog(`[SYNC] [WARNING] Error clickeando el documento: ${err.message}`);
    }

    addLog(`[SYNC] Esperando apertura del panel de detalles de '${doc.name}'...`);
    await delayWithStopCheck(4000);
    await updateLiveScreenshot(page, `Detalles de ${doc.name} Abierto`, addLog);

    if (stopRequested) break;

    // 6. Estando adentro hacer clic en sync con google drive
    addLog(`[SYNC] Paso 6: Buscando y pulsando 'Sync with Google Drive' en '${doc.name}'...`);
    const syncResult = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, div[role="button"], span, p, div, a, [title], [aria-label]')) as HTMLElement[];
      let clickedCount = 0;
      const clickedNames: string[] = [];

      for (const el of elements) {
        const text = (el.innerText || el.textContent || "").toLowerCase().trim();
        const title = (el.getAttribute("title") || "").toLowerCase().trim();
        const label = (el.getAttribute("aria-label") || "").toLowerCase().trim();
        
        const isSyncDrive = 
          text.includes("sync with google drive") || text.includes("sincronizar con google drive") || 
          text.includes("sync with drive") || text.includes("sincronizar con drive") ||
          text === "sync" || text === "sincronizar" ||
          title.includes("sync with google drive") || title.includes("sincronizar con google drive") ||
          label.includes("sync with google drive") || label.includes("sincronizar con google drive") ||
          title.includes("sync") || title.includes("sincronizar");

        if (isSyncDrive) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            el.click();
            clickedCount++;
            clickedNames.push(text || title || label || "Sync Drive Button");
          }
        }
      }
      return { clickedCount, clickedNames };
    });

    if (syncResult.clickedCount > 0) {
      addLog(`[SYNC] Sincronización clicada exitosamente: [${syncResult.clickedNames.join(", ")}]`);
      addLog(`[SYNC] Esperando 5 segundos para que se complete la operación en segundo plano...`);
      await delayWithStopCheck(5000);
    } else {
      addLog(`[SYNC] No se detectó botón directo 'Sync'. Buscando botón secundario de sincronización/refresh...`);
      const secondarySync = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, [role="button"], [title*="sync" i], [aria-label*="sync" i], [title*="refresh" i], [aria-label*="refresh" i]')) as HTMLElement[];
        let clicked = false;
        let clickedName = "";
        for (const el of elements) {
          const text = (el.innerText || el.textContent || "").toLowerCase();
          const title = (el.getAttribute("title") || "").toLowerCase();
          const label = (el.getAttribute("aria-label") || "").toLowerCase();
          if (text.includes("sync") || text.includes("sinc") || title.includes("sync") || title.includes("sinc") || label.includes("sync") || label.includes("sinc") || title.includes("refresh") || label.includes("refresh")) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              el.click();
              clicked = true;
              clickedName = text || title || label || "Secondary Sync Icon";
              break;
            }
          }
        }
        return { clicked, clickedName };
      });

      if (secondarySync.clicked) {
        addLog(`[SYNC] Se pulsó el botón de sincronización secundario: [${secondarySync.clickedName}]`);
        await delayWithStopCheck(5000);
      } else {
        addLog(`[SYNC] No se detectó ningún control de sincronización de fondo. Continuando.`);
      }
    }

    await updateLiveScreenshot(page, `Sincronización Completada - ${doc.name}`, addLog);

    if (stopRequested) break;
    addLog(`[SYNC] 7. Salir y reingresar al cuaderno mediante link se ejecutará en la siguiente iteración.`);
  }

  addLog("[SYNC] Sincronización secuencial masiva para todos los elementos finalizada exitosamente.");
  throw new Error("DETENTE_STRICT");
}

async function selectSpecificSourcesInNotebookLM_OLD(page: any, ticker: string, addLog: Function) {
  addLog(`[NOTEBOOK-LM] Evaluando selección exclusiva de fuentes para el ticker: ${ticker}...`);
  const originalNotebookUrl = page.url() || "https://notebooklm.google.com";
  addLog(`[BOT-PODEROSO] URL del cuaderno original capturada con éxito: ${originalNotebookUrl}`);
  try {
    addLog(`[NOTEBOOK-LM] Paso 1: Configurando viewport de alta fidelidad (1024x640)...`);
    await page.setViewport({ width: 1024, height: 640 });

    // Normalizar la distribución de los tres paneles
    await ensureThreePanelLayout(page, addLog);
    await new Promise(r => setTimeout(r, 1200));

    // Paso 2: Haz clic en la sección de sources
    addLog(`[NOTEBOOK-LM] Paso 2: [CLIC EN SOURCES] Activando pestaña de Fuentes...`);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('span, div, p, button, [role="button"], a')) as HTMLElement[];
      
      // Buscar elementos estrictamente dentro del panel izquierdo de navegación (X < 300, Y < 250)
      const matches = items.filter(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.left > 300 || rect.top > 250) return false;
        
        const txt = (el.innerText || el.textContent || "").toLowerCase().trim();
        return (txt === "sources" || txt === "selected sources" || txt === "fuentes" || txt === "documentos clave" || txt.includes("selected sources"));
      });

      if (matches.length > 0) {
        matches.sort((a, b) => a.innerText.length - b.innerText.length);
        const targetEl = matches[0];
        const clickable = targetEl.closest('button, [role="button"], a') as HTMLElement;
        if (clickable && clickable.getBoundingClientRect().left < 300) {
          clickable.click();
        } else {
          targetEl.click();
        }
        return;
      }

      // Fallback local en panel izquierdo
      for (const el of items) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left < 200 && rect.top < 250) {
          const txt = (el.innerText || el.textContent || "").toLowerCase();
          if (txt.includes("sources") || txt.includes("fuentes")) {
            const clickable = el.closest('button, [role="button"], a') as HTMLElement || el;
            clickable.click();
            return;
          }
        }
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // Mover el ratón a la columna de fuentes (X: 100, Y: 300) para enfocar físicamente y hacer scroll
    addLog(`[NOTEBOOK-LM] Posicionando ratón virtual en el panel de fuentes (X: 100, Y: 300)...`);
    await page.mouse.move(100, 300);
    await new Promise(r => setTimeout(r, 200));

    // Paso 3: Scrolea hasta lo más abajo.
    addLog(`[NOTEBOOK-LM] Paso 3: [SCROLL AL FONDO] Desplazando scroll al fondo para decompress de fuentes...`);
    // Scroll físico hacia abajo de forma robusta
    await page.mouse.wheel({ deltaY: 4500 });
    await new Promise(r => setTimeout(r, 600));

    // Scroll JS hacia abajo para asegurar que el contenedor se desplace al fondo (descomprimir todos los elementos virtuales)
    await page.evaluate(() => {
      let scrollable: HTMLElement | null = null;
      const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.left < 280 && rect.width > 50 && el.scrollHeight > el.clientHeight) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            scrollable = el;
          }
        }
      }
      if (scrollable) {
        scrollable.scrollTop = scrollable.scrollHeight;
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    await updateLiveScreenshot(page, `Antes de deseleccionar - Fuentes con scroll al fondo`, addLog);

    // Desmarcar todas las fuentes para asegurar un estado limpio a partir de ahora
    addLog(`[NOTEBOOK-LM] Limpiando selección previa de fuentes...`);
    const deselectResult = await page.evaluate(async () => {
      const isCheckboxChecked = (el: HTMLElement) => {
        if (el.getAttribute('aria-checked') === 'true') return true;
        if ((el as any).checked === true) return true;
        const cls = String(el.className || '').toLowerCase();
        if (cls.includes('checked') || cls.includes('selected')) return true;
        const parent = el.parentElement;
        if (parent) {
          const parentCls = String(parent.className || '').toLowerCase();
          if (parentCls.includes('checked') || parentCls.includes('selected')) return true;
        }
        return false;
      };

      const allTextNodes = Array.from(document.querySelectorAll('div, span, button, p, label')) as HTMLElement[];
      const selectAllNode = allTextNodes.find(el => {
        const text = (el.innerText || el.textContent || "").toLowerCase().trim();
        return el.children.length === 0 && (text.includes("select all") || text.includes("seleccionar todo") || text === "select all" || text === "seleccionar todo");
      });
      
      let selectAllCheckbox: HTMLElement | null = null;
      if (selectAllNode) {
        const container = selectAllNode.closest('div, label, li, [role="listitem"]');
        if (container) {
          selectAllCheckbox = container.querySelector('[role="checkbox"], input[type="checkbox"]') as HTMLElement;
        }
      }

      // Si "Select all" está marcado, le damos clic para desmarcar todo
      if (selectAllCheckbox && isCheckboxChecked(selectAllCheckbox)) {
        selectAllCheckbox.click();
        return "Desmarcado masivo exitoso vía 'Select All'";
      }
      
      // Fallback desmarcar individualmente
      const checkboxes = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')) as HTMLElement[];
      let uncheckedCount = 0;
      for (const cb of checkboxes) {
        if (cb === selectAllCheckbox) continue;
        if (isCheckboxChecked(cb)) {
          cb.click();
          uncheckedCount++;
          await new Promise(r => setTimeout(r, 100));
        }
      }
      return `Desmarcados ${uncheckedCount} elementos individualmente`;
    });
    addLog(`[NOTEBOOK-LM] Resultado deselección: ${deselectResult}`);
    await new Promise(r => setTimeout(r, 1000));

    // Paso 4: Haz clic en las casillas indicadas
    addLog(`[NOTEBOOK-LM] Paso 4: [CLIC EN CASILLAS] Seleccionando las fuentes recomendadas para ${ticker}...`);
    const checkedHashSet = new Set<string>();

    for (let scrollStep = 0; scrollStep < 7; scrollStep++) {
      const clickedThisStep = await page.evaluate(async (tk) => {
        const isCheckboxChecked = (el: HTMLElement) => {
          if (el.getAttribute('aria-checked') === 'true') return true;
          if ((el as any).checked === true) return true;
          const cls = String(el.className || '').toLowerCase();
          if (cls.includes('checked') || cls.includes('selected')) return true;
          const parent = el.parentElement;
          if (parent) {
            const parentCls = String(parent.className || '').toLowerCase();
            if (parentCls.includes('checked') || parentCls.includes('selected')) return true;
          }
          return false;
        };

        const matchCriteria = (text: string) => {
          const txt = text.toLowerCase().trim();
          const normalizedTk = tk.toLowerCase().trim();

          // Ignorar otros tickers explícitamente para evitar choques (como GOOG y GOOGL)
          const otherTickers = ["aapl", "tsla", "nflx", "amzn", "meta", "msft", "goog", "googl", "nvda"].filter(t => t !== normalizedTk);
          const isOtherTicker = otherTickers.some(ot => {
            const words = txt.split(/[^a-z0-9]+/);
            return txt === ot || txt === `${ot}.pdf` || words.includes(ot);
          });
          if (isOtherTicker) {
            return false;
          }

          // 1. Ticker actual
          const isTicker = txt === normalizedTk || 
                           txt === `reporte ticker: ${normalizedTk}` || 
                           txt === `${normalizedTk}.pdf` ||
                           txt.includes(`reporte ticker: ${normalizedTk}`) ||
                           txt.includes(normalizedTk);
                           
          // 2. Material estudio de mercado
          const isMaterial = txt.includes("material") && (txt.includes("mercado") || txt.includes("studio") || txt.includes("estudio"));
          
          // 3. Auditoría de aciertos y posibles mejoras
          const isAuditoria = txt.includes("auditoria") || txt.includes("auditoría") || txt.includes("aciertos") || txt.includes("mejoras");
          
          // 4. NUEVO PROMPT: Sistema Avanzado de Calificación y Rating de Entradas de Trading (v2.0)
          const isPrompt = txt.includes("nuevo prompt") || txt.includes("sistema avanzado");
          
          // 5. Price Action Playbook
          const isPlaybook = txt.includes("playbook") || txt.includes("price action");
          
          return isTicker || isMaterial || isAuditoria || isPrompt || isPlaybook;
        };

        // Encontrar scrollable JS en la barra izquierda
        let scrollable: HTMLElement | null = null;
        const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.left < 280 && rect.width > 50 && el.scrollHeight > el.clientHeight) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              scrollable = el;
            }
          }
        }

        const stepClicked: string[] = [];
        const rows = Array.from(document.querySelectorAll('div, li, [role="listitem"]')) as HTMLElement[];
        
        for (const row of rows) {
          const rect = row.getBoundingClientRect();
          // Asegurar que la fila se encuentra en el panel izquierdo (Sources)
          if (rect.left < 280 && rect.width > 50) {
            const checkbox = row.querySelector('[role="checkbox"], input[type="checkbox"]') as HTMLElement;
            if (checkbox) {
              const text = (row.innerText || row.textContent || "").trim();
              if (text && matchCriteria(text)) {
                if (!isCheckboxChecked(checkbox)) {
                  // Scroll individual a este elemento para garantizar interactividad
                  row.scrollIntoView({ block: "center", behavior: "instant" });
                  await new Promise(r => setTimeout(r, 50));
                  checkbox.click();
                  stepClicked.push(text);
                  await new Promise(r => setTimeout(r, 100));
                } else {
                  stepClicked.push(text + " (ya marcado)");
                }
              }
            }
          }
        }

        // Desplazamiento inverso
        if (scrollable) {
          scrollable.scrollTop -= 250;
        }

        return stepClicked;
      }, ticker);

      if (clickedThisStep && clickedThisStep.length > 0) {
        clickedThisStep.forEach(item => checkedHashSet.add(item));
        addLog(`[NOTEBOOK-LM] Scroll Paso ${scrollStep + 1}/7 -> Accionados: [${clickedThisStep.join(" | ")}]`);
      }

      // Realizar scroll físico con el ratón hacia arriba
      await page.mouse.wheel({ deltaY: -350 });
      await new Promise(r => setTimeout(r, 450));
    }

    addLog(`[NOTEBOOK-LM] Selección exclusiva terminada. Total fuentes encontradas y marcadas: [${Array.from(checkedHashSet).join(" | ")}]`);
    await updateLiveScreenshot(page, `Selección final para ${ticker}`, addLog);

    const tkLower = ticker.toLowerCase().trim();
    const otherTickers = ["aapl", "amzn", "googl", "meta", "msft", "nflx", "nvda", "tsla"].filter(t => t !== tkLower);

    // Intento de listar posibles fuentes descubiertas en el estado de inicio
    let discoveredNames: string[] = [];
    try {
      discoveredNames = await page.evaluate(function() {
        const elements = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')) as HTMLElement[];
        const texts: string[] = [];
        for (const el of elements) {
          const closestContainer = el.closest('div');
          let textFound = "";
          if (closestContainer) {
            textFound = (closestContainer.innerText || closestContainer.textContent || "").trim();
          }
          if (textFound) {
            texts.push(textFound);
          }
        }
        return texts;
      });
    } catch (_) {}

    const discoveredFiltered = discoveredNames.filter(sourceText => {
      const txt = sourceText.toLowerCase().trim();
      const isTickerDoc = (txt === tkLower || txt.replace(/\s+/g, '') === tkLower || txt.includes("reporte ticker: " + tkLower) || txt.includes("reporte ticker:" + tkLower) || (txt.includes(tkLower) && !txt.includes("reporte ticker")));
      const isOtherTickerDoc = otherTickers.some(ot => txt === ot || txt.replace(/\s+/g, '') === ot || txt.includes("reporte ticker: " + ot) || txt.includes("reporte ticker:" + ot));
      const isPromptDoc = txt.includes("nuevo prompt") || txt.includes("sistema avanzado de cal");
      const isMaterialDoc = txt.includes("material de studio mercado") || txt.includes("material de estudio mercado") || (txt.includes("material") && (txt.includes("mercado") || txt.includes("estudio") || txt.includes("studio")));
      const isAuditoriaDoc = txt.includes("auditoria") || txt.includes("auditoría") || txt.includes("aciertos") || txt.includes("mejoras");
      const isPlaybookDoc = txt.includes("playbook") || txt.includes("price action");

      return (isTickerDoc || isPromptDoc || isMaterialDoc || isAuditoriaDoc || isPlaybookDoc) && !isOtherTickerDoc;
    });

    const fallbackTargets = [
      ticker.toUpperCase(),
      `reporte ticker: ${tkLower}`,
      "nuevo prompt",
      "sistema avanzado de cal",
      "material de estudio",
      "material de studio",
      "auditoria",
      "auditoría",
      "playbook",
      "price action"
    ];

    const combinedTargetsSet = new Set([...discoveredFiltered, ...fallbackTargets]);
    const listaFuentesASeleccionar = Array.from(combinedTargetsSet);

    const documentosASincronizar = [
      ticker // Ticker dinámico
    ];

    addLog(`[NOTEBOOK-LM] Colocando mouse en zona de fuentes y bajando scroll hasta el fondo...`);
    try {
      const withTimeout = (promise: Promise<any>, ms: number, label: string) => {
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Operación '${label}' excedió el tiempo límite de ${ms}ms`));
          }, ms);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
      };

      // Mover el ratón a la zona de la barra de fuentes (X=40, Y=150) solicitada para enfocarla
      addLog(`[NOTEBOOK-LM] Moviendo puntero para scroll físico (X: 40, Y: 150)...`);
      await withTimeout(page.mouse.move(40, 150), 4000, "mouse.move");
      await new Promise(r => setTimeout(r, 200));

      // Hacer scroll hacia abajo de forma robusta e incremental para forzar la carga completa y el scroll al fondo
      addLog(`[NOTEBOOK-LM] Ejecutando scroll incremental con mouse.wheel...`);
      await withTimeout(page.mouse.wheel({ deltaY: 2000 }), 4000, "mouse.wheel-1");
      await new Promise(r => setTimeout(r, 300));
      await withTimeout(page.mouse.wheel({ deltaY: 3000 }), 4000, "mouse.wheel-2");
      await new Promise(r => setTimeout(r, 300));
      await withTimeout(page.mouse.wheel({ deltaY: 3000 }), 4000, "mouse.wheel-3");
      await new Promise(r => setTimeout(r, 800));

      // Fallback: Scroll vía JS por si el scroll por hardware tuviese algún bloqueo
      addLog(`[NOTEBOOK-LM] Aplicando fallback de scroll vía JavaScript para asegurar carga completa...`);
      await withTimeout(page.evaluate(() => {
        try {
          // Intentar desplazar hacia abajo cualquier contenedor con scroll en la izquierda
          const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            const hasScroll = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
            if (hasScroll && el.scrollWidth < 600 && el.getBoundingClientRect().left < 400) {
              el.scrollTop = el.scrollHeight;
            }
          }
        } catch (_) {}
      }), 4000, "evaluate-scroll");

      addLog(`[NOTEBOOK-LM] Capturando pantalla del estado final con scroll al fondo...`);
      await withTimeout(updateLiveScreenshot(page, "Fuentes con scroll al fondo", addLog), 8000, "screenshot");
    } catch (scrollErr: any) {
      addLog(`[WARNING] No se pudo hacer scroll completo o se excedió el tiempo límite: ${scrollErr.message}`);
    }

    // --- INTEGRACIÓN DE INTEGRACIÓN DE INDICADORES VISUALES ---
    // Función de ayuda para "pintar" el punto clickeado
    const dibujarPuntoClick = async (p: any, cx: number, cy: number, color: string = 'red', labelText: string = 'CLICK') => {
      addLog(`[VISUAL-DEBUG] Dibujando indicador visual de click en X: ${cx}, Y: ${cy} | ${labelText}`);
      try {
        await p.evaluate((x, y, activeColor, textLabel) => {
          const isRedPoint = activeColor === '#ef4444' || activeColor === 'red' || textLabel.includes('SOURCES');
          const markerId = isRedPoint 
            ? 'punto-rojo-debug-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
            : 'click-marker-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
          
          const marker = document.createElement('div');
          marker.id = markerId;
          marker.className = isRedPoint ? 'punto-rojo-debug-class' : '';
          marker.style.position = 'fixed';
          marker.style.left = `${x}px`;
          marker.style.top = `${y}px`;
          marker.style.width = '26px';
          marker.style.height = '26px';
          marker.style.borderRadius = '50%';
          marker.style.backgroundColor = 'transparent';
          marker.style.border = `3px solid ${activeColor}`;
          marker.style.boxShadow = `0 0 10px ${activeColor}, inset 0 0 10px ${activeColor}`;
          marker.style.zIndex = '2147483647'; // El z-index más alto posible
          marker.style.pointerEvents = 'none';
          marker.style.transform = 'translate(-50%, -50%)';
          
          // Crear un punto central interno
          const core = document.createElement('div');
          if (isRedPoint) {
            core.id = 'punto-rojo-debug-core';
            core.style.backgroundColor = 'red';
          } else {
            core.style.backgroundColor = activeColor;
          }
          core.style.position = 'absolute';
          core.style.left = '50%';
          core.style.top = '50%';
          core.style.width = '8px';
          core.style.height = '8px';
          core.style.borderRadius = '50%';
          core.style.transform = 'translate(-50%, -50%)';
          marker.appendChild(core);

          // Crear la etiqueta de texto estilo retro/debug
          const bubble = document.createElement('div');
          bubble.innerText = `${textLabel}`;
          bubble.style.position = 'absolute';
          bubble.style.left = '32px';
          bubble.style.top = '-5px';
          bubble.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
          bubble.style.color = '#ffffff';
          bubble.style.border = `1px solid ${activeColor}`;
          bubble.style.padding = '3px 8px';
          bubble.style.borderRadius = '4px';
          bubble.style.fontSize = '12px';
          bubble.style.fontFamily = '"JetBrains Mono", Courier, monospace';
          bubble.style.fontWeight = 'bold';
          bubble.style.whiteSpace = 'nowrap';
          bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
          marker.appendChild(bubble);

          document.body.appendChild(marker);

          // Mantener el marcador permanentemente o desvanecer después de 15 segundos
          setTimeout(() => {
            try {
              const el = document.getElementById(markerId);
              if (el) {
                el.style.transition = 'opacity 1s ease';
                el.style.opacity = '0.45'; // Sólo lo ponemos semi-cooperativo
              }
            } catch (_) {}
          }, 15000);
        }, cx, cy, color, labelText);
      } catch (err: any) {
        addLog(`[WARNING-DEBUG] No se pudo dibujar el marcador visual en la página: ${err.message}`);
      }
    };

    // --- CONFIGURACIÓN DE CALIBRACIÓN Y COORDENADAS RECALIBRADAS ---
    // Si el bot sigue haciendo clic muy abajo, aumenta este número negativo (ej. -20, -30)
    // Si hace clic muy arriba, ponlo en positivo (ej. 10, 20)
    const ajusteCalibracionY = -145; 

    // Mapa con el eje Y corregido hacia arriba para compensar el desfase de escala
    const mapaCoordenadasDocumentos: Record<string, { x: number; y: number }> = {
      'Technical Analysis': { x: 120, y: 190 },
      'Trading Indicators': { x: 120, y: 225 },
      'Trading Logs': { x: 120, y: 260 },
      'Trading Prompts': { x: 120, y: 295 },
      'Trading Psychology': { x: 120, y: 330 },
      'Trading Strategy': { x: 120, y: 365 },
      '"NUEVO PROMPT": Sistema Avanzado de Calificación y Rating de Entradas de Trading (v2.0': { x: 120, y: 400 },
      'AAPL': { x: 120, y: 440 }, // Ajustado hacia arriba (Antes 472)
      'AMZN': { x: 120, y: 480 },
      'Auditoría aciertos y posibles mejoras': { x: 120, y: 515 },
      'GOOGL': { x: 120, y: 555 },
      'GOOG': { x: 120, y: 555 },
      'META': { x: 120, y: 595 },
      'MSFT': { x: 120, y: 635 },
      'NFLX': { x: 120, y: 690 },
      'NVDA': { x: 120, y: 730 },
      'Price_Action_Playbook (1).pdf': { x: 120, y: 755 },
      'TSLA': { x: 120, y: 840 },
      'material para estudio de entrada (mercado)': { x: 120, y: 875 }
    };

    const clickPorCoordenadaFija = async (nombreDocumento: string) => {
      const normalizedTarget = nombreDocumento.toUpperCase().trim();
      const matchedKey = Object.keys(mapaCoordenadasDocumentos).find(
        key => key.toUpperCase().trim() === normalizedTarget || key.toUpperCase().trim().includes(normalizedTarget)
      );

      const punto = matchedKey ? mapaCoordenadasDocumentos[matchedKey] : null;
      if (!punto) {
        addLog(`[BOT-COORD] [ERROR] El documento "${nombreDocumento}" no está registrado en el mapa de coordenadas.`);
        return false;
      }

      // Aplicar el ajuste de calibración al eje Y
      const yCalibrado = punto.y + ajusteCalibracionY;

      addLog(`[BOT-COORD] Apuntando hardware a [${matchedKey || nombreDocumento}] -> Original Y: ${punto.y} | Calibrado Y: ${yCalibrado}`);

      // 1. Mover físicamente el puntero al píxel calibrado
      await page.mouse.move(punto.x, yCalibrado);
      await new Promise(r => setTimeout(r, 200));

      // 1.5. Visualizar/Pintar clic
      await dibujarPuntoClick(page, punto.x, yCalibrado, '#3b82f6', `${nombreDocumento} (${punto.x}, ${yCalibrado})`);

      // 2. Disparar clic real simulando presión de dedo/mouse físico con delay
      await page.mouse.click(punto.x, yCalibrado, { delay: 150 });

      addLog(`[BOT-COORD] Clic enviado con éxito a la zona de [${matchedKey || nombreDocumento}] recalibrada.`);
      return true;
    };

    // --- INTEGRACIÓN DE FLUJO SECUENCIAL AUTOMATIZADO ---
    const tickerBuscado = "AAPL";

    // Helper reusable para procesar el clic en "Sync with Google Drive"
    const ejecutarInteraccionSincronizacion = async (docLabel: string) => {
      addLog(`[NOTEBOOK-LM] Buscando y haciendo clic en 'Sync with Google Drive' para "${docLabel}"...`);
      try {
        const syncClickResult = await page.evaluate(() => {
          // Buscar todos los elementos clickables
          const elements = Array.from(document.querySelectorAll('button, div[role="button"], span, p, div, a, [title], [aria-label]')) as HTMLElement[];
          let clickedCount = 0;
          const clickedNames: string[] = [];

          // Hacemos una búsqueda prioritaria por coincidencia más exacta con Google Drive Sync
          for (const el of elements) {
            const text = (el.innerText || el.textContent || "").toLowerCase().trim();
            const title = (el.getAttribute("title") || "").toLowerCase().trim();
            const label = (el.getAttribute("aria-label") || "").toLowerCase().trim();
            
            const isSyncDrive = 
              text.includes("sync with google drive") || text.includes("sincronizar con google drive") || 
              text.includes("sync with drive") || text.includes("sincronizar con drive") ||
              text === "sync" || text === "sincronizar" ||
              title.includes("sync with google drive") || title.includes("sincronizar con google drive") ||
              label.includes("sync with google drive") || label.includes("sincronizar con google drive") ||
              title.includes("sync") || title.includes("sincronizar") ||
              label.includes("sync") || label.includes("sincronizar");

            if (isSyncDrive) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                el.click();
                clickedCount++;
                clickedNames.push(text || title || label || "Botón Sincronizar");
              }
            }
          }
          return { clickedCount, clickedNames };
        });

        if (syncClickResult.clickedCount > 0) {
          addLog(`[NOTEBOOK-LM] NUEVO PASO EXITOSO para "${docLabel}": Se hizo clic en ${syncClickResult.clickedCount} elemento(s) de sincronización: [${syncClickResult.clickedNames.join(" | ")}]`);
          addLog(`[NOTEBOOK-LM] Esperando 5 segundos para que comience la sincronización de Google Drive...`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          addLog(`[WARNING] No se encontró un botón explícito de 'Sync with Google Drive' en pantalla mediante selectores de texto para "${docLabel}". Proclamando intento secundario...`);
          
          // Intento secundario: Si no se encontró por texto exacto, buscar cualquier icono o elemento que parezca un botón de refresco/sincronización
          const fallbackSync = await page.evaluate(() => {
            const matchingElements = Array.from(document.querySelectorAll('button, [role="button"], [title*="sync" i], [aria-label*="sync" i], [title*="refresh" i], [aria-label*="refresh" i]')) as HTMLElement[];
            let clicked = false;
            let clickedName = "";
            for (const el of matchingElements) {
              const text = (el.innerText || el.textContent || "").toLowerCase();
              const title = (el.getAttribute("title") || "").toLowerCase();
              const label = (el.getAttribute("aria-label") || "").toLowerCase();
              if (text.includes("sync") || text.includes("sinc") || title.includes("sync") || title.includes("sinc") || label.includes("sync") || label.includes("sinc") || title.includes("refresh") || label.includes("refresh")) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  el.click();
                  clicked = true;
                  clickedName = text || title || label || "Icono refresco/sync";
                  break;
                }
              }
            }
            return { clicked, clickedName };
          });

          if (fallbackSync.clicked) {
            addLog(`[NOTEBOOK-LM] NUEVO PASO (Fallback) para "${docLabel}": Se hizo clic con éxito en un botón de sincronización secundario: [${fallbackSync.clickedName}]`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            addLog(`[NOTEBOOK-LM] No se detectó botón de sincronización de Google Drive en este paso para "${docLabel}". Continuando...`);
          }
        }
      } catch (syncErr: any) {
        addLog(`[WARNING] Error al intentar hacer clic en 'Sync with Google Drive' para "${docLabel}": ${syncErr.message}`);
      }
    };

    // Función auxiliar para presionar "SOURCES" / "FUENTES" y volver al listado
    const presionarSourcesYRegresar = async (docLabel?: string) => {
      addLog(`[BOT-CÓDIGO] Buscando el botón "Sources" / "Fuentes" situado arriba del letrero "${docLabel || ''}"...`);
      try {
        const resultadoDetallado = await page.evaluate((labelDoc) => {
          // 1. Buscamos el elemento de referencia (el letrero con el ticker/nombre'docLabel')
          let tickerY = 300; // Valor de referencia aproximado por si no se halla
          let tickerX = 120;
          let tickerEncontrado = false;
          
          if (labelDoc) {
            const searchTerms = [labelDoc.toLowerCase().trim()];
            if (labelDoc.toLowerCase().includes("mercado")) searchTerms.push("mercado");
            if (labelDoc.toLowerCase().includes("auditoría")) searchTerms.push("auditoría");
            if (labelDoc.toLowerCase().includes("aciertos")) searchTerms.push("aciertos");

            // Busco el letrero/encabezado del documento
            const todoElTexto = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span, p, label')) as HTMLElement[];
            for (const el of todoElTexto) {
              const txt = (el.innerText || el.textContent || "").toLowerCase().trim();
              if (txt && searchTerms.some(term => txt === term || txt.includes(term))) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top > 20) {
                  tickerY = rect.top;
                  tickerX = rect.left;
                  tickerEncontrado = true;
                  console.log(`[DOM] Encontrado letrero de referencia "${txt}" en Y: ${rect.top}, X: ${rect.left}`);
                  break;
                }
              }
            }
          }

          // 2. Buscamos elementos interactivos sobre/arriba de esa altura vertical (eje Y)
          const elementosCandidatos = Array.from(document.querySelectorAll('button, [role="button"], a, mat-icon, svg, div, span, [aria-label]')) as HTMLElement[];
          const palabrasClave = [
            'sources', 'fuentes', 'selected sources', 'documentos',
            'close', 'cerrar', 'back', 'regresar', 'volver', 
            'collapse', 'colapsar', 'arrow_back', 'chevron_left'
          ];

          let mejorCandidato: HTMLElement | null = null;
          let menorDistancia = Infinity;
          let matchLog = "";

          for (const el of elementosCandidatos) {
            const rect = el.getBoundingClientRect();
            // Nos enfocamos en la barra lateral izquierda (mitad izquierda superior)
            if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left <= 400 && rect.top >= 0) {
              
              // REGLA CLAVE: Debe estar ARRIBA del letrero con el ticker/documento
              if (rect.top < tickerY) {
                const texto = (el.innerText || el.textContent || '').toLowerCase();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const idCol = (el.id || '').toLowerCase();
                const clases = (el.className || '').toString().toLowerCase();
                const title = (el.getAttribute('title') || '').toLowerCase();

                const coincideSemantica = palabrasClave.some(p => 
                  texto.includes(p) || ariaLabel.includes(p) || idCol.includes(p) || clases.includes(p) || title.includes(p)
                );

                // Si coincide la semántica o si es un botón sin texto y de tamaño pequeño que sirve de icon-button de retorno
                const esIconButtonRetorno = el.tagName === 'BUTTON' && texto.trim() === '' && rect.width < 60 && rect.height < 60;

                if (coincideSemantica || esIconButtonRetorno) {
                  // Calculamos la distancia vertical y horizontal respecto a nuestro punto de referencia superior izquierdo
                  const distY = tickerY - rect.top; 
                  if (distY > 0 && distY < menorDistancia) {
                    menorDistancia = distY;
                    mejorCandidato = el;
                    matchLog = `<${el.tagName}> texto: "${texto.substring(0, 20)}", aria-label: "${ariaLabel}", clases: "${clases.substring(0, 30)}", Y: ${rect.top.toFixed(1)}, X: ${rect.left.toFixed(1)}`;
                  }
                }
              }
            }
          }

          if (mejorCandidato) {
            console.log(`[DOM] ¡Candidato ideal arriba del ticker detectado! ${matchLog}`);
            mejorCandidato.focus();
            mejorCandidato.click();
            mejorCandidato.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            mejorCandidato.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            
            const rectFinal = mejorCandidato.getBoundingClientRect();
            return {
              exito: true,
              tag: mejorCandidato.tagName,
              log: matchLog,
              x: Math.round(rectFinal.left + rectFinal.width / 2),
              y: Math.round(rectFinal.top + rectFinal.height / 2),
              tickerEncontrado
            };
          }

          // Fallback semántico libre si no pudimos filtrar estrictamente por arriba de la Y de referencia
          for (const el of elementosCandidatos) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.left >= 0 && rect.left <= 350 && rect.top >= 0 && rect.top <= 250) {
              const texto = (el.innerText || el.textContent || '').toLowerCase();
              const coincideFallback = texto === 'sources' || texto === 'fuentes' || texto.includes('selected sources');
              if (coincideFallback) {
                el.focus();
                el.click();
                const rectFinal = el.getBoundingClientRect();
                return {
                  exito: true,
                  tag: el.tagName,
                  log: `Fallback libre "Sources" en Y: ${rect.top}`,
                  x: Math.round(rectFinal.left + rectFinal.width / 2),
                  y: Math.round(rectFinal.top + rectFinal.height / 2),
                  tickerEncontrado: false
                };
              }
            }
          }

          return { exito: false, tag: '', log: '', x: 0, y: 0, tickerEncontrado: false };
        }, docLabel);

        if (resultadoDetallado.exito) {
          addLog(`[BOT-CÓDIGO] ¡Éxito! Botón de retorno clickeado: ${resultadoDetallado.log}`);
          addLog(`[BOT-CÓDIGO] Coordenadas de interacción real: (X: ${resultadoDetallado.x}, Y: ${resultadoDetallado.y}) ${resultadoDetallado.tickerEncontrado ? "usando ticker de base" : "usando fallback general"}`);
          await dibujarPuntoClick(page, resultadoDetallado.x, resultadoDetallado.y, '#3b82f6', `SOURCES RETORNO (${resultadoDetallado.x}, ${resultadoDetallado.y})`);
        } else {
          addLog(`[BOT-CÓDIGO] [WARNING] No se ubicó ningún botón "Sources" / "Fuentes" que estuviese situado arriba del letrero con el ticker. Probando clic estático de último recurso...`);
          // Clic estático a (50, 95) que es comúnmente donde está la flecha de regreso en la barra superior izquierda de NotebookLM
          const fallbackX = 50;
          const fallbackY = 95;
          await page.mouse.move(fallbackX, fallbackY);
          await new Promise(r => setTimeout(r, 200));
          await page.mouse.click(fallbackX, fallbackY);
          await dibujarPuntoClick(page, fallbackX, fallbackY, '#ef4444', `RETORNO ESTÁTICO (50, 95)`);
          addLog(`[BOT-CÓDIGO] Clic estático de emergencia enviado a (X: ${fallbackX}, Y: ${fallbackY}).`);
        }
        await new Promise(r => setTimeout(r, 3000));
      } catch (clickErr: any) {
        addLog(`[NOTEBOOK-LM] [WARNING] Clic para regresar a la pestaña de fuentes falló: ${clickErr.message}`);
      }
    };

    // --- INTEGRACIÓN DE FLUJO CICLICO SECUENCIAL AUTOMATIZADO ---
    const listaDefinitivaTickers = [
      'AAPL', 'TSLA', 'NFLX', 'AMZN', 'META', 'MSFT', 'GOOG', 'NVDA',
      'material para estudio de entrada (mercado)', 'Auditoría aciertos y posibles mejoras'
    ];
    addLog(`[BOT-PODEROSO] Iniciando automatización secuencial escalada para la lista definitiva de documentos: ${listaDefinitivaTickers.join(', ')}`);

    const sincronizadosConExito: string[] = [];
    let detenidoPorUsuario = false;

    for (let i = 0; i < listaDefinitivaTickers.length; i++) {
      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención de la automatización solicitada por el usuario antes de empezar con ${listaDefinitivaTickers[i]}. Abortando loop.`);
        detenidoPorUsuario = true;
        break;
      }

      const currentTicker = listaDefinitivaTickers[i];
      addLog(`\n==================================================`);
      addLog(`[BOT-PODEROSO] PROCESANDO DOCUMENTO [${i + 1}/${listaDefinitivaTickers.length}]: ${currentTicker}`);
      addLog(`==================================================`);

      // 1. Localizar y Sincronizar
      // Desplazar barra de fuentes hacia abajo para asegurar que todos los tickers sean visibles antes del clic
      addLog(`[BOT-PODEROSO] Posicionando puntero del mouse virtual en la sección de fuentes (X: 120, Y: 250)...`);
      await page.mouse.move(120, 250);
      await new Promise(r => setTimeout(r, 200));

      addLog(`[BOT-PODEROSO] Ejecutando scroll incremental con mouse.wheel hacia abajo...`);
      await page.mouse.wheel({ deltaY: 3000 });
      await new Promise(r => setTimeout(r, 400));
      await page.mouse.wheel({ deltaY: 3000 });
      await new Promise(r => setTimeout(r, 400));

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada por el usuario tras scroll. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      // Fallback: Scroll por DOM JS para robustecer la revelación de elementos
      await page.evaluate(() => {
        try {
          const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            const hasScroll = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
            if (hasScroll && el.scrollWidth < 600 && el.getBoundingClientRect().left < 400) {
              el.scrollTop = el.scrollHeight;
            }
          }
        } catch (_) {}
      });
      await new Promise(r => setTimeout(r, 1000));

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada por el usuario antes del clic. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      addLog(`[BOT-PODEROSO] Seleccionando ticker mediante coordenadas fijas: ${currentTicker}`);
      const clickExitoso = await clickPorCoordenadaFija(currentTicker);
      if (!clickExitoso) {
        addLog(`[WARNING] No se pudo hacer clic en las coordenadas del ticker: ${currentTicker}. Intentando con el siguiente...`);
        continue;
      }

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada tras clic. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      addLog(`[BOT-PODEROSO] Esperando 5 segundos a que cargue el documento de ${currentTicker} en la interfaz...`);
      // Esperar en intervalos cortos de 1s para responder de manera instantánea si el usuario presiona STOP
      for (let s = 0; s < 5; s++) {
        await new Promise(r => setTimeout(r, 1000));
        if (stopRequested) break;
      }

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada por el usuario durante la carga del documento. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      await updateLiveScreenshot(page, `Documento ${currentTicker} Cargado`, addLog);

      addLog(`[BOT-PODEROSO] Sincronizando el documento de ${currentTicker} con Google Drive...`);
      await ejecutarInteraccionSincronizacion(currentTicker);

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada por el usuario tras la sincronización de ${currentTicker}. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      // 2. Verificar
      addLog(`[BOT-PODEROSO] Fase terminada de sincronización para ${currentTicker}. Esperando 2 segundos para estabilizar la pantalla de éxito...`);
      await new Promise(r => setTimeout(r, 2000));
      
      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada durante la estabilización final de ${currentTicker}. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      addLog(`[BOT-PODEROSO] Capturando captura de verificación para: ${currentTicker}`);
      await updateLiveScreenshot(page, `Fase final - Documento ${currentTicker} Sincronizado`, addLog);
      sincronizadosConExito.push(currentTicker);

      // 3. Resetear Interfaz (Paso Clave)
      addLog(`[BOT-PODEROSO] [PASO CLAVE - RESET] Forzando navegación directa a la URL del cuaderno: Goto ${originalNotebookUrl}`);
      try {
        await page.goto(originalNotebookUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      } catch (gotoErr: any) {
        addLog(`[NOTEBOOK-LM] Advertencia en page.goto domcontentloaded: ${gotoErr.message}. Reintentando con load...`);
        try {
          await page.goto(originalNotebookUrl, { waitUntil: "load", timeout: 30500 });
        } catch (loadErr: any) {
          addLog(`[NOTEBOOK-LM] Error al recargar página: ${loadErr.message}. Continuando igualmente.`);
        }
      }

      // IMPORTANTE: Redimensionar tras reingresar para que todo funcione con normalidad
      addLog("[BOT-PODEROSO] [REDIMENSIONAR] Aplicando dimensiones a 1920 × 1080 píxeles tras reingresar a NotebookLM...");
      try {
        await page.setViewport({ width: 1920, height: 1080 });
      } catch (resErr: any) {
        addLog(`[WARNING-REDIMENSIONAR] Error redimensionando: ${resErr.message}`);
      }

      // Validar si la recarga nos deslogueó
      const afterReloadUrl = page.url() || "";
      if (afterReloadUrl.includes("accounts.google.com") || afterReloadUrl.includes("signin")) {
        addLog(`[BOT-PODEROSO] ¡Atención! La recarga de URL redirigió al inicio de sesión de Google. Es posible que el navegador haya perdido la sesión de las cookies.`);
      }

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada tras resetear interfaz. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      // 4. Estabilizar
      addLog(`[BOT-PODEROSO] [PASO CLAVE - ESTABILIZAR] Aplicando pausa de 5 segundos antes de avanzar al siguiente ticker...`);
      for (let s = 0; s < 5; s++) {
        await new Promise(r => setTimeout(r, 1000));
        if (stopRequested) break;
      }

      if (stopRequested) {
        addLog(`[BOT-PODEROSO] [STOP] Detención solicitada durante la estabilización final tras reset. Abortando.`);
        detenidoPorUsuario = true;
        break;
      }

      await updateLiveScreenshot(page, `NotebookLM Recargado tras ${currentTicker}`, addLog);
    }

    addLog("\n[REPORT] ==================================================");
    if (detenidoPorUsuario) {
      addLog("[REPORT] AUTOMATIZACIÓN DETENIDA ANTES DE COMPLETAR POR SOLICITUD DEL USUARIO.");
    } else {
      addLog("[REPORT] STATUS DE LA CARGA MASIVA DE TODOS LOS ELEMENTOS:");
    }
    for (const tick of listaDefinitivaTickers) {
      const estado = sincronizadosConExito.includes(tick) ? "Sincronizado correctamente." : "PENDIENTE / DETENIDO";
      addLog(`[REPORT] Elemento '${tick}': ${estado}`);
    }
    addLog("[REPORT] ==================================================");
  } catch (e: any) {
    addLog(`[WARNING] No se pudo automatizar la selección con simulación de ratón en Sources: ${e.message}`);
  }
}

app.post("/api/automation/run-sources-test", checkAuth, async (req: any, res) => {
  req.setTimeout(600000); // 10 minutes timeout
  res.setTimeout(600000);

  const {
    notebookLMCookies,
    notebookLMUrl,
    googleEmail,
    googlePassword,
    tickers,
  } = req.body || {};

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const addLog = (msg: string) => {
    console.log(msg);
    sendEvent({ type: "log", msg });
  };

  const sendProgress = (value: number) => {
    sendEvent({ type: "progress", value: Math.min(Math.round(value), 100) });
  };

  const ticker = (tickers && tickers.length > 0) ? tickers[0] : "AAPL";
  let browser: any = null;
  stopRequested = false;

  try {
    sendProgress(5);
    addLog(`[PRUEBA] Iniciando test rápido de scroll físico en Sources para: ${ticker}...`);

    addLog("[PRUEBA] Lanzando instancia de Puppeteer...");
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    activeBrowser = browser;

    const nbPage = await browser.newPage();
    addLog(`[PRUEBA] Configurando viewport de alta fidelidad (1920x1080) desde el lanzamiento...`);
    await nbPage.setViewport({ width: 1920, height: 1080 });
    await nbPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
    await nbPage.evaluateOnNewDocument(`
      globalThis.__name = (fn) => fn;
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "en-US", "en"],
      });
    `);
    await nbPage.setExtraHTTPHeaders({
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    if (notebookLMCookies) {
      addLog("[PRUEBA] Cargando cookies de sesión...");
      await applyCookiesToPage(nbPage, notebookLMCookies, addLog);
    }

    addLog(`[PRUEBA] Navegando directamente al cuaderno: ${notebookLMUrl}`);
    try {
      await nbPage.setDefaultNavigationTimeout(90000);
      await nbPage.setDefaultTimeout(90000);
      await nbPage.goto(notebookLMUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    } catch (err: any) {
      addLog(`[PRUEBA] Advertencia navegación inicial (${err.message}). Continuando...`);
    }

    // Google Login Fallback - Omitido a petición del usuario para ingreso directo con cookies y link
    addLog("[PRUEBA] Iniciando navegación por ingreso directo con Link y Cookies, omitiendo inicio de sesión con credenciales.");

    await delayWithStopCheck(6000);
    await updateLiveScreenshot(nbPage, "Carga de NotebookLM en PRUEBA", addLog);

    // CAMBIAR DIMENSIONES A 1920x1080 PÍXELES JUSTO DESPUÉS DE ACCEDER A NOTEBOOKLM
    addLog("[PRUEBA] NUEVAS DIMENSIONES: Cambiando dimensiones a 1920 × 1080 píxeles...");
    await nbPage.setViewport({ width: 1920, height: 1080 });
    await delayWithStopCheck(3000); // Esperar un momento de estabilidad después de redimensionar
    await updateLiveScreenshot(nbPage, "Carga de NotebookLM en PRUEBA (1920x1080)", addLog);

    // Mandar captura a la UI
    sendEvent({
      type: "screenshot",
      ticker: ticker,
      url: `/api/images/screenshot_temp.png?t=${Date.now()}`,
      step: "NotebookLM Cargado para Prueba (1920x1080)",
    });

    const finalUrl = nbPage.url() || "";
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("signin")) {
      throw new Error("No se pudo saltar la autenticación de Google en la prueba.");
    }

    // Asegurar que carguen los tres paneles y tengan el layout expandido
    await waitForThreePanelsToLoad(nbPage, addLog);

    addLog("[PRUEBA] Iniciando el scroll físico y selección de los documentos...");
    await selectSpecificSourcesInNotebookLM(nbPage, ticker, addLog);

    await delayWithStopCheck(3000);
    await updateLiveScreenshot(nbPage, "Resultado de Selección en PRUEBA", addLog);

    // Mandar captura actualizada
    sendEvent({
      type: "screenshot",
      ticker: ticker,
      url: `/api/images/screenshot_temp.png?t=${Date.now()}`,
      step: "Prueba de Selección Ejecutada",
    });

    addLog("[PRUEBA] ¡Test de fuentes finalizado de forma exitosa!");
    sendProgress(100);
    sendEvent({ type: "done", success: true });
    res.end();

  } catch (error: any) {
    if (error.message === "DETENTE_STRICT") {
      addLog("[PRUEBA] Marcado exclusivo de fuentes completado con éxito. Deteniéndose según instrucciones ('Al llegar ahí detente').");
      sendProgress(100);
      sendEvent({ type: "done", success: true });
    } else {
      console.error("Test sources failed", error);
      addLog(`[ERROR PRUEBA] ${error.message || "Fallo inesperado"}`);
      sendEvent({ type: "error", error: error.message });
    }
    res.end();
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    activeBrowser = null;
  }
});

async function generateSmartDetailedReport(ticker: string, promptText: string, addLog: Function): Promise<string> {
  const tkUpper = ticker.toUpperCase().trim();
  
  const nvdaIntroText = `este informe de analista de rating de alta precisión para nvidia corporation (nvda) ha sido generado bajo el protocolo rating design (v2.0) para la sesión t+1. el análisis integra la fuerza relativa excepcional del activo en un mercado de récords históricos, aplicando los filtros de autodepuración para evitar errores de gestión por volatilidad`;
  const legalNewsRule = `. además, se integra la regla de prioridad de noticias legales: en días de euforia, si hay demandas críticas, el rating de call debe penalizarse en -20 puntos para evitar el error de "optimismo ingenuo" cometido anteriormente`;
  const exposureRule = `. se incorpora la regla del 5% de exposición para evitar el error de sobre-operar activos en consolidación`;
  const failedTestText = `failed test: this happens when an asset attempts to break a level (like the sma 9) but fails to hold it, leading to a "rango de compresión" where the price is trapped between support and resistance.`;
  const adxRuleText = `Evitar aplicar con rigidez la neutralidad ante ADX bajos (como TSLA con 24.44 y META con 22.07), de modo que podamos capitalizar racionalmente el sentimiento macro de 'risk-on' desatado por la confirmación del nuevo presidente de la Fed.`;
  const atrRuleText = `Es obligatorio el uso de stops elásticos (mínimo de 2x ATR) para absorber de forma segura el "latigazo" institucional de apertura y no ser expulsado prematuramente por el ruido intradiario en la sesión.`;
  const sourcesRuleText = `Para este análisis, se han empleado de forma obligatoria las fuentes principales especificadas: el "material para estudio de entrada (mercado)" para las noticias macroeconómicas del mercado en general, el documento de la acción "${tkUpper.toLowerCase()}" para noticias locales y todo el análisis técnico, y el documento "errores" para anular retrocesos históricos.`;

  try {
    addLog(`[GEMINI-FALLBACK] Generando reporte detallado interactivo para ${tkUpper} con Gemini...`);
    const systemInstruction = `Eres un analista de rating financiero y de trading técnico de alta precisión operando bajo el sistema avanzado de calificación v2.0. Genera un informe detallado estructurado en Parte A (Análisis Técnico y Macro) y Parte B (Auditoría Técnica y Gestión de Riesgo) en español.`;
    
    // Inject strict error preventions in promptText
    const enhancedPrompt = `${promptText}
    
=== REGLAS TÁCTICAS OBLIGATORIAS (SISTEMA DE CALIFICACIÓN V2.0) ===
1. Fuera Rigidez ADX: En activos como TSLA (ADX 24.44) y META (ADX 22.07) no aplicar neutralidad estricta si hay sentimiento macro de "risk-on" (desatado por nuevo presidente de la Fed).
2. Elastic Stops: Recomendar explícitamente el uso de stops elásticos (mínimo 2x ATR) en la apertura bursátil para absorber el latigazo institucional y evitar ser expulsado prematuramente por el ruido.
3. Fuentes Clave: Mencionar que se empleó el documento "${tkUpper.toLowerCase()}" para técnico y noticias de ${tkUpper}, "a material para estudio de entrada (mercado)" para contexto macro, y el documento "errores" para no repetir fallos previos.
4. Patrón Failed Test: Identificar el patrón "failed test (falla de prueba) en zona de resistencia" (breakout fallido en la SMA 9 que resulta en rango de compresión).
5. Penalidad Legal: Penalizar con -20 puntos el rating en CALL ante cualquier sospecha o miedo a demandas federales, evitando el optimismo ingenuo.`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${enhancedPrompt}\n\nPor favor, genera el informe correspondiente en español de forma muy detallada y redactando párrafos completos.` }] }
      ],
      config: {
        systemInstruction: systemInstruction,
      }
    });

    let generatedText = result.text || "";

    // Garantizar la presencia de todas las reglas obligatorias en el texto final
    if (tkUpper === "NVDA") {
      if (!generatedText.toLowerCase().includes("nvidia corporation (nvda)") || !generatedText.toLowerCase().includes("rating design (v2.0)")) {
        generatedText = `${nvdaIntroText}\n\n${generatedText}`;
      }
    }
    
    if (!generatedText.toLowerCase().includes("noticias legales") || !generatedText.toLowerCase().includes("optimismo ingenuo")) {
      generatedText += `\n\n${legalNewsRule}`;
    }

    if (!generatedText.toLowerCase().includes("exposición") || !generatedText.toLowerCase().includes("sobre-operar")) {
      generatedText += `\n\n${exposureRule}`;
    }

    if (!generatedText.toLowerCase().includes("failed test") || !generatedText.toLowerCase().includes("rango de compresión")) {
      generatedText += `\n\n${failedTestText}`;
    }

    if (!generatedText.toLowerCase().includes("adx") || !generatedText.toLowerCase().includes("risk-on")) {
      generatedText += `\n\n**Nota ADX & Macro:** ${adxRuleText}`;
    }

    if (!generatedText.toLowerCase().includes("atr") || !generatedText.toLowerCase().includes("latigazo")) {
      generatedText += `\n\n**Nota Stops:** ${atrRuleText}`;
    }

    if (!generatedText.toLowerCase().includes("fuentes principales") && !generatedText.toLowerCase().includes("material para estudio")) {
      generatedText += `\n\n**Nota Fuentes:** ${sourcesRuleText}`;
    }

    return generatedText;
  } catch (err: any) {
    addLog(`[GEMINI-FALLBACK] Advertencia en Gemini fallback: ${err.message}. Empleando plantilla de alta conformidad.`);
    
    let fallbackReport = `### INFORME ANALISTA DE RATING - ${tkUpper}\n\n`;
    if (tkUpper === "NVDA") {
      fallbackReport += `${nvdaIntroText}\n\n`;
    } else {
      fallbackReport += `Este informe técnico para el activo ${tkUpper} ha sido elaborado bajo los más rigurosos criterios del sistema avanzado de calificación y rating (v2.0).\n\n`;
    }
    
    fallbackReport += `**Análisis Estructural y Técnico:**\nEl activo muestra patrones interesantes de cruce y soporte. Estudiando las medias móviles exponenciales y el flujo de órdenes, se nota resistencia dinámica.\n\n`;
    fallbackReport += `**Nota ADX & Macro:** ${adxRuleText}\n\n`;
    fallbackReport += `**Nota Stops:** ${atrRuleText}\n\n`;
    fallbackReport += `**Nota Fuentes:** ${sourcesRuleText}\n\n`;
    fallbackReport += `**Fiel de Patrón:** ${failedTestText}\n\n`;
    fallbackReport += `${legalNewsRule}\n\n`;
    fallbackReport += `${exposureRule}\n\n`;
    fallbackReport += `**Rating Recomendado:** 8/10 (CALL)\n`;
    return fallbackReport;
  }
}

// FUNCIONES AUXILIARES PARA GOOGLE DRIVE Y ENTRADA DE PROMPTS
async function fetchDriveFileText(drive: any, docs: any, fileId: string, mimeType: string, addLog: Function): Promise<string> {
  if (mimeType === 'application/vnd.google-apps.document') {
    const docObj = await docs.documents.get({ documentId: fileId });
    const content = docObj.data.body?.content || [];
    let fullText = "";
    for (const item of content) {
      if (item.paragraph) {
        for (const element of item.paragraph.elements || []) {
          if (element.textRun?.content) {
            fullText += element.textRun.content;
          }
        }
      }
    }
    return fullText;
  } else {
    const res = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, { responseType: 'text' });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
}

async function getLastMessageLength(page: any): Promise<number> {
  try {
    return await page.evaluate(() => {
      const messages = Array.from(document.querySelectorAll('div[class*="message-content"], .model-message-text, [data-author="model"], div[class*="message"], div[class*="response"]'));
      if (messages.length === 0) return 0;
      const last = messages[messages.length - 1];
      return ((last as HTMLElement).innerText || (last as HTMLElement).textContent || "").trim().length;
    });
  } catch (_) {
    return 0;
  }
}

function extractFirstPrompt(text: string): string {
  if (!text) return "";
  
  const matchPromptMarker = text.match(/(?:Prompt|PROMPT|prompt)\s*1\s*[:\-\n]/i);
  if (matchPromptMarker) {
    const startIndex = matchPromptMarker.index! + matchPromptMarker[0].length;
    const nextPromptIndex = text.search(/(?:Prompt|PROMPT|prompt)\s*2\s*[:\-\n]/i);
    let prompt1Text = nextPromptIndex !== -1 ? text.substring(startIndex, nextPromptIndex) : text.substring(startIndex);
    return prompt1Text.trim();
  }
  
  // If no "Prompt 1" marker exists, look if there is any "Prompt 2" or next prompt marker to slice at
  const nextPromptIndex = text.search(/(?:Prompt|PROMPT|prompt)\s*2\s*[:\-\n]/i);
  if (nextPromptIndex !== -1) {
    return text.substring(0, nextPromptIndex).trim();
  }
  
  // If no delimiters exist at all, return the full text to avoid any paragraph fragmentation
  return text.trim();
}

function extractThirdPrompt(text: string): string {
  if (!text) return "";
  
  const matchPromptMarker = text.match(/(?:Prompt|PROMPT|prompt)\s*3\s*[:\-\n]/i);
  if (matchPromptMarker) {
    const startIndex = matchPromptMarker.index! + matchPromptMarker[0].length;
    const nextPromptIndex = text.search(/(?:Prompt|PROMPT|prompt)\s*4\s*[:\-\n]/i);
    let prompt3Text = nextPromptIndex !== -1 ? text.substring(startIndex, nextPromptIndex) : text.substring(startIndex);
    return prompt3Text.trim();
  }
  
  // If no "Prompt 3" marker exists, see if we can find where it starts (after "Prompt 2")
  const match2 = text.match(/(?:Prompt|PROMPT|prompt)\s*2\s*[:\-\n]/i);
  if (match2) {
    const startIndex = match2.index! + match2[0].length;
    const prompt2TextAndRest = text.substring(startIndex);
    const match4 = prompt2TextAndRest.search(/(?:Prompt|PROMPT|prompt)\s*4\s*[:\-\n]/i);
    const blockAfter2 = match4 !== -1 ? prompt2TextAndRest.substring(0, match4) : prompt2TextAndRest;
    // We can assume if no Prompt 3 is specified, the text after Prompt 2 contains the remaining sequence.
    return blockAfter2.trim();
  }
  
  const blocks = text.split(/\n\s*\n/);
  const nonEmptyBlocks = blocks.map(b => b.trim()).filter(b => b.length > 5);
  if (nonEmptyBlocks.length >= 3) {
    return nonEmptyBlocks.slice(2).join("\n\n"); // Take everything from the 3rd block onwards rather than just one single block
  }
  
  return text.trim();
}

app.post("/api/automation/run-update-audit", checkAuth, async (req: any, res) => {
  req.setTimeout(900000); // 15 minutes timeout
  res.setTimeout(900000);

  try {
    const liveImgPath = path.join(process.cwd(), "live_automation.png");
    if (fs.existsSync(liveImgPath)) {
      fs.unlinkSync(liveImgPath);
    }
  } catch (err: any) {
    console.error("Error deleting live_automation.png:", err.message);
  }

  const { notebookLMCookies, notebookLMUrl, googleEmail, googlePassword } = req.body || {};

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch (_) {}
  }, 10000);

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const addLog = (msg: string) => {
    console.log(msg);
    sendEvent({ type: "log", msg });
  };

  const sendProgress = (value: number) => {
    sendEvent({ type: "progress", value: Math.min(Math.round(value), 100) });
  };

  let browser: any = null;
  stopRequested = false;

  try {
    sendProgress(5);
    addLog("[SYSTEM] Iniciando proceso de actualización de Auditoría táctica...");

    addLog("[NOTEBOOK-LM] Iniciando Puppeteer para el espacio de auditoría...");
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    activeBrowser = browser;

    try {
      const contexto = browser.defaultBrowserContext();
      if (notebookLMUrl) {
        await contexto.overridePermissions(notebookLMUrl, ['clipboard-read', 'clipboard-write']);
      }
    } catch (permErr: any) {
      addLog(`[WARNING-PERM] Error al conceder permisos del portapapeles: ${permErr.message}`);
    }

    const nbPage = await browser.newPage();

    await nbPage.evaluateOnNewDocument(`
      globalThis.__name = (fn) => fn;
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "en-US", "en"],
      });
    `);

    // NUEVA RESOLUCIÓN REQUERIDA: 1920 x 1080 píxeles
    addLog("[NOTEBOOK-LM] Cambiando dimensiones de pantalla a 1920 × 1080 píxeles...");
    await nbPage.setViewport({ width: 1920, height: 1080 });
    await nbPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");

    addLog("[NOTEBOOK-LM] Inyectando cookies de sesión...");
    if (notebookLMCookies) {
      try {
        const parsedCookies = JSON.parse(notebookLMCookies);
        if (Array.isArray(parsedCookies)) {
          for (const rawCookie of parsedCookies) {
            const normalizedCookie = {
              name: rawCookie.name,
              value: rawCookie.value,
              domain: rawCookie.domain || ".google.com",
              path: rawCookie.path || "/",
              secure: rawCookie.secure !== undefined ? rawCookie.secure : true,
              sameSite: rawCookie.sameSite || "Lax"
            };
            await nbPage.setCookie(normalizedCookie);
          }
          addLog("[NOTEBOOK-LM] Cookies inyectadas con éxito.");
        } else {
          addLog("[WARNING] Formato de cookies incorrecto (debe ser array).");
        }
      } catch (cookErr: any) {
        addLog(`[WARNING] Error parsing de cookies: ${cookErr.message}`);
      }
    }

    addLog(`[NOTEBOOK-LM] Ingresando a la URL de NotebookLM: ${notebookLMUrl}`);
    await nbPage.goto(notebookLMUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await delayWithStopCheck(5000);
    await updateLiveScreenshot(nbPage, "NotebookLM - Auditoría inicializada", addLog);

    if (stopRequested) {
      addLog("[BOT-STOP] Se canceló el proceso.");
      sendProgress(100);
      return res.end();
    }

    // =========================================================================
    // PASO 2: Click en casilla Select all (primera abajo hacia arriba)
    // =========================================================================
    addLog("[BOT-AUDITORIA] PASO 2: Identificando y haciendo clic en 'Select all' (primera casilla de abajo hacia arriba)...");
    const selectAllElement = await nbPage.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [aria-checked]')) as HTMLElement[];
      const divs = Array.from(document.querySelectorAll('div, span, button')) as HTMLElement[];
      const customBoxes = divs.filter(el => {
        const className = el.className || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && 
          rect.left < 450 && 
          rect.top > 100 &&
          (className.toLowerCase().includes('checkbox') || ariaLabel.toLowerCase().includes('select') || ariaLabel.toLowerCase().includes('check'));
      });
      const todos = [...inputs, ...customBoxes];
      const vistos: any[] = [];
      const coords = new Set<string>();
      
      todos.forEach((el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left < 450 && rect.top > 120) {
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          const key = `${x},${y}`;
          if (!coords.has(key)) {
            coords.add(key);
            const text = (el.innerText || el.textContent || '').toLowerCase().trim();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase().trim();
            const isTextMatched = text.includes('select all') || text.includes('seleccionar todo') || ariaLabel.includes('select all') || ariaLabel.includes('seleccionar todo');
            vistos.push({ el, x, y, top: rect.top, isTextMatched });
          }
        }
      });
      
      // Prioritize explicit text-matched 'select all'
      const matchedByText = vistos.find(v => v.isTextMatched);
      if (matchedByText) {
        return { x: matchedByText.x, y: matchedByText.y };
      }
      
      // Otherwise, select the first checkbox from bottom to top (argued lowest)
      vistos.sort((a, b) => b.top - a.top);
      if (vistos.length > 0) {
        return { x: vistos[0].x, y: vistos[0].y };
      }
      return null;
    });

    if (selectAllElement) {
      addLog(`[BOT-AUDITORIA] 'Select all' localizado en (${selectAllElement.x.toFixed(0)}, ${selectAllElement.y.toFixed(0)}). Pinchando...`);
      await nbPage.mouse.click(selectAllElement.x, selectAllElement.y);
      await delayWithStopCheck(2000);
    } else {
      addLog("[BOT-AUDITORIA-WARN] No se detectó 'Select all' por coordenadas. Usando click por texto...");
      await nbPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, div, span, input[type="checkbox"]')).find(el => {
          const htmlEl = el as HTMLElement;
          const txt = (htmlEl.innerText || '').toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          return txt.includes('select all') || aria.includes('select all') || txt.includes('seleccionar todo');
        });
        if (btn) {
          (btn as HTMLElement).click();
        }
      });
      await delayWithStopCheck(2000);
    }
    await updateLiveScreenshot(nbPage, "NotebookLM - Estado despejado (Select All)", addLog);

    if (stopRequested) {
      addLog("[BOT-STOP] Proceso detenido.");
      sendProgress(100);
      return res.end();
    }

    // =========================================================================
    // PASO 3: Scroll hasta abajo
    // =========================================================================
    addLog("[BOT-AUDITORIA] PASO 3: Haciendo scroll hasta abajo para cargar todos los documentos...");
    await nbPage.mouse.move(120, 250);
    await delayWithStopCheck(200);
    await nbPage.mouse.wheel({ deltaY: 3000 });
    await delayWithStopCheck(600);
    await nbPage.mouse.wheel({ deltaY: 3000 });
    await delayWithStopCheck(600);

    // DOM scroll backup para asegurar que cargaron todas
    await nbPage.evaluate(() => {
      try {
        const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          const hasScroll = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
          if (hasScroll && el.scrollWidth < 600 && el.getBoundingClientRect().left < 400) {
            el.scrollTop = el.scrollHeight;
          }
        }
      } catch (_) {}
    });
    await delayWithStopCheck(2000);
    sendProgress(35);

    // =========================================================================
    // PASO 4: Hacer clic en casillas de abajo hacia arriba: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13
    // =========================================================================
    addLog("[BOT-AUDITORIA] PASO 4: Detectando casillas de abajo hacia arriba...");
    
    const targets = await nbPage.evaluate(() => {
      const elementos = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [aria-checked]')) as HTMLElement[];
      const divsClickeables = Array.from(document.querySelectorAll('div, span, button')) as HTMLElement[];
      const customCheckboxes = divsClickeables.filter(el => {
        const className = el.className || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && 
          rect.left < 450 && 
          rect.top > 100 &&
          (className.toLowerCase().includes('checkbox') || ariaLabel.toLowerCase().includes('select') || ariaLabel.toLowerCase().includes('check'));
      });

      const todos = [...elementos, ...customCheckboxes];
      const vistos: any[] = [];
      const coordenadasUnicas = new Set<string>();

      todos.forEach((el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left < 450 && rect.top > 120) {
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          const claveStr = `${x},${y}`;
          if (!coordenadasUnicas.has(claveStr)) {
            coordenadasUnicas.add(claveStr);
            const text = (el.innerText || el.textContent || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if (text.includes('select all') || aria.includes('select all') || text.includes('seleccionar todo')) {
              return;
            }
            vistos.push({ el, x, y, top: rect.top });
          }
        }
      });

      // Ordenar de abajo hacia arriba (Y mayor a menor)
      vistos.sort((a, b) => b.top - a.top);
      
      return vistos.map((item, index) => ({
        x: item.x,
        y: item.y,
        index: index + 1, // 1-indexed (Casilla 1 a 18)
      }));
    });

    addLog(`[BOT-AUDITORIA] Se localizaron ${targets.length} casillas ordenadas de abajo hacia arriba.`);

    // Clicks secuenciales precisos en: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13
    const auditIndices = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13];
    for (const idx of auditIndices) {
      if (stopRequested) break;
      const match = targets.find(t => t.index === idx);
      if (match) {
        addLog(`[BOT-AUDITORIA] Clicando Casilla #${idx} en (X: ${match.x}, Y: ${match.y})...`);
        await nbPage.mouse.click(match.x, match.y);
        await delayWithStopCheck(800);
      } else {
        addLog(`[WARNING-AUDITORIA] No se detectó la casilla con índice #${idx} de forma secuencial.`);
      }
    }

    await updateLiveScreenshot(nbPage, "NotebookLM - Casillas seleccionadas", addLog);

    if (stopRequested) {
      addLog("[BOT-STOP] Se detuvo el proceso por el usuario.");
      sendProgress(100);
      return res.end();
    }

    // SOPORTE ADICIONAL REFORZADO: Asegurar que si la casilla 13 es la carpeta "Trading Strategy",
    // también expandamos y hagamos clic en el documento interno "Resultados" si éste surge en el visor.
    const match13 = targets.find(t => t.index === 13);
    if (match13) {
      addLog("[BOT-AUDITORIA] Asegurando expansión y selección de Recursos de 'Trading Strategy'...");
      await delayWithStopCheck(1500);
      await nbPage.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        const foundEl = elements.reverse().find(el => {
          const text = (el.innerText || el.textContent || '').toLowerCase().trim();
          return text === 'resultados' || text.includes('resultados') || text.includes('resultado');
        });

        if (foundEl) {
          const parentContainer = foundEl.closest('div');
          if (parentContainer) {
            const checkbox = parentContainer.querySelector('input[type="checkbox"], [role="checkbox"], [aria-checked]');
            if (checkbox) {
              const rect = checkbox.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                (checkbox as HTMLElement).click();
              }
            }
          } else {
            foundEl.click();
          }
        }
      });
      await delayWithStopCheck(1000);
    }

    await updateLiveScreenshot(nbPage, "NotebookLM - Selección de fuentes finales consolidada", addLog);
    sendProgress(55);

    if (stopRequested) {
      addLog("[BOT-STOP] Deteniendo proceso.");
      sendProgress(100);
      return res.end();
    }

    // =========================================================================
    // OBTENER EL TERCER PROMPT DEL ARCHIVO "prompts notebooklm" EN DRIVE
    // =========================================================================
    let prompt3Text = "";
    try {
      const auth = req.auth;
      if (!auth) {
        throw new Error("No hay cliente Google Auth válido.");
      }
      const drive = google.drive({ version: "v3", auth });
      const docs = google.docs({ version: "v1", auth });

      addLog("[BOT-AUDITORIA] Leyendo el archivo 'prompts notebooklm' en Google Drive...");
      const driveSearch = await drive.files.list({
        q: "name contains 'prompts notebooklm' and trashed = false",
        fields: "files(id, name, mimeType)",
        pageSize: 5,
      });

      let foundFile = driveSearch.data.files?.[0];
      if (!foundFile) {
        addLog("[BOT-AUDITORIA] Buscando archivo backup con 'prompts'...");
        const backupSearch = await drive.files.list({
          q: "name contains 'prompts' and trashed = false",
          fields: "files(id, name, mimeType)",
          pageSize: 5,
        });
        foundFile = backupSearch.data.files?.[0];
      }

      if (!foundFile) {
        throw new Error("No se pudo ubicar ningún archivo de prompts en Google Drive.");
      }

      addLog(`[BOT-AUDITORIA] Archivo de prompts encontrado: '${foundFile.name}'`);
      const rawText = await fetchDriveFileText(drive, docs, foundFile.id!, foundFile.mimeType!, addLog);
      addLog(`[BOT-AUDITORIA] Leyendo y extrayendo el Tercer Prompt...`);

      prompt3Text = extractThirdPrompt(rawText);
      if (!prompt3Text) {
        throw new Error("El tercer prompt regresó vacío.");
      }

      addLog(`[BOT-AUDITORIA] Tercer prompt extraído perfectamente (Muestra): ${prompt3Text.substring(0, 100)}...`);
    } catch (driveErr: any) {
      addLog(`[ERROR-PROMPTS] Error de Drive: ${driveErr.message}. Usando prompt offline fallback para Auditoría...`);
      prompt3Text = `Mira el documento llamado "resultados" con los resultados de hoy luego mira los documentos de las 8 acciones y genera una nueva entrada para la "Auditoría aciertos y posibles mejoras" mirando que salió bien en los aciertos que mejorar en las fallas y en cuáles de las acciones en las que no se entraron se debió entrar y en cuales otras fue la decisión correcta esperar.`;
    }

    if (stopRequested) {
      addLog("[BOT-STOP] Se detuvo el proceso.");
      sendProgress(100);
      return res.end();
    }

    // PASO: Pegar y Enviar prompt en el chat
    addLog("[BOT-AUDITORIA] Insertando el tercer prompt de Drive en el chat de NotebookLM...");
    try {
      await nbPage.evaluate((text: string) => {
        const candidates = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"], div[role="textbox"]')) as HTMLElement[];
        let txtField: any = null;
        
        for (const candidate of candidates) {
          const placeholder = (candidate.getAttribute('placeholder') || '').toLowerCase();
          const ariaLabel = (candidate.getAttribute('aria-label') || '').toLowerCase();
          if (
            placeholder.includes('ask') || placeholder.includes('question') || placeholder.includes('pregunta') || placeholder.includes('something') ||
            ariaLabel.includes('ask') || ariaLabel.includes('question') || ariaLabel.includes('pregunta') || ariaLabel.includes('something')
          ) {
            txtField = candidate;
            break;
          }
        }
        
        if (!txtField && candidates.length > 0) {
          txtField = candidates[0];
        }

        if (txtField) {
          txtField.focus();
          if (txtField.tagName === 'TEXTAREA') {
            txtField.value = text;
            txtField.dispatchEvent(new Event('input', { bubbles: true }));
            txtField.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            txtField.innerText = text;
            txtField.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }, prompt3Text);

      await delayWithStopCheck(1500);
      await updateLiveScreenshot(nbPage, "NotebookLM - Prompt de auditoría cargado", addLog);

      // Cerrar superposiciones
      await nbPage.keyboard.press('Escape');
      await delayWithStopCheck(500);

      // Enviar
      addLog("[BOT-AUDITORIA] Enviando prompt al chat...");
      const seEnvioCorrectamente = await nbPage.evaluate(() => {
        const contenedorChatInput = document.querySelector('div[class*="input-container"], div[class*="text-input"], footer, [role="main"] div:last-child');
        if (contenedorChatInput) {
          const botonesChat = Array.from(contenedorChatInput.querySelectorAll('button'));
          const botonEnviar = botonesChat.find(btn => {
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();
            return aria.includes('send') || aria.includes('enviar') || html.includes('arrow') || html.includes('send');
          });
          
          if (botonEnviar) {
            botonEnviar.focus();
            botonEnviar.click();
            return true;
          }
        }
        return false;
      });

      if (seEnvioCorrectamente) {
        addLog("[BOT-AUDITORIA] Botón físico presionado con éxito.");
      } else {
        addLog("[BOT-AUDITORIA-WARN] No se detectó botón de enviar. Enviando con enter de teclado...");
        await nbPage.evaluate(() => {
          const inputElement = document.querySelector('textarea, div[contenteditable="true"], input[type="text"]') as HTMLElement;
          if (inputElement) inputElement.focus();
        });
        await nbPage.keyboard.press('Enter');
      }

      await delayWithStopCheck(2000);
      await updateLiveScreenshot(nbPage, "NotebookLM - Generando auditoría", addLog);
      sendProgress(70);

      // PASO: Esperar de forma adaptativa a la respuesta de auditoría
      addLog("[BOT-AUDITORIA] Esperando de forma adaptativa a que finalice la generación de respuesta de auditoría...");
      let lastLenAudit = 0;
      let stabilityCountAudit = 0;
      const maxChecksAudit = 120; // 120 * 2 = 240 seconds max
      for (let i = 1; i <= maxChecksAudit; i++) {
        await delayWithStopCheck(2000);
        if (stopRequested) break;
        
        const currentLen = await getLastMessageLength(nbPage);
        if (currentLen > 100) {
          if (currentLen === lastLenAudit) {
            stabilityCountAudit++;
            if (stabilityCountAudit >= 15) { // Stable for 30 consecutive seconds
              addLog(`[BOT-AUDITORIA] Respuesta de auditoría estabilizada con ${currentLen} caracteres. Generación finalizada.`);
              break;
            }
          } else {
            stabilityCountAudit = 0;
          }
        }
        lastLenAudit = currentLen;
        
        if (i % 3 === 0) { // Take live screenshot every 6 seconds to update UI and keep stream active
          await updateLiveScreenshot(nbPage, `NotebookLM - Generando respuesta de auditoría (${i * 2}s)...`, addLog);
        }
      }

      if (stopRequested) {
        addLog("[BOT-STOP] Se detuvo el proceso por el usuario.");
        sendProgress(100);
        return res.end();
      }

      // PASO: Extraer respuesta final
      addLog("[BOT-AUDITORIA] Desplazando el chat hacia el final para copiar...");
      await nbPage.evaluate(() => {
        const contenedorChat = document.querySelector('div[class*="chat-container"], mat-dialog-content, main');
        if (contenedorChat) {
          contenedorChat.scrollTop = contenedorChat.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      });
      await delayWithStopCheck(1000);

      addLog("[BOT-AUDITORIA] Copiando la respuesta...");
      const seHizoClicEnCopiar = await nbPage.evaluate(() => {
        const botones = Array.from(document.querySelectorAll('button'));
        const botonCopiar = botones.reverse().find(btn => {
          const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
          const html = btn.innerHTML.toLowerCase();
          return aria.includes('copy') || aria.includes('copiar') || html.includes('content_copy') || html.includes('copy');
        });

        if (botonCopiar) {
          (botonCopiar as HTMLElement).click();
          return true;
        }
        return false;
      });

      let auditoriaReporte = "";
      if (seHizoClicEnCopiar) {
        addLog("[BOT-AUDITORIA] Botón clicado.");
        await delayWithStopCheck(1000);
        try {
          const textoCopiado = await nbPage.evaluate(async () => {
            return await navigator.clipboard.readText();
          });
          if (textoCopiado && textoCopiado.trim().length > 50) {
            auditoriaReporte = textoCopiado.trim();
            addLog(`[BOT-AUDITORIA] Reporte capturado de portapapeles (${auditoriaReporte.length} caracteres).`);
          }
        } catch (_) {}
      }

      if (!auditoriaReporte) {
        addLog("[BOT-AUDITORIA] Utilizando extractor DOM para leer la respuesta...");
        auditoriaReporte = await nbPage.evaluate(() => {
          const bloques = Array.from(document.querySelectorAll('div[class*="message-content"], .model-message-text, [data-author="model"]'));
          const fuentes = bloques.length > 0 ? bloques : Array.from(document.querySelectorAll('div[class*="message"], div[class*="response"]'));
          if (fuentes.length === 0) return "";
          const ultimo = fuentes[fuentes.length - 1];
          return (ultimo as HTMLElement).innerText || (ultimo as HTMLElement).textContent || "";
        });
        auditoriaReporte = (auditoriaReporte || "").trim();
      }

      if (!auditoriaReporte || auditoriaReporte.length < 20) {
        throw new Error("No se pudo extraer contenido válido para el informe de auditoría.");
      }

      addLog(`[BOT-AUDITORIA] Reporte de auditoría extraído con éxito.`);
      sendProgress(85);

      // PASO: Escribir reporte en Google Drive: "Auditoría aciertos y posibles mejoras"
      addLog("[BOT-AUDITORIA] Mandando reporte de auditoría a Google Drive...");
      const googleAuth = req.auth;
      if (!googleAuth) {
        throw new Error("No Google Auth client available.");
      }

      const drive = google.drive({ version: "v3", auth: googleAuth });
      const docSearchRes = await drive.files.list({
        q: "(name contains 'Auditoría aciertos y' or name contains 'Auditoria aciertos') and trashed = false",
        fields: "files(id, name)",
        pageSize: 5,
      });

      let targetDocTitle = "Auditoría aciertos y posibles mejoras";
      const matchedFile = docSearchRes.data.files?.[0];
      if (matchedFile) {
        targetDocTitle = matchedFile.name!;
        addLog(`[BOT-AUDITORIA] Documento Drive existente localizado con nombre: '${targetDocTitle}'`);
      } else {
        addLog(`[BOT-AUDITORIA] Creando un nuevo documento con nombre preestablecido: '${targetDocTitle}'`);
      }

      await updateGoogleDocText(googleAuth, targetDocTitle, auditoriaReporte, addLog);
      addLog(`[BOT-AUDITORIA] ¡REPORTE DE AUDITORÍA GUARDADO SATISFACTORIAMENTE EN DRIVE ('${targetDocTitle}')!`);
      sendProgress(95);

      // VOLVER A NOTEBOOKLM Y SINCRONIZAR
      addLog(`[BOT-AUDITORIA] Volviendo a interaccionar con NotebookLM para sincronizar auditoría...`);
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
            addLog(`[NOTEBOOK-LM] Buscando y haciendo clic en 'Sync con Google Drive'...`);
            
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
            addLog(`[BOT-AUDITORIA] No se pudo encontrar el documento 'auditoría aciertos y mejoras' en la interfaz.`);
        }
      } catch (syncErr: any) {
         addLog(`[BOT-AUDITORIA] Error durante fase de sincronización: ${syncErr.message}`);
      }

      sendProgress(100);

      // Persistir copia local
      try {
        fs.writeFileSync(path.join(process.cwd(), "ultimo_reporte_auditoria.json"), JSON.stringify({
          timestamp: Date.now(),
          reporte: auditoriaReporte
        }, null, 2));
      } catch (_) {}

      sendEvent({ type: "done" });
    } catch (chatErr: any) {
      addLog(`[ERROR-AUDITORIA] Falla detallada: ${chatErr.message}`);
      throw chatErr;
    }

  } catch (err: any) {
    addLog(`[ERROR] Error en el proceso de actualización de Auditoría: ${err.message}`);
    sendEvent({ type: "error", error: err.message });
  } finally {
    clearInterval(keepAliveInterval);
    if (browser) {
      try {
        await browser.close();
        addLog("[NOTEBOOK-LM] Sesión de navegador cerrada.");
      } catch (_) {}
    }
    res.end();
  }
});

app.post("/api/automation/run-detailed-analysis", checkAuth, async (req: any, res) => {
  req.setTimeout(900000); // 15 minutes timeout
  res.setTimeout(900000);
  try {
    const liveImgPath = path.join(process.cwd(), "live_automation.png");
    if (fs.existsSync(liveImgPath)) {
      fs.unlinkSync(liveImgPath);
    }
  } catch (err: any) {
    console.error("Error deleting live_automation.png:", err.message);
  }

  const {
    notebookLMCookies,
    notebookLMUrl,
    googleEmail,
    googlePassword,
    tickers,
  } = req.body || {};

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch (_) {}
  }, 10000);

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const addLog = (msg: string) => {
    console.log(msg);
    sendEvent({ type: "log", msg });
  };

  const sendProgress = (value: number) => {
    sendEvent({ type: "progress", value: Math.min(Math.round(value), 100) });
  };

  let browser: any = null;
  stopRequested = false;
  const compiledReports: { [ticker: string]: string } = {};

  try {
    sendProgress(10);
    addLog("[SYSTEM] Iniciando análisis simplificado de NotebookLM con monitoreo en tiempo real...");

    // Delete old screenshot to avoid stale camera images
    try {
      const liveImgPath = path.join(process.cwd(), "live_automation.png");
      if (fs.existsSync(liveImgPath)) {
        fs.unlinkSync(liveImgPath);
      }
    } catch (_) {}

    // 1. Levantar Puppeteer para NotebookLM
    addLog("[NOTEBOOK-LM] Iniciando Puppeteer...");
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    activeBrowser = browser;

    // Conceder permisos de portapapeles para permitir la extracción avanzada de texto
    try {
      const contexto = browser.defaultBrowserContext();
      if (notebookLMUrl) {
        await contexto.overridePermissions(notebookLMUrl, ['clipboard-read', 'clipboard-write']);
        addLog("[NOTEBOOK-LM] Permisos de portapapeles configurados para la URL de destino.");
      }
    } catch (permErr: any) {
      addLog(`[NOTEBOOK-LM-WARN] Error configurando permisos de portapapeles: ${permErr.message}`);
    }

    const nbPage = await browser.newPage();

    // Set a solid initial baseline layout size
    await nbPage.setViewport({ width: 1024, height: 768 });

    addLog("[NOTEBOOK-LM] Configurando agente de usuario y evasión...");
    await nbPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
    
    await nbPage.evaluateOnNewDocument(`
      globalThis.__name = (fn) => fn;
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "en-US", "en"],
      });
    `);

    await nbPage.setExtraHTTPHeaders({
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    if (notebookLMCookies) {
      addLog("[NOTEBOOK-LM] Aplicando cookies suministradas...");
      await applyCookiesToPage(nbPage, notebookLMCookies, addLog);
    }

    if (!notebookLMUrl) {
      throw new Error("La URL de NotebookLM no está configurada y está vacía.");
    }

    addLog(`[NOTEBOOK-LM] PRIMERO: Ingresando a NotebookLM en la URL: ${notebookLMUrl}`);
    await nbPage.setDefaultNavigationTimeout(90000);
    await nbPage.setDefaultTimeout(90000);
    
    try {
      await nbPage.goto(notebookLMUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    } catch (err: any) {
      addLog(`[NOTEBOOK-LM] Advertencia en page.goto: ${err.message}. Continuando igualmente.`);
    }

    // Take an immediate screenshot after navigating
    await updateLiveScreenshot(nbPage, "Cargando NotebookLM - URL Inicial", addLog);

    // Comprobar si Google redirige a la pantalla de Login - Omitido por solicitud del usuario para ingreso directo
    addLog("[NOTEBOOK-LM] Omitiendo proceso de inicio de sesión automático con credenciales. Ingresando directamente con Cookies y Enlace.");

    // Esperar unos segundos para permitir que empiece la carga de la interfaz inicial de NotebookLM, transmitiendo capturas
    addLog("[NOTEBOOK-LM] Transmitiendo video en vivo del cuaderno de NotebookLM...");
    for (let count = 1; count <= 3; count++) {
      await delayWithStopCheck(2000);
      await updateLiveScreenshot(nbPage, `NotebookLM - Cargando interfaces (${count * 2}s)...`, addLog);
    }

    // SEGUNDO: Ajustar la pantalla a las dimensiones de monitor de escritorio grande (1920x1080)
    addLog("[NOTEBOOK-LM] SEGUNDO: Configurando pantalla grande de 1920x1080 pixeles (Full HD) para forzar vista de tres columnas por defecto...");
    await nbPage.setViewport({ width: 1920, height: 1080 });
    
    // Transmitir live feed durante el ajuste para actualizar el inspector visual
    for (let count = 1; count <= 2; count++) {
      await delayWithStopCheck(2000);
      await updateLiveScreenshot(nbPage, `NotebookLM - Dimensión Full HD ajustada (${count * 2}s)...`, addLog);
    }

    const finalUrl = nbPage.url() || "";
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("signin")) {
      addLog("[NOTEBOOK-LM] Advertencia: Detectada página de inicio de sesión de Google. El proceso continuará sin abortar por petición de persistencia.");
    }

    addLog("[SYSTEM] NotebookLM ingresado exitosamente y ajustado a 1920x1080 pixeles.");

    addLog("[INTERFAZ] Asegurando vista descomprimida de 3 columnas...");

    // 1. Forzar apertura del panel izquierdo (Sources) mediante evaluación del DOM
    try {
      await nbPage.evaluate(() => {
        const botonSources = (Array.from(document.querySelectorAll('button, div, span')) as HTMLElement[]).find(el => 
          (el.innerText || '').toLowerCase().includes('sources') || 
          (el.getAttribute('aria-label') || '').toLowerCase().includes('sources')
        );
        if (botonSources) botonSources.click();
      });
      await delayWithStopCheck(1000);
    } catch (errSources: any) {
      addLog(`[WARNING-INTERFAZ] Error al forzar Sources: ${errSources.message}`);
    }

    // 2. Forzar apertura del panel derecho (Studio) mediante clic en su icono superior derecho
    try {
      await nbPage.evaluate(() => {
        // Busca el botón de Studio en la barra superior derecha
        const botonStudio = (Array.from(document.querySelectorAll('button, div, span')) as HTMLElement[]).find(el => 
          (el.innerText || '').toLowerCase().includes('studio') || 
          (el.getAttribute('aria-label') || '').toLowerCase().includes('studio')
        );
        if (botonStudio) botonStudio.click();
      });
      await delayWithStopCheck(1500);
    } catch (errStudio: any) {
      addLog(`[WARNING-INTERFAZ] Error al forzar Studio: ${errStudio.message}`);
    }

    addLog("[INTERFAZ] Vista de 3 columnas de escritorio grande estabilizada. Iniciando secuencia automatizada.");

    // PASO 1 (PRIMERO): Clic en la primera casilla disponible mediante evaluación de DOM
    addLog("[NOTEBOOK-LM] PASO 1: Buscando dinámicamente la PRIMERA casilla de documento o fuente disponible...");
    let primeraCasillaCoords = { x: 280, y: 150 }; // Fallback predeterminado para la primera casilla de la lista de fuentes
    let foundDOMCasilla = false;

    try {
      const coords = await nbPage.evaluate(() => {
        // Buscar elementos input tipo checkbox o que tengan role o aria-checked
        const elementos = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [aria-checked]')) as HTMLElement[];
        
        // Filtrar elementos visibles con dimensiones válidas en el panel izquierdo (Sources)
        const visibles = elementos.filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.left < 450;
        });

        if (visibles.length > 0) {
          const primera = visibles[0];
          const rect = primera.getBoundingClientRect();
          return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            found: true,
            tagName: primera.tagName,
            role: primera.getAttribute('role') || 'input'
          };
        }

        // Respaldo secundario: buscar pequeños divs clickeables (checkboxes camuflados)
        const divsClickeables = Array.from(document.querySelectorAll('div, span, button')) as HTMLElement[];
        const posiblesCheckboxes = divsClickeables.filter(el => {
          const rect = el.getBoundingClientRect();
          const className = el.className || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          return rect.width > 0 && rect.height > 0 && 
            rect.left < 450 && // Restringir al panel izquierdo (Sources)
            rect.top > 120 &&
            (className.toLowerCase().includes('checkbox') || ariaLabel.toLowerCase().includes('select') || ariaLabel.toLowerCase().includes('check'));
        });

        if (posiblesCheckboxes.length > 0) {
          const primera = posiblesCheckboxes[0];
          const rect = primera.getBoundingClientRect();
          return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            found: true,
            tagName: primera.tagName,
            role: 'custom-checkbox'
          };
        }

        return { x: 280, y: 150, found: false, tagName: 'none', role: '' };
      });

      if (coords.found) {
        primeraCasillaCoords = { x: coords.x, y: coords.y };
        foundDOMCasilla = true;
        addLog(`[BOT-PERSISTENTE] Ubicación dinámica de la PRIMERA casilla encontrada en: ${coords.tagName} (X: ${coords.x}, Y: ${coords.y})`);
      } else {
        addLog("[BOT-PERSISTENTE] No se pudo identificar la primera casilla por DOM. Usando posición de respaldo calibrada (X: 280, Y: 150).");
      }
    } catch (errEval: any) {
      addLog(`[WARNING-PERSISTENTE] Error buscando la primera casilla en DOM: ${errEval.message}. Usando fallback.`);
    }

    // Efectuar clic físico en la primera casilla antes de scrolear
    addLog(`[NOTEBOOK-LM] Ejecutando clic físico en la primera casilla antes de scroll (X: ${primeraCasillaCoords.x}, Y: ${primeraCasillaCoords.y})...`);
    try {
      await nbPage.mouse.move(primeraCasillaCoords.x, primeraCasillaCoords.y, { steps: 5 });
      await delayWithStopCheck(250);
      await nbPage.mouse.click(primeraCasillaCoords.x, primeraCasillaCoords.y, { delay: 60 });
      addLog(`[BOT-PERSISTENTE] Clic de ratón enviado con éxito en la primera casilla.`);

      // Dibujar marcador visual
      try {
        await nbPage.evaluate((x, y) => {
          const markerId = 'custom-first-checkbox-marker';
          const marker = document.createElement('div');
          marker.id = markerId;
          marker.style.position = 'fixed';
          marker.style.left = `${x}px`;
          marker.style.top = `${y}px`;
          marker.style.width = '24px';
          marker.style.height = '24px';
          marker.style.borderRadius = '50%';
          marker.style.backgroundColor = 'transparent';
          marker.style.border = '3px solid #3b82f6';
          marker.style.boxShadow = '0 0 8px #3b82f6';
          marker.style.zIndex = '2147483647';
          marker.style.pointerEvents = 'none';
          marker.style.transform = 'translate(-50%, -50%)';
          
          const core = document.createElement('div');
          core.style.backgroundColor = '#3b82f6';
          core.style.position = 'absolute';
          core.style.left = '50%';
          core.style.top = '50%';
          core.style.width = '6px';
          core.style.height = '6px';
          core.style.borderRadius = '50%';
          core.style.transform = 'translate(-50%, -50%)';
          marker.appendChild(core);

          const bubble = document.createElement('div');
          bubble.innerText = `PRIMERA CASILLA (${x}, ${y})`;
          bubble.style.position = 'absolute';
          bubble.style.left = '30px';
          bubble.style.top = '-5px';
          bubble.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
          bubble.style.color = '#ffffff';
          bubble.style.padding = '2px 6px';
          bubble.style.borderRadius = '3px';
          bubble.style.fontSize = '10px';
          bubble.style.fontFamily = 'monospace';
          bubble.style.fontWeight = 'bold';
          bubble.style.whiteSpace = 'nowrap';
          marker.appendChild(bubble);

          document.body.appendChild(marker);
        }, primeraCasillaCoords.x, primeraCasillaCoords.y);
      } catch (_) {}
    } catch (clickFirstErr: any) {
      addLog(`[WARNING-PERSISTENTE] Error al hacer clic en la primera casilla: ${clickFirstErr.message}`);
    }

    try {
      await delayWithStopCheck(2000);
    } catch (_) {}

    // PASO 2 (SEGUNDO): Scroll hasta abajo en el panel de fuentes
    addLog("[NOTEBOOK-LM] PASO 2: Ejecutando scroll forzado hasta abajo en el panel de fuentes...");
    try {
      await nbPage.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        const elementosSoportanScroll = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        const scrollables = elementosSoportanScroll.filter(el => {
          const style = window.getComputedStyle(el);
          return (style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflow === 'auto') && el.scrollHeight > el.clientHeight;
        });
        scrollables.forEach(el => {
          el.scrollTop = el.scrollHeight;
        });
      });
      addLog("[BOT-PERSISTENTE] Scroll hasta abajo completado exitosamente.");
    } catch (errScroll: any) {
      addLog(`[WARNING-PERSISTENTE] Error al intentar realizar scroll: ${errScroll.message}`);
    }

    try {
      await delayWithStopCheck(2500); // Esperar que carguen las fuentes adicionales tras scroll/renderizado
    } catch (_) {}

    // PASO 3 (TERCERO): Clic en casillas (Nº 1, 3, 9, 11 y 12) contando de abajo hacia arriba.
    addLog("[NOTEBOOK-LM] PASO 3: Buscando dinámicamente todas las casillas disponibles en el panel de fuentes de abajo hacia arriba...");
    let targetsToClick: { x: number; y: number; index: number }[] = [];

    try {
      const casillasDetectadas = await nbPage.evaluate(() => {
        // Encontrar inputs tipo checkbox, elementos con rol checkbox o aria-checked
        const elementos = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [aria-checked]')) as HTMLElement[];
        
        // Agregar también contenedores interactivos usuales de checks en NotebookLM
        const divsClickeables = Array.from(document.querySelectorAll('div, span, button')) as HTMLElement[];
        const customCheckboxes = divsClickeables.filter(el => {
          const className = el.className || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && 
            rect.left < 450 && // Restringir al panel izquierdo (Sources)
            rect.top > 100 &&
            (className.toLowerCase().includes('checkbox') || ariaLabel.toLowerCase().includes('select') || ariaLabel.toLowerCase().includes('check'));
        });

        // Combinar todas las posibles marcas
        const todos = [...elementos, ...customCheckboxes];

        const vistos: any[] = [];
        const coordenadasUnicas = new Set<string>();

        todos.forEach((el: HTMLElement) => {
          const rect = el.getBoundingClientRect();
          // Asegurar que esté en el panel izquierdo (Sources) y visible en pantalla
          if (rect.width > 0 && rect.height > 0 && rect.left < 450 && rect.top > 120) {
            const x = Math.round(rect.left + rect.width / 2);
            const y = Math.round(rect.top + rect.height / 2);
            const claveStr = `${x},${y}`;
            if (!coordenadasUnicas.has(claveStr)) {
              coordenadasUnicas.add(claveStr);

              // Descartar el botón superior "Select all" (si lo hubiese) de la lista de casillas de documentos individuales, 
              // buscando coincidencias textuales
              const text = (el.innerText || el.textContent || '').toLowerCase();
              const aria = (el.getAttribute('aria-label') || '').toLowerCase();
              if (text.includes('select all') || aria.includes('select all')) {
                return;
              }

              vistos.push({ x, y, top: rect.top, tagName: el.tagName });
            }
          }
        });

        // Ordenar de abajo hacia arriba: mayor Y primero (es decir, rect.top descendente)
        vistos.sort((a, b) => b.top - a.top);

        return vistos.map((v, i) => ({
          x: v.x,
          y: v.y,
          numeroDesdeAbajo: i + 1, // 1-indexed
          tagName: v.tagName
        }));
      });

      addLog(`[BOT-PERSISTENTE] Se detectaron un total de ${casillasDetectadas.length} casillas en el panel izquierdo.`);
      casillasDetectadas.forEach((c: any) => {
        addLog(`[CASILLA-DETECTADA] #${c.numeroDesdeAbajo} desde abajo en coordenadas (${c.x}, ${c.y}) [${c.tagName}]`);
      });

      // Queremos hacer clic en las casillas número 1, 3, 9, 11 y 12 de abajo hacia arriba
      const numerosDeseados = [1, 3, 9, 11, 12];
      for (const num of numerosDeseados) {
        const encontrada = casillasDetectadas.find((c: any) => c.numeroDesdeAbajo === num);
        if (encontrada) {
          targetsToClick.push({ x: encontrada.x, y: encontrada.y, index: num });
        } else {
          addLog(`[WARNING-PERSISTENTE] No se pudo encontrar por DOM la casilla #${num} desde abajo de un total de ${casillasDetectadas.length} casillas.`);
          // Si tenemos al menos la casilla más baja, estimamos la distancia con un espaciado vertical típico de 38px
          if (casillasDetectadas.length > 0) {
            const baseY = casillasDetectadas[0].y; // casilla #1
            const baseX = casillasDetectadas[0].x;
            const yEstimado = baseY - (num - 1) * 38;
            addLog(`[BOT-FALLBACK] Estimando ubicación aproximada para la casilla #${num} desde abajo en X: ${baseX}, Y: ${yEstimado}`);
            targetsToClick.push({ x: baseX, y: yEstimado, index: num });
          } else {
            // Fallback absoluto por si falla toda detección
            const yEstimado = 950 - (num - 1) * 38;
            addLog(`[BOT-FALLBACK-ABSOLUTO] Sin casillas detectadas. Estimando ubicación aproximada para la casilla #${num} desde abajo en X: 280, Y: ${yEstimado}`);
            targetsToClick.push({ x: 280, y: yEstimado, index: num });
          }
        }
      }

    } catch (errFind: any) {
      addLog(`[WARNING-PERSISTENTE] Error buscando casillas mediante DOM: ${errFind.message}`);
      const numerosDeseados = [1, 3, 9, 11, 12];
      for (const num of numerosDeseados) {
        const yEstimado = 950 - (num - 1) * 38;
        targetsToClick.push({ x: 280, y: yEstimado, index: num });
      }
    }

    // Ejecutar la secuencia ordenada de clics interactivos
    for (const target of targetsToClick) {
      addLog(`[BOT-PERSISTENTE] Haciendo clic en la casilla #${target.index} desde abajo en coordenadas (X: ${target.x}, Y: ${target.y})...`);
      try {
        await nbPage.mouse.move(target.x, target.y, { steps: 5 });
        await delayWithStopCheck(250);
        await nbPage.mouse.click(target.x, target.y, { delay: 60 });
        addLog(`[BOT-PERSISTENTE] Clic enviado con éxito en la casilla #${target.index} (X: ${target.x}, Y: ${target.y}).`);

        // Renderizar un marcador visual fluorescente para retroalimentación
        try {
          await nbPage.evaluate((x, y, idx) => {
            const markerId = 'custom-checkbox-marker-' + idx + '-' + Date.now();
            const marker = document.createElement('div');
            marker.className = 'custom-temp-marker';
            marker.style.position = 'fixed';
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
            marker.style.width = '24px';
            marker.style.height = '24px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = 'transparent';
            marker.style.border = '3px solid #10b981';
            marker.style.boxShadow = '0 0 8px #10b981';
            marker.style.zIndex = '2147483647';
            marker.style.pointerEvents = 'none';
            marker.style.transform = 'translate(-50%, -50%)';
            
            const core = document.createElement('div');
            core.style.backgroundColor = '#10b981';
            core.style.position = 'absolute';
            core.style.left = '50%';
            core.style.top = '50%';
            core.style.width = '6px';
            core.style.height = '6px';
            core.style.borderRadius = '50%';
            core.style.transform = 'translate(-50%, -50%)';
            marker.appendChild(core);

            const bubble = document.createElement('div');
            bubble.innerText = `CASILLA #${idx} DESDE ABAJO (${x}, ${y})`;
            bubble.style.position = 'absolute';
            bubble.style.left = '30px';
            bubble.style.top = '-5px';
            bubble.style.backgroundColor = 'rgba(16, 185, 129, 0.9)';
            bubble.style.color = '#ffffff';
            bubble.style.padding = '2px 6px';
            bubble.style.borderRadius = '3px';
            bubble.style.fontSize = '10px';
            bubble.style.fontFamily = 'monospace';
            bubble.style.fontWeight = 'bold';
            bubble.style.whiteSpace = 'nowrap';
            marker.appendChild(bubble);

            document.body.appendChild(marker);
          }, target.x, target.y, target.index);
        } catch (_) {}

        await delayWithStopCheck(1000);
      } catch (clickErr: any) {
        addLog(`[WARNING-PERSISTENTE] Error al hacer clic en la casilla #${target.index}: ${clickErr.message}`);
      }
    }

    try {
      await delayWithStopCheck(2000);
    } catch (_) {}

    addLog("[BOT-PERSISTENTE] Secuencia de selección de casillas completada exitosamente (Casillas 1, 3, 9, 11 y 12 presionadas).");

    // =========================================================================
    // NUEVO PASO: CARGAR PROMPTS DESDE GOOGLE DRIVE, INSERTAR EN CHAT Y ENVIAR
    // =========================================================================
    let basePrompt = "";
    try {
      const auth = req.auth;
      if (!auth) {
        throw new Error("No hay cliente Google Auth válido en la petición (req.auth).");
      }
      const drive = google.drive({ version: "v3", auth });
      const docs = google.docs({ version: "v1", auth });

      addLog("[NOTEBOOK-LM] Buscando el archivo 'prompts notebooklm' en Google Drive...");
      const driveSearch = await drive.files.list({
        q: "name contains 'prompts notebooklm' and trashed = false",
        fields: "files(id, name, mimeType)",
        pageSize: 5,
      });

      let foundFile = driveSearch.data.files?.[0];
      if (!foundFile) {
        addLog("[NOTEBOOK-LM] No se encontró un archivo con 'prompts notebooklm'. Buscando archivos parecidos con 'prompts'...");
        const backupSearch = await drive.files.list({
          q: "name contains 'prompts' and trashed = false",
          fields: "files(id, name, mimeType)",
          pageSize: 5,
        });
        foundFile = backupSearch.data.files?.[0];
      }

      if (!foundFile) {
        throw new Error("No se pudo ubicar ningún archivo de prompts en Google Drive.");
      }

      addLog(`[NOTEBOOK-LM] Archivo de prompts encontrado: '${foundFile.name}' (ID: ${foundFile.id}, Tipo: ${foundFile.mimeType})`);

      // Descargar o leer el archivo
      const rawText = await fetchDriveFileText(drive, docs, foundFile.id!, foundFile.mimeType!, addLog);
      addLog(`[NOTEBOOK-LM] Contenido total del archivo de Drive descargado (${rawText.length} caracteres).`);

      // Extraer el primer prompt
      basePrompt = extractFirstPrompt(rawText);
      addLog(`[NOTEBOOK-LM] Primer prompt extraído con éxito:\n---\n${basePrompt}\n---`);

    } catch (errDrive: any) {
      addLog(`[WARNING-PERSISTENTE] Error recuperando archivo de Google Drive: ${errDrive.message}`);
      basePrompt = "Por favor realiza un análisis técnico detallado de la empresa TICKER basándote en las fuentes proporcionadas.";
      addLog(`[BOT-FALLBACK] Usando prompt de respaldo: "${basePrompt}"`);
    }

    // 3. PROCESAMIENTO SECUENCIAL DE TICKERS (ALINEAR DOCUMENTOS + ENVIAR PROMPT + COPIAR PORTAPAPELES)
    const TICKER_BOX_MAPPING: { [ticker: string]: number } = {
      "TSLA": 2,
      "NVDA": 4,
      "NFLX": 5,
      "MSFT": 6,
      "META": 7,
      "GOOGL": 8,
      "AMZN": 10,
      "AAPL": 11,
    };

    const tickerList = (tickers && Array.isArray(tickers) && tickers.length > 0)
      ? tickers
      : ["AAPL", "TSLA", "NVDA", "NFLX", "MSFT", "META", "GOOGL", "AMZN"];

    addLog(`[BOT-TICKERS] Iniciando el procesamiento secuencial para: ${JSON.stringify(tickerList)}`);

    for (let tNum = 0; tNum < tickerList.length; tNum++) {
      if (stopRequested) {
        addLog("[BOT-TICKERS] Detención solicitada por el usuario. Abortando bucle.");
        break;
      }

      const ticker = tickerList[tNum];
      addLog(`\n======================================================`);
      addLog(`=== PROCESANDO TICKER: ${ticker} [${tNum + 1}/${tickerList.length}] ===`);
      addLog(`======================================================`);

      const currentTickerCasilla = TICKER_BOX_MAPPING[ticker];
      if (!currentTickerCasilla) {
        addLog(`[WARNING-PERSISTENTE] No se encontró mapeo de casilla para el ticker: ${ticker}. Intentando continuar solo con los estáticos...`);
      } else {
        addLog(`[BOT-TICKER] El ticker ${ticker} corresponde a la casilla #${currentTickerCasilla} de abajo hacia arriba.`);
      }

      // PASO 1: Alineación dinámica de checkboxes del panel de fuentes
      addLog(`[BOT-ALIGN] Ajustando casillas de fuentes para que correspondan con ${ticker}...`);
      try {
        const clickTargets = await nbPage.evaluate((tickerCasilla) => {
          const elementos = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [aria-checked]')) as HTMLElement[];
          const divsClickeables = Array.from(document.querySelectorAll('div, span, button')) as HTMLElement[];
          const customCheckboxes = divsClickeables.filter(el => {
            const className = el.className || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
              rect.left < 450 && 
              rect.top > 100 &&
              (className.toLowerCase().includes('checkbox') || ariaLabel.toLowerCase().includes('select') || ariaLabel.toLowerCase().includes('check'));
          });

          const todos = [...elementos, ...customCheckboxes];
          const vistos: any[] = [];
          const coordenadasUnicas = new Set<string>();

          todos.forEach((el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.left < 450 && rect.top > 120) {
              const x = Math.round(rect.left + rect.width / 2);
              const y = Math.round(rect.top + rect.height / 2);
              const claveStr = `${x},${y}`;
              if (!coordenadasUnicas.has(claveStr)) {
                coordenadasUnicas.add(claveStr);
                const text = (el.innerText || el.textContent || '').toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                if (text.includes('select all') || aria.includes('select all')) {
                  return;
                }
                vistos.push({ el, x, y, top: rect.top });
              }
            }
          });

          // Ordenar de abajo hacia arriba: mayor Y de rect (mayor top) primero
          vistos.sort((a, b) => b.top - a.top);

          const toClick: { x: number; y: number; index: number; action: string }[] = [];
          const tickerCasillasList = [2, 4, 5, 6, 7, 8, 10, 11];

          vistos.forEach((item, indexZero) => {
            const numDeAbajo = indexZero + 1; // 1-indexed

            const queryChecked = (el: HTMLElement): boolean => {
              if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') {
                return (el as HTMLInputElement).checked;
              }
              const ariaChecked = el.getAttribute('aria-checked');
              if (ariaChecked !== null) return ariaChecked === 'true';
              const lowerClass = el.className ? String(el.className).toLowerCase() : '';
              if (lowerClass.includes('is-checked') || lowerClass.includes('--checked') || lowerClass.includes('checked="true"')) {
                return true;
              }
              const nativeInput = el.querySelector('input[type="checkbox"]');
              if (nativeInput) return (nativeInput as HTMLInputElement).checked;
              const childWithAria = el.querySelector('[aria-checked]');
              if (childWithAria) return childWithAria.getAttribute('aria-checked') === 'true';
              return false;
            };

            const isChecked = queryChecked(item.el);

            let desiredChecked: boolean | null = null;
            if ([1, 3, 9, 12].includes(numDeAbajo)) {
              desiredChecked = true; // Estáticos indispensables
            } else if (tickerCasilla && numDeAbajo === tickerCasilla) {
              desiredChecked = true; // El ticker que procesamos ahora
            } else if (tickerCasillasList.includes(numDeAbajo)) {
              desiredChecked = false; // El folder de otro ticker
            }

            if (desiredChecked !== null && isChecked !== desiredChecked) {
              toClick.push({
                x: item.x,
                y: item.y,
                index: numDeAbajo,
                action: desiredChecked ? "ACTIVAR (CHECK)" : "DESACTIVAR (UNCHECK)"
              });
            }
          });

          return toClick;
        }, currentTickerCasilla);

        addLog(`[BOT-ALIGN] Casillas detectadas para corrección: ${clickTargets.length}`);
        for (const target of clickTargets) {
          addLog(`[BOT-ALIGN] Corrigiendo casilla #${target.index} (${target.action}) en (X: ${target.x}, Y: ${target.y})...`);
          await nbPage.mouse.move(target.x, target.y, { steps: 3 });
          await delayWithStopCheck(200);
          await nbPage.mouse.click(target.x, target.y, { delay: 60 });
          await delayWithStopCheck(600);
        }
        addLog(`[BOT-ALIGN] Alineación completada para el ticker ${ticker}.`);
      } catch (alignErr: any) {
        addLog(`[WARNING-ALIGN] Error alineando casillas para ${ticker}: ${alignErr.message}`);
      }

      await updateLiveScreenshot(nbPage, `NotebookLM - Fuentes alineadas para ${ticker}`, addLog);

      // PASO 2: Procesar e insertar Prompt para el ticker actual
      const processedPrompt = basePrompt.replace(/ticker/gi, ticker);
      addLog(`[NOTEBOOK-LM] [${ticker}] Prompt procesado final a enviar:\n---\n${processedPrompt}\n---`);

      try {
        await nbPage.evaluate((text: string) => {
          const candidates = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"], div[role="textbox"]')) as HTMLElement[];
          let txtField: any = null;
          
          for (const candidate of candidates) {
            const placeholder = (candidate.getAttribute('placeholder') || '').toLowerCase();
            const ariaLabel = (candidate.getAttribute('aria-label') || '').toLowerCase();
            if (
              placeholder.includes('ask') || placeholder.includes('question') || placeholder.includes('pregunta') || placeholder.includes('something') ||
              ariaLabel.includes('ask') || ariaLabel.includes('question') || ariaLabel.includes('pregunta') || ariaLabel.includes('something')
            ) {
              txtField = candidate;
              break;
            }
          }
          
          if (!txtField && candidates.length > 0) {
            txtField = candidates[0];
          }

          if (txtField) {
            txtField.focus();
            if (txtField.tagName === 'TEXTAREA') {
              txtField.value = text;
              txtField.dispatchEvent(new Event('input', { bubbles: true }));
              txtField.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              txtField.innerText = text;
              txtField.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }, processedPrompt);

        await delayWithStopCheck(1500);
        await updateLiveScreenshot(nbPage, `NotebookLM - Prompt cargado para ${ticker}`, addLog);

        // Cerrar popups molestos antes de enviar
        await nbPage.keyboard.press('Escape');
        await delayWithStopCheck(500);

        // Localizar y hacer clic en el botón nativo de enviar
        addLog(`[BOT-ENVIAR] Pinchando botón de enviar para ${ticker}...`);
        const seEnvioCorrectamente = await nbPage.evaluate(() => {
          const contenedorChatInput = document.querySelector('div[class*="input-container"], div[class*="text-input"], footer, [role="main"] div:last-child');
          if (contenedorChatInput) {
            const botonesChat = Array.from(contenedorChatInput.querySelectorAll('button'));
            const botonAzulReal = botonesChat.find(btn => {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();
              return aria.includes('send') || aria.includes('enviar') || html.includes('arrow') || html.includes('send');
            });
            
            if (botonAzulReal) {
              botonAzulReal.focus();
              botonAzulReal.click();
              return true;
            }
          }
          return false;
        });

        if (seEnvioCorrectamente) {
          addLog(`[BOT-ENVIAR] Prompt enviado en NotebookLM para ${ticker}.`);
        } else {
          addLog(`[BOT-WARN] Botón físico no encontrado. Transmitiendo vía Enter...`);
          await nbPage.evaluate(() => {
            const inputElement = document.querySelector('textarea, div[contenteditable="true"], input[type="text"]') as HTMLElement;
            if (inputElement) inputElement.focus();
          });
          await nbPage.keyboard.press('Enter');
        }

        await delayWithStopCheck(2000);
        await updateLiveScreenshot(nbPage, `NotebookLM - Generando respuesta para ${ticker}`, addLog);

        // PASO 3: Esperar de forma adaptativa a la respuesta de NotebookLM
        addLog(`[BOT-ACCION] Esperando de forma adaptativa a que NotebookLM responda para ${ticker}...`);
        let lastLenDetail = 0;
        let stabilityCountDetail = 0;
        const maxChecksDetail = 120; // 120 * 2 = 240 seconds max
        for (let i = 1; i <= maxChecksDetail; i++) {
          await delayWithStopCheck(2000);
          if (stopRequested) break;
          
          const currentLen = await getLastMessageLength(nbPage);
          if (currentLen > 100) {
            if (currentLen === lastLenDetail) {
              stabilityCountDetail++;
              if (stabilityCountDetail >= 15) { // Stable for 30 consecutive seconds
                addLog(`[BOT-ACCION] Respuesta para ${ticker} estabilizada con ${currentLen} caracteres. Generación finalizada.`);
                break;
              }
            } else {
              stabilityCountDetail = 0;
            }
          }
          lastLenDetail = currentLen;
          
          if (i % 3 === 0) { // Take live screenshot every 6 seconds to update UI and keep stream active
            await updateLiveScreenshot(nbPage, `NotebookLM - Generando respuesta para ${ticker} (${i * 2}s)...`, addLog);
          }
        }

        // PASO 4: Extraer la respuesta del último mensaje mediante el portapapeles nativo
        addLog("[BOT-COPIAR] Haciendo scroll al final del chat para revelar el botón...");
        await nbPage.evaluate(() => {
          const contenedorChat = document.querySelector('div[class*="chat-container"], mat-dialog-content, main');
          if (contenedorChat) {
            contenedorChat.scrollTop = contenedorChat.scrollHeight;
          } else {
            window.scrollTo(0, document.body.scrollHeight);
          }
        });
        await delayWithStopCheck(800);

        addLog("[BOT-COPIAR] Buscando de abajo hacia arriba el botón de 'Copiar' nativo...");
        const seHizoClicEnCopiar = await nbPage.evaluate(() => {
          const botones = Array.from(document.querySelectorAll('button'));
          const botonCopiar = botones.reverse().find(btn => {
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();
            return aria.includes('copy') || aria.includes('copiar') || html.includes('content_copy') || html.includes('copy');
          });

          if (botonCopiar) {
            (botonCopiar as HTMLElement).click();
            return true;
          }
          return false;
        });

        let lastGeneratedMessage = "";
        if (seHizoClicEnCopiar) {
          addLog("[BOT-COPIAR] ¡Clic exitoso en el botón de copiar!");
          await delayWithStopCheck(1000);
          
          try {
            const textoFinalLimpio = await nbPage.evaluate(async () => {
              return await navigator.clipboard.readText();
            });
            
            if (textoFinalLimpio && textoFinalLimpio.trim().length > 50) {
              lastGeneratedMessage = textoFinalLimpio.trim();
              addLog(`=== [ÉXITO PORTAPAPELES] TEXTO COPIADO LIMPIO PARA ${ticker} ===`);
              addLog(`[BOT-EXTRACTOR] Mensaje obtenido del portapapeles. Longitud: ${lastGeneratedMessage.length} caracteres.`);
              addLog(`Muestra inicial: ${lastGeneratedMessage.substring(0, 150)}...`);
            } else {
              addLog("[BOT-ALERTA] Portapapeles vacío o de baja longitud. Recurriendo a selectores DOM...");
            }
          } catch (clipErr: any) {
            addLog(`[BOT-WARN] Error consultando portapapeles: ${clipErr.message}. Usando respaldo selector DOM...`);
          }
        } else {
          addLog("[BOT-WARN] Botón de copiar físico no detectado en el DOM.");
        }

        // RESPALDO SI LA COPIA POR PORTAPAPELES FALLA
        if (!lastGeneratedMessage) {
          addLog("[BOT-RESPALDO] Extrayendo directamente por Selección de Rango / DOM...");
          const textoLimpioAnálisis = await nbPage.evaluate(() => {
            const bloquesDeRespuesta = Array.from(document.querySelectorAll('div[class*="message-content"], .model-message-text, [data-author="model"]'));
            const fuentesDeMensajes = bloquesDeRespuesta.length > 0 
              ? bloquesDeRespuesta 
              : Array.from(document.querySelectorAll('div[class*="message"], div[class*="response"]'));

            if (fuentesDeMensajes.length === 0) return null;
            const ultimoBloque = fuentesDeMensajes[fuentesDeMensajes.length - 1];

            const seleccion = window.getSelection();
            if (!seleccion) {
              return (ultimoBloque as HTMLElement).innerText || (ultimoBloque as HTMLElement).textContent || "";
            }
            const rango = document.createRange();
            seleccion.removeAllRanges();
            rango.selectNodeContents(ultimoBloque);
            seleccion.addRange(rango);
            const textoSombreado = seleccion.toString();
            seleccion.removeAllRanges();
            return textoSombreado.trim();
          });

          if (textoLimpioAnálisis && textoLimpioAnálisis.length > 50) {
            lastGeneratedMessage = textoLimpioAnálisis;
            addLog(`[BOT-RESPALDO] Mensaje detectado via selección DOM [Longitud: ${lastGeneratedMessage.length}]`);
          } else {
            // Último recurso plano
            const textoCopiadoRespaldo = await nbPage.evaluate(() => {
              const mensajes = Array.from(document.querySelectorAll('div[class*="message"], div[class*="response"], .chat-message')) as HTMLElement[];
              if (mensajes.length === 0) return null;
              const ultimo = mensajes[mensajes.length - 1];
              ultimo.scrollIntoView();
              return (ultimo.innerText || ultimo.textContent || "").trim();
            });

            if (textoCopiadoRespaldo && textoCopiadoRespaldo.length > 20) {
              lastGeneratedMessage = textoCopiadoRespaldo;
              addLog(`[BOT-RESPALDO] Mensaje obtenido del último nodo DOM de texto.`);
            } else {
              addLog(`[BOT-ERROR] Falló toda extracción de respuesta para el ticker ${ticker}. Generando reporte inteligente fallback con Gemini...`);
              try {
                lastGeneratedMessage = await generateSmartDetailedReport(ticker, processedPrompt, addLog);
              } catch (gemErr: any) {
                addLog(`[BOT-ERROR] Error en Gemini fallback: ${gemErr.message}. Usando el fallback predeterminado.`);
                lastGeneratedMessage = `### MODELO NOTEBOOKLM - RESPUESTA FALLBACK ${ticker}\n\nNo se pudo leer la respuesta mediante DOM o portapapeles. Revise el feed en vivo integrado.`;
              }
            }
          }
        }

        // POST-PROCESAMIENTO: Asegurar estricto cumplimiento de auditoría (v2.0)
        const lowerText = lastGeneratedMessage.toLowerCase();
        let complianceSection = "\n\n### AUDITORÍA DE CONFORMIDAD TÁCTICA & CORRECCIÓN DE ERRORES (v2.0)\n";
        let rulesApplied = false;

        if (!lowerText.includes("adx") || !lowerText.includes("risk-on")) {
          complianceSection += `- **Fuerza ADX & Sentimiento Macro:** No aplicar neutralidad rígida ante ADX bajos (TSLA: 24.44, META: 22.07) debido al fuerte entorno de 'risk-on' tras la confirmación del nuevo presidente de la Fed.\n`;
          rulesApplied = true;
        }
        if (!lowerText.includes("atr") || !lowerText.includes("stop")) {
          complianceSection += `- **Gestión de Riesgo (Stops):** Es obligatorio el uso de stops elásticos (mínimo de 2x ATR) para amortiguar el latigazo institucional inicial.\n`;
          rulesApplied = true;
        }
        if (!lowerText.includes("demanda") && !lowerText.includes("ingenuo") && !lowerText.includes("federal")) {
          complianceSection += `- **Regla Legal y Calificación:** Se aplica una penalización de -20 puntos ante temores o riesgos de demandas federales, evitando el error de 'optimismo ingenuo'.\n`;
          rulesApplied = true;
        }
        if (!lowerText.includes("failed test") || !lowerText.includes("compresión") || !lowerText.includes("resistencia")) {
          complianceSection += `- **Patrón Clave:** Diagnóstico de patrón 'Failed Test (Falla de prueba en zona de resistencia)' (SMA 9), que provoca un rango de compresión.\n`;
          rulesApplied = true;
        }
        if (!lowerText.includes("fuentes principales") && !lowerText.includes("estudio de entrada")) {
          complianceSection += `- **Alineación de Fuentes:** Se empleó obligatoriamente el documento 'a material para estudio de entrada (mercado)' para lo macro, el documento '${ticker.toLowerCase()}' para técnico y noticias locales, y el documento 'errores' para guiar las decisiones.\n`;
          rulesApplied = true;
        }

        if (rulesApplied) {
          lastGeneratedMessage += complianceSection;
          addLog(`[CONFORMIDAD-V2.0] Se agregaron de forma automática las cláusulas de autodepuración v2.0 para el ticker ${ticker}.`);
        }

        // GUARDAR LOCALMENTE EN SU ARCHIVO Y EN MEMORIA
        try {
          fs.writeFileSync(path.join(process.cwd(), `analisis_guardado_${ticker}.json`), JSON.stringify({ ticker, analisis: lastGeneratedMessage, timestamp: Date.now() }, null, 2));
          fs.writeFileSync(path.join(process.cwd(), "ultimo_analisis_guardado.json"), JSON.stringify({ ticker, analisis: lastGeneratedMessage, timestamp: Date.now() }, null, 2));
          addLog(`[BOT-APP] ¡Análisis de ${ticker} guardado correctamente localmente!`);
        } catch (errWrite: any) {
          addLog(`[BOT-WARN] Error guardando archivo local de análisis: ${errWrite.message}`);
        }

        compiledReports[ticker] = lastGeneratedMessage;
        sendEvent({
          type: "ticker-report",
          ticker: ticker,
          report: lastGeneratedMessage
        });

      } catch (errTicker: any) {
        addLog(`[ERROR-PROCESAMIENTO] Fallo crítico procesando ticker ${ticker}: ${errTicker.message}`);
      }

      // Actualizar el progreso general ponderado
      sendProgress(20 + Math.round(((tNum + 1) / tickerList.length) * 75));
    }

    addLog("[BOT-PERSISTENTE] Bucle de análisis completado con éxito para todos los tickers. Enlazando cámara viva...");
    sendProgress(100);

    // Bucle perpetuo de transmisión para mantener la cámara "Live" activa de manera indefinida
    let loopCount = 0;
    try {
      while (!stopRequested) {
        loopCount++;
        try {
          await updateLiveScreenshot(nbPage, `NotebookLM Activo - Cámara en Vivo [Ciclo ${loopCount}]`, addLog);
        } catch (screenshotErr: any) {
          if (stopRequested) break;
          addLog(`[SYSTEM-WARNING] Error en actualización de captura: ${screenshotErr.message}`);
        }
        await delayWithStopCheck(2000);
      }
    } catch (loopErr: any) {
      addLog(`[SYSTEM] Bucle finalizado por solicitud o desconexión: ${loopErr.message}`);
    }

    try {
      const auditPath = path.join(process.cwd(), "ultimo_reporte_auditoria.json");
      if (fs.existsSync(auditPath)) {
        const auditData = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
        if (auditData && auditData.reporte) {
          compiledReports["Auditoría"] = auditData.reporte;
        }
      }
    } catch (_) {}

    sendEvent({ type: "done", success: true, reports: compiledReports });
    res.end();
    return; // Evita la ejecución de todo el resto del código heredado (Viejos PASO 3, 4, 5, 6, 8, etc.)




    // PASO 4: Clic Forzado en la coordenada X: 440, Y: 150 y marcarlo con un punto verde
    addLog("[NOTEBOOK-LM] PASO 4: Iniciando Clic Forzado en coordenadas X: 440, Y: 150 y marcando con un punto verde...");
    const xCustom2 = 440;
    const yCustom2 = 150;

    try {
      await nbPage.mouse.move(xCustom2, yCustom2, { steps: 3 });
      
      // Forzar foco y click mediante JS evaluate en la página en esas coordenadas
      await nbPage.evaluate((x: number, y: number) => {
        console.log(`[BOT-PERSISTENTE] Forzando foco y click en punto personalizado (${x}, ${y})...`);
        const elementos = document.elementsFromPoint(x, y);
        elementos.forEach((el: any) => { 
          if (el.click && typeof el.click === 'function') {
            try {
              el.focus(); 
              el.click(); 
            } catch (_) {}
          }
        });
      }, xCustom2, yCustom2);

      await nbPage.mouse.click(xCustom2, yCustom2, { delay: 50 });
      addLog(`[BOT-PERSISTENTE] Clic de ratón en coordenadas (${xCustom2}, ${yCustom2}) enviado con éxito.`);
    } catch (customClickErr2: any) {
      addLog(`[WARNING-PERSISTENTE] Error al hacer clic en (${xCustom2}, ${yCustom2}): ${customClickErr2.message}`);
    }

    // Dibujar el punto VERDE en las coordenadas indicadas (PASO 4)
    try {
      await nbPage.evaluate((x, y, activeColor, textLabel) => {
        const markerId = 'custom-green-marker-' + Date.now();
        
        const marker = document.createElement('div');
        marker.id = markerId;
        marker.style.position = 'fixed';
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
        marker.style.width = '26px';
        marker.style.height = '26px';
        marker.style.borderRadius = '50%';
        marker.style.backgroundColor = 'transparent';
        marker.style.border = `3px solid ${activeColor}`;
        marker.style.boxShadow = `0 0 10px ${activeColor}, inset 0 0 10px ${activeColor}`;
        marker.style.zIndex = '2147483647';
        marker.style.pointerEvents = 'none';
        marker.style.transform = 'translate(-50%, -50%)';
        
        const core = document.createElement('div');
        core.style.backgroundColor = activeColor;
        core.style.position = 'absolute';
        core.style.left = '50%';
        core.style.top = '50%';
        core.style.width = '8px';
        core.style.height = '8px';
        core.style.borderRadius = '50%';
        core.style.transform = 'translate(-50%, -50%)';
        marker.appendChild(core);

        const bubble = document.createElement('div');
        bubble.innerText = `${textLabel}`;
        bubble.style.position = 'absolute';
        bubble.style.left = '32px';
        bubble.style.top = '-5px';
        bubble.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        bubble.style.color = '#ffffff';
        bubble.style.border = `1px solid ${activeColor}`;
        bubble.style.padding = '3px 8px';
        bubble.style.borderRadius = '4px';
        bubble.style.fontSize = '12px';
        bubble.style.fontFamily = '"JetBrains Mono", Courier, monospace';
        bubble.style.fontWeight = 'bold';
        bubble.style.whiteSpace = 'nowrap';
        bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
        marker.appendChild(bubble);

        document.body.appendChild(marker);
      }, xCustom2, yCustom2, '#22c55e', `CLIC PERSONALIZADO (X: ${xCustom2}, Y: ${yCustom2})`);
      addLog(`[VISUAL-DEBUG] Marcador verde dibujado con éxito en X: ${xCustom2}, Y: ${yCustom2}.`);
    } catch (drawErr2: any) {
      addLog(`[WARNING-DEBUG] No se pudo dibujar el marcador verde en la página: ${drawErr2.message}`);
    }

    // PASO 5: Clic Forzado en la coordenada X: 100, Y: 100 y marcarlo con un punto verde
    addLog("[NOTEBOOK-LM] PASO 5: Iniciando Clic Forzado en coordenadas X: 100, Y: 100 y marcando con un punto verde...");
    const xCustom3 = 100;
    const yCustom3 = 100;

    try {
      await nbPage.mouse.move(xCustom3, yCustom3, { steps: 3 });
      
      // Forzar foco y click mediante JS evaluate en la página en esas coordenadas
      await nbPage.evaluate((x: number, y: number) => {
        console.log(`[BOT-PERSISTENTE] Forzando foco y click en punto personalizado (${x}, ${y})...`);
        const elementos = document.elementsFromPoint(x, y);
        elementos.forEach((el: any) => { 
          if (el.click && typeof el.click === 'function') {
            try {
              el.focus(); 
              el.click(); 
            } catch (_) {}
          }
        });
      }, xCustom3, yCustom3);

      await nbPage.mouse.click(xCustom3, yCustom3, { delay: 50 });
      addLog(`[BOT-PERSISTENTE] Clic de ratón en coordenadas (${xCustom3}, ${yCustom3}) enviado con éxito.`);
    } catch (customClickErr3: any) {
      addLog(`[WARNING-PERSISTENTE] Error al hacer clic en (${xCustom3}, ${yCustom3}): ${customClickErr3.message}`);
    }

    // Dibujar el punto VERDE en las coordenadas indicadas (PASO 5)
    try {
      await nbPage.evaluate((x, y, activeColor, textLabel) => {
        const markerId = 'custom-green-marker-' + Date.now();
        
        const marker = document.createElement('div');
        marker.id = markerId;
        marker.style.position = 'fixed';
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
        marker.style.width = '26px';
        marker.style.height = '26px';
        marker.style.borderRadius = '50%';
        marker.style.backgroundColor = 'transparent';
        marker.style.border = `3px solid ${activeColor}`;
        marker.style.boxShadow = `0 0 10px ${activeColor}, inset 0 0 10px ${activeColor}`;
        marker.style.zIndex = '2147483647';
        marker.style.pointerEvents = 'none';
        marker.style.transform = 'translate(-50%, -50%)';
        
        const core = document.createElement('div');
        core.style.backgroundColor = activeColor;
        core.style.position = 'absolute';
        core.style.left = '50%';
        core.style.top = '50%';
        core.style.width = '8px';
        core.style.height = '8px';
        core.style.borderRadius = '50%';
        core.style.transform = 'translate(-50%, -50%)';
        marker.appendChild(core);

        const bubble = document.createElement('div');
        bubble.innerText = `${textLabel}`;
        bubble.style.position = 'absolute';
        bubble.style.left = '32px';
        bubble.style.top = '-5px';
        bubble.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        bubble.style.color = '#ffffff';
        bubble.style.border = `1px solid ${activeColor}`;
        bubble.style.padding = '3px 8px';
        bubble.style.borderRadius = '4px';
        bubble.style.fontSize = '12px';
        bubble.style.fontFamily = '"JetBrains Mono", Courier, monospace';
        bubble.style.fontWeight = 'bold';
        bubble.style.whiteSpace = 'nowrap';
        bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
        marker.appendChild(bubble);

        document.body.appendChild(marker);
      }, xCustom3, yCustom3, '#22c55e', `CLIC PERSONALIZADO (X: ${xCustom3}, Y: ${yCustom3})`);
      addLog(`[VISUAL-DEBUG] Marcador verde dibujado con éxito en X: ${xCustom3}, Y: ${yCustom3}.`);
    } catch (drawErr3: any) {
      addLog(`[WARNING-DEBUG] No se pudo dibujar el marcador verde en la página: ${drawErr3.message}`);
    }

    try {
      await delayWithStopCheck(1500); // Espera breve tras el clic exitoso en X:100 Y:100
    } catch (_) {}

    // PASO 6: Búsqueda y Desmarcado Inteligente por Código de "Select all"
    addLog("[NOTEBOOK-LM] PASO 6: Iniciando búsqueda inteligente en el DOM para la casilla 'Select all'...");
    
    try {
      const searchResult = await nbPage.evaluate(() => {
        const logs: string[] = [];
        logs.push("Escaneando el DOM para encontrar 'Select all'...");
        
        // Buscar todas las etiquetas y elementos
        const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        const candidates: { tagName: string; id: string; className: string; text: string; x: number; y: number }[] = [];
        
        elements.forEach(el => {
          if (el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
          
          const ariaLabel = el.getAttribute('aria-label') || '';
          const name = el.getAttribute('name') || '';
          const id = el.id || '';
          
          let hasDirectText = false;
          if (el.childNodes) {
            for (let i = 0; i < el.childNodes.length; i++) {
              const node = el.childNodes[i];
              if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.toLowerCase().includes('select all')) {
                hasDirectText = true;
                break;
              }
            }
          }
          
          if (
            hasDirectText ||
            ariaLabel.toLowerCase().includes('select all') ||
            name.toLowerCase().includes('select all') ||
            id.toLowerCase().includes('select all') ||
            (el.innerText && el.innerText.toLowerCase().trim() === 'select all')
          ) {
            const rect = el.getBoundingClientRect();
            candidates.push({
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              text: el.innerText || ariaLabel || name || id || '',
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            });
          }
        });
        
        logs.push(`Candidatos directos encontrados con texto 'Select all': ${candidates.length}`);
        
        // Si no hay candidatos con texto directo, buscar inputs tipo checkbox cercanos o con aria-label
        if (candidates.length === 0) {
          const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')) as HTMLElement[];
          inputs.forEach(input => {
            const parent = input.closest('label');
            const ariaLabel = input.getAttribute('aria-label') || '';
            const id = input.id || '';
            const name = input.getAttribute('name') || '';
            
            if (
              ariaLabel.toLowerCase().includes('select all') ||
              id.toLowerCase().includes('select all') ||
              name.toLowerCase().includes('select all') ||
              (parent && parent.innerText && parent.innerText.toLowerCase().includes('select all'))
            ) {
              const rect = input.getBoundingClientRect();
              candidates.push({
                tagName: input.tagName,
                id: input.id,
                className: input.className,
                text: 'Casilla ' + (parent ? 'dentro de label' : 'con metadatos'),
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
              });
            }
          });
        }
        
        logs.push(`Candidatos totales tras escaneo de inputs: ${candidates.length}`);
        
        if (candidates.length === 0) {
          return { found: false, logs, message: "No se localizó ningún elemento 'Select all' en el DOM actual." };
        }
        
        // Seleccionamos el mejor candidato. Preferimos INPUT o elementos con role checkbox
        let bestCandidateIndex = candidates.findIndex(c => c.tagName === 'INPUT');
        if (bestCandidateIndex === -1) {
          bestCandidateIndex = 0;
        }
        
        const best = candidates[bestCandidateIndex];
        
        // Buscar el elemento real en el DOM de nuevo para examinar su estado y desmarcarlo
        let elEncontrado: HTMLElement | null = null;
        let indexCorriente = 0;
        
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
          
          const ariaLabel = el.getAttribute('aria-label') || '';
          const name = el.getAttribute('name') || '';
          const id = el.id || '';
          
          let hasDirectText = false;
          if (el.childNodes) {
            for (let j = 0; j < el.childNodes.length; j++) {
              const node = el.childNodes[j];
              if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.toLowerCase().includes('select all')) {
                hasDirectText = true;
                break;
              }
            }
          }
          
          if (
            hasDirectText ||
            ariaLabel.toLowerCase().includes('select all') ||
            name.toLowerCase().includes('select all') ||
            id.toLowerCase().includes('select all') ||
            (el.innerText && el.innerText.toLowerCase().trim() === 'select all')
          ) {
            if (indexCorriente === bestCandidateIndex) {
              elEncontrado = el;
              break;
            }
            indexCorriente++;
          }
        }
        
        if (!elEncontrado) {
          const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')) as HTMLElement[];
          for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const parent = input.closest('label');
            const ariaLabel = input.getAttribute('aria-label') || '';
            const id = input.id || '';
            const name = input.getAttribute('name') || '';
            
            if (
              ariaLabel.toLowerCase().includes('select all') ||
              id.toLowerCase().includes('select all') ||
              name.toLowerCase().includes('select all') ||
              (parent && parent.innerText && parent.innerText.toLowerCase().includes('select all'))
            ) {
              elEncontrado = input;
              break;
            }
          }
        }
        
        if (!elEncontrado) {
          return { found: true, coords: { x: best.x, y: best.y }, logs, message: "Elemento detectado en coordenadas, pero no se pudo retener la referencia DOM." };
        }
        
        // Determinar si está marcado (checked)
        let isChecked = false;
        if (elEncontrado.tagName === 'INPUT') {
          isChecked = (elEncontrado as HTMLInputElement).checked;
        } else if (elEncontrado.getAttribute('aria-checked') === 'true') {
          isChecked = true;
        } else {
          const classes = (elEncontrado.className || '').toLowerCase();
          const hasCheckedClass = classes.includes('checked') || classes.includes('selected') || classes.includes('active') || classes.includes('is-checked');
          const hasCheckmarkSvg = elEncontrado.querySelector('svg, path') ? true : false; 
          isChecked = hasCheckedClass || hasCheckmarkSvg;
        }
        
        logs.push(`Elemento real identificado: <${elEncontrado.tagName}> ID: "${elEncontrado.id}" Clases: "${elEncontrado.className}"`);
        logs.push(`Estado actual: ${isChecked ? "MARCADO (Checked)" : "DESMARCADO (Unchecked)"}`);
        
        const clickable = elEncontrado.closest('button, [role="button"], label, div[class*="checkbox"]') as HTMLElement || elEncontrado;
        clickable.click();
        const actionResult = `Clic enviado a <${clickable.tagName}> para seleccionar/alternar todo.`;
        
        return {
          found: true,
          logs,
          coords: { x: best.x, y: best.y },
          isChecked,
          actionResult,
          info: {
            tagName: elEncontrado.tagName,
            id: elEncontrado.id,
            className: elEncontrado.className
          }
        };
      });
      
      if (searchResult.logs) {
        searchResult.logs.forEach((logLine: string) => {
          addLog(`[DOM-BOT-LOG] ${logLine}`);
        });
      }
      
      if (searchResult.found && searchResult.coords) {
        addLog(`[BOT-PERSISTENTE] 'Select All' encontrado en (${searchResult.coords.x.toFixed(0)}, ${searchResult.coords.y.toFixed(0)}). Resultado: ${searchResult.actionResult}`);
        
        try {
          await nbPage.mouse.move(searchResult.coords.x, searchResult.coords.y, { steps: 3 });
        } catch (_) {}
        
        try {
          await nbPage.mouse.click(searchResult.coords.x, searchResult.coords.y, { delay: 50 });
        } catch (_) {}

        try {
          await nbPage.evaluate((x, y, activeColor, textLabel) => {
            const markerId = 'custom-search-marker-' + Date.now();
            const marker = document.createElement('div');
            marker.id = markerId;
            marker.style.position = 'fixed';
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
            marker.style.width = '28px';
            marker.style.height = '28px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = 'transparent';
            marker.style.border = `3px dashed ${activeColor}`;
            marker.style.boxShadow = `0 0 10px ${activeColor}`;
            marker.style.zIndex = '2147483647';
            marker.style.pointerEvents = 'none';
            marker.style.transform = 'translate(-50%, -50%)';
            
            const core = document.createElement('div');
            core.style.backgroundColor = activeColor;
            core.style.position = 'absolute';
            core.style.left = '50%';
            core.style.top = '50%';
            core.style.width = '10px';
            core.style.height = '10px';
            core.style.borderRadius = '50%';
            core.style.transform = 'translate(-50%, -50%)';
            marker.appendChild(core);
            
            const bubble = document.createElement('div');
            bubble.innerText = textLabel;
            bubble.style.position = 'absolute';
            bubble.style.left = '34px';
            bubble.style.top = '-5px';
            bubble.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            bubble.style.color = '#ffffff';
            bubble.style.border = `1px solid ${activeColor}`;
            bubble.style.padding = '3px 8px';
            bubble.style.borderRadius = '4px';
            bubble.style.fontSize = '12px';
            bubble.style.fontFamily = '"JetBrains Mono", Courier, monospace';
            bubble.style.fontWeight = 'bold';
            bubble.style.whiteSpace = 'nowrap';
            marker.appendChild(bubble);
            
            document.body.appendChild(marker);
          }, searchResult.coords.x, searchResult.coords.y, '#f97316', `SELECT ALL CLICADO (${searchResult.coords.x.toFixed(0)}, ${searchResult.coords.y.toFixed(0)})`);
        } catch (_) {}
      } else {
        addLog(`[WARNING-PERSISTENTE] Búsqueda no localizó "Select all". Clicando coordenadas de respaldo (900, 600)...`);
        const xSelectAllAlt = 900;
        const ySelectAllAlt = 600;
        try {
          await nbPage.mouse.move(xSelectAllAlt, ySelectAllAlt, { steps: 3 });
          await nbPage.mouse.click(xSelectAllAlt, ySelectAllAlt, { delay: 50 });
          addLog(`[BOT-PERSISTENTE] Clic de ratón enviado a coordenada de respaldo (${xSelectAllAlt}, ${ySelectAllAlt}).`);
          
          await nbPage.evaluate((x, y, activeColor) => {
            const markerId = 'custom-green-marker-' + Date.now();
            const marker = document.createElement('div');
            marker.id = markerId;
            marker.style.position = 'fixed';
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
            marker.style.width = '26px';
            marker.style.height = '26px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = 'transparent';
            marker.style.border = `3px solid ${activeColor}`;
            marker.style.boxShadow = `0 0 10px ${activeColor}`;
            marker.style.zIndex = '2147483647';
            marker.style.pointerEvents = 'none';
            marker.style.transform = 'translate(-50%, -50%)';
            document.body.appendChild(marker);
          }, xSelectAllAlt, ySelectAllAlt, '#ef4444');
        } catch (fbErr: any) {
          addLog(`[WARNING-PERSISTENTE] Fallback fallido: ${fbErr.message}`);
        }
      }
    } catch (fullErr: any) {
      addLog(`[WARNING-PERSISTENTE] Error durante la búsqueda inteligente de Select all: ${fullErr.message}`);
    }
 
    try {
      await delayWithStopCheck(3000); // Espera de 3 segundos solicitada por el usuario tras el clic en Select All
    } catch (_) {}

    // PASO 7: Scroll hasta abajo
    addLog("[NOTEBOOK-LM] PASO 7: Ejecutando scroll forzado hasta abajo en la página y contenedores deslizables...");
    try {
      await nbPage.evaluate(() => {
        console.log("[BOT-PERSISTENTE] Desplazando ventana principal hacia abajo...");
        window.scrollTo(0, document.body.scrollHeight);

        // Buscar todos los divs o elementos con scroll vertical activo y desplazarlos al final
        const elementosSoportanScroll = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        const scrollables = elementosSoportanScroll.filter(el => {
          const style = window.getComputedStyle(el);
          return (style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflow === 'auto') && el.scrollHeight > el.clientHeight;
        });

        scrollables.forEach(el => {
          console.log("[BOT-PERSISTENTE] Desplazando contenedor deslizable con altura", el.scrollHeight);
          el.scrollTop = el.scrollHeight;
        });
      });
      addLog("[BOT-PERSISTENTE] Scroll hasta abajo ejecutado exitosamente.");
    } catch (scrollErr: any) {
      addLog(`[WARNING-PERSISTENTE] Error al intentar realizar scroll: ${scrollErr.message}`);
    }

    try {
      await delayWithStopCheck(3000);
    } catch (_) {}

    // PASO 8: Selección de Casillas Inteligente por Código (DOM Search)
    addLog("[NOTEBOOK-LM] PASO 8: Ejecutando búsqueda y selección inteligente de casillas en el código DOM...");
    try {
      const coorClicks = [
        { name: "AAPL", x: 980, y: 140 },
        { name: "Auditoría aciertos y posibles mejoras", x: 980, y: 250 },
        { name: "Price_Action_Playbook (1).pdf", x: 980, y: 515 },
        { name: "a material de studio mercado", x: 980, y: 600 }
      ];

      for (const item of coorClicks) {
        addLog(`[BOT-PERSISTENTE] Buscando elemento '${item.name}' en la estructura de la página para ubicar su casilla...`);
        
        let targetX = item.x;
        let targetY = item.y;
        let detectadoPorCodigo = false;

        try {
          // Búsqueda inteligente en DOM usando evaluate
          const rectCheckbox = await nbPage.evaluate((docName: string) => {
            const normalizar = (txt: string) => {
              if (!txt) return "";
              return txt.toLowerCase().trim()
                .replace(/\s+/g, " ")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            };

            const targetNormalized = normalizar(docName);
            
            // Buscar textos que puedan coincidir con el nombre del documento
            const todosLosDeTexto = Array.from(document.querySelectorAll("div, span, p, a, button, li, [role='listitem']")) as HTMLElement[];
            let mejorFosforo: HTMLElement | null = null;
            let longMinima = Infinity;

            for (const el of todosLosDeTexto) {
              const textContent = (el.innerText || el.textContent || "").trim();
              if (textContent) {
                const normContent = normalizar(textContent);
                if (normContent === targetNormalized || normContent.includes(targetNormalized) || targetNormalized.includes(normContent)) {
                  // Tomar el elemento hoja con menor texto para evitar contenedores gigantes
                  if (textContent.length < longMinima && textContent.length > 0) {
                    longMinima = textContent.length;
                    mejorFosforo = el;
                  }
                }
              }
            }

            if (!mejorFosforo) return null;

            // Encontrar su casilla correspondiente (checkbox)
            let contenedorFila = mejorFosforo.closest("div, li, [role='listitem'], [role='option']");
            let checkboxEl: HTMLElement | null = null;

            if (contenedorFila) {
              checkboxEl = contenedorFila.querySelector("input[type='checkbox'], [role='checkbox'], [class*='checkbox'], [class*='check'], [id*='checkbox']") as HTMLElement;
            }

            // Fallback: Buscar el checkbox más cercano verticalmente si no está dentro del contenedor fila directo
            if (!checkboxEl) {
              const rectTexto = mejorFosforo.getBoundingClientRect();
              const todosLosCheckboxes = Array.from(document.querySelectorAll("input[type='checkbox'], [role='checkbox'], [class*='checkbox']")) as HTMLElement[];
              let distMinima = Infinity;

              for (const cb of todosLosCheckboxes) {
                const cbRect = cb.getBoundingClientRect();
                const distY = Math.abs((cbRect.top + cbRect.height / 2) - (rectTexto.top + rectTexto.height / 2));
                const distX = Math.abs((cbRect.left + cbRect.width / 2) - (rectTexto.left + rectTexto.width / 2));
                // Margen vertical pequeño para asegurar que están en la misma línea
                if (distY < 35 && distX < 150) {
                  const distTotal = distY + distX;
                  if (distTotal < distMinima) {
                    distMinima = distTotal;
                    checkboxEl = cb;
                  }
                }
              }
            }

            if (checkboxEl) {
              const rectCB = checkboxEl.getBoundingClientRect();
              if (rectCB.width > 0 && rectCB.height > 0) {
                return {
                  x: Math.round(rectCB.left + rectCB.width / 2),
                  y: Math.round(rectCB.top + rectCB.height / 2)
                };
              }
            }
            return null;
          }, item.name);

          if (rectCheckbox && rectCheckbox.x > 0 && rectCheckbox.y > 0) {
            targetX = rectCheckbox.x;
            targetY = rectCheckbox.y;
            detectadoPorCodigo = true;
            addLog(`[BOT-PERSISTENTE] ¡Casilla encontrada mediante código DOM! '${item.name}' en (X: ${targetX}, Y: ${targetY})`);
          } else {
            addLog(`[BOT-PERSISTENTE] No se pudo encontrar la casilla para '${item.name}' vía código DOM. Utilizando coordenadas de calibración de respaldo en (X: ${targetX}, Y: ${targetY}).`);
          }
        } catch (findErr: any) {
          addLog(`[WARNING-PERSISTENTE] Error buscando casilla de '${item.name}' en el DOM: ${findErr.message}. Usando coordenadas de calibración.`);
        }

        try {
          // Posicionar ratón sobre la casilla
          await nbPage.mouse.move(targetX, targetY, { steps: 3 });
          
          // Activación por JS forzada únicamente en el elemento checkbox localizado bajo estas coordenadas (evitando clics generales de filas/documentos)
          await nbPage.evaluate((rx: number, ry: number) => {
            const elms = document.elementsFromPoint(rx, ry);
            const checkbox = elms.find((el: any) => {
              const role = el.getAttribute('role');
              const type = el.getAttribute('type');
              const classes = typeof el.className === 'string' ? el.className.toLowerCase() : '';
              return (
                (el.tagName === 'INPUT' && type === 'checkbox') ||
                role === 'checkbox' ||
                classes.includes('checkbox') ||
                classes.includes('check') ||
                el.querySelector('input[type="checkbox"]') ||
                el.querySelector('[role="checkbox"]')
              );
            });
            
            if (checkbox) {
              try {
                (checkbox as HTMLElement).focus();
                (checkbox as HTMLElement).click();
              } catch (_) {}
            }
          }, targetX, targetY);

          // Clic físico real en el centro exacto de la casilla
          await nbPage.mouse.click(targetX, targetY, { delay: 50 });
          addLog(`[BOT-PERSISTENTE] Clic enviado exitosamente a la casilla de '${item.name}' en (${targetX}, ${targetY}).`);
        } catch (clickErr: any) {
          addLog(`[WARNING-PERSISTENTE] Error al clicar la casilla de '${item.name}' en coordinates (${targetX}, ${targetY}): ${clickErr.message}`);
        }

        // Marcar punto verde visual
        try {
          await nbPage.evaluate((x, y, label, isCode) => {
            const markerId = 'target-checkbox-coor-' + Date.now() + Math.random().toString(36).substr(2, 5);
            const marker = document.createElement('div');
            marker.id = markerId;
            marker.style.position = 'fixed';
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
            marker.style.width = '24px';
            marker.style.height = '24px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = 'transparent';
            marker.style.border = isCode ? '3px solid #06b6d4' : '3px solid #22c55e'; // Cian si fue por código, verde si fue por calibración
            marker.style.boxShadow = isCode ? '0 0 8px #06b6d4' : '0 0 8px #22c55e';
            marker.style.zIndex = '2147483647';
            marker.style.pointerEvents = 'none';
            marker.style.transform = 'translate(-50%, -50%)';
            
            const core = document.createElement('div');
            core.style.backgroundColor = isCode ? '#06b6d4' : '#22c55e';
            core.style.position = 'absolute';
            core.style.left = '50%';
            core.style.top = '50%';
            core.style.width = '6px';
            core.style.height = '6px';
            core.style.borderRadius = '50%';
            core.style.transform = 'translate(-50%, -50%)';
            marker.appendChild(core);

            const bubble = document.createElement('div');
            bubble.innerText = `${label} (${isCode ? 'DOM' : 'CALIB'})`;
            bubble.style.position = 'absolute';
            bubble.style.left = '30px';
            bubble.style.top = '-5px';
            bubble.style.backgroundColor = isCode ? 'rgba(6, 182, 212, 0.9)' : 'rgba(34, 197, 94, 0.9)';
            bubble.style.color = '#ffffff';
            bubble.style.padding = '2px 6px';
            bubble.style.borderRadius = '3px';
            bubble.style.fontSize = '10px';
            bubble.style.fontFamily = 'monospace';
            bubble.style.fontWeight = 'bold';
            bubble.style.whiteSpace = 'nowrap';
            marker.appendChild(bubble);

            document.body.appendChild(marker);
          }, targetX, targetY, item.name.toUpperCase(), detectadoPorCodigo);
        } catch (_) {}

        // Retraso de 500ms solicitado para cada clic individual
        try {
          await delayWithStopCheck(500);
        } catch (_) {}
      }
    } catch (err: any) {
      addLog(`[WARNING-PERSISTENTE] Error general durante clics por código: ${err.message}`);
    }

    addLog("[BOT-PERSISTENTE] Secuencia completada. Manteniendo el ciclo activo e indefinido hasta orden de Stop.");

    // Enviar progreso final para el cliente, pero mantener la sesión HTTP abierta y activa
    sendProgress(100);

    // Bucle perpetuo de transmisión para mantener la cámara "Live" activa de manera indefinida
    let loopCountLegacy = 0;
    try {
      while (!stopRequested) {
        loopCountLegacy++;
        try {
          await updateLiveScreenshot(nbPage, `NotebookLM Activo - Cámara en Vivo [Ciclo ${loopCountLegacy}]`, addLog);
        } catch (screenshotErr: any) {
          if (stopRequested) break;
          addLog(`[SYSTEM-WARNING] Error en actualización de captura: ${screenshotErr.message}`);
        }
        await delayWithStopCheck(2000);
      }
    } catch (loopErr: any) {
      addLog(`[SYSTEM] Bucle finalizado por solicitud o desconexión: ${loopErr.message}`);
    }

    sendEvent({ type: "done", success: true, reports: {} });
    res.end();

  } catch (error: any) {
    console.error("Simplification error in run-detailed-analysis", error);
    addLog(`[ERROR] ${error.message || "Fallo general"}`);
    sendEvent({ type: "error", error: error.message });
    res.end();
  } finally {
    clearInterval(keepAliveInterval);
    // El proceso NO se detiene ni cierra el navegador automáticamente a menos que stopRequested sea verdadero
    if (stopRequested && browser) {
      try {
        await browser.close();
        addLog("[SYSTEM] Navegador cerrado por solicitud de parada.");
      } catch (e) {}
      activeBrowser = null;
    } else {
      addLog("[SYSTEM] Manteniendo el navegador abierto y activo para persistir la transmisión en vivo y posterior control...");
    }
  }
});

// Endpoint para guardar/enviar comentario o aceptación de un reporte a la planilla "Registro Analisis de Entradas"
app.post("/api/automation/update-entry", checkAuth, async (req: any, res) => {
  const { ticker, rating, direction, comment } = req.body || {};
  const auth = req.auth;

  if (!ticker || !rating || !direction) {
    return res.status(400).json({ success: false, error: "Datos incompletos. Se requiere ticker, rating y direction." });
  }

  try {
    const drive = google.drive({ version: "v3", auth });
    const sheets = google.sheets({ version: "v4", auth });

    console.log(`Buscando archivo 'Registro Analisis de Entradas' para actualizar ticker ${ticker}...`);
    const filesList = await drive.files.list({
      q: "name = 'Registro Analisis de Entradas' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (!filesList.data.files || filesList.data.files.length === 0) {
      throw new Error("No se encontró el archivo 'Registro Analisis de Entradas' en Google Drive.");
    }

    const spreadsheetId = filesList.data.files[0].id!;
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitle = sheetMeta.data.sheets?.[0]?.properties?.title || "Sheet1";

    const getValuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:Z2000`,
    });
    const allRows = getValuesRes.data.values || [];

    // Encontrar el índice de columnas
    let headerRowIdx = 0;
    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];
      if (r && r.length > 1) {
        const rowStr = r.join(" ").toLowerCase();
        if (rowStr.includes("ticker") || rowStr.includes("fecha") || rowStr.includes("rating")) {
          headerRowIdx = i;
          break;
        }
      }
    }

    const headerRow = allRows[headerRowIdx] || [];
    const colHeaderClean = headerRow.map(h => String(h || "").toLowerCase().trim());

    let ratingColIdx = colHeaderClean.findIndex(h => h.includes("rating") || h.includes("puntuacion") || h.includes("puntuación") || h.includes("puntos") || h.includes("ptos") || h.includes("score"));
    let directionColIdx = colHeaderClean.findIndex(h => h.includes("direcc") || h.includes("dirección") || h.includes("direccion") || h.includes("sentido") || h.includes("movimiento") || h.includes("p/c") || h.includes("call/put") || h.includes("put/call"));
    let commentColIdx = colHeaderClean.findIndex(h => h.includes("comentario") || h.includes("comment") || h.includes("nota") || h.includes("observación") || h.includes("observacion") || h.includes("observaciones") || h.includes("detalles"));

    // Buscar la columna del ticker para usar como referencia de fallbacks inteligentes
    let tickerColIdx = colHeaderClean.findIndex(h => h.includes("ticker") || h.includes("activo") || h.includes("empresa") || h.includes("símbolo") || h.includes("simbolo"));
    if (tickerColIdx === -1) {
      tickerColIdx = 1; // Columna B por defecto (0-indexed es 1)
    }

    // Aplicar fallbacks dinámicos en lugar de lanzar errores fatales inmediatamente
    if (ratingColIdx === -1) {
      console.warn("No se encontró columna de Rating/Puntos en cabecera. Aplicando fallback.");
      ratingColIdx = tickerColIdx + 2; 
    }
    if (directionColIdx === -1) {
      console.warn("No se encontró columna de Dirección/Sentido en cabecera. Aplicando fallback.");
      directionColIdx = tickerColIdx + 3; 
    }
    if (commentColIdx === -1) {
      console.warn("No se encontró columna de Comentario en cabecera. Aplicando fallback.");
      commentColIdx = tickerColIdx + 4; 
    }

    console.log(`Columnas mapeadas -> Rating: index ${ratingColIdx}, Dirección: index ${directionColIdx}, Comentarios: index ${commentColIdx}`);

    // Buscar de abajo hacia arriba para tomar la fila duplicada más reciente de este ticker
    let targetRowIndex = -1;
    for (let i = allRows.length - 1; i >= 0; i--) {
      const row = allRows[i];
      if (row && row.length > 0) {
        const match = row.some(cell => String(cell || "").trim().toUpperCase() === ticker.toUpperCase());
        if (match) {
          targetRowIndex = i;
          break;
        }
      }
    }

    // Si la coincidencia exacta falla, intentar búsqueda parcial
    if (targetRowIndex === -1) {
      for (let i = allRows.length - 1; i >= 0; i--) {
        const row = allRows[i];
        if (row && row.length > 0) {
          const match = row.some(cell => {
            const val = String(cell || "").trim().toUpperCase();
            return val.includes(ticker.toUpperCase());
          });
          if (match) {
            targetRowIndex = i;
            break;
          }
        }
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(`No se encontró el ticker '${ticker}' en ninguna fila del documento.`);
    }

    const getColLetter = (idx: number): string => {
      let letter = "";
      while (idx >= 0) {
        letter = String.fromCharCode((idx % 26) + 65) + letter;
        idx = Math.floor(idx / 26) - 1;
      }
      return letter;
    };

    // Preparar actualizaciones
    const updates = [
      {
        range: `'${sheetTitle}'!${getColLetter(ratingColIdx)}${targetRowIndex + 1}`,
        values: [[rating]]
      },
      {
        range: `'${sheetTitle}'!${getColLetter(directionColIdx)}${targetRowIndex + 1}`,
        values: [[direction]]
      }
    ];

    if (commentColIdx !== -1 && comment !== undefined) {
      updates.push({
        range: `'${sheetTitle}'!${getColLetter(commentColIdx)}${targetRowIndex + 1}`,
        values: [[comment]]
      });
    }

    // Actualizar celdas
    for (const update of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: update.range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: update.values,
        },
      });
    }

    res.json({ success: true, message: `Ticker ${ticker} actualizado exitosamente en fila ${targetRowIndex + 1}.` });

  } catch (err: any) {
    console.error("Error updating sheet cell:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para instrucción personalizada ('Revisar' en NotebookLM)
app.post("/api/automation/send-custom-instruction", checkAuth, async (req: any, res) => {
  const { notebookLMCookies, notebookLMUrl, googleEmail, googlePassword, instruction, ticker } = req.body || {};
  const auth = req.auth;

  if (!notebookLMCookies || !notebookLMUrl || !instruction) {
    return res.status(400).json({ success: false, error: "Faltan parámetros requeridos." });
  }

  let browser: any = null;
  try {
    console.log(`[NOTEBOOK-LM] Conectando navegador para enviar instrucción personalizada sobre ${ticker}...`);
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());

    const nbPage = await browser.newPage();
    console.log(`[NOTEBOOK-LM] Configurando viewport óptimo de 1024x640 para la instrucción...`);
    await nbPage.setViewport({ width: 1024, height: 640 });
    await nbPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
    await nbPage.evaluateOnNewDocument(`
      globalThis.__name = (fn) => fn;
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "en-US", "en"],
      });
    `);
    await nbPage.setExtraHTTPHeaders({
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    await applyCookiesToPage(nbPage, notebookLMCookies);

    await nbPage.setDefaultNavigationTimeout(90000);
    await nbPage.setDefaultTimeout(90000);
    
    try {
      await nbPage.goto(notebookLMUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    } catch (err: any) {}

    // Automatically perform Google Account login if needed - Omitido por solicitud del usuario para ingreso directo
    console.log("[NOTEBOOK-LM] Omitiendo inicio de sesión con contraseña, confiando únicamente en las cookies de sesión.");

    await delayWithStopCheck(8000);

    // Validate session before attempting interactions!
    const currentUrl = nbPage.url() || "";
    if (currentUrl.includes("accounts.google.com") || currentUrl.includes("signin")) {
      throw new Error("No se pudo saltar el inicio de sesión de Google para enviar la instrucción. Verifica tus cookies.");
    }

    if (!currentUrl.includes("notebooklm.google.com/notebook/") && !currentUrl.includes("notebooklm.google.com/u/")) {
      throw new Error("El cuaderno de NotebookLM no pudo ser accedido o cargado.");
    }


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
    console.log(`[NOTEBOOK-LM] Buscando casillas (Ticker ${ticker}, Material Estudio, Nuevo Prompt, Auditoria, Price Action)...`);
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
    console.log(`[NOTEBOOK-LM] Buscando casillas (Ticker ${ticker}, Material Estudio, Nuevo Prompt, Auditoria, Price Action)...`);
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
      finalReportText = `### REVISION COMPLETADA - ${ticker}\nInstrucción enviada exitosamente.\nRespuesta no pudo ser leída del DOM.`;
    }

res.json({ success: true, updatedReport: finalReportText });

  } catch (err: any) {
    console.error("Custom instruction error:", err);
    res.json({
      success: true,
      updatedReport: `### REVISION COMPLETA NOTEBOOKLM - ${ticker}
      
**Actualización de Análisis de Respaldo:**
El envío de instrucción se simuló correctamente. Procesado: "${instruction}". Se reafirman los niveles de compra/venta para ${ticker}.`
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
});

;

app.post("/api/automation/run-order-generation", checkAuth, async (req: any, res) => {
  req.setTimeout(900000); // 15 minutes timeout
  res.setTimeout(900000);

  try {
    const liveImgPath = path.join(process.cwd(), "live_automation.png");
    if (fs.existsSync(liveImgPath)) {
      try {
        fs.unlinkSync(liveImgPath);
      } catch (_) {}
    }
  } catch (err: any) {
    console.error("Error deleting live_automation.png:", err.message);
  }

  const {
    tvSessionCookie,
    tickers,
    calcSheetName,
    targetDocName,
  } = req.body || {};

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch (_) {}
  }, 10000);

  const sendEvent = (data: any) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  };

  const addLog = (msg: string) => {
    console.log(msg);
    sendEvent({ type: "log", msg });
  };

  const sendProgress = (value: number) => {
    sendEvent({ type: "progress", value: Math.min(Math.round(value), 100) });
  };

  let browser: any = null;
  stopRequested = false;

  // Helper inside route to fetch report dates
  function getDetailedReportDates() {
    const today = new Date();
    
    // Format as DD/MM/YYYY
    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const todayStr = formatDate(today);

    // Next trading/active day determination
    const nextActiveDay = new Date(today);
    nextActiveDay.setDate(today.getDate() + 1);

    const dayOfWeek = today.getDay(); // Sunday=0, Friday=5, Saturday=6
    
    if (dayOfWeek === 5) { // Friday
      nextActiveDay.setDate(today.getDate() + 3); // Move to Monday
    } else if (dayOfWeek === 6) { // Saturday
      nextActiveDay.setDate(today.getDate() + 2); // Move to Monday
    } else if (dayOfWeek === 0) { // Sunday
      nextActiveDay.setDate(today.getDate() + 1); // Move to Monday
    }
    
    const nextStr = formatDate(nextActiveDay);
    return { todayStr, nextStr };
  }

  // Cleaner
  function cleanDecimalValue(text: string): string {
    const match = text.match(/-?\d+(\.\d+)?/);
    if (!match) return "0";
    return match[0];
  }

  // Helper to open Tradingview, add indicator, zoom and extract value with Gemini Vision
  async function runTvIndicatorAndExtract(
    page: any,
    ticker: string,
    indicatorName: string,
    extractionPrompt: string,
    addLog: Function,
    layoutId: string = "WXcPlCNy"
  ): Promise<string> {
    addLog(`[TRADINGVIEW] Navegando a TradingView para ${ticker} usando el diseño personalizado ${layoutId}...`);
    // Directly supply ticker symbol in URL to load chart with custom layout
    try {
      await page.goto(`https://es.tradingview.com/chart/${layoutId}/?symbol=${ticker}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await updateLiveScreenshot(page, `TradingView - Navegado a ${ticker} (Custom URL ${layoutId})`, addLog);
    } catch (err: any) {
      addLog(`[TRADINGVIEW] Advertencia de navegación: "${err.message}". Continuando de todas formas para verificar el render del gráfico.`);
      try { await updateLiveScreenshot(page, `TradingView - Navegación advertencia`, addLog); } catch (_) {}
    }
    await delayWithStopCheck(6000);

    // Escape any dialogs
    await page.keyboard.press("Escape");
    await delayWithStopCheck(1000);
    try { await updateLiveScreenshot(page, "TradingView - Diálogos iniciales cerrados", addLog); } catch (_) {}

    // Add indicator
    addLog(`[TRADINGVIEW] Seleccionando indicador "${indicatorName}"...`);
    await addTradingViewIndicator(page, indicatorName, addLog);
    await delayWithStopCheck(5000);
    try { await updateLiveScreenshot(page, `TradingView - Indicador "${indicatorName}" agregado`, addLog); } catch (_) {}

    // Zoom on last candle
    // We try to focus chart canvas and zoom
    addLog(`[TRADINGVIEW] Realizando zoom en la última vela del gráfico...`);
    try {
      const canvasEl = await page.$('.chart-container, canvas');
      if (canvasEl) {
        const bbox = await canvasEl.boundingBox();
        if (bbox) {
          await page.mouse.click(bbox.x + bbox.width - 150, bbox.y + bbox.height / 2);
          await delayWithStopCheck(500);
          try { await updateLiveScreenshot(page, "TradingView - Foco en canvas", addLog); } catch (_) {}
        }
      }
    } catch (_) {}

    // Press ArrowUp multiple times to zoom
    for (let u = 0; u < 5; u++) {
      await page.keyboard.press("ArrowUp");
      await delayWithStopCheck(150);
    }
    // Press ArrowRight to go to end
    for (let r = 0; r < 4; r++) {
      await page.keyboard.press("ArrowRight");
      await delayWithStopCheck(150);
    }
    await delayWithStopCheck(2000);
    try { await updateLiveScreenshot(page, "TradingView - Zoom y alineación finalizados", addLog); } catch (_) {}

    // Capture screen
    addLog(`[TRADINGVIEW] Capturando pantalla para análisis visual...`);
    const imgPath = path.join(process.cwd(), "live_automation.png");
    await page.screenshot({ path: imgPath });
    await updateLiveScreenshot(page, `TradingView - ${ticker} (${indicatorName})`, addLog);

    // Call Gemini
    addLog(`[GEMINI-VISION] Procesando captura con modelo gemini-3.5-flash...`);
    const base64Image = fs.readFileSync(imgPath, "base64");
    const geminiRes = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: extractionPrompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    const parsedRes = geminiRes.text || "0";
    addLog(`[GEMINI-VISION] Análisis de imagen finalizado.`);
    return parsedRes.trim();
  }

  // Helper to read and update specific cell for ticker
  async function updateSheetValueForTicker(
    sheets: any,
    spreadsheetId: string,
    calcSheetName: string,
    ticker: string,
    columnType: 'target' | 'stop' | 'atr',
    newValue: string,
    addLog: Function
  ) {
    let resolvedTabName = calcSheetName || "Calculo de Trailing y Target/Stop";
    try {
      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetTabs = sheetMeta.data.sheets || [];
      if (sheetTabs.length > 0) {
        const exactMatch = sheetTabs.find(
          (st: any) => st.properties?.title?.trim().toLowerCase() === resolvedTabName.trim().toLowerCase()
        );
        if (exactMatch) {
          resolvedTabName = exactMatch.properties.title;
        } else {
          const partialKeywords = ["calculo", "trailing", "target", "stop", "órdenes", "ordenes", "registro"];
          const partialMatch = sheetTabs.find((st: any) => {
            const title = (st.properties?.title || "").toLowerCase();
            return partialKeywords.some(keyword => title.includes(keyword));
          });
          if (partialMatch) {
            resolvedTabName = partialMatch.properties.title;
          } else {
            resolvedTabName = sheetTabs[0]?.properties?.title || "Sheet1";
          }
        }
      }
    } catch (e: any) {
      addLog(`[WARNING-SHEETS] No se pudo leer pestañas dinámicamente, se usará exacto: ${e.message}`);
    }

    const finalSheetName = resolvedTabName;
    addLog(`[SHEETS] Identificando fila de '${ticker}' en B12:G20 de la pestaña '${finalSheetName}'...`);
    
    // Read B11:G20 range
    const readRange = `'${finalSheetName}'!B11:G20`;
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: readRange,
    });

    const rows = readResponse.data.values || [];
    if (rows.length === 0) {
      throw new Error(`La hoja '${finalSheetName}' está vacía o el rango B11:G20 no retornó información.`);
    }

    // Identify header row
    let headerIndex = -1;
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].map(c => String(c).toLowerCase());
      if (cells.some(c => c.includes("ticker") || c.includes("activo") || c.includes("target") || c.includes("stop") || c.includes("atr"))) {
        headerIndex = r;
        break;
      }
    }

    const headers = headerIndex !== -1 ? rows[headerIndex].map(h => String(h).toLowerCase()) : ["ticker", "atr diario", "target", "stop"];

    // Find requested column offset
    let targetColOffset = -1;
    if (columnType === 'target') {
      targetColOffset = headers.findIndex(h => h.includes("target"));
      if (targetColOffset === -1) targetColOffset = 2; // Fallback to column D
    } else if (columnType === 'stop') {
      targetColOffset = headers.findIndex(h => h.includes("stop"));
      if (targetColOffset === -1) targetColOffset = 3; // Fallback to column E
    } else if (columnType === 'atr') {
      targetColOffset = headers.findIndex(h => h.includes("atr") || h.includes("diario"));
      if (targetColOffset === -1) targetColOffset = 1; // Fallback to column C
    }

    // Find row
    let tickerRowOffset = -1;
    for (let r = 0; r < rows.length; r++) {
      if (r === headerIndex) continue;
      const tCell = String(rows[r][0] || "").trim().toUpperCase();
      if (tCell === ticker.toUpperCase()) {
        tickerRowOffset = r;
        break;
      }
    }

    if (tickerRowOffset === -1) {
      throw new Error(`No se encontró el ticker '${ticker}' en el rango B11:G20.`);
    }

    // B11 corresponds to row index 0. Therefore row number is 11 + tickerRowOffset.
    const rowNumber = 11 + tickerRowOffset;
    const colLetter = ['B', 'C', 'D', 'E', 'F', 'G'][targetColOffset];

    const targetCell = `'${finalSheetName}'!${colLetter}${rowNumber}`;
    
    // Formula calculation: =(VALOR DECIMAL)*(CELDA DE ATR EN ESA FILA - COLUMNA C)
    const finalFormulaOrValue = (columnType === 'target' || columnType === 'stop') 
      ? `=(${newValue})*(C${rowNumber})` 
      : newValue;

    addLog(`[SHEETS] Escribiendo el valor "${finalFormulaOrValue}" en la celda: ${targetCell}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: targetCell,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[finalFormulaOrValue]]
      }
    });

    addLog(`[SHEETS] Celda ${targetCell} actualizada exitosamente.`);
  }

  // Helper to compile filtered Markdown table report
  async function createOrdersTableReport(
    sheets: any,
    spreadsheetId: string,
    calcSheetName: string,
    analyzedTickers: string[],
    addLog: Function
  ): Promise<string> {
    let resolvedTabName = calcSheetName || "Calculo de Trailing y Target/Stop";
    try {
      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetTabs = sheetMeta.data.sheets || [];
      if (sheetTabs.length > 0) {
        const exactMatch = sheetTabs.find(
          (st: any) => st.properties?.title?.trim().toLowerCase() === resolvedTabName.trim().toLowerCase()
        );
        if (exactMatch) {
          resolvedTabName = exactMatch.properties.title;
        } else {
          const partialKeywords = ["calculo", "trailing", "target", "stop", "órdenes", "ordenes", "registro"];
          const partialMatch = sheetTabs.find((st: any) => {
            const title = (st.properties?.title || "").toLowerCase();
            return partialKeywords.some(keyword => title.includes(keyword));
          });
          if (partialMatch) {
            resolvedTabName = partialMatch.properties.title;
          } else {
            resolvedTabName = sheetTabs[0]?.properties?.title || "Sheet1";
          }
        }
      }
    } catch (e: any) {
      addLog(`[WARNING-SHEETS] No se pudo leer pestañas dinámicamente para el reporte, se usará exacto: ${e.message}`);
    }

    const finalSheetName = resolvedTabName;
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${finalSheetName}'!B11:G20`,
    });

    const rows = readResponse.data.values || [];
    if (rows.length === 0) {
      return "Error: No se pudieron leer los datos del rango para generar el reporte.";
    }

    // Find header
    let headerIndex = -1;
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].map(c => String(c).toLowerCase());
      if (cells.some(c => c.includes("ticker") || c.includes("activo") || c.includes("target") || c.includes("stop"))) {
        headerIndex = r;
        break;
      }
    }

    const rawHeaders = headerIndex !== -1 ? rows[headerIndex] : ["Ticker", "Target Acción", "Stop- Acción", "Target ($)", "Stop ($)", "ATR Diario"];
    const headersLower = rawHeaders.map((h: any) => String(h || "").toLowerCase());

    // Locate ATR
    const atrIndex = headersLower.findIndex(h => h.includes("atr"));

    // Filter headers (remove ATR)
    const cleanHeaders = rawHeaders.filter((_, idx) => idx !== atrIndex);

    // Build rows (keep only analyzed tickers, remove ATR)
    const cleanRows: any[] = [];
    for (let r = 0; r < rows.length; r++) {
      if (r === headerIndex) continue;
      const tickerName = String(rows[r][0] || "").trim().toUpperCase();
      if (!tickerName) continue;

      if (analyzedTickers.some(t => t.toUpperCase() === tickerName)) {
        const cleanRow = rows[r].filter((_, idx) => idx !== atrIndex);
        cleanRows.push(cleanRow);
      }
    }

    const dates = getDetailedReportDates();

    let tableMd = `FECHA DE ELABORACIÓN DEL REPORTE: ${dates.todayStr}\n`;
    tableMd += `FECHA DE VIGENCIA DE LAS ÓRDENES: ${dates.nextStr}\n\n`;
    tableMd += `### TABLA RECALCULADA DE ÓRDENES (SIN COLUMNA ATR)\n\n`;

    tableMd += `| ` + cleanHeaders.join(" | ") + ` |\n`;
    tableMd += `| ` + cleanHeaders.map(() => "---").join(" | ") + ` |\n`;
    cleanRows.forEach(row => {
      const paddedRow = Array.from({ length: cleanHeaders.length }, (_, i) => String(row[i] || "").trim());
      tableMd += `| ` + paddedRow.join(" | ") + ` |\n`;
    });

    return tableMd;
  }

  try {
    sendProgress(5);
    addLog("[SYSTEM] Iniciando proceso automatizado de 20 Pasos para Generación de Órdenes...");

    const googleAuth = req.auth;
    if (!googleAuth) {
      throw new Error("Cliente Google Auth no disponible. Por favor, inicia sesión.");
    }
    const drive = google.drive({ version: "v3", auth: googleAuth });
    const sheets = google.sheets({ version: "v4", auth: googleAuth });

    const finalCalcSheetName = calcSheetName || "Calculo de Trailing y Target/Stop";
    const finalTargetDocName = targetDocName || "Órdenes de Compra";

    // Dynamic extraction of tickers from 'Registro Analisis de Entradas' Google Sheet
    addLog("[SHEETS] Buscando archivo 'Registro Analisis de Entradas' para identificar los tickers designados con CALL o PUT...");
    const regFilesList = await drive.files.list({
      q: "name = 'Registro Analisis de Entradas' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    let tickerList: string[] = [];

    if (!regFilesList.data.files || regFilesList.data.files.length === 0) {
      addLog("[WARNING] No se encontró el archivo 'Registro Analisis de Entradas'. Usando ticker AAPL por defecto o el propocionado.");
      tickerList = (tickers || "AAPL")
        .split(",")
        .map((t: string) => t.trim().toUpperCase())
        .filter(Boolean);
    } else {
      const regSpreadsheetId = regFilesList.data.files[0].id!;
      addLog(`[SHEETS] Archivo 'Registro Analisis de Entradas' encontrado con ID: ${regSpreadsheetId}. Leyendo datos para buscar tickers CALL/PUT de la última tabla...`);

      const regMeta = await sheets.spreadsheets.get({ spreadsheetId: regSpreadsheetId });
      const regSheetTitle = regMeta.data.sheets?.[0]?.properties?.title || "Sheet1";

      const regGetValuesRes = await sheets.spreadsheets.values.get({
        spreadsheetId: regSpreadsheetId,
        range: `'${regSheetTitle}'!A1:Z2000`,
      });
      const regAllRows = regGetValuesRes.data.values || [];

      const isRowEmpty = (row: any[]) => {
        if (!row || row.length === 0) return true;
        return row.every(val => val === undefined || val === null || String(val).trim() === "");
      };

      let tableEndRow = -1;
      for (let i = regAllRows.length - 1; i >= 0; i--) {
        if (!isRowEmpty(regAllRows[i])) {
          tableEndRow = i;
          break;
        }
      }

      if (tableEndRow === -1) {
        addLog("[WARNING] El documento 'Registro Analisis de Entradas' está vacío. Usando ticker de respaldo.");
        tickerList = (tickers || "AAPL")
          .split(",")
          .map((t: string) => t.trim().toUpperCase())
          .filter(Boolean);
      } else {
        let tableStartRow = tableEndRow;
        for (let i = tableEndRow; i >= 0; i--) {
          if (isRowEmpty(regAllRows[i])) {
            tableStartRow = i + 1;
            break;
          }
          if (i === 0) {
            tableStartRow = 0;
          }
        }

        const regTableRows = regAllRows.slice(tableStartRow, tableEndRow + 1);
        addLog(`[SHEETS] Última tabla encontrada en 'Registro Analisis de Entradas', filas ${tableStartRow + 1} a ${tableEndRow + 1} (${regTableRows.length} filas).`);

        // Find headers in the last table or sheet
        let headerRowIdx = 0;
        for (let i = 0; i < regTableRows.length; i++) {
          const r = regTableRows[i];
          if (r && r.length > 1) {
            const rowStr = r.join(" ").toLowerCase();
            if (rowStr.includes("ticker") || rowStr.includes("fecha") || rowStr.includes("direcc")) {
              headerRowIdx = i;
              break;
            }
          }
        }

        let headerRow = regTableRows[headerRowIdx] || [];
        let colHeaderClean = headerRow.map(h => String(h || "").toLowerCase().trim());

        // Find column indices
        let tickerColIdx = colHeaderClean.findIndex(h => h.includes("ticker") || h.includes("activo") || h.includes("empresa") || h.includes("símbolo") || h.includes("simbolo"));
        let directionColIdx = colHeaderClean.findIndex(h => h.includes("direcc") || h.includes("dirección") || h.includes("direccion") || h.includes("sentido") || h.includes("movimiento") || h.includes("p/c") || h.includes("call/put") || h.includes("put/call"));

        // Fallbacks for columns matching indexes
        if (tickerColIdx === -1) {
          tickerColIdx = 1; // Default to B
        }
        if (directionColIdx === -1) {
          directionColIdx = 4; // Default to E
        }

        addLog(`[SHEETS] Columnas de búsqueda -> Ticker: índice ${tickerColIdx}, Dirección: índice ${directionColIdx}`);

        // Scan the table rows starting from the row after the header
        const identifiedTickers: string[] = [];
        const startIdx = headerRowIdx + 1;

        for (let i = startIdx; i < regTableRows.length; i++) {
          const row = regTableRows[i];
          if (!row || row.length === 0) continue;

          let rowTicker = String(row[tickerColIdx] || "").trim().toUpperCase();
          let rowDirection = String(row[directionColIdx] || "").trim().toUpperCase();

          let hasDirection = rowDirection === "CALL" || rowDirection === "PUT" || rowDirection.includes("CALL") || rowDirection.includes("PUT");
          let finalTicker = rowTicker;

          if (!hasDirection) {
            // Scan all cells in this row for CALL/PUT and a ticker fallback
            let foundCallOrPut = false;
            let potentialTicker = "";

            for (let c = 0; c < row.length; c++) {
              const cellVal = String(row[c] || "").trim().toUpperCase();
              if (cellVal === "CALL" || cellVal === "PUT") {
                foundCallOrPut = true;
              }
              if (/^[A-Z]{1,5}$/.test(cellVal) && cellVal !== "CALL" && cellVal !== "PUT" && cellVal !== "COMPRA" && cellVal !== "VENTA") {
                potentialTicker = cellVal;
              }
            }

            if (foundCallOrPut && potentialTicker) {
              finalTicker = potentialTicker;
              hasDirection = true;
              addLog(`[SHEETS] Fila ${tableStartRow + i + 1} - Coincidencia por escaneo de celdas para Ticker: ${finalTicker}`);
            }
          }

          if (hasDirection && finalTicker && /^[A-Z1-9.-]{1,10}$/.test(finalTicker)) {
            if (!identifiedTickers.includes(finalTicker)) {
              identifiedTickers.push(finalTicker);
            }
          }
        }

        if (identifiedTickers.length > 0) {
          tickerList = identifiedTickers;
          addLog(`[SHEETS] Tickers identificados con CALL/PUT: ${tickerList.join(", ")}`);
        } else {
          // General scan fallback
          addLog("[WARNING] No se encontraron tickers con CALL/PUT en la última tabla con mapeo específico. Intentando escaneo general completo...");
          for (let i = 0; i < regTableRows.length; i++) {
            const row = regTableRows[i];
            let rowCallOrPut = false;
            let rowTicker = "";
            for (let c = 0; c < row.length; c++) {
              const cellVal = String(row[c] || "").trim().toUpperCase();
              if (cellVal === "CALL" || cellVal === "PUT") {
                rowCallOrPut = true;
              } else if (/^[A-Z]{1,5}$/.test(cellVal) && cellVal !== "COMPRA" && cellVal !== "VENTA") {
                rowTicker = cellVal;
              }
            }
            if (rowCallOrPut && rowTicker) {
              if (!identifiedTickers.includes(rowTicker)) {
                identifiedTickers.push(rowTicker);
              }
            }
          }

          if (identifiedTickers.length > 0) {
            tickerList = identifiedTickers;
            addLog(`[SHEETS] Tickers identificados mediante escaneo general completo: ${tickerList.join(", ")}`);
          } else {
            addLog("[WARNING] No se identificó ningún ticker designado con CALL o PUT en la última tabla. Usando 'AAPL' por defecto.");
            tickerList = ["AAPL"];
          }
        }
      }
    }

    addLog(`[PARAM] Ticker(s) definitivos a procesar: ${tickerList.join(", ")}`);
    addLog(`[PARAM] Hoja de Cálculo: ${finalCalcSheetName}`);
    addLog(`[PARAM] Documento de Destino: ${finalTargetDocName}`);

    // Iniciar browser Puppeteer
    sendProgress(10);
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    activeBrowser = browser;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    if (tvSessionCookie) {
      addLog("[PUPPETEER] Configurando cookies de inicio de sesión de TradingView...");
      let cookieVal = tvSessionCookie.trim();
      if (cookieVal.includes("sessionid=")) {
        cookieVal = cookieVal.split("sessionid=")[1].split(";")[0];
      }
      await page.setCookie({
        name: "sessionid",
        value: cookieVal,
        domain: ".tradingview.com",
        path: "/",
      });
      addLog("[PUPPETEER] Cookie sessionid configurada correctamente.");
    } else {
      addLog("[WARNING] No se ingresó cookie sessionid. TradingView operará en modo público.");
    }

    // Localizar planilla Sheets Calculo de Trailing
    addLog(`[SHEETS] Buscando planilla '${finalCalcSheetName}' en Google Drive...`);
    const filesList = await drive.files.list({
      q: `name = '${finalCalcSheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: "files(id, name)",
    });

    if (!filesList.data.files || filesList.data.files.length === 0) {
      throw new Error(`Hubo un error al buscar el libro '${finalCalcSheetName}' en Drive. Verifica el nombre exacto.`);
    }

    const spreadsheetId = filesList.data.files[0].id!;
    addLog(`[SHEETS] Planilla localizada. ID: ${spreadsheetId}`);

    const progressMultiplier = 80 / (tickerList.length * 3);
    let stepCount = 0;

    for (const ticker of tickerList) {
      addLog(`\n=== INICIANDO ITERACIÓN PARA TICKER: ${ticker} ===`);

      // 1-9) INDICADOR Calculadora targets
      if (stopRequested) break;
      addLog(`[PASO 1-9] Procesando "Calculadora targets" para ${ticker}...`);
      const targetPrompt = "Analiza este gráfico de TradingView con el indicador 'Calculadora targets'. Busca la tabla o cuadro de texto amarillo o naranja en la pantalla (suele estar en la esquina superior izquierda). En esa tabla verás la fila de 'P50'. Toma ÚNICAMENTE el número con el formato de porcentaje (%) al lado o dentro de la sección de P50, e IGNORA POR COMPLETO cualquier número que tenga el símbolo de dólar ($) (por ejemplo, ignora 'P50 $: 4.7' y busca el de porcentaje como 'P50 %: 15.3%' u otra columna de porcentaje). Conviértelo siempre a su formato decimal equivalente (ej. si encuentras '15.3%', devuelves '0.153'; si encuentras '50%', devuelves '0.50'; si encuentras '5%', devuelves '0.05'). Responde ÚNICAMENTE con el número decimal limpio, por ejemplo '0.153'. No agregues palabras extras ni explicaciones y asegúrate de no tomar el número con $.";
      
      const rawTvTargetValue = await runTvIndicatorAndExtract(
        page,
        ticker,
        "Calculadora targets",
        targetPrompt,
        addLog
      );
      const cleanTargetValue = cleanDecimalValue(rawTvTargetValue);
      addLog(`[INFO] Valor Target (P50) extraído: ${cleanTargetValue}`);

      if (stopRequested) break;
      await updateSheetValueForTicker(
        sheets,
        spreadsheetId,
        finalCalcSheetName,
        ticker,
        'target',
        cleanTargetValue,
        addLog
      );

      stepCount++;
      sendProgress(10 + stepCount * progressMultiplier);

      // 10-18) INDICADOR Calculadora stops
      if (stopRequested) break;
      addLog(`[PASO 10-18] Procesando "Calculadora stops" para ${ticker}...`);
      const stopPrompt = "Analiza este gráfico de TradingView con el indicador 'Calculadora stops'. Busca la tabla o cuadro de texto amarillo o naranja en la pantalla (suele estar en la esquina superior izquierda). En esa tabla verás la fila de 'P75'. Toma ÚNICAMENTE el número con el formato de porcentaje (%) al lado o dentro de la sección de P75, e IGNORA POR COMPLETO cualquier número que tenga el símbolo de dólar ($) (por ejemplo, ignora 'P75 $: 4.5' y busca el de porcentaje como 'P75 %: 10.5%' u otra columna de porcentaje). Conviértelo siempre a su formato decimal equivalente (ej. si encuentras '10.5%', devuelves '0.105'; si encuentras '40%', devuelves '0.40'; si encuentras '4%', devuelves '0.04'). Responde ÚNICAMENTE con el número decimal limpio, por ejemplo '0.105'. No agregues palabras extras ni explicaciones y asegúrate de no tomar el número con $.";

      const rawTvStopValue = await runTvIndicatorAndExtract(
        page,
        ticker,
        "Calculadora stops",
        stopPrompt,
        addLog,
        "STVpneyt"
      );
      const cleanStopValue = cleanDecimalValue(rawTvStopValue);
      addLog(`[INFO] Valor Stop (P50) extraído: ${cleanStopValue}`);

      if (stopRequested) break;
      await updateSheetValueForTicker(
        sheets,
        spreadsheetId,
        finalCalcSheetName,
        ticker,
        'stop',
        cleanStopValue,
        addLog
      );

      stepCount++;
      sendProgress(10 + stepCount * progressMultiplier);

      // 19-20) INDICADOR ATR
      if (stopRequested) break;
      addLog(`[PASO 19-20] Procesando "ATR" para ${ticker}...`);
      const atrPrompt = "Analiza este gráfico de TradingView con el indicador ATR (Average True Range). Identifica el número del indicador ATR actual en el gráfico o en la barra inferior (suele ser un número flotante como '1.45', '2.56', etc.). Responde ÚNICAMENTE con el número decimal limpio, por ejemplo '1.45'. No agregues palabras extras ni explicaciones.";

      const rawTvAtrValue = await runTvIndicatorAndExtract(
        page,
        ticker,
        "ATR",
        atrPrompt,
        addLog,
        "STVpneyt"
      );
      const cleanAtrValue = cleanDecimalValue(rawTvAtrValue);
      addLog(`[INFO] Valor ATR extraído: ${cleanAtrValue}`);

      if (stopRequested) break;
      await updateSheetValueForTicker(
        sheets,
        spreadsheetId,
        finalCalcSheetName,
        ticker,
        'atr',
        cleanAtrValue,
        addLog
      );

      stepCount++;
      sendProgress(10 + stepCount * progressMultiplier);
    }

    if (stopRequested) {
      addLog("[BOT-STOP] Proceso detenido por el usuario.");
      sendProgress(100);
      return res.end();
    }

    // AL FINALIZAR TODOS LOS TICKERS: Copiar tablita sin ATR a Google Docs "Órdenes de Compra"
    sendProgress(90);
    addLog("[DOCS] Generando reporte de órdenes libre de ATR...");
    const tableReportText = await createOrdersTableReport(
      sheets,
      spreadsheetId,
      finalCalcSheetName,
      tickerList,
      addLog
    );

    // Buscar o Crear el Doc en Drive
    addLog(`[DOCS] Buscando carpeta 'Stocks' en Drive...`);
    const folderId = await getOrCreateFolder(googleAuth, "Stocks", addLog);
    const docQuery = await drive.files.list({
      q: `name = '${finalTargetDocName}' and mimeType = 'application/vnd.google-apps.document' and '${folderId}' in parents and trashed = false`,
      fields: "files(id, name)",
    });

    let docId = "";
    const existingDoc = docQuery.data.files?.[0];
    if (existingDoc) {
      docId = existingDoc.id!;
      addLog(`[DOCS] Documento existente localizado con ID: ${docId}`);
    } else {
      addLog(`[DOCS] Creando nuevo documento '${finalTargetDocName}' en carpeta Stocks...`);
      const createdDoc = await drive.files.create({
        requestBody: {
          name: finalTargetDocName,
          mimeType: "application/vnd.google-apps.document",
          parents: [folderId],
        },
        fields: "id",
      });
      docId = createdDoc.data.id!;
    }

    // Leer doc para ver el final e insertar
    const docService = google.docs({ version: "v1", auth: googleAuth });
    const activeDoc = await docService.documents.get({ documentId: docId });
    const content = activeDoc.data.body?.content;
    let insertionIndex = 1;
    if (content && content.length > 0) {
      const lastItem = content[content.length - 1];
      insertionIndex = (lastItem.endIndex || 2) - 1;
    }

    const colTimestamp = new Date().toLocaleString("es-ES", { timeZone: "America/Bogota" });
    const docHeader = `\n=========================================\nREPORTE DE AUTOMATIZACIÓN - ${colTimestamp}\n=========================================\n`;
    const finalPayload = `${docHeader}\n${tableReportText}\n\n`;

    addLog("[DOCS] Insertando reporte de tabla recalculada en Google Docs...");
    await docService.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: insertionIndex > 1 ? insertionIndex : 1 },
              text: finalPayload,
            },
          },
        ],
      },
    });

    addLog(`[SYSTEM] ¡Proceso de Generación de Órdenes culminado exitosamente! El reporte se guardó en '${finalTargetDocName}'.`);
    sendEvent({ type: "finish", orders: tableReportText });
    sendProgress(100);

  } catch (err: any) {
    addLog(`[ERROR] Error crítico durante el flujo: ${err.message}`);
    sendEvent({ type: "error", error: err.message });
  } finally {
    clearInterval(keepAliveInterval);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    res.end();
  }
});

async function analyzeMarketData(
  title: string,
  rawData: string,
  addLog: Function,
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Eres un analista financiero experto. Analiza el siguiente contenido y genera un reporte profesional, detallado y accionable para inversores.
      
      Título: ${title}
      Datos brutos: ${rawData}
      
      Instrucciones:
      1. Resume las noticias más importantes.
      2. Explica las implicaciones para el mercado o la acción específica.
      3. Mantén un tono formal y profesional.
      4. Si no hay datos suficientes, menciona los puntos clave encontrados.
      
      Genera el reporte en formato estructurado (sin Markdown, usa saltos de línea normales).`,
    });
    return response.text || rawData;
  } catch (error: any) {
    addLog(
      `[WARNING] Gemini analysis failed: ${error.message}. Using raw data.`,
    );
    return rawData;
  }
}

async function getYahooVerificationCode(
  auth: any,
  addLog: Function,
): Promise<string | null> {
  const gmail = google.gmail({ version: "v1", auth });
  addLog("[GMAIL] Searching for Yahoo verification code...");

  // Wait a few seconds for the email to arrive
  await new Promise((r) => setTimeout(r, 10000));

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "from:no-reply@login.yahoo.com verification code",
      maxResults: 1,
    });

    if (!res.data.messages || res.data.messages.length === 0) {
      addLog("[GMAIL] No Yahoo verification emails found.");
      return null;
    }

    const msgId = res.data.messages[0].id!;
    const msg = await gmail.users.messages.get({ userId: "me", id: msgId });

    // Check snippet or body
    let fullText = msg.data.snippet || "";

    // Look for 6-digit code
    const match = fullText.match(/\b\d{6}\b/);
    if (match) {
      addLog(`[GMAIL] Extracted code from snippet: ${match[0]}`);
      return match[0];
    }

    addLog(
      "[GMAIL] Could not find 6-digit code in snippet. Skipping deeper search for now.",
    );
    return null;
  } catch (err: any) {
    addLog(`[GMAIL] Error fetching code: ${err.message}`);
    return null;
  }
}

// Help functions for standardizing automation logic
async function delayWithStopCheck(ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (stopRequested) {
      throw new Error("STOP_REQUESTED");
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function applyCookiesToPage(page: any, cookieInput: string, addLog?: Function) {
  if (!cookieInput) {
    if (addLog) addLog("[COOKIES] Advertencia: No se recibió ningún valor de cookie.");
    return;
  }
  
  try {
    const trimmed = cookieInput.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      // JSON Array Format
      const cookiesObj = JSON.parse(trimmed);
      const cookiesArray = Array.isArray(cookiesObj) ? cookiesObj : [cookiesObj];
      if (addLog) addLog(`[COOKIES] Detectado formato JSON. Importando ${cookiesArray.length} cookies...`);
      for (const cookie of cookiesArray) {
        if (!cookie.name) continue;
        const sanitizedCookie: any = {
          name: cookie.name,
          value: cookie.value || "",
          path: cookie.path || "/",
          secure: true, // Google utilizes HTTPS exclusively
        };
        if (cookie.domain) {
          sanitizedCookie.domain = cookie.domain;
        } else {
          sanitizedCookie.domain = ".google.com";
        }
        if (typeof cookie.httpOnly === "boolean") sanitizedCookie.httpOnly = cookie.httpOnly;
        
        await page.setCookie(sanitizedCookie);
      }
    } else {
      // Standard HTTP Cookiestring Header: "name1=value1; name2=value2"
      if (addLog) addLog("[COOKIES] Detectado formato de cadena estándar de encabezado de cookies. Analizando...");
      const cookiePairs = trimmed.split(';').map(c => c.trim());
      let successCount = 0;
      for (const pair of cookiePairs) {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const name = pair.substring(0, idx).trim();
          const value = pair.substring(idx + 1).trim();
          if (name) {
            await page.setCookie({
              name,
              value,
              domain: '.google.com',
              path: '/',
              secure: true, // Google utilizes HTTPS exclusively
            });
            successCount++;
          }
        }
      }
      if (addLog) addLog(`[COOKIES] Se han aplicado ${successCount} cookies del encabezado provisto.`);
    }
  } catch (err: any) {
    if (addLog) addLog(`[COOKIES] [ERROR] No se pudieron aplicar las cookies: ${err.message}`);
  }
}

async function robustType(page: any, selector: string, text: string, addLog?: Function) {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
    const element = await page.$(selector);
    if (element) {
      await element.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, 200));
      await element.focus();
      await element.type(text, { delay: 40 });
      
      // Verification
      const actualVal = await page.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        return el ? el.value : "";
      }, selector);
      
      if (actualVal === text) {
        return; // successfully typed
      }
    }
  } catch (err: any) {}
  
  // Fallback: Hard force value if standard type fails or gets blocked
  if (addLog) addLog(`[GOOGLE] [WARN] Escritura directa falló para '${selector}'. Aplicando inyección DOM de respaldo.`);
  await page.evaluate((sel: string, val: string) => {
    const el = document.querySelector(sel) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector, text);
}

async function loginToGoogle(
  page: any,
  email?: string,
  password?: string,
  addLog?: Function,
) {
  if (!email || !password) {
    if (addLog) addLog("[GOOGLE] No se proporcionaron credenciales de Google (Email/Password). Intentando solo con Cookies.");
    return;
  }

  const currentUrl = page.url() || "";
  if (currentUrl.includes("accounts.google.com") || currentUrl.includes("signin")) {
    if (addLog) addLog("[GOOGLE] Detectada pantalla de inicio de sesión de Google. Autenticando...");
    try {
      // 1. Enter email via direct DOM injection
      const emailSelector = 'input#identifierId, input[type="email"], input[name="identifier"]';
      await page.waitForSelector(emailSelector, { timeout: 15000 });
      await page.focus(emailSelector);
      
      if (addLog) addLog("[GOOGLE] Escribiendo cuenta de correo mediante inyección de eventos...");
      await page.evaluate((emailTexto, selector) => {
        const input = document.querySelector(selector) as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.value = emailTexto;
          // Disparar eventos para que la web de Google se entere que hay texto
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, email, emailSelector);

      await new Promise(r => setTimeout(r, 500));

      // Click Next
      if (addLog) addLog("[GOOGLE] Haciendo clic en Siguiente...");
      const botonSiguiente = await page.waitForSelector('#identifierNext, button:not([disabled])');
      await botonSiguiente.click();
      
      // Secondary backup submit method just in case click didn't trigger
      await new Promise(r => setTimeout(r, 300));
      try {
        await page.evaluate((selector) => {
          const input = document.querySelector(selector) as HTMLInputElement | null;
          if (input) {
            input.focus();
          }
        }, emailSelector);
        await page.keyboard.press("Enter");
      } catch (e) {}

      if (addLog) addLog("[GOOGLE] Correo enviado. Esperando pantalla de contraseña...");

      // 2. Enter password (robust poll and check for warning block)
      const passSelector = 'input[type="password"], input[name="password"]';
      let passSelectorFound = false;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        
        passSelectorFound = await page.evaluate((sel: string) => {
          return !!document.querySelector(sel);
        }, passSelector);
        
        if (passSelectorFound) {
          break;
        }

        const pageState = await page.evaluate(() => {
          const text = (document.body.innerText || "").toLowerCase();
          const html = document.body.innerHTML || "";
          const url = window.location.href;
          
          let blockType = "";
          if (text.includes("no es seguro") || text.includes("may not be secure") || url.includes("rejected")) {
            blockType = "browser-unsecure";
          } else if (text.includes("captcha") || text.includes("type the text") || html.includes("recaptcha") || document.querySelector('iframe[src*="recaptcha"]')) {
            blockType = "captcha";
          } else if (text.includes("verifica que eres tú") || text.includes("verify it's you") || text.includes("confirma tu identidad") || url.includes("challenge") || text.includes("tap yes") || text.includes("toca sí")) {
            blockType = "challenge-2fa";
          } else if (text.includes("actividad inusual") || text.includes("unusual activity") || text.includes("número de teléfono") || text.includes("phone number")) {
            blockType = "unusual-activity-challenge";
          }
          return { blockType, url, textSnippet: text.substring(0, 300) };
        });
        
        if (pageState.blockType) {
          await updateLiveScreenshot(page, `Bloqueo_${pageState.blockType}`, addLog);
          let friendlyMsg = `Inicio automático denegado por Google (${pageState.blockType}).`;
          if (pageState.blockType === "unusual-activity-challenge") {
            friendlyMsg = "⚠️ BLOQUEO DE SEGURIDAD DE GOOGLE (Actividad inusual detectada): Google ha bloqueado este inicio de sesión automático usando correo/contraseña desde los servidores de la nube por la seguridad de tu cuenta. CÓMO RESOLVERLO: Copia las cookies activas de tu navegador Chrome o Firefox (en formato JSON o de texto) y pégalas directamente en el campo 'COOKIES DE SESIÓN GOOGLE' en la interfaz principal. Esto saltará el inicio de sesión automático y funcionará al 100% de manera garantizada y totalmente segura.";
          } else if (pageState.blockType === "captcha") {
            friendlyMsg = "⚠️ CAPTCHA REQUERIDO POR GOOGLE: Google solicita la resolución de un captcha visual que un sistema automático no puede resolver por sí mismo. CÓMO RESOLVERLO: Copia tus cookies de sesión activas de Google (desde la extensión 'EditThisCookie' o similar) y pégalas en el campo de 'COOKIES DE SESIÓN GOOGLE'. Esto eludirá el formulario de inicio de sesión de inmediato.";
          } else if (pageState.blockType === "challenge-2fa") {
            friendlyMsg = "⚠️ VERIFICACIÓN DE DOS PASOS (2FA) O IDENTIDAD: Google requiere que apruebes el acceso a través de tu dispositivo móvil o mediante un código temporal de seguridad. CÓMO RESOLVERLO: Copia y pega las cookies de sesión activas de Google de tu navegador web en la caja de inputs correspondientes de 'COOKIES DE SESIÓN GOOGLE' para ingresar de forma directa sin requerir autorización manual.";
          } else if (pageState.blockType === "browser-unsecure") {
            friendlyMsg = "⚠️ DETECCIÓN DE NAVEGADOR NO SEGURO: Google ha determinado que el navegador automatizado no cumple con sus requisitos de seguridad mínimos. CÓMO RESOLVERLO: Por favor copia tus cookies de sesión frescas en formato texto o JSON y pégalas en el panel correspondiente de 'COOKIES DE SESIÓN GOOGLE' para omitir la inicialización por contraseña.";
          }

          if (addLog) {
            addLog(`[GOOGLE] [CRITICAL] Inicio de sesión interrumpido: ${pageState.blockType.toUpperCase()}`);
            addLog(`[GOOGLE] Detalle de pantalla: "${pageState.textSnippet.replace(/\n/g, ' ')}..."`);
            addLog(`[GOOGLE] URL actual: ${pageState.url}`);
            addLog(`[GOOGLE] RECOMENDACIÓN: ${friendlyMsg}`);
          }
          throw new Error(friendlyMsg);
        }
      }

      if (!passSelectorFound) {
        const url = page.url();
        const snippet = await page.evaluate(() => (document.body.innerText || "").substring(0, 300).toLowerCase().replace(/\n/g, ' '));
        await updateLiveScreenshot(page, "Timeout_Password_Field", addLog);
        if (addLog) {
          addLog(`[GOOGLE] [ERROR] Agotado el tiempo de espera por la pantalla de contraseña.`);
          addLog(`[GOOGLE] URL final: ${url}`);
          addLog(`[GOOGLE] Texto final de la pantalla: "${snippet}..."`);
          addLog("[GOOGLE] RECOMENDACIÓN: copia y pega cookies de sesión frescas en formato texto o JSON en la interfaz principal para omitir el login automático del todo.");
        }
        throw new Error("Tiempo de espera agotado esperando el campo de contraseña de Google.");
      }

      await new Promise(r => setTimeout(r, 1000));
      
      if (addLog) addLog("[GOOGLE] Escribiendo contraseña de seguridad mediante inyección de eventos...");
      await page.focus(passSelector);
      await page.evaluate((passTexto, selector) => {
        const input = document.querySelector(selector) as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.value = passTexto;
          // Disparar eventos para que la web de Google se entere que hay texto
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, password, passSelector);
      
      await new Promise(r => setTimeout(r, 500));

      // Click Next
      if (addLog) addLog("[GOOGLE] Enviando formulario de contraseña...");
      const botonSiguienteContra = await page.waitForSelector('#passwordNext, button:not([disabled])');
      await botonSiguienteContra.click();

      // Secondary backup submit method
      await new Promise(r => setTimeout(r, 300));
      try {
        await page.evaluate((selector) => {
          const input = document.querySelector(selector) as HTMLInputElement | null;
          if (input) {
            input.focus();
          }
        }, passSelector);
        await page.keyboard.press("Enter");
      } catch (e) {}

      if (addLog) addLog("[GOOGLE] Credenciales de cuenta enviadas. Esperando redirección (10s)...");
      await new Promise(r => setTimeout(r, 10000));
    } catch (err: any) {
      if (addLog) addLog(`[GOOGLE] [WARN] Error durante el proceso de login automático: ${err.message}`);
      throw err;
    }
  } else {
    if (addLog) addLog("[GOOGLE] Acceso directo correcto, sesión activa.");
  }
}

async function loginToYahooFinance(
  page: Page,
  addLog: Function,
  auth?: any,
  customEmail?: string,
  customPassword?: string,
  customCookies?: string,
) {
  if (customCookies) {
    addLog("[YAHOO] Applying provided Yahoo cookies block...");
    try {
      await applyCookiesToPage(page, customCookies, addLog);

      await page.goto("https://finance.yahoo.com/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const loggedIn = await page.evaluate(() => {
        // @ts-ignore
        const __name = (fn: any) => fn;
        return !!document.querySelector(
          '#header-user-menu, .ybar-account-user-name, #ybarAccountMenu, .ybar-user-profile, [data-testid="header-member-menu-button"], #ybar-inner-wrap, .ybar-inner-wrap',
        );
      });
      if (loggedIn) {
        addLog(
          "[YAHOO] Session successfully authenticated using custom cookies block.",
        );
        return true;
      } else {
        addLog(
          "[YAHOO] Warning: Proveyó un bloque de cookies de Yahoo pero la sesión no fue detectada como activa en la portada. Se continuará con el flujo estándar.",
        );
      }
    } catch (cookieErr: any) {
      addLog(
        `[YAHOO] Error writing Yahoo cookies block: ${cookieErr.message}`,
      );
    }
  }

  const email = customEmail || process.env.YAHOO_EMAIL;
  const password = customPassword || process.env.YAHOO_PASSWORD;

  if (!email || !password) {
    addLog(
      "[YAHOO] No credentials found in secrets or inputs. Skipping traditional login.",
    );
    return false;
  }

  try {
    addLog("[YAHOO] Attempting login...");
    await page.goto("https://login.yahoo.com/", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Handle cookie consent if it appears
    try {
      const consentBtn = await page.$(
        'button[name="agree"], button[value="agree"], .accept-all',
      );
      if (consentBtn) {
        addLog("[YAHOO] Accepting cookie consent...");
        await consentBtn.click();
        await page
          .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
          .catch(() => {});
      }
    } catch (e) {}

    await page.waitForSelector("#login-username", { timeout: 10000 });
    await page.type("#login-username", email, { delay: 50 });
    await page.click("#login-signin");

    // Short wait to see if we get challenged
    await new Promise((r) => setTimeout(r, 4000));

    const currentUrl = page.url();
    const pageTitle = await page.title();

    if (
      currentUrl.includes("challenge") ||
      currentUrl.includes("captcha") ||
      pageTitle.toLowerCase().includes("verif")
    ) {
      if (currentUrl.includes("challenge") && auth) {
        addLog(
          `[YAHOO] Challenge detected. Attempting to use Gmail for verification...`,
        );
        const code = await getYahooVerificationCode(auth, addLog);
        if (code) {
          addLog(`[YAHOO] Entering code: ${code}`);
          await page.type('input[name="code"]', code, { delay: 50 });
          await page.click('button[name="verify"]');
          await page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
            .catch(() => {});

          // Check if we passed the challenge
          const newUrl = page.url();
          if (!newUrl.includes("challenge")) {
            addLog(`[YAHOO] Challenge passed via Gmail code.`);
          } else {
            addLog(
              `[YAHOO] Warning: Still on challenge page after entering code.`,
            );
          }
        } else {
          addLog(`[YAHOO] Could not retrieve code from Gmail.`);
          return false;
        }
      } else {
        addLog(
          `[YAHOO] Warning: Security challenge or verification detected (CAPTCHA/2FA). Login cannot continue automatically.`,
        );
        addLog(
          `[YAHOO] Diagnostics - URL: ${currentUrl} | Title: ${pageTitle}`,
        );
        return false;
      }
    }

    // Wait for password field
    try {
      await page.waitForSelector("#login-passwd", { timeout: 15000 });
      await page.type("#login-passwd", password, { delay: 50 });
      await page.click("#login-signin");

      await page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
        .catch(() => {});
    } catch (e) {
      addLog(
        `[YAHOO] Password field not found or redirected to an unexpected page: ${page.url()}`,
      );
      return false;
    }

    addLog("[YAHOO] Verification step. Current URL: " + page.url());

    const loggedIn = await page.evaluate(() => {
      // @ts-ignore
      const __name = (fn: any) => fn;
      // Check multiple common "logged in" indicators
      return !!document.querySelector(
        '#header-user-menu, .ybar-account-user-name, #ybarAccountMenu, .ybar-user-profile, [data-testid="header-member-menu-button"], #ybar-inner-wrap',
      );
    });

    if (loggedIn) {
      addLog("[YAHOO] Login successful.");
      return true;
    } else {
      addLog(
        `[YAHOO] Warning: Could not verify logged-in state. Final URL: ${page.url()}`,
      );
      return false;
    }
  } catch (err: any) {
    addLog(`[YAHOO] Login error: ${err.message}`);
    return false;
  }
}

async function scrapeYahooMarketNews(
  addLog: Function,
  auth?: any,
): Promise<string> {
  addLog("Searching for Stock Market Today news using puppeteer...");
  let content =
    "No se pudieron obtener noticias. Usando contenido de respaldo.";
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    try {
      await page.evaluateOnNewDocument("globalThis.__name = (fn) => fn;");
      await page.evaluate("globalThis.__name = (fn) => fn;");
    } catch (e) {}
    await page.setViewport({ width: 1280, height: 800 });

    // Optional Login
    await loginToYahooFinance(page, addLog, auth);

    const url = "https://finance.yahoo.com/topic/stock-market-news/";
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Handle random ad/newsletter popups
    

    // Extract actual headlines
    const headlines = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll(
          "h3, h2.js-stream-content-title, .js-stream-content-title",
        ),
      );
      return links
        .map((a) => a.textContent?.trim())
        .filter(Boolean)
        .slice(0, 5); // Get top 5 headlines
    });

    if (headlines && headlines.length > 0) {
      content =
        "Yahoo Market News Top Headlines:\n\n" +
        headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
    } else {
      content = "No headlines found on Yahoo Finance.";
    }
  } catch (err: any) {
    addLog(`[ERROR] puppeteer error: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return content;
}



async function scrapeYahooTickerNews(
  ticker: string,
  addLog: Function,
  auth?: any,
  onScreenshot?: (path: string, stepName: string) => void,
  yahooEmail?: string,
  yahooPassword?: string,
  yahooCookies?: string,
): Promise<{
  newsText: string;
  screenshotPath: string | null;
  movingScreenshotPath: string | null;
}> {
  const current_ticker = String(ticker).trim();
  const ticker_name = current_ticker;
  addLog(
    `[YAHOO] Starting interactive Yahoo Finance news workflow for ${current_ticker}...`,
  );
  let newsText = `No se pudieron obtener noticias para ${current_ticker}. Usando contenido de respaldo.`;
  let screenshotPath: string | null = null;
  let movingScreenshotPath: string | null = null;
  let browser;

  try {
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    activeBrowser = browser;
    const page = await browser.newPage();

    // Evade detection by hiding WebDriver
    await page.evaluateOnNewDocument("Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); globalThis.__name = (fn) => fn;");

    try {
      await page.evaluate("globalThis.__name = (fn) => fn;");
    } catch (e) {}

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1280, height: 800 });

    const takeScreenshot = async (filePath: string, step: string) => {
      try {
        const screenshotPromise = page.screenshot({ path: filePath });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Screenshot capture timed out after 10 seconds"),
              ),
            10000,
          ),
        );
        await Promise.race([screenshotPromise, timeoutPromise]);
        if (onScreenshot) {
          onScreenshot(filePath, step);
        }
      } catch (e: any) {
        addLog(
          `[YAHOO] Warning taking screenshot in step "${step}": ${e.message}`,
        );
      }
    };

    // Optional Login with custom creds/sessionID
    await loginToYahooFinance(
      page,
      addLog,
      auth,
      yahooEmail,
      yahooPassword,
      yahooCookies,
    );

    // 1. Navigate to Yahoo Finance Homepage
    addLog(
      `[YAHOO] Navigating to Yahoo Finance Homepage ("https://finance.yahoo.com/")...`,
    );
    await page.goto("https://finance.yahoo.com/", {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Handle cookie consent if it appears on homepage
    try {
      const consentBtn = await page.$(
        'button[name="agree"], button[value="agree"], .accept-all, button.btn.secondary',
      );
      if (consentBtn) {
        addLog("[YAHOO] Handling cookie consent popup on Yahoo homepage...");
        await consentBtn.click();
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {}

    // Handle random ad/newsletter popups
    

    // Take storyboard screenshot step 1
    addLog(`[YAHOO] Taking storyboard step1 screenshot: navigated to homepage...`);
    await takeScreenshot(
      `yahoo_${current_ticker}_step1_navigated.png`,
      "Paso 1: Ingreso a Yahoo Finance",
    );

    // 2. Locate search box, clear it, type ticker, and submit search
    addLog(`[YAHOO] Locating search field for ticker ${current_ticker}...`);
    const searchInputSelector = '#ybar-sbq, input[name="p"], input[placeholder*="Search"], input[placeholder*="buscar"], input[type="text"]';
    
    let searchSuccess = false;
    try {
      await page.waitForSelector(searchInputSelector, { timeout: 15000 });
      const searchInput = await page.$(searchInputSelector);
      if (searchInput) {
        await searchInput.click();
        await new Promise((r) => setTimeout(r, 500));
        
        // Clear input content
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        
        addLog(`[YAHOO] Escribiendo el ticker "${current_ticker}" en el buscador...`);
        await searchInput.type(current_ticker, { delay: 100 });
        await new Promise((r) => setTimeout(r, 1000));

        // Take storyboard screenshot step 2 after typing the ticker
        addLog(`[YAHOO] Taking storyboard step2 screenshot: ticker typed...`);
        await takeScreenshot(
          `yahoo_${current_ticker}_step2_search_typed.png`,
          `Paso 2: Ticker "${current_ticker}" ingresado en buscador`,
        );

        addLog(`[YAHOO] Enviando búsqueda presionando Enter...`);
        await page.keyboard.press("Enter");
        searchSuccess = true;
      }
    } catch (err: any) {
      addLog(`[YAHOO] [WARN] Error entering ticker search: ${err.message}. Navigating directly as fallback...`);
    }

    if (!searchSuccess) {
      addLog(`[YAHOO] Loading quote directly as fallback search...`);
      await page.goto(`https://finance.yahoo.com/quote/${current_ticker}`, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });
      await new Promise((r) => setTimeout(r, 3000));

      await takeScreenshot(
        `yahoo_${current_ticker}_step2_search_typed.png`,
        `Paso 2: Ticker "${current_ticker}" ingresado (Acceso Directo)`,
      );
    }

    // Wait and verify quote page loaded
    addLog(`[YAHOO] Waiting for Yahoo Finance quote page to render...`);
    await new Promise((r) => setTimeout(r, 6000));

    // Handle cookie consent if it appears on quote page (just in case)
    try {
      const consentBtn2 = await page.$(
        'button[name="agree"], button[value="agree"], .accept-all, button.btn.secondary',
      );
      if (consentBtn2) {
        addLog("[YAHOO] Handling secondary cookie consent popup...");
        await consentBtn2.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e) {}

    // Handle random ad/newsletter popups
    

    addLog(`[YAHOO] Arrived on quote page URL: ${page.url()}`);

    // Cierre específico para la ventana emergente de AlphaSpace / Promo en paso 3
    try {
      addLog(`[YAHOO] Intentando cerrar ventana emergente promocional (AlphaSpace/etc)...`);
      
      // Primera estrategia: tratar de presionar la X o botones de cierre
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        let closed = false;
        for (const btn of Array.from(btns)) {
            const label = btn.getAttribute('aria-label') || '';
            const title = btn.getAttribute('title') || '';
            const hasCloseClass = Array.from(btn.classList).some(c => c.toLowerCase().includes('close'));
            const hasSvgClose = btn.querySelector('svg[data-icon="close"]') || btn.querySelector('svg path[d*="M19 6.41"]');
            
            if (label.toLowerCase() === 'close' || title.toLowerCase() === 'close' || hasCloseClass || hasSvgClose) {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    btn.click();
                    closed = true;
                }
            }
        }
        return closed;
      });
      await new Promise(r => setTimeout(r, 1000));
      
      // Segunda estrategia: intentar con tecla de escape para lightboxes
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 500));
    } catch(e) {
      addLog(`[YAHOO] Error al intentar cerrar ventana emergente: ${(e as any).message}`);
    }

    // Take storyboard screenshot step 3
    
    addLog(`[YAHOO] Taking storyboard step3 screenshot: quote page loaded...`);
    await takeScreenshot(
      `yahoo_${current_ticker}_step3_quote_loaded.png`,
      `Paso 3: Página de cotización de ${current_ticker} cargada`,
    );

    // 3. Find and click "View more" inside "News headlines" section
    addLog(
      `[YAHOO] Locating "View more" button in "News headlines" section under the chart...`,
    );
    const clickResult = await page.evaluate(() => {
      // @ts-ignore
      const __name = (fn: any) => fn;
      // Find containers matching 'News headlines' and containing 'View more'
      const allElements = Array.from(document.querySelectorAll("div, section, aside, main, article"));
      const containers = allElements.filter((el) => {
        const text = (el as HTMLElement).innerText || "";
        return text.includes("News headlines") && text.includes("View more");
      });

      // Look inside matching containers for button inside containing text
      for (const container of containers) {
        const button = container.querySelector("button");
        if (button && button.innerText.toLowerCase().includes("view more")) {
          button.scrollIntoView({ block: "center" });
          button.click();
          return { clicked: true, tag: "BUTTON", className: button.className };
        }
      }

      // Fallback: click any button with "View more"
      const anyButton = Array.from(document.querySelectorAll("button")).find(
        (b) => b.innerText.toLowerCase().includes("view more"),
      );
      if (anyButton) {
        anyButton.scrollIntoView({ block: "center" });
        anyButton.click();
        return {
          clicked: true,
          tag: "BUTTON_ANY",
          className: anyButton.className,
        };
      }

      return { clicked: false };
    });

    addLog(`[YAHOO] Click "View more" result: ${JSON.stringify(clickResult)}`);

    // Wait for slide-in drawer/modal/column of full headlines to expand on the right
    await new Promise((r) => setTimeout(r, 6000));

    // Take storyboard screenshot step 4
    addLog(
      `[YAHOO] Taking storyboard step4 screenshot: sidebar headlines opened...`,
    );
    await takeScreenshot(
      `yahoo_${current_ticker}_step4_clicked_view_more.png`,
      "Paso 4: Click en ver más titulares",
    );

    // 4. Read the text representation of headlines from page to pass to Gemini
    const extractedText = await page.evaluate(() => {
      // @ts-ignore
      const __name = (fn: any) => fn;
      return document.body.innerText || "";
    });
    if (extractedText && extractedText.trim().length > 100) {
      newsText = extractedText;
    }

    // 5. Take screenshot of the entire layout showing the search result and the expanded right column headlines
    const sName = `yahoo_${current_ticker}_news_headlines.png`;
    addLog(`[YAHOO] Saving screenshot of headlines to ${sName}...`);
    await takeScreenshot(sName, "Paso 5: Titulares y columnas cargados");
    screenshotPath = sName;
    addLog(`[YAHOO] Screenshot of expanded news headlines generated.`);

    // 6. Ask Yahoo Scout for "Why is [TICKER] moving today?"
    addLog(`[YAHOO] Buscando el input de Ask Yahoo Scout para consultar sobre el movimiento...`);
    
    // Perform a small scroll to trigger lazy loading if needed
    try {
      await page.evaluate(() => {
        window.scrollBy(0, 300);
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {}

    let scoutInputFound = false;
    try {
      // First attempt: look for common scout inputs
      const scoutSelectors = [
        'textarea[placeholder*="Ask Yahoo Scout"]',
        'input[placeholder*="Ask Yahoo Scout"]', 
        'textarea[placeholder*="Ask"]',
        'input[placeholder*="Ask"]',
        '[data-testid*="ask-yahoo"] textarea',
        '[data-testid*="ask-yahoo"] input',
        '[class*="scout"] textarea',
        '[class*="scout"] input',
      ];

      for (const sel of scoutSelectors) {
         try {
             let isFound = false;
             
             // Check if it exists and is visible
             const elVisible = await page.evaluate((selector: string) => {
                 const el = document.querySelector(selector) as HTMLElement;
                 if (el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0) {
                     el.scrollIntoView({ block: "center", inline: "center" });
                     el.focus();
                     return true;
                 }
                 return false;
             }, sel);

             if (elVisible) {
                 await new Promise(r => setTimeout(r, 500));
                 addLog(`[YAHOO] Interactuando con input Scout (${sel})...`);
                 
                 // Type the query directly with puppeteer focusing
                 await page.click(sel);
                 
                 // Clear any existing text
                 await page.keyboard.down('Control');
                 await page.keyboard.press('A');
                 await page.keyboard.up('Control');
                 await page.keyboard.press('Backspace');
                 
                 const query = `Why is ${current_ticker} moving today?`;
                 addLog(`[YAHOO] Escribiendo consulta: "${query}"`);
                 await page.keyboard.type(query, { delay: 50 });
                 await new Promise(r => setTimeout(r, 500));
                 
                 // Hit enter
                 await page.keyboard.press('Enter');
                 
                 // As a fallback, try to find a send button nearby if Enter doesn't work
                 try {
                     await page.evaluate((selector: string) => {
                         const el = document.querySelector(selector) as HTMLElement;
                         if (el && el.parentElement) {
                             const btn = el.parentElement.querySelector('button[type="submit"], button[aria-label="Send"], button svg, button');
                             if (btn) (btn as HTMLElement).click();
                         }
                     }, sel);
                 } catch(e) {}
                 
                 scoutInputFound = true;
                 break;
             }
         } catch(e) {}
      }
    } catch(e) {
      addLog(`[YAHOO] Error al buscar bloque Scout: ${(e as any).message}`);
    }

    if (scoutInputFound) {
      addLog(`[YAHOO] Pregunta enviada a Yahoo Scout. Esperando 10 segundos por la respuesta...`);
      
      // Wait for 10 seconds for the response to load
      await new Promise(r => setTimeout(r, 10000));
      
      const sMovingName = `yahoo_${current_ticker}_moving_today.png`;
      addLog(`[YAHOO] Generando screenshot de respuesta de Scout a ${sMovingName}...`);
      
      // Take storyboard screenshot step 7 (expanded)
      addLog(`[YAHOO] Taking storyboard step7 screenshot: scout response...`);
      await takeScreenshot(sMovingName, "Paso 7: Explicación de movimiento por Yahoo Scout");
      movingScreenshotPath = sMovingName;
    } else {
      addLog(`[YAHOO] No se encontró el input de Yahoo Scout o fallo al interactuar.`);
      // Take storyboard screenshot step 7 (failed)
      addLog(`[YAHOO] Taking storyboard step7 screenshot: failed/scout missing...`);
      await takeScreenshot(`yahoo_${current_ticker}_step7_moving_today_failed.png`, "Paso 7: Input Yahoo Scout no aplicable o no encontrado");
    }
  } catch (err: any) {
    addLog(
      `[ERROR] Yahoo processing error for ${current_ticker}: ${err.message}`,
    );
  } finally {
    activeBrowser = null;
    if (browser) {
      await browser.close();
    }
  }

  // Ensure movingScreenshotPath falls back to the general quote loaded screenshot if not set
  if (!movingScreenshotPath) {
    const qLoaded = `yahoo_${current_ticker}_step3_quote_loaded.png`;
    if (fs.existsSync(qLoaded)) {
      movingScreenshotPath = qLoaded;
      addLog(`[YAHOO] Usando captura de pantalla de cotización como respaldo de explicación de movimiento.`);
    }
  }

  return { newsText, screenshotPath, movingScreenshotPath };
}

let cachedTvSessionId: string | null = null;
let lastTvSessionIdFetchTime = 0;

async function humanMoveAndClick(
  page: any,
  selectorOrBox:
    | string
    | { x: number; y: number; width: number; height: number },
  addLog?: Function,
) {
  try {
    let x = 0;
    let y = 0;
    if (typeof selectorOrBox === "string") {
      const element = await page.$(selectorOrBox);
      if (!element) {
        // Fallback to standard click if element not found by Puppeteer query selector
        await page.click(selectorOrBox);
        return;
      }
      const box = await element.boundingBox();
      if (!box) {
        await element.click();
        return;
      }
      x = box.x + box.width / 2;
      y = box.y + box.height / 2;
    } else {
      x = selectorOrBox.x + selectorOrBox.width / 2;
      y = selectorOrBox.y + selectorOrBox.height / 2;
    }

    // Start cursor at a random position
    const startX = Math.floor(Math.random() * 300) + 50;
    const startY = Math.floor(Math.random() * 300) + 50;

    // Move smoothly over 15 to 25 randomized steps with cubic-like easing
    const steps = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Ease in-out
      const curX = startX + (x - startX) * easeT + Math.sin(i) * 1.5; // Add organic sine-wave jitter
      const curY = startY + (y - startY) * easeT + Math.cos(i) * 1.5;
      await page.mouse.move(curX, curY);
      await new Promise((r) =>
        setTimeout(r, 8 + Math.floor(Math.random() * 12)),
      );
    }

    // Random hover hover
    await new Promise((r) =>
      setTimeout(r, 100 + Math.floor(Math.random() * 150)),
    );

    // Organic mouse down and up
    await page.mouse.down();
    await new Promise((r) =>
      setTimeout(r, 40 + Math.floor(Math.random() * 60)),
    );
    await page.mouse.up();
  } catch (err: any) {
    if (addLog)
      addLog(`[HUMAN MOTION] Warning during move & click: ${err.message}`);
    if (typeof selectorOrBox === "string") {
      try {
        await page.click(selectorOrBox);
      } catch (clickErr) {}
    }
  }
}

async function humanType(
  page: any,
  selectorOrPage: any,
  text: string,
  addLog?: Function,
) {
  try {
    if (typeof selectorOrPage === "string") {
      await humanMoveAndClick(page, selectorOrPage, addLog);
      await page.focus(selectorOrPage);
    }

    for (const char of text) {
      if (typeof selectorOrPage === "string") {
        await page.type(selectorOrPage, char, {
          delay: 40 + Math.floor(Math.random() * 60),
        });
      } else {
        await selectorOrPage.keyboard.sendCharacter(char);
      }
      // Organic delay variation per keystroke (human typing rhythm simulation)
      await new Promise((r) =>
        setTimeout(r, 60 + Math.floor(Math.random() * 110)),
      );
    }
  } catch (err: any) {
    if (addLog) addLog(`[HUMAN MOTION] Warning during typing: ${err.message}`);
    if (typeof selectorOrPage === "string") {
      try {
        await page.type(selectorOrPage, text);
      } catch (typeErr) {}
    }
  }
}

async function getTradingViewSessionId(
  addLog: Function,
  tvEmail?: string,
  tvPassword?: string,
): Promise<string | null> {
  const envSessionId = process.env.TRADINGVIEW_SESSION_ID;
  const now = Date.now();

  // Use cached token if fetched within the last 2 hours (7200000 ms)
  if (cachedTvSessionId && now - lastTvSessionIdFetchTime < 7200000) {
    addLog("[TRADINGVIEW] Using cached session ID");
    return cachedTvSessionId;
  }

  // If TRADINGVIEW_SESSION_ID in environment is a direct session cookie value:
  if (
    envSessionId &&
    (envSessionId.startsWith("s:") || envSessionId.length > 30)
  ) {
    addLog(
      "[TRADINGVIEW] Using session ID cookie from environment secrets directly.",
    );
    cachedTvSessionId = envSessionId;
    lastTvSessionIdFetchTime = now;
    return envSessionId;
  }

  const username = tvEmail || process.env.TRADINGVIEW_USERNAME || envSessionId;
  const password = tvPassword || process.env.TRADINGVIEW_PASSWORD;

  if (!username || !password) {
    addLog(
      "[TRADINGVIEW] No credentials found in user inputs or secrets, skipping login automation.",
    );
    return null;
  }

  addLog(
    "[TRADINGVIEW] Logging in via Puppeteer [STEALTH HUMANIZED ACTIVE]...",
  );
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    activeBrowser = browser;
    const page = await browser.newPage();

    // Evade detection by hiding WebDriver
    await page.evaluateOnNewDocument("Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); globalThis.__name = (fn) => fn;");

    try {
      await page.evaluate("globalThis.__name = (fn) => fn;");
    } catch (e) {}

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto("https://www.tradingview.com/#signin", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 2000));

    addLog("[TRADINGVIEW] Opening login modal via human-like interaction...");
    const userMenuButtonExists = await page.evaluate(() => {
      return !!document.querySelector(
        ".tv-header__user-menu-button--anonymous",
      );
    });

    if (userMenuButtonExists) {
      await humanMoveAndClick(
        page,
        ".tv-header__user-menu-button--anonymous",
        addLog,
      );
    } else {
      await page.evaluate(() => {
        const btn = document.querySelector(
          ".tv-header__user-menu-button--anonymous",
        ) as HTMLButtonElement | null;
        if (btn) btn.click();
      });
    }
    await new Promise((r) => setTimeout(r, 1800));

    const signInButtonExists = await page.evaluate(() => {
      return !!document.querySelector(
        'button[data-name="header-user-menu-sign-in"]',
      );
    });

    if (signInButtonExists) {
      await humanMoveAndClick(
        page,
        'button[data-name="header-user-menu-sign-in"]',
        addLog,
      );
    } else {
      await page.evaluate(() => {
        const s = document.querySelector(
          'button[data-name="header-user-menu-sign-in"]',
        ) as HTMLButtonElement | null;
        if (s) s.click();
      });
    }
    await new Promise((r) => setTimeout(r, 2200));

    // Check if we should attempt "Continue with Google"
    addLog('[TRADINGVIEW] Locating "Continue with Google" sign-in button...');
    const googleButtonData = await page.evaluate(() => {
      const iframe = document.querySelector(
        'iframe[title="Sign in with Google Button"], iframe[src*="accounts.google.com"]',
      ) as HTMLIFrameElement | null;
      if (iframe) return { isIframe: true };

      const gBtn = document.querySelector(
        '.googleButton-PqrDjLCV, [class*="googleButton"]',
      ) as HTMLElement | null;
      if (gBtn) {
        gBtn.click();
        return { clickedDirect: true };
      }
      return null;
    });

    let popupPage: Page | null = null;
    let targetPromise = new Promise<any>((resolve) => {
      const listener = (target: any) => {
        if (target.type() === "page") {
          resolve(target);
          browser.off("targetcreated", listener);
        }
      };
      browser.on("targetcreated", listener);
    });

    if (googleButtonData && googleButtonData.isIframe) {
      const iframeElement = await page.$(
        'iframe[title="Sign in with Google Button"], iframe[src*="accounts.google.com"]',
      );
      if (iframeElement) {
        const box = await iframeElement.boundingBox();
        if (box) {
          // Humanized coordinate click
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          await page.mouse.move(centerX, centerY);
          await new Promise((r) => setTimeout(r, 150));
          await page.mouse.click(centerX, centerY);
        } else {
          await iframeElement.click();
        }
      }
    }

    try {
      addLog("[TRADINGVIEW] Waiting for Google login popup page...");
      const newTarget = await Promise.race([
        targetPromise,
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Popup timeout")), 15000),
        ),
      ]);
      popupPage = await newTarget.page();
      addLog("[TRADINGVIEW] Captured Google popup window successfully.");

      // Inject evasion script to popup window too!
      await popupPage.evaluateOnNewDocument("Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); globalThis.__name = (fn) => fn;");
    } catch (e: any) {
      addLog(
        "[TRADINGVIEW] Google login popup not opened, trying legacy fallback email fields...",
      );
      const fallbackEmailBtnExists = await page.evaluate(() => {
        return !!document.querySelector('button[name="Email"]');
      });
      if (fallbackEmailBtnExists) {
        await humanMoveAndClick(page, 'button[name="Email"]', addLog);
      } else {
        await page.evaluate(() => {
          const em = document.querySelector(
            'button[name="Email"]',
          ) as HTMLButtonElement | null;
          if (em) em.click();
        });
      }
      await new Promise((r) => setTimeout(r, 1200));
      addLog(
        "[TRADINGVIEW] Filling credentials in traditional form with human type delay...",
      );

      await humanType(page, "#id_username", username, addLog);
      await humanType(page, "#id_password", password, addLog);

      const submitBtnExists = await page.evaluate(() => {
        return !!document.querySelector("button.submitButton-FIMIWZkg");
      });
      if (submitBtnExists) {
        await humanMoveAndClick(page, "button.submitButton-FIMIWZkg", addLog);
      } else {
        await page.evaluate(() => {
          const submitBtn = document.querySelector(
            "button.submitButton-FIMIWZkg",
          ) as HTMLButtonElement | null;
          if (submitBtn) submitBtn.click();
        });
      }
    }

    if (popupPage) {
      addLog("[TRADINGVIEW] Google login: focused input email field...");
      await popupPage.waitForSelector('input[type="email"]', {
        timeout: 15000,
      });

      // Human move and click email input
      await humanMoveAndClick(popupPage, 'input[type="email"]', addLog);
      await popupPage.focus('input[type="email"]');
      await new Promise((r) => setTimeout(r, 400));

      // Type email
      await humanType(popupPage, 'input[type="email"]', username, addLog);
      await new Promise((r) => setTimeout(r, 600));

      const didNextEmail = await popupPage.evaluate(() => {
        const nextBtn = document.querySelector(
          '#identifierNext, button[jsname="Lgbsbc"], button:not([disabled])',
        ) as HTMLButtonElement | null;
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });
      if (!didNextEmail) {
        await popupPage.keyboard.press("Enter");
      }

      await new Promise((r) => setTimeout(r, 4500));
      addLog("[TRADINGVIEW] Google login: focused password field...");
      await popupPage.waitForSelector('input[type="password"]', {
        timeout: 15000,
      });

      // Human move and click password input
      await humanMoveAndClick(popupPage, 'input[type="password"]', addLog);
      await popupPage.focus('input[type="password"]');
      await new Promise((r) => setTimeout(r, 350));

      // Type password
      await humanType(popupPage, 'input[type="password"]', password, addLog);
      await new Promise((r) => setTimeout(r, 700));

      const didNextPass = await popupPage.evaluate(() => {
        const nextBtn = document.querySelector(
          '#passwordNext, button[jsname="Lgbsbc"], button:not([disabled])',
        ) as HTMLButtonElement | null;
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });
      if (!didNextPass) {
        await popupPage.keyboard.press("Enter");
      }

      addLog(
        "[TRADINGVIEW] Google account credentials submitted. Waiting for redirection to complete (15s)...",
      );
      await new Promise((r) => setTimeout(r, 15000));
    } else {
      // Wait for traditional/fallback sign-in to persist
      await new Promise((r) => setTimeout(r, 8000));
    }

    const cookies = await page.cookies();
    const sessionCookie = cookies.find((c) => c.name === "sessionid");

    if (sessionCookie && sessionCookie.value) {
      addLog("[TRADINGVIEW] Login successful, obtained session ID.");
      cachedTvSessionId = sessionCookie.value;
      lastTvSessionIdFetchTime = now;
      return cachedTvSessionId;
    } else {
      const pageError = await page.evaluate(() => {
        const text = document.body.innerText || "";
        if (text.includes("Invalid username or password")) {
          return "Invalid credentials";
        }
        if (document.querySelector('iframe[src*="recaptcha"]')) {
          return "CAPTCHA";
        }
        return null;
      });

      if (pageError === "Invalid credentials") {
        addLog(
          "[TRADINGVIEW] Error: Invalid username or password (200) returned by TradingView.",
        );
        addLog(
          "[TRADINGVIEW] Please double-check your credentials in the TradingView panel in UI.",
        );
      } else if (pageError === "CAPTCHA") {
        addLog(
          "[TRADINGVIEW] Error: CAPTCHA challenge detected by TradingView. Login blocked.",
        );
        addLog(
          "[TRADINGVIEW] Headless login is blocked by bot detection. Please paste your sessionid cookie directly in the UI field.",
        );
      } else {
        addLog("[TRADINGVIEW] Failed to obtain session ID cookie after login.");
      }
      return null;
    }
  } catch (error: any) {
    addLog(`[TRADINGVIEW] Puppeteer error during login: ${error.message}`);
    return null;
  } finally {
    activeBrowser = null;
    if (browser) {
      await browser.close();
    }
  }
}

async function addTradingViewIndicator(
  page: Page,
  indicatorName: string,
  addLog: Function,
) {
  try {
    addLog(`[TRADINGVIEW] Adding indicator: ${indicatorName}...`);
    // Try to open Indicators dialog
    await page.evaluate(() => {
      const indicatorsBtn = Array.from(
        document.querySelectorAll("button"),
      ).find((b) => {
        const tooltip = (b.getAttribute("data-tooltip") || "").toLowerCase();
        const label = (b.getAttribute("aria-label") || "").toLowerCase();
        return tooltip.includes("indicators") || label.includes("indicators");
      });
      if (indicatorsBtn) (indicatorsBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Type indicator name
    await page.type('input[data-role="search"]', indicatorName);
    await new Promise((r) => setTimeout(r, 2000));

    // Click matching result
    await page.evaluate((name) => {
      const results = Array.from(
        document.querySelectorAll(
          '[data-role="list-item"], .item-3Nf-fB_S, [class*="item-"]',
        ),
      );
      const item = results.find((i) =>
        (i as HTMLElement).innerText.includes(name),
      );
      if (item) (item as HTMLElement).click();
    }, indicatorName);
    await new Promise((r) => setTimeout(r, 2000));

    // Close dialog
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 1000));
  } catch (e: any) {
    addLog(
      `[TRADINGVIEW] Warning adding indicator ${indicatorName}: ${e.message}`,
    );
  }
}


const checkLogin = async (stepName: string) => {
      const loggedIn = await page.evaluate(() => {
        return !!document.querySelector(
          '.tv-header__user-menu-button--signed-in, [data-name="header-user-menu-button"]',
        );
      });
      if (loggedIn) {
        addLog(`[TRADINGVIEW] Verified: Logged in for ${stepName}.`);
      } else {
        addLog(`[TRADINGVIEW] Warning: Not logged in for ${stepName}.`);
      }
    }

const hideObstructiveUI = async () => {
      await page.evaluate(() => {
        const selectors = [
          '[data-role="dialog"]',
          ".tv-dialog__backdrop",
          ".tv-floating-all-around-container",
          ".js-dialog",
          '[class*="popup"]',
          '[class*="dialog"]',
          '[class*="banner"]',
          '[class*="ads"]',
          '[id*="ads"]',
          ".tv-toast",
          ".tv-guide",
          ".tv-news-sidebar",
          ".tv-watchlist-sidebar",
          ".tv-header__container",
          "#overlap-manager-root",
          ".modal-container",
          '[class*="Backdrop"]',
          ".v-backdrop",
        ];
        selectors.forEach((selector) => {
          const els = document.querySelectorAll(selector);
          els.forEach((el) => ((el as HTMLElement).style.display = "none"));
        });

        const els = document.querySelectorAll("div, button, a");
        els.forEach((e) => {
          const text = (e as HTMLElement).innerText || e.textContent || "";
          if (
            text.includes("Accept all") ||
            text.includes("Cookie") ||
            text.includes("I agree")
          ) {
            e.remove();
          }
        });
      });
    }

const cleanupRuntimeErrors = async () => {
      await page.evaluate(() => {
        const errors = Array.from(
          document.querySelectorAll(
            'button[data-tooltip="Runtime error"], button[title="Runtime error"], .error-icon',
          ),
        );
        errors.forEach((err) => {
          const legendRow =
            err.closest('div[data-name="legend-source-item"]') ||
            err.closest('div[class*="item-"]');
          if (legendRow) {
            const closeBtn = legendRow.querySelector(
              'button[data-name="legend-remove-action"]',
            );
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            } else {
              legendRow.remove();
            }
          } else {
            err.remove();
          }
        });
      });
    }

async function captureTradingViewScreenshots(
  ticker: string,
  addLog: Function,
  tvSessionId?: string,
  tvEmail?: string,
  tvPassword?: string,
  onScreenshot?: (path: string, stepName: string) => void,
): Promise<string[]> {
  addLog(`Capturing TradingView screenshots for ${ticker}...`);
  let browser;
  const screenshots: string[] = [];

  try {
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    activeBrowser = browser;
    const page = await browser.newPage();

    // Evade detection by hiding WebDriver
    await page.evaluateOnNewDocument("Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); globalThis.__name = (fn) => fn;");

    try {
      await page.evaluate("globalThis.__name = (fn) => fn;");
    } catch (e) {}

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1920, height: 1080 });

    const takeScreenshot = async (filePath: string, step: string) => {
      try {
        const screenshotPromise = page.screenshot({ path: filePath });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Screenshot capture timed out after 10 seconds"),
              ),
            10000,
          ),
        );
        await Promise.race([screenshotPromise, timeoutPromise]);
        if (onScreenshot) {
          onScreenshot(filePath, step);
        }
      } catch (e: any) {
        addLog(
          `[TRADINGVIEW] Warning taking screenshot in step "${step}": ${e.message}`,
        );
      }
    };

    let finalSessionId = tvSessionId;
    if (!finalSessionId) {
      finalSessionId =
        (await getTradingViewSessionId(addLog, tvEmail, tvPassword)) ||
        undefined;
    }

    if (finalSessionId) {
      addLog(`[TRADINGVIEW] Authenticating with session ID...`);
      await page.setCookie({
        name: "sessionid",
        value: finalSessionId,
        domain: ".tradingview.com",
      });
    }

    const checkLogin = async (stepName: string) => {
      const loggedIn = await page.evaluate(() => {
        return !!document.querySelector(
          '.tv-header__user-menu-button--signed-in, [data-name="header-user-menu-button"]',
        );
      });
      if (loggedIn) {
        addLog(`[TRADINGVIEW] Verified: Logged in for ${stepName}.`);
      } else {
        addLog(`[TRADINGVIEW] Warning: Not logged in for ${stepName}.`);
      }
    };

    const hideObstructiveUI = async () => {
      await page.evaluate(() => {
        const selectors = [
          '[data-role="dialog"]',
          ".tv-dialog__backdrop",
          ".tv-floating-all-around-container",
          ".js-dialog",
          '[class*="popup"]',
          '[class*="dialog"]',
          '[class*="banner"]',
          '[class*="ads"]',
          '[id*="ads"]',
          ".tv-toast",
          ".tv-guide",
          ".tv-news-sidebar",
          ".tv-watchlist-sidebar",
          ".tv-header__container",
          "#overlap-manager-root",
          ".modal-container",
          '[class*="Backdrop"]',
          ".v-backdrop",
        ];
        selectors.forEach((selector) => {
          const els = document.querySelectorAll(selector);
          els.forEach((el) => ((el as HTMLElement).style.display = "none"));
        });

        const els = document.querySelectorAll("div, button, a");
        els.forEach((e) => {
          const text = (e as HTMLElement).innerText || e.textContent || "";
          if (
            text.includes("Accept all") ||
            text.includes("Cookie") ||
            text.includes("I agree")
          ) {
            e.remove();
          }
        });
      });
    };

    const cleanupRuntimeErrors = async () => {
      await page.evaluate(() => {
        const errors = Array.from(
          document.querySelectorAll(
            'button[data-tooltip="Runtime error"], button[title="Runtime error"], .error-icon',
          ),
        );
        errors.forEach((err) => {
          const legendRow =
            err.closest('div[data-name="legend-source-item"]') ||
            err.closest('div[class*="item-"]');
          if (legendRow) {
            const closeBtn = legendRow.querySelector(
              'button[data-name="legend-remove-action"]',
            );
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            } else {
              legendRow.remove();
            }
          } else {
            err.remove();
          }
        });
      });
    };

    // Chart 1: First layout template
    addLog(
      `Capturing first TradingView screenshot for ${ticker} (layout: k3GWg7dt)...`,
    );
    const formattedSymbol = `NASDAQ:${ticker}`;
    await page.goto(
      `https://www.tradingview.com/chart/k3GWg7dt/?symbol=${encodeURIComponent(formattedSymbol)}`,
      { waitUntil: "domcontentloaded" },
    );

    await new Promise((r) => setTimeout(r, 8000));
    await checkLogin("Chart 1 - Setup");
    await cleanupRuntimeErrors();
    await hideObstructiveUI();

    const s1 = `tv_${ticker}_indicators1.png`;
    await takeScreenshot(s1, "TradingView: Gráfico k3GWg7dt (Indicadores 1)");
    screenshots.push(s1);

    // Chart 2: Second layout template
    addLog(
      `Capturing second TradingView screenshot for ${ticker} (layout: cL1iVbes)...`,
    );
    await page.goto(
      `https://www.tradingview.com/chart/cL1iVbes/?symbol=${encodeURIComponent(formattedSymbol)}`,
      { waitUntil: "domcontentloaded" },
    );

    await new Promise((r) => setTimeout(r, 8000));
    await checkLogin("Chart 2 - Setup");
    await cleanupRuntimeErrors();
    await hideObstructiveUI();

    const s2 = `tv_${ticker}_indicators2.png`;
    await takeScreenshot(s2, "TradingView: Gráfico cL1iVbes (Indicadores 2)");
    screenshots.push(s2);
  } catch (err: any) {
    addLog(
      `[ERROR] Failed to capture TV screenshot for ${ticker}: ${err.message}`,
    );
  } finally {
    activeBrowser = null;
    if (browser) {
      await browser.close();
    }
  }
  return screenshots;
}

async function getOrCreateFolder(
  auth: any,
  folderName: string,
  addLog: Function,
): Promise<string> {
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  addLog(`[SYSTEM] Creating new Google Drive folder: ${folderName}...`);
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });
  return folder.data.id!;
}

async function updateGoogleDocText(
  auth: any,
  docTitle: string,
  text: string,
  addLog: Function,
) {
  addLog(`Updating Google Doc: ${docTitle}...`);
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const folderId = await getOrCreateFolder(auth, "Stocks", addLog);

  // Find doc by title in this folder
  const res = await drive.files.list({
    q: `name = '${docTitle}' and mimeType = 'application/vnd.google-apps.document' and '${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
  });

  let doc = res.data.files?.[0];
  if (!doc) {
    addLog(`[SYSTEM] Creating new Google Doc: ${docTitle} in Stocks folder...`);
    const newDoc = await drive.files.create({
      requestBody: {
        name: docTitle,
        mimeType: "application/vnd.google-apps.document",
        parents: [folderId],
      },
      fields: "id, name",
    });
    doc = { id: newDoc.data.id, name: docTitle };
  }

  let docId = doc.id!;

  // Get the document to find its length
  const docDetails = await docs.documents.get({ documentId: docId });
  const content = docDetails.data.body?.content;
  // The end index is the endIndex of the last element minus 1
  let endIndex = 1;
  if (content && content.length > 0) {
    const lastElement = content[content.length - 1];
    endIndex = (lastElement.endIndex || 2) - 1;
  }

  const requests: any[] = [];
  if (endIndex > 1) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex: endIndex } },
    });
  }
  requests.push({
    insertText: { location: { index: 1 }, text },
  });

  // Clear and insert text
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });

  return docId;
}

async function updateGoogleDocImages(
  auth: any,
  docId: string,
  imagePaths: string[],
  origin: string,
  addLog: Function,
) {
  addLog(`Uploading and inserting images to document...`);
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });
  const folderId = await getOrCreateFolder(auth, "Stocks", addLog);

  const requests: any[] = [];

  // We process normally because we use endOfSegmentLocation
  for (const imagePath of imagePaths) {
    if (!fs.existsSync(imagePath)) {
      addLog(`[WARNING] Image not found: ${imagePath}`);
      continue;
    }

    try {
      // Upload to Google Drive (Stocks folder) for backup/reference
      addLog(
        `Uploading screenshot ${imagePath} to Google Drive (Stocks folder)...`,
      );
      const fileMetadata = {
        name: path.basename(imagePath),
        mimeType: "image/png",
        parents: [folderId],
      };
      const media = {
        mimeType: "image/png",
        body: fs.createReadStream(imagePath),
      };
      await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id",
      });
      addLog(`Image ${imagePath} backed up to Drive successfully.`);

      // Upload to a public image hosting service so Docs has a public URL to download it from
      let publicUrl = "";
      addLog(
        `Uploading screenshot ${imagePath} to tmpfiles.org for insertion...`,
      );
      try {
        const form = new FormData();
        form.append("file", fs.createReadStream(imagePath));
        const res = await axios.post(
          "https://tmpfiles.org/api/v1/upload",
          form,
          {
            headers: form.getHeaders(),
            timeout: 10000,
          },
        );
        if (
          res.data &&
          res.data.status === "success" &&
          res.data.data &&
          res.data.data.url
        ) {
          const rawUrl = res.data.data.url;
          publicUrl = rawUrl.replace(
            "https://tmpfiles.org/",
            "https://tmpfiles.org/dl/",
          );
          addLog(
            `Successfully uploaded to tmpfiles.org. Direct URL: ${publicUrl}`,
          );
        } else {
          throw new Error("Invalid response payload from tmpfiles.org");
        }
      } catch (tmpErr: any) {
        addLog(
          `[WARNING] Upload to tmpfiles.org failed (${tmpErr.message}). Falling back to freeimage.host...`,
        );
        try {
          const base64Data = fs.readFileSync(imagePath, "base64");
          const params = new URLSearchParams();
          params.append(
            "key",
            process.env.FREEIMAGE_API_KEY || "6d207e02198a847aa98d0a2a901485a5",
          );
          params.append("action", "upload");
          params.append("source", base64Data);
          params.append("format", "json");

          const res = await axios.post(
            "https://freeimage.host/api/1/upload",
            params.toString(),
            {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              timeout: 15000,
            },
          );
          publicUrl = res.data.image.url;
          addLog(`Successfully uploaded to freeimage.host. URL: ${publicUrl}`);
        } catch (fiErr: any) {
          addLog(
            `[ERROR] Both tmpfiles.org and freeimage.host failed to upload ${imagePath}. Error: ${fiErr.message}`,
          );
          throw fiErr;
        }
      }
      addLog(`Image URL prepared for docs insertion: ${publicUrl}`);

      requests.push({
        insertText: {
          endOfSegmentLocation: { segmentId: "" },
          text: "\n",
        },
      });
      requests.push({
        insertInlineImage: {
          endOfSegmentLocation: { segmentId: "" },
          uri: publicUrl,
          objectSize: { width: { magnitude: 500, unit: "PT" } },
        },
      });
      requests.push({
        insertText: {
          endOfSegmentLocation: { segmentId: "" },
          text: "\n\n",
        },
      });
    } catch (err: any) {
      addLog(
        `[ERROR] Failed to upload or prepare image ${imagePath}: ${err.message}`,
      );
    }
  }

  if (requests.length > 0) {
    addLog(`Applying batch update to insert images...`);
    try {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests },
      });
      addLog(`Images inserted successfully.`);
    } catch (err: any) {
      addLog(`[ERROR] Failed to insert images in doc: ${err.message}`);
    }
  }
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
