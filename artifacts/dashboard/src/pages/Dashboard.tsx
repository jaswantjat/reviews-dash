import React, { useMemo, useState, useEffect } from "react";
import { useDashboardData, useTriggerRefresh } from "@/hooks/use-dashboard";
import { LiveClock } from "@/components/LiveClock";
import { ProgressRing } from "@/components/ProgressRing";
import { RotatingMessage } from "@/components/RotatingMessage";
import { RecentActivity } from "@/components/RecentActivity";
import { motion } from "framer-motion";
import {
  RefreshCcw, Star, TrendingUp, TrendingDown, Target, CalendarDays, Zap,
} from "lucide-react";
import eltexLogo from "@assets/eltex-logo.png";
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

  const progressPercent = data ? Math.min(100, (data.netScore / data.objective) * 100) : 0;

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center gap-5" style={{ background: "hsl(225,40%,97%)" }}>
        <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#5b6cf0", borderRightColor: "#7c4dff" }} />
        <div className="font-display font-bold text-xl" style={{ color: "#0f172a" }}>Cargando panel…</div>
        <div className="text-sm" style={{ color: "#94a3b8" }}>Obteniendo datos en tiempo real</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: "hsl(225,40%,97%)" }}>
        <div className="surface-card-elevated rounded-3xl p-12 flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="text-4xl">⚠️</div>
          <div className="font-display font-bold text-2xl" style={{ color: "#0f172a" }}>Conexión perdida</div>
          <div className="text-sm" style={{ color: "#64748b" }}>No se puede conectar al servidor.</div>
          <button onClick={() => window.location.reload()}
            className="px-7 py-2.5 text-white font-display font-bold rounded-xl hover:opacity-90 transition text-sm"
            style={{ background: "linear-gradient(135deg, #5b6cf0, #7c4dff)" }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const googleTotal = data.googleTotalReviews ?? 0;
  const googleAvg   = data.googleAvgRating    ?? 0;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: "hsl(225,40%,97%)" }}>

      {/* ─── CABECERA ───────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-7"
        style={{ height: 68, background: "#ffffff", borderBottom: "1px solid #e6eaf5", boxShadow: "0 1px 4px rgba(91,108,240,0.06)" }}
      >
        <div className="flex items-center gap-4">
          <img src={eltexLogo} alt="Eltex" className="h-7" />
          <div className="w-px h-7" style={{ background: "#e6eaf5" }} />
          <div>
            <div className="font-display font-bold" style={{ fontSize: "1rem", lineHeight: 1.15, color: "#0f172a" }}>
              Panel de Reseñas
            </div>
            <div className="text-xs font-medium tracking-wide" style={{ color: "#94a3b8" }}>Experiencia del Cliente</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-5 py-2 rounded-full" style={{ background: "rgba(91,108,240,0.08)", border: "1px solid rgba(91,108,240,0.18)" }}>
          <span className="live-dot" style={{ background: "#5b6cf0", boxShadow: "0 0 0 0 rgba(91,108,240,0.4)" }} />
          <span className="font-display font-bold" style={{ color: "#5b6cf0" }}>{data.trimesterName}</span>
          <span className="text-xs font-semibold" style={{ color: "rgba(91,108,240,0.55)" }}>{trimesterLabel}</span>
        </div>

        <LiveClock />
      </header>

      {/* ─── PRINCIPAL ──────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-0"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: "14px 18px" }}
      >
        {/* COL 1 — Anillo de Progreso */}
        <div className="surface-card rounded-2xl flex flex-col overflow-hidden">
          <div className="px-5 pt-5 pb-0 flex items-center justify-between">
            <div className="label">Puntuación Neta {data.trimesterName}</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ProgressRing netScore={data.netScore} objective={data.objective} daysUntilStart={daysUntilStart} />
          </div>

          <div className="mx-5 mb-5 rounded-xl p-4 flex items-center justify-between" style={{ background: "#f8faff", border: "1px solid #e6eaf5" }}>
            <div className="text-center">
              <div className="font-display font-bold text-xl" style={{ color: "#10b981" }}>{data.allTimePositive}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: "#94a3b8" }}>Total +</div>
            </div>
            <div className="w-px h-8" style={{ background: "#e6eaf5" }} />
            <div className="text-center">
              <div className="font-display font-bold text-xl" style={{ color: "#ef4444" }}>{data.allTimeNegative}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: "#94a3b8" }}>Total –</div>
            </div>
            <div className="w-px h-8" style={{ background: "#e6eaf5" }} />
            <div className="text-center">
              <div className="font-display font-bold text-xl" style={{ color: "#0f172a" }}>{data.allTimeTotal}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: "#94a3b8" }}>Almacenadas</div>
            </div>
          </div>
        </div>

        {/* COL 2 — Estadísticas */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Google Maps En Vivo */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card-elevated rounded-2xl overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f0f2fb" }}>
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <span className="label">Google Maps · En vivo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-xl" style={{ color: "#d97706" }}>{googleAvg.toFixed(1)}</span>
                <Star className="w-4 h-4" style={{ fill: "#f59e0b", color: "#f59e0b" }} />
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "#94a3b8" }}>Total de Reseñas</div>
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="font-display font-bold"
                  style={{ fontSize: "3.2rem", lineHeight: 1, color: "#0f172a" }}
                >
                  {googleTotal.toLocaleString("es-ES")}
                </motion.div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="w-5 h-5"
                      style={{ color: i < Math.round(googleAvg) ? "#f59e0b" : "#e2e8f0", fill: i < Math.round(googleAvg) ? "#f59e0b" : "#e2e8f0" }} />
                  ))}
                </div>
                <span className="text-xs" style={{ color: "#94a3b8" }}>valoración oficial en Google Maps</span>
              </div>
            </div>
          </motion.div>

          {/* 4 tarjetas de estadísticas */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <StatCard label="Positivas" value={data.allTimePositive ?? 0}
              color="#10b981" bg="#f0fdf7" border="#c6f0de"
              icon={<TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />}
              sublabel="4–5★ total" />
            <StatCard label="Negativas" value={data.allTimeNegative ?? 0}
              color="#ef4444" bg="#fff5f5" border="#fecaca"
              icon={<TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />}
              sublabel="1–2★ total" />
            <StatCard label={`Faltan para Meta`} value={remainingToGoal}
              color="#5b6cf0" bg="#f0f2ff" border="#c7ccf9"
              icon={<Target className="w-4 h-4" style={{ color: "#5b6cf0" }} />}
              sublabel={`de ${data.objective}`} />
            <StatCard label="Días Restantes" value={daysRemaining} suffix="d"
              color="#d97706" bg="#fffbeb" border="#fde68a"
              icon={<CalendarDays className="w-4 h-4" style={{ color: "#d97706" }} />}
              sublabel={`hasta fin de ${data.trimesterName}`} />
          </div>

          {/* Ritmo Diario */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="surface-card rounded-2xl p-5 flex-1 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="label">Ritmo Diario Necesario</div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(91,108,240,0.08)", border: "1px solid rgba(91,108,240,0.18)" }}>
                <Zap className="w-3 h-3" style={{ color: "#5b6cf0" }} />
                <span className="text-xs font-semibold" style={{ color: "#5b6cf0" }}>Pace</span>
              </div>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="font-display font-bold" style={{ fontSize: "3.2rem", lineHeight: 1, color: "#0f172a" }}>
                {reviewsPerDayNeeded}
              </span>
              <span className="text-sm mb-1.5" style={{ color: "#94a3b8" }}>reseñas / día</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#eef0fb" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progressPercent)}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #5b6cf0, #7c4dff)" }}
                />
              </div>
              <span className="text-xs font-bold font-display" style={{ color: "#5b6cf0" }}>
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
        style={{ height: 52, background: "#ffffff", borderTop: "1px solid #e6eaf5" }}
      >
        <RotatingMessage />

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "#f8faff", border: "1px solid #e6eaf5" }}>
            <span className="live-dot" />
            <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
              Actualizado {lastUpdatedText}
            </span>
          </div>
          <button
            onClick={() => refresh.mutate(undefined)}
            disabled={refresh.isPending}
            title="Forzar actualización"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition disabled:opacity-40 hover:opacity-80"
            style={{ background: "rgba(91,108,240,0.08)", border: "1px solid rgba(91,108,240,0.18)" }}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refresh.isPending ? "animate-spin" : ""}`} style={{ color: "#5b6cf0" }} />
            <span className="text-xs font-semibold" style={{ color: "#5b6cf0" }}>
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
      className="rounded-2xl p-4 flex flex-col justify-between"
      style={{ background: bg, border: `1px solid ${border}`, minHeight: 88 }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </div>
        {icon}
      </div>
      <div className="flex items-end justify-between mt-1.5">
        <div className="font-display font-bold" style={{ fontSize: "2.1rem", lineHeight: 1, color }}>
          {value.toLocaleString("es-ES")}{suffix && <span className="text-base ml-0.5 opacity-40">{suffix}</span>}
        </div>
        {sublabel && <span className="text-xs font-medium mb-0.5" style={{ color, opacity: 0.55 }}>{sublabel}</span>}
      </div>
    </motion.div>
  );
}
