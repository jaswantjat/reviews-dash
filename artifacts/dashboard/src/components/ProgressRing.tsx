import { motion } from "framer-motion";
import { useMemo } from "react";

interface ProgressRingProps {
  netScore: number;
  objective: number;
  daysUntilStart?: number;
}

export function ProgressRing({ netScore, objective, daysUntilStart }: ProgressRingProps) {
  const size = 248;
  const stroke = 16;
  const radius = (size / 2) - (stroke / 2);
  const circumference = 2 * Math.PI * radius;

  const percentage = useMemo(() => {
    if (objective <= 0) return 0;
    return Math.max(0, Math.min((netScore / objective) * 100, 100));
  }, [netScore, objective]);

  const offset = circumference - (percentage / 100) * circumference;

  const isPositive = netScore >= 0;
  const pct = Math.round(percentage);

  const gradientId = "progress-gradient";

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full py-3">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {isPositive ? (
                <>
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f87171" />
                </>
              )}
            </linearGradient>
          </defs>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#eef0fb" strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={`url(#${gradientId})`} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: "spring" }}
            className="font-display font-bold"
            style={{ fontSize: "4rem", lineHeight: 1, color: isPositive ? "#10b981" : "#ef4444" }}
          >
            {netScore}
          </motion.div>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94a3b8" }}>de {objective}</div>
          <div className="font-display font-bold text-base mt-0.5" style={{ color: "#cbd5e1" }}>{pct}%</div>
        </div>
      </div>

      {daysUntilStart !== undefined && daysUntilStart > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: "rgba(91,108,240,0.08)", border: "1px solid rgba(91,108,240,0.2)" }}>
          <span className="live-dot" style={{ background: "#5b6cf0", boxShadow: "0 0 0 0 rgba(91,108,240,0.4)" }} />
          <span className="text-sm font-semibold" style={{ color: "#5b6cf0" }}>
            Q2 comienza en <span className="font-bold">{daysUntilStart} {daysUntilStart !== 1 ? "días" : "día"}</span>
          </span>
        </div>
      )}
    </div>
  );
}
