import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft, 
  RefreshCw, 
  PlusCircle, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
}

interface CalendarPanelProps {
  isAuthenticated: boolean;
  user: any;
  handleLogin: () => Promise<void>;
  onBack: () => void;
  getAccessToken: () => Promise<string | null>;
}

export default function CalendarPanel({
  isAuthenticated,
  user,
  handleLogin,
  onBack,
  getAccessToken
}: CalendarPanelProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorString, setErrorString] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [eventSummary, setEventSummary] = useState('Análisis de Ticker: AAPL');
  const [eventDescription, setEventDescription] = useState('Revisar indicadores de TradingView y actualizar planilla de órdenes.');
  
  // Set default start time to today + 1 hour, end time to today + 2 hours
  const [startDateTime, setStartDateTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    // Format to yyyy-MM-ddThh:mm matching datetime-local input requirements
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [endDateTime, setEndDateTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [filterQuery, setFilterQuery] = useState('');

  // Fetch upcoming calendar events
  const fetchCalendarEvents = async () => {
    setIsLoading(true);
    setErrorString(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo encontrar el token de acceso de Google. Inicia sesión para continuar.');
      }

      // Query primary calendar
      const nowISO = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(nowISO)}&maxResults=15&orderBy=startTime&singleEvents=true`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Error del servidor de Google (HTTP ${res.status})`);
      }

      const data = await res.json();
      setEvents(data.items || []);
    } catch (err: any) {
      console.error('Error fetching google calendar events:', err);
      setErrorString(err.message || 'Error al obtener eventos de Google Calendar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCalendarEvents();
    }
  }, [isAuthenticated]);

  // Handle Quick templates
  const applyPresetTemplate = (summary: string, description: string) => {
    setEventSummary(summary);
    setEventDescription(description);
    
    // Set start/end to prompt values immediately
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    setStartDateTime(formatDate(d));

    const endD = new Date(d);
    endD.setHours(endD.getHours() + 1);
    setEndDateTime(formatDate(endD));

    setSuccessMsg(`Plantilla "${summary}" cargada. Ajusta los tiempos si es necesario.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Create event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventSummary.trim()) {
      setErrorString('El resumen o título del evento es obligatorio.');
      return;
    }

    setIsLoading(true);
    setErrorString(null);
    setSuccessMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Token de acceso no disponible. Inicia sesión nuevamente.');
      }

      const startISO = new Date(startDateTime).toISOString();
      const endISO = new Date(endDateTime).toISOString();

      if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
        throw new Error('La fecha/hora de finalización debe ser posterior a la de inicio.');
      }

      const postBody = {
        summary: eventSummary,
        description: eventDescription,
        start: {
          dateTime: startISO,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
        },
        end: {
          dateTime: endISO,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
        },
        reminders: {
          useDefault: true
        }
      };

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postBody)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Error al guardar el evento en Google Calendar');
      }

      setSuccessMsg('✅ ¡Evento programado exitosamente en tu Google Calendar!');
      setTimeout(() => setSuccessMsg(null), 5000);
      
      // Refresh events
      await fetchCalendarEvents();
    } catch (err: any) {
      setErrorString(err.message || 'Ocurrió un error al agendar el recordatorio.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete event with user confirmation (SAFETY MANDATE REQUIREMENT)
  const handleDeleteEvent = async (eventId: string, summary: string) => {
    const isConfirmed = window.confirm(
      `¿Confirmas la eliminación del recordatorio "${summary}" de tu Google Calendar? Esta acción no se puede deshacer.`
    );
    if (!isConfirmed) return;

    setIsLoading(true);
    setErrorString(null);
    setSuccessMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Token vencido o no disponible.');
      }

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Fallo de Google API al remover el evento.');
      }

      setSuccessMsg(`🗑️ Evento "${summary}" removido exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      
      // Refresh list
      await fetchCalendarEvents();
    } catch (err: any) {
      setErrorString(err.message || 'Error al eliminar el evento.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter local events
  const filteredEvents = events.filter(e => {
    if (!filterQuery) return true;
    const matchLower = filterQuery.toLowerCase();
    const inSummary = (e.summary || '').toLowerCase().includes(matchLower);
    const inDesc = (e.description || '').toLowerCase().includes(matchLower);
    return inSummary || inDesc;
  });

  return (
    <div className="h-screen w-full flex flex-col bg-[#07090c] p-6 text-[#e2e8f0] relative overflow-hidden">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.01]" 
        style={{ backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />
      
      {/* Aesthetic background glow spheres */}
      <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      {/* Header Row */}
      <header className="flex justify-between items-center mb-6 shrink-0 relative z-10 pb-4 border-b border-slate-800/50">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f97316] mb-1 font-mono">SISTEMA INTEGRADO DE CALENDARIO</p>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-orange-450" />
            Google Calendar Scheduler
          </h1>
        </div>
        
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-white/5 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Inicio
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column: Form & Presets (Col 5) */}
        <div className="lg:col-span-5 flex flex-col min-h-0 gap-4">
          <div className="bg-[#111418]/85 border border-[#1e293b] rounded-xl p-5 flex flex-col min-h-0 overflow-y-auto custom-scroll">
            
            {/* Quick Templates Header */}
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Plantillas de Sesiones Rápidas</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                onClick={() => applyPresetTemplate(
                  'Sesión de Trading: AAPL',
                  'Fórmulas recalculadas en Google Sheets. Revisar modelo y ejecutar análisis de objetivos en TradingView.'
                )}
                className="p-3 text-left bg-black/40 border border-slate-800/80 hover:border-orange-500/30 hover:bg-orange-500/5 rounded-lg transition-all text-xs group cursor-pointer"
              >
                <div className="font-bold text-slate-200 group-hover:text-orange-400">🤖 Análisis Tickers</div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">Agendar análisis de indicadores</div>
              </button>
              
              <button
                type="button"
                onClick={() => applyPresetTemplate(
                  'Revisión Técnica: ATR & Stops',
                  'Analizar el indicador de rango verdadero promedio (ATR) para calibrar el tamaño óptimo de lotes y stops en tus activos.'
                )}
                className="p-3 text-left bg-black/40 border border-slate-800/80 hover:border-amber-500/30 hover:bg-amber-500/5 rounded-lg transition-all text-xs group cursor-pointer"
              >
                <div className="font-bold text-slate-200 group-hover:text-amber-400">📊 Calibración de ATR</div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">Revisar stop loss y objetivos</div>
              </button>

              <button
                type="button"
                onClick={() => applyPresetTemplate(
                  'Cierre de Órdenes Semanal',
                  'Auditoría semanal y descarga del reporte de Órdenes de Compra de Google Docs al cierre de mercado de Nueva York.'
                )}
                className="p-3 text-left bg-black/40 border border-slate-800/80 hover:border-yellow-500/30 hover:bg-yellow-500/5 rounded-lg transition-all text-xs group cursor-pointer"
              >
                <div className="font-bold text-slate-200 group-hover:text-yellow-400">📅 Auditoría Semanal</div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">Guardar reportes generales</div>
              </button>

              <button
                type="button"
                onClick={() => applyPresetTemplate(
                  'Prueba de Login & Verificación',
                  'Paso manual para desbloquear credenciales de Yahoo Finance con envío de tokens OTP mediante API de Gmail.'
                )}
                className="p-3 text-left bg-black/40 border border-slate-800/80 hover:border-blue-500/30 hover:bg-blue-500/5 rounded-lg transition-all text-xs group cursor-pointer"
              >
                <div className="font-bold text-slate-200 group-hover:text-blue-400">✉️ Prueba de OTP Yahoo</div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">Verificar sesión Yahoo Finance</div>
              </button>
            </div>

            {/* Event Form */}
            <div className="flex items-center gap-2 mb-4 pt-3 border-t border-slate-800/40">
              <PlusCircle className="w-4 h-4 text-orange-450" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Agendar Nuevo Recordatorio</h3>
            </div>

            {!isAuthenticated ? (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-800 rounded-lg">
                <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acceso Restringido</p>
                <p className="text-[10px] text-slate-500 mt-1 mb-4 leading-normal">
                  Necesitas conectar tu cuenta para vincular tu Google Calendar.
                </p>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="px-4 py-2 bg-orange-655 hover:bg-orange-555 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all"
                >
                  Conectar Google Workspace
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Título o Ticker del Recordatorio
                  </label>
                  <input
                    type="text"
                    required
                    value={eventSummary}
                    onChange={(e) => setEventSummary(e.target.value)}
                    placeholder="Eje: Rebalanceo AAPL"
                    className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-205 focus:border-orange-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Descripción del Trabajo
                  </label>
                  <textarea
                    rows={3}
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Escribe los pasos a realizar o notas del mercado..."
                    className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 focus:border-orange-500 outline-none transition-all custom-scroll resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Hora de Inicio
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 focus:border-orange-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Hora de Fin
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className="w-full bg-[#030405] px-3 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 focus:border-orange-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando en Calendario...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      Vincular / Crear Recordatorio
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>

        {/* Right Column: Events List Viewer (Col 7) */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-[#111418]/85 border border-[#1e293b] rounded-xl p-5 overflow-hidden">
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0 pb-3 border-b border-slate-800/40 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-450" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Próximos Eventos en tu Calendario</h3>
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Buscar eventos..."
                  className="bg-black/40 border border-slate-800 text-xs px-2.5 py-1 rounded-md text-slate-300 focus:outline-none focus:border-orange-500 w-full md:w-36 font-sans placeholder:text-slate-700"
                />

                <button
                  type="button"
                  onClick={fetchCalendarEvents}
                  disabled={isLoading}
                  className="p-1 px-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-md text-xs cursor-pointer flex items-center gap-1 transition-all"
                  title="Refrescar lista"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            )}
          </div>

          {/* Messages Alerts banner */}
          <AnimatePresence>
            {errorString && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorString}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Events Lists Container */}
          <div className="flex-grow overflow-y-auto custom-scroll pr-1 space-y-3">
            {!isAuthenticated ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-8">
                <Calendar className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-xs font-bold uppercase tracking-wide">Inicia sesión de Google para ver tu agenda</p>
                <p className="text-[10px] mt-1 font-light max-w-sm">
                  Al conectar tu Google Workspace, este panel cargará de manera segura y confidencial tus próximos compromisos y recordatorios de trading.
                </p>
              </div>
            ) : isLoading && events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#f97316] mb-3" />
                <p className="text-xs font-mono uppercase">Consultando API de Google Calendar...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-8">
                <Calendar className="w-12 h-12 opacity-10 mb-3" />
                <p className="text-xs font-bold uppercase tracking-wide">No se encontraron eventos próximos</p>
                <p className="text-[10px] mt-1 font-light max-w-xs">
                  {filterQuery ? 'Prueba ajustando el término de búsqueda para localizar tu recordatorio.' : 'Crea un nuevo recordatorio desde el menú de la izquierda para ver tus actividades.'}
                </p>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const startStr = ev.start?.dateTime || ev.start?.date || '';
                const endStr = ev.end?.dateTime || ev.end?.date || '';
                
                // Parse date formatting
                let formattedStart = 'Sin Fecha';
                let formattedTime = '';
                if (startStr) {
                  const d = new Date(startStr);
                  formattedStart = d.toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  }).toUpperCase();
                  
                  if (ev.start?.dateTime) {
                    formattedTime = d.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  }
                }

                const isPresetTradingEvent = ev.summary.toLowerCase().includes('sesión') || 
                                             ev.summary.toLowerCase().includes('trading') || 
                                             ev.summary.toLowerCase().includes('revisión') || 
                                             ev.summary.toLowerCase().includes('ticker') ||
                                             ev.summary.toLowerCase().includes('atr');

                return (
                  <div 
                    key={ev.id} 
                    className={`p-4 rounded-xl border transition-all duration-300 bg-black/40 ${isPlayingStatus(startStr, endStr) ? 'border-orange-500/40 bg-orange-500/5' : 'border-slate-800/80 hover:border-slate-705'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      
                      {/* Left: Ticker-like Date square */}
                      <div className={`p-2 rounded-lg text-center font-mono min-w-[55px] ${isPlayingStatus(startStr, endStr) ? 'bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316]' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                        <div className="text-[11px] font-extrabold tracking-tighter leading-tight">
                          {formattedStart.split(' ').slice(1).join(' ') || formattedStart}
                        </div>
                        <div className="text-[8px] font-bold opacity-60 tracking-wider">
                          {formattedStart.split(' ')[0] || ''}
                        </div>
                        {formattedTime && (
                          <div className="text-[9px] mt-1 text-slate-300 font-bold border-t border-slate-800/80 pt-0.5">
                            {formattedTime}
                          </div>
                        )}
                      </div>

                      {/* Center: Event title & desc */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-extrabold text-white truncate uppercase tracking-wide">
                            {ev.summary}
                          </h4>
                          
                          {isPlayingStatus(startStr, endStr) ? (
                            <span className="text-[8px] uppercase tracking-widest font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full select-none animate-pulse font-bold shrink-0">
                              En Curso
                            </span>
                          ) : isPresetTradingEvent ? (
                            <span className="text-[8px] uppercase tracking-widest font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full select-none font-bold shrink-0">
                              Trading
                            </span>
                          ) : null}
                        </div>
                        
                        {ev.description ? (
                          <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                            {ev.description}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-600 font-mono italic">Sin descripción de trabajo.</p>
                        )}
                      </div>

                      {/* Right actions: Link & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ev.htmlLink && (
                          <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md hover:bg-slate-800/80 text-slate-400 hover:text-white border border-transparent hover:border-slate-800 transition-all"
                            title="Ver en Google Calendar"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id, ev.summary)}
                          className="p-1.5 rounded-md hover:bg-red-950/20 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-950/50 transition-all cursor-pointer"
                          title="Eliminar recordatorio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/40 text-[10px] font-mono text-slate-500 flex justify-between select-none shrink-0">
            <span>Sincronizado vía OAuth 2.0 | API Scope: calendar.events</span>
            <span>Maneja el tiempo de tus operaciones analíticas</span>
          </div>

        </div>

      </div>
    </div>
  );
}

// Check if event is happening in the hour
function isPlayingStatus(startStr?: string, endStr?: string) {
  if (!startStr) return false;
  const now = new Date().getTime();
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : start + 3600 * 1000;
  return now >= start && now <= end;
}
