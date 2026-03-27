import { useMemo, useState, useEffect } from "react";
import { useDashboardData, useTriggerRefresh } from "@/hooks/use-dashboard";
import { LiveClock } from "@/components/LiveClock";
import { ProgressRing } from "@/components/ProgressRing";
import { RotatingMessage } from "@/components/RotatingMessage";
import { RecentActivity } from "@/components/RecentActivity";
import { motion } from "framer-motion";
import {
  RefreshCcw, Star, TrendingUp, TrendingDown, Target, CalendarDays,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const { data, isLoading, isError, dataUpdatedAt } = useDashboardData();
  const refresh = useTriggerRefresh();
  const [lastUpdatedText, setLastUpdatedText] = useState("—");

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const update = () =>
      setLastUpdatedText(formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: es }));
    update();
    const t = setInterval(update, 15_000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  const daysUntilStart = useMemo(() => {
    if (!data) return undefined;
    const start = parseISO(data.trimesterStart);
    const today = new Date();
    if (today >= start) return 0;
    return differenceInDays(start, today);
  }, [data]);

  const daysRemaining = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, differenceInDays(parseISO(data.trimesterEnd), new Date()));
  }, [data]);

  const remainingToGoal = data ? Math.max(0, data.objective - data.netScore) : 270;

  const reviewsPerDayNeeded = useMemo(() => {
    if (!daysRemaining || !remainingToGoal) return "0.0";
    return (remainingToGoal / daysRemaining).toFixed(1);
  }, [daysRemaining, remainingToGoal]);

  const trimesterLabel = useMemo(() => {
    if (!data) return "";
    const s = new Date(data.trimesterStart);
    const e = new Date(data.trimesterEnd);
    return `${s.toLocaleString("es-ES", { month: "short" }).toUpperCase()}–${e.toLocaleString("es-ES", { month: "short" }).toUpperCase()} ${s.getFullYear()}`;
  }, [data]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-white gap-5">
        <div className="w-12 h-12 rounded-full border-2 border-blue-100 border-t-blue-500 animate-spin" />
        <div className="font-display font-bold text-slate-800 text-2xl">Cargando panel…</div>
        <div className="text-sm text-slate-400">Obteniendo datos en tiempo real</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-3xl p-12 flex flex-col items-center gap-5 max-w-sm text-center shadow-lg border border-slate-200">
          <div className="text-4xl">⚠️</div>
          <div className="font-display font-bold text-slate-800 text-2xl">Conexión perdida</div>
          <div className="text-sm text-slate-500">No se puede conectar al servidor.</div>
          <button onClick={() => window.location.reload()}
            className="px-7 py-2.5 bg-blue-600 text-white font-display font-bold rounded-xl hover:bg-blue-700 transition text-sm">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const googleTotal = data.googleTotalReviews ?? 0;
  const googleAvg   = data.googleAvgRating    ?? 0;

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">

      {/* ─── CABECERA ───────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-7"
        style={{ height: 68, background: "white", borderBottom: "1px solid #e2e8f0" }}
      >
        {/* Marca */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl font-display font-extrabold text-white text-base"
            style={{ width: 40, height: 40, background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
          >
            EL
          </div>
          <div>
            <div className="font-display font-bold text-slate-900" style={{ fontSize: "1.1rem", lineHeight: 1.1 }}>
              Panel de Reseñas
            </div>
            <div className="text-xs text-slate-400 font-medium tracking-wide">Experiencia del Cliente · Eltex</div>
          </div>
        </div>

        {/* Trimestre */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100">
          <span className="live-dot" style={{ background: "#3b82f6", boxShadow: "0 0 0 0 rgba(59,130,246,0.4)" }} />
          <span className="font-display font-bold text-blue-700">{data.trimesterName}</span>
          <span className="text-xs font-semibold text-blue-500">{trimesterLabel}</span>
        </div>

        <LiveClock />
      </header>

      {/* ─── PRINCIPAL ──────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-0"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: "14px 18px" }}
      >

        {/* COL 1 — Anillo de Progreso */}
        <div className="card rounded-2xl flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <div className="label">Puntuación Neta Q2</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ProgressRing netScore={data.netScore} objective={data.objective} daysUntilStart={daysUntilStart} />
          </div>

          {/* Tira resumen inferior */}
          <div className="mx-5 mb-5 rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-center justify-between">
            <div className="text-center">
              <div className="font-display font-bold text-emerald-600 text-xl">{data.allTimePositive}</div>
              <div className="text-xs text-slate-400 font-medium">Total +</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <div className="font-display font-bold text-rose-500 text-xl">{data.allTimeNegative}</div>
              <div className="text-xs text-slate-400 font-medium">Total –</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center">
              <div className="font-display font-bold text-slate-800 text-xl">{data.allTimeTotal}</div>
              <div className="text-xs text-slate-400 font-medium">Almacenadas</div>
            </div>
          </div>
        </div>

        {/* COL 2 — Estadísticas */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Google Maps En Vivo */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-elevated rounded-2xl overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <span className="label">Google Maps · En vivo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-amber-500 text-xl">{googleAvg.toFixed(1)}</span>
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-xs text-slate-400 font-medium mb-0.5">Total de Reseñas</div>
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="font-display font-bold text-slate-900"
                  style={{ fontSize: "3.4rem", lineHeight: 1 }}
                >
                  {googleTotal.toLocaleString("es-ES")}
                </motion.div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="w-5 h-5"
                      style={{ color: i < Math.round(googleAvg) ? "#f59e0b" : "#e2e8f0", fill: i < Math.round(googleAvg) ? "#f59e0b" : "transparent" }} />
                  ))}
                </div>
                <span className="text-xs text-slate-400">valoración oficial en Google Maps</span>
              </div>
            </div>
          </motion.div>

          {/* 4 tarjetas de estadísticas */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <StatCard label="Positivas" value={data.allTimePositive ?? 0}
              color="#059669" bg="#f0fdf4" border="#bbf7d0"
              icon={<TrendingUp className="w-4 h-4" style={{ color: "#059669" }} />}
              sublabel="4–5★ total" />
            <StatCard label="Negativas" value={data.allTimeNegative ?? 0}
              color="#dc2626" bg="#fef2f2" border="#fecaca"
              icon={<TrendingDown className="w-4 h-4" style={{ color: "#dc2626" }} />}
              sublabel="1–2★ total" />
            <StatCard label="Meta Q2" value={remainingToGoal}
              color="#2563eb" bg="#eff6ff" border="#bfdbfe"
              icon={<Target className="w-4 h-4" style={{ color: "#2563eb" }} />}
              sublabel={`de ${data.objective}`} />
            <StatCard label="Días Restantes" value={daysRemaining} suffix="d"
              color="#d97706" bg="#fffbeb" border="#fde68a"
              icon={<CalendarDays className="w-4 h-4" style={{ color: "#d97706" }} />}
              sublabel="hasta fin de Q2" />
          </div>

          {/* Ritmo Diario */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card-elevated rounded-2xl p-5 flex-1 flex flex-col justify-between"
          >
            <div className="label">Ritmo Diario Necesario</div>
            <div className="flex items-end gap-2 mt-2">
              <span className="font-display font-bold text-slate-900" style={{ fontSize: "3.4rem", lineHeight: 1 }}>
                {reviewsPerDayNeeded}
              </span>
              <span className="text-slate-400 text-sm mb-1.5">reseñas / día</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, (data.netScore / data.objective) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {data.netScore}/{data.objective}
              </span>
            </div>
          </motion.div>
        </div>

        {/* COL 3 — Reseñas Recientes */}
        <div className="flex flex-col min-h-0">
          <RecentActivity reviews={data.recentActivity ?? []} />
        </div>
      </main>

      {/* ─── PIE DE PÁGINA ──────────────────────────────────────── */}
      <footer
        className="flex-shrink-0 flex items-center justify-between px-7 gap-6"
        style={{ height: 56, background: "white", borderTop: "1px solid #e2e8f0" }}
      >
        <RotatingMessage />

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="live-dot" />
            <span className="text-xs font-medium text-slate-500">
              Actualizado {lastUpdatedText}
            </span>
          </div>
          <button
            onClick={() => refresh.mutate(undefined)}
            disabled={refresh.isPending}
            title="Forzar actualización"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition disabled:opacity-40"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-blue-600 ${refresh.isPending ? "animate-spin" : ""}`} />
            <span className="text-xs font-semibold text-blue-600">
              {refresh.isPending ? "Actualizando…" : "Actualizar"}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label, value, suffix, color, bg, border, icon, sublabel,
}: {
  label: string; value: number; suffix?: string;
  color: string; bg: string; border: string;
  icon: React.ReactNode; sublabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 flex flex-col justify-between border"
      style={{ background: bg, borderColor: border, minHeight: 96 }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </div>
        {icon}
      </div>
      <div className="flex items-end justify-between mt-2">
        <div className="font-display font-bold" style={{ fontSize: "2.2rem", lineHeight: 1, color }}>
          {value.toLocaleString("es-ES")}{suffix && <span className="text-base ml-0.5 opacity-50">{suffix}</span>}
        </div>
        {sublabel && <span className="text-xs font-medium mb-0.5" style={{ color, opacity: 0.6 }}>{sublabel}</span>}
      </div>
    </motion.div>
  );
}
