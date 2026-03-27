import { useMemo, useState, useEffect } from "react";
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
      <div className="w-screen h-screen flex flex-col items-center justify-center gap-5 bg-mesh" style={{ background: "hsl(228 14% 8%)" }}>
        <div className="w-14 h-14 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#5b6cf0", borderRightColor: "#7c4dff" }} />
        <div className="font-display font-bold text-white text-2xl">Cargando panel…</div>
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Obteniendo datos en tiempo real</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: "hsl(228 14% 8%)" }}>
        <div className="glass-card-elevated rounded-3xl p-12 flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="text-4xl">⚠️</div>
          <div className="font-display font-bold text-white text-2xl">Conexión perdida</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>No se puede conectar al servidor.</div>
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
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-mesh" style={{ background: "hsl(228 14% 8%)" }}>

      {/* ─── CABECERA ───────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-8" style={{ height: 72, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Marca con logo real */}
        <div className="flex items-center gap-4">
          <img
            src={eltexLogo}
            alt="Eltex"
            className="h-8 brightness-0 invert"
          />
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div className="font-display font-bold text-white" style={{ fontSize: "1.05rem", lineHeight: 1.1 }}>
              Panel de Reseñas
            </div>
            <div className="text-xs font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Experiencia del Cliente</div>
          </div>
        </div>

        {/* Trimestre */}
        <div className="flex items-center gap-2.5 px-5 py-2 rounded-full" style={{ background: "rgba(91,108,240,0.12)", border: "1px solid rgba(91,108,240,0.2)" }}>
          <span className="live-dot" style={{ background: "#5b6cf0", boxShadow: "0 0 0 0 rgba(91,108,240,0.4)" }} />
          <span className="font-display font-bold" style={{ color: "#8b9cf7" }}>{data.trimesterName}</span>
          <span className="text-xs font-semibold" style={{ color: "rgba(139,156,247,0.6)" }}>{trimesterLabel}</span>
        </div>

        <LiveClock />
      </header>

      {/* ─── PRINCIPAL ──────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-0"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "16px 20px" }}
      >

        {/* COL 1 — Anillo de Progreso */}
        <div className="glass-card rounded-2xl flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <div className="label">Puntuación Neta {data.trimesterName}</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ProgressRing netScore={data.netScore} objective={data.objective} daysUntilStart={daysUntilStart} />
          </div>

          {/* Tira resumen inferior */}
          <div className="mx-5 mb-5 rounded-xl p-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-center">
              <div className="font-display font-bold text-xl" style={{ color: "#34d399" }}>{data.allTimePositive}</div>
              <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Total +</div>
            </div>
            <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="text-center">
              <div className="font-display font-bold text-xl" style={{ color: "#f87171" }}>{data.allTimeNegative}</div>
              <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Total –</div>
            </div>
            <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="text-center">
              <div className="font-display font-bold text-white text-xl">{data.allTimeTotal}</div>
              <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Almacenadas</div>
            </div>
          </div>
        </div>

        {/* COL 2 — Estadísticas */}
        <div className="flex flex-col gap-3.5 min-h-0">

          {/* Google Maps En Vivo */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card-elevated rounded-2xl overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <span className="label">Google Maps · En vivo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-xl" style={{ color: "#fbbf24" }}>{googleAvg.toFixed(1)}</span>
                <Star className="w-4 h-4 fill-amber-400" style={{ color: "#fbbf24" }} />
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Total de Reseñas</div>
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="font-display font-bold text-white"
                  style={{ fontSize: "3.4rem", lineHeight: 1 }}
                >
                  {googleTotal.toLocaleString("es-ES")}
                </motion.div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="w-5 h-5"
                      style={{ color: i < Math.round(googleAvg) ? "#fbbf24" : "rgba(255,255,255,0.12)", fill: i < Math.round(googleAvg) ? "#fbbf24" : "transparent" }} />
                  ))}
                </div>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>valoración oficial en Google Maps</span>
              </div>
            </div>
          </motion.div>

          {/* 4 tarjetas de estadísticas */}
          <div className="grid grid-cols-2 gap-3.5 flex-shrink-0">
            <StatCard label="Positivas" value={data.allTimePositive ?? 0}
              color="#34d399" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.15)"
              icon={<TrendingUp className="w-4 h-4" style={{ color: "#34d399" }} />}
              sublabel="4–5★ total" />
            <StatCard label="Negativas" value={data.allTimeNegative ?? 0}
              color="#f87171" bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.15)"
              icon={<TrendingDown className="w-4 h-4" style={{ color: "#f87171" }} />}
              sublabel="1–2★ total" />
            <StatCard label={`Meta ${data.trimesterName}`} value={remainingToGoal}
              color="#8b9cf7" bg="rgba(91,108,240,0.08)" border="rgba(91,108,240,0.15)"
              icon={<Target className="w-4 h-4" style={{ color: "#8b9cf7" }} />}
              sublabel={`de ${data.objective}`} />
            <StatCard label="Días Restantes" value={daysRemaining} suffix="d"
              color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.15)"
              icon={<CalendarDays className="w-4 h-4" style={{ color: "#fbbf24" }} />}
              sublabel={`hasta fin de ${data.trimesterName}`} />
          </div>

          {/* Ritmo Diario */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card-elevated rounded-2xl p-5 flex-1 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="label">Ritmo Diario Necesario</div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(91,108,240,0.1)", border: "1px solid rgba(91,108,240,0.15)" }}>
                <Zap className="w-3 h-3" style={{ color: "#8b9cf7" }} />
                <span className="text-xs font-semibold" style={{ color: "#8b9cf7" }}>Pace</span>
              </div>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <span className="font-display font-bold text-white" style={{ fontSize: "3.4rem", lineHeight: 1 }}>
                {reviewsPerDayNeeded}
              </span>
              <span className="text-sm mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>reseñas / día</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progressPercent)}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #5b6cf0, #7c4dff)" }}
                />
              </div>
              <span className="text-xs font-bold font-display" style={{ color: "rgba(255,255,255,0.5)" }}>
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
        className="flex-shrink-0 flex items-center justify-between px-8 gap-6"
        style={{ height: 56, borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <RotatingMessage />

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="live-dot" />
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
              Actualizado {lastUpdatedText}
            </span>
          </div>
          <button
            onClick={() => refresh.mutate(undefined)}
            disabled={refresh.isPending}
            title="Forzar actualización"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition disabled:opacity-40 hover:opacity-80"
            style={{ background: "rgba(91,108,240,0.12)", border: "1px solid rgba(91,108,240,0.2)" }}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refresh.isPending ? "animate-spin" : ""}`} style={{ color: "#8b9cf7" }} />
            <span className="text-xs font-semibold" style={{ color: "#8b9cf7" }}>
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
      style={{ background: bg, borderWidth: 1, borderStyle: "solid", borderColor: border, minHeight: 96 }}
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
        {sublabel && <span className="text-xs font-medium mb-0.5" style={{ color, opacity: 0.5 }}>{sublabel}</span>}
      </div>
    </motion.div>
  );
}
