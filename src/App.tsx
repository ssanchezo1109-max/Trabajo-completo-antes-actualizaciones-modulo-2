/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, googleSignIn, logout, getAccessToken } from './auth';
import CalendarPanel from './components/CalendarPanel';
import { 
  Play, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Trash2, 
  LogIn, 
  LogOut, 
  FileText, 
  TrendingUp,
  Activity,
  Box,
  LayoutDashboard,
  Cpu,
  Monitor,
  Maximize2,
  X,
  Home,
  ArrowLeft,
  Database,
  Sparkles,
  ExternalLink,
  Square,
  Sliders,
  RefreshCw,
  Calendar
} from 'lucide-react';

interface AutomationResult {
  success: boolean;
  logs: string[];
  error?: string;
  docId?: string;
  tickerDocs?: { ticker: string; docId: string }[];
}

function TickerImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [errorCount, setErrorCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // When src changes, reset states
  useEffect(() => {
    setErrorCount(0);
    setLoaded(false);
    setRetryKey(prev => prev + 1);
  }, [src]);

  // Retry logic
  useEffect(() => {
    if (errorCount > 0 && errorCount < 10 && !loaded) {
      const timer = setTimeout(() => {
        setRetryKey(prev => prev + 1);
      }, 4000); // retry every 4 seconds
      return () => clearTimeout(timer);
    }
  }, [errorCount, loaded]);

  const finalSrc = src.includes('?') 
    ? `${src.split('?')[0]}?t=${retryKey}_${Date.now()}`
    : `${src}?t=${retryKey}_${Date.now()}`;

  if (errorCount >= 10 && !loaded) {
    return (
      <div className="w-full min-h-[180px] rounded border border-dashed border-slate-800 bg-slate-950/60 p-6 flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs">❗</div>
        <p className="text-[10px] font-mono text-slate-400 text-center">No se encontró o no se pudo generar la captura original</p>
        <button
          type="button"
          onClick={() => {
            setErrorCount(0);
            setRetryKey(prev => prev + 1);
          }}
          className="text-[9px] font-mono uppercase bg-slate-900 hover:bg-slate-850 px-2.5 py-1 rounded text-amber-500 hover:text-amber-400 border border-slate-800 cursor-pointer"
        >
          Reintentar Carga Manual
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[140px] flex items-center justify-center bg-slate-950/40 rounded overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 gap-2 z-10 p-4 border border-slate-800 rounded">
          <Loader2 className="w-4 h-4 text-[#f97316] animate-spin" />
          <span className="text-[9px] font-mono text-slate-400 uppercase animate-pulse">Esperando captura real del robot (Intento {errorCount + 1})...</span>
        </div>
      )}
      <img
        src={finalSrc}
        alt={alt}
        className={`${className} ${loaded ? 'block' : 'hidden'}`}
        onLoad={() => {
          setLoaded(true);
        }}
        onError={() => {
          setErrorCount(prev => prev + 1);
        }}
      />
    </div>
  );
}

