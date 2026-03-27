import { motion } from "framer-motion";
import { useMemo } from "react";

interface ProgressRingProps {
  netScore: number;
  objective: number;
  daysUntilStart?: number;
}

export function ProgressRing({
  netScore,
  objective,
  daysUntilStart,
}: ProgressRingProps) {
  const size = 278;
  const stroke = 18;
  const radius = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;

  const percentage = useMemo(() => {
    if (objective <= 0) return 0;
    return Math.max(0, Math.min((netScore / objective) * 100, 100));
  }, [netScore, objective]);

  const offset = circumference - (percentage / 100) * circumference;
  const pct = Math.round(percentage);
  const isPositive = netScore >= 0;
  const gradientId = `progress-gradient-${isPositive ? "up" : "down"}`;

  return (
    <div className="progress-ring-shell">
      <div className="progress-ring-stage">
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {isPositive ? (
                <>
                  <stop offset="0%" stopColor="#62c5ff" />
                  <stop offset="60%" stopColor="#4d7dff" />
                  <stop offset="100%" stopColor="#7be7c6" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="55%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#facc15" />
                </>
              )}
            </linearGradient>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(141, 167, 210, 0.12)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
        </svg>

        <div className="progress-ring-core">
          <span className="tv-kicker">Puntuación Neta</span>
          <motion.div
            key={netScore}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`progress-ring-score ${isPositive ? "is-positive" : "is-negative"}`}
          >
            {netScore.toLocaleString("es-ES")}
          </motion.div>
          <div className="progress-ring-meta">
            <span>objetivo {objective.toLocaleString("es-ES")}</span>
            <span>{pct}% alcanzado</span>
          </div>
        </div>
      </div>

      {daysUntilStart !== undefined && daysUntilStart > 0 && (
        <div className="tv-pill" data-tone="neutral">
          <span className="signal-dot" data-tone="neutral" />
          La ventana arranca en {daysUntilStart} {daysUntilStart === 1 ? "día" : "días"}
        </div>
      )}
    </div>
  );
}
