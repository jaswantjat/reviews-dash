import { motion } from "framer-motion";

interface MonthStats {
  month: string;
  positive: number;
  negative: number;
  net: number;
}

export function MonthlyBars({ data }: { data: MonthStats[] }) {
  const maxVal = Math.max(...data.map((item) => Math.max(item.positive, item.negative)), 1);

  return (
    <div className="tv-panel tv-panel-soft h-full p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="tv-kicker">Pulso Mensual</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Ritmo de sentimiento</h3>
        </div>
        <div className="tv-pill" data-tone="neutral">
          <span className="signal-dot" data-tone="neutral" />
          Seguimiento trimestral
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {data.map((item, index) => {
          const posH = Math.max(10, Math.round((item.positive / maxVal) * 100));
          const negH = Math.max(10, Math.round((item.negative / maxVal) * 100));
          const isEmpty = item.positive === 0 && item.negative === 0;

          return (
            <div key={item.month} className="flex min-w-0 flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="metric-caption text-white/70">
                  {item.month.slice(0, 3)}
                </span>
                <span
                  className={`font-mono text-sm ${
                    item.net > 0
                      ? "text-emerald-300"
                      : item.net < 0
                        ? "text-rose-300"
                        : "text-white/45"
                  }`}
                >
                  {item.net > 0 ? "+" : ""}
                  {item.net}
                </span>
              </div>

              <div className="month-bars-stage">
                <div className="month-bar-track">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: isEmpty ? "14%" : `${posH}%` }}
                    transition={{ duration: 0.7, delay: index * 0.08, ease: "easeOut" }}
                    className="month-bar month-bar-positive"
                  />
                </div>
                <div className="month-bar-track">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: isEmpty ? "14%" : `${negH}%` }}
                    transition={{ duration: 0.7, delay: 0.15 + index * 0.08, ease: "easeOut" }}
                    className="month-bar month-bar-negative"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="month-bar-stat">
                  <span className="metric-caption text-white/45">Positivas</span>
                  <span className="font-display text-2xl text-emerald-300">
                    {item.positive}
                  </span>
                </div>
                <div className="month-bar-stat">
                  <span className="metric-caption text-white/45">Negativas</span>
                  <span className="font-display text-2xl text-rose-300">
                    {item.negative}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