function LiveRobotCamera({ isRunning }: { isRunning: boolean }) {
  const [timestamp, setTimestamp] = useState(Date.now());
  const [errorCount, setErrorCount] = useState(0);
  const [hasLoadedAtLeastOnce, setHasLoadedAtLeastOnce] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTimestamp(Date.now());
      }, 800); // Polling faster (800ms) to ensure smooth real-time screen stream from the bot
    } else {
      setTimestamp(Date.now());
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <div className="h-full flex flex-col select-none">
        <div className="flex items-center justify-between border-b border-slate-800/85 pb-2 mb-3 shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-550'}`} />
            <span className="text-[10px] font-bold text-slate-305 tracking-wider">CÁMARA DEL ROBOT EN VIVO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#f97316] font-bold uppercase">{isRunning ? 'MONITORIZANDO...' : 'INACTIVO'}</span>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1 text-slate-400 hover:text-[#f97316] hover:bg-slate-800/60 rounded transition-all cursor-pointer flex items-center justify-center"
              title="Expandir Cámara"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-grow relative bg-black border border-slate-805/80 rounded-lg overflow-hidden flex flex-col items-center justify-center p-3 m-0 min-h-[185px]">
          <img
            key={timestamp}
            src={`/api/images/live_automation.png?t=${timestamp}`}
            alt="Captura de automatización en vivo"
            className="max-w-full max-h-full object-contain rounded shadow-lg border border-slate-800"
            onError={() => {
              setErrorCount(prev => prev + 1);
            }}
            onLoad={() => {
              setHasLoadedAtLeastOnce(true);
              setErrorCount(0);
            }}
          />

          {isRunning && !hasLoadedAtLeastOnce && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090c]/95 text-center p-6 gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-505 font-bold mb-1">
                📷
              </div>
              <p className="text-xs font-semibold text-slate-300 font-sans">El robot está iniciando el navegador...</p>
              <p className="text-[10px] text-slate-500 font-mono max-w-xs leading-relaxed uppercase animate-pulse">
                Esperando primera captura de pantalla de la sesión en vivo
              </p>
            </div>
          )}

          {!isRunning && (!hasLoadedAtLeastOnce || errorCount > 2) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090c]/95 text-center p-6 gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-505 font-bold mb-1">
                📷
              </div>
              <p className="text-xs font-semibold text-slate-450 font-sans">Soporte de Monitoreo General</p>
              <p className="text-[10px] text-slate-500 font-mono max-w-xs leading-relaxed">
                Inicia un proceso para ver la pantalla del robot en tiempo real (Puppeteer headless browser stream).
              </p>
            </div>
          )}

          {!isRunning && hasLoadedAtLeastOnce && errorCount <= 2 && (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-900/90 border border-slate-800 rounded font-mono text-[9px] text-[#f97316] uppercase font-bold tracking-wider">
              ÚLTIMO ESTADO
            </div>
          )}
        </div>

        <div className="mt-2 text-left text-[9px] font-mono text-slate-500 uppercase flex justify-between">
          <span>Canal: `/api/images/live_automation.png`</span>
          <span>Autorefresco: {isRunning ? 'Flujo Continuo' : 'Pausado'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-[150] bg-black/98 flex flex-col p-6 animate-fade-in screen-expanded">
          <div className="flex items-center justify-between border-b border-slate-800/90 pb-3 mb-4 font-mono shrink-0">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-200 tracking-wider">MONITOR DE AUTOMATIZACIÓN EN PANTALLA COMPLETA</span>
                <span className="text-[9px] text-slate-500">CANAL EN VIVO: /api/images/live_automation.png</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#f97316] font-black uppercase tracking-widest bg-[#f97316]/10 px-2.5 py-1 rounded border border-[#f97316]/20">
                {isRunning ? 'Robot Activo (Flujo Continuo)' : 'Robot Inactivo (Pausa)'}
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center w-8 h-8"
                title="Cerrar vista expandida"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-grow bg-[#050608]/90 border border-slate-800/80 rounded-xl overflow-hidden p-6 flex flex-col items-center justify-center relative min-h-0">
            <img
              key={`${timestamp}_expanded`}
              src={`/api/images/live_automation.png?t=${timestamp}`}
              alt="Captura de automatización en vivo"
              className="max-w-full max-h-full object-contain rounded-lg border border-slate-800/60 shadow-2xl"
              onError={() => setErrorCount(prev => prev + 1)}
              onLoad={() => {
                setHasLoadedAtLeastOnce(true);
                setErrorCount(0);
              }}
            />

            {isRunning && !hasLoadedAtLeastOnce && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090c]/98">
                <Loader2 className="w-8 h-8 text-[#f97316] animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-300 font-sans">Inicializando conexión con el robot...</p>
                <p className="text-[11px] text-slate-500 font-mono mt-1">ESTA PANTALLA SE ACTUALIZARÁ EN TIEMPO REAL AL VER LOS CAMBIOS EN EL NAVEGADOR</p>
              </div>
            )}
          </div>

          <div className="mt-3 text-center text-[10px] font-mono text-slate-500 uppercase flex justify-between select-none shrink-0">
            <span>Servidor Ingress: Puerto 3000 | Puppeteer virtual frame</span>
            <span>PRESIONA 'ESC' O EL BOTÓN 'X' PARA VOLVER AL PANEL GENERAL</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'extraction' | 'analysis' | 'order-generation' | 'calendar'>('welcome');
  const [tickers, setTickers] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']);
  const [newTicker, setNewTicker] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // States for Order Generation
  const [tvSessionCookie, setTvSessionCookie] = useState(() => localStorage.getItem('tv_session_cookie') || '');
  const [orderGenTickers, setOrderGenTickers] = useState('AAPL');
  const [calcSheetName, setCalcSheetName] = useState('Calculo de Trailing y Target/Stop');
  const [targetDocName, setTargetDocName] = useState('ORDENES');
  const [isOrderGenRunning, setIsOrderGenRunning] = useState(false);
  const [orderGenLogs, setOrderGenLogs] = useState<string[]>(['[SYSTEM] Consola de Generación de Órdenes Lista.']);
  const [ordersOutput, setOrdersOutput] = useState<string>('');
  const [orderGenProgress, setOrderGenProgress] = useState(0);

  const isStoppedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [tvSessionId, setTvSessionId] = useState(() => {
    return localStorage.getItem('tv_session_id') || '';
  });
  const [tvEmail, setTvEmail] = useState(() => {
    return localStorage.getItem('tv_email') || '';
  });
  const [tvPassword, setTvPassword] = useState(() => {
    return localStorage.getItem('tv_password') || '';
  });
  const [yahooCookies, setYahooCookies] = useState(() => {
    return localStorage.getItem('yahoo_cookies') || '';
  });
  const [yahooEmail, setYahooEmail] = useState(() => {
    return localStorage.getItem('yahoo_email') || '';
  });
  const [yahooPassword, setYahooPassword] = useState(() => {
    return localStorage.getItem('yahoo_password') || '';
  });
  const [lastDocId, setLastDocId] = useState(() => {
    return localStorage.getItem('stocks_doc_id') || '';
  });
  const [isTvSessionSaved, setIsTvSessionSaved] = useState(() => {
    return !!(localStorage.getItem('tv_email') || localStorage.getItem('tv_session_id'));
  });
  const [isYahooCookiesSaved, setIsYahooCookiesSaved] = useState(() => {
    return !!(localStorage.getItem('yahoo_email') || localStorage.getItem('yahoo_cookies'));
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<{ url: string; step: string; ticker: string } | null>(null);
  const [screenshotHistory, setScreenshotHistory] = useState<{ url: string; step: string; ticker: string }[]>([]);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Analysis process states
  const [notebookLMCookies, setNotebookLMCookies] = useState(() => {
    return localStorage.getItem('notebook_lm_cookies') || '';
  });
    const [yahooMarketNewsUrl, setYahooMarketNewsUrl] = useState(() => {
    return localStorage.getItem('yahoo_market_news_url') || '';
  });
const [notebookLMUrl, setNotebookLMUrl] = useState(() => {
    return localStorage.getItem('notebook_lm_url') || '';
  });
  const [googleEmail, setGoogleEmail] = useState(() => {
    return localStorage.getItem('google_email') || '';
  });
  const [googlePassword, setGooglePassword] = useState(() => {
    return localStorage.getItem('google_password') || '';
  });
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Detailed Analysis states
  const [isDetailedAnalysisRunning, setIsDetailedAnalysisRunning] = useState(false);
  const [detailedAnalysisLogs, setDetailedAnalysisLogs] = useState<string[]>([]);
  const [detailedAnalysisProgress, setDetailedAnalysisProgress] = useState(0);

  // Auditoria states
  const [isUpdateAuditRunning, setIsUpdateAuditRunning] = useState(false);
  const [updateAuditLogs, setUpdateAuditLogs] = useState<string[]>([]);
  const [updateAuditProgress, setUpdateAuditProgress] = useState(0);
  const [detailedReports, setDetailedReports] = useState<{ [ticker: string]: string }>({});
  const [activeDetailedIndex, setActiveDetailedIndex] = useState(0);
  const [reviewInstruction, setReviewInstruction] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [showCredsSavedMsg, setShowCredsSavedMsg] = useState(false);
  const [detailedResult, setDetailedResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(100);
  const [sheetNotice, setSheetNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const baseTickers = (result?.tickerDocs && result.tickerDocs.length > 0)
    ? result.tickerDocs.map(d => d.ticker)
    : tickers;
    
  const analysisTickers = Object.keys(detailedReports).includes("Auditoría") && !baseTickers.includes("Auditoría")
    ? ["Auditoría", ...baseTickers]
    : baseTickers;

  const handleSaveCredentials = () => {
    localStorage.setItem('notebook_lm_cookies', notebookLMCookies);
    localStorage.setItem('yahoo_market_news_url', yahooMarketNewsUrl);
      localStorage.setItem('notebook_lm_url', notebookLMUrl);
    localStorage.setItem('google_email', googleEmail);
    localStorage.setItem('google_password', googlePassword);
    setShowCredsSavedMsg(true);
    setTimeout(() => {
      setShowCredsSavedMsg(false);
    }, 4500);
  };

  const handleRunDetailedAnalysis = async () => {
    setIsDetailedAnalysisRunning(true);
    setDetailedAnalysisLogs(['[SYSTEM] Iniciando Proceso de Análisis Detallado Inteligente...']);
    setDetailedAnalysisProgress(0);
    setDetailedReports({});
    setActiveDetailedIndex(0);
    setDetailedResult(null);

    isStoppedRef.current = false;
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }

      // Automatically persist credentials too
      localStorage.setItem('notebook_lm_cookies', notebookLMCookies);
      localStorage.setItem('notebook_lm_url', notebookLMUrl);
      localStorage.setItem('google_email', googleEmail);
      localStorage.setItem('google_password', googlePassword);

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/automation/run-detailed-analysis', {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          notebookLMCookies, 
          notebookLMUrl,
          yahooMarketNewsUrl,
          googleEmail,
          googlePassword,
          tickers,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
         throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accLogs: string[] = ['[SYSTEM] Conexión establecida con el servidor de análisis detallado.'];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const rawJSON = line.replace('data: ', '').trim();
                if (!rawJSON) continue;
                const parsed = JSON.parse(rawJSON);

                if (parsed.type === 'log') {
                  accLogs = [...accLogs, parsed.msg];
                  setDetailedAnalysisLogs(accLogs);
                } else if (parsed.type === 'progress') {
                  setDetailedAnalysisProgress(parsed.value);
                } else if (parsed.type === 'ticker-report') {
                  setDetailedReports(prev => ({
                    ...prev,
                    [parsed.ticker]: parsed.report
                  }));
                } else if (parsed.type === 'done') {
                  setDetailedResult({ success: true });
                  if (parsed.reports) {
                    setDetailedReports(parsed.reports);
                  }
                } else if (parsed.type === 'error') {
                  setDetailedResult({ success: false, error: parsed.error });
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setDetailedAnalysisLogs(prev => [...prev, `[ERROR] Falló el proceso de análisis detallado: ${err.message}`]);
      setDetailedResult({ success: false, error: err.message });
    } finally {
      setIsDetailedAnalysisRunning(false);
    }
  };

  const handleRunUpdateAudit = async () => {
    setIsUpdateAuditRunning(true);
    setUpdateAuditLogs(['[SYSTEM] Iniciando Proceso de Actualización de Auditoría...']);
    setUpdateAuditProgress(0);

    isStoppedRef.current = false;
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }

      // Automatically persist credentials too
      localStorage.setItem('notebook_lm_cookies', notebookLMCookies);
      localStorage.setItem('notebook_lm_url', notebookLMUrl);
      localStorage.setItem('google_email', googleEmail);
      localStorage.setItem('google_password', googlePassword);

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/automation/run-update-audit', {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          notebookLMCookies, 
          notebookLMUrl,
          googleEmail,
          googlePassword,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
         throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accLogs: string[] = ['[SYSTEM] Conexión establecida con el servidor de auditoría.'];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const rawJSON = line.replace('data: ', '').trim();
                if (!rawJSON) continue;
                const parsed = JSON.parse(rawJSON);

                if (parsed.type === 'log') {
                  accLogs = [...accLogs, parsed.msg];
                  setUpdateAuditLogs(accLogs);
                } else if (parsed.type === 'progress') {
                  setUpdateAuditProgress(parsed.value);
                } else if (parsed.type === 'done') {
                  accLogs = [...accLogs, '[SYSTEM] ¡Proceso de Actualización de Auditoría Completado Exitosamente!'];
                  setUpdateAuditLogs(accLogs);
                } else if (parsed.type === 'error') {
                  accLogs = [...accLogs, `[ERROR] El servidor retornó un error: ${parsed.error}`];
                  setUpdateAuditLogs(accLogs);
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setUpdateAuditLogs(prev => [...prev, `[ERROR] Falló el proceso de actualización del reporte de auditoría: ${err.message}`]);
    } finally {
      setIsUpdateAuditRunning(false);
    }
  };

  const handleRunOrderGeneration = async () => {
    setIsOrderGenRunning(true);
    setOrderGenLogs(['[SYSTEM] Iniciando Proceso de Generación de Órdenes...']);
    setOrdersOutput('');
    setOrderGenProgress(0);
    isStoppedRef.current = false;

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }

      abortControllerRef.current = new AbortController();

      // Persist TradingView Session Cookie
      localStorage.setItem('tv_session_cookie', tvSessionCookie);

      const response = await fetch('/api/automation/run-order-generation', {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tvSessionCookie,
          tickers: orderGenTickers,
          calcSheetName,
          targetDocName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accLogs: string[] = ['[SYSTEM] Conectado al módulo de órdenes. Escuchando eventos...'];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const rawJSON = line.replace('data: ', '').trim();
                if (!rawJSON) continue;
                const parsed = JSON.parse(rawJSON);

                if (parsed.type === 'log') {
                  accLogs = [...accLogs, parsed.msg];
                  setOrderGenLogs(accLogs);
                } else if (parsed.type === 'progress') {
                  setOrderGenProgress(parsed.value);
                } else if (parsed.type === 'finish') {
                  accLogs = [...accLogs, '[SYSTEM] ¡Módulo de Generación de Órdenes Completado!'];
                  setOrderGenLogs(accLogs);
                  if (parsed.orders) {
                    setOrdersOutput(parsed.orders);
                  }
                } else if (parsed.type === 'error') {
                  accLogs = [...accLogs, `[ERROR] Se reportó un error: ${parsed.error}`];
                  setOrderGenLogs(accLogs);
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setOrderGenLogs(prev => [...prev, `[ERROR] Falló la automatización de generación de órdenes: ${err.message}`]);
    } finally {
      setIsOrderGenRunning(false);
    }
  };

  const handleAcceptReport = async () => {
    const activeTicker = analysisTickers[activeDetailedIndex];
    if (!activeTicker) return;
    const reportTextContent = detailedReports[activeTicker] || '';

    // Auto-parse rating and direction from report text
    let rating = '8';
    let direction = 'CALL';

    const ratingMatch = reportTextContent.match(/(?:rating|puntuaci[oó]n|puntos|score)\s*:\s*\*\*?(\d+)/i) || 
                        reportTextContent.match(/(?:rating|puntuaci[oó]n|puntos|score)\s*:\s*(\d+)/i) ||
                        reportTextContent.match(/(\d+)\s*\/\s*10/);
    if (ratingMatch && ratingMatch[1]) {
      rating = ratingMatch[1];
    }

    const directionMatch = reportTextContent.match(/(?:direcci[oó]n|market direction|sentido)\s*:\s*\*\*?(CALL|PUT|NEUTRAL)/i) ||
                           reportTextContent.match(/(?:direcci[oó]n|market direction|sentido)\s*:\s*(CALL|PUT|NEUTRAL)/i) ||
                           reportTextContent.match(/\b(CALL|PUT|NEUTRAL)\b/i);
    if (directionMatch && directionMatch[1]) {
      direction = directionMatch[1].toUpperCase();
    }

    setIsSavingEntry(true);
    setSheetNotice(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/automation/update-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ticker: activeTicker,
          rating,
          direction,
          comment: commentText || undefined
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed && parsed.error) {
            errorMessage = parsed.error;
          }
        } catch (e) {}
        throw new Error(errorMessage);
      }

      setCommentText('');
      setIsCommenting(false);
      setSheetNotice({ 
        type: 'success', 
        message: `¡Garantizado! Fila para ${activeTicker} (Calificación: ${rating}, Dirección: ${direction}) guardada correctamente en Google Sheets.` 
      });
      
      // Clear success notification after 5 seconds
      setTimeout(() => {
        setSheetNotice(null);
      }, 5000);

      if (activeDetailedIndex < analysisTickers.length - 1) {
        setActiveDetailedIndex(prev => prev + 1);
      } else {
        setSheetNotice({ 
          type: 'success', 
          message: "¡Felicidades! Se han procesado y aceptado los reportes de todos los tickers en 'Registro Analisis de Entradas'." 
        });
      }
    } catch (err: any) {
      console.error(err);
      setSheetNotice({ 
        type: 'error', 
        message: `Error al guardar en Google Sheets: ${err.message || err}` 
      });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleSendCustomInstruction = async () => {
    if (!reviewInstruction.trim()) return;
    const activeTicker = analysisTickers[activeDetailedIndex];
    if (!activeTicker) return;

    setIsSavingEntry(true);
    setSheetNotice(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/automation/send-custom-instruction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          notebookLMCookies,
          notebookLMUrl,
          googleEmail,
          googlePassword,
          instruction: reviewInstruction,
          ticker: activeTicker
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed && parsed.error) {
            errorMessage = parsed.error;
          }
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (data.success && data.updatedReport) {
        setDetailedReports(prev => ({
          ...prev,
          [activeTicker]: data.updatedReport
        }));
        setReviewInstruction('');
        setIsRevising(false);
        setSheetNotice({ 
          type: 'success', 
          message: `¡Listo! Reporte del ticker ${activeTicker} actualizado correctamente mediante NotebookLM.` 
        });
        setTimeout(() => {
          setSheetNotice(null);
        }, 5000);
      } else {
        throw new Error(data.error || "No se pudo actualizar el reporte.");
      }
    } catch (err: any) {
      console.error(err);
      setSheetNotice({ 
        type: 'error', 
        message: `Error al enviar orden a NotebookLM: ${err.message || err}` 
      });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const saveTvSessionId = () => {
    localStorage.setItem('tv_session_id', tvSessionId);
    localStorage.setItem('tv_email', tvEmail);
    localStorage.setItem('tv_password', tvPassword);
    setIsTvSessionSaved(true);
  };

  const saveYahooCookies = () => {
    localStorage.setItem('yahoo_cookies', yahooCookies);
    localStorage.setItem('yahoo_email', yahooEmail);
    localStorage.setItem('yahoo_password', yahooPassword);
    setIsYahooCookiesSaved(true);
  };

  const handleStop = async () => {
    isStoppedRef.current = true;
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {}
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setIsAnalysisRunning(false);
    setIsDetailedAnalysisRunning(false);
    setIsUpdateAuditRunning(false);
    setIsAllInOneRunning(false);
    setIsOrderGenRunning(false);
    setAllInOneCurrentStep(0);

    try {
      const token = await getAccessToken();
      await fetch('/api/automation/stop', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      setLogs((prev) => [...prev, '[SYSTEM] Solicitando detener la ejecución actual... (STOP)']);
      setDetailedAnalysisLogs((prev) => [...prev, '[SYSTEM] Solicitando detener la ejecución actual del análisis detallado... (STOP)']);
      setUpdateAuditLogs((prev) => [...prev, '[SYSTEM] Solicitando detener la ejecución de actualización de auditoría... (STOP)']);
    } catch (err: any) {
      console.error('Error stopping execution:', err);
    }
  };

  const handleRunAnalysisProcess = async () => {
    setAnalysisLogs(['[SYSTEM] Iniciando Proceso de Análisis y Sincronización...']);
    setAnalysisProgress(0);
    setAnalysisResult(null);
    setIsAnalysisRunning(true);
    isStoppedRef.current = false;

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }

      // Persist inputs
      localStorage.setItem('notebook_lm_cookies', notebookLMCookies);
      localStorage.setItem('notebook_lm_url', notebookLMUrl);
      localStorage.setItem('google_email', googleEmail);
      localStorage.setItem('google_password', googlePassword);

      // Inspect recent result for processed tickerDocs
      const activeTickers = result?.tickerDocs || [];

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/automation/run-analysis-process', {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          notebookLMCookies, 
          notebookLMUrl,
          yahooMarketNewsUrl,
          googleEmail,
          googlePassword,
          tickers,
          tickerDocs: activeTickers
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
         throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accLogs: string[] = ['[SYSTEM] Conexión establecida con el servidor de análisis.'];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.trim().startsWith('data:')) {
              const dataStr = line.replace(/^data:\s*/, '');
              if (dataStr) {
                try {
                  const payload = JSON.parse(dataStr);
                  if (payload.type === 'log') {
                    accLogs = [...accLogs, payload.msg];
                    setAnalysisLogs(accLogs);
                  } else if (payload.type === 'progress') {
                    setAnalysisProgress(payload.value);
                  } else if (payload.type === 'done') {
                    setAnalysisResult({ success: true });
                    setAnalysisProgress(100);
                  } else if (payload.type === 'error') {
                    setAnalysisResult({ success: false, error: payload.error });
                  }
                } catch (e) {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      setAnalysisLogs(prev => [...prev, `[ERROR] ${err.message || 'Error en el proceso'}`]);
      setAnalysisResult({ success: false, error: err.message || 'Server Error' });
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  const handleRunSourcesTest = async () => {
    setAnalysisLogs(['[PRUEBA] Iniciando test rápido de scroll físico en Sources de NotebookLM...']);
    setAnalysisProgress(0);
    setAnalysisResult(null);
    setIsAnalysisRunning(true);
    isStoppedRef.current = false;

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }

      // Persist inputs
      localStorage.setItem('notebook_lm_cookies', notebookLMCookies);
      localStorage.setItem('notebook_lm_url', notebookLMUrl);
      localStorage.setItem('google_email', googleEmail);
      localStorage.setItem('google_password', googlePassword);

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/automation/run-sources-test', {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          notebookLMCookies, 
          notebookLMUrl,
          googleEmail,
          googlePassword,
          tickers
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
         throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accLogs: string[] = ['[PRUEBA] Conexión establecida con el servidor de la prueba.'];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.trim().startsWith('data:')) {
              const dataStr = line.replace(/^data:\s*/, '');
              if (dataStr) {
                try {
                  const payload = JSON.parse(dataStr);
                  if (payload.type === 'log') {
                    accLogs = [...accLogs, payload.msg];
                    setAnalysisLogs(accLogs);
                  } else if (payload.type === 'progress') {
                    setAnalysisProgress(payload.value);
                  } else if (payload.type === 'done') {
                    setAnalysisResult({ success: true });
                    setAnalysisProgress(100);
                  } else if (payload.type === 'error') {
                    setAnalysisResult({ success: false, error: payload.error });
                  } else if (payload.type === 'screenshot') {
                    const newShot = { url: payload.url, step: payload.step, ticker: payload.ticker };
                    setCurrentScreenshot(newShot);
                    setScreenshotHistory(prev => [...prev, newShot]);
                  }
                } catch (e) {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      setAnalysisLogs(prev => [...prev, `[ERROR PRUEBA] ${err.message || 'Error en la prueba'}`]);
      setAnalysisResult({ success: false, error: err.message || 'Server Error' });
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  useEffect(() => {
    initAuth(
      (currentUser) => { 
        setIsAuthenticated(true); 
        setUser(currentUser);
      },
      () => { 
        setIsAuthenticated(false); 
        setUser(null);
      }
    );
  }, []);

  useEffect(() => {
    const el = document.getElementById('analysis-terminal');
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [analysisLogs]);

  // Combined 4-in-1 sequential execution states and handler
  const [isAllInOneRunning, setIsAllInOneRunning] = useState(false);
  const [allInOneCurrentStep, setAllInOneCurrentStep] = useState<number>(0); // 0 = Idle, 1 = Proceso Simple, 2 = Sincronización, 3 = Actualizar Auditoría, 4 = Análisis Detallado

  const handleRunAllInOne = async () => {
    setIsAllInOneRunning(true);
    isStoppedRef.current = false;
    try {
      // 1) Proceso Simple
      setAllInOneCurrentStep(1);
      await handleRunAnalysisProcess();
      if (isStoppedRef.current) return;

      // 2) Sincronización de Archivos
      setAllInOneCurrentStep(2);
      await handleRunSourcesTest();
      if (isStoppedRef.current) return;

      // 3) Actualizar Auditoría
      setAllInOneCurrentStep(3);
      await handleRunUpdateAudit();
      if (isStoppedRef.current) return;

      // 4) Análisis Detallado
      setAllInOneCurrentStep(4);
      await handleRunDetailedAnalysis();
    } catch (err: any) {
      console.error('Error en flujo consolidado:', err);
    } finally {
      setIsAllInOneRunning(false);
      setAllInOneCurrentStep(0);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      const res = await googleSignIn();
      if (res) {
        setIsAuthenticated(true);
        setUser(res.user);
      }
    } catch (err: any) {
      console.error('Login failed', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        console.log('User closed the login popup.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        console.log('Concurrent sign in popup cancelled.');
      } else {
        alert(`Error during login: ${err?.message || err}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const runAutomation = async (specificTickers?: string[], mode: 'yahoo' | 'tv' | 'both' = 'both') => {
    if (!isAuthenticated) return;
    setIsRunning(true);
    setResult(null);
    setProgress(0);
    setCurrentScreenshot(null);
    setScreenshotHistory([]);
    setLogs([`[SYSTEM] Initializing Market Analyst Protocol [Mode: ${mode.toUpperCase()}]...`]);

    const tickersToRun = specificTickers || tickers;

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }
      
      const response = await fetch('/api/automation/run', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          tickers: tickersToRun, 
          origin: window.location.origin, 
          tvSessionId, 
          tvEmail,
          tvPassword,
          yahooCookies,
          yahooEmail,
          yahooPassword,
          mode 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
         throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalResult = null;
      let accLogs: string[] = ['[SYSTEM] Initializing Automation Protocol...'];

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.trim().startsWith('data:')) {
              const dataStr = line.replace(/^data:\s*/, '');
              if (dataStr) {
                try {
                  const payload = JSON.parse(dataStr);
                  if (payload.type === 'log') {
                    accLogs = [...accLogs, payload.msg];
                    setLogs(accLogs);
                  } else if (payload.type === 'progress') {
                    setProgress(payload.value);
                  } else if (payload.type === 'screenshot') {
                    const newShot = { url: payload.url, step: payload.step, ticker: payload.ticker };
                    setCurrentScreenshot(newShot);
                    setScreenshotHistory(prev => [...prev, newShot]);
                    if (payload.ticker) {
                      setActiveTicker(payload.ticker);
                    }
                  } else if (payload.type === 'done') {
                    finalResult = payload;
                    setResult(payload);
                    setProgress(100);
                    if (payload.tickerDocs && payload.tickerDocs.length > 0) {
                      const firstDocId = payload.tickerDocs[0].docId;
                      if (firstDocId) {
                        setLastDocId(firstDocId);
                        localStorage.setItem('stocks_doc_id', firstDocId);
                      }
                    }
                  } else if (payload.type === 'error') {
                    setResult({ success: false, error: payload.error });
                  }
                } catch (e) {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] ${err.message || 'Fatal server disconnection'}`]);
      setResult({ success: false, error: err.message || 'Server Error' });
    } finally {
      setIsRunning(false);
    }
  };

  const runSequentialAutomation = async (mode: 'yahoo' | 'tv' | 'both' = 'both') => {
    if (!isAuthenticated) return;
    setIsRunning(true);
    isStoppedRef.current = false;
    setResult(null);
    setProgress(0);
    setCurrentScreenshot(null);
    setScreenshotHistory([]);
    setLogs([`[SYSTEM] Iniciando Proceso Completo Secuencial [Modo: ${mode.toUpperCase()}]...`]);

    const accumulatedTickerDocs: { ticker: string; docId: string }[] = [];
    const totalTickers = tickers.length;

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No Google Access Token found. Please Sign In again.");
      }

      for (let i = 0; i < totalTickers; i++) {
        if (isStoppedRef.current) {
          setLogs(prev => [...prev, `[SYSTEM] Proceso detenido por el usuario.`]);
          break;
        }

        const ticker = tickers[i];
        const current_ticker = String(ticker).trim();
        setLogs(prev => [...prev, `[SYSTEM] >>> Iniciando análisis de ${current_ticker} (${i + 1}/${totalTickers}) <<<`]);
        setActiveTicker(current_ticker);

        const response = await fetch('/api/automation/run', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            tickers: [current_ticker],
            origin: window.location.origin, 
            tvSessionId, 
            tvEmail,
            tvPassword,
            yahooCookies,
            yahooEmail,
            yahooPassword,
            mode 
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server Error (${response.status}) on ${current_ticker}: ${errorText}`);
        }

        if (!response.body) {
          throw new Error(`No response body from server for ${current_ticker}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          if (isStoppedRef.current) {
            await reader.cancel();
            break;
          }

          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            for (const line of lines) {
              if (line.trim().startsWith('data:')) {
                const dataStr = line.replace(/^data:\s*/, '');
                if (dataStr) {
                  try {
                    const payload = JSON.parse(dataStr);
                    if (payload.type === 'log') {
                      setLogs(prev => [...prev, payload.msg]);
                    } else if (payload.type === 'progress') {
                      const indProgress = payload.value;
                      const overallProgress = (i / totalTickers) * 100 + (indProgress / totalTickers);
                      setProgress(overallProgress);
                    } else if (payload.type === 'screenshot') {
                      const newShot = { url: payload.url, step: payload.step, ticker: current_ticker };
                      setCurrentScreenshot(newShot);
                      setScreenshotHistory(prev => [...prev, newShot]);
                    } else if (payload.type === 'done') {
                      if (payload.tickerDocs && payload.tickerDocs.length > 0) {
                        const firstDocId = payload.tickerDocs[0].docId;
                        if (firstDocId) {
                          setLastDocId(firstDocId);
                          localStorage.setItem('stocks_doc_id', firstDocId);
                        }
                        accumulatedTickerDocs.push(...payload.tickerDocs);
                        setResult({
                          success: true,
                          logs: [],
                          tickerDocs: [...accumulatedTickerDocs]
                        });
                      }
                    } else if (payload.type === 'error') {
                      setLogs(prev => [...prev, `[ERROR] Fallo en ${current_ticker}: ${payload.error}`]);
                    }
                  } catch (e) {}
                }
              }
            }
          }
        }

        if (isStoppedRef.current) {
          break;
        }

        setLogs(prev => [...prev, `[SYSTEM] <<< Finalizado análisis de ${current_ticker} (${i + 1}/${totalTickers}) >>>`]);

        if (i < totalTickers - 1) {
          const cooldownSecs = 6;
          for (let c = cooldownSecs; c > 0; c--) {
            if (isStoppedRef.current) break;
            setLogs(prev => [...prev, `[SYSTEM] Cooldown de seguridad: Esperando ${c} segundos antes de iniciar el siguiente ticker...`]);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      if (!isStoppedRef.current) {
        setProgress(100);
        setResult({
          success: true,
          logs: [],
          tickerDocs: accumulatedTickerDocs
        });
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] ${err.message || 'Fatal error'}`]);
      setResult({ success: false, error: err.message || 'Server Error' });
    } finally {
      setIsRunning(false);
    }
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setResult(null);
    setLogs(['[SYSTEM] Initializing Simulation Protocol...']);

    try {
      const response = await fetch('/api/automation/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      const data = await response.json();
      setResult(data);
      if (data.logs) setLogs(data.logs);
    } catch (err: any) {
       setLogs(prev => [...prev, `[ERROR] ${err.message || 'Fatal server disconnection'}`]);
       setResult({ success: false, error: err.message || 'Server Error' });
    } finally {
      setIsRunning(false);
    }
  };

  const addTicker = () => {
    if (newTicker && !tickers.includes(newTicker.toUpperCase())) {
      setTickers([...tickers, newTicker.toUpperCase()]);
      setNewTicker('');
    }
  };

  const removeTicker = (t: string) => {
    setTickers(tickers.filter(item => item !== t));
  };

  if (currentScreen === 'welcome') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-8 bg-[#07090c] text-[#e2e8f0] relative overflow-hidden">
        {/* Aesthetic background glow spheres */}
        <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-[150px] pointer-events-none" />
        
        {/* Header row containing optional status/user info */}
        <div className="absolute top-6 left-8 right-8 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-[#94a3b8] uppercase font-bold">
              SISTEMA OPERATIVO v1.2
            </span>
          </div>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/40 border border-slate-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {user?.email || 'Conectado'}
              </span>
              <button 
                onClick={handleLogout}
                className="px-3 py-1.5 border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400 text-[10px] font-bold uppercase transition-all rounded-lg cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 text-[10px] font-bold uppercase transition-all rounded-lg cursor-pointer hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]"
            >
              Conectar Google
            </button>
          )}
        </div>

        {/* Core Welcome Title Content */}
        <div className="text-center max-w-2xl mb-12 relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f97316] mb-2 font-mono">SUITE DE INTELIGENCIA Y AUTOMATIZACIÓN</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent mb-4">
            Analista de mercado
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed font-light">
            Consola inteligente de monitoreo de activos, extracción en tiempo real con agentes de automatización y generación de reportes estructurados.
          </p>
        </div>

        {/* Modern Bento Grid / Glowing Interactive Card Buttons */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl z-10">
          {/* Card 1: Extracción de información */}
          <div 
            className="bg-[#111418]/85 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between group cursor-pointer hover:border-slate-700/80 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 relative overflow-hidden"
            onClick={() => setCurrentScreen('extraction')}
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-505 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-450 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                Extracción de información
                <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">
                  Activo
                </span>
              </h3>
              
              <p className="text-xs text-slate-400 leading-relaxed mb-6 font-light">
                Configura y ejecuta robots de Puppeteer para extraer de forma segura datos de Yahoo Finance y TradingView, enviando capturas de pantalla viva y reportes inteligentes directamente a Google Docs.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-auto">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Integración de Datos</span>
              <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Entrar Consola →
              </span>
            </div>
          </div>

          {/* Card 2: Análisis de oportunidades */}
          <div 
            className="bg-[#111418]/85 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between group cursor-pointer hover:border-slate-700/80 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.15)] transition-all duration-300 relative overflow-hidden"
            onClick={() => setCurrentScreen('analysis')}
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-450 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-5 h-5 text-orange-450" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                Análisis de oportunidades
                <span className="text-[9px] bg-amber-500/10 text-amber-505 border border-amber-500/25 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">
                  Nuevo
                </span>
              </h3>
              
              <p className="text-xs text-slate-400 leading-relaxed mb-6 font-light">
                Portal en blanco preparado para instrumentar lógicas predictivas avanzadas, escaneo de patrones en gráficos, alarmas integradas sobre indicadores y optimización de portafolios de inversión.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-auto">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Indicadores y Señales</span>
              <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Abrir Módulo →
              </span>
            </div>
          </div>

          {/* Card 3: Generación de Órdenes */}
          <div 
            className="bg-[#111418]/85 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between group cursor-pointer hover:border-slate-700/80 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 relative overflow-hidden"
            onClick={() => setCurrentScreen('order-generation')}
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                Generación de Órdenes
                <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">
                  Automatizado
                </span>
              </h3>
              
              <p className="text-xs text-slate-400 leading-relaxed mb-6 font-light">
                Analiza de forma visual modelos de TradingView usando IA, ingresa los valores técnicos en tu fórmula de Google Sheets y genera automáticamente órdenes de tickers (Target/Stop) directo en tu reporte.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-auto">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Fórmulas y Ejecución</span>
              <span className="text-[10px] font-bold text-purple-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Ejecutar Módulo →
              </span>
            </div>
          </div>

          {/* Card 4: Google Calendar Scheduler */}
          <div 
            className="bg-[#111418]/85 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between group cursor-pointer hover:border-slate-700/80 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(249,115,22,0.15)] transition-all duration-300 relative overflow-hidden"
            onClick={() => setCurrentScreen('calendar')}
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-450 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-5 h-5 text-orange-450" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                Calendario de Sesiones
                <span className="text-[9px] bg-orange-500/10 text-orange-500 border border-orange-500/25 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">
                  Sincronizado
                </span>
              </h3>
              
              <p className="text-xs text-slate-400 leading-relaxed mb-6 font-light">
                Agenda recordatorios automáticos de análisis de tickers, monitorea tus próximas actividades de trading e integra de manera segura alertas financieras directo en tu Google Calendar real.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-auto">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Google Workspace</span>
              <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Ver Agenda →
              </span>
            </div>
          </div>
        </div>

        {/* Aesthetic grid decoration background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.015]" 
          style={{ backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)', backgroundSize: '30px 30px' }} 
        />
      </div>
    );
  }

  if (currentScreen === 'calendar') {
    return (
      <CalendarPanel
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogin={handleLogin}
        onBack={() => setCurrentScreen('welcome')}
        getAccessToken={getAccessToken}
      />
    );
  }

  if (currentScreen === 'order-generation') {
    return (
      <div className="h-screen w-full flex flex-col bg-[#07090c] p-6 text-[#e2e8f0] relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.01]" 
          style={{ backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
        />
        
        {/* Aesthetic background glow spheres */}
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

        {/* Header Row */}
        <header className="flex justify-between items-center mb-6 shrink-0 relative z-10 pb-4 border-b border-slate-800/50">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a855f7] mb-1 font-mono">MÓDULO DE FÓRMULAS Y OPERACIONES</p>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              Generación de Órdenes
            </h1>
          </div>
          
          <button 
            onClick={() => setCurrentScreen('welcome')}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-white/5 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Inicio
          </button>
        </header>

        {/* Main Grid Content */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          {/* Column Left: Parameters Config (Cols 5) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 gap-4 font-sans">
            <div className="bg-[#111418]/85 border border-[#1e293b] rounded-xl p-5 flex flex-col min-h-0 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Parámetros del Bot AI</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Cookie de Sesión de TradingView (sessionid)
                  </label>
                  <input
                    type="password"
                    value={tvSessionCookie}
                    onChange={(e) => setTvSessionCookie(e.target.value)}
                    placeholder="Pega la cookie sessionid de TradingView aquí..."
                    className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 focus:border-purple-500 outline-none transition-all placeholder:text-slate-700"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">Stays server-side for authenticated charting requests.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre de la Hoja (Google Sheets)
                  </label>
                  <input
                    type="text"
                    value={calcSheetName}
                    onChange={(e) => setCalcSheetName(e.target.value)}
                    placeholder="Calculo de Trailing y Target/Stop"
                    className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-[#1e293b] text-xs font-semibold text-slate-200 focus:border-purple-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre del Documento Destino (Google Docs)
                  </label>
                  <input
                    type="text"
                    value={targetDocName}
                    onChange={(e) => setTargetDocName(e.target.value)}
                    placeholder="ORDENES"
                    className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-[#1e293b] text-xs font-semibold text-slate-200 focus:border-purple-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Botones de Control principal */}
              <div className="mt-6 pt-5 border-t border-slate-800/60 space-y-3">
                {!isAuthenticated ? (
                  <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-lg flex items-start gap-2 text-[10px] text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <span className="font-bold">Requiere Autenticación:</span> Conecta tu cuenta de Google Workspace en el panel principal para buscar y escribir en tus documentos del Drive.
                    </div>
                  </div>
                ) : null}

                {isOrderGenRunning ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="w-full py-3 bg-red-650 hover:bg-red-550 border border-red-500/30 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4 text-white fill-white" />
                    DETENER ACCIÓN (STOP)
                  </button>
                ) : (
                  <button
                    disabled={!isAuthenticated}
                    onClick={handleRunOrderGeneration}
                    className={`w-full py-3 rounded-lg font-black text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                      !isAuthenticated
                        ? 'bg-slate-800 text-slate-500 border-slate-750 cursor-not-allowed opacity-55'
                        : 'bg-gradient-to-r from-purple-650 to-fuchsia-650 text-white border-purple-500/35 hover:from-purple-550 hover:to-fuchsia-550 hover:shadow-[0_0_15px_rgba(168,85,247,0.35)] cursor-pointer'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 text-white" />
                    PROCESAR MODELOS Y SHEET
                  </button>
                )}

                {/* Progress bar inside configuration */}
                {isOrderGenRunning && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono">
                      <span>PROGRESO DE AUTOMATIZACIÓN</span>
                      <span>{orderGenProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#030405] rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-300"
                        style={{ width: `${orderGenProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column Right: Live camera stream & console logs & extracted output (Cols 7) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              {/* Card 2: Live View Camera */}
              <div className="bg-[#111418]/85 border border-[#1e293b] rounded-xl p-4 flex flex-col h-[210px] overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Simulador Cámara en Vivo</span>
                  {isOrderGenRunning ? (
                    <span className="text-[8px] bg-red-400/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full uppercase animate-pulse font-bold tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      REC
                    </span>
                  ) : (
                    <span className="text-[8px] bg-slate-805 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full uppercase font-bold">
                      INACTIVO
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-[#1e293b] relative bg-black flex items-center justify-center">
                  <LiveRobotCamera isRunning={isOrderGenRunning} />
                </div>
              </div>

              {/* Card 3: Terminal Console */}
              <div className="bg-[#111418]/85 border border-[#1e293b] rounded-xl p-4 flex flex-col h-[210px] min-h-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                    Consola de Eventos
                  </span>
                </div>
                <div className="flex-1 min-h-0 rounded-lg bg-[#030405] border border-slate-800 p-3 font-mono text-[9px] text-slate-300 overflow-y-auto space-y-1 scrollbar-thin">
                  {orderGenLogs.map((log, index) => {
                    const isSystem = log.includes('[SYSTEM]');
                    const isWarning = log.includes('[WARNING');
                    const isError = log.includes('[ERROR]');
                    const isSheets = log.includes('[SHEETS]');
                    const isGemini = log.includes('[GEMINI]');
                    const isTv = log.includes('[TRADINGVIEW]');
                    const isPuppeteer = log.includes('[PUPPETEER]');
                    
                    let textColor = 'text-slate-300';
                    if (isError) textColor = 'text-red-400 font-semibold';
                    else if (isWarning) textColor = 'text-yellow-400';
                    else if (isSystem) textColor = 'text-purple-400 font-bold';
                    else if (isSheets) textColor = 'text-emerald-400';
                    else if (isGemini) textColor = 'text-sky-400';
                    else if (isTv || isPuppeteer) textColor = 'text-indigo-400';

                    return (
                      <div key={index} className={`leading-relaxed border-b border-slate-900/40 pb-0.5 last:border-0 ${textColor}`}>
                        {log}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 4: Extracted Output Orders */}
            <div className="flex-1 min-h-0 bg-[#111418]/85 border border-[#1e293b] rounded-xl p-5 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Órdenes Extraídas del Análisis
                </span>
                {ordersOutput && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(ordersOutput);
                      alert('¡Copiado al portapapeles exitosamente!');
                    }}
                    className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded text-[9px] hover:bg-purple-500/25 transition-all uppercase tracking-wider font-bold"
                  >
                    Copiar Órdenes
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 rounded-lg bg-[#030405] border border-slate-800 p-4 overflow-y-auto">
                {ordersOutput ? (
                  <div className="text-xs space-y-2 whitespace-pre-wrap leading-relaxed text-slate-100 font-mono">
                    {ordersOutput}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                    <TrendingUp className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider">No se han extraído órdenes todavía</p>
                    <p className="text-[10px] mt-1 font-light max-w-sm">
                      Ejecuta el robot de automatización superior para analizar tus gráficos y actualizar tu planilla. La IA redactará aquí las órdenes una vez completado.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'analysis') {
    return (
      <div className="h-screen w-full flex flex-col bg-[#07090c] p-6 text-[#e2e8f0] relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.01]" 
          style={{ backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
        />

        {/* Header Row */}
        <header className="flex justify-between items-center mb-6 relative z-10 pb-4 border-b border-slate-800/50">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f97316] mb-1 font-mono">MÓDULO DE SEÑALES Y REPORTE GENERAL</p>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Análisis de oportunidades
            </h1>
          </div>
          
          <button 
            onClick={() => setCurrentScreen('welcome')}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-white/5 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Inicio
          </button>
        </header>

        {/* Consolidated Sequential 4-in-1 Process Button Area */}
        <div className="relative z-10 mb-6 shrink-0">
          <button
            type="button"
            onClick={handleRunAllInOne}
            disabled={isAnalysisRunning || isDetailedAnalysisRunning || isUpdateAuditRunning || isAllInOneRunning || !isAuthenticated || !notebookLMCookies || !notebookLMUrl}
            className={`w-full group p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all border ${
              isAllInOneRunning
                ? 'bg-gradient-to-r from-teal-900/50 via-indigo-900/50 to-purple-900/50 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.25)]'
                : (isAnalysisRunning || isDetailedAnalysisRunning || isUpdateAuditRunning || !isAuthenticated || !notebookLMCookies || !notebookLMUrl)
                ? 'bg-slate-900/40 text-slate-500 border-slate-950 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-orange-600/10 via-amber-600/15 to-emerald-600/10 hover:from-orange-600/15 hover:via-[#f97316]/20 hover:to-emerald-600/15 border-orange-500/30 hover:border-orange-500/50 shadow-md cursor-pointer hover:shadow-[0_0_25px_rgba(249,115,22,0.15)]'
            }`}
          >
            <div className="flex items-center gap-4 text-left">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                isAllInOneRunning 
                  ? 'bg-indigo-500/25 text-indigo-400 animate-pulse' 
                  : 'bg-orange-500/10 text-orange-400 group-hover:scale-105'
              }`}>
                {isAllInOneRunning ? (
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                ) : (
                  <Sparkles className="w-6 h-6 text-orange-450 fill-orange-450/20" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  {isAllInOneRunning ? (
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      EJECUTANDO SECUENCIA COMPLETA: PASO {allInOneCurrentStep} DE 4
                    </span>
                  ) : (
                    <span>EJECUTAR SECUENCIA COMPLETA (4 PROCESOS EN 1)</span>
                  )}
                  {!isAllInOneRunning && (
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase font-mono font-bold tracking-wider">
                      Recomendado
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-light flex items-center flex-wrap gap-x-2">
                  <span className={`${allInOneCurrentStep === 1 ? 'text-amber-400 font-bold underline' : ''}`}>1. Proceso Simple</span>
                  <span className="text-slate-600">➜</span>
                  <span className={`${allInOneCurrentStep === 2 ? 'text-indigo-400 font-bold underline' : ''}`}>2. Sincronización de Archivos</span>
                  <span className="text-slate-600">➜</span>
                  <span className={`${allInOneCurrentStep === 3 ? 'text-orange-400 font-bold underline' : ''}`}>3. Actualizar Auditoría</span>
                  <span className="text-slate-600">➜</span>
                  <span className={`${allInOneCurrentStep === 4 ? 'text-emerald-400 font-bold underline' : ''}`}>4. Análisis Detallado</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isAllInOneRunning ? (
                <div className="flex flex-col items-end gap-1 font-mono text-[10px]">
                  <span className="text-indigo-300 font-bold animate-pulse uppercase">
                    Paso {allInOneCurrentStep}: {
                      allInOneCurrentStep === 1 ? 'Ejecutando Proceso Simple' :
                      allInOneCurrentStep === 2 ? 'Sincronizando Archivos' :
                      allInOneCurrentStep === 3 ? 'Actualizando Auditoría' :
                      'Realizando Análisis Detallado'
                    }...
                  </span>
                  <span className="text-slate-500">Mantén esta pestaña o ventana activa</span>
                </div>
              ) : (
                <div className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs uppercase tracking-widest rounded-lg transition-transform group-hover:scale-103 shadow-md flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                  INICIAR SECUENCIA
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Dynamic Split Screen Body */}
        {(isDetailedAnalysisRunning || isUpdateAuditRunning) ? (
          <div className="flex-grow flex flex-col gap-4 overflow-hidden relative z-10 min-h-0">
            {/* Progress Panel */}
            <div className="bg-[#111418] border border-slate-800 p-5 rounded-xl shadow-lg shrink-0 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="flex-grow w-full">
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-2">
                  <span className="flex items-center gap-2 text-amber-500 font-bold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f97316]" /> {isUpdateAuditRunning ? 'ACTUALIZANDO AUDITORÍA (MERCADO, ACCIONES, DRIVE)' : 'PROCESANDO ANÁLISIS DETALLADO (8 TICKERS SECUENCIALES)'}
                  </span>
                  <span className="font-bold text-[#f97316]">{isUpdateAuditRunning ? updateAuditProgress : detailedAnalysisProgress}%</span>
                </div>
                <div className="w-full bg-[#1e252e] h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${isUpdateAuditRunning ? updateAuditProgress : detailedAnalysisProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-mono">
                  {isUpdateAuditRunning 
                    ? 'Por favor, mantén esta ventana abierta. El robot está cambiando la resolución de NotebookLM a 1920x1080, desmarcando todo con "Select All", seleccionando las 8 acciones y "material estudio mercado", expandiendo la carpeta "Trading Strategy" para seleccionar "Resultados", leyendo el tercer prompt de Google Drive, procesando la IA y finalmente actualizando el documento "Auditoría aciertos y posibles mejoras" en Drive.'
                    : 'Por favor, mantén esta ventana abierta. El robot Puppeteer está buscando el bloc "Prompts nootbooklm", extrayendo cada indicador clave, ingresándolos uno a uno en NotebookLM y guardando los resultados consolidados.'
                  }
                </p>
              </div>

              {/* Stop Button Section */}
              <div className="shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleStop}
                  className="w-full md:w-auto px-5 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 border border-red-500/30 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.35)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  DETENER PROCESO
                </button>
              </div>
            </div>

            {/* Live Log Terminal and Live Camera Panel */}
            <div className="flex-grow grid md:grid-cols-2 gap-4 overflow-hidden min-h-0">
              {/* Terminal Panel */}
              <div className="bg-[#090b0e] border border-slate-800 rounded-xl p-5 flex flex-col overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3 shrink-0">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500/80 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-300 tracking-wider">LIVE_DETAILED_CONSOLA</span>
                  </div>
                  <span className="text-[9px] font-mono text-[#f97316] uppercase">PROCESANDO SECUENCIA</span>
                </div>

                {/* Terminal Logs Viewport */}
                <div className="flex-grow overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed space-y-2 pr-1 select-text scroll-smooth custom-scroll" id="detailed-terminal">
                  {(isUpdateAuditRunning ? updateAuditLogs : detailedAnalysisLogs).map((log, index) => {
                    let logColor = 'text-slate-300';
                    if (log.startsWith('[ERROR]')) logColor = 'text-red-400 font-semibold';
                    else if (log.startsWith('[SYSTEM]')) logColor = 'text-blue-400';
                    else if (log.startsWith('[SHEETS]')) logColor = 'text-emerald-400';
                    else if (log.startsWith('[YAHOO]')) logColor = 'text-amber-400';
                    else if (log.startsWith('[NOTEBOOK-LM]')) logColor = 'text-purple-400';
                    else if (log.startsWith('[WARNING]')) logColor = 'text-yellow-500';

                    return (
                      <div key={index} className={`flex gap-2 ${logColor}`}>
                        <span className="text-slate-600 shrink-0 select-none">❯</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Camera Panel */}
              <div className="bg-[#090b0e] border border-slate-800 rounded-xl p-5 flex flex-col overflow-hidden shadow-2xl">
                <LiveRobotCamera isRunning={isDetailedAnalysisRunning || isUpdateAuditRunning} />
              </div>
            </div>
          </div>
        ) : Object.keys(detailedReports).length > 0 ? (
          <div className="flex-grow grid lg:grid-cols-12 gap-6 relative z-10 overflow-hidden min-h-0">
            {/* Left Panel: Report Chat results */}
            <div className="lg:col-span-6 bg-[#111418] border border-slate-800 rounded-xl p-5 flex flex-col overflow-hidden shadow-xl min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded text-[9px] font-bold text-[#f97316] font-mono">
                    TICKER {activeDetailedIndex + 1} DE {analysisTickers.length}
                  </div>
                  <h3 className="text-xs font-bold text-slate-200">
                    Soporte Chat: <span className="text-[#f97316] font-mono">{analysisTickers[activeDetailedIndex]}</span>
                  </h3>
                </div>
                {/* Ticker Selector dots */}
                <div className="flex items-center gap-1">
                  {analysisTickers.map((t, idx) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (detailedReports[t]) {
                          setActiveDetailedIndex(idx);
                        }
                      }}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === activeDetailedIndex
                          ? 'bg-[#f97316] ring-2 ring-orange-500/35'
                          : detailedReports[t]
                          ? 'bg-emerald-500 hover:bg-emerald-400'
                          : 'bg-slate-800 cursor-not-allowed'
                      }`}
                      title={t}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDetailedReports({});
                      setDetailedResult(null);
                      setIsDetailedAnalysisRunning(false);
                      setCurrentScreen('welcome');
                    }}
                    className="ml-2 text-[10px] text-zinc-500 hover:text-red-400 uppercase font-mono transition-colors cursor-pointer"
                  >
                    Salir
                  </button>
                </div>
              </div>

              {/* Chat report content styling */}
              <div className="flex-grow overflow-y-auto pr-1 text-slate-300 leading-relaxed text-xs space-y-3 font-sans select-text scroll-smooth custom-scroll bg-slate-950/40 p-4 border border-slate-805/50 rounded-lg">
                <div className="prose prose-zinc prose-invert max-w-none text-xs leading-relaxed space-y-2">
                  {detailedReports[analysisTickers[activeDetailedIndex]] ? (
                    detailedReports[analysisTickers[activeDetailedIndex]].split('\n').map((line, lIdx) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('###')) {
                        return <h3 key={lIdx} className="text-sm font-bold text-white mt-3 mb-1.5">{trimmed.replace('###', '').trim()}</h3>;
                      }
                      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                        return <p key={lIdx} className="text-xs font-bold text-amber-400 mt-2">{trimmed.replace(/\*\*/g, '').trim()}</p>;
                      }
                      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                        return <li key={lIdx} className="ml-4 list-disc text-slate-300 my-0.5">{trimmed.substring(1).trim()}</li>;
                      }
                      // Render normal paragraph
                      return <p key={lIdx} className="text-slate-306 my-0.5">{trimmed}</p>;
                    })
                  ) : (
                    <div className="italic text-slate-500 text-center py-10">Ningún reporte disponible para este ticker.</div>
                  )}
                </div>
              </div>

              {/* Bottom interactive states for "Revisar" and "Comentario" */}
              <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col gap-3.5 shrink-0">
                {/* Revision input */}
                {isRevising && (
                  <div className="bg-slate-900/60 p-3 border border-slate-800 rounded-lg flex flex-col gap-2 animate-slideUp">
                    <label className="text-[10px] font-mono text-slate-400">INSTRUCCIÓN DE REVISIÓN EN DETALLE</label>
                    <textarea
                      value={reviewInstruction}
                      onChange={(e) => setReviewInstruction(e.target.value)}
                      placeholder="Escribe la corrección o nueva instrucción para NotebookLM (e.g., 'Modifica la dirección a PUT basados en el aumento sostenido')"
                      className="w-full h-14 bg-slate-950/85 border border-slate-800 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono resize-none text-[10.5px]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRevising(false)}
                        className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-550 hover:text-white transition-all rounded cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSendCustomInstruction}
                        disabled={isSavingEntry || !reviewInstruction.trim()}
                        className="px-3.5 py-1 bg-amber-600 hover:bg-amber-550 text-white text-[10px] uppercase font-bold transition-all rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingEntry ? <Loader2 className="w-3 h-3 animate-spin"/> : null}
                        Enviar Orden
                      </button>
                    </div>
                  </div>
                )}

                {/* Comment input */}
                {isCommenting && (
                  <div className="bg-slate-900/60 p-3 border border-slate-800 rounded-lg flex flex-col gap-2 animate-slideUp">
                    <label className="text-[10px] font-mono text-slate-400">COMENTARIO PARA REGISTRO DE ENTRADAS</label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Escribe el comentario que se guardará en la planilla..."
                      className="w-full h-14 bg-slate-950/85 border border-slate-800 rounded-md p-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono resize-none text-[10.5px]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCommenting(false)}
                        className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-550 hover:text-white transition-all rounded cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAcceptReport}
                        disabled={isSavingEntry}
                        className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-550 text-white text-[10px] uppercase font-bold transition-all rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingEntry ? <Loader2 className="w-3 h-3 animate-spin"/> : null}
                        Guardar & Continuar
                      </button>
                    </div>
                  </div>
                )}

                {/* Buttons controls */}
                {!isRevising && !isCommenting && (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={handleAcceptReport}
                      disabled={isSavingEntry}
                      className="bg-emerald-600/95 hover:bg-emerald-500 text-white font-bold py-2 px-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      {isSavingEntry ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Aceptar Reporte
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRevising(true);
                        setIsCommenting(false);
                      }}
                      className="bg-sky-600 hover:bg-sky-550 text-white font-bold py-2 px-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Revisar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommenting(true);
                        setIsRevising(false);
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Comentario
                    </button>
                  </div>
                )}

                {/* Visual Feedback notice and safety skip feature */}
                {sheetNotice && (
                  <div className={`p-3 rounded-lg border text-xs flex flex-col gap-2 mt-2 animate-fadeIn ${
                    sheetNotice.type === 'success' 
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' 
                      : 'bg-red-950/40 border-red-900 text-red-400'
                  }`}>
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-medium">{sheetNotice.message}</span>
                      <button 
                        type="button"
                        onClick={() => setSheetNotice(null)} 
                        className="text-[10px] hover:text-white uppercase font-mono px-1 rounded hover:bg-white/10"
                      >
                        ✕
                      </button>
                    </div>
                    {sheetNotice.type === 'error' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">¿Deseas continuar de todos modos?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSheetNotice(null);
                            setCommentText('');
                            setIsCommenting(false);
                            if (activeDetailedIndex < tickers.length - 1) {
                              setActiveDetailedIndex(prev => prev + 1);
                            } else {
                              setSheetNotice({ 
                                type: 'success', 
                                message: "Se ha omitido el último ticker. ¡Todos los reportes están completados!" 
                              });
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-705 text-slate-100 text-[10px] rounded transition-all font-bold uppercase cursor-pointer hover:bg-slate-700"
                        >
                          Ignorar y Continuar ➔
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Document screenshot preview with good zoom */}
            <div className="lg:col-span-6 bg-[#111418] border border-slate-800 rounded-xl p-5 flex flex-col overflow-hidden shadow-xl min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200">
                    Capturas del Ticker: <span className="text-[#f97316] font-mono">{analysisTickers[activeDetailedIndex]}</span>
                  </h3>
                </div>
                {/* Visual Zoom controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentZoom(prev => Math.max(50, prev - 25))}
                    className="p-1 px-2 bg-slate-800/60 hover:bg-slate-700/60 rounded text-xs text-slate-350 font-bold border border-slate-700/80"
                    title="Reducir Zoom"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 px-1">{currentZoom}%</span>
                  <button
                    type="button"
                    onClick={() => setCurrentZoom(prev => Math.min(300, prev + 25))}
                    className="p-1 px-2 bg-slate-800/60 hover:bg-slate-700/60 rounded text-xs text-slate-350 font-bold border border-slate-700/80"
                    title="Aumentar Zoom"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentZoom(100)}
                    className="p-1 px-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[9px] text-zinc-400 font-mono"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Zoomable Image Container */}
              <div className="flex-grow overflow-auto border border-slate-800/80 rounded-lg bg-black/90 p-4 relative custom-scroll select-none">
                <div 
                  className="transition-all duration-200 ease-out origin-top-left"
                  style={{ transform: `scale(${currentZoom / 100})`, width: '100%', minWidth: '350px' }}
                >
                  <div className="space-y-6">
                    <div>
                      <div className="text-left font-mono text-[9px] text-zinc-500 pb-1.5 mb-2 border-b border-zinc-900/60 flex justify-between">
                        <span>ORIGEN VISUAL : {analysisTickers[activeDetailedIndex]}</span>
                        <span>INDICADORES CLAVE - GRAFICO 1</span>
                      </div>
                      <TickerImage
                        src={`/api/images/tv_${analysisTickers[activeDetailedIndex]}_indicators1.png`}
                        alt={`Indicators chart 1 for ${analysisTickers[activeDetailedIndex]}`}
                        className="w-full rounded border border-slate-850 shadow-md object-contain max-h-[280px]"
                      />
                    </div>

                    <div>
                      <div className="text-left font-mono text-[9px] text-zinc-550 pb-1.5 mb-2 border-b border-zinc-900/60 flex justify-between">
                        <span>ORIGEN VISUAL : {analysisTickers[activeDetailedIndex]}</span>
                        <span>INDICADORES CLAVE - GRAFICO 2</span>
                      </div>
                      <TickerImage
                        src={`/api/images/tv_${analysisTickers[activeDetailedIndex]}_indicators2.png`}
                        alt={`Indicators chart 2 for ${analysisTickers[activeDetailedIndex]}`}
                        className="w-full rounded border border-slate-850 shadow-md object-contain max-h-[280px]"
                      />
                    </div>

                    <div>
                      <div className="text-left font-mono text-[9px] text-zinc-550 pb-1.5 mb-2 border-b border-zinc-900/60 flex justify-between">
                        <span>ORIGEN VISUAL : {analysisTickers[activeDetailedIndex]}</span>
                        <span>YAHOO KEY PARA NOTICIAS</span>
                      </div>
                      <TickerImage
                        src={`/api/images/yahoo_${analysisTickers[activeDetailedIndex]}_news_headlines.png`}
                        alt={`News headlines for ${analysisTickers[activeDetailedIndex]}`}
                        className="w-full rounded border border-slate-855 shadow-md object-contain max-h-[280px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-2 text-center text-[10px] text-slate-500">
                Aumenta el zoom (+ / -) y desplázate para un análisis exhaustivo de cada imagen.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-grow grid lg:grid-cols-12 gap-6 relative z-10 overflow-hidden min-h-0">
            
            {/* Left panel: Inputs & triggers (Col-5) */}
            <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1">
              
              {/* Google Authentication Status Card */}
              <div className="bg-[#111418]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
                <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2 font-mono">
                  <Database className="w-4 h-4 text-[#f97316]" /> CONEXIÓN GOOGLE WORKSPACE
                </h2>
                {isAuthenticated ? (
                  <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Usuario Conectado</span>
                      <span className="text-xs font-semibold text-emerald-400 mt-0.5 truncate max-w-[190px]" title={user?.email}>
                        {user?.email || 'SSO Activo'}
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={handleLogout}
                      className="px-2.5 py-1.5 border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400 text-[10px] font-bold uppercase transition-all rounded-md cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Cerrar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-slate-400 leading-relaxed font-light">
                      Este panel necesita acceso a tu cuenta para buscar el archivo de Sheets en Drive, realizar el copiado de tablas y editar tus Google Docs.
                    </p>
                    <button 
                      type="button"
                      onClick={handleLogin}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 text-[11px] font-bold uppercase tracking-wider transition-all rounded-lg cursor-pointer hover:shadow-[0_0_10px_rgba(59,130,246,0.35)] flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" /> Conectar Google Workspace
                    </button>
                  </div>
                )}
              </div>

                {/* NotebookLM Session & Config Card */}
                <div className="bg-[#111418]/95 border border-slate-800 rounded-xl p-4 shadow-lg flex-grow flex flex-col gap-3">
                  <h2 className="text-xs font-semibold text-slate-200 flex items-center justify-between font-mono">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#f97316]" /> CONFIGURACIÓN NOTEBOOKLM
                    </span>
                    {showCredsSavedMsg && (
                      <span className="text-[10px] text-emerald-400 font-bold tracking-wide animate-pulse">
                        ✓ Credenciales guardadas
                      </span>
                    )}
                  </h2>

                  {/* Google Account Email */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-slate-400 flex justify-between">
                      <span>CORREO DE CUENTA GOOGLE</span>
                      <span className="text-[8px] text-slate-500 font-bold">REFORZADOR / AUTO-LOGIN</span>
                    </label>
                    <input
                      type="email"
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      placeholder="ejemplo@gmail.com"
                      className="w-full bg-slate-900/80 border border-slate-800 shadow-inner rounded-md px-2.5 py-1 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#f97316] transition-all"
                    />
                  </div>

                  {/* Google Account Password */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-slate-400 flex justify-between">
                      <span>CONTRASEÑA GOOGLE</span>
                      <span className="text-[8px] text-slate-500 font-bold">REFORZADOR / AUTO-LOGIN</span>
                    </label>
                    <input
                      type="password"
                      value={googlePassword}
                      onChange={(e) => setGooglePassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-900/80 border border-slate-800 shadow-inner rounded-md px-2.5 py-1 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#f97316] transition-all"
                    />
                  </div>

                  {/* NotebookLM Cookies Input - Compact */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-slate-400 flex justify-between">
                      <span>COOKIES DE SESIÓN GOOGLE</span>
                      <span className="text-[8px] text-[#f97316] font-bold">REQUERIDO</span>
                    </label>
                    <textarea
                      value={notebookLMCookies}
                      onChange={(e) => setNotebookLMCookies(e.target.value)}
                      placeholder="Pega las cookies completas tomadas desde tu navegador..."
                      className="w-full h-11 bg-slate-900/80 border border-slate-800 shadow-inner rounded-md p-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-[#f97316] transition-all resize-none"
                    />
                  </div>

                {/* NotebookLM Notebook Destination URL - Compact */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400 flex justify-between">
                    <span>URL DEL BLOC DE NOTEBOOKLM</span>
                    <span className="text-[8px] text-[#f97316] font-bold">REQUERIDO</span>
                  </label>
                  <input
                    type="text"
                    value={notebookLMUrl}
                    onChange={(e) => setNotebookLMUrl(e.target.value)}
                    placeholder="https://notebooklm.google.com/notebook/..."
                    className="w-full bg-slate-900/80 border border-slate-800 shadow-inner rounded-md px-2.5 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#f97316] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                    <span>URL YAHOO FINANCE MARKET NEWS</span>
                    <span className="text-[8px] text-slate-500 font-bold">OPCIONAL</span>
                  </label>
                  <input
                    type="text"
                    value={yahooMarketNewsUrl}
                    onChange={(e) => setYahooMarketNewsUrl(e.target.value)}
                    placeholder="https://finance.yahoo.com/news/stock-market-today..."
                    className="w-full bg-slate-900/80 border border-slate-800 shadow-inner rounded-md px-2.5 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#f97316] transition-all"
                  />
                </div>


                {/* Action Buttons - Stacked & Compacted */}
                <div className="mt-auto pt-2.5 border-t border-slate-800/40 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    disabled={!notebookLMCookies.trim() || !notebookLMUrl.trim()}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 disabled:opacity-40 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Guardar Credenciales
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRunAnalysisProcess}
                      disabled={isAnalysisRunning || isDetailedAnalysisRunning || !isAuthenticated || !notebookLMCookies || !notebookLMUrl}
                      className={`py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md cursor-pointer flex items-center justify-center gap-1.5 relative overflow-hidden ${
                        isAnalysisRunning 
                        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/20 cursor-not-allowed'
                        : (!isAuthenticated || !notebookLMCookies || !notebookLMUrl)
                        ? 'bg-slate-800/40 text-slate-500 border border-slate-800/60 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-705 border border-slate-700/60 shadow-md'
                      }`}
                    >
                      {isAnalysisRunning ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Ejecutando...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                          Proceso Simple
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleRunDetailedAnalysis}
                      disabled={isAnalysisRunning || isDetailedAnalysisRunning || !isAuthenticated || !notebookLMCookies || !notebookLMUrl}
                      className={`py-2 text-[10px] font-extrabold uppercase tracking-wider transition-all rounded-md cursor-pointer flex items-center justify-center gap-1.5 relative overflow-hidden ${
                        isDetailedAnalysisRunning 
                        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/20 cursor-not-allowed'
                        : (!isAuthenticated || !notebookLMCookies || !notebookLMUrl)
                        ? 'bg-slate-800/40 text-slate-500 border border-slate-800/60 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black hover:shadow-[0_0_10px_rgba(249,115,22,0.3)] border border-orange-500/30 shadow-md'
                      }`}
                    >
                      {isDetailedAnalysisRunning ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analizando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-white" />
                          Análisis Detallado
                        </>
                      )}
                    </button>
                  </div>

                  {isAnalysisRunning || isDetailedAnalysisRunning || isUpdateAuditRunning ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-md cursor-pointer flex items-center justify-center gap-1.5 border bg-red-600 hover:bg-red-500 hover:shadow-[0_0_12px_rgba(239,68,68,0.35)] text-white border-red-500/35 shadow-md animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 text-white fill-white" />
                      DETENER AUTOMATIZACIÓN (STOP)
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleRunSourcesTest}
                        disabled={isDetailedAnalysisRunning || !isAuthenticated || !notebookLMCookies || !notebookLMUrl}
                        className={`w-full py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-md cursor-pointer flex items-center justify-center gap-1.5 border ${
                          isDetailedAnalysisRunning
                          ? 'bg-slate-800/40 text-slate-500 border-slate-800/60 cursor-not-allowed'
                          : (!isAuthenticated || !notebookLMCookies || !notebookLMUrl)
                          ? 'bg-slate-800/40 text-slate-500 border border-slate-800/60 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-550 hover:shadow-[0_0_12px_rgba(99,102,241,0.35)] text-indigo-100 border-indigo-500/35 shadow-md'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5 text-indigo-300" />
                        SINCRONIZACIÓN DE ARCHIVOS
                      </button>

                      <button
                        type="button"
                        onClick={handleRunUpdateAudit}
                        disabled={isAnalysisRunning || isDetailedAnalysisRunning || isUpdateAuditRunning || !isAuthenticated || !notebookLMCookies || !notebookLMUrl}
                        className={`w-full py-2 text-[10px] font-black uppercase tracking-wider transition-all rounded-md cursor-pointer flex items-center justify-center gap-1.5 border ${
                          isUpdateAuditRunning
                          ? 'bg-amber-600/20 text-amber-300 border border-amber-500/20 cursor-not-allowed'
                          : (!isAuthenticated || !notebookLMCookies || !notebookLMUrl || isAnalysisRunning || isDetailedAnalysisRunning)
                          ? 'bg-slate-800/40 text-slate-500 border border-slate-800/60 cursor-not-allowed'
                          : 'bg-[#f97316] hover:bg-orange-500 text-white border-[#f97316]/30 shadow-md hover:shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                        }`}
                      >
                        {isUpdateAuditRunning ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Actualizando Auditoría...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 text-white" />
                            Actualizar Auditoría
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {(!notebookLMCookies || !notebookLMUrl || !isAuthenticated) && (
                    <p className="text-[9px] text-amber-500/70 text-center font-mono">
                      ⚠️ {!isAuthenticated ? 'Conecta tu cuenta Google' : 'Configura las credenciales de NotebookLM'}
                    </p>
                  )}
                </div>

              </div>

            </div>

            {/* Right panel: Log Console & Status Grid (Col-7) */}
            <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden min-h-0">
              {/* Status Checklist Grid */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                
                {/* Task 1 status */}
                <div className="border border-slate-800/80 bg-[#111418]/80 p-3.5 rounded-xl flex items-center gap-3">
                  <div className="flex-grow">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono">1. Google Sheets</h4>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5">Duplicar última tabla</p>
                  </div>
                  {analysisProgress >= 35 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : isAnalysisRunning && analysisProgress < 35 ? (
                    <Loader2 className="w-5 h-5 text-[#f97316] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-800 bg-[#07090c]" />
                  )}
                </div>

                {/* Task 2 status */}
                <div className="border border-slate-800/80 bg-[#111418]/80 p-3.5 rounded-xl flex items-center gap-3">
                  <div className="flex-grow">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono">2. NotebookLM (Tickers)</h4>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5">Actualizar documentos</p>
                  </div>
                  {analysisProgress >= 50 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : isAnalysisRunning && analysisProgress >= 35 && analysisProgress < 50 ? (
                    <Loader2 className="w-5 h-5 text-[#f97316] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-800 bg-[#07090c]" />
                  )}
                </div>

                {/* Task 3 status */}
                <div className="border border-slate-800/80 bg-[#111418]/80 p-3.5 rounded-xl flex items-center gap-3">
                  <div className="flex-grow">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono">3. Yahoo Finance Scraper</h4>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5">Captura de 8 parrafos</p>
                  </div>
                  {analysisProgress >= 70 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : isAnalysisRunning && analysisProgress >= 50 && analysisProgress < 70 ? (
                    <Loader2 className="w-5 h-5 text-[#f97316] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-800 bg-[#07090c]" />
                  )}
                </div>

                {/* Task 4 status */}
                <div className="border border-slate-800/80 bg-[#111418]/80 p-3.5 rounded-xl flex items-center gap-3">
                  <div className="flex-grow">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono">4. Sincronizar Todo</h4>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5">Cargar material a LM</p>
                  </div>
                  {analysisProgress >= 100 && analysisResult?.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : isAnalysisRunning && analysisProgress >= 70 && analysisProgress < 100 ? (
                    <Loader2 className="w-5 h-5 text-[#f97316] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-800 bg-[#07090c]" />
                  )}
                </div>

              </div>

              {/* Progress Bar Panel */}
              <div className="bg-[#111418] border border-slate-800 p-4 rounded-xl shrink-0">
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>PROGRESO DEL PROCESO</span>
                  <span className="font-bold text-[#f97316]">{analysisProgress}%</span>
                </div>
                <div className="w-full bg-[#1e252e] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>

              {/* Split container for Console and Live Camera */}
              <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
                {/* Live Log Terminal Panel */}
                <div className="bg-[#090b0e] border border-slate-800 rounded-xl p-4 flex flex-col overflow-hidden shadow-2xl relative">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500/80 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-300 tracking-wider font-mono">LIVE_CONSOLE_LOGS</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">STREAM: ACTIVE</span>
                  </div>

                  {/* Terminal Logs Viewport */}
                  <div className="flex-grow overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed space-y-2 pr-1 select-text scroll-smooth custom-scroll" id="analysis-terminal">
                    {analysisLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 font-sans p-6 text-center">
                        <Database className="w-8 h-8 mb-2 opacity-30 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-400">Consola lista para recibir eventos...</p>
                        <p className="text-[10px] mt-1 text-slate-500">Ingresa las credenciales y pulsa "Inicio de Proceso" o "PRUEBA" para comenzar.</p>
                      </div>
                    ) : (
                      analysisLogs.map((log, index) => {
                        let logColor = 'text-slate-300';
                        if (log.startsWith('[ERROR]')) logColor = 'text-red-400 font-semibold';
                        else if (log.startsWith('[SYSTEM]')) logColor = 'text-blue-400';
                        else if (log.startsWith('[SHEETS]')) logColor = 'text-emerald-400';
                        else if (log.startsWith('[YAHOO]')) logColor = 'text-amber-400';
                        else if (log.startsWith('[NOTEBOOK-LM]')) logColor = 'text-purple-400';
                        else if (log.startsWith('[WARNING]')) logColor = 'text-yellow-500';

                        return (
                          <div key={index} className={`flex gap-2 ${logColor}`}>
                            <span className="text-slate-600 shrink-0 select-none">❯</span>
                            <span>{log}</span>
                          </div>
                        );
                      })
                    )}
                    {/* Scroll floor anchor */}
                    <span className="h-1 block" />
                  </div>
                  
                  {/* Optional result alert */}
                  {analysisResult && (
                    <div className={`mt-3 p-3.5 border rounded-xl text-xs flex items-center gap-2.5 shrink-0 ${
                      analysisResult.success 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      {analysisResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>¡Éxito total! El proceso ha finalizado correctamente.</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          <span>Fallo en la ejecución: {analysisResult.error || 'Error imprevisto en la secuencia'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Live Robot Camera Panel */}
                <div className="bg-[#090b0e] border border-slate-800 rounded-xl p-4 flex flex-col overflow-hidden shadow-2xl">
                  <LiveRobotCamera isRunning={isAnalysisRunning} />
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">
      {/* Sidebar: Configuration & Tickers */}
      <aside className="w-[325px] bg-[#111418] border-[#1e293b] border-r flex flex-col p-6 shrink-0 h-full">
        <button 
          onClick={() => setCurrentScreen('welcome')}
          className="mb-6 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-white/5 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg cursor-pointer w-full justify-center shadow-md active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Inicio
        </button>
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Automation Agent</p>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Market Studio <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-mono italic">v1.2</span>
          </h1>
        </div>

        <nav className="flex-grow space-y-8 overflow-y-auto pr-2 custom-scroll">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-4 font-bold">Tickers de Análisis</p>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {tickers.map(ticker => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    key={ticker} 
                    className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-default ${
                      activeTicker === ticker 
                        ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.25)]' 
                        : 'bg-white/5 border-transparent hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm font-mono font-bold tracking-wider">{ticker}</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                         disabled={isRunning || !isAuthenticated}
                         onClick={() => runAutomation([ticker], 'yahoo')}
                         className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                           isRunning || !isAuthenticated 
                             ? 'bg-slate-800/20 text-slate-600 border border-slate-900/60 cursor-not-allowed' 
                             : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 active:scale-95 cursor-pointer'
                         }`}
                         title="Yahoo Finance (Rojo)"
                      >
                         <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                         YAHOO
                      </button>

                      <button 
                         disabled={isRunning || !isAuthenticated}
                         onClick={() => runAutomation([ticker], 'tv')}
                         className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                           isRunning || !isAuthenticated 
                             ? 'bg-slate-800/20 text-slate-600 border border-slate-900/60 cursor-not-allowed' 
                             : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 active:scale-95 cursor-pointer'
                         }`}
                         title="TradingView (Verde)"
                      >
                         <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                         TV
                      </button>

                      <button 
                         disabled={isRunning || !isAuthenticated}
                         onClick={() => runAutomation([ticker], 'both')}
                         className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                           isRunning || !isAuthenticated 
                             ? 'bg-slate-800/20 text-slate-600 border border-slate-900/60 cursor-not-allowed' 
                             : 'bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 active:scale-95 cursor-pointer'
                         }`}
                         title="Yahoo + TradingView (Azul)"
                      >
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                         AMBOS
                      </button>
                      {result?.tickerDocs?.find(d => d.ticker === ticker) && (
                        <a 
                          href={`https://docs.google.com/document/d/${result.tickerDocs.find(d => d.ticker === ticker)?.docId}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-all"
                          title="Abrir Documento"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300" />
                        </a>
                      )}
                      <button 
                        onClick={() => removeTicker(ticker)} 
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                        title="Eliminar Ticker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="mt-4 flex gap-2">
              <input 
                type="text" 
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="AGREGAR..."
                className="w-full bg-[#08090b] px-3 py-2 rounded border border-slate-800 text-xs font-mono focus:border-blue-500 outline-none transition-colors placeholder:text-slate-700 uppercase"
                onKeyDown={(e) => e.key === 'Enter' && addTicker()}
              />
              <button 
                onClick={addTicker}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-white"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>        <div className="mt-auto border-t border-slate-800 pt-6 space-y-4">
          <div className="bg-[#08090b]/80 border border-slate-800 rounded-lg p-2.5 space-y-2.5">
            <h3 className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex justify-between items-center pb-1 border-b border-slate-800/60">
              <span>Cookies de Sesión</span>
              <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider">★ Anti-Captcha</span>
            </h3>
            
            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold flex justify-between items-center">
                <span>TradingView (sessionid)</span>
                <span className="text-slate-600 text-[7px] font-mono">s:NzYy...</span>
              </label>
              <input 
                type="password" 
                value={tvSessionId}
                onChange={(e) => {
                  setTvSessionId(e.target.value);
                  setIsTvSessionSaved(false);
                }}
                placeholder="Pegar Cookie sessionid"
                className="w-full bg-[#030405] px-2 py-1 rounded border border-slate-800 text-[11px] font-mono focus:border-blue-500 outline-none transition-colors text-slate-300 placeholder:text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold flex justify-between items-center">
                <span>Yahoo Finance Cookies</span>
                <span className="text-slate-600 text-[7px] font-mono">JSON</span>
              </label>
              <textarea 
                value={yahooCookies}
                onChange={(e) => {
                  setYahooCookies(e.target.value);
                  setIsYahooCookiesSaved(false);
                }}
                placeholder="Pegar arreglo JSON de cookies"
                className="w-full bg-[#030405] px-2 py-1 rounded border border-slate-800 text-[11px] font-mono focus:border-blue-500 outline-none transition-colors text-slate-300 placeholder:text-slate-800 h-24 resize-none"
              />
            </div>

            <button
              onClick={() => {
                saveTvSessionId();
                saveYahooCookies();
              }}
              className={`w-full py-1 rounded text-[9px] font-bold transition-all uppercase tracking-wider ${
                isTvSessionSaved && isYahooCookiesSaved 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 hover:shadow-[0_0_8px_rgba(59,130,246,0.25)]'
              }`}
            >
              {isTvSessionSaved && isYahooCookiesSaved ? '✓ Cookies Guardadas' : 'Guardar Cookies'}
            </button>
          </div>
          
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 tracking-wider">
            <span>GOOGLE DRIVE</span>
            {isAuthenticated ? (
              <span className="text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                CONECTADO
              </span>
            ) : (
              <span className="text-red-400">DESCONECTADO</span>
            )}
          </div>
          {isAuthenticated ? (
            <div className="space-y-2">
              
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400 transition-all text-[11px] font-bold uppercase tracking-widest"
              >
                <LogOut className="w-3 h-3" />
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <button 
              disabled={isLoggingIn}
              onClick={handleLogin}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white transition-all shadow-lg shadow-blue-900/40 text-[11px] font-bold uppercase tracking-widest ${isLoggingIn ? 'cursor-not-allowed' : ''}`}
            >
              <LogIn className="w-3 h-3" />
              {isLoggingIn ? 'Conectando...' : 'Conectar Google'}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col bg-[#0a0c10] relative">
        <header className="p-6 border-b border-[#1e293b] flex justify-between items-center bg-[#0a0c10]/80 backdrop-blur-md z-10">
          <div>
            <h2 className="text-2xl font-light text-slate-400 flex items-center gap-2">
              Status: <span className="font-bold text-white uppercase tracking-tighter">
                {isRunning ? 'PROCESANDO' : result?.success ? 'COMPLETADO' : 'IDLE'}
              </span>
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">TradingView Analysis & Data Aggregation Engine</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              disabled={isRunning || tickers.length === 0}
              onClick={runSimulation}
              className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] tracking-widest transition-all shadow-xl active:scale-95 border ${
                isRunning || tickers.length === 0
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                  : 'bg-transparent text-slate-400 border-slate-700 hover:bg-slate-700/20 cursor-pointer'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              SIMULACIÓN
            </button>
            
            <button 
              disabled={!isAuthenticated || isRunning || tickers.length === 0}
              onClick={() => runAutomation(undefined, 'yahoo')}
              className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] tracking-widest transition-all shadow-xl active:scale-95 border ${
                !isAuthenticated || isRunning || tickers.length === 0
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                  : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/35 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer'
              }`}
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
              YAHOO (ROJO)
            </button>

            <button 
              disabled={!isAuthenticated || isRunning || tickers.length === 0}
              onClick={() => runAutomation(undefined, 'tv')}
              className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] tracking-widest transition-all shadow-xl active:scale-95 border ${
                !isAuthenticated || isRunning || tickers.length === 0
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/35 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer'
              }`}
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
              TRADINGVIEW (VERDE)
            </button>

            <button 
              disabled={!isAuthenticated || isRunning || tickers.length === 0}
              onClick={() => runSequentialAutomation('both')}
              className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] tracking-widest transition-all shadow-xl active:scale-95 border ${
                !isAuthenticated || isRunning || tickers.length === 0
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                  : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500/35 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] cursor-pointer'
              }`}
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
              PROCESO COMPLETO
            </button>

            {lastDocId && (
              <a 
                href={`https://docs.google.com/document/d/${lastDocId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] tracking-widest bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer transition-all active:scale-95 shadow-xl"
              >
                <FileText className="w-3.5 h-3.5" />
                VER DOCUMENTO
              </a>
            )}

            <button 
              
              onClick={handleStop}
              className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] tracking-widest transition-all shadow-xl active:scale-95 border ${
                'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/35 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              STOP
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mock Chart / Status Visualizer */}
          <div className="flex-1 m-6 bg-[#050608] rounded-xl border border-[#1e293b] relative overflow-hidden flex flex-col items-center justify-center">
            {currentScreenshot ? (
              <div className="w-full h-full flex flex-col p-4 animate-fade-in z-10 text-slate-300">
                <div className="flex justify-between items-center bg-[#111418] border border-[#1e293b] rounded-t-lg px-4 py-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-mono tracking-widest text-[#94a3b8] uppercase font-bold">
                      {isRunning ? 'PANTALLA EN VIVO' : 'HISTORIAL DE CAPTURAS'} » {currentScreenshot.ticker}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-400 font-mono italic px-2.5 py-1 bg-blue-500/10 rounded border border-blue-500/20">
                      {currentScreenshot.step}
                    </span>
                    <button
                      onClick={() => setIsLightboxOpen(true)}
                      className="p-1 rounded bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white transition duration-200 border border-slate-700"
                      title="Pantalla Completa"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div 
                  onClick={() => setIsLightboxOpen(true)}
                  className="flex-grow bg-[#030405] flex items-center justify-center overflow-hidden border-x border-b border-[#1e293b] rounded-b-lg relative group min-h-0 cursor-zoom-in hover:border-blue-500/30 transition duration-300"
                >
                  <img
                    src={currentScreenshot.url}
                    alt={currentScreenshot.step}
                    className="max-w-full max-h-full object-contain rounded transition duration-500 group-hover:scale-[1.01]"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Overlay indicating completion state or progress */}
                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 text-[10px] font-mono flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                     <span className="text-slate-500 font-bold">PROGRESO:</span>
                     <span className="text-blue-400 font-bold font-mono">{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Horizontal Storyboard Gallery of all steps in the current run */}
                {screenshotHistory.length > 0 && (
                  <div className="mt-4 shrink-0 bg-[#0e1115] border border-slate-800 p-2.5 rounded-lg">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#64748b] mb-1.5">
                      Secuencia del Proceso Estructurada ({screenshotHistory.length} pasos recopilados)
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
                      {screenshotHistory.map((shot, sIndex) => (
                        <button
                          key={sIndex}
                          onClick={() => setCurrentScreenshot(shot)}
                          className={`flex-shrink-0 w-24 h-15 rounded border bg-black overflow-hidden relative transition-all ${
                            currentScreenshot.url === shot.url
                              ? 'border-blue-500 ring-2 ring-blue-500/30 scale-95'
                              : 'border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <img src={shot.url} alt={shot.step} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className={`absolute inset-0 ${currentScreenshot.url === shot.url ? 'bg-transparent' : 'bg-black/40 hover:bg-transparent'}`} />
                          <div className="absolute bottom-0 inset-x-0 bg-black/90 text-[7px] font-mono truncate px-1 py-0.5 text-center text-slate-400">
                            {shot.ticker}: {shot.step.split(':')[0] || shot.step}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isRunning ? (
              <div className="flex flex-col items-center gap-8 text-center px-12 max-w-lg z-10 animate-pulse">
                <div className="relative">
                  <div className="w-24 h-24 border border-blue-500/20 rounded-full animate-ping absolute inset-0" />
                  <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[#050608] relative">
                    <svg className="w-full h-full absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        className="text-slate-800 stroke-current"
                        strokeWidth="4"
                        cx="50"
                        cy="50"
                        r="45"
                        fill="transparent"
                      />
                      <circle
                        className="text-blue-500 stroke-current transition-all duration-300 ease-out"
                        strokeWidth="4"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="45"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 45}
                        strokeDashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                      <TrendingUp className="w-6 h-6 text-blue-500 mb-1" />
                      <span className="text-[10px] font-bold text-blue-400 font-mono tracking-widest">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight">Análisis en Curso</h3>
                  <p className="text-xs text-slate-500 leading-relaxed uppercase tracking-widest">
                    Iniciando navegador web seguro...<br />
                    Esperando primera captura de pantalla
                  </p>
                </div>
              </div>
            ) : result ? (
              <div className={`flex flex-col items-center gap-4 text-center px-12 max-w-lg z-10 ${result.success ? 'text-emerald-500' : 'text-red-500'}`}>
                {result.success ? <CheckCircle2 className="w-20 h-20 animate-bounce" /> : <AlertCircle className="w-20 h-20" />}
                <div className="space-y-4 flex flex-col items-center">
                  <div className="space-y-2 text-center">
                    <h3 className="text-xl font-bold tracking-tight">
                      {result.success ? 'Proceso Completado' : 'Proceso Fallido'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed uppercase tracking-widest max-w-sm">
                      {result.error || 'Autoejecución de reportes ha finalizado.'}
                    </p>
                  </div>

                  {/* If error is related to authentication / tokens, show direct action to reconnect */}
                  {!result.success && (
                    result.error?.toLowerCase().includes('credential') || 
                    result.error?.toLowerCase().includes('token') || 
                    result.error?.toLowerCase().includes('auth') ||
                    result.error?.toLowerCase().includes('unauthorized') ||
                    result.error?.toLowerCase().includes('sign in') ||
                    result.error?.toLowerCase().includes('verification')
                  ) ? (
                    <button
                      onClick={async () => {
                        await handleLogout();
                        setResult(null);
                        // Trigger login immediately
                        handleLogin();
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-[10px] tracking-widest rounded-lg border border-blue-500/30 transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.45)] cursor-pointer mt-2"
                    >
                      <LogIn className="w-4 h-4" />
                      Reconectar Cuenta de Google
                    </button>
                  ) : null}

                  {result.success && result.docId && (
                    <a
                      href={`https://docs.google.com/document/d/${result.docId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-400 font-bold uppercase text-[10px] tracking-widest rounded-full transition-all mt-4"
                    >
                      <FileText className="w-4 h-4" />
                      Abrir Documento
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-700 flex flex-col items-center gap-3 opacity-30 select-none">
                <LayoutDashboard className="w-20 h-20 stroke-[1]" />
                <p className="text-xs font-black uppercase tracking-widest italic">Awaiting Execution Trigger</p>
              </div>
            )}
            
            {/* Aesthetic Grid Overlays */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
              style={{ backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
            />
            <div className="absolute top-1/2 left-0 w-full h-[1px] border-t border-dashed border-slate-800 opacity-20" />
            <div className="absolute left-1/2 top-0 h-full w-[1px] border-l border-dashed border-slate-800 opacity-20" />
          </div>

          {/* System Logs Footer Area */}
          <footer className="h-[240px] px-6 pb-6 pt-0 bg-transparent flex gap-6 overflow-hidden">
            <div className="flex-1 bg-[#111418] rounded-xl border border-[#1e293b] flex flex-col overflow-hidden shadow-inner">
               <div className="px-4 py-2 bg-black/40 border-b border-[#1e293b] flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                     Terminal Log
                  </p>
                  <span className="text-[9px] font-mono text-slate-700">STD_OUT:MARKET_PROC</span>
               </div>
               <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 font-mono text-[10px] custom-scroll break-all">
                  {logs.length === 0 ? (
                    <p className="text-slate-800 italic uppercase">System ready. Waiting for session...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={`flex gap-3 leading-relaxed ${log.includes('[ERROR]') ? 'text-red-400 font-bold' : log.includes('[SIMULATION]') ? 'text-blue-300' : log.includes('[SYSTEM]') ? 'text-blue-500 font-bold' : 'text-emerald-500/80'}`}>
                        <span className="text-slate-800 shrink-0 select-none">{String(i+1).padStart(3, '0')}</span>
                        <span className="shrink-0 text-slate-600">»</span>
                        <span className="break-all whitespace-pre-wrap">{log}</span>
                      </div>
                    ))
                  )}
               </div>
            </div>

            <div className="w-64 bg-slate-900/30 rounded-xl border border-[#3b82f6]/20 p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/70 mb-3 flex items-center gap-2">
                  <Monitor className="w-3 h-3" />
                  Environ Settings
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">ENGINE:</span>
                    <span className="text-[10px] font-mono font-bold text-white uppercase">Puppeteer</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">BROWSER:</span>
                    <span className="text-[10px] font-mono font-bold text-white uppercase italic">Headless</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">INTERVAL:</span>
                    <span className="text-[10px] font-mono font-bold text-blue-400 uppercase">REAL-TIME</span>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-800">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>8 Cores Enabled</span>
                 </div>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Right Panel: Document Management */}
      <aside className="w-[280px] bg-[#111418] border-l border-[#1e293b] flex flex-col p-6 shrink-0 h-full">
         <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
            <Box className="w-4 h-4" />
            Workspace Docs
         </h3>

         <div className="space-y-6 overflow-y-auto pr-2 custom-scroll">
            <a 
              href={result?.docId ? `https://docs.google.com/document/d/${result.docId}/edit` : '#'}
              target={result?.docId ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="block p-4 bg-black/40 border border-[#1e293b] rounded-xl group hover:border-emerald-500/30 transition-all transition-colors duration-500"
            >
              <p className="text-xs font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">a material de studio mercado</p>
              <p className="text-[10px] text-slate-600 mb-3 font-medium">Contexto General del Mercado</p>
              <div className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full bg-emerald-500 transition-all duration-[2s] ${result?.success ? 'w-full shadow-[0_0_10px_#10b981]' : 'w-0'}`} />
              </div>
              <div className="flex justify-between items-center mt-3">
                 <span className="text-[9px] font-mono text-slate-500">SYNC_STATUS:</span>
                 <span className={`text-[9px] font-bold ${result?.success ? 'text-emerald-500' : 'text-slate-700'}`}>
                    {result?.success ? 'UP TO DATE' : 'PENDING'}
                 </span>
              </div>
            </a>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-2">INDIVIDUAL TICKER DOCS</p>
              <div className="grid gap-3">
                {result?.tickerDocs ? (
                  result.tickerDocs.map(({ ticker, docId }) => (
                    <a 
                      key={ticker} 
                      href={`https://docs.google.com/document/d/${docId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-black/20 border border-slate-800 rounded-lg hover:border-blue-500/30 transition-colors group"
                    >
                      <p className="text-[11px] font-mono font-bold text-slate-400 mb-2 underline decoration-slate-700 underline-offset-4 group-hover:text-blue-400">{ticker}.doc</p>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[9px] font-mono text-slate-500">SYNC_STATUS:</span>
                        <span className="text-[9px] font-bold text-emerald-500">
                          UP TO DATE
                        </span>
                      </div>
                    </a>
                  ))
                ) : (
                  tickers.slice(0, 3).map(ticker => (
                    <div key={ticker} className="p-3 bg-black/20 border border-slate-800 rounded-lg">
                      <p className="text-[11px] font-mono font-bold text-slate-400 mb-2 underline decoration-slate-700 underline-offset-4">{ticker}.doc</p>
                      <div className="grid grid-cols-4 gap-1">
                        {[1,2,3,4].map(n => (
                          <div key={n} className="aspect-square rounded-sm border bg-slate-800/20 border-slate-800 flex items-center justify-center">
                             <div className="w-1 h-1 rounded-full bg-slate-700" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                {!result?.tickerDocs && tickers.length > 3 && (
                   <p className="text-[10px] text-center text-slate-600 font-mono italic">+ {tickers.length - 3} more ticker documents</p>
                )}
              </div>
            </div>
         </div>

         <div className="mt-auto p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
           <p className="text-[10px] font-black text-blue-400 mb-2 uppercase tracking-tight">Session Intelligence</p>
           <p className="text-[10px] text-blue-300/50 leading-relaxed font-medium">
             Using Gemini Flash to prioritize news extraction. Automating TradingView via simulated input injection.
           </p>
         </div>
      </aside>

      {/* Lightbox / Fullscreen Modal */}
      {isLightboxOpen && currentScreenshot && (
        <div 
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md p-6 justify-center items-center animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Header controls inside lightbox */}
          <div className="absolute top-4 left-6 right-6 flex justify-between items-center text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col">
              <span className="text-xs font-mono tracking-widest text-[#94a3b8] uppercase font-black">
                {currentScreenshot.ticker} » PANTALLA COMPLETA
              </span>
              <span className="text-[10px] text-blue-450 font-mono mt-0.5">
                {currentScreenshot.step}
              </span>
            </div>
            <button 
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-750 border border-slate-750 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main expanded image container */}
          <div 
            className="w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center p-4 mt-6"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentScreenshot.url}
              alt={currentScreenshot.step}
              className="max-w-full max-h-full object-contain rounded-lg border border-slate-800 shadow-2xl select-none"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Bottom info banner inside lightbox */}
          <div className="absolute bottom-4 text-center text-[10px] uppercase tracking-widest font-mono text-slate-500" onClick={(e) => e.stopPropagation()}>
            Haz click fuera de la imagen o presiona la equis (✕) para cerrar
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-scroll::-webkit-scrollbar { width: 3px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}} />
    </div>
  );
}
