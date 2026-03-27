import { motion } from "framer-motion";

interface MonthStats {
  month: string;
  positive: number;
  negative: number;
  net: number;
}

export function MonthlyBars({ data }: { data: MonthStats[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.positive, d.negative)), 1);

  return (
    <div className="card rounded-2xl p-5 flex flex-col gap-3 h-full">
      <div className="label mb-1">Monthly Breakdown</div>
      <div className="flex gap-3 flex-1 items-end">
        {data.map((item, i) => {
          const posH = Math.round((item.positive / maxVal) * 100);
          const negH = Math.round((item.negative / maxVal) * 100);
          const isEmpty = item.positive === 0 && item.negative === 0;

          return (
            <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
              {/* Numbers */}
              <div className="flex gap-2 text-xs font-bold font-display">
                {!isEmpty && (
                  <>
                    <span className="text-green-400">+{item.positive}</span>
                    {item.negative > 0 && <span className="text-red-400">−{item.negative}</span>}
                  </>
                )}
                {isEmpty && <span className="text-muted-foreground/40 text-xs">—</span>}
              </div>

              {/* Bars */}
              <div className="w-full flex gap-1 items-end" style={{ height: 80 }}>
                {/* Positive bar */}
                <div className="flex-1 flex items-end bg-white/5 rounded-lg overflow-hidden" style={{ height: 80 }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: isEmpty ? "4px" : `${Math.max(posH, 3)}%` }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                    className="w-full rounded-lg bg-green-500/70"
                  />
                </div>
                {/* Negative bar */}
                <div className="flex-1 flex items-end bg-white/5 rounded-lg overflow-hidden" style={{ height: 80 }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: isEmpty ? "4px" : `${Math.max(negH, 3)}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                    className="w-full rounded-lg bg-red-500/70"
                  />
                </div>
              </div>

              {/* Month label */}
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider text-center">
                {item.month.slice(0, 3)}
              </div>

              {/* Net */}
              <div className={`text-sm font-display font-bold ${
                item.net > 0 ? "text-green-400" : item.net < 0 ? "text-red-400" : "text-white/30"
              }`}>
                {item.net > 0 ? "+" : ""}{item.net}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/70" />
          <span className="text-xs text-white/40">Positive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500/70" />
          <span className="text-xs text-white/40">Negative</span>
        </div>
      </div>
    </div>
  );
}
