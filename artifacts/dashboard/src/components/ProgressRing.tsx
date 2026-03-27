import { motion } from "framer-motion";
import { useMemo } from "react";

interface ProgressRingProps {
  netScore: number;
  objective: number;
  daysUntilStart?: number;
}

export function ProgressRing({ netScore, objective, daysUntilStart }: ProgressRingProps) {
  const size = 260;
  const stroke = 18;
  const radius = (size / 2) - (stroke / 2);
  const circumference = 2 * Math.PI * radius;

  const percentage = useMemo(() => {
    if (objective <= 0) return 0;
    return Math.max(0, Math.min((netScore / objective) * 100, 100));
  }, [netScore, objective]);

  const offset = circumference - (percentage / 100) * circumference;

  const isPositive = netScore >= 0;
  const strokeColor = isPositive ? "#059669" : "#dc2626";
  const textColor = isPositive ? "#059669" : "#dc2626";
  const pct = Math.round(percentage);

  return (
    <div className="flex flex-col items-center justify-center gap-5 w-full py-4">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#e2e8f0" strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={strokeColor} strokeWidth={stroke}
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
            style={{ fontSize: "4.2rem", lineHeight: 1, color: textColor }}
          >
            {netScore}
          </motion.div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">de {objective}</div>
          <div className="font-display font-bold text-slate-300 text-lg mt-0.5">{pct}%</div>
        </div>
      </div>

      {daysUntilStart !== undefined && daysUntilStart > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100">
          <span className="live-dot" style={{ background: "#3b82f6", boxShadow: "0 0 0 0 rgba(59,130,246,0.4)" }} />
          <span className="text-sm font-semibold text-blue-700">
            Q2 comienza en <span className="font-bold">{daysUntilStart} {daysUntilStart !== 1 ? "días" : "día"}</span>
          </span>
        </div>
      )}
    </div>
  );
}
