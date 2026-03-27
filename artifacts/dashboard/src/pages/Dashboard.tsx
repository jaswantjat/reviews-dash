import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Building2,
  DatabaseZap,
  Gauge,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { differenceInDays, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { LiveClock } from "@/components/LiveClock";
import { ProgressRing } from "@/components/ProgressRing";
import { RotatingMessage } from "@/components/RotatingMessage";
import { RecentActivity } from "@/components/RecentActivity";
import { MonthlyBars } from "@/components/StatBars";
import {
  useDashboardData,
  useDashboardLiveSync,
  useTriggerRefresh,
} from "@/hooks/use-dashboard";
import eltexLogo from "@assets/eltex-logo.png";

type PillTone = "live" | "warning" | "neutral";

export default function Dashboard() {
  const { data, isLoading, isError, dataUpdatedAt } = useDashboardData();
  const { connectionState, lastEventAt } = useDashboardLiveSync();
  const refresh = useTriggerRefresh();
  const [sourceUpdatedText, setSourceUpdatedText] = useState("—");
  const [screenUpdatedText, setScreenUpdatedText] = useState("—");
  const [signalUpdatedText, setSignalUpdatedText] = useState("—");

  useEffect(() => {
    const updateRelativeTimes = () => {
      if (data?.updatedAt) {
        setSourceUpdatedText(
          formatDistanceToNow(new Date(data.updatedAt), {
            addSuffix: true,
            locale: es,
          }),
        );
      }

      if (dataUpdatedAt) {
        setScreenUpdatedText(
          formatDistanceToNow(dataUpdatedAt, {
            addSuffix: true,
            locale: es,
          }),
        );
      }

      if (lastEventAt) {
        setSignalUpdatedText(
          formatDistanceToNow(lastEventAt, {
            addSuffix: true,
            locale: es,
          }),
        );
      }
    };

    updateRelativeTimes();
    const timer = setInterval(updateRelativeTimes, 15_000);
    return () => clearInterval(timer);
  }, [data?.updatedAt, dataUpdatedAt, lastEventAt]);

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

  const remainingToGoal = data ? Math.max(0, data.objective - data.netScore) : 0;

  const reviewsPerDayNeeded = useMemo(() => {
    if (!remainingToGoal) return "0.0";
    if (!daysRemaining) return remainingToGoal.toFixed(1);
    return (remainingToGoal / daysRemaining).toFixed(1);
  }, [daysRemaining, remainingToGoal]);

  const trimesterLabel = useMemo(() => {
    if (!data) return "";
    const start = new Date(data.trimesterStart);
    const end = new Date(data.trimesterEnd);
    return `${start
      .toLocaleString("es-ES", { month: "short" })
      .toUpperCase()}–${end
      .toLocaleString("es-ES", { month: "short" })
      .toUpperCase()} ${start.getFullYear()}`;
  }, [data]);

  const progressPercent = data?.objective
    ? Math.max(0, Math.min((data.netScore / data.objective) * 100, 100))
    : 0;
  const googleTotal = data?.googleTotalReviews ?? 0;
  const googleAvg = data?.googleAvgRating ?? 0;
  const positiveShare = data?.allTimeTotal
    ? Math.round((data.allTimePositive / data.allTimeTotal) * 100)
    : 0;
  const isBaseline = data?.provider === "baseline";

  const connectionTone: PillTone = isBaseline
    ? "warning"
    : connectionState === "live"
      ? "live"
      : connectionState === "reconnecting"
        ? "warning"
        : "neutral";

  const connectionLabel = isBaseline
    ? "Snapshot de respaldo"
    : connectionState === "live"
      ? "Canal en directo"
      : connectionState === "reconnecting"
        ? "Reconectando señal"
        : "Fallback polling";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="tv-panel flex w-full max-w-xl flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="loader-orb" />
          <div>
            <div className="tv-kicker">Eltex Broadcast</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Levantando el panel
            </h1>
          </div>
          <p className="max-w-md text-sm text-slate-300">
            Cargando reputación, objetivos y actividad reciente para la pantalla
            en tiempo real.
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="tv-panel flex w-full max-w-lg flex-col items-center gap-5 px-8 py-10 text-center">
          <WifiOff className="h-10 w-10 text-rose-300" />
          <div>
            <div className="tv-kicker">Señal caída</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              No hay conexión con el dashboard
            </h1>
          </div>
          <p className="max-w-md text-sm text-slate-300">
            La aplicación no ha podido obtener los datos del servidor. Reinicia la
            vista o fuerza una nueva actualización.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="primary-action"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <header className="tv-panel tv-panel-soft flex flex-col gap-5 px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="brand-lockup">
              <div className="brand-mark">
                <img src={eltexLogo} alt="Eltex" className="h-8 w-auto" />
              </div>
              <div>
                <div className="tv-kicker">Brand Command Center</div>
                <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                  Reviews Dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Superficie TV para reputación, ritmo comercial y presión
                  operativa en una sola señal.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill tone={connectionTone} label={connectionLabel} />
              <StatusPill
                tone={isBaseline ? "warning" : "neutral"}
                label={isBaseline ? `Base ${sourceUpdatedText}` : `Fuente ${sourceUpdatedText}`}
              />
              <StatusPill tone="neutral" label={`${data.trimesterName} · ${trimesterLabel}`} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <LiveClock />
            <button
              type="button"
              onClick={() => refresh.mutate(undefined)}
              disabled={refresh.isPending}
              className="primary-action"
            >
              <RefreshCcw
                className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`}
              />
              {refresh.isPending ? "Actualizando" : "Forzar refresh"}
            </button>
          </div>
        </header>

        <main className="grid flex-1 min-h-0 gap-4 xl:grid-cols-[1.6fr_1fr]">
          <section className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="tv-panel hero-panel p-5 sm:p-6 xl:p-7">
              <div className="grid gap-8 lg:grid-cols-[minmax(250px,0.78fr)_1fr] lg:items-center">
                <ProgressRing
                  netScore={data.netScore}
                  objective={data.objective}
                  daysUntilStart={daysUntilStart}
                />

                <div className="space-y-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="tv-kicker">Performance Signal</div>
                      <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                        El marcador principal siempre visible
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                        La meta, el ritmo diario y el pulso del trimestre están
                        jerarquizados para una lectura rápida desde distancia.
                      </p>
                    </div>
                    <div className="tv-pill" data-tone="neutral">
                      <span className="signal-dot" data-tone="neutral" />
                      {daysRemaining} días restantes
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <div className="metric-caption text-white/45">Score actual</div>
                      <motion.div
                        key={data.netScore}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="hero-score brand-gradient-text"
                      >
                        {data.netScore.toLocaleString("es-ES")}
                      </motion.div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <MiniChip label="Meta" value={data.objective.toLocaleString("es-ES")} />
                        <MiniChip label="Por día" value={reviewsPerDayNeeded} />
                        <MiniChip
                          label="Actualizado"
                          value={sourceUpdatedText === "—" ? "—" : sourceUpdatedText}
                        />
                      </div>
                    </div>

                    <div className="goal-callout">
                      <div className="metric-caption text-white/45">Pendiente</div>
                      <div className="metric-value mt-2 text-white">
                        {remainingToGoal.toLocaleString("es-ES")}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        reseñas netas para alcanzar el objetivo trimestral
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                      <span>Progreso hacia la meta</span>
                      <span className="font-mono text-white">
                        {progressPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="data-rail">
                      <motion.span
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    <MetricTile
                      label="Positivas"
                      value={data.allTimePositive}
                      accent="positive"
                      icon={<TrendingUp className="h-4 w-4" />}
                      note="4–5 estrellas"
                    />
                    <MetricTile
                      label="Negativas"
                      value={data.allTimeNegative}
                      accent="negative"
                      icon={<TrendingDown className="h-4 w-4" />}
                      note="1–2 estrellas"
                    />
                    <MetricTile
                      label="Objetivo"
                      value={remainingToGoal}
                      accent="brand"
                      icon={<Target className="h-4 w-4" />}
                      note="pendientes"
                    />
                    <MetricTile
                      label="Ritmo diario"
                      value={reviewsPerDayNeeded}
                      accent="neutral"
                      icon={<Gauge className="h-4 w-4" />}
                      note="reseñas por día"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
              <MonthlyBars data={data.monthlyBreakdown ?? []} />

              <section className="tv-panel tv-panel-soft p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="tv-kicker">Cobertura</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      Mezcla de reputación
                    </h3>
                  </div>
                  <Sparkles className="h-5 w-5 text-sky-300" />
                </div>

                <div className="mt-5 space-y-3">
                  {(data.locationBreakdown ?? []).map((location) => (
                    <div key={location.name} className="location-row">
                      <div className="flex items-center gap-3">
                        <div className="location-icon">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {location.name}
                          </div>
                          <div className="metric-caption text-white/35">
                            neto {location.net > 0 ? "+" : ""}
                            {location.net}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-300">
                          +{location.positive}
                        </span>
                        <span className="text-rose-300">
                          -{location.negative}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoStat
                    label="Share positivo"
                    value={`${positiveShare}%`}
                    icon={<Activity className="h-4 w-4" />}
                  />
                  <InfoStat
                    label="Media histórica"
                    value={`${data.allTimeAvgRating.toFixed(1)}★`}
                    icon={<Star className="h-4 w-4" />}
                  />
                  <InfoStat
                    label="Fuente"
                    value={isBaseline ? "Baseline" : "Database"}
                    icon={<DatabaseZap className="h-4 w-4" />}
                  />
                  <InfoStat
                    label="Pantalla"
                    value={screenUpdatedText === "—" ? "ahora" : screenUpdatedText}
                    icon={<ShieldAlert className="h-4 w-4" />}
                  />
                </div>
              </section>
            </div>
          </section>

          <section className="grid min-h-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)]">
            <section className="tv-panel p-5 sm:p-6">
              <div className="flex flex-col gap-5 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-end">
                <div>
                  <div className="tv-kicker">Google Signal</div>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Reputación pública
                  </h3>
                  <motion.div
                    key={googleTotal}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="hero-score mt-4 text-white"
                    style={{ fontSize: "clamp(4rem, 10vw, 6.4rem)" }}
                  >
                    {googleTotal.toLocaleString("es-ES")}
                  </motion.div>
                  <p className="mt-2 text-sm text-slate-300">
                    reseñas visibles en Google Maps
                  </p>
                </div>

                <div className="reputation-card">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="metric-caption text-white/45">Valoración oficial</div>
                      <div className="metric-value mt-2 text-white">
                        {googleAvg.toFixed(1)}
                      </div>
                    </div>
                    <div className="reputation-stars">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          key={index}
                          className="h-5 w-5"
                          style={{
                            color:
                              index < Math.round(googleAvg) ? "#f8c15d" : "rgba(248, 193, 93, 0.18)",
                            fill:
                              index < Math.round(googleAvg) ? "#f8c15d" : "rgba(248, 193, 93, 0.08)",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <StatusPill tone={connectionTone} label={connectionLabel} />
                    <StatusPill
                      tone="neutral"
                      label={
                        signalUpdatedText === "—"
                          ? "Esperando primer evento"
                          : `Evento ${signalUpdatedText}`
                      }
                    />
                    <StatusPill tone="neutral" label={`UI ${screenUpdatedText}`} />
                  </div>
                </div>
              </div>
            </section>

            <RecentActivity reviews={data.recentActivity ?? []} />
          </section>
        </main>

        <footer className="tv-panel tv-panel-soft px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <RotatingMessage />
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="tv-pill" data-tone="neutral">
                <span className="signal-dot" data-tone="neutral" />
                Fuente {sourceUpdatedText}
              </span>
              <span className="tv-pill" data-tone="neutral">
                <span className="signal-dot" data-tone="neutral" />
                Panel {screenUpdatedText}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span className="tv-pill" data-tone={tone}>
      <span className="signal-dot" data-tone={tone} />
      {label}
    </span>
  );
}

function MiniChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-chip">
      <span className="metric-caption text-white/40">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  note,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  note: string;
  accent: "positive" | "negative" | "brand" | "neutral";
}) {
  return (
    <div className="metric-tile" data-accent={accent}>
      <div className="flex items-start justify-between gap-3">
        <span className="metric-caption text-white/45">{label}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <div className="metric-value mt-3 text-white">{value}</div>
      <p className="mt-2 text-sm text-slate-300">{note}</p>
    </div>
  );
}

function InfoStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="info-stat">
      <div className="info-stat-icon">{icon}</div>
      <div>
        <div className="metric-caption text-white/40">{label}</div>
        <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}
